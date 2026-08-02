import type { PlayerState } from "../../game/simulation/state";
import { rasterizePixelText, type PixelTextCell } from "./pixelText";

export const DEATH_RESTART_PROMPT_DELAY_SECONDS = 1;
export const DEATH_RESTART_PROMPT_FADE_SECONDS = 0.4;
export const DEATH_RESTART_PROMPT_PIXEL_SIZE = 3;
export const DEATH_RESTART_PROMPT_GLYPH_SCALE = 3;

export interface CenteredRestartPrompt {
  cells: readonly PixelTextCell[];
  originX: number;
  originY: number;
}

export function createCenteredRestartPrompt(
  viewportWidth: number,
  viewportHeight: number,
): CenteredRestartPrompt {
  const pixelText = rasterizePixelText("R");
  const cells: PixelTextCell[] = [];
  for (const cell of pixelText.cells) {
    for (let offsetY = 0; offsetY < DEATH_RESTART_PROMPT_GLYPH_SCALE; offsetY += 1) {
      for (let offsetX = 0; offsetX < DEATH_RESTART_PROMPT_GLYPH_SCALE; offsetX += 1) {
        cells.push({
          x: cell.x * DEATH_RESTART_PROMPT_GLYPH_SCALE + offsetX,
          y: cell.y * DEATH_RESTART_PROMPT_GLYPH_SCALE + offsetY,
        });
      }
    }
  }
  const renderedWidth =
    pixelText.width * DEATH_RESTART_PROMPT_GLYPH_SCALE *
    DEATH_RESTART_PROMPT_PIXEL_SIZE;
  const renderedHeight =
    pixelText.height * DEATH_RESTART_PROMPT_GLYPH_SCALE *
    DEATH_RESTART_PROMPT_PIXEL_SIZE;

  return {
    cells,
    originX: (viewportWidth - renderedWidth) / 2,
    originY: (viewportHeight - renderedHeight) / 2,
  };
}

export function resolveDeathRestartPromptAlpha(player: PlayerState): number {
  if (player.action !== "dead") return 0;

  const fadeElapsed = player.actionTime - DEATH_RESTART_PROMPT_DELAY_SECONDS;
  return fadeElapsed <= 0
    ? 0
    : fadeElapsed >= DEATH_RESTART_PROMPT_FADE_SECONDS
      ? 1
      : fadeElapsed / DEATH_RESTART_PROMPT_FADE_SECONDS;
}
