<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import AppIcon from './AppIcon.vue';
import { claimVoice, registerVoiceStop, releaseVoice, stopNarration } from '../features/voice.ts';
import FishBorrowPreview from './FishBorrowPreview.vue';
import type { FishDesign } from '../domain/types.ts';
import type { PaintLayer } from '../features/editor/paintLayer.ts';
import { fishRecipe, type BorrowKind } from '../features/inspiration/recipes.ts';
import {
  contentAsset, loadObservationContent, observationFish, observationGroups,
  type ObservationContent, type ObservationFish, type ObservationGroup, type ObservationPoint,
} from '../features/inspiration/content.ts';

const props = defineProps<{ design: FishDesign; color?: PaintLayer | null; glow?: PaintLayer | null; paintTick?: number; disabled?: boolean; initialId?: string }>();
const emit = defineEmits<{ opened: []; closed: []; applied: [design: FishDesign, label: string] }>();
const borrowing = ref<BorrowKind | null>(null);
const recipe = computed(() => selected.value ? fishRecipe(selected.value.id) : null);
const dialog = ref<HTMLDialogElement>();
const openButton = ref<HTMLButtonElement>();
const player = ref<HTMLAudioElement>();
const content = shallowRef<ObservationContent | null>(null);
const selected = shallowRef<ObservationFish | null>(null);
const companion = shallowRef<{ fish: ObservationFish; point: ObservationPoint | null } | null>(null);
const group = ref<ObservationGroup>('starter');
const currentPoint = shallowRef<ObservationPoint | null>(null);
const loading = ref(false), loadError = ref(false), audioError = ref(false), isOpen = ref(false);
const playing = ref<string | null>(null);
const spoken = ref('点一下小喇叭，听听它。');
const visibleFish = computed(() => observationFish(content.value?.fish ?? [], group.value));
const sourceLinks = computed(() => content.value?.sources.filter(s => selected.value?.sourceIds.includes(s.id)) ?? []);
const facts = computed(() => content.value?.claims.filter(c => selected.value?.factIds.includes(c.id)) ?? []);
const previewIds = ['amphiprion-ocellaris', 'epinephelus-merra', 'scarus-ghobban'];
const physicalPoints = new Set(['BANDS', 'FINS', 'MOUTH', 'SPOT', 'PATTERN', 'RINGS', 'TAIL', 'BODY', 'FIN', 'NOSE', 'DOTS', 'COLOR']);
const pins = computed(() => selected.value?.points.flatMap((point, index) => physicalPoints.has(point.key) && point.x !== null && point.y !== null ? [{ point, index }] : []) ?? []);
const specimenStyle = computed(() => selected.value?.id === 'hippocampus-kuda' ? { aspectRatio: '2 / 3', '--art-width': '176px', '--art-ratio': '0.6666667' }
  : selected.value?.id === 'mobula-birostris' ? { aspectRatio: '1', '--art-width': '264px', '--art-ratio': '1' } : { aspectRatio: '3 / 2', '--art-width': '480px', '--art-ratio': '1.5' });
let playTicket = 0, alive = true, previousOverflow = '';
const unregisterVoice = registerVoiceStop(stopAudio);

