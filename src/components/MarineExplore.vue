<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef } from 'vue';
import { contentAsset, loadObservationContent, type ObservationContent } from '../features/inspiration/content.ts';
import { stopNarration, useVoice } from '../features/voice.ts';
import ObservationDetail from './ObservationDetail.vue';
import ReefRelations from './ReefRelations.vue';
const props = defineProps<{ habitat?: string; disabled?: boolean; compact?: boolean }>();
const emit = defineEmits<{ change: [open: boolean] }>();
const dialog = ref<HTMLDialogElement>(), entry = ref<HTMLButtonElement>(), open = ref(false), selection = ref(''), error = ref(false);
const content = shallowRef<ObservationContent | null>(null), voice = useVoice();
const reef = computed(() => props.habitat !== 'coastal-rock');
const nodes = computed(() => reef.value ? [
  { id: 'coral', title: '🪸 珊瑚', image: 'environments/reef-panorama.webp' },
  { id: 'host', title: '🌸 海葵', image: 'illustrations/radianthus-magnifica.webp' },
  { id: 'amphiprion-ocellaris', title: '🐠 小丑鱼的伙伴', image: 'illustrations/amphiprion-ocellaris.webp' },
] : [
  { id: 'hexagrammos-otakii', title: '🥚 守护鱼卵', image: 'illustrations/hexagrammos-otakii.webp' },
  { id: 'sebastiscus-marmoratus', title: '🪨 谁住在礁底', image: 'illustrations/sebastiscus-marmoratus.webp' },
]);
const fish = computed(() => content.value?.fish.find(f => f.id === selection.value));
const ids = computed(() => selection.value === 'coral' ? ['RF-01', 'RF-02', 'RF-03'] : content.value?.host.factIds ?? []);
const facts = computed(() => content.value?.claims.filter(c => ids.value.includes(c.id)) ?? []);
const sources = computed(() => content.value?.sources.filter(s => facts.value.some(c => c.sourceIds.includes(s.id))) ?? []);
let alive = true;
async function load() { error.value = false; try { const data = await loadObservationContent(); if (alive) content.value = data; } catch { if (alive) error.value = true; } }
function show() { if (props.disabled) return; stopNarration(); selection.value = nodes.value[0]!.id; open.value = true; emit('change', true); dialog.value?.showModal(); if (!content.value) void load(); }
async function close() { if (!open.value) return; voice.stop(); open.value = false; emit('change', false); await nextTick(); if (alive) entry.value?.focus({ preventScroll: true }); }
onBeforeUnmount(() => { alive = false; if (open.value) emit('change', false); });
</script>
<template>
  <div class="marine-explore" :class="{ compact }"><button ref="entry" class="explore-entry" :aria-label="compact ? '看海里' : undefined" :disabled="disabled" aria-haspopup="dialog" @click="show">🐚 <span>看海里</span></button>
    <dialog ref="dialog" aria-labelledby="explore-title" @close="close" @cancel.prevent="dialog?.close()"><template v-if="open">
      <header><div><small>随时看看，再回去玩</small><h2 id="explore-title">{{ reef ? '珊瑚浅海的小发现' : '岩礁里的小发现' }}</h2></div><button autofocus @click="dialog?.close()">✕ 返回</button></header>
      <nav aria-label="选择海洋观察对象"><button v-for="n in nodes" :key="n.id" :aria-pressed="selection === n.id" @click="selection = n.id; voice.stop()"><img :src="contentAsset(n.image)" alt="">{{ n.title }}</button></nav>
      <p v-if="error" role="alert">资料暂时打不开。<button @click="load">重试</button></p><p v-else-if="!content" role="status">海洋朋友游过来啦…</p>
      <template v-else><ObservationDetail v-if="fish" :key="fish.id" :fish="fish" :content="content" />
        <section v-else class="object-reading"><img :src="contentAsset(nodes.find(n => n.id === selection)!.image)" :alt="selection === 'coral' ? '珊瑚礁环境示意插画' : '海葵示意插画'"/><h3>{{ selection === 'coral' ? '珊瑚也是动物' : '海葵也有触手' }}</h3><p>{{ selection === 'coral' ? '看看珊瑚有多少种形状。石珊瑚的小动物能建造坚硬的骨骼。' : '它有细长的触手。这里观察的是 Radianthus magnifica，不代表所有海葵都一样。' }}</p><button @click="voice.playing.value ? voice.stop() : voice.play(contentAsset(selection === 'coral' ? 'audio/vo-rf-coral.wav' : content.host.audio))">{{ voice.playing.value ? '■ 停止' : '🔊 听听' }}</button><details><summary>亲子资料与来源</summary><p v-for="fact in facts" :key="fact.id">{{ fact.text }}<small>{{ fact.conditions }}</small></p><a v-for="s in sources" :key="s.id" :href="s.url" target="_blank" rel="noopener noreferrer">{{ s.institution }} · {{ s.title }}</a></details></section>
        <ReefRelations v-if="selection === 'amphiprion-ocellaris'" :content="content" />
        <p class="context-note">这是按主题安排的观察示意，不是当地物种分布复原。观察不会记成钓到，也不会带走野生生物。</p>
      </template>
    </template></dialog>
  </div>
</template>
<style scoped>.marine-explore{display:inline-flex}button{min-width:44px;min-height:44px;padding:10px 13px;border:1px solid #bcd6c7;border-radius:14px;background:#fff8ed;color:#315c50;font:inherit;font-size:13px;cursor:pointer}button[aria-pressed=true]{background:#286956;color:white}dialog{width:min(860px,calc(100vw - 20px));max-height:calc(100dvh - 20px);overflow:auto;padding:20px;border:1px solid #bcd6c7;border-radius:22px;background:#f7faf1;color:#315c50}dialog::backdrop{background:#143c4bb8}header{display:flex;justify-content:space-between;gap:12px;align-items:center}h2{font-size:24px}small,.context-note{font-size:12px;line-height:1.8;display:block}nav{display:flex;gap:10px;margin:15px 0}nav button{flex:1}nav img{display:block;width:100%;height:80px;object-fit:contain}.object-reading>img{width:100%;height:250px;object-fit:contain;background:#d5ebe4;border-radius:18px}.object-reading p{line-height:1.9;font-size:15px}summary,a{display:block;min-height:44px;padding:12px 0;cursor:pointer;font-size:13px;overflow-wrap:anywhere}.context-note{margin-top:18px;color:#637e6d}@media(max-width:480px){dialog{padding:12px}nav{gap:5px}nav button{padding:7px;font-size:11px}h2{font-size:20px}}</style>

<style scoped>@media(max-width:760px){.compact .explore-entry{width:44px;padding:8px}.compact .explore-entry span{display:none}}</style>
