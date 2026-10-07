<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import type * as THREE from 'three';
import type { FishDesign } from '../domain/types.ts';
import type { createCreativeFish3d } from '../rendering/creativeFish3d.ts';
import { openDatabase } from '../storage/db.ts';
import { loadAssets } from '../storage/repository.ts';
import { usePreferences } from '../features/preferences.ts';
import PartThumb from './PartThumb.vue';
const props = defineProps<{ design: FishDesign; name?: string; paint?: CanvasImageSource | null; glow?: CanvasImageSource | null; disabled?: boolean }>();
const emit = defineEmits<{ opened: []; closed: [] }>();
const dialog = ref<HTMLDialogElement>(), entry = ref<HTMLButtonElement>(), canvas = ref<HTMLCanvasElement>();
const open = ref(false), fallback = ref(false), paused = ref(false), loading = ref(false), error = ref(''), yaw = ref(0), pitch = ref(0);
const fallbackPaint = shallowRef<CanvasImageSource | null>(null), fallbackGlow = shallowRef<CanvasImageSource | null>(null);
const prefs = usePreferences();
let renderer: THREE.WebGLRenderer | null = null, scene: THREE.Scene | null = null, camera: THREE.PerspectiveCamera | null = null;
let model: ReturnType<typeof createCreativeFish3d> | null = null, observer: ResizeObserver | null = null, frame = 0, last = 0, time = 0, ticket = 0, alive = true;
let bitmaps: ImageBitmap[] = [], drag: { id: number; x: number; y: number } | null = null;
function dispose(images = true) { if (frame) cancelAnimationFrame(frame); frame = 0; observer?.disconnect(); observer = null; model?.dispose(); model = null; renderer?.dispose(); renderer?.forceContextLoss(); renderer = null; scene = null; camera = null; if (images) { fallbackPaint.value = null; fallbackGlow.value = null; bitmaps.forEach(b => b.close()); bitmaps = []; } }
function draw(now = performance.now()) {
  frame = 0; if (!open.value || !renderer || !scene || !camera || document.hidden) return;
  if (!paused.value && !prefs.reducedMotion.value) time += Math.min(0.05, (now - last) / 1000); last = now;
  if (model) { model.fish.rotation.set(pitch.value, yaw.value, 0); model.animate(time); }
  renderer.render(scene, camera);
  if (!paused.value && !prefs.reducedMotion.value) frame = requestAnimationFrame(draw);
}
function schedule() { if (!frame) { last = performance.now(); frame = requestAnimationFrame(draw); } }
async function show() {
  if (props.disabled) return; open.value = true; emit('opened'); dialog.value?.showModal(); await nextTick(); void build();
}
async function build() {
  const token = ++ticket; dispose(); fallback.value = false; error.value = ''; loading.value = true;
  const owned: ImageBitmap[] = [];
  let paint = props.paint ?? null, glow = props.glow ?? null;
  try {
    const THREE = await import('three');
    const { createCreativeFish3d } = await import('../rendering/creativeFish3d.ts');
    if (!alive || token !== ticket || !open.value) return;
    if ((!paint && props.design.paint.colorAssetId) || (!glow && props.design.paint.glowAssetId)) {
      const db = await openDatabase(); let assets: Map<string, Blob>;
      try { assets = await loadAssets(db, [props.design.paint.colorAssetId, props.design.paint.glowAssetId]); } finally { db.close(); }
      for (const layer of ['color', 'glow'] as const) {
        const id = layer === 'color' ? props.design.paint.colorAssetId : props.design.paint.glowAssetId;
        if (!id || (layer === 'color' ? paint : glow)) continue;
        const blob = assets.get(id); if (!blob) throw new Error('笔迹没有完整读取，返回后可以重试。');
        const bitmap = await createImageBitmap(blob); owned.push(bitmap); if (layer === 'color') paint = bitmap; else glow = bitmap;
      }
    }
    if (!alive || token !== ticket || !open.value || !canvas.value) return;
    bitmaps = owned.splice(0); fallbackPaint.value = paint; fallbackGlow.value = glow;
    renderer = new THREE.WebGLRenderer({ canvas: canvas.value, antialias: true, alpha: false }); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    scene = new THREE.Scene(); scene.background = new THREE.Color('#87c4c7');
    scene.add(new THREE.HemisphereLight('#fff5dc', '#21656c', 2.5)); const sun = new THREE.DirectionalLight('#fff7e3', 2); sun.position.set(-2, 3, 4); scene.add(sun);
    model = createCreativeFish3d(props.design, paint, glow); scene.add(model.fish);
    camera = new THREE.PerspectiveCamera(35, 1, 0.01, 30);
    const resize = () => { if (!renderer || !canvas.value || !camera || !model) return; const r = canvas.value.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return; renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; const tangent = Math.tan(35 * Math.PI / 360); camera.position.z = Math.max(model.width * 0.65 / (tangent * camera.aspect), model.height * 0.65 / tangent, 0.9); camera.updateProjectionMatrix(); schedule(); };
    observer = new ResizeObserver(resize); observer.observe(canvas.value); resize(); schedule();
  } catch (cause) { if (alive && token === ticket) { error.value = cause instanceof Error && cause.message.includes('笔迹') ? cause.message : '立体画面暂时不能显示，先看看原来的作品。'; dispose(false); fallback.value = true; } }
  finally { owned.forEach(b => b.close()); if (alive && token === ticket) loading.value = false; }
}
function down(e: PointerEvent) { if (drag || e.button !== 0) return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.value?.setPointerCapture(e.pointerId); }
function move(e: PointerEvent) { if (!drag || drag.id !== e.pointerId) return; yaw.value += (e.clientX - drag.x) * 0.015; pitch.value = Math.max(-0.8, Math.min(0.8, pitch.value + (e.clientY - drag.y) * 0.01)); drag.x = e.clientX; drag.y = e.clientY; schedule(); }
function end(e?: PointerEvent) { if (!drag || e && drag.id !== e.pointerId) return; const id = drag.id; drag = null; if (canvas.value?.hasPointerCapture(id)) canvas.value.releasePointerCapture(id); }
async function closed() { if (!open.value) return; ++ticket; end(); open.value = false; dispose(); emit('closed'); await nextTick(); if (alive) entry.value?.focus({ preventScroll: true }); }
function hidden() { end(); if (document.hidden) { if (frame) cancelAnimationFrame(frame); frame = 0; } else schedule(); }
watch([yaw, pitch, paused, prefs.reducedMotion], schedule);
document.addEventListener('visibilitychange', hidden);
onBeforeUnmount(() => { alive = false; ++ticket; end(); open.value = false; dispose(); document.removeEventListener('visibilitychange', hidden); });
</script>
<template><div class="creative-volume"><button ref="entry" class="button button--muted" :disabled="disabled" @click="show">🌀 立体转看</button><dialog ref="dialog" aria-labelledby="volume-title" @close="closed" @cancel.prevent="dialog?.close()"><template v-if="open"><header><div><small>自由造型 · 立体样板</small><h2 id="volume-title">{{ name || '我的鱼' }}</h2></div><button autofocus @click="dialog?.close()">✕ 返回</button></header><div class="volume-view"><canvas v-if="!fallback" ref="canvas" role="img" aria-label="自己的鱼的立体模型，可以拖动旋转" @pointerdown="down" @pointermove="move" @pointerup="end" @pointercancel="end" @lostpointercapture="end" @webglcontextlost.prevent="error = '画面连接中断，请重新打开。'; fallback = true; dispose(false)"/><PartThumb v-else :design="design" focus="whole" :paint="fallbackPaint ?? paint" :glow="fallbackGlow ?? glow"/><p v-if="loading" role="status">立体小伙伴游过来啦…</p></div><p v-if="error" role="status">{{ error }}</p><footer><button :aria-pressed="paused || prefs.reducedMotion.value" @click="paused = !paused">{{ paused || prefs.reducedMotion.value ? '▶ 动一动' : '⏸ 停一停' }}</button><button @click="yaw -= Math.PI / 4">↶ 左转</button><button @click="yaw += Math.PI / 4">↷ 右转</button><button @click="yaw = 0; pitch = 0">🐟 正面看</button></footer><p class="volume-note">拖动鱼转一圈。两侧共用你画的花纹，鱼鳍是薄片；这是立体创作可行性样板，原作品仍可继续编辑。</p></template></dialog></div></template>
<style scoped>.creative-volume{display:inline-flex}dialog{width:min(1050px,calc(100vw - 20px));max-height:calc(100dvh - 20px);padding:18px;border:1px solid #c4ded0;border-radius:22px;background:#f5faef;color:#345d50;overflow:auto}dialog::backdrop{background:#103948bf}header{display:flex;align-items:center;justify-content:space-between;gap:14px}h2{font-size:26px}small{font-size:12px}.volume-view{height:min(56dvh,520px);min-height:240px;position:relative;background:#87c4c7;border-radius:18px;margin-top:14px;overflow:hidden}canvas,.volume-view :deep(.part-thumb){width:100%;height:100%;display:block;touch-action:none}.volume-view p{position:absolute;left:18px;top:12px;color:#204d45}footer{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding-top:14px}header button,footer button{min-height:44px;min-width:44px;padding:10px 15px;border:1px solid #b6d2c2;border-radius:13px;color:#315c50;background:#e7f2e2;font:inherit;font-size:13px;cursor:pointer}.volume-note{font-size:12px;line-height:1.8;margin-top:12px}@media(max-width:480px){dialog{padding:12px}.volume-view{height:45dvh}h2{font-size:21px}footer button{flex:1;padding:8px}}</style>
