import { ENEMY_CONFIG } from "../../game/simulation/rules/config";
import { ENEMY_KINDS } from "../../game/content/world";
import { ENEMY_ATTACK_HITBOX } from "../../game/simulation/rules/combat";
import type {
  EnemyState,
  Facing,
  HazardState,
} from "../../game/simulation/state";
import { SOUND_PIXEL_SIZE } from "./pixelLine";

export const THREAT_PIXEL_SIZE = SOUND_PIXEL_SIZE;

export interface ThreatPixelCell {
  x: number;
  y: number;
}

export const SHORT_FLOOR_HAZARD_ID = "hazard-7";
export const LONG_FLOOR_HAZARD_ID = "hazard-1";
export const STAGE_TWO_FLOOR_HAZARD_ID = "hazard-13";

interface CellPoint {
  x: number;
  y: number;
}

type CellPolygon = readonly CellPoint[];

export type EnemyThreatFrame =
  | "idle"
  | "sleep-0"
  | "sleep-1"
  | "walk-0"
  | "walk-1"
  | "walk-2"
  | "walk-3"
  | "alert-0"
  | "alert-1"
  | "attack-strike"
  | "attack-follow-through"
  | "attack-recover"
  | "hurt"
  | "death-recoil"
  | "death-fall"
  | "death-collapse"
  | "corpse";

export type HazardReactionFrame = "impact" | "scatter" | "fade";

const WALK_FRAMES: readonly EnemyThreatFrame[] = [
  "walk-0",
  "walk-1",
  "walk-2",
  "walk-3",
];
const GROUNDED_ENEMY_WALK_FRAMES_PER_SECOND =
  (WALK_FRAMES.length * ENEMY_CONFIG.patrolSpeed) /
  ENEMY_CONFIG.footstepDistance;

const ENEMY_ATTACK_REACH_CELL =
  Math.ceil(ENEMY_ATTACK_HITBOX.reach / THREAT_PIXEL_SIZE) - 1;

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function addBoundary(
  cells: Map<string, ThreatPixelCell>,
  start: CellPoint,
  end: CellPoint,
): void {
  let x = start.x;
  let y = start.y;
  const deltaX = Math.abs(end.x - x);
  const stepX = x < end.x ? 1 : -1;
  const deltaY = -Math.abs(end.y - y);
  const stepY = y < end.y ? 1 : -1;
  let error = deltaX + deltaY;

  while (true) {
    cells.set(cellKey(x, y), { x, y });
    if (x === end.x && y === end.y) {
      return;
    }

    const doubledError = error * 2;
    if (doubledError >= deltaY) {
      error += deltaY;
      x += stepX;
    }
    if (doubledError <= deltaX) {
      error += deltaX;
      y += stepY;
    }
  }
}

function pointInsidePolygon(x: number, y: number, polygon: CellPolygon): boolean {
  let inside = false;
  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current, current += 1
  ) {
    const a = polygon[current];
    const b = polygon[previous];
    const crossesScanline = a.y > y !== b.y > y;
    if (
      crossesScanline &&
      x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function addFilledPolygon(
  cells: Map<string, ThreatPixelCell>,
  polygon: CellPolygon,
): void {
  const minimumX = Math.min(...polygon.map((point) => point.x));
  const maximumX = Math.max(...polygon.map((point) => point.x));
  const minimumY = Math.min(...polygon.map((point) => point.y));
  const maximumY = Math.max(...polygon.map((point) => point.y));

  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      if (pointInsidePolygon(x + 0.5, y + 0.5, polygon)) {
        cells.set(cellKey(x, y), { x, y });
      }
    }
  }

  for (let index = 0; index < polygon.length; index += 1) {
    addBoundary(
      cells,
      polygon[index],
      polygon[(index + 1) % polygon.length],
    );
  }
}

function addPolygons(
  cells: Map<string, ThreatPixelCell>,
  polygons: readonly CellPolygon[],
): void {
  for (const polygon of polygons) {
    addFilledPolygon(cells, polygon);
  }
}

function addPolyline(
  cells: Map<string, ThreatPixelCell>,
  points: readonly CellPoint[],
): void {
  for (let index = 0; index < points.length - 1; index += 1) {
    addBoundary(cells, points[index], points[index + 1]);
  }
}

function fillEnclosedCells(cells: Map<string, ThreatPixelCell>): void {
  const values = [...cells.values()];
  if (values.length === 0) return;
  const minimumX = Math.min(...values.map((cell) => cell.x)) - 1;
  const maximumX = Math.max(...values.map((cell) => cell.x)) + 1;
  const minimumY = Math.min(...values.map((cell) => cell.y)) - 1;
  const maximumY = Math.max(...values.map((cell) => cell.y)) + 1;
  const outside = new Set<string>();
  const queue: ThreatPixelCell[] = [{ x: minimumX, y: minimumY }];

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const key = cellKey(current.x, current.y);
    if (outside.has(key) || cells.has(key)) continue;
    if (
      current.x < minimumX ||
      current.x > maximumX ||
      current.y < minimumY ||
      current.y > maximumY
    ) {
      continue;
    }
    outside.add(key);
    queue.push(
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
    );
  }

  for (let y = minimumY + 1; y < maximumY; y += 1) {
    for (let x = minimumX + 1; x < maximumX; x += 1) {
      const key = cellKey(x, y);
      if (!cells.has(key) && !outside.has(key)) cells.set(key, { x, y });
    }
  }
}

function createBodyPolygons(
  bodyOffsetY: number,
  headReach: number,
): CellPolygon[] {
  return [
    // 낮은 몸통과 길게 빠진 옆얼굴을 하나의 덩어리로 묶는다.
    [
      { x: -9, y: -6 + bodyOffsetY },
      { x: -6, y: -10 + bodyOffsetY },
      { x: -2, y: -12 + bodyOffsetY },
      { x: 3, y: -11 + bodyOffsetY },
      { x: 6, y: -9 + bodyOffsetY },
      { x: 8, y: -11 + bodyOffsetY },
      { x: 9, y: -8 + bodyOffsetY },
      { x: headReach - 2, y: -7 + bodyOffsetY },
      { x: headReach, y: -5 + bodyOffsetY },
      { x: headReach - 3, y: -3 + bodyOffsetY },
      { x: 8, y: -3 + bodyOffsetY },
      { x: 6, y: 1 + bodyOffsetY },
      { x: 5, y: 6 + bodyOffsetY },
      { x: 1, y: 8 + bodyOffsetY },
      { x: -5, y: 7 + bodyOffsetY },
      { x: -8, y: 3 + bodyOffsetY },
    ],
    // 뒤로 휘는 꼬리 덕분에 좌우 방향이 실루엣만으로 읽힌다.
    [
      { x: -7, y: -5 + bodyOffsetY },
      { x: -12, y: -9 + bodyOffsetY },
      { x: -16, y: -8 + bodyOffsetY },
      { x: -13, y: -5 + bodyOffsetY },
      { x: -16, y: -3 + bodyOffsetY },
      { x: -11, y: -3 + bodyOffsetY },
      { x: -7, y: 1 + bodyOffsetY },
    ],
    // 등 가시는 내부 무늬 없이도 포식자의 외곽 리듬을 만든다.
    [
      { x: -7, y: -9 + bodyOffsetY },
      { x: -6, y: -15 + bodyOffsetY },
      { x: -3, y: -11 + bodyOffsetY },
    ],
    [
      { x: -3, y: -11 + bodyOffsetY },
      { x: -1, y: -16 + bodyOffsetY },
      { x: 1, y: -11 + bodyOffsetY },
    ],
    [
      { x: 1, y: -11 + bodyOffsetY },
      { x: 4, y: -14 + bodyOffsetY },
      { x: 5, y: -9 + bodyOffsetY },
    ],
    // 옆머리에서 뒤로 젖혀진 단일 뿔.
    [
      { x: 6, y: -9 + bodyOffsetY },
      { x: 5, y: -15 + bodyOffsetY },
      { x: 9, y: -10 + bodyOffsetY },
    ],
  ];
}

