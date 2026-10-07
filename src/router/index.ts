import { createRouter, createWebHistory } from 'vue-router';
import { habitats } from '../catalog/habitats';

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: () => import('../pages/HomePage.vue'), meta: { title: '首页' } },
    { path: '/create', name: 'create', component: () => import('../pages/CreatePage.vue'), meta: { title: '创造工坊' } },
    { path: '/ocean', name: 'ocean', component: () => import('../pages/OceanPage.vue'), meta: { title: '我的海洋' } },
    { path: '/fishing', redirect: '/fishing/reef-edge' },
    {
      path: '/fishing/:habitatId', name: 'fishing', component: import.meta.env.MODE === 'fishing-preview'
        ? () => import('../pages/DevFishing3DContentPage.vue') : () => import('../pages/FishingPage.vue'),
      meta: { title: '去钓鱼' },
    },
    { path: '/journal', name: 'journal', component: () => import('../pages/JournalPage.vue'), meta: { title: '图鉴' } },
    { path: '/settings', name: 'settings', component: () => import('../pages/SettingsPage.vue'), meta: { title: '设置' } },
    { path: '/playtest', name: 'playtest', component: () => import('../pages/PlaytestPage.vue'), meta: { title: '家庭试玩记录' } },
    // 组合总览只在开发模式注册，正式构建不包含该页面。
    ...(import.meta.env.DEV ? [
      { path: '/dev/parts', name: 'dev-parts', component: () => import('../pages/DevPartsPage.vue'), meta: { title: '部件组合总览' } },
      { path: '/dev/fishing-3d', name: 'dev-fishing-3d', component: () => import('../pages/DevFishing3DContentPage.vue'), meta: { title: '3D 钓鱼' } },
      { path: '/dev/fishing-3d/practice', name: 'dev-fishing-3d-practice', component: () => import('../pages/DevFishing3DPage.vue'), meta: { title: '3D 搏鱼练习' } },
      { path: '/dev/fishing-3d/models', name: 'dev-fish-models', component: () => import('../pages/DevFishModelsPage.vue'), meta: { title: '12 种鱼的三维模型' } },
    ] : []),
    // Candidate build for real-device acceptance; the normal release keeps its existing fishing route.
    ...(import.meta.env.MODE === 'fishing-preview' ? [
      { path: '/preview/fishing-3d', name: 'preview-fishing-3d', component: () => import('../pages/DevFishing3DContentPage.vue'), meta: { title: '3D 钓鱼试玩' } },
    ] : []),
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../pages/NotFoundPage.vue'), meta: { title: '页面未找到' } },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

// 全局守卫同时覆盖首次进入和同一路由的钓场参数切换。
router.beforeEach((to) => {
  if (to.name === 'fishing' && !habitats.some((habitat) => habitat.id === to.params.habitatId)) {
    return { name: 'not-found', params: { pathMatch: to.path.slice(1).split('/') } };
  }
});

router.afterEach((to) => {
  document.title = to.name === 'home' ? '我的海洋 · 每条鱼都有自己的样子' : `${String(to.meta.title)} · 我的海洋`;
});
