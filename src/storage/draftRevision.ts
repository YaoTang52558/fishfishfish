import { request, StorageError } from './db.ts';

// 同一个 store 中的控制记录，不是第二份草稿，不导出到备份。
// 删除、入海、清空或导入也推进它，避免 current 删除后修订号从 1 重用。
const CLOCK_ID = '__revision__';
export async function readDraftRevision(tx: IDBTransaction, current: unknown): Promise<number> {
  const clock = await request(tx.objectStore('drafts').get(CLOCK_ID)) as { value?: unknown } | undefined;
  if (clock !== undefined && !(Number.isSafeInteger(clock.value) && (clock.value as number) >= 0)) {
    throw new StorageError('invalid', '草稿版本记录无法读取');
  }
  const legacy = (current as { revision?: unknown } | undefined)?.revision;
  return Math.max(clock?.value as number ?? 0, Number.isSafeInteger(legacy) && (legacy as number) >= 0 ? legacy as number : 0);
}
export function advanceDraftRevision(tx: IDBTransaction, revision: number): number {
  const next = revision + 1;
  if (!Number.isSafeInteger(next) || next < 1) throw new StorageError('invalid', '草稿版本超出范围');
  tx.objectStore('drafts').put({ id: CLOCK_ID, value: next });
  return next;
}
