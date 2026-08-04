import { ENEMY_KINDS } from "../../game/content/world";
import {
  BOSS_DEATH_PIECE_ANCHORS,
  resolveBossDeathPieceAnchor,
} from "../../game/simulation/rules/bossDeath";
import type { BossDeathPieceState } from "../../game/simulation/state";
import { createEnemyThreatCells } from "./threatPixelArt";

export interface BossDeathPieceCell {
  x: number;
  y: number;
}

const pieceShapeCache = new Map<string, readonly BossDeathPieceCell[]>();

export function resolveBossDeathShakeOffset(modeTime: number): {
  x: number;
  y: number;
} {
  const tick = Math.floor(Math.max(0, modeTime) * 42);
  return {
    x: ((tick * 3) % 5 - 2) * 3,
    y: ((tick * 2) % 3 - 1) * 3,
  };
}

export function resolveBossDeathPieceAlpha(
  piece: BossDeathPieceState,
): number {
  const progress = piece.age / Math.max(piece.lifetime, 0.001);
  if (progress <= 0.68) return 1;
  return Math.max(0, 1 - (progress - 0.68) / 0.32);
}

export function createBossDeathPieceCells(
  piece: BossDeathPieceState,
): BossDeathPieceCell[] {
  const cacheKey = `${piece.facing}:${piece.shape}`;
  const anchor = resolveBossDeathPieceAnchor(piece.shape, piece.facing);
  let cells = pieceShapeCache.get(cacheKey);
  if (!cells) {
    const silhouette = createEnemyThreatCells(
      "hurt",
      piece.facing,
      ENEMY_KINDS.ravenBoss,
    );
    cells = silhouette.filter((cell) => {
      let nearestShape = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (
        let shape = 0;
        shape < BOSS_DEATH_PIECE_ANCHORS.length;
        shape += 1
      ) {
        const candidate = resolveBossDeathPieceAnchor(shape, piece.facing);
        const distance =
          (cell.x - candidate.x) ** 2 + (cell.y - candidate.y) ** 2;
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestShape = shape;
        }
      }
      return nearestShape === piece.shape;
    }).map((cell) => ({
      x: cell.x - anchor.x,
      y: cell.y - anchor.y,
    }));
    pieceShapeCache.set(cacheKey, cells);
  }
  const angle = Math.round(piece.spin / (Math.PI / 12)) * (Math.PI / 12);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const rotatedCells = cells.map((cell) => ({
    x: Math.round(cell.x * cosine - cell.y * sine),
    y: Math.round(cell.x * sine + cell.y * cosine),
  }));
  return [
    ...new Map(
      rotatedCells.map((cell) => [`${cell.x},${cell.y}`, cell]),
    ).values(),
  ];
}
