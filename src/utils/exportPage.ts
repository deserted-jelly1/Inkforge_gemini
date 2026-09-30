import { jsPDF } from 'jspdf';
import { PageData, BackgroundPattern, StrokeData, TextNoteContainer } from '../types/inkforge';
import { computeDynamicWidth } from './spline';

export interface PageExportBounds {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

/**
 * Splits text into wrapped lines that fit within available container width.
 */
export function wrapTextLines(
  text: string,
  maxWidth: number,
  font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
): string[] {
  if (!text) return [];

  const maxLineWidth = Math.max(80, maxWidth - 16); // 8px left and right padding
  let measureTextWidth = (str: string) => str.length * 7.5;

  if (typeof document !== 'undefined') {
    try {
      const measureCanvas = document.createElement('canvas');
      const mCtx = measureCanvas.getContext('2d');
      if (mCtx) {
        mCtx.font = font;
        measureTextWidth = (str: string) => mCtx.measureText(str).width;
      }
    } catch {
      // Fallback to character length estimate
    }
  }

  const resultLines: string[] = [];
  const paragraphs = text.split('\n');

  for (const para of paragraphs) {
    if (!para) {
      resultLines.push('');
      continue;
    }

    const words = para.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = measureTextWidth(testLine);

      if (testWidth <= maxLineWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          resultLines.push(currentLine);
          currentLine = word;
        } else {
          // Word itself is wider than available width; push word directly
          resultLines.push(word);
          currentLine = '';
        }
      }
    }

    if (currentLine) {
      resultLines.push(currentLine);
    }
  }

  return resultLines;
}

/**
 * Computes exact content bounds including negative coordinates and measured text note wraps.
 */
export function computePageContentBounds(page: PageData): PageExportBounds {
  const margin = 60;
  // Page title starts at (72, 32)
  let minX = 72 - margin;
  let minY = 32 - margin;
  let maxX = 850; // standard document width minimum
  let maxY = 1100; // standard document height minimum

  // Include all strokes (including negative coordinates)
  for (const stroke of page.strokes) {
    if (stroke.bounds) {
      if (stroke.bounds.minX - margin < minX) minX = stroke.bounds.minX - margin;
      if (stroke.bounds.minY - margin < minY) minY = stroke.bounds.minY - margin;
      if (stroke.bounds.maxX + margin > maxX) maxX = stroke.bounds.maxX + margin;
      if (stroke.bounds.maxY + margin > maxY) maxY = stroke.bounds.maxY + margin;
    }
  }

  // Include text containers with exact wrapped height
  if (page.textNotes) {
    for (const note of page.textNotes) {
      if (note.x - margin < minX) minX = note.x - margin;
      if (note.y - margin < minY) minY = note.y - margin;

      const noteRight = note.x + note.width + margin;
      const wrappedLines = wrapTextLines(note.text, note.width);
      const lineHeight = 18;
      const measuredHeight = Math.max(50, wrappedLines.length * lineHeight + 24);
      const noteBottom = note.y + measuredHeight + margin;

      if (noteRight > maxX) maxX = noteRight;
      if (noteBottom > maxY) maxY = noteBottom;
    }
  }

  // Round bounds, preserving negative coordinates
  minX = Math.floor(minX);
  minY = Math.floor(minY);
  const width = Math.max(600, Math.ceil(maxX - minX));
  const height = Math.max(800, Math.ceil(maxY - minY));

  return { minX, minY, width, height };
}

/**
 * Renders page to a standalone canvas at the given resolution scale.
 */
