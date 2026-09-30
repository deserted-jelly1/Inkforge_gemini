import React, { useState, useRef } from 'react';
import { ToolType, BackgroundPattern } from '../types/inkforge';
import { PageHistoryManager } from '../utils/historyManager';
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
  Upload,
  FileImage,
  FileText,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Sparkles,
} from 'lucide-react';

export type SaveStatus = 'idle' | 'saving' | 'error';

interface RibbonProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  activeColor: string;
  setActiveColor: (color: string) => void;
  baseWidth: number;
  setBaseWidth: (w: number) => void;
  highlighterWidth: number;
  setHighlighterWidth: (w: number) => void;
  eraserRadius: number;
  setEraserRadius: (r: number) => void;
  backgroundPattern: BackgroundPattern;
  setBackgroundPattern: (p: BackgroundPattern) => void;
  historyManager: PageHistoryManager;
  onUndo: () => void;
  onRedo: () => void;
  onClearInk: () => void;
  onToggleHistory: () => void;
  isHistoryOpen: boolean;
  activeTab: 'draw' | 'home' | 'view' | 'lab' | 'dev';
  setActiveTab: (tab: 'draw' | 'home' | 'view' | 'lab' | 'dev') => void;
  onInsertTextBox: () => void;
  onExportPNG: () => void;
  onExportPDF: () => void;
  onExportJSON: () => void;
  onImportJSON: (file: File) => void;
  saveStatus: SaveStatus;
  onRetrySave: () => void;
}

const PEN_PRESETS = [
  { name: 'Black Gel (0.5mm)', hex: '#0f172a', width: 2.2, type: 'pen' as ToolType },
  { name: 'Navy Blue (0.5mm)', hex: '#1d4ed8', width: 2.2, type: 'pen' as ToolType },
  { name: 'Crimson (0.5mm)', hex: '#dc2626', width: 2.2, type: 'pen' as ToolType },
  { name: 'Emerald (0.5mm)', hex: '#15803d', width: 2.2, type: 'pen' as ToolType },
];

const HIGHLIGHTER_PRESETS = [
  { name: 'Yellow Highlighter', hex: '#facc15' },
  { name: 'Violet Highlighter', hex: '#c084fc' },
  { name: 'Emerald Highlighter', hex: '#4ade80' },
  { name: 'Sky Blue Highlighter', hex: '#38bdf8' },
];

