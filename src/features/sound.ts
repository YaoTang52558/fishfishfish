/*
 * 极简提示音：用 Web Audio 合成，不加载音频文件。默认关闭，只在用户操作后创建音频环境；
 * 任何音频错误都静默忽略，声音只是辅助，所有提示同时有文字与画面。
 */
let context: AudioContext | null = null;
type Cue = 'bite' | 'hook' | 'catch' | 'escape' | 'cast' | 'splash' | 'reel' | 'payout';
const notes: Record<Cue, Array<[frequency: number, start: number, duration: number]>> = {
  bite: [[880, 0, 0.12], [1175, 0.14, 0.14]],
  hook: [[523, 0, 0.1]],
  catch: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.22]],
  escape: [[392, 0, 0.16], [330, 0.16, 0.22]],
  cast: [[240,0,.08],[440,.06,.08]],
  splash: [[180,0,.12],[120,.08,.18]],
  reel: [[620,0,.035],[560,.035,.035]],
  payout: [[260,0,.065]],
};
export function playCue(cue: Cue, enabled: boolean) {
  if (!enabled) return;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    context ??= new Ctor();
    if (context.state === 'suspended') void context.resume();
    const now = context.currentTime;
    for (const [frequency, start, duration] of notes[cue]) {
      const osc = context.createOscillator(), gain = context.createGain();
      osc.type = 'sine'; osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(cue==='reel'||cue==='payout'?.035:cue==='splash'||cue==='cast'?.07:.18, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
      osc.connect(gain).connect(context.destination);
      osc.start(now + start); osc.stop(now + start + duration + 0.02);
    }
  } catch { /* 音频不可用不影响玩法 */ }
}
/** 切到后台时暂停音频。 */
export function suspendAudio() { try { void context?.suspend(); } catch { /* 忽略 */ } }
