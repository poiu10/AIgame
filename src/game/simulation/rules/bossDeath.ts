import type { Facing } from "../state";

export interface BossDeathPieceAnchor {
  x: number;
  y: number;
}

export const BOSS_DEATH_PIECE_CELL_SIZE = 3;

// 까마귀+벌레 보스 실루엣을 큰 신체 부위로 나누는 기준점이다.
// 렌더러는 각 픽셀을 가장 가까운 기준점에 배정하고, 시뮬레이션은 같은
// 기준점에서 파편을 출발시켜 폭발 직전까지 원래 몸 형태를 보존한다.
export const BOSS_DEATH_PIECE_ANCHORS: readonly BossDeathPieceAnchor[] = [
  { x: -24, y: -22 },
  { x: -8, y: -18 },
  { x: 15, y: -15 },
  { x: 27, y: -6 },
  { x: -24, y: 8 },
  { x: -5, y: 5 },
  { x: 14, y: 9 },
  { x: -12, y: 24 },
  { x: 16, y: 25 },
];

export function resolveBossDeathPieceAnchor(
  shape: number,
  facing: Facing,
): BossDeathPieceAnchor {
  const anchor =
    BOSS_DEATH_PIECE_ANCHORS[
      ((shape % BOSS_DEATH_PIECE_ANCHORS.length) +
        BOSS_DEATH_PIECE_ANCHORS.length) %
        BOSS_DEATH_PIECE_ANCHORS.length
    ];
  return facing > 0 ? anchor : { x: -anchor.x - 1, y: anchor.y };
}
