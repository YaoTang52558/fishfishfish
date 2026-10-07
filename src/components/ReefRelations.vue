<script setup lang="ts">
import { computed, ref } from 'vue';
import { contentAsset, type ObservationContent } from '../features/inspiration/content.ts';
import { useVoice } from '../features/voice.ts';
import { clownFoodClaim } from '../features/inspiration/ecology.ts';
const props = defineProps<{ content: ObservationContent }>();
const node = ref<'fish' | 'host' | 'reef' | 'food'>('fish'), voice = useVoice();
const nodes = {
  fish: { title: '小丑鱼', image: 'illustrations/amphiprion-ocellaris.webp', audio: 'audio/vo-ao-home.wav', text: '这种小丑鱼，会和这种海葵一起生活。', factIds: ['AO-03'] },
  host: { title: '海葵伙伴', image: 'illustrations/radianthus-magnifica.webp', audio: 'audio/vo-rm-intro.wav', text: '海葵也是动物。这里的伙伴是 Radianthus magnifica。', factIds: ['AO-03', 'RM-01', 'RM-03', 'RM-04', 'RF-01'] },
  reef: { title: '珊瑚礁', image: 'environments/reef-panorama.webp', audio: 'audio/vo-rf-coral.wav', text: '珊瑚也是动物。石珊瑚的小动物，可以建造坚硬的骨骼。', factIds: ['RF-01', 'RF-02', 'RF-03'] },
  food: { title: '吃什么', image: '', audio: '', text: clownFoodClaim.childText, factIds: [clownFoodClaim.id] },
};
const facts = computed(() => [...props.content.claims, clownFoodClaim].filter(c => nodes[node.value].factIds.includes(c.id)));
const sources = computed(() => props.content.sources.filter(s => facts.value.some(c => c.sourceIds.includes(s.id))));
function hear() { voice.play(node.value === 'food' ? `${import.meta.env.BASE_URL}audio/vo-rel-clown-food.wav` : contentAsset(nodes[node.value].audio)); }
</script>
<template>
  <section class="reef-relations" aria-label="小丑鱼、海葵与珊瑚礁">
    <h3>🐠 看看它的生活</h3>
    <div class="relation-nodes" role="group" aria-label="选择关系观察对象"><button v-for="(n, key) in nodes" :key="key" :aria-pressed="node === key" @click="node = key; voice.stop()"><img v-if="n.image" :src="contentAsset(n.image)" alt=""><span v-else class="food-icon" aria-hidden="true">🍽️</span><strong>{{ n.title }}</strong></button></div>
    <div class="relation-reading"><p>{{ nodes[node].text }}</p><button @click="voice.playing.value ? voice.stop() : hear()">{{ voice.playing.value ? '■ 停止' : '🔊 听听' }}</button></div>
    <p class="relation-question">找找小丑鱼的白带，再看看海葵伸出的触手。它们的样子一样吗？</p>
    <details><summary>亲子一起看：伙伴、食物与家园</summary><p>这里展示一个有资料依据的伙伴关系。不是每种小丑鱼都能和每种海葵生活，也不把这幅想象海洋当作某个新加坡海岸的复原。</p><p>小丑鱼的食物和海葵伙伴是不同的关系；礁区提供生活环境。当前没有模拟喂食或捕食。</p><ul><li v-for="fact in facts" :key="fact.id">{{ fact.text }}<small>{{ fact.conditions }}</small></li></ul><a v-for="source in sources" :key="source.id" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.institution }} · {{ source.title }}</a><p v-if="node === 'food'">食性条目复核于 {{ clownFoodClaim.checkedAt }} · {{ clownFoodClaim.location }}。</p></details>
    <p v-if="voice.error.value" role="status">声音没播出来，可以重听。</p>
  </section>
</template>
<style scoped>
.reef-relations{padding:16px;border:1px solid #c8dfd1;border-radius:18px;background:#edf6ec;margin-top:18px}.reef-relations h3{font-size:17px;margin:0 0 12px}.relation-nodes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}button{min-height:44px;border:1px solid #b9d1bf;border-radius:12px;background:#fffef2;color:#31594a;padding:8px;cursor:pointer}.relation-nodes img{display:block;width:100%;height:70px;object-fit:contain}.relation-nodes button[aria-pressed=true]{border:2px solid #337d67;background:#d2ebdc}.relation-nodes strong{font-size:13px}.relation-reading{display:flex;gap:12px;align-items:center;margin-top:12px}.relation-reading p{flex:1;font-size:14px;line-height:1.8}.relation-reading button{flex-shrink:0}.relation-question{color:#57755b;font-size:13px;line-height:1.8}summary{cursor:pointer;min-height:44px;padding:12px 0;font-size:13px}details p,li{font-size:13px;line-height:1.8}small{display:block;color:#6e8172;font-size:12px}a{display:block;overflow-wrap:anywhere;font-size:12px;min-height:44px;padding:12px 0;text-decoration:underline}

.relation-nodes{grid-template-columns:repeat(4,minmax(0,1fr))}.food-icon{height:70px;display:flex;align-items:center;justify-content:center;font-size:38px}@media(max-width:480px){.relation-nodes{grid-template-columns:repeat(2,minmax(0,1fr))}}</style>
