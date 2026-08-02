import { HAZARD_KINDS, type WorldDefinition } from "../../content/world";
import { rectanglesOverlap } from "../collision/aabb";
import {
  HAZARD_CONFIG,
  PLAYER_CONFIG,
  STAGE_ONE_CONFIG,
} from "../rules/config";
import { getPlayerBounds } from "../rules/player";
import type { GameState } from "../state";
import { damagePlayer, killPlayer } from "./combat";
import { emitSound } from "./sound";
import { updateTerrainMechanismTimers } from "./stageMechanisms";

const HAZARD_REVEAL_SECONDS = 0.62;

export function getGrowingHazardSpeed(): number {
  return PLAYER_CONFIG.maxSpeed * 0.5;
}

function updateGrowingHazard(
  state: GameState,
  world: WorldDefinition,
  hazard: GameState["hazards"][number],
  deltaSeconds: number,
): void {
  hazard.timeUntilPulse -= deltaSeconds;
  if (hazard.timeUntilPulse <= 0) {
    emitSound(
      state,
      "hazard-pulse",
      { x: hazard.bounds.x, y: hazard.bounds.y + hazard.bounds.height / 2 },
      STAGE_ONE_CONFIG.growingHazardPulseDistance,
      1,
    );
    hazard.timeUntilPulse += STAGE_ONE_CONFIG.growingHazardPulseIntervalSeconds;
    hazard.echoTime = HAZARD_REVEAL_SECONDS;
    hazard.echoDuration = HAZARD_REVEAL_SECONDS;
  }

  if (!hazard.growthActive) return;
  const requestedGrowth = getGrowingHazardSpeed() * deltaSeconds;
  const leftGrowth = Math.min(hazard.bounds.x, requestedGrowth);
  const bottomGrowth = Math.min(
    Math.max(
      0,
      world.height - (hazard.bounds.y + hazard.bounds.height),
    ),
    requestedGrowth,
  );
  hazard.bounds.x -= leftGrowth;
  hazard.bounds.width += leftGrowth;
  hazard.bounds.height += bottomGrowth;
  hazard.growthElapsed += deltaSeconds;
}

export function updateWorldEnvironment(
  state: GameState,
  world: WorldDefinition,
  deltaSeconds: number,
): void {
  updateTerrainMechanismTimers(state, deltaSeconds);
  for (const hazard of state.hazards) {
    hazard.echoTime = Math.max(0, hazard.echoTime - deltaSeconds);
    hazard.reactionTime = Math.max(0, hazard.reactionTime - deltaSeconds);
    if (hazard.kind === HAZARD_KINDS.growing) {
      updateGrowingHazard(state, world, hazard, deltaSeconds);
    }
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

  const playerBounds = getPlayerBounds(state.player);
  for (const hazard of state.hazards) {
    if (
      !rectanglesOverlap(playerBounds, hazard.bounds)
    ) {
      continue;
    }

    if (hazard.kind === HAZARD_KINDS.lethal) {
      killPlayer(state);
      break;
    }
    if (hazard.kind === HAZARD_KINDS.growing) {
      hazard.echoTime = HAZARD_REVEAL_SECONDS;
      hazard.echoDuration = HAZARD_REVEAL_SECONDS;
      killPlayer(state);
      break;
    }
    if (state.player.action === "roll") continue;

    const hazardCenterX = hazard.bounds.x + hazard.bounds.width / 2;
    const rejectionDirection = state.player.position.x < hazardCenterX ? -1 : 1;
    const tookDamage = damagePlayer(state, rejectionDirection);
    if (tookDamage) {
      hazard.reactionTime = HAZARD_CONFIG.damageReactionSeconds;
      hazard.reactionDuration = HAZARD_CONFIG.damageReactionSeconds;
      hazard.reactionSide = rejectionDirection;
      hazard.reactionOffsetY = Math.max(
        0,
        Math.min(hazard.bounds.height, state.player.position.y - hazard.bounds.y),
      );
      hazard.echoTime = Math.max(hazard.echoTime, HAZARD_REVEAL_SECONDS);
      hazard.echoDuration = HAZARD_REVEAL_SECONDS;
    }
    state.player.position.x =
      rejectionDirection < 0
        ? hazard.bounds.x -
          PLAYER_CONFIG.width / 2 -
          state.player.hitboxOffsetX
        : hazard.bounds.x +
          hazard.bounds.width +
          PLAYER_CONFIG.width / 2 -
          state.player.hitboxOffsetX;
    state.player.velocity.x = rejectionDirection * 660;
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
