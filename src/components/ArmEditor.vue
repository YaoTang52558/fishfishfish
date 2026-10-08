<script setup lang="ts">
import { computed, watch } from 'vue';
import { armLimits, armPoseLimits, palette } from '../catalog/fish.ts';
import { changeArms, changeArmPose } from '../domain/fish.ts';
import { getArmPoses } from '../domain/arms.ts';
import type { ArmPose, FishDesign } from '../domain/types.ts';
const props = defineProps<{ design: FishDesign; selectedArm: number }>();
const emit = defineEmits<{ change: [FishDesign, string]; live: [FishDesign]; end: []; select: [number] }>();
const current = computed(() => props.selectedArm >= 0 ? getArmPoses(props.design)[props.selectedArm] : props.design.arms);
function select(index: number) { emit('end'); emit('select', index); }
watch(() => props.design.arms?.count, count => { if (!count) select(-1); else if (props.selectedArm >= count) select(count - 1); });
function count(value: number) { emit('end'); emit('change', changeArms(props.design, { count: value }), '调整腕足数量'); }
function live(key: keyof ArmPose, event: Event) {
  const value = (event.target as HTMLInputElement).valueAsNumber;
  emit('live', props.selectedArm >= 0 ? changeArmPose(props.design, props.selectedArm, { [key]: value }) : changeArms(props.design, { [key]: value }));
}
function color(value: string) { emit('end'); emit('change', changeArms(props.design, { color: value }), '给腕足换色'); }
function reset() { emit('end'); emit('change', changeArms(props.design, { poses: undefined }), '腕足一起摆'); select(-1); }
</script>
<template>
  <section class="arm-editor" aria-label="幻想腕足工具">
    <header><strong>🦑 加腕足</strong><span>想长几条，就试几条</span></header>
    <div class="arm-counts" role="group" aria-label="腕足数量">
      <button v-for="n in [0,2,4,8]" :key="n" :aria-label="n ? `${n} 条腕足` : '移除腕足'" :aria-pressed="(design.arms?.count ?? 0) === n" @click="count(n)">{{ n ? '〰'.repeat(Math.min(n,4)) + ' ' + n : '✕ 不要' }}</button>
      <button aria-label="减少一条腕足" :disabled="!design.arms" @click="count((design.arms?.count ?? 1) - 1)">−</button><output aria-live="polite">{{ design.arms?.count ?? 0 }}</output><button aria-label="增加一条腕足" :disabled="(design.arms?.count ?? 0) >= armLimits.count.max" @click="count((design.arms?.count ?? 0) + 1)">＋</button>
    </div>
    <template v-if="design.arms">
      <details class="arm-separate" @toggle="!($event.currentTarget as HTMLDetailsElement).open && select(-1)"><summary @click="emit('end')">👆 每条分别摆</summary><div class="arm-selection" role="group" aria-label="选择单独调整的腕足"><button :aria-pressed="selectedArm < 0" @click="select(-1)">👐 全部</button><button v-for="n in design.arms.count" :key="n" :aria-label="`单独调整第 ${n} 条腕足`" :aria-pressed="selectedArm === n - 1" @click="select(n - 1)">{{ n }}</button><button :disabled="!design.arms.poses" @click="reset">↻ 一起摆</button></div><p>点数字选一条，再拖鱼上的圆点；也可以用下方滑杆。颜色仍一起换。</p></details>
      <p v-if="selectedArm >= 0" class="arm-scope" role="status">🟡 正在改第 {{ selectedArm + 1 }} 条，其余保持原样</p>
      <div class="arm-sliders"><label>↔ 长短<input aria-label="腕足长短" type="range" :min="armLimits.length.min" :max="armLimits.length.max" step="0.01" :value="current?.length" @input="live('length',$event)" @change="emit('end')" @pointerup="emit('end')" @pointercancel="emit('end')" @blur="emit('end')"></label><label>➰ 卷一卷<input aria-label="腕足卷曲" type="range" min="0" max="1" step="0.05" :value="current?.curl" @input="live('curl',$event)" @change="emit('end')" @pointerup="emit('end')" @pointercancel="emit('end')" @blur="emit('end')"></label></div>
      <div v-if="selectedArm >= 0" class="arm-sliders"><label>↔ 沿肚子挪<input aria-label="腕足连接位置" type="range" :min="armPoseLimits.position.min" :max="armPoseLimits.position.max" step="0.01" :value="getArmPoses(design)[selectedArm]?.position" @input="live('position',$event)" @change="emit('end')" @pointerup="emit('end')" @pointercancel="emit('end')" @blur="emit('end')"></label><label>↶ 朝这边<input aria-label="腕足朝向" type="range" :min="armPoseLimits.angle.min" :max="armPoseLimits.angle.max" step="0.05" :value="getArmPoses(design)[selectedArm]?.angle" @input="live('angle',$event)" @change="emit('end')" @pointerup="emit('end')" @pointercancel="emit('end')" @blur="emit('end')"></label></div>
      <div class="arm-colors" role="group" aria-label="腕足颜色"><button v-for="item in palette" :key="item.value" :aria-label="`腕足颜色：${item.name}`" :aria-pressed="design.arms.color === item.value" :style="{background:item.value}" @click="color(item.value)"><span v-if="design.arms.color === item.value">✓</span></button></div>
    </template>
  </section>
</template>
<style scoped>
.arm-separate{margin-top:8px}.arm-separate summary{min-height:44px;display:flex;align-items:center;cursor:pointer;font-size:14px}.arm-selection{display:flex;gap:6px;flex-wrap:wrap}.arm-separate p,.arm-scope{font-size:12px;line-height:1.7;margin:8px 0}.arm-scope{color:#73501e}
</style>
<style scoped>
.arm-editor{padding:12px 16px;background:#f2f6e9;color:#315d50;border-top:1px solid #cbdccd}header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}header strong{font-size:16px}header span{font-size:12px}.arm-counts{display:flex;align-items:center;gap:6px;flex-wrap:wrap}button{min-width:48px;min-height:48px;border:1px solid #b9d1c1;border-radius:12px;padding:7px 10px;background:#fffdf2;color:#315d50;cursor:pointer}button[aria-pressed=true]{background:#d9edde;border:2px solid #398368}button:disabled{opacity:.4}output{min-width:20px;text-align:center}.arm-sliders{display:flex;gap:20px;margin:10px 0}.arm-sliders label{flex:1;min-width:0;font-size:14px}.arm-sliders input{display:block;width:100%;min-height:44px;accent-color:#367b64}.arm-colors{display:flex;gap:6px;flex-wrap:wrap}.arm-colors button{width:48px;padding:0;color:white;text-shadow:0 1px 3px #244848}.arm-colors button[aria-pressed=true]{outline:2px solid #32735f;outline-offset:2px;border-color:#fff}@media(max-width:480px){.arm-editor{padding:10px 8px}.arm-counts{gap:5px}.arm-counts button{padding:6px 8px;font-size:12px}.arm-sliders{gap:14px}.arm-colors{gap:4px}.arm-colors button{width:44px;min-width:44px;min-height:44px}header span{font-size:11px}}
</style>
