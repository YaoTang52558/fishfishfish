import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { createDraft, validateDraft } from '../src/domain/draft.ts';
import { changeShape, createFishDesign, setPaintAsset } from '../src/domain/fish.ts';
import type { StoredAsset } from '../src/domain/types.ts';
import { openDatabase, request, StorageError } from '../src/storage/db.ts';
import { discardDraft, loadDraft, saveDraft } from '../src/storage/drafts.ts';

const png = (id: string, fill = 1): StoredAsset => {
  const blob = new Blob([new Uint8Array(64).fill(fill)], { type: 'image/png' });
  return { id, mime: 'image/png', blob, bytes: blob.size, width: 512, height: 512 };
};
const KEEP = { kind: 'keep' } as const;
const assetIds = async (db: IDBDatabase) => (await request(db.transaction('assets').objectStore('assets').getAllKeys())).sort();

test('draft and paint texture round-trip; replaced textures are cleaned up atomically', async () => {
  const db = await openDatabase(new IDBFactory());
  assert.deepEqual(await loadDraft(db), { status: 'empty' });
  const design = changeShape(createFishDesign(), 'length', 1.3);
  const first = await saveDraft(db, createDraft(design, 0), { color: { kind: 'replace', asset: png('paint-a') }, glow: KEEP });
  assert.equal(first.revision, 1);
  assert.equal(first.design.paint.colorAssetId, 'paint-a');
  const loaded = await loadDraft(db);
  assert.equal(loaded.status, 'ok');
  if (loaded.status !== 'ok') return;
  assert.deepEqual(loaded.draft.design, first.design);
  assert.deepEqual(new Uint8Array(await loaded.layers.color.blob!.arrayBuffer()), new Uint8Array(64).fill(1));
  assert.deepEqual(loaded.layers.glow, { blob: null, error: null });

  const kept = await saveDraft(db, createDraft(changeShape(first.design, 'height', 0.8), 1), { color: KEEP, glow: KEEP });
  assert.equal(kept.design.paint.colorAssetId, 'paint-a');
  const replaced = await saveDraft(db, createDraft(kept.design, 2), { color: { kind: 'replace', asset: png('paint-b', 2) }, glow: KEEP });
  assert.deepEqual(await assetIds(db), ['paint-b']);
  const cleared = await saveDraft(db, createDraft(replaced.design, 3), { color: { kind: 'clear' }, glow: KEEP });
  assert.equal(cleared.design.paint.colorAssetId, null);
  assert.deepEqual(await assetIds(db), []);
  db.close();
});

test('stale revision is rejected without overwriting; textures used by a saved fish are kept', async () => {
  const db = await openDatabase(new IDBFactory());
  const saved = await saveDraft(db, createDraft(createFishDesign(), 0), { color: { kind: 'replace', asset: png('shared') }, glow: KEEP });
  await assert.rejects(saveDraft(db, createDraft(changeShape(createFishDesign(), 'length', 1.4), 0), { color: { kind: 'replace', asset: png('stale') }, glow: KEEP }),
    (error: unknown) => error instanceof StorageError && error.kind === 'conflict');
  const after = await loadDraft(db);
  assert.equal(after.status === 'ok' && after.draft.revision, 1);
  assert.equal(after.status === 'ok' && after.draft.design.shape.length, 1);
  assert.deepEqual(await assetIds(db), ['shared']);

  const tx = db.transaction('fish', 'readwrite');
  tx.objectStore('fish').put({ id: 'fish-1', design: saved.design });
  await new Promise((resolve) => { tx.oncomplete = resolve; });
  await saveDraft(db, createDraft(saved.design, 1), { color: { kind: 'clear' }, glow: KEEP });
  assert.deepEqual(await assetIds(db), ['shared']);
  db.close();
});

test('a failed write (quota) leaves the previous draft and textures intact', async () => {
  const db = await openDatabase(new IDBFactory());
  await saveDraft(db, createDraft(createFishDesign(), 0), { color: { kind: 'replace', asset: png('old') }, glow: KEEP });
  const original = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
    if (this.name === 'drafts') throw new DOMException('full', 'QuotaExceededError');
    return original.apply(this, args);
  };
  try {
    await assert.rejects(saveDraft(db, createDraft(createFishDesign(), 1), { color: { kind: 'replace', asset: png('new') }, glow: KEEP }),
      (error: unknown) => error instanceof StorageError && error.kind === 'quota');
  } finally { IDBObjectStore.prototype.put = original; }
  assert.deepEqual(await assetIds(db), ['old']);
  const loaded = await loadDraft(db);
  assert.equal(loaded.status === 'ok' && loaded.draft.revision, 1);
  db.close();
});

test('unreadable drafts and missing textures are reported, not silently replaced', async () => {
  const db = await openDatabase(new IDBFactory());
  const missing = setPaintAsset(createFishDesign(), 'gone');
  const write = db.transaction('drafts', 'readwrite');
  write.objectStore('drafts').put({ ...createDraft(missing, 4) });
  await new Promise((resolve) => { write.oncomplete = resolve; });
  const loaded = await loadDraft(db);
  assert.equal(loaded.status === 'ok' && loaded.layers.color.error, 'missing');

  const broken = db.transaction('drafts', 'readwrite');
  broken.objectStore('drafts').put({ id: 'current', revision: 2, design: { schemaVersion: 99 } });
  await new Promise((resolve) => { broken.oncomplete = resolve; });
  assert.equal((await loadDraft(db)).status, 'invalid');
  await discardDraft(db);
  assert.deepEqual(await loadDraft(db), { status: 'empty' });
  await assert.rejects(openDatabase(undefined), (error: unknown) => error instanceof StorageError && error.kind === 'unavailable');
  db.close();
});

test('draft validation checks every field and strips unknown ones', () => {
  const draft = { ...createDraft(createFishDesign(), 3), injected: '<b>' };
  const result = validateDraft(draft);
  assert.equal(result.ok, true);
  assert.equal(result.ok && 'injected' in result.value, false);
  for (const patch of [{ revision: 0 }, { revision: 1.5 }, { name: '一二三四五六七八九十一二三四五六七' }, { personality: 'angry' },
    { preferredHabitat: 'deep-sea' }, { updatedAt: 'yesterday' }, { sourceFishId: 'fish-1' }, { id: 'other' }]) {
    assert.equal(validateDraft({ ...createDraft(createFishDesign(), 3), ...patch }).ok, false, JSON.stringify(patch));
  }
});

test('glow texture is saved, replaced and cleaned up independently of the color texture', async () => {
  const db = await openDatabase(new IDBFactory());
  const both = await saveDraft(db, createDraft(createFishDesign(), 0), { color: { kind: 'replace', asset: png('color-1') }, glow: { kind: 'replace', asset: png('glow-1', 3) } });
  assert.deepEqual([both.design.paint.colorAssetId, both.design.paint.glowAssetId], ['color-1', 'glow-1']);
  const loaded = await loadDraft(db);
  assert.equal(loaded.status === 'ok' && loaded.layers.glow.blob?.size, 64);
  const glowOnly = await saveDraft(db, createDraft(both.design, 1), { color: KEEP, glow: { kind: 'replace', asset: png('glow-2', 4) } });
  assert.deepEqual(await assetIds(db), ['color-1', 'glow-2']);
  await saveDraft(db, createDraft(glowOnly.design, 2), { color: { kind: 'clear' }, glow: { kind: 'clear' } });
  assert.deepEqual(await assetIds(db), []);
  db.close();
});
