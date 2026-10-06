<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { renderFish } from '../rendering/FishRenderer';
import type { PassingFish } from './FishingScene.vue';
const props=defineProps<{ fish: PassingFish; seconds: number; reducedMotion: boolean }>();
defineEmits<{ greet: [] }>();const canvas=ref<HTMLCanvasElement>();const start=props.seconds;
const left=computed(()=>props.reducedMotion?'28%':`${23+(props.seconds-start)*3%35}%`);
function draw(){const c=canvas.value,ctx=c?.getContext('2d');if(!c||!ctx)return;ctx.clearRect(0,0,c.width,c.height);renderFish(ctx,props.fish.design,{x:80,y:52,scale:110},{paint:props.fish.color,glow:props.fish.glow?{source:props.fish.glow,version:props.fish.revision}:null,tailAngle:props.reducedMotion?0:Math.sin(props.seconds*4)*.12});}
onMounted(draw);watch(()=>[props.seconds,props.reducedMotion],draw);
</script>
<template><button class="visitor" :style="{left,transition:reducedMotion?'none':undefined}" :aria-label="`和访客${fish.name}打招呼`" @click="$emit('greet')"><canvas ref="canvas" width="160" height="104" aria-hidden="true"/><span>「{{fish.name}}」路过 · 打招呼</span></button></template>
<style scoped>.visitor{position:absolute;top:51%;width:160px;padding:0;background:transparent;border:0;color:#fff5d9;text-shadow:0 1px 4px #174650;cursor:pointer;transition:left 250ms linear;z-index:2}.visitor canvas{width:160px;height:104px;display:block}.visitor span{display:block;font-size:11px;background:#184d58dc;border-radius:14px;padding:7px;overflow-wrap:anywhere}@media(prefers-reduced-motion:reduce){.visitor{transition:none}}@media(max-width:600px){.visitor{width:130px}.visitor canvas{width:130px;height:85px}}</style>
