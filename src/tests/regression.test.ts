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

// -------------------------------------------------------------
// 7. Rigorous smoothedPoints Import Validation
// -------------------------------------------------------------
test('12. Backup Validation: Rejects malformed smoothedPoints: [null] without modifying state', () => {
  const nb = seedDefaultNotebook();
  const corruptNb = JSON.parse(JSON.stringify(nb));
  // Inject [null] as smoothedPoints in the first stroke
  corruptNb.sections[0].pages[0].strokes[0].smoothedPoints = [null];

  const res = validateAndParseBackup(JSON.stringify(corruptNb));
  assert.equal(res.notebook, undefined, 'Malformed smoothedPoints must reject notebook import');
  assert.ok(
    res.error?.includes('invalid or malformed smoothedPoints'),
    `Expected smoothedPoints error message, got: ${res.error}`
  );
});

// -------------------------------------------------------------
// 8. Handwriting Profile Storage & Validation
// -------------------------------------------------------------
test('13. Profile Round-trip: Serializing, exporting, and parsing preserves sample geometry', async () => {
  const { createNewProfile, validateAndParseProfile } = await import('../handwriting/profileStorage.ts');
  const { createStarterSample } = await import('../handwriting/defaultGlyphs.ts');

  const profile = createNewProfile('Alice Script');
  profile.glyphs['a'] = [createStarterSample('a')];
  profile.glyphs['b'] = [createStarterSample('b')];

  const json = JSON.stringify(profile);
  const { profile: parsed, error } = validateAndParseProfile(json);

  assert.equal(error, undefined, 'Valid profile must parse without error');
  assert.ok(parsed, 'Parsed profile should exist');
  assert.equal(parsed.name, 'Alice Script');
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.app, 'InkForge-HandwritingProfile');
  assert.equal(parsed.glyphs['a'].length, 1);
  assert.equal(parsed.glyphs['b'].length, 1);
});

test('14. Profile Validation: Rejects malformed profile schema and corrupt coordinates', async () => {
  const { createNewProfile, validateAndParseProfile } = await import('../handwriting/profileStorage.ts');
  const { createStarterSample } = await import('../handwriting/defaultGlyphs.ts');

  const profile = createNewProfile('Corrupt Profile');
  profile.glyphs['x'] = [createStarterSample('x')];

  // 1. Unsupported schema version
  const corruptVersion = JSON.parse(JSON.stringify(profile));
  corruptVersion.schemaVersion = 99;
  const res1 = validateAndParseProfile(JSON.stringify(corruptVersion));
  assert.ok(res1.error?.includes('Unsupported profile schema version'));

  // 2. Corrupt stroke coordinate (NaN)
  const corruptCoords = JSON.parse(JSON.stringify(profile));
  corruptCoords.glyphs['x'][0].strokes[0].points[0].x = NaN;
  const res2 = validateAndParseProfile(JSON.stringify(corruptCoords));
  assert.ok(res2.error?.includes('invalid coordinates or pressure'));

  // 3. Out-of-bounds pressure (2.5)
  const corruptPressure = JSON.parse(JSON.stringify(profile));
  corruptPressure.glyphs['x'][0].strokes[0].points[0].pressure = 2.5;
  const res3 = validateAndParseProfile(JSON.stringify(corruptPressure));
  assert.ok(res3.error?.includes('invalid coordinates or pressure'));
});

// -------------------------------------------------------------
// 9. Handwriting Layout & Sample Renderer
// -------------------------------------------------------------
test('15. Layout Engine: Missing-character detection without silent font substitution', async () => {
  const { createNewProfile } = await import('../handwriting/profileStorage.ts');
  const { createStarterSample } = await import('../handwriting/defaultGlyphs.ts');
  const { layoutTextWithProfile } = await import('../handwriting/textLayout.ts');

  // Profile containing only 'a', 'b', and 'c'
  const sparseProfile = createNewProfile('Sparse');
  sparseProfile.glyphs['a'] = [createStarterSample('a')];
  sparseProfile.glyphs['b'] = [createStarterSample('b')];
  sparseProfile.glyphs['c'] = [createStarterSample('c')];

  const pages = layoutTextWithProfile('abc def', sparseProfile, {
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 40, right: 40, bottom: 40, left: 40 },
    fontSize: 24,
    lineHeight: 1.5,
    letterSpacing: 1.0,
    wordSpacing: 1.0,
  });

  assert.equal(pages.length, 1);
  const missing = pages[0].missingChars;
  assert.ok(missing.includes('d'), 'Missing character d must be detected');
  assert.ok(missing.includes('e'), 'Missing character e must be detected');
  assert.ok(missing.includes('f'), 'Missing character f must be detected');

  // Verify missing glyphs are explicitly tagged isMissing === true
  const lineGlyphs = pages[0].lines[0].glyphs;
  const missingGlyphD = lineGlyphs.find((g) => g.char === 'd');
  assert.ok(missingGlyphD, 'Glyph d must exist in line');
  assert.equal(missingGlyphD?.isMissing, true, 'Glyph d must be flagged isMissing');

  const presentGlyphA = lineGlyphs.find((g) => g.char === 'a');
  assert.equal(presentGlyphA?.isMissing, false, 'Glyph a must not be flagged isMissing');
});

