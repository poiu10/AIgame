import type { WorldDefinition } from "../../content/world";
import type { InputActions } from "../../input/actions";
import type {
  GameState,
  GroundAttackVariant,
  PlayerState,
  SoundKind,
  Vector2State,
} from "../state";
import { moveBodyAgainstTerrain } from "../collision/motion";
import { MELEE_ATTACK_WAVE_CONFIG, PLAYER_CONFIG } from "../rules/config";

export interface SoundRequest {
  kind: SoundKind;
  position: Vector2State;
  distance: number;
  intensity: number;
  sourceId?: string;
}

function approach(value: number, target: number, amount: number): number {
  if (value < target) {
    return Math.min(value + amount, target);
  }
  return Math.max(value - amount, target);
}

function cancelPlayerAction(player: PlayerState): void {
  player.action = "normal";
  player.actionTime = 0;
  player.rollStartVelocityX = 0;
  player.attackHitIds = [];
}

function advanceGroundAttackVariant(
  variant: GroundAttackVariant,
): GroundAttackVariant {
  return ((variant + 1) % 3) as GroundAttackVariant;
}

function startPlayerAttack(player: PlayerState, input: InputActions): void {
  player.action = "attack";
  player.actionTime = 0;
  player.rollStartVelocityX = 0;
  player.attackFacing =
    Math.abs(input.moveX) > 0.01
      ? input.moveX < 0
        ? -1
        : 1
      : player.facing;
  player.attackAirborne = !player.grounded;
  if (!player.attackAirborne) {
    player.attackVariant = player.nextGroundAttackVariant;
    player.nextGroundAttackVariant = advanceGroundAttackVariant(
      player.nextGroundAttackVariant,
    );
  }
  player.attackHitIds = [];
  player.attackCooldown = PLAYER_CONFIG.attackCooldownSeconds;
}

function getActionHitboxOffset(
  player: PlayerState,
  input: InputActions,
): number {
  if (player.action === "attack") {
    return player.attackFacing * PLAYER_CONFIG.actionHitboxOffset;
  }
  if (player.action === "roll") {
    return player.facing * PLAYER_CONFIG.actionHitboxOffset;
  }
  if (player.action === "hurt" || player.action === "dead") {
    return 0;
  }
  if (Math.abs(input.moveX) > 0.01) {
    return (input.moveX < 0 ? -1 : 1) * PLAYER_CONFIG.actionHitboxOffset;
  }
  if (Math.abs(player.velocity.x) > 0.01) {
    return (player.velocity.x < 0 ? -1 : 1) * PLAYER_CONFIG.actionHitboxOffset;
  }
  return 0;
}

export function getLandingSoundProfile(fallHeight: number): {
  distance: number;
  intensity: number;
} {
  const safeFallHeight = Math.max(0, fallHeight);
  return {
    distance: Math.min(
      PLAYER_CONFIG.landingWaveMaximumDistance,
      PLAYER_CONFIG.landingWaveMinimumDistance +
        safeFallHeight * PLAYER_CONFIG.landingWaveDistancePerPixel,
    ),
    intensity: Math.min(
      1,
      PLAYER_CONFIG.landingWaveMinimumIntensity +
        safeFallHeight * PLAYER_CONFIG.landingWaveIntensityPerPixel,
    ),
  };
}

