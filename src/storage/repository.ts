import { MAX_CAPTURES, type Capture, type Discovery } from '../domain/backup.ts';
import { createDraft, createSettings, FISH_LIMIT, validateDraft, validateOriginalFish, validateSettings, VISIBLE_LIMIT } from '../domain/draft.ts';
import { isAssetId } from '../domain/fish.ts';
import type { EditorDraft, EffectDiscovery, EffectId, OceanEntry, OriginalFish, ProfileSettings } from '../domain/types.ts';
import { completion, request, StorageError, toStorageError } from './db.ts';
import { isValidAsset, referencedBy } from './drafts.ts';
import { notifyChange, serialWrite, type ChangeKind } from './queue.ts';

export interface Profile {
  fish: OriginalFish[];
  /** 读取时发现无法识别的作品记录：保留原样、不显示，也不覆盖。 */
  invalidFish: number;
  settings: ProfileSettings;
  effects: EffectDiscovery[];
  draft: EditorDraft | null;
}

/** 读写事务的统一包装：失败时整体回滚并转换成用户可理解的错误。 */
async function transact<T>(db: IDBDatabase, stores: string[], body: (tx: IDBTransaction) => Promise<T>, change: ChangeKind): Promise<T> {
  return serialWrite(async () => {
    let tx: IDBTransaction;
    try { tx = db.transaction(stores, 'readwrite'); } catch (error) { throw toStorageError(error); }
    const done = completion(tx);
    try {
      const result = await body(tx);
      await done;
      return result;
    } catch (error) {
      try { tx.abort(); } catch { /* 事务已结束 */ }
      await done.catch(() => undefined);
      throw toStorageError(error);
    }
  }).then((result) => { notifyChange(change); return result; });
}

async function readSettings(tx: IDBTransaction): Promise<ProfileSettings> {
  const raw = await request(tx.objectStore('settings').get('profile'));
  if (raw === undefined) return createSettings();
  const result = validateSettings(raw);
  if (!result.ok) throw new StorageError('invalid', '设置记录无法读取');
  return result.value;
}
/** 删除不再被任何作品或草稿引用的纹理。 */
async function cleanupAssets(tx: IDBTransaction, candidates: Array<string | null | undefined>) {
  const ids = [...new Set(candidates.filter(isAssetId))];
  if (!ids.length) return;
  const fish = await request(tx.objectStore('fish').getAll());
  const draft = await request(tx.objectStore('drafts').get('current'));
  const holders = draft ? [...fish, draft] : fish;
  for (const id of ids) if (!referencedBy(holders, id)) tx.objectStore('assets').delete(id);
}

export async function loadProfile(db: IDBDatabase): Promise<Profile> {
  try {
    const tx = db.transaction(['fish', 'settings', 'effectsDiscovered', 'drafts'], 'readonly');
    const done = completion(tx);
    const [rawFish, rawSettings, rawEffects, rawDraft] = await Promise.all([
      request(tx.objectStore('fish').getAll()), request(tx.objectStore('settings').get('profile')),
      request(tx.objectStore('effectsDiscovered').getAll()), request(tx.objectStore('drafts').get('current')),
    ]);
    await done;
    const fish: OriginalFish[] = [];
    let invalidFish = 0;
    for (const item of rawFish) { const result = validateOriginalFish(item); if (result.ok) fish.push(result.value); else invalidFish += 1; }
    fish.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    let settings = createSettings();
    if (rawSettings !== undefined) {
      const parsed = validateSettings(rawSettings);
      if (!parsed.ok) throw new StorageError('invalid', '设置记录无法读取');
      settings = parsed.value;
    }
    const draft = rawDraft === undefined ? null : validateDraft(rawDraft);
    return {
      fish, invalidFish, settings,
      effects: (rawEffects as EffectDiscovery[]).filter((item) => typeof item?.effectId === 'string'),
      draft: draft && draft.ok ? draft.value : null,
    };
  } catch (error) { throw toStorageError(error); }
}

/** 读取一组纹理，返回可直接绘制的 Blob；缺失或无效的纹理不返回。 */
export async function loadAssets(db: IDBDatabase, ids: Array<string | null>): Promise<Map<string, Blob>> {
  try {
    const tx = db.transaction('assets', 'readonly');
    const done = completion(tx);
    const result = new Map<string, Blob>();
    for (const id of new Set(ids.filter(isAssetId))) {
      const asset = await request(tx.objectStore('assets').get(id));
      if (isValidAsset(asset)) result.set(id, asset.blob);
    }
    await done;
    return result;
  } catch (error) { throw toStorageError(error); }
}

