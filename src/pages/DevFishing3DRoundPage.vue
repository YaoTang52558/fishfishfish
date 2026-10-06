<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from 'vue-router';
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
import type { SceneDiagnostics, SceneStatus } from '../features/fishing3d/runtime';
import { usePreferences } from '../features/preferences';
import { playCue, suspendAudio } from '../features/sound';
import { openDatabase } from '../storage/db';
import { loadAssets, loadProfile, recordCapture } from '../storage/repository';

const prefs = usePreferences(), router = useRouter();
const props = withDefaults(defineProps<{ habitatId?: HabitatId }>(), { habitatId: 'reef-edge' });
const habitat = habitats.find(item => item.id === props.habitatId)!;
const session = createRoundSession(fishingContent(props.habitatId), Math.floor(Math.random() * 2 ** 31), prefs.assistMode.value);
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
const status = ref<SceneStatus>('loading'), paused = ref(false), fallback = ref(false), fallbackReason = ref('');
const tutorialKey = 'fish-fishing-tutorial-v1';
const tutorial = ref((() => { try { return localStorage.getItem(tutorialKey) !== 'dismissed'; } catch { return true; } })());
const helpButton = ref<HTMLButtonElement>();
const gamePaused = computed(() => paused.value || tutorial.value);
async function closeTutorial() {
  tutorial.value = false;
  try { localStorage.setItem(tutorialKey, 'dismissed'); } catch { /* Teaching remains available when local preferences cannot be stored. */ }
  await nextTick(); helpButton.value?.focus({ preventScroll: true });
}
const quality = ref<QualityPreference>('auto'), diagnostics = shallowRef<SceneDiagnostics>();
const deviceLabel = ref(''), measurementStarted = ref('');
const previewBuild = import.meta.env.MODE === 'fishing-preview';
function startMeasurement() { measurementStarted.value = new Date().toISOString(); scene.value?.startMeasurement(); }
function exportMeasurement() {
  if (!diagnostics.value?.measurement) return;
  const data = { schema: 'fishing-3d-performance-v1', startedAt: measurementStarted.value, exportedAt: new Date().toISOString(),
    deviceLabel: deviceLabel.value.trim(), environment: previewBuild ? 'preview-build' : 'development', userAgent: navigator.userAgent,
    viewport: { width: innerWidth, height: innerHeight, devicePixelRatio }, habitat: props.habitatId,
    assist: state.value.assist, reducedMotion: prefs.reducedMotion.value, sound: prefs.soundEnabled.value,
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
  if (s.phase === 'setup') return '选好鱼饵，点涟漪或下方落点按钮抛竿。';
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
    if (value.phase === 'caught') playCue('catch', prefs.soundEnabled.value);
    if (value.phase === 'escaped') playCue('escape', prefs.soundEnabled.value);
    previousPhase = value.phase;
  }
  captureService.observe(value);
});
watch(prefs.assistMode, on => session.command({ type: 'setAssist', on }));
watch(() => state.value.phase, async phase => {
  if (phase !== 'fighting' || innerWidth > 1024) return;
  await nextTick();
  const area = sceneFrame.value, buttons = area?.parentElement?.querySelector('.fight-controls');
  if (area && buttons && (area.getBoundingClientRect().top < 0 || buttons.getBoundingClientRect().bottom > innerHeight)) area.scrollIntoView({ block: 'start', behavior: 'instant' });
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
onBeforeUnmount(() => { dead=true;visitorCleanup?.();bitmaps.forEach(b=>b.close());unsubscribe(); session.command({ type: 'cancel' }); suspendAudio(); });
</script>

<template>
  <section class="fishing-round">
    <FishingTutorial v-if="tutorial" @close="closeTutorial" />
    <header><div><p class="eyebrow">3D 钓鱼 · 海面拉鱼</p><h1>{{ habitat.name }}</h1><p>{{ habitat.description }}</p></div><span class="stage-badge">G5 · 教学与试玩</span></header>
    <nav class="choices" aria-label="选择钓场"><button v-for="item in habitats" :key="item.id" :aria-pressed="item.id === habitatId" :disabled="roundActive(state) || unresolved.length > 0 || capture?.status === 'failed' || capture?.status === 'saving'" @click="router.push({ query: { habitat: item.id } })">{{ item.name }}</button><RouterLink v-if="!previewBuild" to="/dev/fishing-3d/models" class="text-link">看看 12 种鱼</RouterLink></nav>
    <p class="prototype-note">每片水域有 6 种鱼，鱼饵与落点会影响遇见谁；大鱼拉力更强，也更有耐力。捕获会记入本机图鉴。</p>
    <p v-if="fallbackReason" role="status" class="prototype-note">{{ fallbackReason }}</p>
    <div class="round-layout">
      <section aria-label="钓场与操作">
        <div ref="sceneFrame" class="scene-frame">
          <FishingFallbackScene v-if="fallback" :round="session" :paused="gamePaused" :reduced-motion="prefs.reducedMotion.value" @status="onStatus" @clear-input="controls?.clear()" />
          <FishingScene3D v-else ref="scene" :round="session" :view="view" :paused="gamePaused" :reduced-motion="prefs.reducedMotion.value" :quality="quality" @status="onStatus" @diagnostics="diagnostics = $event" @clear-input="controls?.clear()" @fallback="useFallback()" @spot="cast" />
          <div class="scene-top"><span>◈ {{ habitat.name }}</span><span>{{ fallback ? '简化画面' : state.phase === 'fighting' ? '海面拉鱼' : '海面观察' }}</span></div>
          <div v-if="state.phase === 'bite'" class="bite-notice"><strong>！咬钩了</strong><span>还有 {{ Math.max(0, biteWindow(state.assist) - state.ticks / 60).toFixed(1) }} 秒</span></div>
          <div v-if="fight && ['fighting', 'landing'].includes(state.phase)" class="fight-hud">
            <div><strong>离岸 {{ distanceToShore(fight).toFixed(1) }} m</strong><span>{{ fight.size === 'large' ? '大鱼' : '小鱼' }} · {{ fight.action === 'rest' ? '喘息中' : fight.action === 'telegraph' ? '准备发力' : fight.action === 'lateral' ? '横游中' : fight.action === 'dive' ? '下潜中' : '冲刺中' }}</span></div>
            <label>鱼线 {{ fight.tension > 1 ? '过紧，松线' : fight.tension > 0.75 ? '偏紧' : '平稳' }}<meter min="0" max="1" :value="Math.min(fight.tension, 1)" aria-label="鱼线张力" :aria-valuetext="fight.tension > 1 ? '过紧，松线' : '平稳'" /></label>
            <label>剩余体力 {{ Math.round((1 - fight.fatigue) * 100) }}%<meter min="0" max="1" :value="1 - fight.fatigue" aria-label="鱼的剩余体力" /></label>
          </div>
          <FishingReel v-if="fight && state.phase === 'fighting'" :fight="fight" :paused="gamePaused || status !== 'running'" :reduced-motion="prefs.reducedMotion.value" />
          <FishingVisitor v-if="passing && ['setup','waiting'].includes(state.phase)" :fish="passing" :seconds="visitorSeconds" :reduced-motion="prefs.reducedMotion.value" @greet="greeting=`「${passing.name}」向你摆摆尾：你好呀！手绘鱼只是路过，不会被钓走。`"/>
          <div v-if="status === 'paused' || gamePaused" class="pause-notice">已暂停，回来后继续这一轮</div>
        </div>
        <p class="action-hint" role="status">{{ hint }}</p>
        <p v-if="greeting" role="status" class="prototype-note">{{ greeting }}</p>
        <p v-if="fight && state.phase === 'fighting' && fight.elapsedTicks >= 1800" class="tool-hint">慢慢来。它喘息时收线，冲刺时松线，也可以开启辅助模式。</p>
        <div v-if="state.phase === 'setup'" class="setup-controls">
          <fieldset><legend>选鱼饵</legend><div class="choices"><button v-for="item in baits" :key="item.id" :disabled="!ready" :aria-pressed="bait === item.id" @click="bait = item.id">{{ item.name }}</button></div></fieldset>
          <fieldset><legend>点一个落点抛竿</legend><div class="choices"><button v-for="item in spots" :key="item.id" :disabled="!ready" @click="cast(item.id)">抛到{{ item.name }}<small>{{ clueNames[state.clues[item.id]] }}</small></button></div></fieldset>
          <p v-if="state.error" role="alert">本钓场内容未准备好，请重新加载。</p>
        </div>
        <button v-if="state.phase === 'waiting' || state.phase === 'bite'" class="primary-action" :disabled="!ready" @click="pull">提竿</button>
        <FishingControls v-if="state.phase === 'fighting'" ref="controls" :disabled="!ready" @input="session.input($event)" />
        <button v-if="state.phase === 'landing'" class="primary-action" :disabled="!ready" @click="land">轻轻抄起</button>
        <button v-if="state.phase === 'escaped'" class="primary-action" :disabled="!ready" @click="retry">再来一次</button>
        <div v-if="state.failStreak >= 2 && !state.assist" role="status" class="assist-suggestion"><p>可以打开辅助：提竿时间更长，横游时协助控竿，更能容忍过紧。发现奖励一样。</p><button @click="prefs.update({ assistMode: true })">打开辅助模式</button></div>
        <div class="session-options"><label><input type="checkbox" :checked="prefs.assistMode.value" @change="prefs.update({ assistMode: ($event.target as HTMLInputElement).checked })"> 辅助模式</label><button :aria-pressed="paused" @click="paused = !paused">{{ paused ? '继续' : '暂停' }}</button><button ref="helpButton" @click="tutorial = true">怎么玩</button></div>
        <p v-if="prefs.error.value" role="alert">设置保存失败：{{ prefs.error.value }}</p>
      </section>
      <aside aria-label="捕获与知识卡">
        <CatchCard v-if="state.phase === 'caught' && species && capture" :key="capture.attemptId" :species="species" :discovery="capture.result?.discovery ?? null" :first-discovery="capture.result?.firstDiscovery ?? false" :save-state="capture.status" :save-error="capture.error" @retry="captureService.retry(capture.attemptId)" @release="release" @inspire="inspire" />
        <section v-else class="empty-panel"><p class="eyebrow">海洋发现</p><h2>每一竿，都有新认识</h2><p>抄起成功后会出现知识卡。小知识可以跳过，放生不会删除已经保存的发现。</p><RouterLink to="/journal" class="text-link">看看我的图鉴</RouterLink></section>
        <div v-for="record in unresolved" :key="record.attemptId" class="pending-save" role="status"><p>{{ record.status === 'saving' ? '放生的鱼还在记录中…' : `放生的鱼尚未保存：${record.error}` }}</p><button v-if="record.status === 'failed'" @click="captureService.retry(record.attemptId)">重试记录</button></div>
      </aside>
    </div>
    <details class="diagnostics"><summary>{{ previewBuild ? '试玩验收记录' : '开发检查与试玩记录' }}</summary>
      <div class="choices"><label>画面质量 <select v-model="quality"><option value="auto">自动</option><option value="standard">标准</option><option value="low">轻量</option></select></label><button v-if="!fallback" @click="scene?.rebuild()">重建场景</button><button v-if="!fallback && !previewBuild" @click="scene?.loseContext()">模拟显卡中断</button><button v-if="!fallback && !previewBuild" @click="scene?.restoreContext()">恢复显卡连接</button><button v-if="!fallback" @click="useFallback()">切换简化画面</button><RouterLink v-if="!previewBuild" to="/dev/fishing-3d/practice">三动作练习</RouterLink></div>
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
.fishing-round { max-width: 1200px; margin: auto; }header { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 12px; }header p { color: var(--muted); margin: 8px 0; }.stage-badge { border: 1px solid var(--line); padding: 10px 16px; border-radius: 24px; white-space: nowrap; font-size: 12px; }.prototype-note { font-size: 13px; color: var(--muted); line-height: 1.8; margin: 12px 0 20px; }.round-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 22px; }.round-layout>section { min-width: 0; }.scene-frame { height: 440px; position: relative; overflow: hidden; border-radius: 24px; background: #79b9b9; }.scene-top { position: absolute; inset: 15px 16px auto; display: flex; justify-content: space-between; gap: 8px; pointer-events: none; color: #fff8e2; text-shadow: 0 1px 4px #144b54; font-size: 13px; }.scene-top span:first-child { background: #fff3dce8; color: #225956; padding: 9px 14px; border-radius: 24px; text-shadow: none; }.fight-hud { position: absolute; top: 64px; left: 16px; right: 16px; max-width: 330px; padding: 12px; color: #fff7df; background: #14515bdb; border-radius: 14px; font-size: 12px; pointer-events: none; }.fight-hud>div { display: flex; justify-content: space-between; gap: 12px; }.fight-hud label { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 8px; }meter { width: 110px; max-width: 45%; }.bite-notice,.pause-notice { position: absolute; left: 50%; top: 42%; transform: translate(-50%,-50%); padding: 15px 24px; border-radius: 18px; background: #fff4dbef; color: #225956; text-align: center; white-space: nowrap; }.bite-notice span { display: block; font-size: 13px; margin-top: 8px; }.bite-notice strong { font-size: 28px; }.action-hint { border-radius: 14px; background: #e7eddf; padding: 14px 16px; font-weight: 600; line-height: 1.7; font-size: 14px; }.choices { display: flex; gap: 8px; flex-wrap: wrap; }.setup-controls fieldset { border: 0; padding: 0; margin: 14px 0; }.setup-controls legend { margin-bottom: 8px; font-size: 14px; }button,select { min-height: 46px; padding: 10px 16px; border: 1px solid #d9dfd0; border-radius: 14px; color: #356258; background: #fffaf0; cursor: pointer; }button:disabled { opacity: .5; cursor: default; }button[aria-pressed=true],.primary-action { background: #185f57; color: #fff8df; }.primary-action { min-height: 56px; min-width: 150px; font-size: 18px; font-weight: 700; }.choices small { display: block; font-size: 11px; margin-top: 4px; }.session-options { display: flex; align-items: center; gap: 14px; margin-top: 18px; }.session-options label { min-height: 44px; display: flex; align-items: center; }.pending-save,.assist-suggestion { padding: 14px; border: 1px solid var(--line); border-radius: 16px; margin-top: 16px; font-size: 13px; }.diagnostics { border-top: 1px solid var(--line); margin-top: 24px; padding-top: 16px; }.diagnostics summary { min-height: 44px; cursor: pointer; }.diagnostics pre { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; line-height: 1.8; }
.session-options { flex-wrap: wrap; }.measurement-controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }.measurement-controls input { display: block; min-height: 44px; max-width: 100%; box-sizing: border-box; border: 1px solid var(--line); border-radius: 10px; padding: 8px; }.measurement-status { font-size: 13px; line-height: 1.8; }
@media(max-width:1000px) { .round-layout { grid-template-columns: 1fr; }.scene-frame { height: 420px; }aside { max-width: 650px; } }@media(max-width:600px) { header { display: block; }.stage-badge { display: none; }.scene-frame { height: clamp(240px, 40dvh, 380px); border-radius: 18px; }.choices>button { flex: 1; padding: 10px 8px; }.prototype-note { font-size: 12px; }.scene-top { inset: 12px 10px auto; } }
@media(max-height:600px) and (orientation:landscape) { .scene-frame { height: clamp(180px, calc(100dvh - 160px), 260px); }.fight-hud { top: 56px; max-width: 280px; padding: 8px; }.fight-hud label { margin-top: 4px; }.action-hint { margin: 8px 0; padding: 8px 12px; }.scene-top { inset: 8px 10px auto; } }
</style>
