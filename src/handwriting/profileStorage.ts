import {
  HandwritingProfile,
  CharacterSample,
  RawSampleStroke,
  ComposerDocument,
  LayoutOptions,
} from './types';
import {
  populateStarterAlphabet,
  isUntouchedStarterSample,
} from './defaultGlyphs';

const PROFILES_DB_NAME = 'inkforge_profiles_db';
const PROFILES_DB_VERSION = 2;
const PROFILES_STORE = 'profiles';
const BACKUP_STORE = 'profiles_backup';
const DRAFTS_STORE = 'drafts';
const ACTIVE_DRAFT_KEY = 'active_composer_draft';

export type LoadProfilesResult =
  | { status: 'found'; profiles: HandwritingProfile[] }
  | { status: 'empty' }
  | { status: 'error'; error: string };

export type LoadDraftResult =
  | { status: 'found'; draft: ComposerDocument }
  | { status: 'not_found' }
  | { status: 'error'; error: string };

let cachedDB: IDBDatabase | null = null;

export function closeProfilesDatabase(): void {
  if (cachedDB) {
    try {
      cachedDB.close();
    } catch {
      // ignore
    }
    cachedDB = null;
  }
}

export function openProfilesDatabase(): Promise<IDBDatabase> {
  if (cachedDB) {
    return Promise.resolve(cachedDB);
  }

  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = indexedDB.open(PROFILES_DB_NAME, PROFILES_DB_VERSION);

    request.onblocked = () => {
      reject(
        new Error(
          'Database upgrade blocked. Please close any other open InkForge tabs to allow database upgrade.'
        )
      );
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PROFILES_STORE)) {
        db.createObjectStore(PROFILES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(BACKUP_STORE)) {
        db.createObjectStore(BACKUP_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
        db.createObjectStore(DRAFTS_STORE);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      cachedDB = db;

      db.onversionchange = () => {
        closeProfilesDatabase();
      };

      db.onclose = () => {
        cachedDB = null;
      };

      resolve(db);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open profiles database.'));
    };
  });
}

/**
 * Validates whether a sample is an untouched synthetic starter sample
 * by comparing stroke geometry directly against canonical coordinates.
 */
export function isStarterSample(sample: CharacterSample, char = ''): boolean {
  if (!sample) return false;
  return isUntouchedStarterSample(sample, char);
}

/**
 * Safely migrates existing profiles:
 * - Checks legacy sample geometry against canonical starter samples.
 * - Removes ONLY confidently identified, UNTOUCHED synthetic starter samples from personal profiles.
 * - Preserves edited or ambiguous samples, relabeling them as user_edited with needsReview: true.
 * - Saves a recoverable backup in profiles_backup before applying any mutation.
 * - Idempotent: running multiple times leaves already-migrated profiles untouched.
 */
export function migrateProfile(profile: HandwritingProfile): {
  profile: HandwritingProfile;
  migrated: boolean;
  backupToSave?: HandwritingProfile;
} {
  if (profile.isDemo) {
    return { profile, migrated: false };
  }

  let hasChanges = false;
  const originalGlyphsCopy = JSON.parse(JSON.stringify(profile.glyphs));
  const cleanedGlyphs: Record<string, CharacterSample[]> = {};

  for (const [char, samples] of Object.entries(profile.glyphs)) {
    if (!Array.isArray(samples)) {
      throw new Error(`Cannot migrate malformed samples for "${char}". Original profile has been preserved.`);
    }

    const preservedSamples: CharacterSample[] = [];

    for (const sample of samples) {
      const untouchedStarter = isUntouchedStarterSample(sample, char);

      if (untouchedStarter) {
        // Confidently identified untouched synthetic starter sample -> remove from personal profile
        hasChanges = true;
      } else {
        // Either user-created or edited legacy sample
        if (sample.id.endsWith('_starter') || sample.isStarter) {
          // Edited starter retaining original ID! Preserve user work and relabel provenance
          hasChanges = true;
          preservedSamples.push({
            ...sample,
            id: `migrated_user_${char}_${sample.id.replace(/_starter$/, '')}_${Date.now()}`,
            isStarter: false,
            provenance: 'user_edited',
            needsReview: true,
          });
        } else {
          // Genuine user sample
          preservedSamples.push({
            ...sample,
            provenance: sample.provenance || 'user_captured',
          });
        }
      }
    }

    if (preservedSamples.length > 0) {
      cleanedGlyphs[char] = preservedSamples;
    }
  }

  if (hasChanges) {
    const backup: HandwritingProfile = {
      ...profile,
      id: `${profile.id}_pre_migration_${Date.now()}`,
      updatedAt: Date.now(),
    };

    const migratedProfile: HandwritingProfile = {
      ...profile,
      glyphs: cleanedGlyphs,
      legacyBackup: originalGlyphsCopy,
      updatedAt: Date.now(),
    };

    return {
      profile: migratedProfile,
      migrated: true,
      backupToSave: backup,
    };
  }

  return { profile, migrated: false };
}

