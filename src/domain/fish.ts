import { armLimits, bodies, eyes, finSets, heads, mouths, palette, patterns, patternLimits, shapeLimits, stampKinds, stampLimits, tails } from '../catalog/fish.ts';
import type { ColorSlot, FishDesign, ShapeKey, Stamp } from './types.ts';

export type PartKey = 'bodyId' | keyof FishDesign['parts'];
const partCatalog: Record<PartKey, readonly { id: string }[]> = {
  bodyId: bodies, headId: heads, tailId: tails, finId: finSets, eyeId: eyes, mouthId: mouths,
};
export const colorSlots: readonly ColorSlot[] = ['body', 'head', 'fin', 'tail'];

export function createFishDesign(): FishDesign {
  return {
    schemaVersion: 1, bodyId: 'streamlined',
    shape: { length: 1, height: 1, headRatio: 0.3 },
    parts: { headId: 'rounded', tailId: 'fork', finId: 'soft', eyeId: 'round', mouthId: 'smile' },
    colors: { body: '#F4BA75', head: '#FFF3D9', fin: '#EAC779', tail: '#E9A598' },
    pattern: { id: 'none', primary: '#F4BA75', secondary: '#FFF3D9' },
    paint: { resolution: 512, colorAssetId: null, glowAssetId: null }, stamps: [], mirroredSide: true,
  };
}
export function changeShape(design: FishDesign, key: ShapeKey, value: number): FishDesign {
  const limit = shapeLimits[key];
  if (!Number.isFinite(value) || value < limit.min || value > limit.max) throw new RangeError(`Invalid shape.${key}`);
  return { ...design, shape: { ...design.shape, [key]: value } };
}
export function changePart(design: FishDesign, key: PartKey, id: string): FishDesign {
  if (!partCatalog[key].some((item) => item.id === id)) throw new RangeError(`Unknown ${key}`);
  return key === 'bodyId' ? { ...design, bodyId: id } : { ...design, parts: { ...design.parts, [key]: id } };
}
export function changeTail(design: FishDesign, tailId: string): FishDesign { return changePart(design, 'tailId', tailId); }
export function changeArms(design: FishDesign, patch: Partial<NonNullable<FishDesign['arms']>>): FishDesign {
  if (patch.count === 0) { const { arms, ...rest } = design; return rest; }
  const arms = { count: 4, length: armLimits.length.default, curl: armLimits.curl.default, color: design.colors.fin, ...design.arms, ...patch };
  if (!validArms(arms)) throw new RangeError('Invalid arms');
  return { ...design, arms };
}
function validArms(value: Record<string, unknown>) {
  return Number.isInteger(value.count) && Number(value.count) >= armLimits.count.min && Number(value.count) <= armLimits.count.max
    && ['length', 'curl'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key]) && Number(value[key]) >= armLimits[key as 'length' | 'curl'].min && Number(value[key]) <= armLimits[key as 'length' | 'curl'].max)
    && isPaletteColor(value.color);
}
export function resetShape(design: FishDesign): FishDesign {
  return { ...design, shape: { length: 1, height: 1, headRatio: 0.3 } };
}
export function changeSculpt(design: FishDesign, edge: 'top' | 'bottom', index: number, value: number): FishDesign {
  if (!Number.isInteger(index) || index < 0 || index > 2 || !Number.isFinite(value) || Math.abs(value) > 0.14) throw new RangeError('Invalid sculpt');
  const sculpt = { top: [...(design.sculpt?.top ?? [0, 0, 0])] as [number, number, number], bottom: [...(design.sculpt?.bottom ?? [0, 0, 0])] as [number, number, number] };
  sculpt[edge][index] = value;
  return { ...design, sculpt };
}
const isPaletteColor = (value: unknown): value is string => palette.some((color) => color.value === value);
export function changeColor(design: FishDesign, slot: ColorSlot | 'primary' | 'secondary', color: string): FishDesign {
  if (!isPaletteColor(color)) throw new RangeError('Color must come from the palette');
  if (slot === 'primary' || slot === 'secondary') return { ...design, pattern: { ...design.pattern, [slot]: color } };
  return { ...design, colors: { ...design.colors, [slot]: color } };
}
export function changePattern(design: FishDesign, id: string): FishDesign {
  if (!patterns.some((pattern) => pattern.id === id)) throw new RangeError('Unknown pattern');
  return { ...design, pattern: { ...design.pattern, id } };
}
export function changePatternDetail(design: FishDesign, key: 'size' | 'density', value: number): FishDesign {
  const limit = patternLimits[key];
  if (!Number.isFinite(value) || value < limit.min || value > limit.max) throw new RangeError(`Invalid pattern.${key}`);
  return { ...design, pattern: { ...design.pattern, [key]: value } };
}
export function setPaintAsset(design: FishDesign, colorAssetId: string | null, glowAssetId: string | null = design.paint.glowAssetId): FishDesign {
  if (colorAssetId !== null && !isAssetId(colorAssetId)) throw new RangeError('Invalid asset ID');
  if (glowAssetId !== null && !isAssetId(glowAssetId)) throw new RangeError('Invalid asset ID');
  return { ...design, paint: { ...design.paint, colorAssetId, glowAssetId } };
}
export function isAssetId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
}

