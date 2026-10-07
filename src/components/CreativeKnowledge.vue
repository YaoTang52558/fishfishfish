<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef } from 'vue';
import { mouths } from '../catalog/fish.ts';
import type { FishDesign } from '../domain/types.ts';
import { loadObservationContent, type ObservationContent } from '../features/inspiration/content.ts';
import ObservationDetail from './ObservationDetail.vue';
import { stopNarration } from '../features/voice.ts';
import PartThumb from './PartThumb.vue';
const props = defineProps<{ design: FishDesign; initialTopic?: 'mouth' | 'fin' | 'tail' | 'shape'; paint?: CanvasImageSource | null; glow?: CanvasImageSource | null; disabled?: boolean }>();
const emit = defineEmits<{ opened: []; closed: [] }>();
const dialog = ref<HTMLDialogElement>(), button = ref<HTMLButtonElement>(), content = shallowRef<ObservationContent | null>(null), openState = ref(false), error = ref(false);
const mouthName = computed(() => mouths.find(m => m.id === props.design.parts.mouthId)?.name ?? '想象的嘴巴');
const topic = ref<'mouth' | 'fin' | 'tail' | 'shape'>('mouth');
const topics = {
  mouth: { title: '嘴巴有什么不同？', icon: '👄', label: '嘴巴', focus: 'mouth' as const, ids: ['forcipiger-flavissimus','scarus-ghobban'], question: '看看自己造的嘴巴。它像下面哪位朋友？也可以谁都不像。', note: '长嘴能探查礁缝，鹦嘴鱼会刮着吃藻类。不同物种有不同用法，你的幻想鱼可以有自己的故事。' },
  fin: { title: '鳍长在哪里？', icon: '🪽', label: '鱼鳍', focus: 'whole' as const, ids: ['zanclus-cornutus','sphyraena-barracuda'], question: '背上的长丝和分开的两片鳍，哪种让你有新想法？', note: '角镰鱼背上有长长的鳍条，大魣有分开的两片背鳍。观察外形以后，你可以创造自己的鳍。' },
  tail: { title: '尾巴都一样吗？', icon: '↔️', label: '尾巴', focus: 'tail' as const, ids: ['hippocampus-kuda','trichiurus-lepturus'], question: '海马能用尾巴抓住东西，带鱼末端却没有扇形尾鳍。你的鱼想要什么尾巴？', note: '这里比较的是这两种鱼的结构。创作里的尾巴与游速是游戏设定，不等于真实鱼类的运动规律。' },
  shape: { title: '鱼也有不同身形', icon: '🐟', label: '身形', focus: 'body' as const, ids: ['ostracion-cubicus','mobula-birostris'], question: '小盒子和大翅膀，让你想到了什么？', note: '黄箱鲀的身体像盒子，蝠鲼宽大的胸鳍像翅膀。你的幻想鱼也可以有自己的形状。' },
};
const examples = computed(() => content.value?.fish.filter(f => topics[topic.value].ids.includes(f.id)) ?? []);
let alive = true;
async function load() { error.value = false; try { const result = await loadObservationContent(); if (alive) content.value = result; } catch { if (alive) error.value = true; } }
function open() { if (!dialog.value || props.disabled) return; topic.value = props.initialTopic ?? 'mouth'; stopNarration(); emit('opened'); openState.value = true; dialog.value.showModal(); if (!content.value) void load(); }
async function closed() { if (!openState.value) return; openState.value = false; emit('closed'); await nextTick(); if (alive) button.value?.focus({ preventScroll: true }); }
onBeforeUnmount(() => { alive = false; if (openState.value) emit('closed'); });
</script>
<template>
  <div class="creative-knowledge"><button ref="button" :disabled="disabled" aria-label="看看真实鱼的秘密" @click="open">🔎 看看真鱼</button>
    <dialog ref="dialog" aria-labelledby="mouth-topic-title" @close="closed" @cancel.prevent="dialog?.close()"><template v-if="openState">
      <header><div><small>你的创作 → 真实鱼朋友 → 再去想象</small><h2 id="mouth-topic-title">{{ topics[topic].title }}</h2></div><button aria-label="回去继续创作" @click="dialog?.close()">🖌️ 回去画</button></header>
      <nav class="topic-tabs" aria-label="创作观察主题"><button v-for="(t, key) in topics" :key="key" :aria-pressed="topic === key" @click="topic = key; stopNarration()">{{ t.icon }} {{ t.label }}</button></nav>
      <div class="your-feature"><PartThumb :design="design" :focus="topics[topic].focus" :paint="paint" :glow="glow" /><div><strong>我的鱼{{ topic === 'mouth' ? '：' + mouthName : '' }}</strong><p>{{ topics[topic].question }}</p></div></div>
      <p v-if="error" role="alert">参考图暂时没读到。<button @click="load">重试</button></p><p v-else-if="!content" role="status">正在打开鱼朋友的图画…</p>
      <div v-if="content" class="mouth-examples"><ObservationDetail v-for="fish in examples" :key="fish.id" :fish="fish" :content="content" compact /></div>
      <footer><p>{{ topics[topic].note }}</p><button @click="dialog?.close()">🖌️ 我有新的想法了</button></footer>
    </template></dialog>
  </div>
</template>
<style scoped>
.creative-knowledge{display:inline-block}button{min-height:44px;min-width:44px;padding:9px 12px;border:1px solid #bed4c4;border-radius:12px;color:#315f4f;background:#edf5e9;cursor:pointer;font-size:13px}button:disabled{opacity:.5}dialog{width:min(1000px,calc(100vw - 24px));max-height:calc(100dvh - 24px);padding:20px;border:1px solid #bfd8c8;border-radius:24px;background:#f6faef;color:#345c4b;overflow:auto;overscroll-behavior:contain}dialog::backdrop{background:#183c49a6}header{display:flex;align-items:center;justify-content:space-between;gap:16px}header small{font-size:11px;color:#7d927a}h2{font-size:26px;margin:7px 0}.your-feature{display:flex;align-items:center;gap:18px;background:#e2f0e2;padding:14px;border-radius:18px;margin:14px 0}.your-feature :deep(.part-thumb){width:130px;height:95px;flex-shrink:0}.your-feature p,footer p{font-size:13px;line-height:1.8}.mouth-examples{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}footer{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 0 0}footer button{flex-shrink:0;background:#f7d68d}@media(max-width:600px){dialog{padding:12px}.mouth-examples{grid-template-columns:1fr}.your-feature{gap:8px;padding:10px}.your-feature :deep(.part-thumb){width:90px}footer{flex-direction:column;align-items:stretch}h2{font-size:21px}}
</style>
<style scoped>.topic-tabs{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.topic-tabs button[aria-pressed=true]{background:#315f4f;color:white}</style>
