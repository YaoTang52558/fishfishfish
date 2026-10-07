<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as THREE from 'three';
import type { OceanActor, FishTextures } from './OceanTank.vue';
import { createCreativeFish3d } from '../rendering/creativeFish3d.ts';
import { creativeSeabed } from '../rendering/creativeSeabed.ts';
import { AdaptiveQuality, frameStats, PerformanceRecorder, type PerformanceMeasurement } from '../features/fishing3d/performance.ts';
import { usePreferences } from '../features/preferences.ts';
import { downloadJson } from '../storage/backup.ts';
const props = defineProps<{ fish: OceanActor[]; textures: Map<string, FishTextures>; paused?: boolean }>();
const emit = defineEmits<{ select: [id: string]; fallback: [] }>();
const canvas = ref<HTMLCanvasElement>(), paused = ref(false), device = ref(''), recording = ref(false), measurement = ref<PerformanceMeasurement | null>(null), fps = ref(0), low = ref(false);
const prefs = usePreferences();
let renderer: THREE.WebGLRenderer | null = null, camera: THREE.PerspectiveCamera | null = null, scene: THREE.Scene | null = null, observer: ResizeObserver | null = null;
let seabed: ReturnType<typeof creativeSeabed> | null = null;
let models: { id: string; model: ReturnType<typeof createCreativeFish3d>; root: THREE.Group; phase: number; speed: number }[] = [];
let frame = 0, last = 0, time = 0, windowMs: number[] = [], windowSeconds = 0, recorder: PerformanceRecorder | null = null, alive = true;
const quality = new AdaptiveQuality(), ray = new THREE.Raycaster();
function dropModels() { models.forEach(m => { scene?.remove(m.root); m.model.dispose(); }); models = []; }
function rebuild() {
  if (!scene || !renderer) return; dropModels();
  try {
    props.fish.slice(0, 20).forEach((f, index) => { const texture = props.textures.get(f.id), model = createCreativeFish3d(f.design, texture?.color ?? null, texture?.glow ?? null); const root = new THREE.Group(); root.add(model.fish); root.scale.setScalar(0.8 / model.size); scene!.add(root); models.push({ id: f.id, model, root, phase: index * 1.7, speed: 0.17 + index % 4 * 0.025 }); }); schedule();
  } catch { fail(); }
}
function fail() { dispose(); if (alive) emit('fallback'); }
function resize() { if (!canvas.value || !renderer || !camera) return; recorder?.interrupt(); last = 0; const r = canvas.value.getBoundingClientRect(); if (!r.width || !r.height) return; renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.position.z = 6.1 / Math.min(1, camera.aspect); camera.updateProjectionMatrix(); schedule(); }
function draw(now: number) {
  frame = 0; if (!renderer || !scene || !camera || document.hidden || props.paused) { last = 0; return; }
  const elapsed = last ? now - last : 0; last = now;
  if (!paused.value && !prefs.reducedMotion.value) time += Math.min(0.05, elapsed / 1000);
  models.forEach((m, i) => { const a = time * m.speed + m.phase; m.root.position.set(Math.sin(a) * 2.4, Math.sin(a * 0.63 + i) * 1.15, -1 + (i % 4) * 0.65); m.root.rotation.y = Math.cos(a) >= 0 ? Math.sin(a) * 0.2 : Math.PI - Math.sin(a) * 0.2; m.model.animate(prefs.reducedMotion.value ? 0 : time); });
  renderer.render(scene, camera);
  if (elapsed > 0 && !paused.value && !prefs.reducedMotion.value) {
    recorder?.add(elapsed, renderer.info.render.calls, renderer.info.render.triangles);
    windowMs.push(elapsed); windowSeconds += elapsed / 1000;
    if (windowSeconds >= 1) { if (recorder) { measurement.value = recorder.read(); recording.value = !measurement.value.complete; } fps.value = frameStats(windowMs).fps; }
    if (windowSeconds >= 5) { if (quality.observe(frameStats(windowMs)) === 'low' && !low.value) { low.value = true; renderer.setPixelRatio(1); recorder?.qualityChanged(); } windowMs = []; windowSeconds = 0; }
  }
  if (!paused.value && !prefs.reducedMotion.value) frame = requestAnimationFrame(draw);
}
function schedule() { if (!frame) frame = requestAnimationFrame(draw); }
function select(e: MouseEvent) { if (!canvas.value || !camera || !scene) return; const r = canvas.value.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera); const hit = ray.intersectObjects(models.map(m => m.root), true)[0]; if (!hit) return; const actor = models.find(m => { let p: THREE.Object3D | null = hit.object; while (p) { if (p === m.root) return true; p = p.parent; } return false; }); if (actor) emit('select', actor.id); }
function start() { if (paused.value || props.paused || prefs.reducedMotion.value) return; recorder = new PerformanceRecorder(); measurement.value = recorder.read(); recording.value = true; last = 0; schedule(); }
function exportRecord() { if (!measurement.value) return; downloadJson({ format: 'fish-ocean-3d-performance-v1', date: new Date().toISOString(), device: device.value, userAgent: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, physicalDeviceVerified: false, renderer: 'procedural-3d', fish: models.length, quality: low.value ? 'low' : 'standard', reducedMotion: prefs.reducedMotion.value, ...measurement.value }, '我的海洋-立体帧预算.json'); }
function interrupt() { recorder?.interrupt(); last = 0; if (document.hidden) { if (frame) cancelAnimationFrame(frame); frame = 0; } else schedule(); }
function dispose() { if (frame) cancelAnimationFrame(frame); frame = 0; observer?.disconnect(); dropModels(); seabed?.dispose(); seabed = null; renderer?.dispose(); renderer?.forceContextLoss(); renderer = null; scene = null; camera = null; }
watch(() => [props.fish, props.textures], () => { recorder?.interrupt(); rebuild(); }); watch(() => [props.paused, paused.value, prefs.reducedMotion.value], () => { recorder?.interrupt(); last = 0; schedule(); });
onMounted(() => { try { renderer = new THREE.WebGLRenderer({ canvas: canvas.value, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); scene = new THREE.Scene(); scene.background = new THREE.Color('#3b9ba8'); scene.fog = new THREE.Fog('#3b9ba8', 9, 20); camera = new THREE.PerspectiveCamera(45, 1, 0.1, 30); scene.add(new THREE.HemisphereLight('#fff3ce', '#195e70', 2.3)); const light = new THREE.DirectionalLight('#efffff', 1.7); light.position.set(-2, 4, 4); scene.add(light); seabed = creativeSeabed(); scene.add(seabed.group); observer = new ResizeObserver(resize); observer.observe(canvas.value!); rebuild(); resize(); } catch { fail(); } document.addEventListener('visibilitychange', interrupt); });
onBeforeUnmount(() => { alive = false; document.removeEventListener('visibilitychange', interrupt); dispose(); });
</script>
<template><section class="creative-ocean-3d" aria-label="自己的立体海洋样板"><div class="volume-ocean-stage"><canvas ref="canvas" role="img" aria-label="原创作品的立体海洋，点鱼可以选择" @click="select" @webglcontextlost.prevent="fail"/><p>立体海洋 · {{ fish.length }} 条小伙伴</p></div><div class="volume-ocean-tools"><button class="button button--muted" :aria-pressed="paused" @click="paused = !paused">{{ paused ? '▶ 继续游' : '⏸ 停一停' }}</button><slot /></div><details class="ocean-parent-tools"><summary>👨‍👦 家长工具</summary><details><summary>立体海洋试玩记录</summary><p>当前 {{ fps.toFixed(1) }} fps · {{ low ? '轻量' : '标准' }}。这个样板共用侧面花纹，点选也可用下方作品卡。</p><label>设备<input v-model="device" maxlength="100" placeholder="例如 iPad 9 · Safari"></label><button class="button button--muted" :disabled="recording || paused || !!props.paused || prefs.reducedMotion.value" @click="start">开始 60 秒记录</button><button class="button button--muted" :disabled="!measurement" @click="exportRecord">导出记录</button><p v-if="measurement" role="status">{{ Math.min(60, measurement.seconds).toFixed(1) }} / 60 秒 · 中断 {{ measurement.interruptions }} 次 · {{ measurement.complete ? measurement.passesFrameBudget ? '帧预算达标，仍需核对真机' : '未达本次预算' : '记录中' }}</p><p>转屏、暂停、后台会标记中断。电脑结果不能代替 iPad；请保留失败样本。</p></details></details></section></template>
<style scoped>.volume-ocean-stage{height:clamp(350px,56dvh,640px);position:relative;background:#3b9ba8;border-radius:24px;overflow:hidden}.volume-ocean-stage canvas{width:100%;height:100%;display:block}.volume-ocean-stage p{position:absolute;left:16px;top:12px;color:#edf9ec;font-size:12px;pointer-events:none}.volume-ocean-tools{display:flex;gap:8px;flex-wrap:wrap;padding:12px 0}summary{min-height:44px;cursor:pointer;padding:12px 0}details p,label{font-size:13px;line-height:1.8}label{display:flex;gap:8px;align-items:center;margin-bottom:10px}input{min-height:44px;padding:8px;border:1px solid #c8dbcb;border-radius:12px;max-width:75%}details button{margin-right:8px}</style>
