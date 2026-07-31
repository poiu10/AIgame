import { STAGE_ONE } from "./stageOne";
import { TUTORIAL_STAGE } from "./tutorialStage";
import type { StageDefinition } from "./world";

export const STAGES: Readonly<Record<string, StageDefinition>> = {
  [TUTORIAL_STAGE.id]: TUTORIAL_STAGE,
  [STAGE_ONE.id]: STAGE_ONE,
};

export const INITIAL_STAGE_ID = TUTORIAL_STAGE.id;

export function getStage(stageId: string): StageDefinition {
  const stage = STAGES[stageId];
  if (!stage) {
    throw new Error(`알 수 없는 스테이지입니다: ${stageId}`);
  }
  return stage;
}
