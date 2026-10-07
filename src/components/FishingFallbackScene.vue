<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { speciesById, speciesDesign } from '../catalog/species';
import { getFishGeometry } from '../domain/geometry';
import { renderFish } from '../rendering/FishRenderer';
import { castPosition, roundActive } from '../domain/fishing3d/round';
import { bobberPosition, castingPose, landedFishPosition, splashAge, surfaceFloat, surfaceRodTip } from '../domain/fishing3d/visual';
import { SceneClock } from '../features/fishing3d/clock';
import type { RoundSession } from '../features/fishing3d/round';
import type { SceneStatus, SceneTarget } from '../features/fishing3d/runtime';
const props = defineProps<{ round: RoundSession; paused: boolean; reducedMotion: boolean }>();
const emit = defineEmits<{ status: [value: SceneStatus]; clearInput: []; targets: [value: SceneTarget[]] }>();
const canvas = ref<HTMLCanvasElement>();
const clock = new SceneClock(), controller = new AbortController();
let frame: number | undefined, observer: ResizeObserver | undefined, unsubscribe: (() => void) | undefined;
let blurred = false, lastReport = 0;
const runnable = () => !props.paused && !blurred && !document.hidden && (!props.reducedMotion || roundActive(props.round.read()) || props.round.read().phase === 'caught' && props.round.read().ticks < 180 || props.round.pendingEncounter());
function draw() {
  const el = canvas.value, ctx = el?.getContext('2d'); if (!el || !ctx) return;
  const w = el.clientWidth, h = el.clientHeight, s = props.round.read();
  ctx.setTransform(el.width / w, 0, 0, el.height / h, 0, 0);
  const coast = props.round.content.habitatId === 'coastal-rock';
  const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, coast ? '#ccdbe3' : '#b9e3dd'); sky.addColorStop(0.3, coast ? '#548998' : '#5ab3b2'); sky.addColorStop(1, coast ? '#234553' : '#14575f');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = coast ? '#83908b' : '#dbcca9'; ctx.fillRect(0, h * 0.82, w, h * 0.18);
  ctx.strokeStyle = '#ecf6e7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, h * 0.28); ctx.lineTo(w, h * 0.28); ctx.stroke();
  if (coast) {
    ctx.fillStyle = '#526e76'; ctx.beginPath(); ctx.moveTo(0,h*.72); ctx.lineTo(w*.08,h*.56);ctx.lineTo(w*.16,h*.63);ctx.lineTo(w*.20,h*.84);ctx.lineTo(0,h);ctx.fill();
    ctx.fillStyle = '#849c9c';ctx.beginPath();ctx.moveTo(w*.76,h*.28);ctx.lineTo(w*.81,h*.14);ctx.lineTo(w*.87,h*.25);ctx.lineTo(w*.91,h*.28);ctx.fill();
    ctx.strokeStyle = '#e2f6f0';ctx.lineWidth = 3;
    for(let i=0;i<3;i++){const y=h*(.68+i*.055),offset=props.reducedMotion?0:Math.sin(clock.time+i)*5;ctx.beginPath();ctx.ellipse(w*.1+offset,y,w*.07,h*.015,0,0,Math.PI*2);ctx.stroke();}
  } else {
    ctx.fillStyle='#eee0b8';ctx.beginPath();ctx.moveTo(0,h*.8);ctx.quadraticCurveTo(w*.28,h*.7,w*.25,h);ctx.lineTo(0,h);ctx.fill();
    for(const side of [.08,.94]) for(let i=0;i<4;i++){ctx.fillStyle=i%2?'#deac9d':'#dcce86';ctx.beginPath();ctx.ellipse(w*(side+(i-1.5)*.02),h*(.67+i*.025),w*.018,h*.024,0,0,Math.PI*2);ctx.fill();}
  }
  // Oblique projection preserves both lateral X and shore-distance Z, with depth on Y.
  const project = (p: { x: number; y: number; z: number }) => ({ x: w * (0.18 + p.z / 18 * 0.65 + p.x / 18 * 0.18), y: h * (0.78 - p.z / 18 * 0.35 - p.y / (p.y > 0 ? 15 : 5)) });
  const tip = project(s.fight ? surfaceRodTip(s.fight) : castingPose(s, props.reducedMotion).tip);
  ctx.strokeStyle = '#795332'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(w * 0.04, h * 0.79); ctx.lineTo(tip.x, tip.y); ctx.stroke();
  if (s.phase === 'setup') for (const spot of ['near', 'middle', 'far'] as const) {
    const p = project(castPosition(spot)); ctx.strokeStyle = '#fff4d7'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 14, 5, 0, 0, Math.PI * 2); ctx.stroke();
  }
  if (['casting', 'waiting', 'bite'].includes(s.phase)) {
    const p = project(bobberPosition(s, props.reducedMotion)); ctx.strokeStyle = '#fff6de'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.fillStyle = '#f4a878'; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
    const impact = splashAge(s);
    if (impact !== null && impact < 0.65 && !props.reducedMotion) {
      ctx.save(); ctx.globalAlpha = 1 - impact / 0.65; ctx.strokeStyle = '#e3fff5'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 8 + impact * 32, 3 + impact * 10, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (s.phase === 'bite') { ctx.fillStyle = '#fff5df'; ctx.font = 'bold 36px sans-serif'; ctx.fillText('!', p.x + 12, p.y - 8); }
  }
  if (s.fight && s.phase === 'fighting') {
    const f = s.fight, p = project(surfaceFloat(f, props.reducedMotion));
    ctx.fillStyle = '#123f4e66'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 8, f.size === 'large' ? 24 : 17, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff6de'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.quadraticCurveTo((tip.x + p.x) / 2, (tip.y + p.y) / 2 + Math.max(0, 1 - f.tension) * 18, p.x, p.y); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const age = props.reducedMotion ? (i + 1) / 4 : (f.elapsedTicks / 60 * 1.2 + i / 3) % 1;
      ctx.save(); ctx.globalAlpha = (1 - age) * (f.action === 'rest' ? 0.25 : 0.8); ctx.strokeStyle = '#d7fff0';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 8 + age * 30, 3 + age * 9, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle = '#f4a878'; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
  }
  if (s.fight && ['landing', 'caught', 'released'].includes(s.phase)) {
    const fish = speciesById(s.speciesId ?? ''); if (!fish) return;
    const position = landedFishPosition(s, props.reducedMotion);
    const p = project(position), design = speciesDesign(fish), scale = Math.min(w * 0.18, 110);
    const heading = s.fight.fishHeading, dx = (heading.z * 0.65 + heading.x * 0.18) * w / 18, dy = -heading.y * h / 5;
    const facing = dx < 0 ? -1 : 1, angle = Math.atan2(dy, dx) - (facing < 0 ? Math.PI : 0);
    if (s.phase === 'landing') {
      // Align the projected line to this simplified renderer's visible mouth, using the same centre and heading.
      const anchor = getFishGeometry(design).mouth.anchor, ax = anchor.x * scale * facing, ay = anchor.y * scale;
      const hook = { x: p.x + ax * Math.cos(angle) - ay * Math.sin(angle), y: p.y + ax * Math.sin(angle) + ay * Math.cos(angle) };
      ctx.strokeStyle = '#fff6de'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.quadraticCurveTo((tip.x + hook.x) / 2, hook.y + Math.max(0, 1 - s.fight.tension) * 22, hook.x, hook.y); ctx.stroke();
    }
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(angle);
    renderFish(ctx, design, { x: 0, y: 0, scale, facing }, { tailAngle: props.reducedMotion ? 0 : Math.sin(s.fight.elapsedTicks / 8) * 0.15 }); ctx.restore();
  }
}
function stop() { if (frame !== undefined) cancelAnimationFrame(frame); frame = undefined; clock.suspend(); props.round.clearInput(); emit('clearInput'); }
function tick(now: number) {
  if (!runnable()) { stop(); return; }
  clock.tick(now, () => props.round.step()); draw();
  if (now - lastReport > 250) { lastReport = now; props.round.publish(); }
  frame = requestAnimationFrame(tick);
}
function sync() {
  draw();
  if (runnable()) { if (frame === undefined) frame = requestAnimationFrame(tick); emit('status', 'running'); }
  else { stop(); emit('status', props.paused || blurred || document.hidden ? 'paused' : 'running'); }
}
onMounted(() => {
  const el = canvas.value!;
  emit('targets', (['near', 'middle', 'far'] as const).map(id => {
    const p = castPosition(id);
    return { id, x: (0.18 + p.z / 18 * 0.65 + p.x / 18 * 0.18) * 100, y: (0.78 - p.z / 18 * 0.35) * 100, visible: true };
  }));
  observer = new ResizeObserver(() => { stop(); el.width = Math.max(1, el.clientWidth); el.height = Math.max(1, el.clientHeight); sync(); }); observer.observe(el);
  unsubscribe = props.round.subscribe(() => { draw(); if (runnable() && frame === undefined) sync(); });
  document.addEventListener('visibilitychange', sync, { signal: controller.signal });
  window.addEventListener('blur', () => { blurred = true; sync(); }, { signal: controller.signal });
  window.addEventListener('focus', () => { blurred = false; sync(); }, { signal: controller.signal }); sync();
});
watch(() => [props.paused, props.reducedMotion], () => { clock.suspend(); sync(); });
onBeforeUnmount(() => { stop(); observer?.disconnect(); unsubscribe?.(); controller.abort(); });
</script>
<template><canvas ref="canvas" role="img" aria-label="简化海面钓场：用浮漂、鱼影和水花观察拉鱼，收线时鼓轮转动" /></template>
<style scoped>canvas { width: 100%; height: 100%; display: block; }</style>
