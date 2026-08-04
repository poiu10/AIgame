import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ASSET_KEYS, AUDIO_ASSETS } from "../src/game/assets/manifest";
import {
  getPlaybackVolume,
  ELECTRIC_LOOP_VOLUME,
  MELEE_ATTACK_VOLUME,
  SOUND_PLAYBACK_PROFILES,
} from "../src/game/assets/soundProfiles";
import { createInitialGameState } from "../src/game/simulation/state";
import {
  emitSound,
  getListenerDistanceScale,
} from "../src/game/simulation/systems/sound";

describe("sample-backed sound", () => {
  it("keeps only manifest-backed audio files in the deployed asset folder", () => {
    const audioDirectory = fileURLToPath(
      new URL("../public/assets/audio/", import.meta.url),
    );
    const deployedFiles = readdirSync(audioDirectory)
      .filter((file) => /\.(?:mp3|ogg|wav)$/i.test(file))
      .sort();
    const manifestFiles = [
      ...new Set(
        Object.values(AUDIO_ASSETS).map((asset) =>
          asset.path.replace("assets/audio/", ""),
        ),
      ),
    ].sort();

    expect(deployedFiles).toEqual(manifestFiles);
  });

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
    expect(SOUND_PLAYBACK_PROFILES["waker-call"].assetKey).toBe(
      ASSET_KEYS.audio.enemyCall,
    );
    expect(SOUND_PLAYBACK_PROFILES["waker-call-burst"]).toMatchObject({
      assetKey: ASSET_KEYS.audio.enemyCall,
      volume: 0.12,
      playbackFraction: 0.22,
    });
    expect(
      SOUND_PLAYBACK_PROFILES["waker-call-burst"].followWithFullPlayback,
    ).toBeUndefined();
    expect(SOUND_PLAYBACK_PROFILES["waker-call-short"]).toMatchObject({
      assetKey: ASSET_KEYS.audio.enemyCall,
      playbackFraction: 0.5,
      followWithFullPlayback: true,
    });
  });

  it("maps phase-three emergence and wet spawning to the supplied samples", () => {
    expect(AUDIO_ASSETS.fleshGrowth.path).toBe(
      "assets/audio/tanweraman-flesh-growing-horror-392360.mp3",
    );
    expect(AUDIO_ASSETS.wetSquelch.path).toBe(
      "assets/audio/universfield-wet-squelch-276679.mp3",
    );
    expect(SOUND_PLAYBACK_PROFILES["boss-flesh-growth"]).toMatchObject({
      assetKey: ASSET_KEYS.audio.fleshGrowth,
      volume: 0.34,
    });
    expect(SOUND_PLAYBACK_PROFILES["boss-wet-squelch"].assetKey).toBe(
      ASSET_KEYS.audio.wetSquelch,
    );
    expect(SOUND_PLAYBACK_PROFILES["spawn-wet-squelch"]).toMatchObject({
      assetKey: ASSET_KEYS.audio.wetSquelch,
      playbackFraction: 0.18,
    });
    expect(SOUND_PLAYBACK_PROFILES["boss-death-squelch"]).toMatchObject({
      assetKey: ASSET_KEYS.audio.wetSquelch,
      rate: 1.12,
      playbackFraction: 0.16,
    });
  });

  it("uses down_cut_before_tak for landing sounds", () => {
    expect(AUDIO_ASSETS.landing.path).toBe(
      "assets/audio/down_cut_before_tak.wav",
    );
  });

  it("uses the supplied restrained player hit sample", () => {
    expect(AUDIO_ASSETS.playerHit.path).toBe(
      "assets/audio/hard-punch-high-ring-removed.mp3",
    );
    expect(SOUND_PLAYBACK_PROFILES["player-hit"]).toMatchObject({
      assetKey: ASSET_KEYS.audio.playerHit,
      volume: 0.16,
      rate: 1,
    });
  });

  it("uses the supplied stone door sample for the opening door", () => {
    expect(AUDIO_ASSETS.doorOpen.path).toBe("assets/audio/stonedoor.mp3");
    expect(SOUND_PLAYBACK_PROFILES["door-open"]).toMatchObject({
      assetKey: ASSET_KEYS.audio.doorOpen,
      volume: 0.38,
      rate: 1,
    });
    expect(SOUND_PLAYBACK_PROFILES["door-close"]).toMatchObject({
      assetKey: ASSET_KEYS.audio.doorOpen,
      volume: 0.38,
      rate: 1,
      playbackStartFraction: 0.5,
    });
  });

  it("halves only the flyer and sleeper periodic volumes", () => {
    expect(SOUND_PLAYBACK_PROFILES["enemy-call"].volume).toBe(0.12);
    expect(SOUND_PLAYBACK_PROFILES.sleep.volume).toBe(0.065);
    expect(SOUND_PLAYBACK_PROFILES["waker-call"].volume).toBe(0.24);
    expect(SOUND_PLAYBACK_PROFILES["waker-call-burst"].volume).toBe(0.12);
    expect(SOUND_PLAYBACK_PROFILES["waker-call-short"].volume).toBe(0.24);
  });

  it("uses the supplied seamless electric loop for the moving electric hazard", () => {
    expect(AUDIO_ASSETS.electric.path).toBe(
      "assets/audio/electric_shock_seamless_loop.ogg",
    );
    expect(AUDIO_ASSETS.crusherPulse.path).toBe(
      "assets/audio/jiiiingggg.mp3",
    );
    expect(SOUND_PLAYBACK_PROFILES["crusher-pulse"]).toMatchObject({
      assetKey: ASSET_KEYS.audio.crusherPulse,
      volume: 0.63,
      rate: 1.05,
    });
    expect(SOUND_PLAYBACK_PROFILES["electric-pulse"]).toMatchObject({
      assetKey: ASSET_KEYS.audio.electric,
      volume: 0.42,
      rate: 1,
    });
    expect(ELECTRIC_LOOP_VOLUME).toBe(0.15);
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
      ...Object.entries(SOUND_PLAYBACK_PROFILES)
        .filter(([kind]) => kind !== "crusher-pulse" && kind !== "electric-pulse")
        .map(([, profile]) => profile.volume),
    )).toBeLessThanOrEqual(0.38);
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

    expect(distanceScale).toBeCloseTo(Math.SQRT1_2);
    expect(state.soundWaves[0].rays[0].remainingDistance).toBe(maximumDistance);
    expect(state.soundWaves[0].rays[0].intensity).toBeCloseTo(0.8);
    expect(state.events[0]).toMatchObject({ type: "sound" });
    expect(state.events[0]?.type === "sound" ? state.events[0].intensity : 0)
      .toBeCloseTo(0.8 * Math.SQRT1_2);
  });

  it("keeps audio events and halves volume by a distance ratio without a hard cutoff", () => {
    const state = createInitialGameState({
      width: 2000,
      height: 500,
      playerSpawn: { x: 0, y: 0 },
      terrain: [],
      enemies: [],
    });

    expect(getListenerDistanceScale(
      state.player.position,
      { x: 800, y: 0 },
      400,
    )).toBeCloseTo(0.5);
    expect(getListenerDistanceScale(
      state.player.position,
      { x: 1600, y: 0 },
      400,
    )).toBeCloseTo(0.25);

    emitSound(state, "water", { x: 1600, y: 0 }, 400, 1);

    expect(state.soundWaves).toHaveLength(1);
    expect(state.soundWaves[0].rays[0]).toMatchObject({
      remainingDistance: 400,
      intensity: 1,
    });
    expect(state.events).toEqual([
      expect.objectContaining({
        type: "sound",
        kind: "water",
        intensity: 0.25,
      }),
    ]);
  });
});
