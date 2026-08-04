import { describe, expect, it } from "vitest";
import {
  ANIMATION_KEYS,
  PLAYER_SPRITE_DISPLAY_SCALE,
} from "../src/game/assets/manifest";
import {
  ENEMY_KINDS,
  type WorldDefinition,
} from "../src/game/content/world";
import { TUTORIAL_STAGE } from "../src/game/content/tutorialStage";
import { EMPTY_INPUT, type InputActions } from "../src/game/input/actions";
import {
  raycastAabb,
  raycastAabbExit,
} from "../src/game/simulation/collision/aabb";
import {
  ENEMY_CONFIG,
  ENEMY_DEATH_WAVE_CONFIG,
  ENEMY_HIT_WAVE_CONFIG,
  FIXED_STEP_SECONDS,
  MELEE_ATTACK_WAVE_CONFIG,
  PLAYER_CONFIG,
  PLAYER_HIT_WAVE_CONFIG,
} from "../src/game/simulation/rules/config";
import {
  getEnemyAttackBounds,
  getPlayerAttackBounds,
  PLAYER_AIR_ATTACK_HITBOX,
  PLAYER_GROUND_ATTACK_HITBOX,
} from "../src/game/simulation/rules/combat";
import { getPlayerBounds } from "../src/game/simulation/rules/player";
import { createInitialGameState } from "../src/game/simulation/state";
import {
  damageEnemy,
  damagePlayer,
  updateEnemyContactDamage,
  updatePlayerCombat,
} from "../src/game/simulation/systems/combat";
import { updateEnemies } from "../src/game/simulation/systems/enemies";
import {
  getLandingSoundProfile,
  updatePlayerMovement,
} from "../src/game/simulation/systems/movement";
import { stepSimulation } from "../src/game/simulation/systems/simulation";
import { updateWorldEnvironment } from "../src/game/simulation/systems/environment";
import {
  createEchoMark,
  createExposedEchoMarks,
  emitSound,
  PLAYER_SOUND_SOURCE_ID,
  updateSoundPropagation,
} from "../src/game/simulation/systems/sound";
import { resolvePlayerAnimationKey } from "../src/phaser/view/playerAnimation";

const flatWorld: WorldDefinition = {
  width: 1200,
  height: 800,
  playerSpawn: { x: 200, y: 600 },
  terrain: [
    { id: "floor", bounds: { x: 0, y: 700, width: 1200, height: 100 } },
  ],
  enemies: [],
};

const flatWorldGroundedPlayerY =
  flatWorld.terrain[0].bounds.y - PLAYER_CONFIG.height / 2;

function stepMany(
  world: WorldDefinition,
  count: number,
  firstInput: Partial<InputActions> = {},
) {
  let state = createInitialGameState(world);
  for (let index = 0; index < count; index += 1) {
    state = stepSimulation(
      state,
      index === 0 ? { ...EMPTY_INPUT, ...firstInput } : EMPTY_INPUT,
      FIXED_STEP_SECONDS,
      world,
    );
  }
  return state;
}

describe("AABB ray casting", () => {
  it("returns the surface point and normal of the nearest face", () => {
    const hit = raycastAabb(
      { x: 0, y: 50 },
      { x: 1, y: 0 },
      200,
      { x: 100, y: 0, width: 20, height: 100 },
    );

    expect(hit).not.toBeNull();
    expect(hit?.distance).toBeCloseTo(100);
    expect(hit?.point).toEqual({ x: 100, y: 50 });
    expect(hit?.normal).toEqual({ x: -1, y: 0 });
  });

  it("returns the exit surface when a ray starts inside the bounds", () => {
    const hit = raycastAabbExit(
      { x: 110, y: 50 },
      { x: 0, y: -1 },
      100,
      { x: 100, y: 20, width: 20, height: 60 },
    );

    expect(hit).not.toBeNull();
    expect(hit?.distance).toBeCloseTo(30);
    expect(hit?.point).toEqual({ x: 110, y: 20 });
    expect(hit?.normal).toEqual({ x: 0, y: -1 });
  });
});

