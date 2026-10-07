<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import type { Discovery } from '../domain/backup.ts';
import { speciesById } from '../catalog/species.ts';
import { contentAsset, loadObservationContent, type ObservationContent, type ObservationFish } from '../features/inspiration/content.ts';
import ObservationDetail from './ObservationDetail.vue';
import CatchCard from './CatchCard.vue';
import { usePreferences } from '../features/preferences.ts';
const props = defineProps<{ discoveries: Discovery[]; initialId?: string }>();
const prefs = usePreferences(), reading = ref<HTMLElement>();
const content = shallowRef<ObservationContent | null>(null), error = ref(false), loading = ref(false);
const selectedId = ref(props.initialId ?? 'amphiprion-ocellaris'), comparisonId = ref<string | null>(null), comparing = ref(false);
const family = ref('all'), shape = ref('all'), home = ref('all'), behavior = ref('all'), onlyCaught = ref(false);
let alive = true;
const found = computed(() => new Map(props.discoveries.map(d => [d.speciesId, d])));
const selected = computed(() => content.value?.fish.find(f => f.id === selectedId.value));
const comparison = computed(() => content.value?.fish.find(f => f.id === comparisonId.value));
const caughtSpecies = computed(() => found.value.has(selectedId.value) ? speciesById(selectedId.value) : null);
const shapes = [{ id: 'all', text: '🐟 所有外形' }, { id: 'long', text: '〰 细长' }, { id: 'box', text: '▣ 盒子' }, { id: 'round', text: '● 圆身体' }, { id: 'wing', text: '🪽 大翅膀' }, { id: 'seahorse', text: '🐴 海马' }];
const shapeIds: Record<string, string[]> = { long: ['sphyraena-barracuda','scomberomorus-commerson','trichiurus-lepturus','hexagrammos-otakii'], box: ['ostracion-cubicus'], round: ['arothron-hispidus'], wing: ['mobula-birostris'], seahorse: ['hippocampus-kuda'] };
function factText(f: ObservationFish) { return content.value?.claims.filter(c => f.factIds.includes(c.id)).map(c => c.text).join(' ') ?? ''; }
const homes = [{ id: 'all', text: '🌊 所有家园', pattern: null }, { id: 'reef', text: '🪸 礁区', pattern: /珊瑚礁|礁区|岩礁|岩岸|岩石/ }, { id: 'estuary', text: '🌿 河口／海草', pattern: /河口|河流|海草/ }, { id: 'offshore', text: '🌐 外海／冷水', pattern: /北大西洋|大洋|外海|远洋|海洋上层/ }];
const behaviors = [{ id: 'all', text: '🔎 全部话题', keys: [] }, { id: 'food', text: '🍽 吃什么', keys: ['FOOD'] }, { id: 'growing', text: '🌱 长大变样', keys: ['YOUNG','GROW','COLOR'] }, { id: 'parent', text: '🥚 鱼爸爸', keys: ['BABY','EGGS'] }, { id: 'partner', text: '🤝 海葵伙伴', keys: [] }];
const visible = computed(() => (content.value?.fish ?? []).filter(f => {
  if (onlyCaught.value && !found.value.has(f.id)) return false;
  if (family.value === 'grouper' && f.group !== 'grouper') return false;
  if (shape.value !== 'all' && !shapeIds[shape.value]?.includes(f.id)) return false;
  const homeRule = homes.find(h => h.id === home.value)?.pattern;
  if (homeRule && !homeRule.test(factText(f))) return false;
  if (behavior.value === 'partner') return f.id === 'amphiprion-ocellaris';
  if (behavior.value === 'growing') return /幼鱼|成长|长大|小时候/.test(factText(f));
  if (behavior.value !== 'all' && !f.points.some(p => behaviors.find(b => b.id === behavior.value)?.keys.includes(p.key))) return false;
  return true;
}));
async function choose(f: ObservationFish) {
  if (comparing.value && f.id !== selectedId.value) comparisonId.value = f.id;
  else { selectedId.value = f.id; comparisonId.value = null; }
  await nextTick();
  if (innerWidth <= 650) reading.value?.scrollIntoView({ block: 'start', behavior: prefs.reducedMotion.value ? 'instant' : 'smooth' });
}
function reset() { family.value = shape.value = home.value = behavior.value = 'all'; onlyCaught.value = false; }
async function load() { loading.value = true; error.value = false; try { const data = await loadObservationContent(); if (alive) content.value = data; } catch { if (alive) error.value = true; } finally { if (alive) loading.value = false; } }
onMounted(load); onBeforeUnmount(() => { alive = false; });
</script>
<template>
  <section class="ocean-library" aria-label="30 鱼观察图鉴">
    <div class="library-intro"><p><strong>🐠 30 位鱼朋友</strong> · 点图画，听秘密</p><details class="library-records"><summary>🎣 我钓过的鱼</summary><p>{{ discoveries.length }} / 12 种。看图画和钓到鱼分开记录。</p></details></div>
    <p v-if="loading" role="status">正在打开鱼朋友的图画…</p><div v-if="error" role="alert">图画暂时没读到。<button @click="load">重新打开</button></div>
    <template v-if="content">
