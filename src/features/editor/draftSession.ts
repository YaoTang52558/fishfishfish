import { computed, nextTick, ref, shallowRef, watch, type Ref } from 'vue';
import { paintResolution } from '../../catalog/fish.ts';
import { createDraft } from '../../domain/draft.ts';
import { setPaintAsset, validateFishDesign } from '../../domain/fish.ts';
import { createId } from '../../domain/id.ts';
import type { EditorDraft, EffectId, FishDesign, FishMeta } from '../../domain/types.ts';
import { buildTemporaryBackup } from '../../storage/backup.ts';
import { openDatabase, StorageError, toStorageError } from '../../storage/db.ts';
import { discardDraft, loadDraft, saveDraft, type LayerKey, type PaintChange } from '../../storage/drafts.ts';
import { onExternalChange } from '../../storage/queue.ts';
import { commitFish, startEditFromFish, type CommitMode, type CommitResult } from '../../storage/repository.ts';
import { DraftAutosaver, type SaveState } from './autosave.ts';
import type { PaintLayer } from './paintLayer.ts';

export type SessionStatus = 'loading' | 'ready' | 'unavailable' | 'invalid' | 'committed';
const layerKeys: readonly LayerKey[] = ['color', 'glow'];
const defaultMeta = (): FishMeta => ({ name: '', personality: 'curious', preferredHabitat: 'reef-edge', effectEnabled: true });
export interface SessionHooks {
  /** 载入或替换草稿：编辑器替换作品并清空撤销历史。 */
  load(design: FishDesign | null): void;
}

/**
 * 工坊与单个草稿的连接：载入、500ms 防抖保存、跳转前 flush、再次编辑、提交入海。
 * 作品始终先保留在内存；只有存档确认成功才显示“已保存”。
 */
