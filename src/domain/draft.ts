import { isAssetId, validateFishDesign } from './fish.ts';
import type { EditorDraft, EffectId, FishDesign, FishMeta, HabitatId, OceanEntry, OriginalFish, Personality, ProfileSettings } from './types.ts';

export const personalities: readonly Personality[] = ['lively', 'relaxed', 'curious'];
export const habitatIds: readonly HabitatId[] = ['reef-edge', 'coastal-rock'];
export const effectIds: readonly EffectId[] = ['starry', 'ribbon', 'bubbles'];
export const FISH_LIMIT = 30;
export const VISIBLE_LIMIT = 20;
const defaultMeta: FishMeta = { name: '', personality: 'curious', preferredHabitat: 'reef-edge', effectEnabled: true };

export function createDraft(design: FishDesign, revision = 0, meta: Partial<FishMeta> & { sourceFishId?: string | null; sourceFishRevision?: number | null } = {}, updatedAt = new Date().toISOString()): EditorDraft {
  return {
    id: 'current', revision, sourceFishId: meta.sourceFishId ?? null, sourceFishRevision: meta.sourceFishRevision ?? null,
    name: meta.name ?? defaultMeta.name, personality: meta.personality ?? defaultMeta.personality,
    preferredHabitat: meta.preferredHabitat ?? defaultMeta.preferredHabitat, effectEnabled: meta.effectEnabled ?? defaultMeta.effectEnabled,
    design, updatedAt,
  };
}
export function createSettings(): ProfileSettings {
  return { id: 'profile', schemaVersion: 1, revision: 0, visibleEntries: [], soundEnabled: false, reducedMotion: false, assistMode: false };
}

type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };
const record = (input: unknown) => input !== null && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : null;
const isTime = (value: unknown) => typeof value === 'string' && !Number.isNaN(Date.parse(value));
/** 名字以普通文本保存：首尾空白去掉后 0–16 个字符（草稿可为空，作品至少 1 个）。 */
const isName = (value: unknown) => typeof value === 'string' && [...value].length <= 16 && !/[\u0000-\u001f\u007f]/.test(value);

function validateMeta(item: Record<string, unknown>, errors: string[]): FishMeta {
  if (!isName(item.name)) errors.push('name');
  if (!personalities.includes(item.personality as Personality)) errors.push('personality');
  if (!habitatIds.includes(item.preferredHabitat as HabitatId)) errors.push('preferredHabitat');
  // 早于步骤 06 的草稿没有该字段，按默认显示特效处理。
  if (item.effectEnabled !== undefined && typeof item.effectEnabled !== 'boolean') errors.push('effectEnabled');
  return { name: item.name as string, personality: item.personality as Personality, preferredHabitat: item.preferredHabitat as HabitatId, effectEnabled: item.effectEnabled !== false };
}

export function validateDraft(input: unknown): Result<EditorDraft> {
  const item = record(input);
  if (!item) return { ok: false, errors: ['draft'] };
  const errors: string[] = [];
  if (item.id !== 'current') errors.push('id');
  if (!Number.isSafeInteger(item.revision) || (item.revision as number) < 1) errors.push('revision');
  if (item.sourceFishId !== null && !isAssetId(item.sourceFishId)) errors.push('sourceFishId');
  if (item.sourceFishRevision !== null && !(Number.isSafeInteger(item.sourceFishRevision) && (item.sourceFishRevision as number) >= 1)) errors.push('sourceFishRevision');
  if ((item.sourceFishId === null) !== (item.sourceFishRevision === null)) errors.push('source');
  const meta = validateMeta(item, errors);
  if (!isTime(item.updatedAt)) errors.push('updatedAt');
  const design = validateFishDesign(item.design);
  if (!design.ok) errors.push(...design.errors.map((error) => `design.${error}`));
  if (errors.length || !design.ok) return { ok: false, errors };
  return { ok: true, value: {
    id: 'current', revision: item.revision as number,
    sourceFishId: item.sourceFishId as string | null, sourceFishRevision: item.sourceFishRevision as number | null,
    ...meta, design: design.value, updatedAt: item.updatedAt as string,
  } };
}

export function validateOriginalFish(input: unknown): Result<OriginalFish> {
  const item = record(input);
  if (!item) return { ok: false, errors: ['fish'] };
  const errors: string[] = [];
  if (!isAssetId(item.id)) errors.push('id');
  if (!Number.isSafeInteger(item.revision) || (item.revision as number) < 1) errors.push('revision');
  const meta = validateMeta(item, errors);
  if (!meta.name || !meta.name.trim()) errors.push('name');
  if (!isTime(item.createdAt) || !isTime(item.updatedAt)) errors.push('time');
  if (item.activeEffect !== null && !effectIds.includes(item.activeEffect as EffectId)) errors.push('activeEffect');
  if (item.ruleVersion !== 1) errors.push('ruleVersion');
  if (!isAssetId(item.lastCommandId)) errors.push('lastCommandId');
  const design = validateFishDesign(item.design);
  if (!design.ok) errors.push(...design.errors.map((error) => `design.${error}`));
  if (errors.length || !design.ok) return { ok: false, errors };
  return { ok: true, value: {
    id: item.id as string, revision: item.revision as number, ...meta,
    createdAt: item.createdAt as string, updatedAt: item.updatedAt as string, design: design.value,
    activeEffect: item.activeEffect as EffectId | null, ruleVersion: 1, lastCommandId: item.lastCommandId as string,
  } };
}

export function validateSettings(input: unknown): Result<ProfileSettings> {
  const item = record(input);
  if (!item) return { ok: false, errors: ['settings'] };
  const errors: string[] = [];
  if (item.id !== 'profile' || item.schemaVersion !== 1) errors.push('id');
  if (!Number.isSafeInteger(item.revision) || (item.revision as number) < 0) errors.push('revision');
  for (const key of ['soundEnabled', 'reducedMotion', 'assistMode']) if (typeof item[key] !== 'boolean') errors.push(key);
  const entries = Array.isArray(item.visibleEntries) ? item.visibleEntries : null;
  const parsed: OceanEntry[] = [];
  if (!entries || entries.length > VISIBLE_LIMIT) errors.push('visibleEntries');
  else for (const entry of entries) {
    const e = record(entry);
    if (e?.kind === 'original' && isAssetId(e.fishId)) parsed.push({ kind: 'original', fishId: e.fishId });
    else if (e?.kind === 'visitor' && isAssetId(e.speciesId)) parsed.push({ kind: 'visitor', speciesId: e.speciesId });
    else errors.push('visibleEntries');
  }
  const keys = parsed.map((e) => e.kind === 'original' ? `o:${e.fishId}` : `v:${e.speciesId}`);
  if (new Set(keys).size !== keys.length) errors.push('visibleEntries.duplicate');
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: {
    id: 'profile', schemaVersion: 1, revision: item.revision as number, visibleEntries: parsed,
    soundEnabled: item.soundEnabled as boolean, reducedMotion: item.reducedMotion as boolean, assistMode: item.assistMode as boolean,
  } };
}
