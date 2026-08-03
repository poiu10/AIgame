import { ENEMY_KINDS, type WorldDefinition } from "../../content/world";
import {
  ENEMY_CONFIG,
  ENEMY_DEATH_WAVE_CONFIG,
  ENEMY_HIT_WAVE_CONFIG,
  STAGE_TWO_CONFIG,
} from "../rules/config";
import type {
  BossActorState,
  BossEncounterState,
  EnemyState,
  Facing,
  GameState,
  PhaseThreePattern,
  PhaseThreeBossState,
  Vector2State,
} from "../state";
import { emitSound, emitSoundWave } from "./sound";

const OFFSCREEN_Y = -100;
const INTERMISSION_FLIGHT_Y = 105;
const PATTERN_SIDE_X = 86;
const PATTERN_SIDE_Y = 220;
const PATTERN_TOP_Y = 68;
const PATTERN_CENTER_TOP_Y = 45;
const PROJECTILE_LOWER_Y = 404;
const PROJECTILE_UPPER_Y = 300;
const PROJECTILE_EDGE_X = 54;
const PROJECTILE_EXIT_MARGIN = 120;
const BOSS_REVEAL_SECONDS = 1;

function nextRandom(encounter: BossEncounterState): number {
  let value = encounter.randomState >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  encounter.randomState = value >>> 0;
  return encounter.randomState / 0x1_0000_0000;
}

function nextActorId(encounter: BossEncounterState): string {
  const id = `phase-three-projectile-${encounter.nextActorId}`;
  encounter.nextActorId += 1;
  return id;
}

function lerp(start: number, end: number, ratio: number): number {
  return start + (end - start) * Math.max(0, Math.min(1, ratio));
}

function easeInOut(ratio: number): number {
  const clamped = Math.max(0, Math.min(1, ratio));
  return clamped * clamped * (3 - 2 * clamped);
}

function setBossPositionAlongMove(
  boss: EnemyState,
  phaseThree: PhaseThreeBossState,
): void {
  const ratio = easeInOut(
    phaseThree.modeTime / Math.max(phaseThree.moveDuration, 0.001),
  );
  boss.position.x = lerp(
    phaseThree.moveStart.x,
    phaseThree.moveTarget.x,
    ratio,
  );
  boss.position.y = lerp(
    phaseThree.moveStart.y,
    phaseThree.moveTarget.y,
    ratio,
  );
}

function choosePattern(encounter: BossEncounterState): PhaseThreePattern {
  return (Math.floor(nextRandom(encounter) * 3) + 1) as PhaseThreePattern;
}

function chooseSide(encounter: BossEncounterState): Facing {
  return nextRandom(encounter) < 0.5 ? -1 : 1;
}

function bossPatternTarget(
  world: WorldDefinition,
  pattern: PhaseThreePattern,
  side: Facing,
): Vector2State {
  if (pattern === 1) {
    return {
      x: side < 0 ? PATTERN_SIDE_X : world.width - PATTERN_SIDE_X,
      y: PATTERN_SIDE_Y,
    };
  }
  if (pattern === 2) {
    return { x: world.width / 2, y: PATTERN_CENTER_TOP_Y };
  }
  return {
    x: side < 0 ? PATTERN_SIDE_X : world.width - PATTERN_SIDE_X,
    y: PATTERN_TOP_Y,
  };
}

function emitBossWave(state: GameState, boss: EnemyState): void {
  emitSoundWave(
    state,
    "waker-call",
    boss.position,
    STAGE_TWO_CONFIG.phaseThreeBossWaveDistance,
    STAGE_TWO_CONFIG.bossCallIntensity,
    boss.id,
  );
}

function emitBossCall(state: GameState, boss: EnemyState): void {
  emitSound(
    state,
    "waker-call",
    boss.position,
    STAGE_TWO_CONFIG.phaseThreeBossWaveDistance,
    STAGE_TWO_CONFIG.bossCallIntensity,
    boss.id,
  );
}

