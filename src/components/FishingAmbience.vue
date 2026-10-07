<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { HabitatId } from '../domain/types.ts';
import { narrationBusy } from '../features/voice.ts';
const baseUrl = import.meta.env.BASE_URL;
const props = defineProps<{ habitatId: HabitatId; enabled: boolean; paused: boolean }>();
const player = ref<HTMLAudioElement>();
let alive = true, generation = 0;
function sync() {
  const audio = player.value; if (!audio) return;
  const token = ++generation;
  if (!props.enabled || props.paused || document.hidden || narrationBusy.value) { audio.pause(); return; }
  audio.volume = props.habitatId === 'coastal-rock' ? .15 : .1;
  void audio.play().catch(() => { if (alive && token === generation) audio.pause(); });
}
watch(() => [props.enabled, props.paused, narrationBusy.value], sync);
onMounted(() => { document.addEventListener('visibilitychange', sync); sync(); });
onBeforeUnmount(() => { alive = false; generation++; player.value?.pause(); document.removeEventListener('visibilitychange', sync); });
</script>
<template><audio ref="player" :src="`${baseUrl}audio/ambient-${habitatId === 'coastal-rock' ? 'rock' : 'reef'}.wav`" preload="none" loop /></template>