export type CommitMode = 'create' | 'update' | 'saveAs';
export interface CommitRequest {
  /** 一次“放入海洋”的凭证；重试时复用，重复提交返回已有结果。 */
  commandId: string;
  /** 新建/另存时预先生成的作品 ID；更新时为原作品 ID。 */
  fishId: string;
  mode: CommitMode;
  /** 期望的草稿修订号：提交的是这一版草稿，不是之后的改动。 */
  draftRevision: number;
  /** 满足条件的彩蛋（按优先级）；全部记为已发现，第一个用于显示。 */
  effects: EffectId[];
}
export interface CommitResult { fish: OriginalFish; repeated: boolean; hidden: OceanEntry | null }

/**
 * 把草稿保存为作品：同一事务内写作品、展示列表、彩蛋发现并删除草稿。
 * 新建或另存满 30 条时拒绝并保留草稿；更新时比较原作品修订号，不静默覆盖。
 */
export function commitFish(db: IDBDatabase, input: CommitRequest, now = new Date()): Promise<CommitResult> {
  if (!isAssetId(input.commandId) || !isAssetId(input.fishId)) return Promise.reject(new StorageError('invalid', '提交凭证无效'));
  return transact(db, ['drafts', 'fish', 'assets', 'settings', 'effectsDiscovered'], async (tx) => {
    const fishStore = tx.objectStore('fish');
    const existingRaw = await request(fishStore.get(input.fishId));
    const existing = existingRaw === undefined ? null : validateOriginalFish(existingRaw);
    if (existing?.ok && existing.value.lastCommandId === input.commandId) return { fish: existing.value, repeated: true, hidden: null };
    const rawDraft = await request(tx.objectStore('drafts').get('current'));
    if (rawDraft === undefined) throw new StorageError('conflict', '草稿已经不在了，可能已在另一个页面保存');
    const parsed = validateDraft(rawDraft);
    if (!parsed.ok) throw new StorageError('invalid', '草稿无法读取');
    const draft = parsed.value;
    if (draft.revision !== input.draftRevision) throw new StorageError('conflict', '草稿已在另一个页面修改');
    const name = draft.name.trim();
    if (!name) throw new StorageError('invalid', '作品需要一个名字');
    const time = now.toISOString();
    let fish: OriginalFish;
    let replacedAssets: Array<string | null> = [];
    if (input.mode === 'update') {
      if (draft.sourceFishId !== input.fishId) throw new StorageError('invalid', '草稿不是这条鱼的编辑');
      if (!existing) throw new StorageError('missing', '原来的作品已经不在了，可以另存为新鱼');
      if (!existing.ok) throw new StorageError('invalid', '原来的作品无法读取');
      if (existing.value.revision !== draft.sourceFishRevision) throw new StorageError('conflict', '这条鱼已在另一个页面更新过');
      fish = { ...existing.value, revision: existing.value.revision + 1, updatedAt: time, name, personality: draft.personality,
        preferredHabitat: draft.preferredHabitat, effectEnabled: draft.effectEnabled, design: draft.design,
        activeEffect: draft.effectEnabled ? input.effects[0] ?? null : null, lastCommandId: input.commandId };
      replacedAssets = [existing.value.design.paint.colorAssetId, existing.value.design.paint.glowAssetId];
    } else {
      if (existing) throw new StorageError('conflict', '作品 ID 已被使用');
      const count = (await request(fishStore.getAllKeys())).length;
      if (count >= FISH_LIMIT) throw new StorageError('limit', `最多保存 ${FISH_LIMIT} 条原创鱼；先删除或备份一些作品，草稿会一直保留`);
      fish = { id: input.fishId, revision: 1, createdAt: time, updatedAt: time, name, personality: draft.personality,
        preferredHabitat: draft.preferredHabitat, effectEnabled: draft.effectEnabled, design: draft.design,
        activeEffect: draft.effectEnabled ? input.effects[0] ?? null : null, ruleVersion: 1, lastCommandId: input.commandId };
    }
    for (const id of [fish.design.paint.colorAssetId, fish.design.paint.glowAssetId]) {
      if (id && !isValidAsset(await request(tx.objectStore('assets').get(id)))) throw new StorageError('invalid', '笔迹图片缺失，请再画一笔后重试');
    }
    fishStore.put(fish);
    // 新鱼入海：放进展示列表；已满 20 个时只收起最早的一个，不删除。
    const settings = await readSettings(tx);
    let hidden: OceanEntry | null = null;
    if (!settings.visibleEntries.some((entry) => entry.kind === 'original' && entry.fishId === fish.id)) {
      const entries = [...settings.visibleEntries, { kind: 'original' as const, fishId: fish.id }];
      if (entries.length > VISIBLE_LIMIT) hidden = entries.shift() ?? null;
      tx.objectStore('settings').put({ ...settings, revision: settings.revision + 1, visibleEntries: entries });
    }
    const effects = tx.objectStore('effectsDiscovered');
    for (const effectId of input.effects) {
      if ((await request(effects.get(effectId))) === undefined) effects.put({ effectId, firstDiscoveredAt: time });
    }
    tx.objectStore('drafts').delete('current');
    await cleanupAssets(tx, replacedAssets);
    return { fish, repeated: false, hidden };
  }, 'fish');
}

