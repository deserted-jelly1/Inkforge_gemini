import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CharacterSample, RawSampleStroke } from '../../handwriting/types';
import { VectorPoint } from '../../types/inkforge';
import { evaluateCentripetalCatmullRom, computeDynamicWidth } from '../../utils/spline';
import { Undo2, Trash2, Plus, Check, RotateCcw } from 'lucide-react';

interface CaptureCellProps {
  char: string;
  samples: CharacterSample[];
  onSaveSample: (sample: CharacterSample) => void;
  onDeleteSample: (sampleId: string) => void;
}

export const CaptureCell: React.FC<CaptureCellProps> = ({
  char,
  samples,
  onSaveSample,
  onDeleteSample,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeSampleIndex, setActiveSampleIndex] = useState<number>(0);
  const [strokes, setStrokes] = useState<RawSampleStroke[]>([]);
  const isPointerDownRef = useRef<boolean>(false);
  const activePointsRef = useRef<VectorPoint[]>([]);

  // Fixed guide metrics in cell coordinates (240 x 240)
  const cellWidth = 240;
  const cellHeight = 240;
  const capHeightY = 70;
  const xHeightY = 110;
  const baselineY = 160;
  const descenderY = 200;

  // Load active sample when character or active index changes
  useEffect(() => {
    if (samples && samples.length > 0) {
      const idx = Math.min(activeSampleIndex, samples.length - 1);
      const current = samples[idx];
      if (current) {
        setStrokes(current.strokes || []);
        return;
      }
    }
    setStrokes([]);
  }, [char, samples, activeSampleIndex]);

  // Redraw canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.scale(dpr, dpr);

    // 1. Cell background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cellWidth, cellHeight);

    // 2. Guide lines
    // Cap height (dashed gray)
    ctx.strokeStyle = '#cbd5e1';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, capHeightY);
    ctx.lineTo(cellWidth - 10, capHeightY);
    ctx.stroke();

    // x-Height (dashed light blue)
    ctx.strokeStyle = '#93c5fd';
    ctx.beginPath();
    ctx.moveTo(10, xHeightY);
    ctx.lineTo(cellWidth - 10, xHeightY);
    ctx.stroke();

    // Baseline (solid indigo)
    ctx.strokeStyle = '#6366f1';
    ctx.setLineDash([]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(10, baselineY);
    ctx.lineTo(cellWidth - 10, baselineY);
    ctx.stroke();

    // Descender (dashed rose)
    ctx.strokeStyle = '#fda4af';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, descenderY);
    ctx.lineTo(cellWidth - 10, descenderY);
    ctx.stroke();

    ctx.setLineDash([]);

    // 3. Faint character prompt in center
    ctx.fillStyle = 'rgba(100, 116, 139, 0.08)';
    ctx.font = '600 110px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(char, cellWidth / 2, baselineY);

    // 4. Render committed strokes
    for (const stroke of strokes) {
      if (stroke.points.length < 2) {
        if (stroke.points.length === 1) {
          ctx.fillStyle = stroke.color || '#0f172a';
          ctx.beginPath();
          ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.baseWidth * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }

      const smoothed = evaluateCentripetalCatmullRom(stroke.points, 6);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = stroke.color || '#0f172a';

      for (let i = 0; i < smoothed.length - 1; i++) {
        const p1 = smoothed[i];
        const p2 = smoothed[i + 1];
        const avgPressure = (p1.pressure + p2.pressure) * 0.5;
        const dynWidth = computeDynamicWidth(stroke.baseWidth, avgPressure, 'pen');

        ctx.lineWidth = dynWidth;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }

    // 5. Render active stroke
    const activePts = activePointsRef.current;
    if (activePts.length >= 2) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a';

      for (let i = 0; i < activePts.length - 1; i++) {
        const p1 = activePts[i];
        const p2 = activePts[i + 1];
        const avgPressure = (p1.pressure + p2.pressure) * 0.5;
        const dynWidth = computeDynamicWidth(2.4, avgPressure, 'pen');

        ctx.lineWidth = dynWidth;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  }, [char, strokes, capHeightY, xHeightY, baselineY, descenderY]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cellWidth * dpr;
    canvas.height = cellHeight * dpr;
    redraw();
  }, [redraw]);

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure > 0 ? e.pressure : 0.5;

    isPointerDownRef.current = true;
    activePointsRef.current = [
      {
        x,
        y,
        pressure,
        tiltX: e.tiltX || 0,
        tiltY: e.tiltY || 0,
        timestamp: Date.now(),
      },
    ];

    redraw();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure > 0 ? e.pressure : 0.5;

    activePointsRef.current.push({
      x,
      y,
      pressure,
      tiltX: e.tiltX || 0,
      tiltY: e.tiltY || 0,
      timestamp: Date.now(),
    });

    redraw();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    const points = activePointsRef.current;
    if (points.length > 0) {
      const newStroke: RawSampleStroke = {
        id: `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        points: [...points],
        baseWidth: 2.4,
        color: '#0f172a',
      };
      const updatedStrokes = [...strokes, newStroke];
      setStrokes(updatedStrokes);
      saveSampleFromStrokes(updatedStrokes);
    }

    activePointsRef.current = [];
    redraw();
  };

  const saveSampleFromStrokes = (strokeList: RawSampleStroke[]) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const st of strokeList) {
      for (const pt of st.points) {
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      }
    }

    if (!Number.isFinite(minX)) {
      minX = 80;
      maxX = 120;
      minY = capHeightY;
      maxY = baselineY;
    }

    const existingSample = samples[activeSampleIndex];
    // If the sample being edited was a starter sample, assign a new user sample ID
    const currentSampleId =
      existingSample && !existingSample.id.endsWith('_starter') && !existingSample.isStarter
        ? existingSample.id
        : `sample_user_${char}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;

    const newSample: CharacterSample = {
      id: currentSampleId,
      createdAt: Date.now(),
      strokes: strokeList,
      cellBounds: { minX, minY, maxX, maxY },
      baselineY,
      capHeightY,
      xHeightY,
      isStarter: false,
      provenance: existingSample ? 'user_edited' : 'user_captured',
    };

    onSaveSample(newSample);
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    const updated = strokes.slice(0, -1);
    setStrokes(updated);
    saveSampleFromStrokes(updated);
  };

  const handleClear = () => {
    setStrokes([]);
    saveSampleFromStrokes([]);
  };

  const handleAddNewSample = () => {
    const newIdx = samples.length;
    setActiveSampleIndex(newIdx);
    setStrokes([]);
  };

  const handleDeleteCurrentSample = () => {
    const current = samples[activeSampleIndex];
    if (current) {
      onDeleteSample(current.id);
      setActiveSampleIndex(Math.max(0, activeSampleIndex - 1));
    }
  };

  return (
    <div className="flex flex-col items-center bg-white border border-neutral-200 rounded-xl p-4 shadow-sm space-y-3">
      {/* Header Bar */}
      <div className="w-full flex items-center justify-between pb-2 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold font-mono text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
            {char}
          </span>
          <span className="text-xs text-neutral-500 font-medium">
            Capture Character Sample
          </span>
        </div>

        {/* Sample Selector Tabs */}
        <div className="flex items-center gap-1">
          {samples.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setActiveSampleIndex(idx)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                activeSampleIndex === idx
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              #{idx + 1}
            </button>
          ))}
          <button
            onClick={handleAddNewSample}
            className="p-1 text-neutral-500 hover:text-indigo-600 hover:bg-neutral-100 rounded transition-colors"
            title="Add another sample variation for this character"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Drawing Canvas */}
      <div className="relative border border-neutral-300 rounded-lg overflow-hidden shadow-inner cursor-crosshair touch-none">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ width: `${cellWidth}px`, height: `${cellHeight}px` }}
          className="block bg-white"
        />

        {/* Visual Guide Labels */}
        <div className="absolute left-1.5 top-[60px] text-[9px] font-mono text-neutral-400 select-none pointer-events-none">
          cap-height
        </div>
        <div className="absolute left-1.5 top-[100px] text-[9px] font-mono text-blue-400 select-none pointer-events-none">
          x-height
        </div>
        <div className="absolute left-1.5 top-[148px] text-[9px] font-mono text-indigo-500 font-semibold select-none pointer-events-none">
          baseline
        </div>
        <div className="absolute left-1.5 top-[188px] text-[9px] font-mono text-rose-400 select-none pointer-events-none">
          descender
        </div>
      </div>

      {/* Control Actions */}
      <div className="w-full flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700 disabled:opacity-30 transition-colors"
            title="Undo last stroke"
          >
            <Undo2 className="w-3 h-3" />
            <span>Undo</span>
          </button>

          <button
            onClick={handleClear}
            disabled={strokes.length === 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700 disabled:opacity-30 transition-colors"
            title="Clear canvas"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear</span>
          </button>
        </div>

        {samples.length > 1 && (
          <button
            onClick={handleDeleteCurrentSample}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-rose-50 text-neutral-400 hover:text-rose-600 transition-colors"
            title="Delete this sample variation"
          >
            <Trash2 className="w-3 h-3" />
            <span>Delete Sample</span>
          </button>
        )}
      </div>
    </div>
  );
};
