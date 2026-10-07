<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { fitFish, getFishGeometry } from '../domain/geometry.ts';
import { getSwimProfile } from '../domain/swim.ts';
import type { Bounds, EffectId, FishDesign } from '../domain/types.ts';
import { usePreferences } from '../features/preferences.ts';
import { renderFish } from '../rendering/FishRenderer.ts';
import { drawStudioWater } from '../rendering/studioWater.ts';
import { openDatabase } from '../storage/db.ts';
import { loadAssets } from '../storage/repository.ts';

const props = defineProps<{ design: FishDesign; name?: string; paint?: CanvasImageSource | null; glow?: CanvasImageSource | null;
  glowVersion?: number; effect?: EffectId | null; disabled?: boolean }>();
const emit = defineEmits<{ opened: []; closed: [] }>();
const dialog = ref<HTMLDialogElement>(), entry = ref<HTMLButtonElement>(), canvas = ref<HTMLCanvasElement>();
const isOpen = ref(false), paused = ref(false), dark = ref(false), facing = ref<1 | -1>(1);
const focus = ref<'whole' | 'body' | 'head'>('whole');
const loading = ref(false), textureError = ref(false), supported = ref(true);
const reducedMotion = usePreferences().reducedMotion;
const title = computed(() => props.name?.trim() || '我的鱼');
let loadedPaint: ImageBitmap | null = null, loadedGlow: ImageBitmap | null = null;
let ticket = 0, alive = true, previousOverflow = '', frame = 0, last: number | null = null, time = 0;
let observer: ResizeObserver | null = null;

