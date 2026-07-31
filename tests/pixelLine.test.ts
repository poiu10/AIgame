import { describe, expect, it } from "vitest";
import {
  rasterizePixelLine,
  SOUND_PIXEL_SIZE,
} from "../src/phaser/view/pixelLine";

describe("pixel line rasterization", () => {
  it("places every wave cell on the 3px grid", () => {
    const cells = rasterizePixelLine({ x: 1, y: 2 }, { x: 17, y: 11 });

    expect(SOUND_PIXEL_SIZE).toBe(3);
    expect(cells.length).toBeGreaterThan(1);
    for (const cell of cells) {
      expect(cell.x % SOUND_PIXEL_SIZE).toBe(0);
      expect(cell.y % SOUND_PIXEL_SIZE).toBe(0);
    }
  });

  it("includes both snapped endpoints without gaps on a straight line", () => {
    expect(rasterizePixelLine({ x: 1, y: 7 }, { x: 10, y: 7 })).toEqual([
      { x: 0, y: 6 },
      { x: 3, y: 6 },
      { x: 6, y: 6 },
      { x: 9, y: 6 },
    ]);
  });
});