function createWalkLegPolygons(
  frame: EnemyThreatFrame,
  bodyOffsetY: number,
): CellPolygon[] {
  const strideByFrame: Readonly<
    Record<"walk-0" | "walk-1" | "walk-2" | "walk-3" | "idle", readonly [number, number]>
  > = {
    idle: [7, -7],
    "walk-0": [11, -9],
    "walk-1": [7, -5],
    "walk-2": [2, -1],
    "walk-3": [6, -6],
  };
  const safeFrame =
    frame === "walk-0" ||
    frame === "walk-1" ||
    frame === "walk-2" ||
    frame === "walk-3"
      ? frame
      : "idle";
  const [frontFootX, rearFootX] = strideByFrame[safeFrame];

  return [
    [
      { x: 2, y: 4 + bodyOffsetY },
      { x: 6, y: 4 + bodyOffsetY },
      { x: 7, y: 9 },
      { x: frontFootX, y: 14 },
      { x: frontFootX + 2, y: 15 },
      { x: frontFootX - 2, y: 15 },
      { x: 3, y: 10 },
    ],
    [
      { x: -6, y: 4 + bodyOffsetY },
      { x: -2, y: 5 + bodyOffsetY },
      { x: -3, y: 9 },
      { x: rearFootX, y: 14 },
      { x: rearFootX + 2, y: 15 },
      { x: rearFootX - 2, y: 15 },
      { x: -7, y: 10 },
    ],
  ];
}

function createClawPolygons(
  frame: EnemyThreatFrame,
  bodyOffsetY: number,
): CellPolygon[] {
  if (frame === "alert-1") {
    return [[
      { x: 3, y: -7 + bodyOffsetY },
      { x: 5, y: -13 + bodyOffsetY },
      { x: 10, y: -17 + bodyOffsetY },
      { x: 9, y: -12 + bodyOffsetY },
      { x: 6, y: -6 + bodyOffsetY },
    ]];
  }

  if (frame === "attack-strike") {
    return [[
      { x: 4, y: -6 + bodyOffsetY },
      { x: 10, y: -8 + bodyOffsetY },
      { x: 23, y: -7 + bodyOffsetY },
      { x: ENEMY_ATTACK_REACH_CELL - 5, y: -5 + bodyOffsetY },
      { x: ENEMY_ATTACK_REACH_CELL, y: -2 + bodyOffsetY },
      { x: ENEMY_ATTACK_REACH_CELL - 4, y: 2 + bodyOffsetY },
      { x: ENEMY_ATTACK_REACH_CELL - 3, y: -1 + bodyOffsetY },
      { x: 23, y: -2 + bodyOffsetY },
      { x: 9, y: -2 + bodyOffsetY },
      { x: 5, y: 1 + bodyOffsetY },
    ]];
  }

  if (frame === "attack-follow-through") {
    return [[
      { x: 4, y: -5 + bodyOffsetY },
      { x: 10, y: -4 + bodyOffsetY },
      { x: 20, y: -1 + bodyOffsetY },
      { x: 30, y: 5 + bodyOffsetY },
      { x: 26, y: 10 + bodyOffsetY },
      { x: 27, y: 5 + bodyOffsetY },
      { x: 18, y: 2 + bodyOffsetY },
      { x: 7, y: 1 + bodyOffsetY },
      { x: 4, y: 3 + bodyOffsetY },
    ]];
  }

  if (frame === "attack-recover") {
    return [[
      { x: 3, y: -5 + bodyOffsetY },
      { x: 8, y: -3 + bodyOffsetY },
      { x: 17, y: 1 + bodyOffsetY },
      { x: 14, y: 7 + bodyOffsetY },
      { x: 14, y: 3 + bodyOffsetY },
      { x: 7, y: 0 + bodyOffsetY },
      { x: 4, y: 2 + bodyOffsetY },
    ]];
  }

  return [[
    { x: 3, y: -5 + bodyOffsetY },
    { x: 7, y: -3 + bodyOffsetY },
    { x: 10, y: 3 + bodyOffsetY },
    { x: 8, y: 8 + bodyOffsetY },
    { x: 8, y: 4 + bodyOffsetY },
    { x: 4, y: 1 + bodyOffsetY },
  ]];
}

function createEnemyPolygons(frame: EnemyThreatFrame): CellPolygon[] {
  if (frame === "corpse") {
    return [[
      { x: -15, y: 13 },
      { x: -10, y: 9 },
      { x: -5, y: 11 },
      { x: -1, y: 7 },
      { x: 3, y: 10 },
      { x: 9, y: 9 },
      { x: 14, y: 13 },
      { x: 10, y: 15 },
      { x: -13, y: 15 },
    ]];
  }

  if (frame === "death-collapse") {
    return [[
      { x: -14, y: 10 },
      { x: -10, y: 5 },
      { x: -5, y: 7 },
      { x: -1, y: 2 },
      { x: 4, y: 6 },
      { x: 10, y: 7 },
      { x: 14, y: 12 },
      { x: 10, y: 15 },
      { x: -12, y: 15 },
    ]];
  }

  if (frame === "death-fall") {
    return [
      [
        { x: -14, y: -1 },
        { x: -9, y: -7 },
        { x: -3, y: -6 },
        { x: 2, y: -2 },
        { x: 9, y: 1 },
        { x: 13, y: 6 },
        { x: 8, y: 9 },
        { x: 2, y: 5 },
        { x: -5, y: 3 },
        { x: -11, y: 5 },
      ],
      [
        { x: -9, y: -5 },
        { x: -10, y: -12 },
        { x: -6, y: -7 },
      ],
      [
        { x: 4, y: 0 },
        { x: 12, y: -3 },
        { x: 16, y: 0 },
        { x: 10, y: 3 },
      ],
    ];
  }

  if (frame === "death-recoil") {
    return [
      ...createBodyPolygons(0, 11),
      ...createWalkLegPolygons("idle", 0),
      [
        { x: 2, y: -5 },
        { x: 5, y: -11 },
        { x: 9, y: -14 },
        { x: 8, y: -8 },
        { x: 5, y: -2 },
      ],
    ];
  }

  if (frame === "hurt") {
    return [
      ...createBodyPolygons(1, 11),
      ...createWalkLegPolygons("idle", 1),
      [
        { x: 1, y: -5 },
        { x: 6, y: -2 },
        { x: 8, y: 5 },
        { x: 5, y: 7 },
        { x: 4, y: 2 },
      ],
    ];
  }

  const bodyOffsetY =
    frame === "walk-1" || frame === "walk-3"
      ? -1
      : frame === "alert-0" || frame === "attack-recover"
        ? 1
        : 0;
  const headReach = frame === "attack-strike" ? 16 : 13;
  const locomotionFrame = frame.startsWith("walk-") ? frame : "idle";

  return [
    ...createBodyPolygons(bodyOffsetY, headReach),
    ...createWalkLegPolygons(locomotionFrame, bodyOffsetY),
    ...createClawPolygons(frame, bodyOffsetY),
  ];
}

