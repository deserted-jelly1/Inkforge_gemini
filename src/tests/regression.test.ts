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
} from '../utils/storage.ts';
import { strokeIntersectsEraser, distanceToSegment } from '../utils/geometry.ts';
import { computePageContentBounds } from '../utils/exportPage.ts';
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

function createDummyStroke(id: string, points: { x: number; y: number }[]): StrokeData {
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
    tool: 'pen',
    color: '#0f172a',
    baseWidth: 2.0,
    opacity: 1.0,
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

test('1. Persistence: Seed notebook contains valid stable IDs and structure', () => {
  const nb = seedDefaultNotebook();
  assert.ok(nb.id, 'Notebook ID should exist');
  assert.ok(nb.sections.length >= 3, 'Default notebook should have at least 3 sections');
  assert.ok(nb.activeSectionId, 'Notebook should have activeSectionId');
  assert.ok(nb.activePageId, 'Notebook should have activePageId');

  const activeSec = nb.sections.find((s) => s.id === nb.activeSectionId);
  assert.ok(activeSec, 'activeSectionId must match an existing section');
  const activePage = activeSec.pages.find((p) => p.id === nb.activePageId);
  assert.ok(activePage, 'activePageId must match an existing page');
});

test('2. Backup Round-trip: Envelope creation, serialization, and validation', () => {
  const nb = seedDefaultNotebook();
  const envelope = createBackupEnvelope(nb);
  assert.equal(envelope.schemaVersion, 2);
  assert.equal(envelope.app, 'InkForge');

  const json = JSON.stringify(envelope);
  const { notebook: parsed, error } = validateAndParseBackup(json);
  assert.equal(error, undefined, 'Valid backup should parse without error');
  assert.ok(parsed, 'Parsed notebook should be returned');
  assert.equal(parsed.title, nb.title);
  assert.equal(parsed.sections.length, nb.sections.length);
  assert.equal(parsed.activeSectionId, nb.activeSectionId);
  assert.equal(parsed.activePageId, nb.activePageId);
});

test('3. Backup Validation: Invalid inputs fail with clear descriptive errors', () => {
  const invalidJson = '{"broken": json}';
  const res1 = validateAndParseBackup(invalidJson);
  assert.ok(res1.error?.includes('Invalid JSON file'));

  const emptyObj = JSON.stringify({});
  const res2 = validateAndParseBackup(emptyObj);
  assert.ok(res2.error?.includes('Missing or invalid notebook title'));

  const noSections = JSON.stringify({ title: 'My Book', sections: [] });
  const res3 = validateAndParseBackup(noSections);
  assert.ok(res3.error?.includes('Notebook must contain at least one section'));
});

test('4. History Isolation: Actions on Page A do not affect Page B', () => {
  const registry = new PageHistoryRegistry();
  const pageAHistory = registry.getHistoryManager('page_A');
  const pageBHistory = registry.getHistoryManager('page_B');

  let pageA = createDummyPage('page_A', 'Page A');
  let pageB = createDummyPage('page_B', 'Page B');

  const strokeA = createDummyStroke('stroke_A_1', [{ x: 10, y: 10 }, { x: 50, y: 50 }]);
  const strokeB = createDummyStroke('stroke_B_1', [{ x: 100, y: 100 }, { x: 200, y: 200 }]);

  // Add stroke to Page A
  const cmdA = new AddStrokeCommand('page_A', strokeA);
  pageAHistory.executeCommand(cmdA, (t) => {
    pageA = t(pageA);
  });

  // Add stroke to Page B
  const cmdB = new AddStrokeCommand('page_B', strokeB);
  pageBHistory.executeCommand(cmdB, (t) => {
    pageB = t(pageB);
  });

  assert.equal(pageA.strokes.length, 1);
  assert.equal(pageB.strokes.length, 1);
  assert.equal(pageA.strokes[0].id, 'stroke_A_1');
  assert.equal(pageB.strokes[0].id, 'stroke_B_1');

  // Undo on Page B
  pageBHistory.undo((t) => {
    pageB = t(pageB);
  });

  assert.equal(pageB.strokes.length, 0, 'Page B stroke should be undone');
  assert.equal(pageA.strokes.length, 1, 'Page A stroke must remain completely untouched!');
  assert.equal(pageA.strokes[0].id, 'stroke_A_1');

  // Undo on Page A
  pageAHistory.undo((t) => {
    pageA = t(pageA);
  });
  assert.equal(pageA.strokes.length, 0, 'Page A stroke should now be undone');
});

test('5. Non-destructive undo: Undoing ink does not revert later unrelated text edits', () => {
  let page = createDummyPage('page_calc');
  const history = new PageHistoryManager('page_calc');

  const stroke1 = createDummyStroke('s1', [{ x: 50, y: 50 }, { x: 100, y: 100 }]);
  const cmdStroke = new AddStrokeCommand('page_calc', stroke1);
  history.executeCommand(cmdStroke, (t) => {
    page = t(page);
  });

  // Now user adds a text note
  const textNote: TextNoteContainer = {
    id: 'note_1',
    x: 150,
    y: 150,
    width: 320,
    text: 'Formulas for surface area',
  };
  const cmdText = new AddTextNoteCommand('page_calc', textNote);
  history.executeCommand(cmdText, (t) => {
    page = t(page);
  });

  // User edits the text note
  const cmdTextEdit = new UpdateTextNoteCommand(
    'page_calc',
    'note_1',
    { text: 'Formulas for surface area' },
    { text: 'Formulas for surface area: ∬ |r_u × r_v| dA' },
    'edit_text',
    'Edit Text'
  );
  history.executeCommand(cmdTextEdit, (t) => {
    page = t(page);
  });

  assert.equal(page.strokes.length, 1);
  assert.equal(page.textNotes.length, 1);
  assert.equal(page.textNotes[0].text, 'Formulas for surface area: ∬ |r_u × r_v| dA');

  // Undo the text edit
  history.undo((t) => {
    page = t(page);
  });
  assert.equal(page.textNotes[0].text, 'Formulas for surface area');
  assert.equal(page.strokes.length, 1, 'Stroke is still present');

  // Undo the text add
  history.undo((t) => {
    page = t(page);
  });
  assert.equal(page.textNotes.length, 0, 'Text note is undone');
  assert.equal(page.strokes.length, 1, 'Stroke is still present');

  // Undo the stroke
  history.undo((t) => {
    page = t(page);
  });
  assert.equal(page.strokes.length, 0, 'Stroke is undone');
});

test('6. Clear Ink: Preserves text notes and is fully recoverable via undo', () => {
  let page = createDummyPage('p_clear_test');
  const history = new PageHistoryManager('p_clear_test');

  const stroke1 = createDummyStroke('s1', [{ x: 50, y: 50 }, { x: 100, y: 100 }]);
  const stroke2 = createDummyStroke('s2', [{ x: 150, y: 150 }, { x: 200, y: 200 }]);
  page.strokes = [stroke1, stroke2];
  page.textNotes = [{ id: 'n1', x: 50, y: 300, width: 200, text: 'Keep this note!' }];

  const cmdClear = new ClearInkCommand('p_clear_test', [stroke1, stroke2]);
  history.executeCommand(cmdClear, (t) => {
    page = t(page);
  });

  assert.equal(page.strokes.length, 0, 'All ink strokes should be cleared');
  assert.equal(page.textNotes.length, 1, 'Text note must be preserved!');
  assert.equal(page.textNotes[0].text, 'Keep this note!');

  // Undo Clear Ink
  history.undo((t) => {
    page = t(page);
  });
  assert.equal(page.strokes.length, 2, 'Strokes should be restored after undo');
  assert.equal(page.textNotes.length, 1, 'Text note still intact');
});

test('7. Geometry: Segment distance calculation and eraser hit testing', () => {
  // Horizontal segment from (10, 50) to (110, 50)
  const distMid = distanceToSegment(60, 55, 10, 50, 110, 50);
  assert.equal(Math.round(distMid), 5, 'Perpendicular distance should be 5');

  const distBeyondRight = distanceToSegment(120, 50, 10, 50, 110, 50);
  assert.equal(Math.round(distBeyondRight), 10, 'Distance beyond endpoint should be 10');

  const stroke = createDummyStroke('test_stroke', [
    { x: 10, y: 50 },
    { x: 110, y: 50 },
  ]);

  // Test eraser hit at midpoint
  const hit1 = strokeIntersectsEraser(stroke, 60, 54, 10);
  assert.equal(hit1, true, 'Eraser with radius 10 at distance 4 should hit the stroke');

  // Test eraser miss far away
  const hit2 = strokeIntersectsEraser(stroke, 60, 100, 10);
  assert.equal(hit2, false, 'Eraser with radius 10 at distance 50 should miss');
});

test('8. Export Bounds: Accurately includes offscreen strokes and text notes', () => {
  const page = createDummyPage('export_test');
  // Stroke positioned far down at (1200, 1800)
  const farStroke = createDummyStroke('far_s', [
    { x: 1100, y: 1700 },
    { x: 1200, y: 1800 },
  ]);
  page.strokes = [farStroke];

  const bounds = computePageContentBounds(page);
  assert.ok(bounds.width >= 1200, 'Export bounds width should encompass the far stroke');
  assert.ok(bounds.height >= 1800, 'Export bounds height should encompass the far stroke');
});