export function useDraftSession(design: Ref<FishDesign>, layers: Record<LayerKey, PaintLayer>, hooks: SessionHooks) {
  const status = ref<SessionStatus>('loading');
  const saveState = ref<SaveState>('idle');
  const error = ref<StorageError | null>(null);
  const notice = ref('');
  const meta = ref<FishMeta>(defaultMeta());
  const source = shallowRef<{ fishId: string; revision: number } | null>(null);
  /** 再次编辑时已有其他草稿：等用户确认是否替换。 */
  const pendingReplace = shallowRef<{ fishId: string; draftName: string } | null>(null);
  const externalChange = ref(false);
  let db: IDBDatabase | null = null;
  let revision = 0;
  const savedVersion = { color: layers.color.version, glow: layers.glow.version };
  const key = () => JSON.stringify([design.value, meta.value, source.value]);
  let savedKey = key();
  let stopExternal: () => void = () => undefined;

  async function encode(layer: PaintLayer): Promise<PaintChange> {
    // PNG 编码在事务外完成；没有可见笔迹时不保存空图片。
    if (layer.isEmpty()) return { kind: 'clear' };
    const blob = await layer.toBlob();
    return { kind: 'replace', asset: { id: createId(), mime: 'image/png', blob, bytes: blob.size, width: paintResolution, height: paintResolution } };
  }
  function snapshotDraft(rev: number): EditorDraft {
    // 校验同时生成普通对象快照：Vue 代理对象不能被 IndexedDB 结构化克隆。
    const checked = validateFishDesign(design.value);
    if (!checked.ok) throw new StorageError('invalid', '作品数据无效，未保存');
    return createDraft(checked.value, rev, { ...meta.value, sourceFishId: source.value?.fishId ?? null, sourceFishRevision: source.value?.revision ?? null });
  }
  async function persist() {
    if (!db || status.value !== 'ready') throw new StorageError('unavailable', '本地存储不可用');
    const draft = snapshotDraft(revision);
    const versions = { color: layers.color.version, glow: layers.glow.version };
    const changes = { color: { kind: 'keep' } as PaintChange, glow: { kind: 'keep' } as PaintChange };
    for (const k of layerKeys) if (versions[k] !== savedVersion[k]) changes[k] = await encode(layers[k]);
    const saved = await saveDraft(db, draft, changes);
    revision = saved.revision;
    savedVersion.color = versions.color; savedVersion.glow = versions.glow;
    // 只回写纹理引用，保留保存期间的新改动；引用相同的设计不会再次触发保存。
    const paint = design.value.paint;
    if (paint.colorAssetId !== saved.design.paint.colorAssetId || paint.glowAssetId !== saved.design.paint.glowAssetId) {
      const unchanged = JSON.stringify(design.value) === JSON.stringify(draft.design);
      design.value = setPaintAsset(design.value, saved.design.paint.colorAssetId, saved.design.paint.glowAssetId);
      if (unchanged) { savedKey = key(); return; }
    }
    savedKey = JSON.stringify([saved.design, meta.value, source.value]);
  }
  const autosaver = new DraftAutosaver(persist, (state, cause) => {
    saveState.value = state;
    error.value = state === 'error' ? toStorageError(cause) : null;
  });
  const hasUnsavedWork = () => layerKeys.some((k) => layers[k].version !== savedVersion[k]) || key() !== savedKey;
  watch([design, meta, source], () => { if (status.value === 'ready' && key() !== savedKey) autosaver.schedule(); }, { deep: true });

  /** 读取当前草稿到编辑器（含两层纹理）。 */
  async function loadCurrent(message?: string) {
    if (!db) return;
    const loaded = await loadDraft(db);
    if (loaded.status === 'invalid') { status.value = 'invalid'; return; }
    for (const k of layerKeys) layers[k].clear();
    if (loaded.status === 'empty') {
      revision = 0; meta.value = defaultMeta(); source.value = null; hooks.load(null);
    } else {
      let broken = false;
      for (const k of layerKeys) {
        const layer = loaded.layers[k];
        if (layer.error) broken = true;
        if (layer.blob) { try { await layers[k].load(layer.blob); } catch { broken = true; } }
      }
      const d = loaded.draft;
      revision = d.revision;
      meta.value = { name: d.name, personality: d.personality, preferredHabitat: d.preferredHabitat, effectEnabled: d.effectEnabled };
      source.value = d.sourceFishId && d.sourceFishRevision ? { fishId: d.sourceFishId, revision: d.sourceFishRevision } : null;
      hooks.load(d.design);
      notice.value = broken ? '已恢复上次的造型，但部分笔迹无法读取；继续作画会用新笔迹替换它。' : message ?? '已恢复上次的草稿。刷新后不保留撤销记录。';
      saveState.value = 'saved';
    }
    savedVersion.color = layers.color.version; savedVersion.glow = layers.glow.version;
    savedKey = key();
    status.value = 'ready';
  }

  async function start(options: { fishId?: string } = {}) {
    try { db = await openDatabase(); } catch (cause) { status.value = 'unavailable'; error.value = toStorageError(cause); return; }
    stopExternal = onExternalChange((kind) => { if (kind !== 'settings') externalChange.value = true; });
    try {
      if (options.fishId) {
        try {
          const result = await startEditFromFish(db, options.fishId);
          if (result.status === 'draft-exists') {
            pendingReplace.value = { fishId: options.fishId, draftName: result.draft.name || '没有名字的鱼' };
            await loadCurrent();
            return;
          }
          await loadCurrent(result.status === 'resumed' ? '继续编辑这条鱼，上次的改动还在。' : '已打开这条鱼。保存会更新海洋里的它；取消编辑会保留原版。');
          return;
        } catch (cause) {
          const failure = toStorageError(cause);
          if (failure.kind !== 'missing') throw failure;
          notice.value = '没有找到要编辑的那条鱼，可能已经删除。已打开工坊里的草稿。';
        }
      }
      await loadCurrent();
    } catch (cause) { status.value = 'unavailable'; error.value = toStorageError(cause); }
  }
  /** 用户确认：放弃现有草稿，改为编辑海洋里的这条鱼。 */
  async function confirmReplace(replace: boolean) {
    const pending = pendingReplace.value;
    pendingReplace.value = null;
    if (!pending || !db || !replace) return;
    await autosaver.flush();
    try {
      await startEditFromFish(db, pending.fishId, true);
      await loadCurrent('已打开这条鱼。保存会更新海洋里的它；取消编辑会保留原版。');
    } catch (cause) { error.value = toStorageError(cause); }
  }
  /** 新建或取消编辑：删除当前草稿（海洋里的原作品不受影响），工坊回到一条新鱼。 */
  async function resetDraft(message: string) {
    autosaver.dispose();
    if (db && status.value === 'ready') {
      try { await discardDraft(db); } catch (cause) { error.value = toStorageError(cause); return false; }
    }
    for (const k of layerKeys) layers[k].clear();
    revision = 0; meta.value = defaultMeta(); source.value = null; hooks.load(null);
    savedVersion.color = layers.color.version; savedVersion.glow = layers.glow.version;
    savedKey = key(); saveState.value = 'idle'; notice.value = message; externalChange.value = false;
    return true;
  }
  async function discardInvalidDraft() {
    if (!db || status.value !== 'invalid') return;
    try {
      await discardDraft(db);
      revision = 0; status.value = 'ready'; notice.value = '已放弃无法读取的旧草稿，开始新的鱼。';
      if (hasUnsavedWork()) autosaver.schedule();
    } catch (cause) { error.value = toStorageError(cause); }
  }

  // —— 提交：同一份草稿重试时复用凭证，数据库按凭证去重 ——
  let pendingCommit: { commandId: string; fishId: string; mode: CommitMode; revision: number } | null = null;
  const committing = ref(false);
  async function commit(mode: CommitMode, effects: EffectId[]): Promise<CommitResult> {
    if (!db || status.value !== 'ready') throw new StorageError('unavailable', '本地存储不可用，作品无法放入海洋；可以先导出');
    if (committing.value) throw new StorageError('conflict', '正在保存，请稍等');
    committing.value = true;
    try {
      // 提交前先让刚改的名字等触发自动保存，再停止防抖并等在途保存完成，冻结要提交的草稿版本。
      await nextTick();
      if (!(await autosaver.flush())) throw error.value ?? new StorageError('unknown', '草稿没有保存成功，暂时不能放入海洋');
      if (revision === 0) await persist();
      const fishId = mode === 'update' ? source.value!.fishId : pendingCommit?.mode === mode && pendingCommit.revision === revision ? pendingCommit.fishId : createId();
      if (!pendingCommit || pendingCommit.mode !== mode || pendingCommit.revision !== revision || pendingCommit.fishId !== fishId) {
        pendingCommit = { commandId: createId(), fishId, mode, revision };
      }
      const result = await commitFish(db, { commandId: pendingCommit.commandId, fishId, mode, draftRevision: revision, effects });
      status.value = 'committed';
      autosaver.dispose();
      return result;
    } finally { committing.value = false; }
  }

  /** 存储不可用或保存失败时，把当前作品导出为临时备份（不含其他作品）。 */
  async function exportCurrent() {
    const blobs = new Map<string, Blob>();
    const ids: Record<LayerKey, string | null> = { color: null, glow: null };
    for (const k of layerKeys) {
      if (layers[k].isEmpty()) continue;
      ids[k] = createId();
      blobs.set(ids[k]!, await layers[k].toBlob());
    }
    const checked = validateFishDesign(setPaintAsset(design.value, ids.color, ids.glow));
    if (!checked.ok) throw new StorageError('invalid', '作品数据无效');
    const draft = createDraft(checked.value, 1, { ...meta.value });
    return buildTemporaryBackup(draft, blobs);
  }

  /** 笔迹像素变化（一笔完成、撤销、清空）后调用。 */
  function paintCommitted() { if (status.value === 'ready') autosaver.schedule(); }
  /** 立即保存；不可用或旧草稿无法读取时，只要有未保存内容就返回 false。 */
  async function flush(): Promise<boolean> {
    if (status.value === 'committed') return true;
    if (status.value === 'ready') return autosaver.flush();
    return !hasUnsavedWork();
  }
  function onHidden() { if (document.visibilityState === 'hidden') void flush(); }
  function onPageHide() { void flush(); }

  const statusText = computed(() => {
    if (status.value === 'loading') return '正在读取草稿…';
    if (status.value === 'committed') return '已放入海洋';
    if (status.value === 'unavailable') return '本地存储不可用 · 作品只在本页，刷新或离开会丢失，可以导出临时备份';
    if (status.value === 'invalid') return '旧草稿无法读取，已原样保留 · 当前改动不会自动保存';
    if (saveState.value === 'saving') return '保存中…';
    if (saveState.value === 'pending') return '有新改动，马上自动保存';
    if (saveState.value === 'saved') return '已保存到这台设备';
    if (saveState.value === 'error') return error.value?.kind === 'conflict'
      ? '草稿已在另一个页面修改，请刷新后继续 · 当前作品还在这里'
      : `保存失败：${error.value?.message ?? '未知错误'} · 作品还在这里，可以重试或导出`;
    return '新草稿 · 改动会自动保存在这台设备';
  });

  return {
    status, saveState, error, notice, statusText, meta, source, pendingReplace, externalChange, committing,
    start, flush, paintCommitted, discardInvalidDraft, hasUnsavedWork, confirmReplace, resetDraft, commit, exportCurrent,
    retry: () => autosaver.flush(),
    bind() {
      document.addEventListener('visibilitychange', onHidden);
      window.addEventListener('pagehide', onPageHide);
    },
    dispose() {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onPageHide);
      stopExternal(); autosaver.dispose(); db?.close(); db = null;
    },
  };
}
