import { bodies, bodyAspect, eyes, finSets, heads, mouths, shapeLimits, tails } from '../catalog/fish.ts';
import type { BodyDefinition, Bounds, FinSpec, FishDesign, HeadDefinition, Point } from './types.ts';

/*
 * 拼接几何（技术设计 4.1）。规范坐标：身体框 [-0.5,0.5]²，朝右，上为负；
 * 实际坐标 = 规范坐标 × axes。只有轮廓点按 axes 变形，眼、嘴、鳍、尾在实际坐标中等比生成。
 */
export interface Axes { x: number; y: number }
export interface FinGeometry { kind: 'dorsal' | 'ventral' | 'pectoral'; polygon: Point[]; rays: Array<[Point, Point]>; pivot: Point }
export interface FishGeometry {
  axes: Axes;
  /** 闭合轮廓（实际坐标）：上缘从尾柄到吻端，再沿下缘返回。 */
  contour: Point[];
  canonicalContour: Point[];
  /** 头部区域：鳃盖弧线 + 轮廓前段。 */
  head: Point[];
  /** 躯干区域：轮廓去掉头部区域。 */
  trunk: Point[];
  gill: Point[];
  neck: { x: number; top: number; bottom: number; slopeTop: number; slopeBottom: number };
  peduncle: { x: number; center: number; height: number };
  tail: { pivot: Point; size: number; polygon: Point[]; rays: Array<[Point, Point]> };
  fins: FinGeometry[];
  pectoral: FinGeometry;
  eye: { center: Point; radius: number };
  mouth: { anchor: Point; angle: number; size: number; reach: number };
  bounds: Bounds;
  /** 身体轮廓自身的包围盒（不含鳍和尾）。 */
  bodyBox: Bounds;
  headStart: number;
  maxHalfHeight: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const byId = <T extends { id: string }>(items: readonly T[], id: string, kind: string): T => {
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new RangeError(`Unknown ${kind}`);
  return item;
};

/** Fritsch–Carlson 单调三次插值：经过控制点、不会在点之间过冲。 */
export function monotoneSpline(xs: readonly number[], ys: readonly number[]) {
  const n = xs.length;
  const delta = xs.slice(0, -1).map((x, i) => (ys[i + 1]! - ys[i]!) / (xs[i + 1]! - x));
  const m = xs.map((_, i) => i === 0 ? delta[0]! : i === n - 1 ? delta[n - 2]! : (delta[i - 1]! * delta[i]! <= 0 ? 0 : (delta[i - 1]! + delta[i]!) / 2));
  for (let i = 0; i < n - 1; i += 1) {
    if (delta[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i]! / delta[i]!, b = m[i + 1]! / delta[i]!, s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * delta[i]!; m[i + 1] = k * b * delta[i]!; }
  }
  const locate = (x: number) => { let i = 0; while (i < n - 2 && x > xs[i + 1]!) i += 1; return i; };
  return {
    value(x: number) {
      const i = locate(x), h = xs[i + 1]! - xs[i]!, t = (x - xs[i]!) / h;
      const h00 = 2 * t ** 3 - 3 * t ** 2 + 1, h10 = t ** 3 - 2 * t ** 2 + t, h01 = -2 * t ** 3 + 3 * t ** 2, h11 = t ** 3 - t ** 2;
      return h00 * ys[i]! + h10 * h * m[i]! + h01 * ys[i + 1]! + h11 * h * m[i + 1]!;
    },
    slope(x: number) {
      const i = locate(x), h = xs[i + 1]! - xs[i]!, t = (x - xs[i]!) / h;
      const d00 = 6 * t ** 2 - 6 * t, d10 = 3 * t ** 2 - 4 * t + 1, d01 = -6 * t ** 2 + 6 * t, d11 = 3 * t ** 2 - 2 * t;
      return (d00 * ys[i]! + d10 * h * m[i]! + d01 * ys[i + 1]! + d11 * h * m[i + 1]!) / h;
    },
  };
}

const bump = (t: number) => Math.sin(Math.PI * t) ** 2;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** 躯干与头型合成的规范轮廓函数；所有部件都只通过这里取连接面。 */
export function bodyOutline(body: BodyDefinition, head: HeadDefinition, headRatio: number, sculpt?: FishDesign['sculpt']) {
  const top = monotoneSpline(body.profile.s, body.profile.top);
  const bottom = monotoneSpline(body.profile.s, body.profile.bottom);
  const neckX = 0.5 - headRatio, trunkLength = neckX + 0.5, headLength = 0.5 - neckX;
  const topN = top.value(1), bottomN = bottom.value(1);
  const slopeTop = top.slope(1) / trunkLength, slopeBottom = bottom.slope(1) / trunkLength;
  const hn = (bottomN - topN) / 2, cn = (topN + bottomN) / 2;
  const mc = (slopeTop + slopeBottom) / 2, mh = (slopeBottom - slopeTop) / 2;
  const f = (t: number) => Math.max(0, 1 - t ** head.a) ** (1 / head.b);
  const half = (t: number) => Math.max(0, (hn + mh * headLength * t * (1 - t)) * f(t));
  const center = (t: number) => cn + mc * headLength * t * (1 - t) ** 2 + head.tip * hn * smooth(t);
  const fitBox = (y: number) => clamp(y, -0.5, 0.5);
  const controls = [0, 0.25, 0.5, 0.75, 1];
  const sculptTop = sculpt ? monotoneSpline(controls, [0, ...sculpt.top, 0]) : null;
  const sculptBottom = sculpt ? monotoneSpline(controls, [0, ...sculpt.bottom, 0]) : null;
  const headTop = (t: number) => fitBox(center(t) - half(t) - head.brow * hn * bump(t));
  const headBottom = (t: number) => fitBox(Math.max(center(t) + half(t) + head.chin * hn * bump(t), headTop(t)));
  return {
    neckX, trunkLength, headLength, topN, bottomN, slopeTop, slopeBottom,
    trunkX: (s: number) => -0.5 + s * trunkLength,
    trunkTop: (s: number) => sculptTop ? clamp(top.value(s) + sculptTop.value(s), -0.5, -0.025) : fitBox(top.value(s)),
    trunkBottom: (s: number) => sculptBottom ? clamp(bottom.value(s) + sculptBottom.value(s), 0.025, 0.5) : fitBox(bottom.value(s)),
    headX: (t: number) => neckX + t * headLength,
    headTop, headBottom,
  };
}
export type BodyOutline = ReturnType<typeof bodyOutline>;

function quad(out: Point[], from: Point, control: Point, to: Point, steps = 10) {
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps, s = 1 - t;
    out.push({ x: s * s * from.x + 2 * s * t * control.x + t * t * to.x, y: s * s * from.y + 2 * s * t * control.y + t * t * to.y });
  }
}
/** 尾巴轮廓（尾巴局部坐标，原点在尾柄，向 -x 延伸）。根部高度等于尾柄高度。 */
function tailPolygon(id: string, size: number, rootHeight: number) {
  const r = rootHeight / 2 / size, o = Math.min(0.6 * r, 0.12);
  const pts: Point[] = [{ x: o, y: -r }];
  const go = (control: [number, number], to: [number, number], steps?: number) => quad(pts, pts[pts.length - 1]!, { x: control[0], y: control[1] }, { x: to[0], y: to[1] }, steps);
  if (id === 'lunate') {
    go([-0.16, -r - 0.06], [-0.5, -0.64]); go([-0.3, -0.24], [-0.17, 0]); go([-0.3, 0.24], [-0.5, 0.64]); go([-0.16, r + 0.06], [o, r]);
  } else if (id === 'fork') {
    go([-0.14, -r - 0.12], [-0.55, -0.5]); go([-0.42, -0.2], [-0.3, 0]); go([-0.42, 0.2], [-0.55, 0.5]); go([-0.14, r + 0.12], [o, r]);
  } else if (id === 'truncate') {
    go([-0.14, -r - 0.06], [-0.46, -0.42]); go([-0.5, 0], [-0.46, 0.42], 8); go([-0.14, r + 0.06], [o, r]);
  } else if (id === 'fan') {
    go([-0.08, -r - 0.1], [-0.28, -0.42]);
    for (let i = 1; i <= 16; i += 1) { const a = -Math.PI / 2 - (i / 16) * Math.PI; pts.push({ x: -0.28 + 0.3 * Math.cos(a), y: -0.42 * Math.sin(a) * -1 }); }
    go([-0.08, r + 0.1], [o, r]);
  } else if (id === 'rhomboid') {
    go([-0.1, -r - 0.12], [-0.24, -0.34]); go([-0.48, -0.16], [-0.6, 0]); go([-0.48, 0.16], [-0.24, 0.34]); go([-0.1, r + 0.12], [o, r]);
  } else if (id === 'ribbon') {
    go([-0.24, -r - 0.16], [-0.62, -0.4]); go([-0.95, -0.52], [-1.18, -0.3], 14); go([-0.85, -0.16], [-0.44, 0.02], 12);
    go([-0.82, 0.18], [-1.08, 0.34], 12); go([-0.85, 0.5], [-0.55, 0.38], 12); go([-0.22, r + 0.14], [o, r]);
  } else throw new RangeError('Unknown tail');
  const polygon = pts.map((p) => ({ x: p.x * size, y: p.y * size }));
  const outer = polygon.filter((p) => p.x < -0.3 * size);
  const rayCount = Math.min(7, outer.length);
  const rays: Array<[Point, Point]> = Array.from({ length: rayCount }, (_, i) => {
    const target = outer[Math.round((i + 0.5) / rayCount * (outer.length - 1))]!;
    return [{ x: -0.04 * size, y: target.y * 0.12 }, { x: target.x * 0.9, y: target.y * 0.9 }];
  });
  return { polygon, rays };
}

