import { describe, expect, it } from "vitest";
import type { WorldDefinition } from "../src/game/content/world";
import { EMPTY_INPUT, type InputActions } from "../src/game/input/actions";
import { raycastAabb } from "../src/game/simulation/collision/aabb";
import { FIXED_STEP_SECONDS } from "../src/game/simulation/rules/config";
import { createInitialGameState } from "../src/game/simulation/state";
import { stepSimulation } from "../src/game/simulation/systems/simulation";
import {
  emitSound,
  updateSoundPropagation,
} from "../src/game/simulation/systems/sound";

const flatWorld: WorldDefinition = {
  width: 600,
  height: 400,
  playerSpawn: { x: 100, y: 300 },
  terrain: [
    { id: "floor", bounds: { x: 0, y: 350, width: 600, height: 50 } },
  ],
  enemies: [],
};

function stepMany(
  world: WorldDefinition,
  count: number,
  firstInput: Partial<InputActions> = {},
) {
  let state = createInitialGameState(world);
  for (let index = 0; index < count; index += 1) {
    state = stepSimulation(
      state,
      index === 0 ? { ...EMPTY_INPUT, ...firstInput } : EMPTY_INPUT,
      FIXED_STEP_SECONDS,
      world,
    );
  }
  return state;
}

describe("AABB ray casting", () => {
  it("returns the surface point and normal of the nearest face", () => {
    const hit = raycastAabb(
      { x: 0, y: 50 },
      { x: 1, y: 0 },
      200,
      { x: 100, y: 0, width: 20, height: 100 },
    );

    expect(hit).not.toBeNull();
    expect(hit?.distance).toBeCloseTo(100);
    expect(hit?.point).toEqual({ x: 100, y: 50 });
    expect(hit?.normal).toEqual({ x: -1, y: 0 });
  });
});

describe("player controller", () => {
  it("lands on platforms and jumps from the grounded state", () => {
    let state = stepMany(flatWorld, 40);
    expect(state.player.grounded).toBe(true);
    expect(state.player.position.y).toBeCloseTo(324);

    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, jumpPressed: true, jumpHeld: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );
    expect(state.player.grounded).toBe(false);
    expect(state.player.velocity.y).toBeLessThan(-600);
  });

  it("enters a timed roll and receives temporary invulnerability", () => {
    let state = stepMany(flatWorld, 40);
    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, moveX: 1, rollPressed: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );

    expect(state.player.action).toBe("roll");
    expect(state.player.velocity.x).toBeGreaterThan(400);
    expect(state.player.invulnerabilityTime).toBeGreaterThan(0);
    expect(state.player.rollCooldown).toBeGreaterThan(0);
  });
});

describe("sound propagation", () => {
  it("keeps reflecting without a bounce cap until distance attenuation removes it", () => {
    const corridor: WorldDefinition = {
      width: 110,
      height: 100,
      playerSpawn: { x: 50, y: 50 },
      terrain: [
        { id: "left", bounds: { x: -10, y: 0, width: 10, height: 100 } },
        { id: "right", bounds: { x: 100, y: 0, width: 10, height: 100 } },
      ],
      enemies: [],
    };
    const state = createInitialGameState(corridor);
    emitSound(state, "debug", { x: 50, y: 50 }, 5_000, 1);
    const trackedRay = state.soundWaves[0].rays[0];
    for (const ray of state.soundWaves[0].rays.slice(1)) {
      ray.active = false;
    }

    for (let index = 0; index < 240 && trackedRay.active; index += 1) {
      updateSoundPropagation(state, corridor, FIXED_STEP_SECONDS);
    }

    expect(trackedRay.reflectionCount).toBeGreaterThan(3);
    expect(trackedRay.active).toBe(false);
    expect(trackedRay.remainingDistance).toBeLessThan(30);
  });

  it("temporarily reveals an enemy crossed by a wave", () => {
    const enemyWorld: WorldDefinition = {
      ...flatWorld,
      enemies: [
        {
          id: "target",
          position: { x: 180, y: 300 },
          patrolMinX: 180,
          patrolMaxX: 180,
        },
      ],
    };
    const state = createInitialGameState(enemyWorld);
    emitSound(state, "debug", { x: 100, y: 300 }, 200, 1);

    for (let index = 0; index < 20; index += 1) {
      updateSoundPropagation(state, enemyWorld, FIXED_STEP_SECONDS);
    }

    expect(state.enemies[0].echoTime).toBeGreaterThan(0);
  });
});

describe("combat loop", () => {
  it("damages and defeats an enemy with the active attack hitbox", () => {
    const combatWorld: WorldDefinition = {
      ...flatWorld,
      enemies: [
        {
          id: "target",
          position: { x: 150, y: 326 },
          patrolMinX: 150,
          patrolMaxX: 150,
        },
      ],
    };
    let state = createInitialGameState(combatWorld);
    state.player.position = { x: 100, y: 324 };
    state.player.grounded = true;
    state.enemies[0].health = 1;
    state.enemies[0].grounded = true;

    for (let index = 0; index < 24; index += 1) {
      state = stepSimulation(
        state,
        index === 0
          ? { ...EMPTY_INPUT, attackPressed: true }
          : EMPTY_INPUT,
        FIXED_STEP_SECONDS,
        combatWorld,
      );
    }

    expect(state.enemies[0].alive).toBe(false);
    expect(state.status).toBe("completed");
    expect(state.soundWaves.some((wave) => wave.kind === "death")).toBe(true);
  });
});
