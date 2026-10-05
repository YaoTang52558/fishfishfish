import { shade } from './color.ts';

/** 在单位半径内绘制一枚印章；调用方负责平移、旋转与缩放。 */
export function drawStampShape(ctx: CanvasRenderingContext2D, kind: string, color: string) {
  ctx.beginPath();
  if (kind === 'starfish') {
    for (let k = 0; k < 10; k += 1) { const a = -Math.PI / 2 + k * Math.PI / 5, d = k % 2 ? 0.42 : 1; ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d); }
    ctx.closePath();
  } else if (kind === 'shell') {
    ctx.moveTo(0, 0.85);
    for (let k = 0; k <= 6; k += 1) { const a = Math.PI + k * Math.PI / 6; ctx.quadraticCurveTo(Math.cos(a - Math.PI / 12) * 1.05, Math.sin(a - Math.PI / 12) * 1.05 + 0.2, Math.cos(a) * 0.95, Math.sin(a) * 0.95 + 0.2); }
    ctx.closePath();
  } else if (kind === 'bubble') {
    ctx.arc(0, 0, 0.9, 0, Math.PI * 2);
  } else if (kind === 'bolt') {
    for (const [x, y] of [[0.25, -1], [-0.45, 0.1], [-0.02, 0.1], [-0.3, 1], [0.48, -0.18], [0.06, -0.18]]) ctx.lineTo(x!, y!);
    ctx.closePath();
  } else if (kind === 'heart') {
    ctx.moveTo(0, 0.85);
    ctx.bezierCurveTo(-1.1, 0.05, -0.75, -0.95, 0, -0.38);
    ctx.bezierCurveTo(0.75, -0.95, 1.1, 0.05, 0, 0.85);
  } else if (kind === 'flower') {
    for (let k = 0; k < 5; k += 1) { const a = -Math.PI / 2 + k * 2 * Math.PI / 5; ctx.moveTo(0, 0); ctx.ellipse(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.48, 0.3, a, 0, Math.PI * 2); }
  }
  if (kind === 'bubble') {
    ctx.fillStyle = color; ctx.globalAlpha *= 0.35; ctx.fill(); ctx.globalAlpha /= 0.35;
    ctx.lineWidth = 0.12; ctx.strokeStyle = shade(color, -0.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(-0.32, -0.32, 0.18, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill();
    return;
  }
  ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = 0.08; ctx.lineJoin = 'round'; ctx.strokeStyle = shade(color, -0.35); ctx.stroke();
  if (kind === 'flower') { ctx.beginPath(); ctx.arc(0, 0, 0.26, 0, Math.PI * 2); ctx.fillStyle = '#EAC779'; ctx.fill(); }
  if (kind === 'shell') {
    ctx.beginPath();
    for (let k = 1; k < 6; k += 1) { const a = Math.PI + k * Math.PI / 6; ctx.moveTo(0, 0.8); ctx.lineTo(Math.cos(a) * 0.8, Math.sin(a) * 0.8 + 0.2); }
    ctx.lineWidth = 0.06; ctx.stroke();
  }
}
