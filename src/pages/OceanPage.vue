<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { habitats } from '../catalog/habitats.ts';
import { speciesById, speciesDesign } from '../catalog/species.ts';
import type { Discovery } from '../domain/backup.ts';
import { FISH_LIMIT, VISIBLE_LIMIT } from '../domain/draft.ts';
import { describeSwim, effectInfo, personalityNames } from '../domain/rules.ts';
import type { OceanEntry, OriginalFish, ProfileSettings } from '../domain/types.ts';
import { usePreferences } from '../features/preferences.ts';
import { openDatabase, toStorageError } from '../storage/db.ts';
import { onExternalChange } from '../storage/queue.ts';
import { deleteFish, loadAssets, loadDiscoveries, loadProfile, setVisibleEntries } from '../storage/repository.ts';
import AppIcon from '../components/AppIcon.vue';
import OceanTank, { type FishTextures, type OceanActor } from '../components/OceanTank.vue';
import PageHeading from '../components/PageHeading.vue';
import SeaScene from '../components/SeaScene.vue';

const route = useRoute();
const router = useRouter();
const status = ref<'loading' | 'ready' | 'unavailable'>('loading');
const message = ref('');
const errorText = ref('');
const allFish = shallowRef<OriginalFish[]>([]);
const discoveries = shallowRef<Discovery[]>([]);
const settings = shallowRef<ProfileSettings | null>(null);
const invalidCount = ref(0);
const textures = shallowRef(new Map<string, FishTextures>());
const selectedId = ref<string | null>(null);
const highlightId = ref<string | null>(null);
const confirmDelete = ref(false);
const busy = ref(false);
const tank = ref<InstanceType<typeof OceanTank>>();
const prefs = usePreferences();
const reducedMotion = prefs.reducedMotion;
let db: IDBDatabase | null = null;
let stopExternal: () => void = () => undefined;
let bitmaps: ImageBitmap[] = [];

const visibleIds = computed(() => new Set((settings.value?.visibleEntries ?? []).flatMap((entry) => entry.kind === 'original' ? [entry.fishId] : [])));
const visibleFish = computed(() => (settings.value?.visibleEntries ?? []).flatMap((entry) => entry.kind === 'original' ? allFish.value.filter((fish) => fish.id === entry.fishId) : []));
const visitorKey = (speciesId: string) => `visitor-${speciesId}`;
const visibleVisitors = computed(() => new Set((settings.value?.visibleEntries ?? []).flatMap((entry) => entry.kind === 'visitor' ? [entry.speciesId] : [])));
/** 展示列表顺序里的全部游动对象：原创鱼 + 物种访客。 */
const actors = computed<OceanActor[]>(() => (settings.value?.visibleEntries ?? []).flatMap((entry): OceanActor[] => {
  if (entry.kind === 'original') return allFish.value.filter((fish) => fish.id === entry.fishId);
  const item = speciesById(entry.speciesId);
  return item ? [{ id: visitorKey(item.id), design: speciesDesign(item), revision: 1, activeEffect: null }] : [];
}));
const visitorChoices = computed(() => discoveries.value.flatMap((d) => { const item = speciesById(d.speciesId); return item ? [item] : []; }));
const selectedVisitor = computed(() => selectedId.value?.startsWith('visitor-') ? speciesById(selectedId.value.slice(8)) : null);
const selected = computed(() => allFish.value.find((fish) => fish.id === selectedId.value) ?? null);
const selectedSwim = computed(() => selected.value ? describeSwim(selected.value.design) : null);
const timeFormat = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });
const habitatName = (id: string) => habitats.find((item) => item.id === id)?.name ?? '';

function releaseTextures() { for (const bitmap of bitmaps) bitmap.close(); bitmaps = []; }
async function loadTextures(fish: OriginalFish[]) {
  if (!db) return;
  const blobs = await loadAssets(db, fish.flatMap((item) => [item.design.paint.colorAssetId, item.design.paint.glowAssetId]));
  const decoded = new Map<string, ImageBitmap>();
  for (const [id, blob] of blobs) { try { decoded.set(id, await createImageBitmap(blob)); } catch { /* 损坏的纹理不显示，不影响其他鱼 */ } }
  releaseTextures();
  bitmaps = [...decoded.values()];
  const map = new Map<string, FishTextures>();
  for (const item of fish) map.set(item.id, { color: decoded.get(item.design.paint.colorAssetId ?? '') ?? null, glow: decoded.get(item.design.paint.glowAssetId ?? '') ?? null });
  textures.value = map;
}
async function reload() {
  if (!db) return;
  const profile = await loadProfile(db);
  allFish.value = profile.fish; settings.value = profile.settings; invalidCount.value = profile.invalidFish;
  discoveries.value = await loadDiscoveries(db);
  if (selectedId.value && !profile.fish.some((fish) => fish.id === selectedId.value)) selectedId.value = null;
  await loadTextures(visibleFish.value);
}

