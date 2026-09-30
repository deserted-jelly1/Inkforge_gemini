import { NotebookData, SectionData, PageData, StrokeData, BackupEnvelope, ToolType, BackgroundPattern } from '../types/inkforge';
import { evaluateCentripetalCatmullRom } from './spline';

const DB_NAME = 'inkforge_db';
const DB_VERSION = 1;
const NOTEBOOK_STORE = 'notebooks';
const METADATA_STORE = 'metadata';
const CURRENT_NOTEBOOK_KEY = 'active_notebook_id';

export type LoadNotebookResult =
  | { status: 'found'; notebook: NotebookData }
  | { status: 'not_found' }
  | { status: 'error'; error: string };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(NOTEBOOK_STORE)) {
        db.createObjectStore(NOTEBOOK_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Loads the active notebook from IndexedDB.
 * Explicitly separates 'not_found' from 'error' so callers never seed or overwrite on read failure.
 */
export async function loadActiveNotebook(): Promise<LoadNotebookResult> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction([METADATA_STORE, NOTEBOOK_STORE], 'readonly');
        const metaStore = tx.objectStore(METADATA_STORE);
        const getMetaReq = metaStore.get(CURRENT_NOTEBOOK_KEY);

        getMetaReq.onsuccess = () => {
          const activeId = getMetaReq.result as string | undefined;
          const nbStore = tx.objectStore(NOTEBOOK_STORE);

          if (activeId) {
            const getNbReq = nbStore.get(activeId);
            getNbReq.onsuccess = () => {
              if (getNbReq.result) {
                resolve({ status: 'found', notebook: getNbReq.result as NotebookData });
              } else {
                // Check if any other notebook exists
                const getAllReq = nbStore.getAll();
                getAllReq.onsuccess = () => {
                  const all = getAllReq.result as NotebookData[];
                  if (all.length > 0) {
                    resolve({ status: 'found', notebook: all[0] });
                  } else {
                    resolve({ status: 'not_found' });
                  }
                };
                getAllReq.onerror = () => {
                  resolve({ status: 'error', error: getAllReq.error?.message || 'Failed reading notebooks' });
                };
              }
            };
            getNbReq.onerror = () => {
              resolve({ status: 'error', error: getNbReq.error?.message || 'Failed reading active notebook' });
            };
          } else {
            const getAllReq = nbStore.getAll();
            getAllReq.onsuccess = () => {
              const all = getAllReq.result as NotebookData[];
              if (all.length > 0) {
                resolve({ status: 'found', notebook: all[0] });
              } else {
                resolve({ status: 'not_found' });
              }
            };
            getAllReq.onerror = () => {
              resolve({ status: 'error', error: getAllReq.error?.message || 'Failed reading notebooks' });
            };
          }
        };

        getMetaReq.onerror = () => {
          resolve({ status: 'error', error: getMetaReq.error?.message || 'Failed reading metadata store' });
        };

        tx.onerror = () => {
          resolve({ status: 'error', error: tx.error?.message || 'Transaction error while loading notebook' });
        };
      } catch (txErr: any) {
        resolve({ status: 'error', error: txErr?.message || 'Failed creating read transaction' });
      }
    });
  } catch (err: any) {
    return { status: 'error', error: err?.message || 'Failed to initialize IndexedDB' };
  }
}

/**
 * Saves active notebook into IndexedDB with transactional guarantee.
 */
export async function saveActiveNotebook(notebook: NotebookData): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([NOTEBOOK_STORE, METADATA_STORE], 'readwrite');
      const nbStore = tx.objectStore(NOTEBOOK_STORE);
      const metaStore = tx.objectStore(METADATA_STORE);

      nbStore.put(notebook);
      metaStore.put(notebook.id, CURRENT_NOTEBOOK_KEY);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Transaction failed'));
      tx.onabort = () => reject(new Error('Transaction aborted'));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Creates rich starter notebook for first-time use.
 * Only called when loadActiveNotebook returns status === 'not_found'.
 */