describe("player controller", () => {
  it("uses integer hitbox dimensions nearest to 90% of the previous size", () => {
    expect(PLAYER_CONFIG.width).toBe(32);
    expect(PLAYER_CONFIG.height).toBe(84);
    expect(Number.isInteger(PLAYER_CONFIG.width)).toBe(true);
    expect(Number.isInteger(PLAYER_CONFIG.height)).toBe(true);
    expect(Number.isInteger(PLAYER_CONFIG.width / 2)).toBe(true);
    expect(Number.isInteger(PLAYER_CONFIG.height / 2)).toBe(true);
  });

  it("keeps the player hitbox centered while moving, rolling, and attacking", () => {
    let state = stepMany(flatWorld, 40);
    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, moveX: 1 },
      FIXED_STEP_SECONDS,
      flatWorld,
    );
    expect(getPlayerBounds(state.player).x).toBeCloseTo(
      state.player.position.x - PLAYER_CONFIG.width / 2,
    );
    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, rollPressed: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );
    expect(state.player.action).toBe("roll");
    expect(getPlayerBounds(state.player).x).toBeCloseTo(
      state.player.position.x - PLAYER_CONFIG.width / 2,
    );

    state.player.action = "normal";
    state.player.attackCooldown = 0;
    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, attackPressed: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );
    expect(state.player.action).toBe("attack");
    expect(getPlayerBounds(state.player).x).toBeCloseTo(
      state.player.position.x - PLAYER_CONFIG.width / 2,
    );
  });

  it("keeps the player attack wave close to the player", () => {
    const state = createInitialGameState(flatWorld);
    state.player.position = { x: 200, y: flatWorldGroundedPlayerY };
    state.player.grounded = true;

    const sounds = updatePlayerMovement(
      state,
      flatWorld,
      { ...EMPTY_INPUT, attackPressed: true },
      0,
    );
    const attackSound = sounds.find((sound) => sound.kind === "player-attack");

    expect(attackSound).toMatchObject({
      position: state.player.position,
      distance: MELEE_ATTACK_WAVE_CONFIG.distance,
      intensity: MELEE_ATTACK_WAVE_CONFIG.intensity,
    });
  });

  it("lands on platforms and jumps from the grounded state", () => {
    let state = stepMany(flatWorld, 40);
    expect(state.player.grounded).toBe(true);
    expect(state.player.position.y).toBeCloseTo(flatWorldGroundedPlayerY);

    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, jumpPressed: true, jumpHeld: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );
    expect(state.player.grounded).toBe(false);
    expect(state.player.velocity.y).toBeCloseTo(
      -PLAYER_CONFIG.jumpSpeed + PLAYER_CONFIG.gravity * FIXED_STEP_SECONDS,
    );
  });

  it("limits upward speed when the jump input is released", () => {
    let state = stepMany(flatWorld, 40);

    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, jumpPressed: true, jumpHeld: false },
      FIXED_STEP_SECONDS,
      flatWorld,
    );

    expect(state.player.velocity.y).toBeCloseTo(
      -PLAYER_CONFIG.jumpReleaseSpeed +
        PLAYER_CONFIG.gravity * FIXED_STEP_SECONDS,
    );
  });

  it("stops horizontal drift when landing without movement input", () => {
    const state = createInitialGameState(flatWorld);
    state.player.position = {
      x: 200,
      y: flatWorldGroundedPlayerY - 8,
    };
    state.player.velocity = { x: PLAYER_CONFIG.maxSpeed, y: 1200 };
    state.player.grounded = false;

    stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, flatWorld);
    const landingX = state.player.position.x;

    expect(state.player.grounded).toBe(true);
    expect(state.player.velocity.x).toBe(0);

    stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, flatWorld);
    expect(state.player.position.x).toBeCloseTo(landingX);
  });

  it("keeps moving when directional input is held through landing", () => {
    const state = createInitialGameState(flatWorld);
    state.player.position = {
      x: 200,
      y: flatWorldGroundedPlayerY - 8,
    };
    state.player.velocity = { x: PLAYER_CONFIG.maxSpeed, y: 1200 };
    state.player.grounded = false;

    stepSimulation(
      state,
      { ...EMPTY_INPUT, moveX: 1 },
      FIXED_STEP_SECONDS,
      flatWorld,
    );

    expect(state.player.grounded).toBe(true);
    expect(state.player.velocity.x).toBe(PLAYER_CONFIG.maxSpeed);
  });

  it("scales the landing wave with the tracked fall height", () => {
    function landWithApex(airborneApexY: number) {
      const state = createInitialGameState(flatWorld);
      state.player.position = {
        x: 200,
        y: flatWorldGroundedPlayerY - 8,
      };
      state.player.velocity = { x: 0, y: 1200 };
      state.player.grounded = false;
      state.player.airborneApexY = airborneApexY;

      stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, flatWorld);

      const landingWave = state.soundWaves.find(
        (wave) => wave.kind === "landing",
      );
      expect(landingWave).toBeDefined();
      return Math.max(
        ...landingWave!.rays.map((ray) => ray.remainingDistance),
      );
    }

    const shallowFallHeight = 88;
    const deepFallHeight = 448;
    const shallowWaveDistance = landWithApex(
      flatWorldGroundedPlayerY - shallowFallHeight,
    );
    const deepWaveDistance = landWithApex(
      flatWorldGroundedPlayerY - deepFallHeight,
    );

    expect(deepWaveDistance).toBeGreaterThan(shallowWaveDistance);
    expect(deepWaveDistance - shallowWaveDistance).toBeCloseTo(
      getLandingSoundProfile(deepFallHeight).distance -
        getLandingSoundProfile(shallowFallHeight).distance,
    );
  });

  it("enters a timed roll and ignores damage while the roll action lasts", () => {
    let state = stepMany(flatWorld, 40);
    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, moveX: 1, rollPressed: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );

    expect(state.player.action).toBe("roll");
    expect(state.player.velocity.x).toBeGreaterThan(800);
    expect(state.player.invulnerabilityTime).toBe(0);
    expect(state.player.rollCooldown).toBeGreaterThan(0);
    expect(damagePlayer(state, -1)).toBe(false);
    expect(state.player.health).toBe(PLAYER_CONFIG.maxHealth);
  });

  it("stops immediately when the roll direction is not held at its end", () => {
    const state = createInitialGameState(flatWorld);
    state.player.position = { x: 200, y: 500 };
    state.player.velocity.x = 240;
    state.player.facing = 1;

    updatePlayerMovement(
      state,
      flatWorld,
      { ...EMPTY_INPUT, rollPressed: true },
      0,
    );
    expect(state.player.velocity.x).toBe(PLAYER_CONFIG.rollSpeed);

    state.player.actionTime = PLAYER_CONFIG.rollSeconds - FIXED_STEP_SECONDS / 2;
    updatePlayerMovement(
      state,
      flatWorld,
      EMPTY_INPUT,
      FIXED_STEP_SECONDS,
    );

    expect(state.player.action).toBe("normal");
    expect(state.player.velocity.x).toBe(0);
  });

  it("keeps roll momentum when its direction remains held", () => {
    const state = createInitialGameState(flatWorld);
    state.player.position = { x: 200, y: 500 };
    state.player.velocity.x = 240;
    state.player.facing = 1;

    updatePlayerMovement(
      state,
      flatWorld,
      { ...EMPTY_INPUT, rollPressed: true },
      0,
    );
    state.player.actionTime = PLAYER_CONFIG.rollSeconds - FIXED_STEP_SECONDS / 2;
    updatePlayerMovement(
      state,
      flatWorld,
      { ...EMPTY_INPUT, moveX: 1 },
      FIXED_STEP_SECONDS,
    );

    expect(state.player.action).toBe("normal");
    expect(state.player.velocity.x).toBeGreaterThan(800);
  });

  it("uses a shallow roll arc to clear a pit and return to its starting height", () => {
    const pitWorld: WorldDefinition = {
      width: 1_000,
      height: 800,
      playerSpawn: { x: 200, y: 600 },
      terrain: [
        { id: "left-floor", bounds: { x: 0, y: 700, width: 300, height: 100 } },
        { id: "right-floor", bounds: { x: 440, y: 700, width: 560, height: 100 } },
      ],
      enemies: [],
    };
    let state = stepMany(pitWorld, 40);
    const startingY = state.player.position.y;
    let minimumY = startingY;

    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, moveX: 1, rollPressed: true },
      FIXED_STEP_SECONDS,
      pitWorld,
    );
    minimumY = Math.min(minimumY, state.player.position.y);
    for (
      let index = 0;
      index < Math.ceil(PLAYER_CONFIG.rollSeconds / FIXED_STEP_SECONDS) + 8;
      index += 1
    ) {
      state = stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, pitWorld);
      minimumY = Math.min(minimumY, state.player.position.y);
    }

    expect(PLAYER_CONFIG.rollBounceSpeed).toBeCloseTo(
      PLAYER_CONFIG.gravity * PLAYER_CONFIG.rollSeconds / 2,
    );
    expect(minimumY).toBeLessThan(startingY - 20);
    expect(state.player.position.x).toBeGreaterThan(440);
    expect(state.player.position.y).toBeCloseTo(startingY);
    expect(state.player.grounded).toBe(true);
  });

  it("cancels a grounded roll into a jump", () => {
    let state = stepMany(flatWorld, 40);
    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, moveX: 1, rollPressed: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );
    expect(state.player.action).toBe("roll");

    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, jumpPressed: true, jumpHeld: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );

    expect(state.player.action).toBe("normal");
    expect(state.player.grounded).toBe(false);
    expect(state.player.velocity.y).toBeCloseTo(
      -PLAYER_CONFIG.jumpSpeed + PLAYER_CONFIG.gravity * FIXED_STEP_SECONDS,
    );
    expect(Math.abs(state.player.velocity.x)).toBeLessThanOrEqual(
      PLAYER_CONFIG.maxSpeed,
    );
  });

  it("cancels an attack into a roll", () => {
    let state = stepMany(flatWorld, 40);
    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, attackPressed: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );
    expect(state.player.action).toBe("attack");

    state.player.attackHitIds = ["previous-target"];
    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, rollPressed: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );

    expect(state.player.action).toBe("roll");
    expect(state.player.actionTime).toBe(0);
    expect(state.player.attackHitIds).toEqual([]);
    expect(damagePlayer(state, -1)).toBe(false);
  });

  it("uses 0.8 second attack and 0.5 second roll cooldowns", () => {
    expect(PLAYER_CONFIG.attackSeconds).toBe(0.3);
    expect(PLAYER_CONFIG.attackCooldownSeconds).toBe(0.8);
    expect(PLAYER_CONFIG.rollCooldownSeconds).toBe(0.5);

    let state = stepMany(flatWorld, 40);
    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, moveX: 1, rollPressed: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );
    expect(state.player.rollCooldown).toBe(0.5);

    for (
      let index = 0;
      index < Math.ceil(0.5 / FIXED_STEP_SECONDS);
      index += 1
    ) {
      state = stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, flatWorld);
    }
    expect(state.player.rollCooldown).toBeCloseTo(0, 8);

    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, attackPressed: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );
    expect(state.player.attackCooldown).toBe(0.8);
    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, rollPressed: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );
    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, attackPressed: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );
    expect(state.player.action).toBe("roll");
  });

  it("cancels a roll into an attack and removes roll invulnerability", () => {
    let state = stepMany(flatWorld, 40);
    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, moveX: 1, rollPressed: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );
    expect(state.player.action).toBe("roll");
    expect(damagePlayer(state, -1)).toBe(false);

    state.player.attackHitIds = ["previous-target"];
    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, attackPressed: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );

    expect(state.player.action).toBe("attack");
    expect(state.player.actionTime).toBe(0);
    expect(state.player.attackHitIds).toEqual([]);
    expect(damagePlayer(state, -1)).toBe(true);
    expect(state.player.action).toBe("hurt");
  });

  it("emits a small player hit sound and wave only on successful damage", () => {
    const state = createInitialGameState(flatWorld);

    expect(damagePlayer(state, -1)).toBe(true);
    const hitWave = state.soundWaves.find((wave) => wave.kind === "player-hit");
    expect(hitWave?.rays[0]).toMatchObject({
      remainingDistance: PLAYER_HIT_WAVE_CONFIG.distance,
      intensity: PLAYER_HIT_WAVE_CONFIG.intensity,
    });
    expect(state.events).toContainEqual(expect.objectContaining({
      type: "sound",
      kind: "player-hit",
      intensity: PLAYER_HIT_WAVE_CONFIG.intensity,
    }));

    expect(damagePlayer(state, 1)).toBe(false);
    expect(state.soundWaves.filter((wave) => wave.kind === "player-hit"))
      .toHaveLength(1);
  });

  it("cancels an attack into a grounded jump", () => {
    let state = stepMany(flatWorld, 40);
    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, attackPressed: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );
    state.player.attackHitIds = ["previous-target"];

    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, jumpPressed: true, jumpHeld: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );

    expect(state.player.action).toBe("normal");
    expect(state.player.actionTime).toBe(0);
    expect(state.player.attackHitIds).toEqual([]);
    expect(state.player.grounded).toBe(false);
    expect(state.player.velocity.y).toBeCloseTo(
      -PLAYER_CONFIG.jumpSpeed + PLAYER_CONFIG.gravity * FIXED_STEP_SECONDS,
    );
  });

  it("cycles ground attacks and keeps air attacks separate", () => {
    let state = stepMany(flatWorld, 40);

    for (const expectedVariant of [0, 1, 2, 0] as const) {
      state = stepSimulation(
        state,
        { ...EMPTY_INPUT, attackPressed: true },
        FIXED_STEP_SECONDS,
        flatWorld,
      );
      expect(state.player.action).toBe("attack");
      expect(state.player.attackAirborne).toBe(false);
      expect(state.player.attackVariant).toBe(expectedVariant);

      for (
        let index = 0;
        index < Math.ceil(
          PLAYER_CONFIG.attackCooldownSeconds / FIXED_STEP_SECONDS,
        );
        index += 1
      ) {
        state = stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, flatWorld);
      }
      expect(state.player.action).toBe("normal");
    }

    const nextGroundVariant = state.player.nextGroundAttackVariant;
    state.player.grounded = false;
    state.player.velocity.y = 400;
    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, attackPressed: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );
    expect(state.player.attackAirborne).toBe(true);
    expect(state.player.nextGroundAttackVariant).toBe(nextGroundVariant);
  });

  it("selects dedicated animations for each player motion", () => {
    const player = createInitialGameState(flatWorld).player;
    player.grounded = true;
    player.velocity = { x: 0, y: 0 };
    expect(resolvePlayerAnimationKey(player)).toBe(ANIMATION_KEYS.player.idle);

    player.velocity.x = 200;
    expect(resolvePlayerAnimationKey(player)).toBe(ANIMATION_KEYS.player.run);

    player.action = "roll";
    expect(resolvePlayerAnimationKey(player)).toBe(ANIMATION_KEYS.player.dash);

    player.action = "attack";
    player.attackAirborne = false;
    for (const variant of [0, 1, 2] as const) {
      player.attackVariant = variant;
      expect(resolvePlayerAnimationKey(player)).toBe(
        [
          ANIMATION_KEYS.player.attack1,
          ANIMATION_KEYS.player.attack2,
          ANIMATION_KEYS.player.attack3,
        ][variant],
      );
    }

    player.attackAirborne = true;
    expect(resolvePlayerAnimationKey(player)).toBe(
      ANIMATION_KEYS.player.airAttack,
    );

    player.action = "normal";
    player.grounded = false;
    for (const [velocityY, expected] of [
      [-1300, ANIMATION_KEYS.player.jumpStart],
      [-600, ANIMATION_KEYS.player.jump],
      [0, ANIMATION_KEYS.player.jumpTransition],
      [600, ANIMATION_KEYS.player.jumpFall],
    ] as const) {
      player.velocity.y = velocityY;
      expect(resolvePlayerAnimationKey(player)).toBe(expected);
    }

    player.action = "hurt";
    expect(resolvePlayerAnimationKey(player)).toBe(ANIMATION_KEYS.player.hurt);
    player.action = "dead";
    expect(resolvePlayerAnimationKey(player)).toBe(ANIMATION_KEYS.player.death);
  });

  it("keeps the attack hitbox facing its starting direction", () => {
    let state = stepMany(flatWorld, 40);
    state.player.facing = 1;
    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, attackPressed: true },
      FIXED_STEP_SECONDS,
      flatWorld,
    );

    expect(state.player.action).toBe("attack");
    expect(state.player.attackFacing).toBe(1);

    state = stepSimulation(
      state,
      { ...EMPTY_INPUT, moveX: -1 },
      FIXED_STEP_SECONDS,
      flatWorld,
    );

    expect(state.player.facing).toBe(-1);
    expect(state.player.attackFacing).toBe(1);
    expect(getPlayerAttackBounds(state.player).x).toBe(
      state.player.position.x + PLAYER_CONFIG.width / 2,
    );
  });

  it("uses an 80%-length attack hitbox with half the former active time", () => {
    const state = createInitialGameState(flatWorld);
    state.player.position = { x: 200, y: 400 };
    state.player.attackFacing = 1;

    expect(PLAYER_SPRITE_DISPLAY_SCALE).toBe(3);
    expect(PLAYER_GROUND_ATTACK_HITBOX).toEqual({
      width: 92,
      height: 120,
      verticalOffset: 0,
    });
    expect(getPlayerAttackBounds(state.player)).toEqual({
      x: 216,
      y: 340,
      width: 92,
      height: 120,
    });

    state.player.attackFacing = -1;
    expect(getPlayerAttackBounds(state.player).x).toBe(92);

    state.player.attackAirborne = true;
    expect(PLAYER_AIR_ATTACK_HITBOX).toEqual({
      width: 92,
      height: 140,
      verticalOffset: -8,
    });
    expect(getPlayerAttackBounds(state.player)).toEqual({
      x: 92,
      y: 322,
      width: 92,
      height: 140,
    });
    expect(
      PLAYER_CONFIG.attackActiveEnd - PLAYER_CONFIG.attackActiveStart,
    ).toBeCloseTo(0.05);
  });

  it("does not keep moving after death", () => {
    const state = createInitialGameState(flatWorld);
    state.player.position = { x: 360, y: flatWorldGroundedPlayerY };
    state.player.velocity = { x: 640, y: -240 };
    state.player.grounded = true;
    state.player.action = "dead";
    state.player.health = 0;
    const deathPosition = { ...state.player.position };

    stepSimulation(
      state,
      { ...EMPTY_INPUT, moveX: 1 },
      FIXED_STEP_SECONDS,
      flatWorld,
    );

    expect(state.player.position).toEqual(deathPosition);
    expect(state.player.velocity).toEqual({ x: 0, y: 0 });
  });
});

