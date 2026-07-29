import type { WorldDefinition } from "../../content/world";
import { centerRect, rectanglesOverlap } from "../collision/aabb";
import { PLAYER_CONFIG } from "../rules/config";
import type { GameState } from "../state";
import { damagePlayer } from "./combat";
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
    state.player.velocity.x = rejectionDirection * 330;
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
