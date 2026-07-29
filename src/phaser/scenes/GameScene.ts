import Phaser from "phaser";
import { TEST_ROOM } from "../../game/content/testRoom";
import type { InputActions } from "../../game/input/actions";
import { FIXED_STEP_SECONDS } from "../../game/simulation/rules/config";
import { createInitialGameState, type GameState } from "../../game/simulation/state";
import {
  drainGameEvents,
  stepSimulation,
} from "../../game/simulation/systems/simulation";
import {
  GAME_HUD_EVENT,
  type HudState,
} from "../../ui/hud/mountHud";
import { GameViewAdapter } from "../view/GameViewAdapter";
import { SoundSynth } from "../view/SoundSynth";

type ActionKey = "W" | "A" | "D" | "SPACE" | "SHIFT" | "J" | "R" | "P" | "F3";

interface PendingButtons {
  jumpPressed: boolean;
  rollPressed: boolean;
  attackPressed: boolean;
  restartPressed: boolean;
  debugPulsePressed: boolean;
}

const EMPTY_PENDING: PendingButtons = {
  jumpPressed: false,
  rollPressed: false,
  attackPressed: false,
  restartPressed: false,
  debugPulsePressed: false,
};

export class GameScene extends Phaser.Scene {
  private gameState: GameState = createInitialGameState(TEST_ROOM);
  private view!: GameViewAdapter;
  private soundSynth!: SoundSynth;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<ActionKey, Phaser.Input.Keyboard.Key>;
  private pending: PendingButtons = { ...EMPTY_PENDING };
  private accumulator = 0;
  private debugVisible = false;
  private lastHudSignature = "";

  constructor() {
    super("game");
  }

  create(): void {
    this.cameras.main.setBounds(0, 0, TEST_ROOM.width, TEST_ROOM.height);
    this.view = new GameViewAdapter(this, TEST_ROOM);
    this.soundSynth = new SoundSynth();
    this.cameras.main.startFollow(this.view.playerTarget, true, 0.11, 0.11);
    this.cameras.main.setDeadzone(150, 90);

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error("키보드 입력을 초기화할 수 없습니다.");
    }

    this.cursors = keyboard.createCursorKeys();
    this.keys = keyboard.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
      SHIFT: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      J: Phaser.Input.Keyboard.KeyCodes.J,
      R: Phaser.Input.Keyboard.KeyCodes.R,
      P: Phaser.Input.Keyboard.KeyCodes.P,
      F3: Phaser.Input.Keyboard.KeyCodes.F3,
    }) as Record<ActionKey, Phaser.Input.Keyboard.Key>;

    keyboard.once("keydown", () => this.soundSynth.unlock());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.soundSynth.dispose());
    this.view.sync(this.gameState, this.debugVisible);
    this.publishHud();
  }

  update(_time: number, deltaMilliseconds: number): void {
    this.captureButtonEdges();
    this.accumulator += Math.min(deltaMilliseconds / 1000, 0.1);

    let firstStep = true;
    while (this.accumulator >= FIXED_STEP_SECONDS) {
      this.gameState = stepSimulation(
        this.gameState,
        this.readInput(firstStep),
        FIXED_STEP_SECONDS,
        TEST_ROOM,
      );
      this.accumulator -= FIXED_STEP_SECONDS;
      if (firstStep) {
        this.pending = { ...EMPTY_PENDING };
        firstStep = false;
      }
    }

    this.view.sync(this.gameState, this.debugVisible);
    this.cameras.main.setFollowOffset(-this.gameState.player.facing * 72, 34);
    this.consumeEvents();
    this.publishHud();
  }

  private captureButtonEdges(): void {
    this.pending.jumpPressed ||=
      Phaser.Input.Keyboard.JustDown(this.keys.SPACE) ||
      Phaser.Input.Keyboard.JustDown(this.keys.W) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.up);
    this.pending.rollPressed ||= Phaser.Input.Keyboard.JustDown(this.keys.SHIFT);
    this.pending.attackPressed ||= Phaser.Input.Keyboard.JustDown(this.keys.J);
    this.pending.restartPressed ||= Phaser.Input.Keyboard.JustDown(this.keys.R);
    this.pending.debugPulsePressed ||= Phaser.Input.Keyboard.JustDown(this.keys.P);

    if (Phaser.Input.Keyboard.JustDown(this.keys.F3)) {
      this.debugVisible = !this.debugVisible;
    }
  }

  private readInput(includeEdges: boolean): InputActions {
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const edges = includeEdges ? this.pending : EMPTY_PENDING;
    return {
      moveX: Number(right) - Number(left),
      jumpPressed: edges.jumpPressed,
      jumpHeld:
        this.cursors.up.isDown || this.keys.W.isDown || this.keys.SPACE.isDown,
      rollPressed: edges.rollPressed,
      attackPressed: edges.attackPressed,
      restartPressed: edges.restartPressed,
      debugPulsePressed: edges.debugPulsePressed,
      toggleDebugPressed: false,
    };
  }

  private consumeEvents(): void {
    for (const event of drainGameEvents(this.gameState)) {
      if (event.type === "sound") {
        this.soundSynth.play(
          event,
          this.cameras.main.worldView.centerX,
          this.cameras.main.width,
        );
      } else {
        this.cameras.main.shake(70, 0.0015 * event.strength);
      }
    }
  }

  private publishHud(): void {
    const remainingEnemies = this.gameState.enemies.filter(
      (enemy) => enemy.alive,
    ).length;
    const hudState: HudState = {
      health: this.gameState.player.health,
      maxHealth: this.gameState.player.maxHealth,
      remainingEnemies,
      status: this.gameState.status,
      debugVisible: this.debugVisible,
    };
    const signature = JSON.stringify(hudState);
    if (signature === this.lastHudSignature) {
      return;
    }
    this.lastHudSignature = signature;
    window.dispatchEvent(new CustomEvent<HudState>(GAME_HUD_EVENT, { detail: hudState }));
  }
}
