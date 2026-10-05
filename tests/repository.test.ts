import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { buildBackup, MAX_BACKUP_BYTES, validateBackup } from '../src/domain/backup.ts';
import { createDraft } from '../src/domain/draft.ts';
import { changeColor, createFishDesign, setPaintAsset } from '../src/domain/fish.ts';
import type { StoredAsset } from '../src/domain/types.ts';
import { openDatabase, request, StorageError } from '../src/storage/db.ts';
import { exportProfile, replaceProfile } from '../src/storage/backup.ts';
import { loadDraft, saveDraft } from '../src/storage/drafts.ts';
import { clearAllData, commitFish, deleteFish, loadDiscoveries, loadProfile, recordCapture, setVisibleEntries, startEditFromFish, updatePreferences } from '../src/storage/repository.ts';
import { pngBytes } from './pngFixture.ts';

const png = (id: string, seed = 1): StoredAsset => {
  const blob = new Blob([pngBytes(seed)], { type: 'image/png' });
  return { id, mime: 'image/png', blob, bytes: blob.size, width: 512, height: 512 };
};
const KEEP = { kind: 'keep' } as const;
const isKind = (kind: string) => (error: unknown) => error instanceof StorageError && error.kind === kind;
const assetIds = async (db: IDBDatabase) => (await request(db.transaction('assets').objectStore('assets').getAllKeys())).sort();
let counter = 0;
const id = (prefix: string) => `${prefix}-${++counter}`;

/** 写入一份带纹理的草稿，返回其修订号。 */
async function draftWith(db: IDBDatabase, name: string, asset?: StoredAsset, base = createDraft(createFishDesign(), 0)) {
  const current = await loadDraft(db);
  const saved = await saveDraft(db, { ...base, name, revision: current.status === 'ok' ? current.draft.revision : current.revision }, { color: asset ? { kind: 'replace', asset } : KEEP, glow: KEEP });
  return saved.revision;
}
const fresh = () => openDatabase(new IDBFactory());

test('saving a fish is idempotent: double submit and retry produce one fish (A09)', async () => {
  const db = await fresh();
  const revision = await draftWith(db, '小橙', png('paint-1'));
  const request1 = { commandId: id('cmd'), fishId: id('fish'), mode: 'create' as const, draftRevision: revision, effects: [] };
  const [first, second] = await Promise.all([commitFish(db, request1), commitFish(db, request1)]);
  assert.equal(first.repeated, false);
  assert.equal(second.repeated, true);
  const retry = await commitFish(db, request1);
  assert.equal(retry.fish.id, first.fish.id);
  const profile = await loadProfile(db);
  assert.equal(profile.fish.length, 1);
  assert.equal(profile.draft, null, 'draft cleared after commit');
  assert.deepEqual(profile.settings.visibleEntries, [{ kind: 'original', fishId: first.fish.id }]);
  assert.deepEqual(await assetIds(db), ['paint-1'], 'texture now belongs to the fish');
  db.close();
});

test('commit freezes the expected draft revision and requires a name', async () => {
  const db = await fresh();
  const revision = await draftWith(db, '');
  await assert.rejects(commitFish(db, { commandId: id('cmd'), fishId: id('fish'), mode: 'create', draftRevision: revision, effects: [] }), isKind('invalid'));
  const named = await draftWith(db, '  小蓝  ');
  await assert.rejects(commitFish(db, { commandId: id('cmd'), fishId: id('fish'), mode: 'create', draftRevision: named - 1, effects: [] }), isKind('conflict'));
  const saved = await commitFish(db, { commandId: id('cmd'), fishId: id('fish'), mode: 'create', draftRevision: named, effects: [] });
  assert.equal(saved.fish.name, '小蓝');
  db.close();
});

