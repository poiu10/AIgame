import Phaser from "phaser";
import { TUTORIAL_STAGE } from "../../game/content/tutorialStage";
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

type ActionKey = "W" | "A" | "D" | "SPACE" | "SHIFT" | "J" | "R";

interface PendingButtons {
  jumpPressed: boolean;
  rollPressed: boolean;
  attackPressed: boolean;
  restartPressed: boolean;
}

const EMPTY_PENDING: PendingButtons = {
  jumpPressed: false,
  rollPressed: false,
  attackPressed: false,
  restartPressed: false,
};

export class GameScene extends Phaser.Scene {
  private gameState: GameState = createInitialGameState(TUTORIAL_STAGE);
  private view!: GameViewAdapter;
  private soundSynth!: SoundSynth;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<ActionKey, Phaser.Input.Keyboard.Key>;
  private pending: PendingButtons = { ...EMPTY_PENDING };
  private accumulator = 0;
  private lastHudSignature = "";

  constructor() {
    super("game");
  }

  create(): void {
    const camera = this.cameras.main;
    camera.setBounds(0, 0, TUTORIAL_STAGE.width, TUTORIAL_STAGE.height);
    this.view = new GameViewAdapter(this, TUTORIAL_STAGE);
    this.soundSynth = new SoundSynth();
    camera.startFollow(this.view.playerTarget, true, 0.11, 0);
    camera.setScroll(camera.scrollX, TUTORIAL_STAGE.height - camera.height);
    camera.setDeadzone(300, camera.height);

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
    }) as Record<ActionKey, Phaser.Input.Keyboard.Key>;

    keyboard.once("keydown", () => this.soundSynth.unlock());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.soundSynth.dispose());
    this.view.sync(this.gameState);
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
        TUTORIAL_STAGE,
      );
      this.accumulator -= FIXED_STEP_SECONDS;
      if (firstStep) {
        this.pending = { ...EMPTY_PENDING };
        firstStep = false;
      }
    }

    this.view.sync(this.gameState);
    this.cameras.main.setFollowOffset(-this.gameState.player.facing * 144, 0);
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
        this.cameras.main.shake(
          70,
          new Phaser.Math.Vector2(0.0015 * event.strength, 0),
        );
      }
    }
  }

  private publishHud(): void {
    const hudState: HudState = {
      health: this.gameState.player.health,
      maxHealth: this.gameState.player.maxHealth,
    };
    const signature = JSON.stringify(hudState);
    if (signature === this.lastHudSignature) {
      return;
    }
    this.lastHudSignature = signature;
    window.dispatchEvent(new CustomEvent<HudState>(GAME_HUD_EVENT, { detail: hudState }));
  }
}
