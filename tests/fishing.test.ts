import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  biteWindow, candidateWeights, createEncounter, createFishingState, fishingConfig, fishingReducer, stepEncounter, suggestAssist,
  type FightPattern, type FishingEvent, type FishingSpecies, type FishingState,
} from '../src/domain/fishing.ts';
import { seededRandom } from '../src/domain/fish.ts';
import { fixedSteps, SIM_STEP } from '../src/domain/swim.ts';

// 测试用占位物种（只在测试中使用，不进入玩家版本）。
const placeholder = (id: string, fightPattern: FightPattern, size: 'small' | 'large', bait: 'shrimp' | 'algae' | 'lure', habitatId: 'reef-edge' | 'coastal-rock' = 'reef-edge'): FishingSpecies => ({
  id, reviewStatus: 'placeholder',
  game: { habitatId, baseWeight: 1, size, fightPattern, baitWeights: { shrimp: 1, algae: 1, lure: 1, [bait]: 3 }, castWeights: { near: 1, middle: 1.2, far: 0.8 } },
});
const species = [placeholder('test-steady', 'steady', 'small', 'shrimp'), placeholder('test-burst', 'burst', 'large', 'lure'), placeholder('test-wave', 'wave', 'small', 'algae'), placeholder('other-habitat', 'steady', 'small', 'shrimp', 'coastal-rock')];
const reduce = (state: FishingState, event: FishingEvent) => fishingReducer(state, event, species, 'reef-edge', true);
const cast = (state: FishingState, seed = 7): FishingState => reduce(state, { type: 'cast', spot: 'middle', bait: 'shrimp', attemptId: `a-${seed}`, seed });
const run = (state: FishingState, seconds: number) => { for (let t = 0; t < seconds - 1e-9; t += SIM_STEP) state = reduce(state, { type: 'tick', dt: SIM_STEP }); return state; };
const toBite = (seed = 7, assist = false) => { let s = cast(createFishingState(1, assist), seed); s = run(s, fishingConfig.castSeconds); return run(s, s.waitDuration); };

test('illegal events leave the state untouched (A14)', () => {
  const setup = createFishingState(1);
  for (const event of [{ type: 'pull' }, { type: 'reel', on: true }, { type: 'release' }, { type: 'retry', clueSeed: 2 }] as FishingEvent[]) assert.equal(reduce(setup, event), setup);
  const casting = cast(setup);
  assert.equal(casting.phase, 'casting');
  assert.equal(reduce(casting, { type: 'cast', spot: 'far', bait: 'lure', attemptId: 'x', seed: 9 }), casting, 'no second cast');
  assert.equal(reduce(casting, { type: 'pull' }), casting, 'pull while casting ignored');
  assert.equal(reduce(casting, { type: 'release' }), casting);
});

test('pulling before the bite is an empty hook; inside the window hooks; after it the fish leaves', () => {
  let s = run(cast(createFishingState(1)), fishingConfig.castSeconds);
  assert.equal(s.phase, 'waiting');
  assert.ok(s.waitDuration >= 3 && s.waitDuration <= 8);
  const early = reduce(s, { type: 'pull' });
  assert.deepEqual([early.phase, early.escape], ['escaped', 'early']);
  const bite = toBite();
  assert.equal(bite.phase, 'bite');
  assert.equal(reduce(run(bite, 2.4), { type: 'pull' }).phase, 'fighting');
  const missed = run(bite, 2.55);
  assert.deepEqual([missed.phase, missed.escape], ['escaped', 'missed']);
  const assisted = toBite(7, true);
  assert.equal(biteWindow(true), 5);
  assert.equal(reduce(run(assisted, 4.9), { type: 'pull' }).phase, 'fighting', 'assist window is 5 s');
  assert.equal(reduce(missed, { type: 'retry', clueSeed: 3 }).phase, 'setup');
});

