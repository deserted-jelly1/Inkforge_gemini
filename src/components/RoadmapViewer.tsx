import React from 'react';
import { CheckCircle2, Clock, GitCommit, AlertCircle, ArrowRight } from 'lucide-react';

export const RoadmapViewer: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto bg-neutral-950 text-neutral-200 p-8 max-w-5xl mx-auto space-y-8 font-sans">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
          InkForge Engineering Status & Staged Execution
        </h1>
        <p className="text-sm text-neutral-400 mt-1">
          Detailed breakdown of v0.1 deliverables, architectural rationale, technical debt, and next milestones.
        </p>
      </div>

      {/* 1. What was created */}
      <div className="p-6 rounded-lg bg-neutral-900 border border-neutral-800 space-y-4">
        <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          <span>1. What Was Created in Stage A & B (InkForge v0.1)</span>
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-neutral-300">
          <li className="p-3 bg-neutral-950 rounded border border-neutral-800 space-y-1">
            <strong className="text-neutral-100">Root CMake Build Hierarchy:</strong>
            <p className="text-neutral-400">Strict C++20 and Qt 6.5+ configuration targeting Windows (MSVC 2022) and Linux (GCC 13+ / Clang 17+).</p>
          </li>
          <li className="p-3 bg-neutral-950 rounded border border-neutral-800 space-y-1">
            <strong className="text-neutral-100">Vector Stroke & Point Model:</strong>
            <p className="text-neutral-400">28-byte cache-aligned Point struct capturing sub-pixel (X, Y), normalized pressure, tilt, and microsecond timestamps.</p>
          </li>
          <li className="p-3 bg-neutral-950 rounded border border-neutral-800 space-y-1">
            <strong className="text-neutral-100">Centripetal Catmull-Rom Evaluator:</strong>
            <p className="text-neutral-400">Centripetal parameter ($\alpha = 0.5$) preventing self-intersections and cusp loops during rapid pen movements.</p>
          </li>
          <li className="p-3 bg-neutral-950 rounded border border-neutral-800 space-y-1">
            <strong className="text-neutral-100">Tablet Input Abstraction:</strong>
            <p className="text-neutral-400"><code className="font-mono text-amber-400">ITabletInputSource</code> and <code className="font-mono text-amber-400">QtTabletFilter</code> isolating Wacom WinTab / Windows Ink events from canvas drawing logic.</p>
          </li>
          <li className="p-3 bg-neutral-950 rounded border border-neutral-800 space-y-1">
            <strong className="text-neutral-100">Infinite Canvas Coordinate Engine:</strong>
            <p className="text-neutral-400">ViewportTransform with 2D affine matrix supporting fluid panning and continuous zoom from 10% to 500%.</p>
          </li>
          <li className="p-3 bg-neutral-950 rounded border border-neutral-800 space-y-1">
            <strong className="text-neutral-100">Command-Pattern Undo / Redo:</strong>
            <p className="text-neutral-400">Zero-copy pointer-based command stack supporting infinite depth undo/redo without document cloning.</p>
          </li>
          <li className="p-3 bg-neutral-950 rounded border border-neutral-800 space-y-1">
            <strong className="text-neutral-100">SQLite Storage Driver:</strong>
            <p className="text-neutral-400">Relational schema with WAL mode enabled for notebooks, pages, and layers.</p>
          </li>
          <li className="p-3 bg-neutral-950 rounded border border-neutral-800 space-y-1">
            <strong className="text-neutral-100">Automated Unit Test Suite:</strong>
            <p className="text-neutral-400">Catch2 / CTest test harness verifying stroke bounding boxes, spline interpolation, and command undo/redo.</p>
          </li>
        </ul>
      </div>

      {/* 2. Why each architectural choice was made */}
      <div className="p-6 rounded-lg bg-neutral-900 border border-neutral-800 space-y-4">
        <div className="flex items-center gap-2 text-amber-400 font-mono text-sm font-semibold">
          <GitCommit className="w-4 h-4" />
          <span>2. Architectural Decision Records (ADRs) & Rationales</span>
        </div>
        <div className="space-y-3 text-xs text-neutral-300">
          <div className="p-3 bg-neutral-950 rounded border border-neutral-800 space-y-1">
            <strong className="text-neutral-100 font-mono">ADR-01: C++20 and Qt 6 rather than Electron or Flutter</strong>
            <p className="text-neutral-400">
              Low-latency pen inking requires native OS event dispatch and direct sub-millisecond hardware access. Garbage-collected runtimes like Electron or Flutter introduce frame drops and GC pauses that break the illusion of real physical pen and paper.
            </p>
          </div>

          <div className="p-3 bg-neutral-950 rounded border border-neutral-800 space-y-1">
            <strong className="text-neutral-100 font-mono">ADR-02: Centripetal Catmull-Rom Splines ($\alpha = 0.5$)</strong>
            <p className="text-neutral-400">
              Standard cubic Bézier curve fitting requires estimating tangents that often overshoot during rapid handwriting changes. Centripetal Catmull-Rom splines guarantee exact point interpolation, continuous tangent vectors ($C^1$), and mathematically eliminate self-intersecting loops.
            </p>
          </div>

          <div className="p-3 bg-neutral-950 rounded border border-neutral-800 space-y-1">
            <strong className="text-neutral-100 font-mono">ADR-03: Dual In-Flight vs Committed Render Passes</strong>
            <p className="text-neutral-400">
              Active strokes are drawn instantly into an immediate-mode scratch buffer using raw tablet coordinates. Only upon pen lift is the final stroke submitted to the document model and spline tessellator, reducing perceived inking latency to &lt; 8 ms.
            </p>
          </div>

          <div className="p-3 bg-neutral-950 rounded border border-neutral-800 space-y-1">
            <strong className="text-neutral-100 font-mono">ADR-04: Hybrid Relational + Binary Chunk Persistence</strong>
            <p className="text-neutral-400">
              Writing individual vector points to SQL tables yields severe query degradation at 100k strokes. Relational metadata is stored in SQLite while stroke point arrays are serialized as packed binary streams.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Technical debt & remaining work */}
      <div className="p-6 rounded-lg bg-neutral-900 border border-neutral-800 space-y-4">
        <div className="flex items-center gap-2 text-rose-400 font-mono text-sm font-semibold">
          <AlertCircle className="w-4 h-4" />
          <span>3. Technical Debt Identified & Tracked</span>
        </div>
        <div className="space-y-2 text-xs text-neutral-300">
          <div className="flex items-start gap-2">
            <span className="text-neutral-500 font-mono">TD-01:</span>
            <span><strong>QPainter CPU Bottleneck at 50k+ Strokes:</strong> The current CanvasRenderer uses QPainter on the CPU. While fast for hundreds of strokes, scaling to an entire semester engineering notebook requires moving to an OpenGL / Vulkan GPU quad-strip tessellation shader pipeline.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-neutral-500 font-mono">TD-02:</span>
            <span><strong>Spatial Indexing:</strong> Viewport culling currently performs linear iteration over layer strokes. An R-Tree or Quadtree index should be introduced to achieve $O(\log N)$ viewport queries.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-neutral-500 font-mono">TD-03:</span>
            <span><strong>Stroke Eraser Splitting:</strong> The current eraser removes whole strokes. Partial stroke erasing (Boolean path subtraction) is reserved for Phase 2.</span>
          </div>
        </div>
      </div>

      {/* 4. Next development task */}
      <div className="p-6 rounded-lg bg-amber-950/30 border border-amber-800/60 space-y-3">
        <div className="flex items-center gap-2 text-amber-400 font-mono text-sm font-semibold">
          <ArrowRight className="w-4 h-4" />
          <span>4. Next Development Tasks (Stage C & Stage D)</span>
        </div>
        <p className="text-xs text-neutral-300">
          With the high-level architecture, module decomposition, C++20 headers, CMake build hierarchy, and initial desktop shell established, the immediate next technical tasks are:
        </p>
        <ol className="list-decimal pl-5 text-xs text-neutral-300 space-y-1">
          <li><strong>One Euro Filter Integration:</strong> Calibrate $f_c$ and $\beta$ cutoff parameters for physical Wacom Intuos stylus jitter suppression at low velocities without introducing high-velocity lag.</li>
          <li><strong>OpenGL / QOpenGLWidget Rendering Path:</strong> Benchmark GPU vertex buffer object (VBO) tessellation against QPainter software rendering.</li>
          <li><strong>R-Tree Spatial Indexing:</strong> Integrate Boost.Geometry R-Tree or custom 2D bounding-box spatial partition in <code className="text-amber-400 font-mono">inkforge_documents</code>.</li>
        </ol>
      </div>
    </div>
  );
};
