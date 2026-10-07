<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { bodies, eyes, finSets, heads, mouths, tails } from '../catalog/fish.ts';
import { bodyOutline, canonicalToScreen, fitFish, getEditorBounds, getFishGeometry, screenToCanonical, screenToLocal } from '../domain/geometry.ts';
import { changeSculpt } from '../domain/fish.ts';
import type { FishDesign } from '../domain/types.ts';
import type { PointerSample } from '../features/editor/editor.ts';
import type { PaintLayer } from '../features/editor/paintLayer.ts';
import { renderFish } from '../rendering/FishRenderer.ts';
import { drawStudioWater } from '../rendering/studioWater.ts';

const props = defineProps<{
  design: FishDesign; color?: PaintLayer | null; glow?: PaintLayer | null; paintTick?: number;
  interactive?: boolean; sculpting?: boolean; dark?: boolean; selectedStampId?: string | null; label?: string;
}>();
const emit = defineEmits<{ press: [PointerSample]; drag: [PointerSample]; release: []; sculptLive: [FishDesign]; sculptEnd: [] }>();
const canvas = ref<HTMLCanvasElement>();
const supported = ref(true);
const name = (items: readonly { id: string; name: string }[], id: string) => items.find((item) => item.id === id)?.name ?? '';
const description = computed(() => {
  const d = props.design;
  return `${name(bodies, d.bodyId)}、${name(heads, d.parts.headId)}、${name(tails, d.parts.tailId)}、${name(finSets, d.parts.finId)}、${name(eyes, d.parts.eyeId)}、${name(mouths, d.parts.mouthId)}；长度 ${d.shape.length.toFixed(2)} 倍，高度 ${d.shape.height.toFixed(2)} 倍，头部占比 ${Math.round(d.shape.headRatio * 100)}%；${d.stamps.length} 枚印章。`;
});
let observer: ResizeObserver | undefined;
let frame = 0;
let activePointer: number | null = null;
const handles = ref<{ edge: 'top' | 'bottom'; index: number; x: number; y: number; base: number }[]>([]);
let sculptDrag: { pointer: number; target: HTMLElement; edge: 'top' | 'bottom'; index: number; base: number; placement: ReturnType<typeof fitFish>; axes: ReturnType<typeof getFishGeometry>['axes'] } | null = null;
const sculptValue = (value: number) => Math.max(-.14, Math.min(.14, Math.round(value * 1000) / 1000));
function sculptDown(e: PointerEvent, handle: typeof handles.value[number]) {
  if (sculptDrag || !e.isPrimary || e.button !== 0 || !canvas.value) return;
  const target = e.currentTarget as HTMLElement;
  target.setPointerCapture(e.pointerId);
  sculptDrag = { ...handle, target, pointer: e.pointerId, placement: placementFor(canvas.value).placement, axes: getFishGeometry(props.design).axes };
}
function sculptMove(e: PointerEvent) {
  if (!sculptDrag || e.pointerId !== sculptDrag.pointer || !canvas.value) return;
  const r = canvas.value.getBoundingClientRect();
  const point = screenToCanonical({ x: e.clientX - r.left, y: e.clientY - r.top }, sculptDrag.placement, sculptDrag.axes);
  emit('sculptLive', changeSculpt(props.design, sculptDrag.edge, sculptDrag.index, sculptValue(point.y - sculptDrag.base)));
}
function sculptEnd(e?: PointerEvent) {
  if (!sculptDrag || e && sculptDrag.pointer !== e.pointerId) return;
  const d = sculptDrag; sculptDrag = null;
  if (d.target.hasPointerCapture(d.pointer)) d.target.releasePointerCapture(d.pointer);
  emit('sculptEnd');
  scheduleDraw();
}
function sculptKey(e: KeyboardEvent, handle: typeof handles.value[number]) {
  if (!['ArrowUp', 'ArrowDown'].includes(e.key)) return;
  e.preventDefault();
  emit('sculptLive', changeSculpt(props.design, handle.edge, handle.index, sculptValue((props.design.sculpt?.[handle.edge][handle.index] ?? 0) + (e.key === 'ArrowUp' ? -.01 : .01))));
  emit('sculptEnd');
}