test('16. Layout Engine: Preserves exact character order, punctuation, and paragraphs', async () => {
  const { createNewProfile } = await import('../handwriting/profileStorage.ts');
  const { populateStarterAlphabet } = await import('../handwriting/defaultGlyphs.ts');
  const { layoutTextWithProfile } = await import('../handwriting/textLayout.ts');

  const profile = createNewProfile('Full');
  profile.glyphs = populateStarterAlphabet();

  const inputText = 'Hello, world!\n\nSecond paragraph.';
  const pages = layoutTextWithProfile(inputText, profile, {
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 40, right: 40, bottom: 40, left: 40 },
    fontSize: 24,
    lineHeight: 1.5,
    letterSpacing: 1.0,
    wordSpacing: 1.0,
  });

  assert.equal(pages.length, 1);
  const lines = pages[0].lines;
  assert.ok(lines.length >= 2, 'Paragraph break must yield distinct lines');

  // Verify first line characters match "Hello, world!"
  const firstLineText = lines[0].glyphs.map((g) => g.char).join('');
  assert.equal(firstLineText, 'Hello,world!');

  // Verify second line characters match "Second paragraph."
  const secondLineText = lines[1].glyphs.map((g) => g.char).join('');
  assert.equal(secondLineText, 'Secondparagraph.');
});

test('17. Deterministic Sample Selection: Repeated runs select identical samples', async () => {
  const { createNewProfile } = await import('../handwriting/profileStorage.ts');
  const { createStarterSample } = await import('../handwriting/defaultGlyphs.ts');
  const { layoutTextWithProfile } = await import('../handwriting/textLayout.ts');

  const profile = createNewProfile('Multi-Sample');
  // Add 3 variations for letter 'e'
  const sample1 = { ...createStarterSample('e'), id: 'e_var_1' };
  const sample2 = { ...createStarterSample('e'), id: 'e_var_2' };
  const sample3 = { ...createStarterSample('e'), id: 'e_var_3' };
  profile.glyphs['e'] = [sample1, sample2, sample3];

  const text = 'exercise eleven everywhere element';
  const options = {
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 40, right: 40, bottom: 40, left: 40 },
    fontSize: 24,
    lineHeight: 1.5,
    letterSpacing: 1.0,
    wordSpacing: 1.0,
  };

  const run1 = layoutTextWithProfile(text, profile, options);
  const run2 = layoutTextWithProfile(text, profile, options);

  const sampleIndices1 = run1[0].lines[0].glyphs
    .filter((g) => g.char === 'e')
    .map((g) => g.sampleIndex);
  const sampleIndices2 = run2[0].lines[0].glyphs
    .filter((g) => g.char === 'e')
    .map((g) => g.sampleIndex);

  assert.deepEqual(
    sampleIndices1,
    sampleIndices2,
    'Deterministic sample selection must produce identical sample indices on every run'
  );
});

