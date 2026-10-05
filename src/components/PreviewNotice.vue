<script setup lang="ts">
defineProps<{ text: string }>();
</script>
<template>
  <div class="preview-notice"><span class="status-dot" /><p><strong>抢先看看</strong> · {{ text }}</p></div>
</template>
