<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { fitFish, getFishGeometry } from '../domain/geometry.ts';
import type { Bounds, FishDesign } from '../domain/types.ts';
import { renderFish } from '../rendering/FishRenderer.ts';

// focus=head 时放大到头部，便于看清眼睛和嘴。
const props = defineProps<{ design: FishDesign; focus?: 'whole' | 'head'; paint?: CanvasImageSource | null; glow?: CanvasImageSource | null }>();
const canvas = ref<HTMLCanvasElement>();
let frame = 0;

function draw() {
  frame = 0;
  const element = canvas.value, ctx = element?.getContext('2d');
  if (!element || !ctx) return;
  const { width, height } = element.getBoundingClientRect();
  if (width <= 0 || height <= 0) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  element.width = Math.round(width * dpr); element.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const geometry = getFishGeometry(props.design);
  let bounds: Bounds = geometry.bounds;
  if (props.focus === 'head') {
    const ys = geometry.head.map((p) => p.y);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    bounds = { minX: geometry.neck.x - (maxY - minY) * 0.2, maxX: geometry.bounds.maxX, minY, maxY: Math.max(maxY, geometry.mouth.anchor.y + geometry.mouth.size * 2.4) };
  }
  renderFish(ctx, props.design, fitFish(bounds, width, height), { paint: props.paint, glow: props.glow ? { source: props.glow, version: 0 } : null });
}
function schedule() { if (!frame) frame = requestAnimationFrame(draw); }
watch(() => [props.design, props.paint, props.glow], schedule);
onMounted(schedule);
onBeforeUnmount(() => { if (frame) cancelAnimationFrame(frame); });
</script>
<template><canvas ref="canvas" class="part-thumb" aria-hidden="true" /></template>
