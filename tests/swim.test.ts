import assert from 'node:assert/strict';
import { test } from 'node:test';
import { changeShape, changeTail, createFishDesign } from '../src/domain/fish.ts';
import { createSwimState, fixedSteps, getSwimProfile, MAX_STEPS_PER_FRAME, SIM_STEP, stepSwim, swimFacing, tailAngle } from '../src/domain/swim.ts';

test('changing only the tail gives a visibly different swim profile within design ranges', () => {
  const fork = getSwimProfile(createFishDesign());
  const fan = getSwimProfile(changeTail(createFishDesign(), 'fan'));
  assert.ok(fork.speed > fan.speed + 0.3);
  assert.ok(fan.tailAmplitude > fork.tailAmplitude);
  for (const profile of [fork, fan, getSwimProfile(changeShape(createFishDesign(), 'height', 1.3))]) {
    assert.ok(profile.speed >= 0.4 && profile.speed <= 1.5);
    assert.ok(profile.turnRate >= 0.5 && profile.turnRate <= 1.8);
    assert.ok(profile.tailFrequency >= 1.5 && profile.tailFrequency <= 3);
    assert.ok(profile.tailAmplitude >= 0.08 && profile.tailAmplitude <= 0.3);
  }
});

test('the trial fish stays inside the tank, turns gradually and never flips instantly', () => {
  for (const design of [createFishDesign(), changeTail(createFishDesign(), 'fan'), changeShape(createFishDesign(), 'length', 1.4)]) {
    const profile = getSwimProfile(design);
    let state = createSwimState(), turns = 0, previousFacing = 1;
    for (let index = 0; index < 60 * 60; index += 1) {
      const next = stepSwim(state, profile, 2);
      if (next.heading !== state.heading) turns += 1;
      state = next;
      const facing = swimFacing(state);
      assert.ok(Math.abs(state.x) <= 2 + 1e-9, `x=${state.x}`);
      assert.ok(Math.abs(facing) >= 0.08 && Math.abs(facing) <= 1);
      assert.ok(Math.abs(facing - previousFacing) < 0.2, 'facing changes smoothly');
      assert.ok(Math.abs(tailAngle(state, profile)) <= profile.tailAmplitude + 1e-12);
      previousFacing = facing;
    }
    assert.ok(turns >= 4, `turns=${turns}`);
  }
});

test('fixed steps give the same simulation at 30/60/120 fps and drop backlog beyond five steps', () => {
  for (const fps of [30, 60, 120]) {
    let accumulator = 0, steps = 0;
    for (let frame = 0; frame < fps * 10; frame += 1) { const result = fixedSteps(accumulator, 1 / fps); accumulator = result.accumulator; steps += result.steps; }
    assert.ok(Math.abs(steps - 600) <= 1, `${fps}fps → ${steps}`);
  }
  assert.deepEqual(fixedSteps(0, 1), { steps: MAX_STEPS_PER_FRAME, accumulator: 0 });
  assert.equal(fixedSteps(0, -1).steps, 0);
  assert.equal(fixedSteps(0, NaN).steps, 0);
  assert.equal(fixedSteps(0, SIM_STEP).steps, 1);
});