/**
 * Loads all profiles from IndexedDB with failure / empty separation.
 * Transactional: Returns migrated profiles only after transaction.oncomplete commits.
 * Atomic: Both profile mutation and pre-migration backup commit together or roll back on abort.
 */
export async function listProfiles(): Promise<LoadProfilesResult> {
  try {
    const db = await openProfilesDatabase();
    return new Promise((resolve) => {
      let resolved = false;
      const safeResolve = (res: LoadProfilesResult) => {
        if (!resolved) {
          resolved = true;
          resolve(res);
        }
      };

      try {
        const tx = db.transaction([PROFILES_STORE, BACKUP_STORE], 'readwrite');
        const store = tx.objectStore(PROFILES_STORE);
        const backupStore = tx.objectStore(BACKUP_STORE);
        const req = store.getAll();

        const migratedList: HandwritingProfile[] = [];

        // Attach transaction lifecycle handlers upfront
        tx.oncomplete = () => {
          safeResolve(migratedList.length ? { status: 'found', profiles: migratedList } : { status: 'empty' });
        };

        tx.onerror = () => {
          safeResolve({
            status: 'error',
            error: tx.error?.message || 'Transaction failed reading/migrating profiles.',
          });
        };

        tx.onabort = () => {
          safeResolve({
            status: 'error',
            error: 'Transaction aborted while reading/migrating profiles.',
          });
        };

        req.onerror = () => {
          safeResolve({
            status: 'error',
            error: req.error?.message || 'Failed reading profiles store.',
          });
        };

        req.onsuccess = () => {
          try {
            const rawProfiles = (req.result as HandwritingProfile[]) || [];
            if (rawProfiles.length === 0) {
              return;
            }

            for (const p of rawProfiles) {
                const { profile: cleanP, migrated, backupToSave } = migrateProfile(p);
                migratedList.push(cleanP);
                if (migrated) {
                  if (backupToSave) {
                    backupStore.put(backupToSave);
                  }
                  store.put(cleanP);
                }
            }
          } catch (innerErr: any) {
            // Synchronous put/validation failures do not automatically abort IDB.
            // Explicitly roll back every queued migration and backup write.
            tx.abort();
            safeResolve({
              status: 'error',
              error: innerErr?.message || 'Error processing loaded profiles.',
            });
          }
        };
      } catch (err: any) {
        safeResolve({
          status: 'error',
          error: err?.message || 'Failed opening readwrite profiles transaction.',
        });
      }
    });
  } catch (err: any) {
    return { status: 'error', error: err?.message || 'Failed opening database.' };
  }
}

