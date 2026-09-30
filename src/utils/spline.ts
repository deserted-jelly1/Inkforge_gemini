import { VectorPoint } from '../types/inkforge';

/**
 * Centripetal Catmull-Rom Spline evaluator (alpha = 0.5)
 * Matches the C++ implementation in inkforge/src/ink/SplineCurve.cpp
 */
function getTime(tPrev: number, pPrev: VectorPoint, pCurr: VectorPoint, alpha = 0.5): number {
  const dx = pCurr.x - pPrev.x;
  const dy = pCurr.y - pPrev.y;
  const dSq = dx * dx + dy * dy;
  return tPrev + Math.pow(dSq, alpha * 0.5);
}

function interpolatePoint(
  a: VectorPoint,
  b: VectorPoint,
  ta: number,
  tb: number,
  tVal: number
): VectorPoint {
  if (Math.abs(tb - ta) < 1e-6) return a;
  const factor = (tVal - ta) / (tb - ta);
  return {
    x: a.x + (b.x - a.x) * factor,
    y: a.y + (b.y - a.y) * factor,
    pressure: a.pressure + (b.pressure - a.pressure) * factor,
    tiltX: a.tiltX + (b.tiltX - a.tiltX) * factor,
    tiltY: a.tiltY + (b.tiltY - a.tiltY) * factor,
    timestamp: Math.round(a.timestamp + (b.timestamp - a.timestamp) * factor),
  };
}

export function evaluateCentripetalCatmullRom(
  controlPoints: VectorPoint[],
  subdivisions = 8
): VectorPoint[] {
  if (controlPoints.length === 0) return [];
  if (controlPoints.length === 1) return [controlPoints[0]];
  if (controlPoints.length === 2) return [...controlPoints];

  const result: VectorPoint[] = [];
  const n = controlPoints.length;
  const alpha = 0.5;

  for (let i = 0; i < n - 1; ++i) {
    const p0 = i === 0 ? controlPoints[0] : controlPoints[i - 1];
    const p1 = controlPoints[i];
    const p2 = controlPoints[i + 1];
    const p3 = i + 2 < n ? controlPoints[i + 2] : controlPoints[n - 1];

    const t0 = 0.0;
    const t1 = getTime(t0, p0, p1, alpha);
    const t2 = getTime(t1, p1, p2, alpha);
    const t3 = getTime(t2, p2, p3, alpha);

    if (Math.abs(t2 - t1) < 1e-6) {
      result.push(p1);
      continue;
    }

    const steps = i === n - 2 ? subdivisions + 1 : subdivisions;
    for (let s = 0; s < steps; ++s) {
      const u = s / subdivisions;
      const t = t1 + u * (t2 - t1);

      const a1 = interpolatePoint(p0, p1, t0, t1, t);
      const a2 = interpolatePoint(p1, p2, t1, t2, t);
      const a3 = interpolatePoint(p2, p3, t2, t3, t);

      const b1 = interpolatePoint(a1, a2, t0, t2, t);
      const b2 = interpolatePoint(a2, a3, t1, t3, t);

      const c = interpolatePoint(b1, b2, t1, t2, t);
      result.push(c);
    }
  }

  return result;
}

export function computeDynamicWidth(baseWidth: number, pressure: number, tool: string): number {
  const p = Math.max(0.05, Math.min(1.0, pressure));
  if (tool === 'pen') {
    // Gamma 1.35 non-linear fountain pen dynamics
    return baseWidth * (0.35 + 0.65 * Math.pow(p, 1.35));
  }
  if (tool === 'highlighter') {
    return baseWidth * 3.5;
  }
  return baseWidth * 1.5;
}