function createSleepingEnemyPolygons(
  waker: boolean,
  breathing = false,
): CellPolygon[] {
  const bodyLift = breathing ? -1 : 0;
  const crest = waker ? (breathing ? -10 : -8) : -5;
  return [
    [
      { x: -11, y: 4 + bodyLift },
      { x: -8, y: -2 + bodyLift },
      { x: -2, y: crest },
      { x: 5, y: -5 + bodyLift },
      { x: 11, y: -1 + bodyLift },
      { x: 9, y: 5 + bodyLift },
      { x: 3, y: 7 + bodyLift },
      { x: -6, y: 7 + bodyLift },
    ],
    [
      { x: -8, y: 1 + bodyLift },
      { x: -14, y: (breathing ? -2 : -1) + bodyLift },
      { x: -17, y: 3 + bodyLift },
      { x: -12, y: 4 + bodyLift },
      { x: -8, y: 6 + bodyLift },
    ],
    ...(waker
      ? [[
          { x: -1, y: -6 },
          { x: 2, y: -12 },
          { x: 4, y: -5 },
        ] satisfies CellPolygon]
      : []),
  ];
}

function createFlyingEnemyPolygons(
  frame: EnemyThreatFrame,
): CellPolygon[] {
  if (frame === "death-recoil") {
    return [
      [
        { x: -11, y: -1 },
        { x: -5, y: -9 },
        { x: 3, y: -8 },
        { x: 9, y: -3 },
        { x: 7, y: 4 },
        { x: -2, y: 6 },
        { x: -10, y: 3 },
      ],
      [
        { x: -4, y: -6 },
        { x: -15, y: -18 },
        { x: -10, y: -1 },
        { x: -2, y: 1 },
      ],
      [
        { x: 0, y: -6 },
        { x: 11, y: -13 },
        { x: 7, y: 1 },
        { x: 1, y: 2 },
      ],
      [
        { x: -9, y: 1 },
        { x: -18, y: -4 },
        { x: -14, y: 4 },
        { x: -8, y: 5 },
      ],
    ];
  }
  if (frame === "death-fall") {
    return [
      [
        { x: -13, y: -8 },
        { x: -6, y: -10 },
        { x: 3, y: -4 },
        { x: 11, y: 4 },
        { x: 7, y: 9 },
        { x: -2, y: 5 },
        { x: -10, y: 0 },
      ],
      [
        { x: -4, y: -5 },
        { x: -8, y: 8 },
        { x: -2, y: 15 },
        { x: 1, y: 1 },
      ],
      [
        { x: 1, y: -3 },
        { x: 8, y: 8 },
        { x: 14, y: 12 },
        { x: 7, y: 1 },
      ],
      [
        { x: -10, y: -5 },
        { x: -18, y: -8 },
        { x: -14, y: -1 },
        { x: -8, y: 2 },
      ],
    ];
  }
  if (frame === "death-collapse") {
    return [
      [
        { x: -17, y: 10 },
        { x: -12, y: 5 },
        { x: -6, y: 8 },
        { x: -1, y: 4 },
        { x: 5, y: 8 },
        { x: 13, y: 9 },
        { x: 17, y: 14 },
        { x: 10, y: 16 },
        { x: -14, y: 16 },
      ],
      [
        { x: -8, y: 8 },
        { x: -4, y: 0 },
        { x: 0, y: 9 },
      ],
      [
        { x: 3, y: 8 },
        { x: 9, y: 3 },
        { x: 10, y: 11 },
      ],
    ];
  }
  if (frame === "corpse") {
    return [[
      { x: -18, y: 13 },
      { x: -13, y: 9 },
      { x: -8, y: 12 },
      { x: -3, y: 7 },
      { x: 2, y: 11 },
      { x: 8, y: 8 },
      { x: 15, y: 12 },
      { x: 18, y: 14 },
      { x: 11, y: 16 },
      { x: -15, y: 16 },
    ]];
  }

  const wingTop =
    frame === "walk-0"
      ? -17
      : frame === "walk-1"
        ? -12
        : frame === "walk-2"
          ? -7
          : frame === "walk-3"
            ? -13
            : frame === "alert-1"
              ? -16
              : frame === "hurt"
                ? -7
                : -11;
  const wingBottom =
    frame === "walk-0"
      ? -6
      : frame === "walk-1"
        ? 0
        : frame === "walk-2"
          ? 8
          : frame === "walk-3"
            ? 3
            : frame === "hurt"
              ? 7
              : 4;
  const bodyOffsetY =
    frame === "walk-1"
      ? -1
      : frame === "walk-2" || frame === "attack-recover"
        ? 1
        : 0;
  const tailSwingY =
    frame === "walk-0"
      ? -3
      : frame === "walk-1"
        ? -1
        : frame === "walk-2"
          ? 3
          : frame === "walk-3"
            ? 1
            : 0;
  const frontOpening =
    frame === "alert-0"
      ? 4
      : frame === "alert-1"
        ? 8
        : frame === "attack-strike"
          ? 10
          : frame === "attack-follow-through"
            ? 7
            : frame === "attack-recover"
              ? 3
              : 0;
  const bladeReach =
    frame === "attack-strike"
      ? ENEMY_ATTACK_REACH_CELL
      : frame === "attack-follow-through"
        ? 30
        : frame === "attack-recover"
          ? 20
          : 0;
  const frontHalfOpening = Math.ceil(frontOpening / 2);
  const frontPolygons: CellPolygon[] = frontOpening > 0
    ? [
        [
          { x: 3, y: -5 + bodyOffsetY },
          { x: 9, y: -7 - frontHalfOpening + bodyOffsetY },
          { x: 14, y: -5 - frontOpening + bodyOffsetY },
          { x: 12, y: -2 - frontHalfOpening + bodyOffsetY },
          { x: 5, y: -1 + bodyOffsetY },
        ],
        [
          { x: 4, y: 0 + bodyOffsetY },
          { x: 12, y: 2 + frontHalfOpening + bodyOffsetY },
          { x: 14, y: 4 + frontOpening + bodyOffsetY },
          { x: 8, y: 5 + frontHalfOpening + bodyOffsetY },
          { x: 4, y: 3 + bodyOffsetY },
        ],
      ]
    : [[
        { x: 4, y: -5 + bodyOffsetY },
        { x: 13, y: -4 + bodyOffsetY },
        { x: 16, y: -1 + bodyOffsetY },
        { x: 13, y: 3 + bodyOffsetY },
        { x: 5, y: 3 + bodyOffsetY },
      ]];
  const bladePolygons: CellPolygon[] = bladeReach > 0
    ? [
        [
          { x: 9, y: -5 + bodyOffsetY },
          { x: bladeReach - 5, y: -13 + bodyOffsetY },
          { x: bladeReach, y: -12 + bodyOffsetY },
          { x: bladeReach - 4, y: -9 + bodyOffsetY },
          { x: 10, y: -1 + bodyOffsetY },
        ],
        [
          { x: 10, y: -2 + bodyOffsetY },
          { x: bladeReach - 2, y: -2 + bodyOffsetY },
          { x: bladeReach, y: 0 + bodyOffsetY },
          { x: bladeReach - 3, y: 2 + bodyOffsetY },
          { x: 10, y: 2 + bodyOffsetY },
        ],
        [
          { x: 9, y: 2 + bodyOffsetY },
          { x: bladeReach - 6, y: 9 + bodyOffsetY },
          { x: bladeReach - 1, y: 12 + bodyOffsetY },
          { x: bladeReach - 5, y: 13 + bodyOffsetY },
          { x: 9, y: 5 + bodyOffsetY },
        ],
      ]
    : [];

  return [
    // 좁은 장갑 몸통과 갈라진 꼬리 지느러미.
    [
      { x: -8, y: -3 + bodyOffsetY },
      { x: -3, y: -7 + bodyOffsetY },
      { x: 4, y: -6 + bodyOffsetY },
      { x: 7, y: -2 + bodyOffsetY },
      { x: 6, y: 3 + bodyOffsetY },
      { x: 1, y: 6 + bodyOffsetY },
      { x: -7, y: 3 + bodyOffsetY },
    ],
    [
      { x: -4, y: -4 + bodyOffsetY },
      { x: -15, y: wingTop },
      { x: -10, y: wingBottom },
      { x: -2, y: 2 + bodyOffsetY },
    ],
    [
      { x: 1, y: -5 + bodyOffsetY },
      { x: 8, y: wingTop - 2 },
      { x: 10, y: wingBottom - 1 },
      { x: 3, y: 2 + bodyOffsetY },
    ],
    [
      { x: -7, y: 0 + bodyOffsetY },
      { x: -16, y: 3 + bodyOffsetY + tailSwingY },
      { x: -12, y: 5 + bodyOffsetY + tailSwingY },
      { x: -17, y: 9 + bodyOffsetY + tailSwingY },
      { x: -7, y: 4 + bodyOffsetY },
    ],
    ...frontPolygons,
    ...bladePolygons,
  ];
}

