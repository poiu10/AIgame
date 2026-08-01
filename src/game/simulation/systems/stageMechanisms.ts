import {
  ENEMY_KINDS,
  HAZARD_KINDS,
  TERRAIN_KINDS,
  type TerrainBlock,
  type WorldDefinition,
} from "../../content/world";
import { SOUND_CONFIG, STAGE_ONE_CONFIG } from "../rules/config";
import type { GameState } from "../state";

export function getActiveTerrain(
  state: GameState,
  world: WorldDefinition,
): TerrainBlock[] {
  return world.terrain.filter((block) =>
    state.terrain.find((terrain) => terrain.id === block.id)?.active ?? true,
  );
}

export function withActiveTerrain(
  state: GameState,
  world: WorldDefinition,
): WorldDefinition {
  return { ...world, terrain: getActiveTerrain(state, world) };
}

export function revealTerrainMechanism(
  state: GameState,
  world: WorldDefinition,
  terrainId: string,
): void {
  const definition = world.terrain.find((block) => block.id === terrainId);
  if (definition?.kind !== TERRAIN_KINDS.button) return;
  const terrain = state.terrain.find((candidate) => candidate.id === terrainId);
  if (!terrain) return;
  terrain.echoTime = SOUND_CONFIG.echoSeconds;
  terrain.echoDuration = SOUND_CONFIG.echoSeconds;
}

export function pressTerrainButton(
  state: GameState,
  world: WorldDefinition,
  terrainId: string,
): boolean {
  const definition = world.terrain.find((block) => block.id === terrainId);
  const button = state.terrain.find((terrain) => terrain.id === terrainId);
  if (definition?.kind !== TERRAIN_KINDS.button || !button || button.pressed) {
    return false;
  }

  button.pressed = true;

  for (const block of world.terrain) {
    const terrain = state.terrain.find((candidate) => candidate.id === block.id);
    if (!terrain) continue;
    if (block.kind === TERRAIN_KINDS.closesOnButton) terrain.active = true;
    if (block.kind === TERRAIN_KINDS.opensOnButton) {
      terrain.active = false;
      state.echoMarks = state.echoMarks.filter((mark) => mark.surfaceId !== block.id);
    }
  }

  for (const hazard of state.hazards) {
    if (hazard.kind === HAZARD_KINDS.growing) hazard.growthActive = true;
  }
  for (const enemy of state.enemies) {
    if (enemy.kind !== ENEMY_KINDS.waker || !enemy.alive) continue;
    enemy.activated = true;
    enemy.action = "pursue";
    enemy.actionTime = 0;
    enemy.timeUntilPulse = STAGE_ONE_CONFIG.wakerPulseWakeDelaySeconds;
  }
  return true;
}

export function updateTerrainMechanismTimers(
  state: GameState,
  deltaSeconds: number,
): void {
  for (const terrain of state.terrain) {
    terrain.echoTime = Math.max(0, terrain.echoTime - deltaSeconds);
  }
}
