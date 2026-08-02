import { describe, expect, it } from "vitest";
import { STAGE_TWO } from "../src/game/content/stageTwo";
import {
  ENEMY_KINDS,
  HAZARD_KINDS,
  TERRAIN_KINDS,
} from "../src/game/content/world";
import {
  FIXED_STEP_SECONDS,
  PLAYER_CONFIG,
  STAGE_TWO_CONFIG,
} from "../src/game/simulation/rules/config";
import { createInitialGameState } from "../src/game/simulation/state";
import {
  damageEnemy,
  updateEnemyContactDamage,
} from "../src/game/simulation/systems/combat";
import { updateEnemies } from "../src/game/simulation/systems/enemies";
import { updateWorldEnvironment } from "../src/game/simulation/systems/environment";
import { emitSound, updateSoundPropagation } from "../src/game/simulation/systems/sound";
import { getActiveTerrain } from "../src/game/simulation/systems/stageMechanisms";
import {
  createCocoonBossThreatCells,
  createFloorHazardThreatCells,
} from "../src/phaser/view/threatPixelArt";

function getTerrainState(
  state: ReturnType<typeof createInitialGameState>,
  id: string,
) {
  return state.terrain.find((terrain) => terrain.id === id)!;
}

describe("Stage 2", () => {
  it("loads map/stage-2.json as the boss room source", () => {
    expect(STAGE_TWO).toMatchObject({
      id: "stage-2",
      width: 960,
      height: 540,
      playerSpawn: { x: 900, y: 380 },
      spawns: [
        expect.objectContaining({
          id: "from-stage-1",
          position: { x: 900, y: 380 },
          facing: -1,
        }),
      ],
    });
    expect(STAGE_TWO.exits[0]).toMatchObject({
      targetStageId: "stage-1",
      targetSpawnId: "spawn-13",
    });
    expect(STAGE_TWO.enemies).toEqual([
      expect.objectContaining({
        id: "boss-cocoon",
        kind: ENEMY_KINDS.cocoonBoss,
        role: "boss",
        health: 1,
      }),
    ]);
    expect(STAGE_TWO.hazards).toEqual([
      expect.objectContaining({
        id: "hazard-13",
        kind: HAZARD_KINDS.damagingFloor,
        bounds: { x: 40, y: 480, width: 880, height: 40 },
      }),
    ]);
    expect(STAGE_TWO.terrain).toContainEqual({
      id: "terrain-floor",
      kind: TERRAIN_KINDS.solid,
      bounds: { x: 40, y: 520, width: 880, height: 20 },
    });
  });

  it("closes the entrance once after the player walks into the room", () => {
    const state = createInitialGameState(STAGE_TWO);
    const door = STAGE_TWO.terrain.find(
      (terrain) => terrain.kind === TERRAIN_KINDS.closesOnEntry,
    )!;
    const doorState = getTerrainState(state, door.id);

    expect(doorState.active).toBe(false);
    expect(getActiveTerrain(state, STAGE_TWO)).not.toContainEqual(door);

    state.player.position = { x: 849, y: 380 };
    updateWorldEnvironment(state, STAGE_TWO, FIXED_STEP_SECONDS);
    expect(doorState.active).toBe(false);

    state.player.position.x = door.bounds.x - STAGE_TWO_CONFIG.entryDoorTriggerDistance;
    updateWorldEnvironment(state, STAGE_TWO, FIXED_STEP_SECONDS);

    expect(doorState.active).toBe(true);
    expect(getActiveTerrain(state, STAGE_TWO).map((terrain) => terrain.id))
      .toContain(door.id);
    expect(state.soundWaves).toEqual([
      expect.objectContaining({
        kind: "door-close",
        sourceId: door.id,
        origin: { x: 918.5, y: 370 },
      }),
    ]);
    expect(state.events.filter(
      (event) => event.type === "sound" && event.kind === "door-close",
    )).toHaveLength(1);

    updateWorldEnvironment(state, STAGE_TWO, FIXED_STEP_SECONDS);
    expect(state.soundWaves).toHaveLength(1);

    for (let index = 0; index < 52; index += 1) {
      updateSoundPropagation(state, STAGE_TWO, FIXED_STEP_SECONDS);
    }
    expect(state.enemies[0].echoTime).toBeGreaterThan(0);
  });

  it("keeps the one-health cocoon stationary and harmless", () => {
    const state = createInitialGameState(STAGE_TWO);
    const cocoon = state.enemies[0];
    const initialPosition = { ...cocoon.position };

    state.player.position = { ...cocoon.position };
    updateEnemies(state, STAGE_TWO, 1);
    updateEnemyContactDamage(state);

    expect(cocoon.kind).toBe(ENEMY_KINDS.cocoonBoss);
    expect(cocoon.position).toEqual(initialPosition);
    expect(cocoon.velocity).toEqual({ x: 0, y: 0 });
    expect(cocoon.action).toBe("sleep");
    expect(state.player.health).toBe(PLAYER_CONFIG.maxHealth);

    expect(damageEnemy(state, cocoon, 1)).toBe(true);
    expect(cocoon.alive).toBe(false);
    expect(cocoon.health).toBe(0);
  });

  it("deals one damage from the floor hazard instead of killing", () => {
    const state = createInitialGameState(STAGE_TWO);
    const hazard = state.hazards[0];
    state.player.position = {
      x: hazard.bounds.x + hazard.bounds.width / 2,
      y: hazard.bounds.y + 4,
    };

    updateWorldEnvironment(state, STAGE_TWO, FIXED_STEP_SECONDS);

    expect(state.player.health).toBe(PLAYER_CONFIG.maxHealth - 1);
    expect(state.player.action).toBe("hurt");

    updateWorldEnvironment(state, STAGE_TWO, FIXED_STEP_SECONDS);
    expect(state.player.health).toBe(PLAYER_CONFIG.maxHealth - 1);
  });

  it("reveals the stage-one floor pattern and the large cocoon with sound", () => {
    expect(createFloorHazardThreatCells("hazard-13"))
      .toEqual(createFloorHazardThreatCells("hazard-1"));

    const cocoonCells = createCocoonBossThreatCells("idle");
    const xs = cocoonCells.map((cell) => cell.x);
    const ys = cocoonCells.map((cell) => cell.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(55);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(95);

    const state = createInitialGameState(STAGE_TWO);
    emitSound(state, "player-step", { x: 680, y: 460 }, 120, 1, "player");
    for (let index = 0; index < 8; index += 1) {
      updateSoundPropagation(state, STAGE_TWO, FIXED_STEP_SECONDS);
    }
    expect(state.echoMarks.some((mark) => mark.surfaceId === "hazard-13"))
      .toBe(true);
  });
});
