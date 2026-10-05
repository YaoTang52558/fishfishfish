<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import AppIcon from './components/AppIcon.vue';
import { initPreferences } from './features/preferences.ts';

void initPreferences();

const route = useRoute();
const main = ref<HTMLElement>();
const links = [
  { to: '/create', label: '创造鱼', icon: 'brush' },
  { to: '/fishing/reef-edge', label: '去钓鱼', icon: 'hook' },
  { to: '/ocean', label: '我的海洋', icon: 'waves' },
  { to: '/journal', label: '图鉴', icon: 'book' },
  { to: '/settings', label: '设置', icon: 'settings' },
] as const;

watch(() => route.fullPath, async () => {
  await nextTick();
  main.value?.focus({ preventScroll: true });
});
</script>

<template>
  <a class="skip-link" href="#main-content">跳到主要内容</a>
  <div class="app-shell">
    <header class="site-header">
      <RouterLink to="/" class="brand" aria-label="我的海洋，返回首页">
        <span class="brand-mark"><AppIcon name="fish" /></span>
        <span>我的海洋<small>MY LITTLE OCEAN</small></span>
      </RouterLink>
      <nav class="primary-nav" aria-label="主要导航">
        <RouterLink v-for="link in links" :key="link.to" :to="link.to"
          :class="{ 'is-active': link.icon === 'hook' && route.name === 'fishing' }">
          <AppIcon :name="link.icon" /><span>{{ link.label }}</span>
        </RouterLink>
      </nav>
    </header>
    <main id="main-content" ref="main" tabindex="-1">
      <RouterView />
    </main>
    <footer class="site-footer"><span>一片小海洋，无限种想象。</span><span>作品只保存在这台设备 · 记得在设置里备份</span></footer>
  </div>
</template>