test('re-editing updates the same fish; a stale edit cannot overwrite it; save-as adds a new one (A09/A13)', async () => {
  const db = await fresh();
  const created = await commitFish(db, { commandId: id('cmd'), fishId: id('fish'), mode: 'create', draftRevision: await draftWith(db, '原版', png('old-paint')), effects: [] });
  const fishId = created.fish.id;
  const start = await startEditFromFish(db, fishId);
  assert.equal(start.status, 'started');
  assert.equal(start.draft.sourceFishId, fishId);
  const edited = await saveDraft(db, { ...start.draft, design: changeColor(start.draft.design, 'body', '#24486B') }, { color: { kind: 'replace', asset: png('new-paint', 2) }, glow: KEEP });
  const updated = await commitFish(db, { commandId: id('cmd'), fishId, mode: 'update', draftRevision: edited.revision, effects: [] });
  assert.equal(updated.fish.id, fishId);
  assert.equal(updated.fish.revision, 2);
  assert.equal(updated.fish.createdAt, created.fish.createdAt);
  assert.equal(updated.fish.design.colors.body, '#24486B');
  assert.deepEqual(await assetIds(db), ['new-paint'], 'replaced texture cleaned up');

  // 两个标签页：A 从 revision 2 开始编辑，B 先更新到 3，A 再提交 → 冲突。
  const tabA = await startEditFromFish(db, fishId);
  const tabB = await startEditFromFish(db, fishId);
  assert.equal(tabB.status, 'resumed');
  const bDraft = await saveDraft(db, { ...tabB.draft, name: 'B 改的' }, { color: KEEP, glow: KEEP });
  await commitFish(db, { commandId: id('cmd'), fishId, mode: 'update', draftRevision: bDraft.revision, effects: [] });
  await assert.rejects(saveDraft(db, { ...tabA.draft, name: 'A 改的' }, { color: KEEP, glow: KEEP }), isKind('conflict'));
  const empty = await loadDraft(db);
  assert.equal(empty.status, 'empty');
  if (empty.status !== 'empty') return;
  // 用最新草稿版本恢复 A 的内存作品，但来源作品版本仍旧，更新原鱼必须拒绝。
  const staleDraft = createDraft(tabA.draft.design, empty.revision, { name: 'A 改的', sourceFishId: fishId, sourceFishRevision: 2 });
  const recovered = await saveDraft(db, staleDraft, { color: KEEP, glow: KEEP });
  await assert.rejects(commitFish(db, { commandId: id('cmd'), fishId, mode: 'update', draftRevision: recovered.revision, effects: [] }), isKind('conflict'));
  assert.equal((await loadProfile(db)).fish[0]!.name, 'B 改的');

  // 另存为新鱼：原作品不变，共用的纹理在两者都删除前保留。
  const asNew = await commitFish(db, { commandId: id('cmd'), fishId: id('fish'), mode: 'saveAs', draftRevision: recovered.revision, effects: [] });
  const profile = await loadProfile(db);
  assert.deepEqual(profile.fish.map((fish) => fish.name).sort(), ['A 改的', 'B 改的']);
  assert.equal(profile.fish.find((fish) => fish.id === fishId)!.revision, 3);
  await deleteFish(db, fishId, 3);
  assert.deepEqual(await assetIds(db), ['new-paint'], 'shared texture kept for the save-as copy');
  await deleteFish(db, asNew.fish.id, 1);
  assert.deepEqual(await assetIds(db), []);
  db.close();
});

