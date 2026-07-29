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
}

export interface WorldDefinition {
  width: number;
  height: number;
  playerSpawn: Vector2State;
  terrain: TerrainBlock[];
  enemies: EnemySpawn[];
}
