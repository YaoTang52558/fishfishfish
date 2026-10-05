<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { habitats } from '../catalog/habitats.ts';
import { speciesById, speciesFor } from '../catalog/species.ts';
import type { Discovery } from '../domain/backup.ts';
import {
  baits, biteWindow, clueNames, createEncounter, createFishingState, fishingConfig, fishingReducer, safeZone, spots, stepEncounter,
  suggestAssist, tensionLabel, type BaitId, type CastSpot, type EncounterState, type FishingEvent, type FishingState,
} from '../domain/fishing.ts';
import { seededRandom } from '../domain/fish.ts';
import { createId } from '../domain/id.ts';
import { fixedSteps, SIM_STEP } from '../domain/swim.ts';
import type { HabitatId, OriginalFish } from '../domain/types.ts';
import { usePreferences } from '../features/preferences.ts';
import { playCue, suspendAudio } from '../features/sound.ts';
import { openDatabase, toStorageError } from '../storage/db.ts';
import { loadAssets, loadProfile, recordCapture } from '../storage/repository.ts';
import CatchCard from '../components/CatchCard.vue';
import FishingScene, { type PassingFish } from '../components/FishingScene.vue';
import PageHeading from '../components/PageHeading.vue';

const route = useRoute();
const router = useRouter();
const prefs = usePreferences();
const habitat = computed(() => habitats.find((item) => item.id === route.params.habitatId) ?? null);
const habitatId = computed(() => (habitat.value?.id ?? 'reef-edge') as HabitatId);
const pool = computed(() => speciesFor(habitatId.value));
const state = shallowRef<FishingState>(createFishingState(Math.floor(Math.random() * 2 ** 31), prefs.assistMode.value));
const bait = ref<BaitId>('shrimp');
const capture = shallowRef<{ attemptId: string; status: 'saving' | 'saved' | 'failed'; error?: string; discovery: Discovery | null; first: boolean } | null>(null);
const message = ref('');
let db: IDBDatabase | null = null;
let frame = 0, last: number | null = null, accumulator = 0;

// —— 原创鱼偶遇：独立随机流，与物种抽样无关 ——
let encounterRandom = seededRandom(Math.floor(Math.random() * 2 ** 31));
const encounter = shallowRef<EncounterState>(createEncounter());
const encounterFish = shallowRef<OriginalFish[]>([]);
const passing = shallowRef<PassingFish | null>(null);
let passingBitmaps: ImageBitmap[] = [];

const dispatch = (event: FishingEvent) => { state.value = fishingReducer(state.value, event, pool.value, habitatId.value); };
const species = computed(() => state.value.speciesId ? speciesById(state.value.speciesId) : null);
const tension = computed(() => tensionLabel(state.value));
const zone = computed(() => safeZone(state.value.assist));
const remaining = computed(() => Math.max(0, Math.ceil(fishingConfig.fightTimeout - state.value.fight.time)));
const biteLeft = computed(() => Math.max(0, biteWindow(state.value.assist) - state.value.phaseTime));
const escapeText: Record<string, string> = {
  early: '浮漂还没动就提竿啦，鱼还没咬钩。等浮漂往下沉、出现“!”再提。',
  missed: '鱼咬了一下又游走了。看到“!”时尽快提竿。',
  break: '线拉得太紧，断开了。张力进入“太紧”时先松开一下。',
  timeout: '这条鱼太能坚持了，它游走了。保持在“正好”的区间收线，会更快。',
};

function cast(spot: CastSpot) {
  if (state.value.phase !== 'setup') return;
  message.value = '';
  dispatch({ type: 'cast', spot, bait: bait.value, attemptId: createId(), seed: Math.floor(Math.random() * 2 ** 31) });
  if (state.value.error === 'no-candidates') message.value = '这片水域暂时没有可以钓的鱼（内容还没准备好）。';
}
function pull() { dispatch({ type: 'pull' }); }
function reel(on: boolean) { if (state.value.phase === 'fighting' && state.value.fight.reeling !== on) dispatch({ type: 'reel', on }); }
function onReelDown(event: PointerEvent) {
  if (!event.isPrimary) return;
  event.preventDefault();
  // 不捕获指针：手指或鼠标滑出按钮就放线（F-04），松开、取消触摸同样放线。
  reel(true);
}
/** 抬起、取消触摸、指针离开按钮都立即放线。 */
function onReelUp() { reel(false); }
function release() {
  dispatch({ type: 'release' });
  message.value = species.value ? `「${species.value.commonNameZh}」游回了大海。` : '';
  dispatch({ type: 'retry', clueSeed: Math.floor(Math.random() * 2 ** 31) });
  capture.value = null;
}
function retry() { dispatch({ type: 'retry', clueSeed: Math.floor(Math.random() * 2 ** 31) }); message.value = ''; }
function inspire() { if (species.value) void router.push({ path: '/create', query: { inspire: species.value.id } }); }

