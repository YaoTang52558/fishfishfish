<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { MAX_BACKUP_BYTES, validateBackup, type BackupData } from '../domain/backup.ts';
import { downloadJson, exportProfile, replaceProfile } from '../storage/backup.ts';
import { openDatabase, toStorageError } from '../storage/db.ts';
import { usePreferences } from '../features/preferences.ts';
import { playCue } from '../features/sound.ts';
import { clearAllData, loadDiscoveries, loadProfile } from '../storage/repository.ts';
import { validateBackupTextures } from '../storage/backupTextures.ts';
import PageHeading from '../components/PageHeading.vue';
import GrowthSettings from '../components/GrowthSettings.vue';

const prefs = usePreferences();
const preferences = [
  { key: 'soundEnabled', title: '提示音', text: '默认关闭。打开后，咬钩和钓到鱼时会有简短提示音；所有提示同时有文字和画面。' },
  { key: 'assistMode', title: '辅助操作', text: '提竿时间从 2.5 秒延长到 5 秒。立体钓场会帮你控竿、鱼线太紧时放线和抄起。发现的鱼一样记入图鉴。' },
  { key: 'reducedMotion', title: '减少动态', text: '关闭气泡粒子、彩蛋特效和入海镜头，鱼仍会慢慢游。系统已开启“减少动态效果”时会自动生效。' },
] as const;
const confirmClear = ref(0);
async function toggle(key: 'soundEnabled' | 'assistMode' | 'reducedMotion', value: boolean) {
  await prefs.update({ [key]: value });
  if (key === 'soundEnabled' && value) playCue('catch', true);
}
async function clearEverything() {
  if (!db) return;
  busy.value = true; errors.value = [];
  try { await clearAllData(db); confirmClear.value = 0; notice.value = '已清空这台设备上的全部作品、图鉴和设置。'; await refresh(); await prefs.reload(); }
  catch (cause) { errors.value = [`清空没有完成，数据保持不变：${toStorageError(cause).message}`]; }
  finally { busy.value = false; }
}
const status = ref<'loading' | 'ready' | 'unavailable'>('loading');
const current = ref({ fish: 0, hasDraft: false, discoveries: 0 });
const busy = ref(false);
const notice = ref('');
const errors = ref<string[]>([]);
const pending = shallowRef<{ data: BackupData; fish: number; hasDraft: boolean; fileName: string } | null>(null);
const fileInput = ref<HTMLInputElement>();
let fileGeneration = 0;
let db: IDBDatabase | null = null;

async function refresh() {
  if (!db) return;
  const profile = await loadProfile(db);
  current.value = { fish: profile.fish.length, hasDraft: profile.draft !== null, discoveries: (await loadDiscoveries(db)).length };
}
onMounted(async () => {
  try { db = await openDatabase(); await refresh(); status.value = 'ready'; } catch { status.value = 'unavailable'; }
});
onBeforeUnmount(() => db?.close());

