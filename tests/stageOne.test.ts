import { describe, expect, it } from "vitest";
import { STAGE_ONE } from "../src/game/content/stageOne";
import {
  ENEMY_KINDS,
  HAZARD_KINDS,
  TERRAIN_KINDS,
  type WorldDefinition,
} from "../src/game/content/world";
import {
  FIXED_STEP_SECONDS,
  PLAYER_CONFIG,
} from "../src/game/simulation/rules/config";
import { createInitialGameState } from "../src/game/simulation/state";
import { updatePlayerCombat } from "../src/game/simulation/systems/combat";
import { updateEnemies } from "../src/game/simulation/systems/enemies";
import {
  getGrowingHazardSpeed,
  updateWorldEnvironment,
} from "../src/game/simulation/systems/environment";
import { emitSound, updateSoundPropagation } from "../src/game/simulation/systems/sound";
import { getActiveTerrain } from "../src/game/simulation/systems/stageMechanisms";

function getTerrainState(state: ReturnType<typeof createInitialGameState>, id: string) {
  return state.terrain.find((terrain) => terrain.id === id)!;
}

describe("Stage 1", () => {
  it("loads the authored map with its two connected doors", () => {
    expect(STAGE_ONE.playerSpawn).toEqual({ x: 80, y: 160 });
    expect(STAGE_ONE.exits).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "exit-2", targetStageId: "tutorial" }),
      expect.objectContaining({ id: "exit-19", targetStageId: "stage-2" }),
    ]));
    expect(STAGE_ONE.enemies.map((enemy) => enemy.health)).toEqual([1, 2, 2, 1]);
  });

  it("presses the orange button with an attack and swaps both doors", () => {
    const state = createInitialGameState(STAGE_ONE);
    expect(getTerrainState(state, "terrain-door1").active).toBe(false);
    expect(getTerrainState(state, "terrain-door2").active).toBe(true);

    state.player.position = { x: 1190, y: 260 };
    state.player.attackFacing = 1;
    state.player.action = "attack";
    state.player.actionTime = PLAYER_CONFIG.attackActiveStart;
    updatePlayerCombat(state, STAGE_ONE);

    expect(getTerrainState(state, "terrain-botton").pressed).toBe(true);
    expect(getTerrainState(state, "terrain-botton").echoTime).toBe(0);
    expect(getTerrainState(state, "terrain-door1").active).toBe(true);
    expect(getTerrainState(state, "terrain-door2").active).toBe(false);
    expect(getActiveTerrain(state, STAGE_ONE).map((terrain) => terrain.id)).toContain(
      "terrain-door1",
    );
  });

  it("reveals the whole button state when a sound ray reaches it", () => {
    const state = createInitialGameState(STAGE_ONE);
    emitSound(state, "terrain-step", { x: 1260, y: 260 }, 160, 1, "player");
    for (let index = 0; index < 12; index += 1) {
      updateSoundPropagation(state, STAGE_ONE, FIXED_STEP_SECONDS);
    }
    expect(getTerrainState(state, "terrain-botton").echoTime).toBeGreaterThan(0);
  });

  it("kills the player on fixed lethal hazards even during a roll", () => {
    const state = createInitialGameState(STAGE_ONE);
    const hazard = state.hazards.find((candidate) => candidate.id === "hazard-7")!;
    state.player.position = {
      x: hazard.bounds.x + hazard.bounds.width / 2,
      y: hazard.bounds.y + hazard.bounds.height / 2,
    };
    state.player.action = "roll";

    updateWorldEnvironment(state, STAGE_ONE, FIXED_STEP_SECONDS);

    expect(state.player.health).toBe(0);
    expect(state.player.action).toBe("dead");
  });

  it("keeps the sleeper stationary, pulsing, and immune to hazards", () => {
    const state = createInitialGameState(STAGE_ONE);
    const sleeper = state.enemies.find((enemy) => enemy.id === "enemy-sleep")!;
    sleeper.position = { x: 560, y: 535 };
    const initialHealth = sleeper.health;

    updateWorldEnvironment(state, STAGE_ONE, FIXED_STEP_SECONDS);
    updateEnemies(state, STAGE_ONE, 0.5);

    expect(sleeper.health).toBe(initialHealth);
    expect(sleeper.position).toEqual({ x: 560, y: 535 });
    expect(state.soundWaves.some((wave) => wave.sourceId === sleeper.id)).toBe(true);
  });

  it("flies horizontally and turns a flyer toward an incoming player wave", () => {
    const state = createInitialGameState(STAGE_ONE);
    const flyer = state.enemies.find((enemy) => enemy.id === "enemy-fly1")!;
    flyer.facing = 1;
    const initialY = flyer.position.y;
    updateEnemies(state, STAGE_ONE, 0.1);
    expect(flyer.position.x).toBeGreaterThan(660);
    expect(flyer.position.y).toBe(initialY);

    emitSound(state, "terrain-step", { x: 520, y: initialY }, 300, 1, "player");
    for (let index = 0; index < 20; index += 1) {
      updateSoundPropagation(state, STAGE_ONE, FIXED_STEP_SECONDS);
    }
    expect(flyer.facing).toBe(-1);
  });

  it("grows leftward at 50%, 100%, then 120% of walking speed", () => {
    expect(getGrowingHazardSpeed(0)).toBe(PLAYER_CONFIG.maxSpeed * 0.5);
    expect(getGrowingHazardSpeed(2)).toBe(PLAYER_CONFIG.maxSpeed);
    expect(getGrowingHazardSpeed(10)).toBe(PLAYER_CONFIG.maxSpeed * 1.2);

    const world: WorldDefinition = {
      width: 12_000,
      height: 1_000,
      playerSpawn: { x: 100, y: 100 },
      terrain: [],
      enemies: [],
      hazards: [
        {
          id: "growth",
          kind: HAZARD_KINDS.growing,
          bounds: { x: 10_000, y: 100, width: 40, height: 40 },
        },
      ],
    };
    const state = createInitialGameState(world);
    const hazard = state.hazards[0];
    hazard.growthActive = true;
    updateWorldEnvironment(state, world, 2);
    expect(hazard.bounds.width).toBeCloseTo(540);
    updateWorldEnvironment(state, world, 8);
    expect(hazard.bounds.width).toBeCloseTo(4540);
    updateWorldEnvironment(state, world, 1);
    expect(hazard.bounds.width).toBeCloseTo(5140);
  });

  it("wakes on the button and smoothly meets a left-running player near x=900", () => {
    const world: WorldDefinition = {
      width: 2_000,
      height: 800,
      playerSpawn: { x: 1_320, y: 200 },
      terrain: [
        {
          id: "button",
          kind: TERRAIN_KINDS.button,
          bounds: { x: 1_340, y: 180, width: 20, height: 40 },
        },
      ],
      enemies: [
        {
          id: "waker",
          kind: ENEMY_KINDS.waker,
          position: { x: 620, y: 200 },
          patrolMinX: 620,
          patrolMaxX: 620,
          health: 1,
        },
      ],
    };
    const state = createInitialGameState(world);
    state.player.position = { x: 1_220, y: 200 };
    state.player.attackFacing = 1;
    state.player.action = "attack";
    state.player.actionTime = PLAYER_CONFIG.attackActiveStart;
    updatePlayerCombat(state, world);
    const waker = state.enemies[0];
    expect(waker.activated).toBe(true);

    let runnerX = 1_320;
    let runnerVelocity = 0;
    let meetingX = Number.NaN;
    for (let index = 0; index < 180; index += 1) {
      runnerVelocity = Math.max(
        -PLAYER_CONFIG.maxSpeed,
        runnerVelocity - PLAYER_CONFIG.acceleration * FIXED_STEP_SECONDS,
      );
      runnerX += runnerVelocity * FIXED_STEP_SECONDS;
      state.player.position = { x: runnerX, y: 200 };
      updateEnemies(state, world, FIXED_STEP_SECONDS);
      if (waker.position.x >= runnerX) {
        meetingX = (waker.position.x + runnerX) / 2;
        break;
      }
    }

    expect(meetingX).toBeGreaterThan(860);
    expect(meetingX).toBeLessThan(940);
    expect(state.soundWaves.some((wave) => wave.sourceId === waker.id)).toBe(true);
  });
});
