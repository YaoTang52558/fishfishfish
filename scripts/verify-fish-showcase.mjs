import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const errors = [], badResponses = [], views = [];
mkdirSync('design/fish-showcase', { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || m.text().includes('Runtime directive')) errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) badResponses.push({ url: r.url(), status: r.status() }); });
  const url = process.env.FISH_WORKSHOP_PREVIEW_URL || 'http://127.0.0.1:5175/create';
  await page.goto(url);
  await page.waitForFunction(() => window.__fishEditor && document.querySelector('.studio-layout')?.inert === false);
  const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const state = () => page.evaluate(() => ({ design: JSON.parse(JSON.stringify(window.__fishEditor.design.value)), count: window.__fishEditor.history.undoCount, tick: window.__fishEditor.paintTick.value }));
  await page.getByRole('button', { name: '颜色', exact: true }).click();
  await page.locator('.part-card').filter({ hasText: '蜂窝纹' }).click();
  await page.getByRole('button', { name: '画笔', exact: true }).click();
  const workshopCanvas = page.locator('.workshop-stage > .fish-canvas-stage canvas');
  async function stroke(dy) {
    await workshopCanvas.scrollIntoViewIfNeeded(); const box = await workshopCanvas.boundingBox();
    await page.mouse.move(box.x + box.width * .44, box.y + box.height * (.47 + dy)); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .58, box.y + box.height * (.49 + dy), { steps: 10 }); await page.mouse.up();
  }
  await stroke(0); await page.getByRole('button', { name: '发光笔', exact: true }).click(); await stroke(.09);
  await page.getByRole('button', { name: '印章', exact: true }).click();
  const box = await workshopCanvas.boundingBox(); await page.mouse.click(box.x + box.width * .44, box.y + box.height * .59);
  await page.waitForFunction(() => document.querySelector('.save-status').textContent.includes('已保存'));
  const before = await state(); assert.equal(before.design.stamps.length, 1); assert.ok(before.design.paint.colorAssetId && before.design.paint.glowAssetId);
  await page.locator('.showcase-entry').evaluate(el => el.closest('details').open = true); await page.locator('.showcase-entry').click(); await page.locator('.showcase-dialog[open]').waitFor(); await settle();
  await page.keyboard.press('Control+z'); assert.deepEqual(await state(), before);
  await page.getByRole('button', { name: '⏸ 停一停', exact: true }).click(); await settle();
  const detailCanvas = page.locator('.showcase-view canvas');
  const pixels = await detailCanvas.evaluate(c => c.toDataURL()); await page.waitForTimeout(180);
  assert.equal(await detailCanvas.evaluate(c => c.toDataURL()), pixels, 'paused near view is static');
  for (const sample of [
    { width: 1024, height: 768, button: '🐟 整条鱼', name: 'whole' },
    { width: 768, height: 1024, button: '🎨 看花纹', name: 'pattern' },
    { width: 390, height: 844, button: '🙂 看脸', name: 'face' },
  ]) {
    await page.setViewportSize({ width: sample.width, height: sample.height }); await page.getByRole('button', { name: sample.button, exact: true }).click(); await settle();
    const size = await page.locator('.showcase-dialog').evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth })); assert.ok(size.scroll <= size.client);
    const footer = await page.locator('.showcase-actions').boundingBox(); assert.ok(footer.y >= 0 && footer.y + footer.height <= sample.height);
    const file = `design/fish-showcase/${sample.name}-${sample.width}.png`; await page.screenshot({ path: file }); views.push({ file, viewport: { width: sample.width, height: sample.height } });
  }
  const faceBefore = await detailCanvas.evaluate(c => c.toDataURL()); await page.getByRole('button', { name: '↔ 转个身', exact: true }).click(); await settle();
  assert.notEqual(await detailCanvas.evaluate(c => c.toDataURL()), faceBefore);
  await page.setViewportSize({ width: 1024, height: 768 }); await page.getByRole('button', { name: '🐟 整条鱼', exact: true }).click();
  await page.getByRole('button', { name: '☾ 看暗处', exact: true }).click(); await settle();
  await page.screenshot({ path: 'design/fish-showcase/glow-1024.png' });
  await page.keyboard.press('Escape'); await settle(); assert.deepEqual(await state(), before);
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  assert.ok(await page.locator('.showcase-entry').evaluate(el => el === document.activeElement));
  await page.getByRole('button', { name: '试游', exact: true }).click();
  await page.locator('.showcase-entry').click(); await settle();
  const trialPixels = await workshopCanvas.evaluate(c => c.toDataURL()); await page.waitForTimeout(180);
  assert.equal(await workshopCanvas.evaluate(c => c.toDataURL()), trialPixels, 'trial behind showcase pauses');
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: '取名入海', exact: true }).click();
  await page.getByLabel('名字（1–16 个字）').fill('珊瑚小伙伴');
  await page.getByRole('button', { name: '放进我的海洋', exact: true }).click();
  await page.waitForURL('**/ocean'); await page.locator('.ocean-welcome').waitFor();
  assert.match(await page.locator('.ocean-welcome').innerText(), /珊瑚小伙伴/);
  await page.waitForTimeout(850); await page.locator('.ocean-tank').screenshot({ path: 'design/fish-showcase/arrival-1024.png' });
  const savedFish = await page.evaluate(async () => {
    const { openDatabase, request } = await import('/src/storage/db.ts'); const db = await openDatabase();
    try { return await request(db.transaction('fish').objectStore('fish').getAll()); } finally { db.close(); }
  });
  assert.equal(savedFish.length, 1); assert.deepEqual(savedFish[0].design, before.design);
  await page.locator('.showcase-entry').click(); await settle();
  assert.equal(await page.locator('#showcase-title').innerText(), '珊瑚小伙伴');
  const tankPixels = await page.locator('.ocean-tank canvas').evaluate(c => c.toDataURL()); await page.waitForTimeout(180);
  assert.equal(await page.locator('.ocean-tank canvas').evaluate(c => c.toDataURL()), tankPixels, 'ocean behind showcase pauses');
  assert.equal(await page.locator('.showcase-error').count(), 0); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '收起（不删除）', exact: true }).click();
  await page.getByRole('button', { name: '放回海洋', exact: true }).waitFor();
  await page.evaluate(() => {
    window.__showcaseDecoded = 0; window.__showcaseClosed = 0;
    const decode = window.createImageBitmap.bind(window);
    window.createImageBitmap = async (...args) => { const b = await decode(...args); window.__showcaseDecoded++; const close = b.close.bind(b); b.close = () => { window.__showcaseClosed++; close(); }; return b; };
  });
  await page.locator('.showcase-entry').click(); await page.waitForFunction(() => !document.querySelector('.showcase-view').classList.contains('is-loading'));
  assert.equal(await page.locator('.showcase-error').count(), 0); assert.equal(await page.evaluate(() => window.__showcaseDecoded), 2, 'hidden fish loads both paint layers on demand');
  await page.keyboard.press('Escape'); await settle(); assert.equal(await page.evaluate(() => window.__showcaseClosed), 2, 'close releases owned bitmaps');
  await page.getByRole('button', { name: '放回海洋', exact: true }).click();
  await page.getByRole('button', { name: '收起（不删除）', exact: true }).waitFor();
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.getByRole('button', { name: '🐟 找这条鱼', exact: true }).click();
  assert.equal(await page.locator('.ocean-skip').count(), 0);
  await page.locator('.showcase-entry').click(); await settle(); assert.ok(await page.getByRole('button', { name: '⏸ 静止观察', exact: true }).isDisabled());
  const still = await detailCanvas.evaluate(c => c.toDataURL()); await page.waitForTimeout(180); assert.equal(await detailCanvas.evaluate(c => c.toDataURL()), still);
  await page.keyboard.press('Escape'); await page.goto(new URL('/ocean?new=' + savedFish[0].id, url).href);
  await page.locator('.ocean-welcome').waitFor(); assert.equal(await page.locator('.ocean-skip').count(), 0);
  assert.ok(await page.locator('.ocean-welcome').evaluate(el => getComputedStyle(el).animationName === 'none'));
  await page.getByRole('button', { name: '收起欢迎提示', exact: true }).click(); assert.equal(await page.locator('.ocean-welcome').count(), 0);
  const after = await page.evaluate(async () => { const { openDatabase, request } = await import('/src/storage/db.ts'); const db = await openDatabase(); try { return await request(db.transaction('fish').objectStore('fish').getAll()); } finally { db.close(); } });
  assert.deepEqual(after, savedFish, 'near view and arrival presentation never rewrite saved fish');
  assert.deepEqual(errors, []); assert.deepEqual(badResponses, []);
  const report = { date: '2026-10-07', scope: 'own-fish close-up and arrival only; desktop Edge, no physical iPad', checks: ['real pen/glow/stamp preserved through whole/pattern/face views', 'pause/turn/dark view; no design or undo mutation', 'Escape and focus return', 'trial and ocean behind dialog pause', 'saved arrival greeting and larger camera', 'one saved fish with original design', 'hidden fish paint loads read-only and releases bitmaps', 'reduced motion static close-up and greeting; no camera pan', 'three responsive layouts'], views, errors, badResponses };
  writeFileSync('docs/content/fish-showcase-verification.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
} finally { await browser.close(); }
