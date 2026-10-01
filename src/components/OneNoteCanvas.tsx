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
  PageHistoryManager,
  AddStrokeCommand,
  BatchEraseCommand,
  AddTextNoteCommand,
  DeleteTextNoteCommand,
  UpdateTextNoteCommand,
} from '../utils/historyManager';
import { strokeIntersectsEraser, isStrokeInViewport } from '../utils/geometry';
import { X, Move, GripVertical, ZoomIn, ZoomOut, Minimize2 } from 'lucide-react';

interface CanvasProps {
  page: PageData;
  onUpdatePage: (transform: (prevPage: PageData) => PageData) => void;
  activeTool: ToolType;
  activeColor: string;
  baseWidth: number;
  highlighterWidth: number;
  eraserRadius: number;
  backgroundPattern: BackgroundPattern;
  historyManager: PageHistoryManager;
  newNoteFocusId: string | null;
  onClearNewNoteFocus: () => void;
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
}

export const OneNoteCanvas: React.FC<CanvasProps> = ({
  page,
  onUpdatePage,
  activeTool,
  activeColor,
  baseWidth,
  highlighterWidth,
  eraserRadius,
  backgroundPattern,
  historyManager,
  newNoteFocusId,
  onClearNewNoteFocus,
  isFocusMode = false,
  onToggleFocusMode,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Viewport state: initialize from page.viewport if available
  const [zoom, setZoom] = useState<number>(() => page.viewport?.zoom || 1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>(() => ({
    x: page.viewport?.panX || 0,
    y: page.viewport?.panY || 0,
  }));

  // Track page ID to reset viewport when page changes
  const lastPageIdRef = useRef<string>(page.id);
  useEffect(() => {
    if (page.id !== lastPageIdRef.current) {
      lastPageIdRef.current = page.id;
      if (page.viewport) {
        setZoom(page.viewport.zoom);
        setPan({ x: page.viewport.panX, y: page.viewport.panY });
      } else {
        setZoom(1.0);
        setPan({ x: 0, y: 0 });
      }
    }
  }, [page.id, page.viewport]);

  // Persist viewport to page data (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      onUpdatePage((prev) => {
        if (
          prev.viewport &&
          prev.viewport.zoom === zoom &&
          prev.viewport.panX === pan.x &&
          prev.viewport.panY === pan.y
        ) {
          return prev;
        }
        return {
          ...prev,
          viewport: { zoom, panX: pan.x, panY: pan.y },
        };
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [zoom, pan, onUpdatePage]);

  // Active in-flight stroke points & gesture state
  const activePointerIdRef = useRef<number | null>(null);
  const activeGestureToolRef = useRef<ToolType>('pen');
  const activePointsRef = useRef<VectorPoint[]>([]);
  const isPointerDownRef = useRef<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  const lastPanPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Map of stroke positions relative to document at start of erase gesture
  const initialStrokeIndexMapRef = useRef<Map<string, number>>(new Map());
  const erasedStrokesThisGestureRef = useRef<{ stroke: StrokeData; originalIndex: number }[]>([]);

  // Text note drag / resize state
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const dragStartPosRef = useRef<{ clientX: number; clientY: number; noteX: number; noteY: number }>({
    clientX: 0,
    clientY: 0,
    noteX: 0,
    noteY: 0,
  });

  const [resizingNoteId, setResizingNoteId] = useState<string | null>(null);
  const resizeStartPosRef = useRef<{ clientX: number; noteWidth: number }>({
    clientX: 0,
    noteWidth: 320,
  });

  const textBeforeEditRef = useRef<Map<string, string>>(new Map());
  const rAFRef = useRef<number | null>(null);

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

  // Focus newly created note
  useEffect(() => {
    if (newNoteFocusId) {
      const textarea = document.getElementById(`textarea_${newNoteFocusId}`) as HTMLTextAreaElement | null;
      if (textarea) {
        textarea.focus();
        onClearNewNoteFocus();
      }
    }
  }, [newNoteFocusId, onClearNewNoteFocus]);

  // Global Keyboard shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isUndo = (isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey;
      const isRedo =
        ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
        ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'y');

      if (isUndo) {
        e.preventDefault();
        historyManager.undo(onUpdatePage);
      } else if (isRedo) {
        e.preventDefault();
        historyManager.redo(onUpdatePage);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyManager, onUpdatePage]);

  // 1. Redraw Base Canvas (Paper background, rules, and committed strokes with culling)
  const redrawBase = useCallback(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High-DPI clear: clear full backing bitmap with identity transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    // Pristine warm paper background
    ctx.fillStyle = '#fdfcf7';
    ctx.fillRect(0, 0, width, height);

    // Ruled lines / Grid based on world coordinates
    const spacing = (page.gridSpacing || 28) * zoom;
    const headerWorldY = 110;
    const headerScreenY = worldToScreen(0, headerWorldY).y;
    const offsetY = pan.y % spacing;

    if (backgroundPattern === 'lined') {
      ctx.strokeStyle = '#e7e5e4';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      for (let y = Math.max(headerScreenY, offsetY); y < height; y += spacing) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Vertical subtle margin guide line
      const marginWorldX = 72;
      const marginScreenX = worldToScreen(marginWorldX, 0).x;
      if (marginScreenX >= 0 && marginScreenX <= width) {
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(marginScreenX, Math.max(0, headerScreenY));
        ctx.lineTo(marginScreenX, height);
        ctx.stroke();
      }
    } else if (backgroundPattern === 'grid') {
      const offsetX = pan.x % spacing;
      ctx.strokeStyle = '#f0eee9';
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

    // Viewport bounds in world space for stroke culling
    const viewportMinWorld = screenToWorld(0, 0);
    const viewportMaxWorld = screenToWorld(width, height);
    const minWX = Math.min(viewportMinWorld.x, viewportMaxWorld.x);
    const minWY = Math.min(viewportMinWorld.y, viewportMaxWorld.y);
    const maxWX = Math.max(viewportMinWorld.x, viewportMaxWorld.x);
    const maxWY = Math.max(viewportMinWorld.y, viewportMaxWorld.y);

    // Render committed strokes
    for (const stroke of page.strokes) {
      if (stroke.bounds && !isStrokeInViewport(stroke.bounds, minWX, minWY, maxWX, maxWY)) {
        continue;
      }

      const pts = stroke.smoothedPoints || stroke.points;
      if (pts.length < 2) {
        if (pts.length === 1) {
          const p = worldToScreen(pts[0].x, pts[0].y);
          ctx.fillStyle = stroke.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, (stroke.baseWidth * zoom) * 0.75, 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }

      if (stroke.tool === 'highlighter') {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.strokeStyle = stroke.color;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = stroke.baseWidth * zoom;
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
  }, [page.strokes, page.gridSpacing, backgroundPattern, zoom, pan, screenToWorld, worldToScreen]);

  // 2. Redraw Active Canvas (High-DPI safe clearing)
  const redrawActive = useCallback(() => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset transform to identity and clear the entire physical backing bitmap
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const activePoints = activePointsRef.current;
    if (activePoints.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const tool = activeGestureToolRef.current;
    const strokeWidth = tool === 'highlighter' ? highlighterWidth : baseWidth;

    if (activePoints.length === 1) {
      const p = worldToScreen(activePoints[0].x, activePoints[0].y);
      ctx.fillStyle = activeColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (strokeWidth * zoom) * 0.75, 0, Math.PI * 2);
      ctx.fill();
    } else {
      if (tool === 'highlighter') {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.strokeStyle = activeColor;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = strokeWidth * zoom;
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
      } else if (tool === 'pen') {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = activeColor;

        for (let i = 0; i < activePoints.length - 1; ++i) {
          const p1 = worldToScreen(activePoints[i].x, activePoints[i].y);
          const p2 = worldToScreen(activePoints[i + 1].x, activePoints[i + 1].y);
          const avgPressure = (activePoints[i].pressure + activePoints[i + 1].pressure) * 0.5;
          const dynWidth = computeDynamicWidth(strokeWidth * zoom, avgPressure, 'pen');

          ctx.lineWidth = dynWidth;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }
  }, [activeColor, baseWidth, highlighterWidth, zoom, worldToScreen]);

  // Setup ResizeObserver for container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;

        if (baseCanvasRef.current) {
          baseCanvasRef.current.width = Math.ceil(width * dpr);
          baseCanvasRef.current.height = Math.ceil(height * dpr);
        }
        if (activeCanvasRef.current) {
          activeCanvasRef.current.width = Math.ceil(width * dpr);
          activeCanvasRef.current.height = Math.ceil(height * dpr);
        }
        redrawBase();
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [redrawBase]);

  // Trigger base redraw when strokes or viewport change
  useEffect(() => {
    redrawBase();
  }, [redrawBase]);

  // Segment Eraser execution (preserving stroke positions relative to document at gesture start)
  const executeEraserAt = (worldX: number, worldY: number) => {
    const strokes = page.strokes;
    const hitItems: { stroke: StrokeData; originalIndex: number }[] = [];

    for (let i = 0; i < strokes.length; i++) {
      const s = strokes[i];
      if (erasedStrokesThisGestureRef.current.some((already) => already.stroke.id === s.id)) {
        continue;
      }
      if (strokeIntersectsEraser(s, worldX, worldY, eraserRadius / zoom)) {
        // Record stroke index relative to document at gesture start
        const originalIndex = initialStrokeIndexMapRef.current.get(s.id) ?? i;
        hitItems.push({ stroke: s, originalIndex });
      }
    }

    if (hitItems.length > 0) {
      erasedStrokesThisGestureRef.current.push(...hitItems);
      const hitIds = new Set(hitItems.map((h) => h.stroke.id));
      onUpdatePage((prev) => ({
        ...prev,
        strokes: prev.strokes.filter((s) => !hitIds.has(s.id)),
      }));
    }
  };

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== null) return;
    activePointerIdRef.current = e.pointerId;

    const canvas = activeCanvasRef.current;
    if (canvas) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // ignore capture errors
      }
    }

    const rect = canvas?.getBoundingClientRect() || { left: 0, top: 0 };
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    let currentTool = activeTool;
    const isHardwareEraser =
      e.buttons === 32 ||
      e.button === 5 ||
      e.button === 2 ||
      (e.pointerType === 'pen' && (e.buttons & 32) === 32);

    if (isHardwareEraser) {
      currentTool = 'eraser';
    }
    activeGestureToolRef.current = currentTool;

    if (currentTool === 'pan' || e.button === 1 || e.buttons === 4) {
      isPanningRef.current = true;
      lastPanPosRef.current = { x: screenX, y: screenY };
      return;
    }

    const world = screenToWorld(screenX, screenY);
    const pressure = e.pressure > 0 ? e.pressure : 0.5;

    if (currentTool === 'text') {
      const newNote: TextNoteContainer = {
        id: `note_${Date.now()}`,
        x: Math.round(world.x),
        y: Math.round(world.y),
        width: 320,
        text: '',
      };
      const cmd = new AddTextNoteCommand(page.id, newNote);
      historyManager.executeCommand(cmd, onUpdatePage);
      activePointerIdRef.current = null;
      return;
    }

    if (currentTool === 'eraser') {
      isPointerDownRef.current = true;
      erasedStrokesThisGestureRef.current = [];

      // Record snapshot of all stroke positions relative to document at gesture start
      const map = new Map<string, number>();
      page.strokes.forEach((s, idx) => map.set(s.id, idx));
      initialStrokeIndexMapRef.current = map;

      executeEraserAt(world.x, world.y);
      return;
    }

    // Drawing
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

    redrawActive();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;

    const canvas = activeCanvasRef.current;
    const rect = canvas?.getBoundingClientRect() || { left: 0, top: 0 };
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

    const nativeEvent = e.nativeEvent as PointerEvent;
    const coalescedEvents =
      typeof nativeEvent?.getCoalescedEvents === 'function'
        ? nativeEvent.getCoalescedEvents()
        : [e];

    const currentTool = activeGestureToolRef.current;
    if (currentTool === 'eraser') {
      for (const cev of coalescedEvents) {
        const cx = cev.clientX - rect.left;
        const cy = cev.clientY - rect.top;
        const cw = screenToWorld(cx, cy);
        executeEraserAt(cw.x, cw.y);
      }
      return;
    }

    for (const cev of coalescedEvents) {
      const cx = cev.clientX - rect.left;
      const cy = cev.clientY - rect.top;
      const cw = screenToWorld(cx, cy);
      const cp = cev.pressure > 0 ? cev.pressure : 0.5;

      activePointsRef.current.push({
        x: cw.x,
        y: cw.y,
        pressure: cp,
        tiltX: cev.tiltX || 0,
        tiltY: cev.tiltY || 0,
        timestamp: Date.now(),
      });
    }

    if (rAFRef.current === null) {
      rAFRef.current = requestAnimationFrame(() => {
        redrawActive();
        rAFRef.current = null;
      });
    }
  };

  const finalizeStrokeOrEraser = () => {
    if (rAFRef.current !== null) {
      cancelAnimationFrame(rAFRef.current);
      rAFRef.current = null;
    }

    const currentTool = activeGestureToolRef.current;

    // Finalize Eraser gesture
    if (currentTool === 'eraser') {
      if (erasedStrokesThisGestureRef.current.length > 0) {
        const removed = [...erasedStrokesThisGestureRef.current];
        erasedStrokesThisGestureRef.current = [];
        const cmd = new BatchEraseCommand(page.id, removed);
        historyManager.executeCommand(cmd, onUpdatePage);
      }
      initialStrokeIndexMapRef.current.clear();
      isPointerDownRef.current = false;
      activePointerIdRef.current = null;
      return;
    }

    // Finalize Pen or Highlighter
    const points = activePointsRef.current;
    if (points.length > 0) {
      const toolWidth = currentTool === 'highlighter' ? highlighterWidth : baseWidth;

      if (points.length === 1) {
        const pt = points[0];
        const r = toolWidth * 0.75;
        const dotStroke: StrokeData = {
          id: `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          tool: currentTool,
          color: activeColor,
          baseWidth: toolWidth,
          opacity: currentTool === 'highlighter' ? 0.35 : 1.0,
          points: [pt],
          smoothedPoints: [pt],
          bounds: { minX: pt.x - r, minY: pt.y - r, maxX: pt.x + r, maxY: pt.y + r },
        };
        const cmd = new AddStrokeCommand(page.id, dotStroke);
        historyManager.executeCommand(cmd, onUpdatePage);
      } else {
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

        const margin = toolWidth * 1.5;
        const newStroke: StrokeData = {
          id: `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          tool: currentTool,
          color: activeColor,
          baseWidth: toolWidth,
          opacity: currentTool === 'highlighter' ? 0.35 : 1.0,
          points: [...points],
          smoothedPoints: smoothed,
          bounds: { minX: minX - margin, minY: minY - margin, maxX: maxX + margin, maxY: maxY + margin },
        };
        const cmd = new AddStrokeCommand(page.id, newStroke);
        historyManager.executeCommand(cmd, onUpdatePage);
      }
    }

    activePointsRef.current = [];
    isPointerDownRef.current = false;
    activePointerIdRef.current = null;

    // High-DPI clear active canvas
    const canvas = activeCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;

    const canvas = activeCanvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    if (isPanningRef.current) {
      isPanningRef.current = false;
      activePointerIdRef.current = null;
      return;
    }

    if (isPointerDownRef.current) {
      finalizeStrokeOrEraser();
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    if (isPointerDownRef.current) {
      finalizeStrokeOrEraser();
    }
    isPanningRef.current = false;
    activePointerIdRef.current = null;
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
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

  // Text Note Dragging
  const startNoteDrag = (noteId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    const note = page.textNotes?.find((n) => n.id === noteId);
    if (!note) return;

    setDraggingNoteId(noteId);
    dragStartPosRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      noteX: note.x,
      noteY: note.y,
    };
  };

  // Text Note Resizing
  const startNoteResize = (noteId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    const note = page.textNotes?.find((n) => n.id === noteId);
    if (!note) return;

    setResizingNoteId(noteId);
    resizeStartPosRef.current = {
      clientX: e.clientX,
      noteWidth: note.width,
    };
  };

  useEffect(() => {
    if (!draggingNoteId && !resizingNoteId) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (draggingNoteId) {
        const dx = (e.clientX - dragStartPosRef.current.clientX) / zoom;
        const dy = (e.clientY - dragStartPosRef.current.clientY) / zoom;
        const targetX = Math.round(dragStartPosRef.current.noteX + dx);
        const targetY = Math.round(dragStartPosRef.current.noteY + dy);

        onUpdatePage((prev) => ({
          ...prev,
          textNotes: (prev.textNotes || []).map((n) =>
            n.id === draggingNoteId ? { ...n, x: targetX, y: targetY } : n
          ),
        }));
      } else if (resizingNoteId) {
        const dx = (e.clientX - resizeStartPosRef.current.clientX) / zoom;
        const newWidth = Math.max(160, Math.round(resizeStartPosRef.current.noteWidth + dx));

        onUpdatePage((prev) => ({
          ...prev,
          textNotes: (prev.textNotes || []).map((n) =>
            n.id === resizingNoteId ? { ...n, width: newWidth } : n
          ),
        }));
      }
    };

    const handlePointerUp = () => {
      if (draggingNoteId) {
        const note = page.textNotes?.find((n) => n.id === draggingNoteId);
        if (note && (note.x !== dragStartPosRef.current.noteX || note.y !== dragStartPosRef.current.noteY)) {
          const cmd = new UpdateTextNoteCommand(
            page.id,
            draggingNoteId,
            { x: dragStartPosRef.current.noteX, y: dragStartPosRef.current.noteY },
            { x: note.x, y: note.y },
            'move_text',
            'Move Text Box'
          );
          historyManager.executeCommand(cmd, () => {});
        }
        setDraggingNoteId(null);
      }

      if (resizingNoteId) {
        const note = page.textNotes?.find((n) => n.id === resizingNoteId);
        if (note && note.width !== resizeStartPosRef.current.noteWidth) {
          const cmd = new UpdateTextNoteCommand(
            page.id,
            resizingNoteId,
            { width: resizeStartPosRef.current.noteWidth },
            { width: note.width },
            'resize_text',
            'Resize Text Box'
          );
          historyManager.executeCommand(cmd, () => {});
        }
        setResizingNoteId(null);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingNoteId, resizingNoteId, zoom, page.textNotes, page.id, historyManager, onUpdatePage]);

  const handleNoteFocus = (noteId: string, currentText: string) => {
    if (!textBeforeEditRef.current.has(noteId)) {
      textBeforeEditRef.current.set(noteId, currentText);
    }
  };

  const handleNoteBlur = (noteId: string, newText: string) => {
    const priorText = textBeforeEditRef.current.get(noteId);
    textBeforeEditRef.current.delete(noteId);

    if (priorText !== undefined && priorText !== newText) {
      const cmd = new UpdateTextNoteCommand(
        page.id,
        noteId,
        { text: priorText },
        { text: newText },
        'edit_text',
        'Edit Text'
      );
      historyManager.executeCommand(cmd, () => {});
    }
  };

  const handleDeleteNote = (noteId: string) => {
    const note = page.textNotes?.find((n) => n.id === noteId);
    if (!note) return;
    const cmd = new DeleteTextNoteCommand(page.id, note);
    historyManager.executeCommand(cmd, onUpdatePage);
  };

  const headerScreenPos = worldToScreen(72, 32);

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

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      className="flex-1 relative overflow-hidden bg-[#fdfcf7] select-none touch-none cursor-crosshair"
    >
      {/* Layer 1: Base Canvas */}
      <canvas
        ref={baseCanvasRef}
        className="absolute inset-0 w-full h-full block pointer-events-none"
      />

      {/* Layer 2: Active Canvas (Pointer capture & in-flight stroke) */}
      <canvas
        ref={activeCanvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className="absolute inset-0 w-full h-full block touch-none z-10"
      />

      {/* Floating Exit Focus Mode Button */}
      {isFocusMode && onToggleFocusMode && (
        <button
          onClick={onToggleFocusMode}
          className="absolute top-4 right-4 z-40 bg-white/95 backdrop-blur-md border border-neutral-200/90 rounded-full px-3.5 py-1.5 shadow-sm text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:border-neutral-300 flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
          title="Exit Focus Mode (Esc or F)"
          aria-label="Exit Focus Mode"
        >
          <Minimize2 className="w-3.5 h-3.5 text-neutral-500" />
          <span>Exit Focus (Esc)</span>
        </button>
      )}

      {/* Synchronized Editable Page Title & Date Header */}
      <div
        style={{
          position: 'absolute',
          left: `${headerScreenPos.x}px`,
          top: `${headerScreenPos.y}px`,
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
        }}
        className="pointer-events-auto w-[680px] space-y-0.5 z-20"
      >
        <input
          type="text"
          value={page.title}
          placeholder="Untitled page"
          onChange={(e) => {
            const newTitle = e.target.value;
            onUpdatePage((prev) => ({ ...prev, title: newTitle, updatedAt: Date.now() }));
          }}
          className="w-full text-2xl font-semibold text-neutral-900 bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-indigo-600 focus:outline-none transition-colors px-0.5 py-0.5"
          aria-label="Page Title"
        />

        <div className="flex items-center gap-2 text-[11px] font-sans text-neutral-400 px-0.5">
          <span>{formattedDate}</span>
          <span aria-hidden="true">·</span>
          <span>{formattedTime}</span>
        </div>

        <div className="w-full h-px bg-neutral-200/80 mt-1.5" />
      </div>

      {/* Text Containers (Document coordinate width, single scale transform) */}
      {(page.textNotes || []).map((note) => {
        const screenPos = worldToScreen(note.x, note.y);
        return (
          <div
            key={note.id}
            style={{
              position: 'absolute',
              left: `${screenPos.x}px`,
              top: `${screenPos.y}px`,
              width: `${note.width}px`,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
            className="group pointer-events-auto bg-white/95 backdrop-blur-xs border border-neutral-300 hover:border-indigo-400 focus-within:border-indigo-600 rounded shadow-xs hover:shadow-md transition-shadow z-20"
          >
            <div
              onPointerDown={(e) => startNoteDrag(note.id, e)}
              className="h-5 bg-neutral-100 group-hover:bg-indigo-50/80 rounded-t flex items-center justify-between px-1.5 cursor-move select-none text-neutral-500"
            >
              <div className="flex items-center gap-1">
                <Move className="w-3 h-3 text-neutral-400" />
                <span className="text-[10px] font-sans font-medium text-neutral-400">Note</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteNote(note.id);
                }}
                className="hover:text-rose-600 p-0.5 rounded transition-colors"
                title="Delete note box"
                aria-label="Delete note box"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            <textarea
              id={`textarea_${note.id}`}
              value={note.text}
              placeholder="Type your notes here..."
              onFocus={() => handleNoteFocus(note.id, note.text)}
              onBlur={(e) => handleNoteBlur(note.id, e.target.value)}
              onChange={(e) => {
                const val = e.target.value;
                onUpdatePage((prev) => ({
                  ...prev,
                  textNotes: (prev.textNotes || []).map((n) =>
                    n.id === note.id ? { ...n, text: val } : n
                  ),
                }));
              }}
              className="w-full bg-transparent text-xs text-neutral-900 focus:outline-none resize-none p-2 min-h-[70px] font-sans leading-relaxed"
            />

            <div
              onPointerDown={(e) => startNoteResize(note.id, e)}
              className="absolute right-0 top-5 bottom-0 w-2.5 cursor-ew-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title="Drag to resize note width"
            >
              <GripVertical className="w-2.5 h-2.5 text-neutral-400" />
            </div>
          </div>
        );
      })}

      {/* Zoom Control Bar */}
      <div className="absolute bottom-3 right-4 z-30 flex items-center gap-1.5 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-md border border-neutral-200 shadow-xs text-xs font-mono text-neutral-600">
        <button
          onClick={() => setZoom((z) => Math.max(0.3, z * 0.9))}
          className="p-1 hover:text-neutral-900 rounded transition-colors"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            setZoom(1.0);
            setPan({ x: 0, y: 0 });
          }}
          className="hover:text-indigo-600 transition-colors tabular-nums font-medium px-1"
          title="Reset Zoom to 100%"
          aria-label="Reset Zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => setZoom((z) => Math.min(3.5, z * 1.1))}
          className="p-1 hover:text-neutral-900 rounded transition-colors"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
