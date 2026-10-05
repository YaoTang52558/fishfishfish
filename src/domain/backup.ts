import { catalogVersion, paintResolution } from '../catalog/fish.ts';
import { effectIds, FISH_LIMIT, validateDraft, validateOriginalFish, validateSettings } from './draft.ts';
import { isAssetId } from './fish.ts';
import type { EditorDraft, EffectDiscovery, EffectId, OriginalFish, ProfileSettings } from './types.ts';

export const BACKUP_FORMAT = 'fishfishfish-backup';
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
export const MAX_PNG_BYTES = 2 * 1024 * 1024;
export const MAX_CAPTURES = 10_000;

export interface Discovery { speciesId: string; firstCaughtAt: string; lastCaughtAt: string; catchCount: number }
export interface Capture { attemptId: string; speciesId: string; caughtAt: string }
export interface BackupData {
  fish: OriginalFish[];
  draft: EditorDraft | null;
  settings: ProfileSettings;
  effects: EffectDiscovery[];
  discoveries: Discovery[];
  captures: Capture[];
  /** 只包含被作品或草稿引用的 PNG。 */
  assets: Map<string, Uint8Array>;
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
/** 只读 PNG 文件头：签名正确、首块为 IHDR，并返回宽高。不解码像素。 */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 33 || PNG_SIGNATURE.some((value, index) => bytes[index] !== value)) return null;
  const type = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
  if (type !== 'IHDR') return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}
export function base64ToBytes(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text) || text.length % 4 !== 0) return null;
  try {
    const binary = atob(text);
    const out = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) out[index] = binary.charCodeAt(index);
    return out;
  } catch { return null; }
}

/** 生成备份对象（不含 IndexedDB 或 DOM 依赖）；纹理按引用收集。 */
export function buildBackup(data: BackupData, exportedAt = new Date().toISOString()) {
  const assets: Record<string, string> = {};
  for (const [id, bytes] of data.assets) assets[id] = bytesToBase64(bytes);
  return {
    format: BACKUP_FORMAT, schemaVersion: 1, catalogVersion, exportedAt,
    fish: data.fish, draft: data.draft, settings: data.settings, effectsDiscovered: data.effects,
    discoveries: data.discoveries, captures: data.captures, assets,
  };
}

export function referencedAssetIds(fish: readonly OriginalFish[], draft: EditorDraft | null): string[] {
  const ids = [...fish.map((item) => item.design), ...(draft ? [draft.design] : [])]
    .flatMap((design) => [design.paint.colorAssetId, design.paint.glowAssetId]).filter(isAssetId);
  return [...new Set(ids)];
}

type Result = { ok: true; value: BackupData; summary: { fish: number; hasDraft: boolean; effects: number; discoveries: number } } | { ok: false; errors: string[] };
const record = (input: unknown) => input !== null && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : null;
const isTime = (value: unknown) => typeof value === 'string' && !Number.isNaN(Date.parse(value));

/**
 * 导入前的完整校验：版本、数量、字段范围、PNG 尺寸与引用完整性都在替换前检查。
 * 未知字段不透传；任何一项不通过都拒绝整个备份，不做部分导入。
 */
