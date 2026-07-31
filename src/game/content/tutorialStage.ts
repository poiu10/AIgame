import type { WorldDefinition } from "./world";

export const TUTORIAL_STAGE: WorldDefinition = {
  width: 5040,
  height: 1440,
  playerSpawn: { x: 192, y: 1180 },
  terrain: [
    { id: "left-wall", bounds: { x: -64, y: 0, width: 64, height: 1440 } },
    { id: "movement-floor", bounds: { x: 0, y: 1300, width: 1360, height: 140 } },
    { id: "jump-step", bounds: { x: 1000, y: 1180, width: 300, height: 120 } },
    { id: "jump-platform", bounds: { x: 1420, y: 1100, width: 300, height: 48 } },
    { id: "jump-pit-floor", bounds: { x: 1360, y: 1400, width: 480, height: 40 } },
    { id: "jump-recovery-high", bounds: { x: 1720, y: 1200, width: 120, height: 200 } },
    { id: "jump-right-hill", bounds: { x: 1840, y: 1100, width: 520, height: 340 } },
    { id: "middle-floor", bounds: { x: 2360, y: 1300, width: 1720, height: 140 } },
    { id: "trial-pit-floor", bounds: { x: 4080, y: 1400, width: 240, height: 40 } },
    { id: "final-floor", bounds: { x: 4320, y: 1300, width: 720, height: 140 } },
    { id: "right-wall", bounds: { x: 5040, y: 0, width: 64, height: 1440 } },
  ],
  enemies: [
    {
      id: "lesson-sentinel",
      position: { x: 3680, y: 1220 },
      patrolMinX: 3480,
      patrolMaxX: 3940,
      health: 2,
    },
    {
      id: "trial-sentinel",
      position: { x: 4620, y: 1220 },
      patrolMinX: 4400,
      patrolMaxX: 4880,
    },
  ],
  hazards: [
    {
      id: "resonance-crusher",
      bounds: { x: 2900, y: 980, width: 120, height: 320 },
    },
  ],
  soundEmitters: [
    {
      id: "movement-water-drop",
      kind: "ambient",
      position: { x: 840, y: 1240 },
      intervalSeconds: 2.4,
      initialDelaySeconds: 0.35,
      maximumDistance: 430,
      intensity: 0.52,
    },
    {
      id: "jump-chain",
      kind: "ambient",
      position: { x: 1580, y: 1020 },
      intervalSeconds: 2.8,
      initialDelaySeconds: 1.2,
      maximumDistance: 500,
      intensity: 0.58,
    },
    {
      id: "resonance-crusher-pulse",
      kind: "hazard",
      position: { x: 2960, y: 1140 },
      intervalSeconds: 0.82,
      initialDelaySeconds: 0.1,
      maximumDistance: 390,
      intensity: 1,
      revealsHazardId: "resonance-crusher",
    },
  ],
  tutorialSections: [
    {
      id: "move",
      startX: 0,
      prompt: "A / D",
    },
    {
      id: "jump",
      startX: 860,
      prompt: "Space",
    },
    {
      id: "roll",
      startX: 2420,
      prompt: "Shift",
    },
    {
      id: "attack",
      startX: 3240,
      prompt: "J",
    },
    {
      id: "trial",
      startX: 4080,
      prompt: "",
      requiresEnemyDefeated: "lesson-sentinel",
    },
  ],
};
