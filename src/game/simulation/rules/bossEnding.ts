import { STAGE_TWO_CONFIG } from "./config";

export function resolveBossEndingText(endingTime: number | null): string {
  if (endingTime === null || endingTime < 0) return "";
  if (endingTime < STAGE_TWO_CONFIG.phaseThreeEndTitleDelaySeconds) {
    return "";
  }
  return "End";
}

export function resolveBossEndingAlpha(endingTime: number | null): number {
  if (endingTime === null) return 0;
  return Math.max(
    0,
    Math.min(
      1,
      (endingTime - STAGE_TWO_CONFIG.phaseThreeEndTitleDelaySeconds) /
        STAGE_TWO_CONFIG.phaseThreeEndFadeSeconds,
    ),
  );
}
