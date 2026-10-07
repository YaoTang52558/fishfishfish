<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
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
import FishShowcase from '../components/FishShowcase.vue';
import { fishThumbnail } from '../rendering/fishThumbnail.ts';
import { exportFishCard } from '../rendering/fishCard.ts';
import CreativeVolume from '../components/CreativeVolume.vue';
import MarineExplore from '../components/MarineExplore.vue';
const CreativeOcean3d = defineAsyncComponent(() => import('../components/CreativeOcean3d.vue'));
import LocalOceanDisplay from '../components/LocalOceanDisplay.vue';

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
const thumbnails = shallowRef(new Map<string, { key: string; url: string; incomplete: boolean }>());
const selectedId = ref<string | null>(null);
const highlightId = ref<string | null>(null);
const arrivalName = ref<string | null>(null);
const showcaseOpen = ref(false);
const volumeOcean = ref(false);
const filter = ref<'all' | 'visible' | 'hidden'>('all'), sort = ref<'created' | 'recent' | 'name'>('created'), search = ref(''), oceanHabitat = ref('reef-edge');
const collection = computed(() => allFish.value.filter(f => (filter.value === 'all' || visibleIds.value.has(f.id) === (filter.value === 'visible')) && f.name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())).slice().sort((a, b) => sort.value === 'recent' ? b.updatedAt.localeCompare(a.updatedAt) : sort.value === 'name' ? a.name.localeCompare(b.name, 'zh-CN') : a.createdAt.localeCompare(b.createdAt)));
let arrivalTimer: ReturnType<typeof setTimeout> | null = null;
const confirmDelete = ref(false);
const busy = ref(false);
const tank = ref<InstanceType<typeof OceanTank>>();
const prefs = usePreferences();
const reducedMotion = prefs.reducedMotion;
let db: IDBDatabase | null = null;
let stopExternal: () => void = () => undefined;
let bitmaps: ImageBitmap[] = [];
let textureTicket = 0, alive = true;

