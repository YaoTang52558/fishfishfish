<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import FishingScene3D from '../components/FishingScene3D.vue';
import type { FishingView } from '../rendering/fishing3d/cameras';
import type { SceneDiagnostics, SceneStatus } from '../features/fishing3d/runtime';
import { usePreferences } from '../features/preferences';
import FishingControls from '../components/FishingControls.vue';
import { FIGHT_SAMPLES } from '../domain/fishing3d/config';
import { distanceToShore } from '../domain/fishing3d/state';
import { fightHint } from '../domain/fishing3d/simulate';
import type { FightSample, FightState3D } from '../domain/fishing3d/state';

const view = ref<FishingView>('surface');
const paused = ref(false);
const quality = ref<'standard' | 'low'>('standard');
const status = ref<SceneStatus>('loading');
const diagnostics = shallowRef<SceneDiagnostics>();
const scene = ref<InstanceType<typeof FishingScene3D>>();
const controls = ref<InstanceType<typeof FishingControls>>();
const fight = shallowRef<FightState3D | null>(null);
const sample = ref<FightSample>('sprinter');
const hint = computed(() => fight.value ? fightHint(fight.value) : '先看看钓场，再选一种动作开始练习。');
const actionName = computed(() => {
  if (!fight.value) return '';
  const names = { sprint: '冲刺', lateral: '横游', dive: '下潜', rest: '喘息' };
  return fight.value.action === 'telegraph' ? `准备${names[fight.value.nextAction]}` : names[fight.value.action];
});
function startPractice() { paused.value = false; view.value = 'underwater'; scene.value?.startFight(sample.value); }
const { reducedMotion } = usePreferences();
const statusText = computed(() => ({ loading: '正在准备', running: reducedMotion.value ? '减少动态已开启' : '海水与鱼正在游动', paused: '场景已暂停', 'context-lost': '等待重新加载', error: '暂时无法显示' })[status.value]);
</script>

<template>
  <section class="fishing-preview">
    <header class="preview-heading">
      <div><p class="eyebrow">3D 钓鱼 · 搏鱼练习</p><h1>珊瑚外缘</h1><p class="intro">留意鱼的动作：喘息时收线，冲刺和下潜时先松线。</p></div>
      <span class="stage-badge">G2 · 核心拉锯</span>
    </header>
    <div class="scene-frame">
      <FishingScene3D ref="scene" :view="view" :paused="paused" :reduced-motion="reducedMotion" :quality="quality" @status="status = $event" @diagnostics="diagnostics = $event" @fight="fight = $event" @clear-input="controls?.clear()" />
      <div class="scene-top"><span class="location">◈ 珊瑚外缘</span><span class="view-label">{{ view === 'surface' ? '海面观察' : '水下近景' }}</span></div>
      <div class="scene-caption"><span class="live-dot" :class="{ still: status !== 'running' || reducedMotion }"></span>{{ statusText }}</div>
      <div v-if="fight" class="fight-hud">
        <div class="hud-numbers"><span>{{ actionName }}</span><strong>离岸 {{ distanceToShore(fight).toFixed(1) }} m</strong></div>
        <div class="gauge-row"><span>鱼线</span><div class="tension-gauge" role="meter" aria-label="鱼线张力" :aria-valuenow="Math.min(100, Math.round(fight.tension * 100))" aria-valuemin="0" aria-valuemax="100" :aria-valuetext="fight.tension > 1 ? '过紧，松线' : fight.tension > 0.75 ? '偏紧' : '平稳'"><i :class="{ danger: fight.tension > 0.75 }" :style="{ width: Math.min(fight.tension * 100, 100) + '%' }"></i></div><span>{{ fight.tension > 1 ? '过紧' : fight.tension > 0.75 ? '偏紧' : '平稳' }}</span></div>
        <div class="gauge-row"><span>体力</span><div class="stamina-gauge" role="meter" aria-label="鱼的剩余体力" :aria-valuenow="Math.round((1 - fight.fatigue) * 100)" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: (1 - fight.fatigue) * 100 + '%' }"></i></div><span>{{ Math.round((1 - fight.fatigue) * 100) }}%</span></div>
      </div>
      <div v-if="fight?.phase === 'fighting'" class="scene-control-dock"><FishingControls ref="controls" :disabled="status !== 'running' || paused" @input="scene?.input($event)" /></div>
    </div>
    <p class="action-hint" role="status">{{ hint }}</p>
    <p v-if="fight?.phase === 'fighting'" class="preview-note">松开就放线 · ← → 控竿，空格收线 · 聚焦按钮后，回车切换按住／松开。</p>
    <div class="practice-actions">
      <template v-if="!fight || fight.phase === 'caught' || fight.phase === 'escaped'">
        <label>动作样本 <select v-model="sample"><option v-for="option in FIGHT_SAMPLES" :key="option.id" :value="option.id">{{ option.name }}</option></select></label>
        <button class="start-practice" :disabled="status !== 'running' && status !== 'paused'" @click="startPractice">{{ fight ? '再练一次' : '开始搏鱼练习' }}</button>
      </template>
      <button v-if="fight?.phase === 'landing'" class="start-practice" :disabled="status !== 'running' || paused" @click="scene?.land()">轻轻抄起</button>
      <button v-if="fight" @click="scene?.cancelFight(); view = 'surface'">退出练习</button>
    </div>
    <div class="control-panel">
      <div class="view-controls" role="group" aria-label="选择观察视角">
        <button :aria-pressed="view === 'surface'" :class="{ selected: view === 'surface' }" @click="view = 'surface'"><span aria-hidden="true">☀</span> 海面观察</button>
        <button :aria-pressed="view === 'underwater'" :class="{ selected: view === 'underwater' }" @click="view = 'underwater'"><span aria-hidden="true">≈</span> 水下近景</button>
      </div>
      <button class="pause-button" :aria-pressed="paused" @click="paused = !paused">{{ paused ? '继续游动' : '暂停游动' }}</button>
    </div>
    <p class="preview-note">这是搏鱼练习，不计入图鉴。三种动作样本用于体验操作差异；当前画面使用原型模型。</p>
    <details class="diagnostics">
      <summary>开发检查</summary>
      <div class="diagnostic-controls">
        <label>画面质量 <select v-model="quality"><option value="standard">标准</option><option value="low">轻量（像素比例 1）</option></select></label>
        <button @click="scene?.rebuild()">重建场景</button><button @click="scene?.loseContext()">模拟显卡中断</button><button @click="scene?.restoreContext()">恢复显卡连接</button><button @click="scene?.measure()">重新测量性能</button>
      </div>
      <pre v-if="diagnostics" class="metric-text" aria-label="场景性能数据">{{ diagnostics.fps.toFixed(1) }} fps · p95 {{ diagnostics.p95.toFixed(1) }} ms · 样本 {{ diagnostics.seconds.toFixed(1) }} 秒