async function saveCapture() {
  const s = state.value;
  if (!s.attemptId || !s.speciesId) return;
  capture.value = { attemptId: s.attemptId, status: 'saving', discovery: null, first: false };
  try {
    db ??= await openDatabase();
    const result = await recordCapture(db, s.attemptId, s.speciesId);
    if (capture.value?.attemptId === s.attemptId) capture.value = { attemptId: s.attemptId, status: 'saved', discovery: result.discovery, first: result.firstDiscovery };
  } catch (cause) {
    // 记录失败不丢本轮结果：卡片仍显示，可以重试。
    if (capture.value?.attemptId === s.attemptId) capture.value = { attemptId: s.attemptId, status: 'failed', error: toStorageError(cause).message, discovery: null, first: false };
  }
}

watch(() => state.value.phase, (phase, previous) => {
  const sound = prefs.soundEnabled.value;
  if (phase === 'bite') playCue('bite', sound);
  if (phase === 'fighting' && previous === 'bite') playCue('hook', sound);
  if (phase === 'caught') { playCue('catch', sound); void saveCapture(); }
  if (phase === 'escaped') playCue('escape', sound);
});
watch(prefs.assistMode, (on) => dispatch({ type: 'setAssist', on }));
watch(habitatId, () => {
  dispatch({ type: 'cancel' });
  state.value = createFishingState(Math.floor(Math.random() * 2 ** 31), prefs.assistMode.value);
  capture.value = null; message.value = '';
  resetEncounter();
  void loadEncounterFish();
});

function resetEncounter() {
  encounter.value = createEncounter(); passing.value = null;
  for (const bitmap of passingBitmaps) bitmap.close();
  passingBitmaps = [];
  encounterRandom = seededRandom(Math.floor(Math.random() * 2 ** 31));
}
async function loadEncounterFish() {
  try {
    db ??= await openDatabase();
    encounterFish.value = (await loadProfile(db)).fish.filter((fish) => fish.preferredHabitat === habitatId.value);
  } catch { encounterFish.value = []; }
}
async function showPassing(fishId: string) {
  const fish = encounterFish.value.find((item) => item.id === fishId);
  if (!fish || !db) return;
  const blobs = await loadAssets(db, [fish.design.paint.colorAssetId, fish.design.paint.glowAssetId]).catch(() => new Map<string, Blob>());
  const decode = async (id: string | null) => { const blob = id ? blobs.get(id) : undefined; if (!blob) return null; const bitmap = await createImageBitmap(blob); passingBitmaps.push(bitmap); return bitmap; };
  passing.value = { name: fish.name, design: fish.design, color: await decode(fish.design.paint.colorAssetId), glow: await decode(fish.design.paint.glowAssetId), revision: fish.revision };
}

function tick(now: number) {
  frame = requestAnimationFrame(tick);
  const steps = fixedSteps(accumulator, last === null ? 0 : (now - last) / 1000);
  last = now; accumulator = steps.accumulator;
  for (let i = 0; i < steps.steps; i += 1) {
    dispatch({ type: 'tick', dt: SIM_STEP });
    const before = encounter.value.shown;
    encounter.value = stepEncounter(encounter.value, state.value, SIM_STEP, encounterFish.value.map((fish) => fish.id), encounterRandom);
    if (!before && encounter.value.shown && encounter.value.fishId) void showPassing(encounter.value.fishId);
  }
}
/** 切到后台：暂停整个模拟和音频，放开收线；回来时不补算后台时长。 */
function onVisibility() {
  if (document.hidden) { reel(false); if (frame) cancelAnimationFrame(frame); frame = 0; suspendAudio(); }
  else if (!frame) { last = null; accumulator = 0; frame = requestAnimationFrame(tick); }
}
function isTyping(target: EventTarget | null) { return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement; }
function onKeyDown(event: KeyboardEvent) {
  if (isTyping(event.target) || (event.key !== ' ' && event.key !== 'Enter')) return;
  const phase = state.value.phase;
  if (phase === 'bite' || phase === 'waiting') { event.preventDefault(); if (!event.repeat) pull(); }
  else if (phase === 'fighting') { event.preventDefault(); if (!event.repeat) reel(true); }
}
function onKeyUp(event: KeyboardEvent) { if (event.key === ' ' || event.key === 'Enter') reel(false); }
function onBlur() { reel(false); }

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); window.addEventListener('blur', onBlur);
  if (!document.hidden) frame = requestAnimationFrame(tick);
  void loadEncounterFish();
});
onBeforeUnmount(() => {
  // 离开页面取消未完成的一轮；已记录的发现不受影响。
  dispatch({ type: 'cancel' });
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur);
  if (frame) cancelAnimationFrame(frame);
  resetEncounter(); db?.close();
});
</script>

