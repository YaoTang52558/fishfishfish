import { ACESFilmicToneMapping, SRGBColorSpace, WebGLRenderer } from 'three';
import { FishingCameras } from '../../rendering/fishing3d/cameras.ts';
import type { FishingView } from '../../rendering/fishing3d/cameras.ts';
import { SceneResources } from '../../rendering/fishing3d/resources.ts';
import { createFishingWorld } from '../../rendering/fishing3d/world.ts';
import { SceneClock } from './clock.ts';

const health = { scenes: 0, loops: 0, created: 0, disposed: 0 };
export type SceneStatus = 'loading' | 'running' | 'paused' | 'context-lost' | 'error';
export interface SceneDiagnostics {
  fps: number; p95: number; seconds: number; calls: number; triangles: number;
  geometries: number; textures: number; resources: number; gpu: string;
  width: number; height: number; dpr: number; time: number; fish: string;
  scenes: number; loops: number; created: number; disposed: number;
}
interface Options {
  reducedMotion: boolean;
  onStatus: (status: SceneStatus) => void;
  onDiagnostics: (diagnostics: SceneDiagnostics) => void;
  onError: (message: string) => void;
}

export function createFishingRuntime(host: HTMLElement, options: Options) {
  const resources = new SceneResources();
  const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  let world: ReturnType<typeof createFishingWorld>;
  try { world = createFishingWorld(resources); }
  catch (error) { resources.dispose(); renderer.dispose(); renderer.forceContextLoss(); throw error; }
  const cameras = new FishingCameras();
  const clock = new SceneClock();
  const controller = new AbortController();
  let dead = false, warmed = false, lost = false, paused = false, blurred = false;
  let reducedMotion = options.reducedMotion;
  let quality: 'standard' | 'low' = 'standard';
  let raf: number | undefined;
  let width = 1, height = 1, lastReport = 0, previousFrame: number | undefined;
  const frames: { timestamp: number; elapsed: number }[] = [];
  const gl = renderer.getContext();
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '珊瑚外缘的立体钓场，草帽角色、鱼竿、浮漂和小丑鱼共用同一空间');
  host.append(canvas);
  health.scenes++; health.created++;

  function runnable() { return !dead && warmed && !lost && !paused && !blurred && !document.hidden && !reducedMotion; }
  function stop() {
    if (raf !== undefined) { cancelAnimationFrame(raf); raf = undefined; health.loops--; }
    clock.suspend(); previousFrame = undefined;
  }
  function render() {
    world.update(clock.time, reducedMotion);
    renderer.render(world.scene, cameras.camera);
  }
  function report() {
    const values = frames.map((frame) => frame.elapsed).sort((a, b) => a - b);
    const total = values.reduce((sum, value) => sum + value, 0);
    options.onDiagnostics({
      fps: total ? values.length * 1000 / total : 0,
      p95: values[Math.max(0, Math.ceil(values.length * 0.95) - 1)] ?? 0,
      seconds: total / 1000,
      calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
      resources: resources.size, gpu, width, height, dpr: renderer.getPixelRatio(), time: clock.time,
      fish: world.fishPosition.toArray().map((value) => value.toFixed(3)).join(', '),
      ...health,
    });
  }
  function frame(timestamp: number) {
    // Keep a single scheduled callback. stop() cancels it and resets the wall-clock baseline.
    if (!runnable()) { stop(); return; }
    if (previousFrame !== undefined) {
      frames.push({ timestamp, elapsed: timestamp - previousFrame });
      while (frames[0] && timestamp - frames[0].timestamp > 60_000) frames.shift();
    }
    previousFrame = timestamp;
    const dt = clock.tick(timestamp);
    cameras.update(dt, reducedMotion, world.fishPosition);
    render();
    if (timestamp - lastReport >= 250) { lastReport = timestamp; report(); }
    raf = requestAnimationFrame(frame);
  }
  function sync() {
    if (dead || lost || !warmed) return;
    if (reducedMotion && !paused && !blurred && !document.hidden) {
      stop(); cameras.update(0, true, world.fishPosition); render(); report(); options.onStatus('running'); return;
    }
    if (runnable()) {
      if (raf === undefined) { health.loops++; raf = requestAnimationFrame(frame); }
      options.onStatus('running');
    } else {
      stop(); options.onStatus('paused'); render(); report();
    }
  }
  function resize() {
    if (dead || lost) return;
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'low' ? 1 : 1.5));
    renderer.setSize(width, height);
    cameras.resize(width, height);
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
    void renderer.compileAsync(world.scene, cameras.camera).then(() => {
      if (dead || lost) return;
      warmed = true; clock.suspend(); resize(); sync();
    }).catch(() => {
      if (!dead) { options.onStatus('error'); options.onError('画面恢复失败，请重新加载场景。'); }
    });
  }, { signal: controller.signal });
  resize(); options.onStatus('loading');

  // The caller retains this runtime while warm-up is pending, so unmount can cancel ownership immediately.
  const ready = renderer.compileAsync(world.scene, cameras.camera).then(() => {
    if (dead || lost) return false;
    warmed = true; render(); report(); sync(); return true;
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
    quality(value: 'standard' | 'low') { quality = value; frames.length = 0; resize(); },
    resetMeasurement() { frames.length = 0; previousFrame = undefined; report(); },
    simulateContextLoss() { if (!dead) renderer.forceContextLoss(); },
    restoreContext() { if (!dead) renderer.forceContextRestore(); },
    dispose() {
      if (dead) return;
      dead = true; stop(); observer.disconnect(); controller.abort();
      resources.dispose(); world.scene.clear(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
      health.scenes--; health.disposed++;
    },
  };
}