绘制 {{ diagnostics.calls }} · 三角形 {{ diagnostics.triangles }} · 几何 {{ diagnostics.geometries }} · 纹理 {{ diagnostics.textures }} · 自有资源 {{ diagnostics.resources }}
画布 {{ diagnostics.width }} × {{ diagnostics.height }} · 像素比例 {{ diagnostics.dpr }}
活动场景 {{ diagnostics.scenes }} · 循环 {{ diagnostics.loops }} · 累计创建 {{ diagnostics.created }} · 已释放 {{ diagnostics.disposed }}
场景时间 {{ diagnostics.time.toFixed(2) }} · 鱼位置 {{ diagnostics.fish }}
GPU：{{ diagnostics.gpu }}</pre>
      <pre v-if="fight" class="metric-text" aria-label="搏鱼规则数据">阶段 {{ fight.phase }} · 规则时间 {{ (fight.elapsedTicks / 60).toFixed(2) }} · 线长 {{ fight.lineLength.toFixed(3) }} · 张力 {{ fight.tension.toFixed(3) }} · 疲劳 {{ fight.fatigue.toFixed(3) }}
竿方向 {{ fight.rodAxis.toFixed(3) }} · 竿尖 {{ JSON.stringify(fight.rodTip) }}
鱼中心 {{ JSON.stringify(fight.fishPosition) }} · 断线计时 {{ fight.breakTicks }}</pre>
      <p>圆润网格为 G1 原型美术。该页面仅在开发模式提供，不产生捕获记录。</p>
    </details>
  </section>
</template>

