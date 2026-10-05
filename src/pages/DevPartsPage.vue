<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { bodies, eyes, finSets, heads, mouths, patterns, shapeLimits, tails } from '../catalog/fish.ts';
import { changePart, changePattern, createFishDesign, type PartKey } from '../domain/fish.ts';
import { fitFish, getFishGeometry } from '../domain/geometry.ts';
import type { FishDesign } from '../domain/types.ts';
import { renderFish } from '../rendering/FishRenderer.ts';

// 仅开发模式：按网格一次看完两类部件的所有组合，用于人工审查拼接效果（技术设计 4.1）。
type Axis = PartKey | 'patternId';
const axes: Record<Axis, { name: string; items: readonly { id: string; name: string }[] }> = {
  bodyId: { name: '身体', items: bodies }, headId: { name: '头型', items: heads }, tailId: { name: '尾巴', items: tails },
  finId: { name: '鳍', items: finSets }, eyeId: { name: '眼睛', items: eyes }, mouthId: { name: '嘴', items: mouths },
  patternId: { name: '花纹', items: patterns },
};
const rows = ref<Axis>('bodyId');
const cols = ref<Axis>('headId');
const shape = ref<'default' | 'long-flat' | 'short-tall'>('default');
const headRatio = ref(0.3);
const showGeometry = ref(false);
const canvas = ref<HTMLCanvasElement>();
let frame = 0;

function apply(design: FishDesign, axis: Axis, id: string) { return axis === 'patternId' ? changePattern(design, id) : changePart(design, axis, id); }
function base(): FishDesign {
  const design = createFishDesign();
  design.pattern = { id: 'none', primary: '#24486B', secondary: '#FFF3D9' };
  design.shape = shape.value === 'long-flat' ? { length: shapeLimits.length.max, height: shapeLimits.height.min, headRatio: headRatio.value }
    : shape.value === 'short-tall' ? { length: shapeLimits.length.min, height: shapeLimits.height.max, headRatio: headRatio.value }
      : { length: 1, height: 1, headRatio: headRatio.value };
  return design;
}
function draw() {
  frame = 0;
  const element = canvas.value, ctx = element?.getContext('2d');
  if (!element || !ctx) return;
  const rowItems = axes[rows.value].items, colItems = axes[cols.value].items;
  const cellW = 220, cellH = 150, labelW = 90, labelH = 28;
  const width = labelW + colItems.length * cellW, height = labelH + rowItems.length * cellH;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  element.width = width * dpr; element.height = height * dpr;
  element.style.width = `${width}px`; element.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#FFFDF7'; ctx.fillRect(0, 0, width, height);
  ctx.font = '13px system-ui'; ctx.fillStyle = '#243D38'; ctx.textBaseline = 'middle';
  colItems.forEach((item, c) => ctx.fillText(item.name, labelW + c * cellW + 10, labelH / 2));
  rowItems.forEach((row, r) => {
    ctx.fillStyle = '#243D38'; ctx.fillText(row.name, 8, labelH + r * cellH + cellH / 2);
    colItems.forEach((col, c) => {
      const design = apply(apply(base(), rows.value, row.id), cols.value, col.id);
      const x = labelW + c * cellW, y = labelH + r * cellH;
      ctx.save(); ctx.beginPath(); ctx.rect(x + 3, y + 3, cellW - 6, cellH - 6); ctx.clip();
      ctx.fillStyle = (r + c) % 2 ? '#1D5A56' : '#215F5B'; ctx.fillRect(x, y, cellW, cellH);
      const geometry = getFishGeometry(design);
      const view = fitFish(geometry.bounds, cellW - 10, cellH - 10);
      const placement = { x: x + 5 + view.x, y: y + 5 + view.y, scale: view.scale };
      renderFish(ctx, design, placement);
      if (showGeometry.value) {
        // 连接面：颈部截面（黄）、尾柄截面（红）、眼睛与嘴锚点（白）。
        const s = placement.scale, px = (p: { x: number; y: number }) => [placement.x + p.x * s, placement.y + p.y * s] as const;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#FFD84D'; ctx.beginPath(); ctx.moveTo(...px({ x: geometry.neck.x, y: geometry.neck.top })); ctx.lineTo(...px({ x: geometry.neck.x, y: geometry.neck.bottom })); ctx.stroke();
        ctx.strokeStyle = '#FF5A4D'; ctx.beginPath(); ctx.moveTo(...px({ x: geometry.peduncle.x, y: geometry.peduncle.center - geometry.peduncle.height / 2 })); ctx.lineTo(...px({ x: geometry.peduncle.x, y: geometry.peduncle.center + geometry.peduncle.height / 2 })); ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        for (const p of [geometry.eye.center, geometry.mouth.anchor]) { ctx.beginPath(); ctx.arc(...px(p), 2.5, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
    });
  });
}
function schedule() { if (!frame) frame = requestAnimationFrame(draw); }
watch([rows, cols, shape, headRatio, showGeometry], schedule);
onMounted(schedule);
onBeforeUnmount(() => { if (frame) cancelAnimationFrame(frame); });
</script>
<template>
  <section class="dev-parts">
    <h1>部件组合总览（开发）</h1>
    <p>只在开发模式可见。逐格检查颈部、尾柄、鳍根和眼嘴是否连接自然。</p>
    <div class="dev-controls">
      <label>行 <select v-model="rows"><option v-for="(axis, key) in axes" :key="key" :value="key">{{ axis.name }}</option></select></label>
      <label>列 <select v-model="cols"><option v-for="(axis, key) in axes" :key="key" :value="key">{{ axis.name }}</option></select></label>
      <label>比例 <select v-model="shape"><option value="default">默认</option><option value="long-flat">最长最扁</option><option value="short-tall">最短最高</option></select></label>
      <label>头部占比 <select v-model.number="headRatio"><option :value="0.2">20%</option><option :value="0.3">30%</option><option :value="0.4">40%</option></select></label>
      <label><input v-model="showGeometry" type="checkbox"> 显示连接面</label>
    </div>
    <div class="dev-grid"><canvas ref="canvas" role="img" aria-label="部件组合网格" /></div>
  </section>
</template>
<style scoped>
.dev-parts h1 { font-size: 24px; margin-bottom: 8px; }
.dev-parts p { font-size: 13px; color: var(--muted); }
.dev-controls { display: flex; flex-wrap: wrap; gap: 16px; margin: 16px 0; font-size: 13px; }
.dev-controls select { min-height: 36px; margin-left: 6px; }
.dev-grid { overflow: auto; border: 1px solid var(--line); border-radius: 12px; }
.dev-grid canvas { display: block; }
</style>
