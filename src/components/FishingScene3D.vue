<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { FishingView } from '../rendering/fishing3d/cameras';
import { createFishingRuntime } from '../features/fishing3d/runtime';
import type { SceneDiagnostics, SceneStatus } from '../features/fishing3d/runtime';
import type { FightInput, FightSample, FightState3D } from '../domain/fishing3d/state';

const props = defineProps<{ view: FishingView; paused: boolean; reducedMotion: boolean; quality: 'standard' | 'low' }>();
const emit = defineEmits<{ diagnostics: [value: SceneDiagnostics]; status: [value: SceneStatus]; fight: [value: FightState3D | null]; clearInput: [] }>();
const host = ref<HTMLElement>();
const status = ref<SceneStatus>('loading');
const failure = ref('');
let runtime: ReturnType<typeof createFishingRuntime> | undefined;
let savedRound: FightState3D | undefined;
let generation = 0;

async function start() {
  const savedFight = runtime?.snapshotFight() ?? savedRound;
  savedRound = savedFight;
  const current = ++generation;
  runtime?.dispose(); runtime = undefined; failure.value = '';
  status.value = 'loading'; emit('status', 'loading');
  try {
    if (!host.value) return;
    const next = createFishingRuntime(host.value, {
      reducedMotion: props.reducedMotion,
      onStatus: (value) => { if (current === generation) { status.value = value; emit('status', value); } },
      onDiagnostics: (value) => { if (current === generation) emit('diagnostics', value); },
      onError: (value) => { if (current === generation) failure.value = value; },
      onFight: (value) => { if (current === generation) emit('fight', value); },
      onClearInput: () => { if (current === generation) emit('clearInput'); },
    });
    runtime = next;
    if (savedFight) next.restoreFight(savedFight);
    next.select(props.view); next.pause(props.paused); next.quality(props.quality);
    if (await next.ready && current === generation) savedRound = undefined;
  } catch {
    if (current !== generation) return;
    runtime?.dispose(); runtime = undefined;
    status.value = 'error'; emit('status', 'error');
    failure.value = '暂时无法打开立体钓场。请检查浏览器是否支持 WebGL 2，再重新加载。';
  }
}
onMounted(() => { void start(); });
onBeforeUnmount(() => { generation++; runtime?.dispose(); runtime = undefined; });
watch(() => props.view, (value) => runtime?.select(value));
watch(() => props.paused, (value) => runtime?.pause(value));
watch(() => props.reducedMotion, (value) => runtime?.motion(value));
watch(() => props.quality, (value) => runtime?.quality(value));
defineExpose({ rebuild: () => start(), loseContext: () => runtime?.simulateContextLoss(), restoreContext: () => runtime?.restoreContext(), measure: () => runtime?.resetMeasurement(),
  startFight: (sample: FightSample, seed?: number) => runtime?.startFight(sample, seed), input: (value: FightInput) => runtime?.setInput(value), land: () => runtime?.land(), cancelFight: () => runtime?.cancelFight(),
});
</script>

<template>
  <div class="scene-host" ref="host">
    <div v-if="failure || status === 'loading'" class="scene-message" :role="failure ? 'alert' : 'status'">
      <template v-if="failure">
        <strong>画面需要重新准备</strong><p>{{ failure }}</p>
        <button class="primary-button" @click="start">重新加载场景</button>
        <RouterLink to="/fishing/reef-edge">去原版钓场</RouterLink>
      </template>
      <template v-else><span class="loading-mark" aria-hidden="true">◌</span><strong>正在准备珊瑚外缘…</strong><p>海岸、珊瑚和小丑鱼很快就到。</p></template>
    </div>
  </div>
</template>

<style scoped>
.scene-host { position: relative; width: 100%; height: 100%; overflow: hidden; background: #85ced3; }
.scene-host :deep(canvas) { display: block; width: 100%; height: 100%; }
.scene-message { position: absolute; z-index: 3; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 12px; padding: 28px; background: #e6f3e9ed; text-align: center; }
.scene-message p { max-width: 370px; margin: 0; color: var(--muted); line-height: 1.7; }
.scene-message a { padding: 10px; }
.loading-mark { font-size: 42px; color: #238c88; }
</style>
