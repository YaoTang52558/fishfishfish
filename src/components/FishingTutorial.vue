<script setup lang="ts">
import { onMounted, ref } from 'vue';
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>(), step = ref(0);
const steps = [
  { icon: '◎', title: '看浮漂，等咬钩', text: '选鱼饵、点落点抛竿。浮漂沉下，出现「咬钩了」时再点提竿。小幅轻触先等等。' },
  { icon: '◉', title: '喘息收线，发力松线', text: '鱼喘息时按住收线，鼓轮就会转。鱼冲刺、下潜或鱼线过紧时松开；横游时向相反方向控竿。大鱼更有力。' },
  { icon: '♡', title: '轻轻抄起，再放回大海', text: '鱼靠岸后点「轻轻抄起」。知识卡可以慢慢看，也可以直接放生；成功保存的发现会留在图鉴里。辅助模式的奖励一样。' },
];
onMounted(() => dialog.value?.showModal());
</script>
<template>
  <dialog ref="dialog" aria-labelledby="tutorial-title" @cancel.prevent="emit('close')">
    <div class="tutorial-card">
      <p class="eyebrow">第一次钓鱼 · {{ step + 1 }} / 3</p>
      <div class="tutorial-icon" aria-hidden="true">{{ steps[step]!.icon }}</div>
      <h2 id="tutorial-title">{{ steps[step]!.title }}</h2>
      <p>{{ steps[step]!.text }}</p>
      <p class="tutorial-note">教学期间已暂停，关掉后接着玩。声音默认关闭。</p>
      <div class="tutorial-actions"><button @click="emit('close')">{{ step === 2 ? '直接开始' : '跳过教学' }}</button><button v-if="step > 0" @click="step--">上一步</button><button class="next" @click="step < 2 ? step++ : emit('close')">{{ step < 2 ? '下一步' : '我来试试' }}</button></div>
    </div>
  </dialog>
</template>
<style scoped>
dialog { width: min(480px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); box-sizing: border-box; border: 1px solid #d4dfcb; border-radius: 24px; padding: 0; color: #225956; background: #fffaf0; }
dialog::backdrop { background: #123f4b99; }.tutorial-card { padding: 26px; }.tutorial-icon { font-size: 56px; color: #bd8040; }h2 { font-size: 24px; }p { line-height: 1.9; }.tutorial-note { font-size: 12px; color: #637c73; }.tutorial-actions { display: flex; flex-wrap: wrap; gap: 8px; }button { min-height: 48px; padding: 10px 16px; border-radius: 14px; border: 1px solid #d4dfcb; background: #fff3d5; color: #225956; cursor: pointer; }.next { background: #185f57; color: #fff8df; margin-left: auto; }
@media(max-height:500px) { .tutorial-card { padding: 16px; }.tutorial-icon { display: none; }h2,p { margin: 8px 0; } }
</style>
