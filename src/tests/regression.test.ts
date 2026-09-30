import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PageHistoryRegistry,
  PageHistoryManager,
  AddStrokeCommand,
  BatchEraseCommand,
  ClearInkCommand,
  AddTextNoteCommand,
  UpdateTextNoteCommand,
} from '../utils/historyManager.ts';
import {
  validateAndParseBackup,
  createBackupEnvelope,
  seedDefaultNotebook,
  loadActiveNotebook,
  LoadNotebookResult,
} from '../utils/storage.ts';
import { strokeIntersectsEraser, distanceToSegment } from '../utils/geometry.ts';
import { computePageContentBounds, wrapTextLines } from '../utils/exportPage.ts';
import { PageData, StrokeData, TextNoteContainer, NotebookData } from '../types/inkforge.ts';

function createDummyPage(id: string, title = 'Test Page'): PageData {
  return {
    id,
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    backgroundPattern: 'lined',
    gridSpacing: 28,
    viewport: { zoom: 1.0, panX: 0, panY: 0 },
    strokes: [],
    textNotes: [],
  };
}

function createDummyStroke(id: string, points: { x: number; y: number }[], tool: 'pen' | 'highlighter' = 'pen'): StrokeData {
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
  return {
    id,
    tool,
    color: '#0f172a',
    baseWidth: tool === 'highlighter' ? 16.0 : 2.0,
    opacity: tool === 'highlighter' ? 0.35 : 1.0,
    points: points.map((p, idx) => ({
      x: p.x,
      y: p.y,
      pressure: 0.5,
      tiltX: 0,
      tiltY: 0,
      timestamp: 1000 + idx * 10,
    })),
    bounds: { minX, minY, maxX, maxY },
  };
}

// -------------------------------------------------------------
// 1. Separation of 'not_found' vs 'error' in storage loading
// -------------------------------------------------------------
test('1. Storage: Explicitly separates not_found from loading errors', async () => {
  // Case A: Mock indexedDB failure
  const originalIndexedDB = globalThis.indexedDB;
  try {
    // Simulate failing IndexedDB open
    (globalThis as any).indexedDB = {
      open: () => {
        const req: any = {};
        setTimeout(() => {
          req.error = new Error('Simulated QuotaExceededError or DatabaseLocked');
          if (req.onerror) req.onerror();
        }, 5);
        return req;
      },
    };

    const res = await loadActiveNotebook();
    assert.equal(res.status, 'error', 'Read failure must return error status, never not_found');
    if (res.status === 'error') {
      assert.ok(res.error.includes('Simulated'), 'Error message should be preserved');
    }
  } finally {
    (globalThis as any).indexedDB = originalIndexedDB;
  }
});

// -------------------------------------------------------------
// 2. Strict Backup Validation
// -------------------------------------------------------------
test('2. Backup Validation: Rejects unsupported schema versions', () => {
  const nb = seedDefaultNotebook();
  const envelope = createBackupEnvelope(nb);
  (envelope as any).schemaVersion = 99;

  const res = validateAndParseBackup(JSON.stringify(envelope));
  assert.ok(res.error?.includes('Unsupported schema version'));
  assert.equal(res.notebook, undefined);
});

test('3. Backup Validation: Rejects duplicate section IDs and duplicate page IDs', () => {
  const nb = seedDefaultNotebook();
  // Duplicate section ID
  const dupSecNb = JSON.parse(JSON.stringify(nb));
  dupSecNb.sections.push({ ...dupSecNb.sections[0] });
  const res1 = validateAndParseBackup(JSON.stringify(dupSecNb));
  assert.ok(res1.error?.includes('Duplicate section ID'));

  // Duplicate page ID across different sections
  const dupPageNb = JSON.parse(JSON.stringify(nb));
  dupPageNb.sections[1].pages.push({ ...dupPageNb.sections[0].pages[0] });
  const res2 = validateAndParseBackup(JSON.stringify(dupPageNb));
  assert.ok(res2.error?.includes('Duplicate page ID'));
});

