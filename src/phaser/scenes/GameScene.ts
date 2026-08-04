import Phaser from "phaser";
import { getStage, INITIAL_STAGE_ID, STAGES } from "../../game/content/stages";
import type { StageDefinition } from "../../game/content/world";
import type { InputActions } from "../../game/input/actions";
import { RestartHoldTracker } from "../../game/input/restartHold";
import {
  BrowserCheckpointStorage,
  createInitialCheckpoint,
  createTransitionCheckpoint,
  findTouchedExit,
  parseCheckpoint,
  recordElectricHazardDeathCount,
  restoreCheckpointState,
  serializeCheckpoint,
  type CheckpointSave,
} from "../../game/progression/checkpoint";
import { FIXED_STEP_SECONDS } from "../../game/simulation/rules/config";
import type { GameState } from "../../game/simulation/state";
import { drainGameEvents, stepSimulation } from "../../game/simulation/systems/simulation";
import {
  createHudState,
  GAME_HUD_EVENT,
  type HudState,
} from "../../ui/hud/mountHud";
import { GameViewAdapter } from "../view/GameViewAdapter";
import { SampleSoundPlayer } from "../view/SampleSoundPlayer";

type ActionKey = "W" | "A" | "D" | "SPACE" | "SHIFT" | "J" | "R";

interface PendingButtons {
  jumpPressed: boolean;
  rollPressed: boolean;
  attackPressed: boolean;
}

const EMPTY_PENDING: PendingButtons = {
  jumpPressed: false,
  rollPressed: false,
  attackPressed: false,
};

export class GameScene extends Phaser.Scene {
  private currentStage!: StageDefinition;
  private gameState!: GameState;
  private checkpoint!: CheckpointSave;
  private readonly checkpointStorage = new BrowserCheckpointStorage();
  private view!: GameViewAdapter;
  private soundPlayer!: SampleSoundPlayer;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<ActionKey, Phaser.Input.Keyboard.Key>;
  private pending: PendingButtons = { ...EMPTY_PENDING };
  private readonly restartHold = new RestartHoldTracker();
  private accumulator = 0;
  private lastHudSignature = "";

  constructor() {
    super("game");
  }

