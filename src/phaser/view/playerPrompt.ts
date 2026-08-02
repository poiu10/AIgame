import type { PlayerState } from "../../game/simulation/state";

export const DEATH_RESTART_PROMPT_DELAY_SECONDS = 1;
export const DEATH_RESTART_PROMPT_FADE_SECONDS = 0.4;

export interface PlayerPrompt {
  text: string;
  alpha: number;
}

export function resolvePlayerPrompt(
  player: PlayerState,
  tutorialPrompt: string,
): PlayerPrompt {
  if (player.action !== "dead") {
    return { text: tutorialPrompt, alpha: 1 };
  }

  const fadeElapsed = player.actionTime - DEATH_RESTART_PROMPT_DELAY_SECONDS;
  const alpha = fadeElapsed <= 0
    ? 0
    : fadeElapsed >= DEATH_RESTART_PROMPT_FADE_SECONDS
      ? 1
      : fadeElapsed / DEATH_RESTART_PROMPT_FADE_SECONDS;

  return { text: "R", alpha };
}
