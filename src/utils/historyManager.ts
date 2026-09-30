import { PageData, StrokeData, TextNoteContainer } from '../types/inkforge';

export type CommandType =
  | 'add_stroke'
  | 'erase_stroke'
  | 'batch_erase'
  | 'clear_ink'
  | 'add_text'
  | 'edit_text'
  | 'move_text'
  | 'resize_text'
  | 'delete_text';

export interface CommandLogEntry {
  id: string;
  pageId: string;
  description: string;
  type: CommandType;
  timestamp: number;
  isUndone: boolean;
}

export interface IPageCommand {
  id: string;
  pageId: string;
  description: string;
  type: CommandType;
  timestamp: number;
  execute: (page: PageData) => PageData;
  undo: (page: PageData) => PageData;
}

export class AddStrokeCommand implements IPageCommand {
  id: string;
  description: string;
  type: CommandType = 'add_stroke';
  timestamp: number;

  constructor(public pageId: string, public stroke: StrokeData) {
    this.id = `cmd_add_${stroke.id}`;
    const pts = stroke.points.length;
    const toolName = stroke.tool === 'highlighter' ? 'Highlight' : 'Ink Stroke';
    this.description = `Add ${toolName} (${pts} pts)`;
    this.timestamp = Date.now();
  }

  execute(page: PageData): PageData {
    if (page.id !== this.pageId) return page;
    if (page.strokes.some((s) => s.id === this.stroke.id)) return page;
    return {
      ...page,
      strokes: [...page.strokes, this.stroke],
      updatedAt: Date.now(),
    };
  }

  undo(page: PageData): PageData {
    if (page.id !== this.pageId) return page;
    return {
      ...page,
      strokes: page.strokes.filter((s) => s.id !== this.stroke.id),
      updatedAt: Date.now(),
    };
  }
}

export class BatchEraseCommand implements IPageCommand {
  id: string;
  description: string;
  type: CommandType = 'batch_erase';
  timestamp: number;

  constructor(
    public pageId: string,
    public removedStrokes: { stroke: StrokeData; originalIndex: number }[]
  ) {
    this.id = `cmd_erase_${Date.now()}`;
    const count = removedStrokes.length;
    this.description = count === 1 ? 'Erase Stroke' : `Erase ${count} Strokes`;
    this.timestamp = Date.now();
  }

  execute(page: PageData): PageData {
    if (page.id !== this.pageId) return page;
    const idsToRemove = new Set(this.removedStrokes.map((r) => r.stroke.id));
    return {
      ...page,
      strokes: page.strokes.filter((s) => !idsToRemove.has(s.id)),
      updatedAt: Date.now(),
    };
  }

  undo(page: PageData): PageData {
    if (page.id !== this.pageId) return page;
    const idsToRestore = new Set(this.removedStrokes.map((r) => r.stroke.id));
    const surviving = page.strokes.filter((s) => !idsToRestore.has(s.id));

    // Sort removed strokes strictly by original index at gesture start
    const sorted = [...this.removedStrokes].sort((a, b) => a.originalIndex - b.originalIndex);
    const restored = [...surviving];

    for (const item of sorted) {
      const targetIndex = Math.min(item.originalIndex, restored.length);
      restored.splice(targetIndex, 0, item.stroke);
    }

    return {
      ...page,
      strokes: restored,
      updatedAt: Date.now(),
    };
  }
}

export class ClearInkCommand implements IPageCommand {
  id: string;
  description: string;
  type: CommandType = 'clear_ink';
  timestamp: number;

  constructor(public pageId: string, public priorStrokes: StrokeData[]) {
    this.id = `cmd_clear_${Date.now()}`;
    this.description = `Clear Ink (${priorStrokes.length} strokes)`;
    this.timestamp = Date.now();
  }

  execute(page: PageData): PageData {
    if (page.id !== this.pageId) return page;
    return {
      ...page,
      strokes: [],
      updatedAt: Date.now(),
    };
  }

  undo(page: PageData): PageData {
    if (page.id !== this.pageId) return page;
    return {
      ...page,
      strokes: this.priorStrokes,
      updatedAt: Date.now(),
    };
  }
}

export class AddTextNoteCommand implements IPageCommand {
  id: string;
  description = 'Add Text Box';
  type: CommandType = 'add_text';
  timestamp: number;

  constructor(public pageId: string, public note: TextNoteContainer) {
    this.id = `cmd_add_text_${note.id}`;
    this.timestamp = Date.now();
  }

  execute(page: PageData): PageData {
    if (page.id !== this.pageId) return page;
    const existing = page.textNotes || [];
    if (existing.some((n) => n.id === this.note.id)) return page;
    return {
      ...page,
      textNotes: [...existing, this.note],
      updatedAt: Date.now(),
    };
  }

  undo(page: PageData): PageData {
    if (page.id !== this.pageId) return page;
    return {
      ...page,
      textNotes: (page.textNotes || []).filter((n) => n.id !== this.note.id),
      updatedAt: Date.now(),
    };
  }
}

export class DeleteTextNoteCommand implements IPageCommand {
  id: string;
  description = 'Delete Text Box';
  type: CommandType = 'delete_text';
  timestamp: number;

