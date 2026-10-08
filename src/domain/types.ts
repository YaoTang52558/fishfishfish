export interface Point { x: number; y: number }
export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }
export type PathCommand =
  | { kind: 'M' | 'L'; to: Point }
  | { kind: 'C'; first: Point; second: Point; to: Point }
  | { kind: 'Q'; control: Point; to: Point }
  | { kind: 'Z' };
export type ShapeKey = 'length' | 'height' | 'headRatio';
export type ColorSlot = 'body' | 'head' | 'fin' | 'tail';
export interface FishDesign {
  schemaVersion: 1;
  bodyId: string;
  shape: Record<ShapeKey, number>;
  parts: { headId: string; tailId: string; finId: string; eyeId: string; mouthId: string };
  colors: Record<ColorSlot, string>;
  pattern: { id: string; primary: string; secondary: string; size?: number; density?: number };
  // 无笔迹时没有资产引用；有笔迹时指向 assets 中不可变的 PNG。
  paint: { resolution: 512; colorAssetId: string | null; glowAssetId: string | null };
  stamps: Stamp[];
  mirroredSide: true;
  /** Optional trunk control offsets in canonical coordinates; old designs omit them. */
  sculpt?: { top: [number, number, number]; bottom: [number, number, number] };
  /** Optional fantasy arms; count is a creative choice, not a species classification. */
  arms?: { count: number; length: number; curl: number; color: string };
}
export interface AnimationProfile { thrust: number; agility: number; amplitude: number }
export interface BodyDefinition {
  id: string; name: string; alias: string; description: string;
  profile: { s: readonly number[]; top: readonly number[]; bottom: readonly number[] };
  license: string;
}
export interface HeadDefinition {
  id: string; name: string; a: number; b: number; tip: number; brow: number; chin: number;
  eye: { t: number; rise: number }; license: string;
}
export interface TailDefinition { id: string; name: string; size: number; animationProfile: AnimationProfile; license: string }
export type FinShape = 'rounded' | 'swept' | 'spiny' | 'filament' | 'sail' | 'low';
export interface FinSpec { edge: 'top' | 'bottom'; from: number; to: number; height: number; shape: FinShape; rays: number }
export interface FinSetDefinition {
  id: string; name: string; fins: readonly FinSpec[]; pectoral: { size: number; shape: 'rounded' | 'swept' };
  animationProfile: AnimationProfile; license: string;
}
export interface EyeDefinition { id: string; name: string; scale: number; style: 'round' | 'big' | 'sleepy' | 'sparkle' | 'dot'; license: string }
export interface MouthDefinition {
  id: string; name: string; alias: string; placement: 'tip' | 'top' | 'bottom';
  style: 'terminal' | 'superior' | 'inferior' | 'protrusible' | 'elongated'; license: string;
}
export interface PatternDefinition { id: string; name: string }
export interface StampDefinition { id: string; name: string }
export interface Stamp { id: string; kind: string; color: string; u: number; v: number; scale: number; rotation: number }
export type Personality = 'lively' | 'relaxed' | 'curious';
export type HabitatId = 'reef-edge' | 'coastal-rock';
/** 草稿与作品共用的“作品信息”：名字、性格、喜爱区域、是否显示彩蛋特效。 */
export interface FishMeta {
  name: string;
  personality: Personality;
  preferredHabitat: HabitatId;
  effectEnabled: boolean;
}
export interface EditorDraft extends FishMeta {
  id: 'current';
  revision: number;
  sourceFishId: string | null;
  sourceFishRevision: number | null;
  design: FishDesign;
  updatedAt: string;
}
export type EffectId = 'starry' | 'ribbon' | 'bubbles';
export interface OriginalFish extends FishMeta {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  design: FishDesign;
  /** 保存时派生的显示特效；关闭特效或不满足条件时为 null。 */
  activeEffect: EffectId | null;
  ruleVersion: 1;
  /** 最近一次成功提交的凭证；重复提交同一凭证直接返回已有结果。 */
  lastCommandId: string;
}
export type OceanEntry = { kind: 'original'; fishId: string } | { kind: 'visitor'; speciesId: string };
export interface ProfileSettings {
  id: 'profile';
  schemaVersion: 1;
  revision: number;
  visibleEntries: OceanEntry[];
  soundEnabled: boolean;
  reducedMotion: boolean;
  assistMode: boolean;
  challenge?: import('./growth.ts').Challenge;
  knowledgeDepth?: import('./growth.ts').KnowledgeDepth;
}
export interface EffectDiscovery { effectId: EffectId; firstDiscoveredAt: string }
export interface StoredAsset {
  id: string;
  mime: 'image/png';
  blob: Blob;
  bytes: number;
  width: 512;
  height: 512;
}
