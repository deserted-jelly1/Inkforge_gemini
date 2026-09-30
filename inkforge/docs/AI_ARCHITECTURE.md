# InkForge — Local AI & Handwriting Modeling Architecture

## 1. Guiding Principle
> **"Improve the user's handwriting without replacing it."**

Unlike traditional OCR systems that erase the personal qualities of human handwriting, InkForge treats handwriting trajectories as continuous geometric time-series signals. The AI subsystems operate strictly as an advisory, enhancement, and retrieval layer that never mutates raw user strokes destructively.

---

## 2. Decoupled Service Architecture

To ensure the desktop application functions seamlessly offline with zero cloud lock-in, all AI capabilities are abstracted behind the `AIService` interface:

```text
                  ┌──────────────────────┐
                  │    DocumentModel     │
                  └──────────┬───────────┘
                             │ (Vector trajectory chunks)
                             ▼
                  ┌──────────────────────┐
                  │      AIService       │
                  └──────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
┌───────────────────────┐         ┌───────────────────────┐
│     OllamaProvider    │         │   OnnxRuntimeProvider │
│  - Local LLM Summaries│         │  - Trajectory Denoise │
│  - Flashcard / Quiz   │         │  - Slant Normalization│
│  - Semantic Q&A       │         │  - Equation OCR       │
└───────────────────────┘         └───────────────────────┘
```

---

## 3. Ollama Integration Protocol
- Communicates over local HTTP socket (`http://127.0.0.1:11434/api/generate`).
- Non-blocking asynchronous requests dispatched on a dedicated background worker thread (`QThread`).
- Streaming responses with real-time cancellation when the user resumes active pen input.

---

## 4. Trajectory Retrieval-Augmented Generation (RAG)
When an LLM generates a response or summary, it references the specific coordinate bounding boxes of the handwritten notes. The user can click any synthesized sentence to navigate directly to the physical handwriting on the infinite canvas.
