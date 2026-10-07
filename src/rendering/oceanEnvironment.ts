/** One static backdrop per viewport; light motes are drawn separately by the tank. */
export function drawShallowOcean(ctx: CanvasRenderingContext2D, image: HTMLImageElement | null, width: number, height: number) {
  const water = ctx.createLinearGradient(0, 0, 0, height);
  water.addColorStop(0, '#7ACDCE'); water.addColorStop(.6, '#319EAF'); water.addColorStop(1, '#236876');
  ctx.fillStyle = water; ctx.fillRect(0, 0, width, height);
  if (image?.naturalWidth) {
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    ctx.drawImage(image, (width - image.naturalWidth * scale) / 2, (height - image.naturalHeight * scale) / 2, image.naturalWidth * scale, image.naturalHeight * scale);
    // The soft wash separates freely drawn fish from the detailed concept background.
    const veil = ctx.createLinearGradient(0, 0, 0, height);
    veil.addColorStop(0, 'rgba(20,105,123,.04)'); veil.addColorStop(.5, 'rgba(13,93,113,.16)'); veil.addColorStop(1, 'rgba(30,106,108,.05)');
    ctx.fillStyle = veil; ctx.fillRect(0, 0, width, height);
  } else {
    // Keep a complete shallow-water scene when the illustration cannot load.
    ctx.fillStyle = '#CEDBC0'; ctx.beginPath(); ctx.moveTo(0, height * .82);
    ctx.quadraticCurveTo(width * .55, height * .68, width, height * .85); ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.fill();
    for (const x of [.03, .1, .88, .96]) {
      ctx.fillStyle = x < .5 ? '#567F76' : '#789782'; ctx.beginPath(); ctx.ellipse(width * x, height * .83, width * .08, height * .18, -.2, 0, Math.PI * 2); ctx.fill();
    }
  }
}
