import React from 'react';
import { Download } from 'lucide-react';

interface TopNavProps {
  activeView: 'canvas' | 'architecture' | 'code' | 'roadmap';
  setActiveView: (view: 'canvas' | 'architecture' | 'code' | 'roadmap') => void;
  strokeCount: number;
  undoCount: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeView,
  setActiveView,
  onExport,
}) => {
  return (
    <header className="h-11 border-b border-neutral-800/80 bg-neutral-950 px-4 flex items-center justify-between shrink-0 select-none z-30">
      {/* Zone 1: Clean Wordmark */}
      <div className="flex items-center gap-2.5">
        <div className="w-5 h-5 rounded bg-neutral-900 border border-neutral-700/80 flex items-center justify-center text-amber-400 font-bold text-xs font-mono">
          IF
        </div>
        <span className="font-semibold text-neutral-100 text-sm tracking-tight font-sans">
          InkForge
        </span>
      </div>

      {/* Zone 2: Minimalist Navigation Links */}
      <nav className="flex items-center gap-1">
        <button
          onClick={() => setActiveView('canvas')}
          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
            activeView === 'canvas'
              ? 'bg-neutral-800 text-neutral-100 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Canvas
        </button>

        <button
          onClick={() => setActiveView('architecture')}
          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
            activeView === 'architecture'
              ? 'bg-neutral-800 text-neutral-100 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Architecture
        </button>

        <button
          onClick={() => setActiveView('code')}
          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
            activeView === 'code'
              ? 'bg-neutral-800 text-neutral-100 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Codebase
        </button>

        <button
          onClick={() => setActiveView('roadmap')}
          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
            activeView === 'roadmap'
              ? 'bg-neutral-800 text-neutral-100 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Roadmap
        </button>
      </nav>

      {/* Zone 3: Quiet Primary Action */}
      <div className="flex items-center gap-2">
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-neutral-300 bg-neutral-900 border border-neutral-800 rounded hover:bg-neutral-800 hover:text-white transition-colors"
          title="Export vector stroke package"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>
    </header>
  );
};
