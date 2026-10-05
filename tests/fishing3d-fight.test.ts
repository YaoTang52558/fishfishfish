import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { createFight, landFish, stepFight } from '../src/domain/fishing3d/simulate.ts';
import { FIGHT_CONFIG as C } from '../src/domain/fishing3d/config.ts';
import { distanceToShore, mouthPosition } from '../src/domain/fishing3d/state.ts';
import type { FightInput, FightState3D, FightSample } from '../src/domain/fishing3d/state.ts';
import { SceneClock } from '../src/features/fishing3d/clock.ts';
import { FightInputs } from '../src/features/fishing3d/input.ts';
import { createPrototypeFish } from '../src/rendering/fishing3d/fish.ts';
import { SceneResources } from '../src/rendering/fishing3d/resources.ts';
import { toWorld } from '../src/rendering/fishing3d/coordinates.ts';

function reactive(s: FightState3D): FightInput {
  const action = s.action === 'telegraph' ? s.nextAction : s.action;
  return { reel: (action === 'rest' || action === 'lateral') && s.tension < 0.9, rodAxis: action === 'lateral' ? -s.lateralSign : 0 };
}
function run(sample: FightSample, policy = reactive, seed?: number) {
  let s = createFight(sample, seed);
  while (s.phase === 'fighting') s = stepFight(s, policy(s));
  return s;
}

test('G2 初始线长由嘴部到竿尖的距离确定，有限配置与输入边界', () => {
  const s = createFight(), hook = mouthPosition(s);
  assert.equal(s.tension, 0);
  assert.equal(s.lineLength, Math.hypot(hook.x - s.rodTip.x, hook.y - s.rodTip.y, hook.z - s.rodTip.z));
  for (const value of Object.values(C)) if (typeof value === 'number') assert.ok(Number.isFinite(value) && value > 0 || value === C.landingDepth);
  assert.throws(() => createFight('diver', NaN));
  assert.throws(() => stepFight(s, { reel: true, rodAxis: Infinity }));
  assert.ok(stepFight(s, { reel: true, rodAxis: 100 }).rodAxis <= 1);
});

test('G2 30/60/120fps 使用同一固定步输入，得到完全相同的结果', () => {
  const states = [30, 60, 120].map((fps) => {
    let s = createFight('diver', 17); const clock = new SceneClock();
    for (let i = 0; i <= 30 * fps; i++) clock.tick(i * 1000 / fps, () => { s = stepFight(s, reactive(s)); });
    return s;
  });
  assert.deepEqual(states[0], states[1]); assert.deepEqual(states[1], states[2]);
  assert.equal(states[0]!.phase, 'landing');
});

test('G2 收线改变线长、拉力及真实位置；全程松线不会靠疲劳条成功', () => {
  let s = createFight(); const initial = structuredClone(s);
  s = stepFight(s, { reel: true, rodAxis: 0 });
  assert.ok(Math.abs(s.lineLength - (initial.lineLength - C.reelSpeed / 60)) < 1e-8);
  for (let i = 1; i < 120; i++) s = stepFight(s, { reel: true, rodAxis: 0 });
  assert.ok(distanceToShore(s) < distanceToShore(initial) - 0.3);
  assert.ok(s.tension > 0.1); assert.deepEqual(initial, createFight());
  const slack = run('sprinter', () => ({ reel: false, rodAxis: 0 }));
  assert.equal(slack.phase, 'escaped'); assert.equal(slack.escapeReason, 'timeout');
  assert.ok(slack.fatigue > 0.7 && distanceToShore(slack) > C.landingRadius);
});

test('G2 冲刺与下潜时持续硬收会断线，按预兆松线后仍可成功', () => {
  for (const kind of ['sprinter', 'diver'] as const) {
    const hard = run(kind, () => ({ reel: true, rodAxis: 0 }));
    assert.equal(hard.escapeReason, 'line');
    assert.ok(hard.breakTicks >= Math.ceil(C.breakSeconds / C.step));
    const smart = run(kind);
    assert.equal(smart.phase, 'landing'); assert.ok(smart.elapsedTicks < 60 * 35);
  }
});

test('G2 横游时相反方向控竿减小横向与离岸位移，竿尖确实移动', () => {
  const outcomes = [-1, 1].map((axis) => {
    let s = createFight('weaver'); s.action = 'lateral'; s.actionTicks = 300; s.lateralSign = 1;
    for (let i = 0; i < 90; i++) s = stepFight(s, { reel: true, rodAxis: axis });
    return s;
  });
  assert.ok(outcomes[0]!.fishPosition.x < outcomes[1]!.fishPosition.x - 0.3);
  assert.ok(distanceToShore(outcomes[0]!) < distanceToShore(outcomes[1]!) - 0.4);
  assert.ok(outcomes[0]!.rodTip.x < -1 && outcomes[1]!.rodTip.x > 1);
});

