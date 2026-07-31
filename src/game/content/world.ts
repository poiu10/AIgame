export interface Vector2State {
  x: number;
  y: number;
}

export interface RectState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TerrainBlock {
  id: string;
  kind?: string;
  bounds: RectState;
}

export interface EnemySpawn {
  id: string;
  kind?: string;
  role?: "enemy" | "boss";
  position: Vector2State;
  patrolMinX: number;
  patrolMaxX: number;
  health?: number;
}

export interface HazardDefinition {
  id: string;
  kind?: string;
  bounds: RectState;
}

export type WorldSoundKind = "ambient" | "hazard";

export interface WorldSoundEmitter {
  id: string;
  kind: WorldSoundKind;
  position: Vector2State;
  intervalSeconds: number;
  initialDelaySeconds: number;
  maximumDistance: number;
  intensity: number;
  revealsHazardId?: string;
}

export interface TutorialSection {
  id: "move" | "jump" | "roll" | "attack" | "trial";
  startX: number;
  prompt: string;
  requiresEnemyDefeated?: string;
}

export interface WorldDefinition {
  width: number;
  height: number;
  playerSpawn: Vector2State;
  terrain: TerrainBlock[];
  enemies: EnemySpawn[];
  hazards?: HazardDefinition[];
  soundEmitters?: WorldSoundEmitter[];
  tutorialSections?: TutorialSection[];
}

export interface StageSpawn {
  id: string;
  position: Vector2State;
  facing?: -1 | 1;
}

export interface StageExit {
  id: string;
  bounds: RectState;
  targetStageId: string;
  targetSpawnId: string;
}

export interface StageDefinition extends WorldDefinition {
  schemaVersion: 1;
  id: string;
  name: string;
  spawns: StageSpawn[];
  exits: StageExit[];
}
