import type { RectState } from "../../content/world";
import type { EnemyState, PlayerState } from "../state";
import { PLAYER_CONFIG } from "./config";

export const PLAYER_GROUND_ATTACK_HITBOX = {
  width: 64,
  height: 60,
  verticalOffset: 0,
} as const;

export const PLAYER_AIR_ATTACK_HITBOX = {
  width: 64,
  height: 70,
  verticalOffset: -4,
} as const;

export const ENEMY_ATTACK_HITBOX = {
  reach: 62,
  height: 48,
} as const;

export function getPlayerAttackBounds(player: PlayerState): RectState {
  const hitbox = player.attackAirborne
    ? PLAYER_AIR_ATTACK_HITBOX
    : PLAYER_GROUND_ATTACK_HITBOX;
  return {
    x:
      player.attackFacing > 0
        ? player.position.x + PLAYER_CONFIG.width / 2
        : player.position.x -
          PLAYER_CONFIG.width / 2 -
          hitbox.width,
    y:
      player.position.y -
      hitbox.height / 2 +
      hitbox.verticalOffset,
    width: hitbox.width,
    height: hitbox.height,
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
