import { describe, expect, it } from "vitest";
import type { WorldDefinition } from "../src/game/content/world";
import { TUTORIAL_STAGE } from "../src/game/content/tutorialStage";
import { EMPTY_INPUT, type InputActions } from "../src/game/input/actions";
import { raycastAabb } from "../src/game/simulation/collision/aabb";
import {
  FIXED_STEP_SECONDS,
  PLAYER_CONFIG,
} from "../src/game/simulation/rules/config";
import { getPlayerAttackBounds } from "../src/game/simulation/rules/combat";
import { createInitialGameState } from "../src/game/simulation/state";
import { stepSimulation } from "../src/game/simulation/systems/simulation";
import {
  createEchoMark,
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

  it("cancels a grounded roll into a jump", () => {
    let state = stepMany(flatWorld, 40);
    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, moveX: 1, rollPressed: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );
    expect(state.player.action).toBe("roll");

    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, jumpPressed: true, jumpHeld: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );

    expect(state.player.action).toBe("normal");
    expect(state.player.grounded).toBe(false);
    expect(state.player.velocity.y).toBeLessThan(-600);
    expect(Math.abs(state.player.velocity.x)).toBeLessThanOrEqual(
      PLAYER_CONFIG.maxSpeed,
    );
  });

  it("cancels an attack into a roll", () => {
    let state = stepMany(flatWorld, 40);
    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, attackPressed: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );
    expect(state.player.action).toBe("attack");

    state.player.attackHitIds = ["previous-target"];
    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, rollPressed: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );

    expect(state.player.action).toBe("roll");
    expect(state.player.actionTime).toBe(0);
    expect(state.player.attackHitIds).toEqual([]);
    expect(state.player.invulnerabilityTime).toBeGreaterThan(0);
  });

  it("keeps the attack hitbox facing its starting direction", () => {
    let state = stepMany(flatWorld, 40);
    state.player.facing = 1;
    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, attackPressed: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );

    expect(state.player.action).toBe("attack");
    expect(state.player.attackFacing).toBe(1);

    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, moveX: -1 },
      FIXED_STEP_SECONDS,
      flatWorld,
    );

    expect(state.player.facing).toBe(-1);
    expect(state.player.attackFacing).toBe(1);
    expect(getPlayerAttackBounds(state.player).x).toBe(
      state.player.position.x + PLAYER_CONFIG.width / 2,
    );
  });

  it("does not keep moving after death", () => {
    const state = createInitialGameState(flatWorld);
    state.player.position = { x: 180, y: 324 };
    state.player.velocity = { x: 320, y: -120 };
    state.player.grounded = true;
    state.player.action = "dead";
    state.player.health = 0;
    state.status = "failed";
    const deathPosition = { ...state.player.position };

    stepSimulation(
      state,
      { ...EMPTY_INPUT, moveX: 1 },
      FIXED_STEP_SECONDS,
      flatWorld,
    );

    expect(state.player.position).toEqual(deathPosition);
    expect(state.player.velocity).toEqual({ x: 0, y: 0 });
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

  it("adds collision rays as the expanding wavefront spacing grows", () => {
    const openWorld: WorldDefinition = {
      width: 2_000,
      height: 2_000,
      playerSpawn: { x: 1_000, y: 1_000 },
      terrain: [],
      enemies: [],
    };
    const state = createInitialGameState(openWorld);
    emitSound(state, "debug", openWorld.playerSpawn, 800, 1);
    const initialRayCount = state.soundWaves[0].rays.length;

    for (let index = 0; index < 90; index += 1) {
      updateSoundPropagation(state, openWorld, FIXED_STEP_SECONDS);
    }

    const rays = state.soundWaves[0].rays;
    const maximumSpacing = rays.reduce((maximum, ray, index) => {
      const next = rays[(index + 1) % rays.length];
      return Math.max(
        maximum,
        Math.hypot(
          next.position.x - ray.position.x,
          next.position.y - ray.position.y,
        ),
      );
    }, 0);

    expect(rays.length).toBeGreaterThan(initialRayCount);
    expect(maximumSpacing).toBeLessThanOrEqual(24);
  });

  it("clips corner echo marks to the terrain face bounds", () => {
    const block = {
      id: "corner",
      bounds: { x: 100, y: 100, width: 20, height: 20 },
    };
    const horizontal = createEchoMark(
      block,
      { x: 100, y: 100 },
      { x: 0, y: -1 },
      1,
    );
    const vertical = createEchoMark(
      block,
      { x: 100, y: 100 },
      { x: -1, y: 0 },
      1,
    );

    expect(horizontal.start).toEqual({ x: 100, y: 100 });
    expect(horizontal.end).toEqual({ x: 120, y: 100 });
    expect(vertical.start).toEqual({ x: 100, y: 100 });
    expect(vertical.end).toEqual({ x: 100, y: 120 });
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

describe("tutorial stage", () => {
  it("uses key-only prompts and half-distance environmental waves", () => {
    expect(
      TUTORIAL_STAGE.tutorialSections?.map((section) => section.prompt),
    ).toEqual(["A / D", "Space", "Shift", "J", "A / D · Space · Shift · J"]);
    expect(
      TUTORIAL_STAGE.soundEmitters?.map((emitter) => emitter.maximumDistance),
    ).toEqual([215, 250, 195]);
    expect(TUTORIAL_STAGE.hazards?.[0].bounds.height).toBe(160);
  });

  it("advances the guidance as the player reaches each lesson", () => {
    const state = createInitialGameState(TUTORIAL_STAGE);
    expect(TUTORIAL_STAGE.tutorialSections?.[state.tutorialStep].id).toBe(
      "move",
    );

    state.player.position.x = 500;
    stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, TUTORIAL_STAGE);
    expect(TUTORIAL_STAGE.tutorialSections?.[state.tutorialStep].id).toBe(
      "jump",
    );

    state.player.position.x = 1300;
    stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, TUTORIAL_STAGE);
    expect(TUTORIAL_STAGE.tutorialSections?.[state.tutorialStep].id).toBe(
      "roll",
    );

    state.player.position.x = 1700;
    stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, TUTORIAL_STAGE);
    expect(TUTORIAL_STAGE.tutorialSections?.[state.tutorialStep].id).toBe(
      "attack",
    );

    state.player.position.x = 2100;
    stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, TUTORIAL_STAGE);
    expect(TUTORIAL_STAGE.tutorialSections?.[state.tutorialStep].id).toBe(
      "attack",
    );

    const lessonEnemy = state.enemies.find(
      (enemy) => enemy.id === "lesson-sentinel",
    );
    expect(lessonEnemy).toBeDefined();
    lessonEnemy!.alive = false;
    stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, TUTORIAL_STAGE);
    expect(TUTORIAL_STAGE.tutorialSections?.[state.tutorialStep].id).toBe(
      "trial",
    );
  });

  it("keeps the resonance crusher harmful while emitting red hazard waves", () => {
    const state = createInitialGameState(TUTORIAL_STAGE);
    const crusher = TUTORIAL_STAGE.hazards?.[0];
    expect(crusher).toBeDefined();
    state.player.position = {
      x: crusher!.bounds.x + crusher!.bounds.width / 2,
      y: 624,
    };
    state.player.grounded = true;

    stepSimulation(state, EMPTY_INPUT, 0.11, TUTORIAL_STAGE);

    expect(state.player.health).toBe(PLAYER_CONFIG.maxHealth - 1);
    expect(state.player.action).toBe("hurt");
    expect(state.soundWaves.some((wave) => wave.kind === "hazard")).toBe(true);
    expect(state.hazards[0].echoTime).toBeGreaterThan(0);
  });

  it("rejects non-rolling movement even during damage invulnerability", () => {
    const state = createInitialGameState(TUTORIAL_STAGE);
    const crusher = TUTORIAL_STAGE.hazards?.[0];
    expect(crusher).toBeDefined();
    state.player.position = { x: crusher!.bounds.x - 10, y: 624 };
    state.player.grounded = true;
    state.player.invulnerabilityTime = 0.5;

    stepSimulation(
      state,
      { ...EMPTY_INPUT, moveX: 1 },
      FIXED_STEP_SECONDS,
      TUTORIAL_STAGE,
    );

    expect(state.player.position.x).toBe(
      crusher!.bounds.x - PLAYER_CONFIG.width / 2,
    );
    expect(state.player.velocity.x).toBeLessThan(0);
    expect(state.player.health).toBe(PLAYER_CONFIG.maxHealth);
  });

  it("allows a full roll to cross the resonance crusher without damage", () => {
    const state = createInitialGameState(TUTORIAL_STAGE);
    const crusher = TUTORIAL_STAGE.hazards?.[0];
    expect(crusher).toBeDefined();
    state.player.position = { x: crusher!.bounds.x - 18, y: 624 };
    state.player.grounded = true;
    const initialHealth = state.player.health;

    for (let index = 0; index < 34; index += 1) {
      stepSimulation(
        state,
        index === 0
          ? { ...EMPTY_INPUT, moveX: 1, rollPressed: true }
          : { ...EMPTY_INPUT, moveX: 1 },
        FIXED_STEP_SECONDS,
        TUTORIAL_STAGE,
      );
    }

    expect(state.player.position.x).toBeGreaterThan(
      crusher!.bounds.x + crusher!.bounds.width + PLAYER_CONFIG.width / 2,
    );
    expect(state.player.health).toBe(initialHealth);
  });
});
