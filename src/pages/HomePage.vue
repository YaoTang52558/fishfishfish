<script setup lang="ts">
import AppIcon from '../components/AppIcon.vue';
import SeaScene from '../components/SeaScene.vue';

const entries = [
  { to: '/create', title: '创造鱼', subtitle: '让想象长出尾巴', description: '拼一拼，画一画，创造一条属于你的鱼。', icon: 'brush', color: 'peach', number: '01' },
  { to: '/fishing/reef-edge', title: '去钓鱼', subtitle: '和海洋打个招呼', description: '选一片喜欢的水域，发现真实鱼类。', icon: 'hook', color: 'sage', number: '02' },
  { to: '/ocean', title: '我的海洋', subtitle: '每次回来，都能相遇', description: '这里会收藏你的作品，留住小小创意。', icon: 'waves', color: 'sand', number: '03' },
] as const;
</script>

<template>
  <section class="home-hero">
    <div class="hero-copy">
      <p class="eyebrow"><span class="tiny-line" />欢迎来到我的海洋</p>
      <h1>每条鱼，<br />都有自己的<span class="accent-word">样子。</span></h1>
      <p class="hero-description">一笔颜色，一点想象。<br />从你喜欢的地方开始，遇见海洋里的小小惊喜。</p>
      <span class="hero-caption"><AppIcon name="spark" />为好奇心留一片海</span>
    </div>
    <div class="hero-art"><SeaScene /><span class="art-caption">小小创意，会有大大的海洋。</span></div>
  </section>

  <section aria-labelledby="entry-title" class="entry-section">
    <div class="section-heading"><h2 id="entry-title">今天，想从哪里开始？</h2><span>三个入口，随心选择</span></div>
    <div class="entry-grid">
      <RouterLink v-for="entry in entries" :key="entry.to" :to="entry.to" class="entry-card" :class="`entry-card--${entry.color}`">
        <div class="entry-top"><span class="entry-icon"><AppIcon :name="entry.icon" /></span><span class="entry-number">{{ entry.number }}</span></div>
        <h3>{{ entry.title }}</h3><p class="entry-subtitle">{{ entry.subtitle }}</p><p class="entry-description">{{ entry.description }}</p>
        <span class="entry-bottom">看看这里<AppIcon name="arrow" /></span>
      </RouterLink>
    </div>
  </section>
  <aside class="journal-invite"><div><AppIcon name="book" /><span>把每一次发现，留在图鉴里。</span></div><RouterLink to="/journal" class="text-link">打开图鉴<AppIcon name="arrow" /></RouterLink></aside>
</template>
