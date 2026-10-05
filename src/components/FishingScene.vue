<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { CastSpot, Clue, FishingState } from '../domain/fishing.ts';
import { getFishGeometry } from '../domain/geometry.ts';
import { getSwimProfile, tailAngle, createSwimState, stepSwim, finAngle } from '../domain/swim.ts';
import type { FishDesign } from '../domain/types.ts';
import { renderFish } from '../rendering/FishRenderer.ts';

export interface PassingFish { name: string; design: FishDesign; color: CanvasImageSource | null; glow: CanvasImageSource | null; revision: number }
const props = defineProps<{ state: FishingState; tone: 'reef' | 'coast'; passing: PassingFish | null; reducedMotion: boolean }>();
const emit = defineEmits<{ spot: [CastSpot]; greet: [] }>();
const canvas = ref<HTMLCanvasElement>();
let frame = 0, time = 0, last: number | null = null;
// 路过的原创鱼只在水域里游（岸边之外），游出右边后从水域左缘重新出现。
const WATER_START = 0.26;
let passX = WATER_START, passSwim = createSwimState();
const spotX: Record<CastSpot, number> = { near: 0.36, middle: 0.58, far: 0.82 };
const SURFACE = 0.3;

function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * SURFACE);
  sky.addColorStop(0, '#F6E6D7'); sky.addColorStop(1, '#E5ECDF');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h * SURFACE);
  const water = ctx.createLinearGradient(0, h * SURFACE, 0, h);
  water.addColorStop(0, '#2C7A72'); water.addColorStop(1, '#0D3437');
  ctx.fillStyle = water; ctx.fillRect(0, h * SURFACE, w, h);
  // 岸边与钓竿
  ctx.fillStyle = props.tone === 'reef' ? '#E9D6B4' : '#758F89';
  ctx.beginPath(); ctx.moveTo(0, h * 0.24); ctx.lineTo(w * 0.2, h * 0.27); ctx.lineTo(w * 0.24, h); ctx.lineTo(0, h); ctx.fill();
  ctx.strokeStyle = '#624727'; ctx.lineWidth = Math.max(3, w * 0.005); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.25); ctx.lineTo(w * 0.24, h * 0.06); ctx.stroke();
  // 海底装饰
  ctx.globalAlpha = 0.55;
  if (props.tone === 'reef') {
    // 珊瑚：几丛圆头分枝，珊瑚色与桃粉交替。
    ctx.globalAlpha = 0.8; ctx.lineCap = 'round';
    [[0.4, '#E9A598'], [0.62, '#EDBCD0'], [0.9, '#E9A598']].forEach(([x, color], index) => {
      const cx = w * (x as number), base = h, top = h * (0.78 - (index % 2) * 0.04);
      ctx.strokeStyle = color as string; ctx.fillStyle = color as string; ctx.lineWidth = Math.max(5, w * 0.011);
      for (const [dx, ty] of [[-0.035, top + h * 0.03], [0, top], [0.035, top + h * 0.04]]) {
        ctx.beginPath(); ctx.moveTo(cx, base); ctx.quadraticCurveTo(cx + w * dx! * 0.3, (base + ty!) / 2, cx + w * dx!, ty!); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx + w * dx!, ty!, ctx.lineWidth * 0.9, 0, Math.PI * 2); ctx.fill();
      }
    });
  } else {
    ctx.fillStyle = '#4C6662';
    for (const [x, r] of [[0.45, 0.07], [0.7, 0.09], [0.95, 0.06]]) { ctx.beginPath(); ctx.ellipse(w * x!, h, w * r!, h * 0.1, 0, Math.PI, 0); ctx.fill(); }
    ctx.strokeStyle = '#72ADA0'; ctx.lineWidth = Math.max(3, w * 0.005);
    for (const x of [0.5, 0.77]) { const sway = props.reducedMotion ? 0 : Math.sin(time + x * 9) * w * 0.01; ctx.beginPath(); ctx.moveTo(w * x, h); ctx.quadraticCurveTo(w * x + sway, h * 0.8, w * x + sway * 0.5, h * 0.62); ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
}
function drawClue(ctx: CanvasRenderingContext2D, clue: Clue, x: number, w: number, h: number) {
  const y = h * SURFACE;
  ctx.save();
  if (clue === 'bubbles') {
    ctx.strokeStyle = '#E6F7F4'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i += 1) {
      const phase = props.reducedMotion ? i / 5 : ((time * 0.4 + i / 5) % 1);
      ctx.globalAlpha = 0.8 - phase * 0.6;
      ctx.beginPath(); ctx.arc(x + Math.sin(i * 2 + time) * 6, y + h * 0.25 - phase * h * 0.24, 2 + (i % 3), 0, Math.PI * 2); ctx.stroke();
    }
  } else if (clue === 'shadow') {
    ctx.fillStyle = '#05201F'; ctx.globalAlpha = 0.35;
    const dx = props.reducedMotion ? 0 : Math.sin(time * 0.6) * w * 0.03;
    ctx.beginPath(); ctx.ellipse(x + dx, y + h * 0.2, w * 0.05, h * 0.03, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + dx - w * 0.05, y + h * 0.2); ctx.lineTo(x + dx - w * 0.075, y + h * 0.18); ctx.lineTo(x + dx - w * 0.075, y + h * 0.22); ctx.fill();
  } else {
    ctx.strokeStyle = '#E6F7F4'; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x, y + 4, w * 0.035, 3, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}
function drawLine(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const s = props.state;
  if (!s.spot || ['setup', 'caught', 'released'].includes(s.phase)) return;
  const tipX = w * 0.24, tipY = h * 0.06, targetX = w * spotX[s.spot];
  let floatX = targetX, floatY = h * SURFACE;
  if (s.phase === 'casting') { const t = Math.min(1, s.phaseTime / 0.8); floatX = tipX + (targetX - tipX) * t; floatY = tipY + (h * SURFACE - tipY) * t - Math.sin(t * Math.PI) * h * 0.12; }
  const bob = props.reducedMotion ? 0 : Math.sin(time * 3) * 2;
  if (s.phase === 'waiting') floatY += bob;
  if (s.phase === 'bite') floatY += 7 + (props.reducedMotion ? 0 : Math.sin(time * 18) * 3);
  if (s.phase === 'fighting') { floatX += Math.sin(s.fight.time * 2.3) * w * 0.03; floatY += 10; }
  ctx.strokeStyle = s.phase === 'fighting' && s.fight.tension > 0.85 ? '#FFF3D9' : '#E7EDE3'; ctx.lineWidth = s.phase === 'fighting' ? 1.8 : 1.2;
  ctx.beginPath(); ctx.moveTo(tipX, tipY);
  ctx.quadraticCurveTo((tipX + floatX) / 2, Math.max(tipY, floatY) - (s.phase === 'fighting' ? h * 0.02 * (1 - s.fight.tension) : h * 0.08), floatX, floatY); ctx.stroke();
  if (s.phase === 'fighting') {
    // 水下挣扎的鱼影
    ctx.save(); ctx.fillStyle = '#05201F'; ctx.globalAlpha = 0.45;
    const fx = floatX + Math.sin(s.fight.time * 1.7) * w * 0.05, fy = h * (SURFACE + 0.18) + Math.cos(s.fight.time * 2.1) * h * 0.04;
    ctx.beginPath(); ctx.ellipse(fx, fy, w * 0.045, h * 0.028, Math.sin(s.fight.time * 3) * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(floatX, floatY); ctx.lineTo(fx, fy); ctx.stroke();
  }
  ctx.fillStyle = '#E9A598'; ctx.beginPath(); ctx.arc(floatX, floatY - 4, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFF3D9'; ctx.beginPath(); ctx.arc(floatX, floatY + 1, 5, 0, Math.PI); ctx.fill();
  if (s.phase === 'bite') {
    ctx.strokeStyle = '#FFF3D9'; ctx.lineWidth = 2;
    for (let i = 0; i < 2; i += 1) { const r = 10 + ((time * 30 + i * 12) % 24); ctx.globalAlpha = 1 - r / 34; ctx.beginPath(); ctx.ellipse(floatX, floatY + 4, r, r * 0.3, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.fillStyle = '#FFF3D9'; ctx.font = `700 ${Math.max(22, w * 0.04)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('!', floatX, floatY - 22);
  }
}
function tick(now: number) {
  frame = requestAnimationFrame(tick);
  const element = canvas.value, ctx = element?.getContext('2d');
  if (!element || !ctx) return;
  const { width: w, height: h } = element.getBoundingClientRect();
  if (w <= 0 || h <= 0) return;
  const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000); last = now; time += dt;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (element.width !== Math.round(w * dpr) || element.height !== Math.round(h * dpr)) { element.width = Math.round(w * dpr); element.height = Math.round(h * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawScene(ctx, w, h);
  if (props.state.phase === 'setup') for (const spot of ['near', 'middle', 'far'] as const) drawClue(ctx, props.state.clues[spot], w * spotX[spot], w, h);
  if (props.passing) {
    // 原创鱼路过：从左游到右，只是问候，不能被钓起。
    const design = props.passing.design, profile = getSwimProfile(design);
    passSwim = stepSwim(passSwim, profile, 100, dt);
    passX += dt * 0.06;
    if (passX > 1.1) passX = WATER_START;
    const scale = Math.min(w * 0.09, h * 0.16) / Math.max(0.5, getFishGeometry(design).bounds.maxY - getFishGeometry(design).bounds.minY) * 0.6;
    renderFish(ctx, design, { x: w * passX, y: h * 0.66, scale, facing: 1 },
      { paint: props.passing.color, glow: props.passing.glow ? { source: props.passing.glow, version: props.passing.revision } : null, tailAngle: tailAngle(passSwim, profile), finAngle: finAngle(passSwim) });
    ctx.fillStyle = '#FFF3D9'; ctx.font = `600 ${Math.max(12, w * 0.018)}px system-ui`; ctx.textAlign = 'center';
    ctx.fillText(`「${props.passing.name}」路过`, w * passX, h * 0.66 - scale * 0.5);
  }
  drawLine(ctx, w, h);
}
function onClick(event: MouseEvent) {
  const rect = canvas.value!.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width, y = (event.clientY - rect.top) / rect.height;
  if (props.passing && Math.abs(x - passX) < 0.08 && Math.abs(y - 0.66) < 0.12) { emit('greet'); return; }
  if (props.state.phase !== 'setup' || y < SURFACE - 0.05) return;
  const nearest = (Object.entries(spotX) as Array<[CastSpot, number]>).reduce((best, entry) => Math.abs(entry[1] - x) < Math.abs(best[1] - x) ? entry : best);
  if (Math.abs(nearest[1] - x) < 0.1) emit('spot', nearest[0]);
}
function onVisibility() {
  if (document.hidden) { if (frame) cancelAnimationFrame(frame); frame = 0; }
  else if (!frame) { last = null; frame = requestAnimationFrame(tick); }
}
onMounted(() => { document.addEventListener('visibilitychange', onVisibility); if (!document.hidden) frame = requestAnimationFrame(tick); });
onBeforeUnmount(() => { document.removeEventListener('visibilitychange', onVisibility); if (frame) cancelAnimationFrame(frame); });
</script>
<template>
  <div class="fishing-scene">
    <canvas ref="canvas" role="img" aria-label="钓场画面：左边是钓竿，水面上有近处、中段、远处三个落点。操作按钮在画面下方。" @click="onClick" />
  </div>
</template>
