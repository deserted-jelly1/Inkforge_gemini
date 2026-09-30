import { StrokeData } from '../types/inkforge';

export type CommandType =
  | 'add_stroke'
  | 'erase_stroke'
  | 'batch_erase'
  | 'clear_canvas'
  | 'macro';

export interface CommandLogEntry {
  id: string;
  description: string;
  type: CommandType;
  timestamp: number;
  strokeCountAffected: number;
  isUndone: boolean;
}

export interface ICanvasCommand {
  id: string;
  description: string;
  type: CommandType;
  timestamp: number;
  strokeCountAffected: number;
  execute: () => void;
  undo: () => void;
}

export class AddStrokeCommand implements ICanvasCommand {
  id: string;
  description: string;
  type: CommandType = 'add_stroke';
  timestamp: number;
  strokeCountAffected = 1;

  constructor(
    private stroke: StrokeData,
    private addFn: (stroke: StrokeData) => void,
    private removeFn: (strokeId: string) => void
  ) {
    this.id = `cmd_add_${stroke.id}`;
    const pts = stroke.points.length;
    const toolName = stroke.tool === 'highlighter' ? 'Highlight' : 'Pen Stroke';
    this.description = `Add ${toolName} (${pts} pts)`;
    this.timestamp = Date.now();
  }

  execute(): void {
    this.addFn(this.stroke);
  }

  undo(): void {
    this.removeFn(this.stroke.id);
  }
}

export class BatchEraseCommand implements ICanvasCommand {
  id: string;
  description: string;
  type: CommandType = 'batch_erase';
  timestamp: number;
  strokeCountAffected: number;

  constructor(
    private removedStrokes: StrokeData[],
    private batchRemoveFn: (strokeIds: string[]) => void,
    private batchRestoreFn: (strokes: StrokeData[]) => void
  ) {
    this.id = `cmd_erase_${Date.now()}`;
    this.strokeCountAffected = removedStrokes.length;
    this.description =
      removedStrokes.length === 1
        ? 'Erase Single Stroke'
        : `Erase ${removedStrokes.length} Strokes`;
    this.timestamp = Date.now();
  }

  execute(): void {
    this.batchRemoveFn(this.removedStrokes.map((s) => s.id));
  }

  undo(): void {
    this.batchRestoreFn(this.removedStrokes);
  }
}

export class ClearCanvasCommand implements ICanvasCommand {
  id: string;
  description: string;
  type: CommandType = 'clear_canvas';
  timestamp: number;
  strokeCountAffected: number;

  constructor(
    private priorStrokes: StrokeData[],
    private clearFn: () => void,
    private restoreFn: (strokes: StrokeData[]) => void
  ) {
    this.id = `cmd_clear_${Date.now()}`;
    this.strokeCountAffected = priorStrokes.length;
    this.description = `Clear Canvas (${priorStrokes.length} strokes wiped)`;
    this.timestamp = Date.now();
  }

  execute(): void {
    this.clearFn();
  }

  undo(): void {
    this.restoreFn(this.priorStrokes);
  }
}

/**
 * Command-pattern based History Manager.
 * Orchestrates undo/redo stacks, execution, and time-travel jumps.
 */
export class HistoryManager {
  private undoStack: ICanvasCommand[] = [];
  private redoStack: ICanvasCommand[] = [];
  private maxDepth: number;
  private onChangeCallbacks: Array<() => void> = [];

  constructor(maxDepth = 100) {
    this.maxDepth = maxDepth;
  }

  executeCommand(command: ICanvasCommand): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // Invalidate redo branch

    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.notify();
  }

  undo(): boolean {
    if (this.undoStack.length === 0) return false;
    const cmd = this.undoStack.pop()!;
    cmd.undo();
    this.redoStack.push(cmd);
    this.notify();
    return true;
  }

  redo(): boolean {
    if (this.redoStack.length === 0) return false;
    const cmd = this.redoStack.pop()!;
    cmd.execute();
    this.undoStack.push(cmd);
    this.notify();
    return true;
  }

  jumpToStep(targetUndoCount: number): boolean {
    if (targetUndoCount < 0 || targetUndoCount > this.undoStack.length + this.redoStack.length) {
      return false;
    }

    while (this.undoStack.length > targetUndoCount) {
      if (!this.undo()) return false;
    }

    while (this.undoStack.length < targetUndoCount) {
      if (!this.redo()) return false;
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

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  getTimeline(): CommandLogEntry[] {
    const timeline: CommandLogEntry[] = [];

    // Committed commands in undo stack (in chronological order)
    for (const cmd of this.undoStack) {
      timeline.push({
        id: cmd.id,
        description: cmd.description,
        type: cmd.type,
        timestamp: cmd.timestamp,
        strokeCountAffected: cmd.strokeCountAffected,
        isUndone: false,
      });
    }

    // Commands currently in redo stack (undone, listed in future execution order)
    for (let i = this.redoStack.length - 1; i >= 0; i--) {
      const cmd = this.redoStack[i];
      timeline.push({
        id: cmd.id,
        description: cmd.description,
        type: cmd.type,
        timestamp: cmd.timestamp,
        strokeCountAffected: cmd.strokeCountAffected,
        isUndone: true,
      });
    }

    return timeline;
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
