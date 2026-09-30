import { StrokeData, StrokeBounds } from '../types/inkforge';

/**
 * Calculates perpendicular distance from point (px, py) to line segment (x1, y1) -> (x2, y2).
 */
export function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const ddx = px - x1;
    const ddy = py - y1;
    return Math.sqrt(ddx * ddx + ddy * ddy);
  }

  // Projection parameter t
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  const diffX = px - projX;
  const diffY = py - projY;
  return Math.sqrt(diffX * diffX + diffY * diffY);
}

/**
 * Checks if a circular eraser at (worldX, worldY) with given radius intersects a stroke.
 * Uses segment-distance hit testing across smoothed or sampled points.
 */
export function strokeIntersectsEraser(
  stroke: StrokeData,
  worldX: number,
  worldY: number,
  eraserRadius: number
): boolean {
  // Quick AABB bounds rejection
  const b = stroke.bounds;
  const margin = eraserRadius + (stroke.baseWidth * 0.5);
  if (
    worldX < b.minX - margin ||
    worldX > b.maxX + margin ||
    worldY < b.minY - margin ||
    worldY > b.maxY + margin
  ) {
    return false;
  }

  const pts = stroke.smoothedPoints || stroke.points;
  if (pts.length === 0) return false;

  if (pts.length === 1) {
    const dx = pts[0].x - worldX;
    const dy = pts[0].y - worldY;
    return Math.sqrt(dx * dx + dy * dy) <= eraserRadius + stroke.baseWidth * 0.5;
  }

  for (let i = 0; i < pts.length - 1; i++) {
    const dist = distanceToSegment(
      worldX,
      worldY,
      pts[i].x,
      pts[i].y,
      pts[i + 1].x,
      pts[i + 1].y
    );
    if (dist <= eraserRadius + (stroke.baseWidth * 0.5)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a stroke's bounding box intersects the current viewport.
 */
export function isStrokeInViewport(
  bounds: StrokeBounds,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): boolean {
  return !(
    bounds.maxX < minX ||
    bounds.minX > maxX ||
    bounds.maxY < minY ||
    bounds.minY > maxY
  );
}
