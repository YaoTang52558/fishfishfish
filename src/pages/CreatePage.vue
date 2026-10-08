<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { habitats } from '../catalog/habitats.ts';
import { speciesById, type SpeciesDefinition } from '../catalog/species.ts';
import { adjustablePatterns, bodies, brushLimits, eyes, finSets, heads, mouths, palette, patterns, patternLimits, shapeLimits, stampKinds, stampLimits, tails } from '../catalog/fish.ts';
import { changeColor, changePart, changePattern, changePatternDetail, changeShape, resetShape, type PartKey } from '../domain/fish.ts';
import { isAssetId } from '../domain/fish.ts';
import { defaultName, describeSwim, displayedEffect, effectInfo, personalityNames, recommendPersonality, satisfiedEffects, validateName } from '../domain/rules.ts';
import type { ColorSlot, FishDesign, Personality, ShapeKey } from '../domain/types.ts';
import { visibleGlowPixels } from '../rendering/FishRenderer.ts';
import { downloadJson } from '../storage/backup.ts';
import { toStorageError } from '../storage/db.ts';
import type { CommitMode } from '../storage/repository.ts';
import { useDraftSession } from '../features/editor/draftSession.ts';
import { useEditor, type Tool } from '../features/editor/editor.ts';
import { PaintLayer } from '../features/editor/paintLayer.ts';
import FishCanvas from '../components/FishCanvas.vue';
import PageHeading from '../components/PageHeading.vue';
import PartThumb from '../components/PartThumb.vue';
import TrialSwim from '../components/TrialSwim.vue';
import FishInspiration from '../components/FishInspiration.vue';
import FishShowcase from '../components/FishShowcase.vue';
import ContextHelp from '../components/ContextHelp.vue';
import CreativeKnowledge from '../components/CreativeKnowledge.vue';
import SculptEditor from '../components/SculptEditor.vue';
import CreativeVolume from '../components/CreativeVolume.vue';
import type { HelpTopic } from '../features/help.ts';

const router = useRouter();
const route = useRoute();
let layers: { color: PaintLayer; glow: PaintLayer } | null = null;
try { layers = { color: new PaintLayer(), glow: new PaintLayer() }; } catch { layers = null; }
const color = layers?.color ?? null, glow = layers?.glow ?? null;
// 无 Canvas 时 editor 仍可调造型，但不能画也不能保存。
const editor = useEditor(color!, glow!, { paintChanged: () => session?.paintCommitted() });
const session = layers ? useDraftSession(editor.design, layers, { load: (next) => editor.load(next) }) : null;
const design = editor.design;

const tabs = ['造型', '部件', '颜色', '画笔'] as const;
const selected = ref<(typeof tabs)[number]>('画笔');
const sculpting = ref(false);
const knowledgeTopic = computed(() => activePart.value === 'tailId' ? 'tail' : activePart.value === 'finId' ? 'fin' : activePart.value === 'mouthId' ? 'mouth' : 'shape');
const activePart = ref<PartKey>('bodyId');
const tabIcons = { 造型: '🐟', 部件: '🧩', 颜色: '🎨', 画笔: '🖌️' };
const primaryFinish = ref<HTMLButtonElement>();
/** 工坊阶段：编辑 → 试游 → 取名入海；返回编辑保留撤销历史。 */
const mode = ref<'edit' | 'trial' | 'finish'>('edit');
const trial = computed(() => mode.value !== 'edit');
const trialEnded = ref(false);
const trialView = ref<InstanceType<typeof TrialSwim>>();
const confirmAction = ref<'new' | 'cancel-edit' | null>(null);
const finishError = ref<{ kind: string; message: string } | null>(null);
const nameError = ref('');
const glowPixels = ref(0);
const personalityTouched = ref(false);
/** 钓鱼图鉴带来的灵感配色：只更换底色与花纹，作为一次可撤销操作；可以不用。 */
const inspiration = ref<SpeciesDefinition | null>(null);
const observationOpen = ref(false);
const showcaseOpen = ref(false);
const knowledgeOpen = ref(false);
const helpOpen = ref(false);
const helpTopic = computed<HelpTopic>(() => mode.value === 'finish' ? 'save' : mode.value === 'trial' ? 'trial' : sculpting.value ? 'sculpt' : selected.value === '画笔' ? 'brush' : selected.value === '颜色' ? 'colors' : 'shape');
function borrowFeature(next: FishDesign, label: string) {
  editor.commit(label, { ...design.value, colors: { ...next.colors }, pattern: { ...next.pattern } });
  editor.message.value = '用上啦！可以继续画，也可以撤销。';
}
function updatePatternDetail(key: 'size' | 'density', event: Event) { editor.live(changePatternDetail(design.value, key, (event.target as HTMLInputElement).valueAsNumber)); }
function applyInspiration() {
  const item = inspiration.value;
  if (!item) return;
  editor.commit('灵感配色', { ...design.value, colors: { ...item.render.colors }, pattern: { ...item.render.pattern } });
  editor.message.value = `已用上「${item.commonNameZh}」的配色，可以撤销；笔迹和印章没有改变。`;
  inspiration.value = null;
}
const dark = ref(false);
const confirmClear = ref(false);
const colorTarget = ref<ColorSlot | 'primary' | 'secondary'>('body');
const pendingLeave = ref<string | null>(null);
let leaveAnyway = false;

const controls: Array<{ key: ShapeKey; name: string; hint: string }> = [
  { key: 'length', name: '身体长度', hint: '短一点，还是修长一点？' },
  { key: 'height', name: '身体高度', hint: '扁一点，还是饱满一点？' },
  { key: 'headRatio', name: '头部占比', hint: '给它一个独特的小脑袋。' },
];
const partGroups: Array<{ tab: '造型' | '部件'; key: PartKey; title: string; items: readonly { id: string; name: string }[]; focus?: 'head' | 'tail' | 'body' | 'eye' | 'mouth' }> = [
  { tab: '造型', key: 'bodyId', title: '身体', items: bodies, focus: 'body' },
  { tab: '造型', key: 'headId', title: '头型', items: heads, focus: 'head' },
  { tab: '部件', key: 'tailId', title: '尾巴', items: tails, focus: 'tail' },
  { tab: '部件', key: 'finId', title: '鳍', items: finSets },
  { tab: '部件', key: 'eyeId', title: '眼睛', items: eyes, focus: 'eye' },
  { tab: '部件', key: 'mouthId', title: '嘴', items: mouths, focus: 'mouth' },
];
const selectedGroup = computed(() => partGroups.find(group => group.key === activePart.value)!);
const leftDock = computed(() => ['tailId', 'bodyId', 'finId'].map(key => partGroups.find(group => group.key === key)!));
const rightDock = computed(() => partGroups.filter(group => ['headId', 'eyeId', 'mouthId'].includes(group.key)));
const colorTargets: Array<{ key: ColorSlot | 'primary' | 'secondary'; name: string }> = [
  { key: 'body', name: '身体' }, { key: 'head', name: '头' }, { key: 'fin', name: '鳍' }, { key: 'tail', name: '尾' },
  { key: 'primary', name: '花纹主色' }, { key: 'secondary', name: '花纹辅色' },
];
const tools: Array<{ key: Tool; name: string; hint: string }> = [
  { key: 'pen', name: '普通笔', hint: '按住拖动作画，笔迹只留在身体上。' },
  { key: 'glow', name: '发光笔', hint: '画在单独的发光层上，打开暗背景看得最清楚。' },
  { key: 'eraser', name: '橡皮', hint: '同时擦掉画笔和发光笔迹，不会擦掉底色、花纹、印章和眼睛。' },
  { key: 'fill', name: '换底色', hint: '点一下身体、头、鳍或尾巴，换成选中的颜色。' },
  { key: 'stamp', name: '印章', hint: '选一个印章，点在身体上盖章；点已盖的印章可以选中、拖动。' },
];

