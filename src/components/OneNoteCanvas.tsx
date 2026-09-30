import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ToolType,
  BackgroundPattern,
  StrokeData,
  VectorPoint,
  TextNoteContainer,
  PageData,
} from '../types/inkforge';
import { evaluateCentripetalCatmullRom, computeDynamicWidth } from '../utils/spline';
import {
  HistoryManager,
  AddStrokeCommand,
  BatchEraseCommand,
} from '../utils/historyManager';
import { X, Move, Plus, ZoomIn, ZoomOut } from 'lucide-react';

interface OneNoteCanvasProps {
  page: PageData;
  onUpdatePage: (updatedPage: PageData) => void;
  activeTool: ToolType;
  activeColor: string;
  baseWidth: number;
  backgroundPattern: BackgroundPattern;
  historyManager: HistoryManager;
}

export const OneNoteCanvas: React.FC<OneNoteCanvasProps> = ({
  page,
  onUpdatePage,
  activeTool,
  activeColor,
  baseWidth,
  backgroundPattern,
  historyManager,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Zoom & Pan state
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // In-flight drawing points
  const activePointsRef = useRef<VectorPoint[]>([]);
  const isPointerDownRef = useRef<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  const lastPanPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const erasedStrokesThisGestureRef = useRef<StrokeData[]>([]);

  // Text Containers
  const textNotes = page.textNotes || [];

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

  // Format date header like OneNote: "Wednesday, September 30, 2026  4:48 AM"
  const formattedDate = new Date(page.createdAt).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = new Date(page.createdAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  // Render Canvas
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

    // 1. Pristine OneNote White Paper
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 2. Ruled Lines or Grid Pattern
    const spacing = 28.0 * zoom;
    const offsetY = pan.y % spacing;

    if (backgroundPattern === 'lined') {
      // Horizontal blue ruled notebook lines
      ctx.strokeStyle = '#e0e7ff';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      // Start lines below the header area
      const headerWorldY = 120;
      const headerScreenY = worldToScreen(0, headerWorldY).y;

      for (let y = Math.max(headerScreenY, offsetY); y < height; y += spacing) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // OneNote vertical pink margin guide
      const marginWorldX = 72;
      const marginScreenX = worldToScreen(marginWorldX, 0).x;
      if (marginScreenX >= 0 && marginScreenX <= width) {
        ctx.strokeStyle = '#fecdd3';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(marginScreenX, Math.max(0, headerScreenY));
        ctx.lineTo(marginScreenX, height);
        ctx.stroke();
      }
    } else if (backgroundPattern === 'grid') {
      const offsetX = pan.x % spacing;
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1.0;
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
    } else if (backgroundPattern === 'dotgrid') {
      const offsetX = pan.x % spacing;
      ctx.fillStyle = '#cbd5e1';
      const dotRadius = Math.max(0.8, 1.0 * zoom);
      for (let x = offsetX; x < width; x += spacing) {
        for (let y = offsetY; y < height; y += spacing) {
          ctx.beginPath();
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 3. Render Strokes
    for (const stroke of page.strokes) {
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

    // 4. Render Active In-Flight Stroke
    const activePts = activePointsRef.current;
    if (activePts.length >= 2) {
      if (activeTool === 'highlighter') {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.strokeStyle = activeColor;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = baseWidth * 3.5 * zoom;
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        const p0 = worldToScreen(activePts[0].x, activePts[0].y);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < activePts.length; ++i) {
          const pi = worldToScreen(activePts[i].x, activePts[i].y);
          ctx.lineTo(pi.x, pi.y);
        }
        ctx.stroke();
        ctx.restore();
      } else if (activeTool === 'pen') {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = activeColor;

        for (let i = 0; i < activePts.length - 1; ++i) {
          const p1 = worldToScreen(activePts[i].x, activePts[i].y);
          const p2 = worldToScreen(activePts[i + 1].x, activePts[i + 1].y);
          const avgPressure = (activePts[i].pressure + activePts[i + 1].pressure) * 0.5;
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
  }, [page.strokes, activeTool, activeColor, baseWidth, backgroundPattern, zoom, pan, worldToScreen]);

  // Window Resize
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

  // Handle pointer down
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

    // Click to add text container in Type mode
    if (activeTool === 'text') {
      const newNote: TextNoteContainer = {
        id: `note_${Date.now()}`,
        x: Math.round(world.x),
        y: Math.round(world.y),
        width: 320,
        text: '',
      };
      onUpdatePage({
        ...page,
        textNotes: [...textNotes, newNote],
        updatedAt: Date.now(),
      });
      return;
    }

    // Eraser mode
    if (activeTool === 'eraser' || (e.pointerType === 'pen' && e.buttons === 32)) {
      isPointerDownRef.current = true;
      erasedStrokesThisGestureRef.current = [];
      const tolerance = 14.0 / zoom;
      const hit = page.strokes.filter((s) =>
        s.points.some((p) => {
          const dx = p.x - world.x;
          const dy = p.y - world.y;
          return dx * dx + dy * dy <= tolerance * tolerance;
        })
      );
      if (hit.length > 0) {
        erasedStrokesThisGestureRef.current.push(...hit);
        const hitIds = new Set(hit.map((s) => s.id));
        onUpdatePage({
          ...page,
          strokes: page.strokes.filter((s) => !hitIds.has(s.id)),
        });
      }
      return;
    }

    // Drawing with Pen or Highlighter
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
      const tolerance = 14.0 / zoom;
      const hit = page.strokes.filter((s) => {
        if (erasedStrokesThisGestureRef.current.some((already) => already.id === s.id)) return false;
        return s.points.some((p) => {
          const dx = p.x - world.x;
          const dy = p.y - world.y;
          return dx * dx + dy * dy <= tolerance * tolerance;
        });
      });
      if (hit.length > 0) {
        erasedStrokesThisGestureRef.current.push(...hit);
        const hitIds = new Set(hit.map((s) => s.id));
        onUpdatePage({
          ...page,
          strokes: page.strokes.filter((s) => !hitIds.has(s.id)),
        });
      }
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
        const cmd = new BatchEraseCommand(
          removed,
          (ids) => {
            const idSet = new Set(ids);
            onUpdatePage({
              ...page,
              strokes: page.strokes.filter((s) => !idSet.has(s.id)),
            });
          },
          (restored) => {
            onUpdatePage({
              ...page,
              strokes: [...page.strokes, ...restored],
            });
          }
        );
        historyManager.executeCommand(cmd);
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
          onUpdatePage({
            ...page,
            strokes: [...page.strokes, s],
            updatedAt: Date.now(),
          });
        },
        (id) => {
          onUpdatePage({
            ...page,
            strokes: page.strokes.filter((s) => s.id !== id),
            updatedAt: Date.now(),
          });
        }
      );

      historyManager.executeCommand(addCmd);
    }

    activePointsRef.current = [];
    redraw();
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    const newZoom = Math.min(3.5, Math.max(0.3, zoom * factor));
    const ratio = newZoom / zoom;

    setZoom(newZoom);
    setPan((prev) => ({
      x: mouseX - (mouseX - prev.x) * ratio,
      y: mouseY - (mouseY - prev.y) * ratio,
    }));
  };

  // Update text container text
  const handleUpdateTextNote = (id: string, text: string) => {
    onUpdatePage({
      ...page,
      textNotes: textNotes.map((n) => (n.id === id ? { ...n, text } : n)),
    });
  };

  // Delete text container
  const handleDeleteTextNote = (id: string) => {
    onUpdatePage({
      ...page,
      textNotes: textNotes.filter((n) => n.id !== id),
    });
  };

  // Header position calculation relative to viewport pan/zoom
  const headerScreenPos = worldToScreen(72, 32);

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden bg-white select-none cursor-crosshair"
    >
      {/* HTML Drawing Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className="w-full h-full block"
      />

      {/* OneNote Signature Editable Page Title & Date Header */}
      <div
        style={{
          position: 'absolute',
          left: `${headerScreenPos.x}px`,
          top: `${headerScreenPos.y}px`,
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
        }}
        className="pointer-events-auto w-[650px] space-y-1 z-10"
      >
        <input
          type="text"
          value={page.title}
          placeholder="Page Title"
          onChange={(e) => onUpdatePage({ ...page, title: e.target.value })}
          className="w-full text-2xl font-semibold text-neutral-900 bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-purple-600 focus:outline-none transition-colors px-1 py-0.5"
        />

        <div className="flex items-center gap-2 text-[11px] font-sans text-neutral-500 px-1">
          <span>{formattedDate}</span>
          <span aria-hidden="true">·</span>
          <span>{formattedTime}</span>
        </div>

        {/* Traditional separator line beneath title header */}
        <div className="w-full h-px bg-neutral-300 dark:bg-neutral-700 mt-2" />
      </div>

      {/* OneNote Draggable Text Containers */}
      {textNotes.map((note) => {
        const screenPos = worldToScreen(note.x, note.y);
        return (
          <div
            key={note.id}
            style={{
              position: 'absolute',
              left: `${screenPos.x}px`,
              top: `${screenPos.y}px`,
              width: `${note.width * zoom}px`,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
            className="group pointer-events-auto bg-white/90 backdrop-blur-xs border border-transparent hover:border-purple-300 focus-within:border-purple-500 rounded p-1 shadow-xs hover:shadow-sm transition-all z-10"
          >
            {/* Draggable Note Container Header Handle */}
            <div className="h-4 bg-neutral-100 group-hover:bg-purple-100/70 rounded-t flex items-center justify-between px-1 cursor-move select-none text-neutral-500">
              <Move className="w-2.5 h-2.5" />
              <button
                onClick={() => handleDeleteTextNote(note.id)}
                className="hover:text-rose-500 p-0.5 rounded"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>

            <textarea
              value={note.text}
              placeholder="Type notes here..."
              onChange={(e) => handleUpdateTextNote(note.id, e.target.value)}
              className="w-full bg-transparent text-xs text-neutral-800 focus:outline-none resize-none p-1.5 min-h-[60px]"
            />
          </div>
        );
      })}

      {/* OneNote Discreet Zoom Slider & Page Reset (Bottom Right) */}
      <div className="absolute bottom-3 right-4 z-20 flex items-center gap-1.5 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-md border border-neutral-200 shadow-xs text-xs font-mono text-neutral-600">
        <button
          onClick={() => setZoom((z) => Math.max(0.3, z * 0.9))}
          className="p-1 hover:text-neutral-900 rounded"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            setZoom(1.0);
            setPan({ x: 0, y: 0 });
          }}
          className="hover:text-purple-700 transition-colors tabular-nums font-medium"
          title="Reset Zoom to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => setZoom((z) => Math.min(3.5, z * 1.1))}
          className="p-1 hover:text-neutral-900 rounded"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
