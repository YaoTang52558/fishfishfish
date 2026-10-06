<script setup lang="ts">
import { species } from '../catalog/species';
import { speciesActions } from '../domain/fishing3d/content';
import FishModelPreview from '../components/FishModelPreview.vue';
const actions={sprinter:'冲刺',weaver:'横游',diver:'下潜'};
</script>
<template><section><p class="eyebrow">3D 海洋发现</p><h1>十二种鱼，各有自己的样子</h1><p>两片水域各有六种鱼。这里展示同一批钓鱼用的三维模型；大小与挣扎类型是游戏配置。</p><RouterLink to="/dev/fishing-3d" class="text-link">返回海面钓鱼</RouterLink><div class="models"><article v-for="fish in species" :key="fish.id"><FishModelPreview :species-id="fish.id"/><h2>{{ fish.commonNameZh }}</h2><small>{{ fish.scientificName }}</small><p>{{ fish.appearance }}</p><span>{{ fish.game.habitatId==='reef-edge'?'珊瑚外缘':'近岸岩礁' }} · {{ fish.game.size==='large'?'大鱼':'小鱼' }} · {{ actions[speciesActions[fish.id]!] }}</span></article></div></section></template>
<style scoped>section{max-width:1200px;margin:auto}section>p{color:var(--muted);line-height:1.8}.models{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;margin-top:24px}article{padding:16px;border:1px solid var(--line);border-radius:22px;background:#fffaf0}h2{font-size:18px;margin:14px 0 6px}small{font-style:italic;color:var(--muted)}article p{font-size:13px;line-height:1.8;color:var(--muted)}article span{font-size:12px;color:#28665d}@media(max-width:900px){.models{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:550px){.models{grid-template-columns:1fr}}</style>
