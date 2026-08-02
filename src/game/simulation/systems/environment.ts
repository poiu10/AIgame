import { HAZARD_KINDS, type WorldDefinition } from "../../content/world";
import { rectanglesOverlap } from "../collision/aabb";
import {
  HAZARD_CONFIG,
  PLAYER_CONFIG,
  SOUND_CONFIG,
  STAGE_ONE_CONFIG,
  STAGE_TWO_CONFIG,
} from "../rules/config";
import { getPlayerBounds } from "../rules/player";
import type { GameState } from "../state";
import { damagePlayer, killPlayer } from "./combat";
import { emitSound, emitSoundWave } from "./sound";
import {
  closeEntryDoors,
  updateTerrainMechanismTimers,
} from "./stageMechanisms";

const HAZARD_REVEAL_SECONDS = 0.62;

export function getElectricHazardDamageBounds(
  world: WorldDefinition,
  hazard: GameState["hazards"][number],
): GameState["hazards"][number]["bounds"] {
  if (hazard.kind !== HAZARD_KINDS.electric || !hazard.activated) {
    return hazard.bounds;
  }
  return {
    ...hazard.bounds,
    height: Math.max(hazard.bounds.height, world.height - hazard.bounds.y),
  };
}

export function getElectricHazardSpeed(
  playerX: number,
  hazard: GameState["hazards"][number],
): number {
  if (
    hazard.activationElapsed <
    STAGE_ONE_CONFIG.electricHazardInitialSpeedSeconds
  ) {
    return (
      STAGE_ONE_CONFIG.electricHazardMinimumSpeed *
      STAGE_ONE_CONFIG.electricHazardInitialSpeedRatio
    );
  }
  const hazardCenterX = hazard.bounds.x + hazard.bounds.width / 2;
  const distance = Math.abs(playerX - hazardCenterX);
  const distanceRange = Math.max(
    1,
    STAGE_ONE_CONFIG.electricHazardFarDistance -
      STAGE_ONE_CONFIG.electricHazardNearDistance,
  );
  const ratio = Math.max(
    0,
    Math.min(
      1,
      (distance - STAGE_ONE_CONFIG.electricHazardNearDistance) / distanceRange,
    ),
  );
  const smoothRatio = ratio * ratio * (3 - 2 * ratio);
  return (
    STAGE_ONE_CONFIG.electricHazardMinimumSpeed +
    (STAGE_ONE_CONFIG.electricHazardMaximumSpeed -
      STAGE_ONE_CONFIG.electricHazardMinimumSpeed) *
      smoothRatio
  );
}

function updateElectricHazard(
  state: GameState,
  hazard: GameState["hazards"][number],
  deltaSeconds: number,
): void {
  if (!hazard.activated) return;

  hazard.timeUntilPulse -= deltaSeconds;
  while (hazard.timeUntilPulse <= 0) {
    emitSoundWave(
      state,
      "electric-pulse",
      {
        x: hazard.bounds.x + hazard.bounds.width / 2,
        y: hazard.bounds.y + hazard.bounds.height / 2,
      },
      STAGE_ONE_CONFIG.electricHazardPulseDistance,
      1,
    );
    hazard.timeUntilPulse += STAGE_ONE_CONFIG.electricHazardPulseIntervalSeconds;
  }

  const initialSpeedTimeRemaining = Math.max(
    0,
    STAGE_ONE_CONFIG.electricHazardInitialSpeedSeconds -
      hazard.activationElapsed,
  );
  const initialSpeedSeconds = Math.min(
    deltaSeconds,
    initialSpeedTimeRemaining,
  );
  hazard.bounds.x = Math.max(
    0,
    hazard.bounds.x -
      STAGE_ONE_CONFIG.electricHazardMinimumSpeed *
        STAGE_ONE_CONFIG.electricHazardInitialSpeedRatio *
        initialSpeedSeconds,
  );
  hazard.activationElapsed += initialSpeedSeconds;

  const distanceScaledSeconds = deltaSeconds - initialSpeedSeconds;
  if (distanceScaledSeconds > 0) {
    hazard.bounds.x = Math.max(
      0,
      hazard.bounds.x -
        getElectricHazardSpeed(state.player.position.x, hazard) *
          distanceScaledSeconds,
    );
    hazard.activationElapsed += distanceScaledSeconds;
  }
}

export function updateWorldEnvironment(
  state: GameState,
  world: WorldDefinition,
  deltaSeconds: number,
): void {
  updateTerrainMechanismTimers(state, deltaSeconds);
  for (const door of closeEntryDoors(
    state,
    world,
    STAGE_TWO_CONFIG.entryDoorTriggerDistance,
  )) {
    const doorOnRight = door.bounds.x + door.bounds.width / 2 >= world.width / 2;
    emitSound(
      state,
      "door-close",
      {
        x: doorOnRight
          ? door.bounds.x - SOUND_CONFIG.raySurfaceOffset
          : door.bounds.x + door.bounds.width + SOUND_CONFIG.raySurfaceOffset,
        y: door.bounds.y + door.bounds.height / 2,
      },
      STAGE_TWO_CONFIG.closingDoorSoundDistance,
      1,
      door.id,
    );
  }
  for (const hazard of state.hazards) {
    hazard.echoTime = Math.max(0, hazard.echoTime - deltaSeconds);
    hazard.reactionTime = Math.max(0, hazard.reactionTime - deltaSeconds);
    if (hazard.kind === HAZARD_KINDS.electric) {
      updateElectricHazard(state, hazard, deltaSeconds);
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
    if (hazard.kind === HAZARD_KINDS.electric && !hazard.activated) {
      continue;
    }
    const damageBounds = getElectricHazardDamageBounds(world, hazard);
    if (
      !rectanglesOverlap(playerBounds, damageBounds)
    ) {
      continue;
    }

    if (hazard.kind === HAZARD_KINDS.lethal) {
      killPlayer(state);
      break;
    }
    if (hazard.kind === HAZARD_KINDS.electric) {
      killPlayer(state);
      break;
    }
    if (hazard.kind === HAZARD_KINDS.damagingFloor) {
      const knockbackDirection = state.player.velocity.x < 0
        ? -1
        : state.player.velocity.x > 0
          ? 1
          : state.player.facing;
      damagePlayer(state, knockbackDirection);
      continue;
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