function stopAudio() {
  playTicket++;
  player.value?.pause();
  if (player.value) player.value.currentTime = 0;
  playing.value = null; releaseVoice(player.value);
}
function play(file: string, text: string, key: string) {
  stopAudio();
  const audio = player.value;
  if (!audio) return;
  claimVoice(audio);
  const ticket = ++playTicket;
  audioError.value = false; spoken.value = text; playing.value = key;
  audio.src = contentAsset(file);
  // A deliberate tap plays the explanation even when automatic game effects are muted.
  void audio.play().catch(() => {
    if (!alive || ticket !== playTicket) return;
    stopAudio(); audioError.value = true;
  });
}
function hearIntro() {
  const fish = selected.value;
  if (fish) { currentPoint.value = null; play(fish.introAudio, fish.intro[0], 'intro'); }
}
function hearPoint(point: ObservationPoint) {
  currentPoint.value = point; play(point.audio, point.text, point.key);
}
function hearCompanion() {
  const item = companion.value;
  if (item) play(item.point?.audio ?? item.fish.introAudio, item.point?.text ?? item.fish.intro[0], 'companion');
}
function choose(fish: ObservationFish) {
  stopAudio(); selected.value = fish; currentPoint.value = null; audioError.value = false;
  spoken.value = '点一下小喇叭，听听它。';
}
function changeGroup(next: ObservationGroup) {
  stopAudio(); group.value = next;
  if (!visibleFish.value.some(f => f.id === selected.value?.id) && visibleFish.value[0]) choose(visibleFish.value[0]);
}
async function load() {
  if (loading.value) return;
  loading.value = true; loadError.value = false;
  try {
    const result = await loadObservationContent();
    if (!alive) return;
    content.value = result;
    if (props.initialId && !selected.value) { const idea = result.fish.find(f => f.id === props.initialId); if (idea) { group.value = 'all'; choose(idea); } }
    if (!selected.value && visibleFish.value[0]) choose(visibleFish.value[0]);
  } catch { if (alive) loadError.value = true; }
  finally { if (alive) loading.value = false; }
}
function open() {
  if (!dialog.value || dialog.value.open || props.disabled) return;
  stopNarration();
  if (companion.value) {
    const idea = companion.value;
    if (!visibleFish.value.some(f => f.id === idea.fish.id)) group.value = idea.fish.group === 'grouper' ? 'grouper' : 'all';
    choose(idea.fish); currentPoint.value = idea.point;
  }
  dialog.value.showModal();
  previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
  isOpen.value = true; emit('opened');
  if (!content.value) void load();
}
function close() { dialog.value?.close(); }
async function onClose() {
  stopAudio();
  borrowing.value = null;
  if (!isOpen.value) return;
  document.body.style.overflow = previousOverflow; isOpen.value = false; emit('closed');
  await nextTick(); if (alive) openButton.value?.focus({ preventScroll: true });
}
function keepIdea() {
  if (selected.value) companion.value = { fish: selected.value, point: currentPoint.value };
  close();
}
async function tryBorrow(kind: BorrowKind) {
  stopAudio(); borrowing.value = kind;
  await nextTick(); dialog.value?.querySelector<HTMLButtonElement>('.borrow-compare')?.focus();
}
async function cancelBorrow() {
  stopAudio(); const previous = borrowing.value; borrowing.value = null;
  await nextTick(); dialog.value?.querySelector<HTMLButtonElement>(`[data-borrow="${previous}"]`)?.focus();
}
function applyBorrow(next: FishDesign, kind: BorrowKind) {
  if (!selected.value) return;
  emit('applied', next, `借${selected.value.name}的${kind === 'colors' ? '颜色' : '花纹'}`);
  keepIdea();
}
function hearFeature(kind: BorrowKind) {
  if (playing.value) { stopAudio(); return; }
  const fish = selected.value;
  if (!fish) return;
  const point = kind === 'pattern' ? fish.points.find(p => ['BANDS', 'SPOT', 'PATTERN', 'DOTS'].includes(p.key)) : fish.points.find(p => p.key === 'COLOR');
  if (point) hearPoint(point); else hearIntro();
}
function onVisibility() { if (document.hidden) stopAudio(); }
let initialOpened = false;
function openInitial() { if (props.initialId && !props.disabled && !initialOpened) { initialOpened = true; open(); } }
watch(() => props.disabled, disabled => { if (disabled) stopAudio(); else openInitial(); });
onMounted(() => { document.addEventListener('visibilitychange', onVisibility); window.addEventListener('pagehide', stopAudio); void nextTick(openInitial); });
onBeforeUnmount(() => {
  alive = false; stopAudio();
  unregisterVoice();
  if (isOpen.value) document.body.style.overflow = previousOverflow;
  player.value?.removeAttribute('src'); player.value?.load();
  document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('pagehide', stopAudio);
});
</script>