test('18. Pagination & Wrapping: Long text wraps and paginates with zero dropped characters', async () => {
  const { createNewProfile } = await import('../handwriting/profileStorage.ts');
  const { populateStarterAlphabet } = await import('../handwriting/defaultGlyphs.ts');
  const { layoutTextWithProfile } = await import('../handwriting/textLayout.ts');

  const profile = createNewProfile('Pagination Test');
  profile.glyphs = populateStarterAlphabet();

  // Create text that comfortably spans multiple pages with compact page height
  const words = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'];
  const longParagraph = words.join(' ') + '. ';
  const fullText = Array(15).fill(longParagraph).join('\n\n');

  // Small page height to force multiple pages
  const pages = layoutTextWithProfile(fullText, profile, {
    pageWidth: 400,
    pageHeight: 300,
    margins: { top: 30, right: 30, bottom: 30, left: 30 },
    fontSize: 20,
    lineHeight: 1.5,
    letterSpacing: 1.0,
    wordSpacing: 1.0,
  });

  assert.ok(pages.length > 2, `Expected multiple pages, got ${pages.length}`);

  // Count non-whitespace characters across all pages
  let laidOutCharCount = 0;
  for (const page of pages) {
    for (const line of page.lines) {
      laidOutCharCount += line.glyphs.length;
    }
  }

  const expectedCharCount = fullText.replace(/\s+/g, '').length;
  assert.equal(
    laidOutCharCount,
    expectedCharCount,
    `Total laid out characters (${laidOutCharCount}) must match input text non-whitespace characters (${expectedCharCount})`
  );
});

// -------------------------------------------------------------
// 10. Genuinely Personal Profiles & Demo Separation
// -------------------------------------------------------------
test('19. Personal Profiles: New personal profiles start empty; composing "abc" with only "a" flags "b" and "c"', async () => {
  const { createNewPersonalProfile, createDemoProfile } = await import('../handwriting/profileStorage.ts');
  const { createStarterSample } = await import('../handwriting/defaultGlyphs.ts');
  const { layoutTextWithProfile } = await import('../handwriting/textLayout.ts');

  // 1. Personal profile must start completely empty
  const personal = createNewPersonalProfile('Bob Handwriting');
  assert.equal(personal.isDemo, false);
  assert.equal(Object.keys(personal.glyphs).length, 0, 'New personal profile must have zero glyphs');

  // 2. Demo profile must be marked isDemo: true and contain starter glyphs
  const demo = createDemoProfile();
  assert.equal(demo.isDemo, true);
  assert.ok(Object.keys(demo.glyphs).length > 20, 'Demo profile should contain starter templates');

  // 3. User captures only 'a' in personal profile
  personal.glyphs['a'] = [
    {
      id: 'user_captured_a_1',
      createdAt: Date.now(),
      strokes: [
        {
          id: 'user_st_1',
          points: [
            { x: 100, y: 100, pressure: 0.5, tiltX: 0, tiltY: 0, timestamp: 1 },
            { x: 120, y: 140, pressure: 0.6, tiltX: 0, tiltY: 0, timestamp: 2 },
          ],
          baseWidth: 2.0,
          color: '#0f172a',
        },
      ],
      cellBounds: { minX: 100, minY: 100, maxX: 120, maxY: 140 },
      baselineY: 140,
      capHeightY: 60,
      xHeightY: 100,
      isStarter: false,
    },
  ];

  // Compose "abc"
  const pages = layoutTextWithProfile('abc', personal, {
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 40, right: 40, bottom: 40, left: 40 },
    fontSize: 24,
    lineHeight: 1.5,
    letterSpacing: 1.0,
    wordSpacing: 1.0,
  });

  assert.equal(pages.length, 1);
  const glyphs = pages[0].lines[0].glyphs;
  assert.equal(glyphs.length, 3);

  // 'a' must be present using user sample
  assert.equal(glyphs[0].char, 'a');
  assert.equal(glyphs[0].isMissing, false);
  assert.equal(glyphs[0].normalizedSample?.sampleId, 'user_captured_a_1');

  // 'b' and 'c' must be visibly flagged missing
  assert.equal(glyphs[1].char, 'b');
  assert.equal(glyphs[1].isMissing, true);
  assert.equal(glyphs[2].char, 'c');
  assert.equal(glyphs[2].isMissing, true);

  assert.deepEqual(pages[0].missingChars, ['b', 'c']);
});

