import { jsPDF } from 'jspdf';
import {
  IHandwritingRenderer,
  LayoutOptions,
  LayoutPage,
  HandwritingProfile,
  NormalizedGlyphSample,
} from './types';
import { layoutTextWithProfile } from './textLayout';
import { evaluateCentripetalCatmullRom, computeDynamicWidth } from '../utils/spline';

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function parseHexColor(hex: string): [number, number, number] {
  let clean = (hex || '').replace('#', '');
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return [15, 23, 42];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export interface RenderSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
}

export interface RenderDot {
  x: number;
  y: number;
  radius: number;
}

export interface StrokeGeometry {
  color: string;
  dots: RenderDot[];
  segments: RenderSegment[];
}

/**
 * Shared stroke geometry generator ensuring identical coordinates,
 * pressure-dependent widths, and dot handling across canvas, SVG, and vector PDF.
 */
export function computeStrokeGeometry(
  sample: NormalizedGlyphSample,
  originX: number,
  originY: number,
  scale: number
): StrokeGeometry[] {
  const result: StrokeGeometry[] = [];

  for (const stroke of sample.strokes) {
    const dots: RenderDot[] = [];
    const segments: RenderSegment[] = [];
    const color = stroke.color || '#0f172a';

    if (stroke.points.length === 1) {
      // Single-point dot tap
      const pt = stroke.points[0];
      dots.push({
        x: originX + pt.x * scale,
        y: originY + pt.y * scale,
        radius: Math.max(0.75, stroke.baseWidth * scale * 0.5),
      });
    } else if (stroke.points.length >= 2) {
      const smoothed = evaluateCentripetalCatmullRom(stroke.points, 6);
      for (let i = 0; i < smoothed.length - 1; i++) {
        const p1 = smoothed[i];
        const p2 = smoothed[i + 1];
        const avgPressure = (p1.pressure + p2.pressure) * 0.5;
        const dynWidth = computeDynamicWidth(stroke.baseWidth * scale, avgPressure, 'pen');

        segments.push({
          x1: originX + p1.x * scale,
          y1: originY + p1.y * scale,
          x2: originX + p2.x * scale,
          y2: originY + p2.y * scale,
          width: dynWidth,
        });
      }
    }

    result.push({ color, dots, segments });
  }

  return result;
}

export class SampleBasedHandwritingRenderer implements IHandwritingRenderer {
  readonly name = 'Sample-based handwriting — experimental';
  readonly isGenerative = false;

  constructor(private profile: HandwritingProfile) {}

  layoutText(text: string, options: LayoutOptions): LayoutPage[] {
    return layoutTextWithProfile(text, this.profile, options);
  }

  renderToCanvas(page: LayoutPage, canvas: HTMLCanvasElement, scale = 2): void {
    canvas.width = Math.ceil(page.width * scale);
    canvas.height = Math.ceil(page.height * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);

    // Background paper
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, page.width, page.height);

    // Ruled baseline guides
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (const line of page.lines) {
      ctx.beginPath();
      ctx.moveTo(page.margins.left, line.baselineY);
      ctx.lineTo(page.width - page.margins.right, line.baselineY);
      ctx.stroke();
    }

    // Render Glyphs
    for (const line of page.lines) {
      for (const glyph of line.glyphs) {
        if (glyph.isMissing) {
          ctx.save();
          ctx.strokeStyle = '#f59e0b';
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1;
          const boxW = Math.max(14, 18 * glyph.scale);
          const boxH = Math.max(18, 24 * glyph.scale);
          ctx.strokeRect(glyph.x, glyph.y - boxH, boxW, boxH);

          ctx.fillStyle = '#b45309';
          ctx.font = `${Math.round(12 * glyph.scale)}px sans-serif`;
          ctx.fillText(glyph.char, glyph.x + 3, glyph.y - 4);
          ctx.restore();
          continue;
        }

        const sample = glyph.normalizedSample;
        if (!sample) continue;

        const geometries = computeStrokeGeometry(sample, glyph.x, glyph.y, glyph.scale);

        for (const geom of geometries) {
          // Render dots
          if (geom.dots.length > 0) {
            ctx.fillStyle = geom.color;
            for (const dot of geom.dots) {
              ctx.beginPath();
              ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Render variable-width segments
          if (geom.segments.length > 0) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = geom.color;
            for (const seg of geom.segments) {
              ctx.lineWidth = seg.width;
              ctx.beginPath();
              ctx.moveTo(seg.x1, seg.y1);
              ctx.lineTo(seg.x2, seg.y2);
              ctx.stroke();
            }
          }
        }
      }
    }
  }