test('sampling uses only this habitat, normalizes weights, and is reproducible from the seed', () => {
  const weights = candidateWeights(species, 'reef-edge', 'shrimp', 'near', 'bubbles', true);
  assert.deepEqual(weights.map((w) => w.id).sort(), ['test-burst', 'test-steady', 'test-wave']);
  assert.ok(Math.abs(weights.reduce((s, w) => s + w.probability, 0) - 1) < 1e-12);
  assert.ok(weights.find((w) => w.id === 'test-steady')!.probability > weights.find((w) => w.id === 'test-burst')!.probability, 'bait and bubbles favour the small shrimp eater');
  assert.deepEqual(candidateWeights(species, 'reef-edge', 'shrimp', 'near', 'calm', false), [], 'placeholders are not used for players');
  const a = cast(createFishingState(1), 42), b = cast(createFishingState(1), 42);
  assert.deepEqual([a.speciesId, a.waitDuration, a.fight], [b.speciesId, b.waitDuration, b.fight]);
  const counts = new Map<string, number>();
  for (let seed = 1; seed <= 3000; seed += 1) { const id = cast(createFishingState(1), seed).speciesId!; counts.set(id, (counts.get(id) ?? 0) + 1); }
  const expected = candidateWeights(species, 'reef-edge', 'shrimp', 'middle', createFishingState(1).clues.middle, true);
  for (const { id, probability } of expected) assert.ok(Math.abs(counts.get(id)! / 3000 - probability) < 0.04, id);
  assert.equal(fishingReducer(createFishingState(1), { type: 'cast', spot: 'near', bait: 'shrimp', attemptId: 'z', seed: 1 }, [], 'reef-edge').error, 'no-candidates');
});

/** 模拟一名会看张力的玩家：太松就收线，偏紧就松开。每帧决定一次输入，像真实界面一样。 */
function playFight(seed: number, fps: number, assist = false, pattern?: FightPattern) {
  const pool = pattern ? species.filter((s) => s.game.fightPattern === pattern) : species;
  let s = reduce(toBite(seed, assist), { type: 'pull' });
  if (pattern) s = { ...s, fight: { ...s.fight, pattern } };
  void pool;
  let accumulator = 0, elapsed = 0;
  while (s.phase === 'fighting' && elapsed < 60) {
    const want = s.fight.tension < 0.5;
    if (want !== s.fight.reeling) s = reduce(s, { type: 'reel', on: want });
    const steps = fixedSteps(accumulator, 1 / fps);
    accumulator = steps.accumulator; elapsed += 1 / fps;
    for (let i = 0; i < steps.steps; i += 1) s = reduce(s, { type: 'tick', dt: SIM_STEP });
  }
  return s;
}

test('fixed steps: the same seed and input timeline give the same result at 30/60/120 fps (A15)', () => {
  // 输入在 1/30 秒的整数倍时刻切换，三种帧率都在同一模拟步收到输入。
  const timeline = (fps: number) => {
    let s = reduce(toBite(11), { type: 'pull' }), accumulator = 0, frame = 0;
    while (s.phase === 'fighting' && frame < fps * 60) {
      const t = frame / fps;
      const on = Math.floor(t * 30) % 30 < 12;
      if (on !== s.fight.reeling && Math.abs(t * 30 - Math.round(t * 30)) < 1e-9) s = reduce(s, { type: 'reel', on });
      const steps = fixedSteps(accumulator, 1 / fps); accumulator = steps.accumulator; frame += 1;
      for (let i = 0; i < steps.steps; i += 1) s = reduce(s, { type: 'tick', dt: SIM_STEP });
    }
    return s;
  };
  const [a, b, c] = [timeline(30), timeline(60), timeline(120)];
  assert.equal(a.phase, b.phase); assert.equal(b.phase, c.phase);
  assert.ok(Math.abs(a.fight.time - b.fight.time) <= SIM_STEP + 1e-9 && Math.abs(b.fight.time - c.fight.time) <= SIM_STEP + 1e-9);
  // 看张力的玩家在不同帧率下也得到相同结果，耗时相差不超过一帧。
  for (const seed of [3, 5, 8]) {
    const [x, y] = [playFight(seed, 30), playFight(seed, 120)];
    assert.equal(x.phase, y.phase);
    assert.ok(Math.abs(x.fight.time - y.fight.time) <= 1 / 30 + SIM_STEP, `seed ${seed}`);
  }
});

