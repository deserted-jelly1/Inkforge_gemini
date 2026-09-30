import { HandwritingProfile, CharacterSample, RawSampleStroke, ComposerDocument } from './types';
import { populateStarterAlphabet } from './defaultGlyphs';

const PROFILES_DB_NAME = 'inkforge_profiles_db';
const PROFILES_DB_VERSION = 2;
const PROFILES_STORE = 'profiles';
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

function openProfilesDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }
    const request = indexedDB.open(PROFILES_DB_NAME, PROFILES_DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PROFILES_STORE)) {
        db.createObjectStore(PROFILES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
        db.createObjectStore(DRAFTS_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open profiles database.'));
  });
}

/**
 * Checks if a sample is a synthetic starter sample.
 */
export function isStarterSample(sample: CharacterSample): boolean {
  return (
    sample.isStarter === true ||
    sample.id.endsWith('_starter') ||
    sample.id.startsWith('sample_starter') ||
    sample.id.startsWith('starter_')
  );
}

/**
 * Safely migrates existing profiles: removes synthetic starter samples from personal profiles
 * while preserving every user-created sample.
 */
export function migrateProfile(profile: HandwritingProfile): { profile: HandwritingProfile; migrated: boolean } {
  // If explicitly a demo profile, leave demo samples
  if (profile.isDemo) {
    return { profile, migrated: false };
  }

  let hasStarterSamples = false;
  const cleanedGlyphs: Record<string, CharacterSample[]> = {};

  for (const [char, samples] of Object.entries(profile.glyphs)) {
    if (!Array.isArray(samples)) continue;
    const userSamples = samples.filter((s) => !isStarterSample(s));
    if (userSamples.length !== samples.length) {
      hasStarterSamples = true;
    }
    if (userSamples.length > 0) {
      cleanedGlyphs[char] = userSamples;
    }
  }

  if (hasStarterSamples) {
    return {
      profile: {
        ...profile,
        glyphs: cleanedGlyphs,
        updatedAt: Date.now(),
      },
      migrated: true,
    };
  }

  return { profile, migrated: false };
}

/**
 * Loads all profiles from IndexedDB with explicit error/empty separation.
 */
export async function listProfiles(): Promise<LoadProfilesResult> {
  try {
    const db = await openProfilesDatabase();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(PROFILES_STORE, 'readonly');
        const store = tx.objectStore(PROFILES_STORE);
        const req = store.getAll();

        req.onsuccess = () => {
          const rawProfiles = (req.result as HandwritingProfile[]) || [];
          if (rawProfiles.length === 0) {
            resolve({ status: 'empty' });
            return;
          }

          // Apply migration to ensure personal profiles contain only user samples
          const migratedList: HandwritingProfile[] = [];
          let needsSave = false;

          for (const p of rawProfiles) {
            const { profile: cleanP, migrated } = migrateProfile(p);
            migratedList.push(cleanP);
            if (migrated) needsSave = true;
          }

          if (needsSave) {
            // Asynchronously persist clean profiles
            for (const p of migratedList) {
              saveProfile(p).catch(console.error);
            }
          }

          resolve({ status: 'found', profiles: migratedList });
        };

        req.onerror = () => {
          resolve({ status: 'error', error: req.error?.message || 'Failed reading profiles from store.' });
        };

        tx.onerror = () => {
          resolve({ status: 'error', error: tx.error?.message || 'Transaction failed reading profiles.' });
        };
      } catch (err: any) {
        resolve({ status: 'error', error: err?.message || 'Failed opening transaction.' });
      }
    });
  } catch (err: any) {
    return { status: 'error', error: err?.message || 'Failed connecting to database.' };
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
      store.put(profile);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed saving profile transaction.'));
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
      store.delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed deleting profile transaction.'));
      tx.onabort = () => reject(new Error('Profile deletion aborted.'));
    } catch (err) {
      reject(err);
    }
  });
}

// ---------------------------------------------------------------------------
// Composer Draft Document Persistence
// ---------------------------------------------------------------------------

export async function loadActiveDraft(): Promise<LoadDraftResult> {
  try {
    const db = await openProfilesDatabase();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(DRAFTS_STORE, 'readonly');
        const store = tx.objectStore(DRAFTS_STORE);
        const req = store.get(ACTIVE_DRAFT_KEY);

        req.onsuccess = () => {
          if (req.result) {
            resolve({ status: 'found', draft: req.result as ComposerDocument });
          } else {
            resolve({ status: 'not_found' });
          }
        };

        req.onerror = () => {
          resolve({ status: 'error', error: req.error?.message || 'Failed reading active draft.' });
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

/**
 * Creates an empty personal profile with zero captured samples.
 */
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

/**
 * Creates the explicitly labeled separate demo profile populated with starter glyphs.
 */
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
