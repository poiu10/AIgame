import {
  ENEMY_KINDS,
  HAZARD_KINDS,
  TERRAIN_KINDS,
  type RectState,
  type WorldDefinition,
} from "../content/world";
import { TUTORIAL_STAGE } from "../content/tutorialStage";
import { ENEMY_CONFIG, PLAYER_CONFIG, STAGE_ONE_CONFIG } from "./rules/config";

export type Facing = -1 | 1;
export type GroundAttackVariant = 0 | 1 | 2;
export type PlayerAction = "normal" | "roll" | "attack" | "hurt" | "dead";
export type EnemyAction =
  | "sleep"
  | "eject"
  | "patrol"
  | "fly"
  | "pursue"
  | "alert"
  | "attack"
  | "hurt"
  | "dead";
export type SoundKind =
  | "player-step"
  | "landing"
  | "player-attack"
  | "enemy-step"
  | "enemy-alert"
  | "enemy-attack"
  | "enemy-call"
  | "waker-call"
  | "waker-call-burst"
  | "waker-call-short"
  | "boss-flesh-growth"
  | "boss-wet-squelch"
  | "spawn-wet-squelch"
  | "boss-death-squelch"
  | "enemy-hit"
  | "enemy-death"
  | "sleep"
  | "water"
  | "door-open"
  | "door-close"
  | "crusher-pulse"
  | "electric-pulse";

export interface Vector2State {
  x: number;
  y: number;
}

export interface PlayerState {
  position: Vector2State;
  velocity: Vector2State;
  hitboxOffsetX: number;
  facing: Facing;
  attackFacing: Facing;
  attackVariant: GroundAttackVariant;
  nextGroundAttackVariant: GroundAttackVariant;
  attackAirborne: boolean;
  grounded: boolean;
  health: number;
  maxHealth: number;
  action: PlayerAction;
  actionTime: number;
  rollCooldown: number;
  attackCooldown: number;
  invulnerabilityTime: number;
  coyoteTime: number;
  jumpBufferTime: number;
  airborneApexY: number;
  footstepTravel: number;
  attackHitIds: string[];
}

export interface EnemyState {
  id: string;
  kind: string;
  position: Vector2State;
  velocity: Vector2State;
  facing: Facing;
  attackFacing: Facing;
  grounded: boolean;
  health: number;
  maxHealth: number;
  alive: boolean;
  action: EnemyAction;
  actionTime: number;
  attackCooldown: number;
  patrolMinX: number;
  patrolMaxX: number;
  footstepTravel: number;
  echoTime: number;
  echoDuration: number;
  activated: boolean;
  timeUntilPulse: number;
}

export type BossPhase = 1 | 2 | 3;
export type BossAttackPattern = 1 | 2 | 3 | 4;
export type PhaseThreePattern = 1 | 2 | 3;
export type PhaseThreeMode =
  | "intro"
  | "pattern-enter"
  | "pattern-active"
  | "pattern-exit"
  | "intermission"
  | "death-shake"
  | "death-explosion"
  | "defeated";

export interface BossActorState {
  id: string;
  kind: "intro-swarm" | "pattern" | "phase-three-projectile";
  pattern: BossAttackPattern | null;
  position: Vector2State;
  velocity: Vector2State;
  facing: Facing;
  age: number;
  launchDelay: number;
  flightDuration: number;
  damagesPlayer: boolean;
  spawnCallEmitted: boolean;
  secondCallTime: number | null;
  secondCallEmitted: boolean;
}

export interface PhaseThreeBossState {
  mode: PhaseThreeMode;
  modeTime: number;
  pattern: PhaseThreePattern | null;
  side: Facing;
  cocoonPosition: Vector2State;
  moveStart: Vector2State;
  moveTarget: Vector2State;
  moveDuration: number;
  bossWaveTimer: number;
  bossCallTimer: number;
  shotsFired: number;
  volleysStarted: number;
  volleyTargets: Vector2State[];
  secondCallWaveEmitted: boolean;
  deathSquelchTimer: number;
  deathSquelchesEmitted: number;
  deathPieces: BossDeathPieceState[];
  endingTime: number | null;
}

export interface BossDeathPieceState {
  position: Vector2State;
  velocity: Vector2State;
  age: number;
  lifetime: number;
  spin: number;
  spinSpeed: number;
  shape: number;
}

export interface BossEncounterState {
  bossId: string;
  phase: BossPhase;
  timeUntilNextPattern: number;
  randomState: number;
  nextActorId: number;
  lastPattern: BossAttackPattern | null;
  actors: BossActorState[];
  phaseThree: PhaseThreeBossState | null;
}

export interface TerrainState {
  id: string;
  active: boolean;
  pressed: boolean;
  echoTime: number;
  echoDuration: number;
}

export interface HazardState {
  id: string;
  kind: string;
  bounds: RectState;
  echoTime: number;
  echoDuration: number;
  reactionTime: number;
  reactionDuration: number;
  reactionSide: Facing;
  reactionOffsetY: number;
  activated: boolean;
  activationElapsed: number;
  timeUntilPulse: number;
}

export interface WorldSoundEmitterState {
  id: string;
  timeUntilPulse: number;
}

export interface SoundRayState {
  position: Vector2State;
  previousPosition: Vector2State;
  direction: Vector2State;
  remainingDistance: number;
  intensity: number;
  reflectionCount: number;
  pathKey: string;
  active: boolean;
}

