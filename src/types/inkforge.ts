export type ToolType = 'pen' | 'highlighter' | 'eraser' | 'pan' | 'text';
export type BackgroundPattern = 'lined' | 'grid' | 'dotgrid' | 'blank';

export interface VectorPoint {
  x: number;
  y: number;
  pressure: number;
  tiltX: number;
  tiltY: number;
  timestamp: number;
}

export interface StrokeBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface StrokeData {
  id: string;
  tool: ToolType;
  color: string;
  baseWidth: number;
  opacity: number;
  points: VectorPoint[];
  smoothedPoints?: VectorPoint[];
  bounds: StrokeBounds;
}

export interface TextNoteContainer {
  id: string;
  x: number;
  y: number;
  width: number;
  text: string;
}

export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

export interface PageData {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  backgroundPattern: BackgroundPattern;
  gridSpacing: number;
  viewport?: ViewportState;
  strokes: StrokeData[];
  textNotes: TextNoteContainer[];
}

export interface SectionData {
  id: string;
  title: string;
  color: string;
  pages: PageData[];
}

export interface NotebookData {
  id: string;
  title: string;
  color: string;
  createdAt: number;
  updatedAt: number;
  sections: SectionData[];
  activeSectionId: string;
  activePageId: string;
}

export interface BackupEnvelope {
  schemaVersion: 2;
  app: 'InkForge';
  exportedAt: number;
  notebook: NotebookData;
}

export interface TabletDiagnostics {
  pointerType: string;
  pressure: number;
  x: number;
  y: number;
  tiltX: number;
  tiltY: number;
  sampleRateHz: number;
  activePointCount: number;
  totalStrokesOnPage: number;
  smoothingEnabled: boolean;
}

export interface CodeFile {
  path: string;
  category: 'header' | 'source' | 'cmake' | 'docs' | 'test';
  language: string;
  description: string;
  content: string;
}