/** 删除一条原创鱼：同时移出展示列表并清理只属于它的纹理；已发现的真实物种不受影响。 */
export function deleteFish(db: IDBDatabase, id: string, expectedRevision: number): Promise<void> {
  return transact(db, ['fish', 'settings', 'assets', 'drafts'], async (tx) => {
    const raw = await request(tx.objectStore('fish').get(id));
    if (raw === undefined) throw new StorageError('missing', '这条鱼已经不在了');
    const parsed = validateOriginalFish(raw);
    if (!parsed.ok) throw new StorageError('invalid', '作品无法读取');
    if (parsed.value.revision !== expectedRevision) throw new StorageError('conflict', '这条鱼刚在另一个页面改过，请刷新后再删');
    tx.objectStore('fish').delete(id);
    const settings = await readSettings(tx);
    const entries = settings.visibleEntries.filter((entry) => !(entry.kind === 'original' && entry.fishId === id));
    if (entries.length !== settings.visibleEntries.length) tx.objectStore('settings').put({ ...settings, revision: settings.revision + 1, visibleEntries: entries });
    await cleanupAssets(tx, [parsed.value.design.paint.colorAssetId, parsed.value.design.paint.glowAssetId]);
  }, 'fish');
}

/** 更新展示列表：去重、最多 20 个、只能引用已有作品（访客需已有发现记录，步骤 09 开放）。 */
export function setVisibleEntries(db: IDBDatabase, entries: OceanEntry[], expectedRevision: number): Promise<ProfileSettings> {
  return transact(db, ['settings', 'fish', 'discoveries'], async (tx) => {
    const settings = await readSettings(tx);
    if (settings.revision !== expectedRevision) throw new StorageError('conflict', '展示列表已在另一个页面修改');
    const keys = entries.map((entry) => entry.kind === 'original' ? `o:${entry.fishId}` : `v:${entry.speciesId}`);
    if (new Set(keys).size !== keys.length) throw new StorageError('invalid', '展示列表有重复项');
    if (entries.length > VISIBLE_LIMIT) throw new StorageError('limit', `同屏最多展示 ${VISIBLE_LIMIT} 条`);
    for (const entry of entries) {
      const found = entry.kind === 'original' ? await request(tx.objectStore('fish').get(entry.fishId)) : await request(tx.objectStore('discoveries').get(entry.speciesId));
      if (found === undefined) throw new StorageError('invalid', '展示列表引用了不存在的鱼');
    }
    const next = { ...settings, revision: settings.revision + 1, visibleEntries: entries };
    tx.objectStore('settings').put(next);
    return next;
  }, 'settings');
}

export type EditStart = { status: 'started'; draft: EditorDraft } | { status: 'draft-exists'; draft: EditorDraft } | { status: 'resumed'; draft: EditorDraft };
/**
 * 再次编辑：从作品复制一份草稿（共用不可变纹理）。已有其他草稿时不覆盖，
 * 除非调用方确认替换；草稿本来就在编辑这条鱼时直接继续。
 */
