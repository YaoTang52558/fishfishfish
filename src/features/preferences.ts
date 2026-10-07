import { computed, ref, shallowRef } from 'vue';
import { createSettings } from '../domain/draft.ts';
import type { ProfileSettings } from '../domain/types.ts';
import { openDatabase, toStorageError } from '../storage/db.ts';
import { onExternalChange } from '../storage/queue.ts';
import { loadProfile, updatePreferences } from '../storage/repository.ts';

/*
 * 全局体验偏好：声音、辅助操作、减少动态。保存在设置记录里；
 * 存储不可用时只在本次打开期间生效。减少动态 = 系统设置 或 应用内开关。
 */
const settings = shallowRef<ProfileSettings>(createSettings());
const systemReducedMotion = ref(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
const persistent = ref(false);
const error = ref('');
let loading: Promise<void> | null = null;

async function load() {
  try {
    const db = await openDatabase();
    try { settings.value = (await loadProfile(db)).settings; persistent.value = true; } finally { db.close(); }
  } catch { persistent.value = false; }
}
export function initPreferences() {
  if (!loading) {
    loading = load();
    if (typeof matchMedia === 'function') matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (event) => { systemReducedMotion.value = event.matches; });
    onExternalChange((kind) => { if (kind === 'settings' || kind === 'profile') void load(); });
  }
  return loading;
}

export function usePreferences() {
  void initPreferences();
  return {
    settings,
    persistent,
    error,
    reducedMotion: computed(() => systemReducedMotion.value || settings.value.reducedMotion),
    systemReducedMotion,
    soundEnabled: computed(() => settings.value.soundEnabled),
    assistMode: computed(() => settings.value.assistMode),
    challenge: computed(() => settings.value.challenge ?? 'regular'),
    knowledgeDepth: computed(() => settings.value.knowledgeDepth ?? 'simple'),
    async update(patch: Partial<Pick<ProfileSettings, 'soundEnabled' | 'reducedMotion' | 'assistMode' | 'challenge' | 'knowledgeDepth'>>) {
      error.value = '';
      if (!persistent.value) { settings.value = { ...settings.value, ...patch }; return; }
      // 入海或改展示列表也会推进设置修订号：冲突时重新读取最新设置再试一次。
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const db = await openDatabase();
          try { settings.value = await updatePreferences(db, patch, settings.value.revision); return; } finally { db.close(); }
        } catch (cause) {
          const failure = toStorageError(cause);
          await load();
          if (failure.kind !== 'conflict' || attempt === 1) { error.value = failure.message; return; }
        }
      }
    },
    /** 设置记录被其他操作（入海、展示列表、导入）改写后重新读取修订号。 */
    reload: load,
  };
}