export function renderPageToCanvas(page: PageData, scale = 2): HTMLCanvasElement {
  const bounds = computePageContentBounds(page);

  // Guard against browser maximum canvas limits (typically 16384px)
  const maxDimension = 16384;
  let effectiveScale = scale;
  if (bounds.width * effectiveScale > maxDimension || bounds.height * effectiveScale > maxDimension) {
    effectiveScale = Math.min(maxDimension / bounds.width, maxDimension / bounds.height);
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(bounds.width * effectiveScale);
  canvas.height = Math.ceil(bounds.height * effectiveScale);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to allocate 2D context for page export.');
  }

  // Scale and translate so bounds.minX, bounds.minY maps to (0, 0)
  ctx.scale(effectiveScale, effectiveScale);
  ctx.translate(-bounds.minX, -bounds.minY);

  // 1. Pristine paper background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(bounds.minX, bounds.minY, bounds.width, bounds.height);

  // 2. Paper Pattern
  const spacing = page.gridSpacing || 28;
  const headerWorldY = 120;

  if (page.backgroundPattern === 'lined') {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    const startY = Math.ceil(Math.max(headerWorldY, bounds.minY) / spacing) * spacing;
    for (let y = startY; y <= bounds.minY + bounds.height; y += spacing) {
      ctx.moveTo(bounds.minX, y);
      ctx.lineTo(bounds.minX + bounds.width, y);
    }
    ctx.stroke();

    // Margin guide line
    const marginX = 72;
    if (marginX >= bounds.minX && marginX <= bounds.minX + bounds.width) {
      ctx.strokeStyle = '#fecdd3';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(marginX, Math.max(headerWorldY, bounds.minY));
      ctx.lineTo(marginX, bounds.minY + bounds.height);
      ctx.stroke();
    }
  } else if (page.backgroundPattern === 'grid') {
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    const startX = Math.ceil(bounds.minX / spacing) * spacing;
    for (let x = startX; x <= bounds.minX + bounds.width; x += spacing) {
      ctx.moveTo(x, bounds.minY);
      ctx.lineTo(x, bounds.minY + bounds.height);
    }
    const startY = Math.ceil(bounds.minY / spacing) * spacing;
    for (let y = startY; y <= bounds.minY + bounds.height; y += spacing) {
      ctx.moveTo(bounds.minX, y);
      ctx.lineTo(bounds.minX + bounds.width, y);
    }
    ctx.stroke();
  } else if (page.backgroundPattern === 'dotgrid') {
    ctx.fillStyle = '#cbd5e1';
    const dotRadius = 1.0;
    const startX = Math.ceil(bounds.minX / spacing) * spacing;
    const startY = Math.ceil(bounds.minY / spacing) * spacing;
    for (let x = startX; x <= bounds.minX + bounds.width; x += spacing) {
      for (let y = startY; y <= bounds.minY + bounds.height; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 3. Page Header: Title and Date
  const headerX = 72;
  const headerY = 60;
  ctx.fillStyle = '#0f172a';
  ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(page.title || 'Untitled page', headerX, headerY);

  const formattedDate = new Date(page.createdAt).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = new Date(page.createdAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  ctx.fillStyle = '#64748b';
  ctx.font = '400 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${formattedDate}  ·  ${formattedTime}`, headerX, headerY + 22);

  // Horizontal divider line
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.moveTo(headerX, headerY + 34);
  ctx.lineTo(Math.max(bounds.minX + bounds.width - 40, headerX + 600), headerY + 34);
  ctx.stroke();

  // 4. Render Vector Strokes (highlighters at displayed baseWidth, matching canvas)
  for (const stroke of page.strokes) {
    const pts = stroke.smoothedPoints || stroke.points;
    if (pts.length < 2) {
      if (pts.length === 1) {
        // Dot tap
        ctx.fillStyle = stroke.color;
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, stroke.baseWidth * 0.75, 0, Math.PI * 2);
        ctx.fill();
      }
      continue;
    }

    if (stroke.tool === 'highlighter') {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.strokeStyle = stroke.color;
      ctx.globalAlpha = 0.35;
      // Highlighters unified with canvas: displayed at stroke.baseWidth
      ctx.lineWidth = stroke.baseWidth;
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; ++i) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = stroke.color;

      for (let i = 0; i < pts.length - 1; ++i) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const avgPressure = (p1.pressure + p2.pressure) * 0.5;
        const dynWidth = computeDynamicWidth(stroke.baseWidth, avgPressure, stroke.tool);

        ctx.lineWidth = dynWidth;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  }

  // 5. Render Typed Text Notes with exact word wrapping
  if (page.textNotes) {
    for (const note of page.textNotes) {
      if (!note.text.trim()) continue;

      ctx.save();
      const wrappedLines = wrapTextLines(note.text, note.width);
      const lineHeight = 18;
      const containerHeight = Math.max(50, wrappedLines.length * lineHeight + 24);

      // Draw subtle background note container
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(note.x, note.y, note.width, containerHeight, 4);
      ctx.fill();
      ctx.stroke();

      // Text styling
      ctx.fillStyle = '#0f172a';
      ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

      for (let l = 0; l < wrappedLines.length; l++) {
        ctx.fillText(wrappedLines[l], note.x + 8, note.y + 20 + l * lineHeight);
      }
      ctx.restore();
    }
  }

  return canvas;
}

export function exportPageAsPNG(
  page: PageData,
  notebookTitle: string,
  onError?: (err: string) => void
): void {
  try {
    const canvas = renderPageToCanvas(page, 2);
    canvas.toBlob((blob) => {
      if (!blob) {
        onError?.('Failed to generate PNG image blob.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeTitle = (page.title || 'Untitled').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `InkForge_${notebookTitle.replace(/\s+/g, '_')}_${safeTitle}.png`;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  } catch (err: any) {
    onError?.(`Export PNG failed: ${err.message || 'Canvas size exceeded or memory error'}`);
  }
}

export function exportPageAsPDF(
  page: PageData,
  notebookTitle: string,
  onError?: (err: string) => void
): void {
  try {
    const canvas = renderPageToCanvas(page, 2);
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const bounds = computePageContentBounds(page);

    const orientation = bounds.width > bounds.height ? 'landscape' : 'portrait';
    const pdf = new jsPDF({
      orientation,
      unit: 'pt',
      format: [bounds.width, bounds.height],
    });

    pdf.addImage(imgData, 'JPEG', 0, 0, bounds.width, bounds.height);
    const safeTitle = (page.title || 'Untitled').replace(/[^a-zA-Z0-9_-]/g, '_');
    pdf.save(`InkForge_${notebookTitle.replace(/\s+/g, '_')}_${safeTitle}.pdf`);
  } catch (err: any) {
    onError?.(`Export PDF failed: ${err.message || 'Failed generating document'}`);
  }
}
