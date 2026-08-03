import { STAGE_TWO_CONFIG } from "./config";

const ENDING_SUFFIX = "...?";

export function resolveBossEndingText(endingTime: number | null): string {
  if (endingTime === null || endingTime < 0) return "";
  if (endingTime < STAGE_TWO_CONFIG.phaseThreeEndTextDelaySeconds) {
    return "End";
  }
  const revealedCharacters = Math.min(
    ENDING_SUFFIX.length,
    Math.floor(
      (endingTime - STAGE_TWO_CONFIG.phaseThreeEndTextDelaySeconds) /
        STAGE_TWO_CONFIG.phaseThreeEndTextCharacterIntervalSeconds,
    ) + 1,
  );
  return `End${ENDING_SUFFIX.slice(0, revealedCharacters)}`;
}
