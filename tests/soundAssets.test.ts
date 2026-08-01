import { describe, expect, it } from "vitest";
import { ASSET_KEYS, AUDIO_ASSETS } from "../src/game/assets/manifest";
import {
  getPlaybackVolume,
  GROWING_LOOP_VOLUME,
  SOUND_PLAYBACK_PROFILES,
} from "../src/game/assets/soundProfiles";
import { createInitialGameState } from "../src/game/simulation/state";
import {
  emitSound,
  getListenerDistanceScale,
} from "../src/game/simulation/systems/sound";

describe("sample-backed sound", () => {
  it("maps every wave kind to one of the loaded audio assets", () => {
    const loadedKeys = new Set(Object.values(AUDIO_ASSETS).map((asset) => asset.key));
    for (const profile of Object.values(SOUND_PLAYBACK_PROFILES)) {
      expect(loadedKeys.has(profile.assetKey)).toBe(true);
    }
  });

  it("plays only the first quarter on a hit and the full file on a kill", () => {
    expect(SOUND_PLAYBACK_PROFILES["enemy-hit"].assetKey).toBe(
      ASSET_KEYS.audio.enemyHit,
    );
    expect(SOUND_PLAYBACK_PROFILES["enemy-hit"].playbackFraction).toBe(0.25);
    expect(SOUND_PLAYBACK_PROFILES["enemy-death"].assetKey).toBe(
      ASSET_KEYS.audio.enemyHit,
    );
    expect(SOUND_PLAYBACK_PROFILES["enemy-death"].playbackFraction).toBeUndefined();
  });

  it("keeps contextual source volumes restrained", () => {
    expect(Math.max(
      ...Object.values(SOUND_PLAYBACK_PROFILES).map((profile) => profile.volume),
    )).toBeLessThanOrEqual(0.38);
    expect(GROWING_LOOP_VOLUME).toBeLessThan(0.1);
    expect(getPlaybackVolume("water", 0.5)).toBeCloseTo(0.085);
  });

  it("uses one distance scale for wave range, wave strength, and audio strength", () => {
    const state = createInitialGameState({
      width: 1000,
      height: 500,
      playerSpawn: { x: 0, y: 0 },
      terrain: [],
      enemies: [],
    });
    const source = { x: 200, y: 0 };
    const maximumDistance = 400;
    const distanceScale = getListenerDistanceScale(
      state.player.position,
      source,
      maximumDistance,
    );

    emitSound(state, "water", source, maximumDistance, 0.8);

    expect(distanceScale).toBe(0.5);
    expect(state.soundWaves[0].rays[0].remainingDistance).toBe(200);
    expect(state.soundWaves[0].rays[0].intensity).toBeCloseTo(0.4);
    expect(state.events[0]).toMatchObject({ type: "sound", intensity: 0.4 });
  });

  it("creates neither audio events nor waves outside the audible distance", () => {
    const state = createInitialGameState({
      width: 1000,
      height: 500,
      playerSpawn: { x: 0, y: 0 },
      terrain: [],
      enemies: [],
    });

    emitSound(state, "water", { x: 401, y: 0 }, 400, 1);

    expect(state.soundWaves).toEqual([]);
    expect(state.events).toEqual([]);
  });
});
