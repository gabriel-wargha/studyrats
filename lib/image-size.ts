/** Longest side of an uploaded photo, in pixels. */
export const MAX_PHOTO_EDGE = 1600;
/** JPEG quality used when re-encoding on a canvas. */
export const JPEG_QUALITY = 0.8;

/**
 * Size to draw an image at so its long edge is at most `maxEdge`.
 * Keeps the aspect ratio, never scales up, and never returns less than 1 px.
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number = MAX_PHOTO_EDGE,
): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 1, height: 1 };
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) return { width: Math.round(width), height: Math.round(height) };
  const scale = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
