import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const development = process.env.FISH_PREVIEW_ORIGIN ?? 'http://127.0.0.1:5175';
const release = process.env.FISH_RELEASE_ORIGIN ?? 'http://127.0.0.1:4173';
const folder = '.verification/fishing-entry';
mkdirSync(folder, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const errors = [], badResponses = [], views = [];
function track(page, expectedWebGLFailure = false) {
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !(expectedWebGLFailure && /Error creating WebGL context/.test(m.text()))) errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) badResponses.push({ url: r.url(), status: r.status() }); });
}
async function ready(page) {
  await page.waitForFunction(() => document.querySelectorAll('.water-target').length === 3 && !document.querySelector('.water-target').disabled, null, { timeout: 45000 });
  assert.equal(await page.locator('.app-shell--scene').count(), 1);
  assert.equal(await page.locator('.scene-frame canvas').count(), 1);
}
async function switchHabitat(page, name, id) {
  await page.locator('.habitat-menu summary').click();
  await page.getByRole('navigation', { name: '选择钓场', exact: true }).getByRole('button', { name, exact: true }).click();
  await page.waitForURL(`**/fishing/${id}`);
  await ready(page);
  await page.getByRole('heading', { name, exact: true }).waitFor();
}
async function photo(page, name) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  const file = `${folder}/${name}.png`;
  await page.locator('.scene-frame').screenshot({ path: file }); views.push(file);
}
try {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  const page = await context.newPage(); track(page);
  await page.goto(development + '/');
  await page.evaluate(async () => {
    const { openDatabase } = await import('/src/storage/db.ts');
    const { recordCapture } = await import('/src/storage/repository.ts');
    const { initPreferences, usePreferences } = await import('/src/features/preferences.ts');
    const db = await openDatabase(); try { await recordCapture(db, 'entry-legacy-capture', 'amphiprion-ocellaris', new Date('2026-10-01T00:00:00Z')); } finally { db.close(); }
    await initPreferences(); await usePreferences().update({ assistMode: false, challenge: 'gentle' });
  });
  await page.locator('.entry-card').filter({ hasText: '去钓鱼' }).click();
  await page.waitForURL('**/fishing/reef-edge');
  await page.getByRole('button', { name: '跳过教学', exact: true }).click();
  await ready(page); await photo(page, 'development-reef-1024');
  assert.equal(await page.locator('a[href="/dev/fishing-3d/practice"]').count(), 0);
  await switchHabitat(page, '近岸岩礁', 'coastal-rock');
  await page.goto(development + '/fishing/coastal-rock?habitat=reef-edge'); await ready(page);
  assert.equal(await page.getByRole('heading', { name: '近岸岩礁', exact: true }).count(), 1);
  await switchHabitat(page, '珊瑚外缘', 'reef-edge');
  await page.locator('.water-target').first().click();
  await page.locator('.habitat-menu summary').click();
  assert.equal(await page.getByRole('navigation', { name: '选择钓场', exact: true }).getByRole('button', { name: '近岸岩礁', exact: true }).isDisabled(), true);
  await page.locator('.habitat-menu summary').click();
  await page.evaluate(() => { const r = window.__fishRound; let n = 0; while (['casting', 'waiting'].includes(r.read().phase) && n++ < 1000) r.step(); r.publish(); });
  await page.getByRole('button', { name: '提竿', exact: true }).click();
  await page.locator('.fight-controls').waitFor();
  const captured = await page.evaluate(() => {
    const r = window.__fishRound; let n = 0;
    while (r.read().phase === 'fighting' && n++ < 9000) { const f = r.read().fight, a = f.action === 'telegraph' ? f.nextAction : f.action; r.input({ reel: ['rest', 'lateral'].includes(a) && f.tension < .9, rodAxis: a === 'lateral' ? -f.lateralSign : 0 }); r.step(); }
    r.publish(); return { phase: r.read().phase, speciesId: r.read().speciesId, attemptId: r.read().attemptId };
  });
  assert.equal(captured.phase, 'landing');
  await page.getByRole('button', { name: '轻轻抄起', exact: true }).click();
  await page.getByRole('button', { name: '看看鱼朋友 →', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.save-line')?.textContent.includes('已记录到图鉴'));
  await photo(page, 'development-catch-1024');
  await page.getByRole('button', { name: '放生', exact: true }).click(); await ready(page);
  await page.reload(); await ready(page);
  const records = await page.evaluate(async () => {
    const { openDatabase } = await import('/src/storage/db.ts'); const db = await openDatabase();
    try { const tx = db.transaction(['captures', 'discoveries'], 'readonly'); const all = store => new Promise((resolve, reject) => { const req = tx.objectStore(store).getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); return { captures: await all('captures'), discoveries: await all('discoveries') }; } finally { db.close(); }
  });
  assert.equal(records.captures.length, 2);
  assert.ok(records.captures.some(c => c.attemptId === captured.attemptId && c.speciesId === captured.speciesId));
  assert.ok(records.captures.some(c => c.attemptId === 'entry-legacy-capture'));
  assert.equal(records.discoveries.find(d => d.speciesId === 'amphiprion-ocellaris').firstCaughtAt, '2026-10-01T00:00:00.000Z');
  await page.goto(development + '/dev/fishing-3d?habitat=coastal-rock'); await ready(page);
  assert.equal(await page.getByRole('heading', { name: '近岸岩礁', exact: true }).count(), 1);
  await page.goto(development + '/fishing'); await page.waitForURL('**/fishing/reef-edge'); await ready(page);
  await context.close();

  // Use the normal built release, without development modules or accelerated state hooks.
  const production = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  await production.addInitScript(() => localStorage.setItem('fish-fishing-tutorial-v1', 'dismissed'));
  const actual = await production.newPage(); track(actual);
  await actual.goto(release + '/');
  await actual.getByRole('navigation', { name: '主要导航', exact: true }).getByRole('link', { name: '去钓鱼', exact: true }).click();
  await actual.waitForURL('**/fishing/reef-edge'); await ready(actual);
  assert.equal(await actual.evaluate(() => typeof window.__fishRound), 'undefined');
  assert.equal(await actual.locator('.scene-host canvas').evaluate(c => !!c.getContext('webgl2')), true);
  assert.equal(await actual.locator('a[href*="/dev/"]').count(), 0);
  assert.equal(await actual.getByRole('button', { name: '模拟显卡中断', exact: true }).count(), 0);
  await switchHabitat(actual, '近岸岩礁', 'coastal-rock'); await photo(actual, 'release-rock-1024');
  await actual.setViewportSize({ width: 768, height: 1024 }); await photo(actual, 'release-rock-768');
  await actual.setViewportSize({ width: 390, height: 844 }); await photo(actual, 'release-rock-390');
  await actual.reload(); await ready(actual);
  assert.equal(await actual.getByRole('heading', { name: '近岸岩礁', exact: true }).count(), 1);
  await actual.goto(release + '/fishing/unknown'); await actual.getByRole('heading', { name: '这片水域，还没有找到。', exact: true }).waitFor();
  assert.equal(await actual.locator('.scene-frame').count(), 0);
  await production.close();

  const fallback = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  await fallback.addInitScript(() => {
    localStorage.setItem('fish-fishing-tutorial-v1', 'dismissed');
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type === 'webgl2' ? null : original.call(this, type, ...args); };
  });
  const simple = await fallback.newPage(); track(simple, true);
  await simple.goto(release + '/fishing/coastal-rock'); await ready(simple);
  assert.equal(await simple.locator('.scene-host').count(), 0);
  assert.ok(await simple.locator('.prototype-note').innerText().then(t => t.includes('简化画面')));
  await simple.locator('.water-target').first().click();
  await simple.waitForFunction(() => ['casting', 'waiting'].includes(document.querySelector('.scene-frame')?.dataset.phase));
  await photo(simple, 'release-fallback-768'); await fallback.close();
  assert.deepEqual(errors, []); assert.deepEqual(badResponses, []);
  const report = { date: new Date().toISOString().slice(0, 10), result: 'passed', physicalDeviceVerified: false,
    scope: 'Isolated desktop Edge: normal development and normal production build. Only development wait/fight clock accelerated; production WebGL, links, layouts and WebGL-unavailable fallback use actual UI.',
    checks: ['home and primary navigation use canonical 3D fishing', 'path habitat wins over stale query; menu updates canonical path', 'active round locks habitat switching', 'cast/pull/land/knowledge/release retain attempt and species', 'existing capture and first discovery survive route replacement and reload', 'legacy development link and /fishing redirect work', 'normal production build loads WebGL scene without development controls or state hook', 'production direct link/reload and invalid habitat recovery', '1024/768/390 viewport layouts', 'WebGL unavailable automatically switches to same-rule Canvas and can cast'], errors, badResponses, views };
  writeFileSync('docs/evidence/fishing-entry-browser.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
