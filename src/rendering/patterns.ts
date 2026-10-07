import { seededRandom } from '../domain/fish.ts';

/*
 * 花纹在“花纹空间”中绘制：x ∈ [-0.5,0.5]，y ∈ [-0.35,0.35]，即默认长高时的实际尺寸；
 * 调用方再按 length/height 缩放，所以花纹随身体伸缩，默认比例下圆点是圆的。
 */
export function drawPattern(ctx: CanvasRenderingContext2D, id: string, primary: string, secondary: string, detail: { size?: number; density?: number } = {}) {
  const random = seededRandom(7);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const size = detail.size ?? 1, density = detail.density ?? 1;
  if (id === 'clown-bands') {
    // Three broad ribbons; spacing changes while the count stays three.
    for (const center of [-0.3 / density, 0, 0.29 / density]) {
      ctx.beginPath();
      ctx.moveTo(center - 0.015, -0.42); ctx.bezierCurveTo(center + 0.025, -0.12, center - 0.035, 0.16, center + 0.008, 0.42);
      ctx.strokeStyle = secondary; ctx.lineWidth = 0.075 * size; ctx.stroke();
      ctx.strokeStyle = primary; ctx.lineWidth = 0.057 * size; ctx.stroke();
    }
  } else if (id === 'grouper-spots') {
    const step = 0.085 / density;
    for (let row = 0, y = -0.42; y < 0.43; row++, y += step) for (let x = -0.56; x < 0.56; x += step) {
      const px = x + (row % 2) * step / 2 + (random() - 0.5) * step * 0.25, py = y + (random() - 0.5) * step * 0.25;
      const radius = (0.013 + random() * 0.009) * size;
      ctx.beginPath(); ctx.arc(px, py, radius * 1.18, 0, Math.PI * 2); ctx.fillStyle = secondary; ctx.fill();
      ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.fillStyle = primary; ctx.fill();
    }
  } else if (id === 'honeycomb') {
    const radius = 0.055 / density, stepY = Math.sqrt(3) * radius;
    // Cream channels surround packed polygonal spots; size adjusts the channel width.
    const fillRadius = radius * Math.min(0.96, 0.56 + size * 0.25);
    ctx.fillStyle = secondary; ctx.fillRect(-0.6, -0.46, 1.2, 0.92);
    for (let col = 0, x = -0.6; x < 0.65; col++, x += radius * 1.5) for (let y = -0.46; y < 0.52; y += stepY) {
      const cy = y + (col % 2) * stepY / 2;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; ctx.lineTo(x + Math.cos(a) * fillRadius, cy + Math.sin(a) * fillRadius); }
      ctx.closePath(); ctx.fillStyle = primary; ctx.fill();
    }
  } else if (id === 'bands') {
    for (let x = -0.44; x < 0.5; x += 0.15) {
      ctx.fillStyle = primary; ctx.fillRect(x, -0.4, 0.055, 0.8);
      ctx.fillStyle = secondary; ctx.fillRect(x + 0.07, -0.4, 0.014, 0.8);
    }
  } else if (id === 'lines') {
    for (const [y, w, color] of [[-0.13, 0.034, primary], [-0.06, 0.012, secondary], [0.02, 0.034, primary], [0.09, 0.012, secondary], [0.16, 0.03, primary]] as const) {
      ctx.fillStyle = color; ctx.fillRect(-0.55, y, 1.1, w);
    }
  } else if (id === 'spots') {
    for (let row = 0; row < 9; row += 1) for (let col = 0; col < 14; col += 1) {
      const x = -0.5 + col * 0.075 + (row % 2) * 0.037, y = -0.34 + row * 0.08;
      ctx.beginPath(); ctx.arc(x, y, row % 2 ? 0.016 : 0.028, 0, Math.PI * 2);
      ctx.fillStyle = row % 2 ? secondary : primary; ctx.fill();
    }
  } else if (id === 'waves') {
    for (let k = -3; k <= 3; k += 1) {
      ctx.beginPath();
      for (let x = -0.55; x <= 0.55; x += 0.01) { const y = k * 0.1 + 0.03 * Math.sin(x * 20 + k); if (x === -0.55) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.strokeStyle = k % 2 ? secondary : primary; ctx.lineWidth = k % 2 ? 0.014 : 0.032; ctx.stroke();
    }
  } else if (id === 'scales') {
    ctx.lineWidth = 0.007;
    for (let row = 0; row < 15; row += 1) for (let col = 0; col < 18; col += 1) {
      const x = -0.52 + col * 0.062 + (row % 2) * 0.031, y = -0.36 + row * 0.05;
      ctx.beginPath(); ctx.arc(x, y, 0.034, -Math.PI / 2, Math.PI / 2, true);
      ctx.fillStyle = primary; ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 0.9;
      ctx.strokeStyle = secondary; ctx.stroke(); ctx.globalAlpha = 1;
    }
  } else if (id === 'checks') {
    for (let row = 0; row < 10; row += 1) for (let col = 0; col < 14; col += 1) {
      ctx.fillStyle = (row + col) % 2 ? primary : secondary; ctx.globalAlpha = 0.7;
      ctx.fillRect(-0.56 + col * 0.08, -0.4 + row * 0.08, 0.08, 0.08);
    }
  } else if (id === 'countershade') {
    const gradient = ctx.createLinearGradient(0, -0.35, 0, 0.35);
    gradient.addColorStop(0, primary); gradient.addColorStop(0.45, primary); gradient.addColorStop(0.62, secondary); gradient.addColorStop(1, secondary);
    ctx.fillStyle = gradient; ctx.fillRect(-0.6, -0.45, 1.2, 0.9);
  } else if (id === 'zebra') {
    for (let i = 0; i < 9; i += 1) {
      const x = -0.46 + i * 0.12 + random() * 0.03, bend = (random() - 0.5) * 0.12;
      ctx.beginPath(); ctx.moveTo(x, -0.42);
      ctx.bezierCurveTo(x + bend, -0.15, x - bend, 0.12, x + bend * 0.5, 0.42);
      ctx.strokeStyle = i % 3 === 2 ? secondary : primary; ctx.lineWidth = 0.025 + random() * 0.025; ctx.stroke();
    }
  } else if (id === 'stars') {
    for (let i = 0; i < 46; i += 1) {
      const x = -0.5 + random(), y = -0.35 + random() * 0.7, r = 0.012 + random() * 0.016;
      ctx.beginPath();
      for (let k = 0; k < 8; k += 1) { const a = k * Math.PI / 4, d = k % 2 ? r * 0.35 : r; ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
      ctx.closePath(); ctx.fillStyle = i % 2 ? secondary : primary; ctx.fill();
    }
  } else if (id === 'eyespot') {
    for (const [r, color] of [[0.085, primary], [0.06, secondary], [0.032, '#243D38']] as const) {
      ctx.beginPath(); ctx.arc(-0.27, -0.04, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    }
  }
  ctx.restore();
}
