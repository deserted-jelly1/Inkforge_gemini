# InkForge — Phased Implementation Roadmap

This document outlines the progressive engineering phases from v0.1 architectural baseline to advanced local AI handwriting enhancement.

---

## Phase 1 — Initial MVP (Current Phase)
**Goal: Deliver rock-solid native notebook shell, tablet input, low-latency ink, and persistence.**

- [x] High-level software architecture and module decoupling.
- [x] CMake build system configured for C++20 and Qt 6 on Windows and Linux.
- [x] Vector stroke and point data model with full timestamp and pressure resolution.
- [x] Tablet input abstraction (`ITabletInputSource`) and sub-pixel event capture.
- [x] Infinite canvas coordinate transformation (pan, continuous zoom $10\% - 500\%$).
- [x] Dynamic variable-width inking with Centripetal Catmull-Rom spline evaluator.
- [x] Core tool set: Pressure-sensitive Pen, Highlighter, and Stroke Eraser.
- [x] Command-pattern undo/redo stack (`AddStrokeCommand`, `CommandStack`).
- [x] SQLite schema for notebooks, pages, and layers.
- [x] Interactive web-based architectural testbed and workbench simulator.

---

## Phase 2 — Advanced Ink Engine & Performance Benchmarking
**Goal: Extreme latency reduction, spatial acceleration, and memory optimization.**

- [ ] One Euro Filter parameter tuning for physical Wacom Intuos hardware.
- [ ] OpenGL hardware-accelerated vertex shader stroke tessellation.
- [ ] R-Tree / quadtree spatial indexing for millions of strokes per canvas.
- [ ] High-frequency stroke prediction (5–10 ms ahead of hardware samples).
- [ ] Partial stroke erasing and path boolean intersection.
- [ ] Automated input-to-photon latency benchmarking harness.

---

## Phase 3 — Deterministic Handwriting Beautification
**Goal: Improve legibility and rhythm without altering personal handwriting traits.**

- [ ] Noise reduction and micro-tremor suppression.
- [ ] Stroke stroke-order classification and word baseline detection.
- [ ] Slant angle normalization (shear transform while preserving stroke pressure).
- [ ] Inter-letter and inter-word rhythm and spacing normalization.
- [ ] Reversible correction: store correction as a delta layer over raw strokes.

---

## Phase 4 — Recognition & Document Intelligence
**Goal: Full offline searchability and math equation transcription.**

- [ ] Stroke trajectory to text transcription via open-source offline models.
- [ ] LaTeX equation recognition from vector stroke graphs.
- [ ] Bounding-box stroke linkage: search query jumps directly to ink coordinates.
- [ ] PDF import, background rendering, and vector overlay annotation.

---

## Phase 5 — Local AI & Offline Retrieval
**Goal: Intelligent study partner powered by Ollama.**

- [ ] `AIService` interface with `OllamaProvider`.
- [ ] Context-aware note summarization and flashcard synthesis.
- [ ] Vector embeddings over recognized handwriting chunks.
- [ ] Visual citation: AI answers highlight source handwriting regions on the canvas.

---

## Phase 6 — Personalized Generative Handwriting Models
**Goal: Generative models that learn user's letter connections and stroke rhythm.**

- [ ] User trajectory dataset collection and personal stroke dictionary.
- [ ] PyTorch training pipeline for personalized generative trajectory models.
- [ ] ONNX Runtime deployment for real-time inference on desktop CPU/GPU.