<template>
  <PageHeading eyebrow="海洋探索 / GO FISHING" title="和海洋，打个招呼。" description="选好鱼饵，点一个落点抛竿。不用先创造鱼，也可以从这里开始。" />
  <div class="habitat-links" aria-label="选择钓场"><RouterLink v-for="item in habitats" :key="item.id" :to="`/fishing/${item.id}`">{{ item.name }}</RouterLink></div>
  <p v-if="message" class="session-notice" role="status">{{ message }}</p>
  <div v-if="habitat" class="fishing-layout fishing-layout--live">
    <section class="fishing-stage" aria-label="钓场">
      <FishingScene :state="state" :tone="habitat.tone" :passing="passing" :reduced-motion="prefs.reducedMotion.value" @spot="cast" @greet="message = `「${passing?.name}」向你摆了摆尾巴：你好呀！原创鱼只是路过，不会被钓走。`" />
      <div class="fishing-controls" aria-live="polite">
        <template v-if="state.phase === 'setup'">
          <fieldset class="part-group"><legend>选鱼饵</legend>
            <div class="target-grid"><button v-for="item in baits" :key="item.id" class="chip-button" :class="{ selected: bait === item.id }" :aria-pressed="bait === item.id" @click="bait = item.id">{{ item.name }}</button></div>
          </fieldset>
          <fieldset class="part-group"><legend>点一个落点抛竿</legend>
            <div class="spot-grid"><button v-for="item in spots" :key="item.id" class="button" @click="cast(item.id)">抛到{{ item.name }}<small>{{ clueNames[state.clues[item.id]] }}</small></button></div>
          </fieldset>
          <p class="tool-hint">气泡和鱼影是线索：不同的鱼喜欢不同的地方和鱼饵（游戏设定）。</p>
        </template>
        <div v-else-if="state.phase === 'casting'" class="phase-box"><p>抛竿中…</p></div>
        <div v-else-if="state.phase === 'waiting'" class="phase-box">
          <p>耐心等一等，浮漂往下沉、出现“!”时再提竿。</p>
          <button class="button button--muted" @click="pull">提竿</button>
        </div>
        <div v-else-if="state.phase === 'bite'" class="phase-box phase-box--bite" role="alert">
          <p><strong>咬钩了！快提竿！</strong>（还剩 {{ biteLeft.toFixed(1) }} 秒）</p>
          <button class="button button--big" @click="pull">提竿</button>
          <p class="tool-hint">键盘：按空格或回车。</p>
        </div>
        <div v-else-if="state.phase === 'fighting'" class="phase-box">
          <div class="meter" role="meter" aria-label="张力" :aria-valuenow="Math.round(state.fight.tension * 100)" aria-valuemin="0" aria-valuemax="100" :aria-valuetext="tension.text">
            <div class="meter-zones"><span :style="{ width: `${zone[0] * 100}%` }">松</span><span :style="{ width: `${(zone[1] - zone[0]) * 100}%` }">正好</span><span>紧</span></div>
            <div class="meter-marker" :style="{ left: `${state.fight.tension * 100}%` }" />
          </div>
          <p class="tension-text" :class="`tension--${tension.zone}`"><strong>张力：{{ tension.text }}</strong></p>
          <div class="progress" role="progressbar" aria-label="收线进度" :aria-valuenow="Math.round(state.fight.progress * 100)" aria-valuemin="0" aria-valuemax="100">
            <div :style="{ width: `${state.fight.progress * 100}%` }" />
          </div>
          <p class="tool-hint">收线进度 {{ Math.round(state.fight.progress * 100) }}% · 还有 {{ remaining }} 秒</p>
          <button class="button button--big reel-button" :class="{ 'is-reeling': state.fight.reeling }" :aria-pressed="state.fight.reeling"
            @pointerdown="onReelDown" @pointerup="onReelUp" @pointercancel="onReelUp" @pointerleave="onReelUp" @contextmenu.prevent>
            {{ state.fight.reeling ? '收线中…松开就放线' : '按住收线' }}
          </button>
          <p class="tool-hint">按住收线，松开放线；连续点按没有用。键盘：按住空格或回车。</p>
        </div>
        <div v-else-if="state.phase === 'escaped'" class="phase-box">
          <p>{{ escapeText[state.escape ?? 'missed'] }}</p>
          <button class="button" @click="retry">再来一次</button>
        </div>
        <div v-if="suggestAssist(state) && state.phase !== 'fighting'" class="effect-box" role="status">
          <p>有点难？可以打开<strong>辅助模式</strong>：提竿时间更长，“正好”的区间更宽，发现的鱼一样记入图鉴。</p>
          <button class="button button--muted" @click="prefs.update({ assistMode: true })">打开辅助模式</button>
        </div>
        <label class="assist-toggle"><input type="checkbox" :checked="prefs.assistMode.value" @change="prefs.update({ assistMode: ($event.target as HTMLInputElement).checked })"> 辅助模式</label>
      </div>
    </section>
    <aside class="fishing-side" aria-label="钓到的鱼">
      <CatchCard v-if="state.phase === 'caught' && species && capture" :species="species" :discovery="capture.discovery" :first-discovery="capture.first"
        :save-state="capture.status" :save-error="capture.error" @release="release" @retry="saveCapture" @inspire="inspire" />
      <section v-else class="empty-panel">
        <p class="eyebrow">虚构水域</p><h2>{{ habitat.name }}</h2><p>{{ habitat.description }}</p>
        <p class="tool-hint">这里的鱼都是真实存在的物种；钓场本身是虚构的，钓到后会放生。</p>
        <RouterLink to="/journal" class="text-link">看看海洋发现</RouterLink>
      </section>
    </aside>
  </div>
</template>
