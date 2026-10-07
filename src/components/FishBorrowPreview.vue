<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import { palette, patternLimits } from '../catalog/fish.ts';
import { changeColor, changePatternDetail } from '../domain/fish.ts';
import type { ColorSlot, FishDesign } from '../domain/types.ts';
import type { PaintLayer } from '../features/editor/paintLayer.ts';
import { contentAsset, type ObservationFish } from '../features/inspiration/content.ts';
import type { BorrowKind, FishRecipe } from '../features/inspiration/recipes.ts';
import FishCanvas from './FishCanvas.vue';

const props = defineProps<{ design: FishDesign; fish: ObservationFish; recipe: FishRecipe; kind: BorrowKind;
  color?: PaintLayer | null; glow?: PaintLayer | null; paintTick?: number; playing?: boolean; audioStatus?: string }>();
const emit = defineEmits<{ apply: [FishDesign, BorrowKind]; cancel: []; hear: [BorrowKind] }>();
const kind = ref(props.kind), original = ref(false);
const colors = shallowRef({ ...props.recipe.colors });
const pattern = shallowRef({ ...props.recipe.pattern });
const target = ref<ColorSlot | 'primary' | 'secondary'>(props.kind === 'colors' ? 'body' : 'primary');
const targets = computed(() => kind.value === 'colors'
  ? [{ key: 'body', name: '🐟 身体' }, { key: 'head', name: '🙂 头' }, { key: 'fin', name: '🪽 鳍' }, { key: 'tail', name: '〰 尾巴' }] as const
  : [{ key: 'primary', name: '● 花纹' }, { key: 'secondary', name: '○ 边和空隙' }] as const);
// Only the selected feature is borrowed. Current paint asset IDs can finish saving during preview.
const candidate = computed<FishDesign>(() => kind.value === 'colors'
  ? { ...props.design, colors: { ...colors.value } }
  : { ...props.design, pattern: { ...props.recipe.pattern!, ...pattern.value } });
const targetColor = computed(() => target.value === 'primary' || target.value === 'secondary'
  ? candidate.value.pattern[target.value] : candidate.value.colors[target.value]);
function switchKind(next: BorrowKind) { kind.value = next; target.value = next === 'colors' ? 'body' : 'primary'; original.value = false; }
function pickColor(value: string) {
  const next = changeColor(candidate.value, target.value, value);
  if (kind.value === 'colors') colors.value = next.colors; else pattern.value = next.pattern;
  original.value = false;
}
function detail(key: 'size' | 'density', event: Event) {
  pattern.value = changePatternDetail(candidate.value, key, (event.target as HTMLInputElement).valueAsNumber).pattern;
  original.value = false;
}
</script>

<template>
  <div class="borrow-preview">
    <div class="borrow-body">
      <section class="borrow-stage" aria-label="自己的鱼预览">
        <div class="borrow-stage-heading"><div><p>借一点灵感，再自己改</p><h3>{{ original ? '原来的鱼' : '我的鱼，试一试' }}</h3></div><button class="borrow-compare" :aria-pressed="original" @click="original = !original">{{ original ? '✨ 看看新样子' : '↔ 看看原来' }}</button></div>
        <FishCanvas :design="original ? design : candidate" :color="color" :glow="glow" :paint-tick="paintTick" :interactive="false" :label="original ? '原来的鱼' : '试一试 · 还没用上'" />
        <p class="borrow-note">画过的笔迹和印章还在。喜欢什么颜色，就换什么颜色。</p>
      </section>
      <aside class="borrow-controls" aria-label="调整借来的灵感">
        <div class="borrow-reference"><img :src="contentAsset(fish.image)" :alt="fish.name + '的参考图'"><div><strong>{{ fish.name }}</strong><p>颜色来自工坊色卡</p><button @click="emit('hear', kind)">{{ playing ? '■ 停止声音' : '🔊 听听特征' }}</button></div></div>
        <p v-if="audioStatus" class="borrow-spoken" role="status">{{ audioStatus }}</p>
        <div class="borrow-kinds" role="group" aria-label="选择借什么"><button :aria-pressed="kind === 'colors'" @click="switchKind('colors')">🎨 借颜色</button><button v-if="recipe.pattern" :aria-pressed="kind === 'pattern'" @click="switchKind('pattern')">▧ 借花纹</button></div>
        <fieldset class="borrow-targets"><legend>想改哪里？</legend><button v-for="item in targets" :key="item.key" :aria-pressed="target === item.key" @click="target = item.key">{{ item.name }}</button></fieldset>
        <fieldset class="borrow-swatches"><legend>点一个颜色</legend><div><button v-for="item in palette" :key="item.value" :aria-label="item.name" :title="item.name" :aria-pressed="targetColor === item.value" :style="{ background: item.value }" @click="pickColor(item.value)"><span v-if="targetColor === item.value" aria-hidden="true">✓</span></button></div></fieldset>
        <div v-if="kind === 'pattern'" class="borrow-details">
          <label>● 大小 <span>小 → 大</span><input aria-label="花纹大小" type="range" :min="patternLimits.size.min" :max="patternLimits.size.max" step="0.05" :value="candidate.pattern.size ?? 1" @input="detail('size', $event)"></label>
          <label>▧ {{ candidate.pattern.id === 'clown-bands' ? '间距' : '疏密' }} <span>{{ candidate.pattern.id === 'clown-bands' ? '远 → 近' : '疏 → 密' }}</span><input aria-label="花纹疏密" type="range" :min="patternLimits.density.min" :max="patternLimits.density.max" step="0.05" :value="candidate.pattern.density ?? 1" @input="detail('density', $event)"></label>
        </div>
        <p class="borrow-freedom">不用照着画，你可以创造全新的鱼。</p>
      </aside>
    </div>
    <footer class="borrow-footer"><button class="borrow-back" @click="emit('cancel')">← 再看看鱼</button><button class="borrow-apply" :disabled="original" @click="emit('apply', candidate, kind)">✓ 用在我的鱼上</button></footer>
  </div>
