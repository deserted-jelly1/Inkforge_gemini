import {
  HandwritingProfile,
  NormalizedGlyphSample,
  LayoutPage,
  LayoutLine,
  LayoutGlyph,
  LayoutOptions,
} from './types';
import { normalizeGlyphSample } from './glyphNormalizer';

/**
 * Fast deterministic string hash for stable sample selection.
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

export function layoutTextWithProfile(
  text: string,
  profile: HandwritingProfile,
  options: LayoutOptions
): LayoutPage[] {
  const {
    pageWidth,
    pageHeight,
    margins,
    fontSize,
    lineHeight,
    letterSpacing,
    wordSpacing,
  } = options;

  const printableWidth = pageWidth - margins.left - margins.right;
  const printableHeight = pageHeight - margins.top - margins.bottom;

  // Scale factor: glyphs are normalized to 100 units cap-height
  const glyphScale = fontSize / 100;
  const lineStep = fontSize * lineHeight;
  const spaceWidth = Math.max(12, fontSize * 0.42 * wordSpacing);

  // Pre-normalize all captured glyphs in profile into cache
  const normalizedCache = new Map<string, NormalizedGlyphSample[]>();
  for (const [char, samples] of Object.entries(profile.glyphs)) {
    if (samples && samples.length > 0) {
      normalizedCache.set(
        char,
        samples.map((s) => normalizeGlyphSample(char, s))
      );
    }
  }

  const pages: LayoutPage[] = [];
  let currentPageNumber = 1;
  let currentLines: LayoutLine[] = [];
  let currentMissing = new Set<string>();

  let currentBaselineY = margins.top + fontSize;
  let currentX = margins.left;
  let currentLineGlyphs: LayoutGlyph[] = [];

  const flushLine = () => {
    if (currentLineGlyphs.length > 0) {
      currentLines.push({
        glyphs: [...currentLineGlyphs],
        baselineY: currentBaselineY,
        width: currentX - margins.left,
      });
      currentLineGlyphs = [];
    }
    currentX = margins.left;
    currentBaselineY += lineStep;

    // Check if new line exceeds page height
    if (currentBaselineY > pageHeight - margins.bottom) {
      pages.push({
        pageNumber: currentPageNumber++,
        lines: [...currentLines],
        width: pageWidth,
        height: pageHeight,
        margins,
        missingChars: Array.from(currentMissing),
      });
      currentLines = [];
      currentMissing = new Set<string>();
      currentBaselineY = margins.top + fontSize;
    }
  };

  // Process text preserving exact paragraphs
  const paragraphs = text.split('\n');

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const paragraph = paragraphs[pIdx];

    // Empty paragraph line
    if (paragraph.length === 0) {
      flushLine();
      // Add extra paragraph spacing
      currentBaselineY += fontSize * 0.5;
      continue;
    }

    // Split paragraph into tokens (words and whitespace)
    const tokens = paragraph.split(/(\s+)/);
    let wordIndexInParagraph = 0;

    for (const token of tokens) {
      if (!token) continue;

      // Whitespace token
      if (/^\s+$/.test(token)) {
        // Space / Tab
        const spacesCount = token.replace(/\t/g, '    ').length;
        currentX += spaceWidth * spacesCount;
        continue;
      }

      // Word token
      wordIndexInParagraph++;
      const wordChars = Array.from(token);

      // Measure word width ahead of time to handle wrapping
      let wordWidth = 0;
      const wordGlyphInfos: {
        char: string;
        sampleIndex: number;
        normalizedSample?: NormalizedGlyphSample;
        isMissing: boolean;
        charWidth: number;
      }[] = [];

      for (let cIdx = 0; cIdx < wordChars.length; cIdx++) {
        const char = wordChars[cIdx];
        const samples = normalizedCache.get(char);

        if (samples && samples.length > 0) {
          // Deterministic sample selection
          const seed = `${char}_p${pIdx}_w${wordIndexInParagraph}_c${cIdx}`;
          const sampleIndex = hashString(seed) % samples.length;
          const sample = samples[sampleIndex];
          const charWidth = sample.advanceWidth * glyphScale * letterSpacing;

          wordGlyphInfos.push({
            char,
            sampleIndex,
            normalizedSample: sample,
            isMissing: false,
            charWidth,
          });
          wordWidth += charWidth;
        } else {
          // Missing character
          currentMissing.add(char);
          const fallbackWidth = fontSize * 0.55 * letterSpacing;
          wordGlyphInfos.push({
            char,
            sampleIndex: 0,
            isMissing: true,
            charWidth: fallbackWidth,
          });
          wordWidth += fallbackWidth;
        }
      }

      // Wrap word if it exceeds printable line width
      if (currentX > margins.left && currentX + wordWidth > margins.left + printableWidth) {
        flushLine();
      }

      // Place word glyphs on current line
      for (const info of wordGlyphInfos) {
        // If single word exceeds printable line width, wrap character-by-character
        if (currentX + info.charWidth > margins.left + printableWidth && currentX > margins.left) {
          flushLine();
        }

        currentLineGlyphs.push({
          char: info.char,
          x: currentX,
          y: currentBaselineY,
          scale: glyphScale,
          sampleIndex: info.sampleIndex,
          normalizedSample: info.normalizedSample,
          isMissing: info.isMissing,
        });

        currentX += info.charWidth;
      }
    }

    // End of paragraph
    flushLine();
  }

  // Push final page if it has content
  if (currentLines.length > 0 || pages.length === 0) {
    pages.push({
      pageNumber: currentPageNumber,
      lines: currentLines,
      width: pageWidth,
      height: pageHeight,
      margins,
      missingChars: Array.from(currentMissing),
    });
  }

  return pages;
}
