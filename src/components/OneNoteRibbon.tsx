import React, { useState, useRef, useEffect } from 'react';
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
  Maximize2,
  Minimize2,
  MoreHorizontal,
  ChevronDown,
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
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
  currentSectionTitle?: string;
  currentSectionColor?: string;
  currentPageTitle?: string;
}

const PEN_COLORS = [
  { name: 'Pitch Black', hex: '#0f172a' },
  { name: 'Navy Blue', hex: '#1d4ed8' },
  { name: 'Crimson Red', hex: '#dc2626' },
  { name: 'Forest Green', hex: '#15803d' },
  { name: 'Slate Gray', hex: '#64748b' },
];

const HIGHLIGHTER_COLORS = [
  { name: 'Sunny Yellow', hex: '#fde047' },
  { name: 'Lavender Purple', hex: '#c084fc' },
  { name: 'Mint Green', hex: '#86efac' },
  { name: 'Sky Blue', hex: '#7dd3fc' },
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
  isFocusMode = false,
  onToggleFocusMode,
  currentSectionTitle,
  currentSectionColor = '#4f46e5',
  currentPageTitle,
}) => {
  const [showPatternPicker, setShowPatternPicker] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSecondaryMenu, setShowSecondaryMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Close menus on click outside
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.ribbon-menu-container')) {
        setShowExportMenu(false);
        setShowSecondaryMenu(false);
        setShowPatternPicker(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportJSON(file);
      e.target.value = '';
    }
  };

  const isNotebookWorkspace = activeTab === 'draw' || activeTab === 'home' || activeTab === 'view';

  return (
    <header className="border-b border-neutral-200/80 bg-white flex flex-col shrink-0 select-none text-neutral-800 z-30 font-sans">
      {/* 1. Top Bar: Brand, Context, Save Status, Workspace Navigation, Actions */}
      <div className="h-10 px-3 flex items-center justify-between text-xs border-b border-neutral-100">
        {/* Left: Brand & Context */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* InkForge Logo */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center text-[11px] font-mono font-bold shadow-2xs">
              IF
            </span>
            <span className="font-semibold text-neutral-900 tracking-tight text-xs hidden sm:inline">
              InkForge
            </span>
          </div>

          <div className="h-3.5 w-px bg-neutral-200/80 shrink-0" />

          {/* Notebook Section & Page Context */}
          {currentSectionTitle && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-600 truncate max-w-[200px] sm:max-w-[320px]">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: currentSectionColor }}
              />
              <span className="font-medium text-neutral-800 truncate">{currentSectionTitle}</span>
              {currentPageTitle && (
                <>
                  <span className="text-neutral-300">/</span>
                  <span className="text-neutral-500 truncate">{currentPageTitle}</span>
                </>
              )}
            </div>
          )}

          <div className="h-3.5 w-px bg-neutral-200/80 shrink-0 hidden sm:block" />

          {/* Quick Undo / Redo */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={onUndo}
              disabled={!historyManager.canUndo()}
              className="p-1 hover:bg-neutral-100 rounded text-neutral-500 hover:text-neutral-900 disabled:opacity-30 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!historyManager.canRedo()}
              className="p-1 hover:bg-neutral-100 rounded text-neutral-500 hover:text-neutral-900 disabled:opacity-30 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              title="Redo (Ctrl+Y)"
              aria-label="Redo"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-3.5 w-px bg-neutral-200/80 shrink-0" />

          {/* Compact Save Status */}
          {saveStatus === 'saving' && (
            <div className="flex items-center gap-1 text-[11px] text-neutral-500 font-mono">
              <RotateCw className="w-3 h-3 animate-spin text-neutral-400" />
              <span className="hidden md:inline">Saving</span>
            </div>
          )}
          {saveStatus === 'idle' && (
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span className="hidden md:inline">Saved locally</span>
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="flex items-center gap-1 text-[11px] text-rose-600 font-medium">
              <AlertTriangle className="w-3 h-3 text-rose-600" />
              <span>Save error</span>
              <button
                onClick={onRetrySave}
                className="underline hover:text-rose-700 font-semibold ml-0.5"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Center: Primary Workspace Switcher (Distinguished from Drawing Tools) */}
        <nav aria-label="Workspace" className="flex items-center p-0.5 bg-neutral-100/80 rounded-lg">
          <button
            onClick={() => setActiveTab('draw')}
            className={`px-3 py-1 rounded-md text-xs transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
              isNotebookWorkspace
                ? 'bg-white text-neutral-900 font-semibold shadow-2xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Notebook
          </button>

          <button
            onClick={() => setActiveTab('lab')}
            className={`px-3 py-1 rounded-md text-xs transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
              activeTab === 'lab'
                ? 'bg-white text-indigo-700 font-semibold shadow-2xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Handwriting Lab</span>
          </button>
        </nav>

        {/* Right: Export, Focus Mode, and Secondary Menu */}
        <div className="flex items-center gap-1.5">
          {/* Export / Backup Dropdown */}
          <div className="relative ribbon-menu-container">
            <button
              onClick={() => {
                setShowExportMenu(!showExportMenu);
                setShowSecondaryMenu(false);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none text-xs"
              aria-label="Export or backup notebook"
            >
              <Download className="w-3.5 h-3.5 text-neutral-500" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className="w-3 h-3 text-neutral-400" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-8 w-52 bg-white border border-neutral-200 rounded-lg shadow-lg py-1.5 z-50 text-xs">
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

          {/* Focus Mode Button */}
          {onToggleFocusMode && (
            <button
              onClick={onToggleFocusMode}
              className={`p-1.5 rounded-md transition-colors text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                isFocusMode ? 'bg-indigo-50 text-indigo-700' : ''
              }`}
              title={isFocusMode ? 'Exit Focus Mode (Esc)' : 'Focus Mode (F)'}
              aria-label={isFocusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
            >
              {isFocusMode ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Secondary Options Menu (...) */}
          <div className="relative ribbon-menu-container">
            <button
              onClick={() => {
                setShowSecondaryMenu(!showSecondaryMenu);
                setShowExportMenu(false);
              }}
              className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              title="More options"
              aria-label="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showSecondaryMenu && (
              <div className="absolute right-0 top-8 w-48 bg-white border border-neutral-200 rounded-lg shadow-lg py-1.5 z-50 text-xs">
                <button
                  onClick={() => {
                    onToggleHistory();
                    setShowSecondaryMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-neutral-50 flex items-center justify-between ${
                    isHistoryOpen ? 'text-indigo-600 font-medium' : 'text-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Page History</span>
                  </div>
                  {isHistoryOpen && <span className="text-[10px] text-indigo-600 font-mono">Open</span>}
                </button>

                <button
                  onClick={() => {
                    setActiveTab('dev');
                    setShowSecondaryMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2 ${
                    activeTab === 'dev' ? 'text-indigo-600 font-medium' : 'text-neutral-700'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Developer / C++</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Drawing Toolbar Row (Cleaned up, calm, uniform dimensions) */}
      {isNotebookWorkspace && (
        <div className="h-10 px-3 bg-[#fafaf9] border-b border-neutral-200/60 flex items-center gap-2.5 overflow-x-auto text-xs">
          {/* Drawing Tool Selector */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTool('pen')}
              className={`h-7 px-2.5 rounded-md flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                activeTool === 'pen'
                  ? 'bg-white text-indigo-700 font-semibold shadow-2xs ring-1 ring-neutral-200'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
              }`}
              title="Pen (P)"
              aria-label="Pen tool"
            >
              <Pen className="w-3.5 h-3.5" />
              <span>Pen</span>
            </button>

            <button
              onClick={() => setActiveTool('highlighter')}
              className={`h-7 px-2.5 rounded-md flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                activeTool === 'highlighter'
                  ? 'bg-white text-indigo-700 font-semibold shadow-2xs ring-1 ring-neutral-200'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
              }`}
              title="Highlighter (H)"
              aria-label="Highlighter tool"
            >
              <Highlighter className="w-3.5 h-3.5" />
              <span>Highlight</span>
            </button>

            <button
              onClick={() => setActiveTool('eraser')}
              className={`h-7 px-2.5 rounded-md flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                activeTool === 'eraser'
                  ? 'bg-white text-indigo-700 font-semibold shadow-2xs ring-1 ring-neutral-200'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
              }`}
              title="Eraser (E)"
              aria-label="Eraser tool"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Eraser</span>
            </button>

            <button
              onClick={() => setActiveTool('text')}
              className={`h-7 px-2.5 rounded-md flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                activeTool === 'text'
                  ? 'bg-white text-indigo-700 font-semibold shadow-2xs ring-1 ring-neutral-200'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
              }`}
              title="Type (T)"
              aria-label="Type tool"
            >
              <Type className="w-3.5 h-3.5" />
              <span>Text</span>
            </button>

            <button
              onClick={() => setActiveTool('pan')}
              className={`h-7 px-2.5 rounded-md flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                activeTool === 'pan'
                  ? 'bg-white text-indigo-700 font-semibold shadow-2xs ring-1 ring-neutral-200'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
              }`}
              title="Pan (V or hold Space)"
              aria-label="Pan tool"
            >
              <Hand className="w-3.5 h-3.5" />
              <span>Pan</span>
            </button>
          </div>

          <div className="h-4 w-px bg-neutral-200 shrink-0" />

          {/* Active Tool Specific Settings Area */}
          <div className="flex items-center gap-2">
            {activeTool === 'pen' && (
              <div className="flex items-center gap-2">
                {/* Clean Pen Color Palette Dots (NO repeated width labels) */}
                <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-md border border-neutral-200/80 shadow-2xs">
                  {PEN_COLORS.map((pen) => {
                    const isSelected = activeColor === pen.hex;
                    return (
                      <button
                        key={pen.hex}
                        onClick={() => setActiveColor(pen.hex)}
                        style={{ backgroundColor: pen.hex }}
                        className={`w-4 h-4 rounded-full border border-black/15 transition-transform ${
                          isSelected ? 'scale-125 ring-2 ring-indigo-500/80' : 'hover:scale-110'
                        }`}
                        title={pen.name}
                        aria-label={pen.name}
                      />
                    );
                  })}

                  <input
                    type="color"
                    value={activeColor}
                    onChange={(e) => setActiveColor(e.target.value)}
                    className="w-4 h-4 rounded-full cursor-pointer border-0 p-0 ml-0.5 overflow-hidden"
                    title="Custom color"
                    aria-label="Custom color picker"
                  />
                </div>

                {/* Single Pen Thickness Selector */}
                <select
                  value={baseWidth}
                  onChange={(e) => setBaseWidth(parseFloat(e.target.value))}
                  className="h-7 text-xs bg-white px-2 rounded-md border border-neutral-200/80 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                  title="Pen Thickness"
                  aria-label="Pen thickness"
                >
                  <option value={1.5}>Fine (1.5pt)</option>
                  <option value={2.2}>Medium (2.2pt)</option>
                  <option value={3.5}>Broad (3.5pt)</option>
                  <option value={5.0}>Bold (5.0pt)</option>
                </select>
              </div>
            )}

            {activeTool === 'highlighter' && (
              <div className="flex items-center gap-2">
                {/* Highlighter Color Palette Dots */}
                <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-md border border-neutral-200/80 shadow-2xs">
                  {HIGHLIGHTER_COLORS.map((hl) => {
                    const isSelected = activeColor === hl.hex;
                    return (
                      <button
                        key={hl.hex}
                        onClick={() => setActiveColor(hl.hex)}
                        style={{ backgroundColor: hl.hex }}
                        className={`w-4 h-4 rounded-full border border-black/15 transition-transform ${
                          isSelected ? 'scale-125 ring-2 ring-indigo-500/80' : 'hover:scale-110'
                        }`}
                        title={hl.name}
                        aria-label={hl.name}
                      />
                    );
                  })}
                </div>

                <select
                  value={highlighterWidth}
                  onChange={(e) => setHighlighterWidth(parseFloat(e.target.value))}
                  className="h-7 text-xs bg-white px-2 rounded-md border border-neutral-200/80 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                  title="Highlighter Width"
                  aria-label="Highlighter width"
                >
                  <option value={10}>Narrow (10pt)</option>
                  <option value={16}>Standard (16pt)</option>
                  <option value={24}>Wide (24pt)</option>
                </select>
              </div>
            )}

            {activeTool === 'eraser' && (
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-md border border-neutral-200/80 shadow-2xs text-xs">
                <button
                  onClick={() => setEraserRadius(10)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    eraserRadius === 10
                      ? 'bg-neutral-200/80 text-neutral-900 font-semibold'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Small
                </button>
                <button
                  onClick={() => setEraserRadius(20)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    eraserRadius === 20
                      ? 'bg-neutral-200/80 text-neutral-900 font-semibold'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Medium
                </button>
                <button
                  onClick={() => setEraserRadius(35)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    eraserRadius === 35
                      ? 'bg-neutral-200/80 text-neutral-900 font-semibold'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Large
                </button>
              </div>
            )}

            {activeTool === 'text' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={onInsertTextBox}
                  className="h-7 px-2.5 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors shadow-xs flex items-center gap-1.5"
                  aria-label="Insert text note box"
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>Insert Note</span>
                </button>
                <span className="text-[11px] text-neutral-500 hidden lg:inline">
                  Click canvas surface to place note
                </span>
              </div>
            )}

            {activeTool === 'pan' && (
              <span className="text-[11px] text-neutral-500 font-sans">
                Drag canvas to navigate · Scroll to zoom
              </span>
            )}
          </div>

          <div className="h-4 w-px bg-neutral-200 shrink-0 ml-auto" />

          {/* Paper Rule / Grid Dropdown */}
          <div className="relative ribbon-menu-container">
            <button
              onClick={() => {
                setShowPatternPicker(!showPatternPicker);
                setShowExportMenu(false);
                setShowSecondaryMenu(false);
              }}
              className="h-7 px-2.5 rounded-md border border-neutral-200/80 bg-white hover:bg-neutral-50 text-neutral-700 font-medium transition-colors flex items-center gap-1.5 text-xs shadow-2xs"
              title="Change paper rule lines"
              aria-label="Change paper rule lines"
            >
              {backgroundPattern === 'grid' ? (
                <Grid className="w-3.5 h-3.5 text-indigo-600" />
              ) : (
                <AlignJustify className="w-3.5 h-3.5 text-indigo-600" />
              )}
              <span className="capitalize">
                {backgroundPattern === 'lined'
                  ? 'Ruled'
                  : backgroundPattern === 'dotgrid'
                  ? 'Dot Grid'
                  : backgroundPattern === 'grid'
                  ? 'Graph Grid'
                  : 'Blank'}
              </span>
              <ChevronDown className="w-3 h-3 text-neutral-400" />
            </button>

            {showPatternPicker && (
              <div className="absolute right-0 top-8 w-36 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-50 text-xs">
                <button
                  onClick={() => {
                    setBackgroundPattern('lined');
                    setShowPatternPicker(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2 ${
                    backgroundPattern === 'lined' ? 'text-indigo-600 font-semibold' : 'text-neutral-700'
                  }`}
                >
                  <AlignJustify className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Ruled Paper</span>
                </button>
                <button
                  onClick={() => {
                    setBackgroundPattern('grid');
                    setShowPatternPicker(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2 ${
                    backgroundPattern === 'grid' ? 'text-indigo-600 font-semibold' : 'text-neutral-700'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Graph Grid</span>
                </button>
                <button
                  onClick={() => {
                    setBackgroundPattern('dotgrid');
                    setShowPatternPicker(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2 ${
                    backgroundPattern === 'dotgrid' ? 'text-indigo-600 font-semibold' : 'text-neutral-700'
                  }`}
                >
                  <span className="w-3.5 text-center font-bold text-indigo-600">·</span>
                  <span>Dot Grid</span>
                </button>
                <button
                  onClick={() => {
                    setBackgroundPattern('blank');
                    setShowPatternPicker(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2 ${
                    backgroundPattern === 'blank' ? 'text-indigo-600 font-semibold' : 'text-neutral-700'
                  }`}
                >
                  <span className="w-3 h-3 border border-dashed border-neutral-400 rounded-xs" />
                  <span>Blank Paper</span>
                </button>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-neutral-200 shrink-0" />

          {/* Destructive Clear Ink (Visually separated, accurately labeled, recoverable via undo) */}
          <button
            onClick={onClearInk}
            className="h-7 px-2 rounded-md hover:bg-rose-50 text-neutral-500 hover:text-rose-600 transition-colors flex items-center gap-1"
            title="Clear Ink Strokes (Text boxes and title are preserved; recoverable with Undo)"
            aria-label="Clear Ink"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Clear Ink</span>
          </button>
        </div>
      )}
    </header>
  );
};
