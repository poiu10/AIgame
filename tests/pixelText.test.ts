import { describe, expect, it } from "vitest";
import { rasterizePixelText } from "../src/phaser/view/pixelText";

describe("pixel text rasterization", () => {
  it("lays out tutorial prompts on a seven-cell grid", () => {
    const text = rasterizePixelText("A / D");

    expect(text.height).toBe(7);
    expect(text.width).toBe(25);
    expect(text.cells).toContainEqual({ x: 1, y: 0 });
    expect(text.cells).toContainEqual({ x: 20, y: 0 });
  });

  it("normalizes lowercase prompts and replaces unsupported characters", () => {
    expect(rasterizePixelText("Shift")).toEqual(rasterizePixelText("SHIFT"));
    expect(rasterizePixelText("1").cells).toEqual(rasterizePixelText("?").cells);
  });

  it("returns an empty layout for an empty prompt", () => {
    expect(rasterizePixelText("")).toEqual({ cells: [], width: 0, height: 0 });
  });
});
