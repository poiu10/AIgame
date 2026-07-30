export const WORLD_UNITS_PER_ART_PIXEL = 1.5;

export const PIXEL_LINE_WIDTH = WORLD_UNITS_PER_ART_PIXEL;
export const PIXEL_BOLD_LINE_WIDTH = WORLD_UNITS_PER_ART_PIXEL * 2;

export function quantizePixelAlpha(alpha: number, steps = 8): number {
  const clamped = Math.max(0, Math.min(1, alpha));
  if (clamped === 0) {
    return 0;
  }
  return Math.ceil(clamped * steps) / steps;
}
