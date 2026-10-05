import { bodyAspect, eyes, mouths, paintResolution } from '../catalog/fish.ts';
import { getFishGeometry, type FishGeometry, type FishPlacement } from '../domain/geometry.ts';
import type { EffectId, FishDesign, Point } from '../domain/types.ts';
import { shade } from './color.ts';
import { drawPattern } from './patterns.ts';
import { drawStampShape } from './stamps.ts';

export interface RenderOptions {
  /** 512×512 自由颜色层，坐标对应身体规范框；按当前轮廓裁剪后绘制。 */
  paint?: CanvasImageSource | null;
  /** 512×512 发光层与其版本号（用于缓存裁剪结果）。 */
  glow?: { source: CanvasImageSource; version: number } | null;
  /** 尾巴绕尾柄的摆动角（弧度）。 */
  tailAngle?: number;
  /** 胸鳍摆动角（弧度）。 */
  finAngle?: number;
  /** 飘带等柔软尾巴的波动相位。 */
  wave?: number;
  /** 暗背景预览：0–1，压暗鱼身（发光不受影响）。 */
  dim?: number;
  /** 工坊选中的印章，画虚线圈。 */
  selectedStampId?: string | null;
  /**
   * 海洋等多鱼场景：身体内部（底色、花纹、头色、明暗、笔迹、印章）缓存成位图，
   * 只在作品或缩放档位变化时重建，避免每帧重放全部笔迹。cacheKey 需随作品修订变化。
   */
  cache?: Map<string, BodySprite>;
  cacheKey?: string;
  /** 彩蛋特效（游戏设定）与动画时间（秒）；减少动态时调用方不传。 */
  effect?: EffectId | null;
  time?: number;
}

export interface BodySprite { key: string; canvas: HTMLCanvasElement; box: { minX: number; minY: number; maxX: number; maxY: number } }

/** 身体内部：底色 → 花纹（只在躯干）→ 头色 → 明暗 → 自由颜色层 → 印章，全部裁剪在轮廓内。 */
function drawBodyInterior(ctx: CanvasRenderingContext2D, design: FishDesign, geometry: FishGeometry, paint: CanvasImageSource | null) {
  const { axes } = geometry;
  trace(ctx, geometry.contour); ctx.fillStyle = design.colors.body; ctx.fill();
  ctx.save();
  trace(ctx, geometry.contour); ctx.clip();
  if (design.pattern.id !== 'none') {
    ctx.save(); trace(ctx, geometry.trunk); ctx.clip();
    ctx.scale(axes.x, axes.y / bodyAspect);
    drawPattern(ctx, design.pattern.id, design.pattern.primary, design.pattern.secondary);
    ctx.restore();
  }
  trace(ctx, geometry.head); ctx.fillStyle = design.colors.head; ctx.fill();
  // 柔和的背深腹浅明暗，在笔迹之下，不改变孩子画的颜色。
  const { minX, maxX, minY: top, maxY: bottom } = geometry.bodyBox;
  const light = ctx.createLinearGradient(0, top, 0, bottom);
  light.addColorStop(0, 'rgba(16,40,40,0.16)'); light.addColorStop(0.45, 'rgba(16,40,40,0)'); light.addColorStop(0.75, 'rgba(255,255,255,0)'); light.addColorStop(1, 'rgba(255,255,255,0.18)');
  ctx.fillStyle = light; ctx.fillRect(minX, top, maxX - minX, bottom - top);
  if (paint) { ctx.imageSmoothingEnabled = true; ctx.drawImage(paint, -0.5 * axes.x, -0.5 * axes.y, axes.x, axes.y); }
  for (const stamp of design.stamps) {
    ctx.save();
    ctx.translate((stamp.u - 0.5) * axes.x, (stamp.v - 0.5) * axes.y); ctx.rotate(stamp.rotation);
    const radius = stamp.scale * axes.x / 2; ctx.scale(radius, radius);
    drawStampShape(ctx, stamp.kind, stamp.color);
    ctx.restore();
  }
  ctx.restore();
}
/** 按当前像素密度分档缓存身体内部；档位相差 19% 以内复用，镜头缩放时不会每帧重建。 */
function drawCachedBody(ctx: CanvasRenderingContext2D, design: FishDesign, geometry: FishGeometry, options: RenderOptions, cache: Map<string, BodySprite>, cacheKey: string) {
  const transform = ctx.getTransform();
  const density = Math.hypot(transform.a, transform.b);
  const bucket = 2 ** (Math.ceil(Math.log2(Math.max(density, 1)) * 4) / 4);
  const key = `${cacheKey}|${bucket}`;
  let sprite = cache.get(cacheKey);
  if (sprite?.key !== key) {
    const pad = 0.01, box = { minX: geometry.bodyBox.minX - pad, minY: geometry.bodyBox.minY - pad, maxX: geometry.bodyBox.maxX + pad, maxY: geometry.bodyBox.maxY + pad };
    const canvas = sprite?.canvas ?? document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil((box.maxX - box.minX) * bucket)); canvas.height = Math.max(1, Math.ceil((box.maxY - box.minY) * bucket));
    const sctx = canvas.getContext('2d')!;
    sctx.setTransform(bucket, 0, 0, bucket, -box.minX * bucket, -box.minY * bucket);
    sctx.lineJoin = 'round';
    drawBodyInterior(sctx, design, geometry, options.paint ?? null);
    sprite = { key, canvas, box };
    cache.set(cacheKey, sprite);
  }
  const { box } = sprite;
  ctx.drawImage(sprite.canvas, box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);
}