export async function loadProfile(id: string): Promise<HandwritingProfile | null> {
  try {
    const db = await openProfilesDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PROFILES_STORE, 'readonly');
      const store = tx.objectStore(PROFILES_STORE);
      const req = store.get(id);

      req.onsuccess = () => {
        const result = req.result as HandwritingProfile | undefined;
        if (!result) {
          resolve(null);
          return;
        }
        const { profile: cleanP } = migrateProfile(result);
        resolve(cleanP);
      };

      req.onerror = () => reject(req.error);
      tx.onabort = () => reject(new Error('Transaction aborted'));
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to load profile:', err);
    return null;
  }
}

export async function saveProfile(profile: HandwritingProfile): Promise<void> {
  const db = await openProfilesDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(PROFILES_STORE, 'readwrite');
      const store = tx.objectStore(PROFILES_STORE);
      const req = store.put(profile);

      req.onerror = () => reject(req.error || new Error('Profile put request failed.'));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed saving profile.'));
      tx.onabort = () => reject(new Error('Profile transaction aborted.'));
    } catch (err) {
      reject(err);
    }
  });
}

export async function deleteProfile(id: string): Promise<void> {
  const db = await openProfilesDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(PROFILES_STORE, 'readwrite');
      const store = tx.objectStore(PROFILES_STORE);
      const req = store.delete(id);

      req.onerror = () => reject(req.error || new Error('Profile delete request failed.'));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed deleting profile.'));
      tx.onabort = () => reject(new Error('Profile deletion aborted.'));
    } catch (err) {
      reject(err);
    }
  });
}

// ---------------------------------------------------------------------------
// Composer Draft Document Persistence & Strict Validation
// ---------------------------------------------------------------------------

export function validateComposerDraft(data: any): { draft?: ComposerDocument; error?: string } {
  if (!data || typeof data !== 'object') {
    return { error: 'Draft root must be an object.' };
  }

  if (data.schemaVersion !== 1) {
    return { error: `Unsupported draft schema version "${data.schemaVersion}". Expected 1.` };
  }

  if (typeof data.id !== 'string' || !data.id.trim()) {
    return { error: 'Draft missing string ID.' };
  }

  if (typeof data.text !== 'string') {
    return { error: 'Draft text must be a string.' };
  }

  if (!data.options || typeof data.options !== 'object') {
    return { error: 'Draft missing layout options.' };
  }

  const { pageWidth, pageHeight, margins, fontSize, lineHeight, letterSpacing, wordSpacing } =
    data.options;

  if (!Number.isFinite(pageWidth) || pageWidth <= 0 || !Number.isFinite(pageHeight) || pageHeight <= 0) {
    return { error: 'Draft has invalid page dimensions.' };
  }

  if (
    !margins ||
    typeof margins !== 'object' ||
    !Number.isFinite(margins.top) ||
    !Number.isFinite(margins.right) ||
    !Number.isFinite(margins.bottom) ||
    !Number.isFinite(margins.left)
  ) {
    return { error: 'Draft has invalid margins.' };
  }

  if (
    !Number.isFinite(fontSize) ||
    fontSize <= 0 ||
    !Number.isFinite(lineHeight) ||
    lineHeight <= 0 ||
    !Number.isFinite(letterSpacing) ||
    letterSpacing <= 0 ||
    !Number.isFinite(wordSpacing) ||
    wordSpacing <= 0
  ) {
    return { error: 'Draft has non-positive or non-finite typography values.' };
  }

  const cleanDraft: ComposerDocument = {
    schemaVersion: 1,
    id: data.id.trim(),
    title: typeof data.title === 'string' ? data.title : 'Handwriting Draft',
    text: data.text,
    profileId: typeof data.profileId === 'string' ? data.profileId : '',
    options: {
      pageWidth,
      pageHeight,
      margins,
      fontSize,
      lineHeight,
      letterSpacing,
      wordSpacing,
    },
    createdAt: typeof data.createdAt === 'number' && Number.isFinite(data.createdAt) ? data.createdAt : Date.now(),
    updatedAt: typeof data.updatedAt === 'number' && Number.isFinite(data.updatedAt) ? data.updatedAt : Date.now(),
    revision: typeof data.revision === 'number' && Number.isFinite(data.revision) ? data.revision : 1,
  };

  return { draft: cleanDraft };
}

