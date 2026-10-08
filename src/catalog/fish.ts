import type {
  BodyDefinition, EyeDefinition, FinSetDefinition, HeadDefinition, MouthDefinition, PatternDefinition, ShapeKey,
  StampDefinition, TailDefinition,
} from '../domain/types.ts';

export const catalogVersion = 3;
export const armLimits = { count: { min: 1, max: 8 }, length: { min: 0.15, max: 0.55, default: 0.32 }, curl: { min: 0, max: 1, default: 0.55 } } as const;
export const shapeLimits = {
  length: { min: 0.75, max: 1.4, step: 0.01, default: 1 },
  height: { min: 0.7, max: 1.3, step: 0.01, default: 1 },
  headRatio: { min: 0.2, max: 0.4, step: 0.01, default: 0.3 },
} as const satisfies Record<ShapeKey, { min: number; max: number; step: number; default: number }>;

export const palette = [
  { name: '暖橙', value: '#F4BA75' }, { name: '珊瑚', value: '#E9A598' },
  { name: '米白', value: '#FFF3D9' }, { name: '金黄', value: '#EAC779' },
  { name: '海草', value: '#9EAF91' }, { name: '薄荷', value: '#CDE3CA' },
  { name: '浅海', value: '#8AAFB0' }, { name: '深海蓝', value: '#24486B' },
  { name: '贝紫', value: '#B3A0B7' }, { name: '桃粉', value: '#EDBCD0' },
  { name: '海绿', value: '#175F57' }, { name: '岩灰', value: '#758F89' },
] as const;
const original = '原创程序矢量 · fishfishfish · 2026-10-05';

/** 身体规范框的纵横比：规范高度 1 对应实际 0.7 × height。 */
export const bodyAspect = 0.7;
export const paintResolution = 512;
/** 笔宽相对身体规范宽度；纹理与身体规范框一一对应。 */
export const brushLimits = { min: 0.005, max: 0.08, step: 0.005, default: 0.02 } as const;
export const stampLimits = { max: 24, scale: { min: 0.05, max: 0.4, default: 0.12 } } as const;

/*
 * 身体只描述躯干：s=0 为尾柄截面（x=-0.5），s=1 为颈部截面（头部起点）。
 * top/bottom 是规范 y（上为负），按 s 平滑插值；颈部高度和切线交给头型延续。
 */
export const bodies: readonly BodyDefinition[] = [
  { id: 'streamlined', name: '流线身体', alias: '梭形', description: '像金枪鱼，适合长距离巡游。',
    profile: { s: [0, 0.18, 0.45, 0.72, 1], top: [-0.075, -0.15, -0.37, -0.42, -0.36], bottom: [0.06, 0.12, 0.28, 0.31, 0.28] }, license: original },
  { id: 'round', name: '圆身体', alias: '球形', description: '像河豚，圆滚滚的。',
    profile: { s: [0, 0.14, 0.34, 0.6, 0.85, 1], top: [-0.07, -0.1, -0.36, -0.47, -0.45, -0.38], bottom: [0.06, 0.1, 0.36, 0.48, 0.45, 0.37] }, license: original },
  { id: 'compressed', name: '侧扁身体', alias: '侧扁形', description: '像蝴蝶鱼，又高又薄。',
    profile: { s: [0, 0.07, 0.3, 0.52, 0.78, 1], top: [-0.06, -0.24, -0.47, -0.5, -0.45, -0.33], bottom: [0.05, 0.22, 0.46, 0.5, 0.43, 0.28] }, license: original },
  { id: 'eel', name: '细长身体', alias: '鳗形', description: '像鳗鱼，长长的一条。',
    profile: { s: [0, 0.2, 0.55, 1], top: [-0.035, -0.08, -0.12, -0.12], bottom: [0.03, 0.07, 0.1, 0.1] }, license: original },
  { id: 'wedge', name: '三角身体', alias: '扁平形', description: '参考鳐鱼，前宽后窄像个三角。',
    profile: { s: [0, 0.25, 0.6, 0.88, 1], top: [-0.04, -0.12, -0.3, -0.44, -0.42], bottom: [0.04, 0.12, 0.2, 0.22, 0.22] }, license: original },
];

/*
 * 头型描述从颈部到吻端的轮廓：f(t)=(1-t^a)^(1/b) 控制半高收拢（b 越大前端越方），
 * tip 为吻端相对颈部中线的偏移（以颈部半高计，正为向下），brow/chin 为额头与下颌的隆起。
 */
export const heads: readonly HeadDefinition[] = [
  { id: 'rounded', name: '圆钝头', a: 2.2, b: 2.2, tip: 0.12, brow: 0, chin: 0, eye: { t: 0.5, rise: 0.36 }, license: original },
  { id: 'pointed', name: '尖吻头', a: 1.6, b: 1, tip: 0.18, brow: 0, chin: 0, eye: { t: 0.38, rise: 0.4 }, license: original },
  { id: 'square', name: '方头', a: 5, b: 4, tip: 0.1, brow: 0, chin: 0.04, eye: { t: 0.5, rise: 0.42 }, license: original },
  { id: 'brow', name: '隆额头', a: 2, b: 2.4, tip: 0.3, brow: 0.32, chin: 0, eye: { t: 0.55, rise: 0.22 }, license: original },
  { id: 'flat', name: '铲形头', a: 2.6, b: 1.6, tip: -0.3, brow: -0.18, chin: 0.06, eye: { t: 0.42, rise: 0.5 }, license: original },
];