test('G2 位置、深度与疲劳共同决定抄鱼，终局不再计时或重复抄起', () => {
  const near = createFight(); near.fishPosition = { x: 0, y: -0.4, z: 0.5 }; near.fatigue = 0.8;
  const landing = stepFight(near, { reel: false, rodAxis: 0 });
  assert.equal(landing.phase, 'landing');
  assert.equal(stepFight(landing, { reel: true, rodAxis: 1 }), landing);
  const caught = landFish(landing); assert.equal(caught.phase, 'caught'); assert.equal(landFish(caught), caught);
  assert.equal(landFish(createFight()).phase, 'fighting');
  for (const patch of [{ fatigue: 0.1 }, { fishPosition: { x: 0, y: -1.5, z: 0.5 } }, { fishPosition: { x: 0, y: -0.4, z: 4 } }]) {
    assert.equal(stepFight({ ...near, ...patch }, { reel: false, rodAxis: 0 }).phase, 'fighting');
  }
});

test('G2 三种样本的预兆和动作不同，60 个 seeded 策略样本稳定到达岸边', () => {
  const first: string[] = [];
  for (const kind of ['sprinter', 'weaver', 'diver'] as const) {
    let s = createFight(kind); for (let i = 0; i < 151; i++) s = stepFight(s, { reel: false, rodAxis: 0 });
    assert.equal(s.action, 'telegraph'); assert.ok(s.actionTicks >= 30); first.push(s.nextAction);
    for (let seed = 1; seed <= 20; seed++) {
      const outcome = run(kind, reactive, seed); assert.equal(outcome.phase, 'landing');
      assert.ok(outcome.elapsedTicks < 60 * 35);
      for (const value of [...Object.values(outcome.fishPosition), ...Object.values(outcome.fishVelocity), outcome.tension, outcome.lineLength]) assert.ok(Number.isFinite(value));
    }
  }
  assert.deepEqual(first, ['sprint', 'lateral', 'dive']);
});

test('G2 暂停与恢复清空持有输入，规则时钟不补算后台时间', () => {
  let s = createFight(); const clock = new SceneClock(), inputs = new FightInputs();
  inputs.keyDown(' ', 'reel'); clock.tick(0); clock.tick(1000 / 60, () => { s = stepFight(s, inputs.read()); });
  const saved = structuredClone(s); clock.suspend(); inputs.clear();
  clock.tick(20_000, () => { s = stepFight(s, inputs.read()); });
  assert.deepEqual(s, saved); assert.deepEqual(inputs.read(), { reel: false, rodAxis: 0 });
  clock.tick(20_000 + 1000 / 60, () => { s = stepFight(s, inputs.read()); });
  assert.equal(s.elapsedTicks, saved.elapsedTicks + 1);
});

test('G2 双指、双向控竿、键盘混合与取消不会串线或粘住', () => {
  const inputs = new FightInputs();
  inputs.pointerDown(1, 'left'); inputs.pointerDown(2, 'reel');
  assert.deepEqual(inputs.read(), { reel: true, rodAxis: -1 });
  inputs.pointerUp(1); assert.deepEqual(inputs.read(), { reel: true, rodAxis: 0 });
  inputs.keyDown('ArrowLeft', 'left'); inputs.pointerDown(3, 'right');
  assert.deepEqual(inputs.read(), { reel: true, rodAxis: 0 });
  inputs.pointerUp(3); inputs.pointerUp(2); assert.deepEqual(inputs.read(), { reel: false, rodAxis: -1 });
  inputs.keyUp('ArrowLeft'); inputs.toggle('reel'); assert.equal(inputs.read().reel, true);
  inputs.release('reel'); inputs.clear(); assert.deepEqual(inputs.read(), { reel: false, rodAxis: 0 });
});

test('G2 渲染嘴部与规则钩点在转向、下潜、靠岸时保持对齐', () => {
  const resources = new SceneResources(), fish = createPrototypeFish(resources);
  for (const heading of [{ x: 1, y: 0, z: 0 }, { x: -0.8, y: -0.6, z: 0 }, { x: 0.6, y: -0.48, z: 0.64 }]) {
    const s = createFight(); s.fishHeading = heading;
    toWorld(s.fishPosition, fish.group.position);
    fish.group.rotation.set(0, Math.atan2(heading.z, heading.x), Math.atan2(heading.y, Math.hypot(heading.x, heading.z)), 'YXZ');
    assert.ok(fish.mouthPosition(new Vector3()).distanceTo(toWorld(mouthPosition(s))) < 1e-8);
  }
  resources.dispose();
});
