import {
  ENEMY_KINDS,
  HAZARD_KINDS,
  TERRAIN_KINDS,
  type RectState,
  type TerrainBlock,
  type WorldDefinition,
} from "../../content/world";
import { SOUND_CONFIG, STAGE_ONE_CONFIG } from "../rules/config";
import type { GameState, TerrainState } from "../state";

export const BUTTON_PRESS_DEPTH = 12;

export function resolveTerrainBounds(
  block: TerrainBlock,
  terrain: TerrainState | undefined,
): RectState {
  if (block.kind !== TERRAIN_KINDS.button || !terrain?.pressed) {
    return block.bounds;
  }

  const pressDepth = Math.min(
    BUTTON_PRESS_DEPTH,
    Math.max(0, block.bounds.height - 1),
  );
  return {
    ...block.bounds,
    y: block.bounds.y + pressDepth,
    height: block.bounds.height - pressDepth,
  };
}

export function getActiveTerrain(
  state: GameState,
  world: WorldDefinition,
): TerrainBlock[] {
  return world.terrain.flatMap((block) => {
    const terrain = state.terrain.find((candidate) => candidate.id === block.id);
    if (!(terrain?.active ?? true)) return [];

    const bounds = resolveTerrainBounds(block, terrain);
    return bounds === block.bounds ? [block] : [{ ...block, bounds }];
  });
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
  button.echoTime = SOUND_CONFIG.echoSeconds;
  button.echoDuration = SOUND_CONFIG.echoSeconds;
  state.echoMarks = state.echoMarks.filter((mark) => mark.surfaceId !== terrainId);

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
    if (hazard.kind !== HAZARD_KINDS.electric) continue;
    hazard.activated = true;
    hazard.activationElapsed = 0;
    hazard.timeUntilPulse = 0;
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

export function closeEntryDoors(
  state: GameState,
  world: WorldDefinition,
  triggerDistance: number,
): TerrainBlock[] {
  const closedDoors: TerrainBlock[] = [];
  for (const block of world.terrain) {
    if (block.kind !== TERRAIN_KINDS.closesOnEntry) continue;
    const terrain = state.terrain.find((candidate) => candidate.id === block.id);
    if (!terrain || terrain.active) continue;

    const doorCenterX = block.bounds.x + block.bounds.width / 2;
    const enteredFarEnough = doorCenterX >= world.width / 2
      ? state.player.position.x <= block.bounds.x - triggerDistance
      : state.player.position.x >=
        block.bounds.x + block.bounds.width + triggerDistance;
    if (!enteredFarEnough) continue;

    terrain.active = true;
    terrain.echoTime = SOUND_CONFIG.echoSeconds;
    terrain.echoDuration = SOUND_CONFIG.echoSeconds;
    closedDoors.push(block);
  }
  return closedDoors;
}