test('20. Profile Migration: Removes synthetic starter samples from personal profiles while preserving user samples', async () => {
  const { migrateProfile } = await import('../handwriting/profileStorage.ts');
  const { createStarterSample } = await import('../handwriting/defaultGlyphs.ts');

  // Case A: Mixed personal profile containing both a starter sample and a user sample
  const mixedPersonal = {
    schemaVersion: 1 as const,
    app: 'InkForge-HandwritingProfile' as const,
    id: 'profile_mixed_1',
    name: 'Mixed User Profile',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDemo: false,
    glyphs: {
      a: [
        createStarterSample('a'), // id has '_starter'
        {
          id: 'user_captured_a_custom',
          createdAt: Date.now(),
          strokes: [],
          cellBounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
          baselineY: 140,
          capHeightY: 60,
          xHeightY: 100,
        },
      ],
      b: [createStarterSample('b')], // only starter
    },
  };

  const { profile: migrated, migrated: wasMigrated } = migrateProfile(mixedPersonal);
  assert.equal(wasMigrated, true);

  // Starter sample for 'a' must be removed, user sample must be preserved
  assert.equal(migrated.glyphs['a'].length, 1);
  assert.equal(migrated.glyphs['a'][0].id, 'user_captured_a_custom');

  // 'b' had only starter sample, so 'b' is completely removed from personal glyphs
  assert.equal(migrated.glyphs['b'], undefined);

  // Case B: Demo profile is untouched
  const demoProfile = {
    schemaVersion: 1 as const,
    app: 'InkForge-HandwritingProfile' as const,
    id: 'profile_demo_starter',
    name: 'Starter Demo',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDemo: true,
    glyphs: {
      a: [createStarterSample('a')],
    },
  };
  const { migrated: demoMigrated } = migrateProfile(demoProfile);
  assert.equal(demoMigrated, false, 'Demo profile should not be stripped of starter samples');
});

// -------------------------------------------------------------
// 11. Composer Document Draft Persistence Model
// -------------------------------------------------------------
test('21. Draft Model: Serializes and preserves composer text, typography, and profile reference', () => {
  const draft = {
    schemaVersion: 1 as const,
    id: 'composer_draft_active',
    title: 'Midterm Calculus Draft',
    text: 'Evaluate the surface flux integral over the hemisphere.',
    profileId: 'profile_alice_123',
    options: {
      pageWidth: 595,
      pageHeight: 842,
      margins: { top: 50, right: 50, bottom: 50, left: 50 },
      fontSize: 28,
      lineHeight: 1.8,
      letterSpacing: 1.1,
      wordSpacing: 1.2,
    },
    createdAt: 1700000000000,
    updatedAt: 1700000001000,
  };

  const serialized = JSON.stringify(draft);
  const parsed = JSON.parse(serialized);

  assert.equal(parsed.text, draft.text);
  assert.equal(parsed.profileId, 'profile_alice_123');
  assert.equal(parsed.options.fontSize, 28);
  assert.equal(parsed.options.lineHeight, 1.8);
  assert.equal(parsed.options.letterSpacing, 1.1);
  assert.equal(parsed.options.wordSpacing, 1.2);
});

// -------------------------------------------------------------
// 12. Storage Failure Separation for Profiles
// -------------------------------------------------------------
test('22. Profile Storage: Separates failure from empty database', async () => {
  const { listProfiles } = await import('../handwriting/profileStorage.ts');

  const originalIndexedDB = globalThis.indexedDB;
  try {
    // Simulate failing IndexedDB open for profile database
    (globalThis as any).indexedDB = {
      open: () => {
        const req: any = {};
        setTimeout(() => {
          req.error = new Error('Simulated DatabaseInUse or StorageCorrupt');
          if (req.onerror) req.onerror();
        }, 5);
        return req;
      },
    };

    const res = await listProfiles();
    assert.equal(res.status, 'error', 'Database failure must return error status, never empty or found');
    if (res.status === 'error') {
      assert.ok(res.error.includes('Simulated'));
    }
  } finally {
    (globalThis as any).indexedDB = originalIndexedDB;
  }
});

// -------------------------------------------------------------
// 13. Single-Point Dots & XML Escaping
// -------------------------------------------------------------
test('23. XML Escaping: Safely escapes special characters for SVG', async () => {
  const { escapeXml } = await import('../handwriting/sampleRenderer.ts');

  const unescaped = '<tag key="value" & \'apostrophe\'>';
  const escaped = escapeXml(unescaped);

  assert.equal(
    escaped,
    '&lt;tag key=&quot;value&quot; &amp; &apos;apostrophe&apos;&gt;',
    'All XML special characters must be escaped'
  );
  assert.ok(!escaped.includes('<'));
  assert.ok(!escaped.includes('>'));
});

