export interface MapScrollIndicatorDot {
  x: number;
  y: number;
}

export const MAP_SCROLL_INDICATOR_DOT_SIZE = 3;
export const MAP_SCROLL_INDICATOR_SPACING = 15;

export function createMapScrollIndicatorDots(
  worldWidth: number,
  worldHeight: number,
  viewportHeight: number,
): MapScrollIndicatorDot[] {
  const topY = Math.max(0, worldHeight - viewportHeight);
  const bottomY = Math.max(topY, worldHeight - MAP_SCROLL_INDICATOR_DOT_SIZE);
  const maximumX = Math.max(0, worldWidth - MAP_SCROLL_INDICATOR_DOT_SIZE);
  const dots: MapScrollIndicatorDot[] = [];

  for (let x = 0; x <= maximumX; x += MAP_SCROLL_INDICATOR_SPACING) {
    dots.push({ x, y: topY }, { x, y: bottomY });
  }
  return dots;
}
