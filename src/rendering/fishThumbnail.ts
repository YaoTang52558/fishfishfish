import { fitFish, getFishGeometry } from '../domain/geometry.ts';
import type { FishDesign } from '../domain/types.ts';
import { renderFish } from './FishRenderer.ts';

/** A static, disposable preview of the saved design and its actual paint layers. */
export function fishThumbnail(design: FishDesign, paint: CanvasImageSource | null, glow: CanvasImageSource | null, revision: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = 240; canvas.height = 144;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const water = ctx.createLinearGradient(0, 0, 0, canvas.height);
  water.addColorStop(0, '#e1f3ed'); water.addColorStop(1, '#c5e3da');
  ctx.fillStyle = water; ctx.fillRect(0, 0, canvas.width, canvas.height);
  renderFish(ctx, design, { ...fitFish(getFishGeometry(design).bounds, canvas.width, canvas.height), facing: 1 }, {
    paint, glow: glow ? { source: glow, version: revision } : null,
  });
  return canvas.toDataURL('image/png');
}
