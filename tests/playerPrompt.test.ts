import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../src/game/simulation/state";
import {
  createCenteredRestartPrompt,
  DEATH_RESTART_PROMPT_DELAY_SECONDS,
  DEATH_RESTART_PROMPT_FADE_SECONDS,
  DEATH_RESTART_PROMPT_GLYPH_SCALE,
  DEATH_RESTART_PROMPT_PIXEL_SIZE,
  resolveDeathRestartPromptAlpha,
} from "../src/phaser/view/playerPrompt";
import { rasterizePixelText } from "../src/phaser/view/pixelText";

describe("player prompt", () => {
  it("keeps the death prompt hidden while the player is alive", () => {
    const { player } = createInitialGameState();

    expect(resolveDeathRestartPromptAlpha(player)).toBe(0);
  });

  it("fades in R one second after death", () => {
    const { player } = createInitialGameState();
    player.action = "dead";

    player.actionTime = DEATH_RESTART_PROMPT_DELAY_SECONDS - 0.01;
    expect(resolveDeathRestartPromptAlpha(player)).toBe(0);

    player.actionTime =
      DEATH_RESTART_PROMPT_DELAY_SECONDS + DEATH_RESTART_PROMPT_FADE_SECONDS / 2;
    expect(resolveDeathRestartPromptAlpha(player)).toBeCloseTo(0.5);

    player.actionTime =
      DEATH_RESTART_PROMPT_DELAY_SECONDS + DEATH_RESTART_PROMPT_FADE_SECONDS;
    expect(resolveDeathRestartPromptAlpha(player)).toBeCloseTo(1);
  });

  it("centers a tutorial-sized R made from 3-by-3 pixel cells", () => {
    const prompt = createCenteredRestartPrompt(960, 540);
    const xs = prompt.cells.map((cell) => cell.x);
    const ys = prompt.cells.map((cell) => cell.y);
    const renderedWidth = 5 * DEATH_RESTART_PROMPT_GLYPH_SCALE *
      DEATH_RESTART_PROMPT_PIXEL_SIZE;
    const renderedHeight = 7 * DEATH_RESTART_PROMPT_GLYPH_SCALE *
      DEATH_RESTART_PROMPT_PIXEL_SIZE;

    expect(DEATH_RESTART_PROMPT_PIXEL_SIZE).toBe(3);
    expect(prompt.cells).toHaveLength(
      rasterizePixelText("R").cells.length * DEATH_RESTART_PROMPT_GLYPH_SCALE ** 2,
    );
    expect(Math.max(...xs) - Math.min(...xs) + 1).toBe(15);
    expect(Math.max(...ys) - Math.min(...ys) + 1).toBe(21);
    expect(renderedWidth).toBe(45);
    expect(renderedHeight).toBe(63);
    expect(prompt.originX).toBe((960 - renderedWidth) / 2);
    expect(prompt.originY).toBe((540 - renderedHeight) / 2);
  });
});
