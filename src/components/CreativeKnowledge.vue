<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { mouths } from '../catalog/fish.ts';
import type { FishDesign } from '../domain/types.ts';
import { contentAsset, loadObservationContent, type ObservationContent, type ObservationFish } from '../features/inspiration/content.ts';
import { creativeTopics as topics, topicAudio, type CreativeTopicId } from '../features/inspiration/creativeTopics.ts';
import { fishRecipe, type BorrowKind } from '../features/inspiration/recipes.ts';
import type { PaintLayer } from '../features/editor/paintLayer.ts';
import FishBorrowPreview from './FishBorrowPreview.vue';
import ObservationDetail from './ObservationDetail.vue';
import { stopNarration, useVoice } from '../features/voice.ts';
import PartThumb from './PartThumb.vue';
const props = defineProps<{ design: FishDesign; initialTopic?: CreativeTopicId; color?: PaintLayer | null; glow?: PaintLayer | null; paintTick?: number; disabled?: boolean; active?: boolean }>();
const emit = defineEmits<{ opened: []; closed: []; applied: [FishDesign, string]; draw: []; arms: [] }>();
const dialog = ref<HTMLDialogElement>(), button = ref<HTMLButtonElement>(), content = shallowRef<ObservationContent | null>(null), openState = ref(false), error = ref(false);
const mouthName = computed(() => mouths.find(m => m.id === props.design.parts.mouthId)?.name ?? '想象的嘴巴');
const topic = ref<CreativeTopicId>('mouth'), voice = useVoice();
const examples = computed(() => topics[topic.value].examples.flatMap(example => content.value?.fish.find(f => f.id === example.id) ?? []));
const borrowing = shallowRef<{ fish: ObservationFish; kind: BorrowKind } | null>(null);
const reference = shallowRef<{ fish: ObservationFish; topic: CreativeTopicId } | null>(null);
const recipe = computed(() => borrowing.value ? fishRecipe(borrowing.value.fish.id) : null);
let previousOverflow = '';
let alive = true;
async function load() { error.value = false; try { const result = await loadObservationContent(); if (alive) content.value = result; } catch { if (alive) error.value = true; } }
function open() { if (!dialog.value || props.disabled) return; topic.value = props.initialTopic ?? 'mouth'; borrowing.value = null; stopNarration(); emit('opened'); openState.value = true; previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; dialog.value.showModal(); if (!content.value) void load(); }
function openReference() { open(); if (openState.value && reference.value) topic.value = reference.value.topic; }
function changeTopic(id: CreativeTopicId) { stopNarration(); topic.value = id; }
function hearIdea() { voice.playing.value ? voice.stop() : voice.play(contentAsset(topicAudio(topic.value))); }
function hearReference() { if (!reference.value) return; const { fish, topic: id } = reference.value; const keys = topics[id].examples.find(e => e.id === fish.id)?.keys; voice.playing.value ? voice.stop() : voice.play(contentAsset(fish.points.find(p => keys?.includes(p.key))?.audio ?? fish.introAudio)); }
function borrow(fish: ObservationFish, kind: BorrowKind) { stopNarration(); borrowing.value = { fish, kind }; }
function hearBorrow() { if (!borrowing.value) return; voice.playing.value ? voice.stop() : voice.play(contentAsset(borrowing.value.fish.introAudio)); }
function remember(fish: ObservationFish) { reference.value = { fish, topic: topic.value }; stopNarration(); dialog.value?.close(); emit('draw'); }
function apply(next: FishDesign, kind: BorrowKind) { if (!borrowing.value) return; const fish = borrowing.value.fish; emit('applied', next, `借${fish.name}的${kind === 'colors' ? '颜色' : '花纹'}`); remember(fish); }
function backToDraw() { stopNarration(); dialog.value?.close(); emit('draw'); }
function tryArms() { stopNarration(); dialog.value?.close(); emit('arms'); }
async function closed() { stopNarration(); if (!openState.value) return; borrowing.value = null; openState.value = false; document.body.style.overflow = previousOverflow; emit('closed'); await nextTick(); if (alive) button.value?.focus({ preventScroll: true }); }
onBeforeUnmount(() => { alive = false; stopNarration(); if (openState.value) { document.body.style.overflow = previousOverflow; emit('closed'); } });
watch(() => props.active, active => { if (active === false) { voice.stop(); dialog.value?.close(); } });
</script>
<template>
  <div class="creative-knowledge"><button ref="button" :disabled="disabled" aria-label="看看海洋朋友的秘密" @click="open">🔎 找灵感</button>
    <Teleport to="body"><dialog ref="dialog" class="creative-topic-dialog" :class="{ 'is-borrowing': borrowing }" aria-labelledby="mouth-topic-title" @close="closed" @cancel.prevent="dialog?.close()"><template v-if="openState">
      <header><div><small>看看海洋朋友，再自由想象</small><h2 id="mouth-topic-title">{{ topics[topic].title }}</h2></div><button aria-label="回去继续创作" @click="backToDraw">🖌️ 回去画</button></header>
      <FishBorrowPreview v-if="borrowing && recipe" :key="borrowing.fish.id + borrowing.kind" :design="design" :fish="borrowing.fish" :recipe="recipe" :kind="borrowing.kind" :color="color" :glow="glow" :paint-tick="paintTick" :playing="voice.playing.value" :audio-status="voice.error.value ? '声音没播出来，可以再点一下。' : ''" @apply="apply" @cancel="stopNarration(); borrowing = null" @hear="hearBorrow" />
      <template v-else>
      <nav class="topic-tabs" aria-label="创作观察主题"><button v-for="(t, key) in topics" :key="key" :data-creative-topic="key" :aria-pressed="topic === key" @click="changeTopic(key)">{{ t.icon }} {{ t.label }}</button></nav>
      <div class="your-feature"><PartThumb :design="design" :focus="topics[topic].focus" :paint="color?.canvas" :glow="glow?.canvas" /><div><strong>我的鱼{{ topic === 'mouth' ? '：' + mouthName : '' }}</strong><p>{{ topics[topic].question }}</p><button class="hear-idea" @click="hearIdea">{{ voice.playing.value ? '■ 停止声音' : '🔊 听听这个点子' }}</button></div></div>
      <p v-if="error" role="alert">参考图暂时没读到。<button @click="load">重试</button></p><p v-else-if="!content" role="status">正在打开鱼朋友的图画…</p>
      <div v-if="content" class="mouth-examples"><section v-for="fish in examples" :key="fish.id" :data-creative-fish="fish.id"><ObservationDetail :fish="fish" :content="content" compact /><div class="example-actions"><button @click="remember(fish)">🖌️ 看着它画</button><button v-if="fishRecipe(fish.id)" @click="borrow(fish, 'colors')">🎨 试试颜色</button><button v-if="fishRecipe(fish.id)?.pattern" @click="borrow(fish, 'pattern')">▧ 试试花纹</button></div></section></div>
      <p v-if="voice.error.value" role="status">声音没播出来，可以再点一下。</p>
      <footer><details><summary>👨‍👦 和家长一起想</summary><p>{{ topics[topic].note }}</p></details><button v-if="topic === 'arms'" @click="tryArms">🦑 试试腕足</button><button @click="backToDraw">🖌️ 我有新的想法了</button></footer>
      </template>
    </template></dialog></Teleport>
    <Teleport to="#creative-reference-slot" v-if="reference"><aside class="creative-reference" aria-label="我记住的灵感"><img :src="contentAsset(reference.fish.image)" :alt="reference.fish.name + '的观察参考'"><div><strong>{{ reference.fish.name }}</strong><p>{{ topics[reference.topic].examples.find(e => e.id === reference?.fish.id)?.keys.map(key => reference?.fish.points.find(p => p.key === key)?.label).filter(Boolean).join(' · ') }}</p></div><button :disabled="disabled" aria-label="听听我的灵感" @click="hearReference">{{ voice.playing.value ? '■' : '🔊' }}</button><button :disabled="disabled" @click="openReference">🔎 再看看</button><button aria-label="收起灵感参考" @click="reference = null; voice.stop()">✕</button></aside></Teleport>
  </div>
