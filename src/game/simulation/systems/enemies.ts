import { ENEMY_KINDS, type WorldDefinition } from "../../content/world";
import { rectanglesOverlap } from "../collision/aabb";
import { moveBodyAgainstTerrain } from "../collision/motion";
import {
  ENEMY_CONFIG,
  getEnemyBodySize,
  MELEE_ATTACK_WAVE_CONFIG,
  STAGE_ONE_CONFIG,
  STAGE_TWO_CONFIG,
} from "../rules/config";
import { getEnemyAttackBounds } from "../rules/combat";
import { getPlayerBounds } from "../rules/player";
import type { EnemyState, GameState, SoundKind } from "../state";
import { damagePlayer } from "./combat";
import { emitSound } from "./sound";

type MobileEnemyAction = "patrol" | "fly" | "pursue";

function playerInAttackRange(state: GameState, enemy: EnemyState): boolean {
  return (
    Math.abs(state.player.position.x - enemy.position.x) <=
      ENEMY_CONFIG.attackRangeX &&
    Math.abs(state.player.position.y - enemy.position.y) <=
      ENEMY_CONFIG.attackRangeY
  );
}

function attackTouchesPlayer(state: GameState, enemy: EnemyState): boolean {
  return rectanglesOverlap(
    getEnemyAttackBounds(enemy),
    getPlayerBounds(state.player),
  );
}

function updateEnemyPulse(
  state: GameState,
  enemy: EnemyState,
  deltaSeconds: number,
  interval: number,
  distance: number,
  kind: SoundKind,
  intensity: number,
): void {
  enemy.timeUntilPulse -= deltaSeconds;
  if (enemy.timeUntilPulse > 0) return;
  emitSound(state, kind, enemy.position, distance, intensity, enemy.id);
  enemy.timeUntilPulse += interval;
}

function beginEnemyAlert(state: GameState, enemy: EnemyState): boolean {
  if (
    state.player.action === "dead" ||
    enemy.attackCooldown > 0 ||
    !playerInAttackRange(state, enemy)
  ) {
    return false;
  }

  enemy.action = "alert";
  enemy.actionTime = 0;
  enemy.facing = state.player.position.x < enemy.position.x ? -1 : 1;
  enemy.attackFacing = enemy.facing;
  enemy.velocity = { x: 0, y: 0 };
  emitSound(
    state,
    "enemy-alert",
    enemy.position,
    ENEMY_CONFIG.alertWaveDistance,
    ENEMY_CONFIG.alertWaveIntensity,
    enemy.id,
  );
  return true;
}

function updateEnemyAttackSequence(
  state: GameState,
  enemy: EnemyState,
  deltaSeconds: number,
  resumeAction: MobileEnemyAction,
): boolean {
  if (enemy.action === "alert") {
    enemy.actionTime += deltaSeconds;
    enemy.velocity = { x: 0, y: 0 };
    if (enemy.actionTime >= ENEMY_CONFIG.alertSeconds) {
      enemy.action = "attack";
      enemy.actionTime = 0;
      emitSound(
        state,
        "enemy-attack",
        enemy.position,
        MELEE_ATTACK_WAVE_CONFIG.distance,
        MELEE_ATTACK_WAVE_CONFIG.intensity,
        enemy.id,
      );
    }
  } else if (enemy.action === "attack") {
    enemy.actionTime += deltaSeconds;
    enemy.velocity = { x: 0, y: 0 };
    if (enemy.actionTime >= ENEMY_CONFIG.attackSeconds) {
      enemy.action = resumeAction;
      enemy.actionTime = 0;
      enemy.attackCooldown = ENEMY_CONFIG.attackCooldownSeconds;
    }
  } else {
    return false;
  }

  if (enemy.action === "attack" && attackTouchesPlayer(state, enemy)) {
    damagePlayer(state, enemy.attackFacing);
  }
  return true;
}