export const OneNoteRibbon: React.FC<RibbonProps> = ({
  activeTool,
  setActiveTool,
  activeColor,
  setActiveColor,
  baseWidth,
  setBaseWidth,
  highlighterWidth,
  setHighlighterWidth,
  eraserRadius,
  setEraserRadius,
  backgroundPattern,
  setBackgroundPattern,
  historyManager,
  onUndo,
  onRedo,
  onClearInk,
  onToggleHistory,
  isHistoryOpen,
  activeTab,
  setActiveTab,
  onInsertTextBox,
  onExportPNG,
  onExportPDF,
  onExportJSON,
  onImportJSON,
  saveStatus,
  onRetrySave,
}) => {
  const [showPatternPicker, setShowPatternPicker] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportJSON(file);
      e.target.value = '';
    }
  };

  return (
    <header className="border-b border-neutral-200 bg-white flex flex-col shrink-0 select-none text-neutral-800 z-30">
      {/* 1. Top Bar: App Title, Save Status, Undo/Redo, Tabs, Export */}
      <div className="h-10 border-b border-neutral-200 px-3 flex items-center justify-between text-xs">
        {/* Left: Brand & Persistence Status */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 font-bold tracking-tight text-neutral-900">
            <span className="w-5 h-5 rounded bg-indigo-600 text-white flex items-center justify-center text-xs font-mono shadow-xs">
              IF
            </span>
            <span className="text-sm">InkForge</span>
          </div>

          <div className="h-3.5 w-px bg-neutral-200 mx-1" />

          {/* Quick Undo / Redo */}
          <button
            onClick={onUndo}
            disabled={!historyManager.canUndo()}
            className="p-1 hover:bg-neutral-100 rounded text-neutral-600 hover:text-neutral-900 disabled:opacity-25 transition-colors"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!historyManager.canRedo()}
            className="p-1 hover:bg-neutral-100 rounded text-neutral-600 hover:text-neutral-900 disabled:opacity-25 transition-colors"
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <div className="h-3.5 w-px bg-neutral-200 mx-1" />

          {/* Save Status Badge */}
          {saveStatus === 'saving' && (
            <div className="flex items-center gap-1 text-[11px] text-neutral-500 font-mono">
              <RotateCw className="w-3 h-3 animate-spin text-indigo-500" />
              <span>Saving...</span>
            </div>
          )}
          {saveStatus === 'idle' && (
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-mono">
              <CheckCircle2 className="w-3 h-3" />
              <span>Saved locally</span>
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="flex items-center gap-1 text-[11px] text-rose-600 font-mono">
              <AlertTriangle className="w-3 h-3" />
              <span>Save failed</span>
              <button
                onClick={onRetrySave}
                className="underline hover:text-rose-700 font-medium ml-0.5"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Center: Tabs */}
        <nav className="flex items-center gap-1 font-medium">
          <button
            onClick={() => setActiveTab('draw')}
            className={`px-3 py-1.5 rounded-t-sm transition-colors border-b-2 ${
              activeTab === 'draw'
                ? 'border-indigo-600 text-indigo-700 font-semibold'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Draw
          </button>

          <button
            onClick={() => setActiveTab('home')}
            className={`px-3 py-1.5 rounded-t-sm transition-colors border-b-2 ${
              activeTab === 'home'
                ? 'border-indigo-600 text-indigo-700 font-semibold'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Notes & Text
          </button>

          <button
            onClick={() => setActiveTab('view')}
            className={`px-3 py-1.5 rounded-t-sm transition-colors border-b-2 ${
              activeTab === 'view'
                ? 'border-indigo-600 text-indigo-700 font-semibold'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Paper View
          </button>

          <button
            onClick={() => setActiveTab('lab')}
            className={`px-3 py-1.5 rounded-t-sm transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'lab'
                ? 'border-indigo-600 text-indigo-700 font-semibold'
                : 'border-transparent text-indigo-600 hover:text-indigo-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Handwriting Lab</span>
          </button>

          <button
            onClick={() => setActiveTab('dev')}
            className={`px-3 py-1.5 rounded-t-sm transition-colors border-b-2 flex items-center gap-1 ${
              activeTab === 'dev'
                ? 'border-indigo-600 text-indigo-700 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Code2 className="w-3 h-3" />
            <span>Developer / C++</span>
          </button>
        </nav>

        {/* Right: History & Export */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleHistory}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
              isHistoryOpen
                ? 'bg-indigo-100 text-indigo-800 font-medium'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
            title="Inspect and rewind page history"
            aria-label="Toggle history panel"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Page History</span>
          </button>

          {/* Export / Backup Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1 px-2.5 py-1 rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-50 transition-colors font-medium"
              aria-label="Export or backup notebook"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-9 w-48 bg-white border border-neutral-200 rounded-lg shadow-lg py-1.5 z-40 text-xs">
                <button
                  onClick={() => {
                    onExportPDF();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2 text-neutral-700"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Export Page as PDF</span>
                </button>

                <button
                  onClick={() => {
                    onExportPNG();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2 text-neutral-700"
                >
                  <FileImage className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export Page as PNG</span>
                </button>

                <div className="my-1 border-t border-neutral-100" />

                <button
                  onClick={() => {
                    onExportJSON();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2 text-neutral-700"
                >
                  <Download className="w-3.5 h-3.5 text-amber-600" />
                  <span>Backup Notebook (JSON)</span>
                </button>

                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2 text-neutral-700"
                >
                  <Upload className="w-3.5 h-3.5 text-purple-600" />
                  <span>Restore from Backup</span>
                </button>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* 2. Ribbon Content Row */}
      {activeTab === 'draw' && (
        <div className="h-14 px-3 flex items-center gap-3 overflow-x-auto bg-[#f8fafc]">
          {/* Tools Mode */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTool('pen')}
              className={`flex flex-col items-center justify-center w-11 h-11 rounded-md transition-colors ${
                activeTool === 'pen'
                  ? 'bg-indigo-100 text-indigo-700 font-semibold ring-1 ring-indigo-400'
                  : 'hover:bg-neutral-200/70 text-neutral-700'
              }`}
              title="Ballpoint / Fountain Pen"
              aria-label="Pen tool"
            >
              <Pen className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">Pen</span>
            </button>

            <button
              onClick={() => setActiveTool('highlighter')}
              className={`flex flex-col items-center justify-center w-11 h-11 rounded-md transition-colors ${
                activeTool === 'highlighter'
                  ? 'bg-indigo-100 text-indigo-700 font-semibold ring-1 ring-indigo-400'
                  : 'hover:bg-neutral-200/70 text-neutral-700'
              }`}
              title="Translucent Chisel Highlighter"
              aria-label="Highlighter tool"
            >
              <Highlighter className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">Highlight</span>
            </button>

            <button
              onClick={() => setActiveTool('eraser')}
              className={`flex flex-col items-center justify-center w-11 h-11 rounded-md transition-colors ${
                activeTool === 'eraser'
                  ? 'bg-indigo-100 text-indigo-700 font-semibold ring-1 ring-indigo-400'
                  : 'hover:bg-neutral-200/70 text-neutral-700'
              }`}
              title="Precision Segment & Stroke Eraser"
              aria-label="Eraser tool"
            >
              <Eraser className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">Eraser</span>
            </button>

            <button
              onClick={() => setActiveTool('text')}
              className={`flex flex-col items-center justify-center w-11 h-11 rounded-md transition-colors ${
                activeTool === 'text'
                  ? 'bg-indigo-100 text-indigo-700 font-semibold ring-1 ring-indigo-400'
                  : 'hover:bg-neutral-200/70 text-neutral-700'
              }`}
              title="Type (Click anywhere to insert a movable note box)"
              aria-label="Type tool"
            >
              <Type className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">Type</span>
            </button>

            <button
              onClick={() => setActiveTool('pan')}
              className={`flex flex-col items-center justify-center w-11 h-11 rounded-md transition-colors ${
                activeTool === 'pan'
                  ? 'bg-indigo-100 text-indigo-700 font-semibold ring-1 ring-indigo-400'
                  : 'hover:bg-neutral-200/70 text-neutral-700'
              }`}
              title="Pan / Navigation Hand"
              aria-label="Pan tool"
            >
              <Hand className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">Pan</span>
            </button>
          </div>

          <div className="h-8 w-px bg-neutral-200" />

          {/* Tool specific controls */}
          {activeTool === 'pen' && (
            <div className="flex items-center gap-2">
              {/* Presets */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-md border border-neutral-200">
                {PEN_PRESETS.map((pen, idx) => {
                  const isSelected = activeColor === pen.hex;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setActiveColor(pen.hex);
                        setBaseWidth(pen.width);
                      }}
                      className={`flex flex-col items-center justify-between w-8 h-10 p-1 rounded transition-all ${
                        isSelected
                          ? 'ring-2 ring-indigo-600 bg-indigo-50/60 scale-105'
                          : 'opacity-80 hover:opacity-100 hover:bg-neutral-50'
                      }`}
                      title={pen.name}
                      aria-label={pen.name}
                    >
                      <div className="w-2 h-5 rounded-xs" style={{ backgroundColor: pen.hex }} />
                      <span className="text-[9px] font-mono text-neutral-500">{pen.width}pt</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Color input */}
              <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-md border border-neutral-200 text-xs">
                <input
                  type="color"
                  value={activeColor}
                  onChange={(e) => setActiveColor(e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer border-0 p-0"
                  title="Choose custom ink color"
                  aria-label="Custom ink color"
                />
                <select
                  value={baseWidth}
                  onChange={(e) => setBaseWidth(parseFloat(e.target.value))}
                  className="text-xs bg-transparent focus:outline-none cursor-pointer"
                  title="Pen Thickness"
                  aria-label="Pen thickness"
                >
                  <option value={1.5}>Fine (1.5pt)</option>
                  <option value={2.2}>Medium (2.2pt)</option>
                  <option value={3.5}>Broad (3.5pt)</option>
                  <option value={5.0}>Bold (5.0pt)</option>
                </select>
              </div>
            </div>
          )}

          {activeTool === 'highlighter' && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white p-1 rounded-md border border-neutral-200">
                {HIGHLIGHTER_PRESETS.map((hl, idx) => {
                  const isSelected = activeColor === hl.hex;
                  return (
                    <button
                      key={idx}
                      onClick={() => setActiveColor(hl.hex)}
                      className={`w-7 h-10 p-1 rounded flex items-center justify-center transition-all ${
                        isSelected
                          ? 'ring-2 ring-indigo-600 bg-indigo-50/60 scale-105'
                          : 'opacity-70 hover:opacity-100 hover:bg-neutral-50'
                      }`}
                      title={hl.name}
                      aria-label={hl.name}
                    >
                      <div className="w-3.5 h-6 rounded-xs" style={{ backgroundColor: hl.hex }} />
                    </button>
                  );
                })}
              </div>

              <div className="bg-white px-2 py-1 rounded-md border border-neutral-200 text-xs flex items-center gap-1.5">
                <span className="text-neutral-500">Width:</span>
                <select
                  value={highlighterWidth}
                  onChange={(e) => setHighlighterWidth(parseFloat(e.target.value))}
                  className="text-xs bg-transparent focus:outline-none cursor-pointer"
                  aria-label="Highlighter width"
                >
                  <option value={10}>Narrow (10pt)</option>
                  <option value={16}>Standard (16pt)</option>
                  <option value={24}>Wide (24pt)</option>
                </select>
              </div>
            </div>
          )}

          {activeTool === 'eraser' && (
            <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-md border border-neutral-200 text-xs">
              <span className="text-neutral-500">Eraser Size:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEraserRadius(10)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    eraserRadius === 10 ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'hover:bg-neutral-100'
                  }`}
                >
                  Small
                </button>
                <button
                  onClick={() => setEraserRadius(20)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    eraserRadius === 20 ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'hover:bg-neutral-100'
                  }`}
                >
                  Medium
                </button>
                <button
                  onClick={() => setEraserRadius(35)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    eraserRadius === 35 ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'hover:bg-neutral-100'
                  }`}
                >
                  Large
                </button>
              </div>
            </div>
          )}

          <div className="h-8 w-px bg-neutral-200" />

          {/* Paper Pattern Selector */}
          <div className="relative">
            <button
              onClick={() => setShowPatternPicker(!showPatternPicker)}
              className="flex flex-col items-center justify-center px-2.5 h-11 rounded-md hover:bg-neutral-200/70 text-neutral-700 transition-colors"
              title="Paper Rule Lines (Ruled, Grid, Dot, Blank)"
              aria-label="Change paper rule lines"
            >
              {backgroundPattern === 'grid' ? (
                <Grid className="w-4 h-4" />
              ) : (
                <AlignJustify className="w-4 h-4" />
              )}
              <span className="text-[10px] mt-0.5">Paper Grid</span>
            </button>

            {showPatternPicker && (
              <div className="absolute top-12 left-0 w-36 bg-white border border-neutral-200 rounded-lg shadow-lg py-1.5 z-40 text-xs">
                <button
                  onClick={() => {
                    setBackgroundPattern('lined');
                    setShowPatternPicker(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2"
                >
                  <AlignJustify className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Ruled Paper</span>
                </button>
                <button
                  onClick={() => {
                    setBackgroundPattern('grid');
                    setShowPatternPicker(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2"
                >
                  <Grid className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Graph Grid</span>
                </button>
                <button
                  onClick={() => {
                    setBackgroundPattern('dotgrid');
                    setShowPatternPicker(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2"
                >
                  <span className="w-3.5 h-3.5 text-center font-bold">·</span>
                  <span>Dot Grid</span>
                </button>
                <button
                  onClick={() => {
                    setBackgroundPattern('blank');
                    setShowPatternPicker(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2"
                >
                  <span className="w-3.5 h-3.5 border border-dashed border-neutral-400 rounded-xs" />
                  <span>Blank Paper</span>
                </button>
              </div>
            )}
          </div>

          {/* Clear Ink (Accurately labeled, preserves text, recoverable via undo) */}
          <button
            onClick={onClearInk}
            className="flex flex-col items-center justify-center px-2.5 h-11 rounded-md hover:bg-neutral-200/70 text-neutral-600 hover:text-rose-600 transition-colors"
            title="Clear Ink Strokes (Typed text boxes and title are retained; recoverable with Undo)"
            aria-label="Clear Ink"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">Clear Ink</span>
          </button>
        </div>
      )}

      {activeTab === 'home' && (
        <div className="h-14 px-3 flex items-center gap-3 text-xs bg-[#f8fafc]">
          <button
            onClick={onInsertTextBox}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors shadow-xs"
            aria-label="Insert text box"
          >
            <Type className="w-4 h-4" />
            <span>Insert Text Box</span>
          </button>

          <div className="h-6 w-px bg-neutral-200" />

          <p className="text-neutral-500 font-sans">
            Click <strong>Type</strong> on the Draw tab or click anywhere on the page surface to place movable text containers alongside handwritten equations and diagrams.
          </p>
        </div>
      )}

      {activeTab === 'view' && (
        <div className="h-14 px-3 flex items-center gap-3 text-xs bg-[#f8fafc]">
          <span className="font-semibold text-neutral-600">Paper Style:</span>
          <div className="flex items-center gap-1 bg-white p-1 rounded-md border border-neutral-200">
            <button
              onClick={() => setBackgroundPattern('lined')}
              className={`px-3 py-1 rounded transition-colors ${
                backgroundPattern === 'lined'
                  ? 'bg-indigo-100 text-indigo-800 font-medium'
                  : 'hover:bg-neutral-100'
              }`}
            >
              Ruled Lines
            </button>
            <button
              onClick={() => setBackgroundPattern('grid')}
              className={`px-3 py-1 rounded transition-colors ${
                backgroundPattern === 'grid'
                  ? 'bg-indigo-100 text-indigo-800 font-medium'
                  : 'hover:bg-neutral-100'
              }`}
            >
              Graph Grid
            </button>
            <button
              onClick={() => setBackgroundPattern('dotgrid')}
              className={`px-3 py-1 rounded transition-colors ${
                backgroundPattern === 'dotgrid'
                  ? 'bg-indigo-100 text-indigo-800 font-medium'
                  : 'hover:bg-neutral-100'
              }`}
            >
              Dot Grid
            </button>
            <button
              onClick={() => setBackgroundPattern('blank')}
              className={`px-3 py-1 rounded transition-colors ${
                backgroundPattern === 'blank'
                  ? 'bg-indigo-100 text-indigo-800 font-medium'
                  : 'hover:bg-neutral-100'
              }`}
            >
              Blank
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
