import type { FishDesign } from '../../domain/types.ts';
import type { Command } from './history.ts';
import type { PaintLayer, PixelRect } from './paintLayer.ts';

/** 造型、部件、颜色、花纹、印章：记录前后文档。撤销时保留当前纹理引用，由存档层管理。 */
export class DesignCommand implements Command {
  readonly label: string;
  private readonly before: FishDesign;
  private readonly after: FishDesign;
  private readonly apply: (design: FishDesign) => void;
  constructor(label: string, before: FishDesign, after: FishDesign, apply: (design: FishDesign) => void) {
    this.label = label; this.before = before; this.after = after; this.apply = apply;
  }
  bytes() { return 2048; }
  undo() { this.apply(this.before); }
  redo() { this.apply(this.after); }
}

interface PixelEntry { layer: PaintLayer; rect: PixelRect; data: ImageData | null; png: Blob | null }

export function cropImageData(source: ImageData, rect: PixelRect): ImageData {
  const out = new ImageData(rect.width, rect.height);
  for (let row = 0; row < rect.height; row += 1) {
    const start = ((rect.y + row) * source.width + rect.x) * 4;
    out.data.set(source.data.subarray(start, start + rect.width * 4), row * rect.width * 4);
  }
  return out;
}

/**
 * 笔迹、橡皮、清空：每层只保存受影响区域的一份像素。
 * 撤销/重做时与当前像素互换——当前像素就是另一方向的状态，因此不必同时保存前后两份。
 */
export class PixelCommand implements Command {
  readonly label: string;
  private readonly entries: PixelEntry[];
  private readonly onChange: () => void;
  constructor(label: string, entries: Array<{ layer: PaintLayer; rect: PixelRect; before: ImageData }>, onChange: () => void) {
    this.label = label; this.onChange = onChange;
    this.entries = entries.map((entry) => ({ layer: entry.layer, rect: entry.rect, data: entry.before, png: null }));
  }
  bytes() { return this.entries.reduce((sum, entry) => sum + (entry.data ? entry.data.data.byteLength : entry.png?.size ?? 0), 0); }
  async undo() { await this.swap(); }
  async redo() { await this.swap(); }
  async compress() {
    let changed = false;
    for (const entry of this.entries) {
      const data = entry.data;
      if (!data) continue;
      const canvas = document.createElement('canvas');
      canvas.width = entry.rect.width; canvas.height = entry.rect.height;
      canvas.getContext('2d')!.putImageData(data, 0, 0);
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      // 编码期间这条记录可能已被撤销互换；只有像素仍是编码时那份才替换。
      if (png && entry.data === data && png.size < data.data.byteLength) { entry.png = png; entry.data = null; changed = true; }
    }
    return changed;
  }
  private async swap() {
    // 先解码全部压缩记录，再同步互换，避免中途出现只换了一层的状态。
    const stored = await Promise.all(this.entries.map((entry) => entry.data ? entry.data : decode(entry.png!, entry.rect)));
    this.entries.forEach((entry, index) => {
      const current = entry.layer.read(entry.rect);
      entry.layer.write(entry.rect, stored[index]!);
      entry.data = current; entry.png = null;
    });
    this.onChange();
  }
}

async function decode(png: Blob, rect: PixelRect): Promise<ImageData> {
  const bitmap = await createImageBitmap(png, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  try {
    const canvas = document.createElement('canvas');
    canvas.width = rect.width; canvas.height = rect.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, rect.width, rect.height);
  } finally { bitmap.close(); }
}
