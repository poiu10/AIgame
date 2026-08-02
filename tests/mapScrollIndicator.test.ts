import { describe, expect, it } from "vitest";
import {
  createMapScrollIndicatorDots,
  MAP_SCROLL_INDICATOR_DOT_SIZE,
  MAP_SCROLL_INDICATOR_SPACING,
} from "../src/phaser/view/mapScrollIndicator";

describe("map scroll indicator", () => {
  it("places 3px dots on the visible world top and bottom edges", () => {
    const dots = createMapScrollIndicatorDots(45, 550, 540);

    expect(MAP_SCROLL_INDICATOR_DOT_SIZE).toBe(3);
    expect(MAP_SCROLL_INDICATOR_SPACING).toBe(15);
    expect(dots).toEqual([
      { x: 0, y: 10 },
      { x: 0, y: 547 },
      { x: 15, y: 10 },
      { x: 15, y: 547 },
      { x: 30, y: 10 },
      { x: 30, y: 547 },
    ]);
  });

  it("spans the world width rather than a fixed screen width", () => {
    const dots = createMapScrollIndicatorDots(1_000, 1_440, 540);
    const topDots = dots.filter((dot) => dot.y === 900);

    expect(topDots[0]).toEqual({ x: 0, y: 900 });
    expect(topDots.at(-1)).toEqual({ x: 990, y: 900 });
    expect(topDots.every((dot) => dot.x <= 997)).toBe(true);
  });
});