  renderToSVG(page: LayoutPage): string {
    const elements: string[] = [];

    // Ruled lines in SVG
    for (const line of page.lines) {
      elements.push(
        `<line x1="${page.margins.left.toFixed(2)}" y1="${line.baselineY.toFixed(2)}" x2="${(page.width - page.margins.right).toFixed(2)}" y2="${line.baselineY.toFixed(2)}" stroke="#f1f5f9" stroke-width="1"/>`
      );
    }

    for (const line of page.lines) {
      for (const glyph of line.glyphs) {
        if (glyph.isMissing) {
          const boxW = Math.max(14, 18 * glyph.scale);
          const boxH = Math.max(18, 24 * glyph.scale);
          const safeChar = escapeXml(glyph.char);
          elements.push(
            `<rect x="${glyph.x.toFixed(2)}" y="${(glyph.y - boxH).toFixed(2)}" width="${boxW.toFixed(2)}" height="${boxH.toFixed(2)}" fill="none" stroke="#f59e0b" stroke-dasharray="3,3" stroke-width="1"/>` +
            `<text x="${(glyph.x + 3).toFixed(2)}" y="${(glyph.y - 4).toFixed(2)}" fill="#b45309" font-family="sans-serif" font-size="${Math.round(12 * glyph.scale)}">${safeChar}</text>`
          );
          continue;
        }

        const sample = glyph.normalizedSample;
        if (!sample) continue;

        const geometries = computeStrokeGeometry(sample, glyph.x, glyph.y, glyph.scale);

        for (const geom of geometries) {
          // Dots preserved in SVG
          for (const dot of geom.dots) {
            elements.push(
              `<circle cx="${dot.x.toFixed(2)}" cy="${dot.y.toFixed(2)}" r="${dot.radius.toFixed(2)}" fill="${geom.color}"/>`
            );
          }

          // Segments with pressure-dependent width in SVG
          for (const seg of geom.segments) {
            elements.push(
              `<line x1="${seg.x1.toFixed(2)}" y1="${seg.y1.toFixed(2)}" x2="${seg.x2.toFixed(2)}" y2="${seg.y2.toFixed(2)}" stroke="${geom.color}" stroke-width="${seg.width.toFixed(2)}" stroke-linecap="round"/>`
            );
          }
        }
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${page.width} ${page.height}" width="${page.width}pt" height="${page.height}pt">
  <rect width="100%" height="100%" fill="#ffffff"/>
  ${elements.join('\n  ')}
</svg>`;
  }
}

export function createVectorPDFDocument(
  pages: LayoutPage[],
  renderer: IHandwritingRenderer
): jsPDF {
  if (pages.length === 0) {
    return new jsPDF();
  }

  const firstPage = pages[0];
  const pdf = new jsPDF({
    orientation: firstPage.width > firstPage.height ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [firstPage.width, firstPage.height],
  });

  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    const page = pages[pIdx];
    if (pIdx > 0) {
      pdf.addPage(
        [page.width, page.height],
        page.width > page.height ? 'landscape' : 'portrait'
      );
    }

    // Background
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, page.width, page.height, 'F');

    // Vector ruled baseline lines
    pdf.setDrawColor(241, 245, 249);
    pdf.setLineDashPattern([], 0);
    pdf.setLineWidth(0.75);
    for (const line of page.lines) {
      pdf.line(page.margins.left, line.baselineY, page.width - page.margins.right, line.baselineY);
    }

    // Vector Glyphs
    for (const line of page.lines) {
      for (const glyph of line.glyphs) {
        if (glyph.isMissing) {
          const boxW = Math.max(14, 18 * glyph.scale);
          const boxH = Math.max(18, 24 * glyph.scale);

          pdf.setDrawColor(245, 158, 11);
          pdf.setLineDashPattern([2, 2], 0);
          pdf.setLineWidth(0.75);
          pdf.rect(glyph.x, glyph.y - boxH, boxW, boxH, 'S');

          pdf.setTextColor(180, 83, 9);
          pdf.setFontSize(Math.max(8, Math.round(10 * glyph.scale)));
          pdf.text(glyph.char, glyph.x + 3, glyph.y - 4);
          continue;
        }

        const sample = glyph.normalizedSample;
        if (!sample) continue;

        const geometries = computeStrokeGeometry(sample, glyph.x, glyph.y, glyph.scale);

        for (const geom of geometries) {
          const [r, g, b] = parseHexColor(geom.color);
          pdf.setFillColor(r, g, b);
          pdf.setDrawColor(r, g, b);
          pdf.setLineDashPattern([], 0);
          pdf.setLineCap(1);
          pdf.setLineJoin(1);

          // Vector dots
          for (const dot of geom.dots) {
            pdf.circle(dot.x, dot.y, dot.radius, 'F');
          }

          // Vector line segments with un-clamped dynamic width matching Canvas and SVG
          for (const seg of geom.segments) {
            pdf.setLineWidth(Math.max(0.05, seg.width));
            pdf.line(seg.x1, seg.y1, seg.x2, seg.y2);
          }
        }
      }
    }
  }

  return pdf;
}

/**
 * Exports multiple rendered pages into a genuine vector PDF.
 * Uses native vector line, circle, rect, and text PDF commands.
 */
export function exportPagesToPDF(
  pages: LayoutPage[],
  renderer: IHandwritingRenderer,
  documentTitle = 'Handwriting_Document'
): void {
  if (pages.length === 0) return;
  const pdf = createVectorPDFDocument(pages, renderer);
  const safeTitle = documentTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
  pdf.save(`InkForge_${safeTitle}.pdf`);
}
