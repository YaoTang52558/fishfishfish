<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { getFishGeometry } from '../domain/geometry.ts';
import { finAngle, fixedSteps, getSwimProfile, SIM_STEP, swimFacing, tailAngle } from '../domain/swim.ts';
import type { OriginalFish } from '../domain/types.ts';
import { createOceanFish, oceanPosition, stepOceanFish, type OceanFish, type Tank } from '../features/ocean/sim.ts';
import { renderFish, type BodySprite } from '../rendering/FishRenderer.ts';

export interface FishTextures { color: CanvasImageSource | null; glow: CanvasImageSource | null }
/** 海洋里游动的对象：原创鱼或物种访客（示意外形）。 */
export type OceanActor = Pick<OriginalFish, 'id' | 'design' | 'revision' | 'activeEffect'>;
const props = defineProps<{
  fish: OceanActor[]; textures: Map<string, FishTextures>; selectedId: string | null; highlightId: string | null; reducedMotion: boolean;
}>();
const emit = defineEmits<{ select: [string | null]; cameraDone: [] }>();
const canvas = ref<HTMLCanvasElement>();
const cameraActive = ref(false);
const HALF_WIDTH = 5;
let sims = new Map<string, OceanFish>();
// 每条鱼身体内部的缓存位图；作品修订或纹理变化时按 key 重建，离开页面释放。
const bodyCache = new Map<string, BodySprite>();
let frame = 0, last: number | null = null, accumulator = 0, time = 0;
let camera: { start: number; id: string } | null = null;
const CAMERA_SECONDS = 4.2;