<details class="library-search"><summary>🔎 找一找鱼朋友</summary>      <div class="library-filters" aria-label="图鉴筛选"><label>鱼家族 <select v-model="family" aria-label="鱼家族"><option value="all">🐟 全部</option><option value="grouper">🔵 六种石斑</option></select></label><label>外形 <select v-model="shape" aria-label="外形"><option v-for="s in shapes" :key="s.id" :value="s.id">{{ s.text }}</option></select></label><label>家园 <select v-model="home" aria-label="家园"><option v-for="h in homes" :key="h.id" :value="h.id">{{ h.text }}</option></select></label><label>好奇什么 <select v-model="behavior" aria-label="好奇什么"><option v-for="b in behaviors" :key="b.id" :value="b.id">{{ b.text }}</option></select></label><label class="caught-filter"><input v-model="onlyCaught" type="checkbox"> 只看钓过的</label><button @click="reset">重置</button></div></details>
      <div class="library-actions"><button :aria-pressed="comparing" @click="comparing = !comparing; comparisonId = null">{{ comparing ? '✓ 结束比较' : '🐟🐠 两条一起看' }}</button><p role="status">{{ comparing ? '再点一条鱼，放在旁边比较。' : '点图画，看看它有什么特别。' }} · {{ visible.length }} 条</p></div>
      <div class="library-layout" :class="{ 'is-comparing': comparison }">
        <div class="library-list" role="group" aria-label="鱼朋友图片卡"><button v-for="f in visible" :key="f.id" :aria-pressed="selectedId === f.id || comparisonId === f.id" @click="choose(f)"><img :src="contentAsset(f.image)" :alt="f.name" loading="lazy"><strong>{{ f.name }}</strong><small>{{ found.has(f.id) ? '🎣 钓过啦' : f.id === 'mobula-birostris' ? '🔎 观察朋友' : '🔎 看看它' }}</small></button><p v-if="!visible.length">还没有符合的卡片。<button @click="reset">看看全部</button></p></div>
        <div v-if="selected" ref="reading" class="library-reading"><ObservationDetail :key="selected.id" :fish="selected" :content="content" :compact="!!comparison" /><RouterLink class="library-create" :to="{ path:'/create', query:{ observe:selected.id } }">🖌️ 带着灵感去造鱼</RouterLink><details v-if="caughtSpecies && found.has(selected.id)" class="capture-record"><summary>🎣 这条鱼的捕获记录</summary><CatchCard :species="caughtSpecies" :discovery="found.get(selected.id) ?? null" :first-discovery="false" save-state="saved" hide-release /></details></div>
        <ObservationDetail v-if="comparison" :key="comparison.id" :fish="comparison" :content="content" compact />
      </div>
      <p class="library-note">家园筛选只列已核对文字中提到的环境，不代表完整分布。30 张观察卡与 12 种钓鱼池分别计算。</p>
    </template>
  </section>
