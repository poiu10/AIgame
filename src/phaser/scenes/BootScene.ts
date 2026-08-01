import Phaser from "phaser";
import {
  AUDIO_ASSETS,
  PLAYER_SPRITE_FRAME,
  PLAYER_SPRITESHEETS,
} from "../../game/assets/manifest";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    for (const sheet of Object.values(PLAYER_SPRITESHEETS)) {
      this.load.spritesheet(sheet.textureKey, sheet.path, {
        frameWidth: PLAYER_SPRITE_FRAME.width,
        frameHeight: PLAYER_SPRITE_FRAME.height,
      });
    }
    for (const asset of Object.values(AUDIO_ASSETS)) {
      this.load.audio(asset.key, asset.path);
    }
  }

  create(): void {
    for (const sheet of Object.values(PLAYER_SPRITESHEETS)) {
      this.textures
        .get(sheet.textureKey)
        .setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.anims.create({
        key: sheet.animationKey,
        frames: this.anims.generateFrameNumbers(sheet.textureKey, {
          start: 0,
          end: sheet.frameCount - 1,
        }),
        frameRate: sheet.frameRate,
        repeat: sheet.repeat,
      });
    }
    this.scene.start("game");
  }
}
