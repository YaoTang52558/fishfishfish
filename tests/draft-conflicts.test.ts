import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { buildBackup, validateBackup } from '../src/domain/backup.ts';
import { createDraft, createSettings } from '../src/domain/draft.ts';
import { createFishDesign } from '../src/domain/fish.ts';
import { openDatabase, StorageError } from '../src/storage/db.ts';
import { discardDraft, loadDraft, saveDraft } from '../src/storage/drafts.ts';
import { replaceProfile } from '../src/storage/backup.ts';
import { clearAllData, commitFish, startEditFromFish } from '../src/storage/repository.ts';

const KEEP = { color: { kind: 'keep' }, glow: { kind: 'keep' } } as const;
const conflict = (e: unknown) => e instanceof StorageError && e.kind === 'conflict';
const fresh = () => openDatabase(new IDBFactory());

test('stale discard and confirmed replacement reject another tab’s newer draft', async () => {
  const db = await fresh();
  const first = await saveDraft(db, createDraft(createFishDesign(), 0, { name: '海里的鱼' }), KEEP);
  await commitFish(db, {commandId:'cmd', fishId:'fish', mode:'create', draftRevision:first.revision, effects:[]});
  const empty = await loadDraft(db);
  if (empty.status !== 'empty') assert.fail();
  const a = await saveDraft(db, createDraft(createFishDesign(), empty.revision, {name:'A'}), KEEP);
  const b = await saveDraft(db, {...a, name:'B的新草稿'}, KEEP);
  await assert.rejects(discardDraft(db, a.revision), conflict);
  await assert.rejects(startEditFromFish(db, 'fish', a.revision), conflict);
  const loaded = await loadDraft(db);
  assert.equal(loaded.status === 'ok' && loaded.draft.name, b.name);
  db.close();
});

test('discard and recreate never reuse a revision; stale empty and populated tabs cannot overwrite', async () => {
  const factory = new IDBFactory();
  const db = await openDatabase(factory);
  const old = await saveDraft(db, createDraft(createFishDesign(), 0, {name:'旧鱼'}), KEEP);
  const revision = await discardDraft(db, old.revision);
  assert.ok(revision > old.revision);
  await assert.rejects(saveDraft(db, old, KEEP), conflict);
  await assert.rejects(saveDraft(db, createDraft(createFishDesign(), 0), KEEP), conflict);
  db.close();
  const reopened = await openDatabase(factory);
  const empty = await loadDraft(reopened);
  assert.deepEqual(empty, {status:'empty', revision});
  const next = await saveDraft(reopened, createDraft(createFishDesign(), revision, {name:'新鱼'}), KEEP);
  assert.ok(next.revision > old.revision);
  await assert.rejects(saveDraft(reopened, {...old, name:'过期改动'}, KEEP), conflict);
  assert.equal((await loadDraft(reopened)).status === 'ok', true);
  reopened.close();
});

test('commit, clear, and import without a draft invalidate every previously opened draft', async () => {
  for (const operation of ['commit', 'clear', 'import'] as const) {
    const db = await fresh();
    const old = await saveDraft(db, createDraft(createFishDesign(), 0, {name:'旧草稿'}), KEEP);
    if (operation === 'commit') await commitFish(db, {commandId:'cmd',fishId:'fish',mode:'create',draftRevision:old.revision,effects:[]});
    if (operation === 'clear') await clearAllData(db);
    if (operation === 'import') {
      const backup = buildBackup({fish:[],draft:null,settings:createSettings(),effects:[],discoveries:[],captures:[],assets:new Map()});
      const parsed = validateBackup(backup, 1000);
      if (!parsed.ok) assert.fail();
      await replaceProfile(db, parsed.value);
    }
    const empty = await loadDraft(db);
    if (empty.status !== 'empty') assert.fail();
    assert.ok(empty.revision > old.revision, operation);
    await assert.rejects(saveDraft(db, old, KEEP), conflict);
    const next = await saveDraft(db, createDraft(createFishDesign(), empty.revision), KEEP);
    await assert.rejects(discardDraft(db, old.revision), conflict);
    assert.equal((await loadDraft(db)).status === 'ok', true);
    assert.ok(next.revision > empty.revision);
    db.close();
  }
});

test('a failed discard rolls back both the document and its persistent revision', async () => {
  const db = await fresh();
  const draft = await saveDraft(db, createDraft(createFishDesign(), 0), KEEP);
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function(this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
    if (this.name === 'drafts') throw new DOMException('full','QuotaExceededError');
    return put.apply(this,args);
  };
  try { await assert.rejects(discardDraft(db,draft.revision)); }
  finally { IDBObjectStore.prototype.put = put; }
  const next = await saveDraft(db,{...draft,name:'仍可保存'},KEEP);
  assert.equal(next.revision,draft.revision+1);
  db.close();
});
