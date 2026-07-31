import type { WorldDefinition } from "../../content/world";
import { centerRect, rectanglesOverlap } from "../collision/aabb";
import { ENEMY_CONFIG, PLAYER_CONFIG } from "../rules/config";
import type { GameState } from "../state";
import { damageEnemy, damagePlayer } from "./combat";
import { emitSound } from "./sound";

const HAZARD_REVEAL_SECONDS = 0.62;

export function updateWorldEnvironment(
  state: GameState,
  world: WorldDefinition,
  deltaSeconds: number,
): void {
  for (const hazard of state.hazards) {
    hazard.echoTime = Math.max(0, hazard.echoTime - deltaSeconds);
  }

  for (const emitterState of state.worldSoundEmitters) {
    const definition = world.soundEmitters?.find(
      (emitter) => emitter.id === emitterState.id,
    );
    if (!definition) {
      continue;
    }

    emitterState.timeUntilPulse -= deltaSeconds;
    if (emitterState.timeUntilPulse > 0) {
      continue;
    }

    emitSound(
      state,
      definition.kind,
      definition.position,
      definition.maximumDistance,
      definition.intensity,
    );
    emitterState.timeUntilPulse += definition.intervalSeconds;

    if (definition.revealsHazardId) {
      const hazard = state.hazards.find(
        (candidate) => candidate.id === definition.revealsHazardId,
      );
      if (hazard) {
        hazard.echoTime = HAZARD_REVEAL_SECONDS;
        hazard.echoDuration = HAZARD_REVEAL_SECONDS;
      }
    }
  }

  const playerBounds = centerRect(
    state.player.position,
    PLAYER_CONFIG.width,
    PLAYER_CONFIG.height,
  );
  for (const hazard of world.hazards ?? []) {
    if (
      !rectanglesOverlap(playerBounds, hazard.bounds) ||
      state.player.action === "roll"
    ) {
      continue;
    }

    const hazardCenterX = hazard.bounds.x + hazard.bounds.width / 2;
    const rejectionDirection = state.player.position.x < hazardCenterX ? -1 : 1;
    damagePlayer(state, rejectionDirection);
    state.player.position.x =
      rejectionDirection < 0
        ? hazard.bounds.x - PLAYER_CONFIG.width / 2
        : hazard.bounds.x + hazard.bounds.width + PLAYER_CONFIG.width / 2;
    state.player.velocity.x = rejectionDirection * 660;
  }

  for (const enemy of state.enemies) {
    if (!enemy.alive || enemy.hazardInvulnerabilityTime > 0) {
      continue;
    }
    const enemyBounds = centerRect(
      enemy.position,
      ENEMY_CONFIG.width,
      ENEMY_CONFIG.height,
    );
    for (const hazard of world.hazards ?? []) {
      if (!rectanglesOverlap(enemyBounds, hazard.bounds)) {
        continue;
      }
      const hazardCenterX = hazard.bounds.x + hazard.bounds.width / 2;
      const rejectionDirection = enemy.position.x < hazardCenterX ? -1 : 1;
      if (damageEnemy(state, enemy, rejectionDirection)) {
        enemy.hazardInvulnerabilityTime =
          ENEMY_CONFIG.hazardDamageCooldownSeconds;
        if (enemy.alive) {
          emitSound(state, "hurt", enemy.position, 500, 0.86, enemy.id);
        }
      }
      break;
    }
  }
}

export function updateTutorialProgress(
  state: GameState,
  world: WorldDefinition,
): void {
  const sections = world.tutorialSections ?? [];
  for (let index = state.tutorialStep + 1; index < sections.length; index += 1) {
    const section = sections[index];
    const requiredEnemy = section.requiresEnemyDefeated
      ? state.enemies.find((enemy) => enemy.id === section.requiresEnemyDefeated)
      : undefined;
    if (
      state.player.position.x < section.startX ||
      (requiredEnemy && requiredEnemy.alive)
    ) {
      break;
    }
    state.tutorialStep = index;
  }
}