</template>
<style scoped>
.creative-knowledge{display:inline-block}button{min-height:44px;min-width:44px;padding:9px 12px;border:1px solid #bed4c4;border-radius:12px;color:#315f4f;background:#edf5e9;cursor:pointer;font-size:13px}button:disabled{opacity:.5}dialog{width:min(1000px,calc(100vw - 24px));max-height:calc(100dvh - 24px);padding:20px;border:1px solid #bfd8c8;border-radius:24px;background:#f6faef;color:#345c4b;overflow:auto;overscroll-behavior:contain}dialog::backdrop{background:#183c49a6}header{display:flex;align-items:center;justify-content:space-between;gap:16px}header small{font-size:11px;color:#7d927a}h2{font-size:26px;margin:7px 0}.your-feature{display:flex;align-items:center;gap:18px;background:#e2f0e2;padding:14px;border-radius:18px;margin:14px 0}.your-feature :deep(.part-thumb){width:130px;height:95px;flex-shrink:0}.your-feature p,footer p{font-size:13px;line-height:1.8}.mouth-examples{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}footer{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 0 0}footer button{flex-shrink:0;background:#f7d68d}@media(max-width:600px){dialog{padding:12px}.mouth-examples{grid-template-columns:1fr}.your-feature{gap:8px;padding:10px}.your-feature :deep(.part-thumb){width:90px}footer{flex-direction:column;align-items:stretch}h2{font-size:21px}}
</style>
<style scoped>
.topic-tabs{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.topic-tabs button[aria-pressed=true]{background:#315f4f;color:white}.example-actions{display:flex;flex-wrap:wrap;gap:6px;padding:10px 0}.example-actions button{flex:1;min-height:48px}.your-feature button{min-height:48px}footer details{flex:1}footer summary{min-height:48px;display:flex;align-items:center;cursor:pointer;font-size:13px}.is-borrowing{padding:0;height:min(820px,calc(100dvh - 24px));overflow:hidden}.is-borrowing header{height:98px;padding:14px 20px}.creative-reference{display:flex;align-items:center;gap:10px;background:#eef5e4;border:1px solid #ccdcbf;border-radius:16px;padding:8px 12px;margin:8px 0}.creative-reference img{width:85px;height:60px;object-fit:contain}.creative-reference div{flex:1;min-width:0}.creative-reference strong{font-size:14px}.creative-reference p{font-size:12px;line-height:1.5;margin:3px 0}.creative-reference button{min-height:48px;flex-shrink:0}
@media(max-width:600px){.is-borrowing header{height:80px;padding:10px 12px}.creative-reference{gap:6px;flex-wrap:wrap}.creative-reference img{width:65px}.creative-reference button{padding:7px 9px}.creative-reference div{min-width:110px}.topic-tabs button{flex:1;min-width:70px;min-height:48px}footer details{width:100%}}
@media(min-width:601px) and (max-width:850px), (min-width:601px) and (max-height:850px){.is-borrowing header{height:86px}}
</style>
