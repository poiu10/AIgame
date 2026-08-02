import { describe, expect, it } from "vitest";
import { STAGE_ONE } from "../src/game/content/stageOne";
import {
  ENEMY_KINDS,
  HAZARD_KINDS,
  TERRAIN_KINDS,
  type WorldDefinition,
} from "../src/game/content/world";
import {
  ENEMY_CONFIG,
  FIXED_STEP_SECONDS,
  MELEE_ATTACK_WAVE_CONFIG,
  PLAYER_CONFIG,
  SOUND_CONFIG,
  STAGE_ONE_CONFIG,
} from "../src/game/simulation/rules/config";
import { createInitialGameState } from "../src/game/simulation/state";
import { updatePlayerCombat } from "../src/game/simulation/systems/combat";
import { updateEnemies } from "../src/game/simulation/systems/enemies";
import {
  getElectricHazardDamageBounds,
  getElectricHazardSpeed,
  updateWorldEnvironment,
} from "../src/game/simulation/systems/environment";
import { emitSound, updateSoundPropagation } from "../src/game/simulation/systems/sound";
import {
  BUTTON_PRESS_DEPTH,
  getActiveTerrain,
  pressTerrainButton,
} from "../src/game/simulation/systems/stageMechanisms";

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
    expect(STAGE_ONE.terrain.find((terrain) => terrain.id === "terrain-5")?.bounds)
      .toEqual({ x: 240, y: 80, width: 160, height: 220 });
    const waker = STAGE_ONE.enemies.find((enemy) => enemy.id === "enemy-wake")!;
    expect(waker.position.x - 70 / 2).toBe(400);
    expect(
      STAGE_ONE.hazards?.filter((hazard) => hazard.kind === HAZARD_KINDS.lethal),
    ).toHaveLength(2);
  });

  it("keeps both left-side exits acoustically open", () => {
    for (const y of [150, 420]) {
      const state = createInitialGameState(STAGE_ONE);
      emitSound(state, "player-step", { x: 80, y }, 200, 1, "player");
      const leftRay = state.soundWaves[0].rays.find(
        (ray) => ray.direction.x < -0.99 && Math.abs(ray.direction.y) < 0.01,
      )!;

      for (let index = 0; index < 12; index += 1) {
        updateSoundPropagation(state, STAGE_ONE, FIXED_STEP_SECONDS);
      }

      expect(leftRay.position.x).toBeLessThan(0);
      expect(leftRay.reflectionCount).toBe(0);
    }
  });

  it("presses the orange button with an attack and swaps both doors", () => {
    const state = createInitialGameState(STAGE_ONE);
    const buttonDefinition = STAGE_ONE.terrain.find(
      (terrain) => terrain.id === "terrain-botton",
    )!;
    expect(getTerrainState(state, "terrain-door1").active).toBe(false);
    expect(getTerrainState(state, "terrain-door2").active).toBe(true);

    state.player.position = {
      x: buttonDefinition.bounds.x - PLAYER_CONFIG.width / 2 - 40,
      y: buttonDefinition.bounds.y + buttonDefinition.bounds.height / 2,
    };
    state.player.attackFacing = 1;
    state.player.action = "attack";
    state.player.actionTime = PLAYER_CONFIG.attackActiveStart;
    updatePlayerCombat(state, STAGE_ONE);

    expect(getTerrainState(state, "terrain-botton").pressed).toBe(true);
    expect(getTerrainState(state, "terrain-botton").echoTime).toBe(
      SOUND_CONFIG.echoSeconds,
    );
    expect(getTerrainState(state, "terrain-door1").active).toBe(true);
    expect(getTerrainState(state, "terrain-door2").active).toBe(false);
    const activeTerrain = getActiveTerrain(state, STAGE_ONE);
    expect(activeTerrain.map((terrain) => terrain.id)).toContain("terrain-door1");
    expect(
      activeTerrain.find((terrain) => terrain.id === "terrain-botton")?.bounds,
    ).toEqual({
      ...buttonDefinition.bounds,
      y: buttonDefinition.bounds.y + BUTTON_PRESS_DEPTH,
      height: buttonDefinition.bounds.height - BUTTON_PRESS_DEPTH,
    });
    expect(state.soundWaves).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "door-open",
        sourceId: "terrain-door2",
        origin: { x: 140, y: 390 },
      }),
    ]));
    expect(state.events.filter(
      (event) => event.type === "sound" && event.kind === "door-open",
    )).toHaveLength(1);
    expect(pressTerrainButton(state, STAGE_ONE, "terrain-botton")).toBe(false);
    expect(state.soundWaves.filter((wave) => wave.kind === "door-open")).toHaveLength(1);
  });

  it("reveals the whole button state when a sound ray reaches it", () => {
    const state = createInitialGameState(STAGE_ONE);
    emitSound(state, "player-step", { x: 1260, y: 260 }, 160, 1, "player");
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

  it("keeps fixed lethal hazards active after every enemy is defeated", () => {
    const state = createInitialGameState(STAGE_ONE);
    for (const enemy of state.enemies) enemy.alive = false;
    const hazard = state.hazards.find((candidate) => candidate.id === "hazard-1")!;
    state.player.position = {
      x: hazard.bounds.x + hazard.bounds.width / 2,
      y: hazard.bounds.y + hazard.bounds.height / 2,
    };

    updateWorldEnvironment(state, STAGE_ONE, FIXED_STEP_SECONDS);

    expect(state.player.health).toBe(0);
    expect(state.player.action).toBe("dead");
  });

  it("reveals only a local red surface mark on fixed lethal hazards", () => {
    const state = createInitialGameState(STAGE_ONE);
    emitSound(state, "player-step", { x: 300, y: 480 }, 100, 1, "player");

    for (let index = 0; index < 4; index += 1) {
      updateSoundPropagation(state, STAGE_ONE, FIXED_STEP_SECONDS);
    }

    const hazardMarks = state.echoMarks.filter(
      (mark) => mark.surfaceId === "hazard-7",
    );
    expect(hazardMarks.length).toBeGreaterThan(0);
    expect(hazardMarks.every((mark) => mark.surfaceKind === "hazard")).toBe(true);
    expect(hazardMarks.every((mark) => mark.start.y === 520 && mark.end.y === 520))
      .toBe(true);
    expect(
      Math.max(...hazardMarks.map((mark) => mark.end.x - mark.start.x)),
    ).toBeLessThan(120);
    expect(state.hazards.find((hazard) => hazard.id === "hazard-7")?.echoTime)
      .toBe(0);
  });

  it("keeps the sleeper stationary and pulsing", () => {
    const state = createInitialGameState(STAGE_ONE);
    const sleeper = state.enemies.find((enemy) => enemy.id === "enemy-sleep")!;
    sleeper.position = { x: 560, y: 535 };
    state.player.position = { x: 520, y: 535 };

    updateEnemies(state, STAGE_ONE, 0.5);

    expect(sleeper.position).toEqual({ x: 560, y: 535 });
    const sleepWave = state.soundWaves.find(
      (wave) => wave.kind === "sleep" && wave.sourceId === sleeper.id,
    );
    expect(sleepWave).toBeDefined();
    expect(Math.max(...sleepWave!.rays.map((ray) => ray.remainingDistance))).toBe(
      MELEE_ATTACK_WAVE_CONFIG.distance,
    );
  });

  it("flies horizontally and turns a flyer toward an incoming player wave", () => {
    const state = createInitialGameState(STAGE_ONE);
    const flyer = state.enemies.find((enemy) => enemy.id === "enemy-fly1")!;
    flyer.facing = 1;
    const initialY = flyer.position.y;
    updateEnemies(state, STAGE_ONE, 0.1);
    expect(flyer.position.x).toBeGreaterThan(660);
    expect(flyer.position.y).toBe(initialY);

    emitSound(state, "player-step", { x: 520, y: initialY }, 300, 1, "player");
    for (let index = 0; index < 20; index += 1) {
      updateSoundPropagation(state, STAGE_ONE, FIXED_STEP_SECONDS);
    }
    expect(flyer.facing).toBe(-1);
  });

  it("gives flyers the same warned melee attack as the ground stalker", () => {
    const state = createInitialGameState(STAGE_ONE);
    const flyer = state.enemies.find((enemy) => enemy.id === "enemy-fly1")!;
    flyer.position = { x: 600, y: 300 };
    state.player.position = { x: 500, y: 300 };
    const healthBefore = state.player.health;

    updateEnemies(state, STAGE_ONE, FIXED_STEP_SECONDS);

    expect(flyer.action).toBe("alert");
    expect(flyer.attackFacing).toBe(-1);
    expect(state.player.health).toBe(healthBefore);
    expect(state.soundWaves.some(
      (wave) => wave.kind === "enemy-alert" && wave.sourceId === flyer.id,
    )).toBe(true);

    updateEnemies(state, STAGE_ONE, ENEMY_CONFIG.alertSeconds);

    expect(flyer.action).toBe("attack");
    expect(state.player.health).toBe(healthBefore - 1);
  });

  it("emits periodic calls from flyers and only awakened wakers", () => {
    const state = createInitialGameState(STAGE_ONE);
    const flyer = state.enemies.find((enemy) => enemy.id === "enemy-fly1")!;
    const waker = state.enemies.find((enemy) => enemy.id === "enemy-wake")!;
    flyer.position = { x: 600, y: 300 };
    waker.position = { x: 620, y: 120 };
    state.player.position = { x: 900, y: 120 };
    flyer.timeUntilPulse = 0;
    waker.timeUntilPulse = 0;

    updateEnemies(state, STAGE_ONE, FIXED_STEP_SECONDS);

    const flyerWave = state.soundWaves.find(
      (wave) => wave.kind === "enemy-call" && wave.sourceId === flyer.id,
    );
    expect(flyerWave).toBeDefined();
    expect(Math.max(...flyerWave!.rays.map((ray) => ray.remainingDistance))).toBe(
      MELEE_ATTACK_WAVE_CONFIG.distance,
    );
    expect(state.soundWaves.some(
      (wave) => wave.kind === "waker-call" && wave.sourceId === waker.id,
    )).toBe(false);
    expect(waker.action).toBe("sleep");
    expect(waker.timeUntilPulse).toBe(0);

    expect(pressTerrainButton(state, STAGE_ONE, "terrain-botton")).toBe(true);
    updateEnemies(
      state,
      STAGE_ONE,
      STAGE_ONE_CONFIG.wakerPulseWakeDelaySeconds,
    );

    const wakerWave = state.soundWaves.find(
      (wave) => wave.kind === "waker-call" && wave.sourceId === waker.id,
    );
    expect(wakerWave).toBeDefined();
    expect(Math.max(...wakerWave!.rays.map((ray) => ray.remainingDistance))).toBe(
      STAGE_ONE_CONFIG.wakerPulseDistance,
    );
  });

  it("smoothly accelerates the electric hazard as the player gets farther away", () => {
    expect(STAGE_ONE_CONFIG.electricHazardMinimumSpeed).toBe(
      PLAYER_CONFIG.maxSpeed * 0.5,
    );

    const world: WorldDefinition = {
      width: 12_000,
      height: 1_000,
      playerSpawn: { x: 100, y: 100 },
      terrain: [],
      enemies: [],
      hazards: [
        {
          id: "electric",
          kind: HAZARD_KINDS.electric,
          bounds: { x: 10_000, y: 100, width: 40, height: 40 },
        },
      ],
    };
    const state = createInitialGameState(world);
    const hazard = state.hazards[0];
    const hazardCenterX = hazard.bounds.x + hazard.bounds.width / 2;
    const transitionMidpoint =
      (STAGE_ONE_CONFIG.electricHazardNearDistance +
        STAGE_ONE_CONFIG.electricHazardFarDistance) /
      2;
    hazard.activationElapsed = 2.999;
    expect(getElectricHazardSpeed(0, hazard)).toBe(250);
    hazard.activationElapsed =
      STAGE_ONE_CONFIG.electricHazardMinimumSpeedSeconds;

    expect(getElectricHazardSpeed(hazardCenterX, hazard)).toBe(250);
    expect(getElectricHazardSpeed(
      hazardCenterX - STAGE_ONE_CONFIG.electricHazardNearDistance,
      hazard,
    )).toBe(250);
    expect(getElectricHazardSpeed(
      hazardCenterX - transitionMidpoint,
      hazard,
    )).toBeCloseTo(450);
    expect(getElectricHazardSpeed(
      hazardCenterX - STAGE_ONE_CONFIG.electricHazardFarDistance,
      hazard,
    )).toBe(650);
    expect(getElectricHazardSpeed(0, hazard)).toBe(650);

    hazard.activationElapsed = 0;
    updateWorldEnvironment(state, world, 2);
    expect(hazard.bounds).toEqual({ x: 10_000, y: 100, width: 40, height: 40 });

    hazard.activated = true;
    hazard.timeUntilPulse = 0;
    state.player.position.y = -100;
    updateWorldEnvironment(state, world, 2.5);
    expect(hazard.bounds.x).toBeCloseTo(9375);
    expect(hazard.activationElapsed).toBeCloseTo(2.5);
    updateWorldEnvironment(state, world, 0.5);
    expect(hazard.bounds.x).toBeCloseTo(9250);
    expect(hazard.activationElapsed).toBeCloseTo(3);
    updateWorldEnvironment(state, world, 1);
    expect(hazard.bounds.x).toBeCloseTo(8600);
    expect(hazard.bounds.width).toBe(40);
    expect(hazard.bounds.height).toBe(40);

    state.player.position.x = hazard.bounds.x + hazard.bounds.width / 2 - 100;
    updateWorldEnvironment(state, world, 1);
    expect(hazard.bounds.x).toBeCloseTo(8350);
    expect(getElectricHazardDamageBounds(world, hazard)).toEqual({
      x: 8350,
      y: 100,
      width: 40,
      height: 900,
    });
  });

  it("starts rapid tiny electric waves only after the button is pressed", () => {
    const state = createInitialGameState(STAGE_ONE);
    const hazard = state.hazards.find(
      (candidate) => candidate.id === "hazard-electric",
    )!;

    updateWorldEnvironment(state, STAGE_ONE, FIXED_STEP_SECONDS);
    expect(state.soundWaves.some((wave) => wave.kind === "electric-pulse")).toBe(false);

    expect(pressTerrainButton(state, STAGE_ONE, "terrain-botton")).toBe(true);

    updateWorldEnvironment(state, STAGE_ONE, FIXED_STEP_SECONDS);

    const wave = state.soundWaves.find((candidate) => candidate.kind === "electric-pulse");
    expect(STAGE_ONE_CONFIG.electricHazardPulseDistance).toBeLessThan(
      MELEE_ATTACK_WAVE_CONFIG.distance,
    );
    expect(STAGE_ONE_CONFIG.electricHazardPulseIntervalSeconds).toBe(0.1);
    expect(wave).toBeDefined();
    expect(Math.max(...wave!.rays.map((ray) => ray.remainingDistance))).toBe(72);
    expect(state.events.some((event) => event.type === "sound" && event.kind === "electric-pulse"))
      .toBe(false);

    updateWorldEnvironment(state, STAGE_ONE, 0.3);
    expect(state.soundWaves.filter((candidate) => candidate.kind === "electric-pulse"))
      .toHaveLength(4);
  });

  it("keeps the downward electric column lethal after every enemy is defeated", () => {
    const state = createInitialGameState(STAGE_ONE);
    for (const enemy of state.enemies) enemy.alive = false;
    expect(pressTerrainButton(state, STAGE_ONE, "terrain-botton")).toBe(true);
    const hazard = state.hazards.find(
      (candidate) => candidate.id === "hazard-electric",
    )!;
    const initialBounds = { ...hazard.bounds };
    const elapsedSeconds = 0.2;
    const expectedTravel =
      STAGE_ONE_CONFIG.electricHazardMinimumSpeed * elapsedSeconds;
    state.player.position = {
      x: initialBounds.x - expectedTravel + initialBounds.width / 2,
      y: initialBounds.y + initialBounds.height + PLAYER_CONFIG.height,
    };
    expect(getElectricHazardSpeed(state.player.position.x, hazard)).toBe(
      STAGE_ONE_CONFIG.electricHazardMinimumSpeed,
    );

    updateWorldEnvironment(state, STAGE_ONE, elapsedSeconds);

    expect(hazard.bounds).toEqual({
      x: initialBounds.x - expectedTravel,
      y: initialBounds.y,
      width: initialBounds.width,
      height: initialBounds.height,
    });
    expect(state.player.health).toBe(0);
    expect(state.player.action).toBe("dead");
  });

  it("wakes on the button, pursues, and starts its warned attack near x=900", () => {
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
    let encounterX = Number.NaN;
    for (let index = 0; index < 180; index += 1) {
      runnerVelocity = Math.max(
        -PLAYER_CONFIG.maxSpeed,
        runnerVelocity - PLAYER_CONFIG.acceleration * FIXED_STEP_SECONDS,
      );
      runnerX += runnerVelocity * FIXED_STEP_SECONDS;
      state.player.position = { x: runnerX, y: 200 };
      updateEnemies(state, world, FIXED_STEP_SECONDS);
      if (waker.action === "alert") {
        encounterX = (waker.position.x + runnerX) / 2;
        break;
      }
    }

    expect(encounterX).toBeGreaterThan(840);
    expect(encounterX).toBeLessThan(960);
    expect(waker.attackFacing).toBe(1);
    expect(state.soundWaves.some(
      (wave) => wave.kind === "enemy-alert" && wave.sourceId === waker.id,
    )).toBe(true);

    const healthBefore = state.player.health;
    updateEnemies(state, world, ENEMY_CONFIG.alertSeconds);
    expect(waker.action).toBe("attack");
    expect(state.player.health).toBe(healthBefore - 1);
  });
});