export function validateBackup(input: unknown, byteLength: number): Result {
  const errors: string[] = [];
  if (!(byteLength > 0) || byteLength > MAX_BACKUP_BYTES) return { ok: false, errors: ['文件超过 50MB 或为空'] };
  const item = record(input);
  if (!item || item.format !== BACKUP_FORMAT) return { ok: false, errors: ['这不是“我的海洋”的备份文件'] };
  if (typeof item.schemaVersion !== 'number' || item.schemaVersion > 1) return { ok: false, errors: ['备份来自更新的版本，当前版本无法读取；现有存档未改动'] };
  if (item.schemaVersion !== 1) errors.push('备份版本无法识别');
  if (!Number.isSafeInteger(item.catalogVersion) || (item.catalogVersion as number) < 1 || (item.catalogVersion as number) > catalogVersion) errors.push('部件目录版本无法识别');

  const fish: OriginalFish[] = [];
  if (!Array.isArray(item.fish) || item.fish.length > FISH_LIMIT) errors.push(`原创鱼数量必须在 0–${FISH_LIMIT} 条之间`);
  else item.fish.forEach((entry, index) => { const r = validateOriginalFish(entry); if (r.ok) fish.push(r.value); else errors.push(`第 ${index + 1} 条作品无效（${r.errors.slice(0, 3).join('、')}）`); });
  if (new Set(fish.map((entry) => entry.id)).size !== fish.length) errors.push('作品 ID 重复');

  let draft: EditorDraft | null = null;
  if (item.draft !== null && item.draft !== undefined) {
    const r = validateDraft(item.draft);
    if (r.ok) draft = r.value; else errors.push('草稿无效');
  }
  const settingsResult = validateSettings(item.settings);
  if (!settingsResult.ok) errors.push('设置无效');

  const effects: EffectDiscovery[] = [];
  if (!Array.isArray(item.effectsDiscovered)) errors.push('彩蛋记录无效');
  else for (const entry of item.effectsDiscovered) {
    const e = record(entry);
    if (e && effectIds.includes(e.effectId as EffectId) && isTime(e.firstDiscoveredAt)) effects.push({ effectId: e.effectId as EffectId, firstDiscoveredAt: e.firstDiscoveredAt as string });
    else errors.push('彩蛋记录无效');
  }
  if (new Set(effects.map((e) => e.effectId)).size !== effects.length) errors.push('彩蛋记录重复');

  const discoveries: Discovery[] = [];
  if (!Array.isArray(item.discoveries)) errors.push('图鉴记录无效');
  else for (const entry of item.discoveries) {
    const d = record(entry);
    if (d && isAssetId(d.speciesId) && isTime(d.firstCaughtAt) && isTime(d.lastCaughtAt) && Number.isSafeInteger(d.catchCount) && (d.catchCount as number) >= 1) {
      discoveries.push({ speciesId: d.speciesId, firstCaughtAt: d.firstCaughtAt as string, lastCaughtAt: d.lastCaughtAt as string, catchCount: d.catchCount as number });
    } else errors.push('图鉴记录无效');
  }
  if (new Set(discoveries.map((d) => d.speciesId)).size !== discoveries.length) errors.push('图鉴记录重复');
  const captures: Capture[] = [];
  if (!Array.isArray(item.captures) || item.captures.length > MAX_CAPTURES) errors.push('捕获记录无效');
  else for (const entry of item.captures) {
    const c = record(entry);
    if (c && isAssetId(c.attemptId) && isAssetId(c.speciesId) && isTime(c.caughtAt)) captures.push({ attemptId: c.attemptId, speciesId: c.speciesId, caughtAt: c.caughtAt as string });
    else errors.push('捕获记录无效');
  }

  if (settingsResult.ok) {
    const fishIds = new Set(fish.map((entry) => entry.id)), speciesIds = new Set(discoveries.map((d) => d.speciesId));
    for (const entry of settingsResult.value.visibleEntries) {
      if (entry.kind === 'original' ? !fishIds.has(entry.fishId) : !speciesIds.has(entry.speciesId)) errors.push('展示列表引用了不存在的鱼');
    }
  }

  const assets = new Map<string, Uint8Array>();
  const rawAssets = record(item.assets);
  if (!rawAssets) errors.push('纹理列表无效');
  else for (const id of referencedAssetIds(fish, draft)) {
    const text = rawAssets[id];
    const bytes = typeof text === 'string' ? base64ToBytes(text) : null;
    const size = bytes ? pngSize(bytes) : null;
    if (!bytes) errors.push(`缺少纹理 ${id}`);
    else if (bytes.length > MAX_PNG_BYTES) errors.push(`纹理 ${id} 超过 2MB`);
    else if (!size || size.width !== paintResolution || size.height !== paintResolution) errors.push(`纹理 ${id} 不是 512×512 PNG`);
    else assets.set(id, bytes);
  }
  if (errors.length || !settingsResult.ok) return { ok: false, errors: [...new Set(errors)] };
  return {
    ok: true,
    value: { fish, draft, settings: settingsResult.value, effects, discoveries, captures, assets },
    summary: { fish: fish.length, hasDraft: draft !== null, effects: effects.length, discoveries: discoveries.length },
  };
}