function finProfile(shape: FinSpec['shape'], u: number) {
  if (shape === 'rounded') return Math.sin(Math.PI * u) ** 0.7;
  if (shape === 'swept') return u < 0.72 ? (u / 0.72) ** 0.9 : (1 - u) / 0.28;
  if (shape === 'sail') return Math.sin(Math.PI * u) ** 0.45;
  if (shape === 'low') return smooth(clamp(u / 0.14, 0, 1)) * smooth(clamp((1 - u) / 0.14, 0, 1));
  if (shape === 'filament') return u < 0.6 ? (u / 0.6) ** 0.8 : 1 - 0.55 * ((u - 0.6) / 0.4) ** 1.5;
  return Math.sin(Math.PI * u) ** 0.6; // spiny 外包络
}
const sweepOf: Record<FinSpec['shape'], number> = { rounded: 0.3, swept: 0.65, sail: 0.18, low: 0.08, filament: 0.5, spiny: 0.3 };

function buildFin(spec: FinSpec, outline: BodyOutline, axes: Axes, maxHalf: number): FinGeometry {
  const dir = spec.edge === 'top' ? -1 : 1;
  const height = clamp(spec.height * maxHalf, 0.035, 0.62);
  const sweep = sweepOf[spec.shape];
  const n = 18;
  const base: Point[] = [], inset: Point[] = [], outer: Point[] = [];
  for (let i = 0; i <= n; i += 1) {
    const u = i / n, s = spec.from + (spec.to - spec.from) * u;
    const top = outline.trunkTop(s) * axes.y, bottom = outline.trunkBottom(s) * axes.y, x = outline.trunkX(s) * axes.x;
    const edgeY = dir < 0 ? top : bottom;
    base.push({ x, y: edgeY });
    inset.push({ x, y: edgeY - dir * (bottom - top) * 0.22 });
    const p = finProfile(spec.shape, u) * height;
    outer.push({ x: x - sweep * p, y: edgeY + dir * p });
  }
  if (spec.shape === 'spiny') {
    // 棘：外缘在鳍条处凸出、之间凹下。
    for (let i = 0; i <= n; i += 1) {
      const wave = 0.72 + 0.28 * Math.abs(Math.cos(Math.PI * (spec.rays) * i / n));
      outer[i] = { x: base[i]!.x + (outer[i]!.x - base[i]!.x) * wave, y: base[i]!.y + (outer[i]!.y - base[i]!.y) * wave };
    }
  }
  let polygon = [...inset, ...outer.slice().reverse()];
  if (spec.shape === 'filament') {
    // 飘带：从鳍的高处向后拖出一条渐细的长带，再收回鳍根后端。
    const k = Math.round(n * 0.45), high = outer[k]!, rearBase = base[0]!;
    const tip = { x: rearBase.x - height * 1.25, y: rearBase.y + dir * height * 0.95 };
    const trail: Point[] = [];
    quad(trail, high, { x: (high.x + tip.x) / 2, y: high.y + dir * height * 0.12 }, tip, 8);
    quad(trail, tip, { x: (rearBase.x + tip.x) / 2, y: rearBase.y + dir * height * 0.55 }, { x: rearBase.x, y: rearBase.y + dir * height * 0.08 }, 8);
    polygon = [...inset, ...outer.slice(k).reverse(), ...trail];
  }
  const rays: Array<[Point, Point]> = Array.from({ length: spec.rays }, (_, i) => {
    const index = Math.round((i + 0.5) / spec.rays * n);
    return [inset[index]!, outer[index]!];
  });
  const middle = base[Math.round(n / 2)]!;
  return { kind: 'dorsal', polygon, rays, pivot: middle };
}

