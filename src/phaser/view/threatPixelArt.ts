import { ENEMY_CONFIG } from "../../game/simulation/rules/config";
import type { EnemyState, Facing } from "../../game/simulation/state";
import { SOUND_PIXEL_SIZE } from "./pixelLine";

export const THREAT_PIXEL_SIZE = SOUND_PIXEL_SIZE;

export interface ThreatPixelCell {
  x: number;
  y: number;
}

interface CellPoint {
  x: number;
  y: number;
}

type CellPolygon = readonly CellPoint[];

export type EnemyThreatFrame =
  | "idle"
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

const WALK_FRAMES: readonly EnemyThreatFrame[] = [
  "walk-0",
  "walk-1",
  "walk-2",
  "walk-3",
];

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
      { x: 10, y: -7 + bodyOffsetY },
      { x: 18, y: -3 + bodyOffsetY },
      { x: 15, y: 2 + bodyOffsetY },
      { x: 15, y: -1 + bodyOffsetY },
      { x: 8, y: -2 + bodyOffsetY },
      { x: 5, y: 1 + bodyOffsetY },
    ]];
  }

  if (frame === "attack-follow-through") {
    return [[
      { x: 4, y: -5 + bodyOffsetY },
      { x: 9, y: -3 + bodyOffsetY },
      { x: 16, y: 4 + bodyOffsetY },
      { x: 12, y: 8 + bodyOffsetY },
      { x: 13, y: 4 + bodyOffsetY },
      { x: 7, y: 1 + bodyOffsetY },
      { x: 4, y: 3 + bodyOffsetY },
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
  if (enemy.grounded && Math.abs(enemy.velocity.x) > 1) {
    return WALK_FRAMES[Math.floor(elapsedSeconds * 9) % WALK_FRAMES.length];
  }
  return "idle";
}

export function createEnemyThreatCells(
  frame: EnemyThreatFrame,
  facing: Facing,
): ThreatPixelCell[] {
  const cells = new Map<string, ThreatPixelCell>();
  addPolygons(cells, createEnemyPolygons(frame));

  return [...cells.values()].map((cell) => ({
    x: cell.x * facing,
    y: cell.y,
  }));
}

export function createHazardThreatCells(
  width: number,
  height: number,
): ThreatPixelCell[] {
  const widthCells = Math.max(9, Math.floor(width / THREAT_PIXEL_SIZE));
  const heightCells = Math.max(17, Math.floor(height / THREAT_PIXEL_SIZE));
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
