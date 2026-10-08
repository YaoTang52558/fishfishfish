import test from 'node:test';
import assert from 'node:assert/strict';
import { armPoseLimits, bodies, catalogVersion } from '../src/catalog/fish.ts';
import { changeArmPose, changeArms, createFishDesign, validateFishDesign } from '../src/domain/fish.ts';
import { getArmPoses, armSections, armPolygon, poseForArmTip } from '../src/domain/arms.ts';
import { getEditorBounds, getFishGeometry } from '../src/domain/geometry.ts';
import { buildBackup, validateBackup } from '../src/domain/backup.ts';
import { createDraft, createSettings } from '../src/domain/draft.ts';
import { createCreativeArms3d } from '../src/rendering/creativeArms3d.ts';
import { IDBFactory } from 'fake-indexeddb';
import { openDatabase } from '../src/storage/db.ts';
import { saveDraft, loadDraft } from '../src/storage/drafts.ts';

test('editing one pose preserves others, count changes preserve survivors and global edits have clear scope', () => {
  const old = changeArms(createFishDesign(), { count: 4 }), defaults = getArmPoses(old);
  const single = changeArmPose(old, 1, { position: .9, angle: 1.2, length: .5, curl: .9 });
  assert.deepEqual(getEditorBounds(old,true),getEditorBounds(single), 'first pose edit keeps the same camera');
  assert.deepEqual(getArmPoses(single).filter((_, i) => i !== 1), defaults.filter((_, i) => i !== 1));
  assert.equal(old.arms?.poses, undefined); assert.deepEqual(single.paint, old.paint);
  const more = changeArms(single, { count: 8 }); assert.deepEqual(getArmPoses(more).slice(0,4), getArmPoses(single));
  assert.deepEqual(getArmPoses(changeArms(more, { count: 2 })), getArmPoses(single).slice(0,2));
  const together = changeArms(single, { length: .2, curl: .4 });
  assert.ok(getArmPoses(together).every(p => p.length === .2 && p.curl === .4));
  assert.deepEqual(getArmPoses(together).map(p => [p.position,p.angle]), getArmPoses(single).map(p => [p.position,p.angle]));
  assert.deepEqual(changeArms(single, { poses: undefined }), old);
  for (const index of [-1,4,NaN,1.5]) assert.throws(() => changeArmPose(old, index, { length: .3 }));
});

test('saved individual poses are strictly bounded, deeply copied and portable; old arm backups retain their shape', async () => {
  const old = changeArms(createFishDesign(), { count: 2 }), design = changeArmPose(old, 0, { angle: -.9 });
  const result = validateFishDesign(design); assert.ok(result.ok);
  if (result.ok) { assert.deepEqual(result.value, design); assert.notEqual(result.value.arms?.poses, design.arms?.poses); }
  for (const poses of [null,{},[],[{}],Array(2),Array(9).fill({}), [{position:.5,angle:0,length:.3,curl:.5}]]) assert.equal(validateFishDesign({...design,arms:{...design.arms,poses}}).ok, false);
  for (const key of Object.keys(armPoseLimits)) for (const value of [NaN,Infinity,'0.3',-10,10]) {
    const poses = getArmPoses(design); poses[0] = {...poses[0]!,[key]:value} as typeof poses[0];
    assert.equal(validateFishDesign({...design,arms:{...design.arms,poses}}).ok, false);
  }
  const db = await openDatabase(new IDBFactory());
  let draft;
  try { draft = await saveDraft(db,createDraft(design,0),{color:{kind:'keep'},glow:{kind:'keep'}}); const loaded = await loadDraft(db); assert.equal(loaded.status,'ok'); if (loaded.status==='ok') assert.deepEqual(loaded.draft.design,design); }
  finally { db.close(); }
  const backup = buildBackup({fish:[],draft,settings:createSettings(),assets:new Map(),effects:[],captures:[],discoveries:[]});
  assert.equal(backup.catalogVersion,catalogVersion); assert.ok(catalogVersion >= 4); const checked = validateBackup(JSON.parse(JSON.stringify(backup)),1000); assert.ok(checked.ok);
  if (checked.ok) assert.deepEqual(checked.value.draft?.design,design);
  const legacy = validateBackup({...backup,catalogVersion:3,draft:{...draft,design:old}},1000); assert.ok(legacy.ok);
  if (legacy.ok) assert.deepEqual(getFishGeometry(legacy.value.draft!.design).arms,getFishGeometry(old).arms);
});

test('endpoint solve follows the rendered curve, clamps extreme drags and fits fixed editing/animated bounds', () => {
  for (const body of bodies) for (const curl of [0,.5,1]) for (const angle of [-1.35,0,1.35]) {
    const design = changeArmPose(changeArms({...createFishDesign(),bodyId:body.id},{count:3}),1,{position:.9,length:.55,curl,angle});
    const g = getFishGeometry(design), root = g.arms[1]!, tip = armSections(root).at(-1)!;
    const solved = poseForArmTip(root,tip,g.axes.x); assert.ok(Math.abs(solved.length-.55)<1e-10); assert.ok(Math.abs(solved.angle-angle)<1e-10);
    const extreme = poseForArmTip(root,{x:1000,y:-1000},g.axes.x); assert.equal(extreme.length,.55); assert.ok(Math.abs(extreme.angle)<=1.35);
    const frame = getEditorBounds(design);
    assert.deepEqual(frame,getEditorBounds(changeArmPose(design,1,{position:.18,length:.15,angle:-angle,curl:1-curl})));
    for (const r of g.arms) for (const time of [0,1,3.8,9]) for (const p of armPolygon(r,time,true)) assert.ok(p.x>=g.bounds.minX && p.x<=g.bounds.maxX && p.y>=g.bounds.minY && p.y<=g.bounds.maxY);
    for (const r of g.arms) for (const p of armPolygon(r)) assert.ok(p.x>=frame.minX && p.x<=frame.maxX && p.y>=frame.minY && p.y<=frame.maxY);
    const mesh = createCreativeArms3d(g.arms,design.arms!.color); mesh.update(0,false);
    const array = mesh.mesh.geometry.attributes.position!.array, stride = 25*9*3;
    assert.ok(Math.abs(array[stride]!- (root.x+root.radius*Math.cos(root.spread))) < 1e-6, '3D uses the individually positioned root'); mesh.dispose();
  }
});