function updateFlyer(
  state: GameState,
  enemy: EnemyState,
  deltaSeconds: number,
): void {
  if (enemy.action === "hurt") {
    enemy.actionTime += deltaSeconds;
    enemy.position.x += enemy.velocity.x * deltaSeconds;
    enemy.position.y += enemy.velocity.y * deltaSeconds;
    enemy.velocity.x *= Math.max(0, 1 - 7 * deltaSeconds);
    enemy.velocity.y *= Math.max(0, 1 - 7 * deltaSeconds);
    if (enemy.actionTime >= ENEMY_CONFIG.hurtSeconds) {
      enemy.action = "fly";
      enemy.actionTime = 0;
      enemy.velocity.y = 0;
    }
    return;
  }
  if (updateEnemyAttackSequence(state, enemy, deltaSeconds, "fly")) return;
  if (beginEnemyAlert(state, enemy)) return;

  enemy.action = "fly";
  if (enemy.position.x <= enemy.patrolMinX) enemy.facing = 1;
  if (enemy.position.x >= enemy.patrolMaxX) enemy.facing = -1;
  enemy.velocity.x = enemy.facing * STAGE_ONE_CONFIG.flyerSpeed;
  enemy.velocity.y = 0;
  enemy.position.x = Math.max(
    enemy.patrolMinX,
    Math.min(enemy.patrolMaxX, enemy.position.x + enemy.velocity.x * deltaSeconds),
  );
}

function updateWaker(
  state: GameState,
  enemy: EnemyState,
  deltaSeconds: number,
): void {
  if (!enemy.activated) {
    enemy.action = "sleep";
    enemy.velocity = { x: 0, y: 0 };
    return;
  }

  if (enemy.action === "eject") {
    enemy.actionTime += deltaSeconds;
    enemy.position.x += enemy.velocity.x * deltaSeconds;
    enemy.position.y += enemy.velocity.y * deltaSeconds;
    enemy.velocity.y +=
      STAGE_TWO_CONFIG.phaseOneEjectGravity * deltaSeconds;
    if (enemy.actionTime >= STAGE_TWO_CONFIG.phaseOneEjectSeconds) {
      enemy.action = "pursue";
      enemy.actionTime = 0;
    }
    return;
  }

  if (enemy.action === "hurt") {
    enemy.actionTime += deltaSeconds;
    enemy.position.x += enemy.velocity.x * deltaSeconds;
    enemy.position.y += enemy.velocity.y * deltaSeconds;
    enemy.velocity.x *= Math.max(0, 1 - 7 * deltaSeconds);
    enemy.velocity.y *= Math.max(0, 1 - 7 * deltaSeconds);
    if (enemy.actionTime >= ENEMY_CONFIG.hurtSeconds) {
      enemy.action = "pursue";
      enemy.actionTime = 0;
    }
    return;
  }
  if (updateEnemyAttackSequence(state, enemy, deltaSeconds, "pursue")) return;
  if (beginEnemyAlert(state, enemy)) return;

  enemy.action = "pursue";
  const deltaX = state.player.position.x - enemy.position.x;
  const deltaY = state.player.position.y - enemy.position.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance > 0.001 && state.player.action !== "dead") {
    enemy.velocity.x +=
      (deltaX / distance) * STAGE_ONE_CONFIG.wakerAcceleration * deltaSeconds;
    enemy.velocity.y +=
      (deltaY / distance) * STAGE_ONE_CONFIG.wakerAcceleration * deltaSeconds;
  }
  const speed = Math.hypot(enemy.velocity.x, enemy.velocity.y);
  if (speed > STAGE_ONE_CONFIG.wakerMaximumSpeed) {
    const scale = STAGE_ONE_CONFIG.wakerMaximumSpeed / speed;
    enemy.velocity.x *= scale;
    enemy.velocity.y *= scale;
  }
  enemy.position.x += enemy.velocity.x * deltaSeconds;
  enemy.position.y += enemy.velocity.y * deltaSeconds;
  if (Math.abs(enemy.velocity.x) > 1) enemy.facing = enemy.velocity.x < 0 ? -1 : 1;
}

