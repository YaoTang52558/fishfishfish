export const DB_NAME = 'fishfishfish';
export const DB_VERSION = 1;
const stores: Array<[name: string, keyPath: string]> = [
  ['fish', 'id'], ['drafts', 'id'], ['assets', 'id'], ['discoveries', 'speciesId'],
  ['captures', 'attemptId'], ['effectsDiscovered', 'effectId'], ['settings', 'id'],
];

export type StorageErrorKind = 'unavailable' | 'quota' | 'denied' | 'conflict' | 'invalid' | 'missing' | 'limit' | 'unknown';
export class StorageError extends Error {
  readonly kind: StorageErrorKind;
  constructor(kind: StorageErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageError';
    this.kind = kind;
  }
}
export function toStorageError(error: unknown): StorageError {
  if (error instanceof StorageError) return error;
  const name = error instanceof Error || (typeof DOMException !== 'undefined' && error instanceof DOMException) ? (error as Error).name : '';
  if (name === 'QuotaExceededError') return new StorageError('quota', '设备存储空间不足', { cause: error });
  if (name === 'NotAllowedError' || name === 'SecurityError') return new StorageError('denied', '浏览器拒绝了本地存储', { cause: error });
  return new StorageError('unknown', '保存时出现未知错误', { cause: error });
}

export function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error);
  });
}
export function completion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new DOMException('Transaction aborted', 'AbortError'));
    transaction.onerror = () => undefined; // 交给 onabort 统一处理，避免重复 reject。
  });
}

/** 打开数据库；版本 1 一次建好全部 store，避免后续步骤为新增 store 升级版本。 */
export function openDatabase(factory: IDBFactory | undefined = globalThis.indexedDB): Promise<IDBDatabase> {
  if (!factory) return Promise.reject(new StorageError('unavailable', '当前浏览器不支持本地存储'));
  return new Promise((resolve, reject) => {
    let open: IDBOpenDBRequest;
    try { open = factory.open(DB_NAME, DB_VERSION); } catch (error) {
      reject(new StorageError('unavailable', '当前浏览器无法打开本地存储', { cause: error })); return;
    }
    open.onupgradeneeded = () => {
      for (const [name, keyPath] of stores) if (!open.result.objectStoreNames.contains(name)) open.result.createObjectStore(name, { keyPath });
    };
    open.onsuccess = () => {
      const db = open.result;
      // 其他标签升级数据库时主动关闭，避免阻塞对方。
      db.onversionchange = () => db.close();
      resolve(db);
    };
    open.onerror = () => reject(new StorageError('unavailable', '当前浏览器无法打开本地存储', { cause: open.error }));
    open.onblocked = () => reject(new StorageError('unavailable', '本地存储被另一个页面占用，请关闭其他标签后重试'));
  });
}