function createWakerPolygons(frame: EnemyThreatFrame): CellPolygon[] {
  if (frame === "death-recoil") {
    return [
      [
        { x: -11, y: -6 },
        { x: -5, y: -14 },
        { x: 2, y: -12 },
        { x: 7, y: -5 },
        { x: 5, y: 5 },
        { x: -2, y: 8 },
        { x: -9, y: 3 },
      ],
      [
        { x: -6, y: -11 },
        { x: -6, y: -20 },
        { x: -2, y: -13 },
        { x: 2, y: -19 },
        { x: 3, y: -10 },
      ],
      [
        { x: -7, y: 1 },
        { x: -17, y: -4 },
        { x: -12, y: 4 },
        { x: -18, y: 9 },
        { x: -6, y: 6 },
      ],
      [
        { x: -2, y: 6 },
        { x: 5, y: 13 },
        { x: 9, y: 10 },
        { x: 2, y: 4 },
      ],
    ];
  }
  if (frame === "death-fall") {
    return [
      [
        { x: -12, y: -8 },
        { x: -5, y: -11 },
        { x: 4, y: -5 },
        { x: 10, y: 3 },
        { x: 6, y: 9 },
        { x: -2, y: 5 },
        { x: -10, y: 0 },
      ],
      [
        { x: -7, y: -8 },
        { x: -12, y: -17 },
        { x: -4, y: -11 },
        { x: 1, y: -16 },
        { x: 1, y: -6 },
      ],
      [
        { x: -8, y: 0 },
        { x: -17, y: 6 },
        { x: -11, y: 8 },
        { x: -16, y: 14 },
        { x: -5, y: 6 },
      ],
    ];
  }
  if (frame === "death-collapse") {
    return [
      [
        { x: -15, y: 10 },
        { x: -9, y: 5 },
        { x: -3, y: 8 },
        { x: 2, y: 4 },
        { x: 7, y: 9 },
        { x: 13, y: 12 },
        { x: 9, y: 16 },
        { x: -13, y: 16 },
      ],
      [
        { x: -5, y: 7 },
        { x: -2, y: -1 },
        { x: 1, y: 8 },
        { x: 5, y: 1 },
        { x: 6, y: 10 },
      ],
    ];
  }
  if (frame === "corpse") {
    return [[
      { x: -16, y: 13 },
      { x: -11, y: 9 },
      { x: -6, y: 12 },
      { x: -1, y: 8 },
      { x: 4, y: 11 },
      { x: 9, y: 9 },
      { x: 14, y: 13 },
      { x: 10, y: 16 },
      { x: -14, y: 16 },
    ]];
  }

  const sway =
    frame === "walk-0"
      ? -4
      : frame === "walk-1"
        ? -1
        : frame === "walk-2"
          ? 3
          : frame === "walk-3"
            ? 1
            : 0;
  const movementShiftX =
    frame === "walk-0" ? -1 : frame === "walk-2" ? 1 : 0;
  const movementShiftY =
    frame === "walk-1" ? -1 : frame === "walk-3" ? 1 : 0;
  const recoil = frame === "hurt" ? -2 : 0;
  const droop = 0;
  const frontOpening =
    frame === "alert-0"
      ? 3
      : frame === "alert-1"
        ? 7
        : frame === "attack-strike"
          ? 9
          : frame === "attack-follow-through"
            ? 6
            : frame === "attack-recover"
              ? 2
              : 0;
  const tentacleReach =
    frame === "attack-strike"
      ? ENEMY_ATTACK_REACH_CELL
      : frame === "attack-follow-through"
        ? 29
        : frame === "attack-recover"
          ? 18
          : 0;
  const frontHalfOpening = Math.ceil(frontOpening / 2);
  const tentacleInner = Math.max(10, Math.floor(tentacleReach * 0.38));
  const tentacleMiddle = Math.max(12, Math.floor(tentacleReach * 0.65));
  const frontPolygons: CellPolygon[] = frontOpening > 0
    ? [
        [
          { x: 2 + recoil + movementShiftX, y: -9 + droop + movementShiftY },
          { x: 8 + movementShiftX, y: -8 - frontHalfOpening + droop + movementShiftY },
          { x: 12 + movementShiftX, y: -5 - frontOpening + droop + movementShiftY },
          { x: 9 + movementShiftX, y: -3 - frontHalfOpening + droop + movementShiftY },
          { x: 3 + recoil + movementShiftX, y: -2 + droop + movementShiftY },
        ],
        [
          { x: 3 + recoil + movementShiftX, y: 0 + droop + movementShiftY },
          { x: 10 + movementShiftX, y: 2 + frontHalfOpening + droop + movementShiftY },
          { x: 12 + movementShiftX, y: 4 + frontOpening + droop + movementShiftY },
          { x: 7 + movementShiftX, y: 7 + frontHalfOpening + droop + movementShiftY },
          { x: 2 + recoil + movementShiftX, y: 5 + droop + movementShiftY },
        ],
      ]
    : [[
        { x: 2 + recoil + movementShiftX, y: -8 + droop + movementShiftY },
        { x: 10 + movementShiftX, y: -5 + droop + movementShiftY },
        { x: 12 + movementShiftX, y: -1 + droop + movementShiftY },
        { x: 8 + movementShiftX, y: 5 + droop + movementShiftY },
        { x: 2 + recoil + movementShiftX, y: 5 + droop + movementShiftY },
      ]];
  const tentaclePolygons: CellPolygon[] = tentacleReach > 0
    ? [
        [
          { x: 8, y: -5 + droop },
          { x: tentacleInner, y: -9 + droop },
          { x: tentacleMiddle, y: -6 + droop },
          { x: tentacleReach, y: -13 + droop },
          { x: tentacleReach - 2, y: -9 + droop },
          { x: tentacleMiddle, y: -2 + droop },
          { x: tentacleInner, y: -5 + droop },
          { x: 8, y: -2 + droop },
        ],
        [
          { x: 9, y: -2 + droop },
          { x: tentacleInner, y: 1 + droop },
          { x: tentacleMiddle, y: -2 + droop },
          { x: tentacleReach, y: 0 + droop },
          { x: tentacleReach - 3, y: 3 + droop },
          { x: tentacleMiddle, y: 2 + droop },
          { x: tentacleInner, y: 4 + droop },
          { x: 9, y: 2 + droop },
        ],
        [
          { x: 8, y: 2 + droop },
          { x: tentacleInner, y: 7 + droop },
          { x: tentacleMiddle, y: 5 + droop },
          { x: tentacleReach - 1, y: 12 + droop },
          { x: tentacleReach - 4, y: 14 + droop },
          { x: tentacleMiddle, y: 9 + droop },
          { x: tentacleInner, y: 11 + droop },
          { x: 8, y: 5 + droop },
        ],
      ]
    : [];

  return [
    // 세로로 선 부유 핵과 왕관 가시가 비행 적의 넓은 날개와 구분된다.
    [
      { x: -7 + recoil + movementShiftX, y: -8 + droop + movementShiftY },
      { x: -2 + recoil + movementShiftX, y: -13 + droop + movementShiftY },
      { x: 3 + recoil + movementShiftX, y: -10 + droop + movementShiftY },
      { x: 5 + recoil + movementShiftX, y: -3 + droop + movementShiftY },
      { x: 4 + recoil + movementShiftX, y: 5 + droop + movementShiftY },
      { x: 2 + recoil + movementShiftX, y: 9 + droop + movementShiftY },
      { x: -5 + recoil + movementShiftX, y: 6 + droop + movementShiftY },
      { x: -9 + recoil + movementShiftX, y: 0 + droop + movementShiftY },
    ],
    [
      { x: -5 + recoil + movementShiftX, y: -9 + droop + movementShiftY },
      { x: -2 + recoil + movementShiftX, y: -18 + droop + movementShiftY },
      { x: 1 + recoil + movementShiftX, y: -11 + droop + movementShiftY },
      { x: 5 + recoil + movementShiftX, y: -17 + droop + movementShiftY },
      { x: 6 + recoil + movementShiftX, y: -8 + droop + movementShiftY },
    ],
    // 서로 다른 박자로 흔들리는 뒤쪽 촉수 세 갈래.
    [
      { x: -6 + movementShiftX, y: 3 + droop + movementShiftY },
      { x: -14 + movementShiftX, y: 5 + sway + droop + movementShiftY },
      { x: -18 + movementShiftX, y: 10 + sway + droop + movementShiftY },
      { x: -13 + movementShiftX, y: 8 + sway + droop + movementShiftY },
      { x: -5 + movementShiftX, y: 7 + droop + movementShiftY },
    ],
    [
      { x: -2 + movementShiftX, y: 6 + droop + movementShiftY },
      { x: -8 + movementShiftX, y: 12 - sway + droop + movementShiftY },
      { x: -5 + movementShiftX, y: 17 - sway + droop + movementShiftY },
      { x: 1 + movementShiftX, y: 8 + droop + movementShiftY },
    ],
    ...frontPolygons,
    ...tentaclePolygons,
  ];
}

