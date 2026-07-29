import type { WorldDefinition } from "../content/world";
import { TUTORIAL_STAGE } from "../content/tutorialStage";
import { ENEMY_CONFIG, PLAYER_CONFIG } from "./rules/config";

export type Facing = -1 | 1;
export type PlayerAction = "normal" | "roll" | "attack" | "hurt" | "dead";
export type EnemyAction = "patrol" | "attack" | "hurt" | "dead";
export type SessionStatus = "playing" | "completed" | "failed";
export type SoundKind =
  | "terrain-step"
  | "landing"
  | "attack-hit"
  | "enemy-step"
  | "enemy-attack"
  | "hurt"
  | "death"
  | "ambient"
  | "hazard"
  | "debug";

export interface Vector2State {
  x: number;
  y: number;
}

export interface PlayerState {
  position: Vector2State;
  velocity: Vector2State;
  facing: Facing;
  attackFacing: Facing;
  grounded: boolean;
  health: number;
  maxHealth: number;
  action: PlayerAction;
  actionTime: number;
  rollCooldown: number;
  invulnerabilityTime: number;
  coyoteTime: number;
  jumpBufferTime: number;
  footstepTravel: number;
  attackHitIds: string[];
}

export interface EnemyState {
  id: string;
  position: Vector2State;
  velocity: Vector2State;
  facing: Facing;
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
}

export interface HazardState {
  id: string;
  echoTime: number;
  echoDuration: number;
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
      facing: 1,
      attackFacing: 1,
      grounded: false,
      health: PLAYER_CONFIG.maxHealth,
      maxHealth: PLAYER_CONFIG.maxHealth,
      action: "normal",
      actionTime: 0,
      rollCooldown: 0,
      invulnerabilityTime: 0,
      coyoteTime: 0,
      jumpBufferTime: 0,
      footstepTravel: 0,
      attackHitIds: [],
    },
    enemies: world.enemies.map((spawn) => ({
      id: spawn.id,
      position: { ...spawn.position },
      velocity: { x: 0, y: 0 },
      facing: -1,
      grounded: false,
      health: spawn.health ?? ENEMY_CONFIG.maxHealth,
      maxHealth: spawn.health ?? ENEMY_CONFIG.maxHealth,
      alive: true,
      action: "patrol",
      actionTime: 0,
      attackCooldown: 0,
      patrolMinX: spawn.patrolMinX,
      patrolMaxX: spawn.patrolMaxX,
      footstepTravel: 0,
      echoTime: 0,
      echoDuration: 0,
    })),
    hazards: (world.hazards ?? []).map((hazard) => ({
      id: hazard.id,
      echoTime: 0,
      echoDuration: 0,
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
