import type { WorldDefinition } from "./world";

export const TUTORIAL_STAGE: WorldDefinition = {
  width: 2520,
  height: 720,
  playerSpawn: { x: 96, y: 590 },
  terrain: [
    { id: "left-wall", bounds: { x: -32, y: 0, width: 32, height: 720 } },
    { id: "movement-floor", bounds: { x: 0, y: 650, width: 680, height: 70 } },
    { id: "jump-step", bounds: { x: 500, y: 590, width: 150, height: 60 } },
    { id: "jump-platform", bounds: { x: 710, y: 550, width: 150, height: 24 } },
    { id: "jump-pit-floor", bounds: { x: 680, y: 700, width: 240, height: 20 } },
    { id: "middle-floor", bounds: { x: 920, y: 650, width: 1120, height: 70 } },
    { id: "combat-ceiling", bounds: { x: 1730, y: 430, width: 300, height: 20 } },
    { id: "trial-pit-floor", bounds: { x: 2040, y: 700, width: 120, height: 20 } },
    { id: "final-floor", bounds: { x: 2160, y: 650, width: 360, height: 70 } },
    { id: "right-wall", bounds: { x: 2520, y: 0, width: 32, height: 720 } },
  ],
  enemies: [
    {
      id: "lesson-sentinel",
      position: { x: 1840, y: 610 },
      patrolMinX: 1740,
      patrolMaxX: 1970,
      health: 2,
    },
    {
      id: "trial-sentinel",
      position: { x: 2310, y: 610 },
      patrolMinX: 2200,
      patrolMaxX: 2440,
    },
  ],
  hazards: [
    {
      id: "resonance-crusher",
      bounds: { x: 1450, y: 570, width: 60, height: 80 },
    },
  ],
  soundEmitters: [
    {
      id: "movement-water-drop",
      kind: "ambient",
      position: { x: 420, y: 620 },
      intervalSeconds: 2.4,
      initialDelaySeconds: 0.35,
      maximumDistance: 430,
      intensity: 0.52,
    },
    {
      id: "jump-chain",
      kind: "ambient",
      position: { x: 790, y: 510 },
      intervalSeconds: 2.8,
      initialDelaySeconds: 1.2,
      maximumDistance: 500,
      intensity: 0.58,
    },
    {
      id: "resonance-crusher-pulse",
      kind: "hazard",
      position: { x: 1480, y: 610 },
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
      prompt: "A / D 이동 · 오른쪽에서 들리는 물소리를 따라가세요",
    },
    {
      id: "jump",
      startX: 430,
      prompt: "Space 점프 · 단차와 수로를 건너세요",
    },
    {
      id: "roll",
      startX: 1210,
      prompt: "Shift 구르기 · 붉은 음파를 내는 공격 지형을 통과하세요",
    },
    {
      id: "attack",
      startX: 1620,
      prompt: "J 공격 · 적의 소리를 읽고 직접 처치하세요",
    },
    {
      id: "trial",
      startX: 2040,
      prompt: "종합 시험 · 이동, 점프, 구르기와 공격을 모두 사용하세요",
      requiresEnemyDefeated: "lesson-sentinel",
    },
  ],
};
