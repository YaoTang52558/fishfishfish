import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const errors = [], badResponses = [], views = [];
mkdirSync('design/workshop-inspiration', { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
  // Repeated pixel readbacks can switch Edge's accelerated canvas to software mid-test.
  // Start the inspected editor canvas in readback mode so equal images use one raster backend.
  // This isolated QA setting is not used by the app or by performance measurements.
  await context.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, options) {
      return getContext.call(this, type, type === '2d' && this.closest('.fish-canvas-stage') ? { ...options, willReadFrequently: true } : options);
    };
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || m.text().includes('Runtime directive')) errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) badResponses.push({ url: r.url(), status: r.status() }); });
  await page.goto(process.env.FISH_WORKSHOP_PREVIEW_URL || 'http://127.0.0.1:5175/create');
  await page.waitForFunction(() => window.__fishEditor && !document.querySelector('.stage-toolbar button:last-child').disabled);
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const state = () => page.evaluate(() => ({ design: JSON.parse(JSON.stringify(window.__fishEditor.design.value)), count: window.__fishEditor.history.undoCount, tick: window.__fishEditor.paintTick.value }));
  const saved = () => page.waitForFunction(() => document.querySelector('.save-status').textContent.includes('已保存'));
  await page.getByRole('button', { name: '画笔', exact: true }).click();
  const canvas = page.locator('.workshop-stage > .fish-canvas-stage canvas');
  async function stroke(dy) {
    await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width * .45, box.y + box.height * (.46 + dy));
    await page.mouse.down(); await page.mouse.move(box.x + box.width * .57, box.y + box.height * (.5 + dy), { steps: 10 }); await page.mouse.up();
  }
  await stroke(0);
  await page.getByRole('button', { name: '发光笔', exact: true }).click(); await stroke(.07);
  await page.getByRole('button', { name: '印章', exact: true }).click();
  const box = await canvas.boundingBox(); await page.mouse.click(box.x + box.width * .46, box.y + box.height * .6);
  await saved(); await settle();
  const before = await state(); assert.equal(before.design.stamps.length, 1); assert.ok(before.design.paint.colorAssetId && before.design.paint.glowAssetId);
  const pixelsBefore = await canvas.evaluate(c => c.toDataURL());
  await page.locator('.inspiration-open').click(); await page.locator('.inspiration-observation').waitFor();
  assert.ok(await page.locator('audio').evaluate(a => a.paused));
  await page.locator('[data-borrow="colors"]').click(); await page.locator('.borrow-preview').waitFor();
  await page.keyboard.press('Control+z'); assert.deepEqual(await state(), before);
  await page.locator('.borrow-swatches button').nth(8).click();
  await page.locator('.borrow-compare').click(); assert.equal(await page.locator('.borrow-apply').isDisabled(), true);
  await page.locator('.borrow-compare').click(); await page.locator('.borrow-back').click(); await page.keyboard.press('Escape'); await settle();
  assert.deepEqual(await state(), before, 'cancel has no design/history/paint changes'); assert.equal(await canvas.evaluate(c => c.toDataURL()), pixelsBefore);
  await page.locator('.inspiration-open').click(); await page.locator('[data-borrow="pattern"]').click();
  await page.getByRole('slider', { name: '花纹大小', exact: true }).fill('1.5'); await page.keyboard.press('Escape'); await settle();
  assert.deepEqual(await state(), before, 'Escape directly from preview discards edits'); assert.equal(await canvas.evaluate(c => c.toDataURL()), pixelsBefore);
  await page.locator('.inspiration-open').click(); await page.locator('[data-borrow="colors"]').click();
  await page.locator('.borrow-swatches button').nth(8).click(); await page.locator('.borrow-apply').click();
  await saved(); const colored = await state();
  assert.equal(colored.count, before.count + 1); assert.notDeepEqual(colored.design.colors, before.design.colors);
  assert.deepEqual(colored.design.pattern, before.design.pattern); assert.deepEqual(colored.design.paint, before.design.paint); assert.deepEqual(colored.design.stamps, before.design.stamps); assert.equal(colored.tick, before.tick);
  await page.getByRole('button', { name: '撤销', exact: true }).click(); await settle(); assert.deepEqual((await state()).design, before.design);
  const afterUndo = await canvas.evaluate(c => c.toDataURL());
  if (afterUndo !== pixelsBefore) {
    mkdirSync('.verification', { recursive: true });
    writeFileSync('.verification/borrow-before.png', Buffer.from(pixelsBefore.split(',')[1], 'base64'));
    writeFileSync('.verification/borrow-after-undo.png', Buffer.from(afterUndo.split(',')[1], 'base64'));
  }
  assert.ok(afterUndo === pixelsBefore, 'undo restores the complete editor image');
  await page.getByRole('button', { name: '重做', exact: true }).click(); await settle(); assert.deepEqual((await state()).design, colored.design);
  const samples = [
    { id: 'amphiprion-ocellaris', pattern: 'clown-bands', viewport: { width: 1024, height: 768 } },
    { id: 'epinephelus-coioides', pattern: 'grouper-spots', viewport: { width: 768, height: 1024 } },
    { id: 'epinephelus-merra', pattern: 'honeycomb', viewport: { width: 390, height: 844 } },
  ];
  for (const sample of samples) {
    await page.setViewportSize(sample.viewport); await page.locator('.inspiration-open').click();
    if (sample.id !== samples[0].id) await page.locator('[data-inspiration-group="grouper"]').click();
    await page.locator(`[data-inspiration-fish="${sample.id}"]`).click();
    if (sample.pattern === 'clown-bands') { await page.locator('[data-borrow="colors"]').click(); await page.locator('.borrow-kinds button').last().click(); }
    else await page.locator('[data-borrow="pattern"]').click();
    await page.getByRole('slider', { name: '花纹大小', exact: true }).fill('1.3');
    await page.getByRole('slider', { name: '花纹疏密', exact: true }).fill('1.15');
    assert.deepEqual((await state()).design, colored.design);
    await page.locator('.borrow-reference button').click(); await page.waitForFunction(() => !document.querySelector('audio').paused);
    await page.locator('.borrow-reference button').click(); assert.ok(await page.locator('audio').evaluate(a => a.paused));
    await page.locator('.borrow-stage').scrollIntoViewIfNeeded(); await settle();
    const size = await page.locator('.inspiration-dialog').evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth })); assert.ok(size.scroll <= size.client);
    const file = `design/workshop-inspiration/borrow-${sample.pattern}-${sample.viewport.width}.png`; await page.screenshot({ path: file });
    views.push({ pattern: sample.pattern, viewport: sample.viewport, file });
    await page.locator('.borrow-apply').click(); await saved(); const applied = await state();
    assert.equal(applied.design.pattern.id, sample.pattern); assert.equal(applied.design.pattern.size, 1.3); assert.equal(applied.design.pattern.density, 1.15);
    assert.deepEqual(applied.design.colors, colored.design.colors); assert.deepEqual(applied.design.parts, before.design.parts); assert.deepEqual(applied.design.shape, before.design.shape);
    assert.deepEqual(applied.design.paint, before.design.paint); assert.deepEqual(applied.design.stamps, before.design.stamps); assert.equal(applied.tick, before.tick);
    assert.equal(applied.count, colored.count + 1);
    if (sample.pattern !== 'honeycomb') {
      await page.getByRole('button', { name: '撤销', exact: true }).click(); await settle(); assert.deepEqual((await state()).design, colored.design);
    }
  }
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByRole('button', { name: '颜色', exact: true }).click();
  await page.getByRole('slider', { name: '花纹大小', exact: true }).fill('1.45'); await saved();
  await page.locator('.pattern-controls').screenshot({ path: 'design/workshop-inspiration/pattern-edit-controls.png' });
  const final = await state();
  await page.reload(); await page.waitForFunction(() => window.__fishEditor && !document.querySelector('.stage-toolbar button:last-child').disabled); await settle();
  assert.deepEqual((await state()).design, final.design, 'pattern parameters, both paint layers and stamp survive draft reload');
  // Every card has a colour offer, including the unusual body shapes.
  const data = JSON.parse(readFileSync('public/content/v1/data.json', 'utf8'));
  await page.locator('.inspiration-open').click(); await page.locator('[data-inspiration-group="all"]').click();
  for (const fish of data.fish) { await page.locator(`[data-inspiration-fish="${fish.id}"]`).click(); assert.equal(await page.locator('[data-borrow="colors"]').count(), 1, fish.id); }
  await page.locator('[data-inspiration-fish="hippocampus-kuda"]').click(); assert.equal(await page.locator('[data-borrow="pattern"]').count(), 0);
  await page.keyboard.press('Escape');
  assert.deepEqual(errors, []); assert.deepEqual(badResponses, []);
  const report = { date: '2026-10-07', scope: 'workshop borrowing only; desktop Edge, no physical iPad', checks: ['real pen + glow + stamp retained', 'preview/cancel has no history or draft mutation', 'original comparison', 'colours only / pattern only', 'apply is one undo step; redo restores', 'three pattern renders and adjustable parameters', 'manual audio start/stop', 'all 30 colour offers; unsupported patterns omitted', 'parameters and paint survive saved draft reload', 'three responsive layouts'], views, errors, badResponses };
  report.pixelReadback = 'Inspected editor canvases use willReadFrequently only in the isolated QA context to keep repeated comparisons on one raster backend; no app or performance settings changed.';
  writeFileSync('docs/content/workshop-borrow-verification.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