export interface SoundWaveState {
  id: number;
  kind: SoundKind;
  sourceId?: string;
  origin: Vector2State;
  rays: SoundRayState[];
  reactedEnemyIds: string[];
}

export interface EchoMarkState {
  surfaceId: string;
  surfaceKind: "terrain" | "hazard";
  start: Vector2State;
  end: Vector2State;
  intensity: number;
  time: number;
  duration: number;
}

export interface SoundEvent {
  type: "sound";
  kind: SoundKind;
  position: Vector2State;
  intensity: number;
}

export interface ImpactEvent {
  type: "impact";
  position: Vector2State;
  strength: number;
}

export type GameEvent = SoundEvent | ImpactEvent;

export interface GameState {
  elapsedTime: number;
  player: PlayerState;
  enemies: EnemyState[];
  terrain: TerrainState[];
  hazards: HazardState[];
  worldSoundEmitters: WorldSoundEmitterState[];
  tutorialStep: number;
  soundWaves: SoundWaveState[];
  echoMarks: EchoMarkState[];
  events: GameEvent[];
  nextWaveId: number;
  bossEncounter: BossEncounterState | null;
}

export function createInitialGameState(
  world: WorldDefinition = TUTORIAL_STAGE,
): GameState {
  const cocoonBoss = world.enemies.find(
    (spawn) => spawn.kind === ENEMY_KINDS.cocoonBoss,
  );
  return {
    elapsedTime: 0,
    player: {
      position: { ...world.playerSpawn },
      velocity: { x: 0, y: 0 },
      hitboxOffsetX: 0,
      facing: 1,
      attackFacing: 1,
      attackVariant: 0,
      nextGroundAttackVariant: 0,
      attackAirborne: false,
      grounded: false,
      health: PLAYER_CONFIG.maxHealth,
      maxHealth: PLAYER_CONFIG.maxHealth,
      action: "normal",
      actionTime: 0,
      rollCooldown: 0,
      attackCooldown: 0,
      invulnerabilityTime: 0,
      coyoteTime: 0,
      jumpBufferTime: 0,
      airborneApexY: world.playerSpawn.y,
      footstepTravel: 0,
      attackHitIds: [],
    },
    enemies: world.enemies.map((spawn, spawnIndex) => ({
      id: spawn.id,
      kind: spawn.kind ?? ENEMY_KINDS.stalker,
      position: { ...spawn.position },
      velocity: { x: 0, y: 0 },
      facing: -1,
      attackFacing: -1,
      grounded: false,
      health: spawn.health ?? ENEMY_CONFIG.maxHealth,
      maxHealth: spawn.health ?? ENEMY_CONFIG.maxHealth,
      alive: true,
      action:
        spawn.kind === ENEMY_KINDS.sleeper ||
        spawn.kind === ENEMY_KINDS.waker ||
        spawn.kind === ENEMY_KINDS.cocoonBoss
          ? "sleep"
          : spawn.kind === ENEMY_KINDS.flyer
            ? "fly"
            : "patrol",
      actionTime: 0,
      attackCooldown: 0,
      patrolMinX: spawn.patrolMinX,
      patrolMaxX: spawn.patrolMaxX,
      footstepTravel: 0,
      echoTime: 0,
      echoDuration: 0,
      activated: spawn.kind !== ENEMY_KINDS.waker,
      timeUntilPulse:
        spawn.kind === ENEMY_KINDS.sleeper
          ? 0.45
          : spawn.kind === ENEMY_KINDS.flyer
            ? STAGE_ONE_CONFIG.activeEnemyPulseInitialDelaySeconds +
              (spawnIndex % 3) * STAGE_ONE_CONFIG.activeEnemyPulseSpawnStaggerSeconds
            : spawn.kind === ENEMY_KINDS.waker
              ? STAGE_ONE_CONFIG.wakerPulseWakeDelaySeconds
              : Number.POSITIVE_INFINITY,
    })),
    terrain: world.terrain.map((block) => ({
      id: block.id,
      active:
        block.kind !== TERRAIN_KINDS.closesOnButton &&
        block.kind !== TERRAIN_KINDS.closesOnEntry,
      pressed: false,
      echoTime: 0,
      echoDuration: 0,
    })),
    hazards: (world.hazards ?? []).map((hazard) => ({
      id: hazard.id,
      kind: hazard.kind ?? HAZARD_KINDS.crusher,
      bounds: { ...hazard.bounds },
      echoTime: 0,
      echoDuration: 0,
      reactionTime: 0,
      reactionDuration: 0,
      reactionSide: 1,
      reactionOffsetY: 0,
      activated: false,
      activationElapsed: 0,
      timeUntilPulse: Number.POSITIVE_INFINITY,
    })),
    worldSoundEmitters: (world.soundEmitters ?? []).map((emitter) => ({
      id: emitter.id,
      timeUntilPulse: emitter.initialDelaySeconds,
    })),
    tutorialStep: 0,
    soundWaves: [],
    echoMarks: [],
    events: [],
    nextWaveId: 1,
    bossEncounter: cocoonBoss
      ? {
          bossId: cocoonBoss.id,
          phase: 1,
          timeUntilNextPattern: Number.POSITIVE_INFINITY,
          randomState: 0x6d2b79f5,
          nextActorId: 1,
          lastPattern: null,
          actors: [],
          phaseThree: null,
        }
      : null,
  };
}
