import type { BossDeathPieceState } from "../../game/simulation/state";

export interface BossDeathPieceCell {
  x: number;
  y: number;
}

const PIECE_SHAPES: readonly (readonly BossDeathPieceCell[])[] = [
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 1 }],
  [{ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }],
  [{ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
];

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

export function createBossDeathPieceCells(
  piece: BossDeathPieceState,
): BossDeathPieceCell[] {
  const shape = PIECE_SHAPES[piece.shape % PIECE_SHAPES.length];
  const quarterTurns =
    ((Math.round(piece.spin / (Math.PI / 2)) % 4) + 4) % 4;
  return shape.map((cell) => {
    let x = cell.x;
    let y = cell.y;
    for (let turn = 0; turn < quarterTurns; turn += 1) {
      [x, y] = [-y, x];
    }
    return { x, y };
  });
}
