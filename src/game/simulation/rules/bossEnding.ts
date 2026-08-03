import { STAGE_TWO_CONFIG } from "./config";

const ENDING_SUFFIX = "...?";

export function resolveBossEndingText(endingTime: number | null): string {
  if (endingTime === null || endingTime < 0) return "";
  if (endingTime < STAGE_TWO_CONFIG.phaseThreeEndTitleDelaySeconds) {
    return "";
  }
  const timeSinceTitle =
    endingTime - STAGE_TWO_CONFIG.phaseThreeEndTitleDelaySeconds;
  if (timeSinceTitle < STAGE_TWO_CONFIG.phaseThreeEndSuffixDelaySeconds) {
    return "End";
  }
  const revealedCharacters = Math.min(
    ENDING_SUFFIX.length,
    Math.floor(
      (timeSinceTitle - STAGE_TWO_CONFIG.phaseThreeEndSuffixDelaySeconds) /
        STAGE_TWO_CONFIG.phaseThreeEndTextCharacterIntervalSeconds,
    ) + 1,
  );
  return `End${ENDING_SUFFIX.slice(0, revealedCharacters)}`;
}