function polygonBounds(points: Point[], bounds: Bounds, offset: Point = { x: 0, y: 0 }) {
  for (const p of points) {
    bounds.minX = Math.min(bounds.minX, p.x + offset.x); bounds.maxX = Math.max(bounds.maxX, p.x + offset.x);
    bounds.minY = Math.min(bounds.minY, p.y + offset.y); bounds.maxY = Math.max(bounds.maxY, p.y + offset.y);
  }
}

function computeGeometry(design: FishDesign): FishGeometry {
  const body = byId(bodies, design.bodyId, 'body'), head = byId(heads, design.parts.headId, 'head');
  const tail = byId(tails, design.parts.tailId, 'tail'), finSet = byId(finSets, design.parts.finId, 'fin');
  const eye = byId(eyes, design.parts.eyeId, 'eye'), mouth = byId(mouths, design.parts.mouthId, 'mouth');
  const axes = { x: design.shape.length, y: design.shape.height * bodyAspect };
  const outline = bodyOutline(body, head, design.shape.headRatio, design.sculpt);
  const toActual = (p: Point): Point => ({ x: p.x * axes.x, y: p.y * axes.y });

  const trunkSteps = 44, headSteps = 40;
  const topC: Point[] = [], bottomC: Point[] = [];
  for (let i = 0; i <= trunkSteps; i += 1) {
    const s = i / trunkSteps, x = outline.trunkX(s);
    topC.push({ x, y: outline.trunkTop(s) }); bottomC.push({ x, y: outline.trunkBottom(s) });
  }
  for (let j = 1; j <= headSteps; j += 1) {
    const t = j / headSteps, x = outline.headX(t);
    topC.push({ x, y: outline.headTop(t) }); bottomC.push({ x, y: outline.headBottom(t) });
  }
  const canonicalContour = [...topC, ...bottomC.slice(0, -1).reverse()];
  const contour = canonicalContour.map(toActual);
  const top = topC.map(toActual), bottom = bottomC.map(toActual);
  let maxHalf = 0;
  for (let i = 0; i < top.length; i += 1) maxHalf = Math.max(maxHalf, (bottom[i]!.y - top[i]!.y) / 2);

  // 鳃盖弧线：从颈部上沿到下沿，向尾部微凸。
  const neckTop = toActual({ x: outline.neckX, y: outline.topN }), neckBottom = toActual({ x: outline.neckX, y: outline.bottomN });
  const neckHalf = (neckBottom.y - neckTop.y) / 2, headLengthA = outline.headLength * axes.x;
  const bulge = Math.min(0.55 * neckHalf, 0.3 * headLengthA);
  const gill: Point[] = [neckTop];
  quad(gill, neckTop, { x: neckTop.x - bulge * 2, y: (neckTop.y + neckBottom.y) / 2 }, neckBottom, 16);
  const headTopPts = top.slice(trunkSteps), headBottomPts = bottom.slice(trunkSteps);
  const headRegion = [...gill, ...headBottomPts.slice(1), ...headTopPts.slice(1, -1).reverse()];
  const trunk = [...top.slice(0, trunkSteps + 1), ...gill.slice(1), ...bottom.slice(0, trunkSteps).reverse()];

  // 尾柄与尾巴：根部高度对齐尾柄，整体大小按身体最大高度并有上下限。
  const pTop = outline.trunkTop(0), pBottom = outline.trunkBottom(0);
  const peduncle = { x: -0.5 * axes.x, center: (pTop + pBottom) / 2 * axes.y, height: (pBottom - pTop) * axes.y };
  const tailSize = clamp(maxHalf * 1.25 * tail.size, 0.13, 0.46);
  const tailShape = tailPolygon(tail.id, tailSize, peduncle.height);

  const fins = finSet.fins.map((spec) => ({ ...buildFin(spec, outline, axes, maxHalf), kind: spec.edge === 'top' ? 'dorsal' as const : 'ventral' as const }));

  // 胸鳍：鳃盖后方、身体中线偏下，近侧绘制。
  const pectoralSize = clamp(finSet.pectoral.size * maxHalf * 0.95, 0.045, 0.3);
  const pivot = { x: neckTop.x - bulge * 0.9, y: (neckTop.y + neckBottom.y) / 2 + neckHalf * 0.3 };
  const w = finSet.pectoral.shape === 'rounded' ? 0.42 : 0.28;
  const local: Point[] = [{ x: 0.04, y: -0.1 }];
  quad(local, local[0]!, { x: -0.55, y: -0.32 }, { x: -1, y: 0.05 }, 10);
  quad(local, local[local.length - 1]!, { x: -0.75, y: w + 0.22 }, { x: 0.02, y: 0.12 }, 10);
  const angle = 0.42, cos = Math.cos(angle), sin = Math.sin(angle);
  const place = (p: Point): Point => ({ x: pivot.x + (p.x * cos - p.y * sin) * pectoralSize, y: pivot.y + (p.x * sin + p.y * cos) * pectoralSize });
  const pectoralPolygon = local.map(place);
  const pectoralRays: Array<[Point, Point]> = [0.25, 0.4, 0.55, 0.7, 0.85].map((k) => [place({ x: 0, y: 0 }), pectoralPolygon[Math.round(k * (local.length - 1))]!]);
  const pectoral: FinGeometry = { kind: 'pectoral', polygon: pectoralPolygon, rays: pectoralRays, pivot };

  // 眼睛：头型给出区域，半径受当地高度限制并与轮廓保持间距。
  // 按眼睛覆盖的整段宽度取最窄的头部高度，斜额头上也不会碰出轮廓。
  const et = head.eye.t, spanT = Math.min(0.05 * eye.scale, 0.3 * headLengthA) / headLengthA;
  const ts = [et - spanT, et, et + spanT].map((t) => clamp(t, 0, 1));
  const eyeTop = Math.max(...ts.map((t) => outline.headTop(t))) * axes.y, eyeBottom = Math.min(...ts.map((t) => outline.headBottom(t))) * axes.y;
  const localHalf = (eyeBottom - eyeTop) / 2;
  const radius = Math.min(0.05 * eye.scale, 0.4 * localHalf, 0.3 * headLengthA);
  const eyeX = Math.max(outline.headX(et) * axes.x, neckTop.x + radius * 1.4);
  const eyeY = clamp((eyeTop + eyeBottom) / 2 - head.eye.rise * localHalf, eyeTop + radius * 1.25, eyeBottom - radius * 1.25);

  // 嘴：位置由头型前缘计算；细长嘴向前延伸，不改变头部轮廓。
  const mt = mouth.placement === 'top' ? 0.88 : mouth.placement === 'bottom' ? 0.8 : 1;
  const sample = (t: number, side: 'top' | 'bottom') => ({ x: outline.headX(t) * axes.x, y: (side === 'top' ? outline.headTop(t) : outline.headBottom(t)) * axes.y });
  const tipPoint = sample(1, 'top');
  let anchor = tipPoint, mouthAngle = 0;
  if (mouth.placement !== 'tip') {
    const side = mouth.placement;
    anchor = sample(mt, side);
    const ahead = sample(Math.min(1, mt + 0.02), side), behind = sample(mt - 0.02, side);
    const tangent = Math.atan2(ahead.y - behind.y, ahead.x - behind.x);
    mouthAngle = tangent;
  }
  const mouthHalf = (outline.headBottom(0.75) - outline.headTop(0.75)) / 2 * axes.y;
  const mouthSize = clamp(mouthHalf * 0.75, 0.018, 0.06);
  const reach = mouth.style === 'elongated' ? clamp(0.17 * axes.x, 0.12, 0.24) : mouth.style === 'protrusible' ? mouthSize * 1.3 : mouthSize * 0.3;

  const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  polygonBounds(contour, bounds);
  // 尾巴按最大摆角预留空间。
  const swing = 0.32;
  for (const p of tailShape.polygon) for (const a of [-swing, 0, swing]) {
    const c = Math.cos(a), s = Math.sin(a);
    polygonBounds([{ x: p.x * c - p.y * s, y: p.x * s + p.y * c }], bounds, { x: peduncle.x, y: peduncle.center });
  }
  for (const fin of fins) polygonBounds(fin.polygon, bounds);
  polygonBounds(pectoral.polygon, bounds);
  polygonBounds([{ x: anchor.x + reach, y: anchor.y }, { x: anchor.x, y: anchor.y + mouthSize * 2.4 }], bounds);

  return {
    axes, contour, canonicalContour, head: headRegion, trunk, gill,
    neck: { x: neckTop.x, top: neckTop.y, bottom: neckBottom.y, slopeTop: outline.slopeTop * axes.y / axes.x, slopeBottom: outline.slopeBottom * axes.y / axes.x },
    peduncle, tail: { pivot: { x: peduncle.x, y: peduncle.center }, size: tailSize, ...tailShape },
    fins, pectoral, eye: { center: { x: eyeX, y: eyeY }, radius }, mouth: { anchor, angle: mouthAngle, size: mouthSize, reach },
    bounds, bodyBox: (() => { const b: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }; polygonBounds(contour, b); return b; })(),
    headStart: neckTop.x, maxHalfHeight: maxHalf,
  };
}

