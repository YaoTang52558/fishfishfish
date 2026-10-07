<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { helpAudio, helpTopics, type HelpTopic } from '../features/help.ts';
import { useVoice } from '../features/voice.ts';
import { usePreferences } from '../features/preferences.ts';
const props = defineProps<{ topic: HelpTopic; disabled?: boolean }>();
const emit = defineEmits<{ change: [open: boolean] }>();
const open = ref(false), voice = useVoice(), dialog = ref<HTMLDialogElement>(), entry = ref<HTMLButtonElement>();
const prefs = usePreferences();
watch(() => props.topic, () => voice.stop());
let alive = true;
async function setOpen(value: boolean) {
  if (value) voice.play(helpAudio(props.topic)); else voice.stop(); open.value = value; emit('change', value);
  if (value) { await nextTick(); if (alive && open.value && !dialog.value?.open) dialog.value?.showModal(); }
  else { dialog.value?.close(); await nextTick(); if (alive) entry.value?.focus({ preventScroll: true }); }
}
watch(() => props.disabled, value => { if (value) void setOpen(false); });
onBeforeUnmount(() => { alive = false; if (open.value) emit('change', false); });
</script>
<template>
  <div class="context-help">
    <button ref="entry" class="help-entry" :disabled="disabled" :aria-expanded="open" aria-label="听听这一步怎么玩" @click="setOpen(!open)">🔊 <span>怎么做</span></button>
    <dialog ref="dialog" class="help-card" aria-label="当前一步的帮助" @cancel.prevent="setOpen(false)" @close="open && setOpen(false)">
      <template v-if="open"><strong><span aria-hidden="true">{{ helpTopics[topic].icon }}</span> {{ helpTopics[topic].title }}</strong>
      <div class="help-demo" :class="{ still: prefs.reducedMotion.value }" aria-hidden="true"><span>👆</span><b>{{ helpTopics[topic].icon }}</b><span>🐟</span></div>
      <p>{{ helpTopics[topic].text }}</p>
      <div><button :aria-label="voice.playing.value ? '停止讲解' : '播放讲解'" @click="voice.playing.value ? voice.stop() : voice.play(helpAudio(topic))">{{ voice.playing.value ? '■ 停止' : '🔊 听一遍' }}</button><button aria-label="收起帮助" @click="setOpen(false)">✓ 我知道啦</button></div>
      <p v-if="voice.error.value" role="status">声音没播出来，可以再点一次。</p></template>
    </dialog>
  </div>
</template>
<style scoped>.help-card .help-demo{display:flex;align-items:center;justify-content:space-around;background:#e0f0e6;border-radius:18px;padding:18px;margin:16px 0;font-size:36px}.help-demo>span:first-child{animation:help-tap 1.4s ease-in-out infinite}.help-demo.still>span{animation:none}@keyframes help-tap{50%{transform:translateY(8px)}}@media(prefers-reduced-motion:reduce){.help-demo>span{animation:none!important}}</style>
<style scoped>
.context-help{display:inline-block;pointer-events:auto}button{min-height:44px;min-width:44px;padding:8px 12px;border:1px solid #b9d6c8;border-radius:12px;background:#f5faef;color:#305b50;font-size:13px;cursor:pointer}.help-card{width:min(330px,calc(100vw - 32px));max-height:calc(100dvh - 32px);padding:20px;box-sizing:border-box;border:1px solid #b9d6c8;border-radius:20px;background:#fffdf1;color:#305b50;box-shadow:0 8px 30px #193f4533;overflow:auto}.help-card::backdrop{background:#173b4866}.help-card strong{display:flex;gap:10px;align-items:center;font-size:20px}.help-card strong span{font-size:40px}.help-card p{font-size:15px;line-height:1.9;margin:16px 0}.help-card>div{display:flex;gap:10px;justify-content:space-between}button:disabled{opacity:.5}@media(max-width:480px){.help-entry span{display:none}}
</style>
