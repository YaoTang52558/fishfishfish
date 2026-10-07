<script setup lang="ts">
import { growthPresets, type Challenge, type KnowledgeDepth } from '../domain/growth.ts';
import { usePreferences } from '../features/preferences.ts';
defineProps<{ locked?: boolean }>();
const prefs = usePreferences();
</script>
<template>
  <section class="growth-settings" aria-label="成长档位">
    <h3>按自己的节奏玩</h3>
    <div class="growth-presets" role="group" aria-label="选择玩法档位">
      <button v-for="p in growthPresets" :key="p.id" :aria-label="p.name" :disabled="locked" :aria-pressed="prefs.assistMode.value === p.assistMode && prefs.challenge.value === p.challenge && prefs.knowledgeDepth.value === p.knowledgeDepth" @click="prefs.update({ assistMode: p.assistMode, challenge: p.challenge, knowledgeDepth: p.knowledgeDepth })"><span aria-hidden="true">{{ p.icon }}</span>{{ p.name }}</button>
    </div>
    <details><summary>分别调整</summary>
      <label><input type="checkbox" :checked="prefs.assistMode.value" @change="prefs.update({ assistMode: ($event.target as HTMLInputElement).checked })"> 帮我控竿、放线和抄鱼</label>
      <label>立体钓鱼挑战 <select aria-label="钓鱼挑战" :disabled="locked" :value="prefs.challenge.value" @change="prefs.update({ challenge: ($event.target as HTMLSelectElement).value as Challenge })"><option value="gentle">轻松</option><option value="regular">适中</option><option value="hard">更有挑战</option></select></label>
      <label>知识 <select aria-label="知识" :value="prefs.knowledgeDepth.value" @change="prefs.update({ knowledgeDepth: ($event.target as HTMLSelectElement).value as KnowledgeDepth })"><option value="simple">先看图和听声音</option><option value="curious">想了解更多</option></select></label>
    </details>
    <p>{{ locked ? '这一竿结束后可以换挑战档位。' : '挑战档位用于立体钓场，随时手动调整。所有鱼和创作工具都一样开放。' }}</p>
    <p v-if="prefs.error.value" role="alert">{{ prefs.error.value }}</p>
  </section>
</template>
<style scoped>
.growth-settings{min-width:0}.growth-settings h3{font-size:16px;margin:8px 0}.growth-presets{display:flex;gap:6px;flex-wrap:wrap}.growth-presets button{flex:1;min-width:70px;min-height:66px;padding:7px;border:1px solid #b8d1c8;border-radius:14px;background:#edf5e9;color:#305f52;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;font-size:12px}.growth-presets button span{font-size:23px}.growth-presets button[aria-pressed=true]{background:#21675b;color:#fff8de}button:disabled{opacity:.55}summary{min-height:44px;padding:12px 0;cursor:pointer}label{display:flex;align-items:center;gap:10px;min-height:48px;font-size:13px}select{min-height:44px;padding:7px;border:1px solid #b8d1c8;border-radius:10px;max-width:70%;background:#fffdf4}p{font-size:12px;color:#6d8076;line-height:1.6}
</style>
