import React from 'react';
import { HistoryManager } from '../utils/historyManager';
import {
  Undo2,
  Redo2,
  Trash2,
  CheckCircle2,
  Clock,
  Pen,
  Eraser,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';

interface HistoryTimelineProps {
  historyManager: HistoryManager;
  isOpen: boolean;
  onClose: () => void;
}

export const HistoryTimeline: React.FC<HistoryTimelineProps> = ({
  historyManager,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const timeline = historyManager.getTimeline();
  const undoCount = historyManager.getUndoCount();
  const redoCount = historyManager.getRedoCount();
  const canUndo = historyManager.canUndo();
  const canRedo = historyManager.canRedo();

  const getCommandIcon = (type: string) => {
    switch (type) {
      case 'add_stroke':
        return <Pen className="w-3.5 h-3.5 text-neutral-300" />;
      case 'batch_erase':
      case 'erase_stroke':
        return <Eraser className="w-3.5 h-3.5 text-neutral-400" />;
      case 'clear_canvas':
        return <Trash2 className="w-3.5 h-3.5 text-neutral-400" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-neutral-400" />;
    }
  };

  const formatTimestamp = (ts: number) => {
    const elapsedSec = Math.floor((Date.now() - ts) / 1000);
    if (elapsedSec < 5) return 'just now';
    if (elapsedSec < 60) return `${elapsedSec}s ago`;
    const min = Math.floor(elapsedSec / 60);
    return `${min}m ago`;
  };

  return (
    <aside className="w-72 border-l border-neutral-800 bg-neutral-950 flex flex-col z-30 shrink-0 select-none shadow-xl">
      {/* Header */}
      <div className="h-11 border-b border-neutral-800 px-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-200">History</span>
          <span className="text-[11px] font-mono text-neutral-500">
            {undoCount} undo · {redoCount} redo
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => historyManager.undo()}
            disabled={!canUndo}
            className="p-1 rounded text-neutral-400 hover:text-white disabled:opacity-20"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => historyManager.redo()}
            disabled={!canRedo}
            className="p-1 rounded text-neutral-400 hover:text-white disabled:opacity-20"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded text-neutral-500 hover:text-neutral-200 ml-1"
            title="Close Panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Timeline List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {timeline.length === 0 ? (
          <div className="py-12 text-center text-xs text-neutral-500 flex flex-col items-center justify-center gap-2">
            <Clock className="w-5 h-5 text-neutral-600" />
            <p>No strokes yet</p>
          </div>
        ) : (
          <>
            <button
              onClick={() => historyManager.jumpToStep(0)}
              className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors flex items-center justify-between ${
                undoCount === 0
                  ? 'bg-neutral-800 text-neutral-100 font-medium'
                  : 'text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <RotateCcw className="w-3.5 h-3.5 text-neutral-500" />
                <span>Blank Canvas</span>
              </div>
              {undoCount === 0 && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
            </button>

            {timeline.map((entry, idx) => {
              const stepIndex = idx + 1;
              const isCurrentState = stepIndex === undoCount;
              const isUndone = entry.isUndone;

              return (
                <button
                  key={entry.id}
                  onClick={() => historyManager.jumpToStep(stepIndex)}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors flex items-start gap-2 ${
                    isCurrentState
                      ? 'bg-neutral-800 text-neutral-100 font-medium'
                      : isUndone
                      ? 'text-neutral-600 hover:bg-neutral-900/60'
                      : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
                  }`}
                  title={`Step #${stepIndex}`}
                >
                  <div className="mt-0.5 shrink-0 opacity-70">
                    {getCommandIcon(entry.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate">{entry.description}</span>
                      <span className="text-[10px] text-neutral-500 font-mono shrink-0">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </>
        )}
      </div>

      <div className="p-2.5 border-t border-neutral-800 text-[11px] text-neutral-500 font-mono text-center">
        Click any action to rewind or fast-forward
      </div>
    </aside>
  );
};