export function seedDefaultNotebook(): NotebookData {
  const stroke1Pts = [
    { x: 140, y: 195, pressure: 0.45, tiltX: 0, tiltY: 0, timestamp: 1000 },
    { x: 165, y: 200, pressure: 0.65, tiltX: 0, tiltY: 0, timestamp: 1010 },
    { x: 195, y: 192, pressure: 0.75, tiltX: 0, tiltY: 0, timestamp: 1020 },
    { x: 225, y: 185, pressure: 0.55, tiltX: 0, tiltY: 0, timestamp: 1030 },
    { x: 260, y: 180, pressure: 0.40, tiltX: 0, tiltY: 0, timestamp: 1040 },
  ];

  const stroke2Pts = [
    { x: 200, y: 195, pressure: 0.50, tiltX: 0, tiltY: 0, timestamp: 1050 },
    { x: 198, y: 230, pressure: 0.75, tiltX: 0, tiltY: 0, timestamp: 1060 },
    { x: 194, y: 265, pressure: 0.85, tiltX: 0, tiltY: 0, timestamp: 1070 },
    { x: 188, y: 295, pressure: 0.45, tiltX: 0, tiltY: 0, timestamp: 1080 },
  ];

  const s1: StrokeData = {
    id: 'seed_stroke_1',
    tool: 'pen',
    color: '#1d4ed8',
    baseWidth: 2.2,
    opacity: 1.0,
    points: stroke1Pts,
    smoothedPoints: evaluateCentripetalCatmullRom(stroke1Pts, 8),
    bounds: { minX: 140, minY: 180, maxX: 260, maxY: 200 },
  };

  const s2: StrokeData = {
    id: 'seed_stroke_2',
    tool: 'pen',
    color: '#1d4ed8',
    baseWidth: 2.2,
    opacity: 1.0,
    points: stroke2Pts,
    smoothedPoints: evaluateCentripetalCatmullRom(stroke2Pts, 8),
    bounds: { minX: 188, minY: 195, maxX: 200, maxY: 295 },
  };

  const page1Id = 'page_surface_integrals';
  const page2Id = 'page_complex_analysis';
  const page3Id = 'page_quick_notes';
  const page4Id = 'page_research_benchmarks';

  const secMathId = 'sec_mathematics';
  const secQuickId = 'sec_quick';
  const secResearchId = 'sec_research';

  const page1: PageData = {
    id: page1Id,
    title: "Calculus III — Surface Integrals & Stokes' Theorem",
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now(),
    backgroundPattern: 'lined',
    gridSpacing: 28,
    viewport: { zoom: 1.0, panX: 0, panY: 0 },
    strokes: [s1, s2],
    textNotes: [
      {
        id: 'note_calc_welcome',
        x: 130,
        y: 330,
        width: 440,
        text: '• Write naturally using your stylus, pen tablet, or mouse.\n• Click "Type" or click anywhere on the page to insert movable text containers.\n• Use the Page History button to inspect and rewind every edit.',
      },
    ],
  };

  const page2: PageData = {
    id: page2Id,
    title: 'Residue Theorem & Contour Integration',
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now(),
    backgroundPattern: 'grid',
    gridSpacing: 24,
    viewport: { zoom: 1.0, panX: 0, panY: 0 },
    strokes: [],
    textNotes: [
      {
        id: 'note_contour',
        x: 120,
        y: 180,
        width: 420,
        text: '∮_C f(z) dz = 2πi ∑ Res(f, a_k)\n\nNotes on simple poles vs essential singularities:',
      },
    ],
  };

  const mathSection: SectionData = {
    id: secMathId,
    title: 'Mathematics',
    color: '#0284c7',
    pages: [page1, page2],
  };

  const quickNotesSection: SectionData = {
    id: secQuickId,
    title: 'Quick Notes',
    color: '#7c3aed',
    pages: [
      {
        id: page3Id,
        title: 'InkForge Engine Milestones',
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now(),
        backgroundPattern: 'lined',
        gridSpacing: 28,
        viewport: { zoom: 1.0, panX: 0, panY: 0 },
        strokes: [],
        textNotes: [
          {
            id: 'note_q1',
            x: 100,
            y: 180,
            width: 380,
            text: '✓ Sub-pixel Catmull-Rom pressure spline rendering\n✓ Segment-based collision eraser\n✓ Local-first IndexedDB persistence with versioned backups',
          },
        ],
      },
    ],
  };

  const researchSection: SectionData = {
    id: secResearchId,
    title: 'Research',
    color: '#059669',
    pages: [
      {
        id: page4Id,
        title: 'Digital Inking Latency Benchmarks',
        createdAt: Date.now() - 172800000,
        updatedAt: Date.now(),
        backgroundPattern: 'lined',
        gridSpacing: 28,
        viewport: { zoom: 1.0, panX: 0, panY: 0 },
        strokes: [],
        textNotes: [
          {
            id: 'note_res1',
            x: 100,
            y: 180,
            width: 420,
            text: 'Target input-to-photon latency: < 16ms (60Hz) / < 8ms (120Hz).\nRaw PointerEvent coalesced sampling tested at 120Hz-240Hz on active styluses.',
          },
        ],
      },
    ],
  };

  return {
    id: 'nb_inkforge_primary',
    title: 'Study & Research Notebook',
    color: '#4f46e5',
    createdAt: Date.now() - 604800000,
    updatedAt: Date.now(),
    sections: [mathSection, quickNotesSection, researchSection],
    activeSectionId: secMathId,
    activePageId: page1Id,
  };
}