  create(): void {
    this.soundPlayer = new SampleSoundPlayer(this);
    this.loadCheckpoint();
    this.configureStageView();

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("키보드 입력을 초기화할 수 없습니다.");

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

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.view.destroy();
      this.soundPlayer.dispose();
    });
    this.view.sync(this.gameState);
    this.soundPlayer.syncElectricHazard(this.gameState, this.cameras.main.width);
    this.publishHud();
  }

  update(_time: number, deltaMilliseconds: number): void {
    this.captureButtonEdges();
    const restartAction = this.restartHold.update(
      this.keys.R.isDown,
      deltaMilliseconds / 1000,
    );
    if (restartAction === "full-reset") {
      this.resetGameCompletely();
      this.pending = { ...EMPTY_PENDING };
      this.accumulator = 0;
    } else if (restartAction === "restore-checkpoint") {
      this.restoreCheckpoint();
      this.pending = { ...EMPTY_PENDING };
      this.accumulator = 0;
    }

    this.accumulator += Math.min(deltaMilliseconds / 1000, 0.1);
    let firstStep = true;
    let stageChanged = false;
    while (this.accumulator >= FIXED_STEP_SECONDS) {
      const wasPlayerDead = this.gameState.player.action === "dead";
      const electricHazardDeathCountBefore =
        this.gameState.electricHazardDeathCount;
      this.gameState = stepSimulation(
        this.gameState,
        this.readInput(firstStep),
        FIXED_STEP_SECONDS,
        this.currentStage,
      );
      this.accumulator -= FIXED_STEP_SECONDS;

      if (
        !wasPlayerDead &&
        this.gameState.player.action === "dead" &&
        this.gameState.electricHazardDeathCount >
          electricHazardDeathCountBefore
      ) {
        this.checkpoint = recordElectricHazardDeathCount(
          this.checkpoint,
          this.currentStage.id,
          this.gameState.electricHazardDeathCount,
        );
        this.persistCheckpoint();
      }

      const exit = this.gameState.player.action !== "dead"
        ? findTouchedExit(this.gameState, this.currentStage)
        : undefined;
      if (exit) {
        const targetStage = getStage(exit.targetStageId);
        this.checkpoint = createTransitionCheckpoint(
          this.checkpoint,
          this.currentStage,
          this.gameState,
          exit,
          targetStage,
        );
        this.persistCheckpoint();
        this.currentStage = targetStage;
        this.gameState = restoreCheckpointState(this.checkpoint, targetStage);
        this.configureStageView();
        stageChanged = true;
      }

      if (firstStep) {
        this.pending = { ...EMPTY_PENDING };
        firstStep = false;
      }
      if (stageChanged) {
        this.accumulator = 0;
        break;
      }
    }

    this.view.sync(this.gameState);
    this.soundPlayer.syncElectricHazard(this.gameState, this.cameras.main.width);
    this.cameras.main.setFollowOffset(-this.gameState.player.facing * 144, 0);
    this.consumeEvents();
    this.publishHud();
  }

  private loadCheckpoint(): void {
    const initialStage = getStage(INITIAL_STAGE_ID);
    const fallback = createInitialCheckpoint(initialStage);
    let loaded: CheckpointSave | null = null;
    try {
      const stored = this.checkpointStorage.load();
      loaded = stored ? parseCheckpoint(stored) : null;
    } catch {
      loaded = null;
    }
    this.checkpoint = loaded && STAGES[loaded.currentStageId] ? loaded : fallback;
    this.currentStage = getStage(this.checkpoint.currentStageId);
    this.gameState = restoreCheckpointState(this.checkpoint, this.currentStage);
  }

  private restoreCheckpoint(): void {
    const checkpointStage = getStage(this.checkpoint.currentStageId);
    this.currentStage = checkpointStage;
    this.gameState = restoreCheckpointState(this.checkpoint, checkpointStage);
    this.configureStageView();
  }

  private resetGameCompletely(): void {
    try {
      this.checkpointStorage.clear();
    } catch {
      // 저장소가 차단되어도 현재 세션은 최초 실행 상태로 초기화한다.
    }
    const initialStage = getStage(INITIAL_STAGE_ID);
    this.checkpoint = createInitialCheckpoint(initialStage);
    this.currentStage = initialStage;
    this.gameState = restoreCheckpointState(this.checkpoint, initialStage);
    this.configureStageView();
  }

  private persistCheckpoint(): void {
    try {
      this.checkpointStorage.save(serializeCheckpoint(this.checkpoint));
    } catch {
      // localStorage가 차단되어도 현재 세션의 체크포인트는 메모리에 유지한다.
    }
  }

  private configureStageView(): void {
    if (this.view) this.view.destroy();
    const camera = this.cameras.main;
    camera.stopFollow();
    camera.setBounds(0, 0, this.currentStage.width, this.currentStage.height);
    this.view = new GameViewAdapter(this, this.currentStage);
    camera.startFollow(this.view.playerTarget, true, 0.11, 0);
    camera.setScroll(camera.scrollX, this.currentStage.height - camera.height);
    camera.setDeadzone(300, camera.height);
  }

  private captureButtonEdges(): void {
    this.pending.jumpPressed ||= Phaser.Input.Keyboard.JustDown(this.keys.SPACE)
      || Phaser.Input.Keyboard.JustDown(this.keys.W)
      || Phaser.Input.Keyboard.JustDown(this.cursors.up);
    this.pending.rollPressed ||= Phaser.Input.Keyboard.JustDown(this.keys.SHIFT);
    this.pending.attackPressed ||= Phaser.Input.Keyboard.JustDown(this.keys.J);
  }

  private readInput(includeEdges: boolean): InputActions {
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const edges = includeEdges ? this.pending : EMPTY_PENDING;
    return {
      moveX: Number(right) - Number(left),
      jumpPressed: edges.jumpPressed,
      jumpHeld: this.cursors.up.isDown || this.keys.W.isDown || this.keys.SPACE.isDown,
      rollPressed: edges.rollPressed,
      attackPressed: edges.attackPressed,
    };
  }

  private consumeEvents(): void {
    for (const event of drainGameEvents(this.gameState)) {
      if (event.type === "sound") {
        this.soundPlayer.play(
          event,
          this.gameState.player.position.x,
          this.cameras.main.width,
        );
      } else {
        this.cameras.main.shake(70, new Phaser.Math.Vector2(0.0015 * event.strength, 0));
      }
    }
  }

  private publishHud(): void {
    const hudState: HudState = createHudState(this.gameState);
    const signature = JSON.stringify(hudState);
    if (signature === this.lastHudSignature) return;
    this.lastHudSignature = signature;
    window.dispatchEvent(new CustomEvent<HudState>(GAME_HUD_EVENT, { detail: hudState }));
  }
}
