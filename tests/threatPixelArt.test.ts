import { describe, expect, it } from "vitest";
import { ENEMY_CONFIG } from "../src/game/simulation/rules/config";
import { ENEMY_KINDS } from "../src/game/content/world";
import { ENEMY_ATTACK_HITBOX } from "../src/game/simulation/rules/combat";
import type { EnemyState } from "../src/game/simulation/state";
import {
  createEnemyThreatCells,
  createCrackedCocoonBossThreatCells,
  createElectricHazardLightningCells,
  createFloorHazardStrikeCells,
  createFloorHazardThreatCells,
  createHazardDamageLightningCells,
  createHazardThreatCells,
  createLongFloorHazardThreatCells,
  createShortFloorHazardThreatCells,
  createThreatOuterOutlineCells,
  LONG_FLOOR_HAZARD_ID,
  resolveEnemyThreatFrame,
  resolveFloorHazardStrikeExtension,
  resolveHazardReactionFrame,
  SHORT_FLOOR_HAZARD_ID,
  THREAT_PIXEL_SIZE,
} from "../src/phaser/view/threatPixelArt";
import {
  ECHO_MARK_COLORS,
  PLAYER_FOOTSTEP_WAVE_COLOR,
  PLAYER_ATTACK_WAVE_COLOR,
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

function countLeadingEdgeBands(
  cells: readonly { x: number; y: number }[],
): number {
  const leadingX = Math.max(...cells.map((cell) => cell.x));
  const ys = [...new Set(
    cells
      .filter((cell) => cell.x >= leadingX - 2)
      .map((cell) => cell.y),
  )].sort((a, b) => a - b);
  let bands = 0;
  let previous = Number.NEGATIVE_INFINITY;
  for (const y of ys) {
    if (y > previous + 1) bands += 1;
    previous = y;
  }
  return bands;
}

function createEnemy(overrides: Partial<EnemyState> = {}): EnemyState {
  return {
    id: "threat-test",
    kind: ENEMY_KINDS.stalker,
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
    patrolMinX: -100,
    patrolMaxX: 100,
    footstepTravel: 0,
    echoTime: 1,
    echoDuration: 1,
    activated: true,
    timeUntilPulse: 1,
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
      -Math.max(...idle.map((cell) => cell.x)) - 1,
    );
  });

  it("builds a one-cell outer outline without covering the enemy", () => {
    const source = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
    const outline = createThreatOuterOutlineCells(source);

    expectUniqueIntegerCells(outline);
    expect(outline).toHaveLength(10);
    expect(outline).toContainEqual({ x: -1, y: -1 });
    expect(outline).toContainEqual({ x: 2, y: 1 });
    expect(outline).not.toContainEqual({ x: 0, y: 0 });
    expect(outline).not.toContainEqual({ x: 1, y: 0 });
  });

  it("selects four walking frames and three attack phases", () => {
    const walker = createEnemy({ velocity: { x: 100, y: 0 } });
    const walkFrameSeconds =
      ENEMY_CONFIG.footstepDistance / (4 * ENEMY_CONFIG.patrolSpeed);
    expect(resolveEnemyThreatFrame(walker, 0)).toBe("walk-0");
    expect(resolveEnemyThreatFrame(walker, walkFrameSeconds)).toBe("walk-1");
    expect(resolveEnemyThreatFrame(walker, walkFrameSeconds * 2)).toBe("walk-2");
    expect(resolveEnemyThreatFrame(walker, walkFrameSeconds * 3)).toBe("walk-3");
    expect(resolveEnemyThreatFrame(walker, walkFrameSeconds * 4)).toBe("walk-0");

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

  it("snaps the strike arm to the hitbox edge before retracting", () => {
    const strikeRight = createEnemyThreatCells("attack-strike", 1);
    const strikeLeft = createEnemyThreatCells("attack-strike", -1);
    const followThrough = createEnemyThreatCells(
      "attack-follow-through",
      1,
    );
    const recover = createEnemyThreatCells("attack-recover", 1);
    const idle = createEnemyThreatCells("idle", 1);
    const rightEdge =
      (Math.max(...strikeRight.map((cell) => cell.x)) + 1) *
      THREAT_PIXEL_SIZE;
    const leftEdge =
      Math.min(...strikeLeft.map((cell) => cell.x)) * THREAT_PIXEL_SIZE;
    const followThroughEdge =
      (Math.max(...followThrough.map((cell) => cell.x)) + 1) *
      THREAT_PIXEL_SIZE;
    const recoverEdge =
      (Math.max(...recover.map((cell) => cell.x)) + 1) * THREAT_PIXEL_SIZE;
    const idleEdge =
      (Math.max(...idle.map((cell) => cell.x)) + 1) * THREAT_PIXEL_SIZE;

    expect(rightEdge).toBeGreaterThanOrEqual(ENEMY_ATTACK_HITBOX.reach);
    expect(rightEdge - ENEMY_ATTACK_HITBOX.reach).toBeLessThan(
      THREAT_PIXEL_SIZE,
    );
    expect(leftEdge).toBeLessThanOrEqual(-ENEMY_ATTACK_HITBOX.reach);
    expect(-ENEMY_ATTACK_HITBOX.reach - leftEdge).toBeLessThan(
      THREAT_PIXEL_SIZE,
    );
    expect(rightEdge).toBeGreaterThan(followThroughEdge);
    expect(followThroughEdge).toBeGreaterThan(recoverEdge);
    expect(recoverEdge).toBeGreaterThan(idleEdge);
  });

  it("keeps flyer and waker silhouettes distinct through locomotion and attack", () => {
    const flyerFlight = createEnemyThreatCells(
      "walk-0",
      1,
      ENEMY_KINDS.flyer,
    );
    const wakerPursuit = createEnemyThreatCells(
      "walk-0",
      1,
      ENEMY_KINDS.waker,
    );
    const stalkerWalk = createEnemyThreatCells(
      "walk-0",
      1,
      ENEMY_KINDS.stalker,
    );
    const flyerStrike = createEnemyThreatCells(
      "attack-strike",
      1,
      ENEMY_KINDS.flyer,
    );
    const wakerStrike = createEnemyThreatCells(
      "attack-strike",
      1,
      ENEMY_KINDS.waker,
    );
    const flyerAlert = createEnemyThreatCells(
      "alert-1",
      1,
      ENEMY_KINDS.flyer,
    );
    const wakerAlert = createEnemyThreatCells(
      "alert-1",
      1,
      ENEMY_KINDS.waker,
    );

    for (const cells of [
      flyerFlight,
      wakerPursuit,
      stalkerWalk,
      flyerStrike,
      wakerStrike,
    ]) {
      expectUniqueIntegerCells(cells);
    }
    expect(new Set([
      JSON.stringify(flyerFlight),
      JSON.stringify(wakerPursuit),
      JSON.stringify(stalkerWalk),
    ]).size).toBe(3);
    expect(JSON.stringify(flyerStrike)).not.toBe(JSON.stringify(wakerStrike));
    expect(flyerAlert).not.toEqual(flyerFlight);
    expect(wakerAlert).not.toEqual(wakerPursuit);
    expect(countLeadingEdgeBands(flyerStrike)).toBeGreaterThanOrEqual(3);
    expect(countLeadingEdgeBands(wakerStrike)).toBeGreaterThanOrEqual(3);

    for (const strike of [flyerStrike, wakerStrike]) {
      const strikeEdge =
        (Math.max(...strike.map((cell) => cell.x)) + 1) * THREAT_PIXEL_SIZE;
      expect(strikeEdge).toBeGreaterThanOrEqual(ENEMY_ATTACK_HITBOX.reach);
      expect(strikeEdge - ENEMY_ATTACK_HITBOX.reach).toBeLessThan(
        THREAT_PIXEL_SIZE,
      );
    }
  });

  it("animates the inactive waker as a breathing sleeping silhouette", () => {
    const waker = createEnemy({
      kind: ENEMY_KINDS.waker,
      action: "sleep",
      activated: false,
    });

    expect(resolveEnemyThreatFrame(waker, 0)).toBe("sleep-0");
    expect(resolveEnemyThreatFrame(waker, 0.5)).toBe("sleep-1");
    const resting = createEnemyThreatCells("sleep-0", 1, ENEMY_KINDS.waker);
    const breathing = createEnemyThreatCells("sleep-1", 1, ENEMY_KINDS.waker);
    expectUniqueIntegerCells(resting);
    expectUniqueIntegerCells(breathing);
    expect(breathing).not.toEqual(resting);
  });

  it("gives flyers and wakers four movement poses and distinct death sequences", () => {
    const movementFrames = ["walk-0", "walk-1", "walk-2", "walk-3"] as const;
    const deathFrames = [
      "death-recoil",
      "death-fall",
      "death-collapse",
      "corpse",
    ] as const;

    for (const kind of [ENEMY_KINDS.flyer, ENEMY_KINDS.waker]) {
      const movement = movementFrames.map((frame) =>
        createEnemyThreatCells(frame, 1, kind),
      );
      const death = deathFrames.map((frame) =>
        createEnemyThreatCells(frame, 1, kind),
      );
      for (const cells of [...movement, ...death]) expectUniqueIntegerCells(cells);
      expect(new Set(movement.map((cells) => JSON.stringify(cells))).size).toBe(4);
      expect(new Set(death.map((cells) => JSON.stringify(cells))).size).toBe(4);
    }

    expect(createEnemyThreatCells("corpse", 1, ENEMY_KINDS.flyer)).not.toEqual(
      createEnemyThreatCells("corpse", 1, ENEMY_KINDS.waker),
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

  it("draws animated electric branches continuously from emitter to floor", () => {
    const height = 410;
    const first = createElectricHazardLightningCells(40, height, 0);
    const second = createElectricHazardLightningCells(40, height, 1);
    expectUniqueIntegerCells(first);
    expectUniqueIntegerCells(second);
    expect(first.every((cell) => cell.x >= 0 && cell.x * THREAT_PIXEL_SIZE < 40))
      .toBe(true);
    expect(first.every((cell) => cell.y >= 0 && cell.y * THREAT_PIXEL_SIZE < height))
      .toBe(true);
    expect(Math.max(...first.map((cell) => cell.y))).toBe(
      Math.ceil(height / THREAT_PIXEL_SIZE) - 1,
    );
    expect(first).not.toEqual(second);
  });

  it("authors separate repeating threat patterns for both floor hazards", () => {
    const shortCells = createShortFloorHazardThreatCells();
    const longCells = createLongFloorHazardThreatCells();
    expectUniqueIntegerCells(shortCells);
    expectUniqueIntegerCells(longCells);

    expect(shortCells.every((cell) => cell.x >= 0 && cell.x < 40)).toBe(true);
    expect(shortCells.every((cell) => cell.y >= 0 && cell.y < 13)).toBe(true);
    expect(longCells.every((cell) => cell.x >= 0 && cell.x < 293)).toBe(true);
    expect(longCells.every((cell) => cell.y >= 0 && cell.y < 13)).toBe(true);
    expect(new Set(shortCells.map((cell) => cell.y)).size).toBe(13);
    expect(new Set(longCells.map((cell) => cell.y)).size).toBe(13);
    expect(longCells.length).toBeGreaterThan(shortCells.length * 5);

    const shortSignature = shortCells
      .map((cell) => `${cell.x},${cell.y}`)
      .sort();
    const longLeadingSignature = longCells
      .filter((cell) => cell.x < 40)
      .map((cell) => `${cell.x},${cell.y}`)
      .sort();
    expect(longLeadingSignature).not.toEqual(shortSignature);
    expect(createFloorHazardThreatCells(SHORT_FLOOR_HAZARD_ID)).toEqual(
      shortCells,
    );
    expect(createFloorHazardThreatCells(LONG_FLOOR_HAZARD_ID)).toEqual(
      longCells,
    );
  });

  it("raises and retracts a clustered floor strike at the contact point", () => {
    const hazardReaction = { reactionTime: 0.42, reactionDuration: 0.42 };
    expect(resolveFloorHazardStrikeExtension(hazardReaction)).toBe(0);
    hazardReaction.reactionTime = 0.3;
    const rising = resolveFloorHazardStrikeExtension(hazardReaction)!;
    hazardReaction.reactionTime = 0.21;
    const extended = resolveFloorHazardStrikeExtension(hazardReaction)!;
    hazardReaction.reactionTime = 0.04;
    const retracting = resolveFloorHazardStrikeExtension(hazardReaction)!;
    expect(rising).toBeGreaterThan(0);
    expect(extended).toBe(1);
    expect(retracting).toBeLessThan(extended);

    const cells = createFloorHazardStrikeCells(120, extended, 60);
    expectUniqueIntegerCells(cells);
    expect(Math.min(...cells.map((cell) => cell.y))).toBeLessThan(-20);
    expect(Math.min(...cells.map((cell) => cell.x))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...cells.map((cell) => cell.x)) * THREAT_PIXEL_SIZE)
      .toBeLessThan(120);
  });

  it("bursts 3px damage lightning from only the contacted side", () => {
    const bodyBefore = createHazardThreatCells(120, 320);
    const impactLeft = createHazardDamageLightningCells(
      120,
      320,
      "impact",
      -1,
      160,
    );
    const impactRight = createHazardDamageLightningCells(
      120,
      320,
      "impact",
      1,
      160,
    );
    const scatter = createHazardDamageLightningCells(
      120,
      320,
      "scatter",
      -1,
      160,
    );
    const fade = createHazardDamageLightningCells(
      120,
      320,
      "fade",
      -1,
      160,
    );
    const bodyAfter = createHazardThreatCells(120, 320);

    expectUniqueIntegerCells(impactLeft);
    expectUniqueIntegerCells(impactRight);
    expectUniqueIntegerCells(scatter);
    expectUniqueIntegerCells(fade);
    expect(bodyAfter).toEqual(bodyBefore);
    expect(impactLeft.some((cell) => cell.x < 0)).toBe(true);
    expect(impactLeft.every((cell) => cell.x < 40)).toBe(true);
    expect(impactRight.some((cell) => cell.x >= 40)).toBe(true);
    expect(impactRight.every((cell) => cell.x >= 0)).toBe(true);
    expect(Math.min(...impactLeft.map((cell) => cell.x))).toBeLessThan(
      Math.min(...scatter.map((cell) => cell.x)),
    );
    expect(Math.min(...scatter.map((cell) => cell.x))).toBeLessThan(
      Math.min(...fade.map((cell) => cell.x)),
    );
  });

  it("selects impact, scatter, and fade from damage reaction time", () => {
    const hazard = {
      id: "hazard-test",
      echoTime: 1,
      echoDuration: 1,
      reactionTime: 1,
      reactionDuration: 1,
      reactionSide: -1 as const,
      reactionOffsetX: 60,
      reactionOffsetY: 160,
    };

    expect(resolveHazardReactionFrame(hazard)).toBe("impact");
    hazard.reactionTime = 0.5;
    expect(resolveHazardReactionFrame(hazard)).toBe("scatter");
    hazard.reactionTime = 0.2;
    expect(resolveHazardReactionFrame(hazard)).toBe("fade");
    hazard.reactionTime = 0;
    expect(resolveHazardReactionFrame(hazard)).toBeNull();
  });

  it("uses the player attack color for enemy attacks and red for other threats", () => {
    expect(SOUND_WAVE_COLORS["enemy-step"]).toBe(
      PLAYER_FOOTSTEP_WAVE_COLOR,
    );
    expect(SOUND_WAVE_COLORS["player-step"]).toBe(
      PLAYER_FOOTSTEP_WAVE_COLOR,
    );
    expect(SOUND_WAVE_COLORS["enemy-alert"]).toBe(THREAT_COLOR);
    expect(SOUND_WAVE_COLORS["enemy-attack"]).toBe(
      PLAYER_ATTACK_WAVE_COLOR,
    );
    expect(SOUND_WAVE_COLORS["enemy-attack"]).toBe(
      SOUND_WAVE_COLORS["player-attack"],
    );
    expect(SOUND_WAVE_COLORS["enemy-call"]).toBe(THREAT_COLOR);
    expect(SOUND_WAVE_COLORS["waker-call"]).toBe(THREAT_COLOR);
    expect(SOUND_WAVE_COLORS["door-open"]).toBe(ECHO_MARK_COLORS.terrain);
    expect(SOUND_WAVE_COLORS["crusher-pulse"]).toBe(THREAT_COLOR);
    expect(SOUND_WAVE_COLORS["electric-pulse"]).toBe(THREAT_COLOR);
    expect(ECHO_MARK_COLORS.terrain).not.toBe(THREAT_COLOR);
    expect(ECHO_MARK_COLORS.hazard).toBe(THREAT_COLOR);
  });

  it("builds the raven-insect boss and its split cocoon from 3px integer cells", () => {
    const idle = createEnemyThreatCells("idle", 1, ENEMY_KINDS.ravenBoss);
    const flap = createEnemyThreatCells("walk-1", 1, ENEMY_KINDS.ravenBoss);
    const mirrored = createEnemyThreatCells("idle", -1, ENEMY_KINDS.ravenBoss);
    const cracked = createCrackedCocoonBossThreatCells(1);

    expect(THREAT_PIXEL_SIZE).toBe(3);
    expectUniqueIntegerCells(idle);
    expectUniqueIntegerCells(flap);
    expectUniqueIntegerCells(mirrored);
    expectUniqueIntegerCells(cracked);
    expect(idle).not.toEqual(flap);
    expect(mirrored).not.toEqual(idle);
    expect(Math.max(...idle.map((cell) => cell.x)) -
      Math.min(...idle.map((cell) => cell.x))).toBeGreaterThan(60);
    expect(Math.max(...idle.map((cell) => cell.y)) -
      Math.min(...idle.map((cell) => cell.y))).toBeGreaterThan(60);
    expect(Math.min(...cracked.map((cell) => Math.abs(cell.x))))
      .toBeGreaterThan(10);
  });
});