onMounted(async () => {
  try { db = await openDatabase(); } catch { status.value = 'unavailable'; return; }
  try { await reload(); } catch (cause) { errorText.value = toStorageError(cause).message; }
  status.value = 'ready';
  stopExternal = onExternalChange(() => { void reload(); });
  const newId = typeof route.query.new === 'string' ? route.query.new : null;
  if (newId) {
    if (visibleIds.value.has(newId)) {
      highlightId.value = newId; selectedId.value = newId;
      message.value = `「${allFish.value.find((fish) => fish.id === newId)?.name}」游进了你的海洋！`;
      await nextTick();
      tank.value?.startCamera(newId);
    } else if (allFish.value.some((fish) => fish.id === newId)) {
      selectedId.value = newId;
    } else message.value = '没有找到刚才那条鱼，可能已经删除。';
    void router.replace({ path: '/ocean' });
  }
});
onBeforeUnmount(() => { stopExternal(); releaseTextures(); db?.close(); });

async function toggleVisible(fish: OriginalFish) {
  if (!db || !settings.value || busy.value) return;
  const entries = settings.value.visibleEntries;
  const showing = visibleIds.value.has(fish.id);
  const next: OceanEntry[] = showing ? entries.filter((entry) => !(entry.kind === 'original' && entry.fishId === fish.id)) : [...entries, { kind: 'original', fishId: fish.id }];
  await saveEntries(next, showing);
}
async function toggleVisitor(speciesId: string) {
  if (!settings.value) return;
  const entries = settings.value.visibleEntries;
  const showing = visibleVisitors.value.has(speciesId);
  const next: OceanEntry[] = showing ? entries.filter((entry) => !(entry.kind === 'visitor' && entry.speciesId === speciesId)) : [...entries, { kind: 'visitor', speciesId }];
  await saveEntries(next, showing);
}
async function saveEntries(next: OceanEntry[], removing: boolean) {
  if (!db || !settings.value || busy.value) return;
  if (!removing && next.length > VISIBLE_LIMIT) { errorText.value = `同屏最多展示 ${VISIBLE_LIMIT} 条（包括物种访客），先收起一条吧。收起不会删除作品。`; return; }
  busy.value = true; errorText.value = '';
  try { settings.value = await setVisibleEntries(db, next, settings.value.revision); await loadTextures(visibleFish.value); }
  catch (cause) { errorText.value = toStorageError(cause).message; await reload(); }
  finally { busy.value = false; }
}
async function removeSelected() {
  const fish = selected.value;
  if (!db || !fish || busy.value) return;
  busy.value = true; errorText.value = '';
  try {
    await deleteFish(db, fish.id, fish.revision);
    message.value = `已删除「${fish.name}」。已发现的真实鱼类记录不受影响。`;
    selectedId.value = null; confirmDelete.value = false;
    await reload();
  } catch (cause) { errorText.value = `删除没有完成：${toStorageError(cause).message}`; await reload(); }
  finally { busy.value = false; }
}
function select(id: string | null) { selectedId.value = id; confirmDelete.value = false; if (id !== highlightId.value) highlightId.value = null; }
function edit(fish: OriginalFish) { void router.push({ path: '/create', query: { fishId: fish.id } }); }
</script>

