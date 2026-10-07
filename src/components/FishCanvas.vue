<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { bodies, eyes, finSets, heads, mouths, tails } from '../catalog/fish.ts';
import { fitFish, getEditorBounds, getFishGeometry, screenToCanonical, screenToLocal } from '../domain/geometry.ts';
import type { FishDesign } from '../domain/types.ts';
import type { PointerSample } from '../features/editor/editor.ts';
import type { PaintLayer } from '../features/editor/paintLayer.ts';
import { renderFish } from '../rendering/FishRenderer.ts';
import { drawStudioWater } from '../rendering/studioWater.ts';

const props = defineProps<{
  design: FishDesign; color?: PaintLayer | null; glow?: PaintLayer | null; paintTick?: number;
  interactive?: boolean; dark?: boolean; selectedStampId?: string | null; label?: string;
}>();
const emit = defineEmits<{ press: [PointerSample]; drag: [PointerSample]; release: [] }>();
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

function placementFor(element: HTMLCanvasElement) {
  const { width, height } = element.getBoundingClientRect();
  return { width, height, placement: fitFish(getEditorBounds(props.design), width, height) };
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

watch(() => [props.design, props.color, props.glow, props.paintTick, props.dark, props.selectedStampId, props.interactive] as const, scheduleDraw);
watch(() => props.interactive, (interactive) => { if (!interactive && activePointer !== null) { activePointer = null; emit('release'); } });
defineExpose({ redraw: scheduleDraw });
onMounted(() => {
  observer = new ResizeObserver(scheduleDraw);
  if (canvas.value) observer.observe(canvas.value);
  window.addEventListener('resize', scheduleDraw);
  scheduleDraw();
});
onBeforeUnmount(() => {
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
  </div>
</template>
