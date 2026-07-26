import Phaser from "phaser";
import type { InputActions } from "../../game/input/actions";
import { createInitialGameState } from "../../game/simulation/state";
import { updateMovement } from "../../game/simulation/systems/movement";

export class GameScene extends Phaser.Scene {
  private readonly gameState = createInitialGameState();
  private player!: Phaser.GameObjects.Arc;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;

  constructor() {
    super("game");
  }

  create(): void {
    this.add
      .text(480, 220, "Phaser 3 + TypeScript + Vite", {
        color: "#f4f7ff",
        fontFamily: "system-ui, sans-serif",
        fontSize: "28px",
      })
      .setOrigin(0.5);

    this.add
      .text(480, 260, "방향키 또는 WASD로 이동", {
        color: "#9baccc",
        fontFamily: "system-ui, sans-serif",
        fontSize: "17px",
      })
      .setOrigin(0.5);

    this.player = this.add.circle(
      this.gameState.playerPosition.x,
      this.gameState.playerPosition.y,
      18,
      0x65d9ff,
    );

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error("키보드 입력을 초기화할 수 없습니다.");
    }

    this.cursors = keyboard.createCursorKeys();
    this.wasd = keyboard.addKeys("W,A,S,D") as Record<
      "W" | "A" | "S" | "D",
      Phaser.Input.Keyboard.Key
    >;
  }

  update(_time: number, delta: number): void {
    updateMovement(this.gameState, this.readInput(), delta / 1000);
    this.player.setPosition(
      this.gameState.playerPosition.x,
      this.gameState.playerPosition.y,
    );
  }

  private readInput(): InputActions {
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;

    return {
      moveX: Number(right) - Number(left),
      moveY: Number(down) - Number(up),
    };
  }
}