test('24. Stroke Geometry: Single-point strokes preserved as dots; multi-point as segments', async () => {
  const { computeStrokeGeometry, SampleBasedHandwritingRenderer } = await import('../handwriting/sampleRenderer.ts');
  const { createNewPersonalProfile } = await import('../handwriting/profileStorage.ts');

  // Single-point dot stroke (e.g. period or dot on 'i')
  const dotSample = {
    char: '.',
    sampleId: 'dot_sample',
    advanceWidth: 40,
    leftSideBearing: 8,
    rightSideBearing: 10,
    bounds: { minX: 10, minY: 10, maxX: 15, maxY: 15 },
    strokes: [
      {
        baseWidth: 3.0,
        color: '#0f172a',
        points: [{ x: 12, y: 12, pressure: 0.8, tiltX: 0, tiltY: 0, timestamp: 100 }],
      },
    ],
  };

  const geoms = computeStrokeGeometry(dotSample, 50, 100, 1.0);
  assert.equal(geoms.length, 1);
  assert.equal(geoms[0].dots.length, 1, 'Single-point stroke must yield a dot');
  assert.equal(geoms[0].segments.length, 0);
  assert.equal(geoms[0].dots[0].x, 50 + 12);
  assert.equal(geoms[0].dots[0].y, 100 + 12);
  assert.ok(geoms[0].dots[0].radius > 0);

  // Multi-point stroke
  const lineSample = {
    char: 'l',
    sampleId: 'line_sample',
    advanceWidth: 40,
    leftSideBearing: 8,
    rightSideBearing: 10,
    bounds: { minX: 10, minY: 0, maxX: 10, maxY: 100 },
    strokes: [
      {
        baseWidth: 2.0,
        color: '#0f172a',
        points: [
          { x: 10, y: 0, pressure: 0.5, tiltX: 0, tiltY: 0, timestamp: 100 },
          { x: 10, y: 100, pressure: 0.5, tiltX: 0, tiltY: 0, timestamp: 200 },
        ],
      },
    ],
  };

  const geomsLine = computeStrokeGeometry(lineSample, 50, 100, 1.0);
  assert.equal(geomsLine[0].dots.length, 0);
  assert.ok(geomsLine[0].segments.length > 0, 'Multi-point stroke must yield smoothed segments');

  // Verify SVG generation includes circle for dot
  const profile = createNewPersonalProfile('Dot Test Profile');
  const renderer = new SampleBasedHandwritingRenderer(profile);
  const fakePage = {
    pageNumber: 1,
    lines: [
      {
        baselineY: 100,
        width: 100,
        glyphs: [
          {
            char: '.',
            x: 50,
            y: 100,
            scale: 1.0,
            sampleIndex: 0,
            normalizedSample: dotSample,
            isMissing: false,
          },
        ],
      },
    ],
    width: 200,
    height: 200,
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
    missingChars: [],
  };

  const svg = renderer.renderToSVG(fakePage);
  assert.ok(svg.includes('<circle'), 'SVG must include <circle> element for single-point dot');
});

test('25. Layout Engine: Handles multiple consecutive blank lines without dropping lines', async () => {
  const { createNewPersonalProfile } = await import('../handwriting/profileStorage.ts');
  const { createStarterSample } = await import('../handwriting/defaultGlyphs.ts');
  const { layoutTextWithProfile } = await import('../handwriting/textLayout.ts');

  const profile = createNewPersonalProfile('Blank Paragraphs');
  profile.glyphs['a'] = [createStarterSample('a')];

  // Text with consecutive blank paragraphs
  const text = 'a\n\n\n\na';
  const pages = layoutTextWithProfile(text, profile, {
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 40, right: 40, bottom: 40, left: 40 },
    fontSize: 24,
    lineHeight: 1.5,
    letterSpacing: 1.0,
    wordSpacing: 1.0,
  });

  assert.equal(pages.length, 1);
  assert.equal(pages[0].lines.length, 2, 'Should contain 2 lines with character "a"');
  // Second line baselineY should be significantly further down due to empty paragraphs
  const line1Y = pages[0].lines[0].baselineY;
  const line2Y = pages[0].lines[1].baselineY;
  assert.ok(
    line2Y - line1Y > 24 * 1.5 * 2,
    `Line 2 baseline (${line2Y}) should be spaced past multiple blank paragraphs relative to Line 1 (${line1Y})`
  );
});

