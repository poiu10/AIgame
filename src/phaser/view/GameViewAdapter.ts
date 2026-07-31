import Phaser from "phaser";
import {
  ASSET_KEYS,
  PLAYER_SPRITE_DISPLAY_SCALE,
  PLAYER_SPRITE_FRAME,
} from "../../game/assets/manifest";
import type { WorldDefinition } from "../../game/content/world";
import {
  PLAYER_CONFIG,
  SOUND_CONFIG,
} from "../../game/simulation/rules/config";
import type {
  EnemyState,
  GameState,
  PlayerState,
} from "../../game/simulation/state";
import {
  getPixelThicknessOffsets,
  rasterizePixelLine,
  SOUND_PIXEL_SIZE,
} from "./pixelLine";
import { rasterizePixelText } from "./pixelText";
import { resolvePlayerAnimationKey } from "./playerAnimation";
import {
  createEnemyThreatCells,
  createHazardDamageLightningCells,
  createHazardThreatCells,
  resolveEnemyThreatFrame,
  resolveHazardReactionFrame,
  THREAT_PIXEL_SIZE,
} from "./threatPixelArt";
import { SOUND_WAVE_COLORS, THREAT_COLOR } from "./viewPalette";

const PLAYER_SPRITE_FEET_Y = 80;
const STANDARD_WAVE_PIXEL_OFFSETS = getPixelThicknessOffsets(2);
const ALERT_WAVE_PIXEL_OFFSETS = getPixelThicknessOffsets(4);
const TUTORIAL_TEXT_PIXEL_SIZE = 10;
const TUTORIAL_TEXT_BOTTOM_Y = -PLAYER_CONFIG.height / 2 - 20;
const TUTORIAL_TEXT_SHADOW_OFFSET = 4;

export class GameViewAdapter {
  readonly playerTarget: Phaser.GameObjects.Container;

  private readonly playerSprite: Phaser.GameObjects.Sprite;
  private readonly tutorialText: Phaser.GameObjects.Graphics;
  private readonly enemyViews = new Map<
    string,
    { container: Phaser.GameObjects.Container; graphics: Phaser.GameObjects.Graphics }
  >();
  private readonly waveGraphics: Phaser.GameObjects.Graphics;
  private readonly echoGraphics: Phaser.GameObjects.Graphics;
  private readonly hazardGraphics: Phaser.GameObjects.Graphics;
  private currentTutorialPrompt = "";

