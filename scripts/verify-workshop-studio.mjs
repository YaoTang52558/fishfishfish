import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const errors = [], badResponses = [], views = [];
mkdirSync('design/workshop-studio', { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || m.text().includes('Runtime directive')) errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) badResponses.push({ url: r.url(), status: r.status() }); });
  const url = process.env.FISH_WORKSHOP_PREVIEW_URL || 'http://127.0.0.1:5175/create';
  const ready = () => page.waitForFunction(() => window.__fishEditor && !document.querySelector('.stage-toolbar button:last-child').disabled);
  const saved = () => page.waitForFunction(() => document.querySelector('.save-status').textContent.includes('已保存'));
  const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const state = () => page.evaluate(() => ({ design: JSON.parse(JSON.stringify(window.__fishEditor.design.value)), history: window.__fishEditor.history.undoCount, tick: window.__fishEditor.paintTick.value }));
  await page.goto(url); await ready();
  const base = await state();
  const dockGroups = [['tailId', '尾巴', 6], ['bodyId', '身体', 5], ['finId', '鳍', 6], ['headId', '头型', 5], ['eyeId', '眼睛', 5], ['mouthId', '嘴', 5]];
  for (const [key, title, count] of dockGroups) {
    await page.locator(`[data-part-tool="${key}"]`).click();
    assert.equal(await page.locator('.studio-tools .part-group legend').innerText(), title);
    assert.equal(await page.locator('.studio-tools .part-card').count(), count);
    const candidate = page.locator('.studio-tools .part-card[aria-pressed="false"]').first(); await candidate.click();
    assert.equal((await state()).history, base.history + 1, `${title}: one change is one undo`);
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    assert.deepEqual((await state()).design, base.design);
  }
  // Actual painting and stamp input go through the resized viewport's inverse geometry.
  await page.getByRole('button', { name: '画笔', exact: true }).click();
  const canvas = page.locator('.workshop-stage > .fish-canvas-stage canvas');
  async function stroke(dy = 0) {
    await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width * .44, box.y + box.height * (.47 + dy)); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .57, box.y + box.height * (.51 + dy), { steps: 10 }); await page.mouse.up();
  }
  await page.getByRole('button', { name: '深海蓝', exact: true }).click(); await stroke();
  await page.getByRole('button', { name: '发光笔', exact: true }).click(); await stroke(.07);
  await page.getByRole('button', { name: '印章', exact: true }).click();
  await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox(); await page.mouse.click(box.x + box.width * .46, box.y + box.height * .59);
  await saved(); const painted = await state();
  assert.ok(painted.design.paint.colorAssetId && painted.design.paint.glowAssetId); assert.equal(painted.design.stamps.length, 1);
  await page.getByRole('button', { name: '换尾巴', exact: true }).click();
  await page.locator('.studio-tools .part-card').filter({ hasText: '新月尾' }).click();
  await saved(); const edited = await state();
  assert.equal(edited.design.parts.tailId, 'lunate'); assert.deepEqual(edited.design.paint, painted.design.paint); assert.deepEqual(edited.design.stamps, painted.design.stamps);
  await page.getByRole('button', { name: '撤销', exact: true }).click(); await page.getByRole('button', { name: '重做', exact: true }).click();
  assert.deepEqual((await state()).design, edited.design);
  const textureDigests = () => page.evaluate(async () => {
    const { openDatabase } = await import('/src/storage/db.ts'), { loadAssets } = await import('/src/storage/repository.ts'); const db = await openDatabase();
    try {
      const ids = Object.values(window.__fishEditor.design.value.paint).filter(v => typeof v === 'string'), blobs = await loadAssets(db, ids);
      const result = {}; for (const [id, blob] of blobs) result[id] = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))).join(',');
      return result;
    } finally { db.close(); }
  });
  const digests = await textureDigests();
  const snapshot = async (mode, viewport) => {
    await page.setViewportSize(viewport); await settle();
    const file = `design/workshop-studio/${mode}-${viewport.width}.png`;
    await page.screenshot({ path: file, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const touches = await page.locator('.studio-dock button, .studio-steps button, .studio-tools .part-card').evaluateAll(els => els.map(el => ({ w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height })));
    assert.ok(touches.every(({w,h}) => w >= 44 && h >= 44));
    views.push({ mode, viewport, file });
  };
  for (const viewport of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) await snapshot('edit', viewport);
  await page.setViewportSize({ width: 1024, height: 768 });
  // Trial and finish can be entered and left without mutating the design or resetting history.
  await page.getByRole('button', { name: '试游', exact: true }).click(); await page.locator('.studio-trial-panel').waitFor();
  await page.keyboard.press('Control+z'); assert.deepEqual((await state()).design, edited.design);
  await snapshot('trial', { width: 1024, height: 768 });
  await page.getByRole('button', { name: '换个尾巴试试', exact: true }).click();
  assert.equal(await page.locator('[data-part-tool="tailId"]').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(await state(), edited);
  await page.getByRole('button', { name: '第三步：入海', exact: true }).click();
  assert.ok(await page.getByLabel('名字（1–16 个字）').inputValue());
  assert.equal(await page.locator('.finish-options').getAttribute('open'), null);
  for (const viewport of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) await snapshot('finish', viewport);
  await page.getByRole('button', { name: '第一步：创作', exact: true }).click(); assert.deepEqual(await state(), edited);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByRole('button', { name: '第三步：入海', exact: true }).click();
  await page.getByLabel('名字（1–16 个字）').fill('海蓝小伙伴');
  await page.getByRole('button', { name: '放进我的海洋', exact: true }).dblclick(); await page.waitForURL('**/ocean');
  const savedFish = async () => page.evaluate(async () => { const { openDatabase, request } = await import('/src/storage/db.ts'); const db = await openDatabase(); try { return await request(db.transaction('fish').objectStore('fish').getAll()); } finally { db.close(); } });
  const first = await savedFish(); assert.equal(first.length, 1); assert.deepEqual(first[0].design, edited.design);
  await page.getByRole('button', { name: '再次编辑', exact: true }).click(); await ready();
  assert.deepEqual((await state()).design, edited.design); assert.deepEqual(await textureDigests(), digests);
  // Updating changes one existing record; save-as keeps that original and creates a second fish.
  await page.getByRole('button', { name: '换嘴', exact: true }).click(); await page.locator('.studio-tools .part-card').nth(1).click(); await saved();
  const updatedDesign = (await state()).design;
  await page.getByRole('button', { name: '第三步：入海', exact: true }).click(); await page.getByRole('button', { name: '更新这条鱼', exact: true }).click(); await page.waitForURL('**/ocean');
  const updated = await savedFish(); assert.equal(updated.length, 1); assert.equal(updated[0].id, first[0].id); assert.deepEqual(updated[0].design, updatedDesign);
  await page.getByRole('button', { name: '再次编辑', exact: true }).click(); await ready();
  await page.getByRole('button', { name: '第三步：入海', exact: true }).click(); await page.getByLabel('名字（1–16 个字）').fill('海蓝的新朋友');
  await page.getByRole('button', { name: '另存为新鱼', exact: true }).click(); await page.waitForURL('**/ocean');
  const second = await savedFish(); assert.equal(second.length, 2); assert.deepEqual(second.find(f => f.id === first[0].id), updated[0]);
  assert.deepEqual(second.find(f => f.id !== first[0].id).design.paint, edited.design.paint);
  await page.reload(); await page.locator('.ocean-list--art img').nth(1).waitFor(); assert.equal((await savedFish()).length, 2);
  // Actual touch dispatch covers drawing on the wider mobile canvas after rotating.
  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const touch = await touchContext.newPage(); touch.on('pageerror',e => errors.push(e.message)); await touch.goto(url);
  await touch.waitForFunction(() => window.__fishEditor && !document.querySelector('.stage-toolbar button:last-child').disabled);
  await touch.getByRole('button', { name: '画笔', exact: true }).tap(); const touchCanvas = touch.locator('.workshop-stage > .fish-canvas-stage canvas'); await touchCanvas.scrollIntoViewIfNeeded();
  const tb = await touchCanvas.boundingBox(), cdp = await touchContext.newCDPSession(touch);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tb.x + tb.width * .44, y: tb.y + tb.height * .48 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tb.x + tb.width * .57, y: tb.y + tb.height * .51 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await touch.waitForFunction(() => window.__fishEditor.design.value.paint.colorAssetId && document.querySelector('.save-status').textContent.includes('已保存'));
  const touchPaint = await touch.evaluate(() => window.__fishEditor.design.value.paint.colorAssetId);
  await touch.setViewportSize({ width: 844, height: 390 }); await touch.getByRole('button', { name: '第二步：试游', exact: true }).tap();
  await touch.getByRole('button', { name: '第一步：创作', exact: true }).tap(); assert.equal(await touch.evaluate(() => window.__fishEditor.design.value.paint.colorAssetId), touchPaint);
  await touchContext.close();
  assert.deepEqual(errors, []); assert.deepEqual(badResponses, []);
  const report = { date: '2026-10-07', scope: 'plan 1–3: shared visual style, picture tools and create/trial/save/edit flow; desktop Edge with emulated touch, no physical iPad', checks: ['six nearby picture tools open the correct choices; one change is one undo', 'actual normal/glow strokes and stamp preserve asset references through part changes', 'three responsive layouts; touch targets at least 44px and no horizontal overflow', 'trial and finish round trips preserve design and undo history', 'default name and optional metadata; trial can be skipped', 'double-click saves one fish only', 're-edit retains exact paint asset bytes', 'update retains the original id; save-as retains original and creates one new fish', 'refresh restores both saved works', 'emulated touch drawing and rotate/trial/back retain paint'], views, errors, badResponses };
  writeFileSync('docs/content/workshop-studio-verification.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
} finally { await browser.close(); }
