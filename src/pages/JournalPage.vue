<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { Discovery } from '../domain/backup.ts';
import { effectIds } from '../domain/draft.ts';
import { effectInfo } from '../domain/rules.ts';
import type { EffectDiscovery, OriginalFish } from '../domain/types.ts';
import { openDatabase } from '../storage/db.ts';
import { onExternalChange } from '../storage/queue.ts';
import { loadAssets, loadDiscoveries, loadProfile } from '../storage/repository.ts';
import AppIcon from '../components/AppIcon.vue';
import OceanLibrary from '../components/OceanLibrary.vue';
import PageHeading from '../components/PageHeading.vue';
import PartThumb from '../components/PartThumb.vue';

const route = useRoute();
const section = ref<'discoveries' | 'creations'>(route.query.tab === 'creations' ? 'creations' : 'discoveries');
const status = ref<'loading' | 'ready' | 'unavailable'>('loading');
const discoveries = shallowRef<Discovery[]>([]);
const fish = shallowRef<OriginalFish[]>([]);
const effects = shallowRef<EffectDiscovery[]>([]);
const textures = shallowRef(new Map<string, ImageBitmap>());
let stop: () => void = () => undefined;
let alive = true, generation = 0;
const dateFormat = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' });

const effectFound = computed(() => new Map(effects.value.map((item) => [item.effectId, item])));

async function load() {
  const token = ++generation;
  let db: IDBDatabase | null = null;
  const map = new Map<string, ImageBitmap>();
  let transferred = false;
  try {
    db = await openDatabase();
    const profile = await loadProfile(db), list = await loadDiscoveries(db);
    if (!alive || token !== generation) return;
    discoveries.value = list; fish.value = profile.fish; effects.value = profile.effects;
    // Real-fish observation cards need no full-resolution original painting textures.
    if (section.value === 'creations') {
      const blobs = await loadAssets(db, profile.fish.flatMap(item => [item.design.paint.colorAssetId, item.design.paint.glowAssetId]));
      for (const [id, blob] of blobs) { try { map.set(id, await createImageBitmap(blob)); } catch { /* Keep damaged assets in storage; show the remaining design. */ } }
    }
    if (!alive || token !== generation) return;
    for (const bitmap of textures.value.values()) bitmap.close();
    textures.value = map; transferred = true; status.value = 'ready';
  } catch { if (alive && token === generation) status.value = 'unavailable'; }
  finally { db?.close(); if (!transferred) for (const bitmap of map.values()) bitmap.close(); }
}
watch(section, () => { void load(); });
onMounted(() => { void load(); stop = onExternalChange(() => { void load(); }); });
onBeforeUnmount(() => { alive = false; generation++; stop(); for (const bitmap of textures.value.values()) bitmap.close(); });
</script>

<template>
  <PageHeading eyebrow="发现与收藏 / JOURNAL" title="每一个小发现，都值得记住。" description="海洋里的真实鱼类，和你想象中的原创作品，各有自己的位置。" />
  <div class="segmented journal-tabs" aria-label="图鉴分区">
    <button :aria-pressed="section === 'discoveries'" :class="{ selected: section === 'discoveries' }" @click="section = 'discoveries'">🐟 鱼朋友</button>
    <button :aria-pressed="section === 'creations'" :class="{ selected: section === 'creations' }" @click="section = 'creations'">我的创造</button>
  </div>
  <p v-if="status === 'unavailable'" class="leave-warning">这台设备暂时不能读取本地存档，图鉴记录无法显示。</p>

  <template v-if="section === 'discoveries'">
    <OceanLibrary :discoveries="discoveries" :initial-id="typeof route.query.observe === 'string' ? route.query.observe : undefined" />
  </template>

  <template v-else>
    <div class="journal-bar"><p>原创 <strong>{{ fish.length }}</strong> 条 · 发现彩蛋 <strong>{{ effects.length }}</strong> / {{ effectIds.length }}</p></div>
    <section v-if="!fish.length" class="journal-empty empty-panel"><span class="empty-icon"><AppIcon name="brush" /></span><h2>你的想象，还没画上第一页。</h2><p>完成的原创作品会留在这里，不需要先钓到任何鱼。</p><RouterLink to="/create" class="button">去创造工坊<AppIcon name="arrow" /></RouterLink></section>
    <div v-else class="species-grid species-grid--wide">
      <RouterLink v-for="item in fish" :key="item.id" class="species-card" :to="{ path: '/create', query: { fishId: item.id } }">
        <PartThumb :design="item.design" :paint="textures.get(item.design.paint.colorAssetId ?? '') ?? null" :glow="textures.get(item.design.paint.glowAssetId ?? '') ?? null" />
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

<style scoped>.page-heading{margin:0 0 14px}.page-heading :deep(h1){font-size:26px;margin:6px 0}.page-heading :deep(.page-description){font-size:13px}.journal-tabs{margin-bottom:12px}</style>
<style scoped>.page-heading :deep(.eyebrow){display:none}</style>
