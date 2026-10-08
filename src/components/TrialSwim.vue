<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { getFishGeometry } from '../domain/geometry.ts';
import { createSwimState, finAngle, fixedSteps, getSwimProfile, stepSwim, swimBob, swimFacing, tailAngle } from '../domain/swim.ts';
import type { EffectId, FishDesign } from '../domain/types.ts';
import type { PaintLayer } from '../features/editor/paintLayer.ts';
import { usePreferences } from '../features/preferences.ts';
import { renderFish } from '../rendering/FishRenderer.ts';
import { drawStudioWater } from '../rendering/studioWater.ts';

// 试游只读：同一份设计与笔迹层，只播放动画，不接收绘画输入。
const props = defineProps<{
  design: FishDesign; color?: PaintLayer | null; glow?: PaintLayer | null; dark?: boolean;
  effect?: EffectId | null; duration?: number; label?: string; paused?: boolean; presentation?: 'trial' | 'arrival';
}>();
const emit = defineEmits<{ ended: [] }>();
const canvas = ref<HTMLCanvasElement>();
const supported = ref(true);
const profile = computed(() => getSwimProfile(props.design));
const description = computed(() => `试游中：每秒约游 ${profile.value.speed.toFixed(2)} 个身长，尾巴每秒摆动约 ${profile.value.tailFrequency.toFixed(1)} 次。`);
const motion = usePreferences().reducedMotion;
let state = createSwimState();
let frame = 0;
let last: number | null = null;
let accumulator = 0;
let endedSent = false;

function layout(width: number, height: number) {
  const bounds = getFishGeometry(props.design).bounds;
  const scale = Math.min(width * (props.presentation === 'arrival' ? .62 : .34) / (bounds.maxX - bounds.minX), height * .65 / (bounds.maxY - bounds.minY));
  const bodyLength = scale * props.design.shape.length;
  const reach = Math.max(-bounds.minX, bounds.maxX) * scale;
  return { scale, bodyLength, halfWidth: Math.max(0, (width / 2 - reach - 12) / bodyLength) };
}
function tick(now: number) {
  frame = requestAnimationFrame(tick);
  const element = canvas.value;
  const ctx = element?.getContext('2d');
  if (!element || !ctx) { supported.value = false; return; }
  const { width, height } = element.getBoundingClientRect();
  if (width <= 0 || height <= 0) return;
  const { scale, bodyLength, halfWidth } = layout(width, height);
  const steps = fixedSteps(accumulator, last === null ? 0 : (now - last) / 1000);
  last = now; accumulator = steps.accumulator;
  for (let index = 0; index < steps.steps; index += 1) state = stepSwim(state, profile.value, halfWidth);
  if (props.duration && !endedSent && state.time >= props.duration) { endedSent = true; emit('ended'); }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const backingWidth = Math.round(width * dpr), backingHeight = Math.round(height * dpr);
  if (element.width !== backingWidth || element.height !== backingHeight) { element.width = backingWidth; element.height = backingHeight; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawStudioWater(ctx, width, height, props.dark);
  if (!motion.value) {
    ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = 0.06;
    for (let index = 0; index < 7; index += 1) {
      const x = ((index * 0.17 + state.time * 0.015) % 1) * width, y = height - ((index * 0.29 + state.time * 0.06) % 1) * height;
      ctx.beginPath(); ctx.arc(x, y, 3 + (index % 3) * 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  renderFish(ctx, props.design,
    { x: props.presentation === 'arrival' ? width / 2 - (getFishGeometry(props.design).bounds.minX + getFishGeometry(props.design).bounds.maxX) / 2 * scale : width / 2 + (motion.value ? 0 : state.x * bodyLength),
      y: height / 2 + (motion.value ? 0 : swimBob(state) * bodyLength) - (props.design.arms ? (getFishGeometry(props.design).bounds.minY + getFishGeometry(props.design).bounds.maxY) / 2 * scale : 0), scale, facing: props.presentation === 'arrival' || motion.value ? 1 : swimFacing(state) },
    { paint: props.color?.canvas, glow: props.glow ? { source: props.glow.canvas, version: props.glow.version } : null,
      tailAngle: motion.value ? 0 : tailAngle(state, profile.value), finAngle: motion.value ? 0 : finAngle(state), wave: motion.value ? 0 : state.time * 5, dim: props.dark ? 0.55 : 0,
      effect: motion.value ? null : props.effect, time: motion.value ? 0 : state.time });
}
/** 重新开始计时（“继续看”不重置，只有重新试游时调用）。 */
function restart() { state = createSwimState(); endedSent = false; }
defineExpose({ restart, elapsed: () => state.time });
watch(() => props.duration, () => { endedSent = false; });
/** 切到后台时暂停，返回后不补算后台时长。 */
function onVisibility() {
  if (document.hidden || props.paused) { if (frame) cancelAnimationFrame(frame); frame = 0; }
  else if (!frame) { last = null; accumulator = 0; frame = requestAnimationFrame(tick); }
}
onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility);
  if (!document.hidden && !props.paused) frame = requestAnimationFrame(tick);
});
watch(() => props.paused, onVisibility);
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility);
  if (frame) cancelAnimationFrame(frame);
});
</script>
<template>
  <div class="fish-canvas-stage">
    <canvas v-if="supported" ref="canvas" role="img" :aria-label="description">{{ description }}</canvas>
    <p v-else class="canvas-fallback">此浏览器暂不支持鱼画布，请换一个支持 Canvas 的浏览器。</p>
    <span class="scene-label">{{ label ?? '试游池 · 只看不画' }}</span>
  </div>
</template>
