import { describe, expect, it } from "vitest";
import { ASSET_KEYS, AUDIO_ASSETS } from "../src/game/assets/manifest";
import {
  getPlaybackVolume,
  GROWING_LOOP_VOLUME,
  MELEE_ATTACK_VOLUME,
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

  it("uses the supplied kaaaaaak sample for active enemy calls", () => {
    expect(AUDIO_ASSETS.enemyCall.path).toBe("assets/audio/1kaaaaaak.mp3");
    expect(SOUND_PLAYBACK_PROFILES["enemy-call"].assetKey).toBe(
      ASSET_KEYS.audio.enemyCall,
    );
  });

  it("uses down2 for landing sounds", () => {
    expect(AUDIO_ASSETS.landing.path).toBe("assets/audio/down2.wav");
  });

  it("makes only the resonance crusher pulse louder and slightly higher", () => {
    expect(AUDIO_ASSETS.crusherPulse.path).toBe(
      "assets/audio/jiiiingggg.mp3",
    );
    expect(SOUND_PLAYBACK_PROFILES["crusher-pulse"]).toMatchObject({
      assetKey: ASSET_KEYS.audio.crusherPulse,
      volume: 0.315,
      rate: 1.05,
    });
    expect(SOUND_PLAYBACK_PROFILES["hazard-pulse"]).toMatchObject({
      volume: 0.21,
      rate: 0.95,
    });
  });

  it("keeps contextual source volumes restrained", () => {
    expect(MELEE_ATTACK_VOLUME).toBe(0.14);
    expect(SOUND_PLAYBACK_PROFILES["player-attack"].volume).toBe(
      MELEE_ATTACK_VOLUME,
    );
    expect(SOUND_PLAYBACK_PROFILES["enemy-attack"].volume).toBe(
      MELEE_ATTACK_VOLUME,
    );
    expect(getPlaybackVolume("player-attack", 1)).toBe(MELEE_ATTACK_VOLUME);
    expect(getPlaybackVolume("enemy-attack", 1)).toBe(MELEE_ATTACK_VOLUME);
    expect(SOUND_PLAYBACK_PROFILES["enemy-attack"].rate).toBe(0.9);
    expect(Math.max(
      ...Object.values(SOUND_PLAYBACK_PROFILES).map((profile) => profile.volume),
    )).toBeLessThanOrEqual(0.38);
    expect(GROWING_LOOP_VOLUME).toBeLessThan(0.1);
    expect(getPlaybackVolume("water", 0.5)).toBeCloseTo(0.085);
  });

  it("attenuates audio without shrinking or dimming its wave", () => {
    const state = createInitialGameState({
      width: 1000,
      height: 500,
      playerSpawn: { x: 0, y: 0 },
      terrain: [],
      enemies: [],
    });
    const source = { x: 400, y: 0 };
    const maximumDistance = 400;
    const distanceScale = getListenerDistanceScale(
      state.player.position,
      source,
      maximumDistance,
    );

    emitSound(state, "water", source, maximumDistance, 0.8);

    expect(distanceScale).toBe(0.5);
    expect(state.soundWaves[0].rays[0].remainingDistance).toBe(maximumDistance);
    expect(state.soundWaves[0].rays[0].intensity).toBeCloseTo(0.8);
    expect(state.events[0]).toMatchObject({ type: "sound", intensity: 0.4 });
  });

  it("keeps waves but creates no audio event outside the audible distance", () => {
    const state = createInitialGameState({
      width: 1000,
      height: 500,
      playerSpawn: { x: 0, y: 0 },
      terrain: [],
      enemies: [],
    });

    emitSound(state, "water", { x: 801, y: 0 }, 400, 1);

    expect(state.soundWaves).toHaveLength(1);
    expect(state.soundWaves[0].rays[0]).toMatchObject({
      remainingDistance: 400,
      intensity: 1,
    });
    expect(state.events).toEqual([]);
  });
});
