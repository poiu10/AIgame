import type { SoundKind } from "../../game/simulation/state";

export const PLAYER_FOOTSTEP_WAVE_COLOR = 0x68e8ff;
export const PLAYER_ATTACK_WAVE_COLOR = 0xff67b1;
export const THREAT_COLOR = 0xff334f;
export const TRIGGER_COLOR = 0xff9d2e;

export const SOUND_WAVE_COLORS: Readonly<Record<SoundKind, number>> = {
  "player-step": PLAYER_FOOTSTEP_WAVE_COLOR,
  landing: 0x8af7ff,
  "player-attack": PLAYER_ATTACK_WAVE_COLOR,
  "enemy-step": PLAYER_FOOTSTEP_WAVE_COLOR,
  "enemy-alert": THREAT_COLOR,
  "enemy-attack": PLAYER_ATTACK_WAVE_COLOR,
  "enemy-call": THREAT_COLOR,
  "enemy-hit": PLAYER_ATTACK_WAVE_COLOR,
  "enemy-death": 0xffffff,
  sleep: THREAT_COLOR,
  water: 0x79dfee,
  "crusher-pulse": THREAT_COLOR,
  "hazard-pulse": THREAT_COLOR,
};
