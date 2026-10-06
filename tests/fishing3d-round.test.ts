import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { species } from '../src/catalog/species.ts';
import { commandRound, createRound, stepRound, castPosition } from '../src/domain/fishing3d/round.ts';
import type { RoundContent, RoundState } from '../src/domain/fishing3d/round.ts';
import { bobberPosition, castingPose, CAST_MOTION, surfaceFloat } from '../src/domain/fishing3d/visual.ts';
import { validateBackup } from '../src/domain/backup.ts';
import { stepFight } from '../src/domain/fishing3d/simulate.ts';
import { createFight } from '../src/domain/fishing3d/simulate.ts';
import { SceneClock } from '../src/features/fishing3d/clock.ts';
import { createRoundSession } from '../src/features/fishing3d/round.ts';
import { createCaptureService } from '../src/features/fishing3d/capture.ts';
import { openDatabase, StorageError } from '../src/storage/db.ts';
import { loadDiscoveries, recordCapture } from '../src/storage/repository.ts';
import { exportProfile, replaceProfile } from '../src/storage/backup.ts';
import { Line, Raycaster, Vector2 } from 'three';
import { mouthPosition } from '../src/domain/fishing3d/state.ts';
import { FishingCameras } from '../src/rendering/fishing3d/cameras.ts';
import { createFishingWorld } from '../src/rendering/fishing3d/world.ts';
import { SceneResources } from '../src/rendering/fishing3d/resources.ts';
import { toWorld } from '../src/rendering/fishing3d/coordinates.ts';
const content: RoundContent = { pool: species, habitatId: 'reef-edge', samples: { 'amphiprion-ocellaris': 'sprinter' } };
const cast = (s = createRound(4), spot: 'near' | 'middle' | 'far' = 'middle', seed = 11) => commandRound(s, { type: 'cast', attemptId: `attempt-${seed}`, bait: 'shrimp', spot, seed }, content);
function toBite(s: RoundState) { while (s.phase === 'casting' || s.phase === 'waiting') s = stepRound(s); return s; }
function caught(spot: 'near' | 'middle' | 'far' = 'middle', assist = false, seed = 11) {
  let s = commandRound(toBite(cast(createRound(4, assist), spot, seed)), { type: 'pull' }, content);
  while (s.phase === 'fighting' || (s.phase === 'landing' && assist)) {
    const f = s.fight!, action = f.action === 'telegraph' ? f.nextAction : f.action;
    s = stepRound(s, { reel: ['rest', 'lateral'].includes(action) && f.tension < 0.9, rodAxis: action === 'lateral' ? -f.lateralSign : 0 });
  }
  return commandRound(s, { type: 'land' }, content);
}
test('G3 合法阶段、抛投终点、三落点初始位置与捕获只在抄起后成立', () => {
  const setup = createRound(4);
  for (const type of ['pull', 'land', 'release'] as const) assert.equal(commandRound(setup, { type }, content), setup);
  for (const spot of ['near', 'middle', 'far'] as const) {
    const casting = cast(setup, spot); assert.equal(cast(casting), casting);
    assert.deepEqual(bobberPosition({ ...casting, ticks: CAST_MOTION.impactTick }), castPosition(spot));
    const resources = new SceneResources(), world = createFishingWorld(resources);
    const line = world.scene.children.find(object => object instanceof Line) as Line;
    const grip = { x: -2, y: 1.65, z: -0.1 }, resting = castingPose(setup).tip;
    const length = Math.hypot(resting.x - grip.x, resting.y - grip.y, resting.z - grip.z);
    for (let tick = 0; tick <= CAST_MOTION.totalTicks; tick++) {
      const frame = { ...casting, ticks: tick }, tip = castingPose(frame).tip, float = bobberPosition(frame);
      assert.ok(Math.abs(Math.hypot(tip.x - grip.x, tip.y - grip.y, tip.z - grip.z) - length) < 1e-8, 'casting must not shorten the rod');
      assert.ok(float.y >= 0, 'airborne float must not dip below water');
      world.update(tick / 60, false, undefined, frame);
      const positions = line.geometry.getAttribute('position'), expected = toWorld(float);
      assert.ok(Math.hypot(positions.getX(23) - expected.x, positions.getY(23) - expected.y, positions.getZ(23) - expected.z) < 1e-6, 'line ends at the float, never a hidden fish');
      if (tick < CAST_MOTION.releaseTick) assert.ok(Math.abs(float.x - tip.x) < 1e-8 && Math.abs(float.z - tip.z) < 1e-8, 'float stays with the rod until release');
    }
    resources.dispose();
    assert.deepEqual(bobberPosition({ ...casting, ticks: CAST_MOTION.totalTicks }), bobberPosition({ ...casting, phase: 'waiting', ticks: 0 }));
    const bite = toBite(casting); assert.equal(bite.phase, 'bite');
    const fighting = commandRound(bite, { type: 'pull' }, content);
    assert.deepEqual(fighting.fight!.fishPosition, { ...castPosition(spot), y: -1.35 });
    assert.equal(commandRound(fighting, { type: 'land' }, content), fighting);
    for (const assist of [false, true]) {
      for (let seed = 1; seed <= 10; seed++) assert.equal(caught(spot, assist, seed).phase, 'caught', `${spot}/${assist}/${seed}`);
    }
  }
});
test('G3 提早、错过、2.5/5 秒窗口与连续失败、取消不计失败', () => {
  let s = cast(); for (let i = 0; i < CAST_MOTION.totalTicks; i++) s = stepRound(s);
  assert.equal(s.phase, 'waiting'); s = commandRound(s, { type: 'pull' }, content); assert.equal(s.escape, 'early'); assert.equal(s.failStreak, 1);
  s = commandRound(s, { type: 'retry', seed: 8 }, content); s = toBite(cast(s));
  for (let i = 0; i < 149; i++) s = stepRound(s); assert.equal(s.phase, 'bite');
  s = stepRound(s); assert.equal(s.escape, 'missed'); assert.equal(s.failStreak, 2);
  let assisted = toBite(cast(createRound(4, true)));
  for (let i = 0; i < 299; i++) assisted = stepRound(assisted); assert.equal(assisted.phase, 'bite');
  assert.equal(stepRound(assisted).escape, 'missed');
  assert.equal(commandRound(cast(createRound(4)), { type: 'cancel' }, content).failStreak, 0);
});
test('G3 大小来自选中物种；大鱼更有耐力，各动作与落点仍可完成', () => {
  const largeContent = { ...content, pool: content.pool.map(item => ({ ...item, game: { ...item.game, size: 'large' as const } })) };
  const hooked = commandRound(toBite(cast()), { type: 'pull' }, largeContent);
  assert.equal(hooked.fight!.size, 'large');
  for (const sample of ['sprinter', 'weaver', 'diver'] as const) for (const spot of ['near', 'middle', 'far'] as const) {
    const duration: number[] = [];
    for (const size of ['small', 'large'] as const) {
      let total = 0;
      for (let seed = 1; seed <= 20; seed++) {
        let f = createFight(sample, seed, size); f.fishPosition = { ...castPosition(spot), y: -1.35 };
        const hook = mouthPosition(f); f.lineLength = Math.hypot(hook.x - f.rodTip.x, hook.y - f.rodTip.y, hook.z - f.rodTip.z);
        while (f.phase === 'fighting') {
          const action = f.action === 'telegraph' ? f.nextAction : f.action;
          f = stepFight(f, { reel: ['rest', 'lateral'].includes(action) && f.tension < 0.9, rodAxis: action === 'lateral' ? -f.lateralSign : 0 });
          assert.ok(Number.isFinite(f.tension));
        }
        assert.equal(f.phase, 'landing', `${size}/${sample}/${spot}/${seed}`); total += f.elapsedTicks;
      }
      duration.push(total);
    }
    assert.ok(duration[1]! > duration[0]!, 'large fish should take more sustained effort on average');
  }
});
test('G3 收线才转鼓轮，松线与暂停清输入停转；水面鱼线连接可见浮漂', () => {
  const session = createRoundSession(content, 4);
  session.command({ type: 'cast', attemptId: 'reel', bait: 'shrimp', spot: 'middle', seed: 11 });
  while (session.read().phase !== 'bite') session.step(); session.command({ type: 'pull' });
  session.input({ reel: true, rodAxis: 0 }); for (let i = 0; i < 60; i++) session.step();
  const turns = session.read().fight!.reelTurns; assert.ok(turns > 0); assert.equal(session.read().fight!.reeling, true);
  session.clearInput(); assert.equal(session.read().fight!.reeling, false);
  for (let i = 0; i < 30; i++) session.step(); assert.equal(session.read().fight!.reelTurns, turns);
  const resources = new SceneResources(), world = createFishingWorld(resources), s = session.read();
  world.update(0, false, s.fight!, s);
  const line = world.scene.children.find(object => object instanceof Line) as Line, p = line.geometry.getAttribute('position');
  const float = toWorld(surfaceFloat(s.fight!));
  assert.ok(Math.hypot(p.getX(23) - float.x, p.getY(23) - float.y, p.getZ(23) - float.z) < 1e-6);
  resources.dispose();
});
test('G3 只抽预载且审核通过的物种，无资源保持准备；独立 seeded 抽样', () => {
  const s = createRound(4), event = { type: 'cast' as const, attemptId: 'attempt-1', bait: 'algae' as const, spot: 'far' as const, seed: 42 };
  assert.deepEqual(commandRound(s, event, content), commandRound(s, event, content));
  const unavailable = commandRound(s, event, { ...content, samples: {} }); assert.equal(unavailable.phase, 'setup'); assert.equal(unavailable.error, 'no-candidates');
  assert.equal(commandRound(s, event, content).speciesId, 'amphiprion-ocellaris');
});
test('G3 三个涟漪的中心均可点击，画面层不接收业务命令', () => {
  const resources = new SceneResources(), world = createFishingWorld(resources), cameras = new FishingCameras();
  world.update(0, false, undefined, createRound(4)); world.scene.updateMatrixWorld(true);
  for (const [w, h] of [[822, 440], [358, 380]]) {
    cameras.resize(w!, h!); cameras.update(0, true, world.fishPosition); cameras.camera.updateMatrixWorld(true);
    for (const spot of ['near', 'middle', 'far'] as const) {
      const projected = toWorld({ ...castPosition(spot), y: 0.035 }).project(cameras.camera), ray = new Raycaster();
      ray.setFromCamera(new Vector2(projected.x, projected.y), cameras.camera);
      assert.equal(ray.intersectObjects(world.castSpots)[0]?.object.userData.spot, spot);
    }
  }
  resources.dispose();
});
test('G3 整轮 30/60/120fps 与渲染重建／暂停复用同一业务状态', () => {
  const results = [30, 60, 120].map(fps => {
    const session = createRoundSession(content, 4, true), clock = new SceneClock();
    session.command({ type: 'cast', attemptId: 'round-clock', bait: 'shrimp', spot: 'middle', seed: 11 });
    for (let i = 0; i <= 40 * fps; i++) clock.tick(i * 1000 / fps, () => {
      const s = session.read(); if (s.phase === 'bite') session.command({ type: 'pull' });
      const f = session.read().fight;
      if (f) session.input({ reel: (f.action === 'rest' || f.action === 'lateral') && f.tension < 0.9, rodAxis: 0 });
      session.step();
    });
    return session.read();
  });
  assert.deepEqual(results[0], results[1]); assert.deepEqual(results[1], results[2]); assert.equal(results[0]!.phase, 'caught');
  const session = createRoundSession(content, 4), clock = new SceneClock(); session.command({ type: 'cast', attemptId: 'pause', bait: 'shrimp', spot: 'middle', seed: 11 });
  clock.tick(0); clock.tick(1000, () => session.step()); const saved = structuredClone(session.read()); clock.suspend(); session.clearInput();
  const rebuiltClock = new SceneClock(); rebuiltClock.tick(30_000, () => session.step()); assert.deepEqual(session.read(), saved);
});
test('G3 辅助协助横游竿向、过紧容错 2 秒、自动抄起，放生回准备', () => {
  const f = createFight(); f.breakTicks = 71; f.tension = 2; f.lineLength = 1.5;
  assert.equal(stepFight(f, { reel: true, rodAxis: 0 }).phase, 'escaped');
  assert.equal(stepFight(f, { reel: true, rodAxis: 0 }, true).phase, 'fighting');
  let s = commandRound(toBite(cast(createRound(4, true))), { type: 'pull' }, content);
  s = { ...s, fight: { ...s.fight!, action: 'lateral', lateralSign: 1 } };
  assert.ok(stepRound(s).fight!.rodAxis < 0);
  const result = caught('middle', true); assert.equal(result.phase, 'caught');
  let released = commandRound(result, { type: 'release' }, content); for (let i = 0; i < 72; i++) released = stepRound(released);
  assert.equal(released.phase, 'setup'); assert.equal(released.attemptId, null);
});
test('G3 捕获服务不记录未完成轮次；失败放生后重试并序列化重复提交', async () => {
  const db = await openDatabase(new IDBFactory()); let writes = 0;
  const service = createCaptureService(async (attempt, id) => { writes++; if (writes === 1) throw new StorageError('quota', '测试配额不足'); return recordCapture(db, attempt, id); }, () => undefined);
  service.observe(cast()); service.observe(toBite(cast())); assert.equal(writes, 0);
  const s = caught(); service.observe(s); await service.retry(s.attemptId!);
  assert.equal(service.get(s.attemptId)?.status, 'failed'); assert.equal((await loadDiscoveries(db)).length, 0);
  service.observe(commandRound(s, { type: 'release' }, content));
  await Promise.all([service.retry(s.attemptId!), service.retry(s.attemptId!), service.retry(s.attemptId!)]);
  assert.equal(writes, 2); assert.equal(service.get(s.attemptId)?.status, 'saved');
  const discovery = (await loadDiscoveries(db))[0]!; assert.equal(discovery.catchCount, 1);
  await recordCapture(db, s.attemptId!, s.speciesId!); assert.deepEqual((await loadDiscoveries(db))[0], discovery);
  db.close();
});
test('G3 新捕获复用旧数据库及备份 schema，恢复后幂等与首次时间保持', async () => {
  const db = await openDatabase(new IDBFactory()), s = caught();
  await recordCapture(db, s.attemptId!, s.speciesId!, new Date('2026-10-06T01:00:00Z'));
  const backup = await exportProfile(db); const restored = await openDatabase(new IDBFactory());
  const checked = validateBackup(backup, JSON.stringify(backup).length); assert.ok(checked.ok);
  await replaceProfile(restored, checked.value);
  await recordCapture(restored, s.attemptId!, s.speciesId!, new Date('2026-10-07T01:00:00Z'));
  assert.equal((await loadDiscoveries(restored))[0]!.catchCount, 1);
  assert.equal((await loadDiscoveries(restored))[0]!.firstCaughtAt, '2026-10-06T01:00:00.000Z');
  db.close(); restored.close();
});
