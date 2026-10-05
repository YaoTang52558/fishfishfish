import { bodies, palette } from '../catalog/fish.ts';
import { getSwimProfile, type SwimProfile } from './swim.ts';
import type { EffectId, FishDesign, Personality } from './types.ts';

/*
 * 以下都是游戏设定：游动风格、性格推荐与彩蛋只服务于玩法反馈，
 * 不能当作生物学结论展示。
 */
export type SwimStyleId = 'dash' | 'agile' | 'calm';
export interface SwimStyle { id: SwimStyleId; name: string; explanation: string }
export function swimStyle(profile: SwimProfile): SwimStyle {
  if (profile.speed >= 1.2) return { id: 'dash', name: '冲刺型', explanation: '游得快、转弯幅度大，尾巴摆得又快又小。' };
  if (profile.turnRate >= 1.35) return { id: 'agile', name: '灵巧型', explanation: '速度不算快，但转身很利落。' };
  return { id: 'calm', name: '悠闲型', explanation: '慢慢地游，尾巴摆得大，转身也不着急。' };
}
export function describeSwim(design: FishDesign) {
  const profile = getSwimProfile(design);
  return { profile, style: swimStyle(profile) };
}

export const personalityNames: Record<Personality, string> = { lively: '轻快', relaxed: '悠闲', curious: '好奇' };
/** 性格推荐只看游动风格（部件与比例），所以改配色不会改变推荐；同一配置结果相同。 */
export function recommendPersonality(design: FishDesign): Personality {
  const style = swimStyle(getSwimProfile(design)).id;
  return style === 'dash' ? 'lively' : style === 'calm' ? 'relaxed' : 'curious';
}

export function defaultName(design: FishDesign): string {
  const color = palette.find((item) => item.value === design.colors.body)?.name ?? '小';
  const body = bodies.find((item) => item.id === design.bodyId)?.id;
  const suffix = body === 'round' ? '圆圆' : body === 'eel' ? '长长' : body === 'wedge' ? '三角' : body === 'compressed' ? '扁扁' : '小鱼';
  return `${color}${suffix}`;
}

/** 名字：去掉首尾空白，1–16 个可见字符，不含控制字符。按普通文本显示。 */
export function validateName(input: string): { ok: true; value: string } | { ok: false; reason: string } {
  const value = input.trim();
  if (/[\u0000-\u001f\u007f]/.test(value)) return { ok: false, reason: '名字里有不能显示的字符。' };
  const length = [...value].length;
  if (length === 0) return { ok: false, reason: '给它起个名字吧，至少 1 个字。' };
  if (length > 16) return { ok: false, reason: '名字最多 16 个字。' };
  return { ok: true, value };
}

export const effectInfo: Record<EffectId, { code: string; title: string; label: string; condition: string }> = {
  starry: { code: 'FX-01', title: '星夜鱼', label: '星夜漫游者', condition: '大眼睛 + 深海蓝身体 + 一笔看得见的发光笔迹' },
  ribbon: { code: 'FX-02', title: '飘带鱼', label: '海流舞者', condition: '飘带尾 + 波浪花纹' },
  bubbles: { code: 'FX-03', title: '泡泡鱼', label: '泡泡伙伴', condition: '圆身体 + 至少一枚泡泡印章' },
};
/** 发光笔迹裁剪到身体后至少 16 个非透明像素才算“看得见”。 */
export const VISIBLE_GLOW_PIXELS = 16;

/** 满足条件的彩蛋，按 FX-01 → FX-02 → FX-03 排序；第一个用于显示，全部记为已发现。 */
export function satisfiedEffects(design: FishDesign, visibleGlowPixels: number): EffectId[] {
  const result: EffectId[] = [];
  if (design.parts.eyeId === 'big' && design.colors.body === '#24486B' && visibleGlowPixels >= VISIBLE_GLOW_PIXELS) result.push('starry');
  if (design.parts.tailId === 'ribbon' && design.pattern.id === 'waves') result.push('ribbon');
  if (design.bodyId === 'round' && design.stamps.some((stamp) => stamp.kind === 'bubble')) result.push('bubbles');
  return result;
}
export function displayedEffect(satisfied: readonly EffectId[], enabled: boolean): EffectId | null {
  return enabled ? satisfied[0] ?? null : null;
}
