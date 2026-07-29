import type { WorldDefinition } from "../../content/world";
import { centerRect, rectanglesOverlap } from "../collision/aabb";
import { moveBodyAgainstTerrain } from "../collision/motion";
import { ENEMY_CONFIG, PLAYER_CONFIG } from "../rules/config";
import { getEnemyAttackBounds } from "../rules/combat";
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
    centerRect(
      state.player.position,
      PLAYER_CONFIG.width,
      PLAYER_CONFIG.height,
    ),
  );
}

export function updateEnemies(
  state: GameState,
  world: WorldDefinition,
  deltaSeconds: number,
): void {
  for (const enemy of state.enemies) {
    if (!enemy.alive) {
      continue;
    }

    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - deltaSeconds);
    if (enemy.action === "attack") {
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
        enemy.action = "attack";
        enemy.actionTime = 0;
        enemy.facing = playerDeltaX < 0 ? -1 : 1;
        enemy.velocity.x = 0;
        emitSound(state, "enemy-attack", enemy.position, 340, 1, enemy.id);
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
      ENEMY_CONFIG.width,
      ENEMY_CONFIG.height,
      world.terrain,
      deltaSeconds,
    );

    if (motion.hitWall && enemy.action === "patrol") {
      enemy.facing = enemy.facing === 1 ? -1 : 1;
    }

    if (enemy.action === "attack" && attackTouchesPlayer(state, enemy)) {
      damagePlayer(state, enemy.facing);
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
            y: enemy.position.y + ENEMY_CONFIG.height / 2 - 1,
          },
          180,
          0.62,
          enemy.id,
        );
      }
    }
  }
}