export function resolveEnemyThreatFrame(
  enemy: EnemyState,
  elapsedSeconds: number,
): EnemyThreatFrame {
  if (enemy.action === "dead") {
    const deathProgress = enemy.actionTime / ENEMY_CONFIG.deathAnimationSeconds;
    if (deathProgress < 0.3) {
      return "death-recoil";
    }
    if (!enemy.grounded || deathProgress < 0.68) {
      return "death-fall";
    }
    return deathProgress < 1 ? "death-collapse" : "corpse";
  }
  if (enemy.action === "hurt") {
    return "hurt";
  }
  if (enemy.action === "sleep") {
    if (enemy.kind === ENEMY_KINDS.waker) {
      return Math.floor(elapsedSeconds * 2) % 2 === 0
        ? "sleep-0"
        : "sleep-1";
    }
    return "idle";
  }
  if (enemy.action === "alert") {
    return enemy.actionTime / ENEMY_CONFIG.alertSeconds < 0.55
      ? "alert-0"
      : "alert-1";
  }
  if (enemy.action === "attack") {
    const progress = enemy.actionTime / ENEMY_CONFIG.attackSeconds;
    if (progress < 0.45) {
      return "attack-strike";
    }
    return progress < 0.78
      ? "attack-follow-through"
      : "attack-recover";
  }
  if (
    enemy.action === "fly" ||
    enemy.action === "pursue" ||
    enemy.action === "eject"
  ) {
    return WALK_FRAMES[Math.floor(elapsedSeconds * 7) % WALK_FRAMES.length];
  }
  if (enemy.grounded && Math.abs(enemy.velocity.x) > 1) {
    return WALK_FRAMES[
      Math.floor(elapsedSeconds * GROUNDED_ENEMY_WALK_FRAMES_PER_SECOND) %
        WALK_FRAMES.length
    ];
  }
  return "idle";
}

export function createCocoonBossThreatCells(
  frame: EnemyThreatFrame,
): ThreatPixelCell[] {
  const cells = new Map<string, ThreatPixelCell>();
  const add = (x: number, y: number) => {
    cells.set(cellKey(x, y), { x, y });
  };
  const remove = (x: number, y: number) => {
    cells.delete(cellKey(x, y));
  };

  if (frame === "corpse" || frame === "death-collapse") {
    const halfWidth = frame === "corpse" ? 26 : 20;
    const height = frame === "corpse" ? 9 : 15;
    for (let y = 0; y < height; y += 1) {
      const rowHalfWidth = Math.max(4, halfWidth - Math.floor(y * 0.9));
      for (let x = -rowHalfWidth; x <= rowHalfWidth; x += 1) add(x, y);
    }
    return [...cells.values()];
  }

  const recoilX = frame === "hurt" || frame === "death-recoil" ? 3 : 0;
  const droopY = frame === "death-fall" ? 5 : 0;

  for (let y = -55; y <= -39; y += 1) {
    const halfWidth = y < -49 ? 2 : y < -44 ? 4 : 6;
    for (let x = -halfWidth; x <= halfWidth; x += 1) {
      add(x + recoilX, y + droopY);
    }
  }
  for (const root of [
    { x: -13, y: -51 }, { x: -11, y: -49 }, { x: -8, y: -46 },
    { x: 8, y: -47 }, { x: 11, y: -51 }, { x: 15, y: -53 },
    { x: -17, y: -48 }, { x: 18, y: -46 },
  ]) add(root.x + recoilX, root.y + droopY);

  const topY = -40;
  const bottomY = 40;
  for (let y = topY; y <= bottomY; y += 1) {
    const progress = (y - topY) / (bottomY - topY);
    const organicBulge = Math.pow(Math.sin(progress * Math.PI), 0.72) * 22;
    const leftWidth = Math.max(
      6,
      Math.round(
        8 + organicBulge + Math.sin(progress * Math.PI * 5.2) * 2.5,
      ),
    );
    const rightWidth = Math.max(
      6,
      Math.round(
        7 + organicBulge + Math.cos(progress * Math.PI * 6.4) * 2,
      ),
    );
    for (let x = -leftWidth; x <= rightWidth; x += 1) {
      add(x + recoilX, y + droopY);
    }
    if ((y + 27) % 17 === 0) {
      for (let offset = 1; offset <= 5; offset += 1) {
        add(
          -leftWidth - offset + recoilX,
          y - Math.floor(offset / 2) + droopY,
        );
      }
    }
    if ((y + 18) % 19 === 0) {
      for (let offset = 1; offset <= 6; offset += 1) {
        add(
          rightWidth + offset + recoilX,
          y + Math.floor(offset / 2) + droopY,
        );
      }
    }
  }

  // 굳은 외피 사이로 보이는 비대칭 수축 홈과 찢긴 흔적.
  for (let offset = 0; offset < 9; offset += 1) {
    remove(-13 + Math.floor(offset / 3) + recoilX, -24 + offset + droopY);
    remove(14 - Math.floor(offset / 4) + recoilX, 5 + offset + droopY);
  }
  for (let offset = 0; offset < 6; offset += 1) {
    remove(-18 + offset + recoilX, 18 + Math.floor(offset / 2) + droopY);
  }

  for (const tip of [
    { x: -17, length: 7, bend: -1 },
    { x: -9, length: 13, bend: 1 },
    { x: -2, length: 17, bend: -1 },
    { x: 6, length: 12, bend: 1 },
    { x: 14, length: 8, bend: 1 },
  ]) {
    for (let offset = 1; offset <= tip.length; offset += 1) {
      const bend = Math.floor((offset / tip.length) * 4) * tip.bend;
      const thickness = offset < tip.length * 0.55 ? 1 : 0;
      for (let x = -thickness; x <= thickness; x += 1) {
        add(tip.x + bend + x + recoilX, bottomY + offset + droopY);
      }
    }
  }

  return [...cells.values()];
}