const cache = new Map<string, FishGeometry>();
/** 按造型与部件缓存；绘画、颜色和印章变化不重建几何。 */
export function getFishGeometry(design: FishDesign): FishGeometry {
  const key = `${design.bodyId}|${design.parts.headId}|${design.parts.tailId}|${design.parts.finId}|${design.parts.eyeId}|${design.parts.mouthId}|${design.shape.length}|${design.shape.height}|${design.shape.headRatio}|${JSON.stringify(design.sculpt)}`;
  let geometry = cache.get(key);
  if (!geometry) {
    geometry = computeGeometry(design);
    if (cache.size > 96) cache.delete(cache.keys().next().value!);
    cache.set(key, geometry);
  }
  return geometry;
}

export function fitFish(bounds: Bounds, width: number, height: number) {
  if (![width, height].every((value) => Number.isFinite(value) && value > 0)) throw new RangeError('Invalid viewport');
  const scale = Math.min(width * 0.8 / (bounds.maxX - bounds.minX), height * 0.76 / (bounds.maxY - bounds.minY));
  return { scale, x: width / 2 - (bounds.minX + bounds.maxX) / 2 * scale,
    y: height / 2 - (bounds.minY + bounds.maxY) / 2 * scale };
}

/** 工坊相机：当前部件在最大长高下的范围。调比例不改变相机，换部件才重新取景。 */
export function getEditorBounds(design: FishDesign): Bounds {
  const result: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const headRatio of [shapeLimits.headRatio.min, shapeLimits.headRatio.max]) {
    const b = getFishGeometry({ ...design, shape: { length: shapeLimits.length.max, height: shapeLimits.height.max, headRatio } }).bounds;
    result.minX = Math.min(result.minX, b.minX); result.minY = Math.min(result.minY, b.minY);
    result.maxX = Math.max(result.maxX, b.maxX); result.maxY = Math.max(result.maxY, b.maxY);
  }
  return result;
}

