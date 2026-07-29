import type { WorldDefinition } from "./world";

export const TEST_ROOM: WorldDefinition = {
  width: 1600,
  height: 720,
  playerSpawn: { x: 96, y: 590 },
  terrain: [
    { id: "left-wall", bounds: { x: -32, y: 0, width: 32, height: 720 } },
    { id: "floor-west", bounds: { x: 0, y: 650, width: 560, height: 70 } },
    { id: "pit-step", bounds: { x: 540, y: 520, width: 110, height: 24 } },
    { id: "pit-floor", bounds: { x: 560, y: 700, width: 90, height: 20 } },
    { id: "floor-east", bounds: { x: 650, y: 650, width: 950, height: 70 } },
    { id: "jump-low", bounds: { x: 250, y: 550, width: 170, height: 24 } },
    { id: "jump-mid", bounds: { x: 445, y: 470, width: 130, height: 24 } },
    { id: "echo-wall", bounds: { x: 800, y: 570, width: 28, height: 80 } },
    { id: "enemy-platform", bounds: { x: 920, y: 505, width: 210, height: 24 } },
    { id: "echo-ceiling", bounds: { x: 1110, y: 350, width: 280, height: 24 } },
    { id: "right-wall", bounds: { x: 1600, y: 0, width: 32, height: 720 } },
  ],
  enemies: [
    {
      id: "sentinel-a",
      position: { x: 950, y: 610 },
      patrolMinX: 860,
      patrolMaxX: 1060,
    },
    {
      id: "sentinel-b",
      position: { x: 1350, y: 610 },
      patrolMinX: 1240,
      patrolMaxX: 1510,
    },
  ],
};