describe("sound propagation", () => {
  it("keeps reflecting without a bounce cap until distance attenuation removes it", () => {
    const corridor: WorldDefinition = {
      width: 220,
      height: 200,
      playerSpawn: { x: 100, y: 100 },
      terrain: [
        { id: "left", bounds: { x: -20, y: 0, width: 20, height: 200 } },
        { id: "right", bounds: { x: 200, y: 0, width: 20, height: 200 } },
      ],
      enemies: [],
    };
    const state = createInitialGameState(corridor);
    emitSound(state, "player-step", { x: 100, y: 100 }, 10_000, 1);
    const trackedRay = state.soundWaves[0].rays[0];
    for (const ray of state.soundWaves[0].rays.slice(1)) {
      ray.active = false;
    }

    for (let index = 0; index < 240 && trackedRay.active; index += 1) {
      updateSoundPropagation(state, corridor, FIXED_STEP_SECONDS);
    }

    expect(trackedRay.reflectionCount).toBeGreaterThan(3);
    expect(trackedRay.active).toBe(false);
    expect(trackedRay.remainingDistance).toBeLessThan(60);
  });

  it("temporarily reveals an enemy crossed by a wave", () => {
    const enemyWorld: WorldDefinition = {
      ...flatWorld,
      enemies: [
        {
          id: "target",
          position: { x: 360, y: 600 },
          patrolMinX: 360,
          patrolMaxX: 360,
        },
      ],
    };
    const state = createInitialGameState(enemyWorld);
    emitSound(state, "player-step", { x: 200, y: 600 }, 400, 1);

    for (let index = 0; index < 20; index += 1) {
      updateSoundPropagation(state, enemyWorld, FIXED_STEP_SECONDS);
    }

    expect(state.enemies[0].echoTime).toBeGreaterThan(0);
  });

  it("keeps a corpse and lets later sound waves reveal it again", () => {
    const corpseWorld: WorldDefinition = {
      ...flatWorld,
      enemies: [
        {
          id: "corpse-target",
          position: { x: 360, y: 652 },
          patrolMinX: 360,
          patrolMaxX: 360,
          health: 1,
        },
      ],
    };
    const state = createInitialGameState(corpseWorld);
    const corpse = state.enemies[0];
    corpse.grounded = true;
    corpse.facing = 1;
    damageEnemy(state, corpse, 1);

    expect(state.enemies).toHaveLength(1);
    expect(corpse.alive).toBe(false);
    expect(corpse.action).toBe("dead");

    for (let index = 0; index < 10; index += 1) {
      updateEnemies(state, corpseWorld, FIXED_STEP_SECONDS);
    }
    expect(corpse.actionTime).toBeCloseTo(FIXED_STEP_SECONDS * 10);
    expect(state.enemies).toContain(corpse);

    state.soundWaves = [];
    corpse.echoTime = 0;
    emitSound(
      state,
      "player-step",
      { x: 200, y: 680 },
      400,
      1,
      PLAYER_SOUND_SOURCE_ID,
    );
    for (let index = 0; index < 20; index += 1) {
      updateSoundPropagation(state, corpseWorld, FIXED_STEP_SECONDS);
    }

    expect(corpse.echoTime).toBeGreaterThan(0);
    expect(corpse.alive).toBe(false);
    expect(corpse.facing).toBe(1);

    state.soundWaves = [];
    for (let index = 0; index < 120; index += 1) {
      updateSoundPropagation(state, corpseWorld, FIXED_STEP_SECONDS);
    }
    expect(corpse.echoTime).toBe(0);
    expect(state.enemies).toContain(corpse);
  });

  it("moves an enemy toward the side a player wave arrived from", () => {
    const enemyWorld: WorldDefinition = {
      ...flatWorld,
      enemies: [
        {
          id: "listener",
          position: { x: 500, y: 652 },
          patrolMinX: 300,
          patrolMaxX: 700,
        },
      ],
    };
    const state = createInitialGameState(enemyWorld);
    const enemy = state.enemies[0];
    enemy.facing = 1;
    enemy.grounded = true;
    emitSound(
      state,
      "player-step",
      { x: 200, y: 652 },
      480,
      1,
      PLAYER_SOUND_SOURCE_ID,
    );

    for (let index = 0; index < 35; index += 1) {
      updateSoundPropagation(state, enemyWorld, FIXED_STEP_SECONDS);
    }

    expect(enemy.facing).toBe(-1);
    const positionBeforeMovement = enemy.position.x;
    stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, enemyWorld);
    expect(enemy.position.x).toBeLessThan(positionBeforeMovement);
  });

  it("adds collision rays as the expanding wavefront spacing grows", () => {
    const openWorld: WorldDefinition = {
      width: 4_000,
      height: 4_000,
      playerSpawn: { x: 2_000, y: 2_000 },
      terrain: [],
      enemies: [],
    };
    const state = createInitialGameState(openWorld);
    emitSound(state, "player-step", openWorld.playerSpawn, 1600, 1);
    const initialRayCount = state.soundWaves[0].rays.length;

    for (let index = 0; index < 90; index += 1) {
      updateSoundPropagation(state, openWorld, FIXED_STEP_SECONDS);
    }

    const rays = state.soundWaves[0].rays;
    const maximumSpacing = rays.reduce((maximum, ray, index) => {
      const next = rays[(index + 1) % rays.length];
      return Math.max(
        maximum,
        Math.hypot(
          next.position.x - ray.position.x,
          next.position.y - ray.position.y,
        ),
      );
    }, 0);

    expect(rays.length).toBeGreaterThan(initialRayCount);
    expect(maximumSpacing).toBeLessThanOrEqual(48);
  });

  it("clips corner echo marks to the terrain face bounds", () => {
    const block = {
      id: "corner",
      bounds: { x: 200, y: 200, width: 40, height: 40 },
    };
    const horizontal = createEchoMark(
      block,
      { x: 200, y: 200 },
      { x: 0, y: -1 },
      1,
    );
    const vertical = createEchoMark(
      block,
      { x: 200, y: 200 },
      { x: -1, y: 0 },
      1,
    );

    expect(horizontal.start).toEqual({ x: 200, y: 200 });
    expect(horizontal.end).toEqual({ x: 240, y: 200 });
    expect(horizontal.surfaceKind).toBe("terrain");
    expect(vertical.start).toEqual({ x: 200, y: 200 });
    expect(vertical.end).toEqual({ x: 200, y: 240 });
  });

  it("removes echo mark sections covered by adjacent terrain", () => {
    const wall = {
      id: "wall",
      bounds: { x: 200, y: 200, width: 40, height: 120 },
    };
    const floor = {
      id: "floor",
      bounds: { x: 200, y: 280, width: 100, height: 40 },
    };

    const verticalMarks = createExposedEchoMarks(
      wall,
      [wall, floor],
      { x: 240, y: 270 },
      { x: 1, y: 0 },
      1,
    );
    const horizontalMarks = createExposedEchoMarks(
      floor,
      [wall, floor],
      { x: 250, y: 280 },
      { x: 0, y: -1 },
      1,
    );

    expect(verticalMarks).toHaveLength(1);
    expect(verticalMarks[0].start).toEqual({ x: 240, y: 222 });
    expect(verticalMarks[0].end).toEqual({ x: 240, y: 280 });
    expect(horizontalMarks).toHaveLength(1);
    expect(horizontalMarks[0].start).toEqual({ x: 240, y: 280 });
    expect(horizontalMarks[0].end).toEqual({ x: 298, y: 280 });
  });
});