async function exportBackup() {
  if (!db) return;
  busy.value = true; errors.value = []; notice.value = '';
  try {
    downloadJson(await exportProfile(db), `我的海洋-备份-${new Date().toISOString().slice(0, 10)}.json`);
    notice.value = '备份文件已生成。它只保存在你选择的位置，不会上传到任何地方。';
  } catch (cause) { errors.value = [`导出没有完成：${toStorageError(cause).message}`]; }
  finally { busy.value = false; }
}
/** 选择文件后只做校验与预览，不写入存档。 */
async function chooseFile(event: Event) {
  const generation = ++fileGeneration;
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  pending.value = null; errors.value = []; notice.value = '';
  if (!file) return;
  if (file.size > MAX_BACKUP_BYTES) { errors.value = ['文件超过 50MB，不能导入。现有存档没有改动。']; return; }
  let parsed: unknown;
  try { parsed = JSON.parse(await file.text()); } catch { if (generation === fileGeneration) errors.value = ['文件无法读取，可能已损坏。现有存档没有改动。']; return; }
  if (generation !== fileGeneration) return;
  const result = validateBackup(parsed, file.size);
  if (!result.ok) { errors.value = [...result.errors.slice(0, 6), '现有存档没有改动。']; return; }
  try { await validateBackupTextures(result.value); }
  catch (cause) { if (generation === fileGeneration) errors.value = [toStorageError(cause).message, '现有存档没有改动。']; return; }
  if (generation !== fileGeneration) return;
  pending.value = { data: result.value, fish: result.summary.fish, hasDraft: result.summary.hasDraft, fileName: file.name };
}
async function confirmImport() {
  if (!db || !pending.value) return;
  busy.value = true; errors.value = [];
  try {
    await replaceProfile(db, pending.value.data);
    notice.value = `导入完成：现在有 ${pending.value.fish} 条作品${pending.value.hasDraft ? '和 1 份草稿' : ''}，可以继续编辑。`;
    pending.value = null;
    await refresh();
    await prefs.reload();
  } catch (cause) { errors.value = [`导入没有完成，现有存档保持不变：${toStorageError(cause).message}`]; }
  finally { busy.value = false; }
}
</script>
<template>
  <PageHeading eyebrow="按你的节奏 / SETTINGS" title="让这片海，更适合你。" description="声音、辅助操作、动态效果和作品备份，都在这里管理。" />
  <div class="settings-layout">
    <section class="settings-panel" aria-labelledby="preferences-title"><h2 id="preferences-title">体验偏好</h2>
      <div v-for="item in preferences" :key="item.key" class="setting-row">
        <div><h3><label :for="`pref-${item.key}`">{{ item.title }}</label></h3><p>{{ item.text }}</p><p v-if="item.key === 'reducedMotion' && prefs.systemReducedMotion.value" class="tool-hint">系统已开启减少动态效果。</p></div>
        <input :id="`pref-${item.key}`" class="switch" type="checkbox" role="switch" :checked="prefs.settings.value[item.key]" @change="toggle(item.key, ($event.target as HTMLInputElement).checked)" />
      </div>
      <p v-if="!prefs.persistent.value" class="tool-hint">本地存储不可用，偏好只在这次打开期间有效。</p>
      <p v-if="prefs.error.value" class="editor-message">{{ prefs.error.value }}</p>
      <GrowthSettings />
      <RouterLink to="/playtest" class="button button--muted">📝 家庭试玩记录</RouterLink>
      <h2 class="data-title">数据说明</h2>
      <ul class="data-notes">
        <li>作品、图鉴和设置只保存在这台设备的这个浏览器里，不需要注册，也不会上传或同步。</li>
        <li>不记录名字、笔迹或浏览行为用于统计；导出的备份文件只保存在你选择的位置。</li>
        <li>清理浏览器的网站数据会删除这里的存档，记得先导出备份。</li>
      </ul>
    </section>
    <section class="settings-panel" aria-labelledby="backup-title">
      <h2 id="backup-title">作品与备份</h2>
      <p>作品保存在当前浏览器中，不会自动同步到其他设备。清理浏览器的站点数据会删除本地作品，记得定期导出备份。</p>
      <p v-if="status === 'ready'" class="backup-current">当前：{{ current.fish }} 条作品{{ current.hasDraft ? '，1 份未完成的草稿' : '' }}，已发现 {{ current.discoveries }} 种真实鱼类</p>
      <p v-else-if="status === 'unavailable'" class="editor-message">这台设备暂时不能使用本地存储，无法导出或导入。</p>
      <div class="backup-actions">
        <button class="button" :disabled="status !== 'ready' || busy" @click="exportBackup">导出备份</button>
        <button class="button button--muted" :disabled="status !== 'ready' || busy" @click="fileInput?.click()">导入备份…</button>
        <input ref="fileInput" class="visually-hidden" type="file" accept="application/json,.json" tabindex="-1" aria-hidden="true" @change="chooseFile" />
      </div>
      <div v-if="pending" class="confirm-box" role="alert">
        <p><strong>导入「{{ pending.fileName }}」会替换全部存档。</strong></p>
        <p>将替换为 {{ pending.fish }} 条作品{{ pending.hasDraft ? '和 1 份草稿' : '' }}；当前有 {{ current.fish }} 条作品{{ current.hasDraft ? '和 1 份草稿' : '' }}。建议先导出现在的备份。</p>
        <div>
          <button class="button button--muted" :disabled="busy" @click="exportBackup">先导出现在的备份</button>
          <button class="button" :disabled="busy" @click="confirmImport">确认替换</button>
          <button class="button button--muted" :disabled="busy" @click="pending = null">取消</button>
        </div>
      </div>
      <p v-if="notice" class="session-notice" role="status">{{ notice }}</p>
      <ul v-if="errors.length" class="backup-errors" role="alert"><li v-for="item in errors" :key="item">{{ item }}</li></ul>
      <p class="panel-footnote">导入会整体替换，不做合并；失败或取消都不会改动现有作品。</p>
      <div class="danger-zone">
        <h3>清空全部数据</h3>
        <p>删除这台设备上的全部原创鱼、草稿、图鉴发现、彩蛋记录和设置。无法撤销。</p>
        <button v-if="confirmClear === 0" class="button button--muted chip-button--danger" :disabled="status !== 'ready' || busy" @click="confirmClear = 1">清空全部数据…</button>
        <div v-else class="confirm-box" role="alert">
          <p v-if="confirmClear === 1">确定要清空吗？当前有 {{ current.fish }} 条作品、{{ current.discoveries }} 种已发现的鱼。建议先导出备份。</p>
          <p v-else><strong>最后确认：</strong>清空后无法找回。</p>
          <div>
            <button class="button button--muted" :disabled="busy" @click="exportBackup">先导出备份</button>
            <button v-if="confirmClear === 1" class="button" :disabled="busy" @click="confirmClear = 2">继续</button>
            <button v-else class="button" :disabled="busy" @click="clearEverything">确认清空</button>
            <button class="button button--muted" :disabled="busy" @click="confirmClear = 0">取消</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
