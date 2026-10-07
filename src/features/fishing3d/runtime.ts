import { ACESFilmicToneMapping, Raycaster, SRGBColorSpace, Vector2, WebGLRenderer } from 'three';
import { FishingCameras } from '../../rendering/fishing3d/cameras.ts';
import type { FishingView } from '../../rendering/fishing3d/cameras.ts';
import { SceneResources } from '../../rendering/fishing3d/resources.ts';
import { createFishingWorld } from '../../rendering/fishing3d/world.ts';
import { SceneClock } from './clock.ts';
import { createFight, landFish, stepFight } from '../../domain/fishing3d/simulate.ts';
import { emptyFightInput } from '../../domain/fishing3d/state.ts';
import type { FightInput, FightSample, FightState3D } from '../../domain/fishing3d/state.ts';
import { roundActive } from '../../domain/fishing3d/round.ts';
import type { RoundSession } from './round.ts';
import type { CastSpot } from '../../domain/fishing.ts';
import { loadHabitatModels } from '../../rendering/fishing3d/models.ts';
import { AdaptiveQuality, frameStats, PerformanceRecorder } from './performance.ts';
import type { PerformanceMeasurement, QualityPreference, RenderQuality } from './performance.ts';

const health = { scenes: 0, loops: 0, created: 0, disposed: 0 };
export type SceneStatus = 'loading' | 'running' | 'paused' | 'context-lost' | 'error';
export interface SceneTarget { id: CastSpot; x: number; y: number; visible: boolean }
export interface SceneDiagnostics {
  fps: number; p95: number; seconds: number; calls: number; triangles: number;
  geometries: number; textures: number; resources: number; gpu: string;
  width: number; height: number; dpr: number; time: number; fish: string;
  scenes: number; loops: number; created: number; disposed: number;
  quality: RenderQuality; qualityPreference: QualityPreference; measurement: PerformanceMeasurement | null;
  castTargets: SceneTarget[];
}
interface Options {
  round?: RoundSession;
  onSpot?: (spot: CastSpot) => void;
  reducedMotion: boolean;
  onStatus: (status: SceneStatus) => void;
  onDiagnostics: (diagnostics: SceneDiagnostics) => void;
  onError: (message: string) => void;
  onFight?: (state: FightState3D | null) => void;
  onClearInput?: () => void;
}