test('20 visible / 30 saved limits: the earliest visible is only hidden; the 31st keeps its draft (A10)', async () => {
  const db = await fresh();
  const ids: string[] = [];
  for (let i = 0; i < 30; i += 1) {
    const result = await commitFish(db, { commandId: id('cmd'), fishId: id('fish'), mode: 'create', draftRevision: await draftWith(db, `鱼${i}`), effects: [] });
    ids.push(result.fish.id);
    if (i === 20) assert.deepEqual(result.hidden, { kind: 'original', fishId: ids[0] });
  }
  let profile = await loadProfile(db);
  assert.equal(profile.fish.length, 30);
  assert.equal(profile.settings.visibleEntries.length, 20);
  assert.deepEqual(profile.settings.visibleEntries.map((entry) => entry.kind === 'original' && entry.fishId), ids.slice(10));
  const revision = await draftWith(db, '第31条', png('keep-me'));
  await assert.rejects(commitFish(db, { commandId: id('cmd'), fishId: id('fish'), mode: 'create', draftRevision: revision, effects: [] }), isKind('limit'));
  profile = await loadProfile(db);
  assert.equal(profile.fish.length, 30);
  assert.equal(profile.draft?.name, '第31条');
  assert.ok((await assetIds(db)).includes('keep-me'));
  db.close();
});

test('visible list edits are validated and revision-checked; deleting removes the entry', async () => {
  const db = await fresh();
  const a = await commitFish(db, { commandId: id('cmd'), fishId: id('fish'), mode: 'create', draftRevision: await draftWith(db, 'A'), effects: [] });
  const b = await commitFish(db, { commandId: id('cmd'), fishId: id('fish'), mode: 'create', draftRevision: await draftWith(db, 'B'), effects: [] });
  let settings = (await loadProfile(db)).settings;
  settings = await setVisibleEntries(db, [{ kind: 'original', fishId: b.fish.id }], settings.revision);
  assert.deepEqual(settings.visibleEntries, [{ kind: 'original', fishId: b.fish.id }]);
  await assert.rejects(setVisibleEntries(db, [], settings.revision - 1), isKind('conflict'));
  await assert.rejects(setVisibleEntries(db, [{ kind: 'original', fishId: a.fish.id }, { kind: 'original', fishId: a.fish.id }], settings.revision), isKind('invalid'));
  await assert.rejects(setVisibleEntries(db, [{ kind: 'original', fishId: 'nope' }], settings.revision), isKind('invalid'));
  await assert.rejects(setVisibleEntries(db, [{ kind: 'visitor', speciesId: 'clownfish' }], settings.revision), isKind('invalid'));
  await assert.rejects(deleteFish(db, b.fish.id, 99), isKind('conflict'));
  await deleteFish(db, b.fish.id, 1);
  const profile = await loadProfile(db);
  assert.deepEqual(profile.fish.map((fish) => fish.id), [a.fish.id]);
  assert.deepEqual(profile.settings.visibleEntries, []);
  await assert.rejects(deleteFish(db, b.fish.id, 1), isKind('missing'));
  db.close();
});

test('re-editing never silently replaces another draft; cancelling leaves the saved fish untouched (A11)', async () => {
  const db = await fresh();
  const fish = (await commitFish(db, { commandId: id('cmd'), fishId: id('fish'), mode: 'create', draftRevision: await draftWith(db, '海洋里的'), effects: [] })).fish;
  await draftWith(db, '另一条草稿', png('other-draft'));
  const blocked = await startEditFromFish(db, fish.id);
  assert.equal(blocked.status, 'draft-exists');
  assert.equal((await loadProfile(db)).draft?.name, '另一条草稿');
  const replaced = await startEditFromFish(db, fish.id, blocked.draft.revision);
  assert.equal(replaced.status, 'started');
  assert.deepEqual(await assetIds(db), [], 'replaced draft texture cleaned');
  await saveDraft(db, { ...replaced.draft, name: '改了一半' }, { color: KEEP, glow: KEEP });
  assert.equal((await loadProfile(db)).fish[0]!.name, '海洋里的', 'draft edits do not touch the saved fish');
  await assert.rejects(startEditFromFish(db, 'missing-fish'), isKind('missing'));
  db.close();
});

