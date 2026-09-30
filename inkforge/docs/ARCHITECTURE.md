# InkForge System Architecture (v0.1)

## 1. Executive Summary & Design Philosophy
InkForge is architected as a modular, high-performance desktop C++20/Qt 6 application. Its primary technical mandate is to deliver zero-compromise input-to-render latency for high-precision tablet pens (Wacom Intuos / Cintiq) while preserving complete vector trajectory fidelity.

### Architectural Invariants:
1. **Unidirectional Event Pipeline**:
   $$\text{Hardware/OS} \longrightarrow \text{Input System} \longrightarrow \text{Stroke Builder} \longrightarrow \text{Document Model} \longrightarrow \text{Render Pipeline}$$
2. **Zero Business Logic in UI**: The Qt Widgets and Canvas components only emit user intents and subscribe to document model change signals.
3. **Decoupled Data Storage**: The Canvas never calls disk I/O directly; storage runs asynchronously through a transactional SQLite worker.
4. **Lossless Vector Capture**: Raw tablet coordinates, pressure dynamics, timestamps, and tilt angles are retained intact, guaranteeing that AI models and future curve reconstruction algorithms can reprocess original user strokes.

---

## 2. Module Decomposition & Responsibilities

| Subsystem | Target Library | Primary Responsibilities | Dependencies |
| :--- | :--- | :--- | :--- |
| **inkforge_core** | `STATIC_LIB` | Primitive types, Vec2d, BoundingBox, Color, microsecond clocks | Standard Library |
| **inkforge_ink** | `STATIC_LIB` | `Point`, `Stroke`, `Brush`, Catmull-Rom spline evaluator, One Euro filtering | `inkforge_core` |
| **inkforge_input** | `STATIC_LIB` | `ITabletInputSource`, `TabletInputEvent`, Pen state tracking, Wacom/WinTab abstraction | `inkforge_core`, Qt6::Gui |
| **inkforge_documents** | `STATIC_LIB` | `Notebook`, `Page`, `Layer`, `DocumentModel`, Scene spatial hierarchy | `inkforge_ink` |
| **inkforge_rendering** | `STATIC_LIB` | `IRenderer`, `CanvasRenderer`, `ViewportTransform`, GPU/QPainter backends | `inkforge_documents`, Qt6::Gui |
| **inkforge_commands** | `STATIC_LIB` | Command pattern implementation (`AddStrokeCommand`, `CommandStack`) | `inkforge_documents` |
| **inkforge_storage** | `STATIC_LIB` | SQLite metadata persistence, binary chunk serialization, autosave worker | `inkforge_documents`, Qt6::Sql |
| **inkforge_canvas** | `STATIC_LIB` | Qt infinite canvas widget, input routing, viewport navigation | `inkforge_rendering`, `inkforge_input`, `inkforge_commands` |
| **inkforge_app** | `EXECUTABLE` | Main entry point, Qt application shell, window management, toolbar assembly | All above modules, Qt6::Widgets |

---

## 3. Dependency Graph & Layering Rules
```text
           ┌────────────────────────────────────────┐
           │              inkforge_app              │
           └───────────────────┬────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌────────────────────────┐             ┌────────────────────────┐
│    inkforge_canvas     │             │    inkforge_storage    │
└───────────┬────────────┘             └──────────┬─────────────┘
            │                                     │
      ┌─────┴───────────────┐                     │
      ▼                     ▼                     │
┌──────────────┐     ┌──────────────┐             │
│inkforge_input│     │inkforge_rend.│             │
└──────┬───────┘     └──────┬───────┘             │
       │                    │                     │
       ▼                    ▼                     ▼
┌──────────────┐     ┌──────────────────────────────────┐
│inkforge_core │     │       inkforge_documents         │
└──────────────┘     └──────────────────┬───────────────┘
                                        │
                                        ▼
                             ┌─────────────────────┐
                             │    inkforge_ink     │
                             └──────────┬──────────┘
                                        │
                                        ▼
                             ┌─────────────────────┐
                             │    inkforge_core    │
                             └─────────────────────┘
```

**Forbidden Dependencies**:
- `inkforge_ink` MUST NOT depend on `inkforge_rendering` or Qt Widgets.
- `inkforge_documents` MUST NOT depend on `inkforge_canvas` or GUI controllers.
- `inkforge_storage` MUST NOT depend on rendering code.

---

## 4. Main Document Data Model

The document hierarchy is structured as follows:

```text
Notebook
 ├── uuid: string
 ├── metadata: NotebookMetadata (title, tags, created_at, updated_at)
 └── pages: std::vector<std::shared_ptr<Page>>
      │
      └── Page
           ├── uuid: string
           ├── index: size_t
           ├── dimensions: Size2D (virtual boundary, default unbounded)
           ├── background_style: enum { Blank, Lined, Grid, DotGrid }
           └── layers: std::vector<Layer>
                │
                └── Layer
                     ├── uuid: string
                     ├── name: string
                     ├── is_visible: bool
                     ├── is_locked: bool
                     ├── opacity: float [0.0, 1.0]
                     └── strokes: std::vector<std::shared_ptr<Stroke>>
```

