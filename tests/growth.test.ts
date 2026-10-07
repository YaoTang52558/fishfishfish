import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import { createSettings, validateSettings } from '../src/domain/draft.ts';
import { growthPresets, challengeRules } from '../src/domain/growth.ts';
import { createRound, commandRound, stepRound, type RoundContent } from '../src/domain/fishing3d/round.ts';
import { landedFishPosition } from '../src/domain/fishing3d/visual.ts';
import { createFight, stepFight } from '../src/domain/fishing3d/simulate.ts';
import { species } from '../src/catalog/species.ts';
import { openDatabase } from '../src/storage/db.ts';
import { loadProfile, updatePreferences } from '../src/storage/repository.ts';
import { exportProfile, replaceProfile } from '../src/storage/backup.ts';
import { validateBackup } from '../src/domain/backup.ts';

const content: RoundContent = { pool: species, habitatId: 'reef-edge', samples: { 'amphiprion-ocellaris': 'sprinter' } };
test('old settings retain their exact shape; new independent preferences validate', () => {
  const old = createSettings(); const parsed = validateSettings(old); assert.ok(parsed.ok); assert.deepEqual(parsed.value, old);
  for (const p of growthPresets) assert.ok(validateSettings({ ...old, challenge: p.challenge, knowledgeDepth: p.knowledgeDepth, assistMode: p.assistMode }).ok);
  assert.ok(validateSettings({ ...old, assistMode: true, challenge: 'hard', knowledgeDepth: 'simple' }).ok);
  for (const field of ['challenge','knowledgeDepth']) for (const invalid of [null, false, 1, 'auto']) assert.equal(validateSettings({ ...old, [field]: invalid }).ok, false);
});
test('growth preferences survive backup and independent changes without writing discoveries', async () => {
  const db = await openDatabase(new IDBFactory());
  try {
    let settings = await updatePreferences(db, { assistMode: true, challenge: 'hard', knowledgeDepth: 'curious' }, 0);
    settings = await updatePreferences(db, { knowledgeDepth: 'simple' }, settings.revision);
    assert.equal(settings.assistMode, true); assert.equal(settings.challenge, 'hard');
    const backup = await exportProfile(db), valid = validateBackup(backup, JSON.stringify(backup).length); assert.ok(valid.ok);
    const target = await openDatabase(new IDBFactory());
    try { await replaceProfile(target, valid.value); const restored = (await loadProfile(target)).settings; assert.deepEqual({ ...restored, revision: settings.revision }, settings); assert.ok(restored.revision > settings.revision); } finally { target.close(); }
    assert.equal(backup.discoveries.length, 0); assert.equal(backup.captures.length, 0);
    await assert.rejects(updatePreferences(db, { challenge: 'auto' as 'hard' }, settings.revision));
    assert.deepEqual((await loadProfile(db)).settings, settings);
  } finally { db.close(); }
});
test('challenge is locked during a cast and retained on cancel, retry and release', () => {
  let s = createRound(1, true, 'gentle');
  s = commandRound(s, { type:'cast', bait:'shrimp', spot:'near', attemptId:'growth-cast', seed:11 }, content);
  assert.equal(commandRound(s, { type:'setChallenge', value:'hard' }, content), s);
  const cancelled = commandRound(s, { type:'cancel' }, content); assert.equal(cancelled.challenge, 'gentle');
  const retried = commandRound({ ...s, phase:'escaped' }, { type:'retry', seed:2 }, content); assert.equal(retried.challenge, 'gentle');
  assert.equal(stepRound({ ...s, phase:'released', ticks:71 }).challenge, 'gentle');
  assert.equal(commandRound(cancelled, { type:'setChallenge', value:'hard' }, content).challenge, 'hard');
});
test('size and challenge both change strength/stamina without changing selected fish', () => {
  assert.ok(challengeRules.gentle.power < challengeRules.regular.power && challengeRules.regular.power < challengeRules.hard.power);
  const f = { ...createFight('sprinter', 4), action:'sprint' as const, actionTicks:120 };
  const gentle = stepFight(f, { reel:false, rodAxis:0 }, false, 'gentle');
  const hard = stepFight(f, { reel:false, rodAxis:0 }, false, 'hard');
  assert.ok(hard.fishVelocity.z > gentle.fishVelocity.z); assert.ok(hard.fatigue < gentle.fatigue);
  for (const p of growthPresets) {
    const s = commandRound(createRound(1,p.assistMode,p.challenge),{type:'cast',bait:'shrimp',spot:'middle',attemptId:'same-fish',seed:11},content);
    assert.equal(s.speciesId,'amphiprion-ocellaris');
  }
});
test('helper releases dangerous reeling and does not take control away when disabled', () => {
  const fight = { ...createFight('sprinter', 8), tension:1.2, action:'sprint' as const };
  const s = { ...createRound(1,true), phase:'fighting' as const, fight };
  const helped = stepRound(s,{reel:true,rodAxis:0}), manual = stepRound({...s,assist:false},{reel:true,rodAxis:0});
  assert.equal(helped.fight?.reeling,false); assert.equal(manual.fight?.reeling,true);
});
test('all three manual challenges remain landable for both sizes and each action sample', () => {
  for (const challenge of ['gentle','regular','hard'] as const) for (const size of ['small','large'] as const) for (const sample of ['sprinter','weaver','diver'] as const) {
    let f = createFight(sample,17,size);
    while (f.phase === 'fighting') {
      const action = f.action === 'telegraph' ? f.nextAction : f.action;
      f = stepFight(f,{reel:['rest','lateral'].includes(action) && f.tension < .9,rodAxis:action === 'lateral' ? -f.lateralSign : 0},false,challenge);
    }
    assert.equal(f.phase,'landing',`${challenge}/${size}/${sample}`);
  }
});
test('net lift and release are continuous presentation only, with static reduced-motion pose', () => {
  const fight = { ...createFight(), phase:'caught' as const };
  const s = { ...createRound(1), phase:'caught' as const, fight, speciesId:'amphiprion-ocellaris', attemptId:'net-fish' };
  const before = structuredClone(s); const first=landedFishPosition(s), last=landedFishPosition({...s,ticks:81});
  assert.equal(first.y,-.12); assert.equal(last.y,.8);
  assert.deepEqual(landedFishPosition({...s,phase:'released'}),last);
  assert.deepEqual(landedFishPosition(s,true),last); assert.deepEqual(s,before);
  let next=s; for(let i=0;i<200;i++) next=stepRound(next) as typeof s;
  assert.equal(next.phase,'caught'); assert.equal(next.ticks,180); assert.equal(next.speciesId,s.speciesId); assert.equal(next.attemptId,s.attemptId);
});
