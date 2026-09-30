import { HandwritingProfile, CharacterSample, RawSampleStroke } from './types';

const PROFILES_DB_NAME = 'inkforge_profiles_db';
const PROFILES_DB_VERSION = 1;
const STORE_NAME = 'profiles';

function openProfilesDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }
    const request = indexedDB.open(PROFILES_DB_NAME, PROFILES_DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open profiles database.'));
  });
}

export async function listProfiles(): Promise<HandwritingProfile[]> {
  try {
    const db = await openProfilesDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => resolve((req.result as HandwritingProfile[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to list profiles:', err);
    return [];
  }
}

export async function loadProfile(id: string): Promise<HandwritingProfile | null> {
  try {
    const db = await openProfilesDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => resolve((req.result as HandwritingProfile) || null);
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
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(profile);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to save profile.'));
  });
}

export async function deleteProfile(id: string): Promise<void> {
  const db = await openProfilesDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete profile.'));
  });
}

/**
 * Validates and parses imported handwriting profile JSON.
 * Rejects corrupt structures, invalid coordinates, or unsupported schema versions.
 */
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

  // Validate each character entry and its samples
  for (const [char, samples] of Object.entries(parsed.glyphs)) {
    if (typeof char !== 'string' || char.length === 0) {
      return { error: 'Invalid character key in glyphs dictionary.' };
    }
    if (!Array.isArray(samples)) {
      return { error: `Samples for character "${char}" must be an array.` };
    }

    for (let sIdx = 0; sIdx < samples.length; sIdx++) {
      const sample = samples[sIdx] as any;
      if (!sample || typeof sample !== 'object') {
        return { error: `Sample #${sIdx} for "${char}" is not an object.` };
      }
      if (typeof sample.id !== 'string' || !sample.id.trim()) {
        return { error: `Sample #${sIdx} for "${char}" missing ID.` };
      }
      if (!Number.isFinite(sample.baselineY) || !Number.isFinite(sample.capHeightY)) {
        return { error: `Sample "${sample.id}" for "${char}" has invalid guide geometry.` };
      }
      if (!Array.isArray(sample.strokes)) {
        return { error: `Sample "${sample.id}" for "${char}" strokes must be an array.` };
      }

      for (let stIdx = 0; stIdx < sample.strokes.length; stIdx++) {
        const stroke = sample.strokes[stIdx];
        if (!stroke || typeof stroke !== 'object') {
          return { error: `Stroke #${stIdx} in sample "${sample.id}" is invalid.` };
        }
        if (!Array.isArray(stroke.points) || stroke.points.length === 0) {
          return { error: `Stroke #${stIdx} in sample "${sample.id}" has no points.` };
        }
        for (let ptIdx = 0; ptIdx < stroke.points.length; ptIdx++) {
          const pt = stroke.points[ptIdx];
          if (
            !pt ||
            !Number.isFinite(pt.x) ||
            !Number.isFinite(pt.y) ||
            !Number.isFinite(pt.pressure) ||
            pt.pressure < 0 ||
            pt.pressure > 1
          ) {
            return { error: `Point #${ptIdx} in stroke #${stIdx} of sample "${sample.id}" has invalid coordinates or pressure.` };
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
    glyphs: parsed.glyphs,
  };

  return { profile: cleanProfile };
}

/**
 * Creates an empty or starter personal handwriting profile.
 */
export function createNewProfile(name = 'My Handwriting'): HandwritingProfile {
  return {
    schemaVersion: 1,
    app: 'InkForge-HandwritingProfile',
    id: `profile_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    description: 'Personal print handwriting capture profile for InkForge.',
    glyphs: {},
  };
}
