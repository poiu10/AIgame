import { describe, expect, it } from "vitest";
import { STAGE_TWO } from "../src/game/content/stageTwo";
import {
  ENEMY_KINDS,
  HAZARD_KINDS,
  TERRAIN_KINDS,
} from "../src/game/content/world";
import {
  ENEMY_CONFIG,
  FIXED_STEP_SECONDS,
  PLAYER_CONFIG,
  SOUND_CONFIG,
  STAGE_TWO_CONFIG,
} from "../src/game/simulation/rules/config";
import { isEnemyBodyPresent } from "../src/game/simulation/rules/enemyDeath";
import {
  resolveBossEndingAlpha,
  resolveBossEndingText,
} from "../src/game/simulation/rules/bossEnding";
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
import { triggerPhaseThreePattern } from "../src/game/simulation/systems/phaseThreeBoss";
import { updateEnemies } from "../src/game/simulation/systems/enemies";
import { updateWorldEnvironment } from "../src/game/simulation/systems/environment";
import { emitSound, updateSoundPropagation } from "../src/game/simulation/systems/sound";
import { getActiveTerrain } from "../src/game/simulation/systems/stageMechanisms";
import {
  createCocoonBossThreatCells,
  createCrackedCocoonBossThreatCells,
  createEnemyThreatCells,
  createFloorHazardThreatCells,
} from "../src/phaser/view/threatPixelArt";
import {
  createBossDeathPieceCells,
  resolveBossDeathPieceAlpha,
  resolveBossDeathShakeOffset,
} from "../src/phaser/view/bossDeathPresentation";
import { createHudState } from "../src/ui/hud/mountHud";

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

