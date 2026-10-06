import type { RoundState } from '../../domain/fishing3d/round.ts';
import type { CaptureResult } from '../../storage/repository.ts';
import { toStorageError } from '../../storage/db.ts';
export interface CaptureStatus {
  attemptId: string; speciesId: string; status: 'saving' | 'saved' | 'failed'; result: CaptureResult | null; error?: string;
}
/** Keeps failed receipts after release, serializes duplicate requests, and ignores stale UI updates. */
export function createCaptureService(write: (attemptId: string, speciesId: string) => Promise<CaptureResult>, changed: () => void) {
  const records = new Map<string, CaptureStatus>();
  const pending = new Map<string, Promise<void>>();
  async function save(attemptId: string) {
    const record = records.get(attemptId);
    if (!record || record.status === 'saved') return;
    if (pending.has(attemptId)) return pending.get(attemptId);
    records.set(attemptId, { ...record, status: 'saving', error: undefined }); changed();
    const task = (async () => {
      try {
        const result = await Promise.resolve().then(() => write(record.attemptId, record.speciesId));
        records.set(attemptId, { ...record, status: 'saved', result });
      } catch (cause) {
        records.set(attemptId, { ...record, status: 'failed', error: toStorageError(cause).message });
      } finally { pending.delete(attemptId); changed(); }
    })();
    pending.set(attemptId, task); return task;
  }
  return {
    get: (attemptId: string | null) => attemptId ? records.get(attemptId) : undefined,
    unresolved: () => [...records.values()].filter(record => record.status !== 'saved'),
    observe(state: RoundState) {
      if (state.phase !== 'caught' || !state.attemptId || !state.speciesId) return;
      if (!records.has(state.attemptId)) { records.set(state.attemptId, { attemptId: state.attemptId, speciesId: state.speciesId, status: 'saving', result: null }); void save(state.attemptId); }
    },
    retry: save,
  };
}
