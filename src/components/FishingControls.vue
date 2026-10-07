<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { FightInputs } from '../features/fishing3d/input';
import type { HoldAction } from '../features/fishing3d/input';
import type { FightInput } from '../domain/fishing3d/state';

const props = defineProps<{ disabled: boolean; inScene?: boolean }>();
const emit = defineEmits<{ input: [value: FightInput] }>();
const holds = new FightInputs();
const input = ref(holds.read());
const controller = new AbortController();
function update() { input.value = holds.read(); emit('input', input.value); }
function clear() { holds.clear(); update(); }
function down(event: PointerEvent, action: HoldAction) {
  if (props.disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
  event.preventDefault();
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  holds.pointerDown(event.pointerId, action); update();
}
function up(event: PointerEvent) { holds.pointerUp(event.pointerId); update(); }
function move(event: PointerEvent) {
  const target = event.currentTarget as HTMLElement, rect = target.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
    up(event); if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
  }
}
function activate(event: MouseEvent, action: HoldAction) {
  // AT/keyboard click is an accessible hold toggle; pointer clicks already use down/up.
  if (!props.disabled && event.detail === 0) { holds.toggle(action); update(); }
}
const actionFor = (key: string): HoldAction | undefined => ({ ArrowLeft: 'left', ArrowRight: 'right', ' ': 'reel' } as Record<string, HoldAction>)[key];
onMounted(() => {
  window.addEventListener('keydown', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (props.disabled || event.repeat || !actionFor(event.key) || target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (target?.closest('button, a, summary') && !target.closest('[data-fight-control]')) return;
    event.preventDefault(); holds.keyDown(event.key, actionFor(event.key)!); update();
  }, { signal: controller.signal });
  window.addEventListener('keyup', (event) => { if (actionFor(event.key)) { holds.keyUp(event.key); update(); } }, { signal: controller.signal });
  window.addEventListener('blur', clear, { signal: controller.signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); }, { signal: controller.signal });
});
watch(() => props.disabled, (value) => { if (value) clear(); });
onBeforeUnmount(() => { controller.abort(); clear(); });
defineExpose({ clear });
</script>

<template>
  <div class="fight-controls" :class="{ 'in-scene': inScene }" role="group" aria-label="搏鱼操作">
    <button data-fight-control :disabled="disabled" :aria-pressed="input.rodAxis < 0" @pointerdown="down($event, 'left')" @pointermove="move" @pointerup="up" @pointercancel="up" @lostpointercapture="up" @click="activate($event, 'left')"><span aria-hidden="true">↶</span>左控竿</button>
    <button data-fight-control class="reel" :disabled="disabled" :aria-pressed="input.reel" @pointerdown="down($event, 'reel')" @pointermove="move" @pointerup="up" @pointercancel="up" @lostpointercapture="up" @click="activate($event, 'reel')"><slot name="reel"><span aria-hidden="true">◉</span></slot>{{ input.reel ? '正在收线' : '按住收线' }}</button>
    <button data-fight-control :disabled="disabled" :aria-pressed="input.rodAxis > 0" @pointerdown="down($event, 'right')" @pointermove="move" @pointerup="up" @pointercancel="up" @lostpointercapture="up" @click="activate($event, 'right')"><span aria-hidden="true">↷</span>右控竿</button>
    <small v-if="inScene" class="release-note">松开手，就放线</small>
    <button v-else class="release" :disabled="disabled" @click="holds.release('reel'); update()">松线</button>
  </div>
  <p v-if="!inScene" class="input-note">松开就放线 · ← → 控竿，空格收线 · 也可用键盘聚焦按钮，回车切换按住／松开。</p>
</template>

<style scoped>
.fight-controls { display: grid; grid-template-columns: 1fr 1.35fr 1fr auto; gap: 10px; margin-top: 16px; position: sticky; bottom: 0; z-index: 5; background: #fffaf0f5; border-radius: 18px; padding: 8px 0 max(8px, env(safe-area-inset-bottom)); }
button { min-height: 64px; border-radius: 18px; padding: 8px 16px; border: 1px solid #d6dac7; background: #fff3d5; color: #225c58; cursor: pointer; font-size: 14px; font-weight: 700; touch-action: none; user-select: none; display: flex; justify-content: center; align-items: center; gap: 10px; }
button span { font-size: 30px; }button.reel { background: #fbd47a; border-color: #ecbc58; }button[aria-pressed="true"] { background: #195f57; color: #fff9e4; }button:disabled { opacity: 0.55; cursor: default; }.release { background: transparent; min-width: 64px; }
.input-note { font-size: 12px; line-height: 1.8; color: var(--muted); margin: 10px 0; }
@media(max-width:600px) { .fight-controls { gap: 6px; grid-template-columns: 1fr 1.35fr 1fr; }button { padding: 8px; font-size: 13px; min-height: 66px; flex-direction: column; gap: 2px; }button span { font-size: 26px; }.release { grid-column: 1 / -1; min-height: 44px; flex-direction: row; } }
.in-scene { position: relative; margin: 0; padding: 0; background: transparent; grid-template-columns: 72px 72px minmax(8px, 1fr) 172px; grid-template-rows: 68px 44px; gap: 8px; pointer-events: none; }
.in-scene button { pointer-events: auto; min-height: 0; min-width: 0; height: 100%; padding: 8px; flex-direction: column; gap: 2px; border: 1px solid #fff7db88; background: #fff4dce8; box-shadow: 0 5px 16px #133b4133; backdrop-filter: blur(8px); font-size: 12px; line-height: 1.25; }
.in-scene button span { line-height: 1; }
.in-scene button:first-child { grid-column: 1; grid-row: 1; align-self: end; }
.in-scene button:nth-child(3) { grid-column: 2; grid-row: 1; align-self: end; }
.in-scene button.reel { grid-column: 4; grid-row: 1 / 3; border-radius: 24px; background: #f9d185f5; color: #304e40; font-size: 16px; }
.in-scene button.release { grid-column: 1 / 3; grid-row: 2; background: #173f48e8; color: #fff4dc; font-size: 13px; }
.in-scene button[aria-pressed=true] { background: #195f57f5; color: #fff9e4; }
.in-scene button:disabled { opacity: .65; }
.in-scene{width:min(420px,100%);margin:0 auto;grid-template-columns:1fr 1.5fr 1fr;grid-template-rows:88px 22px;gap:8px}.in-scene button:first-child{grid-column:1;grid-row:1}.in-scene button.reel{grid-column:2;grid-row:1;font-size:16px}.in-scene button:nth-child(3){grid-column:3;grid-row:1}.release-note{grid-row:2;grid-column:1/-1;color:#fff9dc;text-align:center;font-size:12px;text-shadow:0 1px 4px #183d45}
@media(max-width:600px), (max-height:500px) { .in-scene { grid-template-columns: 58px 58px minmax(6px, 1fr) 130px; grid-template-rows: 58px 44px; gap: 6px; }.in-scene button span { font-size: 24px; }.in-scene button.reel { font-size: 14px; } }
@media(max-width:600px),(max-height:500px){.in-scene{width:min(340px,100%);grid-template-columns:1fr 1.4fr 1fr;grid-template-rows:68px 20px}.in-scene button.reel{grid-column:2;grid-row:1}}
</style>
