import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tails } from '../src/catalog/fish.ts';
import { addStamp, changeColor, changePart, changePattern, createFishDesign, randomizeDesign } from '../src/domain/fish.ts';
import { defaultName, describeSwim, displayedEffect, recommendPersonality, satisfiedEffects, validateName, VISIBLE_GLOW_PIXELS } from '../src/domain/rules.ts';
import { getSwimProfile } from '../src/domain/swim.ts';
import { createOceanFish, oceanMode, oceanPosition, stepOceanFish } from '../src/features/ocean/sim.ts';

test('changing only the tail changes the explained swim style (A07)', () => {
  const styles = new Map(tails.map((tail) => [tail.id, describeSwim(changePart(createFishDesign(), 'tailId', tail.id)).style.id]));
  assert.equal(styles.get('lunate'), 'dash');
  assert.equal(styles.get('fork'), 'dash');
  assert.equal(styles.get('fan'), 'calm');
  assert.equal(styles.get('ribbon'), 'calm');
  const agile = describeSwim(changePart(changePart(createFishDesign(), 'tailId', 'fan'), 'finId', 'nub'));
  assert.equal(agile.style.id, 'agile', 'fins change turning, so a slow tail with nimble fins is agile');
  for (const tail of tails) assert.ok(describeSwim(changePart(createFishDesign(), 'tailId', tail.id)).style.explanation.length > 5);
});

test('personality recommendation is reproducible and ignores colors', () => {
  for (let seed = 1; seed <= 100; seed += 1) {
    const design = randomizeDesign(createFishDesign(), seed);
    assert.equal(recommendPersonality(design), recommendPersonality(structuredClone(design)));
    assert.equal(recommendPersonality(changeColor(design, 'body', '#B3A0B7')), recommendPersonality(design));
  }
  assert.equal(recommendPersonality(changePart(createFishDesign(), 'tailId', 'lunate')), 'lively');
  assert.equal(recommendPersonality(changePart(createFishDesign(), 'tailId', 'ribbon')), 'relaxed');
});

test('names: trimmed, 1–16 visible characters, no control characters', () => {
  assert.deepEqual(validateName('  泡泡  '), { ok: true, value: '泡泡' });
  assert.equal(validateName('一二三四五六七八九十一二三四五六').ok, true);
  assert.equal(validateName('一二三四五六七八九十一二三四五六七').ok, false);
  assert.equal(validateName('   ').ok, false);
  assert.equal(validateName('a\u0007b').ok, false);
  assert.equal(validateName('🐟🐠').ok, true);
  assert.equal(validateName('<b>鱼</b>').ok, true, 'markup is kept as plain text, never rendered as HTML');
  assert.ok([...defaultName(createFishDesign())].length <= 16);
});

test('easter eggs follow fixed priority, require visible glow, and removing a condition removes only the display (A08)', () => {
  let design = changeColor(changePart(createFishDesign(), 'eyeId', 'big'), 'body', '#24486B');
  design = changePattern(changePart(design, 'tailId', 'ribbon'), 'waves');
  design = changePart(design, 'bodyId', 'round');
  design = addStamp(design, { id: 'b1', kind: 'bubble', color: '#8AAFB0', u: 0.5, v: 0.5, scale: 0.1, rotation: 0 })!;
  assert.deepEqual(satisfiedEffects(design, VISIBLE_GLOW_PIXELS), ['starry', 'ribbon', 'bubbles']);
  assert.equal(displayedEffect(satisfiedEffects(design, VISIBLE_GLOW_PIXELS), true), 'starry');
  assert.deepEqual(satisfiedEffects(design, VISIBLE_GLOW_PIXELS - 1), ['ribbon', 'bubbles'], 'glow must be visible');
  assert.equal(displayedEffect(satisfiedEffects(design, 999), false), null, 'effect can be switched off');
  const noWaves = changePattern(design, 'spots');
  assert.deepEqual(satisfiedEffects(noWaves, 0), ['bubbles']);
  assert.deepEqual(noWaves.stamps, design.stamps, 'rules never alter the design');
  assert.deepEqual(satisfiedEffects(createFishDesign(), 1000), []);
});

test('ocean fish cruise, idle and turn while staying inside the tank', () => {
  const tank = { halfWidth: 6, halfHeight: 3.4 };
  for (let n = 0; n < 12; n += 1) {
    const design = randomizeDesign(createFishDesign(), n + 11);
    let fish = createOceanFish(`f${n}`, getSwimProfile(design), design.shape.length, tank, n * 97 + 3);
    const seen = new Set<string>();
    for (let step = 0; step < 60 * 90; step += 1) {
      fish = stepOceanFish(fish, tank);
      seen.add(oceanMode(fish));
      const p = oceanPosition(fish);
      assert.ok(Math.abs(p.x) <= tank.halfWidth + 1e-6, `x=${p.x}`);
      assert.ok(Math.abs(p.y) <= tank.halfHeight, `y=${p.y}`);
    }
    assert.deepEqual([...seen].sort(), ['cruise', 'idle', 'turn'], `fish ${n}`);
  }
});