describe("combat loop", () => {
  const enemyAttackWorld: WorldDefinition = {
    ...flatWorld,
    enemies: [
      {
        id: "attacker",
        position: { x: 300, y: 652 },
        patrolMinX: 300,
        patrolMaxX: 300,
      },
    ],
  };

  function createOverlappingEnemyAttackState() {
    const state = createInitialGameState(enemyAttackWorld);
    state.player.position = { x: 200, y: flatWorldGroundedPlayerY };
    state.player.grounded = true;
    state.enemies[0].grounded = true;
    return state;
  }

  function advanceEnemyAlert(state: ReturnType<typeof createInitialGameState>) {
    const stepsBeforeAttack =
      Math.ceil(ENEMY_CONFIG.alertSeconds / FIXED_STEP_SECONDS) - 1;
    for (let index = 0; index < stepsBeforeAttack; index += 1) {
      stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, enemyAttackWorld);
    }
  }

  it("emits a small red warning wave and attacks after 0.4 seconds", () => {
    const state = createOverlappingEnemyAttackState();

    stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, enemyAttackWorld);

    expect(state.enemies[0].action).toBe("alert");
    expect(state.player.health).toBe(PLAYER_CONFIG.maxHealth);
    const warningWave = state.soundWaves.find(
      (wave) => wave.kind === "enemy-alert",
    );
    expect(warningWave).toBeDefined();
    expect(
      Math.max(...warningWave!.rays.map((ray) => ray.remainingDistance)),
    ).toBeLessThan(ENEMY_CONFIG.alertWaveDistance);
    expect(
      Math.max(...warningWave!.rays.map((ray) => ray.intensity)),
    ).toBeCloseTo(ENEMY_CONFIG.alertWaveIntensity);

    advanceEnemyAlert(state);
    expect(state.enemies[0].action).toBe("alert");
    expect(state.player.health).toBe(PLAYER_CONFIG.maxHealth);

    stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, enemyAttackWorld);
    expect(state.enemies[0].action).toBe("attack");
    expect(state.player.health).toBe(PLAYER_CONFIG.maxHealth - 1);
    expect(state.player.action).toBe("hurt");
    const attackWave = state.soundWaves.find(
      (wave) => wave.kind === "enemy-attack",
    );
    expect(attackWave).toBeDefined();
    expect(
      Math.max(...attackWave!.rays.map((ray) => ray.remainingDistance)),
    ).toBeLessThanOrEqual(MELEE_ATTACK_WAVE_CONFIG.distance);
    expect(
      Math.max(...attackWave!.rays.map((ray) => ray.remainingDistance)),
    ).toBeGreaterThan(MELEE_ATTACK_WAVE_CONFIG.distance - 20);
    expect(
      Math.max(...attackWave!.rays.map((ray) => ray.intensity)),
    ).toBeCloseTo(MELEE_ATTACK_WAVE_CONFIG.intensity);
  });

  it("only starts an enemy attack while the stationary player is inside its hitbox", () => {
    const outsideState = createOverlappingEnemyAttackState();
    outsideState.player.position.x =
      outsideState.enemies[0].position.x - ENEMY_CONFIG.attackRangeX - 1;

    stepSimulation(
      outsideState,
      EMPTY_INPUT,
      FIXED_STEP_SECONDS,
      enemyAttackWorld,
    );

    expect(outsideState.enemies[0].action).toBe("patrol");

    const insideState = createOverlappingEnemyAttackState();
    insideState.player.position.x =
      insideState.enemies[0].position.x - ENEMY_CONFIG.attackRangeX;

    stepSimulation(
      insideState,
      EMPTY_INPUT,
      FIXED_STEP_SECONDS,
      enemyAttackWorld,
    );
    expect(insideState.enemies[0].action).toBe("alert");

    advanceEnemyAlert(insideState);
    stepSimulation(
      insideState,
      EMPTY_INPUT,
      FIXED_STEP_SECONDS,
      enemyAttackWorld,
    );

    expect(insideState.player.health).toBe(PLAYER_CONFIG.maxHealth - 1);
  });

  it("keeps the enemy attack hitbox facing its detection direction", () => {
    const state = createOverlappingEnemyAttackState();

    stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, enemyAttackWorld);

    const enemy = state.enemies[0];
    expect(enemy.action).toBe("alert");
    expect(enemy.attackFacing).toBe(-1);
    const lockedAttackBounds = getEnemyAttackBounds(enemy);

    enemy.facing = 1;
    advanceEnemyAlert(state);
    stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, enemyAttackWorld);

    expect(enemy.action).toBe("attack");
    expect(enemy.facing).toBe(1);
    expect(enemy.attackFacing).toBe(-1);
    expect(getEnemyAttackBounds(enemy)).toEqual(lockedAttackBounds);
    expect(state.player.health).toBe(PLAYER_CONFIG.maxHealth - 1);
  });

  it("blocks overlapping enemy attacks during invulnerability", () => {
    const state = createOverlappingEnemyAttackState();
    state.player.invulnerabilityTime = 0.5;

    stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, enemyAttackWorld);

    expect(state.player.health).toBe(PLAYER_CONFIG.maxHealth);
    expect(state.enemies[0].action).toBe("alert");

    advanceEnemyAlert(state);
    stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, enemyAttackWorld);
    expect(state.player.health).toBe(PLAYER_CONFIG.maxHealth);
    expect(state.enemies[0].action).toBe("attack");

    state.player.invulnerabilityTime = 0;
    stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, enemyAttackWorld);

    expect(state.player.health).toBe(PLAYER_CONFIG.maxHealth - 1);
  });

  it("damages the player on contact with a living enemy body", () => {
    const state = createInitialGameState(enemyAttackWorld);
    state.player.position = { ...state.enemies[0].position };

    stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, enemyAttackWorld);

    expect(state.player.health).toBe(PLAYER_CONFIG.maxHealth - 1);
    expect(state.player.action).toBe("hurt");
    expect(state.player.velocity.x).toBe(-660);

    updateEnemyContactDamage(state);
    expect(state.player.health).toBe(PLAYER_CONFIG.maxHealth - 1);
  });

  it("ignores enemy body contact while rolling and after the enemy dies", () => {
    const rollingState = createInitialGameState(enemyAttackWorld);
    rollingState.player.position = { ...rollingState.enemies[0].position };
    rollingState.player.action = "roll";

    updateEnemyContactDamage(rollingState);
    expect(rollingState.player.health).toBe(PLAYER_CONFIG.maxHealth);

    const corpseState = createInitialGameState(enemyAttackWorld);
    corpseState.player.position = { ...corpseState.enemies[0].position };
    corpseState.enemies[0].alive = false;
    corpseState.enemies[0].action = "dead";

    updateEnemyContactDamage(corpseState);
    expect(corpseState.player.health).toBe(PLAYER_CONFIG.maxHealth);
  });

  it("keeps an enemy hit wave only slightly larger than a melee attack wave", () => {
    const state = createInitialGameState(enemyAttackWorld);

    damageEnemy(state, state.enemies[0], 1);

    const hitWave = state.soundWaves.find((wave) => wave.kind === "enemy-hit");
    expect(hitWave).toBeDefined();
    expect(
      Math.max(...hitWave!.rays.map((ray) => ray.remainingDistance)),
    ).toBe(ENEMY_HIT_WAVE_CONFIG.distance);
    expect(ENEMY_HIT_WAVE_CONFIG.distance).toBeGreaterThan(
      MELEE_ATTACK_WAVE_CONFIG.distance,
    );
    expect(
      ENEMY_HIT_WAVE_CONFIG.distance - MELEE_ATTACK_WAVE_CONFIG.distance,
    ).toBe(20);
  });

  it("keeps an enemy death wave only slightly larger than its hit wave", () => {
    const state = createInitialGameState(enemyAttackWorld);
    state.enemies[0].health = 1;

    damageEnemy(state, state.enemies[0], 1);

    const deathWave = state.soundWaves.find((wave) => wave.kind === "enemy-death");
    expect(deathWave).toBeDefined();
    expect(
      Math.max(...deathWave!.rays.map((ray) => ray.remainingDistance)),
    ).toBe(ENEMY_DEATH_WAVE_CONFIG.distance);
    expect(ENEMY_DEATH_WAVE_CONFIG.distance).toBeGreaterThan(
      ENEMY_HIT_WAVE_CONFIG.distance,
    );
    expect(
      ENEMY_DEATH_WAVE_CONFIG.distance - ENEMY_HIT_WAVE_CONFIG.distance,
    ).toBe(20);
  });

  it("damages and defeats an enemy with the active attack hitbox", () => {
    const combatWorld: WorldDefinition = {
      ...flatWorld,
      enemies: [
        {
          id: "target",
          position: { x: 300, y: 652 },
          patrolMinX: 300,
          patrolMaxX: 300,
        },
      ],
    };
    let state = createInitialGameState(combatWorld);
    state.player.position = { x: 200, y: flatWorldGroundedPlayerY };
    state.player.grounded = true;
    state.enemies[0].health = 1;
    state.enemies[0].grounded = true;
    state.enemies[0].attackCooldown = Number.POSITIVE_INFINITY;
    let sawPlayerAttackWave = false;
    let sawEnemyDeathWave = false;

    for (let index = 0; index < 24; index += 1) {
      state = stepSimulation(
        state,
        index === 0
          ? { ...EMPTY_INPUT, attackPressed: true }
          : EMPTY_INPUT,
        FIXED_STEP_SECONDS,
        combatWorld,
      );
      sawPlayerAttackWave ||= state.soundWaves.some(
        (wave) => wave.kind === "player-attack",
      );
      sawEnemyDeathWave ||= state.soundWaves.some(
        (wave) => wave.kind === "enemy-death",
      );
    }

    expect(state.enemies[0].alive).toBe(false);
    expect(state.player.action).not.toBe("dead");
    expect(sawPlayerAttackWave).toBe(true);
    expect(sawEnemyDeathWave).toBe(true);
    expect(state.soundWaves.some((wave) => wave.kind === "enemy-hit")).toBe(false);
  });

  it("keeps terrain attack impacts without emitting an attack wave", () => {
    const state = createInitialGameState(flatWorld);
    state.player.position = { x: 200, y: flatWorldGroundedPlayerY };
    state.player.grounded = true;
    state.player.action = "attack";
    state.player.actionTime = PLAYER_CONFIG.attackActiveStart;

    updatePlayerCombat(state, flatWorld);

    expect(state.player.attackHitIds).toContain("terrain:floor");
    expect(state.events.some((event) => event.type === "impact")).toBe(true);
    expect(state.soundWaves.some((wave) => wave.kind === "enemy-hit")).toBe(false);
    expect(state.soundWaves.some((wave) => wave.kind === "enemy-death")).toBe(false);
  });

  it("keeps every enemy kind unaffected by hazards", () => {
    const enemyKinds = Object.values(ENEMY_KINDS);
    const hazardWorld: WorldDefinition = {
      ...flatWorld,
      enemies: enemyKinds.map((kind, index) => ({
        id: `hazard-target-${kind}`,
        kind,
        position: { x: 400 + index, y: 652 },
        patrolMinX: 400 + index,
        patrolMaxX: 400 + index,
        health: 2,
      })),
      hazards: [
        {
          id: "test-hazard",
          bounds: { x: 360, y: 560, width: 80, height: 140 },
        },
      ],
    };
    const state = createInitialGameState(hazardWorld);

    updateWorldEnvironment(state, hazardWorld, FIXED_STEP_SECONDS);

    expect(state.enemies.map((enemy) => enemy.health)).toEqual(
      enemyKinds.map(() => 2),
    );
    expect(state.enemies.every((enemy) => enemy.alive)).toBe(true);
    expect(state.events).toEqual([]);
  });
});