const partValue = (key: PartKey) => key === 'bodyId' ? design.value.bodyId : design.value.parts[key];
function pickPart(key: PartKey, id: string, title: string) { editor.commit(`换${title}`, changePart(design.value, key, id)); }
function updateShape(key: ShapeKey, event: Event) { editor.live(changeShape(design.value, key, (event.target as HTMLInputElement).valueAsNumber)); }
function valueLabel(key: ShapeKey) {
  return key === 'headRatio' ? `${Math.round(design.value.shape[key] * 100)}%` : `${design.value.shape[key].toFixed(2)} 倍`;
}
const targetColor = computed(() => colorTarget.value === 'primary' || colorTarget.value === 'secondary' ? design.value.pattern[colorTarget.value] : design.value.colors[colorTarget.value]);
const colorName = (value: string) => palette.find((item) => item.value === value)?.name ?? '';
const currentTool = computed(() => tools.find((item) => item.key === editor.tool.value)!);
const widthLabel = computed(() => `${Math.round(editor.brushWidth.value * 1000) / 10}%`);
const loading = computed(() => session?.status.value === 'loading');
const statusText = computed(() => session?.statusText.value ?? '此浏览器无法创建画布，作品不能画也不能保存');
const stamp = editor.selectedStamp;
const stageLabel = computed(() => {
  if (editor.preview.value) return '随机预览';
  if (sculpting.value) return '🤏 拖动鱼背和肚子上的圆点';
  if (selected.value === '颜色') return `🎨 给${colorTargets.find(t => t.key === colorTarget.value)?.name ?? '身体'}换颜色，点下面的色块`;
  if (selected.value !== '画笔') return '点旁边换部件，点画笔就能画';
  const tool = editor.tool.value;
  return tool === 'fill' ? '换底色 · 点一下要换色的部位' : tool === 'stamp' ? '印章 · 点身体盖章' : `${currentTool.value.name} · 只画在身体上`;
});
// 仅开发模式：供浏览器验证读取撤销历史占用，正式构建不暴露。
if (import.meta.env.DEV) (window as unknown as { __fishEditor?: typeof editor }).__fishEditor = editor;
const stampName = computed(() => stampKinds.find((item) => item.id === stamp.value?.kind)?.name ?? '');

function nudgeStamp(du: number, dv: number) { editor.adjustStamp('移动印章', (s) => ({ u: s.u + du, v: s.v + dv })); }
function finishGesture() { editor.release(); editor.endLive('调整造型或花纹'); }
function selectTab(tab: (typeof tabs)[number]) {
  if (session?.committing.value) return;
  finishGesture(); selected.value = tab; mode.value = 'edit'; confirmClear.value = false; sculpting.value = false;
  if (tab === '造型' || tab === '部件') {
    if (selectedGroup.value.tab !== tab) activePart.value = tab === '造型' ? 'bodyId' : 'tailId';
  }
}
function selectGroup(key: PartKey) {
  activePart.value = key; selectTab(selectedGroup.value.tab);
}
function quickTool(action: 'pen' | 'eraser' | 'colors' | 'sculpt') {
  selectTab(action === 'colors' ? '颜色' : action === 'sculpt' ? '造型' : '画笔');
  if (action === 'pen' || action === 'eraser') editor.tool.value = action;
  if (action === 'sculpt') { activePart.value = 'bodyId'; sculpting.value = true; }
}
function returnToEdit() { if (!session?.committing.value) { finishGesture(); mode.value = 'edit'; } }

// —— 试游与入海 ——
const swim = computed(() => describeSwim(design.value));
const recommended = computed(() => recommendPersonality(design.value));
const effects = computed(() => satisfiedEffects(design.value, glowPixels.value));
const shownEffect = computed(() => displayedEffect(effects.value, session?.meta.value.effectEnabled ?? true));
const editingExisting = computed(() => !!session?.source.value);
function measureGlow() { glowPixels.value = glow ? visibleGlowPixels(glow.canvas, glow.version, design.value) : 0; }
async function startTrial() {
  if (session?.committing.value || editor.preview.value) return;
  finishGesture(); measureGlow(); mode.value = 'trial'; trialEnded.value = false;
  await nextTick(); trialView.value?.restart();
}
async function tryAnotherTail() {
  returnToEdit(); selectGroup('tailId');
  await nextTick();
  const first = document.querySelector('.part-group .part-card') as HTMLElement | null;
  first?.scrollIntoView({ block: 'nearest' }); first?.focus();
}
async function openFinish() {
  if (!session || session.status.value !== 'ready' || session.committing.value || editor.preview.value) return;
  finishGesture(); measureGlow(); mode.value = 'finish'; finishError.value = null; nameError.value = '';
  const meta = session.meta.value;
  if (!meta.name.trim()) meta.name = defaultName(design.value);
  // 新作品默认采用推荐性格；玩家改过或是再次编辑的作品就保留原选择。
  if (!editingExisting.value && !personalityTouched.value) meta.personality = recommended.value;
  await nextTick(); primaryFinish.value?.focus({ preventScroll: true });
}
function choosePersonality(value: Personality) { if (session) { session.meta.value.personality = value; personalityTouched.value = true; } }
async function saveFish(commitMode: CommitMode) {
  // 连点时第二次点击直接忽略；数据库仍按提交凭证去重。
  if (!session || session.committing.value) return;
  const name = validateName(session.meta.value.name);
  if (!name.ok) { nameError.value = name.reason; return; }
  nameError.value = ''; session.meta.value.name = name.value; finishError.value = null;
  measureGlow();
  try {
    const result = await session.commit(commitMode, effects.value);
    leaveAnyway = true;
    await router.push({ path: '/ocean', query: { new: result.fish.id } });
  } catch (cause) {
    const failure = toStorageError(cause);
    finishError.value = { kind: failure.kind, message: failure.message };
  }
}
async function exportTemporary() {
  if (!session) return;
  try { downloadJson(await session.exportCurrent(), `我的海洋-临时作品-${new Date().toISOString().slice(0, 10)}.json`); }
  catch (cause) { finishError.value = { kind: 'unknown', message: toStorageError(cause).message }; }
}
async function runConfirm() {
  const action = confirmAction.value;
  confirmAction.value = null;
  if (!session || !action) return;
  mode.value = 'edit';
  if (action === 'new') { await session.resetDraft('已开始一条新鱼。'); personalityTouched.value = false; return; }
  if (await session.resetDraft('已取消编辑，海洋里的原版没有改变。')) { leaveAnyway = true; await router.push('/ocean'); }
}
function onKey(event: KeyboardEvent) {
  if (!(event.ctrlKey || event.metaKey) || trial.value || helpOpen.value || observationOpen.value || knowledgeOpen.value || showcaseOpen.value || editor.preview.value) return;
  const key = event.key.toLowerCase();
  if (key === 'z' && !event.shiftKey) { event.preventDefault(); void editor.undo(); }
  else if ((key === 'z' && event.shiftKey) || key === 'y') { event.preventDefault(); void editor.redo(); }
}

