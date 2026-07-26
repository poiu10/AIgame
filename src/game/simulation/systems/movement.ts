import type { InputActions } from "../../input/actions";
import type { GameState } from "../state";

const PLAYER_SPEED = 220;
const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 540;
const PLAYER_RADIUS = 18;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function updateMovement(
  state: GameState,
  input: InputActions,
  deltaSeconds: number,
): void {
  const length = Math.hypot(input.moveX, input.moveY) || 1;
  const distance = PLAYER_SPEED * deltaSeconds;

  state.playerPosition.x += (input.moveX / length) * distance;
  state.playerPosition.y += (input.moveY / length) * distance;

  state.playerPosition.x = clamp(
    state.playerPosition.x,
    PLAYER_RADIUS,
    WORLD_WIDTH - PLAYER_RADIUS,
  );
  state.playerPosition.y = clamp(
    state.playerPosition.y,
    PLAYER_RADIUS,
    WORLD_HEIGHT - PLAYER_RADIUS,
  );
}
