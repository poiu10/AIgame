import type { RectState, Vector2State } from "../../content/world";

export interface RayHit {
  distance: number;
  point: Vector2State;
  normal: Vector2State;
}

const EPSILON = 0.0001;

export function centerRect(
  position: Vector2State,
  width: number,
  height: number,
): RectState {
  return {
    x: position.x - width / 2,
    y: position.y - height / 2,
    width,
    height,
  };
}

export function rectanglesOverlap(a: RectState, b: RectState): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function raycastAabb(
  origin: Vector2State,
  direction: Vector2State,
  maximumDistance: number,
  bounds: RectState,
): RayHit | null {
  let enter = -Infinity;
  let exit = Infinity;
  let normal: Vector2State = { x: 0, y: 0 };

  const axes = [
    {
      origin: origin.x,
      direction: direction.x,
      minimum: bounds.x,
      maximum: bounds.x + bounds.width,
      nearNormal: { x: direction.x > 0 ? -1 : 1, y: 0 },
    },
    {
      origin: origin.y,
      direction: direction.y,
      minimum: bounds.y,
      maximum: bounds.y + bounds.height,
      nearNormal: { x: 0, y: direction.y > 0 ? -1 : 1 },
    },
  ];

  for (const axis of axes) {
    if (Math.abs(axis.direction) < EPSILON) {
      if (axis.origin < axis.minimum || axis.origin > axis.maximum) {
        return null;
      }
      continue;
    }

    let near = (axis.minimum - axis.origin) / axis.direction;
    let far = (axis.maximum - axis.origin) / axis.direction;
    if (near > far) {
      [near, far] = [far, near];
    }

    if (near > enter) {
      enter = near;
      normal = axis.nearNormal;
    }
    exit = Math.min(exit, far);
    if (enter > exit) {
      return null;
    }
  }

  if (exit < EPSILON || enter < EPSILON || enter > maximumDistance) {
    return null;
  }

  return {
    distance: enter,
    point: {
      x: origin.x + direction.x * enter,
      y: origin.y + direction.y * enter,
    },
    normal,
  };
}

export function segmentIntersectsAabb(
  start: Vector2State,
  end: Vector2State,
  bounds: RectState,
): boolean {
  const delta = { x: end.x - start.x, y: end.y - start.y };
  const distance = Math.hypot(delta.x, delta.y);
  if (distance < EPSILON) {
    return false;
  }

  return (
    raycastAabb(
      start,
      { x: delta.x / distance, y: delta.y / distance },
      distance,
      bounds,
    ) !== null || rectanglesOverlap({ x: start.x, y: start.y, width: 1, height: 1 }, bounds)
  );
}
