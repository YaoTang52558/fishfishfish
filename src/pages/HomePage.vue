<script setup lang="ts">
import AppIcon from '../components/AppIcon.vue';
import SeaScene from '../components/SeaScene.vue';
import { onMounted, onBeforeUnmount, shallowRef } from 'vue';
import PartThumb from '../components/PartThumb.vue';
import type { FishDesign } from '../domain/types.ts';
import { openDatabase } from '../storage/db.ts';
import { loadAssets, loadProfile } from '../storage/repository.ts';
import { onExternalChange } from '../storage/queue.ts';

const recent = shallowRef<{ name: string; design: FishDesign; to: string; draft: boolean } | null>(null);
const paint = shallowRef<ImageBitmap | null>(null), glow = shallowRef<ImageBitmap | null>(null);
let alive = true, ticket = 0, stop = () => {};
async function load() {
  const token = ++ticket; const images: ImageBitmap[] = []; let db: IDBDatabase | null = null;
  try {
    db = await openDatabase(); const profile = await loadProfile(db);
    const fish = [...profile.fish].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    const item = profile.draft ? { name: profile.draft.name || '没画完的小伙伴', design: profile.draft.design, to: '/create', draft: true } : fish ? { name: fish.name, design: fish.design, to: '/create?fishId=' + encodeURIComponent(fish.id), draft: false } : null;
    let color: ImageBitmap | null = null, light: ImageBitmap | null = null;
    if (item) { const blobs = await loadAssets(db, [item.design.paint.colorAssetId, item.design.paint.glowAssetId]);
      for (const [id, blob] of blobs) { try { const image = await createImageBitmap(blob); images.push(image); if (id === item.design.paint.colorAssetId) color = image; if (id === item.design.paint.glowAssetId) light = image; } catch { /* Thumbnail failure does not remove the saved design. */ } }
    }
    if (!alive || token !== ticket) { images.forEach(b => b.close()); return; }
    paint.value?.close(); glow.value?.close(); recent.value = item; paint.value = color; glow.value = light;
  } catch { images.forEach(b => b.close()); } finally { db?.close(); }
}
onMounted(() => { void load(); stop = onExternalChange(() => void load()); });
onBeforeUnmount(() => { alive = false; ticket++; stop(); paint.value?.close(); glow.value?.close(); });

const entries = [
  { to: '/create', title: '创造鱼', subtitle: '让想象长出尾巴', description: '拼一拼，画一画，创造一条属于你的鱼。', icon: 'brush', color: 'peach', number: '01' },
  { to: '/fishing/reef-edge', title: '去钓鱼', subtitle: '和海洋打个招呼', description: '选一片喜欢的水域，发现真实鱼类。', icon: 'hook', color: 'sage', number: '02' },
  { to: '/ocean', title: '我的海洋', subtitle: '每次回来，都能相遇', description: '这里会收藏你的作品，留住小小创意。', icon: 'waves', color: 'sand', number: '03' },
] as const;
</script>

<template>
  <section class="home-hero home-start">
    <div class="hero-copy">
      <p class="eyebrow"><span class="tiny-line" />欢迎来到我的海洋</p>
      <h1>造一条<br />你想象的鱼。</h1>
      <p class="hero-description">换尾巴，画花纹，捏一捏。<br />让它游进自己的海洋。</p>
      <RouterLink to="/create" class="button home-create">🖌️ {{ recent?.draft ? '继续画这条鱼' : '造一条鱼' }}<AppIcon name="arrow" /></RouterLink>
    </div>
    <RouterLink v-if="recent" :to="recent.to" class="home-recent" :aria-label="'继续创作：' + recent.name"><span>{{ recent.draft ? '接着画' : '给它一个新想法' }}</span><PartThumb :design="recent.design" :paint="paint" :glow="glow"/><strong>{{ recent.name }}</strong><b>🖌️ 继续我的鱼 →</b></RouterLink>
    <div v-else class="hero-art"><SeaScene /><span class="art-caption">你的鱼，也能游到这里。</span></div>
  </section>

  <section aria-labelledby="entry-title" class="entry-section">
    <div class="section-heading"><h2 id="entry-title">也可以去看看</h2></div>
    <div class="entry-grid">
      <RouterLink v-for="entry in entries.filter(e => e.to !== '/create')" :key="entry.to" :to="entry.to" class="entry-card" :class="`entry-card--${entry.color}`">
        <div class="entry-top"><span class="entry-icon"><AppIcon :name="entry.icon" /></span><span class="entry-number">{{ entry.number }}</span></div>
        <h3>{{ entry.title }}</h3><p class="entry-subtitle">{{ entry.subtitle }}</p>
      </RouterLink>
    </div>
  </section>
  <aside class="journal-invite"><div><AppIcon name="book" /><span>把每一次发现，留在图鉴里。</span></div><RouterLink to="/journal" class="text-link">打开图鉴<AppIcon name="arrow" /></RouterLink></aside>
</template>
<style scoped>.home-start{gap:30px;margin:0 0 22px}.home-start h1{font-size:clamp(32px,4vw,46px);line-height:1.3;margin:12px 0}.home-start .hero-caption{display:none}.home-start .sea-scene{height:270px;transform:none}.home-create{min-height:64px;font-size:22px;margin-top:20px;border-radius:20px}.home-recent{display:flex;flex-direction:column;align-items:center;padding:16px;border:2px solid #bbd8cb;border-radius:26px;background:#e0f0e9;min-width:0}.home-recent>span{font-size:14px;color:#456a5b}.home-recent :deep(canvas){width:100%;height:170px}.home-recent strong{font-size:22px;overflow-wrap:anywhere;max-width:100%;text-align:center}.home-recent b{display:grid;place-items:center;min-height:56px;font-size:17px;color:#175f57}.entry-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.entry-card{padding:16px 20px}.entry-top{margin-bottom:10px}.entry-number{display:none}.section-heading{margin-bottom:12px}.journal-invite{margin-top:10px}@media(max-width:760px){.home-start{gap:16px}.home-start .sea-scene{height:220px}.home-create{font-size:19px}.home-start{grid-template-columns:1fr 1fr}}@media(max-width:520px){.home-start{grid-template-columns:1fr;gap:12px}.home-start h1 br{display:none}.home-start .sea-scene{height:150px}.home-start .hero-copy{padding:0}.home-recent :deep(canvas){height:140px}.home-create{margin-top:12px;width:100%}.entry-card h3{font-size:20px}.entry-card{padding:12px}.entry-icon{width:40px;height:40px}}
</style>
