# InkForge — AI-Enhanced Handwriting Notebook

> **"Improve the user's handwriting without replacing it."**

InkForge is a professional, cross-platform, local-first desktop handwriting environment engineered for graphics tablets (e.g., Wacom Intuos, Cintiq). Unlike standard drawing programs or OCR tools that discard handwriting trajectories in favor of generic font text, InkForge preserves the full vector physics of human handwriting (coordinate stream, high-resolution pressure dynamics, tilt, velocity, and timestamp series) to enable low-latency digital inking, infinite canvas navigation, and identity-preserving AI handwriting enhancement.

---

## Key Pillars

1. **Native C++20 / Qt 6 Architecture**: Clean modular design separating input abstraction, stroke construction, vector document models, rendering pipelines, and persistence.
2. **True Vector Ink Model**: Every stroke is stored with sub-pixel floating-point coordinates, normalized pressure $[0.0, 1.0]$, microsecond timestamps, and tilt angles, enabling Catmull-Rom spline reconstruction and future trajectory learning.
3. **Decoupled Tablet Abstraction**: Supports Windows Ink, Wacom WinTab, and Linux libinput via an isolated `ITabletInputSource` interface.
4. **Infinite Canvas Engine**: Viewport coordinate transformations with sub-millisecond panning, smooth continuous zooming ($10\% - 500\%$), and spatial bounding-box indexing.
5. **Robust Persistence & Undo**: Hybrid architecture combining relational SQLite for notebook/page metadata with transactional vector stroke chunks, guarded by a command-pattern undo/redo stack.
6. **Local-First & Privacy Preserving**: Zero mandatory cloud dependencies. Local model execution via PyTorch/ONNX and Ollama local LLM integration.

---

## Repository Structure

```text
inkforge/
├── CMakeLists.txt              # Root build configuration (C++20, Qt 6)
├── README.md                   # Project overview & quick start
├── docs/                       # Architectural specifications & ADRs
│   ├── ARCHITECTURE.md         # Comprehensive system architecture & dataflow
│   ├── BUILDING.md             # Compilation instructions (Windows MSVC & Linux GCC)
│   ├── DIGITAL_INK.md          # Mathematics of stroke smoothing, Catmull-Rom, & latency
│   ├── STORAGE_FORMAT.md       # SQLite schema & vector stroke binary serialization
│   ├── ROADMAP.md              # Phased engineering roadmap (Phase 1 to Phase 6)
│   └── AI_ARCHITECTURE.md      # Local AI, Ollama integration, & trajectory learning
├── include/inkforge/           # Public headers organized by subsystem
│   ├── core/                   # Platform types, export macros, math utilities
│   ├── ink/                    # Point, Stroke, Catmull-Rom, InkEngine
│   ├── input/                  # TabletInputEvent, PenState, ITabletInputSource
│   ├── documents/              # Notebook, Page, Layer, DocumentModel
│   ├── rendering/              # ViewportTransform, IRenderer, CanvasRenderer
│   ├── storage/                # SQLiteStorage, IDatabase, binary serialization
│   └── commands/               # ICommand, CommandStack, AddStrokeCommand
├── src/                        # Implementations & subproject CMakeLists
│   ├── app/                    # Entry point, MainWindow, application shell
│   ├── canvas/                 # Qt-based interactive Infinite Canvas widget
│   ├── ink/                    # Digital ink mathematics & curve generation
│   ├── input/                  # Tablet event filter & device management
│   ├── documents/              # Document lifecycle & scene graph
│   ├── rendering/              # QPainter / GPU hardware-accelerated rendering
│   ├── storage/                # SQLite driver & migration system
│   └── commands/               # Undo/redo command implementations
└── tests/                      # Unit test suite (Catch2 / CTest)
```

---

## Quick Build Instructions

### Prerequisites
- **C++ Compiler**: MSVC 2022 v19.34+ (Windows) or GCC 13+ / Clang 17+ (Linux)
- **CMake**: 3.24 or newer
- **Qt 6**: Version 6.5 LTS or newer with `Core`, `Gui`, `Widgets`, and `Sql`
- **Ninja** or Visual Studio Generator

### Windows (PowerShell with MSVC)
```powershell
cmake -B build -S . -G "Visual Studio 17 2022" -A x64 -DCMAKE_PREFIX_PATH="C:/Qt/6.7.2/msvc2022_64"
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
./build/Release/inkforge_app.exe
```

### Linux (Bash)
```bash
cmake -B build -S . -G Ninja -DCMAKE_BUILD_TYPE=Release -DCMAKE_PREFIX_PATH="/opt/Qt/6.7.2/gcc_64"
cmake --build build
ctest --test-dir build --output-on-failure
./build/src/app/inkforge_app
```

Refer to `docs/BUILDING.md` for full platform-specific toolchain setups.
