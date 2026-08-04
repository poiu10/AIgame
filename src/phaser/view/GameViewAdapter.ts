import Phaser from "phaser";
import {
  ASSET_KEYS,
  PLAYER_SPRITE_DISPLAY_SCALE,
  PLAYER_SPRITE_FRAME,
} from "../../game/assets/manifest";
import type { WorldDefinition } from "../../game/content/world";
import { ENEMY_KINDS, HAZARD_KINDS, TERRAIN_KINDS } from "../../game/content/world";
import {
  PLAYER_CONFIG,
  SOUND_CONFIG,
  STAGE_TWO_CONFIG,
} from "../../game/simulation/rules/config";
import { isEnemyBodyPresent } from "../../game/simulation/rules/enemyDeath";
import type {
  BossActorState,
  EnemyState,
  GameState,
  PlayerState,
} from "../../game/simulation/state";
import {
  resolveBossEndingAlpha,
  resolveBossEndingText,
} from "../../game/simulation/rules/bossEnding";
import { resolveTerrainBounds } from "../../game/simulation/systems/stageMechanisms";
import {
  getPixelThicknessOffsets,
  rasterizePixelLine,
  SOUND_PIXEL_SIZE,
} from "./pixelLine";
import {
  createMapScrollIndicatorDots,
  MAP_SCROLL_INDICATOR_DOT_SIZE,
} from "./mapScrollIndicator";
import { rasterizePixelText } from "./pixelText";
import {
  createBossDeathPieceCells,
  resolveBossDeathPieceAlpha,
  resolveBossDeathShakeOffset,
} from "./bossDeathPresentation";
import { resolvePlayerAnimationKey } from "./playerAnimation";
import {
  createCenteredRestartPrompt,
  DEATH_RESTART_PROMPT_PIXEL_SIZE,
  resolveDeathRestartPromptAlpha,
} from "./playerPrompt";
import {
  createEnemyThreatCells,
  createCrackedCocoonBossThreatCells,
  createElectricHazardLightningCells,
  createFloorHazardStrikeCells,
  createFloorHazardThreatCells,
  createHazardDamageLightningCells,
  createHazardThreatCells,
  resolveEnemyThreatFrame,
  resolveFloorHazardStrikeExtension,
  resolveHazardReactionFrame,
  THREAT_PIXEL_SIZE,
  type EnemyThreatFrame,
} from "./threatPixelArt";
import {
  ECHO_MARK_COLORS,
  SOUND_WAVE_COLORS,
  TERRAIN_ECHO_COLOR,
  THREAT_COLOR,
  TRIGGER_COLOR,
} from "./viewPalette";
import { GAME_VIEW_DEPTH } from "./viewDepth";

const PLAYER_SPRITE_FEET_Y = 80;
const STANDARD_WAVE_PIXEL_OFFSETS = getPixelThicknessOffsets(2);
const ALERT_WAVE_PIXEL_OFFSETS = getPixelThicknessOffsets(4);
const TUTORIAL_TEXT_PIXEL_SIZE = 10;
const TUTORIAL_TEXT_BOTTOM_Y = -PLAYER_CONFIG.height / 2 - 20;
const TUTORIAL_TEXT_SHADOW_OFFSET = 4;
const BUTTON_PRESS_GUIDE_WIDTH = 3;
const ELECTRIC_LIGHTNING_FRAME_COUNT = 4;
const ELECTRIC_LIGHTNING_FRAME_RATE = 20;
const MAP_SCROLL_INDICATOR_ALPHA = 0.62;
const ENDING_TEXT_PIXEL_SIZE = 9;
const ENDING_DEMO_PIXEL_SIZE = 5;
const ENDING_TEXT_SHADOW_OFFSET = 3;
const ENDING_DEMO_GAP = 15;
const BOSS_ACTOR_WALK_FRAMES: readonly EnemyThreatFrame[] = [
  "walk-0",
  "walk-1",
  "walk-2",
  "walk-3",
];

interface ThreatView {
  container: Phaser.GameObjects.Container;
  graphics: Phaser.GameObjects.Graphics;
}

export class GameViewAdapter {
  readonly playerTarget: Phaser.GameObjects.Container;