function cocoonCrackCenterX(y: number): number {
  const steppedOffset =
    y < -22 ? -2 : y < -5 ? 3 : y < 14 ? -4 : y < 29 ? 2 : -1;
  return Math.round(
    steppedOffset +
      Math.sin((y + 41) * 0.41) * 2.2 +
      Math.sin((y + 7) * 0.17) * 1.5,
  );
}

export function createCrackedCocoonBossThreatCells(
  progress: number,
): ThreatPixelCell[] {
  const clamped = Math.max(0, Math.min(1, progress));
  const separation = Math.round(clamped * 13);
  const pivot = { x: cocoonCrackCenterX(-39), y: -39 };
  const crackedCells = createCocoonBossThreatCells("idle")
    .filter((cell) => {
      if (clamped <= 0) return true;
      const crackCenter = cocoonCrackCenterX(cell.y);
      const crackWidth = Math.ceil(clamped * 2.5);
      const onMainCrack = Math.abs(cell.x - crackCenter) <= crackWidth;
      const firstBranchX = crackCenter - Math.round((cell.y + 14) * 0.58);
      const onFirstBranch =
        clamped > 0.28 &&
        cell.y >= -14 &&
        cell.y <= 1 &&
        Math.abs(cell.x - firstBranchX) <= 1;
      const secondBranchX = crackCenter + Math.round((cell.y - 9) * 0.48);
      const onSecondBranch =
        clamped > 0.5 &&
        cell.y >= 9 &&
        cell.y <= 27 &&
        Math.abs(cell.x - secondBranchX) <= 1;
      return !onMainCrack && !onFirstBranch && !onSecondBranch;
    })
    .map((cell) => {
      const side = cell.x < cocoonCrackCenterX(cell.y) ? -1 : 1;
      const angle = -side * clamped * 0.13;
      const relativeX = cell.x - pivot.x;
      const relativeY = cell.y - pivot.y;
      return {
        x: Math.round(
          pivot.x +
            relativeX * Math.cos(angle) -
            relativeY * Math.sin(angle) +
            side * separation,
        ),
        y: Math.round(
          pivot.y +
            relativeX * Math.sin(angle) +
            relativeY * Math.cos(angle) +
            clamped * (side < 0 ? 1 : 3),
        ),
      };
    });
  return [
    ...new Map(crackedCells.map((cell) => [cellKey(cell.x, cell.y), cell]))
      .values(),
  ];
}

function createRavenInsectBossThreatCells(
  frame: EnemyThreatFrame,
): ThreatPixelCell[] {
  const cells = new Map<string, ThreatPixelCell>();
  const wingBeat = frame === "walk-1" || frame === "walk-3" ? 5 : 0;
  const recoil = frame === "hurt" || frame === "death-recoil" ? -3 : 0;
  const fall = frame === "death-fall" ? 7 : 0;

  if (frame === "corpse" || frame === "death-collapse") {
    addPolygons(cells, [[
      { x: -28, y: 12 }, { x: -17, y: 4 }, { x: 7, y: 7 },
      { x: 24, y: 16 }, { x: 16, y: 21 }, { x: -22, y: 20 },
    ]]);
    return [...cells.values()];
  }

  // Crow-like hooked head, beak, breast and ragged tail.
  addPolygons(cells, [
    [
      { x: 5 + recoil, y: -17 + fall }, { x: 15 + recoil, y: -22 + fall },
      { x: 22 + recoil, y: -17 + fall }, { x: 21 + recoil, y: -7 + fall },
      { x: 13 + recoil, y: -3 + fall }, { x: 5 + recoil, y: -8 + fall },
    ],
    [
      { x: 20 + recoil, y: -17 + fall }, { x: 32 + recoil, y: -12 + fall },
      { x: 23 + recoil, y: -8 + fall }, { x: 17 + recoil, y: -10 + fall },
    ],
    [
      { x: -10 + recoil, y: -10 + fall }, { x: 9 + recoil, y: -13 + fall },
      { x: 18 + recoil, y: -1 + fall }, { x: 12 + recoil, y: 15 + fall },
      { x: -8 + recoil, y: 17 + fall }, { x: -18 + recoil, y: 4 + fall },
    ],
    [
      { x: -15 + recoil, y: -5 + fall }, { x: -24 + recoil, y: 1 + fall },
      { x: -31 + recoil, y: 13 + fall }, { x: -19 + recoil, y: 9 + fall },
      { x: -33 + recoil, y: 23 + fall }, { x: -12 + recoil, y: 14 + fall },
    ],
  ]);

  // Broad feathered wing above and a separate insect wing below.
  addPolygons(cells, [
    [
      { x: 2 + recoil, y: -8 + fall }, { x: -8 + recoil, y: -28 - wingBeat + fall },
      { x: -17 + recoil, y: -34 - wingBeat + fall }, { x: -14 + recoil, y: -17 + fall },
      { x: -27 + recoil, y: -29 - wingBeat + fall }, { x: -24 + recoil, y: -10 + fall },
      { x: -37 + recoil, y: -19 - wingBeat + fall }, { x: -26 + recoil, y: 1 + fall },
      { x: -5 + recoil, y: 7 + fall },
    ],
    [
      { x: 3 + recoil, y: 6 + fall }, { x: 22 + recoil, y: 13 + wingBeat + fall },
      { x: 29 + recoil, y: 25 + wingBeat + fall }, { x: 11 + recoil, y: 18 + fall },
      { x: 18 + recoil, y: 31 + wingBeat + fall }, { x: -2 + recoil, y: 18 + fall },
    ],
  ]);

  // Six jointed insect legs and a pair of feelers keep the silhouette readable.
  for (const leg of [
    [{ x: -7, y: 12 }, { x: -19, y: 24 }, { x: -27, y: 30 }],
    [{ x: 0, y: 14 }, { x: -7, y: 30 }, { x: -4, y: 37 }],
    [{ x: 7, y: 12 }, { x: 13, y: 27 }, { x: 23, y: 32 }],
    [{ x: -3, y: -8 }, { x: -16, y: -15 }, { x: -22, y: -11 }],
    [{ x: 8, y: 6 }, { x: 24, y: 7 }, { x: 30, y: 13 }],
    [{ x: 12, y: 0 }, { x: 27, y: -1 }, { x: 33, y: 4 }],
  ]) {
    addPolyline(cells, leg.map((point) => ({
      x: point.x + recoil,
      y: point.y + fall,
    })));
  }
  addPolyline(cells, [
    { x: 14 + recoil, y: -19 + fall },
    { x: 12 + recoil, y: -29 + fall },
    { x: 17 + recoil, y: -35 + fall },
  ]);

  return [...cells.values()];
}

