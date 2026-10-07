import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const errors = [], views = [];
mkdirSync('design/ocean-collection', { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  // Observe resource ownership in this isolated QA context, without modifying app state.
  await context.addInitScript(() => {
    const original = window.createImageBitmap.bind(window);
    window.__bitmapQA = { created: 0, closed: 0 };
    window.createImageBitmap = async (...args) => {
      const bitmap = await original(...args), close = bitmap.close.bind(bitmap);
      window.__bitmapQA.created++;
      bitmap.close = () => { window.__bitmapQA.closed++; close(); };
      return bitmap;
    };
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  const url = process.env.FISH_OCEAN_PREVIEW_URL || 'http://127.0.0.1:5175/ocean';
  await page.goto(url); await page.getByRole('link', { name: '去创造一条鱼' }).waitFor();
  // Saved fixture designs exercise a varied full collection without changing the user's database.
  await page.evaluate(async () => {
    const { createFishDesign } = await import('/src/domain/fish.ts');
    const { createSettings, validateOriginalFish } = await import('/src/domain/draft.ts');
    const { bodies, tails, finSets, palette } = await import('/src/catalog/fish.ts');
    const { openDatabase, completion } = await import('/src/storage/db.ts');
    const names = ['蓝色泡泡', '珊瑚小圆点', '金色长尾', '海草伙伴', '我的白带鱼', '紫色小星星'];
    const paint = document.createElement('canvas'); paint.width = paint.height = 512;
    const ctx = paint.getContext('2d'); ctx.fillStyle = '#EDBCD0'; ctx.fillRect(200, 230, 115, 45);
    const blob = await new Promise(resolve => paint.toBlob(resolve, 'image/png'));
    const db = await openDatabase();
    const tx = db.transaction(['fish', 'settings', 'assets'], 'readwrite'), done = completion(tx);
    const settings = createSettings();
    tx.objectStore('assets').put({ id: 'qa-paint', mime: 'image/png', width: 512, height: 512, bytes: blob.size, blob });
    for (let index = 0; index < 30; index++) {
      const design = createFishDesign(), color = palette[index % palette.length].value;
      design.bodyId = bodies[index % bodies.length].id;
      design.parts.tailId = tails[index % tails.length].id; design.parts.finId = finSets[index % finSets.length].id;
      design.colors.body = color; design.colors.head = palette[(index + 2) % palette.length].value;
      design.colors.tail = palette[(index + 4) % palette.length].value;
      design.pattern.id = ['none', 'grouper-spots', 'honeycomb', 'clown-bands'][index % 4];
      design.shape.length = index % 2 ? 1.4 : .75;
      design.paint.colorAssetId = index < 6 ? 'qa-paint' : index === 29 ? 'qa-missing' : null;
      design.stamps = [{ id: `stamp-${index}`, kind: 'starfish', color: '#EAC779', u: .6, v: .45, scale: .15, rotation: 0 }];
      const time = new Date(Date.UTC(2026, 9, 7, 0, index)).toISOString();
      const fish = { id: `qa-fish-${index}`, revision: 1, name: names[index] || `小伙伴 ${index + 1}`, personality: 'curious', preferredHabitat: 'reef-edge', effectEnabled: false,
        createdAt: time, updatedAt: time, design, activeEffect: null, ruleVersion: 1, lastCommandId: `qa-command-${index}` };
      const valid = validateOriginalFish(fish); if (!valid.ok) throw new Error(JSON.stringify(valid.errors));
      tx.objectStore('fish').put(fish);
      if (index < 5) settings.visibleEntries.push({ kind: 'original', fishId: fish.id });
    }
    tx.objectStore('settings').put(settings); await done; db.close();
  });
  await page.reload(); await page.locator('.ocean-list--art img').nth(29).waitFor();
  const snapshot = () => page.evaluate(async () => {
    const { openDatabase, request } = await import('/src/storage/db.ts'); const db = await openDatabase();
    try { const tx = db.transaction(['fish', 'settings', 'assets']); return { fish: await request(tx.objectStore('fish').getAll()), settings: await request(tx.objectStore('settings').getAll()), assets: await request(tx.objectStore('assets').getAllKeys()) }; }
    finally { db.close(); }
  });
  const before = await snapshot(); assert.equal(before.fish.length, 30);
  const cards = page.locator('.ocean-list--art .ocean-list-name'); assert.equal(await cards.count(), 30);
  assert.match(await cards.nth(29).innerText(), /笔迹暂未读到/);
  // Hidden painted fish appears correctly, then releases the temporary full-size bitmap.
  const artwork = await cards.nth(5).locator('img').getAttribute('src');
  const expected = await page.evaluate(async () => {
    const { loadProfile, loadAssets } = await import('/src/storage/repository.ts'); const { openDatabase } = await import('/src/storage/db.ts');
    const { fishThumbnail } = await import('/src/rendering/fishThumbnail.ts'); const db = await openDatabase();
    try {
      const fish = (await loadProfile(db)).fish.find(f => f.id === 'qa-fish-5'), blobs = await loadAssets(db, ['qa-paint']);
      const image = await createImageBitmap(blobs.get('qa-paint'));
      try { return { painted: fishThumbnail(fish.design, image, null, fish.revision), blank: fishThumbnail(fish.design, null, null, fish.revision) }; }
      finally { image.close(); }
    } finally { db.close(); }
  });
  assert.equal(artwork, expected.painted); assert.notEqual(artwork, expected.blank);
  assert.equal(await page.evaluate(() => window.__bitmapQA.created - window.__bitmapQA.closed), 5, 'only five visible painted fish retain source bitmaps');
  await cards.nth(0).click(); await page.locator('.ocean-skip').waitFor(); assert.equal(await cards.nth(0).getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('.ocean-play-hint').innerText(), /蓝色泡泡/); await page.getByRole('button', { name: '跳过镜头' }).click();
  assert.deepEqual(await snapshot(), before, 'selection, locating and thumbnail creation are read-only');
  // Reduced motion keeps locating static, while hidden selection never silently displays a fish.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await cards.nth(5).focus(); await page.keyboard.press('Space');
  assert.match(await page.locator('.fish-card h2').innerText(), /紫色小星星/); assert.equal(await page.locator('.ocean-skip').count(), 0);
  assert.deepEqual(await snapshot(), before);
  await page.getByRole('button', { name: '放回海洋：紫色小星星', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.ocean-list--art small')[5].textContent.includes('在海里'));
  await page.waitForFunction(() => !document.querySelector('.ocean-list--art .chip-button').disabled);
  assert.equal(await page.evaluate(() => window.__bitmapQA.created - window.__bitmapQA.closed), 6);
  await page.getByRole('button', { name: '收起：紫色小星星', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.ocean-list--art small')[5].textContent.includes('已收起'));
  await page.waitForFunction(() => !document.querySelector('.ocean-list--art .chip-button').disabled);
  assert.equal(await cards.nth(5).locator('img').getAttribute('src'), artwork);
  assert.equal(await page.evaluate(() => window.__bitmapQA.created - window.__bitmapQA.closed), 5);
  const afterToggle = await snapshot(); assert.deepEqual(afterToggle.fish, before.fish); assert.deepEqual(afterToggle.assets, before.assets);
  assert.deepEqual(afterToggle.settings[0].visibleEntries, before.settings[0].visibleEntries);
  // Capture both the larger scene and the collection, with 30 scrollable cards.
  for (const viewport of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport); await cards.nth(0).click();
    await page.locator('.ocean-experience').scrollIntoViewIfNeeded();
    const scene = `design/ocean-collection/scene-${viewport.width}.png`; await page.locator('.ocean-experience').screenshot({ path: scene });
    await page.locator('.ocean-list--art').evaluate(el => { el.scrollTop = 0; });
    const collection = `design/ocean-collection/cards-${viewport.width}.png`; await page.locator('.ocean-collection').screenshot({ path: collection });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const dimensions = await cards.nth(0).evaluate(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }));
    assert.ok(dimensions.width >= 120 && dimensions.height >= 150);
    assert.ok(await page.locator('.ocean-list--art .chip-button').nth(0).evaluate(el => el.getBoundingClientRect().height >= 44));
    views.push({ viewport, scene, collection });
  }
  await page.locator('a[href="/create"]').first().click();
  await page.waitForURL('**/create');
  assert.equal(await page.evaluate(() => window.__bitmapQA.created - window.__bitmapQA.closed), 0, 'ocean releases all its source bitmaps on navigation');
  assert.deepEqual(errors, []);
  const report = { date: '2026-10-07', scope: 'original-fish picture collection and larger ocean; isolated fixtures, desktop Edge; no physical iPad', checks: ['30 saved designs rendered as static picture cards', 'hidden fish preserves actual paint and stamps', 'hidden temporary bitmaps released; only visible source layers retained', 'thumbnail selection and finding do not write storage', 'keyboard selection and reduced motion', 'hidden fish remains hidden until explicitly put back', 'show/hide retains fish and assets and releases old bitmaps', 'three responsive scene/card layouts; no horizontal overflow; touch buttons at least 44px', 'missing paint labelled; other cards remain readable', 'all owned ocean bitmaps released on route exit'], views, errors };
  writeFileSync('docs/content/ocean-collection-verification.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
} finally { await browser.close(); }