  private readonly playerSprite: Phaser.GameObjects.Sprite;
  private readonly tutorialText: Phaser.GameObjects.Graphics;
  private readonly restartPrompt: Phaser.GameObjects.Graphics;
  private readonly enemyViews = new Map<string, ThreatView>();
  private readonly bossActorViews = new Map<string, ThreatView>();
  private readonly waveGraphics: Phaser.GameObjects.Graphics;
  private readonly echoGraphics: Phaser.GameObjects.Graphics;
  private readonly hazardGraphics: Phaser.GameObjects.Graphics;
  private readonly floorHazardStrikeGraphics: Phaser.GameObjects.Graphics;
  private readonly bossCocoonGraphics: Phaser.GameObjects.Graphics;
  private readonly bossDeathGraphics: Phaser.GameObjects.Graphics;
  private readonly endingTextGraphics: Phaser.GameObjects.Graphics;
  private readonly terrainMechanismGraphics: Phaser.GameObjects.Graphics;
  private readonly mapScrollIndicatorGraphics: Phaser.GameObjects.Graphics;
  private currentTutorialPrompt = "";
  private currentEndingText = "";

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldDefinition,
  ) {
    this.echoGraphics = scene.add.graphics().setDepth(GAME_VIEW_DEPTH.echoes);
    this.waveGraphics = scene.add.graphics().setDepth(GAME_VIEW_DEPTH.waves);
    this.hazardGraphics = scene.add.graphics().setDepth(GAME_VIEW_DEPTH.hazards);
    this.floorHazardStrikeGraphics = scene.add
      .graphics()
      .setDepth(GAME_VIEW_DEPTH.floorHazardStrikes);
    this.bossCocoonGraphics = scene.add
      .graphics()
      .setDepth(GAME_VIEW_DEPTH.bossCocoon);
    this.bossDeathGraphics = scene.add
      .graphics()
      .setDepth(GAME_VIEW_DEPTH.bossDeath);
    this.terrainMechanismGraphics = scene.add
      .graphics()
      .setDepth(GAME_VIEW_DEPTH.terrainMechanisms);
    this.mapScrollIndicatorGraphics = scene.add
      .graphics()
      .setDepth(GAME_VIEW_DEPTH.mapScrollIndicator)
      .setScrollFactor(1, 0);
    this.mapScrollIndicatorGraphics.fillStyle(
      TERRAIN_ECHO_COLOR,
      MAP_SCROLL_INDICATOR_ALPHA,
    );
    this.endingTextGraphics = scene.add
      .graphics()
      .setDepth(GAME_VIEW_DEPTH.overlay)
      .setScrollFactor(0);
    for (const dot of createMapScrollIndicatorDots(
      world.width,
      scene.cameras.main.height,
    )) {
      this.mapScrollIndicatorGraphics.fillRect(
        dot.x,
        dot.y,
        MAP_SCROLL_INDICATOR_DOT_SIZE,
        MAP_SCROLL_INDICATOR_DOT_SIZE,
      );
    }
    this.playerSprite = scene.add
      .sprite(0, PLAYER_CONFIG.height / 2, ASSET_KEYS.player.idle)
      .setOrigin(0.5, PLAYER_SPRITE_FEET_Y / PLAYER_SPRITE_FRAME.height)
      .setScale(PLAYER_SPRITE_DISPLAY_SCALE);
    this.tutorialText = scene.add.graphics();
    this.restartPrompt = scene.add
      .graphics()
      .setDepth(GAME_VIEW_DEPTH.overlay)
      .setScrollFactor(0)
      .setAlpha(0);
    const restartPrompt = createCenteredRestartPrompt(
      scene.cameras.main.width,
      scene.cameras.main.height,
    );
    this.restartPrompt.fillStyle(0x030608, 0.9);
    for (const cell of restartPrompt.cells) {
      this.restartPrompt.fillRect(
        restartPrompt.originX +
          cell.x * DEATH_RESTART_PROMPT_PIXEL_SIZE +
          DEATH_RESTART_PROMPT_PIXEL_SIZE,
        restartPrompt.originY +
          cell.y * DEATH_RESTART_PROMPT_PIXEL_SIZE +
          DEATH_RESTART_PROMPT_PIXEL_SIZE,
        DEATH_RESTART_PROMPT_PIXEL_SIZE,
        DEATH_RESTART_PROMPT_PIXEL_SIZE,
      );
    }
    this.restartPrompt.fillStyle(0xeaffff, 1);
    for (const cell of restartPrompt.cells) {
      this.restartPrompt.fillRect(
        restartPrompt.originX + cell.x * DEATH_RESTART_PROMPT_PIXEL_SIZE,
        restartPrompt.originY + cell.y * DEATH_RESTART_PROMPT_PIXEL_SIZE,
        DEATH_RESTART_PROMPT_PIXEL_SIZE,
        DEATH_RESTART_PROMPT_PIXEL_SIZE,
      );
    }
    this.playerTarget = scene.add
      .container(world.playerSpawn.x, world.playerSpawn.y, [
        this.playerSprite,
        this.tutorialText,
      ])
      .setDepth(GAME_VIEW_DEPTH.player);

    for (const spawn of world.enemies) {
      const graphics = scene.add.graphics();
      const container = scene.add
        .container(spawn.position.x, spawn.position.y, [graphics])
        .setDepth(GAME_VIEW_DEPTH.enemies)
        .setVisible(false);
      this.enemyViews.set(spawn.id, { container, graphics });
    }
  }

  sync(state: GameState): void {
    this.drawPlayer(state.player);
    this.drawTutorialText(state);
    this.restartPrompt.setAlpha(resolveDeathRestartPromptAlpha(state.player));
    this.drawEnemies(state);
    this.drawBossCocoon(state);
    this.drawBossActors(state);
    this.drawBossDeath(state);
    this.drawEndingText(state);
    this.drawTerrainMechanisms(state);
    this.drawHazards(state);
    this.drawEchoes(state);
    this.drawWaves(state);
  }

  private drawTutorialText(state: GameState): void {
    const section = this.world.tutorialSections?.[state.tutorialStep];
    const prompt = state.player.action === "dead" ? "" : (section?.prompt ?? "");
    if (prompt === this.currentTutorialPrompt) return;
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

  destroy(): void {
    this.playerTarget.destroy(true);
    this.restartPrompt.destroy();
    for (const view of this.enemyViews.values()) {
      view.container.destroy(true);
    }
    this.enemyViews.clear();
    for (const view of this.bossActorViews.values()) {
      view.container.destroy(true);
    }
    this.bossActorViews.clear();
    this.waveGraphics.destroy();
    this.echoGraphics.destroy();
    this.hazardGraphics.destroy();
    this.bossCocoonGraphics.destroy();
    this.bossDeathGraphics.destroy();
    this.endingTextGraphics.destroy();
    this.terrainMechanismGraphics.destroy();
    this.mapScrollIndicatorGraphics.destroy();
  }

  private drawTerrainMechanisms(state: GameState): void {
    this.terrainMechanismGraphics.clear();
    for (const definition of this.world.terrain) {
      if (definition.kind !== TERRAIN_KINDS.button) continue;
      const terrain = state.terrain.find((candidate) => candidate.id === definition.id);
      if (!terrain || terrain.echoTime <= 0) continue;
      const alpha = Math.min(
        1,
        terrain.echoTime / Math.max(terrain.echoDuration, 0.001),
      );
      const bounds = resolveTerrainBounds(definition, terrain);
      const pressDepth = bounds.y - definition.bounds.y;
      if (pressDepth > 0) {
        const guideWidth = Math.min(
          BUTTON_PRESS_GUIDE_WIDTH,
          definition.bounds.width / 2,
        );
        this.terrainMechanismGraphics.fillStyle(TRIGGER_COLOR, alpha * 0.3);
        this.terrainMechanismGraphics.fillRect(
          definition.bounds.x,
          definition.bounds.y,
          guideWidth,
          pressDepth,
        );
        this.terrainMechanismGraphics.fillRect(
          definition.bounds.x + definition.bounds.width - guideWidth,
          definition.bounds.y,
          guideWidth,
          pressDepth,
        );
      }
      this.terrainMechanismGraphics.fillStyle(TRIGGER_COLOR, alpha);
      this.terrainMechanismGraphics.fillRect(
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
      );
    }
  }

  private drawHazards(state: GameState): void {
    this.hazardGraphics.clear();
    this.floorHazardStrikeGraphics.clear();
    for (const hazard of state.hazards) {
      if (
        hazard.kind === HAZARD_KINDS.lethal ||
        hazard.kind === HAZARD_KINDS.damagingFloor
      ) {
        const extension = resolveFloorHazardStrikeExtension(hazard);
        if (extension !== null) {
          this.floorHazardStrikeGraphics.fillStyle(THREAT_COLOR, 1);
          for (const cell of createFloorHazardStrikeCells(
            hazard.bounds.width,
            extension,
            hazard.reactionOffsetX,
          )) {
            this.floorHazardStrikeGraphics.fillRect(
              hazard.bounds.x + cell.x * THREAT_PIXEL_SIZE,
              hazard.bounds.y + cell.y * THREAT_PIXEL_SIZE,
              THREAT_PIXEL_SIZE,
              THREAT_PIXEL_SIZE,
            );
          }
        }
        continue;
      }
      if (hazard.kind === HAZARD_KINDS.electric) {
        if (!hazard.activated) continue;
        this.hazardGraphics.fillStyle(THREAT_COLOR, 1);
        for (const cell of createHazardThreatCells(
          hazard.bounds.width,
          hazard.bounds.height,
        )) {
          this.hazardGraphics.fillRect(
            hazard.bounds.x + cell.x * THREAT_PIXEL_SIZE,
            hazard.bounds.y + cell.y * THREAT_PIXEL_SIZE,
            THREAT_PIXEL_SIZE,
            THREAT_PIXEL_SIZE,
          );
        }
        const lightningHeight = Math.max(
          0,
          this.world.height - hazard.bounds.y - hazard.bounds.height,
        );
        const phase = Math.floor(
          state.elapsedTime * ELECTRIC_LIGHTNING_FRAME_RATE,
        ) % ELECTRIC_LIGHTNING_FRAME_COUNT;
        for (const cell of createElectricHazardLightningCells(
          hazard.bounds.width,
          lightningHeight,
          phase,
        )) {
          this.hazardGraphics.fillRect(
            hazard.bounds.x + cell.x * THREAT_PIXEL_SIZE,
            hazard.bounds.y + hazard.bounds.height + cell.y * THREAT_PIXEL_SIZE,
            THREAT_PIXEL_SIZE,
            THREAT_PIXEL_SIZE,
          );
        }
        continue;
      }
      if (hazard.echoTime <= 0) {
        continue;
      }

      const alpha = Math.min(
        1,
        hazard.echoTime / Math.max(hazard.echoDuration, 0.001),
      );
      this.hazardGraphics.fillStyle(THREAT_COLOR, alpha);
      for (const cell of createHazardThreatCells(
        hazard.bounds.width,
        hazard.bounds.height,
      )) {
        this.hazardGraphics.fillRect(
          hazard.bounds.x + cell.x * THREAT_PIXEL_SIZE,
          hazard.bounds.y + cell.y * THREAT_PIXEL_SIZE,
          THREAT_PIXEL_SIZE,
          THREAT_PIXEL_SIZE,
        );
      }

      const reactionFrame = resolveHazardReactionFrame(hazard);
      if (reactionFrame) {
        this.hazardGraphics.fillStyle(THREAT_COLOR, Math.min(1, alpha + 0.2));
        for (const cell of createHazardDamageLightningCells(
          hazard.bounds.width,
          hazard.bounds.height,
          reactionFrame,
          hazard.reactionSide,
          hazard.reactionOffsetY,
        )) {
          this.hazardGraphics.fillRect(
            hazard.bounds.x + cell.x * THREAT_PIXEL_SIZE,
            hazard.bounds.y + cell.y * THREAT_PIXEL_SIZE,
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
    for (const view of this.enemyViews.values()) {
      view.container.setVisible(false);
    }
    for (const enemy of state.enemies) {
      if (!isEnemyBodyPresent(this.world, enemy)) continue;
      const view = this.ensureThreatView(this.enemyViews, enemy.id);
      let renderX = enemy.position.x;
      let renderY = enemy.position.y;
      const phaseThree = state.bossEncounter?.phaseThree;
      if (
        enemy.kind === ENEMY_KINDS.ravenBoss &&
        phaseThree?.mode === "death-shake"
      ) {
        const offset = resolveBossDeathShakeOffset(phaseThree.modeTime);
        renderX += offset.x;
        renderY += offset.y;
      }
      view.container.setPosition(renderX, renderY);
      const visible = enemy.echoTime > 0;
      view.container.setVisible(visible);
      if (!visible) {
        continue;
      }

      let alpha = Math.min(
        1,
        enemy.echoTime / Math.max(enemy.echoDuration, 0.001),
      );
      if (
        enemy.kind === ENEMY_KINDS.ravenBoss &&
        phaseThree?.mode === "intro"
      ) {
        alpha *= Math.min(
          1,
          phaseThree.modeTime / STAGE_TWO_CONFIG.phaseThreeIntroSeconds,
        );
      }
      this.drawEnemy(view.graphics, enemy, state.elapsedTime, alpha);
    }
  }

  private drawBossDeath(state: GameState): void {
    this.bossDeathGraphics.clear();
    const phaseThree = state.bossEncounter?.phaseThree;
    if (!phaseThree || phaseThree.deathPieces.length === 0) return;
    for (const piece of phaseThree.deathPieces) {
      const life = resolveBossDeathPieceAlpha(piece);
      this.bossDeathGraphics.fillStyle(THREAT_COLOR, life);
      const originX = Math.round(piece.position.x / THREAT_PIXEL_SIZE) *
        THREAT_PIXEL_SIZE;
      const originY = Math.round(piece.position.y / THREAT_PIXEL_SIZE) *
        THREAT_PIXEL_SIZE;
      for (const cell of createBossDeathPieceCells(piece)) {
        this.bossDeathGraphics.fillRect(
          originX + cell.x * THREAT_PIXEL_SIZE,
          originY + cell.y * THREAT_PIXEL_SIZE,
          THREAT_PIXEL_SIZE,
          THREAT_PIXEL_SIZE,
        );
      }
    }
  }

  private drawEndingText(state: GameState): void {
    const endingTime = state.bossEncounter?.phaseThree?.endingTime ?? null;
    const text = resolveBossEndingText(endingTime);
    this.endingTextGraphics.setAlpha(resolveBossEndingAlpha(endingTime));
    if (text === this.currentEndingText) return;
    this.currentEndingText = text;
    this.endingTextGraphics.clear();
    if (!text) return;
    const pixels = rasterizePixelText(text);
    const originX = Math.floor(
      (this.scene.cameras.main.width - pixels.width * ENDING_TEXT_PIXEL_SIZE) / 2,
    );
    const originY = Math.floor(
      (this.scene.cameras.main.height - pixels.height * ENDING_TEXT_PIXEL_SIZE) / 2,
    );
    const demoPixels = rasterizePixelText("(Demo)", true);
    const demoOriginX = Math.floor(
      (this.scene.cameras.main.width -
        demoPixels.width * ENDING_DEMO_PIXEL_SIZE) / 2,
    );
    const demoOriginY =
      originY - demoPixels.height * ENDING_DEMO_PIXEL_SIZE - ENDING_DEMO_GAP;
    this.drawEndingLabel(
      demoPixels,
      demoOriginX,
      demoOriginY,
      ENDING_DEMO_PIXEL_SIZE,
    );
    this.drawEndingLabel(
      pixels,
      originX,
      originY,
      ENDING_TEXT_PIXEL_SIZE,
    );
  }

  private drawEndingLabel(
    pixels: ReturnType<typeof rasterizePixelText>,
    originX: number,
    originY: number,
    pixelSize: number,
  ): void {
    this.endingTextGraphics.fillStyle(0x030608, 0.9);
    for (const cell of pixels.cells) {
      this.endingTextGraphics.fillRect(
        originX + cell.x * pixelSize + ENDING_TEXT_SHADOW_OFFSET,
        originY + cell.y * pixelSize + ENDING_TEXT_SHADOW_OFFSET,
        pixelSize,
        pixelSize,
      );
    }
    this.endingTextGraphics.fillStyle(0xeaffff, 1);
    for (const cell of pixels.cells) {
      this.endingTextGraphics.fillRect(
        originX + cell.x * pixelSize,
        originY + cell.y * pixelSize,
        pixelSize,
        pixelSize,
      );
    }
  }

  private drawBossCocoon(state: GameState): void {
    this.bossCocoonGraphics.clear();
    const encounter = state.bossEncounter;
    const phaseThree = state.bossEncounter?.phaseThree;
    const boss = encounter
      ? state.enemies.find((enemy) => enemy.id === encounter.bossId)
      : undefined;
    if (
      !phaseThree ||
      phaseThree.mode !== "intro" ||
      !boss ||
      boss.echoTime <= 0
    ) return;
    const progress = Math.min(
      1,
      phaseThree.modeTime / STAGE_TWO_CONFIG.phaseThreeIntroSeconds,
    );
    const echoAlpha = Math.min(
      1,
      boss.echoTime / Math.max(boss.echoDuration, 0.001),
    );
    this.bossCocoonGraphics.fillStyle(
      THREAT_COLOR,
      (1 - progress * 0.72) * echoAlpha,
    );
    for (const cell of createCrackedCocoonBossThreatCells(progress)) {
      this.bossCocoonGraphics.fillRect(
        phaseThree.cocoonPosition.x + cell.x * THREAT_PIXEL_SIZE,
        phaseThree.cocoonPosition.y + cell.y * THREAT_PIXEL_SIZE,
        THREAT_PIXEL_SIZE,
        THREAT_PIXEL_SIZE,
      );
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
    for (const cell of createEnemyThreatCells(frame, facing, enemy.kind)) {
      graphics.fillRect(
        cell.x * THREAT_PIXEL_SIZE,
        cell.y * THREAT_PIXEL_SIZE,
        THREAT_PIXEL_SIZE,
        THREAT_PIXEL_SIZE,
      );
    }
  }

  private drawBossActors(state: GameState): void {
    const actors = state.bossEncounter?.actors ?? [];
    const activeIds = new Set(actors.map((actor) => actor.id));
    for (const [id, view] of this.bossActorViews) {
      if (activeIds.has(id)) continue;
      view.container.destroy(true);
      this.bossActorViews.delete(id);
    }

    for (const actor of actors) {
      const view = this.ensureThreatView(this.bossActorViews, actor.id);
      const visible = actor.age >= 0;
      view.container
        .setPosition(actor.position.x, actor.position.y)
        .setVisible(visible);
      if (!visible) continue;
      this.drawBossActor(view.graphics, actor, state.elapsedTime);
    }
  }

  private ensureThreatView(
    views: Map<string, ThreatView>,
    id: string,
  ): ThreatView {
    const existing = views.get(id);
    if (existing) return existing;
    const graphics = this.scene.add.graphics();
    const view = {
      graphics,
      container: this.scene.add
        .container(0, 0, [graphics])
        .setDepth(GAME_VIEW_DEPTH.enemies)
        .setVisible(false),
    };
    views.set(id, view);
    return view;
  }

  private drawBossActor(
    graphics: Phaser.GameObjects.Graphics,
    actor: BossActorState,
    elapsedSeconds: number,
  ): void {
    const warningProgress = actor.launchDelay > 0
      ? actor.age / actor.launchDelay
      : 1;
    const frame: EnemyThreatFrame =
      actor.kind === "pattern" && actor.age < actor.launchDelay
        ? warningProgress < 0.55
          ? "alert-0"
          : "alert-1"
        : BOSS_ACTOR_WALK_FRAMES[
            Math.floor(elapsedSeconds * 10) % BOSS_ACTOR_WALK_FRAMES.length
          ];
    graphics.clear();
    graphics.fillStyle(THREAT_COLOR, 1);
    for (const cell of createEnemyThreatCells(
      frame,
      actor.facing,
      ENEMY_KINDS.waker,
    )) {
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
      if (mark.surfaceKind === "hazard") {
        const hazard = state.hazards.find(
          (candidate) => candidate.id === mark.surfaceId,
        );
        if (!hazard) continue;

        const minimumX = Math.min(mark.start.x, mark.end.x);
        const maximumX = Math.max(mark.start.x, mark.end.x);
        const minimumY = Math.min(mark.start.y, mark.end.y);
        const maximumY = Math.max(mark.start.y, mark.end.y);
        const horizontal = maximumX - minimumX >= maximumY - minimumY;
        this.echoGraphics.fillStyle(ECHO_MARK_COLORS.hazard, alpha);
        for (const cell of createFloorHazardThreatCells(hazard.id)) {
          const worldX = hazard.bounds.x + cell.x * THREAT_PIXEL_SIZE;
          const worldY = hazard.bounds.y + cell.y * THREAT_PIXEL_SIZE;
          const insideRevealedSurface = horizontal
            ? worldX + THREAT_PIXEL_SIZE >= minimumX && worldX <= maximumX
            : worldY + THREAT_PIXEL_SIZE >= minimumY && worldY <= maximumY;
          if (!insideRevealedSurface) continue;
          this.echoGraphics.fillRect(
            worldX,
            worldY,
            THREAT_PIXEL_SIZE,
            THREAT_PIXEL_SIZE,
          );
        }
        continue;
      }
      this.drawPixelLine(
        this.echoGraphics,
        mark.start.x,
        mark.start.y,
        mark.end.x,
        mark.end.y,
        ECHO_MARK_COLORS.terrain,
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