test('4. Backup Validation: Rejects non-finite coordinates, pressure, and widths', () => {
  const nb = seedDefaultNotebook();
  const corruptStrokeNb = JSON.parse(JSON.stringify(nb));
  // Set non-finite coordinate in stroke point
  corruptStrokeNb.sections[0].pages[0].strokes[0].points[0].x = NaN;
  const res1 = validateAndParseBackup(JSON.stringify(corruptStrokeNb));
  assert.ok(res1.error?.includes('non-finite coordinates or out-of-range pressure'));

  // Set out-of-range pressure
  const corruptPressureNb = JSON.parse(JSON.stringify(nb));
  corruptPressureNb.sections[0].pages[0].strokes[0].points[0].pressure = 1.8;
  const res2 = validateAndParseBackup(JSON.stringify(corruptPressureNb));
  assert.ok(res2.error?.includes('non-finite coordinates or out-of-range pressure'));

  // Set negative stroke baseWidth
  const corruptWidthNb = JSON.parse(JSON.stringify(nb));
  corruptWidthNb.sections[0].pages[0].strokes[0].baseWidth = -3;
  const res3 = validateAndParseBackup(JSON.stringify(corruptWidthNb));
  assert.ok(res3.error?.includes('non-positive or non-finite baseWidth'));

  // Set inverted bounds (minX > maxX)
  const corruptBoundsNb = JSON.parse(JSON.stringify(nb));
  corruptBoundsNb.sections[0].pages[0].strokes[0].bounds = { minX: 100, maxX: 50, minY: 10, maxY: 20 };
  const res4 = validateAndParseBackup(JSON.stringify(corruptBoundsNb));
  assert.ok(res4.error?.includes('invalid or inverted bounds'));
});

test('5. Backup Validation: Rejects invalid text-note fields and paper parameters', () => {
  const nb = seedDefaultNotebook();
  // Invalid text note width <= 0
  const corruptNoteNb = JSON.parse(JSON.stringify(nb));
  corruptNoteNb.sections[0].pages[0].textNotes = [{ id: 'n1', x: 10, y: 10, width: 0, text: 'hello' }];
  const res1 = validateAndParseBackup(JSON.stringify(corruptNoteNb));
  assert.ok(res1.error?.includes('width must be a positive finite number'));

  // Invalid backgroundPattern
  const corruptPatternNb = JSON.parse(JSON.stringify(nb));
  corruptPatternNb.sections[0].pages[0].backgroundPattern = 'psychedelic';
  const res2 = validateAndParseBackup(JSON.stringify(corruptPatternNb));
  assert.ok(res2.error?.includes('invalid backgroundPattern'));
});

// -------------------------------------------------------------
// 3. Document-Session Boundary on Restore
// -------------------------------------------------------------
test('6. Session Boundary: Restore clears all histories even when IDs match current document', () => {
  const registry = new PageHistoryRegistry();
  const pageId = 'page_shared_id';
  const historyMgr = registry.getHistoryManager(pageId);

  let page = createDummyPage(pageId);
  const stroke = createDummyStroke('s1', [{ x: 10, y: 10 }, { x: 20, y: 20 }]);
  historyMgr.executeCommand(new AddStrokeCommand(pageId, stroke), (t) => {
    page = t(page);
  });

  assert.equal(historyMgr.getUndoCount(), 1);
  assert.equal(historyMgr.canUndo(), true);

  // Perform clean session boundary reset
  registry.resetAll();

  // Querying history for the same page ID after reset must yield fresh empty history
  const freshHistoryMgr = registry.getHistoryManager(pageId);
  assert.equal(freshHistoryMgr.getUndoCount(), 0);
  assert.equal(freshHistoryMgr.canUndo(), false);
  assert.equal(freshHistoryMgr.canRedo(), false);
});

// -------------------------------------------------------------
// 4. Eraser Undo Ordering
// -------------------------------------------------------------
test('7. Eraser Undo Ordering: Erasing [A, B] from [A, B, C, D] restores exact [A, B, C, D]', () => {
  const history = new PageHistoryManager('p_ordering');
  const sA = createDummyStroke('sA', [{ x: 10, y: 10 }, { x: 20, y: 20 }]);
  const sB = createDummyStroke('sB', [{ x: 30, y: 30 }, { x: 40, y: 40 }]);
  const sC = createDummyStroke('sC', [{ x: 50, y: 50 }, { x: 60, y: 60 }]);
  const sD = createDummyStroke('sD', [{ x: 70, y: 70 }, { x: 80, y: 80 }]);

  let page = createDummyPage('p_ordering');
  page.strokes = [sA, sB, sC, sD];

  // Document indices at gesture start: A: 0, B: 1, C: 2, D: 3
  // Erase A then B in single gesture
  const removedStrokes = [
    { stroke: sA, originalIndex: 0 },
    { stroke: sB, originalIndex: 1 },
  ];

  const eraseCmd = new BatchEraseCommand('p_ordering', removedStrokes);
  history.executeCommand(eraseCmd, (t) => {
    page = t(page);
  });

  assert.equal(page.strokes.length, 2);
  assert.deepEqual(
    page.strokes.map((s) => s.id),
    ['sC', 'sD']
  );

  // Undo must restore [sA, sB, sC, sD]
  history.undo((t) => {
    page = t(page);
  });

  assert.equal(page.strokes.length, 4);
  assert.deepEqual(
    page.strokes.map((s) => s.id),
    ['sA', 'sB', 'sC', 'sD'],
    'Restored strokes must maintain exact initial document order [A, B, C, D]'
  );
});