<template>
  <PageHeading eyebrow="小小水族箱 / MY OCEAN" title="每次回来，都能相遇。" description="你放进海洋的原创鱼都在这里。点一条鱼，看看它的名字和性格。" />
  <p v-if="message" class="session-notice" role="status">{{ message }}</p>
  <p v-if="errorText" class="leave-warning" role="alert">{{ errorText }}</p>
  <p v-if="invalidCount" class="session-notice">有 {{ invalidCount }} 条作品记录无法读取，已原样保留，没有显示。</p>
  <div v-if="status === 'unavailable'" class="ocean-layout">
    <SeaScene />
    <section class="empty-panel"><h2>这台设备暂时不能读取本地存档</h2><p>可以先在工坊里创作，并用“导出这条鱼”保存一份临时备份。</p><RouterLink to="/create" class="button">去创造工坊<AppIcon name="arrow" /></RouterLink></section>
  </div>
  <div v-else-if="status === 'ready' && !allFish.length && !visitorChoices.length" class="ocean-layout">
    <SeaScene />
    <section class="empty-panel"><span class="empty-icon"><AppIcon name="fish" /></span><h2>第一位小伙伴，会是什么样子？</h2><p>这是示范海洋，示范鱼不记入收藏。<br />在工坊完成作品后，它会游到这里。</p><RouterLink to="/create" class="button">去创造一条鱼<AppIcon name="arrow" /></RouterLink></section>
  </div>
  <div v-else-if="status === 'ready'" class="ocean-layout ocean-layout--live">
    <OceanTank ref="tank" :fish="actors" :textures="textures" :selected-id="selectedId" :highlight-id="highlightId" :reduced-motion="reducedMotion"
      @select="select" @camera-done="() => undefined" />
    <section class="ocean-panel" aria-label="我的作品">
      <p class="ocean-counts">展示 {{ actors.length }} / {{ VISIBLE_LIMIT }} · 已保存 {{ allFish.length }} / {{ FISH_LIMIT }}</p>
      <article v-if="selected" class="fish-card" aria-live="polite">
        <span class="eyebrow">{{ selected.activeEffect ? effectInfo[selected.activeEffect].label : '原创鱼' }}</span>
        <h2>{{ selected.name }}</h2>
        <dl>
          <div><dt>性格</dt><dd>{{ personalityNames[selected.personality] }}</dd></div>
          <div><dt>游法</dt><dd>{{ selectedSwim?.style.name }}</dd></div>
          <div><dt>喜欢去</dt><dd>{{ habitatName(selected.preferredHabitat) }}</dd></div>
          <div><dt>创建于</dt><dd>{{ timeFormat.format(new Date(selected.createdAt)) }}</dd></div>
        </dl>
        <p class="tool-hint">性格、游法和喜爱的地方都是游戏设定。</p>
        <div class="fish-card-actions">
          <button class="button" @click="edit(selected)">再次编辑</button>
          <button class="button button--muted" :disabled="busy" @click="toggleVisible(selected)">{{ visibleIds.has(selected.id) ? '收起（不删除）' : '放回海洋' }}</button>
          <button v-if="!confirmDelete" class="button button--muted chip-button--danger" :disabled="busy" @click="confirmDelete = true">删除…</button>
        </div>
        <div v-if="confirmDelete" class="confirm-box" role="alert">
          <p>确定删除「{{ selected.name }}」吗？删除后无法撤销；建议先在设置里导出备份。</p>
          <div><button class="button" :disabled="busy" @click="removeSelected">删除</button><button class="button button--muted" @click="confirmDelete = false">取消</button></div>
        </div>
      </article>
      <article v-else-if="selectedVisitor" class="fish-card" aria-live="polite">
        <span class="eyebrow">物种访客</span>
        <h2>{{ selectedVisitor.commonNameZh }}</h2>
        <p class="scientific"><i>{{ selectedVisitor.scientificName }}</i></p>
        <p class="tool-hint">这是图鉴里的示意展示，不是被带走的野生鱼。钓到的鱼都已经放生了。</p>
        <div class="fish-card-actions">
          <RouterLink class="button" :to="{ path: '/journal' }">在图鉴里看它</RouterLink>
          <button class="button button--muted" :disabled="busy" @click="toggleVisitor(selectedVisitor.id)">请它离开</button>
        </div>
      </article>
      <p v-else class="tool-hint">点海里的一条鱼，或在下面的列表里选一条。</p>
      <h3 class="ocean-list-title">全部作品</h3>
      <ul class="ocean-list">
        <li v-for="fish in allFish" :key="fish.id" :class="{ selected: fish.id === selectedId }">
          <button class="ocean-list-name" :aria-pressed="fish.id === selectedId" @click="select(fish.id)">{{ fish.name }}<small>{{ visibleIds.has(fish.id) ? '在海里' : '已收起' }}</small></button>
          <button class="chip-button" :disabled="busy" @click="toggleVisible(fish)">{{ visibleIds.has(fish.id) ? '收起' : '展示' }}</button>
        </li>
      </ul>
      <template v-if="visitorChoices.length">
        <h3 class="ocean-list-title">物种访客</h3>
        <p class="tool-hint">钓到过的真实鱼类可以来做客，每种最多一名，和原创鱼一起算在同屏 {{ VISIBLE_LIMIT }} 条里。</p>
        <ul class="ocean-list">
          <li v-for="item in visitorChoices" :key="item.id" :class="{ selected: selectedId === visitorKey(item.id) }">
            <button class="ocean-list-name" :disabled="!visibleVisitors.has(item.id)" @click="select(visitorKey(item.id))">{{ item.commonNameZh }}<small>{{ visibleVisitors.has(item.id) ? '正在做客' : '没有邀请' }}</small></button>
            <button class="chip-button" :disabled="busy" @click="toggleVisitor(item.id)">{{ visibleVisitors.has(item.id) ? '请它离开' : '邀请做客' }}</button>
          </li>
        </ul>
      </template>
      <RouterLink to="/create" class="text-link">再创造一条<AppIcon name="arrow" /></RouterLink>
    </section>
  </div>
</template>
