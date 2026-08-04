export const FIXED_STEP_SECONDS = 1 / 120;

export const MELEE_ATTACK_WAVE_CONFIG = {
  distance: 160,
  intensity: 0.76,
} as const;

export const PLAYER_HIT_WAVE_CONFIG = {
  distance: 120,
  intensity: 0.35,
} as const;

export const ENEMY_HIT_WAVE_CONFIG = {
  distance: 180,
  intensity: 0.82,
} as const;

export const ENEMY_DEATH_WAVE_CONFIG = {
  distance: 200,
  intensity: 0.88,
} as const;

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
  jumpSpeed: 1010,
  jumpReleaseSpeed: 341,
  coyoteSeconds: 0.11,
  jumpBufferSeconds: 0.12,
  rollSpeed: 900,
  rollSeconds: 0.27,
  rollBounceSpeed: 472.5,
  rollCooldownSeconds: 0.5,
  attackSeconds: 0.3,
  attackCooldownSeconds: 0.8,
  attackActiveStart: 0.08,
  attackActiveEnd: 0.13,
  hurtSeconds: 0.3,
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
  sleeperPulseDistance: MELEE_ATTACK_WAVE_CONFIG.distance,
  activeEnemyPulseIntervalSeconds: 3.4,
  flyerPulseDistance: MELEE_ATTACK_WAVE_CONFIG.distance,
  wakerPulseDistance: 520,
  activeEnemyPulseIntensity: 0.76,
  activeEnemyPulseInitialDelaySeconds: 0.8,
  activeEnemyPulseSpawnStaggerSeconds: 0.55,
  wakerPulseWakeDelaySeconds: 0.45,
  flyerSpeed: 190,
  wakerAcceleration: 700,
  wakerMaximumSpeed: 560,
  openingDoorSoundDistance: 720,
  electricHazardInitialSpeed: 50,
  electricHazardInitialSpeedSeconds: 1,
  electricHazardSpeed: 600,
  electricHazardDeathGraceCount: 3,
  electricHazardDeathSpeedReduction: 10,
  electricHazardMinimumSpeed: 200,
  electricHazardPulseIntervalSeconds: 0.1,
  electricHazardPulseDistance: 72,
  electricSoundMaximumDistance: 720,
} as const;

export const STAGE_TWO_CONFIG = {
  entryDoorTriggerDistance: 72,
  closingDoorSoundDistance: 720,
  phaseOneHealth: 5,
  phaseOneMinionHealth: 2,
  phaseOneEjectSeconds: 0.38,
  phaseOneEjectHorizontalSpeed: 440,
  phaseOneEjectVerticalSpeed: 180,
  phaseOneEjectGravity: 620,
  phaseOneMinionPulseIntervalSeconds: 1,
  phaseTwoHealth: 15,
  phaseTwoPatternIntervalSeconds: 2,
  phaseTwoPatternWarningSeconds: 0.5,
  phaseTwoDoubleCallDelaySeconds: 0.25,
  phaseTwoPatternSpeed: 920,
  phaseTwoIntroActorCount: 14,
  phaseTwoIntroSpawnIntervalSeconds: 0.055,
  phaseTwoIntroMinimumSpeed: 620,
  bossCallDistance: MELEE_ATTACK_WAVE_CONFIG.distance,
  bossCallIntensity: STAGE_ONE_CONFIG.activeEnemyPulseIntensity,
  phaseThreeHealth: 20,
  phaseThreeIntroSeconds: 3.2,
  phaseThreeBossWaveDistance: 540,
  phaseThreeIntermissionSeconds: 8,
  phaseThreeIntermissionDescendDelaySeconds: 1,
  phaseThreeIntermissionExitLeadSeconds: 1,
  phaseThreeBossCallIntervalSeconds: 2.4,
  phaseThreeIntermissionFlightY: 150,
  phaseThreePatternEntrySeconds: 0.8,
  phaseThreePatternExitSeconds: 0.8,
  phaseThreePatternWarningSeconds: 0.5,
  phaseThreePatternOneShotIntervalSeconds: 0.8,
  phaseThreePatternTwoDurationSeconds: 20,
  phaseThreePatternTwoIntervalSeconds: 3,
  phaseThreePatternTwoOverlapIntervalSeconds: 2,
  phaseThreePatternThreeBarrageDelaySeconds: 3,
  phaseThreePatternThreeBarrageSeconds: 6,
  phaseThreePatternThreeShotIntervalSeconds: 0.2,
  phaseThreeProjectileSpeed: 920,
  phaseThreeSpawnWaveDistance: 160,
  phaseThreeDeathShakeSeconds: 1.6,
  phaseThreeDeathSquelchIntervalSeconds: 0.16,
  phaseThreeDeathPieceCount: 24,
  phaseThreeDeathPieceLifetimeSeconds: 2.6,
  phaseThreeDeathPieceGravity: 360,
  phaseThreeEndTitleDelaySeconds: 5,
  phaseThreeEndFadeSeconds: 1,
} as const;

export function getEnemyBodySize(kind?: string): {
  width: number;
  height: number;
} {
  if (kind === "stage-sleeper") return { width: 72, height: 40 };
  if (kind === "stage-flyer") return { width: 66, height: 44 };
  if (kind === "stage-waker") return { width: 70, height: 52 };
  if (kind === "stage-2-raven-insect-boss") {
    return { width: 180, height: 120 };
  }
  if (kind === "stage-2-cocoon-boss") return { width: 180, height: 260 };
  return { width: ENEMY_CONFIG.width, height: ENEMY_CONFIG.height };
}

export const HAZARD_CONFIG = {
  damageReactionSeconds: 0.32,
  floorStrikeSeconds: 0.42,
} as const;

export const SOUND_CONFIG = {
  speed: 1300,
  initialRayCount: 24,
  maximumRaySpacing: 40,
  listenerHalfVolumeDistanceMultiplier: 2,
  reflectionDistanceRetention: 0.64,
  reflectionIntensityRetention: 0.7,
  minimumRemainingDistance: 60,
  raySurfaceOffset: 1.5,
  echoSeconds: 0.68,
  enemyEchoSeconds: 0.48,
  maximumEchoMarks: 720,
} as const;
