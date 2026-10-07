<script setup lang="ts">
import type { FightState3D } from '../domain/fishing3d/state';
defineProps<{ fight: FightState3D; paused: boolean; reducedMotion: boolean; compact?: boolean }>();
</script>

<template>
  <div class="reel" :class="{ compact }" role="img" :aria-label="paused ? '鼓轮已暂停' : fight.reeling ? '鼓轮正在收线' : '鼓轮停转，正在松线'" :data-reeling="fight.reeling && !paused">
    <div class="reel-caption"><span class="status-dot" :class="{ active: fight.reeling && !paused }" /><strong>{{ paused ? '已暂停' : fight.reeling ? '正在收线' : '松线 · 等它喘息' }}</strong></div>
    <svg viewBox="0 0 180 100" aria-hidden="true">
      <defs><linearGradient id="reel-metal" x2="0" y2="1"><stop stop-color="#ffe6a4" /><stop offset=".5" stop-color="#bd8745" /><stop offset="1" stop-color="#e8bd6d" /></linearGradient></defs>
      <path d="M24 86 107 20" stroke="#714c32" stroke-width="9" stroke-linecap="round" />
      <path d="M24 86 107 20" stroke="#e3b775" stroke-width="3" stroke-linecap="round" />
      <path d="M58 66 72 78 98 66" fill="none" stroke="#deba7b" stroke-width="6" />
      <path d="M56 34H111V67H56Z" fill="url(#reel-metal)" stroke="#775638" stroke-width="2" />
      <ellipse cx="56" cy="50" rx="13" ry="24" fill="#d9ab62" stroke="#fff0c0" stroke-width="3" />
      <path d="M69 35V66M75 35V66M81 35V66M87 35V66M93 35V66" stroke="#f4e5ba" stroke-width="3" opacity=".9" />
      <ellipse cx="111" cy="50" rx="14" ry="24" fill="#b78345" stroke="#ffe6a4" stroke-width="3" />
      <circle cx="119" cy="50" r="18" fill="#285e5b" stroke="#eed09a" stroke-width="3" />
      <g class="crank" :style="{ transform: `rotate(${reducedMotion ? 0 : fight.reelTurns * 360}deg)`, transition: paused || reducedMotion || !fight.reeling ? 'none' : 'transform 250ms linear' }">
        <path d="M104 50H134M119 35V65" stroke="#b6d4bc" stroke-width="2" />
        <path d="M119 50H147" stroke="#ffe3a5" stroke-width="5" stroke-linecap="round" />
        <ellipse cx="149" cy="50" rx="7" ry="10" fill="#725139" stroke="#f4ce8d" stroke-width="2" />
      </g>
      <circle cx="119" cy="50" r="5" fill="#ffe3a5" />
      <path d="M80 34 157 16" stroke="#fff4d5" stroke-width="1" opacity=".8" />
    </svg>
    <small>{{ fight.size === 'large' ? '大鱼 · 拉力更强' : '小鱼 · 轻巧灵活' }}</small>
  </div>
</template>

<style scoped>
.reel { position: absolute; right: 14px; bottom: 14px; width: 164px; padding: 10px 10px 8px; border: 1px solid #e8d8ab55; border-radius: 18px; background: #163f43e8; color: #fff1d1; box-shadow: 0 6px 24px #163f4333; pointer-events: none; }
.reel-caption { display: flex; align-items: center; gap: 6px; font-size: 12px; }.status-dot { width: 6px; height: 6px; border-radius: 50%; background: #d4b477; }.status-dot.active { background: #a8e6bd; }svg { display: block; width: 100%; height: 86px; }.crank { transform-origin: 119px 50px; }small { display: block; text-align: center; font-size: 11px; color: #dddcbd; }
@media(max-width:600px) { .reel { width: 134px; right: 10px; bottom: 10px; padding: 8px; }svg { height: 72px; }.reel-caption { font-size: 11px; } }
.reel.compact { position: static; width: 110px; padding: 0; border: 0; background: none; box-shadow: none; color: inherit; }
.compact .reel-caption, .compact small { display: none; }.compact svg { height: 60px; }
</style>
