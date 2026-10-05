<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { habitats } from '../catalog/habitats.ts';
import { silhouetteDesign, species, speciesDesign, type SpeciesDefinition } from '../catalog/species.ts';
import type { Discovery } from '../domain/backup.ts';
import { effectIds } from '../domain/draft.ts';
import { effectInfo } from '../domain/rules.ts';
import type { EffectDiscovery, OriginalFish } from '../domain/types.ts';
import { openDatabase } from '../storage/db.ts';
import { onExternalChange } from '../storage/queue.ts';
import { loadAssets, loadDiscoveries, loadProfile } from '../storage/repository.ts';
import AppIcon from '../components/AppIcon.vue';
import CatchCard from '../components/CatchCard.vue';
import PageHeading from '../components/PageHeading.vue';
import PartThumb from '../components/PartThumb.vue';

const route = useRoute();
const router = useRouter();
const section = ref<'discoveries' | 'creations'>(route.query.tab === 'creations' ? 'creations' : 'discoveries');
const onlyFound = ref(false);
const status = ref<'loading' | 'ready' | 'unavailable'>('loading');
const discoveries = shallowRef<Discovery[]>([]);
const fish = shallowRef<OriginalFish[]>([]);
const effects = shallowRef<EffectDiscovery[]>([]);
const textures = shallowRef(new Map<string, ImageBitmap>());
const openId = ref<string | null>(null);
let stop: () => void = () => undefined;
const dateFormat = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' });

const found = computed(() => new Map(discoveries.value.map((item) => [item.speciesId, item])));
const verified = species.filter((item) => item.reviewStatus === 'verified');
const groups = computed(() => habitats.map((habitat) => ({
  habitat, items: verified.filter((item) => item.game.habitatId === habitat.id && (!onlyFound.value || found.value.has(item.id))),
})));
const opened = computed<SpeciesDefinition | null>(() => verified.find((item) => item.id === openId.value && found.value.has(item.id)) ?? null);
const effectFound = computed(() => new Map(effects.value.map((item) => [item.effectId, item])));

async function load() {
  let db: IDBDatabase;
  try { db = await openDatabase(); } catch { status.value = 'unavailable'; return; }
  try {
    const [profile, list] = [await loadProfile(db), await loadDiscoveries(db)];
    discoveries.value = list; fish.value = profile.fish; effects.value = profile.effects;
    const blobs = await loadAssets(db, profile.fish.map((item) => item.design.paint.colorAssetId));
    for (const bitmap of textures.value.values()) bitmap.close();
    const map = new Map<string, ImageBitmap>();
    for (const [id, blob] of blobs) { try { map.set(id, await createImageBitmap(blob)); } catch { /* 跳过损坏纹理 */ } }
    textures.value = map;
    status.value = 'ready';
  } finally { db.close(); }
}
onMounted(() => { void load(); stop = onExternalChange(() => { void load(); }); });
onBeforeUnmount(() => { stop(); for (const bitmap of textures.value.values()) bitmap.close(); });
function inspire(id: string) { void router.push({ path: '/create', query: { inspire: id } }); }
</script>