</template>

<style scoped>
.borrow-preview{height:calc(100% - 98px);display:flex;flex-direction:column;min-height:0}.borrow-body{display:grid;grid-template-columns:minmax(0,1fr) 300px;flex:1;min-height:0}.borrow-stage{display:flex;flex-direction:column;min-width:0;padding:22px;overflow:auto}.borrow-stage-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.borrow-stage-heading p{font-size:12px;color:#778875}.borrow-stage-heading h3{font-size:25px;margin-top:3px}.borrow-compare,.borrow-back{min-height:48px;border:1px solid #c6d4c4;border-radius:14px;background:#edf3e7;color:#315e4d;padding:10px 14px;font-size:14px;flex-shrink:0}.borrow-compare[aria-pressed=true]{background:#d9e9d7}.borrow-stage :deep(.fish-canvas-stage){flex:1;min-height:240px}.borrow-note{font-size:12px;color:#70836f;padding-top:14px}.borrow-controls{overflow:auto;padding:18px;background:#f0f2e7;border-left:1px solid #dce4d7;overscroll-behavior:contain}.borrow-reference{display:flex;gap:10px;align-items:center;margin-bottom:16px}.borrow-reference img{width:92px;height:78px;object-fit:contain}.borrow-reference strong{font-size:15px}.borrow-reference p{font-size:11px;color:#778875;margin-top:3px}.borrow-reference button{border:0;background:transparent;color:#315e4d;font-size:12px;min-height:44px;padding:5px 0}.borrow-kinds{display:flex;gap:6px;margin:12px 0 20px}.borrow-kinds button{flex:1;min-height:48px;padding:8px;border:1px solid #c7d9c5;border-radius:13px;background:#fffdf7;color:#3d6750;font-size:14px}.borrow-kinds button[aria-pressed=true]{background:#245e55;border-color:#245e55;color:white}.borrow-controls fieldset{border:0;padding:0;margin:0 0 17px}.borrow-controls legend{font-size:13px;color:#506d52;margin-bottom:9px}.borrow-targets{display:flex;flex-wrap:wrap;gap:6px}.borrow-targets button{min-height:44px;flex:1;min-width:100px;border:1px solid #cadac4;border-radius:11px;background:#fdfcf4;color:#41624f;font-size:13px;padding:6px}.borrow-targets button[aria-pressed=true]{border-color:#5f9575;background:#e0eddb}.borrow-swatches>div{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px}.borrow-swatches button{width:100%;aspect-ratio:1;border:2px solid #fffdf7;border-radius:12px;min-height:32px;box-shadow:0 0 0 1px #bdcbb9;color:#fff;font-size:21px;text-shadow:0 1px 3px #152f29}.borrow-swatches button[aria-pressed=true]{box-shadow:0 0 0 3px #316c55}.borrow-details label{display:block;font-size:13px;color:#42634e;margin:16px 0}.borrow-details label>span{float:right;font-size:11px;color:#85917d}.borrow-details input{display:block;width:100%;height:44px;accent-color:#346f59;margin-top:3px}.borrow-freedom{font-size:12px;color:#948065;margin-top:15px}.borrow-footer{height:84px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 24px;background:#fffdf7;border-top:1px solid #dce4d7}.borrow-apply{min-height:54px;min-width:240px;border:0;border-radius:16px;background:#f2cc83;color:#5c4624;font-size:16px;font-weight:750;padding:10px 20px}.borrow-apply:disabled{opacity:.45}
@media(max-width:850px){.borrow-preview{height:calc(100% - 86px)}.borrow-body{grid-template-columns:minmax(0,1fr) 260px}.borrow-stage{padding:16px}.borrow-controls{padding:14px}.borrow-stage-heading{align-items:start;flex-direction:column}.borrow-stage-heading h3{font-size:23px}.borrow-footer{padding:14px 18px}.borrow-reference img{width:75px}.borrow-apply{min-width:210px}}
@media(max-width:600px){.borrow-preview{height:calc(100% - 80px)}.borrow-body{display:block;overflow:auto}.borrow-stage{overflow:visible;padding:14px}.borrow-stage-heading{flex-direction:row;align-items:center}.borrow-stage-heading h3{font-size:21px}.borrow-compare{font-size:12px;padding:8px}.borrow-stage :deep(.fish-canvas-stage){min-height:205px}.borrow-controls{overflow:visible;border-left:0;border-top:1px solid #dce4d7}.borrow-reference img{width:100px}.borrow-swatches button{min-height:42px}.borrow-footer{height:76px;padding:10px 12px;gap:8px}.borrow-back{padding:8px 10px;font-size:12px}.borrow-apply{min-width:0;flex:1;font-size:14px;padding:10px}.borrow-note{font-size:11px}}
@media(max-height:850px) and (min-width:601px){.borrow-preview{height:calc(100% - 86px)}}
.borrow-spoken{font-size:12px;color:#42634e;border-radius:12px;padding:10px;background:#e2ecdc;margin-bottom:12px;line-height:1.7}
</style>
