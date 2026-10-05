<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import FishingScene3D from '../components/FishingScene3D.vue';
import type { FishingView } from '../rendering/fishing3d/cameras';
import type { SceneDiagnostics, SceneStatus } from '../features/fishing3d/runtime';
import { usePreferences } from '../features/preferences';

const view = ref<FishingView>('surface');
const paused = ref(false);
const quality = ref<'standard' | 'low'>('standard');
const status = ref<SceneStatus>('loading');
const diagnostics = shallowRef<SceneDiagnostics>();
const scene = ref<InstanceType<typeof FishingScene3D>>();
const { reducedMotion } = usePreferences();
const statusText = computed(() => ({ loading: '正在准备', running: reducedMotion.value ? '减少动态已开启' : '海水与鱼正在游动', paused: '场景已暂停', 'context-lost': '等待重新加载', error: '暂时无法显示' })[status.value]);
</script>

<template>
  <section class="fishing-preview">
    <header class="preview-heading">
      <div><p class="eyebrow">3D 钓鱼 · 场景预览</p><h1>珊瑚外缘</h1><p class="intro">坐在海岸上，看看浮漂，再潜入水下和小丑鱼相遇。</p></div>
      <span class="stage-badge">G1 · 场景与镜头</span>
    </header>
    <div class="scene-frame">
      <FishingScene3D ref="scene" :view="view" :paused="paused" :reduced-motion="reducedMotion" :quality="quality" @status="status = $event" @diagnostics="diagnostics = $event" />
      <div class="scene-top"><span class="location">◈ 珊瑚外缘</span><span class="view-label">{{ view === 'surface' ? '海面观察' : '水下近景' }}</span></div>
      <div class="scene-caption"><span class="live-dot" :class="{ still: status !== 'running' || reducedMotion }"></span>{{ statusText }}</div>
    </div>
    <div class="control-panel">
      <div class="view-controls" role="group" aria-label="选择观察视角">
        <button :aria-pressed="view === 'surface'" :class="{ selected: view === 'surface' }" @click="view = 'surface'"><span aria-hidden="true">☀</span> 海面观察</button>
        <button :aria-pressed="view === 'underwater'" :class="{ selected: view === 'underwater' }" @click="view = 'underwater'"><span aria-hidden="true">≈</span> 水下近景</button>
      </div>
      <button class="pause-button" :aria-pressed="paused" @click="paused = !paused">{{ paused ? '继续游动' : '暂停游动' }}</button>
    </div>
    <p class="preview-note">这一阶段可以切换视角、观察鱼和鱼线。下一阶段加入抛竿、控竿与收放线。</p>
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
      <p>圆润网格为 G1 原型美术。该页面仅在开发模式提供，不产生捕获记录。</p>
    </details>
  </section>
</template>

<style scoped>
.fishing-preview { max-width: 1144px; margin: 0 auto; }
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