export function createEnemyThreatCells(
  frame: EnemyThreatFrame,
  facing: Facing,
  kind: string = ENEMY_KINDS.stalker,
): ThreatPixelCell[] {
  const cells = new Map<string, ThreatPixelCell>();
  if (kind === ENEMY_KINDS.cocoonBoss) {
    for (const cell of createCocoonBossThreatCells(frame)) {
      cells.set(cellKey(cell.x, cell.y), cell);
    }
  } else if (kind === ENEMY_KINDS.ravenBoss) {
    for (const cell of createRavenInsectBossThreatCells(frame)) {
      cells.set(cellKey(cell.x, cell.y), cell);
    }
  } else if (kind === ENEMY_KINDS.sleeper && frame === "idle") {
    addPolygons(cells, createSleepingEnemyPolygons(false));
  } else if (kind === ENEMY_KINDS.flyer) {
    addPolygons(cells, createFlyingEnemyPolygons(frame));
  } else if (
    kind === ENEMY_KINDS.waker &&
    (frame === "sleep-0" || frame === "sleep-1")
  ) {
    addPolygons(cells, createSleepingEnemyPolygons(true, frame === "sleep-1"));
  } else if (kind === ENEMY_KINDS.waker) {
    addPolygons(cells, createWakerPolygons(frame));
  } else {
    addPolygons(cells, createEnemyPolygons(frame));
  }
  fillEnclosedCells(cells);

  return [...cells.values()].map((cell) => ({
    x: facing > 0 ? cell.x : -cell.x - 1,
    y: cell.y,
  }));
}

export function createHazardThreatCells(
  width: number,
  height: number,
): ThreatPixelCell[] {
  const widthCells = Math.max(7, Math.floor(width / THREAT_PIXEL_SIZE));
  const heightCells = Math.max(7, Math.floor(height / THREAT_PIXEL_SIZE));
  const lastX = widthCells - 1;
  const lastY = heightCells - 1;
  const middleX = Math.floor(lastX / 2);
  const rightSide: CellPoint[] = [];
  const leftSide: CellPoint[] = [];
  const sideSteps = 12;

  for (let index = 1; index < sideSteps; index += 1) {
    const y = Math.round((lastY * index) / sideSteps);
    const isSpike = index % 2 === 0;
    const inset = Math.max(2, Math.round(widthCells * 0.18));
    rightSide.push({ x: isSpike ? lastX : lastX - inset, y });
    leftSide.unshift({ x: isSpike ? 0 : inset, y });
  }

  const monolith: CellPolygon = [
    { x: middleX, y: 0 },
    { x: lastX - 5, y: 5 },
    { x: lastX - 2, y: 2 },
    { x: lastX - 4, y: Math.round(lastY * 0.12) },
    ...rightSide,
    { x: lastX - 4, y: Math.round(lastY * 0.88) },
    { x: lastX - 2, y: lastY - 2 },
    { x: lastX - 5, y: lastY - 5 },
    { x: middleX, y: lastY },
    { x: 5, y: lastY - 5 },
    { x: 2, y: lastY - 2 },
    { x: 4, y: Math.round(lastY * 0.88) },
    ...leftSide,
    { x: 4, y: Math.round(lastY * 0.12) },
    { x: 2, y: 2 },
    { x: 5, y: 5 },
  ];
  const cells = new Map<string, ThreatPixelCell>();
  addFilledPolygon(cells, monolith);
  return [...cells.values()];
}

export function createElectricHazardLightningCells(
  width: number,
  height: number,
  phase: number,
): ThreatPixelCell[] {
  const widthCells = Math.max(7, Math.floor(width / THREAT_PIXEL_SIZE));
  const heightCells = Math.max(1, Math.ceil(height / THREAT_PIXEL_SIZE));
  const lastX = widthCells - 1;
  const centerX = Math.floor(lastX / 2);
  const cells = new Map<string, ThreatPixelCell>();
  const offsets = [0, -2, 1, -1, 2, 0, 1, -2] as const;
  const points: CellPoint[] = [];

  for (let y = 0, segment = 0; y < heightCells; y += 4, segment += 1) {
    points.push({
      x: Math.max(1, Math.min(lastX - 1, centerX + offsets[(segment + phase) % offsets.length])),
      y,
    });
  }
  if (points.at(-1)?.y !== heightCells - 1) {
    points.push({
      x: Math.max(1, Math.min(lastX - 1, centerX + offsets[(points.length + phase) % offsets.length])),
      y: heightCells - 1,
    });
  }
  addPolyline(cells, points);

  for (let index = 2; index < points.length - 1; index += 3) {
    const anchor = points[index];
    const direction = (index + phase) % 2 === 0 ? -1 : 1;
    addPolyline(cells, [
      anchor,
      {
        x: Math.max(0, Math.min(lastX, anchor.x + direction * 3)),
        y: Math.min(heightCells - 1, anchor.y + 3),
      },
    ]);
  }

  return [...cells.values()];
}

function addThreatCell(
  cells: Map<string, ThreatPixelCell>,
  x: number,
  y: number,
  widthCells: number,
  heightCells: number,
): void {
  if (x < 0 || x >= widthCells || y < 0 || y >= heightCells) return;
  cells.set(cellKey(x, y), { x, y });
}

/** 짧은 바닥 장해물 전용 도안. 긴 장해물 도안의 축소본으로 사용하지 않는다. */
export function createShortFloorHazardThreatCells(): ThreatPixelCell[] {
  const widthCells = 40;
  const heightCells = 13;
  const cells = new Map<string, ThreatPixelCell>();

  for (let y = 7; y < heightCells; y += 1) {
    for (let x = 0; x < widthCells; x += 1) {
      addThreatCell(cells, x, y, widthCells, heightCells);
    }
  }

  const spikes = [
    { center: 3, top: 2, left: 0, right: 7 },
    { center: 13, top: 0, left: 8, right: 18 },
    { center: 24, top: 2, left: 19, right: 29 },
    { center: 35, top: 0, left: 30, right: 39 },
  ] as const;
  for (const spike of spikes) {
    for (let y = spike.top; y <= 7; y += 1) {
      const progress = (y - spike.top) / Math.max(1, 7 - spike.top);
      const left = Math.round(
        spike.center + (spike.left - spike.center) * progress,
      );
      const right = Math.round(
        spike.center + (spike.right - spike.center) * progress,
      );
      for (let x = left; x <= right; x += 1) {
        addThreatCell(cells, x, y, widthCells, heightCells);
      }
    }
  }

  for (const notchStart of [1, 11, 21, 31]) {
    const notches = [
      { x: notchStart, y: 9 },
      { x: notchStart + 1, y: 9 },
      { x: notchStart + 1, y: 10 },
      { x: notchStart + 2, y: 10 },
      { x: notchStart + 2, y: 11 },
      { x: notchStart + 3, y: 11 },
    ];
    for (const notch of notches) {
      cells.delete(cellKey(notch.x, notch.y));
    }
  }

  return [...cells.values()];
}

