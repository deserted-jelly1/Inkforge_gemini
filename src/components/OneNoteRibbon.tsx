import React, { useState } from 'react';
import { ToolType, BackgroundPattern } from '../types/inkforge';
import { HistoryManager } from '../utils/historyManager';
import {
  Undo2,
  Redo2,
  Pen,
  Highlighter,
  Eraser,
  Hand,
  Type,
  Trash2,
  History,
  Grid,
  AlignJustify,
  Download,
  CheckSquare,
} from 'lucide-react';

interface OneNoteRibbonProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  activeColor: string;
  setActiveColor: (color: string) => void;
  baseWidth: number;
  setBaseWidth: (w: number) => void;
  backgroundPattern: BackgroundPattern;
  setBackgroundPattern: (p: BackgroundPattern) => void;
  historyManager: HistoryManager;
  onClearPage: () => void;
  onToggleHistory: () => void;
  isHistoryOpen: boolean;
  activeTab: 'draw' | 'home' | 'view' | 'architecture' | 'code';
  setActiveTab: (tab: 'draw' | 'home' | 'view' | 'architecture' | 'code') => void;
  onExport: () => void;
  onInsertTextBox: () => void;
}

const PEN_PRESETS = [
  { name: 'Black Pen (0.5mm)', hex: '#0f172a', width: 2.2, type: 'pen' as ToolType },
  { name: 'Blue Pen (0.5mm)', hex: '#1d4ed8', width: 2.2, type: 'pen' as ToolType },
  { name: 'Red Pen (0.5mm)', hex: '#dc2626', width: 2.2, type: 'pen' as ToolType },
  { name: 'Green Pen (0.5mm)', hex: '#15803d', width: 2.2, type: 'pen' as ToolType },
  { name: 'Yellow Highlighter', hex: '#facc15', width: 14.0, type: 'highlighter' as ToolType },
  { name: 'Purple Highlighter', hex: '#c084fc', width: 14.0, type: 'highlighter' as ToolType },
];