export function updateEnemies(
  state: GameState,
  world: WorldDefinition,
  deltaSeconds: number,
): void {
  for (const enemy of state.enemies) {
    const body = getEnemyBodySize(enemy.kind);
    if (!enemy.alive) {
      enemy.actionTime += deltaSeconds;
      if (!enemy.grounded) {
        enemy.velocity.x *= Math.max(0, 1 - 4 * deltaSeconds);
        enemy.velocity.y = Math.min(
          enemy.velocity.y + ENEMY_CONFIG.gravity * deltaSeconds,
          ENEMY_CONFIG.maxFallSpeed,
        );
        moveBodyAgainstTerrain(
          enemy,
          body.width,
          body.height,
          world.terrain,
          deltaSeconds,
        );
      } else {
        enemy.velocity.x = 0;
        enemy.velocity.y = 0;
      }
      continue;
    }

    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - deltaSeconds);
    if (
      enemy.kind === ENEMY_KINDS.cocoonBoss ||
      enemy.kind === ENEMY_KINDS.ravenBoss
    ) {
      if (enemy.action === "hurt") {
        enemy.actionTime += deltaSeconds;
        if (enemy.actionTime >= ENEMY_CONFIG.hurtSeconds) {
          enemy.action = enemy.kind === ENEMY_KINDS.ravenBoss ? "fly" : "sleep";
          enemy.actionTime = 0;
        }
      } else {
        enemy.action = enemy.kind === ENEMY_KINDS.ravenBoss ? "fly" : "sleep";
      }
      enemy.grounded = false;
      enemy.velocity = { x: 0, y: 0 };
      continue;
    }
    if (enemy.kind === ENEMY_KINDS.sleeper) {
      enemy.action = "sleep";
      enemy.grounded = true;
      enemy.velocity = { x: 0, y: 0 };
      updateEnemyPulse(
        state,
        enemy,
        deltaSeconds,
        STAGE_ONE_CONFIG.sleeperPulseIntervalSeconds,
        STAGE_ONE_CONFIG.sleeperPulseDistance,
        "sleep",
        0.72,
      );
      continue;
    }
    if (enemy.kind === ENEMY_KINDS.flyer) {
      updateEnemyPulse(
        state,
        enemy,
        deltaSeconds,
        STAGE_ONE_CONFIG.activeEnemyPulseIntervalSeconds,
        STAGE_ONE_CONFIG.flyerPulseDistance,
        "enemy-call",
        STAGE_ONE_CONFIG.activeEnemyPulseIntensity,
      );
      updateFlyer(state, enemy, deltaSeconds);
      continue;
    }
    if (enemy.kind === ENEMY_KINDS.waker) {
      if (enemy.activated) {
        updateEnemyPulse(
          state,
          enemy,
          deltaSeconds,
          STAGE_ONE_CONFIG.activeEnemyPulseIntervalSeconds,
          STAGE_ONE_CONFIG.wakerPulseDistance,
          "waker-call",
          STAGE_ONE_CONFIG.activeEnemyPulseIntensity,
        );
      }
      updateWaker(state, enemy, deltaSeconds);
      continue;
    }
    if (updateEnemyAttackSequence(state, enemy, deltaSeconds, "patrol")) {
      // 공격 상태는 공통 처리하고, 지상 적의 중력·지형 충돌은 아래에서 유지한다.
    } else if (enemy.action === "hurt") {
      enemy.actionTime += deltaSeconds;
      enemy.velocity.x *= Math.max(0, 1 - 7 * deltaSeconds);
      if (enemy.actionTime >= ENEMY_CONFIG.hurtSeconds) {
        enemy.action = "patrol";
        enemy.actionTime = 0;
      }
    } else {
      enemy.actionTime = 0;
      if (!beginEnemyAlert(state, enemy)) {
        if (enemy.position.x <= enemy.patrolMinX) {
          enemy.facing = 1;
        } else if (enemy.position.x >= enemy.patrolMaxX) {
          enemy.facing = -1;
        }
        enemy.velocity.x = enemy.facing * ENEMY_CONFIG.patrolSpeed;
      }
    }

    enemy.velocity.y = Math.min(
      enemy.velocity.y + ENEMY_CONFIG.gravity * deltaSeconds,
      ENEMY_CONFIG.maxFallSpeed,
    );
    const motion = moveBodyAgainstTerrain(
      enemy,
      body.width,
      body.height,
      world.terrain,
      deltaSeconds,
    );

    if (motion.hitWall && enemy.action === "patrol") {
      enemy.facing = enemy.facing === 1 ? -1 : 1;
    }

    if (enemy.grounded && enemy.action === "patrol") {
      enemy.footstepTravel += Math.abs(motion.movedX);
      if (enemy.footstepTravel >= ENEMY_CONFIG.footstepDistance) {
        enemy.footstepTravel %= ENEMY_CONFIG.footstepDistance;
        emitSound(
          state,
          "enemy-step",
          {
            x: enemy.position.x,
            y: enemy.position.y + ENEMY_CONFIG.height / 2 - 2,
          },
          360,
          0.62,
          enemy.id,
        );
      }
    }
  }
}