/** 긴 바닥 장해물 전용 도안. 짧은 장해물을 가로로 늘이지 않고 별도로 구성한다. */
export function createLongFloorHazardThreatCells(): ThreatPixelCell[] {
  const widthCells = 293;
  const heightCells = 13;
  const cells = new Map<string, ThreatPixelCell>();

  for (let y = 8; y < heightCells; y += 1) {
    for (let x = 0; x < widthCells; x += 1) {
      addThreatCell(cells, x, y, widthCells, heightCells);
    }
  }

  for (let moduleStart = 0, moduleIndex = 0;
    moduleStart < widthCells;
    moduleStart += 18, moduleIndex += 1) {
    const reversed = moduleIndex % 2 === 1;
    const bladeCenter = moduleStart + (reversed ? 6 : 4);
    const bladeTop = moduleIndex % 3 === 0 ? 0 : 1;
    for (let y = bladeTop; y <= 8; y += 1) {
      const progress = (y - bladeTop) / Math.max(1, 8 - bladeTop);
      const halfWidth = Math.round(progress * 5);
      for (let x = bladeCenter - halfWidth; x <= bladeCenter + halfWidth; x += 1) {
        addThreatCell(cells, x, y, widthCells, heightCells);
      }
    }

    const hookCenter = moduleStart + (reversed ? 13 : 14);
    for (let y = 3; y <= 8; y += 1) {
      const progress = (y - 3) / 5;
      const leftReach = Math.round(progress * (reversed ? 5 : 3));
      const rightReach = Math.round(progress * (reversed ? 3 : 5));
      for (let x = hookCenter - leftReach; x <= hookCenter + rightReach; x += 1) {
        addThreatCell(cells, x, y, widthCells, heightCells);
      }
    }

    const hookDirection = reversed ? -1 : 1;
    for (let offset = 1; offset <= 4; offset += 1) {
      addThreatCell(
        cells,
        hookCenter + hookDirection * offset,
        Math.max(1, 4 - Math.ceil(offset / 2)),
        widthCells,
        heightCells,
      );
    }

    const mouthStart = moduleStart + 8;
    for (const notch of [
      { x: mouthStart, y: 9 },
      { x: mouthStart + 1, y: 9 },
      { x: mouthStart + 2, y: 9 },
      { x: mouthStart + 1, y: 10 },
      { x: mouthStart + 2, y: 10 },
    ]) {
      cells.delete(cellKey(notch.x, notch.y));
    }
  }

  return [...cells.values()];
}

const SHORT_FLOOR_HAZARD_THREAT_CELLS =
  createShortFloorHazardThreatCells();
const LONG_FLOOR_HAZARD_THREAT_CELLS =
  createLongFloorHazardThreatCells();

export function createFloorHazardThreatCells(
  hazardId: string,
): ThreatPixelCell[] {
  if (hazardId === SHORT_FLOOR_HAZARD_ID) {
    return SHORT_FLOOR_HAZARD_THREAT_CELLS;
  }
  if (hazardId === LONG_FLOOR_HAZARD_ID) {
    return LONG_FLOOR_HAZARD_THREAT_CELLS;
  }
  if (hazardId === STAGE_TWO_FLOOR_HAZARD_ID) {
    return LONG_FLOOR_HAZARD_THREAT_CELLS;
  }
  return [];
}

export function resolveFloorHazardStrikeExtension(
  hazard: Pick<HazardState, "reactionTime" | "reactionDuration">,
): number | null {
  if (hazard.reactionTime <= 0 || hazard.reactionDuration <= 0) return null;
  const progress = Math.max(
    0,
    Math.min(1, 1 - hazard.reactionTime / hazard.reactionDuration),
  );
  if (progress < 0.32) {
    const rise = progress / 0.32;
    return 1 - (1 - rise) * (1 - rise);
  }
  if (progress < 0.62) return 1;
  return Math.max(0, 1 - (progress - 0.62) / 0.38);
}

export function createFloorHazardStrikeCells(
  width: number,
  extension: number,
  contactOffsetX: number,
): ThreatPixelCell[] {
  const widthCells = Math.max(1, Math.ceil(width / THREAT_PIXEL_SIZE));
  const centerX = Math.max(
    4,
    Math.min(widthCells - 5, Math.round(contactOffsetX / THREAT_PIXEL_SIZE)),
  );
  const cells = new Map<string, ThreatPixelCell>();
  const addCell = (x: number, y: number) => {
    if (x < 0 || x >= widthCells) return;
    cells.set(cellKey(x, y), { x, y });
  };

  for (let x = centerX - 7; x <= centerX + 7; x += 1) {
    if (Math.abs(x - centerX) % 3 !== 1) addCell(x, 0);
  }

  const mainHeight = Math.max(1, Math.round(2 + extension * 20));
  for (let level = 0; level < mainHeight; level += 1) {
    const ratio = level / Math.max(1, mainHeight - 1);
    const halfWidth = Math.max(0, Math.floor((1 - ratio) * 3));
    for (let x = centerX - halfWidth; x <= centerX + halfWidth; x += 1) {
      addCell(x, -level - 1);
    }
  }

  const sideHeight = Math.max(1, Math.round(mainHeight * 0.58));
  for (const side of [-1, 1] as const) {
    const sideCenter = centerX + side * 6;
    for (let level = 0; level < sideHeight; level += 1) {
      const inwardLean = Math.floor(level / 5) * -side;
      addCell(sideCenter + inwardLean, -level);
      if (level < sideHeight * 0.55) {
        addCell(sideCenter + inwardLean - side, -level);
      }
    }
  }
  return [...cells.values()];
}

export function resolveHazardReactionFrame(
  hazard: HazardState,
): HazardReactionFrame | null {
  if (hazard.reactionTime <= 0 || hazard.reactionDuration <= 0) {
    return null;
  }

  const progress = 1 - hazard.reactionTime / hazard.reactionDuration;
  if (progress < 0.36) {
    return "impact";
  }
  return progress < 0.72 ? "scatter" : "fade";
}

export function createHazardDamageLightningCells(
  width: number,
  height: number,
  frame: HazardReactionFrame,
  side: Facing,
  contactOffsetY: number,
): ThreatPixelCell[] {
  const widthCells = Math.max(7, Math.floor(width / THREAT_PIXEL_SIZE));
  const heightCells = Math.max(7, Math.floor(height / THREAT_PIXEL_SIZE));
  const lastX = widthCells - 1;
  const cells = new Map<string, ThreatPixelCell>();
  const anchorY = Math.max(
    2,
    Math.min(
      heightCells - 3,
      Math.round(contactOffsetY / THREAT_PIXEL_SIZE),
    ),
  );
  const startX = side < 0 ? 2 : lastX - 2;
  const reach = frame === "impact" ? 10 : frame === "scatter" ? 7 : 4;
  const firstX = startX + side * Math.ceil(reach * 0.4);
  const secondX = startX + side * Math.ceil(reach * 0.7);
  const endX = startX + side * reach;
  const verticalSign = side < 0 ? -1 : 1;

  addPolyline(cells, [
    { x: startX, y: anchorY },
    { x: firstX, y: anchorY + verticalSign * 2 },
    { x: secondX, y: anchorY - verticalSign * 2 },
    { x: endX, y: anchorY + verticalSign },
  ]);

  if (frame === "impact") {
    addPolyline(cells, [
      { x: secondX, y: anchorY - verticalSign * 2 },
      { x: endX, y: anchorY - 6 },
    ]);
    addPolyline(cells, [
      { x: secondX, y: anchorY - verticalSign * 2 },
      { x: endX + side * 2, y: anchorY + 6 },
    ]);
    addPolyline(cells, [
      { x: endX, y: anchorY + verticalSign },
      { x: endX + side * 3, y: anchorY },
    ]);
  } else if (frame === "scatter") {
    addPolyline(cells, [
      { x: secondX, y: anchorY - verticalSign * 2 },
      { x: endX + side * 2, y: anchorY - 5 },
    ]);
  }

  return [...cells.values()];
}
