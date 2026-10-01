import { ComposerDocument } from './types';
import { loadActiveDraft, saveActiveDraft } from './profileStorage';

export type DraftSaveStatus = 'idle' | 'saving' | 'error';

let currentDraft: ComposerDocument | null = null;
let currentRevision = 0;
let lastSavedRevision = 0;
let saveTimer: any = null;
let currentStatus: DraftSaveStatus = 'idle';
let subscribers = new Set<(draft: ComposerDocument, status: DraftSaveStatus) => void>();

function notify(): void {
  if (!currentDraft) return;
  for (const cb of subscribers) {
    cb(currentDraft, currentStatus);
  }
}

/**
 * Initializes or retrieves the active composer draft.
 * If draft is already held in memory across tab navigation, returns current memory state.
 */
export async function getOrLoadActiveDraft(
  fallbackProfileId = ''
): Promise<{ status: 'found' | 'not_found' | 'error'; draft: ComposerDocument; error?: string }> {
  if (currentDraft) {
    return { status: 'found', draft: currentDraft };
  }

  const loadRes = await loadActiveDraft();

  if (loadRes.status === 'found') {
    currentDraft = loadRes.draft;
    currentRevision = loadRes.draft.revision || 1;
    lastSavedRevision = currentRevision;
    currentStatus = 'idle';
    notify();
    return { status: 'found', draft: currentDraft };
  }

  if (loadRes.status === 'not_found') {
    const freshDraft: ComposerDocument = {
      schemaVersion: 1,
      id: 'composer_draft_active',
      title: 'Handwriting Draft',
      text: `Stokes' Theorem relates the surface integral of the curl of a vector field over a surface to the line integral of the vector field over its boundary curve.

Key formula:
integral_C F . dr = double_integral_S (curl F) . dS

Notes for midterm:
1. Verify orientation of the boundary curve using the right-hand rule.
2. Parametrize the surface carefully before computing the normal vector.`,
      profileId: fallbackProfileId,
      options: {
        pageWidth: 595,
        pageHeight: 842,
        margins: { top: 48, right: 48, bottom: 48, left: 48 },
        fontSize: 24,
        lineHeight: 1.5,
        letterSpacing: 1.0,
        wordSpacing: 1.0,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      revision: 1,
    };

    currentDraft = freshDraft;
    currentRevision = 1;
    lastSavedRevision = 1;
    currentStatus = 'idle';
    // Persist seeded draft only on confirmed not_found
    await saveActiveDraft(freshDraft);
    notify();
    return { status: 'not_found', draft: freshDraft };
  }

  // Load error: preserve storage, do NOT write default draft!
  currentStatus = 'error';
  return {
    status: 'error',
    error: loadRes.error,
    draft: {
      schemaVersion: 1,
      id: 'composer_draft_error',
      title: 'Draft',
      text: '',
      profileId: fallbackProfileId,
      options: {
        pageWidth: 595,
        pageHeight: 842,
        margins: { top: 48, right: 48, bottom: 48, left: 48 },
        fontSize: 24,
        lineHeight: 1.5,
        letterSpacing: 1.0,
        wordSpacing: 1.0,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      revision: 0,
    },
  };
}

export function getCurrentDraft(): ComposerDocument | null {
  return currentDraft;
}

export function getDraftStatus(): DraftSaveStatus {
  return currentStatus;
}

/**
 * Updates draft with revision increment and coordinates debounced persistence
 * safely surviving component unmounts.
 */
export function updateDraft(updated: ComposerDocument): void {
  currentRevision++;
  const revised: ComposerDocument = {
    ...updated,
    revision: currentRevision,
    updatedAt: Date.now(),
  };

  currentDraft = revised;
  currentStatus = 'saving';
  notify();

  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  const assignedRev = currentRevision;
  saveTimer = setTimeout(() => {
    executeDraftSave(assignedRev);
  }, 600);
}

/**
 * Flushes pending save immediately (e.g. before unmount or profile switch).
 */
export function flushDraftSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  return executeDraftSave(currentRevision);
}

async function executeDraftSave(revisionToSave: number): Promise<void> {
  if (!currentDraft) return;

  const snapshot = currentDraft;
  currentStatus = 'saving';
  notify();

  try {
    await saveActiveDraft(snapshot);
    // Ignore stale callbacks if a newer edit occurred in the meantime
    if (revisionToSave >= currentRevision) {
      lastSavedRevision = revisionToSave;
      currentStatus = 'idle';
      notify();
    }
  } catch (err) {
    // Ignore stale failure callbacks
    if (revisionToSave >= currentRevision) {
      currentStatus = 'error';
      notify();
    }
  }
}

export function subscribeDraft(
  callback: (draft: ComposerDocument, status: DraftSaveStatus) => void
): () => void {
  subscribers.add(callback);
  if (currentDraft) {
    callback(currentDraft, currentStatus);
  }
  return () => {
    subscribers.delete(callback);
  };
}