test('a careful player lands every fight pattern in roughly 15–30 s; assist is easier, rewards unchanged', () => {
  for (const pattern of ['steady', 'burst', 'wave'] as const) {
    const times: number[] = [];
    let caught = 0;
    for (let seed = 1; seed <= 40; seed += 1) { const s = playFight(seed, 60, false, pattern); if (s.phase === 'caught') { caught += 1; times.push(s.fight.time); } }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)]!;
    assert.ok(caught >= 38, `${pattern} caught ${caught}/40`);
    assert.ok(median >= 15 && median <= 30, `${pattern} median ${median.toFixed(1)} s`);
    const assisted = playFight(9, 60, true, pattern);
    assert.equal(assisted.phase, 'caught');
    assert.equal(assisted.speciesId, playFight(9, 60, false, pattern).speciesId, 'assist does not change which fish bites');
  }
});

test('holding the line too tight breaks it after 1.2 s (2 s with assist); doing nothing times out at 45 s', () => {
  const hold = (assist: boolean) => {
    let s = reduce(reduce(toBite(4, assist), { type: 'pull' }), { type: 'reel', on: true });
    let tight = 0;
    while (s.phase === 'fighting') { s = reduce(s, { type: 'tick', dt: SIM_STEP }); if (s.fight.tension >= 0.98) tight += SIM_STEP; }
    return { s, tight };
  };
  const normal = hold(false), assisted = hold(true);
  assert.deepEqual([normal.s.phase, normal.s.escape], ['escaped', 'break']);
  assert.ok(Math.abs(normal.tight - 1.2) < 0.05);
  assert.ok(Math.abs(assisted.tight - 2) < 0.05);
  let idle = reduce(toBite(4), { type: 'pull' });
  idle = run(idle, 46);
  assert.deepEqual([idle.phase, idle.escape], ['escaped', 'timeout']);
  assert.equal(idle.fight.progress, 0, 'low tension only lowers progress');
});

test('two failures in a row suggest assist mode; a catch resets the streak (A17)', () => {
  let s = createFishingState(1);
  for (let i = 0; i < 2; i += 1) { s = reduce(run(cast(s, 20 + i), fishingConfig.castSeconds), { type: 'pull' }); s = reduce(s, { type: 'retry', clueSeed: i }); }
  assert.equal(s.failStreak, 2);
  assert.equal(suggestAssist(s), true);
  s = reduce(s, { type: 'setAssist', on: true });
  assert.equal(suggestAssist(s), false);
  const won = playFight(9, 60, true);
  assert.equal(won.phase, 'caught');
  assert.equal(won.failStreak, 0);
  const cancelled = reduce(reduce(toBite(), { type: 'pull' }), { type: 'cancel' });
  assert.equal(cancelled.phase, 'setup', 'leaving cancels the round without recording it');
});

test('original-fish encounters use their own random stream and never change which species bite (A19)', () => {
  const speciesSequence = (withFish: boolean) => {
    const random = seededRandom(99);
    let encounter = createEncounter(), s = createFishingState(1);
    const results: string[] = [];
    for (let round = 0; round < 20; round += 1) {
      s = cast(s, 500 + round);
      results.push(s.speciesId!);
      for (let t = 0; t < 12; t += 0.5) encounter = stepEncounter(encounter, s, 0.5, withFish ? ['fish-1'] : [], random);
      s = reduce(reduce(run(s, fishingConfig.castSeconds), { type: 'pull' }), { type: 'retry', clueSeed: round });
    }
    return results;
  };
  assert.deepEqual(speciesSequence(true), speciesSequence(false));
  let scheduled = 0;
  for (let seed = 1; seed <= 2000; seed += 1) {
    const e = stepEncounter(createEncounter(), createFishingState(1), 10, ['a', 'b'], seededRandom(seed));
    if (e.scheduled) scheduled += 1;
  }
  assert.ok(Math.abs(scheduled / 2000 - 0.2) < 0.03, `rate ${scheduled / 2000}`);
  // 搏鱼中不出现，回到安全时段才出现；最多一次。
  const random = () => 0.01;
  let e = stepEncounter(createEncounter(), reduce(toBite(), { type: 'pull' }), 10, ['a'], random);
  assert.deepEqual([e.scheduled, e.shown], [true, false]);
  e = stepEncounter(e, createFishingState(1), 0.1, ['a'], random);
  assert.equal(e.shown, true);
  assert.equal(stepEncounter(e, createFishingState(1), 10, ['a'], random), e);
  assert.equal(stepEncounter(createEncounter(), createFishingState(1), 10, [], random).scheduled, false, 'no original fish → nothing');
});
