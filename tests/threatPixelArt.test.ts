import { describe, expect, it } from "vitest";
import { ENEMY_CONFIG } from "../src/game/simulation/rules/config";
import type { EnemyState } from "../src/game/simulation/state";
import {
  createEnemyThreatCells,
  createHazardThreatCells,
  resolveEnemyThreatFrame,
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

function createEnemy(overrides: Partial<EnemyState> = {}): EnemyState {
  return {
    id: "threat-test",
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    facing: 1,
    attackFacing: 1,
    grounded: true,
    health: 3,
    maxHealth: 3,
    alive: true,
    action: "patrol",
    actionTime: 0,
    attackCooldown: 0,
    hazardInvulnerabilityTime: 0,
    patrolMinX: -100,
    patrolMaxX: 100,
    footstepTravel: 0,
    echoTime: 1,
    echoDuration: 1,
    ...overrides,
  };
}

describe("threat pixel art", () => {
  it("builds a filled side-profile enemy from unique 3px cells", () => {
    const idle = createEnemyThreatCells("idle", 1);
    const facingLeft = createEnemyThreatCells("idle", -1);

    expect(THREAT_PIXEL_SIZE).toBe(3);
    expectUniqueIntegerCells(idle);
    expectUniqueIntegerCells(facingLeft);
    expect(idle.length).toBeGreaterThan(250);
    expect(Math.max(...idle.map((cell) => cell.x))).toBeGreaterThan(
      Math.abs(Math.min(...idle.map((cell) => cell.x))) / 2,
    );
    expect(Math.min(...facingLeft.map((cell) => cell.x))).toBe(
      -Math.max(...idle.map((cell) => cell.x)),
    );
  });

  it("selects four walking frames and three attack phases", () => {
    const walker = createEnemy({ velocity: { x: 100, y: 0 } });
    expect(resolveEnemyThreatFrame(walker, 0)).toBe("walk-0");
    expect(resolveEnemyThreatFrame(walker, 1 / 9)).toBe("walk-1");
    expect(resolveEnemyThreatFrame(walker, 2 / 9)).toBe("walk-2");
    expect(resolveEnemyThreatFrame(walker, 3 / 9)).toBe("walk-3");

    const attacker = createEnemy({ action: "attack" });
    attacker.actionTime = ENEMY_CONFIG.attackSeconds * 0.2;
    expect(resolveEnemyThreatFrame(attacker, 0)).toBe("attack-strike");
    attacker.actionTime = ENEMY_CONFIG.attackSeconds * 0.6;
    expect(resolveEnemyThreatFrame(attacker, 0)).toBe(
      "attack-follow-through",
    );
    attacker.actionTime = ENEMY_CONFIG.attackSeconds * 0.9;
    expect(resolveEnemyThreatFrame(attacker, 0)).toBe("attack-recover");
  });

  it("changes the filled silhouette between walking and attacking poses", () => {
    const walkFrames = [0, 1, 2, 3].map((index) =>
      createEnemyThreatCells(`walk-${index}` as const, 1),
    );
    const striking = createEnemyThreatCells("attack-strike", 1);

    expect(new Set(walkFrames.map((cells) => JSON.stringify(cells))).size).toBe(
      4,
    );
    expect(Math.max(...striking.map((cell) => cell.x))).toBeGreaterThan(
      Math.max(...walkFrames[0].map((cell) => cell.x)),
    );
  });

  it("plays a death sequence before settling on the persistent corpse", () => {
    const deadEnemy = createEnemy({
      alive: false,
      action: "dead",
      grounded: true,
    });

    deadEnemy.actionTime = ENEMY_CONFIG.deathAnimationSeconds * 0.1;
    expect(resolveEnemyThreatFrame(deadEnemy, 0)).toBe("death-recoil");
    deadEnemy.actionTime = ENEMY_CONFIG.deathAnimationSeconds * 0.5;
    expect(resolveEnemyThreatFrame(deadEnemy, 0)).toBe("death-fall");
    deadEnemy.actionTime = ENEMY_CONFIG.deathAnimationSeconds * 0.8;
    expect(resolveEnemyThreatFrame(deadEnemy, 0)).toBe("death-collapse");
    deadEnemy.actionTime = ENEMY_CONFIG.deathAnimationSeconds * 1.1;
    expect(resolveEnemyThreatFrame(deadEnemy, 0)).toBe("corpse");

    const deathFrames = [
      "death-recoil",
      "death-fall",
      "death-collapse",
      "corpse",
    ] as const;
    expect(
      new Set(
        deathFrames.map((frame) =>
          JSON.stringify(createEnemyThreatCells(frame, 1)),
        ),
      ).size,
    ).toBe(deathFrames.length);
  });

  it("fills the serrated hazard interior while keeping it inside its bounds", () => {
    const cells = createHazardThreatCells(120, 320);
    expectUniqueIntegerCells(cells);

    expect(cells.every((cell) => cell.x >= 0 && cell.x * 3 < 120)).toBe(true);
    expect(cells.every((cell) => cell.y >= 0 && cell.y * 3 < 320)).toBe(true);
    expect(cells).not.toContainEqual({ x: 0, y: 0 });
    expect(cells).not.toContainEqual({ x: 39, y: 0 });
    expect(cells).toContainEqual({ x: 19, y: 50 });
    expect(cells.length).toBeGreaterThan(2500);
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
