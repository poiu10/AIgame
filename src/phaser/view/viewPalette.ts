import type { SoundKind } from "../../game/simulation/state";

export const PLAYER_FOOTSTEP_WAVE_COLOR = 0x68e8ff;
export const THREAT_COLOR = 0xff334f;
export const TRIGGER_COLOR = 0xff9d2e;

export const SOUND_WAVE_COLORS: Readonly<Record<SoundKind, number>> = {
  "player-step": PLAYER_FOOTSTEP_WAVE_COLOR,
  landing: 0x8af7ff,
  "player-attack": 0xff67b1,
  "enemy-step": PLAYER_FOOTSTEP_WAVE_COLOR,
  "enemy-alert": THREAT_COLOR,
  "enemy-attack": THREAT_COLOR,
  "enemy-call": THREAT_COLOR,
  "enemy-hit": 0xff67b1,
  "enemy-death": 0xffffff,
  sleep: THREAT_COLOR,
  water: 0x79dfee,
  "hazard-pulse": THREAT_COLOR,
};