const VALID_TOOLS: Set<ToolType> = new Set(['pen', 'highlighter', 'eraser', 'pan', 'text']);
const VALID_PATTERNS: Set<BackgroundPattern> = new Set(['lined', 'grid', 'dotgrid', 'blank']);

/**
 * Rigorously validates and parses backup JSON without mutating existing state.
 * Validates schema version, unique IDs, finite coordinates, pressure, widths,
 * bounds, viewport values, paper spacing, and text-note fields.
 */
export function validateAndParseBackup(jsonString: string): { notebook?: NotebookData; error?: string } {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: any) {
    return { error: `Invalid JSON syntax: ${err.message}` };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { error: 'Backup root must be an object.' };
  }

  // Check schema version if envelope
  if ('schemaVersion' in parsed) {
    if (parsed.schemaVersion !== 2) {
      return { error: `Unsupported schema version "${parsed.schemaVersion}". Supported version is 2.` };
    }
    if (parsed.app !== 'InkForge') {
      return { error: `Invalid backup application signature "${parsed.app}". Expected "InkForge".` };
    }
  }

  const rawNotebook = parsed.notebook ? parsed.notebook : parsed;

  if (!rawNotebook || typeof rawNotebook !== 'object') {
    return { error: 'Missing notebook payload in backup file.' };
  }

  if (typeof rawNotebook.id !== 'string' || !rawNotebook.id.trim()) {
    return { error: 'Notebook missing valid string "id".' };
  }

  if (typeof rawNotebook.title !== 'string' || !rawNotebook.title.trim()) {
    return { error: 'Notebook missing or empty "title".' };
  }

  if (!Array.isArray(rawNotebook.sections) || rawNotebook.sections.length === 0) {
    return { error: 'Notebook must contain a non-empty "sections" array.' };
  }

  const sectionIdSet = new Set<string>();
  const pageIdSet = new Set<string>();

  for (let sIdx = 0; sIdx < rawNotebook.sections.length; sIdx++) {
    const sec = rawNotebook.sections[sIdx];
    if (!sec || typeof sec !== 'object') {
      return { error: `Section at index ${sIdx} is not a valid object.` };
    }
    if (typeof sec.id !== 'string' || !sec.id.trim()) {
      return { error: `Section at index ${sIdx} has invalid or missing "id".` };
    }
    if (sectionIdSet.has(sec.id)) {
      return { error: `Duplicate section ID detected: "${sec.id}".` };
    }
    sectionIdSet.add(sec.id);

    if (typeof sec.title !== 'string' || !sec.title.trim()) {
      return { error: `Section "${sec.id}" has invalid or missing "title".` };
    }

    if (!Array.isArray(sec.pages) || sec.pages.length === 0) {
      return { error: `Section "${sec.title}" must contain at least one page.` };
    }

    for (let pIdx = 0; pIdx < sec.pages.length; pIdx++) {
      const page = sec.pages[pIdx];
      if (!page || typeof page !== 'object') {
        return { error: `Page at index ${pIdx} in section "${sec.title}" is not an object.` };
      }
      if (typeof page.id !== 'string' || !page.id.trim()) {
        return { error: `Page at index ${pIdx} in section "${sec.title}" has invalid "id".` };
      }
      if (pageIdSet.has(page.id)) {
        return { error: `Duplicate page ID detected across notebook: "${page.id}".` };
      }
      pageIdSet.add(page.id);

      if (typeof page.title !== 'string') {
        return { error: `Page "${page.id}" title must be a string.` };
      }

      // Pattern & Grid Spacing
      if (page.backgroundPattern && !VALID_PATTERNS.has(page.backgroundPattern)) {
        return { error: `Page "${page.title}" has invalid backgroundPattern: "${page.backgroundPattern}".` };
      }
      if (typeof page.gridSpacing !== 'undefined') {
        if (!Number.isFinite(page.gridSpacing) || page.gridSpacing <= 0) {
          return { error: `Page "${page.title}" has non-positive or non-finite gridSpacing: ${page.gridSpacing}.` };
        }
      }

      // Viewport validation
      if (page.viewport) {
        if (
          typeof page.viewport !== 'object' ||
          !Number.isFinite(page.viewport.zoom) ||
          page.viewport.zoom <= 0 ||
          !Number.isFinite(page.viewport.panX) ||
          !Number.isFinite(page.viewport.panY)
        ) {
          return { error: `Page "${page.title}" has invalid viewport parameters.` };
        }
      }

      // Validate Strokes
      if (!Array.isArray(page.strokes)) {
        return { error: `Page "${page.title}" strokes must be an array.` };
      }

      const strokeIdSet = new Set<string>();
      for (let strIdx = 0; strIdx < page.strokes.length; strIdx++) {
        const str = page.strokes[strIdx];
        if (!str || typeof str !== 'object') {
          return { error: `Stroke #${strIdx} on page "${page.title}" is not an object.` };
        }
        if (typeof str.id !== 'string' || !str.id.trim()) {
          return { error: `Stroke #${strIdx} on page "${page.title}" missing valid string "id".` };
        }
        if (strokeIdSet.has(str.id)) {
          return { error: `Duplicate stroke ID "${str.id}" on page "${page.title}".` };
        }
        strokeIdSet.add(str.id);

        if (!VALID_TOOLS.has(str.tool)) {
          return { error: `Stroke "${str.id}" has invalid tool: "${str.tool}".` };
        }
        if (typeof str.color !== 'string' || !str.color.trim()) {
          return { error: `Stroke "${str.id}" has invalid color.` };
        }
        if (!Number.isFinite(str.baseWidth) || str.baseWidth <= 0) {
          return { error: `Stroke "${str.id}" has non-positive or non-finite baseWidth.` };
        }
        if (!Number.isFinite(str.opacity) || str.opacity < 0 || str.opacity > 1) {
          return { error: `Stroke "${str.id}" has opacity outside [0, 1].` };
        }

        // Validate bounds
        if (
          !str.bounds ||
          typeof str.bounds !== 'object' ||
          !Number.isFinite(str.bounds.minX) ||
          !Number.isFinite(str.bounds.minY) ||
          !Number.isFinite(str.bounds.maxX) ||
          !Number.isFinite(str.bounds.maxY) ||
          str.bounds.minX > str.bounds.maxX ||
          str.bounds.minY > str.bounds.maxY
        ) {
          return { error: `Stroke "${str.id}" has invalid or inverted bounds.` };
        }

        // Validate points
        if (!Array.isArray(str.points) || str.points.length === 0) {
          return { error: `Stroke "${str.id}" points array is missing or empty.` };
        }

        for (let ptIdx = 0; ptIdx < str.points.length; ptIdx++) {
          const pt = str.points[ptIdx];
          if (
            !pt ||
            !Number.isFinite(pt.x) ||
            !Number.isFinite(pt.y) ||
            !Number.isFinite(pt.pressure) ||
            pt.pressure < 0 ||
            pt.pressure > 1 ||
            !Number.isFinite(pt.tiltX) ||
            !Number.isFinite(pt.tiltY) ||
            !Number.isFinite(pt.timestamp)
          ) {
            return { error: `Stroke "${str.id}" point #${ptIdx} has non-finite coordinates or out-of-range pressure.` };
          }
        }
      }

      // Validate Text Notes
      if (typeof page.textNotes !== 'undefined') {
        if (!Array.isArray(page.textNotes)) {
          return { error: `Page "${page.title}" textNotes must be an array.` };
        }
        const noteIdSet = new Set<string>();
        for (let nIdx = 0; nIdx < page.textNotes.length; nIdx++) {
          const note = page.textNotes[nIdx];
          if (!note || typeof note !== 'object') {
            return { error: `Text note #${nIdx} on page "${page.title}" is invalid.` };
          }
          if (typeof note.id !== 'string' || !note.id.trim()) {
            return { error: `Text note #${nIdx} on page "${page.title}" missing "id".` };
          }
          if (noteIdSet.has(note.id)) {
            return { error: `Duplicate text note ID "${note.id}" on page "${page.title}".` };
          }
          noteIdSet.add(note.id);

          if (!Number.isFinite(note.x) || !Number.isFinite(note.y)) {
            return { error: `Text note "${note.id}" coordinates must be finite numbers.` };
          }
          if (!Number.isFinite(note.width) || note.width <= 0) {
            return { error: `Text note "${note.id}" width must be a positive finite number.` };
          }
          if (typeof note.text !== 'string') {
            return { error: `Text note "${note.id}" text must be a string.` };
          }
        }
      }
    }
  }

  // Verify activeSectionId and activePageId
  if (typeof rawNotebook.activeSectionId !== 'string' || !sectionIdSet.has(rawNotebook.activeSectionId)) {
    return { error: `activeSectionId "${rawNotebook.activeSectionId}" does not exist in sections.` };
  }

  const activeSec = rawNotebook.sections.find((s: any) => s.id === rawNotebook.activeSectionId)!;
  const activeSecPageIds = new Set(activeSec.pages.map((p: any) => p.id));
  if (typeof rawNotebook.activePageId !== 'string' || !activeSecPageIds.has(rawNotebook.activePageId)) {
    return { error: `activePageId "${rawNotebook.activePageId}" does not exist in section "${activeSec.title}".` };
  }

  const cleanNotebook: NotebookData = {
    id: rawNotebook.id,
    title: rawNotebook.title.trim(),
    color: typeof rawNotebook.color === 'string' ? rawNotebook.color : '#4f46e5',
    createdAt: typeof rawNotebook.createdAt === 'number' && Number.isFinite(rawNotebook.createdAt) ? rawNotebook.createdAt : Date.now(),
    updatedAt: Date.now(),
    sections: rawNotebook.sections,
    activeSectionId: rawNotebook.activeSectionId,
    activePageId: rawNotebook.activePageId,
  };

  return { notebook: cleanNotebook };
}

export function createBackupEnvelope(notebook: NotebookData): BackupEnvelope {
  return {
    schemaVersion: 2,
    app: 'InkForge',
    exportedAt: Date.now(),
    notebook,
  };
}