function emitBossWetSquelch(state: GameState, boss: EnemyState): void {
  emitSound(
    state,
    "boss-wet-squelch",
    boss.position,
    STAGE_TWO_CONFIG.phaseThreeBossWaveDistance,
    1,
    boss.id,
  );
}

function createProjectile(
  encounter: BossEncounterState,
  pattern: PhaseThreePattern,
  position: Vector2State,
  velocity: Vector2State,
  flightDuration: number,
): BossActorState {
  const facing: Facing = velocity.x < 0 ? -1 : 1;
  return {
    id: nextActorId(encounter),
    kind: "phase-three-projectile",
    pattern,
    position: { ...position },
    velocity,
    facing,
    age: 0,
    launchDelay: 0,
    flightDuration,
    damagesPlayer: true,
    spawnCallEmitted: true,
    secondCallTime: null,
    secondCallEmitted: true,
  };
}

function addProjectile(
  state: GameState,
  encounter: BossEncounterState,
  pattern: PhaseThreePattern,
  position: Vector2State,
  velocity: Vector2State,
  flightDuration: number,
): BossActorState {
  const actor = createProjectile(
    encounter,
    pattern,
    position,
    velocity,
    flightDuration,
  );
  encounter.actors.push(actor);
  emitSound(
    state,
    "spawn-wet-squelch",
    actor.position,
    STAGE_TWO_CONFIG.phaseThreeSpawnWaveDistance,
    STAGE_TWO_CONFIG.bossCallIntensity,
    actor.id,
  );
  return actor;
}

function addHorizontalProjectile(
  state: GameState,
  world: WorldDefinition,
  encounter: BossEncounterState,
  pattern: PhaseThreePattern,
  side: Facing,
  y: number,
): void {
  const speed = STAGE_TWO_CONFIG.phaseThreeProjectileSpeed;
  addProjectile(
    state,
    encounter,
    pattern,
    {
      x: side < 0 ? PROJECTILE_EDGE_X : world.width - PROJECTILE_EDGE_X,
      y,
    },
    { x: -side * speed, y: 0 },
    (world.width + PROJECTILE_EXIT_MARGIN * 2) / speed,
  );
}

function addAimedProjectile(
  state: GameState,
  encounter: BossEncounterState,
  boss: EnemyState,
  pattern: PhaseThreePattern,
  target: Vector2State,
): void {
  const deltaX = target.x - boss.position.x;
  const deltaY = target.y - boss.position.y;
  const distance = Math.max(1, Math.hypot(deltaX, deltaY));
  const speed = STAGE_TWO_CONFIG.phaseThreeProjectileSpeed;
  addProjectile(
    state,
    encounter,
    pattern,
    boss.position,
    { x: (deltaX / distance) * speed, y: (deltaY / distance) * speed },
    1.6,
  );
}

