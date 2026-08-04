import Phaser from "phaser";
import { ASSET_KEYS } from "../../game/assets/manifest";
import {
  ELECTRIC_LOOP_VOLUME,
  getPlaybackVolume,
  SOUND_PLAYBACK_PROFILES,
} from "../../game/assets/soundProfiles";
import { HAZARD_KINDS } from "../../game/content/world";
import { STAGE_ONE_CONFIG } from "../../game/simulation/rules/config";
import type {
  GameState,
  SoundEvent,
  Vector2State,
} from "../../game/simulation/state";
import { getListenerDistanceScale } from "../../game/simulation/systems/sound";

type AdjustableSound = Phaser.Sound.BaseSound & {
  setVolume(value: number): AdjustableSound;
  setPan(value: number): AdjustableSound;
};

function getPan(
  sourceX: number,
  listenerX: number,
  viewportWidth: number,
): number {
  return Math.max(
    -1,
    Math.min(1, (sourceX - listenerX) / Math.max(1, viewportWidth * 0.48)),
  );
}

export class SampleSoundPlayer {
  private electricLoop: AdjustableSound | null = null;
  private readonly oneShotSounds = new Set<AdjustableSound>();
  private readonly handleVisibilityChange = () => {
    if (this.isPageInactive()) this.discardHiddenPageAudio();
  };

  constructor(private readonly scene: Phaser.Scene) {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
      window.addEventListener("blur", this.handleVisibilityChange);
    }
  }

  play(event: SoundEvent, listenerX: number, viewportWidth: number): void {
    if (this.isPageInactive()) return;
    const profile = SOUND_PLAYBACK_PROFILES[event.kind];
    const volume = getPlaybackVolume(event.kind, event.intensity);
    if (volume <= 0) return;

    const sound = this.scene.sound.add(profile.assetKey) as AdjustableSound;
    this.oneShotSounds.add(sound);
    const config: Phaser.Types.Sound.SoundConfig = {
      volume,
      rate: profile.rate,
      pan: getPan(event.position.x, listenerX, viewportWidth),
    };
    const destroy = () => {
      this.oneShotSounds.delete(sound);
      if (!sound.pendingRemove) sound.destroy();
    };
    if (profile.followWithFullPlayback) {
      sound.once(Phaser.Sound.Events.COMPLETE, () => {
        if (this.isPageInactive()) {
          destroy();
          return;
        }
        sound.once(Phaser.Sound.Events.COMPLETE, destroy);
        if (!sound.play(config)) destroy();
      });
    } else {
      sound.once(Phaser.Sound.Events.COMPLETE, destroy);
    }

    let started: boolean;
    if (profile.playbackStartFraction || profile.playbackFraction) {
      const markerName = `segment-${event.kind}`;
      const startFraction = profile.playbackStartFraction ?? 0;
      const playbackFraction = profile.playbackFraction ?? (1 - startFraction);
      sound.addMarker({
        name: markerName,
        start: sound.totalDuration * startFraction,
        duration: Math.max(
          0.01,
          Math.min(
            sound.totalDuration * playbackFraction,
            sound.totalDuration * (1 - startFraction),
          ),
        ),
      });
      started = sound.play(markerName, config);
    } else {
      started = sound.play(config);
    }
    if (!started) destroy();
  }

  syncElectricHazard(
    state: GameState,
    viewportWidth: number,
  ): void {
    if (this.isPageInactive()) {
      this.stopElectricLoop();
      return;
    }
    const source = this.findActiveElectricHazard(state);
    if (!source) {
      this.stopElectricLoop();
      return;
    }

    const listener = state.player.position;
    const distanceScale = getListenerDistanceScale(
      listener,
      source,
      STAGE_ONE_CONFIG.electricSoundMaximumDistance,
    );

    if (!this.electricLoop) {
      this.electricLoop = this.scene.sound.add(ASSET_KEYS.audio.electric, {
        loop: true,
        volume: 0,
      }) as AdjustableSound;
      this.electricLoop.play();
    }
    this.electricLoop.setVolume(ELECTRIC_LOOP_VOLUME * distanceScale);
    this.electricLoop.setPan(getPan(source.x, listener.x, viewportWidth));
  }

  dispose(): void {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
      window.removeEventListener("blur", this.handleVisibilityChange);
    }
    this.discardHiddenPageAudio();
  }

  discardHiddenPageAudio(): void {
    for (const sound of this.oneShotSounds) {
      sound.stop();
      if (!sound.pendingRemove) sound.destroy();
    }
    this.oneShotSounds.clear();
    this.stopElectricLoop();
  }

  private isPageInactive(): boolean {
    return typeof document !== "undefined" &&
      (document.hidden || !document.hasFocus());
  }

  private findActiveElectricHazard(state: GameState): Vector2State | null {
    let nearest: Vector2State | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const hazard of state.hazards) {
      if (
        hazard.kind !== HAZARD_KINDS.electric ||
        !hazard.activated
      ) {
        continue;
      }
      const candidate = {
        x: hazard.bounds.x + hazard.bounds.width / 2,
        y: hazard.bounds.y + hazard.bounds.height / 2,
      };
      const distance = Math.hypot(
        candidate.x - state.player.position.x,
        candidate.y - state.player.position.y,
      );
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  private stopElectricLoop(): void {
    if (!this.electricLoop) return;
    this.electricLoop.stop();
    this.electricLoop.destroy();
    this.electricLoop = null;
  }
}
