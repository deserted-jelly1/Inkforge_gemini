import { ComposerDocument } from './types';
import { loadActiveDraft, saveActiveDraft } from './profileStorage';

export type DraftManagerState = 'uninitialized' | 'loading' | 'ready' | 'load_error';
export type DraftSaveStatus = 'idle' | 'saving' | 'error';

export interface DraftManagerSnapshot {
  draft: ComposerDocument | null;
  state: DraftManagerState;
  saveStatus: DraftSaveStatus;
  loadError: string | null;
}

let managerState: DraftManagerState = 'uninitialized';
let currentDraft: ComposerDocument | null = null;
let currentRevision = 0;
let lastSavedRevision = 0;
let saveQueue: Promise<boolean> = Promise.resolve(true);
let saveTimer: any = null;
let currentSaveStatus: DraftSaveStatus = 'idle';
let loadError: string | null = null;
let activeLoadPromise: Promise<{
  status: 'found' | 'not_found' | 'error';
  draft?: ComposerDocument;
  error?: string;
}> | null = null;

let subscribers = new Set<
  (snapshot: DraftManagerSnapshot) => void
>();

function notify(): void {
  const snapshot: DraftManagerSnapshot = {
    draft: currentDraft,
    state: managerState,
    saveStatus: currentSaveStatus,
    loadError,
  };
  for (const cb of subscribers) {
    try {
      cb(snapshot);
    } catch (err) {
      console.error('Draft subscriber error:', err);
    }
  }
}

/**
 * Resets the draft manager state completely.
 * Used for test isolation and clean session boundary testing.
 */
export function resetDraftManagerForTesting(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  managerState = 'uninitialized';
  currentDraft = null;
  currentRevision = 0;
  lastSavedRevision = 0;
  saveQueue = Promise.resolve(true);
  currentSaveStatus = 'idle';
  loadError = null;
  activeLoadPromise = null;
  subscribers.clear();
}

/**
 * Initializes or retrieves the active composer draft.
 * - Deduplicates concurrent calls.
 * - Enforces load safety: allows mutation and writes only after successful load or confirmed not_found.
 * - Handles initial save failure: retains new draft in memory, sets error state, never labels saved before commit.
 */
export function getOrLoadActiveDraft(
  fallbackProfileId = ''
): Promise<{ status: 'found' | 'not_found' | 'error'; draft?: ComposerDocument; error?: string }> {
  // If already ready, return current in-memory draft
  if (managerState === 'ready' && currentDraft) {
    return Promise.resolve({ status: 'found', draft: currentDraft });
  }

  // Deduplicate concurrent initialization requests
  if (activeLoadPromise) {
    return activeLoadPromise;
  }

  managerState = 'loading';
  loadError = null;
  currentSaveStatus = 'idle';
  notify();

  const loadPromise: Promise<{
    status: 'found' | 'not_found' | 'error';
    draft?: ComposerDocument;
    error?: string;
  }> = (async () => {
    try {
      const loadRes = await loadActiveDraft();

      if (loadRes.status === 'found') {
        currentDraft = loadRes.draft;
        currentRevision = loadRes.draft.revision || 1;
        lastSavedRevision = currentRevision;
        managerState = 'ready';
        currentSaveStatus = 'idle';
        loadError = null;
        notify();
        return { status: 'found' as const, draft: currentDraft };
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
        lastSavedRevision = 0; // NOT saved yet!
        managerState = 'ready';
        currentSaveStatus = 'saving'; // Never report saved before transaction commits
        loadError = null;
        notify();

        await executeDraftSave(currentRevision);

        return { status: 'not_found' as const, draft: currentDraft! };
      }

      // Load error: preserve storage, do NOT write default draft, set load_error state
      managerState = 'load_error';
      const errStr = loadRes.error || 'Failed to load active draft from storage.';
      loadError = errStr;
      currentDraft = null; // No unread draft in memory to prevent accidental writes
      currentSaveStatus = 'error';
      notify();
      return { status: 'error' as const, error: errStr };
    } catch (err: any) {
      managerState = 'load_error';
      const errStr = err?.message || 'Database error during draft initialization.';
      loadError = errStr;
      currentDraft = null;
      currentSaveStatus = 'error';
      notify();
      return { status: 'error' as const, error: errStr };
    } finally {
      activeLoadPromise = null;
    }
  })();

  activeLoadPromise = loadPromise;
  return loadPromise;
}

