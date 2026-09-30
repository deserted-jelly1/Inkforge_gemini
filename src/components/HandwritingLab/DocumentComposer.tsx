import React, { useState, useEffect, useRef, useMemo } from 'react';
import { HandwritingProfile, LayoutOptions } from '../../handwriting/types';
import { SampleBasedHandwritingRenderer, exportPagesToPDF } from '../../handwriting/sampleRenderer';
import {
  FileText,
  FileCode,
  Download,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Sparkles,
} from 'lucide-react';

interface DocumentComposerProps {
  profile: HandwritingProfile;
}

const PRESET_TEXTS = [
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

export const DocumentComposer: React.FC<DocumentComposerProps> = ({ profile }) => {
  const [inputText, setInputText] = useState<string>(PRESET_TEXTS[0].text);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);

  // Typography controls
  const [fontSize, setFontSize] = useState<number>(24);
  const [lineHeight, setLineHeight] = useState<number>(1.5);
  const [letterSpacing, setLetterSpacing] = useState<number>(1.0);
  const [wordSpacing, setWordSpacing] = useState<number>(1.0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Standard A4 dimensions in pt (595 x 842 pt)
  const layoutOptions: LayoutOptions = useMemo(
    () => ({
      pageWidth: 595,
      pageHeight: 842,
      margins: { top: 48, right: 48, bottom: 48, left: 48 },
      fontSize,
      lineHeight,
      letterSpacing,
      wordSpacing,
    }),
    [fontSize, lineHeight, letterSpacing, wordSpacing]
  );

  // Instantiate renderer with current profile
  const renderer = useMemo(() => new SampleBasedHandwritingRenderer(profile), [profile]);

  // Compute paginated layout
  const pages = useMemo(() => {
    return renderer.layoutText(inputText, layoutOptions);
  }, [renderer, inputText, layoutOptions]);

  // Ensure current page index is valid
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

  // Export SVG of current page
  const handleExportSVG = () => {
    if (!activePage) return;
    const svgString = renderer.renderToSVG(activePage);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `InkForge_Handwriting_Page_${activePage.pageNumber}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export Multipage PDF
  const handleExportPDF = () => {
    if (pages.length === 0) return;
    exportPagesToPDF(pages, renderer, `${profile.name}_Document`);
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-neutral-100 text-neutral-800 text-xs">
      {/* Left: Input Text Editor & Typography Controls */}
      <div className="w-[420px] border-r border-neutral-200 bg-white flex flex-col shrink-0 overflow-hidden">
        {/* Presets and Status */}
        <div className="p-3 border-b border-neutral-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-neutral-900 text-sm">Document Composer</span>
            <div className="flex items-center gap-1">
              {PRESET_TEXTS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => setInputText(preset.text)}
                  className="px-2 py-0.5 rounded text-[11px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors"
                  title={preset.name}
                >
                  Preset {idx + 1}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-neutral-500 leading-relaxed">
            Type any new text below. Words are dynamically assembled from your captured character glyphs.
          </p>
        </div>

        {/* Text Area */}
        <div className="flex-1 p-3 flex flex-col">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your notes or document text here..."
            className="w-full flex-1 p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-mono text-neutral-800 focus:outline-none focus:border-indigo-500 focus:bg-white resize-none leading-relaxed transition-colors"
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
                <span className="font-mono">{fontSize}pt</span>
              </div>
              <input
                type="range"
                min="18"
                max="40"
                step="1"
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value))}
                className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-neutral-500 mb-1">
                <span>Line Height</span>
                <span className="font-mono">{lineHeight}x</span>
              </div>
              <input
                type="range"
                min="1.2"
                max="2.2"
                step="0.1"
                value={lineHeight}
                onChange={(e) => setLineHeight(parseFloat(e.target.value))}
                className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-neutral-500 mb-1">
                <span>Letter Spacing</span>
                <span className="font-mono">{letterSpacing.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.5"
                step="0.05"
                value={letterSpacing}
                onChange={(e) => setLetterSpacing(parseFloat(e.target.value))}
                className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <div>
              <div className="flex justify-between text-neutral-500 mb-1">
                <span>Word Spacing</span>
                <span className="font-mono">{wordSpacing.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="2.0"
                step="0.1"
                value={wordSpacing}
                onChange={(e) => setWordSpacing(parseFloat(e.target.value))}
                className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
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
            {/* Pagination Buttons */}
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

            {/* Multipage PDF Export */}
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors shadow-xs"
              title="Export complete document as multipage PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF ({pages.length}p)</span>
            </button>
          </div>
        </div>

        {/* Missing Characters Alert Banner */}
        {allMissingChars.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-amber-800 text-[11px]">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Missing characters in profile:</strong>{' '}
              {allMissingChars.map((c) => (
                <span
                  key={c}
                  className="font-mono bg-amber-100 text-amber-900 px-1 rounded mr-1"
                >
                  {c === ' ' ? 'space' : c}
                </span>
              ))}
              (shown in dashed amber boxes in preview)
            </span>
          </div>
        )}

        {/* Canvas Document Scroll Container */}
        <div className="flex-1 overflow-auto p-6 flex justify-center items-start">
          <div className="bg-white rounded-lg shadow-xl border border-neutral-300 p-1">
            <canvas
              ref={canvasRef}
              style={{
                width: `${layoutOptions.pageWidth}px`,
                height: `${layoutOptions.pageHeight}px`,
              }}
              className="block bg-white rounded-md"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