export async function loadActiveDraft(): Promise<LoadDraftResult> {
  try {
    const db = await openProfilesDatabase();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(DRAFTS_STORE, 'readonly');
        const store = tx.objectStore(DRAFTS_STORE);
        const req = store.get(ACTIVE_DRAFT_KEY);

        req.onsuccess = () => {
          if (!req.result) {
            resolve({ status: 'not_found' });
            return;
          }
          const { draft, error } = validateComposerDraft(req.result);
          if (error || !draft) {
            resolve({ status: 'error', error: `Corrupt draft in storage: ${error}` });
          } else {
            resolve({ status: 'found', draft });
          }
        };

        req.onerror = () => {
          resolve({ status: 'error', error: req.error?.message || 'Failed reading active draft.' });
        };

        tx.onerror = () => {
          resolve({ status: 'error', error: tx.error?.message || 'Transaction error reading draft.' });
        };

        tx.onabort = () => {
          resolve({ status: 'error', error: 'Draft transaction aborted.' });
        };
      } catch (err: any) {
        resolve({ status: 'error', error: err?.message || 'Failed opening draft transaction.' });
      }
    });
  } catch (err: any) {
    return { status: 'error', error: err?.message || 'Database error loading draft.' };
  }
}

export async function saveActiveDraft(draft: ComposerDocument): Promise<void> {
  const db = await openProfilesDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(DRAFTS_STORE, 'readwrite');
      const store = tx.objectStore(DRAFTS_STORE);
      store.put(draft, ACTIVE_DRAFT_KEY);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed saving draft transaction.'));
      tx.onabort = () => reject(new Error('Draft transaction aborted.'));
    } catch (err) {
      reject(err);
    }
  });
}

// ---------------------------------------------------------------------------
// Profile Validation & Factory Helpers
// ---------------------------------------------------------------------------

