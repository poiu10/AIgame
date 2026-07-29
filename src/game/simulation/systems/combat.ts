import type { WorldDefinition } from "../../content/world";
import { centerRect, rectanglesOverlap } from "../collision/aabb";
import { ENEMY_CONFIG, PLAYER_CONFIG } from "../rules/config";
import type { GameState } from "../state";
import { emitSound } from "./sound";

export function damagePlayer(
  state: GameState,
  knockbackDirection: -1 | 1,
): boolean {
  const player = state.player;
  if (
    player.action === "dead" ||
    player.invulnerabilityTime > 0 ||
    state.status !== "playing"
  ) {
    return false;
  }

  player.health -= 1;
  player.invulnerabilityTime = PLAYER_CONFIG.damageInvulnerabilitySeconds;
  player.velocity.x = knockbackDirection * 330;
  player.velocity.y = -280;
  player.actionTime = 0;
  player.attackHitIds = [];

  if (player.health <= 0) {
    player.health = 0;
    player.action = "dead";
    player.velocity.x = 0;
    player.velocity.y = 0;
    state.status = "failed";
    emitSound(state, "death", player.position, 720, 1);
  } else {
    player.action = "hurt";
    emitSound(state, "hurt", player.position, 500, 0.86);
  }
  state.events.push({ type: "impact", position: { ...player.position }, strength: 1 });
  return true;
}

function defeatEnemy(state: GameState, enemyIndex: number): void {
  const enemy = state.enemies[enemyIndex];
  enemy.health = 0;
  enemy.alive = false;
  enemy.action = "dead";
  enemy.echoTime = 1;
  enemy.echoDuration = 1;
  emitSound(state, "death", enemy.position, 720, 1, enemy.id);
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

  const attackWidth = 58;
  const attackHeight = 38;
  const hitbox = {
    x:
      player.facing > 0
        ? player.position.x + PLAYER_CONFIG.width / 2
        : player.position.x - PLAYER_CONFIG.width / 2 - attackWidth,
    y: player.position.y - attackHeight / 2,
    width: attackWidth,
    height: attackHeight,
  };

  state.enemies.forEach((enemy, enemyIndex) => {
    if (
      !enemy.alive ||
      player.attackHitIds.includes(enemy.id) ||
      !rectanglesOverlap(
        hitbox,
        centerRect(enemy.position, ENEMY_CONFIG.width, ENEMY_CONFIG.height),
      )
    ) {
      return;
    }

    player.attackHitIds.push(enemy.id);
    enemy.health -= 1;
    enemy.action = "hurt";
    enemy.actionTime = 0;
    enemy.velocity.x = player.facing * 240;
    enemy.velocity.y = -120;
    enemy.echoTime = 0.72;
    enemy.echoDuration = 0.72;
    emitSound(state, "attack-hit", enemy.position, 520, 0.9, enemy.id);
    state.events.push({
      type: "impact",
      position: { ...enemy.position },
      strength: 0.8,
    });

    if (enemy.health <= 0) {
      defeatEnemy(state, enemyIndex);
    }
  });

  for (const block of world.terrain) {
    const hitId = `terrain:${block.id}`;
    if (
      player.attackHitIds.includes(hitId) ||
      !rectanglesOverlap(hitbox, block.bounds)
    ) {
      continue;
    }

    player.attackHitIds.push(hitId);
    const hitPosition = {
      x:
        player.facing > 0
          ? Math.min(hitbox.x + hitbox.width, block.bounds.x) - player.facing
          : Math.max(hitbox.x, block.bounds.x + block.bounds.width) - player.facing,
      y: Math.min(
        Math.max(player.position.y, block.bounds.y),
        block.bounds.y + block.bounds.height,
      ),
    };
    emitSound(state, "attack-hit", hitPosition, 460, 0.76);
    state.events.push({ type: "impact", position: hitPosition, strength: 0.45 });
  }

  if (state.enemies.every((enemy) => !enemy.alive)) {
    state.status = "completed";
  }
}
