import Phaser from "phaser";
import { WORLD_UNITS_PER_ART_PIXEL } from "./pixelStyle";

const GLYPHS: Record<string, readonly string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
};

const GLYPH_COLUMNS = 5;
const GLYPH_ROWS = 7;
const DOT_SIZE = WORLD_UNITS_PER_ART_PIXEL * 3;
const GLYPH_GAP = DOT_SIZE;
const OUTLINE_SIZE = WORLD_UNITS_PER_ART_PIXEL;
const TEXT_COLOR = 0xeaffff;
const OUTLINE_COLOR = 0x030608;

export class PixelLabel {
  readonly gameObject: Phaser.GameObjects.Graphics;

  private value = "";

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.gameObject = scene.add.graphics().setPosition(x, y);
  }

  setText(value: string): void {
    const normalized = value.toUpperCase();
    if (normalized === this.value) {
      return;
    }

    this.value = normalized;
    this.redraw();
  }

  private redraw(): void {
    const graphics = this.gameObject;
    graphics.clear();
    if (!this.value) {
      return;
    }

    const glyphWidth = GLYPH_COLUMNS * DOT_SIZE;
    const width =
      this.value.length * glyphWidth +
      Math.max(0, this.value.length - 1) * GLYPH_GAP;
    const startX = -width / 2;
    const startY = -GLYPH_ROWS * DOT_SIZE;

    graphics.fillStyle(OUTLINE_COLOR, 1);
    this.forEachDot((x, y) => {
      graphics.fillRect(
        startX + x - OUTLINE_SIZE,
        startY + y - OUTLINE_SIZE,
        DOT_SIZE + OUTLINE_SIZE * 2,
        DOT_SIZE + OUTLINE_SIZE * 2,
      );
    });

    graphics.fillStyle(TEXT_COLOR, 1);
    this.forEachDot((x, y) => {
      graphics.fillRect(startX + x, startY + y, DOT_SIZE, DOT_SIZE);
    });
  }

  private forEachDot(callback: (x: number, y: number) => void): void {
    const glyphAdvance = GLYPH_COLUMNS * DOT_SIZE + GLYPH_GAP;
    for (let characterIndex = 0; characterIndex < this.value.length; characterIndex += 1) {
      const character = this.value[characterIndex];
      if (character === " ") {
        continue;
      }
      const glyph = GLYPHS[character];
      if (!glyph) {
        continue;
      }
      for (let row = 0; row < GLYPH_ROWS; row += 1) {
        for (let column = 0; column < GLYPH_COLUMNS; column += 1) {
          if (glyph[row][column] === "1") {
            callback(
              characterIndex * glyphAdvance + column * DOT_SIZE,
              row * DOT_SIZE,
            );
          }
        }
      }
    }
  }
}
