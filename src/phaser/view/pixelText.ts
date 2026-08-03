interface PixelGlyph {
  readonly rows: readonly string[];
  readonly width: number;
}

export interface PixelTextCell {
  readonly x: number;
  readonly y: number;
}

export interface RasterizedPixelText {
  readonly cells: readonly PixelTextCell[];
  readonly width: number;
  readonly height: number;
}

const GLYPH_HEIGHT = 7;
const GLYPH_SPACING = 1;

function glyph(...rows: string[]): PixelGlyph {
  return { rows, width: rows[0]?.length ?? 0 };
}

const PIXEL_GLYPHS: Readonly<Record<string, PixelGlyph>> = {
  " ": glyph("000", "000", "000", "000", "000", "000", "000"),
  "/": glyph("00001", "00010", "00100", "00100", "01000", "10000", "00000"),
  ".": glyph("000", "000", "000", "000", "000", "000", "010"),
  "?": glyph("01110", "10001", "00001", "00010", "00100", "00000", "00100"),
  A: glyph("01110", "10001", "10001", "11111", "10001", "10001", "10001"),
  B: glyph("11110", "10001", "10001", "11110", "10001", "10001", "11110"),
  C: glyph("01111", "10000", "10000", "10000", "10000", "10000", "01111"),
  D: glyph("11110", "10001", "10001", "10001", "10001", "10001", "11110"),
  E: glyph("11111", "10000", "10000", "11110", "10000", "10000", "11111"),
  F: glyph("11111", "10000", "10000", "11110", "10000", "10000", "10000"),
  G: glyph("01111", "10000", "10000", "10111", "10001", "10001", "01111"),
  H: glyph("10001", "10001", "10001", "11111", "10001", "10001", "10001"),
  I: glyph("11111", "00100", "00100", "00100", "00100", "00100", "11111"),
  J: glyph("00111", "00010", "00010", "00010", "10010", "10010", "01100"),
  K: glyph("10001", "10010", "10100", "11000", "10100", "10010", "10001"),
  L: glyph("10000", "10000", "10000", "10000", "10000", "10000", "11111"),
  M: glyph("10001", "11011", "10101", "10101", "10001", "10001", "10001"),
  N: glyph("10001", "11001", "10101", "10011", "10001", "10001", "10001"),
  O: glyph("01110", "10001", "10001", "10001", "10001", "10001", "01110"),
  P: glyph("11110", "10001", "10001", "11110", "10000", "10000", "10000"),
  Q: glyph("01110", "10001", "10001", "10001", "10101", "10010", "01101"),
  R: glyph("11110", "10001", "10001", "11110", "10100", "10010", "10001"),
  S: glyph("01111", "10000", "10000", "01110", "00001", "00001", "11110"),
  T: glyph("11111", "00100", "00100", "00100", "00100", "00100", "00100"),
  U: glyph("10001", "10001", "10001", "10001", "10001", "10001", "01110"),
  V: glyph("10001", "10001", "10001", "10001", "10001", "01010", "00100"),
  W: glyph("10001", "10001", "10001", "10101", "10101", "10101", "01010"),
  X: glyph("10001", "10001", "01010", "00100", "01010", "10001", "10001"),
  Y: glyph("10001", "10001", "01010", "00100", "00100", "00100", "00100"),
  Z: glyph("11111", "00001", "00010", "00100", "01000", "10000", "11111"),
};

export function rasterizePixelText(text: string): RasterizedPixelText {
  const glyphs = [...text.toUpperCase()].map(
    (character) => PIXEL_GLYPHS[character] ?? PIXEL_GLYPHS["?"],
  );
  const cells: PixelTextCell[] = [];
  let cursorX = 0;

  for (const [glyphIndex, currentGlyph] of glyphs.entries()) {
    for (const [y, row] of currentGlyph.rows.entries()) {
      for (const [x, value] of [...row].entries()) {
        if (value === "1") {
          cells.push({ x: cursorX + x, y });
        }
      }
    }
    cursorX += currentGlyph.width;
    if (glyphIndex < glyphs.length - 1) {
      cursorX += GLYPH_SPACING;
    }
  }

  return {
    cells,
    width: cursorX,
    height: glyphs.length > 0 ? GLYPH_HEIGHT : 0,
  };
}