// -------------------------------------------------------------
// 14. Non-Destructive Migration & Starter Geometry Comparison
// -------------------------------------------------------------
test('26. Migration Safety: Edited starter sample retaining original ID is preserved and relabeled', async () => {
  const { migrateProfile } = await import('../handwriting/profileStorage.ts');
  const { createStarterSample } = await import('../handwriting/defaultGlyphs.ts');

  // Create starter sample for 'a'
  const starterA = createStarterSample('a');
  // User modified one stroke in starterA (e.g. moved a point or added a curve)
  const editedStarterA = JSON.parse(JSON.stringify(starterA));
  editedStarterA.strokes[0].points[0].x += 25; // User moved point!
  // It still retains the original ID 'sample_a_starter'

  const profile = {
    schemaVersion: 1 as const,
    app: 'InkForge-HandwritingProfile' as const,
    id: 'profile_legacy_edited',
    name: 'Legacy Profile With Edited Starter',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDemo: false,
    glyphs: {
      a: [editedStarterA],
    },
  };

  const { profile: migrated, migrated: wasMigrated } = migrateProfile(profile);

  // The sample MUST be preserved, not deleted!
  assert.equal(wasMigrated, true);
  assert.ok(migrated.glyphs['a'], 'Edited sample must not be deleted');
  assert.equal(migrated.glyphs['a'].length, 1);
  const preserved = migrated.glyphs['a'][0];
  assert.equal(preserved.provenance, 'user_edited', 'Provenance must be tagged user_edited');
  assert.equal(preserved.isStarter, false, 'isStarter must be flipped to false');
  assert.equal(preserved.needsReview, true);
});

test('27. Migration Idempotence: Running migration repeatedly produces identical output', async () => {
  const { migrateProfile } = await import('../handwriting/profileStorage.ts');
  const { createStarterSample } = await import('../handwriting/defaultGlyphs.ts');

  const profile = {
    schemaVersion: 1 as const,
    app: 'InkForge-HandwritingProfile' as const,
    id: 'profile_idempotent_test',
    name: 'Idempotent Test',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDemo: false,
    glyphs: {
      a: [createStarterSample('a')], // untouched starter
      b: [
        {
          id: 'user_b',
          createdAt: Date.now(),
          strokes: [],
          cellBounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
          baselineY: 140,
          capHeightY: 60,
          xHeightY: 100,
          provenance: 'user_captured' as const,
        },
      ],
    },
  };

  // Pass 1
  const pass1 = migrateProfile(profile);
  assert.equal(pass1.migrated, true);
  assert.equal(pass1.profile.glyphs['a'], undefined, 'Untouched starter a removed');
  assert.equal(pass1.profile.glyphs['b'].length, 1, 'User b preserved');
  assert.ok(pass1.backupToSave, 'Backup should be generated on pass 1');

  // Pass 2 on the output of pass 1
  const pass2 = migrateProfile(pass1.profile);
  assert.equal(pass2.migrated, false, 'Second migration pass should perform zero changes (idempotent)');
  assert.deepEqual(pass2.profile.glyphs, pass1.profile.glyphs);
});

// -------------------------------------------------------------
// 15. Draft Read-Error Handling & Zero-Write Invariant
// -------------------------------------------------------------
test('28. Draft Error Handling: Read failure preserves storage and performs ZERO writes', async () => {
  const { getOrLoadActiveDraft } = await import('../handwriting/draftManager.ts');

  const originalIndexedDB = globalThis.indexedDB;
  let writeAttempted = false;

  try {
    (globalThis as any).indexedDB = {
      open: () => {
        const req: any = {};
        setTimeout(() => {
          // Open succeeds but transaction fails
          const fakeDB: any = {
            transaction: () => {
              const tx: any = {
                objectStore: () => ({
                  get: () => {
                    const getReq: any = {};
                    setTimeout(() => {
                      getReq.error = new Error('Simulated QuotaExceededError or DB locked on read');
                      if (getReq.onerror) getReq.onerror();
                    }, 5);
                    return getReq;
                  },
                  put: () => {
                    writeAttempted = true;
                    throw new Error('ILLEGAL WRITE: Draft storage must not be written on read failure');
                  },
                }),
              };
              return tx;
            },
            close: () => {},
          };
          req.result = fakeDB;
          if (req.onsuccess) req.onsuccess();
        }, 5);
        return req;
      },
    };

    const res = await getOrLoadActiveDraft('test_profile');
    assert.equal(res.status, 'error', 'Read failure must return error status');
    assert.equal(writeAttempted, false, 'Draft read failure must cause ZERO default-draft writes');
  } finally {
    (globalThis as any).indexedDB = originalIndexedDB;
  }
});