export function updatePlayerMovement(
  state: GameState,
  world: WorldDefinition,
  input: InputActions,
  deltaSeconds: number,
): SoundRequest[] {
  const player = state.player;
  const sounds: SoundRequest[] = [];
  let startedAttack = false;

  player.rollCooldown = Math.max(0, player.rollCooldown - deltaSeconds);
  player.attackCooldown = Math.max(0, player.attackCooldown - deltaSeconds);
  player.invulnerabilityTime = Math.max(
    0,
    player.invulnerabilityTime - deltaSeconds,
  );
  player.jumpBufferTime = Math.max(0, player.jumpBufferTime - deltaSeconds);

  if (input.jumpPressed) {
    player.jumpBufferTime = PLAYER_CONFIG.jumpBufferSeconds;
  }

  if (player.grounded) {
    player.coyoteTime = PLAYER_CONFIG.coyoteSeconds;
  } else {
    player.coyoteTime = Math.max(0, player.coyoteTime - deltaSeconds);
  }

  if (player.action === "dead") {
    player.actionTime += deltaSeconds;
    player.velocity.x = 0;
    player.velocity.y = 0;
    player.hitboxOffsetX = 0;
    return sounds;
  }

  if (player.action !== "normal") {
    const endingAction = player.action;
    player.actionTime += deltaSeconds;
    const duration =
      player.action === "roll"
        ? PLAYER_CONFIG.rollSeconds
        : player.action === "attack"
          ? PLAYER_CONFIG.attackSeconds
          : PLAYER_CONFIG.hurtSeconds;
    if (player.actionTime >= duration) {
      if (
        endingAction === "roll" &&
        input.moveX * player.facing <= 0.01
      ) {
        player.velocity.x = player.rollStartVelocityX;
      }
      player.action = "normal";
      player.actionTime = 0;
      player.rollStartVelocityX = 0;
      player.attackHitIds = [];
    }
  }

  if (
    player.action === "roll" &&
    input.attackPressed &&
    player.attackCooldown <= 0
  ) {
    startPlayerAttack(player, input);
    startedAttack = true;
  } else if (
    (player.action === "normal" || player.action === "attack") &&
    input.rollPressed &&
    player.rollCooldown <= 0
  ) {
    const startsOnGround = player.grounded;
    player.rollStartVelocityX = player.velocity.x;
    player.action = "roll";
    player.actionTime = 0;
    player.attackHitIds = [];
    player.rollCooldown = PLAYER_CONFIG.rollCooldownSeconds;
    if (startsOnGround) {
      player.velocity.y = -PLAYER_CONFIG.rollBounceSpeed;
      player.grounded = false;
    }
  } else if (
    player.action === "normal" &&
    input.attackPressed &&
    player.attackCooldown <= 0
  ) {
    startPlayerAttack(player, input);
    startedAttack = true;
  }

  if (startedAttack) {
    sounds.push({
      kind: "player-attack",
      position: { ...player.position },
      distance: MELEE_ATTACK_WAVE_CONFIG.distance,
      intensity: MELEE_ATTACK_WAVE_CONFIG.intensity,
    });
  }

  if (
    player.jumpBufferTime > 0 &&
    player.coyoteTime > 0 &&
    player.action !== "hurt"
  ) {
    if (player.action === "roll") {
      cancelPlayerAction(player);
      player.velocity.x = Math.max(
        -PLAYER_CONFIG.maxSpeed,
        Math.min(PLAYER_CONFIG.maxSpeed, player.velocity.x),
      );
    } else if (player.action === "attack") {
      cancelPlayerAction(player);
    }
    player.velocity.y = -PLAYER_CONFIG.jumpSpeed;
    player.grounded = false;
    player.coyoteTime = 0;
    player.jumpBufferTime = 0;
  }

  if (
    player.action !== "roll" &&
    !input.jumpHeld &&
    player.velocity.y < -PLAYER_CONFIG.jumpReleaseSpeed
  ) {
    player.velocity.y = Math.max(
      player.velocity.y,
      -PLAYER_CONFIG.jumpReleaseSpeed,
    );
  }

  if (player.action === "roll") {
    player.velocity.x = player.facing * PLAYER_CONFIG.rollSpeed;
  } else if (player.action === "hurt") {
    player.velocity.x = approach(player.velocity.x, 0, 1800 * deltaSeconds);
  } else {
    if (Math.abs(input.moveX) > 0.01) {
      player.facing = input.moveX < 0 ? -1 : 1;
      const control = player.grounded
        ? PLAYER_CONFIG.acceleration
        : PLAYER_CONFIG.airAcceleration;
      const attackScale = player.action === "attack" ? 0.45 : 1;
      player.velocity.x = approach(
        player.velocity.x,
        input.moveX * PLAYER_CONFIG.maxSpeed * attackScale,
        control * deltaSeconds,
      );
    } else if (player.grounded) {
      player.velocity.x = approach(
        player.velocity.x,
        0,
        PLAYER_CONFIG.groundDrag * deltaSeconds,
      );
    }
  }

  player.velocity.y = Math.min(
    player.velocity.y + PLAYER_CONFIG.gravity * deltaSeconds,
    PLAYER_CONFIG.maxFallSpeed,
  );
  const previousHitboxOffsetX = player.hitboxOffsetX;
  player.hitboxOffsetX = getActionHitboxOffset(player, input);
  const motion = moveBodyAgainstTerrain(
    player,
    PLAYER_CONFIG.width,
    PLAYER_CONFIG.height,
    world.terrain,
    deltaSeconds,
    {
      horizontalOffset: player.hitboxOffsetX,
      previousHorizontalOffset: previousHitboxOffsetX,
    },
  );

  if (
    motion.landed &&
    Math.abs(input.moveX) <= 0.01 &&
    player.action !== "roll" &&
    player.action !== "hurt"
  ) {
    player.velocity.x = 0;
  }

  if (motion.landed) {
    const fallHeight = Math.max(
      0,
      player.position.y - player.airborneApexY,
    );
    const landingSound = getLandingSoundProfile(fallHeight);
    sounds.push({
      kind: "landing",
      position: {
        x: player.position.x,
        y: player.position.y + PLAYER_CONFIG.height / 2 - 2,
      },
      distance: landingSound.distance,
      intensity: landingSound.intensity,
    });
    player.airborneApexY = player.position.y;
  } else if (player.grounded) {
    player.airborneApexY = player.position.y;
  } else {
    player.airborneApexY = Math.min(
      player.airborneApexY,
      player.position.y,
    );
  }

  if (player.grounded && player.action !== "roll") {
    player.footstepTravel += Math.abs(motion.movedX);
    if (player.footstepTravel >= PLAYER_CONFIG.footstepDistance) {
      player.footstepTravel %= PLAYER_CONFIG.footstepDistance;
      sounds.push({
        kind: "player-step",
        position: {
          x: player.position.x,
          y: player.position.y + PLAYER_CONFIG.height / 2 - 2,
        },
        distance: 280,
        intensity: 0.42,
      });
    }
  }

  return sounds;
}