// thrust/amplitude 是游戏手感参数，不代表真实鱼类的游泳能力。
export const tails: readonly TailDefinition[] = [
  { id: 'lunate', name: '新月尾', size: 1.1, animationProfile: { thrust: 0.95, agility: 0.5, amplitude: 0.1 }, license: original },
  { id: 'fork', name: '分叉尾', size: 1, animationProfile: { thrust: 0.8, agility: 0.5, amplitude: 0.16 }, license: original },
  { id: 'truncate', name: '截形尾', size: 0.9, animationProfile: { thrust: 0.55, agility: 0.5, amplitude: 0.2 }, license: original },
  { id: 'fan', name: '圆形尾', size: 0.95, animationProfile: { thrust: 0.35, agility: 0.5, amplitude: 0.26 }, license: original },
  { id: 'rhomboid', name: '菱形尾', size: 0.95, animationProfile: { thrust: 0.45, agility: 0.5, amplitude: 0.22 }, license: original },
  { id: 'ribbon', name: '飘带尾', size: 1.15, animationProfile: { thrust: 0.25, agility: 0.5, amplitude: 0.3 }, license: original },
];

/* 每片鳍用躯干比例区间定位，height 相对身体最大半高；鳍根贴着轮廓并画在身体后面。 */
export const finSets: readonly FinSetDefinition[] = [
  { id: 'soft', name: '软鳍', animationProfile: { thrust: 0.5, agility: 0.6, amplitude: 0.1 }, license: original, pectoral: { size: 0.75, shape: 'rounded' }, fins: [
    { edge: 'top', from: 0.42, to: 0.78, height: 0.55, shape: 'rounded', rays: 6 },
    { edge: 'bottom', from: 0.66, to: 0.78, height: 0.38, shape: 'swept', rays: 3 },
    { edge: 'bottom', from: 0.2, to: 0.36, height: 0.4, shape: 'rounded', rays: 4 },
  ] },
  { id: 'spiny', name: '棘背鳍', animationProfile: { thrust: 0.5, agility: 0.5, amplitude: 0.1 }, license: original, pectoral: { size: 0.7, shape: 'swept' }, fins: [
    { edge: 'top', from: 0.32, to: 0.84, height: 0.62, shape: 'spiny', rays: 9 },
    { edge: 'bottom', from: 0.66, to: 0.76, height: 0.4, shape: 'swept', rays: 3 },
    { edge: 'bottom', from: 0.18, to: 0.38, height: 0.42, shape: 'spiny', rays: 5 },
  ] },
  { id: 'flowing', name: '长飘鳍', animationProfile: { thrust: 0.5, agility: 0.35, amplitude: 0.1 }, license: original, pectoral: { size: 0.8, shape: 'rounded' }, fins: [
    { edge: 'top', from: 0.3, to: 0.72, height: 0.8, shape: 'filament', rays: 6 },
    { edge: 'bottom', from: 0.62, to: 0.72, height: 0.9, shape: 'filament', rays: 2 },
    { edge: 'bottom', from: 0.22, to: 0.5, height: 0.75, shape: 'filament', rays: 5 },
  ] },
  { id: 'sail', name: '帆鳍', animationProfile: { thrust: 0.5, agility: 0.3, amplitude: 0.1 }, license: original, pectoral: { size: 0.65, shape: 'swept' }, fins: [
    { edge: 'top', from: 0.18, to: 0.9, height: 1.15, shape: 'sail', rays: 12 },
    { edge: 'bottom', from: 0.68, to: 0.78, height: 0.35, shape: 'swept', rays: 3 },
    { edge: 'bottom', from: 0.18, to: 0.34, height: 0.35, shape: 'swept', rays: 3 },
  ] },
  { id: 'continuous', name: '连续鳍', animationProfile: { thrust: 0.5, agility: 0.7, amplitude: 0.1 }, license: original, pectoral: { size: 0.55, shape: 'rounded' }, fins: [
    { edge: 'top', from: 0.02, to: 0.88, height: 0.42, shape: 'low', rays: 16 },
    { edge: 'bottom', from: 0.02, to: 0.62, height: 0.38, shape: 'low', rays: 11 },
  ] },
  { id: 'nub', name: '小圆鳍', animationProfile: { thrust: 0.5, agility: 0.8, amplitude: 0.1 }, license: original, pectoral: { size: 0.6, shape: 'rounded' }, fins: [
    { edge: 'top', from: 0.14, to: 0.3, height: 0.36, shape: 'rounded', rays: 3 },
    { edge: 'bottom', from: 0.14, to: 0.28, height: 0.32, shape: 'rounded', rays: 3 },
  ] },
];

