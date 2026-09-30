import React, { useState } from 'react';
import {
  Layers,
  Cpu,
  Database,
  ArrowRightLeft,
  Activity,
  FolderTree,
  AlertTriangle,
  GitBranch,
  ShieldCheck,
  Zap,
  Terminal,
} from 'lucide-react';

export const ArchitectureViewer: React.FC = () => {
  const [selectedSection, setSelectedSection] = useState<number>(1);

  const sections = [
    { id: 1, title: '01. High-Level Software Architecture', icon: Layers },
    { id: 2, title: '02. Module Responsibilities', icon: Cpu },
    { id: 3, title: '03. Module Dependency Matrix', icon: ArrowRightLeft },
    { id: 4, title: '04. Document Data Model', icon: Database },
    { id: 5, title: '05. Vector Stroke Model', icon: Activity },
    { id: 6, title: '06. Tablet Input Pipeline', icon: Zap },
    { id: 7, title: '07. Rendering Engine', icon: Layers },
    { id: 8, title: '08. Persistence Architecture', icon: Database },
    { id: 9, title: '09. Command Undo/Redo', icon: ArrowRightLeft },
    { id: 10, title: '10. Concurrency & Threading', icon: Activity },
    { id: 11, title: '11. CMake Project Structure', icon: Terminal },
    { id: 12, title: '12. Repository Structure', icon: FolderTree },
    { id: 13, title: '13. External Dependencies', icon: ShieldCheck },
    { id: 14, title: '14. High-Risk Engineering Problems', icon: AlertTriangle },
    { id: 15, title: '15. Staged Implementation Roadmap', icon: GitBranch },
  ];

  return (
    <div className="flex-1 flex overflow-hidden bg-neutral-950 text-neutral-200">
      {/* Sidebar navigation */}
      <aside className="w-80 border-r border-neutral-800 bg-neutral-900/50 flex flex-col shrink-0">
        <div className="p-4 border-b border-neutral-800">
          <h2 className="text-sm font-semibold text-neutral-100 uppercase tracking-wider font-mono">
            System Architecture
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            InkForge v0.1 Architectural Specification
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {sections.map((sec) => {
            const Icon = sec.icon;
            const isSelected = selectedSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setSelectedSection(sec.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-md transition-colors text-left ${
                  isSelected
                    ? 'bg-neutral-800 text-amber-400 font-medium'
                    : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-400' : 'text-neutral-500'}`} />
                <span className="truncate">{sec.title}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto space-y-8 font-sans">
        {selectedSection === 1 && (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
                01. High-Level Software Architecture
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                Layered, unidirectional dataflow designed for extreme input responsiveness and modularity.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-neutral-900 border border-neutral-800 space-y-4">
              <h3 className="text-sm font-semibold text-neutral-200 font-mono">Unidirectional Pipeline Flow</h3>
              <div className="p-4 bg-neutral-950 rounded-md border border-neutral-800 font-mono text-xs text-neutral-300 leading-relaxed overflow-x-auto">
                <div className="text-amber-400 font-bold mb-2">Hardware & OS Layer</div>
                <div>Wacom Tablet Digitizer (133–200 Hz event packets)</div>
                <div className="text-neutral-500 my-1">   ↓ [WinTab / Windows Ink / libinput API]</div>
                <div className="text-amber-400 font-bold mb-2">Input Abstraction Layer (`inkforge_input`)</div>
                <div>ITabletInputSource → QtTabletFilter (Normalized X, Y, Pressure, Tilt, Timestamp)</div>
                <div className="text-neutral-500 my-1">   ↓ [Sub-pixel Dispatch]</div>
                <div className="text-amber-400 font-bold mb-2">Vector Stroke Processing (`inkforge_ink`)</div>
                <div>One Euro Filter → Dynamic Width Generator → Centripetal Catmull-Rom Spline</div>
                <div className="text-neutral-500 my-1">   ↓ [Command Stack `AddStrokeCommand`]</div>
                <div className="text-amber-400 font-bold mb-2">Document Hierarchy (`inkforge_documents`)</div>
                <div>Notebook → Page → Layer → Vector Stroke Scene Graph</div>
                <div className="text-neutral-500 my-1">   ↓ [Viewport Culling & Double Buffering]</div>
                <div className="text-amber-400 font-bold mb-2">Rendering Engine (`inkforge_rendering`)</div>
                <div>CanvasRenderer → QPainter / GPU Shader Pipeline → Display</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 space-y-2">
                <h4 className="text-xs font-semibold text-amber-400 font-mono uppercase tracking-wide">
                  Core Architectural Rule 1
                </h4>
                <p className="text-xs text-neutral-300">
                  <strong>Zero Business Logic in UI:</strong> Qt widgets (such as <code className="text-neutral-200">CanvasWidget</code>) strictly capture user input intents and render scene updates. They never directly access databases, file disks, or AI routines.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 space-y-2">
                <h4 className="text-xs font-semibold text-amber-400 font-mono uppercase tracking-wide">
                  Core Architectural Rule 2
                </h4>
                <p className="text-xs text-neutral-300">
                  <strong>Lossless Vector Retention:</strong> Raw tablet coordinates and high-resolution dynamics are permanently retained. Destructive pixel rasterization or forced font conversion is strictly prohibited.
                </p>
              </div>
            </div>
          </section>
        )}

        {selectedSection === 2 && (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
                02. Module Responsibilities
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                Decomposition of responsibilities into eight specialized static libraries and one application binary.
              </p>
            </div>

            <div className="border border-neutral-800 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-neutral-900 text-neutral-400 font-mono uppercase border-b border-neutral-800">
                  <tr>
                    <th className="p-3">Target Library</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Primary Responsibilities</th>
                    <th className="p-3">Public Dependencies</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  <tr className="hover:bg-neutral-900/40">
                    <td className="p-3 font-mono font-medium text-amber-400">inkforge_core</td>
                    <td className="p-3 text-neutral-400">STATIC</td>
                    <td className="p-3 text-neutral-300">Primitive geometric math (Vec2d, Rect2d), ColorRgba, platform export macros.</td>
                    <td className="p-3 text-neutral-400">std (C++20)</td>
                  </tr>
                  <tr className="hover:bg-neutral-900/40">
                    <td className="p-3 font-mono font-medium text-amber-400">inkforge_ink</td>
                    <td className="p-3 text-neutral-400">STATIC</td>
                    <td className="p-3 text-neutral-300">Point, Stroke, Catmull-Rom spline curves, dynamic width calculations.</td>
                    <td className="p-3 text-neutral-400">inkforge_core</td>
                  </tr>
                  <tr className="hover:bg-neutral-900/40">
                    <td className="p-3 font-mono font-medium text-amber-400">inkforge_input</td>
                    <td className="p-3 text-neutral-400">STATIC</td>
                    <td className="p-3 text-neutral-300">ITabletInputSource abstraction, QtTabletFilter, Wacom digitizer hardware event normalization.</td>
                    <td className="p-3 text-neutral-400">inkforge_core, Qt6::Gui</td>
                  </tr>
                  <tr className="hover:bg-neutral-900/40">
                    <td className="p-3 font-mono font-medium text-amber-400">inkforge_documents</td>
                    <td className="p-3 text-neutral-400">STATIC</td>
                    <td className="p-3 text-neutral-300">Notebook, Page, Layer scene graph, DocumentModel dirty tracking and change signals.</td>
                    <td className="p-3 text-neutral-400">inkforge_ink</td>
                  </tr>
                  <tr className="hover:bg-neutral-900/40">
                    <td className="p-3 font-mono font-medium text-amber-400">inkforge_rendering</td>
                    <td className="p-3 text-neutral-400">STATIC</td>
                    <td className="p-3 text-neutral-300">IRenderer interface, CanvasRenderer (QPainter), ViewportTransform (world-to-screen matrix).</td>
                    <td className="p-3 text-neutral-400">inkforge_documents, Qt6::Gui</td>
                  </tr>
                  <tr className="hover:bg-neutral-900/40">
                    <td className="p-3 font-mono font-medium text-amber-400">inkforge_commands</td>
                    <td className="p-3 text-neutral-400">STATIC</td>
                    <td className="p-3 text-neutral-300">ICommand interface, CommandStack (undo/redo), AddStrokeCommand, RemoveStrokeCommand.</td>
                    <td className="p-3 text-neutral-400">inkforge_documents</td>
                  </tr>
                  <tr className="hover:bg-neutral-900/40">
                    <td className="p-3 font-mono font-medium text-amber-400">inkforge_storage</td>
                    <td className="p-3 text-neutral-400">STATIC</td>
                    <td className="p-3 text-neutral-300">IDatabase, SQLiteStorage with WAL journaling, relational schemas, binary stroke chunk storage.</td>
                    <td className="p-3 text-neutral-400">inkforge_documents, Qt6::Sql</td>
                  </tr>
                  <tr className="hover:bg-neutral-900/40">
                    <td className="p-3 font-mono font-medium text-amber-400">inkforge_canvas</td>
                    <td className="p-3 text-neutral-400">STATIC</td>
                    <td className="p-3 text-neutral-300">QWidget infinite canvas, viewport interaction, tablet event routing, in-flight scratchpad.</td>
                    <td className="p-3 text-neutral-400">inkforge_rendering, inkforge_input, inkforge_commands</td>
                  </tr>
                  <tr className="hover:bg-neutral-900/40">
                    <td className="p-3 font-mono font-medium text-amber-400">inkforge_app</td>
                    <td className="p-3 text-neutral-400">EXECUTABLE</td>
                    <td className="p-3 text-neutral-300">Main application entry point, MainWindow, menus, toolbars, high-DPI initialization.</td>
                    <td className="p-3 text-neutral-400">All modules, Qt6::Widgets</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {selectedSection === 3 && (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
                03. Module Dependency Matrix & Invariants
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                Strict acyclic graph guarantees that domain models can be tested without Qt GUI dependencies.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-neutral-900 border border-neutral-800 space-y-4">
              <h3 className="text-sm font-semibold text-neutral-200 font-mono">Strict Architectural Invariants</h3>
              <ul className="space-y-2 text-xs text-neutral-300">
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">🚫 FORBIDDEN:</span>
                  <span><code className="text-neutral-100 font-mono">inkforge_ink</code> must NOT depend on Qt Widgets or rendering headers. Stroke vector mathematics must remain 100% portable for headless test suites and background thread AI processing.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">🚫 FORBIDDEN:</span>
                  <span><code className="text-neutral-100 font-mono">inkforge_documents</code> must NOT depend on UI controllers or storage engines. Document state updates emit agnostic callback signals.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">🚫 FORBIDDEN:</span>
                  <span><code className="text-neutral-100 font-mono">inkforge_storage</code> must NOT depend on rendering code or canvas widgets.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓ ENFORCED:</span>
                  <span>All external hardware interfaces are hidden behind abstract virtual base classes (<code className="text-neutral-100 font-mono">ITabletInputSource</code>, <code className="text-neutral-100 font-mono">IDatabase</code>, <code className="text-neutral-100 font-mono">IRenderer</code>).</span>
                </li>
              </ul>
            </div>
          </section>
        )}

        {selectedSection === 4 && (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
                04. Document Data Model Hierarchy
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                A structured composition: Notebook → Pages → Layers → Vector Strokes.
              </p>
            </div>

            <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800 font-mono text-xs space-y-2">
              <div className="text-amber-400 font-semibold">Notebook Entity</div>
              <div className="pl-4 border-l border-neutral-700 text-neutral-300">
                <div>uuid: string (UUIDv4)</div>
                <div>metadata: {`{ title, subject, tags, created_at, updated_at }`}</div>
                <div>pages: std::vector&lt;std::shared_ptr&lt;Page&gt;&gt;</div>
                <div className="text-amber-400 font-semibold mt-2">Page Entity</div>
                <div className="pl-4 border-l border-neutral-700 text-neutral-300">
                  <div>uuid: string</div>
                  <div>index: size_t</div>
                  <div>background_pattern: enum {`{ Blank, Lined, Grid, DotGrid }`}</div>
                  <div>grid_spacing: double (default 24.0 pt)</div>
                  <div>layers: std::vector&lt;Layer&gt;</div>
                  <div className="text-amber-400 font-semibold mt-2">Layer Entity</div>
                  <div className="pl-4 border-l border-neutral-700 text-neutral-300">
                    <div>uuid: string</div>
                    <div>name: string ("Ink Layer", "Annotation Layer")</div>
                    <div>is_visible: bool</div>
                    <div>is_locked: bool</div>
                    <div>opacity: float [0.0, 1.0]</div>
                    <div>strokes: std::vector&lt;std::shared_ptr&lt;Stroke&gt;&gt;</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {selectedSection === 5 && (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
                05. Vector Stroke & Point Data Model
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                Exact binary struct layout storing continuous digitizer trajectory physics.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 font-mono text-xs space-y-2">
                <div className="text-amber-400 font-semibold">struct Point (28 Bytes Packed)</div>
                <div className="text-neutral-400">double x;            // 8B world coordinate X</div>
                <div className="text-neutral-400">double y;            // 8B world coordinate Y</div>
                <div className="text-neutral-400">float pressure;      // 4B normalized [0.0, 1.0]</div>
                <div className="text-neutral-400">float tilt_x;        // 4B pen tilt X [-60°, +60°]</div>
                <div className="text-neutral-400">float tilt_y;        // 4B pen tilt Y [-60°, +60°]</div>
                <div className="text-neutral-400">uint64_t timestamp;  // 8B microsecond clock</div>
                <div className="text-emerald-400 text-[11px] pt-1 border-t border-neutral-800">
                  Cache friendly: 2 points per 64-byte L1 cache line!
                </div>
              </div>

              <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 space-y-2 text-xs text-neutral-300">
                <h4 className="font-semibold text-neutral-100 font-mono">Centripetal Catmull-Rom Formulation</h4>
                <p>
                  Evaluates t_(i+1) = t_i + ||P_(i+1) - P_i||^α with centripetal parameter α = 0.5.
                </p>
                <p className="text-neutral-400">
                  Guarantees that rapid changes in pen velocity do not generate self-intersecting loops or sharp cusps, preserving personal handwriting slant and curvature fidelity.
                </p>
              </div>
            </div>
          </section>
        )}

        {selectedSection === 6 && (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
                06. Tablet Input Pipeline
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                Wacom Intuos / Cintiq digitizer event capture with zero quantization.
              </p>
            </div>

            <div className="p-5 rounded-lg bg-neutral-900 border border-neutral-800 space-y-3 text-xs text-neutral-300 leading-relaxed">
              <p>
                InkForge isolates platform-specific tablet drivers behind the <code className="text-amber-400 font-mono">ITabletInputSource</code> interface. On Windows, Qt 6 forwards both Windows Ink and Wacom WinTab events via <code className="text-neutral-100 font-mono">QTabletEvent</code>.
              </p>
              <div className="p-3 bg-neutral-950 rounded border border-neutral-800 font-mono text-[11px] text-neutral-300">
                Tablet Press → QTabletEvent::pointerType() Check (Stylus Tip vs Eraser End) → Sub-pixel position → Microsecond timestamp → Emitted to CanvasWidget in-flight scratch buffer.
              </div>
              <p>
                By rendering the in-flight stroke immediately into an overlay pass prior to document commit, perceived input-to-render latency remains under 8 milliseconds.
              </p>
            </div>
          </section>
        )}

        {selectedSection === 7 && (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
                07. Rendering Engine & Viewport Transformations
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                Double-buffered affine matrix viewport transform with bounding-box culling.
              </p>
            </div>

            <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800 text-xs text-neutral-300 space-y-3">
              <p>
                <strong>Viewport Transform:</strong> Manages screen_pos = world_pos × zoom + pan. Supports smooth continuous zooming from 10% to 500% pinned around the cursor focal point.
              </p>
              <p>
                <strong>Spatial Bounding Box Culling:</strong> Prior to rendering each stroke, <code className="text-neutral-100 font-mono">stroke.intersects(visible_world_rect)</code> is evaluated. Strokes outside the current screen viewport are skipped immediately with zero drawing overhead.
              </p>
              <p>
                <strong>Blend Modes:</strong> The highlighter tool activates <code className="text-neutral-100 font-mono">QPainter::CompositionMode_Multiply</code>, allowing dark ink written beneath the highlight to remain sharp and legible.
              </p>
            </div>
          </section>
        )}

        {selectedSection === 8 && (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
                08. Persistence Architecture
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                Hybrid storage: Relational SQLite metadata paired with binary stroke chunks.
              </p>
            </div>

            <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800 space-y-3 text-xs text-neutral-300">
              <p>
                To avoid database bloat when notebooks grow to 50,000+ strokes, InkForge implements a hybrid persistence format:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-neutral-400">
                <li><strong className="text-neutral-200">SQLite Database (`notebooks.sqlite`):</strong> Stores notebooks, pages, layers, and spatial chunk offsets with Write-Ahead Logging (<code className="text-amber-400 font-mono">PRAGMA journal_mode = WAL</code>).</li>
                <li><strong className="text-neutral-200">Binary Stroke Chunks:</strong> Fixed-width IEEE-754 binary point arrays compressed with LZ4/Zstandard for instantaneous file reads and crash-safe atomic write-ahead logs.</li>
              </ul>
            </div>
          </section>
        )}

        {selectedSection === 9 && (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
                09. Command-Pattern Undo / Redo
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                O(1) memory overhead command stack without state copying.
              </p>
            </div>

            <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800 font-mono text-xs text-neutral-300 space-y-2">
              <p className="text-amber-400 font-semibold">// Strict Command Pattern Interface</p>
              <p>class ICommand {`{ virtual void execute() = 0; virtual void undo() = 0; }`};</p>
              <p className="text-neutral-400">
                When adding a stroke, <code className="text-neutral-200">AddStrokeCommand</code> stores only <code className="text-neutral-200">std::shared_ptr&lt;Stroke&gt;</code> and a pointer to the active <code className="text-neutral-200">Layer</code>. Undo removes the pointer from the layer's vector; Redo appends it back. No document cloning occurs!
              </p>
            </div>
          </section>
        )}

        {selectedSection === 10 && (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
                10. Concurrency & Multi-Threading Rules
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                Strict separation of GUI event loop from background I/O and future AI services.
              </p>
            </div>

            <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800 space-y-3 text-xs text-neutral-300">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-neutral-950 rounded border border-neutral-800">
                  <div className="text-amber-400 font-bold font-mono">1. GUI Thread (Main)</div>
                  <p className="mt-1 text-neutral-400">Qt Event Loop, Tablet events, Viewport transformations, immediate-mode scratchpad.</p>
                </div>
                <div className="p-3 bg-neutral-950 rounded border border-neutral-800">
                  <div className="text-amber-400 font-bold font-mono">2. Storage Worker</div>
                  <p className="mt-1 text-neutral-400">SQLite writes, binary chunk serialization, background autosave every 15s.</p>
                </div>
                <div className="p-3 bg-neutral-950 rounded border border-neutral-800">
                  <div className="text-amber-400 font-bold font-mono">3. AI Worker Pool</div>
                  <p className="mt-1 text-neutral-400">(Phases 4-5) Ollama local LLM queries, trajectory beautification, and offline OCR.</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {selectedSection === 11 && (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
                11. CMake Project Structure & Cross-Platform Support
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                Modern CMake 3.24+ configuration for Windows (MSVC 2022) and Linux (GCC 13+).
              </p>
            </div>

            <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800 font-mono text-xs space-y-2 text-neutral-300">
              <p className="text-amber-400 font-semibold">Sub-target Modular Graph</p>
              <div>add_library(inkforge_core STATIC ...)</div>
              <div>add_library(inkforge_ink STATIC ...)</div>
              <div>add_library(inkforge_input STATIC ...)</div>
              <div>add_library(inkforge_documents STATIC ...)</div>
              <div>add_library(inkforge_rendering STATIC ...)</div>
              <div>add_library(inkforge_commands STATIC ...)</div>
              <div>add_library(inkforge_storage STATIC ...)</div>
              <div>add_library(inkforge_canvas STATIC ...)</div>
              <div>add_executable(inkforge_app ...)</div>
              <div>add_executable(inkforge_tests ...)</div>
            </div>
          </section>
        )}

        {selectedSection === 12 && (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
                12. Repository Structure
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                Clean, enterprise-grade C++ directory layout ready for 100k+ lines of code.
              </p>
            </div>

            <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800 font-mono text-xs text-neutral-300 whitespace-pre leading-relaxed">
{`inkforge/
├── CMakeLists.txt              # Root build script
├── README.md                   # Project overview & build guide
├── docs/                       # Architecture & ADRs
│   ├── ARCHITECTURE.md         # Full specification
│   ├── BUILDING.md             # Platform compile instructions
│   ├── DIGITAL_INK.md          # Mathematics of Catmull-Rom & latency
│   ├── STORAGE_FORMAT.md       # Relational SQLite & binary serialization
│   ├── ROADMAP.md              # Phased engineering roadmap
│   └── AI_ARCHITECTURE.md      # Ollama & trajectory models
├── include/inkforge/           # Public headers (decoupled interfaces)
│   ├── core/                   # Vec2d, Rect2d, ColorRgba
│   ├── ink/                    # Point, Stroke, CatmullRom, InkEngine
│   ├── input/                  # TabletInputEvent, ITabletInputSource
│   ├── documents/              # Notebook, Page, Layer, DocumentModel
│   ├── rendering/              # ViewportTransform, CanvasRenderer
│   ├── storage/                # SQLiteStorage, IDatabase
│   └── commands/               # CommandStack, AddStrokeCommand
├── src/                        # Implementations (compiled into static libs)
│   ├── app/                    # main.cpp, MainWindow.cpp
│   ├── canvas/                 # CanvasWidget.cpp
│   ├── ink/                    # SplineCurve.cpp, Stroke.cpp
│   ├── input/                  # QtTabletFilter.cpp, TabletDeviceManager.cpp
│   ├── documents/              # Page.cpp, Notebook.cpp
│   ├── rendering/              # CanvasRenderer.cpp
│   ├── storage/                # SQLiteStorage.cpp
│   └── commands/               # CommandStack.cpp, StrokeCommands.cpp
└── tests/                      # Automated unit test suite (CTest)`}
            </div>
          </section>
        )}

        {selectedSection === 13 && (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
                13. External Dependency Policy
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                Zero bloat policy: Every dependency must justify maintenance cost and license compatibility.
              </p>
            </div>

            <div className="border border-neutral-800 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-neutral-900 text-neutral-400 font-mono uppercase border-b border-neutral-800">
                  <tr>
                    <th className="p-3">Component</th>
                    <th className="p-3">Selected Dependency</th>
                    <th className="p-3">License</th>
                    <th className="p-3">Justification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800 text-neutral-300">
                  <tr>
                    <td className="p-3 font-medium">Desktop GUI / Windowing</td>
                    <td className="p-3 font-mono text-amber-400">Qt 6.5+ LTS</td>
                    <td className="p-3 text-neutral-400">LGPLv3</td>
                    <td className="p-3">Industry-standard cross-platform tablet event handling, DPI scaling, and hardware integration.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">Relational Storage</td>
                    <td className="p-3 font-mono text-amber-400">SQLite 3 (via QtSql)</td>
                    <td className="p-3 text-neutral-400">Public Domain</td>
                    <td className="p-3">Zero configuration, atomic transactions, embedded in-process, ubiquitous crash recovery.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">Local LLM Integration</td>
                    <td className="p-3 font-mono text-amber-400">Ollama HTTP API</td>
                    <td className="p-3 text-neutral-400">MIT</td>
                    <td className="p-3">Decouples large neural network weights and GPU acceleration from the native C++ desktop binary.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {selectedSection === 14 && (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
                14. High-Risk Engineering Problems & Mitigations
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                Proactive analysis of critical bottlenecks before scaling codebase size.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 space-y-2">
                <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs font-mono">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>RISK 1: Input-to-Photon Latency Degradation</span>
                </div>
                <p className="text-xs text-neutral-300">
                  If the stroke evaluator blocks the Qt event loop while waiting for curve fitting, pen lag becomes visible.
                </p>
                <p className="text-xs text-emerald-400">
                  <strong>Mitigation:</strong> Dual-layer rendering. Raw pointer samples are drawn immediately into an uncommitted scratchpad buffer (&lt; 5 ms). Full Catmull-Rom spline tessellation runs upon pen lift or asynchronously in the background.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 space-y-2">
                <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs font-mono">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>RISK 2: Infinite Canvas Frame Rate Collapse at 100k Strokes</span>
                </div>
                <p className="text-xs text-neutral-300">
                  Iterating through hundreds of thousands of vector strokes each paint frame will degrade FPS below 30.
                </p>
                <p className="text-xs text-emerald-400">
                  <strong>Mitigation:</strong> Hierarchical R-Tree spatial indexing and viewport bounding-box culling. Only strokes intersecting the visible screen coordinate box are submitted to the rasterizer.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 space-y-2">
                <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs font-mono">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>RISK 3: Destructive AI "Beautification" Replacing Handwriting Identity</span>
                </div>
                <p className="text-xs text-neutral-300">
                  Over-smoothing handwriting turns personal notes into robotic handwriting fonts.
                </p>
                <p className="text-xs text-emerald-400">
                  <strong>Mitigation:</strong> Deterministic micro-jitter suppression first. Original raw point vectors are always preserved so any enhancement layer can be selectively dialed back or reverted.
                </p>
              </div>
            </div>
          </section>
        )}

        {selectedSection === 15 && (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
                15. Staged Implementation Roadmap
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                Phased execution from baseline desktop shell to personalized handwriting models.
              </p>
            </div>

            <div className="space-y-3">
              {[
                { phase: 'Phase 1 (Complete)', title: 'Architecture Baseline & Desktop Shell', status: 'Delivered', desc: 'Core modules, C++20/Qt 6 CMake skeleton, vector stroke models, tablet input abstraction, infinite canvas, and undo/redo.' },
                { phase: 'Phase 2', title: 'Advanced Ink Engine & Hardware Benchmarks', status: 'Next Sprint', desc: 'One Euro Filter tuning for physical Wacom hardware, OpenGL GPU quad-strip tessellation, spatial R-Tree index.' },
                { phase: 'Phase 3', title: 'Deterministic Handwriting Beautification', status: 'Planned', desc: 'Noise removal, baseline detection, slant normalization, and character spacing normalization without deep learning.' },
                { phase: 'Phase 4', title: 'Handwriting & Equation Recognition', status: 'Planned', desc: 'Offline OCR and LaTeX transcription referencing original stroke coordinate bounding boxes.' },
                { phase: 'Phase 5', title: 'Local AI via Ollama', status: 'Planned', desc: 'Offline note summarization, visual RAG citations, and flashcard generation.' },
                { phase: 'Phase 6', title: 'Personalized Generative Handwriting Model', status: 'Research', desc: 'Learning personal stroke rhythm, pressure, and letter connections to generate clean user-styled handwriting.' },
              ].map((item, idx) => (
                <div key={idx} className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-amber-400">{item.phase}</span>
                      <span aria-hidden="true" className="text-neutral-600">·</span>
                      <h4 className="text-sm font-semibold text-neutral-200">{item.title}</h4>
                    </div>
                    <p className="text-xs text-neutral-400">{item.desc}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded font-mono shrink-0 ${
                    item.status === 'Delivered'
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                      : item.status === 'Next Sprint'
                      ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
