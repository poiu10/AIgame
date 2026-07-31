import type { EnemyAction, Facing } from "../../game/simulation/state";
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

type CellSegment = readonly [CellPoint, CellPoint];

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function addSegment(
  cells: Map<string, ThreatPixelCell>,
  [start, end]: CellSegment,
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

function addSegments(
  cells: Map<string, ThreatPixelCell>,
  segments: readonly CellSegment[],
): void {
  for (const segment of segments) {
    addSegment(cells, segment);
  }
}

const ENEMY_BODY_SEGMENTS: readonly CellSegment[] = [
  // 갈라진 뿔과 아래로 눌린 머리
  [{ x: -4, y: -10 }, { x: -8, y: -15 }],
  [{ x: -8, y: -15 }, { x: -9, y: -9 }],
  [{ x: 4, y: -10 }, { x: 8, y: -15 }],
  [{ x: 8, y: -15 }, { x: 9, y: -9 }],
  [{ x: -9, y: -9 }, { x: -6, y: -3 }],
  [{ x: 9, y: -9 }, { x: 6, y: -3 }],
  [{ x: -6, y: -3 }, { x: 0, y: 1 }],
  [{ x: 0, y: 1 }, { x: 6, y: -3 }],
  // 비대칭 눈썹과 빈 얼굴의 균열
  [{ x: -6, y: -7 }, { x: -2, y: -8 }],
  [{ x: 2, y: -8 }, { x: 6, y: -7 }],
  [{ x: 0, y: -6 }, { x: 0, y: -2 }],
  // 굽은 어깨, 갈비뼈, 가시 돋친 몸통
  [{ x: -6, y: -2 }, { x: -10, y: 2 }],
  [{ x: 6, y: -2 }, { x: 10, y: 2 }],
  [{ x: -7, y: 0 }, { x: -6, y: 10 }],
  [{ x: 7, y: 0 }, { x: 6, y: 10 }],
  [{ x: -6, y: 4 }, { x: -1, y: 5 }],
  [{ x: 1, y: 5 }, { x: 6, y: 4 }],
  [{ x: -6, y: 7 }, { x: -1, y: 8 }],
  [{ x: 1, y: 8 }, { x: 6, y: 7 }],
  [{ x: -6, y: 10 }, { x: -3, y: 12 }],
  [{ x: 6, y: 10 }, { x: 3, y: 12 }],
  // 뒤로 꺾인 다리와 발톱
  [{ x: -3, y: 12 }, { x: -5, y: 15 }],
  [{ x: -5, y: 15 }, { x: -9, y: 15 }],
  [{ x: 3, y: 12 }, { x: 5, y: 15 }],
  [{ x: 5, y: 15 }, { x: 9, y: 15 }],
];

const ENEMY_IDLE_ARM_SEGMENTS: readonly CellSegment[] = [
  [{ x: -9, y: 2 }, { x: -10, y: 8 }],
  [{ x: -10, y: 8 }, { x: -7, y: 6 }],
  [{ x: 9, y: 2 }, { x: 10, y: 8 }],
  [{ x: 10, y: 8 }, { x: 7, y: 6 }],
];

const ENEMY_ATTACK_ARM_SEGMENTS: readonly CellSegment[] = [
  [{ x: 7, y: 0 }, { x: 13, y: -1 }],
  [{ x: 13, y: -1 }, { x: 16, y: 2 }],
  [{ x: 16, y: 2 }, { x: 12, y: 1 }],
  [{ x: 16, y: 2 }, { x: 13, y: 4 }],
  [{ x: -9, y: 2 }, { x: -10, y: 8 }],
  [{ x: -10, y: 8 }, { x: -7, y: 6 }],
];

const ENEMY_REMAINS_SEGMENTS: readonly CellSegment[] = [
  [{ x: -11, y: 13 }, { x: -7, y: 10 }],
  [{ x: -7, y: 10 }, { x: -2, y: 13 }],
  [{ x: -2, y: 13 }, { x: 4, y: 11 }],
  [{ x: 4, y: 11 }, { x: 10, y: 14 }],
  [{ x: -8, y: 10 }, { x: -10, y: 6 }],
  [{ x: -10, y: 6 }, { x: -5, y: 9 }],
  [{ x: -2, y: 12 }, { x: 0, y: 8 }],
  [{ x: 0, y: 8 }, { x: 3, y: 11 }],
  [{ x: 5, y: 12 }, { x: 9, y: 9 }],
];

export function createEnemyThreatCells(
  action: EnemyAction,
  facing: Facing,
): ThreatPixelCell[] {
  const cells = new Map<string, ThreatPixelCell>();

  if (action === "dead") {
    addSegments(cells, ENEMY_REMAINS_SEGMENTS);
  } else {
    addSegments(cells, ENEMY_BODY_SEGMENTS);
    addSegments(
      cells,
      action === "attack" || action === "alert"
        ? ENEMY_ATTACK_ARM_SEGMENTS
        : ENEMY_IDLE_ARM_SEGMENTS,
    );
  }

  return [...cells.values()].map((cell) => ({
    x: cell.x * facing,
    y: cell.y,
  }));
}

export function createHazardThreatCells(
  width: number,
  height: number,
): ThreatPixelCell[] {
  const widthCells = Math.max(7, Math.floor(width / THREAT_PIXEL_SIZE));
  const heightCells = Math.max(15, Math.floor(height / THREAT_PIXEL_SIZE));
  const lastX = widthCells - 1;
  const lastY = heightCells - 1;
  const middleX = Math.floor(lastX / 2);
  const cells = new Map<string, ThreatPixelCell>();

  // 찢어진 왕관형 상단과 하단이 사각 외곽선 대신 위험 범위를 암시한다.
  addSegments(cells, [
    [{ x: 2, y: 5 }, { x: middleX, y: 0 }],
    [{ x: middleX, y: 0 }, { x: lastX - 2, y: 5 }],
    [{ x: 2, y: lastY - 5 }, { x: middleX, y: lastY }],
    [{ x: middleX, y: lastY }, { x: lastX - 2, y: lastY - 5 }],
  ]);

  // 두 톱니 기둥은 일정 간격으로 안쪽을 물어뜯는 이빨을 만든다.
  for (let y = 6; y <= lastY - 6; y += 1) {
    const railOffset = Math.floor(y / 5) % 2;
    cells.set(cellKey(1 + railOffset, y), { x: 1 + railOffset, y });
    cells.set(cellKey(lastX - 1 - railOffset, y), {
      x: lastX - 1 - railOffset,
      y,
    });
  }

  for (let y = 10; y <= lastY - 10; y += 12) {
    addSegments(cells, [
      [{ x: 2, y: y - 3 }, { x: 11, y }],
      [{ x: 11, y }, { x: 2, y: y + 3 }],
      [{ x: lastX - 2, y: y - 3 }, { x: lastX - 11, y }],
      [{ x: lastX - 11, y }, { x: lastX - 2, y: y + 3 }],
    ]);
  }

  // 중앙의 불연속 공명 균열은 살아 움직이는 공격 지형처럼 보이게 한다.
  for (let y = 7; y <= lastY - 7; y += 8) {
    const direction = Math.floor(y / 8) % 2 === 0 ? -1 : 1;
    addSegment(cells, [
      { x: middleX + direction * 2, y },
      { x: middleX - direction * 2, y: Math.min(lastY - 7, y + 5) },
    ]);
  }

  return [...cells.values()];
}
