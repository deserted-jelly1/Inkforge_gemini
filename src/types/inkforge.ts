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

export interface StrokeData {
  id: string;
  tool: ToolType;
  color: string;
  baseWidth: number;
  opacity: number;
  points: VectorPoint[];
  smoothedPoints?: VectorPoint[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

export interface TextNoteContainer {
  id: string;
  x: number;
  y: number;
  width: number;
  text: string;
}

export interface PageData {
  id: string;
  title: string;
  index?: number;
  createdAt: number;
  updatedAt: number;
  backgroundPattern: BackgroundPattern;
  gridSpacing: number;
  strokes: StrokeData[];
  textNotes?: TextNoteContainer[];
}

export interface SectionData {
  id: string;
  title: string;
  color: string;
  pages: PageData[];
  activePageIndex: number;
}

export interface NotebookData {
  id: string;
  title: string;
  color: string;
  createdAt: number;
  updatedAt: number;
  sections: SectionData[];
  activeSectionIndex: number;
  // Backward compatibility convenience getters
  pages: PageData[];
  activePageIndex: number;
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
