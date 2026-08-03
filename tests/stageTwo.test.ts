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
  damagePlayer,
  damageEnemy,
  updateEnemyContactDamage,
} from "../src/game/simulation/systems/combat";
import {
  triggerBossPattern,
  updateBossEncounter,
} from "../src/game/simulation/systems/bossEncounter";
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

function enterPhaseTwo() {
  const state = createInitialGameState(STAGE_TWO);
  const cocoon = state.enemies[0];
  for (let hit = 0; hit < STAGE_TWO_CONFIG.phaseOneHealth; hit += 1) {
    damageEnemy(state, cocoon, hit % 2 === 0 ? -1 : 1);
  }
  return { state, cocoon };
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
        health: STAGE_TWO_CONFIG.phaseOneHealth,
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

  it("keeps the cocoon stationary and harmless while phase one starts at five health", () => {
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
    expect(cocoon.health).toBe(STAGE_TWO_CONFIG.phaseOneHealth);
    expect(cocoon.maxHealth).toBe(STAGE_TWO_CONFIG.phaseOneHealth);
    expect(state.bossEncounter?.phase).toBe(1);
    expect(state.player.health).toBe(PLAYER_CONFIG.maxHealth);
  });

  it("ejects one two-health pursuing enemy and plays its call on every phase-one hit", () => {
    const state = createInitialGameState(STAGE_TWO);
    const cocoon = state.enemies[0];

    expect(damageEnemy(state, cocoon, -1)).toBe(true);

    const minion = state.enemies.find((enemy) => enemy.id.startsWith("boss-minion"));
    expect(minion).toMatchObject({
      kind: ENEMY_KINDS.waker,
      health: STAGE_TWO_CONFIG.phaseOneMinionHealth,
      maxHealth: STAGE_TWO_CONFIG.phaseOneMinionHealth,
      action: "eject",
      activated: true,
      facing: -1,
    });
    expect(minion!.position.y).toBeLessThan(cocoon.position.y);
    expect(minion!.velocity.x).toBeLessThan(0);
    expect(state.soundWaves).toContainEqual(
      expect.objectContaining({ kind: "waker-call", sourceId: minion!.id }),
    );
    expect(state.events).toContainEqual(
      expect.objectContaining({ type: "sound", kind: "waker-call" }),
    );

    updateEnemies(
      state,
      STAGE_TWO,
      STAGE_TWO_CONFIG.phaseOneEjectSeconds + FIXED_STEP_SECONDS,
    );
    expect(minion!.action).toBe("pursue");
    expect(minion!.position.x).toBeLessThan(cocoon.position.x);
  });

  it("refills the cocoon to fifteen health and sprays a harmless phase-two intro swarm", () => {
    const { state, cocoon } = enterPhaseTwo();

    expect(state.bossEncounter?.phase).toBe(2);
    expect(cocoon.alive).toBe(true);
    expect(cocoon.health).toBe(STAGE_TWO_CONFIG.phaseTwoHealth);
    expect(cocoon.maxHealth).toBe(STAGE_TWO_CONFIG.phaseTwoHealth);
    expect(state.enemies.filter((enemy) => enemy.id.startsWith("boss-minion")))
      .toHaveLength(STAGE_TWO_CONFIG.phaseOneHealth);
    expect(state.bossEncounter?.actors).toHaveLength(
      STAGE_TWO_CONFIG.phaseTwoIntroActorCount,
    );
    expect(state.bossEncounter?.actors.every((actor) =>
      actor.kind === "intro-swarm" && !actor.damagesPlayer
    )).toBe(true);

    const initialHealth = state.player.health;
    updateBossEncounter(state, STAGE_TWO, 2, (direction) =>
      damagePlayer(state, direction),
    );
    expect(state.bossEncounter?.actors).toHaveLength(0);
    expect(state.player.health).toBe(initialHealth);
  });

  it("builds all four warned, invulnerable phase-two attack formations", () => {
    const { state } = enterPhaseTwo();
    const encounter = state.bossEncounter!;
    encounter.actors = [];
    state.soundWaves = [];
    state.events = [];

    const horizontal = triggerBossPattern(state, STAGE_TWO, 1);
    expect(horizontal).toHaveLength(1);
    expect(horizontal[0].position.y).toBe(404);
    expect(horizontal[0].velocity.y).toBe(0);

    state.player.position.x = 600;
    const vertical = triggerBossPattern(state, STAGE_TWO, 2);
    expect(vertical).toHaveLength(1);
    expect(vertical[0].position.x).toBe(600);
    expect(vertical[0].velocity.y).toBeGreaterThan(0);

    const converging = triggerBossPattern(state, STAGE_TWO, 3);
    expect(converging).toHaveLength(2);
    expect(converging[0].velocity.x).toBeGreaterThan(0);
    expect(converging[1].velocity.x).toBeLessThan(0);

    const doubleDrop = triggerBossPattern(state, STAGE_TWO, 4);
    expect(doubleDrop).toHaveLength(2);
    expect(doubleDrop.every((actor) => actor.secondCallTime !== null)).toBe(true);
    expect(state.soundWaves.filter((wave) => wave.kind === "waker-call-short"))
      .toHaveLength(2);

    const enemyIds = new Set(state.enemies.map((enemy) => enemy.id));
    expect(encounter.actors.every((actor) => !enemyIds.has(actor.id))).toBe(true);
    const positionsBeforeWarning = encounter.actors.map((actor) => ({
      id: actor.id,
      position: { ...actor.position },
    }));
    updateBossEncounter(state, STAGE_TWO, 0.24, () => false);
    expect(encounter.actors.map((actor) => actor.position)).toEqual(
      positionsBeforeWarning.map((actor) => actor.position),
    );
    expect(state.soundWaves.filter((wave) => wave.kind === "waker-call"))
      .toHaveLength(4);

    updateBossEncounter(state, STAGE_TWO, 0.27, () => false);
    expect(state.soundWaves.filter((wave) => wave.kind === "waker-call"))
      .toHaveLength(6);
    expect(encounter.actors.some((actor, index) =>
      actor.position.x !== positionsBeforeWarning[index]?.position.x ||
      actor.position.y !== positionsBeforeWarning[index]?.position.y
    )).toBe(true);
  });

  it("chooses a new phase-two pattern every five seconds and attack actors damage on contact", () => {
    const { state } = enterPhaseTwo();
    const encounter = state.bossEncounter!;
    encounter.actors = [];

    updateBossEncounter(state, STAGE_TWO, 4.99, () => false);
    expect(encounter.lastPattern).toBeNull();
    updateBossEncounter(state, STAGE_TWO, 0.02, () => false);
    expect([1, 2, 3, 4]).toContain(encounter.lastPattern);

    encounter.actors = [];
    state.player.action = "normal";
    state.player.invulnerabilityTime = 0;
    state.player.position = { x: 480, y: 200 };
    triggerBossPattern(state, STAGE_TWO, 2);
    const healthBefore = state.player.health;
    updateBossEncounter(state, STAGE_TWO, 0.6, (direction) =>
      damagePlayer(state, direction),
    );
    expect(state.player.health).toBe(healthBefore - 1);
  });

  it("stops after phase-two health is exhausted and leaves phase three for later", () => {
    const { state, cocoon } = enterPhaseTwo();
    for (let hit = 0; hit < STAGE_TWO_CONFIG.phaseTwoHealth; hit += 1) {
      expect(damageEnemy(state, cocoon, 1)).toBe(true);
    }

    expect(state.bossEncounter?.phase).toBe(3);
    expect(cocoon.alive).toBe(true);
    expect(cocoon.health).toBe(0);
    expect(damageEnemy(state, cocoon, 1)).toBe(false);
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
