import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const base = process.env.FISH_CONTENT_PREVIEW_URL ?? 'http://127.0.0.1:5175';
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [], responses = [], views = [];
fs.mkdirSync('.verification/creative-learning', { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    const Original = window.Audio; window.__learningAudio = [];
    window.Audio = function(...args) { const a = new Original(...args); window.__learningAudio.push(a); return a; };
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('response', r => { if (r.status() >= 400) responses.push({ url: r.url(), status: r.status() }); });
  await page.goto(base + '/create');
  await page.waitForFunction(() => window.__fishEditor && document.querySelector('.studio-layout')?.inert === false);
  const canvas = page.locator('.studio-stage > .fish-canvas-stage canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * .46, box.y + box.height * .49); await page.mouse.down();
  await page.mouse.move(box.x + box.width * .56, box.y + box.height * .52, { steps: 10 }); await page.mouse.up();
  await page.waitForFunction(() => window.__fishEditor.history.undoCount > 0 && document.querySelector('.save-status')?.textContent.includes('已保存'));
  const snapshot = () => page.evaluate(() => ({ design: JSON.stringify(window.__fishEditor.design.value), undo: window.__fishEditor.history.undoCount, paintTick: window.__fishEditor.paintTick.value }));
  const before = await snapshot();
  const open = () => page.getByRole('button', { name: '看看海洋朋友的秘密', exact: true }).click();
  const dialog = page.locator('.creative-topic-dialog');
  await open(); await dialog.locator('[data-creative-fish]').nth(1).waitFor();
  assert.equal(await dialog.locator('[data-creative-topic]').count(), 7);
  await page.keyboard.press('Control+z'); assert.deepEqual(await snapshot(), before, 'background undo is blocked by learning dialog');
  for (const [width, height] of [[1024,768], [768,1024], [390,844]]) {
    await page.setViewportSize({ width, height });
    for (const topic of ['mouth','fin','tail','shape','pattern','arms','shell']) {
      await dialog.locator(`[data-creative-topic="${topic}"]`).click();
      assert.equal(await dialog.locator('[data-creative-fish]').count(), 2);
      await dialog.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      assert.ok(await dialog.evaluate(d => d.scrollWidth <= d.clientWidth + 1), `${topic} overflows ${width}`);
    }
    await dialog.locator('[data-creative-topic="arms"]').click();
    await dialog.locator('.hear-idea').click();
    await page.waitForFunction(() => window.__learningAudio.some(a => !a.paused && a.currentTime > 0));
    await dialog.locator('[data-creative-topic="shell"]').click();
    assert.ok(await page.evaluate(() => window.__learningAudio.every(a => a.paused)));
    const screenshot = `.verification/creative-learning/topics-${width}x${height}.png`;
    await page.screenshot({ path: screenshot }); views.push({ width, height, screenshot, noHorizontalOverflow: true });
  }
  await page.setViewportSize({ width: 1024, height: 768 });
  await dialog.locator('[data-creative-topic="pattern"]').click();
  const tiger = dialog.locator('[data-creative-fish="penaeus-monodon"]');
  await tiger.getByRole('button', { name: '试试颜色', exact: false }).click();
  await dialog.locator('.borrow-compare').waitFor();
  for (const [width, height] of [[1024,768], [768,1024], [390,844]]) {
    await page.setViewportSize({ width, height });
    assert.ok(await dialog.evaluate(d => d.scrollWidth <= d.clientWidth + 1));
    const footer = await dialog.locator('.borrow-footer').boundingBox();
    assert.ok(footer.y >= 0 && footer.y + footer.height <= height + 1, 'borrow confirmation stays visible');
    const screenshot = `.verification/creative-learning/preview-${width}x${height}.png`;
    await page.screenshot({ path: screenshot }); views.push({ width, height, screenshot, preview: true });
  }
  await page.setViewportSize({ width: 1024, height: 768 });
  await dialog.getByRole('button', { name: '看看原来', exact: false }).click();
  assert.ok(await dialog.locator('.borrow-apply').isDisabled());
  await dialog.locator('.borrow-back').click();
  assert.deepEqual(await snapshot(), before, 'cancel preview preserves design and real stroke history');
  await tiger.getByRole('button', { name: '试试花纹', exact: false }).click();
  await dialog.locator('.borrow-apply').click();
  await dialog.waitFor({ state: 'hidden' });
  const applied = await snapshot(); const appliedDesign = JSON.parse(applied.design), beforeDesign = JSON.parse(before.design);
  assert.equal(appliedDesign.pattern.id, 'bands'); assert.equal(applied.undo, before.undo + 1);
  assert.deepEqual(appliedDesign.colors, beforeDesign.colors); assert.deepEqual(appliedDesign.paint, beforeDesign.paint);
  assert.equal(applied.paintTick, before.paintTick); assert.ok(await page.locator('.creative-reference').isVisible());
  assert.equal(await page.getByRole('button', { name: '画一画', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  assert.deepEqual(await snapshot(), before, 'borrowed pattern is one undo step and keeps paint');
  await page.locator('.creative-reference').getByRole('button', { name: '再看看', exact: false }).click();
  assert.equal(await dialog.locator('[data-creative-topic="pattern"]').getAttribute('aria-pressed'), 'true');
  await dialog.locator('[data-creative-fish="babylonia-areolata"]').getByRole('button', { name: '试试颜色', exact: false }).click();
  await dialog.locator('.borrow-apply').click(); await dialog.waitFor({ state: 'hidden' });
  const colors = await snapshot(); assert.equal(colors.undo, before.undo + 1); assert.notDeepEqual(JSON.parse(colors.design).colors, beforeDesign.colors);
  assert.equal(JSON.parse(colors.design).pattern.id, beforeDesign.pattern.id); assert.equal(colors.paintTick, before.paintTick);
  await page.getByRole('button', { name: '撤销', exact: true }).click(); assert.deepEqual(await snapshot(), before);
  await page.locator('.creative-reference').getByRole('button', { name: '再看看', exact: false }).click();
  await dialog.locator('[data-creative-topic="arms"]').click();
  await dialog.locator('[data-creative-fish="octopus-vulgaris"]').getByRole('button', { name: '看着它画', exact: false }).click();
  assert.deepEqual(await snapshot(), before, 'keep a picture without altering the work');
  for (const [width, height] of [[1024,768], [768,1024], [390,844]]) {
    await page.setViewportSize({ width, height });
    await page.locator('.creative-reference').scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
    await page.locator('.creative-reference img').evaluate(image => image.decode());
    const screenshot = `.verification/creative-learning/reference-${width}x${height}.png`;
    await page.locator('.studio-stage').screenshot({ path: screenshot }); views.push({ width, height, screenshot, reference: true });
  }
  await page.getByRole('button', { name: '听听我的灵感', exact: true }).click();
  await page.waitForFunction(() => window.__learningAudio.some(a => !a.paused));
  await page.getByRole('button', { name: '第二步：试游', exact: true }).click();
  await page.waitForFunction(() => window.__learningAudio.every(a => a.paused));
  await page.getByRole('button', { name: '第一步：创作', exact: true }).click();
  await page.getByRole('button', { name: '收起灵感参考', exact: true }).click();
  await page.getByRole('button', { name: '换尾巴', exact: true }).click(); await open();
  assert.equal(await dialog.locator('[data-creative-topic="tail"]').getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '看看海洋朋友的秘密');
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  await page.waitForFunction(() => document.querySelector('.save-status')?.textContent.includes('已保存'));
  await page.reload(); await page.waitForFunction(() => window.__fishEditor && document.querySelector('.studio-layout')?.inert === false);
  assert.equal((await snapshot()).design, before.design, 'draft still contains the original painted design');
  await page.goto(base + '/journal'); await page.locator('[data-category="all"]').waitFor();
  await page.locator('.library-search summary').click();
  for (const text of ['花螺', '方斑东风螺']) { await page.getByRole('searchbox', { name: '海洋朋友名字' }).fill(text); assert.equal(await page.locator('.library-list>button').count(), 1); }
  assert.deepEqual(errors, []); assert.deepEqual(responses, []);
  const checks = ['seven source-backed creative topics at three viewports', 'tap narration and stop on switching or trial', 'observe and cancel leave real stroke and undo history unchanged', 'colour and pattern borrowing each use one undo step', 'keep, hear, revisit and dismiss a drawing reference', 'current tail tool selects tail topic', 'Escape focus and body scroll restore', 'painted draft reload and formal/common alias search'];
  fs.writeFileSync('docs/evidence/creative-learning-browser.json', JSON.stringify({ date: '2026-10-08', scope: 'Desktop Edge, tablet/phone viewports; not real iPad or child acceptance', checks, views, errors, responses }, null, 2) + '\n');
  console.log(JSON.stringify({ checks, views: views.length, errors, responses }));
} finally { await browser.close(); }
