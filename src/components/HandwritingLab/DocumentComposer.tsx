import React, { useState, useEffect, useRef, useMemo } from 'react';
import { HandwritingProfile, LayoutOptions, ComposerDocument } from '../../handwriting/types';
import { DraftManagerState, DraftSaveStatus } from '../../handwriting/draftManager';
import { SampleBasedHandwritingRenderer, exportPagesToPDF } from '../../handwriting/sampleRenderer';
import {
  FileText,
  FileCode,
  Download,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Sliders,
  RotateCw,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface DocumentComposerProps {
  profile: HandwritingProfile | null;
  draft: ComposerDocument | null;
  draftManagerState: DraftManagerState;
  draftLoadError: string | null;
  draftSaveStatus: DraftSaveStatus;
  onUpdateDraft: (updated: ComposerDocument) => void;
  onRetrySaveDraft: () => void;
  onRetryLoadDraft: () => void;
}

export const PRESET_TEXTS = [
  {
    name: 'Calculus III Study Summary',
    text: `Stokes' Theorem relates the surface integral of the curl of a vector field over a surface to the line integral of the vector field over its boundary curve.

Key formula:
integral_C F . dr = double_integral_S (curl F) . dS

Notes for midterm:
1. Verify orientation of the boundary curve using the right-hand rule.
2. Parametrize the surface carefully before computing the normal vector.`,
  },
  {
    name: 'Quick Brown Fox Pangram',
    text: `The quick brown fox jumps over the lazy dog.
PACK MY BOX WITH FIVE DOZEN LIQUOR JUGS!
1234567890 . , ! ? - ' " : ; ( )`,
  },
  {
    name: 'Research Roadmap Note',
    text: `Milestone 1: Capture personal print handwriting samples.
Milestone 2: Compose new study paragraphs preserving recognizable letter shapes and baseline alignment.
Milestone 3: Export vector SVG and multipage PDF documents for print and revision.`,
  },
];

const DEFAULT_OPTIONS: LayoutOptions = {
  pageWidth: 595,
  pageHeight: 842,
  margins: { top: 48, right: 48, bottom: 48, left: 48 },
  fontSize: 24,
  lineHeight: 1.5,
  letterSpacing: 1.0,
  wordSpacing: 1.0,
};

export const DocumentComposer: React.FC<DocumentComposerProps> = ({
  profile,
  draft,
  draftManagerState,
  draftLoadError,
  draftSaveStatus,
  onUpdateDraft,
  onRetrySaveDraft,
  onRetryLoadDraft,
}) => {
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const effectiveProfile: HandwritingProfile = useMemo(() => {
    if (profile) return profile;
    return {
      schemaVersion: 1,
      app: 'InkForge-HandwritingProfile',
      id: 'empty_fallback',
      name: 'No Profile Selected',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      glyphs: {},
    };
  }, [profile]);

  const renderer = useMemo(
    () => new SampleBasedHandwritingRenderer(effectiveProfile),
    [effectiveProfile]
  );

  const draftText = draft?.text ?? '';
  const draftOptions = draft?.options ?? DEFAULT_OPTIONS;

  // Compute paginated layout using draft options
  const pages = useMemo(() => {
    return renderer.layoutText(draftText, draftOptions);
  }, [renderer, draftText, draftOptions]);

  // Adjust page index when page count changes
  useEffect(() => {
    if (currentPageIndex >= pages.length) {
      setCurrentPageIndex(Math.max(0, pages.length - 1));
    }
  }, [pages.length, currentPageIndex]);

  const activePage = pages[currentPageIndex] || pages[0];

  // Render active page to canvas
  useEffect(() => {
    if (!activePage || !canvasRef.current) return;
    renderer.renderToCanvas(activePage, canvasRef.current, 2);
  }, [renderer, activePage]);

  // Collect all missing characters across all pages
  const allMissingChars = useMemo(() => {
    const set = new Set<string>();
    for (const p of pages) {
      for (const c of p.missingChars) {
        set.add(c);
      }
    }
    return Array.from(set);
  }, [pages]);

  const isEditingDisabled = draftManagerState !== 'ready' || !draft;

  // Handlers for draft mutations
  const handleTextChange = (newText: string) => {
    if (isEditingDisabled || !draft) return;
    onUpdateDraft({
      ...draft,
      text: newText,
      updatedAt: Date.now(),
    });
  };

  const handleOptionChange = (key: keyof LayoutOptions, val: number) => {
    if (isEditingDisabled || !draft) return;
    onUpdateDraft({
      ...draft,
      options: {
        ...draft.options,
        [key]: val,
      },
      updatedAt: Date.now(),
    });
  };

  const handleApplyPreset = (presetText: string) => {
    if (isEditingDisabled || !draft) return;
    if (draft.text.trim().length > 0 && draft.text !== presetText) {
      const confirmReplace = window.confirm(
        'Replace current draft text with preset? Your custom changes in this draft will be overwritten.'
      );
      if (!confirmReplace) return;
    }
    handleTextChange(presetText);
  };

  // Export SVG of current page
  const handleExportSVG = () => {
    setExportError(null);
    try {
      if (!activePage) return;
      const svgString = renderer.renderToSVG(activePage);
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `InkForge_Handwriting_Page_${activePage.pageNumber}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError(`Export SVG failed: ${err.message || 'Unknown error'}`);
    }
  };

  // Export Multipage PDF
  const handleExportPDF = () => {
    setExportError(null);
    try {
      if (pages.length === 0) return;
      exportPagesToPDF(pages, renderer, `${effectiveProfile.name}_Document`);
    } catch (err: any) {
      setExportError(`Export PDF failed: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-neutral-100 text-neutral-800 text-xs">
      {/* Left: Input Text Editor & Typography Controls */}
      <div className="w-[430px] border-r border-neutral-200 bg-white flex flex-col shrink-0 overflow-hidden">
        {/* Presets and Save Status */}
        <div className="p-3 border-b border-neutral-200 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-900 text-sm">Composer Draft</span>

              {/* Draft Save Status Indicator */}
              {draftSaveStatus === 'saving' && (
                <div className="flex items-center gap-1 text-[11px] text-neutral-500 font-mono">
                  <RotateCw className="w-3 h-3 animate-spin text-indigo-500" />
                  <span>Saving draft...</span>
                </div>
              )}
              {draftSaveStatus === 'idle' && draftManagerState === 'ready' && (
                <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-mono">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Saved locally</span>
                </div>
              )}
              {draftSaveStatus === 'error' && (
                <div className="flex items-center gap-1 text-[11px] text-rose-600 font-mono">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Save failed</span>
                  <button
                    onClick={onRetrySaveDraft}
                    className="underline hover:text-rose-700 font-medium ml-0.5"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              {PRESET_TEXTS.map((preset, idx) => (
                <button
                  key={idx}
                  disabled={isEditingDisabled}
                  onClick={() => handleApplyPreset(preset.text)}
                  className="px-2 py-0.5 rounded text-[11px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors disabled:opacity-40"
                  title={preset.name}
                >
                  Preset {idx + 1}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-neutral-500 leading-relaxed">
            Your draft text and typography are automatically preserved. Composed words use the currently selected profile: <strong>{effectiveProfile.name}</strong>.
          </p>
        </div>

        {/* Load Error Banner if draft reading failed */}
        {draftManagerState === 'load_error' && (
          <div className="bg-rose-50 border-b border-rose-200 p-3 space-y-2">
            <div className="flex items-start gap-2 text-rose-800 text-[11px]">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Draft Storage Read Failure</p>
                <p className="text-rose-600 mt-0.5">
                  {draftLoadError || 'Could not load saved draft from storage.'}
                </p>
                <p className="text-neutral-500 mt-1">
                  Editing is locked to prevent overwriting your saved work. Click Retry to restore your document.
                </p>
              </div>
            </div>
            <button
              onClick={onRetryLoadDraft}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-rose-600 text-white font-medium hover:bg-rose-700 transition-colors shadow-xs"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry Load Draft</span>
            </button>
          </div>
        )}

        {/* Text Area */}
        <div className="flex-1 p-3 flex flex-col">
          <textarea
            value={draftText}
            disabled={isEditingDisabled}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={
              draftManagerState === 'load_error'
                ? 'Draft loading failed. Please click Retry Load Draft above.'
                : 'Type your notes or document text here...'
            }
            className="w-full flex-1 p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-mono text-neutral-800 focus:outline-none focus:border-indigo-500 focus:bg-white resize-none leading-relaxed transition-colors disabled:opacity-50 disabled:bg-neutral-100"
          />
        </div>

        {/* Typography Controls Drawer */}
        <div className="p-3 border-t border-neutral-200 bg-neutral-50 space-y-2.5">
          <div className="flex items-center gap-1.5 font-semibold text-neutral-700 text-[11px]">
            <Sliders className="w-3.5 h-3.5 text-indigo-600" />
            <span>Handwriting Typography Controls</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div>
              <div className="flex justify-between text-neutral-500 mb-1">
                <span>Font Size</span>
                <span className="font-mono">{draftOptions.fontSize}pt</span>
              </div>
              <input
                type="range"
                disabled={isEditingDisabled}
                min="18"
                max="40"
                step="1"
                value={draftOptions.fontSize}
                onChange={(e) => handleOptionChange('fontSize', parseInt(e.target.value))}
                className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-40"
              />
            </div>

            <div>
              <div className="flex justify-between text-neutral-500 mb-1">
                <span>Line Height</span>
                <span className="font-mono">{draftOptions.lineHeight}x</span>
              </div>
              <input
                type="range"
                disabled={isEditingDisabled}
                min="1.2"
                max="2.2"
                step="0.1"
                value={draftOptions.lineHeight}
                onChange={(e) => handleOptionChange('lineHeight', parseFloat(e.target.value))}
                className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-40"
              />
            </div>

            <div>
              <div className="flex justify-between text-neutral-500 mb-1">
                <span>Letter Spacing</span>
                <span className="font-mono">{draftOptions.letterSpacing.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                disabled={isEditingDisabled}
                min="0.8"
                max="1.5"
                step="0.05"
                value={draftOptions.letterSpacing}
                onChange={(e) => handleOptionChange('letterSpacing', parseFloat(e.target.value))}
                className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-40"
              />
            </div>

            <div>
              <div className="flex justify-between text-neutral-500 mb-1">
                <span>Word Spacing</span>
                <span className="font-mono">{draftOptions.wordSpacing.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                disabled={isEditingDisabled}
                min="0.8"
                max="2.0"
                step="0.1"
                value={draftOptions.wordSpacing}
                onChange={(e) => handleOptionChange('wordSpacing', parseFloat(e.target.value))}
                className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-40"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right: Paginated A4 Document Live Preview */}
      <div className="flex-1 flex flex-col overflow-hidden bg-neutral-200/70">
        {/* Preview Header & Export Bar */}
        <div className="h-11 px-4 border-b border-neutral-300 bg-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-900">A4 Document Preview</span>
            <span className="font-mono text-neutral-400">·</span>
            <span className="text-neutral-500 font-mono">
              Page {currentPageIndex + 1} of {pages.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Pagination Controls */}
            <div className="flex items-center gap-1 mr-2 border-r border-neutral-200 pr-2">
              <button
                onClick={() => setCurrentPageIndex((idx) => Math.max(0, idx - 1))}
                disabled={currentPageIndex === 0}
                className="p-1 rounded hover:bg-neutral-100 disabled:opacity-30 text-neutral-700"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPageIndex((idx) => Math.min(pages.length - 1, idx + 1))}
                disabled={currentPageIndex >= pages.length - 1}
                className="p-1 rounded hover:bg-neutral-100 disabled:opacity-30 text-neutral-700"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Vector SVG Export */}
            <button
              onClick={handleExportSVG}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium transition-colors"
              title="Export current page as vector SVG"
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-600" />
              <span>Export SVG</span>
            </button>

            {/* Genuine Vector PDF Export */}
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors shadow-xs"
              title="Export complete document as genuine vector PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Vector PDF ({pages.length}p)</span>
            </button>
          </div>
        </div>

        {/* Visible Export Failure Banner */}
        {exportError && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 flex items-center justify-between text-xs text-rose-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{exportError}</span>
            </div>
            <button
              onClick={() => setExportError(null)}
              className="underline text-rose-600 hover:text-rose-800 text-[11px]"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Plain-Language Missing Characters Notice */}
        {allMissingChars.length > 0 && (
          <div className="bg-amber-50/90 border-b border-amber-200/80 px-4 py-2 flex items-center gap-2 text-amber-900 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{allMissingChars.length} character{allMissingChars.length > 1 ? 's are' : ' is'} not yet captured in &quot;{effectiveProfile.name}&quot;:</strong>{' '}
              {allMissingChars.map((c) => (
                <span
                  key={c}
                  className="font-mono font-semibold bg-amber-100/80 text-amber-950 px-1 py-0.5 rounded mr-1"
                >
                  {c === ' ' ? 'space' : c}
                </span>
              ))}
              (shown in dashed amber boxes). Capture them in Character Studio or continue composing.
            </span>
          </div>
        )}

        {/* Canvas Document Scroll Container with desk styling */}
        <div className="flex-1 overflow-auto p-8 flex justify-center items-start bg-[#eceae4]">
          <div className="bg-white rounded-sm shadow-md border border-neutral-300/80 transition-shadow">
            <canvas
              ref={canvasRef}
              style={{
                width: `${draftOptions.pageWidth}px`,
                height: `${draftOptions.pageHeight}px`,
              }}
              className="block bg-white rounded-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
