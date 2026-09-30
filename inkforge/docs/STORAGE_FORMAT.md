# InkForge — Storage Format & Persistence Specification

## 1. Storage Architecture Overview
InkForge avoids storing massive vector strokes directly inside SQL row columns as plain text or JSON strings, which degrades query performance as notebooks scale to hundreds of thousands of strokes.

Instead, a **hybrid package format** (`.inkforge` bundle or directory containing SQLite + binary chunks) is employed:
- **SQLite Database (`notebook.db`)**: Stores relational document structure, notebook metadata, page order, layer states, and spatial chunk indexes.
- **Binary Stroke Chunks (`strokes.chunk`)**: Fixed-length IEEE-754 binary streams storing packed `Point` structs and vector trajectories.

---

## 2. SQLite Relational Schema

```sql
-- Notebook metadata
CREATE TABLE IF NOT EXISTS notebooks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    metadata_json TEXT
);

-- Pages within a notebook
CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
    page_index INTEGER NOT NULL,
    width REAL DEFAULT 0.0,
    height REAL DEFAULT 0.0,
    bg_style INTEGER DEFAULT 1, -- 0=Blank, 1=Lined, 2=Grid, 3=DotGrid
    created_at INTEGER NOT NULL
);

-- Layers per page
CREATE TABLE IF NOT EXISTS layers (
    id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    layer_index INTEGER NOT NULL,
    name TEXT NOT NULL,
    is_visible INTEGER DEFAULT 1,
    is_locked INTEGER DEFAULT 0,
    opacity REAL DEFAULT 1.0
);

-- Spatial chunks storing stroke references
CREATE TABLE IF NOT EXISTS stroke_records (
    id TEXT PRIMARY KEY,
    layer_id TEXT NOT NULL REFERENCES layers(id) ON DELETE CASCADE,
    tool_type INTEGER NOT NULL, -- 0=Pen, 1=Highlighter, 2=Eraser
    color_rgba INTEGER NOT NULL,
    base_width REAL NOT NULL,
    point_count INTEGER NOT NULL,
    min_x REAL NOT NULL,
    min_y REAL NOT NULL,
    max_x REAL NOT NULL,
    max_y REAL NOT NULL,
    chunk_file TEXT NOT NULL,
    chunk_byte_offset INTEGER NOT NULL,
    chunk_byte_length INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stroke_spatial 
    ON stroke_records(layer_id, min_x, max_x, min_y, max_y);
```

---

## 3. Binary Chunk Serialization Protocol

Each stroke chunk is packed with a 32-byte header followed by dense 28-byte point records:

```text
Stroke Chunk Header (32 Bytes):
[0x00 - 0x03] Magic Bytes: 0x49 0x4E 0x4B 0x46 ("INKF")
[0x04 - 0x07] Version: uint32_t (e.g. 0x00010000)
[0x08 - 0x0F] Stroke Count: uint64_t
[0x10 - 0x1F] Reserved / CRC32 Checksum

Packed Point Record (28 Bytes per point):
[0x00 - 0x07] x: float64 (8 bytes, sub-pixel world coordinate)
[0x08 - 0x0F] y: float64 (8 bytes, sub-pixel world coordinate)
[0x10 - 0x13] pressure: float32 (4 bytes, [0.0, 1.0])
[0x14 - 0x17] tiltX: float32 (4 bytes)
[0x18 - 0x1B] tiltY: float32 (4 bytes)
[0x1C - 0x23] timestamp_us: uint64_t (8 bytes)
```

This guarantees high serialization performance, zero GC pause, memory-mapped I/O (`mmap`) compatibility, and strict backward/forward compatibility.
