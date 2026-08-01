import {
  ENEMY_KINDS,
  HAZARD_KINDS,
  TERRAIN_KINDS,
  type RectState,
  type WorldDefinition,
} from "../content/world";
import { TUTORIAL_STAGE } from "../content/tutorialStage";
import { ENEMY_CONFIG, PLAYER_CONFIG } from "./rules/config";

export type Facing = -1 | 1;
export type GroundAttackVariant = 0 | 1 | 2;
export type PlayerAction = "normal" | "roll" | "attack" | "hurt" | "dead";
export type EnemyAction =
  | "sleep"
  | "patrol"
  | "fly"
  | "pursue"
  | "alert"
  | "attack"
  | "hurt"
  | "dead";
export type SessionStatus = "playing" | "completed" | "failed";
export type SoundKind =
  | "terrain-step"
  | "landing"
  | "attack-hit"
  | "enemy-step"
  | "enemy-alert"
  | "enemy-attack"
  | "hurt"
  | "death"
  | "ambient"
  | "hazard";

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
  hazardInvulnerabilityTime: number;
  patrolMinX: number;
  patrolMaxX: number;
  footstepTravel: number;
  echoTime: number;
  echoDuration: number;
  activated: boolean;
  timeUntilPulse: number;
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
  growthActive: boolean;
  growthElapsed: number;
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
  status: SessionStatus;
  nextWaveId: number;
}

export function createInitialGameState(
  world: WorldDefinition = TUTORIAL_STAGE,
): GameState {
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
      invulnerabilityTime: 0,
      coyoteTime: 0,
      jumpBufferTime: 0,
      airborneApexY: world.playerSpawn.y,
      footstepTravel: 0,
      attackHitIds: [],
    },
    enemies: world.enemies.map((spawn) => ({
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
        spawn.kind === ENEMY_KINDS.sleeper || spawn.kind === ENEMY_KINDS.waker
          ? "sleep"
          : spawn.kind === ENEMY_KINDS.flyer
            ? "fly"
            : "patrol",
      actionTime: 0,
      attackCooldown: 0,
      hazardInvulnerabilityTime: 0,
      patrolMinX: spawn.patrolMinX,
      patrolMaxX: spawn.patrolMaxX,
      footstepTravel: 0,
      echoTime: 0,
      echoDuration: 0,
      activated: spawn.kind !== ENEMY_KINDS.waker,
      timeUntilPulse: spawn.kind === ENEMY_KINDS.sleeper ? 0.45 : 1.15,
    })),
    terrain: world.terrain.map((block) => ({
      id: block.id,
      active: block.kind !== TERRAIN_KINDS.closesOnButton,
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
      growthActive: false,
      growthElapsed: 0,
      timeUntilPulse: hazard.kind === HAZARD_KINDS.growing ? 0.35 : Number.POSITIVE_INFINITY,
    })),
    worldSoundEmitters: (world.soundEmitters ?? []).map((emitter) => ({
      id: emitter.id,
      timeUntilPulse: emitter.initialDelaySeconds,
    })),
    tutorialStep: 0,
    soundWaves: [],
    echoMarks: [],
    events: [],
    status: "playing",
    nextWaveId: 1,
  };
}