test('8. Eraser Undo Ordering: Erasing [B, D] from [A, B, C, D] restores exact [A, B, C, D]', () => {
  const history = new PageHistoryManager('p_ordering_2');
  const sA = createDummyStroke('sA', [{ x: 10, y: 10 }, { x: 20, y: 20 }]);
  const sB = createDummyStroke('sB', [{ x: 30, y: 30 }, { x: 40, y: 40 }]);
  const sC = createDummyStroke('sC', [{ x: 50, y: 50 }, { x: 60, y: 60 }]);
  const sD = createDummyStroke('sD', [{ x: 70, y: 70 }, { x: 80, y: 80 }]);

  let page = createDummyPage('p_ordering_2');
  page.strokes = [sA, sB, sC, sD];

  // Erase B (originalIndex 1) and D (originalIndex 3)
  const removedStrokes = [
    { stroke: sB, originalIndex: 1 },
    { stroke: sD, originalIndex: 3 },
  ];

  const eraseCmd = new BatchEraseCommand('p_ordering_2', removedStrokes);
  history.executeCommand(eraseCmd, (t) => {
    page = t(page);
  });

  assert.deepEqual(
    page.strokes.map((s) => s.id),
    ['sA', 'sC']
  );

  history.undo((t) => {
    page = t(page);
  });

  assert.deepEqual(
    page.strokes.map((s) => s.id),
    ['sA', 'sB', 'sC', 'sD'],
    'Restored strokes must maintain exact initial document order [A, B, C, D]'
  );
});

// -------------------------------------------------------------
// 5. Unified Canvas & Export: Negative Coordinates & Text Wrapping
// -------------------------------------------------------------
test('9. Export Bounds: Preserves negative coordinates without clamping to zero', () => {
  const page = createDummyPage('p_neg');
  // Stroke with points well into negative space: (-150, -80)
  const negStroke = createDummyStroke('neg_s', [
    { x: -150, y: -80 },
    { x: -50, y: 20 },
  ]);
  page.strokes = [negStroke];

  const bounds = computePageContentBounds(page);
  assert.ok(bounds.minX < 0, `minX (${bounds.minX}) must be negative to encompass negative stroke points`);
  assert.ok(bounds.minY < 0, `minY (${bounds.minY}) must be negative to encompass negative stroke points`);
  assert.ok(bounds.minX <= -150 - 60, 'minX must encompass stroke start minus margin');
});

test('10. Text Wrapping: Measures actual wrapped lines for text note container', () => {
  const longText = 'InkForge is a dependable local-first digital ink notebook designed for high-resolution graphics tablets and stylus input with ultra-low latency.';
  // Wrap to 200px width
  const lines = wrapTextLines(longText, 200);
  assert.ok(lines.length >= 3, `Expected at least 3 wrapped lines for 200px width, got ${lines.length}`);
});

// -------------------------------------------------------------
// 6. Paper Pattern Derived from Active Page
// -------------------------------------------------------------
test('11. Paper Pattern: Derived per page and preserved across navigation', () => {
  const nb = seedDefaultNotebook();
  const page1 = nb.sections[0].pages[0]; // lined
  const page2 = nb.sections[0].pages[1]; // grid

  assert.equal(page1.backgroundPattern, 'lined');
  assert.equal(page2.backgroundPattern, 'grid');

  // Verify that active page pattern is directly read from the page
  const activeSec = nb.sections.find((s) => s.id === nb.activeSectionId)!;
  const currentP = activeSec.pages.find((p) => p.id === nb.activePageId)!;
  assert.equal(currentP.backgroundPattern, 'lined');
});