function releaseImages() { loadedPaint?.close(); loadedGlow?.close(); loadedPaint = null; loadedGlow = null; }
function boundsOf(points: readonly { x: number; y: number }[]): Bounds {
  return { minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)), minY: Math.min(...points.map(p => p.y)), maxY: Math.max(...points.map(p => p.y)) };
}
function draw(now: number) {
  frame = 0;
  if (!isOpen.value || document.hidden) return;
  if (!paused.value && !reducedMotion.value && last !== null) time += Math.min(0.05, (now - last) / 1000);
  last = now;
  const el = canvas.value, ctx = el?.getContext('2d');
  if (!el || !ctx) { supported.value = false; return; }
  const { width, height } = el.getBoundingClientRect();
  if (width <= 0 || height <= 0) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(width * dpr), h = Math.round(height * dpr);
  if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawStudioWater(ctx, width, height, dark.value);
  const geometry = getFishGeometry(props.design);
  const bounds = focus.value === 'head' ? boundsOf(geometry.head) : focus.value === 'body' ? geometry.bodyBox : geometry.bounds;
  // Close-ups use current geometry, so the child's drawing fills the view without altering its proportions.
  const mirrored = facing.value === 1 ? bounds : { ...bounds, minX: -bounds.maxX, maxX: -bounds.minX };
  const placement = fitFish(mirrored, width, height);
  const profile = getSwimProfile(props.design);
  renderFish(ctx, props.design, { ...placement, facing: facing.value }, {
    paint: props.paint ?? loadedPaint, glow: props.glow || loadedGlow ? { source: (props.glow ?? loadedGlow)!, version: props.glowVersion ?? 1 } : null,
    tailAngle: reducedMotion.value ? 0 : Math.sin(time * profile.tailFrequency * Math.PI * 2) * profile.tailAmplitude,
    finAngle: reducedMotion.value ? 0 : Math.sin(time * 3.2 + 1.2) * .16, wave: time * 5,
    dim: dark.value ? .55 : 0, effect: reducedMotion.value ? null : props.effect, time,
  });
  if (!paused.value && !reducedMotion.value) frame = requestAnimationFrame(draw);
}
function redraw() { if (isOpen.value && !document.hidden && !frame) frame = requestAnimationFrame(draw); }
async function prepareTextures() {
  const token = ++ticket;
  const ids = [!props.paint ? props.design.paint.colorAssetId : null, !props.glow ? props.design.paint.glowAssetId : null];
  if (!ids.some(Boolean)) { loading.value = false; redraw(); return; }
  loading.value = true;
  const owned: ImageBitmap[] = [];
  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase(); const blobs = await loadAssets(db, ids);
    const decode = async (id: string | null) => {
      if (!id) return null;
      const blob = blobs.get(id); if (!blob) throw new Error('Missing paint');
      const bitmap = await createImageBitmap(blob); owned.push(bitmap); return bitmap;
    };
    const paint = await decode(ids[0]!), glow = await decode(ids[1]!);
    if (!alive || token !== ticket || !isOpen.value) { owned.forEach(b => b.close()); return; }
    loadedPaint = paint; loadedGlow = glow;
  } catch {
    owned.forEach(b => b.close());
    if (alive && token === ticket && isOpen.value) textureError.value = true;
  } finally {
    db?.close();
    if (alive && token === ticket && isOpen.value) { loading.value = false; redraw(); }
  }
}
async function open() {
  if (props.disabled || !dialog.value || dialog.value.open) return;
  emit('opened');
  focus.value = 'whole'; facing.value = 1; paused.value = false; dark.value = false; textureError.value = false;
  time = 0; last = null; releaseImages();
  dialog.value.showModal(); isOpen.value = true;
  previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
  await nextTick();
  if (!alive || !isOpen.value) return;
  if (canvas.value) { observer = new ResizeObserver(redraw); observer.observe(canvas.value); }
  void prepareTextures(); redraw();
}
function close() { dialog.value?.close(); }
async function onClose() {
  if (!isOpen.value) return;
  ticket++; isOpen.value = false; if (frame) cancelAnimationFrame(frame); frame = 0;
  observer?.disconnect(); observer = null; releaseImages();
  document.body.style.overflow = previousOverflow; emit('closed');
  await nextTick(); if (alive) entry.value?.focus({ preventScroll: true });
}
function visibility() { if (document.hidden) { if (frame) cancelAnimationFrame(frame); frame = 0; } else { last = null; redraw(); } }
watch(() => [props.design, props.paint, props.glow, props.glowVersion, props.effect, focus.value, facing.value, dark.value, paused.value, reducedMotion.value], () => { last = null; redraw(); });
document.addEventListener('visibilitychange', visibility);
onBeforeUnmount(() => {
  alive = false; ticket++; if (frame) cancelAnimationFrame(frame); observer?.disconnect(); releaseImages();
  if (isOpen.value) { document.body.style.overflow = previousOverflow; emit('closed'); }
  document.removeEventListener('visibilitychange', visibility);
});
</script>

<template>
  <div class="fish-showcase">
    <button ref="entry" class="button button--muted showcase-entry" :disabled="disabled" aria-haspopup="dialog" :aria-expanded="isOpen" @click="open">🔍 近看</button>
    <dialog ref="dialog" class="showcase-dialog" aria-labelledby="showcase-title" @close="onClose" @cancel.prevent="close">
      <header class="showcase-heading"><div><p>你画的每一笔，都在这里</p><h2 id="showcase-title">{{ title }}</h2></div><button class="showcase-close" autofocus @click="close">✕ 返回</button></header>
      <div class="showcase-view" :class="{ 'is-loading': loading }">
        <canvas v-if="supported" ref="canvas" role="img" :aria-label="`${title}的${focus === 'head' ? '头部' : focus === 'body' ? '花纹' : '完整'}近看，保留原笔迹与印章`" />
        <p v-else class="showcase-loading">此浏览器暂时无法显示画布。</p>
        <p v-if="loading" class="showcase-loading" role="status">画过的笔迹游过来啦…</p>
        <p v-if="textureError" class="showcase-error" role="status">有些笔迹暂时没显示，返回后可以再试一次。</p>
        <div class="showcase-focus" role="group" aria-label="近看哪里"><button :aria-pressed="focus === 'whole'" @click="focus = 'whole'">🐟 整条鱼</button><button :aria-pressed="focus === 'body'" @click="focus = 'body'">🎨 看花纹</button><button :aria-pressed="focus === 'head'" @click="focus = 'head'">🙂 看脸</button></div>
      </div>
      <footer class="showcase-actions"><button @click="facing = facing === 1 ? -1 : 1">↔ 转个身</button><button :disabled="reducedMotion" :aria-pressed="paused || reducedMotion" @click="paused = !paused">{{ reducedMotion ? '⏸ 静止观察' : paused ? '▶ 动一动' : '⏸ 停一停' }}</button><button :aria-pressed="dark" @click="dark = !dark">{{ dark ? '☀ 看亮处' : '☾ 看暗处' }}</button></footer>
    </dialog>
  </div>
