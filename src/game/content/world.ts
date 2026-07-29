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
  bounds: RectState;
}

export interface EnemySpawn {
  id: string;
  position: Vector2State;
  patrolMinX: number;
  patrolMaxX: number;
  health?: number;
}

export interface HazardDefinition {
  id: string;
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
