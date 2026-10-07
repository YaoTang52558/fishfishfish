<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { bodies, heads } from '../catalog/fish.ts';
import { bodyOutline, getFishGeometry } from '../domain/geometry.ts';
import type { FishDesign } from '../domain/types.ts';
import { changeSculpt } from '../domain/fish.ts';
const props = defineProps<{ design: FishDesign }>();
const emit = defineEmits<{ live: [design: FishDesign]; end: []; reset: [] }>();
const svg = ref<SVGSVGElement>();
const outline = computed(() => bodyOutline(bodies.find(b => b.id === props.design.bodyId)!, heads.find(h => h.id === props.design.parts.headId)!, props.design.shape.headRatio));
const path = computed(() => getFishGeometry(props.design).canonicalContour.map((p, i) => `${i ? 'L' : 'M'}${80 + p.x * 140},${65 + p.y * 95}`).join(' ') + 'Z');
const positions = computed(() => (['top', 'bottom'] as const).flatMap(edge => [0, 1, 2].map(index => {
  const s = (index + 1) / 4, base = edge === 'top' ? outline.value.trunkTop(s) : outline.value.trunkBottom(s);
  return { edge, index, base, x: 80 + outline.value.trunkX(s) * 140, y: 65 + (base + (props.design.sculpt?.[edge][index] ?? 0)) * 95 };
})));
let drag: { edge: 'top' | 'bottom'; index: number; base: number; pointer: number; target: Element } | null = null;
function down(e: PointerEvent, p: typeof positions.value[number]) { if (drag || e.button !== 0) return; drag = { ...p, pointer: e.pointerId, target: e.currentTarget as Element }; drag.target.setPointerCapture(e.pointerId); }
function move(e: PointerEvent) {
  if (!drag || drag.pointer !== e.pointerId || !svg.value) return;
  const r = svg.value.getBoundingClientRect(), y = (e.clientY - r.top) * 130 / r.height;
  const offset = Math.max(-0.14, Math.min(0.14, (y - 65) / 95 - drag.base));
  emit('live', changeSculpt(props.design, drag.edge, drag.index, Math.round(offset * 1000) / 1000));
}
function end(e?: PointerEvent) { if (!drag || e && e.pointerId !== drag.pointer) return; const d = drag; drag = null; if (d.target.hasPointerCapture(d.pointer)) d.target.releasePointerCapture(d.pointer); emit('end'); }
onBeforeUnmount(() => end());
</script>
<template>
  <details class="sculpt-editor"><summary>🤏 捏一捏鱼背和肚子</summary><p>上下拖小圆点，造出自己的轮廓。画过的笔迹还在，可以撤销。</p>
    <svg ref="svg" viewBox="0 0 160 130" aria-label="鱼背和肚子的塑形控制图" @pointermove="move" @pointerup="end" @pointercancel="end" @lostpointercapture="end"><path :d="path" fill="#b9ded2" stroke="#427866" stroke-width="1.5"/><g v-for="p in positions" :key="`${p.edge}${p.index}`" @pointerdown.prevent="down($event, p)"><circle :cx="p.x" :cy="p.y" r="14" fill="transparent"/><circle :cx="p.x" :cy="p.y" r="4.5" :fill="p.edge === 'top' ? '#ecac64' : '#77afcf'" stroke="white" stroke-width="2" /></g></svg>
    <details><summary>用滑杆调整</summary><label v-for="p in positions" :key="`${p.edge}${p.index}`">{{ p.edge === 'top' ? '鱼背' : '肚子' }} {{ p.index + 1 }}<input type="range" min="-0.14" max="0.14" step="0.005" :value="design.sculpt?.[p.edge][p.index] ?? 0" @input="emit('live', changeSculpt(design, p.edge, p.index, ($event.target as HTMLInputElement).valueAsNumber))" @change="emit('end')" @blur="emit('end')" /></label></details>
    <button class="chip-button" @click="emit('reset')">恢复原轮廓</button>
  </details>
</template>
<style scoped>.sculpt-editor{margin-top:12px;border-top:1px solid #cadbcb;padding-top:8px}summary{min-height:44px;padding:12px 0;cursor:pointer}p{font-size:12px;line-height:1.7}svg{width:100%;height:210px;touch-action:none}g{cursor:ns-resize}label{display:flex;align-items:center;gap:10px;min-height:44px;font-size:12px}input{flex:1;min-width:0}</style>