---

## 5. Stroke & Point Data Model

### Raw Vector Point Representation
Every point sampled by the tablet hardware is encapsulated in a compact, cache-aligned struct:

```cpp
struct Point {
    double x{0.0};              // Sub-pixel world coordinate X
    double y{0.0};              // Sub-pixel world coordinate Y
    float pressure{0.0f};       // Normalized pressure [0.0, 1.0]
    float tiltX{0.0f};          // Pen tilt angle X (-60 to +60 degrees)
    float tiltY{0.0f};          // Pen tilt angle Y (-60 to +60 degrees)
    uint64_t timestamp_us{0};   // Microseconds since epoch
};
```

### Vector Stroke Architecture
```cpp
enum class ToolType : uint8_t {
    Pen = 0,
    Highlighter = 1,
    Eraser = 2
};

class Stroke {
public:
    std::string id;
    ToolType tool{ToolType::Pen};
    Color color{0, 0, 0, 255};
    float base_width{2.5f};
    std::vector<Point> raw_points;
    Rect2D bounding_box;

    void add_point(const Point& pt);
    void recompute_bounds();
    std::vector<Point> compute_spline_points(double step_size = 1.0) const;
};
```

---

## 6. Tablet Input Pipeline

Graphics tablet input requires specialized handling to preserve sub-millisecond precision and prevent quantization:

```text
Wacom Tablet Hardware
       │ (Physical Pen Down, 133-200 Hz event stream)
       ▼
OS Tablet API (Windows Ink / WinTab API / libinput on Linux)
       │
       ▼
Qt Platform Abstraction (QTabletEvent)
       │
       ▼
inkforge::input::QtTabletFilter (Sub-pixel x, y, pressure, tiltX, tiltY)
       │
       ▼
inkforge::input::TabletInputEvent Normalization
       │
       ▼
inkforge::canvas::CanvasWidget (Active Stroke Construction)
       │
       ▼
Real-time Dynamic Stroke Tessellation & Immediate-Mode Scratch Buffer
```

To eliminate perceived latency, input points during an active stroke are drawn directly into an immediate **In-Flight Overlay Layer**. When the pen lifts (`PenUp`), the stroke is finalized, passed to the Catmull-Rom evaluator, inserted into the active `Layer`, and recorded in the Undo stack.

---

## 7. Rendering Pipeline

The rendering system separates static document layers from the dynamic stroke in-flight:

1. **Static Background Pass**: Grid lines, dot grids, or PDF page background transformed by `ViewportTransform`.
2. **Document Stroke Pass**:
   - Viewport Culling: Only strokes whose `bounding_box.intersects(viewport_rect)` are submitted.
   - Level of Detail (LOD): At extreme zoom-out ($<25\%$), simplified polylines are used; at normal/high zoom, full Catmull-Rom spline ribbons with variable-radius quad strips are rendered.
3. **In-Flight Stroke Pass**: Uncommitted active stroke rendered directly from raw tablet points with predictive tip extrapolation.

---

## 8. Persistence Architecture

Persistence utilizes a hybrid storage model:
- **Relational Metadata (`notebook.sqlite`)**:
  - `notebooks` table (uuid, title, created_at, updated_at)
  - `pages` table (uuid, notebook_id, page_index, bg_style)
  - `layers` table (uuid, page_id, layer_index, name, opacity)
- **Stroke Chunks (`.inkforge_chunk`)**:
  - Large binary BLOBs or compressed binary chunks storing thousands of vector stroke streams using IEEE-754 binary formats, avoiding SQL query overhead for millions of coordinates.
- **Autosave Worker**: Runs on a background thread (`QThread`), performing atomic write-ahead journaling and snapshots every 30 seconds or upon 5 seconds of pen idle.

---

## 9. Undo / Redo Architecture

Implemented via the strict Command Pattern:
```cpp
class ICommand {
public:
    virtual ~ICommand() = default;
    virtual void execute() = 0;
    virtual void undo() = 0;
    virtual std::string description() const = 0;
};
```
Commands like `AddStrokeCommand` store only the shared pointer to the created stroke and the target `Layer` ID. Undo simply removes the pointer from the layer's vector; Redo appends it back. Memory footprint is $O(1)$ pointer operations without duplicating document state.

---

## 10. Threading Model & Concurrency Rules

1. **GUI Thread (Main)**:
   - Qt Event Loop
   - Tablet event processing
   - Viewport transformations & UI rendering
   - Command dispatch
2. **Storage Thread (`StorageWorker`)**:
   - SQLite reads/writes
   - Vector stroke chunk serialization
   - Autosave transactions
3. **AI / Background Worker (`WorkerPool`)**:
   - Catmull-Rom background curve caching
   - (Phase 4-5) OCR, semantic chunking, and local LLM queries