function addBarrageProjectile(
  state: GameState,
  encounter: BossEncounterState,
  boss: EnemyState,
): void {
  const phaseThree = encounter.phaseThree;
  if (!phaseThree) return;
  const random = nextRandom(encounter);
  const minimumAngle = phaseThree.side < 0 ? 0 : 0.5 * Math.PI;
  const maximumAngle = phaseThree.side < 0 ? 0.5 * Math.PI : Math.PI;
  const angle = lerp(minimumAngle, maximumAngle, random);
  const speed = STAGE_TWO_CONFIG.phaseThreeProjectileSpeed;
  addProjectile(
    state,
    encounter,
    3,
    boss.position,
    { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    1.8,
  );
}

function hasPatternProjectiles(
  encounter: BossEncounterState,
  pattern: PhaseThreePattern,
): boolean {
  return encounter.actors.some(
    (actor) =>
      actor.kind === "phase-three-projectile" && actor.pattern === pattern,
  );
}

function beginPatternActive(
  state: GameState,
  encounter: BossEncounterState,
  boss: EnemyState,
): void {
  const phaseThree = encounter.phaseThree;
  if (!phaseThree?.pattern) return;
  phaseThree.mode = "pattern-active";
  phaseThree.modeTime = 0;
  phaseThree.shotsFired = 0;
  phaseThree.volleysStarted = 0;
  phaseThree.volleyTargets = [];
  phaseThree.secondCallWaveEmitted = false;

  if (phaseThree.pattern === 1) {
    emitBossWetSquelch(state, boss);
    emitBossCall(state, boss);
  } else if (phaseThree.pattern === 2) {
    emitBossWetSquelch(state, boss);
    phaseThree.volleyTargets.push({ ...state.player.position });
    phaseThree.volleysStarted = 1;
  } else {
    emitSound(
      state,
      "waker-call-short",
      boss.position,
      STAGE_TWO_CONFIG.phaseThreeBossWaveDistance,
      STAGE_TWO_CONFIG.bossCallIntensity,
      boss.id,
    );
  }
}

export function triggerPhaseThreePattern(
  state: GameState,
  world: WorldDefinition,
  pattern: PhaseThreePattern,
  side: Facing = 1,
): boolean {
  const encounter = state.bossEncounter;
  if (!encounter || encounter.phase !== 3 || !encounter.phaseThree) {
    return false;
  }
  const boss = state.enemies.find((enemy) => enemy.id === encounter.bossId);
  if (!boss?.alive) return false;
  encounter.actors = encounter.actors.filter(
    (actor) => actor.kind !== "phase-three-projectile",
  );
  encounter.phaseThree.pattern = pattern;
  encounter.phaseThree.side = side;
  encounter.lastPattern = pattern;
  boss.position = bossPatternTarget(world, pattern, side);
  boss.facing = side < 0 ? 1 : -1;
  beginPatternActive(state, encounter, boss);
  return true;
}

function beginPatternEntry(
  world: WorldDefinition,
  encounter: BossEncounterState,
  boss: EnemyState,
  fromIntro: boolean,
): void {
  const phaseThree = encounter.phaseThree;
  if (!phaseThree) return;
  const pattern = choosePattern(encounter);
  const side = pattern === 2 ? 1 : chooseSide(encounter);
  const target = bossPatternTarget(world, pattern, side);
  phaseThree.mode = "pattern-enter";
  phaseThree.modeTime = 0;
  phaseThree.pattern = pattern;
  phaseThree.side = side;
  phaseThree.moveStart = fromIntro
    ? { ...boss.position }
    : { x: target.x, y: OFFSCREEN_Y };
  phaseThree.moveTarget = target;
  phaseThree.moveDuration = STAGE_TWO_CONFIG.phaseThreePatternEntrySeconds;
  boss.position = { ...phaseThree.moveStart };
  boss.facing = side < 0 ? 1 : -1;
  encounter.lastPattern = pattern;
}

function beginPatternExit(
  encounter: BossEncounterState,
  world: WorldDefinition,
  boss: EnemyState,
): void {
  const phaseThree = encounter.phaseThree;
  if (!phaseThree?.pattern) return;
  const horizontalExit = phaseThree.pattern === 1;
  phaseThree.mode = "pattern-exit";
  phaseThree.modeTime = 0;
  phaseThree.moveStart = { ...boss.position };
  phaseThree.moveTarget = horizontalExit
    ? {
        x: phaseThree.side < 0 ? -140 : world.width + 140,
        y: boss.position.y,
      }
    : { x: boss.position.x, y: OFFSCREEN_Y };
  phaseThree.moveDuration = STAGE_TWO_CONFIG.phaseThreePatternExitSeconds;
}

function updatePatternOne(
  state: GameState,
  world: WorldDefinition,
  encounter: BossEncounterState,
  boss: EnemyState,
): void {
  const phaseThree = encounter.phaseThree!;
  while (phaseThree.shotsFired < 3) {
    const shotTime =
      STAGE_TWO_CONFIG.phaseThreePatternWarningSeconds +
      phaseThree.shotsFired *
        STAGE_TWO_CONFIG.phaseThreePatternOneShotIntervalSeconds;
    if (phaseThree.modeTime < shotTime) break;
    const y = phaseThree.shotsFired === 1
      ? PROJECTILE_UPPER_Y
      : PROJECTILE_LOWER_Y;
    addHorizontalProjectile(
      state,
      world,
      encounter,
      1,
      phaseThree.side,
      y,
    );
    phaseThree.shotsFired += 1;
  }
  if (
    phaseThree.shotsFired === 3 &&
    !hasPatternProjectiles(encounter, 1)
  ) {
    beginPatternExit(encounter, world, boss);
  }
}

function updatePatternTwo(
  state: GameState,
  world: WorldDefinition,
  encounter: BossEncounterState,
  boss: EnemyState,
): void {
  const phaseThree = encounter.phaseThree!;
  while (phaseThree.volleysStarted < 3) {
    const cueTime =
      phaseThree.volleysStarted *
      STAGE_TWO_CONFIG.phaseThreePatternTwoIntervalSeconds;
    if (phaseThree.modeTime < cueTime) break;
    emitBossWetSquelch(state, boss);
    phaseThree.volleyTargets.push({ ...state.player.position });
    phaseThree.volleysStarted += 1;
  }
  while (phaseThree.shotsFired < phaseThree.volleysStarted) {
    const launchTime =
      phaseThree.shotsFired *
        STAGE_TWO_CONFIG.phaseThreePatternTwoIntervalSeconds +
      STAGE_TWO_CONFIG.phaseThreePatternWarningSeconds;
    if (phaseThree.modeTime < launchTime) break;
    emitBossCall(state, boss);
    addAimedProjectile(
      state,
      encounter,
      boss,
      2,
      phaseThree.volleyTargets[phaseThree.shotsFired],
    );
    phaseThree.shotsFired += 1;
  }
  if (
    phaseThree.modeTime >=
    STAGE_TWO_CONFIG.phaseThreePatternTwoDurationSeconds
  ) {
    beginPatternExit(encounter, world, boss);
  }
}

function updatePatternThree(
  state: GameState,
  world: WorldDefinition,
  encounter: BossEncounterState,
  boss: EnemyState,
): void {
  const phaseThree = encounter.phaseThree!;
  if (
    !phaseThree.secondCallWaveEmitted &&
    phaseThree.modeTime >= STAGE_TWO_CONFIG.phaseTwoDoubleCallDelaySeconds
  ) {
    phaseThree.secondCallWaveEmitted = true;
    emitBossWave(state, boss);
  }

  const shotCount = Math.round(
    STAGE_TWO_CONFIG.phaseThreePatternThreeBarrageSeconds /
      STAGE_TWO_CONFIG.phaseThreePatternThreeShotIntervalSeconds,
  );
  while (phaseThree.shotsFired < shotCount) {
    const shotTime =
      STAGE_TWO_CONFIG.phaseThreePatternThreeBarrageDelaySeconds +
      phaseThree.shotsFired *
        STAGE_TWO_CONFIG.phaseThreePatternThreeShotIntervalSeconds;
    if (phaseThree.modeTime < shotTime) break;
    addBarrageProjectile(state, encounter, boss);
    phaseThree.shotsFired += 1;
  }
  if (
    phaseThree.shotsFired === shotCount &&
    !hasPatternProjectiles(encounter, 3)
  ) {
    beginPatternExit(encounter, world, boss);
  }
}

function updatePatternActive(
  state: GameState,
  world: WorldDefinition,
  encounter: BossEncounterState,
  boss: EnemyState,
): void {
  const pattern = encounter.phaseThree?.pattern;
  if (pattern === 1) updatePatternOne(state, world, encounter, boss);
  if (pattern === 2) updatePatternTwo(state, world, encounter, boss);
  if (pattern === 3) updatePatternThree(state, world, encounter, boss);
}

function updateIntermission(
  state: GameState,
  world: WorldDefinition,
  encounter: BossEncounterState,
  boss: EnemyState,
  deltaSeconds: number,
): void {
  const phaseThree = encounter.phaseThree!;
  const descendStart =
    STAGE_TWO_CONFIG.phaseThreeIntermissionDescendDelaySeconds;
  const exitStart =
    STAGE_TWO_CONFIG.phaseThreeIntermissionSeconds -
    STAGE_TWO_CONFIG.phaseThreeIntermissionExitLeadSeconds;
  const time = phaseThree.modeTime;

  if (time < descendStart) {
    boss.position.y = OFFSCREEN_Y;
  } else if (time < descendStart + 1) {
    const ratio = easeInOut(time - descendStart);
    boss.position.x = lerp(phaseThree.moveStart.x, world.width / 2, ratio);
    boss.position.y = lerp(OFFSCREEN_Y, INTERMISSION_FLIGHT_Y, ratio);
  } else if (time < exitStart) {
    const flightTime = time - descendStart - 1;
    boss.position.x =
      world.width / 2 + Math.sin(flightTime * 1.35) * world.width * 0.31;
    boss.position.y = INTERMISSION_FLIGHT_Y + Math.sin(flightTime * 2.1) * 24;
  } else {
    const lastFlightTime = exitStart - descendStart - 1;
    const startX =
      world.width / 2 + Math.sin(lastFlightTime * 1.35) * world.width * 0.31;
    const startY =
      INTERMISSION_FLIGHT_Y + Math.sin(lastFlightTime * 2.1) * 24;
    const ratio = easeInOut(
      (time - exitStart) /
        STAGE_TWO_CONFIG.phaseThreeIntermissionExitLeadSeconds,
    );
    boss.position.x = startX;
    boss.position.y = lerp(startY, OFFSCREEN_Y, ratio);
  }

  if (time >= descendStart && time < exitStart) {
    phaseThree.bossCallTimer -= deltaSeconds;
    while (phaseThree.bossCallTimer <= 0) {
      emitBossCall(state, boss);
      phaseThree.bossCallTimer +=
        STAGE_TWO_CONFIG.phaseThreeBossCallIntervalSeconds;
    }
  }

  if (time >= STAGE_TWO_CONFIG.phaseThreeIntermissionSeconds) {
    beginPatternEntry(world, encounter, boss, false);
  }
}

export function startPhaseThree(
  state: GameState,
  encounter: BossEncounterState,
  boss: EnemyState,
): void {
  const cocoonPosition = { ...boss.position };
  encounter.phase = 3;
  encounter.timeUntilNextPattern = Number.POSITIVE_INFINITY;
  encounter.lastPattern = null;
  encounter.actors = encounter.actors.filter(
    (actor) => actor.kind !== "pattern" && actor.kind !== "intro-swarm",
  );
  boss.kind = ENEMY_KINDS.ravenBoss;
  boss.health = STAGE_TWO_CONFIG.phaseThreeHealth;
  boss.maxHealth = STAGE_TWO_CONFIG.phaseThreeHealth;
  boss.alive = true;
  boss.action = "fly";
  boss.actionTime = 0;
  boss.velocity = { x: 0, y: 0 };
  encounter.phaseThree = {
    mode: "intro",
    modeTime: 0,
    pattern: null,
    side: 1,
    cocoonPosition,
    moveStart: cocoonPosition,
    moveTarget: cocoonPosition,
    moveDuration: STAGE_TWO_CONFIG.phaseThreeIntroSeconds,
    bossWaveTimer: 0,
    bossCallTimer: 0,
    shotsFired: 0,
    volleysStarted: 0,
    volleyTargets: [],
    secondCallWaveEmitted: false,
  };
  emitSound(
    state,
    "boss-flesh-growth",
    cocoonPosition,
    STAGE_TWO_CONFIG.phaseThreeBossWaveDistance,
    1,
    boss.id,
  );
}

export function damagePhaseThreeBoss(
  state: GameState,
  encounter: BossEncounterState,
  boss: EnemyState,
): boolean {
  const phaseThree = encounter.phaseThree;
  if (!phaseThree || phaseThree.mode === "defeated" || !boss.alive) {
    return false;
  }
  boss.health = Math.max(0, boss.health - 1);
  boss.action = "hurt";
  boss.actionTime = 0;
  boss.echoTime = BOSS_REVEAL_SECONDS;
  boss.echoDuration = BOSS_REVEAL_SECONDS;
  state.events.push({
    type: "impact",
    position: { ...boss.position },
    strength: 0.9,
  });
  if (boss.health > 0) {
    emitSound(
      state,
      "enemy-hit",
      boss.position,
      ENEMY_HIT_WAVE_CONFIG.distance,
      ENEMY_HIT_WAVE_CONFIG.intensity,
      boss.id,
    );
    return true;
  }

  boss.alive = false;
  boss.action = "dead";
  boss.actionTime = 0;
  boss.velocity = { x: 0, y: 0 };
  boss.echoTime = ENEMY_CONFIG.deathRevealSeconds;
  boss.echoDuration = ENEMY_CONFIG.deathRevealSeconds;
  phaseThree.mode = "defeated";
  phaseThree.modeTime = 0;
  encounter.actors = encounter.actors.filter(
    (actor) => actor.kind !== "phase-three-projectile",
  );
  emitSound(
    state,
    "enemy-death",
    boss.position,
    ENEMY_DEATH_WAVE_CONFIG.distance,
    ENEMY_DEATH_WAVE_CONFIG.intensity,
    boss.id,
  );
  return true;
}

export function updatePhaseThreeBoss(
  state: GameState,
  world: WorldDefinition,
  encounter: BossEncounterState,
  boss: EnemyState,
  deltaSeconds: number,
): void {
  const phaseThree = encounter.phaseThree;
  if (!phaseThree || phaseThree.mode === "defeated" || !boss.alive) return;

  boss.echoTime = BOSS_REVEAL_SECONDS;
  boss.echoDuration = BOSS_REVEAL_SECONDS;
  phaseThree.bossWaveTimer -= deltaSeconds;
  while (phaseThree.bossWaveTimer <= 0) {
    emitBossWave(state, boss);
    phaseThree.bossWaveTimer +=
      STAGE_TWO_CONFIG.phaseThreeBossWaveIntervalSeconds;
  }

  phaseThree.modeTime += deltaSeconds;
  if (phaseThree.mode === "intro") {
    const ratio = easeInOut(
      phaseThree.modeTime / STAGE_TWO_CONFIG.phaseThreeIntroSeconds,
    );
    boss.position.x = phaseThree.cocoonPosition.x;
    boss.position.y = lerp(
      phaseThree.cocoonPosition.y,
      phaseThree.cocoonPosition.y + 80,
      ratio,
    );
    if (phaseThree.modeTime >= STAGE_TWO_CONFIG.phaseThreeIntroSeconds) {
      beginPatternEntry(world, encounter, boss, true);
    }
    return;
  }
  if (phaseThree.mode === "pattern-enter") {
    setBossPositionAlongMove(boss, phaseThree);
    if (phaseThree.modeTime >= phaseThree.moveDuration) {
      boss.position = { ...phaseThree.moveTarget };
      beginPatternActive(state, encounter, boss);
    }
    return;
  }
  if (phaseThree.mode === "pattern-active") {
    updatePatternActive(state, world, encounter, boss);
    return;
  }
  if (phaseThree.mode === "pattern-exit") {
    setBossPositionAlongMove(boss, phaseThree);
    if (phaseThree.modeTime >= phaseThree.moveDuration) {
      boss.position = { ...phaseThree.moveTarget };
      phaseThree.mode = "intermission";
      phaseThree.modeTime = 0;
      phaseThree.bossCallTimer = 0;
      phaseThree.moveStart = { ...boss.position };
    }
    return;
  }
  updateIntermission(state, world, encounter, boss, deltaSeconds);
}