<template>
  <PageHeading eyebrow="发现与收藏 / JOURNAL" title="每一个小发现，都值得记住。" description="海洋里的真实鱼类，和你想象中的原创作品，各有自己的位置。" />
  <div class="segmented journal-tabs" aria-label="图鉴分区">
    <button :aria-pressed="section === 'discoveries'" :class="{ selected: section === 'discoveries' }" @click="section = 'discoveries'">海洋发现</button>
    <button :aria-pressed="section === 'creations'" :class="{ selected: section === 'creations' }" @click="section = 'creations'">我的创造</button>
  </div>
  <p v-if="status === 'unavailable'" class="leave-warning">这台设备暂时不能读取本地存档，图鉴记录无法显示。</p>

  <template v-if="section === 'discoveries'">
    <div class="journal-bar">
      <p>已发现 <strong>{{ discoveries.length }}</strong> / {{ verified.length }} 种真实鱼类</p>
      <label class="assist-toggle"><input v-model="onlyFound" type="checkbox"> 只看已发现</label>
    </div>
    <div class="journal-layout">
      <div>
        <section v-for="group in groups" :key="group.habitat.id" class="journal-group" :aria-label="group.habitat.name">
          <h2>{{ group.habitat.name }}</h2>
          <p v-if="!group.items.length" class="tool-hint">这里还没有发现。<RouterLink :to="`/fishing/${group.habitat.id}`" class="text-link">去{{ group.habitat.name }}看看</RouterLink></p>
          <div class="species-grid">
            <button v-for="item in group.items" :key="item.id" class="species-card" :class="{ locked: !found.has(item.id), selected: openId === item.id }"
              :aria-pressed="openId === item.id" :disabled="!found.has(item.id)" @click="openId = item.id">
              <PartThumb :design="found.has(item.id) ? speciesDesign(item) : silhouetteDesign(item)" />
              <strong>{{ found.has(item.id) ? item.commonNameZh : '还没遇见' }}</strong>
              <small v-if="found.get(item.id)">第一次：{{ dateFormat.format(new Date(found.get(item.id)!.firstCaughtAt)) }} · {{ found.get(item.id)!.catchCount }} 次</small>
              <small v-else>去{{ group.habitat.name }}钓钓看</small>
            </button>
          </div>
        </section>
      </div>
      <aside class="journal-detail" aria-live="polite">
        <template v-if="opened">
          <CatchCard :species="opened" :discovery="found.get(opened.id) ?? null" :first-discovery="false" save-state="saved" hide-release />
          <button class="button button--muted" @click="inspire(opened.id)">用它的配色去创作</button>
        </template>
        <section v-else class="empty-panel"><span class="empty-icon"><AppIcon name="book" /></span><h2>点一张已发现的卡片</h2><p>可以看它的样子、吃什么、住在哪，还有资料来源。</p></section>
      </aside>
    </div>
  </template>

  <template v-else>
    <div class="journal-bar"><p>原创 <strong>{{ fish.length }}</strong> 条 · 发现彩蛋 <strong>{{ effects.length }}</strong> / {{ effectIds.length }}</p></div>
    <section v-if="!fish.length" class="journal-empty empty-panel"><span class="empty-icon"><AppIcon name="brush" /></span><h2>你的想象，还没画上第一页。</h2><p>完成的原创作品会留在这里，不需要先钓到任何鱼。</p><RouterLink to="/create" class="button">去创造工坊<AppIcon name="arrow" /></RouterLink></section>
    <div v-else class="species-grid species-grid--wide">
      <RouterLink v-for="item in fish" :key="item.id" class="species-card" :to="{ path: '/create', query: { fishId: item.id } }">
        <PartThumb :design="item.design" :paint="textures.get(item.design.paint.colorAssetId ?? '') ?? null" />
        <strong>{{ item.name }}</strong>
        <small>{{ item.activeEffect ? effectInfo[item.activeEffect].label : '原创鱼' }} · {{ dateFormat.format(new Date(item.createdAt)) }}</small>
      </RouterLink>
    </div>
    <h2 class="ocean-list-title">组合彩蛋</h2>
    <ul class="effect-list">
      <li v-for="id in effectIds" :key="id" :class="{ locked: !effectFound.has(id) }">
        <strong>{{ effectFound.has(id) ? effectInfo[id].label : '？？？' }}</strong>
        <span>{{ effectFound.has(id) ? `${effectInfo[id].condition} · ${dateFormat.format(new Date(effectFound.get(id)!.firstDiscoveredAt))} 发现` : '还没发现的组合，试试不同的部件和花纹' }}</span>
      </li>
    </ul>
    <p class="tool-hint">彩蛋是游戏里的趣味设定，不代表真实鱼类的能力。</p>
  </template>
</template>
