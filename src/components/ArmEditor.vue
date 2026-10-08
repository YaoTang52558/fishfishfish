<script setup lang="ts">
import { armLimits, palette } from '../catalog/fish.ts';
import { changeArms } from '../domain/fish.ts';
import type { FishDesign } from '../domain/types.ts';
const props = defineProps<{ design: FishDesign }>();
const emit = defineEmits<{ change: [FishDesign, string]; live: [FishDesign]; end: [] }>();
function count(value: number) { emit('end'); emit('change', changeArms(props.design, { count: value }), '调整腕足数量'); }
function live(key: 'length' | 'curl', event: Event) { emit('live', changeArms(props.design, { [key]: (event.target as HTMLInputElement).valueAsNumber })); }
function color(value: string) { emit('end'); emit('change', changeArms(props.design, { color: value }), '给腕足换色'); }
</script>
<template>
  <section class="arm-editor" aria-label="幻想腕足工具">
    <header><strong>🦑 加腕足</strong><span>想长几条，就试几条</span></header>
    <div class="arm-counts" role="group" aria-label="腕足数量">
      <button v-for="n in [0,2,4,8]" :key="n" :aria-label="n ? `${n} 条腕足` : '移除腕足'" :aria-pressed="(design.arms?.count ?? 0) === n" @click="count(n)">{{ n ? '〰'.repeat(Math.min(n,4)) + ' ' + n : '✕ 不要' }}</button>
      <button aria-label="减少一条腕足" :disabled="!design.arms" @click="count((design.arms?.count ?? 1) - 1)">−</button><output aria-live="polite">{{ design.arms?.count ?? 0 }}</output><button aria-label="增加一条腕足" :disabled="(design.arms?.count ?? 0) >= armLimits.count.max" @click="count((design.arms?.count ?? 0) + 1)">＋</button>
    </div>
    <template v-if="design.arms">
      <div class="arm-sliders"><label>↔ 长短<input aria-label="腕足长短" type="range" :min="armLimits.length.min" :max="armLimits.length.max" step="0.01" :value="design.arms.length" @input="live('length',$event)" @change="emit('end')" @pointerup="emit('end')" @pointercancel="emit('end')" @blur="emit('end')"></label><label>➰ 卷一卷<input aria-label="腕足卷曲" type="range" min="0" max="1" step="0.05" :value="design.arms.curl" @input="live('curl',$event)" @change="emit('end')" @pointerup="emit('end')" @pointercancel="emit('end')" @blur="emit('end')"></label></div>
      <div class="arm-colors" role="group" aria-label="腕足颜色"><button v-for="item in palette" :key="item.value" :aria-label="`腕足颜色：${item.name}`" :aria-pressed="design.arms.color === item.value" :style="{background:item.value}" @click="color(item.value)"><span v-if="design.arms.color === item.value">✓</span></button></div>
    </template>
  </section>
</template>
<style scoped>
.arm-editor{padding:12px 16px;background:#f2f6e9;color:#315d50;border-top:1px solid #cbdccd}header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}header strong{font-size:16px}header span{font-size:12px}.arm-counts{display:flex;align-items:center;gap:6px;flex-wrap:wrap}button{min-width:48px;min-height:48px;border:1px solid #b9d1c1;border-radius:12px;padding:7px 10px;background:#fffdf2;color:#315d50;cursor:pointer}button[aria-pressed=true]{background:#d9edde;border:2px solid #398368}button:disabled{opacity:.4}output{min-width:20px;text-align:center}.arm-sliders{display:flex;gap:20px;margin:10px 0}.arm-sliders label{flex:1;min-width:0;font-size:14px}.arm-sliders input{display:block;width:100%;min-height:44px;accent-color:#367b64}.arm-colors{display:flex;gap:6px;flex-wrap:wrap}.arm-colors button{width:48px;padding:0;color:white;text-shadow:0 1px 3px #244848}.arm-colors button[aria-pressed=true]{outline:2px solid #32735f;outline-offset:2px;border-color:#fff}@media(max-width:480px){.arm-editor{padding:10px 8px}.arm-counts{gap:5px}.arm-counts button{padding:6px 8px;font-size:12px}.arm-sliders{gap:14px}.arm-colors{gap:4px}.arm-colors button{width:44px;min-width:44px;min-height:44px}header span{font-size:11px}}
</style>
