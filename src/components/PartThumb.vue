<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { fitFish, getFishGeometry } from '../domain/geometry.ts';
import type { Bounds, FishDesign } from '../domain/types.ts';
import { renderFish } from '../rendering/FishRenderer.ts';

// focus=head 时放大到头部，便于看清眼睛和嘴。
const props = defineProps<{ design: FishDesign; focus?: 'whole' | 'head' | 'tail' | 'body' | 'eye' | 'mouth'; paint?: CanvasImageSource | null; glow?: CanvasImageSource | null }>();
const canvas = ref<HTMLCanvasElement>();
let frame = 0;
let observer: ResizeObserver | null = null;

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
  if (props.focus === 'body') bounds = geometry.bodyBox;
  if (props.focus === 'tail') {
    const points = geometry.tail.polygon.map(p => ({ x: p.x + geometry.tail.pivot.x, y: p.y + geometry.tail.pivot.y }));
    bounds = { minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)) + geometry.axes.x * .08,
      minY: Math.min(...points.map(p => p.y)), maxY: Math.max(...points.map(p => p.y)) };
  }
  if (props.focus === 'eye' || props.focus === 'mouth') {
    const center = props.focus === 'eye' ? geometry.eye.center : geometry.mouth.anchor;
    const radius = props.focus === 'eye' ? geometry.eye.radius * 2.6 : Math.max(geometry.mouth.size * 3, geometry.axes.y * .2);
    bounds = { minX: center.x - radius * 1.3, maxX: center.x + radius * 1.3, minY: center.y - radius, maxY: center.y + radius };
  }
  renderFish(ctx, props.design, fitFish(bounds, width, height), { paint: props.paint, glow: props.glow ? { source: props.glow, version: 0 } : null });
}
function schedule() { if (!frame) frame = requestAnimationFrame(draw); }
watch(() => [props.design, props.paint, props.glow, props.focus], schedule);
onMounted(() => { observer = new ResizeObserver(schedule); if (canvas.value) observer.observe(canvas.value); schedule(); });
onBeforeUnmount(() => { observer?.disconnect(); if (frame) cancelAnimationFrame(frame); });
</script>
<template><canvas ref="canvas" class="part-thumb" aria-hidden="true" /></template>
