<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';
import { habitats } from '../catalog/habitats';
import { fishingContent } from '../domain/fishing3d/content';
import type { HabitatId } from '../domain/types';
import { roundActive } from '../domain/fishing3d/round';
import FishingScene3D from '../components/FishingScene3D.vue';
import FishingFallbackScene from '../components/FishingFallbackScene.vue';
import FishingControls from '../components/FishingControls.vue';
import FishingReel from '../components/FishingReel.vue';
import FishingVisitor from '../components/FishingVisitor.vue';
import FishingTutorial from '../components/FishingTutorial.vue';
import FishingAmbience from '../components/FishingAmbience.vue';
import MarineExplore from '../components/MarineExplore.vue';
import ContextHelp from '../components/ContextHelp.vue';
import GrowthSettings from '../components/GrowthSettings.vue';
import { helpTopics, helpAudio, type HelpTopic } from '../features/help.ts';
import { useVoice } from '../features/voice.ts';
import type { QualityPreference } from '../features/fishing3d/performance';
import type { PassingFish } from '../components/FishingScene.vue';
import CatchCard from '../components/CatchCard.vue';
import { speciesById } from '../catalog/species';
import { baits, biteWindow, clueNames, spots } from '../domain/fishing';
import type { BaitId, CastSpot } from '../domain/fishing';
import { createId } from '../domain/id';
import { distanceToShore } from '../domain/fishing3d/state';
import { fightHint } from '../domain/fishing3d/simulate';
import { createRoundSession } from '../features/fishing3d/round';
import { createCaptureService } from '../features/fishing3d/capture';
import type { SceneDiagnostics, SceneStatus, SceneTarget } from '../features/fishing3d/runtime';
import { usePreferences } from '../features/preferences';
import { playCue, suspendAudio } from '../features/sound';
import { openDatabase } from '../storage/db';
import { loadAssets, loadProfile, recordCapture } from '../storage/repository';

