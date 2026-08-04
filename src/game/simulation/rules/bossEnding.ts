import { STAGE_TWO_CONFIG } from "./config";

export function resolveBossEndingText(endingTime: number | null): string {
  if (endingTime === null || endingTime < 0) return "";
  if (endingTime < STAGE_TWO_CONFIG.phaseThreeEndTitleDelaySeconds) {
    return "";
  }
  return "End";
}
