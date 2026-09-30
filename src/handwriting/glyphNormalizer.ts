import { CharacterSample, NormalizedGlyphSample } from './types';

/**
 * Normalizes raw captured character strokes into a standardized coordinate space
 * where baseline is y = 0, cap-height is y = -100, and x starts at x = leftSideBearing.
 */
export function normalizeGlyphSample(
  char: string,
  sample: CharacterSample
): NormalizedGlyphSample {
  const capHeightUnits = Math.max(20, sample.baselineY - sample.capHeightY);
  const scale = 100 / capHeightUnits;

  // Find tight bounding box across all points in sample
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const stroke of sample.strokes) {
    for (const pt of stroke.points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
  }

  // Handle special blank / space / zero-stroke sample
  if (!Number.isFinite(minX)) {
    minX = 0;
    maxX = 50;
    minY = sample.capHeightY;
    maxY = sample.baselineY;
  }

  // Determine side bearing based on character type
  const isPunctuation = ['.', ',', '!', '?', "'", '"', '-', ':', ';'].includes(char);
  const leftBearing = isPunctuation ? 8 : 12;
  const rightBearing = isPunctuation ? 10 : 14;

  const normalizedStrokes = sample.strokes.map((stroke) => ({
    baseWidth: stroke.baseWidth * scale,
    color: stroke.color,
    points: stroke.points.map((pt) => ({
      x: (pt.x - minX) * scale + leftBearing,
      y: (pt.y - sample.baselineY) * scale,
      pressure: pt.pressure,
      tiltX: pt.tiltX,
      tiltY: pt.tiltY,
      timestamp: pt.timestamp,
    })),
  }));

  const rawWidth = (maxX - minX) * scale;
  const advanceWidth = Math.max(30, rawWidth + leftBearing + rightBearing);

  return {
    char,
    sampleId: sample.id,
    advanceWidth,
    leftSideBearing: leftBearing,
    rightSideBearing: rightBearing,
    bounds: {
      minX: leftBearing,
      minY: (minY - sample.baselineY) * scale,
      maxX: leftBearing + rawWidth,
      maxY: (maxY - sample.baselineY) * scale,
    },
    strokes: normalizedStrokes,
  };
}