const prefs = usePreferences(), router = useRouter(), route = useRoute();
const props = withDefaults(defineProps<{ habitatId?: HabitatId }>(), { habitatId: 'reef-edge' });
const habitat = habitats.find(item => item.id === props.habitatId)!;
const session = createRoundSession(fishingContent(props.habitatId), Math.floor(Math.random() * 2 ** 31), prefs.assistMode.value, prefs.challenge.value);
const voice = useVoice(), skipCelebration = ref(false);
const sceneHelp = computed<HelpTopic>(() => state.value.phase === 'setup' || state.value.phase === 'casting' ? 'cast' : ['waiting','bite'].includes(state.value.phase) ? 'bite' : state.value.phase === 'fighting' ? 'fight' : state.value.phase === 'caught' ? 'catch' : 'land');
const baitDetail = computed(() => helpTopics[bait.value]);
const state = shallowRef(session.read());
const passing=shallowRef<PassingFish|null>(null),visitorSeconds=ref(0),greeting=ref('');let visitorStarted=false,dead=false;const bitmaps:ImageBitmap[]=[];
async function loadVisitorFish(){
  try{const db=await openDatabase();try{
    const fish=(await loadProfile(db)).fish.filter(f=>f.preferredHabitat===props.habitatId);if(dead)return;session.visitors(fish.map(f=>f.id));
    const unsubscribeVisitor=session.subscribe(()=>{const e=session.encounter();visitorSeconds.value=e.elapsed;if(e.shown&&!visitorStarted){visitorStarted=true;void show(e.fishId!);}});
    const stop=unsubscribeVisitor;visitorCleanup=stop;
    async function show(id:string){try{const f=fish.find(item=>item.id===id);if(!f||dead)return;const visitorDb=await openDatabase();let assets:Map<string,Blob>;try{assets=await loadAssets(visitorDb,[f.design.paint.colorAssetId,f.design.paint.glowAssetId]);}finally{visitorDb.close();}
      const decode=async(id:string|null)=>{const blob=id?assets.get(id):null;if(!blob)return null;const bitmap=await createImageBitmap(blob);if(dead){bitmap.close();return null;}bitmaps.push(bitmap);return bitmap;};
      const color=await decode(f.design.paint.colorAssetId),glow=await decode(f.design.paint.glowAssetId);if(!dead)passing.value={name:f.name,design:f.design,color,glow,revision:f.revision};
    }catch{/* A missing visitor bitmap never replaces the actual hooked fish. */}}
  }finally{/* Reopen for assets when a visitor is selected; no long-lived database handle. */db.close();}}
  catch{/* No creations or unavailable storage simply means no visitor. */}
}
let visitorCleanup: (()=>void)|undefined;
void loadVisitorFish();
const scene = ref<InstanceType<typeof FishingScene3D>>(), controls = ref<InstanceType<typeof FishingControls>>();
const sceneFrame = ref<HTMLElement>();
const fallbackTargets = shallowRef<SceneTarget[]>([]);
const fullscreen = ref(false), fullscreenError = ref('');
const fullscreenAvailable = typeof document.documentElement.requestFullscreen === 'function';
const onFullscreenChange = () => { fullscreen.value = document.fullscreenElement === sceneFrame.value; };
onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange);
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__fishRound = session;
});
async function toggleFullscreen() {
  try {
    fullscreenError.value = '';
    if (document.fullscreenElement) await document.exitFullscreen();
    else await sceneFrame.value?.requestFullscreen();
  } catch { fullscreenError.value = '这台浏览器暂时无法全屏，可以继续在大画面中玩。'; }
}
const status = ref<SceneStatus>('loading'), paused = ref(false), fallback = ref(false), fallbackReason = ref('');
const tutorialKey = 'fish-fishing-tutorial-v1';
const tutorial = ref((() => { try { return localStorage.getItem(tutorialKey) !== 'dismissed'; } catch { return true; } })());
const helpButton = ref<HTMLButtonElement>();
const helpOpen = ref(false);
const exploring = ref(false);
const gamePaused = computed(() => paused.value || tutorial.value || helpOpen.value || exploring.value);
async function closeTutorial() {
  tutorial.value = false;
  try { localStorage.setItem(tutorialKey, 'dismissed'); } catch { /* Teaching remains available when local preferences cannot be stored. */ }
  await nextTick(); helpButton.value?.focus({ preventScroll: true });
}
const quality = ref<QualityPreference>('auto'), diagnostics = shallowRef<SceneDiagnostics>();
const targets = computed(() => fallback.value ? fallbackTargets.value : diagnostics.value?.castTargets ?? []);
const spotName = (id: CastSpot) => spots.find(item => item.id === id)!.name;
const spotIdentity = (id: CastSpot) => props.habitatId === 'coastal-rock' ? ({ near: '岩缝边', middle: '浪花外', far: '外海' })[id] : ({ near: '浅沙湾', middle: '珊瑚旁', far: '深蓝处' })[id];
const deviceLabel = ref(''), measurementStarted = ref('');
const previewBuild = import.meta.env.MODE === 'fishing-preview';
const developmentTools = computed(() => import.meta.env.DEV && route.path.startsWith('/dev/'));
function changeHabitat(id: HabitatId) {
  if (route.name === 'fishing') {
    const query = { ...route.query }; delete query.habitat;
    void router.push({ name: 'fishing', params: { habitatId: id }, query });
  } else void router.push({ query: { ...route.query, habitat: id } });
}
function startMeasurement() { measurementStarted.value = new Date().toISOString(); scene.value?.startMeasurement(); }
function exportMeasurement() {
  if (!diagnostics.value?.measurement) return;
  const data = { schema: 'fishing-3d-performance-v1', startedAt: measurementStarted.value, exportedAt: new Date().toISOString(),
    deviceLabel: deviceLabel.value.trim(), environment: previewBuild ? 'preview-build' : import.meta.env.DEV ? 'development' : 'production-build', userAgent: navigator.userAgent,
    viewport: { width: innerWidth, height: innerHeight, devicePixelRatio }, habitat: props.habitatId,
    assist: state.value.assist, reducedMotion: prefs.reducedMotion.value, sound: prefs.soundEnabled.value,
    challenge: state.value.challenge, knowledgeDepth: prefs.knowledgeDepth.value, gameRules: 'g3-growth-v1',
    diagnostics: diagnostics.value, physicalDeviceVerified: false,
    note: '设备名称由测试者填写；本文件只记录浏览器实测帧预算，不能单独证明真机型号、冷启动或亲子试玩通过。' };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `fishing-${props.habitatId}-${Date.now()}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const bait = ref<BaitId>('shrimp'), revision = ref(0);
const captureService = createCaptureService(async (attemptId, speciesId) => {
  const db = await openDatabase();
  try { return await recordCapture(db, attemptId, speciesId); } finally { db.close(); }
}, () => revision.value++);
const capture = computed(() => { void revision.value; return captureService.get(state.value.attemptId); });
const unresolved = computed(() => { void revision.value; return captureService.unresolved().filter(item => item.attemptId !== state.value.attemptId); });
const species = computed(() => speciesById(state.value.speciesId ?? ''));
const fight = computed(() => state.value.fight);
const ready = computed(() => status.value === 'running' && !gamePaused.value);
const view = 'surface' as const;
const hint = computed(() => {
  const s = state.value;
  if (s.phase === 'setup') return '选好鱼饵，点水面上的落点抛竿。';
  if (s.phase === 'casting') return '抛竿中，留意鱼饵落到哪里。';
  if (s.phase === 'waiting') return '小幅轻触还不算咬钩；浮漂沉下、出现“咬钩了”再提竿。';
  if (s.phase === 'bite') return '咬钩了！现在提竿！';
  if (s.phase === 'caught') return '轻轻抄起了！可以看看知识卡，随时放生。';
  if (s.phase === 'released') return '它游回了大海。马上可以再抛一竿。';
  if (s.phase === 'escaped') return ({ early: '提得太早啦，等浮漂沉下再提竿。', missed: '咬钩窗口过去了，再来一次。', line: '鱼线拉得太紧，它挣脱了。冲刺时先松线。', timeout: '它游得有点远，喘息时再收线试试。' })[s.escape ?? 'missed'];
  return s.fight ? fightHint(s.fight, true) : '';
});
let previousPhase = state.value.phase;
let impactAttempt:string|null=null,lastReelTurn=0,wasReeling=false;
const unsubscribe = session.subscribe(value => {
  state.value = value;
  const sound=prefs.soundEnabled.value&&!gamePaused.value&&status.value==='running';
  if((value.phase==='casting'&&value.ticks>=72)||value.phase==='waiting'){
    if(value.attemptId!==impactAttempt){impactAttempt=value.attemptId;playCue('splash',sound);}
  }
  const turn=Math.floor(value.fight?.reelTurns??0);
  if(value.phase==='fighting'&&value.fight?.reeling&&turn!==lastReelTurn)playCue('reel',sound);
  if(value.phase==='fighting'&&wasReeling&&!value.fight?.reeling)playCue('payout',sound);
  lastReelTurn=turn;wasReeling=value.fight?.reeling??false;
  if (value.phase !== previousPhase) {
    controls.value?.clear();
    if(value.phase==='casting')playCue('cast',prefs.soundEnabled.value);
    if(value.phase==='released')playCue('splash',prefs.soundEnabled.value);
    if (value.phase === 'bite') playCue('bite', prefs.soundEnabled.value);
    if (value.phase === 'fighting') playCue('hook', prefs.soundEnabled.value);
    if (value.phase === 'caught') { skipCelebration.value = false; if (prefs.soundEnabled.value && !gamePaused.value) voice.play(helpAudio('catch')); }
    if (value.phase === 'escaped') playCue('escape', prefs.soundEnabled.value);
    previousPhase = value.phase;
  }
  captureService.observe(value);
});
watch(prefs.assistMode, on => session.command({ type: 'setAssist', on }));
watch(prefs.challenge, value => session.command({ type: 'setChallenge', value }));
watch(() => state.value.phase, phase => { if (phase === 'setup') session.command({ type: 'setChallenge', value: prefs.challenge.value }); });
watch(gamePaused, value => { if (value) voice.stop(); });
watch(() => state.value.phase, async phase => {
  if (phase !== 'fighting') return;
  await nextTick();
  const area = sceneFrame.value;
  if (area && (area.getBoundingClientRect().top < 0 || area.getBoundingClientRect().bottom > innerHeight)) area.scrollIntoView({ block: 'start', behavior: 'instant' });
});
function onStatus(value: SceneStatus) {
  status.value = value;
  if (value !== 'running') { controls.value?.clear(); session.clearInput(); suspendAudio(); }
  if (value === 'error' && !fallback.value) useFallback('立体画面暂时无法打开，已切换到简化画面。');
}
function useFallback(reason = '已切换到简化画面，继续同一轮钓鱼。') {
  controls.value?.clear(); session.clearInput(); status.value = 'loading'; diagnostics.value = undefined; fallbackReason.value = reason; fallback.value = true;
}
function cast(spot: CastSpot) { if (ready.value) session.command({ type: 'cast', spot, bait: bait.value, attemptId: createId(), seed: Math.floor(Math.random() * 2 ** 31) }); }
function pull() { if (ready.value) session.command({ type: 'pull' }); }
function land() { if (ready.value) session.command({ type: 'land' }); }
function release() { if (ready.value) session.command({ type: 'release' }); }
function retry() { if (ready.value) session.command({ type: 'retry', seed: Math.floor(Math.random() * 2 ** 31) }); }
function inspire() { if (species.value) void router.push({ path: '/create', query: { inspire: species.value.id } }); }
onBeforeRouteLeave(() => captureService.unresolved().length === 0 || window.confirm('还有捕获结果没有保存成功。离开后本页的重试入口会关闭，确定离开吗？'));
onBeforeRouteUpdate(() => !roundActive(state.value) && captureService.unresolved().length === 0);
onBeforeUnmount(() => { document.removeEventListener('fullscreenchange', onFullscreenChange); if (import.meta.env.DEV) delete (window as unknown as Record<string, unknown>).__fishRound; dead=true;visitorCleanup?.();bitmaps.forEach(b=>b.close());unsubscribe(); session.command({ type: 'cancel' }); suspendAudio(); });
</script>

<template>
  <section class="fishing-round">
    <FishingAmbience :habitat-id="habitatId" :enabled="prefs.soundEnabled.value" :paused="gamePaused || status !== 'running'" />
    <header class="round-header"><div><p class="eyebrow">今天的海洋探险</p><h1>{{ habitat.name }}</h1></div><p>{{ habitat.description }}</p></header>
    <div ref="sceneFrame" class="scene-frame" :data-phase="state.phase" :data-fullscreen="fullscreen">
      <FishingTutorial v-if="tutorial" @close="closeTutorial" />
      <FishingFallbackScene v-if="fallback" :round="session" :paused="gamePaused" :reduced-motion="prefs.reducedMotion.value" @status="onStatus" @clear-input="controls?.clear()" @targets="fallbackTargets = $event" />
      <FishingScene3D v-else ref="scene" :round="session" :view="view" :paused="gamePaused" :reduced-motion="prefs.reducedMotion.value" :quality="quality" @status="onStatus" @diagnostics="diagnostics = $event" @clear-input="controls?.clear()" @fallback="useFallback()" @spot="cast" />
      <div class="scene-top">
        <details class="habitat-menu"><summary :aria-label="'选择钓场，当前' + habitat.name">◈ <span class="habitat-label">{{ habitat.name }}</span><span aria-hidden="true">⌄</span></summary>
          <nav class="choices" aria-label="选择钓场"><button v-for="item in habitats" :key="item.id" :aria-pressed="item.id === habitatId" :disabled="roundActive(state) || unresolved.length > 0 || capture?.status === 'failed' || capture?.status === 'saving'" @click="changeHabitat(item.id)">{{ item.name }}</button></nav>
        </details>
        <div class="scene-tools">
          <MarineExplore compact :habitat="habitatId" @change="exploring = $event" />
          <ContextHelp :topic="sceneHelp" @change="helpOpen = $event" />
          <button :aria-pressed="paused" @click="paused = !paused">{{ paused ? '继续' : '暂停' }}</button>
          <button ref="helpButton" aria-label="怎么玩" title="怎么玩" @click="tutorial = true">?</button>
          <button v-if="fullscreenAvailable" :aria-label="fullscreen ? '收起画面' : '放大画面'" @click="toggleFullscreen">⛶</button>
          <details class="scene-settings"><summary aria-label="钓场设置" title="钓场设置">⚙</summary>
            <div class="settings-panel">
              <GrowthSettings :locked="roundActive(state)" />
              <label><input type="checkbox" :checked="prefs.soundEnabled.value" @change="prefs.update({ soundEnabled: ($event.target as HTMLInputElement).checked })"> 钓场声音</label>
              <label>画面质量 <select v-model="quality"><option value="auto">自动</option><option value="standard">标准</option><option value="low">轻量</option></select></label>
              <RouterLink to="/journal">看看我的图鉴 →</RouterLink>
            </div>
          </details>
        </div>
      </div>
      <div v-if="state.phase === 'setup'" class="water-targets" role="group" aria-label="水面落点">
        <template v-for="target in targets" :key="target.id">
          <button v-if="target.visible" class="water-target" :style="{ left: target.x + '%', top: target.y + '%' }" :disabled="!ready" @click="cast(target.id)">
            <strong>抛到{{ spotName(target.id) }}</strong><small>{{ spotIdentity(target.id) }} · {{ clueNames[state.clues[target.id]] }}</small><span class="target-pin" aria-hidden="true" />
          </button>
        </template>
      </div>
      <div v-if="state.phase === 'bite'" class="bite-notice"><strong>！咬钩了</strong><span>还有 {{ Math.max(0, biteWindow(state.assist) - state.ticks / 60).toFixed(1) }} 秒</span></div>
      <div v-if="fight && ['fighting', 'landing'].includes(state.phase)" class="fight-hud">
        <div><strong>离岸 {{ distanceToShore(fight).toFixed(1) }} m</strong><span>{{ fight.size === 'large' ? '大鱼' : '小鱼' }} · {{ fight.action === 'rest' ? '喘息中' : fight.action === 'telegraph' ? '准备发力' : fight.action === 'lateral' ? '横游中' : fight.action === 'dive' ? '下潜中' : '冲刺中' }}</span></div>
        <label>鱼线 {{ fight.tension > 1 ? '过紧，松线' : fight.tension > 0.75 ? '偏紧' : '平稳' }}<meter min="0" max="1" :value="Math.min(fight.tension, 1)" aria-label="鱼线张力" :aria-valuetext="fight.tension > 1 ? '过紧，松线' : '平稳'" /></label>
        <label>剩余体力 {{ Math.round((1 - fight.fatigue) * 100) }}%<meter min="0" max="1" :value="1 - fight.fatigue" aria-label="鱼的剩余体力" /></label>
      </div>
      <FishingVisitor v-if="passing && ['setup','waiting'].includes(state.phase)" :fish="passing" :seconds="visitorSeconds" :reduced-motion="prefs.reducedMotion.value" @greet="greeting='你的手绘鱼向你摆摆尾：你好呀！'" />
      <div v-if="status === 'paused' || gamePaused" class="pause-notice">已暂停，回来后继续这一轮</div>
      <div v-if="state.phase !== 'caught'" class="scene-bottom">
        <p class="action-hint" role="status">{{ hint }}</p>
        <div v-if="state.phase === 'setup'" class="bait-tray">
          <fieldset><legend>选鱼饵</legend><div class="choices"><button v-for="item in baits" :key="item.id" :disabled="!ready" :aria-pressed="bait === item.id" @click="bait = item.id; voice.stop()"><span class="bait-icon" aria-hidden="true">{{ helpTopics[item.id].icon }}</span>{{ item.name }}</button></div></fieldset>
          <div class="bait-explanation"><span>{{ baitDetail.icon }} {{ bait === 'shrimp' ? '偏向喜欢虾型饵的鱼' : bait === 'algae' ? '偏向藻食鱼' : '偏向喜欢拟饵的鱼' }}</span><button :aria-label="voice.playing.value ? '停止鱼饵讲解' : '听听鱼饵区别'" @click="voice.playing.value ? voice.stop() : voice.play(helpAudio(bait))">{{ voice.playing.value ? '■' : '🔊' }}</button><small>游戏里的机会不同，不保证遇见哪条鱼。</small></div>
        </div>
        <div v-if="state.phase === 'waiting' || state.phase === 'bite'" class="primary-tray"><button class="primary-action" :class="{ 'bite-action': state.phase === 'bite' }" :disabled="!ready" @click="pull">提竿</button><small>{{ state.phase === 'bite' ? '现在！' : '看浮漂，等它沉下' }}</small></div>
        <FishingControls v-if="state.phase === 'fighting'" ref="controls" in-scene :disabled="!ready" @input="session.input($event)">
          <template #reel><FishingReel v-if="fight" compact :fight="fight" :paused="gamePaused || status !== 'running'" :reduced-motion="prefs.reducedMotion.value" /></template>
        </FishingControls>
        <div v-if="state.phase === 'landing'" class="primary-tray"><button class="primary-action" :disabled="!ready" @click="land">轻轻抄起</button></div>
        <div v-if="state.phase === 'escaped'" class="primary-tray"><button class="primary-action" :disabled="!ready" @click="retry">再来一次</button><button v-if="state.failStreak >= 2 && !state.assist" class="assist-action" @click="prefs.update({ assistMode: true })">让游戏帮我一下</button></div>
        <p v-if="state.error" class="scene-error" role="alert">本钓场内容未准备好，请重新加载。</p>
      </div>
      <div v-if="state.phase === 'caught' && species && state.ticks < 150 && !skipCelebration" class="catch-celebration" :class="{ 'is-still': prefs.reducedMotion.value }" role="status"><div aria-hidden="true" class="celebration-colors"><span>✦</span><span>●</span><span>✦</span><span>●</span><span>✦</span></div><strong>钓到啦！</strong><p>你好，{{ species.commonNameZh }}！</p><button @click="skipCelebration = true; voice.stop()">看看鱼朋友 →</button></div>
      <aside v-if="state.phase === 'caught' && species && capture && (state.ticks >= 150 || skipCelebration)" class="catch-panel" aria-label="捕获与知识卡">
        <CatchCard :key="capture.attemptId" :species="species" :discovery="capture.result?.discovery ?? null" :first-discovery="capture.result?.firstDiscovery ?? false" :save-state="capture.status" :save-error="capture.error" @retry="captureService.retry(capture.attemptId)" @release="release" @inspire="inspire" />
      </aside>
    </div>
    <p v-if="fallbackReason || fullscreenError || greeting" role="status" class="prototype-note">{{ fallbackReason || fullscreenError || greeting }}</p>
    <p v-if="prefs.error.value" role="alert">设置保存失败：{{ prefs.error.value }}</p>
    <div v-for="record in unresolved" :key="record.attemptId" class="pending-save" role="status"><p>{{ record.status === 'saving' ? '放生的鱼还在记录中…' : '放生的鱼尚未保存：' + record.error }}</p><button v-if="record.status === 'failed'" @click="captureService.retry(record.attemptId)">重试记录</button></div>
    <details class="diagnostics"><summary>{{ developmentTools ? '开发检查与试玩记录' : previewBuild ? '试玩验收记录' : '家长与试玩记录' }}</summary>
      <div class="choices"><label>画面质量 <select v-model="quality"><option value="auto">自动</option><option value="standard">标准</option><option value="low">轻量</option></select></label><button v-if="!fallback" @click="scene?.rebuild()">重建场景</button><button v-if="!fallback && developmentTools" @click="scene?.loseContext()">模拟显卡中断</button><button v-if="!fallback && developmentTools" @click="scene?.restoreContext()">恢复显卡连接</button><button v-if="!fallback" @click="useFallback()">切换简化画面</button><RouterLink v-if="developmentTools" to="/dev/fishing-3d/practice">三动作练习</RouterLink></div>
      <p v-if="diagnostics?.quality === 'low' && quality === 'auto'" role="status">帧率持续偏低，画面已自动调为轻量；收放线规则和奖励相同。</p>
      <pre>阶段 {{ state.phase }} · 当前阶段 {{ state.ticks }} 步 · 凭证 {{ state.attemptId ?? '无' }}
{{ diagnostics ? `${diagnostics.fps.toFixed(1)} fps · P95 ${diagnostics.p95.toFixed(1)} ms · ${diagnostics.calls} 次绘制 · ${diagnostics.triangles} 三角形\n${diagnostics.quality === 'low' ? '轻量' : '标准'} · DPR ${diagnostics.dpr} · 活动场景 ${diagnostics.scenes} · 循环 ${diagnostics.loops}\n几何 ${diagnostics.geometries} · 纹理 ${diagnostics.textures} · 资源 ${diagnostics.resources} · 创建 ${diagnostics.created} / 释放 ${diagnostics.disposed}` : '' }}</pre>
      <div v-if="!fallback" class="measurement-controls"><label>测试设备 <input v-model="deviceLabel" placeholder="例如 iPad 9 · Safari" maxlength="100"></label><button :disabled="!ready" @click="startMeasurement">开始 60 秒记录</button><button :disabled="!diagnostics?.measurement" @click="exportMeasurement">导出本次记录</button></div>
      <p v-if="diagnostics?.measurement" role="status" class="measurement-status">已记录 {{ Math.min(60, diagnostics.measurement.seconds).toFixed(1) }} / 60 秒 · 中断 {{ diagnostics.measurement.interruptions }} 次 · {{ diagnostics.measurement.complete ? diagnostics.measurement.passesFrameBudget ? '本次帧预算达标（需核对真机）' : '本次未达验收预算，请查看导出记录' : '记录中，请保持页面前台并实际操作' }}</p>
      <p class="tool-hint">暂停、旋转屏幕或切到后台会标记中断，需重新开始连续记录。电脑模拟结果不能替代真机；冷启动与亲子试玩需另外记录。</p>
    </details>
  </section>
</template>

<style scoped>
.catch-celebration{position:absolute;z-index:7;top:80px;right:18px;left:auto;width:min(315px,calc(100% - 28px));padding:16px 20px;border:2px solid #fff6d4;border-radius:24px;background:linear-gradient(120deg,#fff0cdf5,#ffe2d5f5,#dcf4dff5,#d6eff2f5);text-align:center;box-shadow:0 8px 30px #174c4833;color:#245b4d;animation:catch-welcome .35s ease-out}.catch-celebration strong{font-size:36px;color:#bd7153;letter-spacing:2px}.catch-celebration p{font-size:17px;margin:8px 0 12px}.celebration-colors{display:flex;justify-content:center;gap:12px;font-size:25px}.celebration-colors span:nth-child(1){color:#e99482}.celebration-colors span:nth-child(2){color:#76b9a0}.celebration-colors span:nth-child(3){color:#e4ae43;font-size:34px}.celebration-colors span:nth-child(4){color:#a29bc6}.celebration-colors span:nth-child(5){color:#71b9d1}.catch-celebration.is-still{animation:none}@keyframes catch-welcome{from{opacity:0;translate:0 12px}to{opacity:1;translate:0 0}}.bait-icon{display:block;font-size:23px;margin-bottom:3px}.bait-explanation{display:grid;grid-template-columns:1fr 44px;align-items:center;gap:4px 8px;font-size:12px;color:#526d56;max-width:240px}.bait-explanation small{grid-column:1/-1;font-size:10px}.bait-explanation button{padding:7px;min-width:44px}.settings-panel :deep(.growth-settings input){width:18px;height:18px}.settings-panel :deep(.growth-settings select){max-width:65%;padding:5px}

.fishing-round { margin: auto; max-width: 1600px; }
.round-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 14px; }.round-header h1 { font-size: 24px; margin-top: 2px; }.round-header p:last-child { color: var(--muted); font-size: 13px; }.eyebrow { font-size: 10px; }
.scene-frame { height: clamp(500px, calc(100dvh - 170px), 920px); position: relative; isolation: isolate; overflow: hidden; border-radius: 26px; background: #79b9b9; box-shadow: 0 14px 40px #174e4a18; }
.scene-frame:fullscreen { width: 100%; height: 100dvh; border-radius: 0; }
.scene-top { position: absolute; z-index: 6; inset: 16px 18px auto; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; pointer-events: none; }
.scene-top button,.scene-top details { pointer-events: auto; }
.scene-tools { display: flex; gap: 6px; align-items: flex-start; }.scene-tools>button { min-width: 44px; padding: 10px; }
button,select,summary { min-height: 44px; padding: 10px 16px; border: 1px solid #fff5dfaa; border-radius: 14px; color: #285650; background: #fff9ecef; cursor: pointer; font: inherit; font-size: 13px; }
button:disabled { opacity: .6; cursor: default; }button[aria-pressed=true] { background: #185f57; color: #fff8df; }
summary { list-style: none; display: flex; align-items: center; gap: 8px; }summary::-webkit-details-marker { display: none; }.scene-settings>summary { min-width: 44px; justify-content: center; padding: 10px; }
.habitat-menu,.scene-settings { position: relative; }.habitat-menu nav,.settings-panel { position: absolute; top: 52px; padding: 12px; border-radius: 18px; background: #fff9ef; color: #285650; box-shadow: 0 8px 32px #173e4140; min-width: 220px; }
.habitat-menu nav { left: 0; }.settings-panel { right: 0; width: 260px; max-height: calc(100dvh - 160px); overflow: auto; }.settings-panel label { display: flex; align-items: center; gap: 8px; min-height: 44px; font-size: 13px; }.settings-panel p { font-size: 12px; color: #63776f; line-height: 1.7; }.settings-panel a { display: block; padding: 12px 0; font-size: 13px; }.settings-panel input { width: 18px; height: 18px; }
.water-targets { position: absolute; inset: 0; pointer-events: none; }.water-target { position: absolute; transform: translate(-50%, calc(-100% - 13px)); pointer-events: auto; min-width: 88px; padding: 9px 13px; border-radius: 14px; background: #fff4dce8; box-shadow: 0 5px 20px #174a4940; text-align: center; touch-action: manipulation; }
.water-target strong { display: block; font-size: 14px; }.water-target small { display: block; margin-top: 3px; color: #61756b; font-size: 11px; }.target-pin { position: absolute; left: 50%; top: 100%; width: 2px; height: 13px; background: #fff4dc; }.target-pin::after { content: ''; position: absolute; left: -3px; bottom: -4px; width: 8px; height: 8px; border-radius: 50%; background: #fff4dc; }
.scene-bottom { position: absolute; inset: auto 22px 20px; z-index: 4; pointer-events: none; }.scene-bottom button,.scene-bottom fieldset { pointer-events: auto; }
.action-hint { width: fit-content; max-width: min(620px, 100%); margin: 0 auto 14px; padding: 10px 16px; border: 1px solid #fff4d544; border-radius: 14px; color: #fff9e8; background: #123f49db; backdrop-filter: blur(8px); font-size: 14px; font-weight: 600; text-align: center; line-height: 1.6; }
.bait-tray { display: flex; justify-content: center; align-items: center; gap: 24px; width: fit-content; max-width: 100%; margin: auto; padding: 12px 18px; background: #fff8e9ed; border: 1px solid #fff5dcb3; border-radius: 20px; box-shadow: 0 8px 24px #173e4133; }.bait-tray fieldset { display: flex; align-items: center; gap: 12px; border: 0; padding: 0; margin: 0; }.bait-tray legend { float: left; margin-right: 12px; font-size: 12px; color: #607b6e; line-height: 44px; }.choices { display: flex; flex-wrap: wrap; gap: 8px; }.bait-tray button { border-color: #d3dcca; background: #fffaf0; }.bait-tray button[aria-pressed=true] { background: #185f57; }.tray-note { font-size: 12px; color: #61756b; }
.primary-tray { display: flex; align-items: center; flex-direction: column; gap: 8px; }.primary-action { min-width: 180px; min-height: 64px; background: #f9d185; color: #314e41; font-size: 21px; font-weight: 750; border-radius: 22px; box-shadow: 0 6px 24px #173e4140; }.primary-tray small { color: #fff4de; text-shadow: 0 1px 4px #154c54; }.bite-action { background: #ffdb88; border: 2px solid #fff8d9; }.assist-action { background: #fff9ed; }
.fight-hud { position: absolute; top: 76px; left: 18px; width: 290px; padding: 12px; color: #fff7df; background: #14515bda; backdrop-filter: blur(8px); border-radius: 16px; font-size: 12px; pointer-events: none; }.fight-hud>div { display: flex; justify-content: space-between; gap: 12px; }.fight-hud label { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 8px; }meter { width: 110px; max-width: 45%; }
.bite-notice,.pause-notice { position: absolute; left: 50%; top: 35%; transform: translate(-50%,-50%); padding: 15px 24px; border-radius: 18px; background: #fff4dbee; color: #225956; text-align: center; pointer-events: none; white-space: nowrap; }.bite-notice span { display: block; font-size: 13px; margin-top: 8px; }.bite-notice strong { font-size: 28px; }.pause-notice { z-index: 5; }
.catch-panel { position: absolute; z-index: 4; inset: 76px 18px 18px auto; width: min(370px, calc(100% - 36px)); overflow: auto; overscroll-behavior: contain; border-radius: 22px; background: #fffaf0; box-shadow: 0 8px 40px #173e414d; }.catch-panel :deep(.catch-card) { border: 0; box-shadow: none; }
.prototype-note,.pending-save { margin-top: 14px; font-size: 13px; color: var(--muted); }.pending-save { padding: 14px; border: 1px solid var(--line); border-radius: 16px; }.scene-error { color: #fff5dc; text-align: center; }
.diagnostics { margin-top: 20px; border-top: 1px solid var(--line); padding-top: 12px; }.diagnostics summary { width: fit-content; color: var(--muted); background: transparent; border: 0; font-size: 12px; }.diagnostics pre { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; line-height: 1.8; }.measurement-controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }.measurement-controls input { display: block; min-height: 44px; max-width: 100%; border: 1px solid var(--line); border-radius: 10px; padding: 8px; }.measurement-status { font-size: 13px; line-height: 1.8; }
@media(max-width:760px) { .round-header { margin-bottom: 10px; }.round-header h1 { font-size: 20px; }.round-header>p { display: none; }.scene-frame { height: max(560px, calc(100dvh - 210px)); border-radius: 20px; }.scene-top { inset: 12px 10px auto; }.scene-tools { gap: 4px; }.scene-tools>button,summary { padding: 8px; font-size: 12px; }.scene-bottom { inset: auto 12px 14px; }.bait-tray { padding: 10px; flex-direction:column;gap:6px; }.bait-tray legend,.tray-note { display: none; }.bait-tray button { padding: 8px 12px; }.action-hint { font-size: 12px; padding: 9px 12px; margin-bottom: 10px; }.water-target { width:76px;min-width:76px;max-width:76px;padding:7px; }.water-target strong { font-size: 11px; }.water-target small { font-size: 9px;line-height:1.4; }.fight-hud { top: 68px; left: 10px; width: 270px; padding: 10px; }.catch-panel { inset: 68px 10px 10px auto; width: min(370px, calc(100% - 20px)); } }
@media(max-height:500px) and (orientation:landscape) { .round-header { display: none; }.scene-frame { height: calc(100dvh - 82px); min-height: 290px; }.scene-top { inset: 8px 12px auto; }.scene-bottom { inset: auto 14px 10px; }.action-hint { position: relative; left:auto; bottom:auto; transform:none; max-width:100%; font-size: 11px; margin: 0; padding: 8px; }.bait-tray { margin-left: auto; margin-right: 0; }.scene-frame[data-phase=setup] .action-hint { left: 0; transform: none; max-width: calc(100% - 400px); }.fight-hud { top: 60px; padding: 8px; width: 260px; }.fight-hud label { margin-top: 3px; }.bite-notice { top: 46%; padding: 10px 20px; }.bite-notice strong { font-size: 22px; }.catch-panel { inset: 58px 12px 10px auto; }.catch-celebration{top:20%;padding:10px 16px;width:270px}.catch-celebration strong{font-size:25px}.celebration-colors{display:none}.catch-celebration p{font-size:13px;margin:6px}.bait-tray{gap:8px;padding:8px}.bait-explanation small{display:none}.scene-frame[data-phase=fighting] .action-hint{font-size:10px;margin-bottom:5px} }
@media(max-width:600px){.catch-celebration{top:78px;left:10px;right:10px;width:auto;padding:10px 14px;text-align:left}.catch-celebration strong{font-size:25px;letter-spacing:1px}.catch-celebration p{font-size:13px;margin:4px 0 8px}.celebration-colors{position:absolute;right:12px;top:11px;font-size:14px;gap:5px}.celebration-colors span:nth-child(3){font-size:19px}.catch-celebration button{font-size:12px;min-height:44px;padding:8px 12px}}
</style>

<style scoped>@media(max-width:480px){.scene-top{gap:4px}.habitat-label{display:none}.habitat-menu>summary{min-width:44px;width:44px;white-space:nowrap;justify-content:center;padding:8px}.scene-tools{gap:2px;flex-shrink:0}}</style>
