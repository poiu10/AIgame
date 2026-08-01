import type { StageDefinition } from "./world";

// 2스테이지 본편 맵이 들어오기 전에도 1스테이지 출구가 안전하게 전환되도록
// 최소 진입실만 제공한다.
export const STAGE_TWO: StageDefinition = {
  schemaVersion: 1,
  id: "stage-2",
  name: "2스테이지 진입실",
  width: 960,
  height: 550,
  playerSpawn: { x: 120, y: 420 },
  spawns: [
    { id: "from-stage-1", position: { x: 120, y: 420 }, facing: 1 },
  ],
  exits: [
    {
      id: "return-to-stage-1",
      bounds: { x: 0, y: 340, width: 40, height: 140 },
      targetStageId: "stage-1",
      targetSpawnId: "spawn-13",
    },
  ],
  terrain: [
    { id: "ceiling", kind: "solid", bounds: { x: 0, y: 0, width: 960, height: 80 } },
    { id: "floor", kind: "solid", bounds: { x: 0, y: 480, width: 960, height: 70 } },
    { id: "left-wall", kind: "solid", bounds: { x: -64, y: 0, width: 64, height: 550 } },
    { id: "right-wall", kind: "solid", bounds: { x: 960, y: 0, width: 64, height: 550 } },
  ],
  enemies: [],
  hazards: [],
  soundEmitters: [],
};