function tankFor(width: number, height: number): Tank { return { halfWidth: HALF_WIDTH, halfHeight: HALF_WIDTH * height / width }; }
function sync(tank: Tank) {
  const next = new Map<string, OceanFish>();
  props.fish.forEach((fish, index) => {
    const existing = sims.get(fish.id);
    const profile = getSwimProfile(fish.design);
    if (existing && existing.bodyLength === fish.design.shape.length) next.set(fish.id, { ...existing, profile });
    else next.set(fish.id, createOceanFish(fish.id, profile, fish.design.shape.length, tank, index * 7919 + fish.id.length * 31 + 1));
  });
  sims = next;
}
const ease = (t: number) => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
/** 入海镜头：放大并跟随新鱼，结束后回到全景。返回缩放与焦点（世界坐标）。 */
function cameraView() {
  if (!camera) return { zoom: 1, x: 0, y: 0 };
  const sim = sims.get(camera.id);
  const t = time - camera.start;
  if (!sim || t >= CAMERA_SECONDS) { camera = null; cameraActive.value = false; emit('cameraDone'); return { zoom: 1, x: 0, y: 0 }; }
  const amount = ease(t / 0.7) * (1 - ease((t - (CAMERA_SECONDS - 0.8)) / 0.8));
  const pos = oceanPosition(sim);
  return { zoom: 1 + 0.9 * amount, x: pos.x * amount, y: pos.y * amount };
}
function placementOf(sim: OceanFish, width: number, height: number, view: { zoom: number; x: number; y: number }) {
  const ppu = width / (HALF_WIDTH * 2) * view.zoom;
  const pos = oceanPosition(sim);
  return { x: width / 2 + (pos.x - view.x) * ppu, y: height / 2 + (pos.y - view.y) * ppu, scale: ppu, facing: swimFacing(sim.swim) };
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const water = ctx.createLinearGradient(0, 0, 0, height);
  water.addColorStop(0, '#2C7A72'); water.addColorStop(0.6, '#175653'); water.addColorStop(1, '#0D3437');
  ctx.fillStyle = water; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#FFFFFF';
  for (const [x0, w, a] of [[0.08, 0.2, 0.04], [0.55, 0.12, 0.03]] as const) {
    ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(width * x0, 0); ctx.lineTo(width * (x0 + w), 0); ctx.lineTo(width * (x0 + w + 0.25), height); ctx.lineTo(width * (x0 + 0.2), height); ctx.fill();
  }
  ctx.globalAlpha = 0.5; ctx.fillStyle = '#092F32';
  ctx.beginPath(); ctx.moveTo(0, height * 0.88);
  for (let x = 0; x <= width; x += width / 24) ctx.lineTo(x, height * (0.88 + Math.sin(x / width * 9) * 0.02));
  ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.fill();
  ctx.globalAlpha = 0.45; ctx.strokeStyle = '#72ADA0'; ctx.lineWidth = Math.max(3, width * 0.006); ctx.lineCap = 'round';
  for (const x of [0.07, 0.11, 0.86, 0.91]) {
    const sway = props.reducedMotion ? 0 : Math.sin(time * 0.8 + x * 20) * width * 0.008;
    ctx.beginPath(); ctx.moveTo(width * x, height); ctx.quadraticCurveTo(width * x + sway * 2, height * 0.8, width * x + sway, height * 0.68); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function tick(now: number) {
  frame = requestAnimationFrame(tick);
  const element = canvas.value, ctx = element?.getContext('2d');
  if (!element || !ctx) return;
  const { width, height } = element.getBoundingClientRect();
  if (width <= 0 || height <= 0) return;
  const tank = tankFor(width, height);
  if (sims.size !== props.fish.length || props.fish.some((fish) => !sims.has(fish.id))) sync(tank);
  const steps = fixedSteps(accumulator, last === null ? 0 : (now - last) / 1000);
  last = now; accumulator = steps.accumulator;
  for (let index = 0; index < steps.steps; index += 1) {
    time += SIM_STEP;
    for (const [id, sim] of sims) sims.set(id, stepOceanFish(sim, tank));
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (element.width !== Math.round(width * dpr) || element.height !== Math.round(height * dpr)) { element.width = Math.round(width * dpr); element.height = Math.round(height * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBackground(ctx, width, height);
  const view = cameraView();
  for (const fish of props.fish) {
    const sim = sims.get(fish.id);
    if (!sim) continue;
    const placement = placementOf(sim, width, height, view);
    const textures = props.textures.get(fish.id);
    if (fish.id === props.selectedId || fish.id === props.highlightId) {
      const b = getFishGeometry(fish.design).bounds;
      const pulse = fish.id === props.highlightId && !props.reducedMotion ? 1 + Math.sin(time * 4) * 0.06 : 1;
      ctx.save(); ctx.beginPath();
      ctx.ellipse(placement.x + (b.minX + b.maxX) / 2 * placement.scale * placement.facing, placement.y + (b.minY + b.maxY) / 2 * placement.scale,
        (b.maxX - b.minX) / 2 * placement.scale * 1.15 * pulse, (b.maxY - b.minY) / 2 * placement.scale * 1.25 * pulse, 0, 0, Math.PI * 2);
      ctx.strokeStyle = fish.id === props.selectedId ? '#FFF3D9' : '#EAC779'; ctx.lineWidth = 2.5; ctx.setLineDash([7, 5]); ctx.globalAlpha = 0.9; ctx.stroke();
      ctx.restore();
    }
    renderFish(ctx, fish.design, placement, {
      paint: textures?.color, glow: textures?.glow ? { source: textures.glow, version: fish.revision } : null,
      tailAngle: tailAngle(sim.swim, sim.profile), finAngle: finAngle(sim.swim), wave: time * 5,
      effect: props.reducedMotion ? null : fish.activeEffect, time,
      cache: bodyCache, cacheKey: `${fish.id}|${fish.revision}|${textures ? 'tex' : 'none'}`,
    });
  }
}

/** 点击选鱼：从最上层开始，找包含点击位置的鱼。 */
function onClick(event: MouseEvent) {
  const element = canvas.value!;
  const rect = element.getBoundingClientRect();
  const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  const view = cameraView();
  for (const fish of [...props.fish].reverse()) {
    const sim = sims.get(fish.id);
    if (!sim) continue;
    const p = placementOf(sim, rect.width, rect.height, view);
    const b = getFishGeometry(fish.design).bounds;
    const lx = (point.x - p.x) / (p.scale * p.facing), ly = (point.y - p.y) / p.scale;
    if (lx >= b.minX && lx <= b.maxX && ly >= b.minY && ly <= b.maxY) { emit('select', fish.id); return; }
  }
  emit('select', null);
}
function skipCamera() { if (camera) { camera = null; cameraActive.value = false; emit('cameraDone'); } }
function startCamera(id: string) {
  if (props.reducedMotion) { emit('cameraDone'); return; }
  camera = { start: time, id }; cameraActive.value = true;
}
defineExpose({ startCamera, skipCamera });
watch(() => props.fish, () => { const element = canvas.value; if (element) { const { width, height } = element.getBoundingClientRect(); if (width > 0) sync(tankFor(width, height)); } });
function onVisibility() {
  if (document.hidden) { if (frame) cancelAnimationFrame(frame); frame = 0; }
  else if (!frame) { last = null; accumulator = 0; frame = requestAnimationFrame(tick); }
}
onMounted(() => { document.addEventListener('visibilitychange', onVisibility); if (!document.hidden) frame = requestAnimationFrame(tick); });
onBeforeUnmount(() => { document.removeEventListener('visibilitychange', onVisibility); if (frame) cancelAnimationFrame(frame); bodyCache.clear(); });
</script>
<template>
  <div class="ocean-tank">
    <canvas ref="canvas" role="img" :aria-label="`我的海洋：${fish.length} 条原创鱼在游。可以在右侧列表选择一条查看。`" @click="onClick" />
    <button v-if="cameraActive" class="button button--muted ocean-skip" @click="skipCamera">跳过镜头</button>
    <span class="scene-label">我的海洋</span>
  </div>
</template>