/**
 * Retries loading the draft from storage after a load error.
 */
export async function retryDraftLoad(
  fallbackProfileId = ''
): Promise<{ status: 'found' | 'not_found' | 'error'; draft?: ComposerDocument; error?: string }> {
  // A repeated retry must not discard edits or start a competing load.
  if (activeLoadPromise || managerState === 'ready') return getOrLoadActiveDraft(fallbackProfileId);
  managerState = 'uninitialized';
  currentDraft = null;
  loadError = null;
  activeLoadPromise = null;
  return getOrLoadActiveDraft(fallbackProfileId);
}

/**
 * Retries saving the current in-memory draft if initial save or autosave failed.
 */
export async function retryDraftSave(): Promise<boolean> {
  if (managerState !== 'ready' || !currentDraft) {
    return false;
  }
  return executeDraftSave(currentRevision);
}

export function getCurrentDraft(): ComposerDocument | null {
  return currentDraft;
}

export function getDraftManagerState(): DraftManagerState {
  return managerState;
}

export function getDraftStatus(): DraftSaveStatus {
  return currentSaveStatus;
}

export function getDraftLoadError(): string | null {
  return loadError;
}

/**
 * Updates draft with revision increment and coordinates debounced persistence.
 * ENFORCED SAFETY: Rejects mutations if draft is not in 'ready' state.
 */
export function updateDraft(updated: ComposerDocument): boolean {
  if (managerState !== 'ready' || !currentDraft) {
    // Prevent edits from overwriting an unread draft
    return false;
  }

  currentRevision++;
  const revised: ComposerDocument = {
    ...updated,
    revision: currentRevision,
    updatedAt: Date.now(),
  };

  currentDraft = revised;
  currentSaveStatus = 'saving';
  notify();

  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  const assignedRev = currentRevision;
  saveTimer = setTimeout(() => {
    executeDraftSave(assignedRev);
  }, 600);

  return true;
}

/**
 * Updates only the profile reference on the current in-memory draft
 * WITHOUT restoring an older captured copy of draft text.
 * ENFORCED SAFETY: No-op if manager is not in 'ready' state.
 */
export function setDraftProfileId(profileId: string): boolean {
  if (managerState !== 'ready' || !currentDraft) {
    return false;
  }

  if (currentDraft.profileId === profileId) {
    return true;
  }

  return updateDraft({
    ...currentDraft,
    profileId,
  });
}

/**
 * Flushes pending save immediately (e.g. before unmount or profile switch).
 * ENFORCED SAFETY: No-op if manager is not in 'ready' state.
 */
export function flushDraftSave(): Promise<void> {
  if (managerState !== 'ready' || !currentDraft) {
    return Promise.resolve();
  }

  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  return executeDraftSave(currentRevision).then(() => undefined);
}

function executeDraftSave(_requestedRevision: number): Promise<boolean> {
  if (!currentDraft || managerState !== 'ready') return Promise.resolve(false);
  const snapshot = structuredClone(currentDraft);
  const revisionToSave = currentRevision;
  currentSaveStatus = 'saving';
  notify();
  // Queue the writes themselves, not just their UI callbacks.
  const operation = saveQueue.then(async () => {
  try {
    if (revisionToSave > lastSavedRevision) await saveActiveDraft(snapshot);
    lastSavedRevision = Math.max(lastSavedRevision, revisionToSave);
    // Ignore stale callbacks if a newer edit occurred in the meantime
    if (revisionToSave >= currentRevision) {
      lastSavedRevision = revisionToSave;
      currentSaveStatus = 'idle';
      notify();
      return true;
    }
    return false;
  } catch (err) {
    // Ignore stale failure callbacks
    if (revisionToSave >= currentRevision) {
      currentSaveStatus = 'error';
      notify();
    }
    return false;
  }
  });
  saveQueue = operation;
  return operation;
}

export function subscribeDraft(
  callback: (snapshot: DraftManagerSnapshot) => void
): () => void {
  subscribers.add(callback);
  callback({
    draft: currentDraft,
    state: managerState,
    saveStatus: currentSaveStatus,
    loadError,
  });
  return () => {
    subscribers.delete(callback);
  };
}