</template>
<style scoped>
.library-reading{scroll-margin-top:12px}
.library-intro{display:flex;gap:12px;justify-content:space-between;flex-wrap:wrap;margin:20px 0}.library-intro p{font-size:13px;color:#658074}.library-intro strong{font-size:18px;color:#315c4b}.library-filters{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;padding:14px;background:#edf5ed;border-radius:18px}.library-filters label{font-size:11px;color:#5f7768;display:flex;flex-direction:column;gap:5px}.library-filters select,button{min-height:44px;border:1px solid #bdd5c5;border-radius:12px;background:#fffdf2;padding:9px 12px;color:#345d4d;cursor:pointer;font-size:12px}.library-filters .caught-filter{flex-direction:row;align-items:center;min-height:44px;font-size:12px}.library-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:14px 0}.library-actions p{font-size:12px;color:#6e816f}.library-layout{display:grid;grid-template-columns:minmax(220px,.85fr) minmax(360px,1.4fr);gap:18px;align-items:start}.library-layout.is-comparing{grid-template-columns:240px minmax(0,1fr) minmax(0,1fr)}.library-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;max-height:840px;overflow:auto;padding:3px;align-content:start}.library-list button{display:flex;flex-direction:column;align-items:center;padding:10px;gap:5px;min-width:0}.library-list img{width:100%;height:100px;object-fit:contain}.library-list strong{font-size:13px}.library-list small{font-size:10px;color:#82927b}.library-list button[aria-pressed=true]{background:#d9eedf;border:2px solid #59927a}.library-create{display:flex;justify-content:center;align-items:center;min-height:48px;margin-top:12px;border:1px solid #bdd5c5;border-radius:14px;background:#f9df98;color:#50613c;font-size:14px}.capture-record summary{padding:14px 0;min-height:44px;font-size:13px;cursor:pointer}.library-note{font-size:11px;color:#748370;line-height:1.7;margin-top:18px}@media(max-width:1000px){.library-layout.is-comparing{grid-template-columns:repeat(2,minmax(0,1fr))}.is-comparing .library-list{grid-column:1/-1;grid-template-columns:repeat(6,minmax(0,1fr));max-height:250px}.library-list img{height:80px}}@media(max-width:650px){.library-layout,.library-layout.is-comparing{grid-template-columns:minmax(0,1fr)}.library-list,.is-comparing .library-list{grid-template-columns:repeat(3,minmax(0,1fr));max-height:280px;grid-column:auto}.library-list img{height:65px}.library-list strong{font-size:11px}.library-filters label{flex:1;min-width:125px}.library-intro{gap:6px}}
</style>

<style scoped>.library-search>summary,.library-records>summary{min-height:48px;display:flex;align-items:center;cursor:pointer;padding:8px 12px;font-size:14px;border:1px solid #bdd5c5;border-radius:12px;background:#edf5ed}.library-intro{margin:12px 0;align-items:center}.library-layout{grid-template-columns:minmax(340px,1.4fr) minmax(220px,.85fr)}.library-reading{grid-column:1;grid-row:1}.library-list{grid-column:2;grid-row:1}.library-layout.is-comparing{grid-template-columns:repeat(2,minmax(0,1fr))}.is-comparing .library-list{grid-column:1/-1;grid-row:2;grid-template-columns:repeat(6,minmax(0,1fr));max-height:250px}.is-comparing>.observation-detail{grid-column:2;grid-row:1}.library-actions{margin:10px 0}.library-note{font-size:12px}@media(max-width:650px){.library-layout,.library-layout.is-comparing{grid-template-columns:minmax(0,1fr)}.library-reading{grid-column:1;grid-row:1}.library-list,.is-comparing .library-list{grid-column:1;grid-row:3;grid-template-columns:repeat(3,minmax(0,1fr));max-height:290px}.is-comparing>.observation-detail{grid-column:1;grid-row:2}}</style>
<style scoped>@media(min-width:650px){.library-reading :deep(.specimen-window){height:240px;margin:10px 0}}</style>