function trace(ctx: CanvasRenderingContext2D, points: readonly Point[], close = true) {
  ctx.beginPath();
  points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  if (close) ctx.closePath();
}
function drawFinShape(ctx: CanvasRenderingContext2D, polygon: readonly Point[], rays: ReadonlyArray<readonly [Point, Point]>, color: string, alpha = 0.95) {
  ctx.save();
  ctx.globalAlpha = alpha; trace(ctx, polygon); ctx.fillStyle = color; ctx.fill();
  ctx.clip();
  ctx.beginPath();
  for (const [from, to] of rays) { ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); }
  ctx.strokeStyle = shade(color, -0.3); ctx.globalAlpha = alpha * 0.45; ctx.lineWidth = 0.0045; ctx.stroke();
  ctx.restore();
  ctx.save(); trace(ctx, polygon); ctx.strokeStyle = shade(color, -0.4); ctx.globalAlpha = 0.45; ctx.lineWidth = 0.005; ctx.stroke(); ctx.restore();
}
function rotateAbout(ctx: CanvasRenderingContext2D, pivot: Point, angle: number) {
  ctx.translate(pivot.x, pivot.y); ctx.rotate(angle); ctx.translate(-pivot.x, -pivot.y);
}

function drawEye(ctx: CanvasRenderingContext2D, design: FishDesign, geometry: FishGeometry) {
  const style = eyes.find((eye) => eye.id === design.parts.eyeId)?.style ?? 'round';
  const { center: c, radius: r } = geometry.eye;
  const dark = '#243D38';
  const circle = (x: number, y: number, radius: number, color: string) => { ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); };
  if (style === 'dot') { circle(c.x, c.y, r, dark); circle(c.x + r * 0.3, c.y - r * 0.3, r * 0.3, '#FFFFFF'); return; }
  circle(c.x, c.y, r, '#FFFFFF');
  ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.strokeStyle = shade(design.colors.head, -0.45); ctx.globalAlpha = 0.5; ctx.lineWidth = Math.max(0.003, r * 0.08); ctx.stroke(); ctx.globalAlpha = 1;
  const pupil = style === 'big' ? 0.62 : style === 'sparkle' ? 0.6 : style === 'sleepy' ? 0.5 : 0.55;
  const py = style === 'sleepy' ? c.y + r * 0.2 : c.y;
  circle(c.x + r * 0.14, py, r * pupil, dark);
  if (style === 'sparkle') {
    ctx.beginPath();
    for (let k = 0; k < 8; k += 1) { const a = k * Math.PI / 4, d = (k % 2 ? 0.12 : 0.34) * r; ctx.lineTo(c.x + r * 0.28 + Math.cos(a) * d, c.y - r * 0.22 + Math.sin(a) * d); }
    ctx.closePath(); ctx.fillStyle = '#FFFFFF'; ctx.fill();
  } else circle(c.x + r * 0.32, c.y - r * 0.24, r * (style === 'big' ? 0.22 : 0.18), '#FFFFFF');
  if (style === 'big') circle(c.x - r * 0.05, c.y + r * 0.22, r * 0.1, '#FFFFFF');
  if (style === 'sleepy') {
    ctx.save(); ctx.beginPath(); ctx.arc(c.x, c.y, r * 1.02, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = shade(design.colors.head, -0.12); ctx.fillRect(c.x - r * 1.2, c.y - r * 1.2, r * 2.4, r * 1.15);
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(c.x - r, c.y - r * 0.05); ctx.quadraticCurveTo(c.x, c.y + r * 0.08, c.x + r, c.y - r * 0.05);
    ctx.strokeStyle = shade(design.colors.head, -0.5); ctx.lineWidth = r * 0.14; ctx.lineCap = 'round'; ctx.stroke();
  }
}

