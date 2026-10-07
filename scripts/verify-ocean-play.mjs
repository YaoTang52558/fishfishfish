import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const errors = [], badResponses = [], views = [];
mkdirSync('design/ocean-play', { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) badResponses.push({ url: r.url(), status: r.status() }); });
  const url = process.env.FISH_WORKSHOP_PREVIEW_URL || 'http://127.0.0.1:5175/create';
  await page.goto(url); await page.waitForFunction(() => window.__fishEditor && !document.querySelector('.stage-toolbar button:last-child').disabled);
  await page.getByRole('button', { name: '画笔', exact: true }).click();
  const canvas = page.locator('.workshop-stage > .fish-canvas-stage canvas'); await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * .45, box.y + box.height * .48); await page.mouse.down(); await page.mouse.move(box.x + box.width * .56, box.y + box.height * .52, { steps: 8 }); await page.mouse.up();
  await page.getByRole('button', { name: '试游', exact: true }).click(); await page.getByRole('button', { name: '取名入海', exact: true }).click();
  await page.getByLabel('名字（1–16 个字）').fill('泡泡小伙伴'); await page.getByRole('button', { name: '放进我的海洋', exact: true }).click();
  await page.waitForURL('**/ocean').catch(async error => { console.error(JSON.stringify({ errors, badResponses, url: page.url(), body: (await page.locator('body').innerText()).slice(-2500) })); throw error; });
  const snapshot = () => page.evaluate(async () => {
    const { openDatabase, request } = await import('/src/storage/db.ts'); const db = await openDatabase();
    try { const tx = db.transaction(['fish', 'settings', 'assets']); return { fish: await request(tx.objectStore('fish').getAll()), settings: await request(tx.objectStore('settings').getAll()), assets: await request(tx.objectStore('assets').getAllKeys()) }; } finally { db.close(); }
  });
  const before = await snapshot(); assert.equal(before.fish.length, 1); assert.ok(before.fish[0].design.paint.colorAssetId);
  await page.getByRole('button', { name: '收起欢迎提示', exact: true }).click();
  await page.getByRole('button', { name: '🫧 玩泡泡', exact: true }).click();
  assert.equal(await page.locator('.ocean-skip').count(), 0); await page.waitForFunction(() => document.activeElement?.classList.contains('ocean-play-bubble'));
  const bubble = page.locator('.ocean-play-bubble'); assert.ok(!await bubble.evaluate(el => el.classList.contains('is-reaching')));
  await page.keyboard.press('Space'); await bubble.locator('xpath=self::*[contains(@class,"is-reaching")]').waitFor();
  await page.locator('.ocean-play-bubble.is-reached').waitFor({ timeout: 14000 }); assert.match(await page.locator('.ocean-play-hint').innerText(), /来啦/);
  await page.locator('.ocean-experience').screenshot({ path: 'design/ocean-play/reached-1024.png' });
  await page.waitForFunction(() => { const b = document.querySelector('.ocean-play-bubble'); return b && !b.classList.contains('is-reached') && !b.classList.contains('is-reaching'); });
  await page.getByRole('button', { name: '听听怎么玩泡泡', exact: true }).click();
  await page.waitForFunction(() => { const a = document.querySelector('.ocean-experience audio'); return !a.paused && a.currentTime > 0; });
  await page.getByRole('button', { name: '停止声音', exact: true }).click(); assert.ok(await page.locator('.ocean-experience audio').evaluate(a => a.paused));
  // Retargeting uses the water, including touch-generated clicks, without changing selection or storage.
  const water = page.locator('.ocean-tank canvas'); await water.click({ position: { x: 230, y: 160 } });
  assert.ok(await bubble.evaluate(el => el.classList.contains('is-reaching'))); assert.match(await page.locator('.fish-card h2').innerText(), /泡泡小伙伴/);
  await page.locator('.showcase-entry').click(); const pausedCanvas = await water.evaluate(c => c.toDataURL()); await page.waitForTimeout(160); assert.equal(await water.evaluate(c => c.toDataURL()), pausedCanvas);
  await page.keyboard.press('Escape');
  for (const viewport of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport); await page.locator('.ocean-experience').scrollIntoViewIfNeeded();
    const file = `design/ocean-play/shallow-${viewport.width}.png`; await page.locator('.ocean-experience').screenshot({ path: file });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth); assert.equal(overflow, false);
    const b = await bubble.boundingBox(), c = await water.boundingBox(); assert.ok(b.x >= c.x && b.y >= c.y && b.x + b.width <= c.x + c.width && b.y + b.height <= c.y + c.height);
    views.push({ viewport, file });
  }
  await page.getByRole('button', { name: '✓ 看它们游', exact: true }).click(); assert.equal(await bubble.count(), 0);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.getByRole('button', { name: '🫧 玩泡泡', exact: true }).click();
  assert.equal(await bubble.evaluate(el => getComputedStyle(el).animationName), 'none'); await bubble.click(); await page.locator('.ocean-play-bubble.is-reached').waitFor({ timeout: 14000 });
  await page.getByRole('button', { name: '✓ 看它们游', exact: true }).click();
  assert.deepEqual(await snapshot(), before, 'bubble play, near view and resizing never change fish, settings or assets');
  const clip = readFileSync('public/audio/vo-ocean-bubble-help.wav'); assert.equal(clip.toString('ascii', 0, 4), 'RIFF'); assert.ok(clip.length > 10000);
  const fallback = await context.newPage();
  await fallback.route('**/content/v1/environments/reef-panorama.webp', r => r.fulfill({ status: 404, body: 'unavailable' }));
  await fallback.goto(new URL('/ocean', url).href); await fallback.locator('.ocean-experience').waitFor();
  await fallback.locator('.ocean-experience').screenshot({ path: 'design/ocean-play/fallback.png' }); await fallback.close();
  const emptyContext = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' }); const empty = await emptyContext.newPage();
  await empty.goto(new URL('/ocean', url).href); await empty.locator('.ocean-experience').waitFor();
  assert.ok(await empty.getByRole('button', { name: '🫧 玩泡泡', exact: true }).isDisabled()); assert.ok(await empty.getByRole('link', { name: '去创造一条鱼' }).count()); await emptyContext.close();
  assert.deepEqual(errors, []); assert.deepEqual(badResponses, []);
  const report = { date: '2026-10-07', scope: 'shallow environment + original-fish bubble play only; desktop Edge, no physical iPad', checks: ['real drawing saves before entering ocean', 'bubble keyboard activation and reached response', 'water retargeting; one selected original fish', 'manual help voice starts/stops', 'close-up pauses underlying play', 'three responsive layouts and target remains in bounds', 'reduced motion removes bubble effects but retains requested play', 'fish/settings/assets unchanged by play', 'image failure fallback', 'empty ocean asks for creation; no demo fish saved'], views, errors, badResponses };
  writeFileSync('docs/content/ocean-play-verification.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
} finally { await browser.close(); }
