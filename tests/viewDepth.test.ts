import { describe, expect, it } from "vitest";
import { GAME_VIEW_DEPTH } from "../src/phaser/view/viewDepth";

describe("game view depth", () => {
  it("draws floor hazard strikes in front of the player", () => {
    expect(GAME_VIEW_DEPTH.floorHazardStrikes).toBeGreaterThan(
      GAME_VIEW_DEPTH.player,
    );
  });

  it("keeps passive hazard visuals behind the player", () => {
    expect(GAME_VIEW_DEPTH.hazards).toBeLessThan(GAME_VIEW_DEPTH.player);
  });
});
