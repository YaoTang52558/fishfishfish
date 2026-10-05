import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import { buildBackup, validateBackup } from '../src/domain/backup.ts';
import { createDraft, createSettings } from '../src/domain/draft.ts';
import { createFishDesign, setPaintAsset } from '../src/domain/fish.ts';
import { validateBackupTextures } from '../src/storage/backupTextures.ts';
import { replaceProfile } from '../src/storage/backup.ts';
import { loadProfile } from '../src/storage/repository.ts';
import { saveDraft } from '../src/storage/drafts.ts';
import { openDatabase } from '../src/storage/db.ts';

function brokenBackup() {
  const bytes = new Uint8Array(33);
  bytes.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
  new DataView(bytes.buffer).setUint32(16,512); new DataView(bytes.buffer).setUint32(20,512);
  return buildBackup({fish:[],draft:createDraft(setPaintAsset(createFishDesign(),'broken',null),1),settings:createSettings(),effects:[],discoveries:[],captures:[],assets:new Map([['broken',bytes]])});
}
test('header-valid but undecodable PNG aborts import before existing data is replaced', async () => {
  const db = await openDatabase(new IDBFactory());
  await saveDraft(db,createDraft(createFishDesign(),0,{name:'不能丢的鱼'}),{color:{kind:'keep'},glow:{kind:'keep'}});
  const before = await loadProfile(db);
  const checked = validateBackup(brokenBackup(),1000);
  if (!checked.ok) assert.fail();
  await assert.rejects(async () => {
    await validateBackupTextures(checked.value,async(blob) => {
      assert.equal(blob.type,'image/png'); assert.equal(blob.size,33);
      throw new DOMException('Invalid image','InvalidStateError');
    });
    await replaceProfile(db,checked.value);
  },/已损坏/);
  assert.deepEqual(await loadProfile(db),before);
  db.close();
});
test('both referenced layers must decode at 512×512; every decoded bitmap is released', async () => {
  const checked = validateBackup(brokenBackup(),1000);
  if (!checked.ok) assert.fail();
  checked.value.assets.set('second-layer',new Uint8Array([1]));
  let calls=0, closed=0;
  await assert.rejects(validateBackupTextures(checked.value,async() => {
    calls+=1;
    return {width:calls===1?512:256,height:512,close(){closed+=1;}};
  }),/实际尺寸/);
  assert.equal(calls,2); assert.equal(closed,2);
  calls=0;closed=0;
  await validateBackupTextures(checked.value,async() => {calls+=1;return {width:512,height:512,close(){closed+=1;}};});
  assert.equal(calls,2);assert.equal(closed,2);
});
