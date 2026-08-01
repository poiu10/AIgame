import type { SoundKind } from "../../game/simulation/state";

export const PLAYER_FOOTSTEP_WAVE_COLOR = 0x68e8ff;
export const THREAT_COLOR = 0xff334f;
export const TRIGGER_COLOR = 0xff9d2e;

export const SOUND_WAVE_COLORS: Readonly<Record<SoundKind, number>> = {
  "terrain-step": PLAYER_FOOTSTEP_WAVE_COLOR,
  landing: 0x8af7ff,
  "attack-hit": 0xff67b1,
  "enemy-step": PLAYER_FOOTSTEP_WAVE_COLOR,
  "enemy-alert": THREAT_COLOR,
  "enemy-attack": THREAT_COLOR,
  hurt: 0xff4f7d,
  death: 0xffffff,
  ambient: 0x79dfee,
  hazard: THREAT_COLOR,
};