const TAU = Math.PI * 2;
export function normalizeAngle(angle: number) { return ((angle % TAU) + TAU + Math.PI) % TAU - Math.PI; }
export function validateStamp(input: unknown): Stamp | null {
  if (input === null || typeof input !== 'object') return null;
  const item = input as Record<string, unknown>;
  const num = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
  if (!isAssetId(item.id) || !stampKinds.some((kind) => kind.id === item.kind) || !isPaletteColor(item.color)
    || !num(item.u, 0, 1) || !num(item.v, 0, 1) || !num(item.scale, stampLimits.scale.min, stampLimits.scale.max)
    || !num(item.rotation, -Math.PI, Math.PI)) return null;
  return { id: item.id, kind: item.kind as string, color: item.color, u: item.u as number, v: item.v as number, scale: item.scale as number, rotation: item.rotation as number };
}
/** 新增印章；超过上限返回 null，由界面明确提示，不替换已有印章。 */
export function addStamp(design: FishDesign, stamp: Stamp): FishDesign | null {
  if (design.stamps.length >= stampLimits.max) return null;
  if (!validateStamp(stamp) || design.stamps.some((item) => item.id === stamp.id)) throw new RangeError('Invalid stamp');
  return { ...design, stamps: [...design.stamps, stamp] };
}
export function updateStamp(design: FishDesign, id: string, patch: Partial<Omit<Stamp, 'id'>>): FishDesign {
  const clampTo = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  return { ...design, stamps: design.stamps.map((stamp) => {
    if (stamp.id !== id) return stamp;
    const next = { ...stamp, ...patch };
    next.u = clampTo(next.u, 0, 1); next.v = clampTo(next.v, 0, 1);
    next.scale = clampTo(next.scale, stampLimits.scale.min, stampLimits.scale.max);
    next.rotation = normalizeAngle(next.rotation);
    if (!validateStamp(next)) throw new RangeError('Invalid stamp');
    return next;
  }) };
}
export function removeStamp(design: FishDesign, id: string): FishDesign {
  return { ...design, stamps: design.stamps.filter((stamp) => stamp.id !== id) };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
export function validateFishDesign(input: unknown): { ok: true; value: FishDesign } | { ok: false; errors: string[] } {
  const item = record(input);
  if (!item) return { ok: false, errors: ['design'] };
  const errors: string[] = [];
  const shape = record(item.shape), parts = record(item.parts), colors = record(item.colors);
  const pattern = record(item.pattern), paint = record(item.paint);
  if (item.schemaVersion !== 1) errors.push('schemaVersion');
  if (!bodies.some((body) => body.id === item.bodyId)) errors.push('bodyId');
  if (item.mirroredSide !== true) errors.push('mirroredSide');
  const sculpt = record(item.sculpt);
  const arms = record(item.arms);
  if (item.arms !== undefined && (!arms || !validArms(arms))) errors.push('arms');
  if (item.sculpt !== undefined && (!sculpt || !['top', 'bottom'].every(edge => Array.isArray(sculpt[edge]) && (sculpt[edge] as unknown[]).length === 3 && (sculpt[edge] as unknown[]).every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 0.14)))) errors.push('sculpt');
  for (const key of ['length', 'height', 'headRatio'] as const) {
    const value = shape?.[key], limits = shapeLimits[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < limits.min || value > limits.max) errors.push(`shape.${key}`);
  }
  for (const key of ['headId', 'tailId', 'finId', 'eyeId', 'mouthId'] as const) {
    if (!partCatalog[key].some((part) => part.id === parts?.[key])) errors.push(`parts.${key}`);
  }
  for (const key of colorSlots) if (!isPaletteColor(colors?.[key])) errors.push(`colors.${key}`);
  if (!patterns.some((entry) => entry.id === pattern?.id) || !isPaletteColor(pattern?.primary) || !isPaletteColor(pattern?.secondary)) errors.push('pattern');
  for (const key of ['size', 'density'] as const) {
    const value = pattern?.[key], limit = patternLimits[key];
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < limit.min || value > limit.max)) errors.push(`pattern.${key}`);
  }
  if (paint?.resolution !== 512) errors.push('paint.resolution');
  for (const key of ['colorAssetId', 'glowAssetId']) {
    const value = paint?.[key];
    if (value !== null && !isAssetId(value)) errors.push(`paint.${key}`);
  }
  const stamps = Array.isArray(item.stamps) ? item.stamps.map(validateStamp) : null;
  if (!stamps || stamps.length > stampLimits.max || stamps.some((stamp) => !stamp)
    || new Set(stamps.map((stamp) => stamp?.id)).size !== stamps.length) errors.push('stamps');
  if (errors.length || !shape || !parts || !colors || !pattern || !paint || !stamps) return { ok: false, errors };
  return { ok: true, value: {
    schemaVersion: 1, bodyId: item.bodyId as string,
    shape: { length: shape.length as number, height: shape.height as number, headRatio: shape.headRatio as number },
    parts: { headId: parts.headId as string, tailId: parts.tailId as string, finId: parts.finId as string, eyeId: parts.eyeId as string, mouthId: parts.mouthId as string },
    colors: { body: colors.body as string, head: colors.head as string, fin: colors.fin as string, tail: colors.tail as string },
    pattern: { id: pattern.id as string, primary: pattern.primary as string, secondary: pattern.secondary as string,
      ...(pattern.size === undefined ? {} : { size: pattern.size as number }), ...(pattern.density === undefined ? {} : { density: pattern.density as number }) },
    paint: { resolution: 512, colorAssetId: paint.colorAssetId as string | null, glowAssetId: paint.glowAssetId as string | null },
    stamps: stamps as Stamp[], mirroredSide: true,
    ...(arms ? { arms: { count: arms.count as number, length: arms.length as number, curl: arms.curl as number, color: arms.color as string } } : {}),
    ...(sculpt ? { sculpt: { top: [...sculpt.top as number[]] as [number, number, number], bottom: [...sculpt.bottom as number[]] as [number, number, number] } } : {}),
  } };
}

/** 可复现的伪随机数（mulberry32）。 */
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/**
 * 随机造型：只改变身体、部件、比例、底色与花纹，保留笔迹、发光和印章。
 * 返回新文档，不修改输入；由调用方决定预览后是否应用。
 */
export function randomizeDesign(design: FishDesign, seed: number): FishDesign {
  const random = seededRandom(seed);
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]!;
  const step = (key: ShapeKey) => {
    const { min, max, step: size } = shapeLimits[key];
    return Math.round((min + random() * (max - min)) / size) * size;
  };
  const color = () => pick(palette).value;
  const shape = { length: step('length'), height: step('height'), headRatio: step('headRatio') };
  for (const key of ['length', 'height', 'headRatio'] as const) shape[key] = Math.min(shapeLimits[key].max, Math.max(shapeLimits[key].min, Number(shape[key].toFixed(2))));
  return {
    ...design, bodyId: pick(bodies).id, shape,
    parts: { headId: pick(heads).id, tailId: pick(tails).id, finId: pick(finSets).id, eyeId: pick(eyes).id, mouthId: pick(mouths).id },
    colors: { body: color(), head: color(), fin: color(), tail: color() },
    pattern: { id: pick(patterns).id, primary: color(), secondary: color() },
  };
}