</template>

<style scoped>
.fish-showcase{display:inline-flex}.showcase-entry{min-height:48px}.showcase-dialog{width:calc(100% - 40px);max-width:1100px;height:min(820px,calc(100dvh - 40px));max-height:calc(100dvh - 40px);padding:0;border:1px solid #c3d6cc;border-radius:26px;background:#fffdf7;color:#243d38;overflow:hidden}.showcase-dialog::backdrop{background:#102f3ce8}.showcase-heading{height:96px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 25px}.showcase-heading p{font-size:12px;color:#7b8c77}.showcase-heading h2{font-size:29px;margin-top:3px;overflow-wrap:anywhere;line-height:1.2}.showcase-close{min-height:48px;flex-shrink:0;padding:9px 17px;border:1px solid #c7d8c7;border-radius:14px;background:#edf3e8;color:#345f4d;font-size:15px}.showcase-view{height:calc(100% - 180px);position:relative;background:#174f50;overflow:hidden}.showcase-view canvas{width:100%;height:calc(100% - 66px);display:block}.showcase-view.is-loading canvas{visibility:hidden}.showcase-focus{position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:center;gap:10px;padding:9px 14px;background:#113d40}.showcase-focus button{min-height:48px;min-width:130px;padding:9px 16px;border:1px solid #769b88;border-radius:14px;background:#254f50;color:#eaf5e5;font-size:15px}.showcase-focus button[aria-pressed=true]{background:#f2d28c;border-color:#f2d28c;color:#584927}.showcase-actions{height:84px;display:flex;align-items:center;justify-content:center;gap:14px;padding:14px;background:#fffdf7}.showcase-actions button{min-height:48px;min-width:140px;padding:10px 16px;border:1px solid #bdcec1;border-radius:14px;background:#edf3e8;color:#315f4d;font-size:15px}.showcase-actions button[aria-pressed=true]{background:#dcebd5}.showcase-actions button:disabled{opacity:.6}.showcase-loading{position:absolute;inset:0 0 66px;display:grid;place-items:center;color:#e9f5e7;font-size:16px}.showcase-error{position:absolute;left:12px;right:12px;top:12px;background:#fff4dbec;border-radius:12px;padding:10px 14px;color:#77592a;font-size:13px}
@media(max-width:600px){.showcase-dialog{width:calc(100% - 16px);height:calc(100dvh - 16px);max-height:calc(100dvh - 16px);border-radius:20px}.showcase-heading{height:96px;padding:14px 17px}.showcase-heading h2{font-size:23px}.showcase-heading p{font-size:11px}.showcase-view{height:calc(100% - 172px)}.showcase-focus{gap:6px;padding:9px 8px}.showcase-focus button{min-width:0;flex:1;padding:8px 6px;font-size:13px}.showcase-actions{height:76px;padding:10px 8px;gap:6px}.showcase-actions button{min-width:0;flex:1;font-size:13px;padding:8px 6px}}
@media(max-height:500px){.showcase-heading{height:68px;padding:9px 20px}.showcase-heading p{display:none}.showcase-heading h2{font-size:22px}.showcase-view{height:calc(100% - 134px)}.showcase-actions{height:66px;padding:8px}.showcase-view canvas{height:calc(100% - 60px)}.showcase-focus{padding:6px 14px}}
</style>
