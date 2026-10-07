import { onBeforeUnmount, onMounted, ref } from 'vue';

const stops = new Set<() => void>();
let current: HTMLAudioElement | null = null;
export const narrationBusy = ref(false);
export function releaseVoice(audio: HTMLAudioElement | null | undefined) { if (audio && current === audio) { current = null; narrationBusy.value = false; } }
/** Narration has one owner across help, observation cards and ocean play. */
export function registerVoiceStop(stop: () => void) { stops.add(stop); return () => { stops.delete(stop); }; }
export function stopNarration() { for (const stop of stops) stop(); }
export function claimVoice(audio: HTMLAudioElement) {
  stopNarration();
  if (current && current !== audio) current.pause();
  current = audio;
  narrationBusy.value = true;
}
export const voiceActive = () => narrationBusy.value;
export function useVoice() {
  const playing = ref(false), error = ref(false);
  let audio: HTMLAudioElement | null = null, ticket = 0, alive = true;
  function stop() { ticket++; audio?.pause(); if (audio) audio.currentTime = 0; releaseVoice(audio); playing.value = false; }
  const unregister = registerVoiceStop(stop);
  function play(url: string) {
    audio ??= new Audio(); claimVoice(audio); error.value = false;
    const token = ++ticket; audio.src = url; playing.value = true;
    audio.onended = () => { playing.value = false; releaseVoice(audio); };
    void audio.play().catch(() => { if (alive && token === ticket) { stop(); error.value = true; } });
  }
  const hidden = () => { if (document.hidden) stop(); };
  onMounted(() => { document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', stop); });
  onBeforeUnmount(() => { alive = false; stop(); unregister(); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', stop); if (audio) { audio.removeAttribute('src'); audio.load(); } });
  return { playing, error, play, stop };
}
