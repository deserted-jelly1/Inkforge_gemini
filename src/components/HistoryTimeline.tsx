import React from 'react';
import { PageHistoryManager, CommandType } from '../utils/historyManager';
import { PageData } from '../types/inkforge';
import {
  Undo2,
  Redo2,
  Trash2,
  CheckCircle2,
  Clock,
  Pen,
  Eraser,
  Type,
  Move,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';

interface HistoryTimelineProps {
  historyManager: PageHistoryManager;
  isOpen: boolean;
  onClose: () => void;
  onApplyToPage: (transform: (prev: PageData) => PageData) => void;
}

export const HistoryTimeline: React.FC<HistoryTimelineProps> = ({
  historyManager,
  isOpen,
  onClose,
  onApplyToPage,
}) => {
  if (!isOpen) return null;

  const timeline = historyManager.getTimeline();
  const undoCount = historyManager.getUndoCount();
  const redoCount = historyManager.getRedoCount();
  const canUndo = historyManager.canUndo();
  const canRedo = historyManager.canRedo();

  const getCommandIcon = (type: CommandType) => {
    switch (type) {
      case 'add_stroke':
        return <Pen className="w-3.5 h-3.5 text-indigo-400" />;
      case 'batch_erase':
      case 'erase_stroke':
        return <Eraser className="w-3.5 h-3.5 text-amber-400" />;
      case 'clear_ink':
        return <Trash2 className="w-3.5 h-3.5 text-rose-400" />;
      case 'add_text':
      case 'edit_text':
        return <Type className="w-3.5 h-3.5 text-emerald-400" />;
      case 'move_text':
      case 'resize_text':
        return <Move className="w-3.5 h-3.5 text-sky-400" />;
      case 'delete_text':
        return <Trash2 className="w-3.5 h-3.5 text-orange-400" />;
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
    <aside className="w-72 border-l border-neutral-200 bg-white flex flex-col z-30 shrink-0 select-none shadow-lg text-neutral-800 text-xs">
      {/* Header */}
      <div className="h-11 border-b border-neutral-200 px-3 flex items-center justify-between bg-neutral-50">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-neutral-900">Page History</span>
          <span className="text-[11px] font-mono text-neutral-500">
            {undoCount} undo · {redoCount} redo
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => historyManager.undo(onApplyToPage)}
            disabled={!canUndo}
            className="p-1 rounded text-neutral-500 hover:text-neutral-900 disabled:opacity-20 hover:bg-neutral-200/60 transition-colors"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => historyManager.redo(onApplyToPage)}
            disabled={!canRedo}
            className="p-1 rounded text-neutral-500 hover:text-neutral-900 disabled:opacity-20 hover:bg-neutral-200/60 transition-colors"
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded text-neutral-400 hover:text-neutral-700 ml-1 hover:bg-neutral-200/60 transition-colors"
            title="Close history panel"
            aria-label="Close history panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Timeline List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {timeline.length === 0 ? (
          <div className="py-12 text-center text-xs text-neutral-400 flex flex-col items-center justify-center gap-2">
            <Clock className="w-5 h-5 text-neutral-300" />
            <p>No actions on this page yet.</p>
            <p className="text-[10px] text-neutral-400">Draw or type to generate page history.</p>
          </div>
        ) : (
          <>
            <button
              onClick={() => historyManager.jumpToStep(0, onApplyToPage)}
              className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors flex items-center justify-between border ${
                undoCount === 0
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-950 font-medium'
                  : 'border-transparent text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
                <span>Base Page State</span>
              </div>
              {undoCount === 0 && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
            </button>

            {timeline.map((entry, idx) => {
              const stepIndex = idx + 1;
              const isCurrentState = stepIndex === undoCount;
              const isUndone = entry.isUndone;

              return (
                <button
                  key={entry.id}
                  onClick={() => historyManager.jumpToStep(stepIndex, onApplyToPage)}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors flex items-start gap-2 border ${
                    isCurrentState
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-medium shadow-xs'
                      : isUndone
                      ? 'border-dashed border-neutral-200 text-neutral-400 hover:bg-neutral-50'
                      : 'border-transparent text-neutral-700 hover:bg-neutral-100'
                  }`}
                  title={`Rewind / Fast-forward to step #${stepIndex}`}
                >
                  <div className="mt-0.5 shrink-0 opacity-80">
                    {getCommandIcon(entry.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate">{entry.description}</span>
                      <span className="text-[10px] text-neutral-400 font-mono shrink-0">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </div>
                  </div>
                  {isCurrentState && (
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0 mt-1.5" />
                  )}
                </button>
              );
            })}
          </>
        )}
      </div>

      <div className="p-2 border-t border-neutral-200 text-[10px] text-neutral-400 font-mono text-center bg-neutral-50">
        Click any action to rewind or replay
      </div>
    </aside>
  );
};
