<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { getFishGeometry } from '../domain/geometry.ts';
import { finAngle, fixedSteps, getSwimProfile, SIM_STEP, swimFacing, tailAngle } from '../domain/swim.ts';
import type { OriginalFish } from '../domain/types.ts';
import { createOceanFish, oceanPosition, stepOceanFish, type OceanFish, type Tank } from '../features/ocean/sim.ts';
import { renderFish, type BodySprite } from '../rendering/FishRenderer.ts';
import { followBubble } from '../features/ocean/bubblePlay.ts';
import { drawShallowOcean } from '../rendering/oceanEnvironment.ts';
import { claimVoice, registerVoiceStop, releaseVoice } from '../features/voice.ts';
import { PerformanceRecorder, type PerformanceMeasurement } from '../features/fishing3d/performance.ts';
import { downloadJson } from '../storage/backup.ts';

export interface FishTextures { color: CanvasImageSource | null; glow: CanvasImageSource | null }
/** 海洋里游动的对象：原创鱼或物种访客（示意外形）。 */
export type OceanActor = Pick<OriginalFish, 'id' | 'design' | 'revision' | 'activeEffect'>;
const props = defineProps<{
  fish: OceanActor[]; textures: Map<string, FishTextures>; selectedId: string | null; highlightId: string | null; reducedMotion: boolean; arrivalName?: string | null; paused?: boolean;
  playableIds?: string[]; selectedName?: string;
}>();
const emit = defineEmits<{ select: [string | null]; cameraDone: []; dismissArrival: []; theme: [habitat: string] }>();
const canvas = ref<HTMLCanvasElement>();
const cameraActive = ref(false);
const deviceLabel = ref(''), measurement = ref<PerformanceMeasurement | null>(null), recording = ref(false);
let recorder: PerformanceRecorder | null = null, measuredViewport = '', measurementSeconds = 0;
let measuredFish = 0;
const playing = ref(false), playId = ref<string | null>(null);
const guiding = ref(false), theme = ref<'reef' | 'rock'>('reef');
watch(theme, value => emit('theme', value === 'reef' ? 'reef-edge' : 'coastal-rock'));
let guidePointer: number | null = null, suppressClick = false;
const bubble = ref<{ u: number; v: number; phase: 'ready' | 'calling' | 'reached'; reachedAt?: number } | null>(null);
const bubbleButton = ref<HTMLButtonElement>();
const player = ref<HTMLAudioElement>(), speaking = ref(false), soundError = ref(false);
const helpAudioUrl = `${import.meta.env.BASE_URL}audio/vo-ocean-bubble-help.wav`;
const bubbleStyle = computed(() => bubble.value ? { left: `${bubble.value.u * 100}%`, top: `${bubble.value.v * 100}%` } : {});
const playHint = computed(() => !playing.value ? props.selectedName ? `这是${props.selectedName}，可以近看或一起玩。` : '点自己的鱼，可以近看或一起玩。'
  : guiding.value ? '手指在水里慢慢划，它会跟过来。'
  : bubble.value?.phase === 'reached' ? `${props.selectedName || '小伙伴'}来啦！` : bubble.value?.phase === 'calling' ? '它游过来啦…' : '点泡泡，或点水里的别处。');
