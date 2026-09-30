import { NotebookData, SectionData, PageData, StrokeData, BackupEnvelope } from '../types/inkforge';
import { evaluateCentripetalCatmullRom } from './spline';

const DB_NAME = 'inkforge_db';
const DB_VERSION = 1;
const NOTEBOOK_STORE = 'notebooks';
const METADATA_STORE = 'metadata';
const CURRENT_NOTEBOOK_KEY = 'active_notebook_id';

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
    request.onerror = () => reject(request.error);
  });
}

export async function loadActiveNotebook(): Promise<NotebookData | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
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
              resolve(getNbReq.result as NotebookData);
            } else {
              // Try getting first available notebook if active was not found
              const getAllReq = nbStore.getAll();
              getAllReq.onsuccess = () => {
                const all = getAllReq.result as NotebookData[];
                resolve(all.length > 0 ? all[0] : null);
              };
              getAllReq.onerror = () => resolve(null);
            }
          };
          getNbReq.onerror = () => resolve(null);
        } else {
          const getAllReq = nbStore.getAll();
          getAllReq.onsuccess = () => {
            const all = getAllReq.result as NotebookData[];
            resolve(all.length > 0 ? all[0] : null);
          };
          getAllReq.onerror = () => resolve(null);
        }
      };

      getMetaReq.onerror = () => reject(getMetaReq.error);
    });
  } catch (err) {
    console.error('Failed to load from IndexedDB:', err);
    return null;
  }
}

export async function saveActiveNotebook(notebook: NotebookData): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([NOTEBOOK_STORE, METADATA_STORE], 'readwrite');
    const nbStore = tx.objectStore(NOTEBOOK_STORE);
    const metaStore = tx.objectStore(METADATA_STORE);

    nbStore.put(notebook);
    metaStore.put(notebook.id, CURRENT_NOTEBOOK_KEY);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error('Transaction aborted'));
  });
}

/**
 * Creates rich starter notebook for first-time use.
 * Never called if an existing notebook is found in IndexedDB.
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
    color: '#0284c7', // Sky Blue
    pages: [page1, page2],
  };

  const quickNotesSection: SectionData = {
    id: secQuickId,
    title: 'Quick Notes',
    color: '#7c3aed', // Purple
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
    color: '#059669', // Emerald
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

/**
 * Validates and parses a JSON backup file.
 * Returns either validated NotebookData or an error message.
 */
export function validateAndParseBackup(jsonString: string): { notebook?: NotebookData; error?: string } {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: any) {
    return { error: `Invalid JSON file: ${err.message}` };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { error: 'Backup file root is not an object.' };
  }

  let rawNotebook = parsed;
  // Handle envelope wrapper
  if (parsed.schemaVersion && parsed.notebook) {
    rawNotebook = parsed.notebook;
  }

  if (typeof rawNotebook.title !== 'string' || !rawNotebook.title.trim()) {
    return { error: 'Missing or invalid notebook title.' };
  }

  if (!Array.isArray(rawNotebook.sections) || rawNotebook.sections.length === 0) {
    return { error: 'Notebook must contain at least one section.' };
  }

  // Validate each section
  for (let sIdx = 0; sIdx < rawNotebook.sections.length; sIdx++) {
    const sec = rawNotebook.sections[sIdx];
    if (!sec || typeof sec !== 'object') {
      return { error: `Section at index ${sIdx} is invalid.` };
    }
    if (!sec.id || typeof sec.id !== 'string') {
      sec.id = `sec_${Date.now()}_${sIdx}`;
    }
    if (typeof sec.title !== 'string') {
      sec.title = `Section ${sIdx + 1}`;
    }
    if (typeof sec.color !== 'string') {
      sec.color = '#4f46e5';
    }
    if (!Array.isArray(sec.pages) || sec.pages.length === 0) {
      // Add empty page if none exists
      sec.pages = [
        {
          id: `page_${Date.now()}_${sIdx}`,
          title: 'Untitled page',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          backgroundPattern: 'lined',
          gridSpacing: 28,
          strokes: [],
          textNotes: [],
        },
      ];
    }

    for (let pIdx = 0; pIdx < sec.pages.length; pIdx++) {
      const page = sec.pages[pIdx];
      if (!page || typeof page !== 'object') {
        return { error: `Page at index ${pIdx} in section "${sec.title}" is invalid.` };
      }
      if (!page.id || typeof page.id !== 'string') {
        page.id = `page_${Date.now()}_${sIdx}_${pIdx}`;
      }
      if (typeof page.title !== 'string') {
        page.title = 'Untitled page';
      }
      if (!Array.isArray(page.strokes)) {
        page.strokes = [];
      }
      if (!Array.isArray(page.textNotes)) {
        page.textNotes = [];
      }
      if (!page.backgroundPattern) {
        page.backgroundPattern = 'lined';
      }
      if (!page.gridSpacing) {
        page.gridSpacing = 28;
      }
    }
  }

  // Ensure active IDs point to existing section and page
  const sectionIds = new Set(rawNotebook.sections.map((s: SectionData) => s.id));
  let activeSectionId = rawNotebook.activeSectionId;
  if (!activeSectionId || !sectionIds.has(activeSectionId)) {
    activeSectionId = rawNotebook.sections[0].id;
  }

  const activeSec = rawNotebook.sections.find((s: SectionData) => s.id === activeSectionId)!;
  const pageIds = new Set(activeSec.pages.map((p: PageData) => p.id));
  let activePageId = rawNotebook.activePageId;
  if (!activePageId || !pageIds.has(activePageId)) {
    activePageId = activeSec.pages[0].id;
  }

  const notebook: NotebookData = {
    id: rawNotebook.id && typeof rawNotebook.id === 'string' ? rawNotebook.id : `nb_${Date.now()}`,
    title: rawNotebook.title.trim(),
    color: rawNotebook.color || '#4f46e5',
    createdAt: typeof rawNotebook.createdAt === 'number' ? rawNotebook.createdAt : Date.now(),
    updatedAt: Date.now(),
    sections: rawNotebook.sections,
    activeSectionId,
    activePageId,
  };

  return { notebook };
}

export function createBackupEnvelope(notebook: NotebookData): BackupEnvelope {
  return {
    schemaVersion: 2,
    app: 'InkForge',
    exportedAt: Date.now(),
    notebook,
  };
}
