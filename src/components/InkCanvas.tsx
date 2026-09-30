import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ToolType,
  BackgroundPattern,
  StrokeData,
  VectorPoint,
  TabletDiagnostics,
  NotebookData,
  PageData,
} from '../types/inkforge';
import { evaluateCentripetalCatmullRom, computeDynamicWidth } from '../utils/spline';
import {
  HistoryManager,
  AddStrokeCommand,
  BatchEraseCommand,
  ClearCanvasCommand,
} from '../utils/historyManager';
import { HistoryTimeline } from './HistoryTimeline';
import {
  Undo2,
  Redo2,
  Trash2,
  Hand,
  Pen,
  Highlighter,
  Eraser,
  History,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';

interface InkCanvasProps {
  notebook: NotebookData;
  setNotebook: React.Dispatch<React.SetStateAction<NotebookData>>;
  diagnostics: TabletDiagnostics;
  setDiagnostics: React.Dispatch<React.SetStateAction<TabletDiagnostics>>;
  onStrokeCountChange: (count: number) => void;
  historyManager: HistoryManager;
}

const COLOR_PALETTE = [
  { name: 'Slate', hex: '#0f172a' },
  { name: 'Indigo', hex: '#312e81' },
  { name: 'Burgundy', hex: '#881337' },
  { name: 'Emerald', hex: '#064e3b' },
  { name: 'Amber', hex: '#78350f' },
];

export const InkCanvas: React.FC<InkCanvasProps> = ({
  notebook,
  setNotebook,
  setDiagnostics,
  onStrokeCountChange,
  historyManager,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Tool states
  const [activeTool, setActiveTool] = useState<ToolType>('pen');
  const [activeColor, setActiveColor] = useState<string>('#0f172a');
  const [baseWidth, setBaseWidth] = useState<number>(2.5);
  const [backgroundPattern, setBackgroundPattern] = useState<BackgroundPattern>('dotgrid');

  // Viewport states
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Minimalist History Drawer toggle (default: false for maximum canvas area)
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);

  // Active in-flight stroke points
  const activePointsRef = useRef<VectorPoint[]>([]);
  const isPointerDownRef = useRef<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  const lastPanPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Erasing gesture batch collector
  const erasedStrokesThisGestureRef = useRef<StrokeData[]>([]);

  const activePage = notebook.pages[notebook.activePageIndex] || notebook.pages[0];

  useEffect(() => {
    onStrokeCountChange(activePage.strokes.length);
  }, [activePage.strokes.length, onStrokeCountChange]);

  // Coordinate transformations
  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      return {
        x: (screenX - pan.x) / zoom,
        y: (screenY - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  const worldToScreen = useCallback(
    (worldX: number, worldY: number) => {
      return {
        x: worldX * zoom + pan.x,
        y: worldY * zoom + pan.y,
      };
    },
    [pan, zoom]
  );

  // Redraw the canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Pristine paper background
    ctx.fillStyle = '#fafafc';
    ctx.fillRect(0, 0, width, height);

    // 2. Subtle pattern rendering
    const spacing = 24.0 * zoom;
    const offsetX = pan.x % spacing;
    const offsetY = pan.y % spacing;

    if (backgroundPattern === 'dotgrid') {
      ctx.fillStyle = '#d1d5db';
      const dotRadius = Math.max(0.8, 1.0 * zoom);
      for (let x = offsetX; x < width; x += spacing) {
        for (let y = offsetY; y < height; y += spacing) {
          ctx.beginPath();
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (backgroundPattern === 'grid') {
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let x = offsetX; x < width; x += spacing) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = offsetY; y < height; y += spacing) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    } else if (backgroundPattern === 'lined') {
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let y = offsetY; y < height; y += spacing) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    }

    // 3. Render committed strokes with Catmull-Rom smoothing
    const strokes = activePage.strokes;
    for (const stroke of strokes) {
      const pts = stroke.smoothedPoints || stroke.points;
      if (pts.length < 2) continue;

      if (stroke.tool === 'highlighter') {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.strokeStyle = stroke.color;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = stroke.baseWidth * 3.5 * zoom;
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        const p0 = worldToScreen(pts[0].x, pts[0].y);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < pts.length; ++i) {
          const pi = worldToScreen(pts[i].x, pts[i].y);
          ctx.lineTo(pi.x, pi.y);
        }
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = stroke.color;

        for (let i = 0; i < pts.length - 1; ++i) {
          const p1 = worldToScreen(pts[i].x, pts[i].y);
          const p2 = worldToScreen(pts[i + 1].x, pts[i + 1].y);
          const avgPressure = (pts[i].pressure + pts[i + 1].pressure) * 0.5;
          const dynWidth = computeDynamicWidth(stroke.baseWidth * zoom, avgPressure, stroke.tool);

          ctx.lineWidth = dynWidth;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }

    // 4. Render active in-flight stroke points
    const activePoints = activePointsRef.current;
    if (activePoints.length >= 2) {
      if (activeTool === 'highlighter') {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.strokeStyle = activeColor;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = baseWidth * 3.5 * zoom;
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        const p0 = worldToScreen(activePoints[0].x, activePoints[0].y);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < activePoints.length; ++i) {
          const pi = worldToScreen(activePoints[i].x, activePoints[i].y);
          ctx.lineTo(pi.x, pi.y);
        }
        ctx.stroke();
        ctx.restore();
      } else if (activeTool === 'pen') {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = activeColor;

        for (let i = 0; i < activePoints.length - 1; ++i) {
          const p1 = worldToScreen(activePoints[i].x, activePoints[i].y);
          const p2 = worldToScreen(activePoints[i + 1].x, activePoints[i + 1].y);
          const avgPressure = (activePoints[i].pressure + activePoints[i + 1].pressure) * 0.5;
          const dynWidth = computeDynamicWidth(baseWidth * zoom, avgPressure, 'pen');

          ctx.lineWidth = dynWidth;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }, [
    activePage.strokes,
    activeTool,
    activeColor,
    baseWidth,
    backgroundPattern,
    zoom,
    pan,
    worldToScreen,
  ]);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      redraw();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [redraw]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Check stroke intersection with eraser
  const checkAndCollectErasedStrokes = (worldX: number, worldY: number) => {
    const tolerance = 14.0 / zoom;
    const hitStrokes: StrokeData[] = [];

    for (const stroke of activePage.strokes) {
      const alreadyCollected = erasedStrokesThisGestureRef.current.some((s) => s.id === stroke.id);
      if (alreadyCollected) continue;

      const hit = stroke.points.some((p) => {
        const dx = p.x - worldX;
        const dy = p.y - worldY;
        return dx * dx + dy * dy <= tolerance * tolerance;
      });

      if (hit) {
        hitStrokes.push(stroke);
      }
    }

    if (hitStrokes.length > 0) {
      erasedStrokesThisGestureRef.current.push(...hitStrokes);
      setNotebook((prev) => {
        const pages = [...prev.pages];
        const hitIds = new Set(hitStrokes.map((s) => s.id));
        pages[prev.activePageIndex] = {
          ...pages[prev.activePageIndex],
          strokes: pages[prev.activePageIndex].strokes.filter((s) => !hitIds.has(s.id)),
        };
        return { ...prev, pages };
      });
    }
  };

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    if (activeTool === 'pan' || e.button === 1 || e.buttons === 4) {
      isPanningRef.current = true;
      lastPanPosRef.current = { x: screenX, y: screenY };
      return;
    }

    const world = screenToWorld(screenX, screenY);
    const pressure = e.pressure > 0 ? e.pressure : 0.5;

    if (activeTool === 'eraser' || (e.pointerType === 'pen' && e.buttons === 32)) {
      isPointerDownRef.current = true;
      erasedStrokesThisGestureRef.current = [];
      checkAndCollectErasedStrokes(world.x, world.y);
      return;
    }

    isPointerDownRef.current = true;
    activePointsRef.current = [
      {
        x: world.x,
        y: world.y,
        pressure,
        tiltX: e.tiltX || 0,
        tiltY: e.tiltY || 0,
        timestamp: Date.now(),
      },
    ];

    setDiagnostics({
      pointerType: e.pointerType || 'pen',
      pressure,
      x: Math.round(world.x),
      y: Math.round(world.y),
      tiltX: e.tiltX || 0,
      tiltY: e.tiltY || 0,
      sampleRateHz: 165,
      activePointCount: 1,
      totalStrokesOnPage: activePage.strokes.length,
      smoothingEnabled: true,
    });

    redraw();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    if (isPanningRef.current) {
      const dx = screenX - lastPanPosRef.current.x;
      const dy = screenY - lastPanPosRef.current.y;
      lastPanPosRef.current = { x: screenX, y: screenY };
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      return;
    }

    if (!isPointerDownRef.current) return;

    const world = screenToWorld(screenX, screenY);
    const pressure = e.pressure > 0 ? e.pressure : 0.5;

    if (activeTool === 'eraser' || (e.pointerType === 'pen' && e.buttons === 32)) {
      checkAndCollectErasedStrokes(world.x, world.y);
      return;
    }

    activePointsRef.current.push({
      x: world.x,
      y: world.y,
      pressure,
      tiltX: e.tiltX || 0,
      tiltY: e.tiltY || 0,
      timestamp: Date.now(),
    });

    redraw();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }

    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    if (activeTool === 'eraser' || (e.pointerType === 'pen' && e.buttons === 32)) {
      if (erasedStrokesThisGestureRef.current.length > 0) {
        const removed = [...erasedStrokesThisGestureRef.current];
        erasedStrokesThisGestureRef.current = [];

        const eraseCmd = new BatchEraseCommand(
          removed,
          (strokeIds) => {
            setNotebook((prev) => {
              const pages = [...prev.pages];
              const idSet = new Set(strokeIds);
              pages[prev.activePageIndex] = {
                ...pages[prev.activePageIndex],
                strokes: pages[prev.activePageIndex].strokes.filter((s) => !idSet.has(s.id)),
              };
              return { ...prev, pages, updatedAt: Date.now() };
            });
          },
          (restoredStrokes) => {
            setNotebook((prev) => {
              const pages = [...prev.pages];
              pages[prev.activePageIndex] = {
                ...pages[prev.activePageIndex],
                strokes: [...pages[prev.activePageIndex].strokes, ...restoredStrokes],
              };
              return { ...prev, pages, updatedAt: Date.now() };
            });
          }
        );

        historyManager.executeCommand(eraseCmd);
      }
      return;
    }

    const points = activePointsRef.current;
    if (points.length >= 2) {
      const smoothed = evaluateCentripetalCatmullRom(points, 8);

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const pt of points) {
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      }

      const newStroke: StrokeData = {
        id: `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        tool: activeTool,
        color: activeColor,
        baseWidth,
        opacity: activeTool === 'highlighter' ? 0.35 : 1.0,
        points: [...points],
        smoothedPoints: smoothed,
        bounds: { minX, minY, maxX, maxY },
      };

      const addCmd = new AddStrokeCommand(
        newStroke,
        (s) => {
          setNotebook((prev) => {
            const pages = [...prev.pages];
            pages[prev.activePageIndex] = {
              ...pages[prev.activePageIndex],
              strokes: [...pages[prev.activePageIndex].strokes, s],
            };
            return { ...prev, pages, updatedAt: Date.now() };
          });
        },
        (strokeId) => {
          setNotebook((prev) => {
            const pages = [...prev.pages];
            pages[prev.activePageIndex] = {
              ...pages[prev.activePageIndex],
              strokes: pages[prev.activePageIndex].strokes.filter((s) => s.id !== strokeId),
            };
            return { ...prev, pages, updatedAt: Date.now() };
          });
        }
      );

      historyManager.executeCommand(addCmd);
    }

    activePointsRef.current = [];
    redraw();
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    const newZoom = Math.min(4.0, Math.max(0.2, zoom * factor));
    const actualRatio = newZoom / zoom;

    setZoom(newZoom);
    setPan((prev) => ({
      x: mouseX - (mouseX - prev.x) * actualRatio,
      y: mouseY - (mouseY - prev.y) * actualRatio,
    }));
  };

  const handleClearPage = () => {
    if (activePage.strokes.length === 0) return;
    const prior = [...activePage.strokes];

    const clearCmd = new ClearCanvasCommand(
      prior,
      () => {
        setNotebook((prev) => {
          const pages = [...prev.pages];
          pages[prev.activePageIndex] = {
            ...pages[prev.activePageIndex],
            strokes: [],
          };
          return { ...prev, pages, updatedAt: Date.now() };
        });
      },
      (restoredStrokes) => {
        setNotebook((prev) => {
          const pages = [...prev.pages];
          pages[prev.activePageIndex] = {
            ...pages[prev.activePageIndex],
            strokes: restoredStrokes,
          };
          return { ...prev, pages, updatedAt: Date.now() };
        });
      }
    );

    historyManager.executeCommand(clearCmd);
  };

  const handleAddPage = () => {
    const newIndex = notebook.pages.length;
    const newPage: PageData = {
      id: `page_${newIndex + 1}`,
      title: `Page ${newIndex + 1}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      index: newIndex,
      backgroundPattern,
      gridSpacing: 24,
      strokes: [],
    };
    setNotebook((prev) => ({
      ...prev,
      pages: [...prev.pages, newPage],
      activePageIndex: newIndex,
      updatedAt: Date.now(),
    }));
  };

  const handlePrevPage = () => {
    if (notebook.activePageIndex > 0) {
      setNotebook((prev) => ({
        ...prev,
        activePageIndex: prev.activePageIndex - 1,
      }));
    }
  };

  const handleNextPage = () => {
    if (notebook.activePageIndex < notebook.pages.length - 1) {
      setNotebook((prev) => ({
        ...prev,
        activePageIndex: prev.activePageIndex + 1,
      }));
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-[#fafafc] select-none relative">
      {/* Canvas Viewport */}
      <div className="flex-1 relative cursor-crosshair touch-none overflow-hidden bg-[#fafafc]">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          className="w-full h-full block"
        />

        {/* Minimal Floating Toolbar Island */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 p-1.5 bg-neutral-900/90 backdrop-blur-md rounded-xl border border-neutral-800 shadow-xl text-neutral-300">
          {/* Main Drawing Tools */}
          <button
            onClick={() => setActiveTool('pen')}
            className={`p-1.5 rounded-lg transition-colors ${
              activeTool === 'pen'
                ? 'bg-neutral-800 text-amber-400 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
            title="Pen"
          >
            <Pen className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('highlighter')}
            className={`p-1.5 rounded-lg transition-colors ${
              activeTool === 'highlighter'
                ? 'bg-neutral-800 text-amber-400 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
            title="Highlighter"
          >
            <Highlighter className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('eraser')}
            className={`p-1.5 rounded-lg transition-colors ${
              activeTool === 'eraser'
                ? 'bg-neutral-800 text-amber-400 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
            title="Eraser"
          >
            <Eraser className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('pan')}
            className={`p-1.5 rounded-lg transition-colors ${
              activeTool === 'pan'
                ? 'bg-neutral-800 text-amber-400 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
            title="Pan"
          >
            <Hand className="w-4 h-4" />
          </button>

          {/* Color Dots */}
          {activeTool !== 'eraser' && (
            <>
              <div className="h-4 w-px bg-neutral-800 mx-1" />
              <div className="flex items-center gap-1 px-1">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => setActiveColor(c.hex)}
                    style={{ backgroundColor: c.hex }}
                    className={`w-3.5 h-3.5 rounded-full transition-all ${
                      activeColor === c.hex
                        ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-neutral-900 scale-110'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    title={c.name}
                  />
                ))}
              </div>

              {/* Stroke Width Toggle */}
              <button
                onClick={() => setBaseWidth((w) => (w === 2.5 ? 4.5 : w === 4.5 ? 1.5 : 2.5))}
                className="px-1.5 py-0.5 text-[11px] font-mono text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
                title="Stroke Width"
              >
                {baseWidth}pt
              </button>
            </>
          )}

          <div className="h-4 w-px bg-neutral-800 mx-1" />

          {/* Undo / Redo */}
          <button
            onClick={() => historyManager.undo()}
            disabled={!historyManager.canUndo()}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 disabled:opacity-20"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => historyManager.redo()}
            disabled={!historyManager.canRedo()}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 disabled:opacity-20"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-neutral-800 mx-1" />

          {/* Page navigation */}
          <div className="flex items-center gap-1 text-xs text-neutral-400 font-mono">
            <button
              onClick={handlePrevPage}
              disabled={notebook.activePageIndex === 0}
              className="p-1 hover:text-white disabled:opacity-20"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span>{notebook.activePageIndex + 1}/{notebook.pages.length}</span>
            <button
              onClick={handleNextPage}
              disabled={notebook.activePageIndex === notebook.pages.length - 1}
              className="p-1 hover:text-white disabled:opacity-20"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleAddPage}
              className="p-1 text-neutral-400 hover:text-amber-400 transition-colors ml-0.5"
              title="Add Page"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-neutral-800 mx-1" />

          {/* Paper Pattern Selector */}
          <select
            value={backgroundPattern}
            onChange={(e) => setBackgroundPattern(e.target.value as BackgroundPattern)}
            className="bg-transparent text-[11px] text-neutral-400 hover:text-neutral-200 focus:outline-none cursor-pointer"
            title="Paper Background"
          >
            <option value="dotgrid" className="bg-neutral-900">Dot</option>
            <option value="grid" className="bg-neutral-900">Grid</option>
            <option value="lined" className="bg-neutral-900">Lined</option>
            <option value="blank" className="bg-neutral-900">Blank</option>
          </select>

          {/* Clear Button */}
          <button
            onClick={handleClearPage}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 transition-colors"
            title="Clear Page"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* History Timeline Drawer Button */}
          <button
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className={`p-1.5 rounded-lg transition-colors ${
              isHistoryOpen
                ? 'bg-neutral-800 text-amber-400'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/60'
            }`}
            title="History Timeline"
          >
            <History className="w-4 h-4" />
          </button>
        </div>

        {/* Quiet Minimal Bottom Indicator */}
        <div className="absolute bottom-3 right-4 z-10 flex items-center gap-2 text-[11px] font-mono text-neutral-400 bg-white/80 backdrop-blur-sm px-2.5 py-1 rounded-md border border-neutral-200/80 shadow-xs">
          <button
            onClick={() => {
              setZoom(1.0);
              setPan({ x: 0, y: 0 });
            }}
            className="hover:text-neutral-800 transition-colors"
            title="Reset Zoom to 100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <span aria-hidden="true" className="text-neutral-300">·</span>
          <span>{activePage.strokes.length} strokes</span>
        </div>
      </div>

      {/* History Timeline Overlay Drawer */}
      <HistoryTimeline
        historyManager={historyManager}
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />
    </div>
  );
};
