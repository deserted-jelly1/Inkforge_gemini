import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { closeProfilesDatabase, openProfilesDatabase, createNewPersonalProfile, saveProfile, listProfiles, loadActiveDraft } from '../handwriting/profileStorage';
import { createStarterSample } from '../handwriting/defaultGlyphs';
import { resetDraftManagerForTesting, getOrLoadActiveDraft, updateDraft, getCurrentDraft, getDraftStatus, flushDraftSave, subscribeDraft, retryDraftLoad } from '../handwriting/draftManager';

beforeEach(() => {
  closeProfilesDatabase();
  resetDraftManagerForTesting();
  globalThis.indexedDB = new IDBFactory();
});
afterEach(() => {
  closeProfilesDatabase();
  resetDraftManagerForTesting();
});

async function allRecords(store: string) {
  const db = await openProfilesDatabase();
  return new Promise<any[]>((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const request = tx.objectStore(store).getAll();
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(tx.error);
  });
}

test('migration rolls back earlier writes when a later backup put throws synchronously', async () => {
  const a = createNewPersonalProfile('A');
  const b = createNewPersonalProfile('B');
  a.glyphs = { a: [createStarterSample('a')] };
  b.glyphs = { b: [createStarterSample('b')] };
  await saveProfile(a);
  await saveProfile(b);
  const original = IDBObjectStore.prototype.put;
  let backupCount = 0;
  IDBObjectStore.prototype.put = function(value: any, key?: IDBValidKey) {
    if (this.name === 'profiles_backup' && ++backupCount === 2) throw new Error('Backup quota exceeded');
    return original.call(this, value, key);
  };
  try {
    const result = await listProfiles();
    assert.equal(result.status, 'error');
  } finally {
    IDBObjectStore.prototype.put = original;
  }
  const stored = await allRecords('profiles');
  assert.equal(stored.length, 2);
  assert.ok(stored.every(p => Object.keys(p.glyphs).length === 1));
  assert.deepEqual(await allRecords('profiles_backup'), []);
});

test('migration commits backups and cleaned profiles together and is idempotent', async () => {
  const profile = createNewPersonalProfile('Legacy');
  profile.glyphs = { a: [createStarterSample('a')] };
  await saveProfile(profile);
  assert.equal((await listProfiles()).status, 'found');
  assert.deepEqual((await allRecords('profiles'))[0].glyphs, {});
  assert.equal((await allRecords('profiles_backup')).length, 1);
  await listProfiles();
  assert.equal((await allRecords('profiles_backup')).length, 1);
});

test('edits during the first save remain unsaved until their own commit and survive reload', async () => {
  let edited = false;
  const observed: string[] = [];
  const unsubscribe = subscribeDraft(snapshot => {
    observed.push(`${snapshot.draft?.text}:${snapshot.saveStatus}`);
    if (!edited && snapshot.state === 'ready' && snapshot.draft) {
      edited = true;
      updateDraft({ ...snapshot.draft, text: 'My own notes during initialization' });
    }
  });
  await getOrLoadActiveDraft('personal');
  await flushDraftSave();
  assert.equal(getDraftStatus(), 'idle');
  assert.equal(getCurrentDraft()?.text, 'My own notes during initialization');
  unsubscribe();
  resetDraftManagerForTesting();
  const restored = await getOrLoadActiveDraft();
  assert.equal(restored.draft?.text, 'My own notes during initialization');
  assert.ok(observed.some(value => value.endsWith(':saving')));
});

test('rapid flushes serialize snapshots and persist the final revision', async () => {
  await getOrLoadActiveDraft('personal');
  updateDraft({ ...getCurrentDraft()!, text: 'First edit' });
  const first = flushDraftSave();
  updateDraft({ ...getCurrentDraft()!, text: 'Newest edit', options: { ...getCurrentDraft()!.options, fontSize: 30 } });
  const last = flushDraftSave();
  await Promise.all([first, last]);
  closeProfilesDatabase();
  resetDraftManagerForTesting();
  const result = await loadActiveDraft();
  assert.equal(result.status, 'found');
  if (result.status === 'found') {
    assert.equal(result.draft.text, 'Newest edit');
    assert.equal(result.draft.options.fontSize, 30);
  }
});

test('retry load on a ready draft never discards unsaved edits', async () => {
  await getOrLoadActiveDraft();
  updateDraft({ ...getCurrentDraft()!, text: 'Keep this pending edit' });
  const result = await retryDraftLoad();
  assert.equal(result.draft?.text, 'Keep this pending edit');
  await flushDraftSave();
});