<template>
  <div class="fish-inspiration">
  <div class="inspiration-entry" :class="{ 'has-companion': companion }">
    <div v-if="companion" class="companion-art"><img :src="contentAsset(companion.fish.image)" :alt="`${companion.fish.name}的观察参考`"></div>
    <div v-else class="inspiration-peek" aria-hidden="true"><img v-for="id in previewIds" :key="id" :src="contentAsset(`illustrations/${id}.webp`)" alt=""></div>
    <div class="inspiration-entry-copy">
      <strong>{{ companion ? companion.fish.name : '海洋朋友，给你一点灵感' }}</strong>
      <p>{{ companion ? (companion.point?.label ?? '想怎么画，都可以。') : '看看颜色、嘴巴和花纹。' }}</p>
    </div>
    <div class="inspiration-entry-actions">
      <button v-if="companion" class="inspiration-sound" :aria-label="playing === 'companion' ? '停止声音' : `听听${companion.fish.name}${companion.point ? '的' + companion.point.label : ''}`" @click="playing === 'companion' ? stopAudio() : hearCompanion()"><span aria-hidden="true">{{ playing === 'companion' ? '■' : '🔊' }}</span></button>
      <button ref="openButton" class="inspiration-open" :disabled="disabled" aria-haspopup="dialog" :aria-expanded="isOpen" @click="open"><AppIcon name="fish" />{{ companion ? '再看看' : '看看鱼' }}</button>
    </div>
    <p v-if="audioError && !isOpen" class="inspiration-entry-error" role="status">声音没播出来，可以再点一下。</p>
  </div>

  <Teleport to="body"><dialog ref="dialog" class="inspiration-dialog" aria-labelledby="inspiration-title" @close="onClose" @cancel.prevent="close">
    <header class="inspiration-heading"><div><p>看一看，再自由地画</p><h2 id="inspiration-title">海里的灵感</h2></div><button class="inspiration-close" autofocus @click="close"><span aria-hidden="true">✕</span> 继续画</button></header>
    <FishBorrowPreview v-if="borrowing && selected && recipe" :key="selected.id" :design="design" :fish="selected" :recipe="recipe" :kind="borrowing" :color="color" :glow="glow" :paint-tick="paintTick" :playing="!!playing" :audio-status="audioError ? '声音没播出来，可以再点一下。' : playing ? spoken : ''" @apply="applyBorrow" @cancel="cancelBorrow" @hear="hearFeature" />
    <div v-else-if="loading || loadError" class="inspiration-loading" role="status"><AppIcon name="fish" /><p>{{ loadError ? '海洋朋友还没游过来。' : '海洋朋友游过来啦…' }}</p><button v-if="loadError" class="button" @click="load">再试一次</button></div>
    <div v-else-if="selected" class="inspiration-body">
      <aside class="inspiration-library" aria-label="选择海洋伙伴">
        <div class="inspiration-groups" role="group" aria-label="海洋朋友分类"><button v-for="item in observationGroups" :key="item.id" :data-inspiration-group="item.id" :aria-pressed="group === item.id" @click="changeGroup(item.id)"><span aria-hidden="true">{{ item.icon }}</span>{{ item.label }}</button></div>
        <div class="inspiration-fish-list"><button v-for="fish in visibleFish" :key="fish.id" :data-inspiration-fish="fish.id" :aria-pressed="selected.id === fish.id" :aria-label="`看看${fish.name}`" @click="choose(fish)"><img :src="contentAsset(fish.image)" alt="" loading="lazy"><span>{{ fish.name }}</span></button></div>
      </aside>
      <section class="inspiration-observation" :aria-label="`${selected.name}的观察卡`">
        <div class="inspiration-fish-heading"><div><span>真实伙伴 · 观察插画</span><h3>{{ selected.name }}</h3></div><div class="inspiration-top-audio"><button class="inspiration-listen" :class="{ playing: playing === 'intro' }" @click="hearIntro"><span aria-hidden="true">🔊</span> 听听它</button><button class="inspiration-stop" :disabled="!playing" aria-label="停止声音" @click="stopAudio">■</button></div></div>
        <div class="inspiration-specimen-well"><div class="inspiration-specimen" :style="specimenStyle"><img :src="contentAsset(selected.image)" :alt="`${selected.name}的原创外形示意图`"><button v-for="pin in pins" :key="pin.point.key" class="inspiration-pin" :class="{ active: playing === pin.point.key }" :style="{ left: `${pin.point.x! * 100}%`, top: `${pin.point.y! * 100}%` }" :aria-label="`观察点 ${pin.index + 1}，听听${pin.point.label}`" @click="hearPoint(pin.point)">{{ pin.index + 1 }}</button></div></div>
        <div class="inspiration-points"><button v-for="(point, index) in selected.points" :key="point.key" :class="{ active: currentPoint?.key === point.key }" :aria-pressed="currentPoint?.key === point.key" @click="hearPoint(point)"><span class="point-number">{{ index + 1 }}</span><span>{{ point.label }}</span><span aria-hidden="true">🔊</span></button></div>
        <div class="inspiration-spoken" role="status"><span aria-hidden="true">♪</span><p>{{ audioError ? '声音没播出来，可以再点一下。' : spoken }}</p></div>
        <div class="inspiration-invite"><AppIcon name="brush" /><p>{{ selected.invite }}</p></div>
        <details :key="selected.id" class="inspiration-parent"><summary>和家长一起看</summary><h4>{{ selected.formalName }} · {{ selected.scientificName }}</h4><p>{{ selected.parent }}</p><ul><li v-for="fact in facts" :key="fact.id">{{ fact.text }}</li></ul><p class="source-date">来源查阅：{{ content?.date }} · 图片为原创观察示意</p><a v-for="source in sourceLinks" :key="source.id" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.institution }}：{{ source.title }} ↗</a></details>
      </section>
    </div>
    <footer v-if="selected && !loading && !loadError && !borrowing" class="inspiration-dialog-footer"><div class="inspiration-borrow-actions"><button v-if="recipe" data-borrow="colors" @click="tryBorrow('colors')">🎨 试试颜色</button><button v-if="recipe?.pattern" data-borrow="pattern" @click="tryBorrow('pattern')">▧ 试试花纹</button></div><button class="inspiration-return" @click="keepIdea"><AppIcon name="brush" />继续自由画<AppIcon name="arrow" /></button></footer>
  </dialog></Teleport>
  <audio ref="player" preload="none" @ended="playing = null; releaseVoice(player)"></audio>
  </div>
