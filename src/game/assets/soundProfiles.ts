import type { SoundKind } from "../simulation/state";
import { ASSET_KEYS } from "./manifest";

export interface SoundPlaybackProfile {
  assetKey: string;
  volume: number;
  rate: number;
  playbackFraction?: number;
}

export const SOUND_PLAYBACK_PROFILES: Readonly<
  Record<SoundKind, SoundPlaybackProfile>
> = {
  "player-step": {
    assetKey: ASSET_KEYS.audio.walk,
    volume: 0.1,
    rate: 1.06,
  },
  "enemy-step": {
    assetKey: ASSET_KEYS.audio.walk,
    volume: 0.12,
    rate: 0.9,
  },
  landing: {
    assetKey: ASSET_KEYS.audio.landing,
    volume: 0.34,
    rate: 1,
  },
  "player-attack": {
    assetKey: ASSET_KEYS.audio.attack,
    volume: 0.28,
    rate: 1.04,
  },
  "enemy-attack": {
    assetKey: ASSET_KEYS.audio.attack,
    volume: 0.34,
    rate: 0.9,
  },
  "enemy-hit": {
    assetKey: ASSET_KEYS.audio.enemyHit,
    volume: 0.26,
    rate: 1.03,
    playbackFraction: 0.25,
  },
  "enemy-death": {
    assetKey: ASSET_KEYS.audio.enemyHit,
    volume: 0.38,
    rate: 0.94,
  },
  "enemy-alert": {
    assetKey: ASSET_KEYS.audio.enemyAlert,
    volume: 0.3,
    rate: 1,
  },
  sleep: {
    assetKey: ASSET_KEYS.audio.sleepingEnemy,
    volume: 0.13,
    rate: 0.96,
  },
  water: {
    assetKey: ASSET_KEYS.audio.water,
    volume: 0.17,
    rate: 1,
  },
  "hazard-pulse": {
    assetKey: ASSET_KEYS.audio.hazardPulse,
    volume: 0.21,
    rate: 0.95,
  },
};

export const GROWING_LOOP_VOLUME = 0.075;

export function getPlaybackVolume(
  kind: SoundKind,
  audibleIntensity: number,
): number {
  return Math.max(
    0,
    Math.min(1, SOUND_PLAYBACK_PROFILES[kind].volume * audibleIntensity),
  );
}
