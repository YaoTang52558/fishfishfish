<script setup lang="ts">
import { useId } from 'vue';
withDefaults(defineProps<{ variant?: 'ocean' | 'reef' | 'coast' | 'workshop' }>(), { variant: 'ocean' });
const id = useId().replace(/[^a-zA-Z0-9-]/g, '');
const fish = [
  { x: 330, y: 170, size: 1.6, color: '#f4ba75', reverse: false },
  { x: 130, y: 100, size: 0.75, color: '#cde3ca', reverse: true },
  { x: 460, y: 280, size: 0.85, color: '#e9a598', reverse: true },
];
</script>

<template>
  <div class="sea-scene" :class="`sea-scene--${variant}`">
    <svg viewBox="0 0 600 380" fill="none" aria-hidden="true">
      <defs>
        <linearGradient :id="`${id}-water`" x1="0" y1="0" x2="600" y2="380" gradientUnits="userSpaceOnUse">
          <stop stop-color="#286e68" /><stop offset="1" stop-color="#103e40" />
        </linearGradient>
      </defs>
      <rect width="600" height="380" :fill="`url(#${id}-water)`" />
      <path d="M50 0h130L380 380H220Z" fill="#fff" opacity=".035" />
      <path d="M340 0h65l170 380H435Z" fill="#fff" opacity=".03" />
      <path d="M0 320q110-45 220 0t230 0 150 0v60H0Z" fill="#092f32" opacity=".5" />
      <g stroke="#72ada0" stroke-width="5" stroke-linecap="round" opacity=".5">
        <path d="M45 380q-30-80 5-125M65 380q30-60 3-100M515 380q-10-60 17-85M543 380q28-65 2-135" />
      </g>
      <g v-if="variant === 'reef'" stroke="#d79b8d" stroke-width="12" stroke-linecap="round" opacity=".6">
        <path d="M130 380v-60m0 22-24-25m24 15 28-26M440 380v-45m0 19-17-18m17 0 15-18" />
      </g>
      <g v-if="variant === 'coast'" fill="#758f89"><ellipse cx="125" cy="375" rx="85" ry="35" /><ellipse cx="430" cy="385" rx="110" ry="55" /></g>
      <g stroke="#bbdcd1" opacity=".35">
        <circle cx="420" cy="100" r="7" /><circle cx="435" cy="70" r="4" /><circle cx="75" cy="215" r="4" /><circle cx="485" cy="190" r="5" />
      </g>
      <!-- 原创静态示范插画；不作为后续可编辑的鱼模型。 -->
      <g v-for="(item, index) in (variant === 'workshop' ? fish.slice(0, 1) : fish)" :key="index"
        :transform="`translate(${item.x} ${item.y}) scale(${item.reverse ? -item.size : item.size} ${item.size})`">
        <path d="m-42 0-30-28q-8 27 0 56Z" :fill="item.color" />
        <path d="M-15-18q-10-28 18-24l8 24M-12 20q4 21 25 17l-3-17" :fill="item.color" opacity=".8" />
        <path d="M-47 0q20-41 65-29Q45-24 53 0 41 33 10 30-26 33-47 0Z" :fill="item.color" />
        <path d="M-10-22q16 22 0 45M4-25q16 25 0 50" stroke="#fff" stroke-width="7" opacity=".26" />
        <path d="M7 8q-13-3-15 11 14 9 22-3" fill="#fff" opacity=".25" />
        <circle cx="33" cy="-5" r="6" fill="#fff8eb" /><circle cx="35" cy="-5" r="3" fill="#173d3a" />
        <path d="m46 9-6 2" stroke="#7b5d45" stroke-width="2" stroke-linecap="round" />
      </g>
    </svg>
    <span class="scene-label">{{ variant === 'workshop' ? '示范造型' : '示范海洋' }}</span>
  </div>
</template>
