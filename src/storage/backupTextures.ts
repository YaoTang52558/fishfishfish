import { paintResolution } from '../catalog/fish.ts';
import type { BackupData } from '../domain/backup.ts';
import { StorageError } from './db.ts';

export interface DecodedTexture { width: number; height: number; close(): void }
export type TextureDecoder = (blob: Blob) => Promise<DecodedTexture>;

/** 文件头校验之后、预览与替换之前真实解码。全部在 IndexedDB 事务外完成。 */
export async function validateBackupTextures(data: BackupData, decode: TextureDecoder = (blob) => createImageBitmap(blob)): Promise<void> {
  for (const [id, bytes] of data.assets) {
    let image: DecodedTexture;
    try { image = await decode(new Blob([bytes as BlobPart], { type: 'image/png' })); }
    catch (cause) { throw new StorageError('invalid', `笔迹图片 ${id} 已损坏，不能导入`, { cause }); }
    try {
      if (image.width !== paintResolution || image.height !== paintResolution) throw new StorageError('invalid', `笔迹图片 ${id} 的实际尺寸不是 512×512`);
    } finally { image.close(); }
  }
}