  constructor(public pageId: string, public note: TextNoteContainer) {
    this.id = `cmd_del_text_${note.id}`;
    this.timestamp = Date.now();
  }

  execute(page: PageData): PageData {
    if (page.id !== this.pageId) return page;
    return {
      ...page,
      textNotes: (page.textNotes || []).filter((n) => n.id !== this.note.id),
      updatedAt: Date.now(),
    };
  }

  undo(page: PageData): PageData {
    if (page.id !== this.pageId) return page;
    const existing = page.textNotes || [];
    if (existing.some((n) => n.id === this.note.id)) return page;
    return {
      ...page,
      textNotes: [...existing, this.note],
      updatedAt: Date.now(),
    };
  }
}

export class UpdateTextNoteCommand implements IPageCommand {
  id: string;
  timestamp: number;

  constructor(
    public pageId: string,
    public noteId: string,
    public previousState: { x?: number; y?: number; width?: number; text?: string },
    public newState: { x?: number; y?: number; width?: number; text?: string },
    public type: CommandType,
    public description: string
  ) {
    this.id = `cmd_upd_text_${Date.now()}`;
    this.timestamp = Date.now();
  }

  execute(page: PageData): PageData {
    if (page.id !== this.pageId) return page;
    return {
      ...page,
      textNotes: (page.textNotes || []).map((n) =>
        n.id === this.noteId ? { ...n, ...this.newState } : n
      ),
      updatedAt: Date.now(),
    };
  }

  undo(page: PageData): PageData {
    if (page.id !== this.pageId) return page;
    return {
      ...page,
      textNotes: (page.textNotes || []).map((n) =>
        n.id === this.noteId ? { ...n, ...this.previousState } : n
      ),
      updatedAt: Date.now(),
    };
  }
}

export class PageHistoryManager {
  private undoStack: IPageCommand[] = [];
  private redoStack: IPageCommand[] = [];
  private maxDepth: number;
  private onChangeCallbacks: Array<() => void> = [];

  constructor(public pageId: string, maxDepth = 100) {
    this.maxDepth = maxDepth;
  }

  executeCommand(command: IPageCommand, applyToPage: (transform: (page: PageData) => PageData) => void): void {
    applyToPage((page) => command.execute(page));
    this.undoStack.push(command);
    this.redoStack = [];

    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.notify();
  }

  undo(applyToPage: (transform: (page: PageData) => PageData) => void): boolean {
    if (this.undoStack.length === 0) return false;
    const cmd = this.undoStack.pop()!;
    applyToPage((page) => cmd.undo(page));
    this.redoStack.push(cmd);
    this.notify();
    return true;
  }

  redo(applyToPage: (transform: (page: PageData) => PageData) => void): boolean {
    if (this.redoStack.length === 0) return false;
    const cmd = this.redoStack.pop()!;
    applyToPage((page) => cmd.execute(page));
    this.undoStack.push(cmd);
    this.notify();
    return true;
  }

  jumpToStep(targetUndoCount: number, applyToPage: (transform: (page: PageData) => PageData) => void): boolean {
    if (targetUndoCount < 0 || targetUndoCount > this.undoStack.length + this.redoStack.length) {
      return false;
    }

    while (this.undoStack.length > targetUndoCount) {
      if (!this.undo(applyToPage)) return false;
    }

    while (this.undoStack.length < targetUndoCount) {
      if (!this.redo(applyToPage)) return false;
    }

    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getUndoCount(): number {
    return this.undoStack.length;
  }

  getRedoCount(): number {
    return this.redoStack.length;
  }

  getTimeline(): CommandLogEntry[] {
    const timeline: CommandLogEntry[] = [];
    for (const cmd of this.undoStack) {
      timeline.push({
        id: cmd.id,
        pageId: cmd.pageId,
        description: cmd.description,
        type: cmd.type,
        timestamp: cmd.timestamp,
        isUndone: false,
      });
    }

    for (let i = this.redoStack.length - 1; i >= 0; i--) {
      const cmd = this.redoStack[i];
      timeline.push({
        id: cmd.id,
        pageId: cmd.pageId,
        description: cmd.description,
        type: cmd.type,
        timestamp: cmd.timestamp,
        isUndone: true,
      });
    }
    return timeline;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  subscribe(callback: () => void): () => void {
    this.onChangeCallbacks.push(callback);
    return () => {
      this.onChangeCallbacks = this.onChangeCallbacks.filter((cb) => cb !== callback);
    };
  }

  private notify(): void {
    for (const cb of this.onChangeCallbacks) {
      cb();
    }
  }
}

export class PageHistoryRegistry {
  private managers = new Map<string, PageHistoryManager>();

  getHistoryManager(pageId: string): PageHistoryManager {
    let mgr = this.managers.get(pageId);
    if (!mgr) {
      mgr = new PageHistoryManager(pageId);
      this.managers.set(pageId, mgr);
    }
    return mgr;
  }

  removePage(pageId: string): void {
    this.managers.delete(pageId);
  }

  resetAll(): void {
    for (const mgr of this.managers.values()) {
      mgr.clear();
    }
    this.managers.clear();
  }
}