function placementFor(element: HTMLCanvasElement) {
  const { width, height } = element.getBoundingClientRect();
  return { width, height, placement: sculptDrag?.placement ?? fitFish(getEditorBounds(props.design), width, height) };
}
function draw() {
  frame = 0;
  const element = canvas.value;
  const ctx = element?.getContext('2d');
  if (!element || !ctx) { supported.value = false; return; }
  const { width, height, placement } = placementFor(element);
  if (width <= 0 || height <= 0) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const backingWidth = Math.round(width * dpr), backingHeight = Math.round(height * dpr);
  if (element.width !== backingWidth || element.height !== backingHeight) { element.width = backingWidth; element.height = backingHeight; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawStudioWater(ctx, width, height, props.dark);
  renderFish(ctx, props.design, placement, {
    paint: props.color?.canvas, glow: props.glow ? { source: props.glow.canvas, version: props.glow.version } : null,
    dim: props.dark ? 0.55 : 0, selectedStampId: props.interactive ? props.selectedStampId : null,
  });
  const base = bodyOutline(bodies.find(b => b.id === props.design.bodyId)!, heads.find(h => h.id === props.design.parts.headId)!, props.design.shape.headRatio);
  const outline = bodyOutline(bodies.find(b => b.id === props.design.bodyId)!, heads.find(h => h.id === props.design.parts.headId)!, props.design.shape.headRatio, props.design.sculpt);
  handles.value = (['top', 'bottom'] as const).flatMap(edge => [0, 1, 2].map(index => {
    const s = (index + 1) / 4;
    const p = canonicalToScreen({ x: outline.trunkX(s), y: edge === 'top' ? outline.trunkTop(s) : outline.trunkBottom(s) }, placement, getFishGeometry(props.design).axes);
    return { edge, index, ...p, base: edge === 'top' ? base.trunkTop(s) : base.trunkBottom(s) };
  }));
}
function scheduleDraw() { if (!frame) frame = requestAnimationFrame(draw); }

/** 输入使用 CSS 像素：减去画布偏移后逆转视口与身体缩放，不乘 DPR。 */
function sample(event: PointerEvent): PointerSample {
  const element = canvas.value!;
  const rect = element.getBoundingClientRect();
  const { placement } = placementFor(element);
  const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  const axes = getFishGeometry(props.design).axes;
  return { canonical: screenToCanonical(point, placement, axes), local: screenToLocal(point, placement), axes };
}
function onPointerDown(event: PointerEvent) {
  if (!props.interactive || activePointer !== null || !event.isPrimary) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  activePointer = event.pointerId;
  try { canvas.value?.setPointerCapture(event.pointerId); } catch { /* 指针已失效时仍按普通事件处理 */ }
  emit('press', sample(event));
}
function onPointerMove(event: PointerEvent) {
  if (event.pointerId !== activePointer) return;
  const events = event.getCoalescedEvents?.() ?? [];
  for (const item of events.length ? events : [event]) emit('drag', sample(item));
}
/** 抬笔、取消触摸或丢失捕获都结束本次操作；已画出的部分保留。 */
function finish(event: PointerEvent) {
  if (event.pointerId !== activePointer) return;
  activePointer = null;
  if (canvas.value?.hasPointerCapture(event.pointerId)) canvas.value.releasePointerCapture(event.pointerId);
  emit('release');
}

watch(() => [props.design, props.color, props.glow, props.paintTick, props.dark, props.selectedStampId, props.interactive, props.sculpting] as const, scheduleDraw);
watch(() => props.sculpting, value => { if (!value) sculptEnd(); });
watch(() => props.interactive, (interactive) => { if (!interactive && activePointer !== null) { activePointer = null; emit('release'); } });
defineExpose({ redraw: scheduleDraw });
onMounted(() => {
  observer = new ResizeObserver(scheduleDraw);
  if (canvas.value) observer.observe(canvas.value);
  window.addEventListener('resize', scheduleDraw);
  scheduleDraw();
});
onBeforeUnmount(() => {
  sculptEnd();
  observer?.disconnect(); window.removeEventListener('resize', scheduleDraw);
  if (frame) cancelAnimationFrame(frame);
  if (activePointer !== null) { activePointer = null; emit('release'); }
});
</script>
<template>
  <div class="fish-canvas-stage" :class="{ 'is-painting': interactive }">
    <canvas v-if="supported" ref="canvas" role="img" :aria-label="description"
      @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="finish"
      @pointercancel="finish" @lostpointercapture="finish">{{ description }}</canvas>
    <p v-else class="canvas-fallback">此浏览器暂不支持鱼画布，请换一个支持 Canvas 的浏览器。{{ description }}</p>
    <span class="scene-label">{{ label ?? '你的造型' }}</span>
    <div v-if="sculpting && supported" class="sculpt-handles" aria-label="直接捏鱼的轮廓"><button v-for="handle in handles" :key="handle.edge + handle.index" :aria-label="`${handle.edge === 'top' ? '鱼背' : '肚子'}塑形点 ${handle.index + 1}，上下拖动或按方向键`" :style="{ left: handle.x + 'px', top: handle.y + 'px' }" @pointerdown.prevent="sculptDown($event, handle)" @pointermove="sculptMove" @pointerup="sculptEnd" @pointercancel="sculptEnd" @lostpointercapture="sculptEnd" @blur="sculptEnd()" @keydown="sculptKey($event, handle)"><span :class="handle.edge">↕</span></button></div>
  </div>
</template>
<style scoped>@media(max-width:480px){.sculpt-handles button{width:44px!important;height:44px!important}.sculpt-handles span{width:27px!important;height:27px!important;font-size:17px!important}}</style>
<style scoped>.sculpt-handles{position:absolute;inset:0;pointer-events:none}.sculpt-handles button{position:absolute;transform:translate(-50%,-50%);width:56px;height:56px;border:0;background:transparent;display:grid;place-items:center;pointer-events:auto;touch-action:none;padding:0}.sculpt-handles span{display:grid;place-items:center;width:30px;height:30px;border:3px solid #fffdf2;border-radius:50%;background:#d98632;color:#fff;font-size:19px;box-shadow:0 2px 8px #244b57aa}.sculpt-handles .bottom{background:#286f95}.scene-label{pointer-events:none}</style>
