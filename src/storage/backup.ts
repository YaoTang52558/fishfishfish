import { paintResolution } from '../catalog/fish.ts';
import { buildBackup, referencedAssetIds, type BackupData, type Capture, type Discovery } from '../domain/backup.ts';
import { createSettings } from '../domain/draft.ts';
import { completion, request, toStorageError } from './db.ts';
import { notifyChange, serialWrite } from './queue.ts';
import { loadProfile } from './repository.ts';
import { advanceDraftRevision, readDraftRevision } from './draftRevision.ts';

const allStores = ['fish', 'drafts', 'assets', 'discoveries', 'captures', 'effectsDiscovered', 'settings'];

/** 导出完整备份：作品、草稿、图鉴、捕获凭证、彩蛋、设置，以及所有被引用的 PNG。 */
export async function exportProfile(db: IDBDatabase) {
  const profile = await loadProfile(db);
  let discoveries: Discovery[] = [], captures: Capture[] = [];
  const blobs = new Map<string, Blob>();
  try {
    const tx = db.transaction(['discoveries', 'captures', 'assets'], 'readonly');
    const done = completion(tx);
    discoveries = await request(tx.objectStore('discoveries').getAll()) as Discovery[];
    captures = await request(tx.objectStore('captures').getAll()) as Capture[];
    for (const id of referencedAssetIds(profile.fish, profile.draft)) {
      const asset = await request(tx.objectStore('assets').get(id)) as { blob?: Blob } | undefined;
      if (asset?.blob) blobs.set(id, asset.blob);
    }
    await done;
  } catch (error) { throw toStorageError(error); }
  // 读取 Blob 内容在事务结束后进行，不在活动事务中等待非 IndexedDB 工作。
  const assets = new Map<string, Uint8Array>();
  for (const [id, blob] of blobs) assets.set(id, new Uint8Array(await blob.arrayBuffer()));
  return buildBackup({ fish: profile.fish, draft: profile.draft, settings: profile.settings, effects: profile.effects, discoveries, captures, assets });
}

/** 存储不可用时的临时导出：只包含当前草稿与它的纹理。 */
export async function buildTemporaryBackup(draft: BackupData['draft'], blobs: Map<string, Blob>) {
  const assets = new Map<string, Uint8Array>();
  for (const [id, blob] of blobs) assets.set(id, new Uint8Array(await blob.arrayBuffer()));
  return buildBackup({ fish: [], draft, settings: createSettings(), effects: [], discoveries: [], captures: [], assets });
}

/** 校验通过的备份整体替换现有存档；同一事务内完成，失败时全部回滚。 */
export function replaceProfile(db: IDBDatabase, data: BackupData): Promise<void> {
  return serialWrite(async () => {
    let tx: IDBTransaction;
    try { tx = db.transaction(allStores, 'readwrite'); } catch (error) { throw toStorageError(error); }
    const done = completion(tx);
    try {
      // 导入的草稿修订号排在现有草稿之后，已打开的工坊会识别为冲突而不是覆盖它。
      const current = await request(tx.objectStore('drafts').get('current')) as { revision?: number } | undefined;
      const floor = await readDraftRevision(tx, current);
      for (const name of allStores) tx.objectStore(name).clear();
      const revision = advanceDraftRevision(tx, Math.max(data.draft?.revision ?? 0, floor));
      for (const fish of data.fish) tx.objectStore('fish').put(fish);
      if (data.draft) tx.objectStore('drafts').put({ ...data.draft, revision });
      for (const [id, bytes] of data.assets) {
        const blob = new Blob([bytes as BlobPart], { type: 'image/png' });
        tx.objectStore('assets').put({ id, mime: 'image/png', blob, bytes: blob.size, width: paintResolution, height: paintResolution });
      }
      for (const effect of data.effects) tx.objectStore('effectsDiscovered').put(effect);
      for (const discovery of data.discoveries) tx.objectStore('discoveries').put(discovery);
      for (const capture of data.captures) tx.objectStore('captures').put(capture);
      tx.objectStore('settings').put({ ...data.settings, revision: data.settings.revision + 1 });
      await done;
    } catch (error) {
      try { tx.abort(); } catch { /* 事务已结束 */ }
      await done.catch(() => undefined);
      throw toStorageError(error);
    }
  }).then(() => notifyChange('profile'));
}

/** 下载 JSON 文件（浏览器）。不上传到任何服务。 */
export function downloadJson(data: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.rel = 'noopener';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