function drawMouth(ctx: CanvasRenderingContext2D, design: FishDesign, geometry: FishGeometry) {
  const style = mouths.find((mouth) => mouth.id === design.parts.mouthId)?.style ?? 'terminal';
  const { anchor, angle, size: s, reach } = geometry.mouth;
  const line = shade(design.colors.head, -0.55);
  ctx.save();
  ctx.translate(anchor.x, anchor.y); ctx.rotate(angle);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = line; ctx.lineWidth = Math.max(0.004, s * 0.2);
  if (style === 'terminal') {
    ctx.beginPath(); ctx.moveTo(-s * 0.02, s * 0.06); ctx.quadraticCurveTo(-s * 0.5, s * 0.5, -s * 1.15, s * 0.3); ctx.stroke();
  } else if (style === 'superior') {
    // 上缘：局部 -y 指向身体外侧（上方）。
    ctx.beginPath(); ctx.moveTo(s * 0.12, -s * 0.12); ctx.quadraticCurveTo(-s * 0.4, s * 0.62, -s * 1.15, s * 0.5);
    ctx.quadraticCurveTo(-s * 0.45, s * 0.22, s * 0.12, -s * 0.12); ctx.fillStyle = line; ctx.fill(); ctx.stroke();
  } else if (style === 'inferior') {
    ctx.beginPath(); ctx.moveTo(s * 0.05, 0); ctx.quadraticCurveTo(-s * 0.45, -s * 0.45, -s * 1, -s * 0.25); ctx.stroke();
    ctx.lineWidth = Math.max(0.003, s * 0.13); ctx.strokeStyle = shade(design.colors.head, -0.35);
    ctx.beginPath(); ctx.moveTo(-s * 0.1, s * 0.05); ctx.quadraticCurveTo(-s * 0.15, s * 1.5, -s * 1.05, s * 2.2);
    ctx.moveTo(-s * 0.45, s * 0.02); ctx.quadraticCurveTo(-s * 0.6, s * 1.15, -s * 1.5, s * 1.6); ctx.stroke();
  } else if (style === 'protrusible') {
    ctx.beginPath(); ctx.ellipse(reach * 0.45, 0, reach * 0.6, s * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = shade(design.colors.head, -0.15); ctx.fill(); ctx.lineWidth = Math.max(0.003, s * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(reach * 0.05, 0); ctx.lineTo(reach * 1.08, 0); ctx.lineWidth = Math.max(0.003, s * 0.14); ctx.stroke();
  } else {
    const h = s * 0.55;
    ctx.beginPath(); ctx.moveTo(-s * 0.3, -h); ctx.quadraticCurveTo(reach * 0.5, -h * 0.4, reach, 0); ctx.quadraticCurveTo(reach * 0.5, h * 0.5, -s * 0.3, h); ctx.closePath();
    ctx.fillStyle = shade(design.colors.head, -0.12); ctx.fill(); ctx.lineWidth = Math.max(0.003, s * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.2, 0); ctx.lineTo(reach * 0.92, 0); ctx.lineWidth = Math.max(0.003, s * 0.08); ctx.stroke();
  }
  ctx.restore();
}

function drawTail(ctx: CanvasRenderingContext2D, design: FishDesign, geometry: FishGeometry, options: RenderOptions) {
  const { pivot, polygon, rays, size } = geometry.tail;
  const wave = options.wave ?? 0;
  // 飘带尾：越靠末端，波动越大。
  const bend = (p: Point): Point => design.parts.tailId === 'ribbon' && p.x < -0.35 * size
    ? { x: p.x, y: p.y + Math.sin(wave - p.x / size * 4) * 0.06 * size * (-p.x / size) } : p;
  ctx.save();
  ctx.translate(pivot.x, pivot.y); ctx.rotate(options.tailAngle ?? 0);
  drawFinShape(ctx, polygon.map(bend), rays.map(([a, b]) => [bend(a), bend(b)] as const), design.colors.tail, 1);
  ctx.restore();
}

/** 彩蛋特效：只是装饰，不改变部件或笔迹。 */
function drawEffect(ctx: CanvasRenderingContext2D, effect: EffectId, geometry: FishGeometry, time: number, tailAngle: number) {
  const { bounds } = geometry;
  const w = bounds.maxX - bounds.minX, h = bounds.maxY - bounds.minY;
  ctx.save();
  if (effect === 'starry') {
    // 星夜漫游者：身体周围闪烁的小星点。
    const spots = [[0.1, -0.15], [0.35, -0.3], [0.7, -0.2], [0.95, 0.1], [0.15, 1.1], [0.55, 1.25], [0.85, 1.05]];
    spots.forEach(([fx, fy], index) => {
      const x = bounds.minX + fx! * w, y = bounds.minY + fy! * h, r = 0.012 + (index % 3) * 0.004;
      ctx.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 2.2 + index * 1.7));
      ctx.beginPath();
      for (let k = 0; k < 8; k += 1) { const a = k * Math.PI / 4, d = k % 2 ? r * 0.35 : r; ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
      ctx.closePath(); ctx.fillStyle = '#FFF6D2'; ctx.fill();
    });
  } else if (effect === 'ribbon') {
    // 海流舞者：尾巴后方缓慢飘动的光带。
    const { pivot, size } = geometry.tail;
    ctx.translate(pivot.x, pivot.y); ctx.rotate(tailAngle * 0.6);
    for (let band = 0; band < 3; band += 1) {
      ctx.beginPath();
      for (let k = 0; k <= 24; k += 1) {
        const t = k / 24, x = -size * (0.4 + t * 1.4), y = (band - 1) * size * 0.25 + Math.sin(time * 1.4 - t * 5 + band) * size * 0.12 * t;
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.strokeStyle = '#E8FFF8'; ctx.globalAlpha = 0.28 - band * 0.06; ctx.lineWidth = size * 0.06; ctx.lineCap = 'round'; ctx.stroke();
    }
  } else {
    // 泡泡伙伴：每隔一会儿从嘴边冒出一串泡泡。
    const { anchor } = geometry.mouth;
    for (let index = 0; index < 3; index += 1) {
      const phase = (time / 2.4 + index / 3) % 1;
      const x = anchor.x + 0.03 + Math.sin(phase * 6 + index) * 0.012, y = anchor.y - phase * h * 0.9;
      ctx.globalAlpha = Math.max(0, 0.8 - phase * 0.8);
      ctx.beginPath(); ctx.arc(x, y, 0.012 + index * 0.004, 0, Math.PI * 2);
      ctx.strokeStyle = '#E6F7F4'; ctx.lineWidth = 0.004; ctx.stroke();
    }
  }
  ctx.restore();
}

const glowCache = new WeakMap<CanvasImageSource, { key: string; canvas: HTMLCanvasElement }>();
/** 发光层裁剪到身体轮廓后缓存；只在笔迹或轮廓变化时重建，不每帧重放。 */
function maskedGlow(source: CanvasImageSource, version: number, geometry: FishGeometry, key: string) {
  // 缓存以发光源为键；同一源换造型时按 key 重建。
  const cacheKey = `${version}|${key}`;
  const cached = glowCache.get(source);
  if (cached?.key === cacheKey) return cached.canvas;
  const canvas = cached?.canvas ?? document.createElement('canvas');
  canvas.width = paintResolution; canvas.height = paintResolution;
  // 彩蛋规则会读回像素数，第一次取上下文时就声明，避免浏览器反复回读的性能警告。
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, paintResolution, paintResolution);
  ctx.drawImage(source, 0, 0, paintResolution, paintResolution);
  ctx.globalCompositeOperation = 'destination-in';
  trace(ctx, geometry.canonicalContour.map((p) => ({ x: (p.x + 0.5) * paintResolution, y: (p.y + 0.5) * paintResolution })));
  ctx.fill();
  glowCache.set(source, { key: cacheKey, canvas });
  return canvas;
}

/** 场景无关的鱼渲染入口；位置与朝向由调用方提供，不改动文档。 */
export function renderFish(ctx: CanvasRenderingContext2D, design: FishDesign, placement: FishPlacement, options: RenderOptions = {}) {
  const geometry = getFishGeometry(design);
  const { axes } = geometry;
  ctx.save();
  ctx.translate(placement.x, placement.y); ctx.scale(placement.scale * (placement.facing ?? 1), placement.scale);
  ctx.lineJoin = 'round';

  // 远侧鳍 → 尾 → 身体 → 头 → 花纹 → 自由颜色层 → 印章 → 近侧鳍 → 眼嘴 → 外轮廓 → 发光层。
  // 暗背景预览：每个部件画完立即压暗自身，后画的部件会盖住前面的，重叠处不会被压暗两次。
  const dimColor = options.dim ? `rgba(6,14,32,${Math.min(0.85, options.dim)})` : null;
  const dimPolygon = (points: readonly Point[]) => { if (dimColor) { trace(ctx, points); ctx.fillStyle = dimColor; ctx.fill(); } };
  for (const fin of geometry.fins) { drawFinShape(ctx, fin.polygon, fin.rays, design.colors.fin); dimPolygon(fin.polygon); }
  drawTail(ctx, design, geometry, options);
  if (dimColor) { ctx.save(); ctx.translate(geometry.tail.pivot.x, geometry.tail.pivot.y); ctx.rotate(options.tailAngle ?? 0); dimPolygon(geometry.tail.polygon); ctx.restore(); }

  if (options.cache && options.cacheKey) drawCachedBody(ctx, design, geometry, options, options.cache, options.cacheKey);
  else drawBodyInterior(ctx, design, geometry, options.paint ?? null);
  dimPolygon(geometry.contour);
  ctx.save(); trace(ctx, geometry.gill, false); ctx.strokeStyle = shade(design.colors.head, -0.4); ctx.globalAlpha = 0.4; ctx.lineWidth = 0.006; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();

  ctx.save(); rotateAbout(ctx, geometry.pectoral.pivot, options.finAngle ?? 0);
  drawFinShape(ctx, geometry.pectoral.polygon, geometry.pectoral.rays, design.colors.fin, 0.88); dimPolygon(geometry.pectoral.polygon); ctx.restore();
  drawEye(ctx, design, geometry);
  if (dimColor) { ctx.beginPath(); ctx.arc(geometry.eye.center.x, geometry.eye.center.y, geometry.eye.radius * 1.05, 0, Math.PI * 2); ctx.fillStyle = dimColor; ctx.fill(); }
  drawMouth(ctx, design, geometry);
  // 外轮廓不描尾柄截面，尾巴根部与身体之间不出现接缝线。
  trace(ctx, geometry.contour, false); ctx.strokeStyle = shade(design.colors.body, -0.5); ctx.globalAlpha = 0.5; ctx.lineWidth = 0.007; ctx.stroke(); ctx.globalAlpha = 1;

  if (options.glow) {
    const key = `${design.bodyId}|${design.parts.headId}|${design.shape.headRatio}`;
    const masked = maskedGlow(options.glow.source, options.glow.version, geometry, key);
    const pixelsPerUnit = Math.hypot(ctx.getTransform().a, ctx.getTransform().b);
    ctx.save();
    // 光晕可以溢出轮廓；笔迹本身已裁剪在身体内。
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = 'rgba(255,248,214,0.9)'; ctx.shadowBlur = Math.min(28, Math.max(4, pixelsPerUnit * 0.03));
    ctx.drawImage(masked, -0.5 * axes.x, -0.5 * axes.y, axes.x, axes.y);
    ctx.restore();
    ctx.drawImage(masked, -0.5 * axes.x, -0.5 * axes.y, axes.x, axes.y);
  }
  if (options.effect) drawEffect(ctx, options.effect, geometry, options.time ?? 0, options.tailAngle ?? 0);
  if (options.selectedStampId) {
    const stamp = design.stamps.find((item) => item.id === options.selectedStampId);
    if (stamp) {
      const pixelsPerUnit = Math.hypot(ctx.getTransform().a, ctx.getTransform().b);
      ctx.beginPath(); ctx.arc((stamp.u - 0.5) * axes.x, (stamp.v - 0.5) * axes.y, stamp.scale * axes.x / 2 * 1.25, 0, Math.PI * 2);
      ctx.setLineDash([6 / pixelsPerUnit, 4 / pixelsPerUnit]); ctx.lineWidth = 2 / pixelsPerUnit; ctx.strokeStyle = '#FFFFFF'; ctx.stroke(); ctx.setLineDash([]);
    }
  }
  ctx.restore();
}

/** 发光笔迹裁剪到当前身体轮廓后的非透明像素数（彩蛋“看得见的发光笔迹”规则使用）。 */
export function visibleGlowPixels(source: CanvasImageSource, version: number, design: FishDesign): number {
  const geometry = getFishGeometry(design);
  const masked = maskedGlow(source, version, geometry, `${design.bodyId}|${design.parts.headId}|${design.shape.headRatio}`);
  const data = masked.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, paintResolution, paintResolution).data;
  let count = 0;
  for (let index = 3; index < data.length; index += 4) if (data[index] !== 0) count += 1;
  return count;
}