</template>

<style scoped>
.inspiration-entry{display:flex;align-items:center;gap:14px;padding:12px 16px;background:#edf3e9;border-bottom:1px solid #dce7d8;flex-wrap:wrap;color:#254f45}
.inspiration-peek{display:flex;width:132px;flex-shrink:0;align-items:center}.inspiration-peek img{width:58px;height:48px;object-fit:contain;margin-left:-17px}.inspiration-peek img:first-child{margin-left:0}.inspiration-entry-copy{flex:1;min-width:140px}.inspiration-entry-copy strong{font-size:14px}.inspiration-entry-copy p{font-size:12px;color:#687b70;margin-top:2px}.inspiration-entry-actions{display:flex;gap:7px;align-items:center}.inspiration-open,.inspiration-sound{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;border-radius:14px;border:1px solid #bdcec1;background:#fffdf7;color:#24594c;padding:9px 14px;font-size:14px;font-weight:650}.inspiration-open:hover{background:#dfeedd}.inspiration-sound{min-width:48px;padding:8px}.companion-art{width:106px;flex-shrink:0}.companion-art img{display:block;width:100%;height:78px;object-fit:contain}.inspiration-entry-error{width:100%;font-size:12px}
.inspiration-dialog{width:calc(100% - 48px);max-width:1120px;height:min(820px,calc(100dvh - 48px));max-height:calc(100dvh - 48px);border:1px solid #c9d7cb;border-radius:28px;padding:0;background:#faf8ef;color:#243d38;overflow:hidden}.inspiration-dialog::backdrop{background:#102f3cd6}.inspiration-heading{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:20px 26px;border-bottom:1px solid #dfe5d9;height:98px;background:#fffdf7}.inspiration-heading p{font-size:12px;letter-spacing:.06em;color:#718373}.inspiration-heading h2{font-size:27px;margin-top:2px}.inspiration-close{min-height:48px;flex-shrink:0;border:1px solid #d7dfd0;border-radius:14px;background:#edf2e7;color:#335b4e;padding:10px 17px;font-size:15px;font-weight:650}.inspiration-body{display:grid;grid-template-columns:285px minmax(0,1fr);height:calc(100% - 98px);min-height:0}.inspiration-library{display:flex;flex-direction:column;min-height:0;border-right:1px solid #dce4d7;background:#f1f2e7;padding:16px}.inspiration-groups{display:flex;gap:4px;background:#e3e9dc;padding:4px;border-radius:15px;flex-shrink:0}.inspiration-groups button{flex:1;min-width:0;min-height:50px;border:0;border-radius:11px;background:transparent;color:#677b68;display:flex;align-items:center;justify-content:center;gap:5px;font-size:12px;font-weight:650;padding:6px 4px}.inspiration-groups button[aria-pressed=true]{background:#fffdf7;color:#225b4d;box-shadow:0 2px 6px #214b3812}.inspiration-fish-list{overflow-y:auto;overscroll-behavior:contain;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-content:start;gap:9px;min-height:0;margin-top:16px;padding:3px 3px 12px;scrollbar-width:thin}.inspiration-fish-list button{min-width:0;border:2px solid transparent;background:#e7ecdf;border-radius:17px;padding:8px 5px 9px;color:#526956;font-size:12px;min-height:113px}.inspiration-fish-list button[aria-pressed=true]{border-color:#3e8570;background:#fffdf7;color:#1b5447}.inspiration-fish-list button:hover{background:#f8fbf1}.inspiration-fish-list img{display:block;width:100%;height:72px;object-fit:contain;margin-bottom:3px}.inspiration-observation{overflow-y:auto;overscroll-behavior:contain;padding:20px 26px 22px;min-width:0;scrollbar-width:thin}.inspiration-fish-heading{display:flex;justify-content:space-between;gap:16px;align-items:center}.inspiration-fish-heading span:not(button span){font-size:11px;color:#7b8c7c}.inspiration-fish-heading h3{font-size:29px;margin-top:3px;line-height:1.35}.inspiration-listen{display:flex;align-items:center;justify-content:center;gap:8px;min-height:48px;border:0;border-radius:15px;padding:9px 16px;background:#245e55;color:#fff;font-size:14px;flex-shrink:0}.inspiration-listen:hover,.inspiration-listen.playing{background:#377c6b}.inspiration-specimen-well{display:flex;justify-content:center;align-items:center;background:radial-gradient(ellipse at center,#f1f6ee,#e2ece4);border-radius:22px;min-height:270px;margin:16px 0 15px;padding:10px}.inspiration-specimen{position:relative;width:100%;flex-shrink:0}.inspiration-specimen>img{width:100%;height:100%;object-fit:contain;display:block}.inspiration-pin{position:absolute;transform:translate(-50%,-50%);width:46px;height:46px;border:2px solid #c79240;border-radius:50%;background:#fff1c9eb;color:#83581b;font-size:15px;font-weight:750}.inspiration-pin:hover,.inspiration-pin.active{background:#ffd88e}.inspiration-points{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.inspiration-points button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-width:0;min-height:96px;padding:8px 6px;border:1px solid #dce5d4;border-radius:16px;background:#f4f6ec;color:#466b56;font-size:13px}.inspiration-points button.active{border-color:#75a487;background:#e3efe1}.point-number{display:grid;place-items:center;width:25px;height:25px;background:#e3ead9;border-radius:50%;font-size:12px;font-weight:750}.inspiration-spoken{display:flex;align-items:center;gap:12px;padding:9px 12px;background:#edf3e9;border-radius:14px;margin-top:12px;min-height:57px}.inspiration-spoken>span{font-size:22px;color:#448573}.inspiration-spoken p{font-size:13px;flex:1}.inspiration-spoken button{flex-shrink:0;min-width:44px;min-height:44px;border:0;border-radius:11px;background:#dbe8d8;color:#36614b}.inspiration-spoken button:disabled{opacity:.4}.inspiration-invite{display:flex;gap:10px;align-items:start;padding:14px 3px;color:#96764b;font-size:13px}.inspiration-invite .icon{width:20px;height:20px;margin-top:3px}.inspiration-return{display:flex;align-items:center;justify-content:center;gap:12px;min-height:54px;width:100%;border:0;border-radius:16px;background:#f2cc83;color:#5c4624;font-size:16px;font-weight:750}.inspiration-return:hover{background:#f6d698}.inspiration-return .icon:last-child{width:19px}.inspiration-parent{border-top:1px solid #dfe6d8;margin-top:17px;padding-top:7px;color:#7c8c7b;font-size:12px}.inspiration-parent summary{min-height:44px;cursor:pointer;padding:11px 2px}.inspiration-parent h4{color:#345e4f;font-size:14px;margin:8px 0}.inspiration-parent p,.inspiration-parent li{line-height:1.8}.inspiration-parent a{display:block;padding:8px 0;color:#326c5c;text-decoration:underline;overflow-wrap:anywhere}.source-date{font-size:11px}.inspiration-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;height:calc(100% - 98px);color:#71866f}.inspiration-loading .icon{width:64px;height:64px}.inspiration-loading p{font-size:18px}
@media(max-width:850px){.inspiration-dialog{width:calc(100% - 28px);height:calc(100dvh - 28px);max-height:calc(100dvh - 28px);border-radius:23px}.inspiration-heading{padding:16px 20px;height:86px}.inspiration-heading h2{font-size:25px}.inspiration-body{grid-template-columns:220px minmax(0,1fr);height:calc(100% - 86px)}.inspiration-library{padding:10px}.inspiration-groups button{flex-direction:column;gap:1px;min-height:56px}.inspiration-observation{padding:16px}.inspiration-fish-heading h3{font-size:25px}.inspiration-listen{padding:8px 12px;font-size:13px}.inspiration-specimen-well{min-height:235px}.inspiration-points button{font-size:12px;min-height:97px}.inspiration-peek{width:110px}.inspiration-peek img{width:50px}.inspiration-entry{gap:10px;padding:10px 12px}}
@media(max-width:600px){.inspiration-dialog{width:calc(100% - 16px);height:calc(100dvh - 16px);max-height:calc(100dvh - 16px);border-radius:20px}.inspiration-heading{height:80px;padding:12px 16px}.inspiration-heading h2{font-size:23px}.inspiration-body{display:flex;flex-direction:column;overflow-y:auto;height:calc(100% - 80px)}.inspiration-library{flex-shrink:0;padding:10px 12px;border-right:0;border-bottom:1px solid #dce4d7}.inspiration-groups button{flex-direction:row;min-height:44px}.inspiration-fish-list{display:flex;overflow-x:auto;overflow-y:hidden;margin-top:8px;padding:3px 3px 6px;gap:8px}.inspiration-fish-list button{flex:0 0 98px;min-height:100px}.inspiration-fish-list img{height:58px}.inspiration-observation{overflow:visible;padding:15px;flex-shrink:0}.inspiration-specimen-well{min-height:222px;margin:12px 0}.inspiration-fish-heading h3{font-size:25px}.inspiration-entry-copy{min-width:100px}.inspiration-entry-copy strong{font-size:13px}.inspiration-peek{width:86px}.inspiration-peek img{width:40px;margin-left:-11px}.inspiration-open{padding:8px 10px;font-size:13px}.companion-art{width:70px}.companion-art img{height:65px}.inspiration-entry-actions{margin-left:auto}.inspiration-entry-copy p{font-size:11px}.inspiration-return{font-size:15px}.inspiration-pin{width:44px;height:44px}}
.inspiration-body{height:calc(100% - 182px)}.inspiration-dialog-footer{height:84px;border-top:1px solid #dce4d7;background:#fffdf7;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:14px 24px}.inspiration-dialog-footer p{font-size:13px;color:#7a8d7b}.inspiration-dialog-footer .inspiration-return{width:auto;min-width:290px;padding:10px 20px}
@media(max-width:850px){.inspiration-body{height:calc(100% - 170px)}.inspiration-dialog-footer{padding:14px 18px;gap:12px}.inspiration-dialog-footer .inspiration-return{min-width:265px;font-size:15px}.inspiration-dialog-footer p{font-size:12px;max-width:170px}}
@media(max-width:600px){.inspiration-body{height:calc(100% - 156px)}.inspiration-dialog-footer{height:76px;padding:10px 14px}.inspiration-dialog-footer p{display:none}.inspiration-dialog-footer .inspiration-return{width:100%;min-width:0}}
.inspiration-top-audio{display:flex;gap:7px;align-items:center;flex-shrink:0}.inspiration-stop{min-width:44px;min-height:48px;border:0;border-radius:13px;background:#e3ecde;color:#3e7159}.inspiration-stop:disabled{opacity:.4}.inspiration-specimen{max-width:min(var(--art-width),calc(var(--art-height,320px) * var(--art-ratio)))}
@media(max-height:850px) and (min-width:601px){.inspiration-specimen-well{--art-height:195px;min-height:0;height:215px;margin:12px 0}.inspiration-points button{min-height:85px}.inspiration-heading{height:86px;padding:14px 24px}.inspiration-body{height:calc(100% - 170px)}}
.inspiration-open:disabled{opacity:.45}.inspiration-borrow-actions{display:flex;gap:8px}.inspiration-borrow-actions button{min-height:54px;border:1px solid #aac9b5;border-radius:14px;background:#e4efdf;color:#315f4d;padding:10px 16px;font-size:15px;font-weight:650}.inspiration-dialog-footer .inspiration-return{min-width:200px}.inspiration-borrow-actions button:hover{background:#d4e9d1}
@media(max-width:600px){.inspiration-dialog-footer{gap:6px;padding:10px}.inspiration-borrow-actions{gap:5px;flex:1}.inspiration-borrow-actions button{font-size:12px;padding:8px;flex:1;white-space:nowrap;min-height:52px}.inspiration-dialog-footer .inspiration-return{font-size:12px;min-width:0;width:auto;padding:8px 10px;gap:5px}.inspiration-return .icon{display:none}}
</style>
