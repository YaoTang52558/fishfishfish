<script setup lang="ts">
import PageHeading from '../components/PageHeading.vue';
</script>
<template>
  <PageHeading eyebrow="回到熟悉的水域" title="这片水域，还没有找到。" description="页面或钓场地址可能有误。回到首页，再选择一个入口吧。" />
  <RouterLink to="/" class="button">返回首页</RouterLink>
</template>