const visibleIds = computed(() => new Set((settings.value?.visibleEntries ?? []).flatMap((entry) => entry.kind === 'original' ? [entry.fishId] : [])));
const visibleFish = computed(() => (settings.value?.visibleEntries ?? []).flatMap((entry) => entry.kind === 'original' ? allFish.value.filter((fish) => fish.id === entry.fishId) : []));
const playableIds = computed(() => visibleFish.value.map(fish => fish.id));
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
  const token = ++textureTicket;
  const keyOf = (item: OriginalFish) => `${item.revision}|${item.design.paint.colorAssetId}|${item.design.paint.glowAssetId}`;
  const needed = fish.filter(item => visibleIds.value.has(item.id) || thumbnails.value.get(item.id)?.key !== keyOf(item));
  const blobs = await loadAssets(db, needed.flatMap(item => [item.design.paint.colorAssetId, item.design.paint.glowAssetId]));
  const owned: ImageBitmap[] = [];
  const map = new Map<string, FishTextures>();
  const previews = new Map<string, { key: string; url: string; incomplete: boolean }>();
  try {
    for (const item of fish) {
      if (!alive || token !== textureTicket) return;
      const cached = thumbnails.value.get(item.id), visible = visibleIds.value.has(item.id);
      if (!visible && cached?.key === keyOf(item)) { previews.set(item.id, cached); continue; }
      const images: ImageBitmap[] = [];
      const decode = async (id: string | null) => {
        const blob = id ? blobs.get(id) : null;
        if (!blob) return null;
        try { const bitmap = await createImageBitmap(blob); images.push(bitmap); owned.push(bitmap); return bitmap; }
        catch { return null; }
      };
      const color = await decode(item.design.paint.colorAssetId), glow = await decode(item.design.paint.glowAssetId);
      const incomplete = Boolean((item.design.paint.colorAssetId && !color) || (item.design.paint.glowAssetId && !glow));
      previews.set(item.id, cached?.key === keyOf(item) && cached.incomplete === incomplete ? cached : {
        key: keyOf(item), url: fishThumbnail(item.design, color, glow, item.revision), incomplete,
      });
      if (visible) map.set(item.id, { color, glow });
      else for (const image of images) { image.close(); owned.splice(owned.indexOf(image), 1); }
    }
    if (!alive || token !== textureTicket) return;
    releaseTextures(); bitmaps = owned.splice(0);
    textures.value = map; thumbnails.value = previews;
  } finally { for (const image of owned) image.close(); }
}
async function reload() {
  if (!db) return;
  const profile = await loadProfile(db);
  allFish.value = profile.fish; settings.value = profile.settings; invalidCount.value = profile.invalidFish;
  discoveries.value = await loadDiscoveries(db);
  if (selectedId.value && !profile.fish.some((fish) => fish.id === selectedId.value)) selectedId.value = null;
  await loadTextures(profile.fish);
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
      arrivalName.value = allFish.value.find(fish => fish.id === newId)?.name ?? null;
      arrivalTimer = setTimeout(() => { arrivalName.value = null; }, 5500);
      message.value = `「${allFish.value.find((fish) => fish.id === newId)?.name}」游进了你的海洋！`;
      await nextTick();
      tank.value?.startCamera(newId, true);
    } else if (allFish.value.some((fish) => fish.id === newId)) {
      selectedId.value = newId;
    } else message.value = '没有找到刚才那条鱼，可能已经删除。';
    void router.replace({ path: '/ocean' });
  }
});
onBeforeUnmount(() => { alive = false; textureTicket++; if (arrivalTimer) clearTimeout(arrivalTimer); stopExternal(); releaseTextures(); thumbnails.value.clear(); db?.close(); });

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
  try { settings.value = await setVisibleEntries(db, next, settings.value.revision); await loadTextures(allFish.value); }
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
function chooseArtwork(fish: OriginalFish) {
  select(fish.id);
  const scene = tank.value?.$el as HTMLElement | undefined;
  scene?.scrollIntoView({ behavior: reducedMotion.value ? 'auto' : 'smooth', block: 'start' });
  if (visibleIds.value.has(fish.id)) tank.value?.startCamera(fish.id);
}
function edit(fish: OriginalFish) { void router.push({ path: '/create', query: { fishId: fish.id } }); }
async function card() {
  if (!selected.value || !db || busy.value) return;
  const fish = selected.value; busy.value = true; errorText.value = ''; const images: ImageBitmap[] = [];
  try {
    const assets = await loadAssets(db, [fish.design.paint.colorAssetId, fish.design.paint.glowAssetId]);
    const decode = async (id: string | null) => { if (!id) return null; const blob = assets.get(id); if (!blob) throw new Error('笔迹未完整读取，暂不导出。请返回后重试。'); const image = await createImageBitmap(blob); images.push(image); return image; };
    const color = await decode(fish.design.paint.colorAssetId), glow = await decode(fish.design.paint.glowAssetId);
    if (alive) { await exportFishCard(fish, color, glow); message.value = '作品鱼卡已生成。图片可以分享；换设备继续画，请到设置导出备份。'; }
  } catch (cause) { if (alive) errorText.value = cause instanceof Error ? cause.message : '图片导出没有完成。'; }
  finally { images.forEach(i => i.close()); if (alive) busy.value = false; }
}
</script>

