import { describe, expect, it } from "vitest";
import {
  createEnemyThreatCells,
  createHazardThreatCells,
  THREAT_PIXEL_SIZE,
} from "../src/phaser/view/threatPixelArt";
import {
  PLAYER_FOOTSTEP_WAVE_COLOR,
  SOUND_WAVE_COLORS,
  THREAT_COLOR,
} from "../src/phaser/view/viewPalette";

function expectUniqueIntegerCells(cells: readonly { x: number; y: number }[]): void {
  expect(cells.length).toBeGreaterThan(0);
  expect(new Set(cells.map((cell) => `${cell.x},${cell.y}`)).size).toBe(
    cells.length,
  );
  for (const cell of cells) {
    expect(Number.isInteger(cell.x)).toBe(true);
    expect(Number.isInteger(cell.y)).toBe(true);
  }
}

describe("threat pixel art", () => {
  it("builds the enemy from unique 3px cells with a directional attack claw", () => {
    const idle = createEnemyThreatCells("patrol", 1);
    const attackingRight = createEnemyThreatCells("attack", 1);
    const attackingLeft = createEnemyThreatCells("attack", -1);

    expect(THREAT_PIXEL_SIZE).toBe(3);
    expectUniqueIntegerCells(idle);
    expectUniqueIntegerCells(attackingRight);
    expectUniqueIntegerCells(attackingLeft);
    expect(Math.max(...attackingRight.map((cell) => cell.x))).toBeGreaterThan(
      Math.max(...idle.map((cell) => cell.x)),
    );
    expect(Math.min(...attackingLeft.map((cell) => cell.x))).toBeLessThan(
      Math.min(...idle.map((cell) => cell.x)),
    );
  });

  it("keeps the serrated hazard inside its bounds without drawing box corners", () => {
    const cells = createHazardThreatCells(120, 320);
    expectUniqueIntegerCells(cells);

    expect(cells.every((cell) => cell.x >= 0 && cell.x * 3 < 120)).toBe(true);
    expect(cells.every((cell) => cell.y >= 0 && cell.y * 3 < 320)).toBe(true);
    expect(cells).not.toContainEqual({ x: 0, y: 0 });
    expect(cells).not.toContainEqual({ x: 39, y: 0 });
    expect(cells.some((cell) => cell.x === 11)).toBe(true);
    expect(cells.some((cell) => cell.x === 28)).toBe(true);
  });

  it("uses one red for threats and the player blue for enemy footsteps", () => {
    expect(SOUND_WAVE_COLORS["enemy-step"]).toBe(
      PLAYER_FOOTSTEP_WAVE_COLOR,
    );
    expect(SOUND_WAVE_COLORS["terrain-step"]).toBe(
      PLAYER_FOOTSTEP_WAVE_COLOR,
    );
    expect(SOUND_WAVE_COLORS["enemy-alert"]).toBe(THREAT_COLOR);
    expect(SOUND_WAVE_COLORS.hazard).toBe(THREAT_COLOR);
  });
});
