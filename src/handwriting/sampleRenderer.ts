import { jsPDF } from 'jspdf';
import {
  IHandwritingRenderer,
  LayoutOptions,
  LayoutPage,
  HandwritingProfile,
} from './types';
import { layoutTextWithProfile } from './textLayout';
import { evaluateCentripetalCatmullRom, computeDynamicWidth } from '../utils/spline';

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

    // Reset transform to identity and clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.scale(scale, scale);

    // 1. Pristine paper background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, page.width, page.height);

    // 2. Subtle light ruled lines across text baselines
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (const line of page.lines) {
      ctx.beginPath();
      ctx.moveTo(page.margins.left, line.baselineY);
      ctx.lineTo(page.width - page.margins.right, line.baselineY);
      ctx.stroke();
    }

    // 3. Render Characters
    for (const line of page.lines) {
      for (const glyph of line.glyphs) {
        if (glyph.isMissing) {
          // Visible missing character indicator: dashed amber frame with character label
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

        ctx.save();
        ctx.translate(glyph.x, glyph.y);
        ctx.scale(glyph.scale, glyph.scale);

        for (const stroke of sample.strokes) {
          if (stroke.points.length < 2) {
            if (stroke.points.length === 1) {
              const pt = stroke.points[0];
              ctx.fillStyle = stroke.color || '#0f172a';
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, stroke.baseWidth * 0.7, 0, Math.PI * 2);
              ctx.fill();
            }
            continue;
          }

          const smoothed = evaluateCentripetalCatmullRom(stroke.points, 6);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = stroke.color || '#0f172a';

          for (let i = 0; i < smoothed.length - 1; i++) {
            const p1 = smoothed[i];
            const p2 = smoothed[i + 1];
            const avgPressure = (p1.pressure + p2.pressure) * 0.5;
            const dynWidth = computeDynamicWidth(stroke.baseWidth, avgPressure, 'pen');

            ctx.lineWidth = dynWidth;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }

        ctx.restore();
      }
    }
  }

  renderToSVG(page: LayoutPage): string {
    const paths: string[] = [];

    for (const line of page.lines) {
      for (const glyph of line.glyphs) {
        if (glyph.isMissing) {
          const boxW = Math.max(14, 18 * glyph.scale);
          const boxH = Math.max(18, 24 * glyph.scale);
          paths.push(
            `<rect x="${glyph.x.toFixed(2)}" y="${(glyph.y - boxH).toFixed(2)}" width="${boxW.toFixed(2)}" height="${boxH.toFixed(2)}" fill="none" stroke="#f59e0b" stroke-dasharray="3,3" stroke-width="1"/>` +
            `<text x="${(glyph.x + 3).toFixed(2)}" y="${(glyph.y - 4).toFixed(2)}" fill="#b45309" font-size="${Math.round(12 * glyph.scale)}">${glyph.char}</text>`
          );
          continue;
        }

        const sample = glyph.normalizedSample;
        if (!sample) continue;

        for (const stroke of sample.strokes) {
          if (stroke.points.length < 2) continue;
          const smoothed = evaluateCentripetalCatmullRom(stroke.points, 6);

          let d = '';
          for (let i = 0; i < smoothed.length; i++) {
            const sx = (glyph.x + smoothed[i].x * glyph.scale).toFixed(2);
            const sy = (glyph.y + smoothed[i].y * glyph.scale).toFixed(2);
            d += i === 0 ? `M ${sx} ${sy}` : ` L ${sx} ${sy}`;
          }

          const strokeWidth = (stroke.baseWidth * glyph.scale).toFixed(2);
          const color = stroke.color || '#0f172a';
          paths.push(
            `<path d="${d}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`
          );
        }
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${page.width} ${page.height}" width="${page.width}pt" height="${page.height}pt">
  <rect width="100%" height="100%" fill="#ffffff"/>
  ${paths.join('\n  ')}
</svg>`;
  }
}

/**
 * Exports multiple rendered pages into a downloadable multipage PDF.
 */
export function exportPagesToPDF(
  pages: LayoutPage[],
  renderer: IHandwritingRenderer,
  documentTitle = 'Handwriting_Document'
): void {
  if (pages.length === 0) return;

  const firstPage = pages[0];
  const pdf = new jsPDF({
    orientation: firstPage.width > firstPage.height ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [firstPage.width, firstPage.height],
  });

  const tempCanvas = document.createElement('canvas');

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) {
      pdf.addPage([pages[i].width, pages[i].height], pages[i].width > pages[i].height ? 'landscape' : 'portrait');
    }
    renderer.renderToCanvas(pages[i], tempCanvas, 2);
    const imgData = tempCanvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(imgData, 'JPEG', 0, 0, pages[i].width, pages[i].height);
  }

  const safeTitle = documentTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
  pdf.save(`InkForge_${safeTitle}.pdf`);
}