const HALF_WIDTH = 4;
// Visitors sit behind original creations; the selected fish is drawn and hit-tested last.
const orderedFish = computed(() => [...props.fish].sort((a, b) => {
  const layer = (id: string) => id === props.selectedId ? 2 : props.playableIds?.includes(id) ? 1 : 0;
  return layer(a.id) - layer(b.id);
}));
let sims = new Map<string, OceanFish>();
// 每条鱼身体内部的缓存位图；作品修订或纹理变化时按 key 重建，离开页面释放。
const bodyCache = new Map<string, BodySprite>();
let frame = 0, last: number | null = null, accumulator = 0, time = 0;
let camera: { start: number; id: string } | null = null;
const CAMERA_SECONDS = 4.2;
let environment: HTMLImageElement | null = null;
let backdrop: HTMLCanvasElement | null = null, backdropKey = '';
let alive = true, soundTicket = 0, bubbleIndex = 0;
const unregisterVoice = registerVoiceStop(stopSound);

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
function cameraView(width: number, height: number) {
  if (!camera) return { zoom: 1, x: 0, y: 0 };
  const sim = sims.get(camera.id);
  const t = time - camera.start;
  if (!sim || t >= CAMERA_SECONDS) { camera = null; cameraActive.value = false; emit('cameraDone'); return { zoom: 1, x: 0, y: 0 }; }
  const amount = ease(t / 0.7) * (1 - ease((t - (CAMERA_SECONDS - 0.8)) / 0.8));
  const pos = oceanPosition(sim);
  const fish = props.fish.find(f => f.id === camera?.id);
  const bounds = fish ? getFishGeometry(fish.design).bounds : null;
  const ppu = width / (HALF_WIDTH * 2);
  const targetZoom = bounds ? Math.min(4.5, width * .58 / ((bounds.maxX - bounds.minX) * ppu), height * .5 / ((bounds.maxY - bounds.minY) * ppu)) : 1.9;
  return { zoom: 1 + (Math.max(1, targetZoom) - 1) * amount, x: pos.x * amount, y: pos.y * amount };
}
function placementOf(sim: OceanFish, width: number, height: number, view: { zoom: number; x: number; y: number }) {
  const ppu = width / (HALF_WIDTH * 2) * view.zoom;
  const pos = oceanPosition(sim);
  return { x: width / 2 + (pos.x - view.x) * ppu, y: height / 2 + (pos.y - view.y) * ppu, scale: ppu, facing: swimFacing(sim.swim) };
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), key = `${width}|${height}|${dpr}`;
  if (!backdrop || key !== backdropKey) {
    backdrop ??= document.createElement('canvas'); backdrop.width = Math.round(width * dpr); backdrop.height = Math.round(height * dpr);
    const bctx = backdrop.getContext('2d')!; bctx.setTransform(dpr, 0, 0, dpr, 0, 0); drawShallowOcean(bctx, environment, width, height); backdropKey = key;
  }
  ctx.drawImage(backdrop, 0, 0, width, height);
  if (!props.reducedMotion) {
    ctx.fillStyle = '#F5FFFF'; ctx.globalAlpha = .24;
    for (let i = 0; i < 8; i++) {
      const x = ((i * .173 + Math.sin(time * .17 + i) * .015) % 1) * width, y = height * (1 - ((i * .137 + time * .018) % 1));
      ctx.beginPath(); ctx.arc(x, y, 1.2 + i % 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function tick(now: number) {
  frame = requestAnimationFrame(tick);
  const element = canvas.value, ctx = element?.getContext('2d');
  if (!element || !ctx) return;
  const { width, height } = element.getBoundingClientRect();
  if (width <= 0 || height <= 0) return;
  const viewport = `${width}|${height}|${window.devicePixelRatio}`;
  if (recorder && measuredViewport && measuredViewport !== viewport) recorder.interrupt();
  measuredViewport = viewport;
  if (recorder && last !== null && !props.reducedMotion) {
    recorder.add(now - last, 0, 0);
    measurementSeconds += (now - last) / 1000;
    if (Math.floor(measurementSeconds) !== Math.floor(measurement.value?.seconds ?? -1)) { measurement.value = recorder.read(); recording.value = !measurement.value.complete; }
  }
  const tank = tankFor(width, height);
  if (sims.size !== props.fish.length || props.fish.some((fish) => !sims.has(fish.id))) sync(tank);
  const steps = fixedSteps(accumulator, last === null ? 0 : (now - last) / 1000);
  last = now; accumulator = steps.accumulator;
  for (let index = 0; index < steps.steps; index += 1) {
    time += SIM_STEP;
    for (const [id, sim] of sims) {
      if (playing.value && id === playId.value && bubble.value?.phase === 'calling') {
        const actor = props.fish.find(f => f.id === id);
        if (actor) {
          const target = { x: (bubble.value.u - .5) * HALF_WIDTH * 2, y: (bubble.value.v - .5) * tank.halfHeight * 2 };
          const guided = followBubble(sim, target, getFishGeometry(actor.design).mouth.anchor, tank);
          sims.set(id, guided.fish);
          if (guided.arrived) bubble.value = { ...bubble.value, phase: 'reached', reachedAt: time };
        }
      } else sims.set(id, stepOceanFish(sim, tank));
    }
    if (bubble.value?.phase === 'reached' && time - (bubble.value.reachedAt ?? time) > 1.2 && !guiding.value) newBubble();
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (element.width !== Math.round(width * dpr) || element.height !== Math.round(height * dpr)) { element.width = Math.round(width * dpr); element.height = Math.round(height * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBackground(ctx, width, height);
  const view = cameraView(width, height);
  for (const fish of orderedFish.value) {
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
      ctx.fillStyle = '#ecffef'; ctx.globalAlpha = .15; ctx.fill();
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
  if (guiding.value || suppressClick) { suppressClick = false; return; }
  const element = canvas.value!;
  const rect = element.getBoundingClientRect();
  const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  if (playing.value) {
    bubble.value = { u: Math.max(.15, Math.min(.85, point.x / rect.width)), v: Math.max(.22, Math.min(.68, point.y / rect.height)), phase: 'calling' };
    return;
  }
  const view = cameraView(rect.width, rect.height);
  for (const fish of [...orderedFish.value].reverse()) {
    const sim = sims.get(fish.id);
    if (!sim) continue;
    const p = placementOf(sim, rect.width, rect.height, view);
    const b = getFishGeometry(fish.design).bounds;
    const lx = (point.x - p.x) / (p.scale * p.facing), ly = (point.y - p.y) / p.scale;
    const extraX = Math.max(0, (44 / p.scale - (b.maxX - b.minX)) / 2);
    const extraY = Math.max(0, (44 / p.scale - (b.maxY - b.minY)) / 2);
    if (lx >= b.minX - extraX && lx <= b.maxX + extraX && ly >= b.minY - extraY && ly <= b.maxY + extraY) { emit('select', fish.id); return; }
  }
  emit('select', null);
}
function skipCamera() { if (camera) { camera = null; cameraActive.value = false; emit('cameraDone'); } }
function startCamera(id: string, arriving = false) {
  stopPlay();
  const element = canvas.value;
  if (element) {
    const { width, height } = element.getBoundingClientRect();
    if (width > 0) sync(tankFor(width, height));
  }
  // Only a newly saved, visible fish enters from the left. Finding an existing fish retains its position.
  const sim = sims.get(id);
  if (sim && arriving && !props.reducedMotion) {
    const fish = props.fish.find(f => f.id === id);
    const reach = fish ? Math.max(Math.abs(getFishGeometry(fish.design).bounds.minX), getFishGeometry(fish.design).bounds.maxX) : .8;
    sims.set(id, { ...sim, y: 0, targetY: 0, mode: 'cruise', timer: 6,
      swim: { ...sim.swim, x: (-HALF_WIDTH + reach + .2) / sim.bodyLength, heading: 1, turn: null } });
  }
  if (props.reducedMotion) { skipCamera(); emit('cameraDone'); return; }
  camera = { start: time, id }; cameraActive.value = true;
}
function newBubble() {
  bubbleIndex++;
  const sim = playId.value ? sims.get(playId.value) : null;
  const position = sim ? oceanPosition(sim).x : 0;
  bubble.value = { u: position > 0 ? .3 : .7, v: bubbleIndex % 2 ? .4 : .55, phase: 'ready' };
}
function stopSound() { soundTicket++; player.value?.pause(); if (player.value) player.value.currentTime = 0; speaking.value = false; releaseVoice(player.value); }
function hearHelp() {
  if (speaking.value) { stopSound(); return; }
  const audio = player.value; if (!audio) return;
  claimVoice(audio);
  stopSound(); const token = ++soundTicket; soundError.value = false; speaking.value = true;
  void audio.play().catch(() => { if (alive && token === soundTicket) { speaking.value = false; soundError.value = true; } });
}
function stopPlay() { playing.value = false; guiding.value = false; guidePointer = null; playId.value = null; bubble.value = null; stopSound(); }
function togglePlay() {
  if (playing.value && !guiding.value) { stopPlay(); return; }
  if (guiding.value) stopPlay();
  const ids = props.playableIds ?? [];
  const id = props.selectedId && ids.includes(props.selectedId) ? props.selectedId : ids[0];
  if (!id) return;
  skipCamera(); playing.value = true; playId.value = id; emit('select', id); newBubble();
  void nextTick(() => bubbleButton.value?.focus({ preventScroll: true }));
}
defineExpose({ startCamera, skipCamera });
function toggleGuide() {
  if (guiding.value) { stopPlay(); return; }
  if (playing.value) stopPlay();
  togglePlay(); if (playing.value) guiding.value = true;
}
function guideTo(event: PointerEvent) {
  if (!guiding.value || guidePointer !== event.pointerId) return;
  const rect = canvas.value!.getBoundingClientRect();
  bubble.value = { u: Math.max(.15, Math.min(.85, (event.clientX - rect.left) / rect.width)), v: Math.max(.22, Math.min(.68, (event.clientY - rect.top) / rect.height)), phase: 'calling' };
}
function guideDown(event: PointerEvent) {
  if (!guiding.value || props.paused || (event.pointerType === 'mouse' && event.button !== 0)) return;
  guidePointer = event.pointerId; suppressClick = true; canvas.value?.setPointerCapture(event.pointerId); guideTo(event);
}
function guideUp(event: PointerEvent) { if (guidePointer === event.pointerId) guidePointer = null; }
function loadEnvironment() {
  const image = new Image(); environment = image; backdropKey = '';
  image.onload = () => { if (alive && environment === image) backdropKey = ''; };
  image.onerror = () => { if (alive && environment === image) { environment = null; backdropKey = ''; } };
  image.src = `${import.meta.env.BASE_URL}content/v1/environments/${theme.value === 'reef' ? 'reef' : 'rock'}-panorama.webp`;
}
watch(theme, () => { recorder?.interrupt(); loadEnvironment(); });
watch(() => props.fish, () => { const element = canvas.value; if (element) { const { width, height } = element.getBoundingClientRect(); if (width > 0) sync(tankFor(width, height)); } });
function onVisibility() {
  recorder?.interrupt();
  if (document.hidden || props.paused) { stopSound(); guidePointer = null; }
  if (document.hidden || props.paused) { if (frame) cancelAnimationFrame(frame); frame = 0; }
  else if (!frame) { last = null; accumulator = 0; frame = requestAnimationFrame(tick); }
}
watch(() => props.paused, onVisibility);
watch(() => [props.selectedId, props.playableIds], () => { if (playing.value && (props.selectedId !== playId.value || !(props.playableIds ?? []).includes(playId.value ?? ''))) stopPlay(); });
watch(() => props.reducedMotion, value => { recorder?.interrupt(); if (value) skipCamera(); });
watch(() => props.fish, () => recorder?.interrupt());
onMounted(() => {
  loadEnvironment();
  document.addEventListener('visibilitychange', onVisibility); if (!document.hidden && !props.paused) frame = requestAnimationFrame(tick);
});
onBeforeUnmount(() => { alive = false; stopSound(); unregisterVoice(); document.removeEventListener('visibilitychange', onVisibility); if (frame) cancelAnimationFrame(frame); bodyCache.clear(); backdrop = null; if (environment) { environment.onload = null; environment.onerror = null; environment.src = ''; } environment = null; });
function startMeasurement() { if (props.reducedMotion || props.paused) return; recorder = new PerformanceRecorder(); measurement.value = recorder.read(); recording.value = true; measuredViewport = ''; measurementSeconds = 0; measuredFish = props.fish.length; last = null; }
function exportMeasurement() {
  if (!measurement.value) return;
  const { fps, p95, seconds, frames, complete, interruptions } = measurement.value;
  downloadJson({ format: 'fish-ocean-canvas-performance-v1', date: new Date().toISOString(), device: deviceLabel.value, userAgent: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, physicalDeviceVerified: false, renderer: 'canvas-2d', fish: measuredFish, finalFish: props.fish.length, theme: theme.value, reducedMotion: props.reducedMotion, fps, p95, seconds, frames, complete, interruptions, passesFrameTiming: complete && interruptions === 0 && fps >= 30 && p95 <= 50 }, '我的海洋-平面帧预算.json');
}
</script>
<template>
  <section class="ocean-experience" aria-label="浅海与自己的鱼">
  <div class="ocean-tank" :class="{ 'is-playing': playing }">
    <canvas ref="canvas" :class="{ 'finger-guiding': guiding }" role="img" :aria-label="`我的海洋：${fish.length} 条鱼在游。可以在下方作品卡选择自己的鱼。`" @click="onClick" @pointerdown="guideDown" @pointermove="guideTo" @pointerup="guideUp" @pointercancel="guideUp" @lostpointercapture="guideUp" />
    <button v-if="cameraActive" class="button button--muted ocean-skip" @click="skipCamera">跳过镜头</button>
    <span class="scene-label">{{ theme === 'reef' ? '珊瑚浅海' : '岩礁花园' }}</span><span v-if="selectedName" class="selected-fish-name">🐟 {{ selectedName }}</span>
    <button v-if="playing && bubble && !guiding" ref="bubbleButton" class="ocean-play-bubble" :class="{ 'is-reaching': bubble.phase === 'calling', 'is-reached': bubble.phase === 'reached', 'is-still': reducedMotion }" :style="bubbleStyle" :aria-disabled="bubble.phase === 'reached'" :aria-label="bubble.phase === 'reached' ? '鱼碰到泡泡啦' : '点泡泡，让自己的鱼游过来'" @click="bubble.phase !== 'reached' && (bubble = { ...bubble, phase: 'calling' })"><span aria-hidden="true">{{ bubble.phase === 'reached' ? '✦' : '○' }}</span></button>
    <div v-if="arrivalName" class="ocean-welcome" :class="{ 'is-still': reducedMotion }" role="status"><div class="welcome-colors" aria-hidden="true"><span>✦</span><span>●</span><span>✦</span><span>●</span><span>✦</span></div><div><p>你的海洋小伙伴！</p><strong>你好，{{ arrivalName }}！</strong></div><button aria-label="收起欢迎提示" @click="emit('dismissArrival')">✕</button></div>
  </div>
  <div class="ocean-playbar"><div class="ocean-play-hint" role="status"><strong>{{ guiding ? '☝ 跟着手指游' : playing ? '🫧 一起玩泡泡' : theme === 'reef' ? '珊瑚浅海' : '岩礁花园' }}</strong><span>{{ soundError ? '声音没播出来，可以再点一下。' : playHint }}</span></div><div class="ocean-play-actions"><slot name="actions" /><button class="button" :disabled="!playableIds?.length" :aria-pressed="guiding" @click="toggleGuide">{{ guiding ? '✓ 看它们游' : '☝ 跟手指' }}</button><label class="ocean-theme-picker">换个家园<select v-model="theme" aria-label="海洋主题"><option value="reef">🪸 珊瑚浅海</option><option value="rock">🪨 岩礁花园</option></select></label><button class="button" :disabled="!playableIds?.length" :aria-pressed="playing && !guiding" @click="togglePlay">{{ playing && !guiding ? '✓ 看它们游' : '🫧 玩泡泡' }}</button><button v-if="playableIds?.length" class="ocean-play-listen" :aria-label="speaking ? '停止声音' : '听听怎么玩泡泡'" @click="hearHelp">{{ speaking ? '■' : '🔊' }}</button></div></div>
  <audio ref="player" :src="helpAudioUrl" preload="none" @ended="speaking = false; releaseVoice(player)"></audio>
  <details class="ocean-parent-tools"><summary>👨‍👦 家长工具</summary><details class="ocean-measurement"><summary>海洋真机试玩记录</summary><label>设备<input v-model="deviceLabel" maxlength="100" placeholder="例如 iPad 9 · Safari"></label><button class="button button--muted" :disabled="recording || reducedMotion || !!paused" @click="startMeasurement">开始 60 秒记录</button><button class="button button--muted" :disabled="!measurement" @click="exportMeasurement">导出记录</button><p v-if="measurement" role="status">{{ Math.min(60, measurement.seconds).toFixed(1) }} / 60 秒 · {{ fish.length }} 条鱼 · 中断 {{ measurement.interruptions }} 次</p><p>保持普通动态，实际点鱼和陪玩。转屏、后台或暂停会标记中断；此记录只测平面画面的帧时长，不测三维绘制次数。</p></details></details>
  </section>
</template>
<style scoped>.ocean-measurement{margin-top:12px}.ocean-measurement summary{min-height:44px;padding:12px 0;cursor:pointer;font-size:13px}.ocean-measurement label{display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:12px}.ocean-measurement input{min-height:44px;padding:8px;border:1px solid #c8dbcb;border-radius:10px;max-width:75%}.ocean-measurement button{margin-right:8px}.ocean-measurement p{font-size:12px;line-height:1.8}</style>

<style scoped>
.finger-guiding{touch-action:none}.selected-fish-name{position:absolute;top:12px;right:12px;background:#fff8dee6;color:#315f50;padding:8px 12px;border-radius:14px;font-size:12px;pointer-events:none}.ocean-theme-picker{display:flex;flex-direction:column;font-size:10px;color:#6d8270;gap:3px}.ocean-theme-picker select{min-height:44px;border:1px solid #bbd3bd;border-radius:12px;padding:6px;background:#f5f9ed;color:#315f50;font-size:12px}

.ocean-experience{scroll-margin-top:88px}
.ocean-experience{min-width:0;border:1px solid #bfd5cc;border-radius:22px;overflow:hidden;background:#fffdf7}.ocean-experience .ocean-tank{border-radius:0;height:clamp(360px,48vw,570px)}.ocean-playbar{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 18px;background:#f9faee;border-top:1px solid #dce7d7;flex-wrap:wrap}.ocean-play-hint{display:flex;flex-direction:column;gap:4px;min-width:170px}.ocean-play-hint strong{font-size:15px;color:#315e50}.ocean-play-hint>span{font-size:12px;color:#75876e}.ocean-play-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ocean-play-listen{min-width:48px;min-height:48px;border:1px solid #c1d4bc;border-radius:14px;background:#e8f1e1;color:#335f4d;font-size:19px}.ocean-play-actions .button{min-height:48px}.ocean-play-bubble{position:absolute;transform:translate(-50%,-50%);width:66px;height:66px;border:2px solid #eaffff;border-radius:50%;background:radial-gradient(circle at 30% 26%,#ffffffc9 0 5%,#d2ffff2b 18%,#79cbd23d 62%,#ecffffb8 100%);box-shadow:0 0 0 5px #63a6b234,0 3px 12px #24667755,inset 0 0 12px #ecffff96;color:#fff;font-size:36px;line-height:1;cursor:pointer;animation:bubble-breathe 2s ease-in-out infinite}.ocean-play-bubble.is-reaching{border-color:#fff2b8;box-shadow:0 0 0 5px #fff0bc3b,0 3px 12px #24667755}.ocean-play-bubble.is-reached{animation:bubble-pop .65s ease-out both;background:#fff5ccba;border-color:#fff6cf;color:#d7a959;pointer-events:none}.ocean-play-bubble.is-still{animation:none}.is-playing canvas{cursor:crosshair}@keyframes bubble-breathe{50%{box-shadow:0 0 0 9px #b0f2f522,0 3px 12px #24667755,inset 0 0 12px #ecffff96}}@keyframes bubble-pop{to{opacity:.15;box-shadow:0 0 0 25px #fff8d900;transform:translate(-50%,-50%) scale(1.2)}}
@media(max-width:560px){.ocean-experience .ocean-tank{height:360px}.ocean-playbar{padding:12px;gap:12px}.ocean-play-actions{width:100%;gap:6px}.ocean-play-actions .button{font-size:12px;padding:9px 12px}.ocean-play-hint>span{font-size:11px}.ocean-play-bubble{width:60px;height:60px}}
.ocean-welcome{position:absolute;left:20px;right:20px;bottom:18px;display:flex;justify-content:center;align-items:center;gap:16px;padding:14px 40px 14px 20px;border:1px solid #f9dfaf;border-radius:20px;background:linear-gradient(115deg,#fff6ddf5,#f3efdbf5,#d9f0e9f5);box-shadow:0 6px 22px #143c432e;color:#29544b;animation:welcome-in .4s ease-out}.ocean-welcome p{font-size:12px;color:#799071}.ocean-welcome strong{display:block;font-size:23px;line-height:1.3;margin-top:3px;overflow-wrap:anywhere}.ocean-welcome>button{position:absolute;right:8px;top:8px;width:44px;height:44px;border:0;border-radius:12px;background:transparent;color:#728878}.welcome-colors{display:flex;gap:6px;font-size:22px;transform:rotate(-8deg)}.welcome-colors span:nth-child(1){color:#e89987}.welcome-colors span:nth-child(2){color:#87b69a}.welcome-colors span:nth-child(3){color:#dfb854;font-size:33px}.welcome-colors span:nth-child(4){color:#a79bb8}.welcome-colors span:nth-child(5){color:#7fbbbf}.is-still{animation:none}@keyframes welcome-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:560px){.ocean-welcome{left:10px;right:10px;bottom:10px;padding:12px 42px 12px 14px;gap:10px}.ocean-welcome strong{font-size:19px}.welcome-colors{gap:3px;font-size:15px}.welcome-colors span:nth-child(3){font-size:25px}}
</style>

<style scoped>.ocean-parent-tools>summary{min-height:48px;padding:12px 16px;cursor:pointer;color:#5c7766;font-size:13px}.ocean-parent-tools>.ocean-measurement{padding:0 16px 14px}</style>