export const OneNoteRibbon: React.FC<OneNoteRibbonProps> = ({
  activeTool,
  setActiveTool,
  activeColor,
  setActiveColor,
  baseWidth,
  setBaseWidth,
  backgroundPattern,
  setBackgroundPattern,
  historyManager,
  onClearPage,
  onToggleHistory,
  isHistoryOpen,
  activeTab,
  setActiveTab,
  onExport,
  onInsertTextBox,
}) => {
  const [showPatternPicker, setShowPatternPicker] = useState(false);

  return (
    <div className="border-b border-neutral-200 dark:border-neutral-800 bg-[#fbfbfc] dark:bg-[#181a1f] flex flex-col shrink-0 select-none text-neutral-800 dark:text-neutral-200">
      {/* 1. Top Ribbon Tabs & Quick Access Toolbar */}
      <div className="h-8 border-b border-neutral-200 dark:border-neutral-800 px-3 flex items-center justify-between text-xs bg-white dark:bg-[#131519]">
        {/* Left: Quick Access Toolbar & App Title */}
        <div className="flex items-center gap-2">
          {/* OneNote Purple Icon */}
          <div className="w-5 h-5 rounded bg-purple-700 text-white flex items-center justify-center font-bold text-xs font-mono shadow-xs">
            N
          </div>
          <span className="font-semibold tracking-tight text-neutral-900 dark:text-white mr-2">
            OneNote
          </span>

          <div className="h-3.5 w-px bg-neutral-300 dark:bg-neutral-700" />

          {/* Quick Undo / Redo */}
          <button
            onClick={() => historyManager.undo()}
            disabled={!historyManager.canUndo()}
            className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white disabled:opacity-25"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => historyManager.redo()}
            disabled={!historyManager.canRedo()}
            className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white disabled:opacity-25"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Ribbon Tabs */}
        <div className="flex items-center gap-1 font-medium">
          <button
            onClick={() => setActiveTab('draw')}
            className={`px-3 py-1 rounded-t-sm transition-colors border-b-2 ${
              activeTab === 'draw'
                ? 'border-purple-600 text-purple-700 dark:text-purple-400 font-semibold'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Draw
          </button>

          <button
            onClick={() => setActiveTab('home')}
            className={`px-3 py-1 rounded-t-sm transition-colors border-b-2 ${
              activeTab === 'home'
                ? 'border-purple-600 text-purple-700 dark:text-purple-400 font-semibold'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Home
          </button>

          <button
            onClick={() => setActiveTab('view')}
            className={`px-3 py-1 rounded-t-sm transition-colors border-b-2 ${
              activeTab === 'view'
                ? 'border-purple-600 text-purple-700 dark:text-purple-400 font-semibold'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            View
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3 py-1 rounded-t-sm transition-colors border-b-2 ${
              activeTab === 'architecture'
                ? 'border-purple-600 text-purple-700 dark:text-purple-400 font-semibold'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Architecture
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`px-3 py-1 rounded-t-sm transition-colors border-b-2 ${
              activeTab === 'code'
                ? 'border-purple-600 text-purple-700 dark:text-purple-400 font-semibold'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            C++ Engine
          </button>
        </div>

        {/* Right: Export & History Toggle */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleHistory}
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
              isHistoryOpen
                ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
            title="Command History & Time Travel"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">History</span>
          </button>

          <button
            onClick={onExport}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Export Notebook"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* 2. Ribbon Content Bar */}
      {activeTab === 'draw' && (
        <div className="h-14 px-3 flex items-center gap-4 overflow-x-auto">
          {/* Group 1: Tools Mode */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTool('text')}
              className={`flex flex-col items-center justify-center w-11 h-11 rounded transition-colors ${
                activeTool === 'text'
                  ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 ring-1 ring-purple-400'
                  : 'hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
              }`}
              title="Type (Click anywhere on page to create note container)"
            >
              <Type className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">Type</span>
            </button>

            <button
              onClick={() => setActiveTool('pan')}
              className={`flex flex-col items-center justify-center w-11 h-11 rounded transition-colors ${
                activeTool === 'pan'
                  ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 ring-1 ring-purple-400'
                  : 'hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
              }`}
              title="Pan / Select Hand"
            >
              <Hand className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">Pan</span>
            </button>

            <button
              onClick={() => setActiveTool('eraser')}
              className={`flex flex-col items-center justify-center w-11 h-11 rounded transition-colors ${
                activeTool === 'eraser'
                  ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 ring-1 ring-purple-400'
                  : 'hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
              }`}
              title="Stroke Eraser"
            >
              <Eraser className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">Eraser</span>
            </button>
          </div>

          <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-800" />

          {/* Group 2: OneNote Favorite Pens Gallery */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-neutral-900 p-1 rounded-lg border border-neutral-200 dark:border-neutral-800">
            {PEN_PRESETS.map((pen, idx) => {
              const isSelected =
                activeTool === pen.type &&
                activeColor === pen.hex &&
                Math.abs(baseWidth - pen.width) < 1.0;
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setActiveTool(pen.type);
                    setActiveColor(pen.hex);
                    setBaseWidth(pen.width);
                  }}
                  className={`flex flex-col items-center justify-between w-9 h-11 p-1 rounded transition-all ${
                    isSelected
                      ? 'bg-purple-50 dark:bg-purple-950/60 ring-2 ring-purple-500 scale-105'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 opacity-80 hover:opacity-100'
                  }`}
                  title={pen.name}
                >
                  <div
                    className="w-2.5 h-6 rounded-xs"
                    style={{ backgroundColor: pen.hex }}
                  />
                  <span className="text-[9px] font-mono text-neutral-500">
                    {pen.type === 'highlighter' ? 'HL' : `${pen.width}pt`}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-800" />

          {/* Group 3: Rule Lines & Paper Setup */}
          <div className="relative">
            <button
              onClick={() => setShowPatternPicker(!showPatternPicker)}
              className="flex flex-col items-center justify-center px-2 h-11 rounded hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
              title="Page Rule Lines (Ruled notebook or grid lines)"
            >
              {backgroundPattern === 'grid' ? (
                <Grid className="w-4 h-4" />
              ) : (
                <AlignJustify className="w-4 h-4" />
              )}
              <span className="text-[10px] mt-0.5">Rule Lines</span>
            </button>

            {showPatternPicker && (
              <div className="absolute top-12 left-0 w-36 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg py-1 z-30 text-xs">
                <button
                  onClick={() => {
                    setBackgroundPattern('lined');
                    setShowPatternPicker(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-purple-50 dark:hover:bg-neutral-800 flex items-center gap-2"
                >
                  <AlignJustify className="w-3.5 h-3.5 text-purple-600" />
                  <span>Ruled Paper</span>
                </button>
                <button
                  onClick={() => {
                    setBackgroundPattern('grid');
                    setShowPatternPicker(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-purple-50 dark:hover:bg-neutral-800 flex items-center gap-2"
                >
                  <Grid className="w-3.5 h-3.5 text-purple-600" />
                  <span>Grid Paper</span>
                </button>
                <button
                  onClick={() => {
                    setBackgroundPattern('dotgrid');
                    setShowPatternPicker(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-purple-50 dark:hover:bg-neutral-800 flex items-center gap-2"
                >
                  <span className="w-3.5 h-3.5 text-center font-bold">·</span>
                  <span>Dot Grid</span>
                </button>
                <button
                  onClick={() => {
                    setBackgroundPattern('blank');
                    setShowPatternPicker(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-purple-50 dark:hover:bg-neutral-800 flex items-center gap-2"
                >
                  <span className="w-3.5 h-3.5 border border-dashed border-neutral-400 rounded-xs" />
                  <span>Blank Paper</span>
                </button>
              </div>
            )}
          </div>

          {/* Group 4: Clear Page */}
          <button
            onClick={onClearPage}
            className="flex flex-col items-center justify-center px-2 h-11 rounded hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-600 hover:text-rose-600 dark:text-neutral-400 dark:hover:text-rose-400 transition-colors"
            title="Clear All Strokes"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">Clear</span>
          </button>
        </div>
      )}

      {activeTab === 'home' && (
        <div className="h-14 px-3 flex items-center gap-3 text-xs">
          <button
            onClick={onInsertTextBox}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors shadow-xs"
          >
            <Type className="w-4 h-4" />
            <span>Insert Text Container</span>
          </button>

          <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-800" />

          <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">OneNote Tip:</span>
            <span>Click anywhere on the blank paper below to instantly start typing a text note!</span>
          </div>
        </div>
      )}

      {activeTab === 'view' && (
        <div className="h-14 px-3 flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setBackgroundPattern('lined')}
              className={`px-3 py-1.5 rounded transition-colors ${
                backgroundPattern === 'lined'
                  ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-medium'
                  : 'hover:bg-neutral-200/60 dark:hover:bg-neutral-800'
              }`}
            >
              Ruled Lines
            </button>
            <button
              onClick={() => setBackgroundPattern('grid')}
              className={`px-3 py-1.5 rounded transition-colors ${
                backgroundPattern === 'grid'
                  ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-medium'
                  : 'hover:bg-neutral-200/60 dark:hover:bg-neutral-800'
              }`}
            >
              Graph Grid
            </button>
            <button
              onClick={() => setBackgroundPattern('blank')}
              className={`px-3 py-1.5 rounded transition-colors ${
                backgroundPattern === 'blank'
                  ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-medium'
                  : 'hover:bg-neutral-200/60 dark:hover:bg-neutral-800'
              }`}
            >
              Blank
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
