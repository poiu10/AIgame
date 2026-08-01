export const FIXED_STEP_SECONDS = 1 / 120;

export const PLAYER_CONFIG = {
  width: 32,
  height: 84,
  actionHitboxOffset: 20,
  maxHealth: 4,
  acceleration: 3800,
  airAcceleration: 2100,
  maxSpeed: 500,
  groundDrag: 4200,
  gravity: 3500,
  maxFallSpeed: 1700,
  jumpSpeed: 1300,
  coyoteSeconds: 0.11,
  jumpBufferSeconds: 0.12,
  rollSpeed: 900,
  rollSeconds: 0.27,
  rollCooldownSeconds: 0.68,
  attackSeconds: 0.31,
  attackActiveStart: 0.08,
  attackActiveEnd: 0.18,
  hurtSeconds: 0.3,
  checkpointRestoreSeconds: 0.9,
  damageInvulnerabilitySeconds: 0.8,
  landingWaveMinimumDistance: 180,
  landingWaveDistancePerPixel: 1,
  landingWaveMaximumDistance: 840,
  landingWaveMinimumIntensity: 0.35,
  landingWaveIntensityPerPixel: 0.00125,
  footstepDistance: 184,
} as const;

export const ENEMY_CONFIG = {
  width: 68,
  height: 96,
  maxHealth: 3,
  patrolSpeed: 144,
  gravity: 3500,
  maxFallSpeed: 1700,
  attackRangeX: 136,
  attackRangeY: 86,
  alertSeconds: 0.4,
  alertWaveDistance: 240,
  alertWaveIntensity: 1,
  attackSeconds: 0.58,
  attackCooldownSeconds: 1.15,
  hurtSeconds: 0.24,
  deathAnimationSeconds: 0.54,
  deathRevealSeconds: 0.82,
  corpseEchoWidth: 96,
  corpseEchoHeight: 36,
  corpseEchoOffsetY: 30,
  footstepDistance: 128,
} as const;

export const STAGE_ONE_CONFIG = {
  sleeperPulseIntervalSeconds: 2.2,
  sleeperPulseDistance: 360,
  flyerSpeed: 190,
  wakerAcceleration: 700,
  wakerMaximumSpeed: 560,
  wakerPulseIntervalSeconds: 1.15,
  wakerPulseDistance: 440,
  growingHazardPulseIntervalSeconds: 1.35,
  growingHazardPulseDistance: 420,
} as const;

export function getEnemyBodySize(kind?: string): {
  width: number;
  height: number;
} {
  if (kind === "stage-sleeper") return { width: 72, height: 40 };
  if (kind === "stage-flyer") return { width: 66, height: 44 };
  if (kind === "stage-waker") return { width: 70, height: 52 };
  return { width: ENEMY_CONFIG.width, height: ENEMY_CONFIG.height };
}

export const HAZARD_CONFIG = {
  damageReactionSeconds: 0.32,
} as const;

export const SOUND_CONFIG = {
  speed: 1300,
  initialRayCount: 24,
  maximumRaySpacing: 40,
  reflectionDistanceRetention: 0.64,
  reflectionIntensityRetention: 0.7,
  minimumRemainingDistance: 60,
  raySurfaceOffset: 1.5,
  echoSeconds: 0.68,
  enemyEchoSeconds: 0.48,
  maximumEchoMarks: 720,
} as const;
