export interface Vector2State {
  x: number;
  y: number;
}

export interface GameState {
  playerPosition: Vector2State;
}

export function createInitialGameState(): GameState {
  return {
    playerPosition: { x: 480, y: 270 },
  };
}
