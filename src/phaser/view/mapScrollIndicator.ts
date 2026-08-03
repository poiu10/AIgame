export interface MapScrollIndicatorDot {
  x: number;
  y: number;
}

export const MAP_SCROLL_INDICATOR_DOT_SIZE = 3;
export const MAP_SCROLL_INDICATOR_SPACING = 15;
export const MAP_SCROLL_INDICATOR_EDGE_INSET = 6;

export function createMapScrollIndicatorDots(
  worldWidth: number,
  viewportHeight: number,
): MapScrollIndicatorDot[] {
  const maximumInset = Math.max(
    0,
    Math.floor(
      (viewportHeight - MAP_SCROLL_INDICATOR_DOT_SIZE) / 2,
    ),
  );
  const edgeInset = Math.min(MAP_SCROLL_INDICATOR_EDGE_INSET, maximumInset);
  const topY = edgeInset;
  const bottomY = Math.max(
    topY,
    viewportHeight - MAP_SCROLL_INDICATOR_DOT_SIZE - edgeInset,
  );
  const maximumX = Math.max(0, worldWidth - MAP_SCROLL_INDICATOR_DOT_SIZE);
  const dots: MapScrollIndicatorDot[] = [];

  for (let x = 0; x <= maximumX; x += MAP_SCROLL_INDICATOR_SPACING) {
    dots.push({ x, y: topY }, { x, y: bottomY });
  }
  return dots;
}
