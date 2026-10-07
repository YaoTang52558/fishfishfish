/** Calm shallow water shared by creation, trial and close-up; no moving camera while drawing. */
export function drawStudioWater(ctx: CanvasRenderingContext2D, width: number, height: number, dark = false) {
  const water = ctx.createLinearGradient(0, 0, width * .15, height);
  water.addColorStop(0, dark ? '#132b43' : '#a3dde0');
  water.addColorStop(.55, dark ? '#0b1d32' : '#56adbb');
  water.addColorStop(1, dark ? '#050d1c' : '#367f91');
  ctx.fillStyle = water; ctx.fillRect(0, 0, width, height);
  ctx.save(); ctx.fillStyle = '#f5ffff'; ctx.globalAlpha = dark ? .025 : .12;
  for (let i = 0; i < 3; i++) {
    const x = width * (.07 + i * .31);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + width * .075, 0);
    ctx.lineTo(x + width * .26, height); ctx.lineTo(x + width * .13, height); ctx.fill();
  }
  ctx.globalAlpha = dark ? .06 : .38; ctx.fillStyle = dark ? '#487183' : '#d8e5cc';
  ctx.beginPath(); ctx.moveTo(0, height * .91);
  ctx.quadraticCurveTo(width * .3, height * .84, width * .6, height * .93);
  ctx.quadraticCurveTo(width * .85, height * .97, width, height * .88);
  ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.fill(); ctx.restore();
}
