import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { armLimits, bodies, catalogVersion, shapeLimits } from '../src/catalog/fish.ts';
import { changeArms, createFishDesign, randomizeDesign, validateFishDesign } from '../src/domain/fish.ts';
import { getEditorBounds, getFishGeometry } from '../src/domain/geometry.ts';
import { armPolygon, armSections } from '../src/domain/arms.ts';
import { buildBackup, validateBackup } from '../src/domain/backup.ts';
import { createDraft, createSettings } from '../src/domain/draft.ts';
import { saveDraft, loadDraft } from '../src/storage/drafts.ts';
import { openDatabase } from '../src/storage/db.ts';
import { createCreativeArms3d } from '../src/rendering/creativeArms3d.ts';
import { Vector3 } from 'three';

test('optional arms preserve old designs and reject malformed saved structures', () => {
  const old = createFishDesign(); assert.deepEqual(validateFishDesign(old), { ok: true, value: old });
  const design = changeArms(old, { count: 3, color: '#EDBCD0' });
  assert.equal(design.arms?.count, 3); assert.equal(old.arms, undefined);
  const checked = validateFishDesign(design); assert.ok(checked.ok); if (checked.ok) assert.deepEqual(checked.value, design);
  assert.deepEqual(changeArms(design, { count: 0 }), old);
  assert.deepEqual(randomizeDesign(design, 125).arms, design.arms);
  for (const patch of [{ count: 9 }, { count: -1 }, { count: 1.5 }, { count: '4' }, { length: NaN }, { length: Infinity }, { length: .01 }, { curl: 1.1 }, { color: 'red' }]) {
    assert.equal(validateFishDesign({ ...design, arms: { ...design.arms, ...patch } }).ok, false);
  }
  for (const arms of [null, [], {}, 'eight']) assert.equal(validateFishDesign({ ...old, arms }).ok, false);
});

test('arm attachment, animated extents and fixed editor framing hold at shape limits', () => {
  for (const body of bodies) for (const count of [1,3,8]) for (const length of [armLimits.length.min, armLimits.length.max]) for (const curl of [0,.37,1]) {
    const design = changeArms({ ...createFishDesign(), bodyId: body.id,
      shape: { length: shapeLimits.length.max, height: shapeLimits.height.min, headRatio: shapeLimits.headRatio.max },
      sculpt: { top: [-.14,.14,-.14], bottom: [.14,-.14,.14] } }, { count, length, curl });
    const g = getFishGeometry(design), box = getEditorBounds(design);
    assert.equal(g.arms.length, count);
    for (const root of g.arms) for (const time of [0,1,3.8,9,21]) for (const p of armPolygon(root, time, true)) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      const b = g.bounds; assert.ok(p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY);
    }
    for (const root of g.arms) for (const p of armPolygon(root)) assert.ok(p.x >= box.minX && p.x <= box.maxX && p.y >= box.minY && p.y <= box.maxY, 'static editor stays within its fixed frame');
    assert.deepEqual(box, getEditorBounds(changeArms(design, { length: .26, curl: .55 })), 'sliders must not move the editor camera');
    const recolored = changeArms(design, { color: '#E9A598' }); assert.equal(getFishGeometry(recolored), g, 'colour changes reuse geometry');
    assert.deepEqual(armSections(g.arms[0]!, 8, false), armSections(g.arms[0]!, 0, false), 'static pose has no time dependence');
  }
});

test('arms survive draft storage and catalog-versioned backup; old backups still load', async () => {
  const db = await openDatabase(new IDBFactory());
  try {
    const design = changeArms(createFishDesign(), { count: 8, length: .46, curl: .8, color: '#B3A0B7' });
    const saved = await saveDraft(db, createDraft(design, 0), { color: { kind: 'keep' }, glow: { kind: 'keep' } });
    const loaded = await loadDraft(db); assert.equal(loaded.status, 'ok'); if (loaded.status === 'ok') assert.deepEqual(loaded.draft.design, design);
    const backup = buildBackup({ fish: [], draft: saved, settings: createSettings(), effects: [], discoveries: [], captures: [], assets: new Map() });
    assert.equal(backup.catalogVersion, catalogVersion); const read = validateBackup(JSON.parse(JSON.stringify(backup)), 1000); assert.ok(read.ok);
    if (read.ok) assert.deepEqual(read.value.draft?.design, design);
    const old = { ...backup, catalogVersion: 2, draft: { ...saved, design: createFishDesign() } }; assert.ok(validateBackup(old, 1000).ok);
  } finally { db.close(); }
});

test('eight animated 3D arms share a bounded mesh and keep GPU buffers between frames', () => {
  const design = changeArms(createFishDesign(), { count: 8 }), roots = getFishGeometry(design).arms;
  const model = createCreativeArms3d(roots, design.arms!.color), geometry = model.mesh.geometry;
  const position = geometry.attributes.position!, array = position.array, original = Array.from(array);
  assert.ok(position.count <= 1800); assert.ok(geometry.index!.count / 3 <= 3300);
  model.update(3.8); assert.equal(geometry.attributes.position, position); assert.equal(position.array, array);
  assert.notDeepEqual(Array.from(array), original); assert.ok(Array.from(array).every(Number.isFinite));
  for (const time of [0,1,3.8,9,21]) {
    model.update(time);
    for (let i = 0; i < position.count; i++) assert.ok(geometry.boundingSphere!.containsPoint(new Vector3().fromBufferAttribute(position, i)), 'raycasting bound contains animated tips');
  }
  let geometryDisposed = false, materialDisposed = false;
  geometry.addEventListener('dispose', () => geometryDisposed = true); model.mesh.material.addEventListener('dispose', () => materialDisposed = true);
  model.dispose(); assert.ok(geometryDisposed && materialDisposed);
});