test('effect discoveries are recorded once with the first time; the displayed effect respects the switch', async () => {
  const db = await fresh();
  const t1 = new Date('2026-10-01T00:00:00Z'), t2 = new Date('2026-10-02T00:00:00Z');
  const first = await commitFish(db, { commandId: id('cmd'), fishId: id('fish'), mode: 'create', draftRevision: await draftWith(db, 'A'), effects: ['ribbon', 'bubbles'] }, t1);
  assert.equal(first.fish.activeEffect, 'ribbon');
  const off = createDraft(createFishDesign(), 0, { name: 'B', effectEnabled: false });
  const second = await commitFish(db, { commandId: id('cmd'), fishId: id('fish'), mode: 'create', draftRevision: await draftWith(db, 'B', undefined, off), effects: ['bubbles'] }, t2);
  assert.equal(second.fish.activeEffect, null);
  const effects = (await loadProfile(db)).effects.sort((a, b) => a.effectId.localeCompare(b.effectId));
  assert.deepEqual(effects, [{ effectId: 'bubbles', firstDiscoveredAt: t1.toISOString() }, { effectId: 'ribbon', firstDiscoveredAt: t1.toISOString() }]);
  db.close();
});

test('a failed commit (quota) leaves fish, draft and textures as they were (A12)', async () => {
  const db = await fresh();
  const revision = await draftWith(db, '保存失败也在', png('draft-paint'));
  const original = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
    if (this.name === 'settings') throw new DOMException('full', 'QuotaExceededError');
    return original.apply(this, args);
  };
  try {
    await assert.rejects(commitFish(db, { commandId: id('cmd'), fishId: id('fish'), mode: 'create', draftRevision: revision, effects: ['ribbon'] }), isKind('quota'));
  } finally { IDBObjectStore.prototype.put = original; }
  const profile = await loadProfile(db);
  assert.equal(profile.fish.length, 0);
  assert.equal(profile.draft?.name, '保存失败也在');
  assert.equal(profile.effects.length, 0);
  assert.deepEqual(await assetIds(db), ['draft-paint']);
  db.close();
});

async function populated() {
  const db = await fresh();
  const color = png('c-1', 3), glow = png('g-1', 4);
  const base = createDraft(setPaintAsset(createFishDesign(), null, null), 0);
  const revision = (await saveDraft(db, { ...base, name: '发光鱼' }, { color: { kind: 'replace', asset: color }, glow: { kind: 'replace', asset: glow } })).revision;
  await commitFish(db, { commandId: id('cmd'), fishId: id('fish'), mode: 'create', draftRevision: revision, effects: ['starry'] });
  await draftWith(db, '还没画完', png('d-1', 5));
  return db;
}

test('backup round-trip restores fish, both texture layers, draft, effects and the visible list (A21)', async () => {
  const source = await populated();
  const backup = await exportProfile(source);
  const text = JSON.stringify(backup);
  const parsed = validateBackup(JSON.parse(text), text.length);
  assert.equal(parsed.ok, true, parsed.ok ? '' : parsed.errors.join('; '));
  if (!parsed.ok) return;
  assert.deepEqual(parsed.summary, { fish: 1, hasDraft: true, effects: 1, discoveries: 0 });
  const target = await fresh();
  await commitFish(target, { commandId: id('cmd'), fishId: id('fish'), mode: 'create', draftRevision: await draftWith(target, '会被替换'), effects: [] });
  await replaceProfile(target, parsed.value);
  const [before, after] = [await loadProfile(source), await loadProfile(target)];
  assert.deepEqual(after.fish, before.fish);
  assert.deepEqual(after.effects, before.effects);
  assert.deepEqual(after.settings.visibleEntries, before.settings.visibleEntries);
  assert.equal(after.draft?.name, '还没画完');
  assert.deepEqual(await assetIds(target), ['c-1', 'd-1', 'g-1']);
  const blob = (await request(target.transaction('assets').objectStore('assets').get('g-1')) as StoredAsset).blob;
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), pngBytes(4));
  source.close(); target.close();
});