  constructor(
    scene: Phaser.Scene,
    private readonly world: WorldDefinition,
  ) {
    this.echoGraphics = scene.add.graphics().setDepth(3);
    this.waveGraphics = scene.add.graphics().setDepth(4);
    this.hazardGraphics = scene.add.graphics().setDepth(7);
    this.playerSprite = scene.add
      .sprite(0, PLAYER_CONFIG.height / 2, ASSET_KEYS.player.idle)
      .setOrigin(0.5, PLAYER_SPRITE_FEET_Y / PLAYER_SPRITE_FRAME.height)
      .setScale(PLAYER_SPRITE_DISPLAY_SCALE);
    this.tutorialText = scene.add.graphics();
    this.playerTarget = scene.add
      .container(world.playerSpawn.x, world.playerSpawn.y, [
        this.playerSprite,
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

  sync(state: GameState): void {
    this.drawPlayer(state.player);
    this.drawTutorialText(state);
    this.drawEnemies(state);
    this.drawHazards(state);
    this.drawEchoes(state);
    this.drawWaves(state);
  }

  private drawTutorialText(state: GameState): void {
    const section = this.world.tutorialSections?.[state.tutorialStep];
    const prompt = state.status === "playing" ? (section?.prompt ?? "") : "";
    if (prompt === this.currentTutorialPrompt) {
      return;
    }
    this.currentTutorialPrompt = prompt;

    const pixelText = rasterizePixelText(prompt);
    const originX = -(pixelText.width * TUTORIAL_TEXT_PIXEL_SIZE) / 2;
    const originY =
      TUTORIAL_TEXT_BOTTOM_Y - pixelText.height * TUTORIAL_TEXT_PIXEL_SIZE;

    this.tutorialText.clear();
    this.tutorialText.fillStyle(0x030608, 0.9);
    for (const cell of pixelText.cells) {
      this.tutorialText.fillRect(
        originX + cell.x * TUTORIAL_TEXT_PIXEL_SIZE + TUTORIAL_TEXT_SHADOW_OFFSET,
        originY + cell.y * TUTORIAL_TEXT_PIXEL_SIZE + TUTORIAL_TEXT_SHADOW_OFFSET,
        TUTORIAL_TEXT_PIXEL_SIZE,
        TUTORIAL_TEXT_PIXEL_SIZE,
      );
    }

    this.tutorialText.fillStyle(0xeaffff, 1);
    for (const cell of pixelText.cells) {
      this.tutorialText.fillRect(
        originX + cell.x * TUTORIAL_TEXT_PIXEL_SIZE,
        originY + cell.y * TUTORIAL_TEXT_PIXEL_SIZE,
        TUTORIAL_TEXT_PIXEL_SIZE,
        TUTORIAL_TEXT_PIXEL_SIZE,
      );
    }
  }

  private drawHazards(state: GameState): void {
    this.hazardGraphics.clear();
    for (const definition of this.world.hazards ?? []) {
      const hazard = state.hazards.find(
        (candidate) => candidate.id === definition.id,
      );
      if (!hazard || hazard.echoTime <= 0) {
        continue;
      }

      const alpha = Math.min(
        1,
        hazard.echoTime / Math.max(hazard.echoDuration, 0.001),
      );
      this.hazardGraphics.fillStyle(THREAT_COLOR, alpha);
      for (const cell of createHazardThreatCells(
        definition.bounds.width,
        definition.bounds.height,
      )) {
        this.hazardGraphics.fillRect(
          definition.bounds.x + cell.x * THREAT_PIXEL_SIZE,
          definition.bounds.y + cell.y * THREAT_PIXEL_SIZE,
          THREAT_PIXEL_SIZE,
          THREAT_PIXEL_SIZE,
        );
      }

      const reactionFrame = resolveHazardReactionFrame(hazard);
      if (reactionFrame) {
        this.hazardGraphics.fillStyle(THREAT_COLOR, Math.min(1, alpha + 0.2));
        for (const cell of createHazardDamageLightningCells(
          definition.bounds.width,
          definition.bounds.height,
          reactionFrame,
          hazard.reactionSide,
          hazard.reactionOffsetY,
        )) {
          this.hazardGraphics.fillRect(
            definition.bounds.x + cell.x * THREAT_PIXEL_SIZE,
            definition.bounds.y + cell.y * THREAT_PIXEL_SIZE,
            THREAT_PIXEL_SIZE,
            THREAT_PIXEL_SIZE,
          );
        }
      }
    }
  }

  private drawPlayer(player: PlayerState): void {
    this.playerTarget.setPosition(player.position.x, player.position.y);
    this.playerTarget.setAlpha(1);

    const animationKey = resolvePlayerAnimationKey(player);
    if (this.playerSprite.anims.currentAnim?.key !== animationKey) {
      this.playerSprite.anims.play(animationKey);
    }
    this.playerSprite.setFlipX(
      (player.action === "attack" ? player.attackFacing : player.facing) < 0,
    );
  }

  private drawEnemies(state: GameState): void {
    for (const enemy of state.enemies) {
      const view = this.enemyViews.get(enemy.id);
      if (!view) {
        continue;
      }
      view.container.setPosition(enemy.position.x, enemy.position.y);
      const visible = enemy.echoTime > 0;
      view.container.setVisible(visible);
      if (!visible) {
        continue;
      }

      const alpha = Math.min(
        1,
        enemy.echoTime / Math.max(enemy.echoDuration, 0.001),
      );
      this.drawEnemy(view.graphics, enemy, state.elapsedTime, alpha);
    }
  }

  private drawEnemy(
    graphics: Phaser.GameObjects.Graphics,
    enemy: EnemyState,
    elapsedSeconds: number,
    alpha: number,
  ): void {
    graphics.clear();
    graphics.fillStyle(THREAT_COLOR, alpha);
    const facing =
      enemy.action === "alert" || enemy.action === "attack"
        ? enemy.attackFacing
        : enemy.facing;
    const frame = resolveEnemyThreatFrame(enemy, elapsedSeconds);
    for (const cell of createEnemyThreatCells(frame, facing)) {
      graphics.fillRect(
        cell.x * THREAT_PIXEL_SIZE,
        cell.y * THREAT_PIXEL_SIZE,
        THREAT_PIXEL_SIZE,
        THREAT_PIXEL_SIZE,
      );
    }
  }

  private drawEchoes(state: GameState): void {
    this.echoGraphics.clear();
    for (const mark of state.echoMarks) {
      const life = mark.time / mark.duration;
      const alpha = Math.max(0, life * mark.intensity * 0.95);
      this.drawPixelLine(
        this.echoGraphics,
        mark.start.x,
        mark.start.y,
        mark.end.x,
        mark.end.y,
        0x83f4ff,
        alpha,
      );
    }
  }

  private drawWaves(state: GameState): void {
    this.waveGraphics.clear();
    for (const wave of state.soundWaves) {
      const color = SOUND_WAVE_COLORS[wave.kind];
      const thicknessOffsets =
        wave.kind === "enemy-alert"
          ? ALERT_WAVE_PIXEL_OFFSETS
          : STANDARD_WAVE_PIXEL_OFFSETS;
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
          this.drawPixelLine(
            this.waveGraphics,
            ray.position.x,
            ray.position.y,
            next.position.x,
            next.position.y,
            color,
            alpha * 0.86,
            thicknessOffsets,
          );
        }
      }
    }
  }

  private drawPixelLine(
    graphics: Phaser.GameObjects.Graphics,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    color: number,
    alpha: number,
    thicknessOffsets = STANDARD_WAVE_PIXEL_OFFSETS,
  ): void {
    graphics.fillStyle(color, alpha);

    for (const cell of rasterizePixelLine(
      { x: startX, y: startY },
      { x: endX, y: endY },
    )) {
      for (const offsetY of thicknessOffsets) {
        for (const offsetX of thicknessOffsets) {
          graphics.fillRect(
            cell.x + offsetX * SOUND_PIXEL_SIZE,
            cell.y + offsetY * SOUND_PIXEL_SIZE,
            SOUND_PIXEL_SIZE,
            SOUND_PIXEL_SIZE,
          );
        }
      }
    }
  }
}
