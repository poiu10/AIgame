import { ENEMY_KINDS, type WorldDefinition } from "../../content/world";
import { rectanglesOverlap } from "../collision/aabb";
import { moveBodyAgainstTerrain } from "../collision/motion";
import {
  ENEMY_CONFIG,
  getEnemyBodySize,
  STAGE_ONE_CONFIG,
} from "../rules/config";
import { getEnemyAttackBounds } from "../rules/combat";
import { getPlayerBounds } from "../rules/player";
import type { EnemyState, GameState } from "../state";
import { damagePlayer } from "./combat";
import { emitSound } from "./sound";

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

function bodyTouchesPlayer(state: GameState, enemy: EnemyState): boolean {
  const body = getEnemyBodySize(enemy.kind);
  return rectanglesOverlap(
    {
      x: enemy.position.x - body.width / 2,
      y: enemy.position.y - body.height / 2,
      width: body.width,
      height: body.height,
    },
    getPlayerBounds(state.player),
  );
}

function updateEnemyPulse(
  state: GameState,
  enemy: EnemyState,
  deltaSeconds: number,
  interval: number,
  distance: number,
): void {
  enemy.timeUntilPulse -= deltaSeconds;
  if (enemy.timeUntilPulse > 0) return;
  emitSound(state, "enemy-step", enemy.position, distance, 0.72, enemy.id);
  enemy.timeUntilPulse += interval;
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
  } else {
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
  if (bodyTouchesPlayer(state, enemy)) damagePlayer(state, enemy.facing);
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

  updateEnemyPulse(
    state,
    enemy,
    deltaSeconds,
    STAGE_ONE_CONFIG.wakerPulseIntervalSeconds,
    STAGE_ONE_CONFIG.wakerPulseDistance,
  );
  enemy.action = "pursue";
  const deltaX = state.player.position.x - enemy.position.x;
  const deltaY = state.player.position.y - enemy.position.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance > 0.001 && state.status === "playing") {
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
  if (bodyTouchesPlayer(state, enemy)) damagePlayer(state, enemy.facing);
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
      );
      continue;
    }
    if (enemy.kind === ENEMY_KINDS.flyer) {
      updateFlyer(state, enemy, deltaSeconds);
      continue;
    }
    if (enemy.kind === ENEMY_KINDS.waker) {
      updateWaker(state, enemy, deltaSeconds);
      continue;
    }
    if (enemy.action === "alert") {
      enemy.actionTime += deltaSeconds;
      enemy.velocity.x = 0;
      if (enemy.actionTime >= ENEMY_CONFIG.alertSeconds) {
        enemy.action = "attack";
        enemy.actionTime = 0;
        emitSound(state, "enemy-attack", enemy.position, 680, 1, enemy.id);
      }
    } else if (enemy.action === "attack") {
      enemy.actionTime += deltaSeconds;
      enemy.velocity.x = 0;
      if (enemy.actionTime >= ENEMY_CONFIG.attackSeconds) {
        enemy.action = "patrol";
        enemy.actionTime = 0;
        enemy.attackCooldown = ENEMY_CONFIG.attackCooldownSeconds;
      }
    } else if (enemy.action === "hurt") {
      enemy.actionTime += deltaSeconds;
      enemy.velocity.x *= Math.max(0, 1 - 7 * deltaSeconds);
      if (enemy.actionTime >= ENEMY_CONFIG.hurtSeconds) {
        enemy.action = "patrol";
        enemy.actionTime = 0;
      }
    } else {
      enemy.actionTime = 0;
      const playerDeltaX = state.player.position.x - enemy.position.x;
      if (
        state.status === "playing" &&
        enemy.attackCooldown <= 0 &&
        playerInAttackRange(state, enemy)
      ) {
        enemy.action = "alert";
        enemy.actionTime = 0;
        enemy.facing = playerDeltaX < 0 ? -1 : 1;
        enemy.attackFacing = enemy.facing;
        enemy.velocity.x = 0;
        emitSound(
          state,
          "enemy-alert",
          enemy.position,
          ENEMY_CONFIG.alertWaveDistance,
          ENEMY_CONFIG.alertWaveIntensity,
          enemy.id,
        );
      } else {
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

    if (enemy.action === "attack" && attackTouchesPlayer(state, enemy)) {
      damagePlayer(state, enemy.attackFacing);
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
