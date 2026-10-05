import { paintResolution } from '../../catalog/fish.ts';
import type { Axes } from '../../domain/geometry.ts';
import type { Point } from '../../domain/types.ts';

export interface BrushSettings { color: string; width: number }
export interface PixelRect { x: number; y: number; width: number; height: number }

/**
 * 透明笔迹层（普通颜色层或发光层）：纹理与身体规范框 [-0.5,0.5]² 对应，保存时不裁剪；
 * 渲染时再按当前轮廓裁剪，所以换轮廓不会销毁被遮住的笔迹。
 */
export class PaintLayer {
  readonly canvas: HTMLCanvasElement;
  /** 每次像素变化递增，用于判断是否需要重新编码 PNG 和重建缓存。 */
  version = 0;
  private readonly ctx: CanvasRenderingContext2D;
  private last: Point | null = null;
  private axes: Axes | null = null;
  private radius = { x: 0, y: 0 };
  private dirty: { minX: number; minY: number; maxX: number; maxY: number } | null = null;

  constructor(doc: Document = document) {
    this.canvas = doc.createElement('canvas');
    this.canvas.width = paintResolution; this.canvas.height = paintResolution;
    // 撤销需要读回受影响区域，使用 CPU 友好的画布。
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.ctx = ctx;
  }

  get drawing() { return this.last !== null; }

  /**
   * 以规范坐标开始一笔。笔宽相对身体规范宽度，按落笔时的长高换算，
   * 使笔触在当时的屏幕上是圆的；之后调整比例时笔迹随身体一起伸缩。
   */
  begin(point: Point, axes: Axes, brush: BrushSettings, mode: 'paint' | 'erase' = 'paint') {
    const size = paintResolution;
    this.ctx.setTransform(size / axes.x, 0, 0, size / axes.y, size / 2, size / 2);
    this.ctx.strokeStyle = brush.color; this.ctx.fillStyle = brush.color;
    this.ctx.lineWidth = brush.width; this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round';
    this.ctx.globalCompositeOperation = mode === 'erase' ? 'destination-out' : 'source-over';
    this.axes = axes;
    this.radius = { x: brush.width / 2 / axes.x * size + 2, y: brush.width / 2 / axes.y * size + 2 };
    const actual = { x: point.x * axes.x, y: point.y * axes.y };
    this.ctx.beginPath(); this.ctx.arc(actual.x, actual.y, brush.width / 2, 0, Math.PI * 2); this.ctx.fill();
    this.last = actual;
    this.touch(point);
    this.version += 1;
  }
  extend(point: Point) {
    if (!this.last || !this.axes) return;
    const actual = { x: point.x * this.axes.x, y: point.y * this.axes.y };
    this.ctx.beginPath(); this.ctx.moveTo(this.last.x, this.last.y); this.ctx.lineTo(actual.x, actual.y); this.ctx.stroke();
    this.last = actual;
    this.touch(point);
    this.version += 1;
  }
  end() { this.last = null; this.axes = null; this.ctx.globalCompositeOperation = 'source-over'; }

  /** 本笔影响的纹理像素区域（含笔宽），读取后清空。 */
  takeDirty(): PixelRect | null {
    const dirty = this.dirty;
    this.dirty = null;
    if (!dirty) return null;
    const x = Math.max(0, Math.floor(dirty.minX)), y = Math.max(0, Math.floor(dirty.minY));
    const maxX = Math.min(paintResolution, Math.ceil(dirty.maxX)), maxY = Math.min(paintResolution, Math.ceil(dirty.maxY));
    return maxX > x && maxY > y ? { x, y, width: maxX - x, height: maxY - y } : null;
  }
  snapshot(): ImageData { return this.ctx.getImageData(0, 0, paintResolution, paintResolution); }
  read(rect: PixelRect): ImageData { return this.ctx.getImageData(rect.x, rect.y, rect.width, rect.height); }
  write(rect: PixelRect, data: ImageData) {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.putImageData(data, rect.x, rect.y);
    this.version += 1;
  }

  /** 非透明像素数量；发光“可见笔迹”等规则使用。 */
  countInk(limit = Infinity): number {
    const data = this.ctx.getImageData(0, 0, paintResolution, paintResolution).data;
    let count = 0;
    for (let index = 3; index < data.length; index += 4) if (data[index] !== 0 && ++count >= limit) return count;
    return count;
  }
  isEmpty(): boolean { return this.countInk(1) === 0; }
  clear() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, paintResolution, paintResolution);
    this.version += 1;
  }
  async load(blob: Blob) {
    const bitmap = await createImageBitmap(blob);
    try {
      if (bitmap.width !== paintResolution || bitmap.height !== paintResolution) throw new RangeError('Paint texture must be 512×512');
      this.end(); this.clear();
      this.ctx.drawImage(bitmap, 0, 0);
    } finally { bitmap.close(); }
  }
  toBlob(): Promise<Blob> {
    return new Promise((resolve, reject) => this.canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG encoding failed')), 'image/png'));
  }

  private touch(point: Point) {
    const px = (point.x + 0.5) * paintResolution, py = (point.y + 0.5) * paintResolution;
    const d = this.dirty ?? { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    d.minX = Math.min(d.minX, px - this.radius.x); d.maxX = Math.max(d.maxX, px + this.radius.x);
    d.minY = Math.min(d.minY, py - this.radius.y); d.maxY = Math.max(d.maxY, py + this.radius.y);
    this.dirty = d;
  }
}
