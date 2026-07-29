import Phaser from "phaser";
import type { WorldDefinition } from "../../game/content/world";
import {
  ENEMY_CONFIG,
  SOUND_CONFIG,
} from "../../game/simulation/rules/config";
import type {
  EnemyState,
  GameState,
  PlayerState,
  SoundKind,
} from "../../game/simulation/state";

const WAVE_COLORS: Record<SoundKind, number> = {
  "terrain-step": 0x68e8ff,
  landing: 0x8af7ff,
  "attack-hit": 0xff67b1,
  "enemy-step": 0xffb85c,
  "enemy-attack": 0xff704d,
  hurt: 0xff4f7d,
  death: 0xffffff,
  debug: 0xc18cff,
};

export class GameViewAdapter {
  readonly playerTarget: Phaser.GameObjects.Container;

  private readonly playerGraphics: Phaser.GameObjects.Graphics;
  private readonly enemyViews = new Map<
    string,
    { container: Phaser.GameObjects.Container; graphics: Phaser.GameObjects.Graphics }
  >();
  private readonly waveGraphics: Phaser.GameObjects.Graphics;
  private readonly echoGraphics: Phaser.GameObjects.Graphics;
  private readonly debugGraphics: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private readonly world: WorldDefinition,
  ) {
    this.debugGraphics = scene.add.graphics().setDepth(1);
    this.echoGraphics = scene.add.graphics().setDepth(3);
    this.waveGraphics = scene.add.graphics().setDepth(4);
    this.playerGraphics = scene.add.graphics();
    this.playerTarget = scene.add
      .container(world.playerSpawn.x, world.playerSpawn.y, [this.playerGraphics])
      .setDepth(10);

    for (const spawn of world.enemies) {
      const graphics = scene.add.graphics();
      const container = scene.add
        .container(spawn.position.x, spawn.position.y, [graphics])
        .setDepth(8)
        .setVisible(false);
      this.enemyViews.set(spawn.id, { container, graphics });
    }
  }

  sync(state: GameState, debugVisible: boolean): void {
    this.drawPlayer(state.player, state.elapsedTime);
    this.drawEnemies(state, debugVisible);
    this.drawEchoes(state);
    this.drawWaves(state);
    this.drawDebug(debugVisible);
  }

  private drawPlayer(player: PlayerState, elapsedTime: number): void {
    this.playerTarget.setPosition(player.position.x, player.position.y);
    this.playerTarget.setAlpha(
      player.invulnerabilityTime > 0 && Math.floor(elapsedTime * 18) % 2 === 0
        ? 0.42
        : 1,
    );

    const graphics = this.playerGraphics;
    graphics.clear();
    const facing = player.facing;
    const actionColor =
      player.action === "hurt" || player.action === "dead" ? 0xff5c86 : 0x76efff;

    graphics.fillStyle(0x183d55, 0.35);
    graphics.fillCircle(0, 0, 30);
    graphics.fillStyle(actionColor, 1);
    graphics.fillCircle(0, -18, 9);
    graphics.fillRoundedRect(-10, -9, 20, 32, 7);
    graphics.fillTriangle(-10, 19, 10, 19, -facing * 4, 29);

    graphics.lineStyle(3, 0xd9fbff, 0.95);
    graphics.beginPath();
    graphics.moveTo(facing * 5, -4);
    graphics.lineTo(facing * 24, 16);
    graphics.strokePath();

    if (player.action === "roll") {
      graphics.lineStyle(2, 0x76efff, 0.65);
      graphics.strokeCircle(0, 6, 21);
    }

    if (
      player.action === "attack" &&
      player.actionTime >= 0.05 &&
      player.actionTime <= 0.22
    ) {
      graphics.lineStyle(5, 0xff8fc7, 0.88);
      graphics.beginPath();
      graphics.arc(facing * 8, 0, 35, facing > 0 ? -0.9 : 2.2, facing > 0 ? 0.9 : 4.05);
      graphics.strokePath();
    }
  }

  private drawEnemies(state: GameState, debugVisible: boolean): void {
    for (const enemy of state.enemies) {
      const view = this.enemyViews.get(enemy.id);
      if (!view) {
        continue;
      }
      view.container.setPosition(enemy.position.x, enemy.position.y);
      const visible = debugVisible || enemy.echoTime > 0;
      view.container.setVisible(visible);
      if (!visible) {
        continue;
      }

      const alpha = debugVisible
        ? 0.35
        : Math.min(1, enemy.echoTime / Math.max(enemy.echoDuration, 0.001));
      this.drawEnemy(view.graphics, enemy, alpha);
    }
  }

  private drawEnemy(
    graphics: Phaser.GameObjects.Graphics,
    enemy: EnemyState,
    alpha: number,
  ): void {
    graphics.clear();
    const color = enemy.alive ? 0xffa24d : 0xfff4dc;
    graphics.lineStyle(2, color, alpha);
    graphics.strokeRoundedRect(
      -ENEMY_CONFIG.width / 2,
      -ENEMY_CONFIG.height / 2,
      ENEMY_CONFIG.width,
      ENEMY_CONFIG.height,
      8,
    );
    graphics.strokeCircle(enemy.facing * 7, -11, 3);
    graphics.beginPath();
    graphics.moveTo(-12, 16);
    graphics.lineTo(0, 8);
    graphics.lineTo(12, 16);
    graphics.strokePath();

    if (enemy.action === "attack") {
      graphics.lineStyle(4, 0xff604c, alpha);
      graphics.lineBetween(0, -2, enemy.facing * 34, 2);
    }
  }

  private drawEchoes(state: GameState): void {
    this.echoGraphics.clear();
    for (const mark of state.echoMarks) {
      const life = mark.time / mark.duration;
      const alpha = Math.max(0, life * mark.intensity * 0.95);
      this.echoGraphics.lineStyle(2.5, 0x83f4ff, alpha);
      this.echoGraphics.lineBetween(
        mark.start.x,
        mark.start.y,
        mark.end.x,
        mark.end.y,
      );
    }
  }

  private drawWaves(state: GameState): void {
    this.waveGraphics.clear();
    for (const wave of state.soundWaves) {
      const color = WAVE_COLORS[wave.kind];
      for (let index = 0; index < wave.rays.length; index += 1) {
        const ray = wave.rays[index];
        if (!ray.active) {
          continue;
        }
        const alpha = Math.max(0.08, Math.min(0.92, ray.intensity * 0.85));

        const next = wave.rays[(index + 1) % wave.rays.length];
        if (!next.active || next.pathKey !== ray.pathKey) {
          continue;
        }
        const separation = Math.hypot(
          next.position.x - ray.position.x,
          next.position.y - ray.position.y,
        );
        if (separation <= SOUND_CONFIG.maximumRaySpacing * 1.15) {
          this.waveGraphics.lineStyle(2, color, alpha * 0.86);
          this.waveGraphics.lineBetween(
            ray.position.x,
            ray.position.y,
            next.position.x,
            next.position.y,
          );
        }
      }
    }
  }

  private drawDebug(visible: boolean): void {
    this.debugGraphics.clear();
    if (!visible) {
      return;
    }
    this.debugGraphics.lineStyle(1, 0x5f7690, 0.55);
    for (const block of this.world.terrain) {
      this.debugGraphics.strokeRect(
        block.bounds.x,
        block.bounds.y,
        block.bounds.width,
        block.bounds.height,
      );
    }
  }
}
