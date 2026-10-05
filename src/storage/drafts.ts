import { paintResolution } from '../catalog/fish.ts';
import { validateDraft } from '../domain/draft.ts';
import { isAssetId, setPaintAsset } from '../domain/fish.ts';
import type { EditorDraft, StoredAsset } from '../domain/types.ts';
import { completion, request, StorageError, toStorageError } from './db.ts';
import { notifyChange, serialWrite } from './queue.ts';

export const MAX_ASSET_BYTES = 2 * 1024 * 1024;
export type PaintChange = { kind: 'keep' } | { kind: 'replace'; asset: StoredAsset } | { kind: 'clear' };
export interface PaintChanges { color: PaintChange; glow: PaintChange }
export type LayerKey = keyof PaintChanges;
export interface LoadedLayer { blob: Blob | null; error: 'missing' | 'invalid' | null }
export type LoadedDraft =
  | { status: 'empty' }
  | { status: 'invalid'; errors: string[] }
  | { status: 'ok'; draft: EditorDraft; layers: Record<LayerKey, LoadedLayer> };

const assetField = { color: 'colorAssetId', glow: 'glowAssetId' } as const;

export function isValidAsset(value: unknown): value is StoredAsset {
  if (value === null || typeof value !== 'object') return false;
  const asset = value as Partial<StoredAsset>;
  return isAssetId(asset.id) && asset.mime === 'image/png' && asset.blob instanceof Blob
    && asset.width === paintResolution && asset.height === paintResolution
    && Number.isSafeInteger(asset.bytes) && asset.bytes === asset.blob.size && asset.blob.size > 0 && asset.blob.size <= MAX_ASSET_BYTES;
}

export async function loadDraft(db: IDBDatabase): Promise<LoadedDraft> {
  try {
    const tx = db.transaction(['drafts', 'assets'], 'readonly');
    const done = completion(tx);
    const raw = await request(tx.objectStore('drafts').get('current'));
    if (raw === undefined) { await done; return { status: 'empty' }; }
    const result = validateDraft(raw);
    if (!result.ok) { await done; return { status: 'invalid', errors: result.errors }; }
    const layers = {} as Record<LayerKey, LoadedLayer>;
    for (const key of ['color', 'glow'] as const) {
      const id = result.value.design.paint[assetField[key]];
      if (!id) { layers[key] = { blob: null, error: null }; continue; }
      const asset = await request(tx.objectStore('assets').get(id));
      layers[key] = asset === undefined ? { blob: null, error: 'missing' } : isValidAsset(asset) ? { blob: asset.blob, error: null } : { blob: null, error: 'invalid' };
    }
    await done;
    return { status: 'ok', draft: result.value, layers };
  } catch (error) { throw toStorageError(error); }
}

export function referencedBy(fish: unknown[], assetId: string) {
  return fish.some((item) => {
    const paint = (item as { design?: { paint?: Record<string, unknown> } } | null)?.design?.paint;
    return paint?.colorAssetId === assetId || paint?.glowAssetId === assetId;
  });
}
type StoredPaint = { colorAssetId?: unknown; glowAssetId?: unknown } | undefined;

/**
 * 以 draft.revision 作为期望修订号写入草稿；两层纹理与草稿在同一事务内写入，
 * 被替换且没有作品引用的旧纹理同时删除。PNG 编码须在调用前完成。
 */
export function saveDraft(db: IDBDatabase, draft: EditorDraft, paint: PaintChanges, now = new Date()): Promise<EditorDraft> {
  return serialWrite(() => writeDraft(db, draft, paint, now)).then((saved) => { notifyChange('draft'); return saved; });
}
async function writeDraft(db: IDBDatabase, draft: EditorDraft, paint: PaintChanges, now: Date): Promise<EditorDraft> {
  for (const change of [paint.color, paint.glow]) if (change.kind === 'replace' && !isValidAsset(change.asset)) throw new StorageError('invalid', '笔迹图片无效');
  let tx: IDBTransaction;
  try { tx = db.transaction(['drafts', 'assets', 'fish'], 'readwrite'); } catch (error) { throw toStorageError(error); }
  const done = completion(tx);
  try {
    const drafts = tx.objectStore('drafts'), assets = tx.objectStore('assets');
    const current = await request(drafts.get('current')) as { revision?: unknown; design?: { paint?: StoredPaint } } | undefined;
    const currentRevision = current && Number.isSafeInteger(current.revision) ? current.revision as number : 0;
    if (currentRevision !== draft.revision) throw new StorageError('conflict', '草稿已在另一个页面修改');
    const next = { color: draft.design.paint.colorAssetId, glow: draft.design.paint.glowAssetId };
    for (const key of ['color', 'glow'] as const) {
      const change = paint[key];
      if (change.kind === 'replace') { assets.put(change.asset); next[key] = change.asset.id; } else if (change.kind === 'clear') next[key] = null;
    }
    const saved: EditorDraft = { ...draft, revision: draft.revision + 1, design: setPaintAsset(draft.design, next.color, next.glow), updatedAt: now.toISOString() };
    drafts.put(saved);
    const previous = [current?.design?.paint?.colorAssetId, current?.design?.paint?.glowAssetId].filter(isAssetId)
      .filter((id) => id !== next.color && id !== next.glow);
    if (previous.length) {
      const fish = await request(tx.objectStore('fish').getAll());
      for (const id of previous) if (!referencedBy(fish, id)) assets.delete(id);
    }
    await done;
    return saved;
  } catch (error) {
    try { tx.abort(); } catch { /* 事务已结束 */ }
    await done.catch(() => undefined);
    throw toStorageError(error);
  }
}

/** 放弃无法读取的旧草稿：删除草稿及其未被作品引用的纹理。 */
export function discardDraft(db: IDBDatabase): Promise<void> {
  return serialWrite(() => removeDraft(db)).then(() => notifyChange('draft'));
}
async function removeDraft(db: IDBDatabase): Promise<void> {
  let tx: IDBTransaction;
  try { tx = db.transaction(['drafts', 'assets', 'fish'], 'readwrite'); } catch (error) { throw toStorageError(error); }
  const done = completion(tx);
  try {
    const current = await request(tx.objectStore('drafts').get('current')) as { design?: { paint?: StoredPaint } } | undefined;
    tx.objectStore('drafts').delete('current');
    const ids = [current?.design?.paint?.colorAssetId, current?.design?.paint?.glowAssetId].filter(isAssetId);
    if (ids.length) {
      const fish = await request(tx.objectStore('fish').getAll());
      for (const id of ids) if (!referencedBy(fish, id)) tx.objectStore('assets').delete(id);
    }
    await done;
  } catch (error) {
    try { tx.abort(); } catch { /* 事务已结束 */ }
    await done.catch(() => undefined);
    throw toStorageError(error);
  }
}