test('broken, oversized, future or incomplete backups are rejected before anything is replaced (A22)', async () => {
  const db = await populated();
  const good = await exportProfile(db);
  const size = JSON.stringify(good).length;
  const variants: Array<[string, unknown, number?]> = [
    ['format', { ...good, format: 'other' }],
    ['future', { ...good, schemaVersion: 2 }],
    ['catalog', { ...good, catalogVersion: 99 }],
    ['oversize', good, MAX_BACKUP_BYTES + 1],
    ['too many fish', { ...good, fish: Array.from({ length: 31 }, (_, i) => ({ ...good.fish[0], id: `f${i}` })) }],
    ['duplicate id', { ...good, fish: [good.fish[0], good.fish[0]] }],
    ['missing asset', { ...good, assets: {} }],
    ['bad png size', { ...good, assets: { ...good.assets, 'c-1': Buffer.from(pngBytes(3, 256, 256)).toString('base64') } }],
    ['not png', { ...good, assets: { ...good.assets, 'c-1': Buffer.from('hello').toString('base64') } }],
    ['bad color', { ...good, fish: [{ ...good.fish[0], design: { ...good.fish[0]!.design, colors: { ...good.fish[0]!.design.colors, body: 'red' } } }] }],
    ['dangling visible', { ...good, settings: { ...good.settings, visibleEntries: [{ kind: 'original', fishId: 'ghost' }] } }],
    ['bad name', { ...good, fish: [{ ...good.fish[0], name: '' }] }],
  ];
  for (const [label, value, bytes] of variants) {
    const result = validateBackup(JSON.parse(JSON.stringify(value)), bytes ?? size);
    assert.equal(result.ok, false, label);
  }
  const extra = validateBackup({ ...good, fish: [{ ...good.fish[0], script: '<img onerror>' }], injected: true }, size);
  assert.equal(extra.ok, true);
  assert.equal(extra.ok && 'script' in extra.value.fish[0]!, false, 'unknown fields are dropped');
  db.close();
});

test('an import that fails mid-transaction rolls back completely (A23)', async () => {
  const db = await populated();
  const before = await loadProfile(db);
  const other = await fresh();
  const otherRevision = await draftWith(other, '导入用');
  await commitFish(other, { commandId: id('cmd'), fishId: id('fish'), mode: 'create', draftRevision: otherRevision, effects: [] });
  const backup = await exportProfile(other);
  const parsed = validateBackup(backup, JSON.stringify(backup).length);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const original = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
    if (this.name === 'settings') throw new DOMException('denied', 'UnknownError');
    return original.apply(this, args);
  };
  try { await assert.rejects(replaceProfile(db, parsed.value)); } finally { IDBObjectStore.prototype.put = original; }
  const after = await loadProfile(db);
  assert.deepEqual(after, before);
  assert.deepEqual(await assetIds(db), ['c-1', 'd-1', 'g-1']);
  db.close(); other.close();
});

test('buildBackup output passes its own validation', () => {
  const draft = createDraft(createFishDesign(), 1, { name: '临时' });
  const backup = buildBackup({ fish: [], draft, settings: { id: 'profile', schemaVersion: 1, revision: 0, visibleEntries: [], soundEnabled: false, reducedMotion: false, assistMode: false }, effects: [], discoveries: [], captures: [], assets: new Map() });
  const result = validateBackup(JSON.parse(JSON.stringify(backup)), 1000);
  assert.equal(result.ok, true);
});