function leave() {
  const target = pendingLeave.value;
  if (!target) return;
  leaveAnyway = true; pendingLeave.value = null;
  void router.push(target);
}
onBeforeRouteLeave(async (to) => {
  if (leaveAnyway || !session) return true;
  editor.release();
  if (await session.flush()) return true;
  pendingLeave.value = to.fullPath;
  return false;
});
async function retry() {
  if (!session) return;
  const saved = await session.retry();
  if (saved && pendingLeave.value) leave();
}
onMounted(() => {
  session?.bind();
  const fishId = typeof route.query.fishId === 'string' && isAssetId(route.query.fishId) ? route.query.fishId : undefined;
  const inspire = typeof route.query.inspire === 'string' ? speciesById(route.query.inspire) : null;
  void session?.start({ fishId }).then(() => { inspiration.value = inspire; });
  window.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => { session?.dispose(); window.removeEventListener('keydown', onKey); });
</script>

<template>
  <div class="studio-heading">
    <PageHeading class="studio-title" eyebrow="想象工坊 / CREATE" :title="editingExisting ? '给你的鱼一个新想法。' : '造一条你想象的鱼。'" description="选部件，涂颜色。想怎么画都可以。" />
    <ol class="studio-steps" aria-label="创作步骤">
      <li><button :aria-current="mode === 'edit' ? 'step' : undefined" :disabled="loading || session?.committing.value || !!editor.preview.value" aria-label="第一步：创作" @click="returnToEdit"><span aria-hidden="true">🖌️</span>创作</button></li>
      <li><button :aria-current="mode === 'trial' ? 'step' : undefined" :disabled="loading || session?.committing.value || !!editor.preview.value" aria-label="第二步：试游" @click="startTrial"><span aria-hidden="true">🐟</span>试游</button></li>
      <li><button :aria-current="mode === 'finish' ? 'step' : undefined" :disabled="!session || session.status.value !== 'ready' || session.committing.value || !!editor.preview.value" aria-label="第三步：入海" @click="openFinish"><span aria-hidden="true">🌊</span>入海</button></li>
    </ol>
  </div>
  <p v-if="session?.notice.value" class="session-notice" role="status">{{ session.notice.value }}</p>
  <p v-if="session?.externalChange.value" class="session-notice">另一个页面修改了存档。刷新后可以看到最新内容；当前作品还在这里。</p>
  <div v-if="session?.pendingReplace.value" class="leave-warning" role="alert">
    <p><strong>工坊里还有一条没完成的鱼「{{ session.pendingReplace.value.draftName }}」。</strong>要改为编辑海洋里的那条鱼吗？没完成的这条会被替换。</p>
    <div>
      <button class="button" @click="session.confirmReplace(true)">改为编辑海洋里的鱼</button>
      <button class="button button--muted" @click="session.confirmReplace(false)">继续没完成的这条</button>
    </div>
  </div>
  <div v-if="inspiration" class="edit-banner" role="status">
    <p>要用「{{ inspiration.commonNameZh }}」的配色吗？只换身体、头、鳍、尾的底色和花纹，笔迹和印章不变，用完还能撤销。这些颜色在色卡里本来就能选。</p>
    <div class="stage-actions"><button class="button" @click="applyInspiration">用这个配色</button><button class="button button--muted" @click="inspiration = null">不用了</button></div>
  </div>
  <div v-if="editingExisting && session?.status.value === 'ready'" class="edit-banner">
    <p>正在改「{{ session.meta.value.name || '这条鱼' }}」。入海时可以更新原作，也可以保留原作、另存一条。</p>
    <button class="button button--muted" @click="confirmAction = 'cancel-edit'">取消编辑</button>
  </div>
  <div v-if="confirmAction" class="leave-warning" role="alert">
    <p>{{ confirmAction === 'new' ? '开始一条新鱼？当前工坊里的作品（包括笔迹和印章）会被清空。' : '取消编辑？这次的改动会丢弃，海洋里的原版保持不变。' }}</p>
    <div>
      <button class="button" @click="runConfirm">{{ confirmAction === 'new' ? '开始新鱼' : '取消编辑' }}</button>
      <button class="button button--muted" @click="confirmAction = null">再想想</button>
    </div>
  </div>
  <div v-if="pendingLeave" class="leave-warning" role="alert">
    <p><strong>这条鱼还没保存好。</strong>{{ session?.status.value === 'ready' ? '可以再试一次保存；' : '' }}现在离开，未保存的改动会丢失。</p>
    <div>
      <button v-if="session?.status.value === 'ready' && session.error.value?.kind !== 'conflict'" class="button" @click="retry">重试保存</button>
      <button class="button button--muted" @click="pendingLeave = null">留在这里</button>
      <button class="button button--muted" @click="leave">不保存，离开</button>
    </div>
  </div>
  <div class="workshop-layout studio-layout" :class="{ 'is-observing': trial, 'is-finishing': mode === 'finish' }" :inert="loading">
    <section class="workshop-stage studio-stage" :class="{ 'has-preview': !!editor.preview.value }" aria-label="鱼造型预览">
      <div class="stage-toolbar" role="toolbar" aria-label="编辑操作">
        <ContextHelp :topic="helpTopic" :disabled="!!session?.committing.value || loading" @change="helpOpen = $event; finishGesture()" />
        <CreativeKnowledge v-show="mode === 'edit'" :active="mode === 'edit'" :initial-topic="knowledgeTopic" :design="design" :color="color" :glow="glow" :paint-tick="editor.paintTick.value" :disabled="!!editor.preview.value || loading" @opened="finishGesture(); knowledgeOpen = true" @closed="knowledgeOpen = false" @applied="borrowFeature" @draw="quickTool('pen')" />
        <button class="chip-button" aria-label="撤销" :disabled="!editor.canUndo.value || trial || !!editor.preview.value" @click="editor.undo()"><span aria-hidden="true">↶</span> 撤销</button>
        <button class="chip-button" aria-label="重做" :disabled="!editor.canRedo.value || trial || !!editor.preview.value" @click="editor.redo()"><span aria-hidden="true">↷</span> 重做</button>
        <details class="studio-more"><summary>⋯ 更多</summary><div class="studio-more-panel">
        <button class="chip-button" aria-label="随机造型" :disabled="trial" @click="finishGesture(); editor.previewRandom()"><span aria-hidden="true">🎲</span> 随机造型</button>
        <button class="chip-button" aria-label="暗背景" :aria-pressed="dark" :class="{ selected: dark }" @click="dark = !dark"><span aria-hidden="true">{{ dark ? '🌙' : '☀️' }}</span> 暗背景</button>
        <FishInspiration v-show="!trial" class="studio-inspiration" :initial-id="typeof route.query.observe === 'string' ? route.query.observe : undefined" :design="design" :color="color" :glow="glow" :paint-tick="editor.paintTick.value" :disabled="!!editor.preview.value || loading || trial" @opened="finishGesture(); observationOpen = true" @closed="observationOpen = false" @applied="borrowFeature" />
        <button class="chip-button" :disabled="!session || session.status.value !== 'ready'" @click="confirmAction = 'new'">新建一条</button>
        </div></details>
      </div>
      <div v-if="editor.preview.value" class="preview-bar" role="status">
        <span>随机预览：还没有改变你的鱼，笔迹和印章会保留。</span>
        <div>
          <button class="button" @click="editor.applyPreview()">用这个</button>
          <button class="button button--muted" @click="editor.previewRandom()">换一个</button>
          <button class="button button--muted" @click="editor.cancelPreview()">取消</button>
        </div>
      </div>
      <template v-if="trial">
      <TrialSwim ref="trialView" :design="design" :color="color" :glow="glow" :dark="dark" :effect="shownEffect"
        :paused="showcaseOpen || knowledgeOpen || observationOpen || helpOpen"
        :presentation="mode === 'finish' ? 'arrival' : 'trial'"
        :duration="mode === 'trial' ? 15 : undefined" :label="mode === 'finish' ? '快要入海啦' : '试游池 · 只看不画'" @ended="trialEnded = true" />
      <div v-if="mode === 'trial'" class="swim-summary" role="status">
        <strong>🐟 {{ swim.style.name }}</strong><span>看看尾巴和鱼鳍怎么动。想再改，随时返回。</span><em>游戏设定</em>
      </div>
      <div v-if="mode === 'trial' && trialEnded" class="trial-result" role="dialog" aria-label="试游结果">
        <p>试游 15 秒结束：它是<strong>{{ swim.style.name }}</strong>的鱼。</p>
        <div>
          <button class="button" :disabled="!session || session.status.value !== 'ready'" @click="openFinish">取名，放进海洋</button>
          <button class="button button--muted" @click="tryAnotherTail">换个尾巴试试</button>
          <button class="button button--muted" @click="trialEnded = false">继续看</button>
        </div>
      </div>
      </template>
      <div v-if="!trial" class="studio-dock studio-dock--left" role="group" aria-label="尾巴、身体和鱼鳍工具" :inert="!!editor.preview.value">
        <button v-for="group in leftDock" :key="group.key" :data-part-tool="group.key" :aria-label="`换${group.title}`" :aria-pressed="selected === group.tab && activePart === group.key" @click="selectGroup(group.key)"><PartThumb :design="design" :focus="group.focus" /><span>{{ group.title }}</span></button>
      </div>
      <div id="creative-reference-slot" v-show="mode === 'edit'"></div>
      <FishCanvas v-if="!trial" :design="editor.preview.value ?? design" :color="color" :glow="glow" :paint-tick="editor.paintTick.value"
        :interactive="!editor.preview.value && selected === '画笔' && !!layers" :sculpting="sculpting && !editor.preview.value" :dark="dark" :selected-stamp-id="editor.tool.value === 'stamp' ? editor.selectedStampId.value : null"
        :label="stageLabel"
        @press="editor.press" @drag="editor.move" @release="editor.release" @sculpt-live="editor.live($event)" @sculpt-end="editor.endLive('捏轮廓')" />
      <div v-if="!trial" class="studio-dock studio-dock--right" role="group" aria-label="头型、眼睛和嘴工具" :inert="!!editor.preview.value">
        <button v-for="group in rightDock" :key="group.key" :data-part-tool="group.key" :aria-label="`换${group.title}`" :aria-pressed="selected === group.tab && activePart === group.key" @click="selectGroup(group.key)"><PartThumb :design="design" :focus="group.focus" /><span>{{ group.title }}</span></button>
      </div>
      <div v-if="!trial" class="studio-quicktools" role="group" aria-label="直接创作工具" :inert="!!editor.preview.value">
        <button aria-label="画一画" :aria-pressed="selected === '画笔' && editor.tool.value === 'pen'" @click="quickTool('pen')"><span aria-hidden="true">🖌️</span>画一画</button>
        <button aria-label="擦一擦" :aria-pressed="selected === '画笔' && editor.tool.value === 'eraser'" @click="quickTool('eraser')"><span aria-hidden="true">🧽</span>擦一擦</button>
        <button aria-label="换颜色" :aria-pressed="selected === '颜色'" @click="quickTool('colors')"><span aria-hidden="true">🎨</span>换颜色</button>
        <button aria-label="捏一捏" :aria-pressed="sculpting" @click="quickTool('sculpt')"><span aria-hidden="true">🤏</span>捏一捏</button>
      </div>
      <div v-if="!trial && (selected === '画笔' || selected === '颜色')" class="studio-quickpalette" role="group" :aria-label="selected === '画笔' ? '画笔颜色' : '选中部位的底色'" :inert="!!editor.preview.value">
        <button v-for="item in palette" :key="item.value" :aria-label="`快捷颜色：${item.name}`" :aria-pressed="(selected === '画笔' ? editor.brushColor.value : targetColor) === item.value" :style="{ '--quick-color': item.value }" @click="selected === '画笔' ? editor.brushColor.value = item.value : editor.commit('换颜色', changeColor(design, colorTarget, item.value))"><span /></button>
      </div>
      <div class="stage-bottom">
        <span class="save-status" :class="`save-status--${session?.saveState.value ?? 'error'}`" role="status">{{ statusText }}</span>
        <div class="stage-actions">
          <details class="studio-more"><summary>🐟 看看作品</summary><div class="studio-more-panel">
          <FishShowcase :design="design" :name="session?.meta.value.name" :paint="color?.canvas" :glow="glow?.canvas" :glow-version="glow?.version" :effect="shownEffect" :disabled="!!editor.preview.value || loading" @opened="editor.release(); showcaseOpen = true" @closed="showcaseOpen = false" />
          <CreativeVolume :design="design" :name="session?.meta.value.name" :paint="color?.canvas" :glow="glow?.canvas" :disabled="!!editor.preview.value || loading" @opened="finishGesture(); showcaseOpen = true" @closed="showcaseOpen = false" />
          </div></details>
          <button v-if="session?.saveState.value === 'error' && session.error.value?.kind !== 'conflict'" class="button button--muted" @click="retry">重试保存</button>
          <button v-if="session?.status.value === 'invalid'" class="button button--muted" @click="session.discardInvalidDraft()">放弃旧草稿</button>
          <button v-if="session?.status.value === 'unavailable' || session?.saveState.value === 'error'" class="button button--muted" @click="exportTemporary">导出这条鱼</button>
          <button v-if="mode === 'edit'" class="button" :disabled="!!editor.preview.value" @click="startTrial">试游</button>
          <template v-else>
            <button class="button button--muted" :disabled="session?.committing.value" @click="returnToEdit">返回编辑</button>
            <button v-if="mode === 'trial'" class="button" :disabled="!session || session.status.value !== 'ready'" @click="openFinish">取名入海</button>
          </template>
        </div>
      </div>
    </section>
    <aside v-if="mode === 'finish' && session" class="tool-panel finish-panel" aria-label="取名入海" :inert="session.committing.value">
      <div class="panel-body">
        <span class="eyebrow">🌊 让这条鱼游进海洋</span><h2>名字已经想好啦，也可以自己改。</h2>
        <label class="field-label" for="fish-name">名字（1–16 个字）</label>
        <input id="fish-name" v-model="session.meta.value.name" class="text-input" type="text" maxlength="32" autocomplete="off" :aria-invalid="!!nameError" @input="nameError = ''" :aria-describedby="nameError ? 'name-error' : undefined" />
        <p v-if="nameError" id="name-error" class="editor-message" role="alert">{{ nameError }}</p>
        <button class="reset-shape" @click="session.meta.value.name = defaultName(design)">用推荐的名字：{{ defaultName(design) }}</button>
        <p class="finish-reassurance">造型、花纹和你画的每一笔，都会一起入海。</p>
        <div class="finish-actions">
          <template v-if="editingExisting">
            <button ref="primaryFinish" class="button" :disabled="session.committing.value" @click="saveFish('update')">{{ session.committing.value ? '保存中…' : '更新这条鱼' }}</button>
            <button class="button button--muted" :disabled="session.committing.value" @click="saveFish('saveAs')">另存为新鱼</button>
          </template>
          <button v-else ref="primaryFinish" class="button" :disabled="session.committing.value" @click="saveFish('create')">{{ session.committing.value ? '保存中…' : '放进我的海洋' }}</button>
          <button class="button button--muted" :disabled="session.committing.value" @click="returnToEdit">返回编辑</button>
        </div>
        <p v-if="editingExisting" class="tool-hint">更新：改变海里原来的这条鱼。另存：保留原作，多一条新鱼。</p>
        <details class="finish-options"><summary>选性格和喜欢去的地方</summary>
        <fieldset class="part-group"><legend>性格</legend>
          <div class="target-grid"><button v-for="(label, key) in personalityNames" :key="key" class="chip-button" :class="{ selected: session.meta.value.personality === key }" :aria-pressed="session.meta.value.personality === key" @click="choosePersonality(key)">{{ label }}<small v-if="recommended === key"> · 推荐</small></button></div>
          <p class="tool-hint">按它的游动风格推荐，可以自己改。性格只是游戏设定。</p>
        </fieldset>
        <fieldset class="part-group"><legend>喜欢去的地方</legend>
          <div class="target-grid"><button v-for="habitat in habitats" :key="habitat.id" class="chip-button" :class="{ selected: session.meta.value.preferredHabitat === habitat.id }" :aria-pressed="session.meta.value.preferredHabitat === habitat.id" @click="session.meta.value.preferredHabitat = habitat.id">{{ habitat.name }}</button></div>
          <p class="tool-hint">以后去这片钓场时，它偶尔会路过打招呼。</p>
        </fieldset>
        <div v-if="effects.length" class="effect-box">
          <p>发现组合彩蛋：<strong v-for="effect in effects" :key="effect">「{{ effectInfo[effect].label }}」</strong></p>
          <label><input v-model="session.meta.value.effectEnabled" type="checkbox"> 显示特效</label>
          <p class="tool-hint">彩蛋只是好玩的游戏设定，不会改变部件、笔迹或钓鱼结果。</p>
        </div>
        </details>
        <div v-if="finishError" class="confirm-box" role="alert">
          <p>{{ finishError.message }}</p>
          <div>
            <RouterLink v-if="finishError.kind === 'limit'" class="button button--muted" to="/ocean">去海洋整理作品</RouterLink>
            <button v-if="editingExisting && (finishError.kind === 'missing' || finishError.kind === 'conflict') && session.error.value?.kind !== 'conflict'" class="button button--muted" @click="saveFish('saveAs')">另存为新鱼</button>
            <button class="button button--muted" @click="exportTemporary">导出这条鱼</button>
          </div>
        </div>
      </div>
    </aside>
    <aside v-else-if="mode === 'trial'" class="tool-panel studio-trial-panel" aria-label="试游观察">
      <div><h2>喜欢它现在的样子吗？</h2><p>看看刚换的尾巴，再决定要不要修改。</p></div>
      <div v-if="!trialEnded" class="stage-actions"><button class="button button--muted" @click="tryAnotherTail">换个尾巴试试</button><button class="button" :disabled="!session || session.status.value !== 'ready'" @click="openFinish">准备入海</button></div>
      <details><summary>看看游动特点</summary><p>{{ swim.style.explanation }}每秒约游 {{ swim.profile.speed.toFixed(2) }} 个身长。这里的游动差异是游戏设定。</p></details>
    </aside>
    <aside v-else class="tool-panel studio-tools" aria-label="工坊工具" :inert="!!editor.preview.value">
      <div class="segmented" aria-label="工具分类">
        <button v-for="tab in tabs" :key="tab" :aria-label="tab" :aria-pressed="selected === tab" :class="{ selected: selected === tab }" @click="selectTab(tab)"><span aria-hidden="true">{{ tabIcons[tab] }}</span>{{ tab }}</button>
      </div>

      <div v-if="selected === '造型' || selected === '部件'" class="panel-body">
        <div class="studio-group-switch" role="group" aria-label="选择要换的部位"><button v-for="group in partGroups.filter(item => item.tab === selected)" :key="group.key" class="chip-button" :aria-pressed="activePart === group.key" :class="{ selected: activePart === group.key }" @click="selectGroup(group.key)">{{ group.title }}</button></div>
        <fieldset v-for="group in [selectedGroup]" :key="group.key" class="part-group">
          <legend>{{ group.title }}</legend>
          <div class="part-grid">
            <button v-for="item in group.items" :key="item.id" class="part-card" :class="{ selected: partValue(group.key) === item.id }" :aria-pressed="partValue(group.key) === item.id" @click="pickPart(group.key, item.id, group.title)">
              <PartThumb :design="changePart(design, group.key, item.id)" :focus="group.focus" /><span>{{ item.name }}</span>
            </button>
          </div>
        </fieldset>
        <details v-if="selected === '造型'" class="studio-proportions"><summary>↔ 调一调长短、胖瘦和头的大小</summary>
          <div v-for="control in controls" :key="control.key" class="shape-control">
            <div class="control-heading"><label :for="`shape-${control.key}`">{{ control.name }}</label><output :for="`shape-${control.key}`">{{ valueLabel(control.key) }}</output></div>
            <input :id="`shape-${control.key}`" type="range" :min="shapeLimits[control.key].min" :max="shapeLimits[control.key].max" :step="shapeLimits[control.key].step" :value="design.shape[control.key]" :aria-valuetext="valueLabel(control.key)" @input="updateShape(control.key, $event)" @change="editor.endLive('调整比例')" @pointerup="editor.endLive('调整比例')" @blur="editor.endLive('调整比例')" />
            <p>{{ control.hint }}</p>
          </div>
          <button class="reset-shape" @click="editor.commit('恢复默认比例', resetShape(design))">恢复默认比例</button>
        </details>
        <SculptEditor v-if="selected === '造型'" :design="design" @live="editor.live($event)" @end="editor.endLive('捏轮廓')" @reset="editor.commit('恢复原轮廓', (({ sculpt, ...rest }) => rest)(design))" />
        <p v-else class="panel-footnote">游动差异只是游戏设定：比如新月尾在这里游得快，不代表真实鱼类都这样。</p>
      </div>

      <div v-else-if="selected === '颜色'" class="panel-body">
        <fieldset class="part-group"><legend>要涂的部位</legend>
          <div class="target-grid"><button v-for="target in colorTargets" :key="target.key" class="chip-button" :class="{ selected: colorTarget === target.key }" :aria-pressed="colorTarget === target.key" @click="colorTarget = target.key">{{ target.name }}</button></div>
        </fieldset>
        <fieldset class="swatches"><legend>颜色</legend><div>
          <button v-for="item in palette" :key="item.value" :aria-pressed="targetColor === item.value" :aria-label="item.name" :title="item.name" :class="{ selected: targetColor === item.value }" :style="{ '--swatch': item.value }" @click="editor.commit('换颜色', changeColor(design, colorTarget, item.value))" />
        </div><p>当前：{{ colorName(targetColor) }}</p></fieldset>
        <fieldset class="part-group"><legend>花纹</legend>
          <div class="part-grid">
            <button v-for="item in patterns" :key="item.id" class="part-card" :class="{ selected: design.pattern.id === item.id }" :aria-pressed="design.pattern.id === item.id" @click="editor.commit('换花纹', changePattern(design, item.id))">
              <PartThumb :design="changePattern(design, item.id)" /><span>{{ item.name }}</span>
            </button>
          </div>
        </fieldset>
        <div v-if="adjustablePatterns.has(design.pattern.id)" class="pattern-controls">
          <div v-for="key in (['size', 'density'] as const)" :key="key" class="shape-control">
            <div class="control-heading"><label :for="`pattern-${key}`">{{ key === 'size' ? '花纹大小' : design.pattern.id === 'clown-bands' ? '白带间距（远 → 近）' : '花纹疏密（疏 → 密）' }}</label><output :for="`pattern-${key}`">{{ (design.pattern[key] ?? 1).toFixed(2) }}</output></div>
            <input :id="`pattern-${key}`" type="range" :aria-label="key === 'size' ? '花纹大小' : '花纹疏密'" :min="patternLimits[key].min" :max="patternLimits[key].max" step="0.05" :value="design.pattern[key] ?? 1" @input="updatePatternDetail(key, $event)" @change="editor.endLive('调整花纹')" @pointerup="editor.endLive('调整花纹')" @blur="editor.endLive('调整花纹')">
          </div>
        </div>
        <p class="panel-footnote">花纹的两种颜色在“花纹主色 / 花纹辅色”里换。</p>
      </div>

      <div v-else class="panel-body">
        <fieldset class="part-group"><legend>工具</legend>
          <div class="target-grid"><button v-for="item in tools" :key="item.key" class="chip-button" :class="{ selected: editor.tool.value === item.key }" :aria-pressed="editor.tool.value === item.key" @click="editor.tool.value = item.key">{{ item.name }}</button></div>
          <p class="tool-hint">{{ currentTool.hint }}</p>
        </fieldset>
        <fieldset v-if="editor.tool.value !== 'eraser'" class="swatches"><legend>{{ editor.tool.value === 'stamp' ? '印章颜色' : editor.tool.value === 'fill' ? '底色' : '笔的颜色' }}</legend><div>
          <button v-for="item in palette" :key="item.value" :aria-pressed="editor.brushColor.value === item.value" :aria-label="item.name" :title="item.name" :class="{ selected: editor.brushColor.value === item.value }" :style="{ '--swatch': item.value }" @click="editor.brushColor.value = item.value" />
        </div><p>当前：{{ colorName(editor.brushColor.value) }}</p></fieldset>
        <div v-if="['pen', 'glow', 'eraser'].includes(editor.tool.value)" class="shape-control">
          <div class="control-heading"><label for="brush-width">{{ editor.tool.value === 'eraser' ? '橡皮大小' : '笔的粗细' }}</label><output for="brush-width">{{ widthLabel }}</output></div>
          <input id="brush-width" v-model.number="editor.brushWidth.value" type="range" :min="brushLimits.min" :max="brushLimits.max" :step="brushLimits.step" :aria-valuetext="`身体宽度的 ${widthLabel}`" />
          <p>粗细按身体宽度计算，换屏幕大小也一样。</p>
        </div>
        <template v-if="editor.tool.value === 'stamp'">
          <fieldset class="part-group"><legend>印章（{{ design.stamps.length }} / {{ stampLimits.max }}）</legend>
            <div class="target-grid"><button v-for="item in stampKinds" :key="item.id" class="chip-button" :class="{ selected: editor.stampKind.value === item.id }" :aria-pressed="editor.stampKind.value === item.id" @click="editor.stampKind.value = item.id">{{ item.name }}</button></div>
          </fieldset>
          <div v-if="stamp" class="stamp-controls" role="group" aria-label="调整选中的印章">
            <p>选中：{{ stampName }}</p>
            <div class="stamp-buttons">
              <button class="chip-button" @click="nudgeStamp(0, -0.02)">上移</button><button class="chip-button" @click="nudgeStamp(0, 0.02)">下移</button>
              <button class="chip-button" @click="nudgeStamp(-0.02, 0)">左移</button><button class="chip-button" @click="nudgeStamp(0.02, 0)">右移</button>
              <button class="chip-button" @click="editor.adjustStamp('旋转印章', (s) => ({ rotation: s.rotation - Math.PI / 12 }))">向左转</button>
              <button class="chip-button" @click="editor.adjustStamp('旋转印章', (s) => ({ rotation: s.rotation + Math.PI / 12 }))">向右转</button>
              <button class="chip-button" :disabled="stamp.scale <= stampLimits.scale.min" @click="editor.adjustStamp('缩放印章', (s) => ({ scale: s.scale - 0.02 }))">缩小</button>
              <button class="chip-button" :disabled="stamp.scale >= stampLimits.scale.max" @click="editor.adjustStamp('缩放印章', (s) => ({ scale: s.scale + 0.02 }))">放大</button>
              <button class="chip-button" @click="editor.adjustStamp('印章换色', () => ({ color: editor.brushColor.value }))">换成当前颜色</button>
              <button class="chip-button chip-button--danger" @click="editor.deleteStamp()">删除</button>
            </div>
          </div>
        </template>
        <div class="clear-paint">
          <button v-if="!confirmClear" class="reset-shape" @click="confirmClear = true">清空画笔和发光笔迹…</button>
          <div v-else class="confirm-box" role="alert">
            <p>要清空所有画笔和发光笔迹吗？底色、花纹和印章会保留，清空后可以撤销。</p>
            <div><button class="button" @click="editor.clearPaint(); confirmClear = false">清空</button><button class="button button--muted" @click="confirmClear = false">取消</button></div>
          </div>
        </div>
        <p class="panel-footnote">自由画笔需要指针或触摸；键盘可以选工具、颜色、粗细，并用按钮调整印章。Ctrl+Z 撤销，Ctrl+Shift+Z 重做。</p>
      </div>
      <p class="editor-message" role="status" aria-live="polite">{{ editor.message.value }}</p>
    </aside>
  </div>
</template>
<style scoped>
.studio-quicktools,.studio-quickpalette{grid-column:1/-1;display:flex;justify-content:center;gap:10px;flex-wrap:wrap;padding:8px 12px;background:#f3f8f2}.studio-quicktools{grid-row:calc(var(--studio-row,2) + 1)}.studio-quickpalette{grid-row:calc(var(--studio-row,2) + 2);gap:4px;padding-top:0}.studio-quicktools button{min-height:56px;min-width:110px;border:1px solid #bfd7ca;border-radius:15px;background:#fffdf2;color:#315c50;font-size:15px;display:flex;align-items:center;justify-content:center;gap:8px}.studio-quicktools button span{font-size:25px}.studio-quicktools button[aria-pressed=true]{background:#d4ebdf;border:2px solid #448d74}.studio-quickpalette button{width:48px;height:48px;padding:6px;border:2px solid transparent;background:transparent;border-radius:50%}.studio-quickpalette button span{display:block;width:100%;height:100%;border-radius:50%;background:var(--quick-color);border:1px solid #385f5066}.studio-quickpalette button[aria-pressed=true]{border-color:#175f57;background:#fffdf2}.studio-more summary{min-height:48px;display:flex;align-items:center;padding:8px 12px;border:1px solid #bfd4c4;border-radius:12px;font-size:13px;cursor:pointer;list-style:none;background:#fffdf3}.studio-more-panel{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px}.stage-toolbar .studio-more[open]{flex-basis:100%}.studio-stage>.stage-bottom{grid-row:calc(var(--studio-row,2) + 3)}@media(max-width:560px){.studio-quicktools{gap:6px;padding:7px}.studio-quicktools button{min-width:0;flex:1;font-size:12px;flex-direction:column;gap:2px}.studio-quickpalette{gap:1px}.studio-quickpalette button{width:44px;height:44px}}
</style>

<style scoped>
.studio-tools .segmented button{white-space:nowrap}
.studio-heading{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:14px}.studio-title{margin:0}.studio-title :deep(h1){font-size:27px;margin:3px 0;letter-spacing:-.5px}.studio-title :deep(.eyebrow){font-size:9px;letter-spacing:1.4px}.studio-title :deep(.page-description){font-size:12px}.studio-steps{display:flex;gap:6px;padding:0;margin:0;list-style:none;flex-shrink:0}.studio-steps button{min-height:48px;display:flex;align-items:center;gap:8px;border:1px solid #d2e2dc;border-radius:15px;padding:8px 15px;background:#f5f9f4;color:#67817a;font-size:14px}.studio-steps button[aria-current=step]{background:#dcefea;border-color:#72ab9b;color:#215f52;font-weight:700}.studio-steps button>span{font-size:20px}.studio-steps button:disabled{opacity:.45}
.studio-layout{grid-template-columns:minmax(0,1fr);gap:12px}.studio-stage{display:grid;grid-template-columns:88px minmax(0,1fr) 88px;background:#f7fbf7;border-color:#c8ded7;box-shadow:0 10px 24px #22524d08}.studio-stage>.stage-toolbar{grid-column:1/-1;grid-row:1;padding:8px 12px;gap:6px;align-items:center;background:#f3f8f2}.studio-stage>.stage-toolbar>.chip-button{min-height:44px;padding:6px 11px;font-size:12px}.studio-stage>.stage-toolbar>.chip-button>span{font-size:18px}.studio-stage>.stage-toolbar>.chip-button:last-child{margin-left:auto;color:#6f8378}.studio-stage>.fish-canvas-stage{grid-column:2;grid-row:var(--studio-row,2);height:clamp(260px,36dvh,420px);border-radius:18px;margin:0 2px;border:1px solid #8dc0c5}.studio-stage.has-preview{--studio-row:3}.studio-stage>.preview-bar{grid-column:1/-1;grid-row:2}.studio-stage>.stage-bottom,.studio-stage>.swim-summary,.studio-stage>.trial-result{grid-column:1/-1}.studio-stage>.stage-bottom{padding:10px 14px;min-height:64px}.studio-stage .stage-actions{gap:7px}.studio-stage .stage-actions :deep(.button){min-height:48px}.studio-stage>.stage-bottom>.save-status{font-size:11px}.studio-stage>.swim-summary{padding:12px 18px 0;font-size:12px}.studio-stage>.trial-result{margin-bottom:8px}.is-observing .studio-stage>.fish-canvas-stage{grid-column:1/-1;margin:0 10px}
.studio-dock{grid-row:var(--studio-row,2);display:flex;flex-direction:column;justify-content:center;gap:8px;padding:8px}.studio-dock--left{grid-column:1}.studio-dock--right{grid-column:3}.studio-dock button{display:flex;flex-direction:column;align-items:center;gap:3px;min-height:72px;padding:5px;border:1px solid #d3e2d9;border-radius:15px;background:#fffdf8;color:#42695d;font-size:12px}.studio-dock button[aria-pressed=true]{border:2px solid #619a83;padding:4px;background:#e2efe1;box-shadow:0 2px 8px #23563b12}.studio-dock :deep(.part-thumb){height:39px;background:#e0efe8;border-radius:9px}.studio-dock button>span{font-weight:650}
.studio-inspiration{margin-left:5px}.studio-inspiration :deep(.inspiration-entry){padding:0;border:0;background:transparent;gap:6px;flex-wrap:nowrap}.studio-inspiration :deep(.inspiration-peek),.studio-inspiration :deep(.inspiration-entry-copy){display:none}.studio-inspiration :deep(.inspiration-open),.studio-inspiration :deep(.inspiration-sound){min-height:44px;font-size:12px;padding:7px 10px}.studio-inspiration :deep(.companion-art){width:44px}.studio-inspiration :deep(.companion-art img){height:40px}.studio-inspiration :deep(.inspiration-entry-error){display:none}
.studio-tools{padding:10px 14px 8px;border-color:#c8ded7;background:#fffef8}.studio-tools>.segmented{max-width:470px;margin-bottom:9px;background:#e8f2ea}.studio-tools>.segmented button{min-height:46px;display:flex;justify-content:center;align-items:center;gap:7px}.studio-tools>.segmented button>span{font-size:20px}.studio-tools>.panel-body{padding:0;max-height:242px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}.studio-tools .part-group{margin-bottom:8px}.studio-tools .part-group legend{margin-bottom:7px;color:#496e60;font-size:12px}.studio-tools .part-grid{grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.studio-tools .part-card{min-height:88px;padding:5px 5px 7px;font-size:12px;background:#f3f8ed}.studio-tools :deep(.part-thumb){height:54px;background:#d9ebe5}.studio-tools .part-card.selected{background:#e4f0dd;box-shadow:inset 0 0 0 1px #6c9980}.studio-group-switch{display:flex;gap:6px;margin-bottom:9px}.studio-group-switch .chip-button{min-height:44px;padding:7px 14px;font-size:12px}.studio-proportions{margin:8px 0}.studio-proportions>summary,.finish-options>summary,.studio-trial-panel summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-size:12px;font-weight:650;color:#447160}.studio-proportions .shape-control{margin:8px 0}.studio-tools .shape-control input{min-height:44px}.studio-tools .target-grid{gap:6px}.studio-tools .target-grid .chip-button{font-size:12px;min-height:44px}.studio-tools .swatches{max-width:650px;margin:10px 0}.studio-tools .swatches>div{grid-template-columns:repeat(12,minmax(0,1fr))}.studio-tools .panel-footnote{margin:8px 0 0;font-size:10px}.studio-tools>.editor-message{margin-top:6px;min-height:0}.studio-trial-panel{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:18px 22px;border-color:#c8ded7;background:#f5faf1}.studio-trial-panel h2{font-size:19px;margin:0 0 4px}.studio-trial-panel p{font-size:12px;color:#6b8376}.studio-trial-panel details{width:100%}.studio-trial-panel summary{min-height:32px}
.finish-panel{background:#f4f9ed;border-color:#c8ded7;padding:8px 20px}.finish-panel .panel-body{padding:14px 0}.finish-panel h2{font-size:19px;line-height:1.6;margin:8px 0 16px}.finish-panel .reset-shape{text-align:left;min-height:44px}.finish-reassurance{font-size:12px;color:#597662;margin:2px 0 14px}.finish-actions{gap:8px}.finish-actions>.button{min-height:52px}.finish-options{border-top:1px solid #d6e4d3;margin-top:18px;padding-top:5px}.finish-options .part-group{margin-top:12px}.finish-panel .confirm-box{margin-top:12px}
@media(min-width:1000px){.studio-layout.is-finishing{grid-template-columns:minmax(0,1fr) 310px;align-items:start}.is-finishing .studio-stage>.fish-canvas-stage{height:clamp(320px,48dvh,510px)}}
@media(max-width:760px){.studio-heading{align-items:flex-start;gap:10px}.studio-title :deep(h1){font-size:23px}.studio-title :deep(.page-description){display:none}.studio-steps button{flex-direction:column;gap:1px;min-width:56px;padding:5px 9px;font-size:11px}.studio-steps button>span{font-size:18px}.studio-stage{grid-template-columns:66px minmax(0,1fr) 66px}.studio-stage>.fish-canvas-stage{height:340px}.studio-dock{padding:6px;gap:9px}.studio-dock button{min-height:65px;font-size:11px}.studio-dock :deep(.part-thumb){height:34px}.studio-stage>.stage-bottom{flex-direction:row;align-items:center}.studio-stage>.stage-bottom>.save-status{max-width:35%}.studio-tools .part-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.studio-tools .swatches>div{grid-template-columns:repeat(6,minmax(0,1fr))}.studio-tools>.panel-body{max-height:310px}.studio-stage :deep(.scene-label){top:10px;left:12px;letter-spacing:0;font-size:9px}.studio-stage .stage-actions :deep(.button){padding:8px 12px;font-size:12px}.studio-trial-panel{padding:16px}.finish-panel{padding:5px 16px}}
@media(max-width:480px){.studio-heading{flex-wrap:wrap;align-items:center}.studio-title :deep(h1){font-size:24px}.studio-steps{width:100%;gap:7px}.studio-steps li{flex:1}.studio-steps button{width:100%;min-height:44px;flex-direction:row;font-size:12px}.studio-stage{grid-template-columns:58px minmax(0,1fr) 58px}.studio-stage>.fish-canvas-stage{height:295px}.studio-dock{padding:4px;gap:9px}.studio-dock button{min-height:66px;padding:4px;border-radius:12px}.studio-stage>.stage-toolbar{padding:7px 8px;gap:5px}.studio-stage>.stage-toolbar>.chip-button{font-size:11px;padding:5px 8px}.studio-stage>.stage-toolbar>.chip-button:last-child{margin-left:0}.studio-stage>.stage-bottom{flex-direction:column;align-items:stretch;gap:6px}.studio-stage>.stage-bottom>.save-status{max-width:none;font-size:10px;text-align:center}.studio-stage .stage-actions{justify-content:center}.studio-tools{padding:9px}.studio-tools>.panel-body{max-height:330px}.studio-tools .segmented button{font-size:12px;gap:4px}.studio-group-switch{flex-wrap:wrap}.studio-group-switch .chip-button{padding:7px 11px}.studio-trial-panel .stage-actions{width:100%;justify-content:flex-start}}
.studio-trial-panel{flex-direction:row}
@media(max-width:480px){
  .studio-stage{grid-template-columns:repeat(6,minmax(0,1fr))}
  .studio-stage>.fish-canvas-stage{grid-column:1/-1;height:260px;margin:0 8px}
  .studio-dock{grid-row:var(--studio-tool-row,3);flex-direction:row;gap:4px;padding:7px 4px}
  .studio-dock--left{grid-column:1/4}.studio-dock--right{grid-column:4/7}
  .studio-stage.has-preview{--studio-tool-row:4}
  .studio-dock button{flex:1;min-width:0;min-height:62px;padding:3px;font-size:10px}
  .studio-dock :deep(.part-thumb){height:31px}
  .studio-tools>.segmented button{padding:8px 5px;font-size:11px}
}
</style>

<style scoped>
#creative-reference-slot{grid-column:1/-1;grid-row:calc(var(--studio-row,2) + 4);padding:0 12px}#creative-reference-slot:empty{display:none}
@media(max-width:480px){.studio-stage>.studio-quicktools{grid-row:calc(var(--studio-tool-row,3) + 1)}.studio-stage>.studio-quickpalette{grid-row:calc(var(--studio-tool-row,3) + 2)}.studio-stage>.stage-bottom{grid-row:calc(var(--studio-tool-row,3) + 3)}#creative-reference-slot{grid-row:calc(var(--studio-tool-row,3) + 4);padding:0 8px}}.is-observing .studio-stage>.stage-bottom{grid-row:auto}
</style>
