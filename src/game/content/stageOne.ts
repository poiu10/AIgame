import type { StageDefinition } from "./world";

export const STAGE_ONE: StageDefinition = {
  schemaVersion: 1,
  id: "stage-1",
  name: "1스테이지",
  width: 4800,
  height: 1440,
  playerSpawn: { x: 180, y: 1258 },
  spawns: [
    { id: "from-tutorial", position: { x: 180, y: 1258 }, facing: 1 },
    { id: "east-return", position: { x: 4520, y: 1258 }, facing: -1 },
  ],
  exits: [
    {
      id: "to-tutorial",
      bounds: { x: 0, y: 1080, width: 48, height: 220 },
      targetStageId: "tutorial",
      targetSpawnId: "from-stage-1",
    },
  ],
  terrain: [
    { id: "entry-ceiling", kind: "solid", bounds: { x: 0, y: 1020, width: 700, height: 60 } },
    { id: "stage-floor", kind: "solid", bounds: { x: 0, y: 1300, width: 4800, height: 140 } },
    { id: "left-upper-wall", kind: "solid", bounds: { x: -64, y: 0, width: 64, height: 1020 } },
    { id: "right-wall", kind: "solid", bounds: { x: 4800, y: 0, width: 64, height: 1440 } },
  ],
  enemies: [],
  hazards: [],
  soundEmitters: [],
};
