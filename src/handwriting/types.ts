import { VectorPoint } from '../types/inkforge';

export type SampleProvenance =
  | 'user_captured'
  | 'user_edited'
  | 'synthetic_starter'
  | 'migrated_review';

export interface RawSampleStroke {
  id: string;
  points: VectorPoint[];
  baseWidth: number;
  color: string;
}

export interface CharacterSample {
  id: string;
  createdAt: number;
  strokes: RawSampleStroke[];
  cellBounds: { minX: number; minY: number; maxX: number; maxY: number };
  baselineY: number;
  capHeightY: number;
  xHeightY: number;
  isStarter?: boolean;
  provenance?: SampleProvenance;
  needsReview?: boolean;
}

export interface HandwritingProfile {
  schemaVersion: 1;
  app: 'InkForge-HandwritingProfile';
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  description?: string;
  isDemo?: boolean;
  legacyBackup?: Record<string, CharacterSample[]>;
  glyphs: Record<string, CharacterSample[]>;
}

export interface ComposerDocument {
  schemaVersion: 1;
  id: string;
  title: string;
  text: string;
  profileId: string;
  options: LayoutOptions;
  createdAt: number;
  updatedAt: number;
  revision?: number;
}

export interface NormalizedGlyphSample {
  char: string;
  sampleId: string;
  advanceWidth: number;
  leftSideBearing: number;
  rightSideBearing: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  strokes: {
    points: { x: number; y: number; pressure: number; tiltX: number; tiltY: number; timestamp: number }[];
    baseWidth: number;
    color: string;
  }[];
}

export interface LayoutGlyph {
  char: string;
  x: number;
  y: number;
  scale: number;
  sampleIndex: number;
  normalizedSample?: NormalizedGlyphSample;
  isMissing: boolean;
}

export interface LayoutLine {
  glyphs: LayoutGlyph[];
  baselineY: number;
  width: number;
}

export interface LayoutPage {
  pageNumber: number;
  lines: LayoutLine[];
  width: number;
  height: number;
  margins: { top: number; right: number; bottom: number; left: number };
  missingChars: string[];
}

export interface LayoutOptions {
  pageWidth: number;
  pageHeight: number;
  margins: { top: number; right: number; bottom: number; left: number };
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
}

export interface IHandwritingRenderer {
  readonly name: string;
  readonly isGenerative: boolean;
  layoutText(text: string, options: LayoutOptions): LayoutPage[];
  renderToCanvas(page: LayoutPage, canvas: HTMLCanvasElement, scale?: number): void;
  renderToSVG(page: LayoutPage): string;
}

export const SUPPORTED_CHARACTERS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz'.split(''),
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  digits: '0123456789'.split(''),
  punctuation: ['.', ',', '!', '?', "'", '"', '-', '(', ')', ':', ';', '/'],
};
