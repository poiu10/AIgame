export const SOUND_PIXEL_SIZE = 3;

export interface PixelCell {
  x: number;
  y: number;
}

interface Point {
  x: number;
  y: number;
}

export function getPixelThicknessOffsets(
  thicknessCells: number,
): readonly number[] {
  if (!Number.isInteger(thicknessCells) || thicknessCells <= 0) {
    throw new RangeError("thicknessCells must be a positive integer");
  }

  const firstOffset = -Math.floor(thicknessCells / 2);
  return Array.from(
    { length: thicknessCells },
    (_, index) => firstOffset + index,
  );
}

export function rasterizePixelLine(
  start: Point,
  end: Point,
  pixelSize = SOUND_PIXEL_SIZE,
): PixelCell[] {
  if (!Number.isFinite(pixelSize) || pixelSize <= 0) {
    throw new RangeError("pixelSize must be greater than zero");
  }

  let x = Math.floor(start.x / pixelSize);
  let y = Math.floor(start.y / pixelSize);
  const endX = Math.floor(end.x / pixelSize);
  const endY = Math.floor(end.y / pixelSize);
  const deltaX = Math.abs(endX - x);
  const stepX = x < endX ? 1 : -1;
  const deltaY = -Math.abs(endY - y);
  const stepY = y < endY ? 1 : -1;
  let error = deltaX + deltaY;
  const cells: PixelCell[] = [];

  while (true) {
    cells.push({ x: x * pixelSize, y: y * pixelSize });
    if (x === endX && y === endY) {
      return cells;
    }

    const doubledError = error * 2;
    if (doubledError >= deltaY) {
      error += deltaY;
      x += stepX;
    }
    if (doubledError <= deltaX) {
      error += deltaX;
      y += stepY;
    }
  }
}