function enterPhaseThree() {
  const { state, cocoon } = enterPhaseTwo();
  for (let hit = 0; hit < STAGE_TWO_CONFIG.phaseTwoHealth; hit += 1) {
    damageEnemy(state, cocoon, 1);
  }
  return { state, boss: cocoon };
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

  it("hides the boss health bar until the first successful boss hit", () => {
    const state = createInitialGameState(STAGE_TWO);
    const cocoon = state.enemies[0];

    expect(createHudState(state).boss).toBeNull();

    expect(damageEnemy(state, cocoon, 1)).toBe(true);
    expect(createHudState(state).boss).toMatchObject({
      health: STAGE_TWO_CONFIG.phaseOneHealth - 1,
      maxHealth: STAGE_TWO_CONFIG.phaseOneHealth,
      phase: 1,
    });

    const phaseTwo = enterPhaseTwo();
    expect(createHudState(phaseTwo.state).boss).toMatchObject({
      health: STAGE_TWO_CONFIG.phaseTwoHealth,
      maxHealth: STAGE_TWO_CONFIG.phaseTwoHealth,
      phase: 2,
    });
  });

  it("ejects a two-health pursuing enemy with a one-second call interval", () => {
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
      pulseIntervalSeconds:
        STAGE_TWO_CONFIG.phaseOneMinionPulseIntervalSeconds,
    });
    expect(minion!.position.y).toBeLessThan(cocoon.position.y);
    expect(minion!.velocity.x).toBeLessThan(0);
    expect(state.soundWaves).toContainEqual(
      expect.objectContaining({ kind: "waker-call", sourceId: minion!.id }),
    );
    const summonCallWave = state.soundWaves.find(
      (wave) => wave.kind === "waker-call" && wave.sourceId === minion!.id,
    );
    expect(Math.max(...summonCallWave!.rays.map((ray) => ray.remainingDistance)))
      .toBe(160);
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

    state.soundWaves = [];
    state.events = [];
    updateEnemies(state, STAGE_TWO, 0.59);
    expect(state.soundWaves).toHaveLength(0);
    updateEnemies(state, STAGE_TWO, 0.03);
    expect(state.soundWaves).toContainEqual(
      expect.objectContaining({ kind: "waker-call", sourceId: minion!.id }),
    );
  });

  it("removes non-boss bodies after their Stage 2 death animation", () => {
    const { state } = enterPhaseTwo();
    const minion = state.enemies.find(
      (enemy) => enemy.kind === ENEMY_KINDS.waker,
    )!;
    expect(damageEnemy(state, minion, 1)).toBe(true);
    expect(damageEnemy(state, minion, 1)).toBe(true);
    expect(isEnemyBodyPresent(STAGE_TWO, minion)).toBe(true);

    updateEnemies(
      state,
      STAGE_TWO,
      ENEMY_CONFIG.deathAnimationSeconds + FIXED_STEP_SECONDS,
    );

    expect(minion.alive).toBe(false);
    expect(isEnemyBodyPresent(STAGE_TWO, minion)).toBe(false);
    expect(isEnemyBodyPresent(STAGE_TWO, state.enemies[0])).toBe(true);

    minion.echoTime = 0;
    state.soundWaves = [];
    emitSound(state, "player-step", minion.position, 160, 1);
    for (let step = 0; step < 8; step += 1) {
      updateSoundPropagation(state, STAGE_TWO, FIXED_STEP_SECONDS);
    }
    expect(minion.echoTime).toBe(0);
  });

  it("steers pursuing enemies into attack range instead of orbiting the player", () => {
    const state = createInitialGameState(STAGE_TWO);
    const cocoon = state.enemies[0];
    damageEnemy(state, cocoon, 1);
    const minion = state.enemies.find((enemy) =>
      enemy.id.startsWith("boss-minion")
    )!;
    state.player.position = { x: 650, y: 350 };
    minion.position = { x: 210, y: 180 };
    minion.velocity = { x: -120, y: 520 };
    minion.action = "pursue";

    let enteredAttackSequence = false;
    for (let step = 0; step < 720; step += 1) {
      updateEnemies(state, STAGE_TWO, FIXED_STEP_SECONDS);
      if (minion.action === "alert" || minion.action === "attack") {
        enteredAttackSequence = true;
        break;
      }
    }
    expect(enteredAttackSequence).toBe(true);
  });

  it("refills the cocoon to fifteen health and sprays a harmless phase-two intro swarm", () => {
    const { state, cocoon } = enterPhaseTwo();

    expect(state.bossEncounter?.phase).toBe(2);
    expect(cocoon.alive).toBe(true);
    expect(cocoon.health).toBe(STAGE_TWO_CONFIG.phaseTwoHealth);
    expect(cocoon.maxHealth).toBe(STAGE_TWO_CONFIG.phaseTwoHealth);
    expect(state.enemies.filter((enemy) => enemy.id.startsWith("boss-minion")))
      .toHaveLength(STAGE_TWO_CONFIG.phaseOneHealth - 1);
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
    expect(state.bossEncounter?.actors.filter(
      (actor) => actor.kind === "intro-swarm",
    )).toHaveLength(0);
    expect(state.player.health).toBe(initialHealth);
    expect(state.events.filter(
      (event) => event.type === "sound" && event.kind === "waker-call-burst",
    )).toHaveLength(STAGE_TWO_CONFIG.phaseTwoIntroActorCount);
    const introCallWaves = state.soundWaves.filter(
      (wave) => wave.kind === "waker-call-burst",
    );
    expect(introCallWaves).toHaveLength(STAGE_TWO_CONFIG.phaseTwoIntroActorCount);
    expect(introCallWaves.every((wave) =>
      Math.max(...wave.rays.map((ray) => ray.remainingDistance)) === 160
    )).toBe(true);
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
    expect(state.soundWaves.every((wave) =>
      Math.max(...wave.rays.map((ray) => ray.remainingDistance)) === 160
    )).toBe(true);

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
    expect(state.soundWaves.every((wave) =>
      Math.max(...wave.rays.map((ray) => ray.remainingDistance)) === 160
    )).toBe(true);
    expect(encounter.actors.some((actor, index) =>
      actor.position.x !== positionsBeforeWarning[index]?.position.x ||
      actor.position.y !== positionsBeforeWarning[index]?.position.y
    )).toBe(true);
  });

  it("chooses a non-repeating phase-two pattern every two seconds and damages on contact", () => {
    const { state } = enterPhaseTwo();
    const encounter = state.bossEncounter!;
    encounter.actors = [];

    updateBossEncounter(state, STAGE_TWO, 1.99, () => false);
    expect(encounter.lastPattern).toBeNull();
    updateBossEncounter(state, STAGE_TWO, 0.02, () => false);
    expect([1, 2, 3, 4]).toContain(encounter.lastPattern);
    const firstPattern = encounter.lastPattern;
    encounter.actors = [];
    updateBossEncounter(
      state,
      STAGE_TWO,
      STAGE_TWO_CONFIG.phaseTwoPatternIntervalSeconds,
      () => false,
    );
    expect(encounter.lastPattern).not.toBe(firstPattern);

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

  it("cracks the cocoon and starts the raven-insect phase at twenty-five health", () => {
    const { state, boss } = enterPhaseThree();

    expect(state.bossEncounter?.phase).toBe(3);
    expect(state.bossEncounter?.phaseThree?.mode).toBe("intro");
    expect(boss).toMatchObject({
      kind: ENEMY_KINDS.ravenBoss,
      alive: true,
      health: STAGE_TWO_CONFIG.phaseThreeHealth,
      maxHealth: STAGE_TWO_CONFIG.phaseThreeHealth,
      action: "fly",
    });
    expect(state.events).toContainEqual(
      expect.objectContaining({ type: "sound", kind: "boss-flesh-growth" }),
    );
    const growthWave = state.soundWaves.find(
      (wave) => wave.kind === "boss-flesh-growth",
    )!;
    expect(Math.max(...growthWave.rays.map((ray) => ray.remainingDistance)))
      .toBe(STAGE_TWO_CONFIG.phaseThreeBossWaveDistance);

    updateBossEncounter(
      state,
      STAGE_TWO,
      STAGE_TWO_CONFIG.phaseThreeIntroSeconds,
      () => false,
    );
    expect(state.bossEncounter?.phaseThree?.mode).toBe("pattern-enter");
    expect(state.soundWaves.some((wave) =>
      wave.kind === "waker-call" && wave.sourceId === boss.id
    )).toBe(false);
  });

  it("does not damage on phase-three boss body contact", () => {
    const { state, boss } = enterPhaseThree();
    state.player.position = { ...boss.position };
    state.player.action = "normal";
    state.player.invulnerabilityTime = 0;

    updateEnemyContactDamage(state);

    expect(state.player.health).toBe(PLAYER_CONFIG.maxHealth);
    expect(state.player.action).toBe("normal");

    state.player.health = PLAYER_CONFIG.maxHealth;
    state.player.action = "roll";
    state.player.invulnerabilityTime = 0;
    updateEnemyContactDamage(state);
    expect(state.player.health).toBe(PLAYER_CONFIG.maxHealth);

    state.player.action = "normal";
    state.bossEncounter!.phaseThree!.mode = "death-shake";
    boss.health = 0;
    updateEnemyContactDamage(state);
    expect(state.player.health).toBe(PLAYER_CONFIG.maxHealth);
  });

  it("lets phase-three boss visibility expire between its sounds", () => {
    const { state, boss } = enterPhaseThree();
    const phaseThree = state.bossEncounter!.phaseThree!;
    state.soundWaves = [];
    state.events = [];
    boss.echoTime = 0;
    boss.echoDuration = SOUND_CONFIG.enemyEchoSeconds;
    phaseThree.mode = "pattern-enter";
    phaseThree.modeTime = 0;
    phaseThree.moveStart = { ...boss.position };
    phaseThree.moveTarget = { ...boss.position };
    phaseThree.moveDuration = 1;

    updateBossEncounter(state, STAGE_TWO, 0.1, () => false);

    expect(boss.echoTime).toBe(0);
    expect(state.soundWaves.some((wave) => wave.sourceId === boss.id)).toBe(false);
  });

  it("fires the three phase-three patterns with boss and spawn wave radii kept separate", () => {
    const { state } = enterPhaseThree();
    const encounter = state.bossEncounter!;
    encounter.actors = [];
    state.soundWaves = [];
    state.events = [];

    expect(triggerPhaseThreePattern(state, STAGE_TWO, 1, -1)).toBe(true);
    expect(state.events.filter((event) =>
      event.type === "sound" &&
      (event.kind === "boss-wet-squelch" || event.kind === "waker-call")
    )).toHaveLength(2);
    updateBossEncounter(state, STAGE_TWO, 0.51, () => false);
    expect(encounter.actors.at(-1)?.position.y).toBe(404);
    updateBossEncounter(state, STAGE_TWO, 0.8, () => false);
    expect(encounter.actors.at(-1)?.position.y).toBe(300);
    updateBossEncounter(state, STAGE_TWO, 0.8, () => false);
    expect(encounter.actors.at(-1)?.position.y).toBe(404);
    const patternOneSpawnWaves = state.soundWaves.filter(
      (wave) => wave.kind === "spawn-wet-squelch",
    );
    expect(patternOneSpawnWaves).toHaveLength(3);
    expect(patternOneSpawnWaves.every((wave) =>
      Math.max(...wave.rays.map((ray) => ray.remainingDistance)) === 160
    )).toBe(true);

    state.soundWaves = [];
    state.events = [];
    state.player.position = { x: 300, y: 390 };
    triggerPhaseThreePattern(state, STAGE_TWO, 2);
    const boss = state.enemies.find((enemy) => enemy.id === encounter.bossId)!;
    expect(boss.position.y).toBe(
      STAGE_TWO_CONFIG.phaseThreeIntermissionFlightY,
    );
    state.player.position = { x: 700, y: 200 };
    updateBossEncounter(state, STAGE_TWO, 0.51, () => false);
    const aimed = encounter.actors.find(
      (actor) => actor.kind === "phase-three-projectile" && actor.pattern === 2,
    )!;
    expect(aimed.velocity.x).toBeLessThan(0);
    expect(aimed.velocity.y).toBeGreaterThan(0);
    expect(state.events).toContainEqual(
      expect.objectContaining({ type: "sound", kind: "waker-call" }),
    );
    updateBossEncounter(state, STAGE_TWO, 1.5, () => false);
    expect(encounter.phaseThree?.phaseTwoPatternsStarted).toBe(1);
    expect(encounter.actors.some((actor) => actor.kind === "pattern"))
      .toBe(true);
    const firstOverlappingPattern =
      encounter.phaseThree?.lastOverlappingPattern;
    updateBossEncounter(state, STAGE_TWO, 2, () => false);
    expect(encounter.phaseThree?.phaseTwoPatternsStarted).toBe(2);
    expect(encounter.phaseThree?.lastOverlappingPattern)
      .not.toBe(firstOverlappingPattern);
    expect(encounter.phaseThree?.volleysStarted).toBe(2);
    expect(encounter.phaseThree?.shotsFired).toBe(2);

    state.soundWaves = [];
    state.events = [];
    triggerPhaseThreePattern(state, STAGE_TWO, 3, 1);
    expect(state.events).toContainEqual(
      expect.objectContaining({ type: "sound", kind: "waker-call-short" }),
    );
    updateBossEncounter(state, STAGE_TWO, 3.01, () => false);
    const firstBarrageShot = encounter.actors.find(
      (actor) => actor.kind === "phase-three-projectile" && actor.pattern === 3,
    )!;
    expect(firstBarrageShot.velocity.x).toBeLessThanOrEqual(0);
    expect(firstBarrageShot.velocity.y).toBeGreaterThanOrEqual(0);
    updateBossEncounter(
      state,
      STAGE_TWO,
      STAGE_TWO_CONFIG.phaseThreePatternThreeBarrageSeconds,
      () => false,
    );
    const barrageWaves = state.soundWaves.filter(
      (wave) => wave.kind === "spawn-wet-squelch",
    );
    expect(barrageWaves).toHaveLength(30);
    expect(barrageWaves.every((wave) =>
      Math.max(...wave.rays.map((ray) => ray.remainingDistance)) === 160
    )).toBe(true);
  });

  it("waits eight seconds after a phase-three pattern exits, then attacks again", () => {
    const { state, boss } = enterPhaseThree();
    const encounter = state.bossEncounter!;
    triggerPhaseThreePattern(state, STAGE_TWO, 2);
    updateBossEncounter(state, STAGE_TWO, 20, () => false);
    expect(encounter.phaseThree?.mode).toBe("pattern-exit");
    updateBossEncounter(
      state,
      STAGE_TWO,
      STAGE_TWO_CONFIG.phaseThreePatternExitSeconds,
      () => false,
    );
    expect(encounter.phaseThree?.mode).toBe("intermission");
    updateBossEncounter(state, STAGE_TWO, 0.99, () => false);
    expect(boss.position.y).toBe(-100);
    updateBossEncounter(state, STAGE_TWO, 1.01, () => false);
    expect(boss.position.y).toBeGreaterThan(-100);
    updateBossEncounter(state, STAGE_TWO, 5, () => false);
    expect(encounter.phaseThree?.mode).toBe("intermission");
    updateBossEncounter(state, STAGE_TWO, 1, () => false);
    expect(encounter.phaseThree?.mode).toBe("pattern-enter");
  });

  it("runs the fixed alternating lower-side and upper phase-three sequence", () => {
    const { state, boss } = enterPhaseThree();
    const encounter = state.bossEncounter!;
    const selections: { pattern: number | null; side: number }[] = [];
    for (let index = 0; index < 8; index += 1) {
      encounter.phaseThree!.mode = "intermission";
      encounter.phaseThree!.modeTime =
        STAGE_TWO_CONFIG.phaseThreeIntermissionSeconds - 0.01;
      encounter.phaseThree!.moveStart = { ...boss.position };
      updateBossEncounter(state, STAGE_TWO, 0.02, () => false);
      selections.push({
        pattern: encounter.phaseThree!.pattern,
        side: encounter.phaseThree!.side,
      });
    }

    expect(selections).toEqual([
      { pattern: 1, side: -1 },
      { pattern: 2, side: 1 },
      { pattern: 1, side: 1 },
      { pattern: 3, side: -1 },
      { pattern: 1, side: -1 },
      { pattern: 2, side: 1 },
      { pattern: 1, side: 1 },
      { pattern: 3, side: 1 },
    ]);
  });

  it("shakes, explodes into body pieces, and reveals End five seconds after death", () => {
    const { state, boss } = enterPhaseThree();
    for (let hit = 0; hit < STAGE_TWO_CONFIG.phaseThreeHealth; hit += 1) {
      expect(damageEnemy(state, boss, 1)).toBe(true);
    }
    const phaseThree = state.bossEncounter!.phaseThree!;
    expect(boss.alive).toBe(true);
    expect(boss.health).toBe(0);
    expect(phaseThree.mode).toBe("death-shake");
    expect(phaseThree.deathSquelchesEmitted).toBe(1);
    expect(damageEnemy(state, boss, 1)).toBe(false);

    const firstShake = resolveBossDeathShakeOffset(0);
    const nextShake = resolveBossDeathShakeOffset(0.05);
    expect(firstShake).not.toEqual(nextShake);
    expect(Math.abs(firstShake.x % 3)).toBe(0);
    expect(Math.abs(firstShake.y % 3)).toBe(0);

    updateBossEncounter(
      state,
      STAGE_TWO,
      STAGE_TWO_CONFIG.phaseThreeDeathShakeSeconds - 0.01,
      () => false,
    );
    expect(phaseThree.mode).toBe("death-shake");
    expect(boss.alive).toBe(true);
    expect(phaseThree.deathSquelchesEmitted).toBe(10);
    expect(state.events.filter((event) =>
      event.type === "sound" && event.kind === "boss-death-squelch"
    )).toHaveLength(10);
    expect(state.soundWaves.filter((wave) =>
      wave.kind === "boss-death-squelch" &&
      Math.max(...wave.rays.map((ray) => ray.remainingDistance)) === 160
    )).toHaveLength(10);

    const wetExplosionSoundsBefore = state.events.filter((event) =>
      event.type === "sound" && event.kind === "boss-wet-squelch"
    ).length;
    updateBossEncounter(state, STAGE_TWO, 0.02, () => false);
    expect(phaseThree.mode).toBe("death-explosion");
    expect(boss.alive).toBe(false);
    expect(state.events).toContainEqual(expect.objectContaining({
      type: "sound",
      kind: "boss-death-explosion",
    }));
    expect(state.events.filter((event) =>
      event.type === "sound" && event.kind === "boss-wet-squelch"
    )).toHaveLength(wetExplosionSoundsBefore + 1);
    expect(state.soundWaves.some((wave) =>
      wave.kind === "boss-death-explosion" &&
      Math.max(...wave.rays.map((ray) => ray.remainingDistance)) === 540
    )).toBe(true);
    expect(state.soundWaves.some((wave) =>
      wave.kind === "boss-wet-squelch" &&
      Math.max(...wave.rays.map((ray) => ray.remainingDistance)) === 540
    )).toBe(true);
    expect(phaseThree.deathPieces).toHaveLength(
      STAGE_TWO_CONFIG.phaseThreeDeathPieceCount,
    );
    expect(phaseThree.deathPieces.some((piece) => piece.velocity.x < 0)).toBe(true);
    expect(phaseThree.deathPieces.some((piece) => piece.velocity.x > 0)).toBe(true);
    expect(phaseThree.deathPieces.some((piece) => piece.velocity.y < 0)).toBe(true);
    expect(phaseThree.deathPieces.some((piece) => piece.velocity.y > 0)).toBe(true);
    const reconstructedBossCells = new Set<string>();
    for (const piece of phaseThree.deathPieces) {
      const cells = createBossDeathPieceCells(piece);
      expect(cells.length).toBeGreaterThanOrEqual(20);
      expect(cells.every((cell) =>
        Number.isInteger(cell.x) && Number.isInteger(cell.y)
      )).toBe(true);
      const offsetX = Math.round((piece.position.x - boss.position.x) / 3);
      const offsetY = Math.round((piece.position.y - boss.position.y) / 3);
      for (const cell of cells) {
        reconstructedBossCells.add(`${offsetX + cell.x},${offsetY + cell.y}`);
      }
    }
    const sourceBossCells = new Set(
      createEnemyThreatCells("hurt", boss.facing, ENEMY_KINDS.ravenBoss)
        .map((cell) => `${cell.x},${cell.y}`),
    );
    expect(reconstructedBossCells).toEqual(sourceBossCells);
    expect(resolveBossDeathPieceAlpha(phaseThree.deathPieces[0])).toBe(1);
    expect(resolveBossDeathPieceAlpha({
      ...phaseThree.deathPieces[0],
      age: phaseThree.deathPieces[0].lifetime * 0.84,
    })).toBeCloseTo(0.5);
    expect(resolveBossEndingText(phaseThree.endingTime)).toBe("");
    expect(resolveBossEndingText(4.999)).toBe("");
    expect(resolveBossEndingText(5)).toBe("End");
    expect(resolveBossEndingText(20)).toBe("End");
    expect(resolveBossEndingAlpha(null)).toBe(0);
    expect(resolveBossEndingAlpha(4.999)).toBe(0);
    expect(resolveBossEndingAlpha(5)).toBe(0);
    expect(resolveBossEndingAlpha(5.5)).toBeCloseTo(0.5);
    expect(resolveBossEndingAlpha(6)).toBe(1);
    expect(resolveBossEndingAlpha(20)).toBe(1);

    updateBossEncounter(
      state,
      STAGE_TWO,
      STAGE_TWO_CONFIG.phaseThreeDeathPieceLifetimeSeconds,
      () => false,
    );
    expect(phaseThree.deathPieces).toHaveLength(0);
    expect(phaseThree.mode).toBe("defeated");
    expect(resolveBossEndingText(phaseThree.endingTime)).toBe("");
    updateBossEncounter(
      state,
      STAGE_TWO,
      STAGE_TWO_CONFIG.phaseThreeEndTitleDelaySeconds -
        STAGE_TWO_CONFIG.phaseThreeDeathPieceLifetimeSeconds,
      () => false,
    );
    expect(resolveBossEndingText(phaseThree.endingTime)).toBe("End");
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
    expect(hazard.reactionTime).toBeGreaterThan(0);
    expect(hazard.reactionOffsetX).toBe(hazard.bounds.width / 2);

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
    const cracked = createCrackedCocoonBossThreatCells(1);
    expect(Math.min(...cracked.map((cell) => Math.abs(cell.x))))
      .toBeGreaterThan(10);

    const state = createInitialGameState(STAGE_TWO);
    emitSound(state, "player-step", { x: 680, y: 460 }, 120, 1, "player");
    for (let index = 0; index < 8; index += 1) {
      updateSoundPropagation(state, STAGE_TWO, FIXED_STEP_SECONDS);
    }
    expect(state.echoMarks.some((mark) => mark.surfaceId === "hazard-13"))
      .toBe(true);
  });

  it("reveals the floor hazard when a wave starts inside it", () => {
    const state = createInitialGameState(STAGE_TWO);
    const hazard = state.hazards[0];
    emitSound(
      state,
      "landing",
      {
        x: hazard.bounds.x + hazard.bounds.width / 2,
        y: hazard.bounds.y + hazard.bounds.height - 2,
      },
      120,
      0.35,
      "player",
    );

    for (let index = 0; index < 8; index += 1) {
      updateSoundPropagation(state, STAGE_TWO, FIXED_STEP_SECONDS);
    }

    expect(state.echoMarks.some((mark) =>
      mark.surfaceKind === "hazard" && mark.surfaceId === hazard.id
    )).toBe(true);
  });
});