<template>
  <PageHeading eyebrow="自己的海洋 / MY OCEAN" title="这是你创造的海洋。" description="点自己的鱼，近看每一笔，或陪它玩一个泡泡。想怎么创造，都可以。" />
  <p v-if="message" class="session-notice" role="status">{{ message }}</p>
  <p v-if="errorText" class="leave-warning" role="alert">{{ errorText }}</p>
  <div v-if="status === 'ready'" class="ocean-view-switch" role="group" aria-label="海洋画面"><button class="button button--muted" :aria-pressed="!volumeOcean" @click="volumeOcean = false">🌊 画出来的海洋</button><button class="button button--muted" :aria-pressed="volumeOcean" @click="volumeOcean = true">🌀 立体海洋样板</button><LocalOceanDisplay :fish="actors" :textures="textures" @change="showcaseOpen = $event" /></div>
  <p v-if="invalidCount" class="session-notice">有 {{ invalidCount }} 条作品记录无法读取，已原样保留，没有显示。</p>
  <div v-if="status === 'unavailable'" class="ocean-layout">
    <SeaScene />
    <section class="empty-panel"><h2>这台设备暂时不能读取本地存档</h2><p>可以先在工坊里创作，并用“导出这条鱼”保存一份临时备份。</p><RouterLink to="/create" class="button">去创造工坊<AppIcon name="arrow" /></RouterLink></section>
  </div>
  <div v-else-if="status === 'ready' && !allFish.length && !visitorChoices.length" class="ocean-layout">
    <OceanTank :fish="[]" :textures="textures" :selected-id="null" :highlight-id="null" :reduced-motion="reducedMotion" />
    <section class="empty-panel"><span class="empty-icon"><AppIcon name="fish" /></span><h2>第一位小伙伴，会是什么样子？</h2><p>海洋已经准备好啦。<br />在工坊完成自己的鱼，它就会游到这里。</p><RouterLink to="/create" class="button">去创造一条鱼<AppIcon name="arrow" /></RouterLink></section>
  </div>
  <div v-else-if="status === 'ready'" class="ocean-layout ocean-layout--live">
    <CreativeOcean3d v-if="volumeOcean" :fish="actors" :textures="textures" :paused="showcaseOpen" @select="select" @fallback="volumeOcean = false; message = '立体画面暂时不可用，已经回到画出来的海洋。'"><CreativeVolume v-if="selected" :design="selected.design" :name="selected.name" :paint="textures.get(selected.id)?.color" :glow="textures.get(selected.id)?.glow" @opened="showcaseOpen = true" @closed="showcaseOpen = false" /></CreativeOcean3d>
    <OceanTank v-else ref="tank" :fish="actors" :textures="textures" :selected-id="selectedId" :highlight-id="highlightId" :reduced-motion="reducedMotion" :arrival-name="arrivalName" :paused="showcaseOpen" :playable-ids="playableIds" :selected-name="selected?.name"
      @select="select" @dismiss-arrival="arrivalName = null" @camera-done="() => undefined" @theme="oceanHabitat = $event">
      <template #actions>
        <FishShowcase v-if="selected" :design="selected.design" :name="selected.name" :paint="textures.get(selected.id)?.color" :glow="textures.get(selected.id)?.glow" :glow-version="selected.revision" :effect="selected.activeEffect" @opened="showcaseOpen = true" @closed="showcaseOpen = false" />
        <CreativeVolume v-if="selected" :design="selected.design" :name="selected.name" :paint="textures.get(selected.id)?.color" :glow="textures.get(selected.id)?.glow" @opened="showcaseOpen = true" @closed="showcaseOpen = false" />
        <MarineExplore :habitat="oceanHabitat" @change="showcaseOpen = $event" />
        <button v-if="selected && visibleIds.has(selected.id)" class="button button--muted" @click="tank?.startCamera(selected.id)">🐟 找这条鱼</button>
      </template>
    </OceanTank>
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
          <button class="button button--muted" :disabled="busy" @click="card">🖼️ 保存作品鱼卡</button>
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
      <div class="ocean-collection">
      <h3 class="ocean-list-title">🐟 我的鱼 · 点图选一条</h3>
      <div class="collection-tools"><div role="group" aria-label="作品范围"><button v-for="f in (['all', 'visible', 'hidden'] as const)" :key="f" :aria-pressed="filter === f" @click="filter = f">{{ f === 'all' ? '🐟 全部' : f === 'visible' ? '🌊 在海里' : '💤 已收起' }}</button></div><label>找名字<input v-model="search" type="search" maxlength="60" placeholder="鱼的名字"></label><label>排列<select v-model="sort"><option value="created">创作顺序</option><option value="recent">最近修改</option><option value="name">名字</option></select></label></div>
      <p v-if="!collection.length" role="status">这里暂时没有作品。试试「全部」或清掉名字。</p>
      <ul class="ocean-list ocean-list--art" aria-label="自己的鱼作品卡">
        <li v-for="fish in collection" :key="fish.id" :class="{ selected: fish.id === selectedId }">
          <button class="ocean-list-name" :aria-pressed="fish.id === selectedId" :aria-label="`${fish.name}，${visibleIds.has(fish.id) ? '在海里，点图找鱼' : '已收起，点图选中'}`" @click="chooseArtwork(fish)">
            <img v-if="thumbnails.get(fish.id)?.url" :src="thumbnails.get(fish.id)?.url" alt="" width="240" height="144" />
            <span v-else class="ocean-art-placeholder" aria-hidden="true">🐟</span>
            <span class="ocean-art-name">{{ fish.name }}<span v-if="fish.id === selectedId" aria-hidden="true"> ✓</span></span>
            <small>{{ thumbnails.get(fish.id)?.incomplete ? '笔迹暂未读到' : visibleIds.has(fish.id) ? '🌊 在海里' : '💤 已收起' }}</small>
          </button>
          <button class="chip-button" :aria-label="`${visibleIds.has(fish.id) ? '收起' : '放回海洋'}：${fish.name}`" :disabled="busy" @click="toggleVisible(fish)">{{ visibleIds.has(fish.id) ? '💤 收起' : '🌊 放回海洋' }}</button>
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
      </div>
    </section>
  </div>
