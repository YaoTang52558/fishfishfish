<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { habitats } from '../catalog/habitats.ts';
import { speciesById, type SpeciesDefinition } from '../catalog/species.ts';
import { bodies, brushLimits, eyes, finSets, heads, mouths, palette, patterns, shapeLimits, stampKinds, stampLimits, tails } from '../catalog/fish.ts';
import { changeColor, changePart, changePattern, changeShape, resetShape, type PartKey } from '../domain/fish.ts';
import { isAssetId } from '../domain/fish.ts';
import { defaultName, describeSwim, displayedEffect, effectInfo, personalityNames, recommendPersonality, satisfiedEffects, validateName } from '../domain/rules.ts';
import type { ColorSlot, Personality, ShapeKey } from '../domain/types.ts';
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
import PreviewNotice from '../components/PreviewNotice.vue';
import TrialSwim from '../components/TrialSwim.vue';

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
const selected = ref<(typeof tabs)[number]>('造型');
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
const partGroups: Array<{ tab: '造型' | '部件'; key: PartKey; title: string; items: readonly { id: string; name: string }[]; focus?: 'head' }> = [
  { tab: '造型', key: 'bodyId', title: '身体', items: bodies },
  { tab: '造型', key: 'headId', title: '头型', items: heads },
  { tab: '部件', key: 'tailId', title: '尾巴', items: tails },
  { tab: '部件', key: 'finId', title: '鳍', items: finSets },
  { tab: '部件', key: 'eyeId', title: '眼睛', items: eyes, focus: 'head' },
  { tab: '部件', key: 'mouthId', title: '嘴', items: mouths, focus: 'head' },
];
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
const currentBody = computed(() => bodies.find((body) => body.id === design.value.bodyId)!);
const currentTool = computed(() => tools.find((item) => item.key === editor.tool.value)!);
const widthLabel = computed(() => `${Math.round(editor.brushWidth.value * 1000) / 10}%`);
const loading = computed(() => session?.status.value === 'loading');
const statusText = computed(() => session?.statusText.value ?? '此浏览器无法创建画布，作品不能画也不能保存');
const stamp = editor.selectedStamp;
const stageLabel = computed(() => {
  if (editor.preview.value) return '随机预览';
  if (selected.value !== '画笔') return '你的造型';
  const tool = editor.tool.value;
  return tool === 'fill' ? '换底色 · 点一下要换色的部位' : tool === 'stamp' ? '印章 · 点身体盖章' : `${currentTool.value.name} · 只画在身体上`;
});
// 仅开发模式：供浏览器验证读取撤销历史占用，正式构建不暴露。
if (import.meta.env.DEV) (window as unknown as { __fishEditor?: typeof editor }).__fishEditor = editor;
const stampName = computed(() => stampKinds.find((item) => item.id === stamp.value?.kind)?.name ?? '');

function nudgeStamp(du: number, dv: number) { editor.adjustStamp('移动印章', (s) => ({ u: s.u + du, v: s.v + dv })); }
function selectTab(tab: (typeof tabs)[number]) { selected.value = tab; mode.value = 'edit'; confirmClear.value = false; }

