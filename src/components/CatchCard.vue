<script setup lang="ts">
import { computed, ref } from 'vue';
import { speciesDesign, type SpeciesDefinition } from '../catalog/species.ts';
import type { Discovery } from '../domain/backup.ts';
import PartThumb from './PartThumb.vue';

const props = defineProps<{
  species: SpeciesDefinition; discovery: Discovery | null; firstDiscovery: boolean;
  saveState: 'saving' | 'saved' | 'failed'; saveError?: string;
  /** 图鉴里查看时不显示放生（布尔属性未传时 Vue 会当作 false，所以用“隐藏”语义）。 */
  hideRelease?: boolean;
}>();
const emit = defineEmits<{ release: []; retry: []; inspire: [] }>();
const showAnswer = ref(false);
const showFacts = ref(false);
const design = computed(() => speciesDesign(props.species));
const dateFormat = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' });
</script>
<template>
  <article class="catch-card" aria-labelledby="catch-title">
    <PartThumb class="catch-thumb" :design="design" />
    <p class="eyebrow">{{ firstDiscovery ? '第一次发现！' : discovery ? `${hideRelease ? '' : '再次遇见 · '}第一次发现于 ${dateFormat.format(new Date(discovery.firstCaughtAt))}` : '钓到了' }}</p>
    <h2 id="catch-title">{{ species.commonNameZh }}</h2>
    <p class="scientific"><i>{{ species.scientificName }}</i><span v-if="species.popularNameZh"> · 也叫{{ species.popularNameZh }}</span></p>
    <p class="save-line" :class="`save-line--${saveState}`" role="status">
      {{ saveState === 'saving' ? '正在记录到图鉴…' : saveState === 'saved' ? `已记录到图鉴${discovery ? ` · 共遇见 ${discovery.catchCount} 次` : ''}` : `没有记录成功：${saveError ?? ''}` }}
      <button v-if="saveState === 'failed'" class="chip-button" @click="emit('retry')">重试记录</button>
    </p>
    <div class="observe">
      <p><strong>看一看：</strong>{{ species.observation.question }}</p>
      <button v-if="!showAnswer" class="reset-shape" @click="showAnswer = true">看答案</button>
      <p v-else class="tool-hint">{{ species.observation.answer }}</p>
    </div>
    <button class="reset-shape" :aria-expanded="showFacts" @click="showFacts = !showFacts">{{ showFacts ? '收起小知识' : '了解它（小知识）' }}</button>
    <div v-if="showFacts" class="facts">
      <dl>
        <div><dt>样子</dt><dd>{{ species.appearance }}</dd></div>
        <div><dt>吃什么</dt><dd>{{ species.realDiet }}</dd></div>
        <div><dt>住在哪</dt><dd>{{ species.realHabitat }}</dd></div>
        <div v-if="species.maxLengthCm"><dt>最长约</dt><dd>{{ species.maxLengthCm }} 厘米</dd></div>
      </dl>
      <ul><li v-for="fact in species.facts" :key="fact.text">{{ fact.text }} <a :href="fact.sourceUrl" target="_blank" rel="noopener noreferrer">来源</a></li></ul>
      <p class="tool-hint">资料查阅于 {{ species.sources[0]?.checkedAt }}；钓场是游戏里虚构的地方，钓饵与搏鱼方式只是游戏设定。</p>
    </div>
    <div class="catch-actions">
      <button v-if="!hideRelease" class="button" @click="emit('release')">放生</button>
      <button v-if="firstDiscovery" class="button button--muted" @click="emit('inspire')">用它的配色去创作</button>
    </div>
  </article>
</template>