export function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!, b = polygon[j]!;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export interface FishPlacement { x: number; y: number; scale: number; facing?: number }

/**
 * 画布 CSS 像素 → 鱼规范坐标（身体框 [-0.5,0.5]²）。输入不乘 DPR；
 * 依次逆转渲染器的 平移 → 实例缩放/朝向 → 身体长高缩放。
 */
export function screenToCanonical(point: Point, placement: FishPlacement, axes: Axes): Point {
  const local = screenToLocal(point, placement);
  if (!(axes.x > 0) || !(axes.y > 0)) throw new RangeError('Invalid transform');
  return { x: local.x / axes.x, y: local.y / axes.y };
}
/** 画布 CSS 像素 → 鱼实际局部坐标（未除以身体长高）。 */
export function screenToLocal(point: Point, placement: FishPlacement): Point {
  const facing = placement.facing ?? 1;
  if (!(placement.scale > 0) || facing === 0) throw new RangeError('Invalid transform');
  return { x: (point.x - placement.x) / (placement.scale * facing), y: (point.y - placement.y) / placement.scale };
}
export function canonicalToScreen(point: Point, placement: FishPlacement, axes: Axes): Point {
  const facing = placement.facing ?? 1;
  return { x: placement.x + point.x * axes.x * placement.scale * facing, y: placement.y + point.y * axes.y * placement.scale };
}
/** 规范坐标 → 纹理 UV；纹理与身体规范框一一对应，换轮廓只影响裁剪。 */
export function canonicalToUv(point: Point): Point {
  return { x: point.x + 0.5, y: point.y + 0.5 };
}

export type FishRegion = 'head' | 'body' | 'fin' | 'tail';
/** 点击位置所属的可换色区域（实际局部坐标）；近侧胸鳍优先，其次头、身体、鳍、尾。 */
export function hitRegion(geometry: FishGeometry, local: Point): FishRegion | null {
  if (pointInPolygon(local, geometry.pectoral.polygon)) return 'fin';
  if (pointInPolygon(local, geometry.contour)) return pointInPolygon(local, geometry.head) ? 'head' : 'body';
  if (geometry.fins.some((fin) => pointInPolygon(local, fin.polygon))) return 'fin';
  const tailLocal = { x: local.x - geometry.tail.pivot.x, y: local.y - geometry.tail.pivot.y };
  return pointInPolygon(tailLocal, geometry.tail.polygon) ? 'tail' : null;
}
