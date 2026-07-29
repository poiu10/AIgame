import { TEST_ROOM } from "../../content/testRoom";
import type { WorldDefinition } from "../../content/world";
import type { InputActions } from "../../input/actions";
import { PLAYER_CONFIG } from "../rules/config";
import { createInitialGameState, type GameState } from "../state";
import { updatePlayerCombat } from "./combat";
import { updateEnemies } from "./enemies";
import { updatePlayerMovement } from "./movement";
import { emitSound, updateSoundPropagation } from "./sound";

export function stepSimulation(
  state: GameState,
  input: InputActions,
  deltaSeconds: number,
  world: WorldDefinition = TEST_ROOM,
): GameState {
  if (input.restartPressed) {
    return createInitialGameState(world);
  }

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
      sound.sourceId,
    );
  }

  if (
    state.player.position.y > world.height + PLAYER_CONFIG.height &&
    state.player.action !== "dead"
  ) {
    state.player.health = 0;
    state.player.action = "dead";
    state.player.velocity.x = 0;
    state.player.velocity.y = 0;
    state.status = "failed";
    emitSound(state, "death", state.player.position, 720, 1);
  }

  updateEnemies(state, world, deltaSeconds);
  updatePlayerCombat(state, world);

  if (input.debugPulsePressed) {
    emitSound(state, "debug", state.player.position, 800, 1);
  }

  updateSoundPropagation(state, world, deltaSeconds);
  return state;
}

export function drainGameEvents(state: GameState): GameState["events"] {
  return state.events.splice(0, state.events.length);
}