export function validateAndParseProfile(jsonString: string): { profile?: HandwritingProfile; error?: string } {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: any) {
    return { error: `Invalid profile JSON syntax: ${err.message}` };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { error: 'Profile root must be a JSON object.' };
  }

  if (parsed.schemaVersion !== 1) {
    return { error: `Unsupported profile schema version "${parsed.schemaVersion}". Expected version 1.` };
  }

  if (parsed.app !== 'InkForge-HandwritingProfile') {
    return { error: `Invalid application signature "${parsed.app}". Expected "InkForge-HandwritingProfile".` };
  }

  if (typeof parsed.id !== 'string' || !parsed.id.trim()) {
    return { error: 'Profile must have a valid non-empty string ID.' };
  }

  if (typeof parsed.name !== 'string' || !parsed.name.trim()) {
    return { error: 'Profile must have a valid non-empty name.' };
  }

  if (!parsed.glyphs || typeof parsed.glyphs !== 'object') {
    return { error: 'Profile must contain a "glyphs" map object.' };
  }

  for (const [char, samples] of Object.entries(parsed.glyphs)) {
    if (typeof char !== 'string' || char.length === 0) {
      return { error: 'Invalid character key in glyphs dictionary.' };
    }
    if (!Array.isArray(samples)) {
      return { error: `Samples for character "${char}" must be an array.` };
    }

    const sampleIdSet = new Set<string>();
    for (let sIdx = 0; sIdx < samples.length; sIdx++) {
      const sample = samples[sIdx] as any;
      if (!sample || typeof sample !== 'object') {
        return { error: `Sample #${sIdx} for "${char}" is not an object.` };
      }
      if (typeof sample.id !== 'string' || !sample.id.trim()) {
        return { error: `Sample #${sIdx} for "${char}" missing ID.` };
      }
      if (sampleIdSet.has(sample.id)) {
        return { error: `Duplicate sample ID "${sample.id}" for character "${char}".` };
      }
      sampleIdSet.add(sample.id);

      if (!Number.isFinite(sample.baselineY) || !Number.isFinite(sample.capHeightY)) {
        return { error: `Sample "${sample.id}" for "${char}" has invalid guide geometry.` };
      }
      if (!Array.isArray(sample.strokes)) {
        return { error: `Sample "${sample.id}" for "${char}" strokes must be an array.` };
      }

      const strokeIdSet = new Set<string>();
      for (let stIdx = 0; stIdx < sample.strokes.length; stIdx++) {
        const stroke = sample.strokes[stIdx];
        if (!stroke || typeof stroke !== 'object') {
          return { error: `Stroke #${stIdx} in sample "${sample.id}" is invalid.` };
        }
        if (typeof stroke.id !== 'string' || !stroke.id.trim()) {
          return { error: `Stroke #${stIdx} in sample "${sample.id}" missing string ID.` };
        }
        if (strokeIdSet.has(stroke.id)) {
          return { error: `Duplicate stroke ID "${stroke.id}" in sample "${sample.id}".` };
        }
        strokeIdSet.add(stroke.id);

        if (!Number.isFinite(stroke.baseWidth) || stroke.baseWidth <= 0) {
          return { error: `Stroke "${stroke.id}" has non-positive or non-finite baseWidth.` };
        }
        if (typeof stroke.color !== 'string' || !stroke.color.trim()) {
          return { error: `Stroke "${stroke.id}" has invalid color.` };
        }
        if (!Array.isArray(stroke.points) || stroke.points.length === 0) {
          return { error: `Stroke "${stroke.id}" in sample "${sample.id}" has no points.` };
        }
        for (let ptIdx = 0; ptIdx < stroke.points.length; ptIdx++) {
          const pt = stroke.points[ptIdx];
          if (
            !pt ||
            !Number.isFinite(pt.x) ||
            !Number.isFinite(pt.y) ||
            !Number.isFinite(pt.pressure) ||
            pt.pressure < 0 ||
            pt.pressure > 1 ||
            (pt.tiltX !== undefined && !Number.isFinite(pt.tiltX)) ||
            (pt.tiltY !== undefined && !Number.isFinite(pt.tiltY)) ||
            (pt.timestamp !== undefined && !Number.isFinite(pt.timestamp))
          ) {
            return { error: `Point #${ptIdx} in stroke "${stroke.id}" of sample "${sample.id}" has invalid coordinates or pressure.` };
          }
        }
      }
    }
  }

  const cleanProfile: HandwritingProfile = {
    schemaVersion: 1,
    app: 'InkForge-HandwritingProfile',
    id: parsed.id.trim(),
    name: parsed.name.trim(),
    createdAt: typeof parsed.createdAt === 'number' && Number.isFinite(parsed.createdAt) ? parsed.createdAt : Date.now(),
    updatedAt: Date.now(),
    description: typeof parsed.description === 'string' ? parsed.description : undefined,
    isDemo: parsed.isDemo === true,
    glyphs: parsed.glyphs,
  };

  return { profile: cleanProfile };
}

export function createNewPersonalProfile(name = 'My Handwriting'): HandwritingProfile {
  return {
    schemaVersion: 1,
    app: 'InkForge-HandwritingProfile',
    id: `profile_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    description: 'Personal print handwriting capture profile for InkForge.',
    isDemo: false,
    glyphs: {},
  };
}

export const createNewProfile = createNewPersonalProfile;

export function createDemoProfile(): HandwritingProfile {
  return {
    schemaVersion: 1,
    app: 'InkForge-HandwritingProfile',
    id: 'profile_demo_starter',
    name: 'Starter Print (Demo Template)',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    description: 'Reference starter template showing sample-based composition capability.',
    isDemo: true,
    glyphs: populateStarterAlphabet(),
  };
}