export function startEditFromFish(db: IDBDatabase, fishId: string, replace = false): Promise<EditStart> {
  return transact(db, ['fish', 'drafts', 'assets'], async (tx) => {
    const raw = await request(tx.objectStore('fish').get(fishId));
    if (raw === undefined) throw new StorageError('missing', '找不到这条鱼');
    const parsed = validateOriginalFish(raw);
    if (!parsed.ok) throw new StorageError('invalid', '作品无法读取');
    const fish = parsed.value;
    const rawDraft = await request(tx.objectStore('drafts').get('current'));
    const current = rawDraft === undefined ? null : validateDraft(rawDraft);
    if (current?.ok && current.value.sourceFishId === fishId && current.value.sourceFishRevision === fish.revision) return { status: 'resumed', draft: current.value };
    if (current?.ok && !replace) return { status: 'draft-exists', draft: current.value };
    const revision = current?.ok ? current.value.revision + 1 : Number.isSafeInteger((rawDraft as { revision?: number } | undefined)?.revision) ? (rawDraft as { revision: number }).revision + 1 : 1;
    const draft = createDraft(fish.design, revision, { name: fish.name, personality: fish.personality, preferredHabitat: fish.preferredHabitat,
      effectEnabled: fish.effectEnabled, sourceFishId: fish.id, sourceFishRevision: fish.revision });
    tx.objectStore('drafts').put(draft);
    const old = current?.ok ? current.value.design.paint : (rawDraft as { design?: { paint?: { colorAssetId?: string; glowAssetId?: string } } } | undefined)?.design?.paint;
    await cleanupAssets(tx, [old?.colorAssetId, old?.glowAssetId]);
    return { status: 'started', draft };
  }, 'draft');
}

export interface CaptureResult { discovery: Discovery; firstDiscovery: boolean; repeated: boolean }
/**
 * 记录一次捕获：同一事务内写捕获凭证并更新发现条目。同一 attemptId 再次提交直接返回原结果，
 * 不增加次数，首次发现时间保持不变。凭证最多保留 10,000 条，超出时清理最旧的，累计统计保留。
 */
export function recordCapture(db: IDBDatabase, attemptId: string, speciesId: string, now = new Date()): Promise<CaptureResult> {
  if (!isAssetId(attemptId) || !isAssetId(speciesId)) return Promise.reject(new StorageError('invalid', '捕获记录无效'));
  return transact(db, ['captures', 'discoveries'], async (tx) => {
    const captures = tx.objectStore('captures'), discoveries = tx.objectStore('discoveries');
    const previous = await request(captures.get(attemptId)) as Capture | undefined;
    if (previous) {
      const discovery = await request(discoveries.get(previous.speciesId)) as Discovery;
      return { discovery, firstDiscovery: false, repeated: true };
    }
    const time = now.toISOString();
    const existing = await request(discoveries.get(speciesId)) as Discovery | undefined;
    const discovery: Discovery = existing
      ? { ...existing, lastCaughtAt: time, catchCount: existing.catchCount + 1 }
      : { speciesId, firstCaughtAt: time, lastCaughtAt: time, catchCount: 1 };
    captures.put({ attemptId, speciesId, caughtAt: time });
    discoveries.put(discovery);
    const all = await request(captures.getAll()) as Capture[];
    if (all.length > MAX_CAPTURES) {
      all.sort((a, b) => a.caughtAt.localeCompare(b.caughtAt));
      for (const old of all.slice(0, all.length - MAX_CAPTURES)) captures.delete(old.attemptId);
    }
    return { discovery, firstDiscovery: !existing, repeated: false };
  }, 'discovery');
}

export async function loadDiscoveries(db: IDBDatabase): Promise<Discovery[]> {
  try {
    const tx = db.transaction('discoveries', 'readonly');
    const done = completion(tx);
    const all = await request(tx.objectStore('discoveries').getAll()) as Discovery[];
    await done;
    return all.filter((item) => isAssetId(item?.speciesId));
  } catch (error) { throw toStorageError(error); }
}

/** 更新体验偏好（声音、辅助、减少动态）；比较修订号。 */
export function updatePreferences(db: IDBDatabase, patch: Partial<Pick<ProfileSettings, 'soundEnabled' | 'reducedMotion' | 'assistMode'>>, expectedRevision: number): Promise<ProfileSettings> {
  return transact(db, ['settings'], async (tx) => {
    const settings = await readSettings(tx);
    if (settings.revision !== expectedRevision) throw new StorageError('conflict', '设置已在另一个页面修改');
    const next = { ...settings, ...patch, revision: settings.revision + 1 };
    tx.objectStore('settings').put(next);
    return next;
  }, 'settings');
}

/** 清空全部本地数据（作品、草稿、图鉴、凭证、彩蛋、设置）。界面须二次确认。 */
export function clearAllData(db: IDBDatabase): Promise<void> {
  return transact(db, ['fish', 'drafts', 'assets', 'discoveries', 'captures', 'effectsDiscovered', 'settings'], async (tx) => {
    for (const name of ['fish', 'drafts', 'assets', 'discoveries', 'captures', 'effectsDiscovered', 'settings']) tx.objectStore(name).clear();
  }, 'profile');
}