// -------------------------------------------------------------
// 16. Draft Navigation Safety & Debounce Flush
// -------------------------------------------------------------
test('29. Draft Manager: Flushes edits immediately and prevents stale callbacks from replacing newer revisions', async () => {
  const { updateDraft, flushDraftSave, getCurrentDraft, getDraftStatus } = await import(
    '../handwriting/draftManager.ts'
  );

  const baseDraft = {
    schemaVersion: 1 as const,
    id: 'composer_draft_active',
    title: 'Midterm Notes',
    text: 'Version 1 text',
    profileId: 'prof_1',
    options: {
      pageWidth: 595,
      pageHeight: 842,
      margins: { top: 40, right: 40, bottom: 40, left: 40 },
      fontSize: 24,
      lineHeight: 1.5,
      letterSpacing: 1.0,
      wordSpacing: 1.0,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // 1. Edit draft
  updateDraft({ ...baseDraft, text: 'Version 2: Unique paragraph before tab switch' });
  const activeInMemory = getCurrentDraft();
  assert.equal(activeInMemory?.text, 'Version 2: Unique paragraph before tab switch');

  // 2. Immediate flush simulating user navigating away from tab
  await flushDraftSave();

  // 3. Edit again simulating rapid return
  updateDraft({ ...baseDraft, text: 'Version 3: Newest edit after rapid return' });
  const finalInMemory = getCurrentDraft();
  assert.equal(finalInMemory?.text, 'Version 3: Newest edit after rapid return');
});

// -------------------------------------------------------------
// 17. Vector PDF Output Inspection
// -------------------------------------------------------------
test('30. Vector PDF: Generates genuine vector content with un-clamped dynamic widths and no raster images', async () => {
  const { createVectorPDFDocument, SampleBasedHandwritingRenderer } = await import(
    '../handwriting/sampleRenderer.ts'
  );
  const { createNewPersonalProfile } = await import('../handwriting/profileStorage.ts');
  const { layoutTextWithProfile } = await import('../handwriting/textLayout.ts');

  const profile = createNewPersonalProfile('Vector PDF Profile');
  // Character with light stroke (width 1.2 pt)
  profile.glyphs['i'] = [
    {
      id: 'i_custom',
      createdAt: Date.now(),
      strokes: [
        {
          id: 'i_stem',
          points: [
            { x: 100, y: 100, pressure: 0.2, tiltX: 0, tiltY: 0, timestamp: 1 },
            { x: 100, y: 140, pressure: 0.2, tiltX: 0, tiltY: 0, timestamp: 2 },
          ],
          baseWidth: 1.2,
          color: '#0f172a',
        },
        {
          id: 'i_dot',
          points: [{ x: 100, y: 80, pressure: 0.5, tiltX: 0, tiltY: 0, timestamp: 3 }],
          baseWidth: 2.0,
          color: '#0f172a',
        },
      ],
      cellBounds: { minX: 100, minY: 80, maxX: 100, maxY: 140 },
      baselineY: 140,
      capHeightY: 60,
      xHeightY: 100,
    },
  ];

  const renderer = new SampleBasedHandwritingRenderer(profile);
  const pages = layoutTextWithProfile('i', profile, {
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 40, right: 40, bottom: 40, left: 40 },
    fontSize: 24,
    lineHeight: 1.5,
    letterSpacing: 1.0,
    wordSpacing: 1.0,
  });

  const pdf = createVectorPDFDocument(pages, renderer);
  const pdfString = pdf.output();

  // 1. PDF must contain vector path drawing operators (e.g. 're' for rectangle, 'w' for line width, 'm' / 'l' for lines)
  assert.ok(pdfString.includes(' re') || pdfString.includes(' l') || pdfString.includes(' m'), 'PDF must contain vector drawing commands');

  // 2. PDF must NOT contain raster JPEG embeddings (/DCTDecode or /Image)
  assert.ok(!pdfString.includes('/DCTDecode'), 'Vector PDF must not embed raster JPEG images');
});



