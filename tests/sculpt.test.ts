import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import { bodies, heads } from '../src/catalog/fish.ts';
import { changeSculpt, createFishDesign, validateFishDesign } from '../src/domain/fish.ts';
import { getFishGeometry } from '../src/domain/geometry.ts';
import { createDraft } from '../src/domain/draft.ts';
import { validateBackup } from '../src/domain/backup.ts';
import { openDatabase } from '../src/storage/db.ts';
import { loadDraft, saveDraft } from '../src/storage/drafts.ts';
import { exportProfile, replaceProfile } from '../src/storage/backup.ts';
import { summarizePlaytest } from '../src/features/playtest.ts';
import { pngBytes } from './pngFixture.ts';
import type { StoredAsset } from '../src/domain/types.ts';

test('old designs keep their exact shape; sculpt changes are immutable and reject hostile input', () => {
  const old = createFishDesign(), before = structuredClone(old), result = validateFishDesign(old); assert.ok(result.ok); assert.deepEqual(result.value, old);
  const next = changeSculpt(old, 'top', 1, -0.14); assert.deepEqual(old, before); assert.deepEqual(next.sculpt, { top: [0, -0.14, 0], bottom: [0, 0, 0] });
  assert.deepEqual(getFishGeometry(changeSculpt(old, 'top', 1, 0)).canonicalContour, getFishGeometry(old).canonicalContour);
  assert.equal(next.paint, old.paint); assert.equal(next.stamps, old.stamps);
  for (const invalid of [null, [], { top: [0, 0], bottom: [0, 0, 0] }, { top: [0, 0.141, 0], bottom: [0, 0, 0] }, { top: [0, NaN, 0], bottom: [0, 0, 0] }]) assert.equal(validateFishDesign({ ...old, sculpt: invalid }).ok, false);
  for (const value of [Infinity, NaN, 0.15]) assert.throws(() => changeSculpt(old, 'top', 1, value));
});
test('sculpted contours stay finite, noncrossing, and connect the same neck and tail across all body/head combinations', () => {
  for (const b of bodies) for (const h of heads) for (const sign of [-1, 1]) {
    const old = { ...createFishDesign(), bodyId: b.id, parts: { ...createFishDesign().parts, headId: h.id } };
    const next = { ...old, sculpt: { top: [sign * 0.14, -sign * 0.14, sign * 0.14] as [number, number, number], bottom: [-sign * 0.14, sign * 0.14, -sign * 0.14] as [number, number, number] } };
    const base = getFishGeometry(old), g = getFishGeometry(next);
    assert.deepEqual(g.neck, base.neck); assert.deepEqual(g.tail.pivot, base.tail.pivot);
    assert.ok(g.canonicalContour.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.y >= -0.5 && p.y <= 0.5));
    const top = g.canonicalContour.slice(0, 85), bottom = [...g.canonicalContour.slice(85)].reverse();
    for (let i = 0; i < bottom.length; i++) assert.ok(top[i]!.y <= bottom[i]!.y);
    assert.notDeepEqual(g.canonicalContour, base.canonicalContour);
  }
});
test('sculpt survives draft reload and portable backup; old profile and captures remain intact', async () => {
  const db = await openDatabase(new IDBFactory()), target = await openDatabase(new IDBFactory());
  try {
    const design = changeSculpt(changeSculpt(createFishDesign(), 'top', 0, -0.08), 'bottom', 2, 0.11);
    const asset = (id: string, seed: number): StoredAsset => { const blob = new Blob([pngBytes(seed)], { type: 'image/png' }); return { id, mime: 'image/png', width: 512, height: 512, bytes: blob.size, blob }; };
    const saved = await saveDraft(db, createDraft(design), { color: { kind: 'replace', asset: asset('sculpt-color', 40) }, glow: { kind: 'replace', asset: asset('sculpt-glow', 80) } }); const loaded = await loadDraft(db); assert.equal(loaded.status, 'ok'); assert.ok(loaded.status === 'ok'); assert.deepEqual(loaded.draft.design.sculpt, saved.design.sculpt); assert.equal(loaded.layers.color.error, null); assert.equal(loaded.layers.glow.error, null);
    const backup = await exportProfile(db), parsed = validateBackup(backup, JSON.stringify(backup).length); assert.ok(parsed.ok);
    await replaceProfile(target, parsed.value); const restored = await loadDraft(target); assert.ok(restored.status === 'ok'); assert.deepEqual(restored.draft.design, saved.design);
    const bad = { ...backup, draft: { ...backup.draft, design: { ...saved.design, sculpt: { top: [0, 9, 0], bottom: [0, 0, 0] } } } }; assert.equal(validateBackup(bad, JSON.stringify(bad).length).ok, false);
    assert.equal(parsed.value.assets.size, 2); assert.equal(backup.captures.length, 0); assert.equal(backup.discoveries.length, 0);
  } finally { db.close(); target.close(); }
});
test('playtest summaries preserve unmeasured and failed outcomes', () => { assert.deepEqual(summarizePlaytest([{ outcome: 'passed' }, { outcome: 'failed' }, { outcome: 'unmeasured' }]), { total: 3, passed: 1, failed: 1, unmeasured: 1 }); });
