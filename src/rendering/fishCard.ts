import { fitFish, getFishGeometry } from '../domain/geometry.ts';
import type { OriginalFish } from '../domain/types.ts';
import { renderFish } from './FishRenderer.ts';
/** A shareable image, never a replacement for an editable backup. */
export async function exportFishCard(fish: OriginalFish, paint: CanvasImageSource | null, glow: CanvasImageSource | null) {
  const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 850;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('这台设备暂时无法导出图片。');
  const gradient = ctx.createLinearGradient(0, 0, 0, 850); gradient.addColorStop(0, '#e9f7ed'); gradient.addColorStop(1, '#8fcacf');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1200, 850);
  ctx.fillStyle = '#2e685c'; ctx.font = '24px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('我创造的鱼 · 我的海洋', 600, 66);
  const fitted = fitFish(getFishGeometry(fish.design).bounds, 1200, 590);
  renderFish(ctx, fish.design, { ...fitted, y: fitted.y + 92 }, { paint, glow: glow ? { source: glow, version: fish.revision } : null });
  ctx.fillStyle = '#214f49'; ctx.font = 'bold 44px sans-serif'; ctx.fillText(fish.name, 600, 748, 1100);
  ctx.font = '22px sans-serif'; ctx.fillText('自由想象的作品', 600, 797);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png')); if (!blob) throw new Error('图片没有生成，请再试一次。');
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `${fish.name.replace(/[<>:"/\\|?*]/g, '_')}-作品鱼卡.png`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