test('a capture is counted once per attempt, keeps the first discovery time, and survives refresh (A18)', async () => {
  const factory = new IDBFactory();
  const db = await openDatabase(factory);
  const t1 = new Date('2026-10-01T00:00:00Z'), t2 = new Date('2026-10-02T00:00:00Z'), t3 = new Date('2026-10-03T00:00:00Z');
  const [first, again] = await Promise.all([recordCapture(db, 'attempt-1', 'clownfish', t1), recordCapture(db, 'attempt-1', 'clownfish', t2)]);
  assert.deepEqual([first.firstDiscovery, first.repeated, again.repeated], [true, false, true]);
  assert.equal(again.discovery.catchCount, 1);
  const second = await recordCapture(db, 'attempt-2', 'clownfish', t3);
  assert.deepEqual([second.firstDiscovery, second.discovery.catchCount, second.discovery.firstCaughtAt, second.discovery.lastCaughtAt], [false, 2, t1.toISOString(), t3.toISOString()]);
  db.close();
  // 刷新：重新打开同一个数据库，再提交同一凭证仍不重复计数。
  const reopened = await openDatabase(factory);
  const replay = await recordCapture(reopened, 'attempt-2', 'clownfish', new Date());
  assert.deepEqual([replay.repeated, replay.discovery.catchCount, replay.discovery.firstCaughtAt], [true, 2, t1.toISOString()]);
  await assert.rejects(recordCapture(reopened, 'bad id!', 'clownfish'), isKind('invalid'));
  reopened.close();
});

test('discovered species can be shown as visitors once each; preferences and clear-all are revision-safe', async () => {
  const db = await fresh();
  await recordCapture(db, 'a1', 'yellow-tang');
  assert.deepEqual((await loadDiscoveries(db)).map((d) => d.speciesId), ['yellow-tang']);
  let settings = (await loadProfile(db)).settings;
  settings = await setVisibleEntries(db, [{ kind: 'visitor', speciesId: 'yellow-tang' }], settings.revision);
  await assert.rejects(setVisibleEntries(db, [{ kind: 'visitor', speciesId: 'yellow-tang' }, { kind: 'visitor', speciesId: 'yellow-tang' }], settings.revision), isKind('invalid'));
  settings = await updatePreferences(db, { assistMode: true, soundEnabled: true }, settings.revision);
  assert.deepEqual([settings.assistMode, settings.soundEnabled, settings.reducedMotion], [true, true, false]);
  await assert.rejects(updatePreferences(db, { reducedMotion: true }, settings.revision - 1), isKind('conflict'));
  await commitFish(db, { commandId: id('cmd'), fishId: id('fish'), mode: 'create', draftRevision: await draftWith(db, '要清空', png('x-1')), effects: ['ribbon'] });
  await clearAllData(db);
  const empty = await loadProfile(db);
  assert.deepEqual([empty.fish.length, empty.effects.length, empty.draft, empty.settings.visibleEntries.length], [0, 0, null, 0]);
  assert.deepEqual(await loadDiscoveries(db), []);
  assert.deepEqual(await assetIds(db), []);
  db.close();
});

test('a backup restores both play modes: creations, discoveries, capture tokens and visitors (A21, step 09)', async () => {
  const source = await populated();
  await recordCapture(source, 'attempt-a', 'amphiprion-ocellaris', new Date('2026-10-01T00:00:00Z'));
  await recordCapture(source, 'attempt-b', 'amphiprion-ocellaris', new Date('2026-10-02T00:00:00Z'));
  let settings = (await loadProfile(source)).settings;
  settings = await setVisibleEntries(source, [...settings.visibleEntries, { kind: 'visitor', speciesId: 'amphiprion-ocellaris' }], settings.revision);
  const backup = await exportProfile(source);
  const parsed = validateBackup(JSON.parse(JSON.stringify(backup)), JSON.stringify(backup).length);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.summary.discoveries, 1);
  const target = await fresh();
  await replaceProfile(target, parsed.value);
  const [discovery] = await loadDiscoveries(target);
  assert.deepEqual([discovery!.catchCount, discovery!.firstCaughtAt], [2, '2026-10-01T00:00:00.000Z']);
  assert.equal((await recordCapture(target, 'attempt-a', 'amphiprion-ocellaris')).repeated, true, 'imported tokens still prevent double counting');
  assert.deepEqual((await loadProfile(target)).settings.visibleEntries, settings.visibleEntries);
  source.close(); target.close();
});
