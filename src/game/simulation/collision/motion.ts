import type { TerrainBlock } from "../../content/world";
import type { Vector2State } from "../state";
import { centerRect, rectanglesOverlap } from "./aabb";

export interface MovingBody {
  position: Vector2State;
  velocity: Vector2State;
  grounded: boolean;
}

export interface MotionResult {
  movedX: number;
  movedY: number;
  landed: boolean;
  hitWall: boolean;
}

export function moveBodyAgainstTerrain(
  body: MovingBody,
  width: number,
  height: number,
  terrain: TerrainBlock[],
  deltaSeconds: number,
): MotionResult {
  const startX = body.position.x;
  const startY = body.position.y;
  const wasGrounded = body.grounded;
  const verticalSpeed = body.velocity.y;
  let hitWall = false;

  body.position.x += body.velocity.x * deltaSeconds;
  for (const block of terrain) {
    const bodyBounds = centerRect(body.position, width, height);
    if (!rectanglesOverlap(bodyBounds, block.bounds)) {
      continue;
    }

    if (body.velocity.x > 0) {
      body.position.x = block.bounds.x - width / 2;
    } else if (body.velocity.x < 0) {
      body.position.x = block.bounds.x + block.bounds.width + width / 2;
    }
    body.velocity.x = 0;
    hitWall = true;
  }

  body.grounded = false;
  body.position.y += body.velocity.y * deltaSeconds;
  for (const block of terrain) {
    const bodyBounds = centerRect(body.position, width, height);
    if (!rectanglesOverlap(bodyBounds, block.bounds)) {
      continue;
    }

    if (body.velocity.y > 0) {
      body.position.y = block.bounds.y - height / 2;
      body.grounded = true;
    } else if (body.velocity.y < 0) {
      body.position.y = block.bounds.y + block.bounds.height + height / 2;
    }
    body.velocity.y = 0;
  }

  return {
    movedX: body.position.x - startX,
    movedY: body.position.y - startY,
    landed: !wasGrounded && body.grounded && verticalSpeed > 80,
    hitWall,
  };
}