describe("tutorial stage", () => {
  it("uses key-only prompts and half-distance environmental waves", () => {
    expect(
      TUTORIAL_STAGE.tutorialSections?.map((section) => section.prompt),
    ).toEqual(["A / D", "Space", "Shift", "J", ""]);
    expect(
      TUTORIAL_STAGE.soundEmitters?.map((emitter) => emitter.maximumDistance),
    ).toEqual([430, 500, 390]);
    expect(TUTORIAL_STAGE.hazards?.[0].bounds.height).toBe(320);

    const jumpPlatform = TUTORIAL_STAGE.terrain.find(
      (block) => block.id === "jump-platform",
    );
    const rightHill = TUTORIAL_STAGE.terrain.find(
      (block) => block.id === "jump-right-hill",
    );
    expect(rightHill?.bounds.y).toBe(jumpPlatform?.bounds.y);
    expect(
      TUTORIAL_STAGE.terrain
        .filter((block) => block.id.startsWith("jump-recovery-"))
        .map((block) => block.bounds.y),
    ).toEqual([1200]);
    expect(
      TUTORIAL_STAGE.terrain.some((block) => block.id === "combat-ceiling"),
    ).toBe(false);
    expect(
      TUTORIAL_STAGE.terrain.some((block) => block.id === "jump-pit-floor"),
    ).toBe(false);
    const movementFloor = TUTORIAL_STAGE.terrain.find(
      (block) => block.id === "movement-floor",
    );
    expect(
      (movementFloor?.bounds.x ?? 0) + (movementFloor?.bounds.width ?? 0),
    ).toBe(rightHill?.bounds.x);
  });

  it("advances the guidance as the player reaches each lesson", () => {
    const state = createInitialGameState(TUTORIAL_STAGE);
    expect(TUTORIAL_STAGE.tutorialSections?.[state.tutorialStep].id).toBe(
      "move",
    );

    state.player.position.x = 1000;
    stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, TUTORIAL_STAGE);
    expect(TUTORIAL_STAGE.tutorialSections?.[state.tutorialStep].id).toBe(
      "jump",
    );

    state.player.position.x = 2600;
    stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, TUTORIAL_STAGE);
    expect(TUTORIAL_STAGE.tutorialSections?.[state.tutorialStep].id).toBe(
      "roll",
    );

    state.player.position.x = 3400;
    stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, TUTORIAL_STAGE);
    expect(TUTORIAL_STAGE.tutorialSections?.[state.tutorialStep].id).toBe(
      "attack",
    );

    state.player.position.x = 4200;
    stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, TUTORIAL_STAGE);
    expect(TUTORIAL_STAGE.tutorialSections?.[state.tutorialStep].id).toBe(
      "attack",
    );

    const lessonEnemy = state.enemies.find(
      (enemy) => enemy.id === "lesson-sentinel",
    );
    expect(lessonEnemy).toBeDefined();
    lessonEnemy!.alive = false;
    stepSimulation(state, EMPTY_INPUT, FIXED_STEP_SECONDS, TUTORIAL_STAGE);
    expect(TUTORIAL_STAGE.tutorialSections?.[state.tutorialStep].id).toBe(
      "trial",
    );
  });

  it("keeps the resonance crusher harmful while emitting red hazard waves", () => {
    const state = createInitialGameState(TUTORIAL_STAGE);
    const crusher = TUTORIAL_STAGE.hazards?.[0];
    expect(crusher).toBeDefined();
    state.player.position = {
      x: crusher!.bounds.x + crusher!.bounds.width / 2,
      y: 1248,
    };
    state.player.grounded = true;

    stepSimulation(state, EMPTY_INPUT, 0.11, TUTORIAL_STAGE);

    expect(state.player.health).toBe(PLAYER_CONFIG.maxHealth - 1);
    expect(state.player.action).toBe("hurt");
    expect(state.soundWaves.some((wave) => wave.kind === "crusher-pulse")).toBe(true);
    expect(state.hazards[0].echoTime).toBeGreaterThan(0);
    expect(state.hazards[0].reactionTime).toBeGreaterThan(0);
    expect(state.hazards[0].reactionDuration).toBeGreaterThan(0);
    expect(state.hazards[0].reactionSide).toBe(1);
    expect(state.hazards[0].reactionOffsetY).toBe(
      state.player.position.y - crusher!.bounds.y,
    );
  });

  it("does not play damage feedback for a periodic hazard wave alone", () => {
    const state = createInitialGameState(TUTORIAL_STAGE);
    state.player.position = { x: 2800, y: 1140 };
    stepSimulation(state, EMPTY_INPUT, 0.11, TUTORIAL_STAGE);

    expect(state.soundWaves.some((wave) => wave.kind === "crusher-pulse")).toBe(true);
    expect(state.hazards[0].echoTime).toBeGreaterThan(0);
    expect(state.hazards[0].reactionTime).toBe(0);
  });

  it("rejects non-rolling movement even during damage invulnerability", () => {
    const state = createInitialGameState(TUTORIAL_STAGE);
    const crusher = TUTORIAL_STAGE.hazards?.[0];
    expect(crusher).toBeDefined();
    state.player.position = {
      x: crusher!.bounds.x - PLAYER_CONFIG.width / 2,
      y: 1248,
    };
    state.player.grounded = true;
    state.player.invulnerabilityTime = 0.5;

    stepSimulation(
      state,
      { ...EMPTY_INPUT, moveX: 1 },
      FIXED_STEP_SECONDS,
      TUTORIAL_STAGE,
    );

    const rejectedBounds = getPlayerBounds(state.player);
    expect(rejectedBounds.x + rejectedBounds.width).toBe(crusher!.bounds.x);
    expect(state.player.velocity.x).toBeLessThan(0);
    expect(state.player.health).toBe(PLAYER_CONFIG.maxHealth);
    expect(state.hazards[0].reactionTime).toBe(0);
  });

  it("allows a full roll to cross the resonance crusher without damage", () => {
    const state = createInitialGameState(TUTORIAL_STAGE);
    const crusher = TUTORIAL_STAGE.hazards?.[0];
    expect(crusher).toBeDefined();
    state.player.position = { x: crusher!.bounds.x - 36, y: 1248 };
    state.player.grounded = true;
    const initialHealth = state.player.health;

    for (let index = 0; index < 34; index += 1) {
      stepSimulation(
        state,
        index === 0
          ? { ...EMPTY_INPUT, moveX: 1, rollPressed: true }
          : { ...EMPTY_INPUT, moveX: 1 },
        FIXED_STEP_SECONDS,
        TUTORIAL_STAGE,
      );
    }

    expect(state.player.position.x).toBeGreaterThan(
      crusher!.bounds.x + crusher!.bounds.width + PLAYER_CONFIG.width / 2,
    );
    expect(state.player.health).toBe(initialHealth);
    expect(state.hazards[0].reactionTime).toBe(0);
  });
});