export const eyes: readonly EyeDefinition[] = [
  { id: 'round', name: '圆眼睛', scale: 1, style: 'round', license: original },
  { id: 'big', name: '大眼睛', scale: 1.5, style: 'big', license: original },
  { id: 'sleepy', name: '眯眯眼', scale: 1.05, style: 'sleepy', license: original },
  { id: 'sparkle', name: '星星眼', scale: 1.2, style: 'sparkle', license: original },
  { id: 'dot', name: '豆豆眼', scale: 0.6, style: 'dot', license: original },
];

export const mouths: readonly MouthDefinition[] = [
  { id: 'smile', name: '端位嘴', alias: '嘴在正前方', placement: 'tip', style: 'terminal', license: original },
  { id: 'upturned', name: '上位嘴', alias: '嘴朝上', placement: 'top', style: 'superior', license: original },
  { id: 'barbel', name: '下位嘴', alias: '嘴朝下，带胡须', placement: 'bottom', style: 'inferior', license: original },
  { id: 'kiss', name: '伸缩嘴', alias: '嘟嘟嘴', placement: 'tip', style: 'protrusible', license: original },
  { id: 'beak', name: '细长嘴', alias: '长长的吻', placement: 'tip', style: 'elongated', license: original },
];

export const patterns: readonly PatternDefinition[] = [
  { id: 'none', name: '无花纹' },
  { id: 'bands', name: '竖条纹' }, { id: 'lines', name: '横条纹' }, { id: 'spots', name: '圆点' },
  { id: 'waves', name: '波浪' }, { id: 'scales', name: '鳞片' }, { id: 'checks', name: '格子' },
  { id: 'countershade', name: '背深腹浅' }, { id: 'zebra', name: '斑马纹' }, { id: 'stars', name: '星点' },
  { id: 'eyespot', name: '眼斑' },
  { id: 'clown-bands', name: '小丑鱼白带' }, { id: 'grouper-spots', name: '石斑圆点' }, { id: 'honeycomb', name: '蜂窝纹' },
];

export const adjustablePatterns = new Set(['clown-bands', 'grouper-spots', 'honeycomb']);
export const patternLimits = { size: { min: 0.6, max: 1.6 }, density: { min: 0.65, max: 1.5 } } as const;

export const stampKinds: readonly StampDefinition[] = [
  { id: 'starfish', name: '海星' }, { id: 'shell', name: '贝壳' }, { id: 'bubble', name: '泡泡' },
  { id: 'bolt', name: '闪电' }, { id: 'heart', name: '爱心' }, { id: 'flower', name: '花' },
];

export function validateCatalog(): string[] {
  const errors: string[] = [];
  const finite = (...values: number[]) => values.every(Number.isFinite);
  for (const [key, limits] of Object.entries(shapeLimits)) {
    if (!finite(limits.min, limits.max, limits.step, limits.default)
      || limits.min >= limits.max || limits.step <= 0 || limits.default < limits.min || limits.default > limits.max) errors.push(`shape.${key}`);
  }
  const unique = (kind: string, items: readonly { id: string }[]) => {
    if (new Set(items.map((item) => item.id)).size !== items.length) errors.push(`duplicate:${kind}`);
  };
  unique('body', bodies); unique('head', heads); unique('tail', tails); unique('fin', finSets);
  unique('eye', eyes); unique('mouth', mouths); unique('pattern', patterns); unique('stamp', stampKinds);
  for (const body of bodies) {
    const { s, top, bottom } = body.profile;
    if (s.length < 3 || s.length !== top.length || s.length !== bottom.length || s[0] !== 0 || s[s.length - 1] !== 1
      || s.some((value, index) => index > 0 && value <= s[index - 1]!)
      || top.some((value, index) => !(value < bottom[index]! && value >= -0.5 && bottom[index]! <= 0.5)) || !body.license) errors.push(`body:${body.id}`);
  }
  for (const head of heads) if (!finite(head.a, head.b, head.tip, head.brow, head.chin, head.eye.t, head.eye.rise) || head.a < 1.5 || head.b < 1 || !head.license) errors.push(`head:${head.id}`);
  const profileOk = (profile: { thrust: number; agility: number; amplitude: number }) => Object.values(profile).every((value) => Number.isFinite(value) && value >= 0 && value <= 1);
  for (const tail of tails) if (!profileOk(tail.animationProfile) || !(tail.size > 0) || !tail.license) errors.push(`tail:${tail.id}`);
  for (const set of finSets) {
    if (!profileOk(set.animationProfile) || !set.license || !(set.pectoral.size > 0)
      || set.fins.some((fin) => !(fin.from >= 0 && fin.from < fin.to && fin.to <= 1 && fin.height > 0 && fin.rays >= 0))) errors.push(`fin:${set.id}`);
  }
  for (const eye of eyes) if (!(eye.scale > 0) || !eye.license) errors.push(`eye:${eye.id}`);
  if (!(brushLimits.min > 0 && brushLimits.min <= brushLimits.default && brushLimits.default <= brushLimits.max)) errors.push('brush');
  if (new Set(palette.map((color) => color.value)).size !== palette.length
    || !palette.every((color) => /^#[0-9A-F]{6}$/.test(color.value))) errors.push('palette');
  return errors;
}
