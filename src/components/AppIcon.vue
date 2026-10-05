<script setup lang="ts">
defineProps<{ name: 'fish' | 'brush' | 'hook' | 'waves' | 'book' | 'settings' | 'arrow' | 'spark' }>();
const paths = {
  fish: 'M17 12c-5-7-11-4-14 0 3 4 9 7 14 0l4-4v8l-4-4M8 10h.01',
  brush: 'm14 4 6 6M5 15 16 4a2.8 2.8 0 0 1 4 4L9 19M5 15c-3 0-3 4-3 6 2 0 6 0 6-3 0-2-1-3-3-3Z',
  hook: 'M15 3v12a5 5 0 0 1-10 0v-3l4 3M12 3h6',
  waves: 'M2 7c3-4 5 4 8 0s5 4 8 0 4 0 4 0M2 12c3-4 5 4 8 0s5 4 8 0 4 0 4 0M2 17c3-4 5 4 8 0s5 4 8 0 4 0 4 0',
  book: 'M12 5v16M12 5C9 3 5 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-3-1-7-1-10 1Z',
  settings: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',
};
</script>

<template>
  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="paths[name]" />
  </svg>
</template>