</template>

<style scoped>
.ocean-layout--live{grid-template-columns:minmax(0,1fr);gap:18px}.ocean-layout--live .ocean-panel{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}.ocean-counts{grid-row:1;margin-bottom:0}.ocean-collection{grid-row:2;min-width:0}.ocean-collection>.ocean-list-title:first-child{margin-top:0}.fish-card{border-top:1px solid var(--line);padding-top:18px}
.ocean-list--art{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;max-height:440px;padding:3px 3px 8px}.ocean-list--art li{display:flex;flex-direction:column;align-items:stretch;gap:6px;min-width:0}.ocean-list--art .ocean-list-name{position:relative;padding:0 0 10px;overflow:hidden;text-align:center;border:2px solid #d5e3d8;background:#f6faf1;min-height:156px;flex:none}.ocean-list--art li.selected .ocean-list-name{border-color:#447c66;box-shadow:0 0 0 2px #c1dbc3;background:#edf4e4}.ocean-list--art img,.ocean-art-placeholder{display:block;width:100%;height:112px;object-fit:contain;background:#d8ece4}.ocean-art-placeholder{line-height:112px;font-size:42px}.ocean-art-name{display:block;margin:8px 6px 3px;font-size:15px;font-weight:700;color:#2b5747}.ocean-list--art .chip-button{min-height:44px;align-self:stretch;font-size:12px}.ocean-list-name:focus-visible{outline:3px solid #deab49;outline-offset:2px}
@media(max-width:760px){.ocean-list--art{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ocean-panel{padding:14px}.ocean-art-name{font-size:13px}}
</style>
<style scoped>.collection-tools{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px}.collection-tools>div{display:flex;flex-wrap:wrap;gap:6px}.collection-tools button,.collection-tools input,.collection-tools select{min-height:44px;border:1px solid #c5dacc;border-radius:12px;background:#f6faf1;padding:8px 12px;color:#315c50;font:inherit;font-size:13px}.collection-tools button[aria-pressed=true]{background:#326d56;color:white}.collection-tools label{display:flex;align-items:center;gap:8px;font-size:12px}.collection-tools input{width:160px}@media(max-width:480px){.collection-tools input{width:130px}}</style>