// —— 试游与入海 ——
const swim = computed(() => describeSwim(design.value));
const recommended = computed(() => recommendPersonality(design.value));
const effects = computed(() => satisfiedEffects(design.value, glowPixels.value));
const shownEffect = computed(() => displayedEffect(effects.value, session?.meta.value.effectEnabled ?? true));
const editingExisting = computed(() => !!session?.source.value);
function measureGlow() { glowPixels.value = glow ? visibleGlowPixels(glow.canvas, glow.version, design.value) : 0; }
function startTrial() { editor.release(); measureGlow(); mode.value = 'trial'; trialEnded.value = false; trialView.value?.restart(); }
async function tryAnotherTail() {
  mode.value = 'edit'; selected.value = '部件';
  await nextTick();
  const first = document.querySelector('.part-group .part-card') as HTMLElement | null;
  first?.scrollIntoView({ block: 'nearest' }); first?.focus();
}
function openFinish() {
  if (!session) return;
  measureGlow(); mode.value = 'finish'; finishError.value = null; nameError.value = '';
  const meta = session.meta.value;
  if (!meta.name.trim()) meta.name = defaultName(design.value);
  // 新作品默认采用推荐性格；玩家改过或是再次编辑的作品就保留原选择。
  if (!editingExisting.value && !personalityTouched.value) meta.personality = recommended.value;
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
  if (!(event.ctrlKey || event.metaKey) || trial.value) return;
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
  <PageHeading eyebrow="想象工坊 / CREATE" title="创造一条，只属于你的鱼。" description="拼身体、头和尾巴，涂颜色、画图案、盖印章，再放进试游池看看它怎么游。" />
  <PreviewNotice text="完成作品后可以取名、放进我的海洋；钓鱼玩法会在后面的版本开放。" />
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
    <p>正在编辑海洋里的「{{ session.meta.value.name || '这条鱼' }}」。可以更新它，也可以另存为新鱼；取消编辑会保留原版。</p>
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
  <div class="workshop-layout" :inert="loading">
    <section class="workshop-stage" aria-label="鱼造型预览">
      <div class="stage-toolbar" role="toolbar" aria-label="编辑操作">
        <button class="chip-button" :disabled="!editor.canUndo.value || trial || !!editor.preview.value" @click="editor.undo()">撤销</button>
        <button class="chip-button" :disabled="!editor.canRedo.value || trial || !!editor.preview.value" @click="editor.redo()">重做</button>
        <button class="chip-button" :disabled="trial" @click="editor.previewRandom()">随机造型</button>
        <button class="chip-button" :aria-pressed="dark" :class="{ selected: dark }" @click="dark = !dark">暗背景</button>
        <button class="chip-button" :disabled="!session || session.status.value !== 'ready'" @click="confirmAction = 'new'">新建一条</button>
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
        :duration="mode === 'trial' ? 15 : undefined" :label="mode === 'finish' ? '快要入海啦' : '试游池 · 只看不画'" @ended="trialEnded = true" />
      <div v-if="mode === 'trial'" class="swim-summary" role="status">
        <strong>{{ swim.style.name }}</strong><span>{{ swim.style.explanation }}每秒约游 {{ swim.profile.speed.toFixed(2) }} 个身长。</span><em>游戏设定</em>
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
      <FishCanvas v-else :design="editor.preview.value ?? design" :color="color" :glow="glow" :paint-tick="editor.paintTick.value"
        :interactive="!editor.preview.value && selected === '画笔' && !!layers" :dark="dark" :selected-stamp-id="editor.tool.value === 'stamp' ? editor.selectedStampId.value : null"
        :label="stageLabel"
        @press="editor.press" @drag="editor.move" @release="editor.release" />
      <div class="stage-bottom">
        <span class="save-status" :class="`save-status--${session?.saveState.value ?? 'error'}`" role="status">{{ statusText }}</span>
        <div class="stage-actions">
          <button v-if="session?.saveState.value === 'error' && session.error.value?.kind !== 'conflict'" class="button button--muted" @click="retry">重试保存</button>
          <button v-if="session?.status.value === 'invalid'" class="button button--muted" @click="session.discardInvalidDraft()">放弃旧草稿</button>
          <button v-if="session?.status.value === 'unavailable' || session?.saveState.value === 'error'" class="button button--muted" @click="exportTemporary">导出这条鱼</button>
          <button v-if="mode === 'edit'" class="button" :disabled="!!editor.preview.value" @click="startTrial">试游</button>
          <template v-else>
            <button class="button button--muted" @click="mode = 'edit'">返回编辑</button>
            <button v-if="mode === 'trial'" class="button" :disabled="!session || session.status.value !== 'ready'" @click="openFinish">取名入海</button>
          </template>
        </div>
      </div>
    </section>
    <aside v-if="mode === 'finish' && session" class="tool-panel finish-panel" aria-label="取名入海">
      <div class="panel-body">
        <span class="eyebrow">最后一步</span><h2>给它一个名字</h2>
        <label class="field-label" for="fish-name">名字（1–16 个字）</label>
        <input id="fish-name" v-model="session.meta.value.name" class="text-input" type="text" maxlength="32" autocomplete="off" :aria-invalid="!!nameError" @input="nameError = ''" :aria-describedby="nameError ? 'name-error' : undefined" />
        <p v-if="nameError" id="name-error" class="editor-message" role="alert">{{ nameError }}</p>
        <button class="reset-shape" @click="session.meta.value.name = defaultName(design)">用推荐的名字：{{ defaultName(design) }}</button>
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
        <div v-if="finishError" class="confirm-box" role="alert">
          <p>{{ finishError.message }}</p>
          <div>
            <RouterLink v-if="finishError.kind === 'limit'" class="button button--muted" to="/ocean">去海洋整理作品</RouterLink>
            <button v-if="editingExisting && (finishError.kind === 'missing' || finishError.kind === 'conflict') && session.error.value?.kind !== 'conflict'" class="button button--muted" @click="saveFish('saveAs')">另存为新鱼</button>
            <button class="button button--muted" @click="exportTemporary">导出这条鱼</button>
          </div>
        </div>
        <div class="finish-actions">
          <template v-if="editingExisting">
            <button class="button" :disabled="session.committing.value" @click="saveFish('update')">{{ session.committing.value ? '保存中…' : '更新这条鱼' }}</button>
            <button class="button button--muted" :disabled="session.committing.value" @click="saveFish('saveAs')">另存为新鱼</button>
          </template>
          <button v-else class="button" :disabled="session.committing.value" @click="saveFish('create')">{{ session.committing.value ? '保存中…' : '放进我的海洋' }}</button>
          <button class="button button--muted" :disabled="session.committing.value" @click="mode = 'edit'">返回编辑</button>
        </div>
      </div>
    </aside>
    <aside v-else class="tool-panel" aria-label="工坊工具" :inert="!!editor.preview.value">
      <div class="segmented" aria-label="工具分类">
        <button v-for="tab in tabs" :key="tab" :aria-pressed="selected === tab" :class="{ selected: selected === tab }" @click="selectTab(tab)">{{ tab }}</button>
      </div>

      <div v-if="selected === '造型' || selected === '部件'" class="panel-body">
        <div v-if="selected === '造型'" class="body-choice"><span class="eyebrow">{{ currentBody.alias }}</span><h2>{{ currentBody.name }}</h2><p>{{ currentBody.description }}</p></div>
        <fieldset v-for="group in partGroups.filter((item) => item.tab === selected)" :key="group.key" class="part-group">
          <legend>{{ group.title }}</legend>
          <div class="part-grid">
            <button v-for="item in group.items" :key="item.id" class="part-card" :class="{ selected: partValue(group.key) === item.id }" :aria-pressed="partValue(group.key) === item.id" @click="pickPart(group.key, item.id, group.title)">
              <PartThumb :design="changePart(design, group.key, item.id)" :focus="group.focus" /><span>{{ item.name }}</span>
            </button>
          </div>
        </fieldset>
        <template v-if="selected === '造型'">
          <div v-for="control in controls" :key="control.key" class="shape-control">
            <div class="control-heading"><label :for="`shape-${control.key}`">{{ control.name }}</label><output :for="`shape-${control.key}`">{{ valueLabel(control.key) }}</output></div>
            <input :id="`shape-${control.key}`" type="range" :min="shapeLimits[control.key].min" :max="shapeLimits[control.key].max" :step="shapeLimits[control.key].step" :value="design.shape[control.key]" :aria-valuetext="valueLabel(control.key)" @input="updateShape(control.key, $event)" @change="editor.endLive('调整比例')" />
            <p>{{ control.hint }}</p>
          </div>
          <button class="reset-shape" @click="editor.commit('恢复默认比例', resetShape(design))">恢复默认比例</button>
        </template>
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
