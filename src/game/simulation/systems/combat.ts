import {
  ENEMY_KINDS,
  TERRAIN_KINDS,
  type WorldDefinition,
} from "../../content/world";
import { centerRect, rectanglesOverlap } from "../collision/aabb";
import {
  ENEMY_CONFIG,
  ENEMY_HIT_WAVE_CONFIG,
  getEnemyBodySize,
  PLAYER_CONFIG,
  STAGE_ONE_CONFIG,
} from "../rules/config";
import { getPlayerAttackBounds } from "../rules/combat";
import { getPlayerBounds } from "../rules/player";
import type { EnemyState, Facing, GameState } from "../state";
import { emitSound } from "./sound";
import { getActiveTerrain, pressTerrainButton } from "./stageMechanisms";

export function killPlayer(state: GameState): boolean {
  const player = state.player;
  if (player.action === "dead") return false;
  player.health = 0;
  player.action = "dead";
  player.actionTime = 0;
  player.attackHitIds = [];
  player.hitboxOffsetX = 0;
  player.velocity.x = 0;
  player.velocity.y = 0;
  state.events.push({ type: "impact", position: { ...player.position }, strength: 1 });
  return true;
}

export function damagePlayer(
  state: GameState,
  knockbackDirection: -1 | 1,
): boolean {
  const player = state.player;
  if (
    player.action === "dead" ||
    player.action === "roll" ||
    player.invulnerabilityTime > 0
  ) {
    return false;
  }

  player.health -= 1;
  player.invulnerabilityTime = PLAYER_CONFIG.damageInvulnerabilitySeconds;
  player.velocity.x = knockbackDirection * 660;
  player.velocity.y = -560;
  player.actionTime = 0;
  player.attackHitIds = [];
  player.hitboxOffsetX = 0;

  if (player.health <= 0) {
    killPlayer(state);
    return true;
  }
  player.action = "hurt";
  state.events.push({ type: "impact", position: { ...player.position }, strength: 1 });
  return true;
}

function defeatEnemy(state: GameState, enemy: EnemyState): void {
  enemy.health = 0;
  enemy.alive = false;
  enemy.action = "dead";
  enemy.actionTime = 0;
  emitSound(state, "enemy-death", enemy.position, 720, 1, enemy.id);
  enemy.echoTime = ENEMY_CONFIG.deathRevealSeconds;
  enemy.echoDuration = ENEMY_CONFIG.deathRevealSeconds;
}

export function damageEnemy(
  state: GameState,
  enemy: EnemyState,
  knockbackDirection: Facing,
): boolean {
  if (!enemy.alive) {
    return false;
  }

  enemy.health -= 1;
  enemy.action = "hurt";
  enemy.actionTime = 0;
  enemy.velocity.x = knockbackDirection * 480;
  enemy.velocity.y = -240;
  enemy.echoTime = 0.72;
  enemy.echoDuration = 0.72;
  state.events.push({
    type: "impact",
    position: { ...enemy.position },
    strength: 0.8,
  });

  if (enemy.health <= 0) {
    defeatEnemy(state, enemy);
  } else {
    emitSound(
      state,
      "enemy-hit",
      enemy.position,
      ENEMY_HIT_WAVE_CONFIG.distance,
      ENEMY_HIT_WAVE_CONFIG.intensity,
      enemy.id,
    );
  }
  return true;
}

export function updatePlayerCombat(
  state: GameState,
  world: WorldDefinition,
): void {
  const player = state.player;
  if (
    player.action !== "attack" ||
    player.actionTime < PLAYER_CONFIG.attackActiveStart ||
    player.actionTime > PLAYER_CONFIG.attackActiveEnd
  ) {
    return;
  }

  const hitbox = getPlayerAttackBounds(player);

  state.enemies.forEach((enemy) => {
    const body = getEnemyBodySize(enemy.kind);
    if (
      !enemy.alive ||
      player.attackHitIds.includes(enemy.id) ||
      !rectanglesOverlap(
        hitbox,
        centerRect(enemy.position, body.width, body.height),
      )
    ) {
      return;
    }

    player.attackHitIds.push(enemy.id);
    damageEnemy(state, enemy, player.attackFacing);
  });

  for (const block of getActiveTerrain(state, world)) {
    const hitId = `terrain:${block.id}`;
    if (
      player.attackHitIds.includes(hitId) ||
      !rectanglesOverlap(hitbox, block.bounds)
    ) {
      continue;
    }

    player.attackHitIds.push(hitId);
    const buttonPressed = pressTerrainButton(state, world, block.id);
    if (buttonPressed) {
      const openingDoor = world.terrain.find(
        (candidate) => candidate.kind === TERRAIN_KINDS.opensOnButton,
      );
      if (openingDoor) {
        emitSound(
          state,
          "door-open",
          {
            x: openingDoor.bounds.x + openingDoor.bounds.width / 2,
            y: openingDoor.bounds.y + openingDoor.bounds.height / 2,
          },
          STAGE_ONE_CONFIG.openingDoorSoundDistance,
          1,
          openingDoor.id,
        );
      }
    }
    const hitPosition = {
      x:
        player.facing > 0
          ? Math.min(hitbox.x + hitbox.width, block.bounds.x) - player.facing * 2
          : Math.max(hitbox.x, block.bounds.x + block.bounds.width) - player.facing * 2,
      y: Math.min(
        Math.max(player.position.y, block.bounds.y),
        block.bounds.y + block.bounds.height,
      ),
    };
    state.events.push({ type: "impact", position: hitPosition, strength: 0.45 });
  }
}

export function updateEnemyContactDamage(state: GameState): void {
  const playerBounds = getPlayerBounds(state.player);

  for (const enemy of state.enemies) {
    if (!enemy.alive || enemy.kind === ENEMY_KINDS.cocoonBoss) continue;

    const body = getEnemyBodySize(enemy.kind);
    if (
      !rectanglesOverlap(
        playerBounds,
        centerRect(enemy.position, body.width, body.height),
      )
    ) {
      continue;
    }

    const knockbackDirection: Facing =
      state.player.position.x <= enemy.position.x ? -1 : 1;
    damagePlayer(state, knockbackDirection);
    return;
  }
}