export function createFishingRuntime(host: HTMLElement, options: Options) {
  const resources = new SceneResources();
  const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  let world: ReturnType<typeof createFishingWorld>;
  try { world = createFishingWorld(resources, { habitatId: options.round?.content.habitatId, fullContent: !!options.round, deferModels: !!options.round }); }
  catch (error) { resources.dispose(); renderer.dispose(); renderer.forceContextLoss(); throw error; }
  const cameras = new FishingCameras(!!options.round);
  const clock = new SceneClock();
  let fight: FightState3D | undefined;
  let input = emptyFightInput();
  const controller = new AbortController();
  let dead = false, warmed = false, lost = false, paused = false, blurred = false;
  let reducedMotion = options.reducedMotion;
  const adaptiveQuality = new AdaptiveQuality();
  let measurement: PerformanceRecorder | undefined;
  const qualityFrames: number[] = [];
  let qualitySeconds = 0;
  let raf: number | undefined;
  let width = 1, height = 1, lastReport = 0, previousFrame: number | undefined;
  const frames: { timestamp: number; elapsed: number }[] = [];
  const gl = renderer.getContext();
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '立体海面钓场，草帽角色、鱼竿、浮漂和选中的真实鱼共用同一空间');
  host.append(canvas);
  canvas.addEventListener('click', (event) => {
    if (dead || lost || !warmed || paused || blurred || document.hidden || options.round?.read().phase !== 'setup') return;
    const rect = canvas.getBoundingClientRect(), ray = new Raycaster();
    ray.setFromCamera(new Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), cameras.camera);
    const hit = ray.intersectObjects(world.castSpots)[0];
    if (hit) options.onSpot?.(hit.object.userData.spot as CastSpot);
  }, { signal: controller.signal });
  health.scenes++; health.created++;

  const currentFight = () => options.round ? options.round.read().fight ?? undefined : fight;
  const active = () => options.round ? roundActive(options.round.read()) || options.round.read().phase === 'caught' && options.round.read().ticks < 180 || options.round.pendingEncounter() : fight?.phase === 'fighting';
  function runnable() { return !dead && warmed && !lost && !paused && !blurred && !document.hidden && (!reducedMotion || active()); }
  function stop() {
    if (raf !== undefined) measurement?.interrupt();
    if (raf !== undefined) { cancelAnimationFrame(raf); raf = undefined; health.loops--; }
    clock.suspend(); previousFrame = undefined;
    qualityFrames.length = 0; qualitySeconds = 0; adaptiveQuality.interrupt();
    input = emptyFightInput(); options.onClearInput?.();
    options.round?.clearInput();
  }
  function render(updateWorld = true) {
    if (updateWorld) world.update(clock.time, reducedMotion, currentFight(), options.round?.read());
    renderer.render(world.scene, cameras.camera);
  }
  function report() {
    const stats = frameStats(frames.map((frame) => frame.elapsed));
    options.onDiagnostics({
      fps: stats.fps, p95: stats.p95, seconds: stats.seconds,
      calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
      resources: resources.size, gpu, width, height, dpr: renderer.getPixelRatio(), time: clock.time,
      fish: world.fishPosition.toArray().map((value) => value.toFixed(3)).join(', '),
      ...health,
      quality: adaptiveQuality.current, qualityPreference: adaptiveQuality.preference, measurement: measurement?.read() ?? null,
      castTargets: world.castSpots.map(target => {
        const point = target.position.clone().project(cameras.camera);
        return { id: target.userData.spot as CastSpot, x: (point.x + 1) * 50, y: (1 - point.y) * 50,
          visible: point.z > -1 && point.z < 1 && Math.abs(point.x) < 1 && Math.abs(point.y) < 1 };
      }),
    });
    options.onFight?.(fight ?? null);
    options.round?.publish();
  }
  function frame(timestamp: number) {
    // Keep a single scheduled callback. stop() cancels it and resets the wall-clock baseline.
    if (!runnable()) { stop(); return; }
    if (previousFrame !== undefined) {
      const elapsed = timestamp - previousFrame;
      frames.push({ timestamp, elapsed });
      measurement?.add(elapsed, renderer.info.render.calls, renderer.info.render.triangles);
      qualityFrames.push(elapsed); qualitySeconds += elapsed / 1000;
      if (qualitySeconds >= 5) {
        const before = adaptiveQuality.current;
        adaptiveQuality.observe(frameStats(qualityFrames)); qualityFrames.length = 0; qualitySeconds = 0;
        if (before !== adaptiveQuality.current) { measurement?.qualityChanged(); applyQuality(); }
      }
      while (frames[0] && timestamp - frames[0].timestamp > 60_000) frames.shift();
    }
    previousFrame = timestamp;
    const dt = clock.tick(timestamp, () => {
      if (options.round) { options.round.step(); return; }
      if (!fight || fight.phase !== 'fighting') return;
      const previous = fight;
      fight = stepFight(fight, input);
      if (previous.phase !== fight.phase || previous.action !== fight.action) options.onFight?.(fight);
    });
    world.update(clock.time, reducedMotion, currentFight(), options.round?.read());
    if (options.round) {
      const view = 'surface';
      if (cameras.view !== view) { cameras.select(view, reducedMotion, world.fishPosition); world.setView(view); }
    }
    cameras.update(dt, reducedMotion, world.fishPosition);
    render(false);
    if (timestamp - lastReport >= 500) { lastReport = timestamp; report(); }
    raf = requestAnimationFrame(frame);
  }
  function sync() {
    if (dead || lost || !warmed) return;
    if (reducedMotion && !active() && !paused && !blurred && !document.hidden) {
      stop(); cameras.update(0, true, world.fishPosition); render(); report(); options.onStatus('running'); return;
    }
    if (runnable()) {
      if (raf === undefined) { health.loops++; raf = requestAnimationFrame(frame); }
      options.onStatus('running');
    } else {
      stop(); cameras.update(0, true, world.fishPosition); options.onStatus('paused'); render(); report();
    }
  }
  function resize() {
    if (dead || lost) return;
    if (warmed) measurement?.interrupt();
    previousFrame = undefined; qualityFrames.length = 0; qualitySeconds = 0; adaptiveQuality.interrupt();
    input = emptyFightInput(); options.round?.clearInput(); options.onClearInput?.(); clock.suspend();
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, adaptiveQuality.current === 'low' ? 1 : 1.5));
    renderer.setSize(width, height);
    cameras.resize(width, height);
    if (warmed) { render(); report(); }
  }
  function applyQuality() {
    // Resizing the drawing buffer must not suspend the round or clear a held control.
    world.quality(adaptiveQuality.current);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, adaptiveQuality.current === 'low' ? 1 : 1.5));
    renderer.setSize(width, height);
    if (warmed) { render(); report(); }
  }
  const observer = new ResizeObserver(resize); observer.observe(host);
  window.addEventListener('resize', resize, { signal: controller.signal });
  document.addEventListener('visibilitychange', sync, { signal: controller.signal });
  window.addEventListener('blur', () => { blurred = true; sync(); }, { signal: controller.signal });
  window.addEventListener('focus', () => { blurred = false; sync(); }, { signal: controller.signal });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault(); lost = true; stop(); options.onStatus('context-lost');
    options.onError('画面暂时中断了。请重新加载场景，继续查看。');
  }, { signal: controller.signal });
  canvas.addEventListener('webglcontextrestored', () => {
    if (dead) return;
    lost = false; warmed = false; options.onError(''); options.onStatus('loading');
    world.warmModels(true);
    void renderer.compileAsync(world.scene, cameras.camera).then(() => {
      if (dead || lost) return;
      world.warmModels(false); warmed = true; clock.suspend(); resize(); sync();
    }).catch(() => {
      if (!dead) { options.onStatus('error'); options.onError('画面恢复失败，请重新加载场景。'); }
    });
  }, { signal: controller.signal });
  resize(); options.onStatus('loading');

  // The caller retains this runtime while warm-up is pending, so unmount can cancel ownership immediately.
  const ready = (async () => {
    if(options.round){const loaded=await loadHabitatModels(resources,options.round.content.habitatId);if(dead)return false;world.installModels(loaded);}
    world.warmModels(true);
    await renderer.compileAsync(world.scene,cameras.camera);
    if (dead || lost) return false;
    world.warmModels(false); warmed = true; render(); report(); sync(); return true;
  })();
  const unsubscribe = options.round?.subscribe(() => {
    if (warmed && raf === undefined && !dead && !lost) { render(); if (runnable()) sync(); }
  });

  return {
    ready,
    select(view: FishingView) {
      if (dead || lost) return;
      cameras.select(view, reducedMotion || paused || blurred || document.hidden, world.fishPosition);
      world.setView(view);
      if (warmed && !runnable()) { render(); report(); }
    },
    pause(value: boolean) { paused = value; sync(); },
    motion(value: boolean) { reducedMotion = value; clock.suspend(); sync(); },
    quality(value: QualityPreference) { const before = adaptiveQuality.current; adaptiveQuality.set(value); qualityFrames.length = 0; qualitySeconds = 0; if (before !== adaptiveQuality.current) measurement?.qualityChanged(); applyQuality(); },
    resetMeasurement() { frames.length = 0; previousFrame = undefined; report(); },
    startMeasurement() { measurement = new PerformanceRecorder(); frames.length = 0; previousFrame = undefined; report(); },
    setInput(value: FightInput) { if (runnable() && fight?.phase === 'fighting') input = { reel: value.reel, rodAxis: value.rodAxis }; },
    startFight(sample: FightSample, seed?: number) {
      if (dead || lost || !warmed) return;
      input = emptyFightInput(); options.onClearInput?.(); fight = createFight(sample, seed); clock.suspend();
      world.update(clock.time, reducedMotion, fight);
      cameras.select('underwater', reducedMotion, world.fishPosition); world.setView('underwater');
      options.onFight?.(fight); sync();
    },
    snapshotFight() { return fight ? structuredClone(fight) : undefined; },
    restoreFight(value: FightState3D) { fight = structuredClone(value); input = emptyFightInput(); options.onClearInput?.(); world.update(clock.time, reducedMotion, fight); },
    land() { if (fight && !dead && !lost && !paused && !blurred && !document.hidden) { fight = landFish(fight); input = emptyFightInput(); options.onClearInput?.(); render(); report(); sync(); } },
    cancelFight() { fight = undefined; input = emptyFightInput(); options.onClearInput?.(); options.onFight?.(null); sync(); },
    simulateContextLoss() { if (!dead) renderer.forceContextLoss(); },
    restoreContext() { if (!dead) renderer.forceContextRestore(); },
    dispose() {
      if (dead) return;
      dead = true; stop(); observer.disconnect(); controller.abort(); unsubscribe?.();
      resources.dispose(); world.scene.clear(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
      health.scenes--; health.disposed++;
    },
  };
}
