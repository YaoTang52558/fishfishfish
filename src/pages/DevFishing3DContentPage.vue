<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import DevFishing3DRoundPage from './DevFishing3DRoundPage.vue';
const route = useRoute();
const habitat = computed(() => (route.query.habitat ?? route.params.habitatId) === 'coastal-rock' ? 'coastal-rock' as const : 'reef-edge' as const);
</script>
<template><DevFishing3DRoundPage :key="habitat" :habitat-id="habitat" /></template>
