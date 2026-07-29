import type { WorldDefinition } from "../../content/world";
import type { InputActions } from "../../input/actions";
import type { GameState, SoundKind, Vector2State } from "../state";
import { moveBodyAgainstTerrain } from "../collision/motion";
import { PLAYER_CONFIG } from "../rules/config";

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

export function updatePlayerMovement(
  state: GameState,
  world: WorldDefinition,
  input: InputActions,
  deltaSeconds: number,
): SoundRequest[] {
  const player = state.player;
  const sounds: SoundRequest[] = [];

  player.rollCooldown = Math.max(0, player.rollCooldown - deltaSeconds);
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
    player.velocity.x = 0;
    player.velocity.y = 0;
    return sounds;
  }

  if (player.action !== "normal") {
    player.actionTime += deltaSeconds;
    const duration =
      player.action === "roll"
        ? PLAYER_CONFIG.rollSeconds
        : player.action === "attack"
          ? PLAYER_CONFIG.attackSeconds
          : PLAYER_CONFIG.hurtSeconds;
    if (player.actionTime >= duration) {
      player.action = "normal";
      player.actionTime = 0;
      player.attackHitIds = [];
    }
  }

  if (
    player.action === "roll" &&
    player.jumpBufferTime > 0 &&
    player.coyoteTime > 0
  ) {
    player.action = "normal";
    player.actionTime = 0;
    player.velocity.x = Math.max(
      -PLAYER_CONFIG.maxSpeed,
      Math.min(PLAYER_CONFIG.maxSpeed, player.velocity.x),
    );
  }

  if (
    (player.action === "normal" || player.action === "attack") &&
    input.rollPressed &&
    player.rollCooldown <= 0
  ) {
    player.action = "roll";
    player.actionTime = 0;
    player.attackHitIds = [];
    player.rollCooldown = PLAYER_CONFIG.rollCooldownSeconds;
    player.invulnerabilityTime = Math.max(
      player.invulnerabilityTime,
      PLAYER_CONFIG.rollSeconds,
    );
  } else if (player.action === "normal" && input.attackPressed) {
    player.action = "attack";
    player.actionTime = 0;
    player.attackFacing =
      Math.abs(input.moveX) > 0.01
        ? input.moveX < 0
          ? -1
          : 1
        : player.facing;
    player.attackHitIds = [];
  }

  if (
    player.jumpBufferTime > 0 &&
    player.coyoteTime > 0 &&
    player.action !== "roll" &&
    player.action !== "hurt"
  ) {
    player.velocity.y = -PLAYER_CONFIG.jumpSpeed;
    player.grounded = false;
    player.coyoteTime = 0;
    player.jumpBufferTime = 0;
  }

  if (!input.jumpHeld && player.velocity.y < -220) {
    player.velocity.y = Math.max(player.velocity.y, -220);
  }

  if (player.action === "roll") {
    player.velocity.x = player.facing * PLAYER_CONFIG.rollSpeed;
  } else if (player.action === "hurt") {
    player.velocity.x = approach(player.velocity.x, 0, 900 * deltaSeconds);
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
  const motion = moveBodyAgainstTerrain(
    player,
    PLAYER_CONFIG.width,
    PLAYER_CONFIG.height,
    world.terrain,
    deltaSeconds,
  );

  if (motion.landed) {
    const strength = Math.min(1, 0.45 + motion.landingSpeed / 900);
    sounds.push({
      kind: "landing",
      position: {
        x: player.position.x,
        y: player.position.y + PLAYER_CONFIG.height / 2 - 1,
      },
      distance: 380 + strength * 240,
      intensity: strength,
    });
  }

  if (player.grounded && player.action !== "roll") {
    player.footstepTravel += Math.abs(motion.movedX);
    if (player.footstepTravel >= PLAYER_CONFIG.footstepDistance) {
      player.footstepTravel %= PLAYER_CONFIG.footstepDistance;
      sounds.push({
        kind: "terrain-step",
        position: {
          x: player.position.x,
          y: player.position.y + PLAYER_CONFIG.height / 2 - 1,
        },
        distance: 280,
        intensity: 0.42,
      });
    }
  }

  return sounds;
}
