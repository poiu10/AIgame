import type { SoundEvent, SoundKind } from "../../game/simulation/state";

const FREQUENCIES: Record<SoundKind, number> = {
  "terrain-step": 150,
  landing: 92,
  "attack-hit": 360,
  "enemy-step": 210,
  "enemy-alert": 165,
  "enemy-attack": 115,
  hurt: 280,
  death: 72,
  ambient: 430,
  hazard: 64,
  debug: 520,
};

export class SoundSynth {
  private context: AudioContext | null = null;

  unlock(): void {
    if (!this.context) {
      this.context = new AudioContext();
    }
    if (this.context.state === "suspended") {
      void this.context.resume();
    }
  }

  play(event: SoundEvent, listenerX: number, viewportWidth: number): void {
    if (!this.context || this.context.state !== "running") {
      return;
    }

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner();
    const duration = event.kind === "death" ? 0.34 : 0.1 + event.intensity * 0.08;
    const pan = Math.max(
      -1,
      Math.min(1, (event.position.x - listenerX) / (viewportWidth * 0.48)),
    );

    oscillator.type =
      event.kind.includes("enemy") || event.kind === "hazard"
        ? "sawtooth"
        : "sine";
    oscillator.frequency.setValueAtTime(FREQUENCIES[event.kind], now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(45, FREQUENCIES[event.kind] * 0.72),
      now + duration,
    );
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(
      0.025 + event.intensity * 0.055,
      now + 0.012,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    panner.pan.setValueAtTime(pan, now);

    oscillator.connect(gain).connect(panner).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  dispose(): void {
    if (this.context) {
      void this.context.close();
      this.context = null;
    }
  }
}
