<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import FishingRoundPage from './FishingRoundPage.vue';
const route = useRoute();
// Canonical links use the path; legacy development and playtest links use the query.
const habitat = computed(() => (route.name === 'fishing' ? route.params.habitatId : route.query.habitat) === 'coastal-rock' ? 'coastal-rock' as const : 'reef-edge' as const);
</script>
<template><FishingRoundPage :key="habitat" :habitat-id="habitat" /></template>
