import Phaser from "phaser";
import {
  ANIMATION_KEYS,
  ASSET_KEYS,
  PLAYER_SPRITE_FRAME,
} from "../../game/assets/manifest";
import type { WorldDefinition } from "../../game/content/world";
import {
  ENEMY_CONFIG,
  PLAYER_CONFIG,
  SOUND_CONFIG,
} from "../../game/simulation/rules/config";
import {
  getEnemyAttackBounds,
  getPlayerAttackBounds,
} from "../../game/simulation/rules/combat";
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
  "enemy-alert": 0xff334f,
  "enemy-attack": 0xff704d,
  hurt: 0xff4f7d,
  death: 0xffffff,
  ambient: 0x79dfee,
  hazard: 0xff334f,
  debug: 0xc18cff,
};

const PLAYER_SPRITE_SCALE = 1.5;
const PLAYER_SPRITE_FEET_Y = 80;

export class GameViewAdapter {
  readonly playerTarget: Phaser.GameObjects.Container;

  private readonly playerSprite: Phaser.GameObjects.Sprite;
  private readonly playerGraphics: Phaser.GameObjects.Graphics;
  private readonly tutorialText: Phaser.GameObjects.Text;
  private readonly enemyViews = new Map<
    string,
    { container: Phaser.GameObjects.Container; graphics: Phaser.GameObjects.Graphics }
  >();
  private readonly waveGraphics: Phaser.GameObjects.Graphics;
  private readonly echoGraphics: Phaser.GameObjects.Graphics;
  private readonly hazardGraphics: Phaser.GameObjects.Graphics;
  private readonly debugGraphics: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private readonly world: WorldDefinition,
  ) {
    this.debugGraphics = scene.add.graphics().setDepth(1);
    this.echoGraphics = scene.add.graphics().setDepth(3);
    this.waveGraphics = scene.add.graphics().setDepth(4);
    this.hazardGraphics = scene.add.graphics().setDepth(7);
    this.playerSprite = scene.add
      .sprite(0, PLAYER_CONFIG.height / 2, ASSET_KEYS.player.idle)
      .setOrigin(0.5, PLAYER_SPRITE_FEET_Y / PLAYER_SPRITE_FRAME.height)
      .setScale(PLAYER_SPRITE_SCALE);
    this.playerGraphics = scene.add.graphics();
    this.tutorialText = scene.add
      .text(0, -PLAYER_CONFIG.height / 2 - 10, "", {
        color: "#eaffff",
        fontFamily: "Consolas, monospace",
        fontSize: "39px",
        fontStyle: "bold",
        stroke: "#030608",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1);
    this.playerTarget = scene.add
      .container(world.playerSpawn.x, world.playerSpawn.y, [
        this.playerSprite,
        this.playerGraphics,
        this.tutorialText,
      ])
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
    this.drawPlayer(state.player);
    this.drawTutorialText(state);
    this.drawEnemies(state, debugVisible);
    this.drawHazards(state, debugVisible);
    this.drawEchoes(state);
    this.drawWaves(state);
    this.drawDebug(debugVisible);
  }

  private drawTutorialText(state: GameState): void {
    const section = this.world.tutorialSections?.[state.tutorialStep];
    this.tutorialText.setText(
      state.status === "playing" ? (section?.prompt ?? "") : "",
    );
  }

  private drawHazards(state: GameState, debugVisible: boolean): void {
    this.hazardGraphics.clear();
    for (const definition of this.world.hazards ?? []) {
      const hazard = state.hazards.find(
        (candidate) => candidate.id === definition.id,
      );
      if (!hazard || (!debugVisible && hazard.echoTime <= 0)) {
        continue;
      }

      const alpha = debugVisible
        ? 0.35
        : Math.min(1, hazard.echoTime / Math.max(hazard.echoDuration, 0.001));
      this.hazardGraphics.lineStyle(2.5, 0xff334f, alpha);
      this.hazardGraphics.strokeRect(
        definition.bounds.x,
        definition.bounds.y,
        definition.bounds.width,
        definition.bounds.height,
      );
    }
  }

  private drawPlayer(player: PlayerState): void {
    this.playerTarget.setPosition(player.position.x, player.position.y);
    this.playerTarget.setAlpha(1);

    const animationKey = this.getPlayerAnimationKey(player);
    if (this.playerSprite.anims.currentAnim?.key !== animationKey) {
      this.playerSprite.anims.play(animationKey);
    }
    this.playerSprite.setFlipX(
      (player.action === "attack" ? player.attackFacing : player.facing) < 0,
    );

    const graphics = this.playerGraphics;
    graphics.clear();
    const hitboxColor =
      player.action === "hurt" || player.action === "dead" ? 0xff5c86 : 0x76efff;
    graphics.lineStyle(2, hitboxColor, 1);
    graphics.strokeRect(
      -PLAYER_CONFIG.width / 2,
      -PLAYER_CONFIG.height / 2,
      PLAYER_CONFIG.width,
      PLAYER_CONFIG.height,
    );

    if (player.action === "attack") {
      const attackBounds = getPlayerAttackBounds(player);
      const active =
        player.actionTime >= PLAYER_CONFIG.attackActiveStart &&
        player.actionTime <= PLAYER_CONFIG.attackActiveEnd;
      graphics.lineStyle(2, 0xffd166, active ? 1 : 0.4);
      graphics.strokeRect(
        attackBounds.x - player.position.x,
        attackBounds.y - player.position.y,
        attackBounds.width,
        attackBounds.height,
      );
    }
  }

  private getPlayerAnimationKey(player: PlayerState): string {
    if (player.action === "hurt" || player.action === "dead") {
      return ANIMATION_KEYS.player.hurt;
    }
    if (player.action === "attack") {
      return ANIMATION_KEYS.player.attack;
    }
    if (!player.grounded || Math.abs(player.velocity.x) > 10) {
      return ANIMATION_KEYS.player.run;
    }
    return ANIMATION_KEYS.player.idle;
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
    graphics.strokeRect(
      -ENEMY_CONFIG.width / 2,
      -ENEMY_CONFIG.height / 2,
      ENEMY_CONFIG.width,
      ENEMY_CONFIG.height,
    );

    if (enemy.action === "attack") {
      const attackBounds = getEnemyAttackBounds(enemy);
      graphics.lineStyle(2, 0xff9f68, alpha);
      graphics.strokeRect(
        attackBounds.x - enemy.position.x,
        attackBounds.y - enemy.position.y,
        attackBounds.width,
        attackBounds.height,
      );
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
      const lineWidth = wave.kind === "enemy-alert" ? 4 : 2;
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
          this.waveGraphics.lineStyle(lineWidth, color, alpha * 0.86);
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
    this.debugGraphics.lineStyle(1, 0xff334f, 0.55);
    for (const hazard of this.world.hazards ?? []) {
      this.debugGraphics.strokeRect(
        hazard.bounds.x,
        hazard.bounds.y,
        hazard.bounds.width,
        hazard.bounds.height,
      );
    }
  }
}
