import { TUTORIAL_STAGE } from "../../content/tutorialStage";
import type { WorldDefinition } from "../../content/world";
import type { InputActions } from "../../input/actions";
import { PLAYER_CONFIG } from "../rules/config";
import type { GameState } from "../state";
import { updatePlayerCombat } from "./combat";
import { updateEnemies } from "./enemies";
import { updateTutorialProgress, updateWorldEnvironment } from "./environment";
import { updatePlayerMovement } from "./movement";
import {
  emitSound,
  PLAYER_SOUND_SOURCE_ID,
  updateSoundPropagation,
} from "./sound";

export function stepSimulation(
  state: GameState,
  input: InputActions,
  deltaSeconds: number,
  world: WorldDefinition = TUTORIAL_STAGE,
): GameState {
  state.elapsedTime += deltaSeconds;

  const movementSounds = updatePlayerMovement(
    state,
    world,
    input,
    deltaSeconds,
  );
  for (const sound of movementSounds) {
    emitSound(
      state,
      sound.kind,
      sound.position,
      sound.distance,
      sound.intensity,
      sound.sourceId ?? PLAYER_SOUND_SOURCE_ID,
    );
  }

  if (
    state.player.position.y > world.height + PLAYER_CONFIG.height &&
    state.player.action !== "dead"
  ) {
    state.player.health = 0;
    state.player.action = "dead";
    state.player.hitboxOffsetX = 0;
    state.player.velocity.x = 0;
    state.player.velocity.y = 0;
    state.status = "failed";
    emitSound(
      state,
      "death",
      state.player.position,
      720,
      1,
      PLAYER_SOUND_SOURCE_ID,
    );
  }

  updateEnemies(state, world, deltaSeconds);
  updatePlayerCombat(state, world);
  updateWorldEnvironment(state, world, deltaSeconds);
  updateTutorialProgress(state, world);

  updateSoundPropagation(state, world, deltaSeconds);
  return state;
}

export function drainGameEvents(state: GameState): GameState["events"] {
  return state.events.splice(0, state.events.length);
}
