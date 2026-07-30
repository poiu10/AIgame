import { ANIMATION_KEYS } from "../../game/assets/manifest";
import type { PlayerState } from "../../game/simulation/state";

const GROUND_ATTACK_ANIMATIONS = [
  ANIMATION_KEYS.player.attack1,
  ANIMATION_KEYS.player.attack2,
  ANIMATION_KEYS.player.attack3,
] as const;

export function resolvePlayerAnimationKey(player: PlayerState): string {
  if (player.action === "dead") {
    return ANIMATION_KEYS.player.death;
  }
  if (player.action === "hurt") {
    return ANIMATION_KEYS.player.hurt;
  }
  if (player.action === "attack") {
    return player.attackAirborne
      ? ANIMATION_KEYS.player.airAttack
      : GROUND_ATTACK_ANIMATIONS[player.attackVariant];
  }
  if (player.action === "roll") {
    return ANIMATION_KEYS.player.dash;
  }
  if (!player.grounded) {
    if (player.velocity.y < -480) {
      return ANIMATION_KEYS.player.jumpStart;
    }
    if (player.velocity.y < -120) {
      return ANIMATION_KEYS.player.jump;
    }
    if (player.velocity.y <= 160) {
      return ANIMATION_KEYS.player.jumpTransition;
    }
    return ANIMATION_KEYS.player.jumpFall;
  }
  if (Math.abs(player.velocity.x) > 10) {
    return ANIMATION_KEYS.player.run;
  }
  return ANIMATION_KEYS.player.idle;
}