<style scoped>
.fishing-preview { max-width: 1144px; margin: 0 auto; }
.scene-control-dock { position: absolute; left: 16px; right: 16px; bottom: 12px; z-index: 2; }.scene-control-dock :deep(.fight-controls) { margin-top: 0; }.scene-control-dock :deep(.input-note) { display: none; }.scene-frame:has(.scene-control-dock) .scene-caption { bottom: 90px; }
@media(max-width:600px) { .scene-control-dock { left: 10px; right: 10px; bottom: 10px; }.scene-frame:has(.scene-control-dock) .scene-caption { display: none; } }
.fight-hud { position: absolute; top: 76px; left: 50%; transform: translateX(-50%); width: min(380px, calc(100% - 32px)); padding: 12px 16px; border-radius: 18px; background: #134f59d9; color: #fff5db; border: 1px solid #d3f0e260; pointer-events: none; }
.hud-numbers { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 10px; }.gauge-row { display: grid; grid-template-columns: 28px 1fr 34px; align-items: center; gap: 8px; font-size: 11px; margin-top: 7px; }
.tension-gauge,.stamina-gauge { height: 8px; background: #ffffff26; border-radius: 20px; overflow: hidden; }.gauge-row i { display: block; height: 100%; background: #b7e6bf; border-radius: inherit; }.tension-gauge i { background: #ffd977; }.tension-gauge i.danger { background: #fb9971; }
.action-hint { margin: 14px 0 8px; padding: 12px 16px; border-radius: 14px; background: #e7eddf; font-size: 14px; font-weight: 600; line-height: 1.7; }
.practice-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin: 14px 0 4px; }.practice-actions label { font-size: 13px; display: flex; align-items: center; gap: 8px; }.practice-actions .start-practice { background: #185f57; color: #fff8df; font-weight: 700; }
.preview-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
.eyebrow { margin: 0 0 6px; color: #43877d; font-size: 12px; letter-spacing: 2px; font-weight: 700; }
h1 { margin-bottom: 8px; }
.intro { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.7; }
.stage-badge { flex-shrink: 0; padding: 9px 14px; border: 1px solid #dce4d5; border-radius: 30px; color: #647a67; font-size: 12px; }
.scene-frame { position: relative; height: clamp(340px, calc(100dvh - 380px), 580px); border-radius: 26px; overflow: hidden; box-shadow: 0 12px 34px #254d4110; border: 1px solid #d9e5d8; }
.scene-top { pointer-events: none; position: absolute; inset: 20px 20px auto; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.location { border-radius: 30px; background: #fff5dcf0; color: #174f55; padding: 10px 17px; font-size: 15px; font-weight: 700; }
.view-label { color: #fff; text-shadow: 0 1px 4px #245155; font-size: 13px; font-weight: 700; }
.scene-caption { pointer-events: none; position: absolute; bottom: 18px; left: 20px; padding: 8px 13px; background: #174f55b8; border: 1px solid #ffffff30; border-radius: 24px; color: #f3ffef; font-size: 12px; display: flex; align-items: center; gap: 7px; }
.live-dot { width: 6px; height: 6px; border-radius: 50%; background: #a9edc2; }.live-dot.still { background: #f4d189; }
.control-panel { display: flex; gap: 12px; align-items: center; justify-content: space-between; padding: 18px 0 0; }
.view-controls { display: flex; gap: 8px; }
button, select { min-height: 46px; border: 1px solid #d9dfd0; background: #fffaf0; color: #356258; border-radius: 14px; padding: 10px 18px; font-size: 14px; cursor: pointer; }
.view-controls button { min-height: 50px; display: flex; gap: 9px; align-items: center; font-weight: 700; }.view-controls span { font-size: 22px; line-height: 1; }
.view-controls .selected { background: #185f57; color: #fff8df; border-color: #185f57; box-shadow: 0 4px 12px #185f5720; }
.pause-button { background: transparent; }.preview-note { font-size: 13px; color: var(--muted); margin: 14px 0 24px; line-height: 1.7; }
.diagnostics { border-top: 1px solid var(--line); padding-top: 15px; font-size: 12px; color: var(--muted); }
summary { cursor: pointer; min-height: 44px; display: list-item; padding-top: 10px; }
.diagnostic-controls { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }.diagnostic-controls label { display: flex; gap: 8px; align-items: center; }
.metric-text { display: block; white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.9 monospace; margin-top: 16px; }
@media (max-width: 600px) { .preview-heading { align-items: flex-start; margin-bottom: 16px; }.stage-badge { display: none; }.scene-frame { height: 420px; border-radius: 20px; }.scene-top { inset: 15px 12px auto; }.location { padding: 8px 12px; font-size: 13px; }.scene-caption { left: 12px; bottom: 12px; }.control-panel { align-items: stretch; gap: 8px; }.view-controls { flex: 1; gap: 6px; }.view-controls button { flex: 1; padding: 8px 10px; font-size: 13px; gap: 5px; }.pause-button { padding: 8px 10px; font-size: 12px; }.intro { font-size: 13px; } }
</style>
