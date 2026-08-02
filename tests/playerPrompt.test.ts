import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../src/game/simulation/state";
import {
  DEATH_RESTART_PROMPT_DELAY_SECONDS,
  DEATH_RESTART_PROMPT_FADE_SECONDS,
  resolvePlayerPrompt,
} from "../src/phaser/view/playerPrompt";

describe("player prompt", () => {
  it("keeps the tutorial prompt while the player is alive", () => {
    const { player } = createInitialGameState();

    expect(resolvePlayerPrompt(player, "SPACE")).toEqual({
      text: "SPACE",
      alpha: 1,
    });
  });

  it("fades in R one second after death", () => {
    const { player } = createInitialGameState();
    player.action = "dead";

    player.actionTime = DEATH_RESTART_PROMPT_DELAY_SECONDS - 0.01;
    expect(resolvePlayerPrompt(player, "SPACE")).toEqual({ text: "R", alpha: 0 });

    player.actionTime =
      DEATH_RESTART_PROMPT_DELAY_SECONDS + DEATH_RESTART_PROMPT_FADE_SECONDS / 2;
    expect(resolvePlayerPrompt(player, "SPACE").text).toBe("R");
    expect(resolvePlayerPrompt(player, "SPACE").alpha).toBeCloseTo(0.5);

    player.actionTime =
      DEATH_RESTART_PROMPT_DELAY_SECONDS + DEATH_RESTART_PROMPT_FADE_SECONDS;
    expect(resolvePlayerPrompt(player, "SPACE").text).toBe("R");
    expect(resolvePlayerPrompt(player, "SPACE").alpha).toBeCloseTo(1);
  });
});
