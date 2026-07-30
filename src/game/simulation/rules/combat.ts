import type { RectState } from "../../content/world";
import type { EnemyState, PlayerState } from "../state";
import { PLAYER_CONFIG } from "./config";

export const PLAYER_ATTACK_HITBOX = {
  width: 64,
  height: 52,
  verticalOffset: 4,
} as const;

export const ENEMY_ATTACK_HITBOX = {
  reach: 62,
  height: 48,
} as const;

export function getPlayerAttackBounds(player: PlayerState): RectState {
  return {
    x:
      player.attackFacing > 0
        ? player.position.x + PLAYER_CONFIG.width / 2
        : player.position.x -
          PLAYER_CONFIG.width / 2 -
          PLAYER_ATTACK_HITBOX.width,
    y:
      player.position.y -
      PLAYER_ATTACK_HITBOX.height / 2 +
      PLAYER_ATTACK_HITBOX.verticalOffset,
    width: PLAYER_ATTACK_HITBOX.width,
    height: PLAYER_ATTACK_HITBOX.height,
  };
}

export function getEnemyAttackBounds(enemy: EnemyState): RectState {
  return {
    x:
      enemy.attackFacing > 0
        ? enemy.position.x
        : enemy.position.x - ENEMY_ATTACK_HITBOX.reach,
    y: enemy.position.y - ENEMY_ATTACK_HITBOX.height / 2,
    width: ENEMY_ATTACK_HITBOX.reach,
    height: ENEMY_ATTACK_HITBOX.height,
  };
}
