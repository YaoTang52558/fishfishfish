import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tails } from '../src/catalog/fish.ts';
import { createFishDesign } from '../src/domain/fish.ts';
import { canonicalToScreen, canonicalToUv, fitFish, getEditorBounds, getFishGeometry, screenToCanonical } from '../src/domain/geometry.ts';
import { createId } from '../src/domain/id.ts';

const close = (a: number, b: number, epsilon = 1e-9) => Math.abs(a - b) < epsilon;
const extremes = () => tails.flatMap((tail) => [0.75, 1.4].flatMap((length) => [0.7, 1.3].flatMap((height) => [0.2, 0.4].map((headRatio) => {
  const design = createFishDesign(); design.shape = { length, height, headRatio }; design.parts.tailId = tail.id;
  return design;
}))));

test('screen input inverts the render transform for every extreme shape, viewport and facing', () => {
  for (const design of extremes()) {
    const axes = getFishGeometry(design).axes;
    for (const [width, height] of [[333, 245], [393, 380], [810, 380]] as const) for (const facing of [1, -1]) {
      const placement = { ...fitFish(getEditorBounds(design), width, height), facing };
      for (const point of [{ x: -0.5, y: -0.5 }, { x: 0.5, y: 0.5 }, { x: 0.13, y: -0.27 }, { x: -0.31, y: 0.08 }]) {
        const back = screenToCanonical(canonicalToScreen(point, placement, axes), placement, axes);
        assert.ok(close(back.x, point.x) && close(back.y, point.y), `${width}x${height} ${facing}`);
      }
    }
  }
  assert.throws(() => screenToCanonical({ x: 0, y: 0 }, { x: 0, y: 0, scale: 0 }, { x: 1, y: 0.6 }), RangeError);
});

test('a stroke keeps the same texture UV when the body is resized; only its screen position follows the body', () => {
  const placement = fitFish(getEditorBounds(createFishDesign()), 810, 380);
  const before = createFishDesign();
  const stroke = screenToCanonical({ x: placement.x + 40, y: placement.y - 25 }, placement, getFishGeometry(before).axes);
  const uv = canonicalToUv(stroke);
  assert.ok(uv.x >= 0 && uv.x <= 1 && uv.y >= 0 && uv.y <= 1);
  const after = createFishDesign(); after.shape = { length: 1.4, height: 1.3, headRatio: 0.4 };
  const axes = getFishGeometry(after).axes;
  const moved = canonicalToScreen(stroke, placement, axes);
  assert.ok(close(moved.x - placement.x, 40 * 1.4) && close(moved.y - placement.y, -25 * 1.3));
  assert.deepEqual(canonicalToUv(screenToCanonical(moved, placement, axes)).x.toFixed(9), uv.x.toFixed(9));
});

test('body canonical frame covers the whole texture; ids work without randomUUID', () => {
  assert.deepEqual(canonicalToUv({ x: -0.5, y: -0.5 }), { x: 0, y: 0 });
  assert.deepEqual(canonicalToUv({ x: 0.5, y: 0.5 }), { x: 1, y: 1 });
  const fallback = createId({ getRandomValues: (array: Uint8Array) => array.fill(171) } as unknown as Crypto);
  assert.match(fallback, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(createId(), createId());
});
