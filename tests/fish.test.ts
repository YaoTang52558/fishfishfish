import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bodies, eyes, finSets, heads, mouths, palette, patterns, shapeLimits, stampLimits, tails, validateCatalog } from '../src/catalog/fish.ts';
import {
  addStamp, changeColor, changePart, changePattern, changePatternDetail, changeShape, createFishDesign, randomizeDesign, removeStamp, resetShape,
  updateStamp, validateFishDesign,
} from '../src/domain/fish.ts';
import { bodyOutline, getEditorBounds, getFishGeometry, hitRegion, pointInPolygon } from '../src/domain/geometry.ts';
import type { FishDesign, Point, Stamp } from '../src/domain/types.ts';

const shapes = [shapeLimits.length.min, shapeLimits.length.max].flatMap((length) => [shapeLimits.height.min, shapeLimits.height.max]
  .flatMap((height) => [shapeLimits.headRatio.min, shapeLimits.headRatio.max].map((headRatio) => ({ length, height, headRatio }))));
const withParts = (patch: Partial<FishDesign['parts']> & { bodyId?: string }, shape = { length: 1, height: 1, headRatio: 0.3 }): FishDesign => {
  const design = createFishDesign();
  const { bodyId, ...parts } = patch;
  return { ...design, bodyId: bodyId ?? design.bodyId, parts: { ...design.parts, ...parts }, shape };
};
function distanceToPolyline(point: Point, polygon: readonly Point[]) {
  let best = Infinity;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!;
    const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0;
    best = Math.min(best, Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy)));
  }
  return best;
}
const stamp = (id: string, patch: Partial<Stamp> = {}): Stamp => ({ id, kind: 'heart', color: '#EDBCD0', u: 0.4, v: 0.5, scale: 0.12, rotation: 0, ...patch });

test('catalog covers the P0 part counts and every default document is valid and independent', () => {
  assert.deepEqual(validateCatalog(), []);
  assert.deepEqual([bodies.length, heads.length, tails.length, finSets.length, eyes.length, mouths.length, patterns.length - 1, palette.length], [5, 5, 6, 6, 5, 5, 13, 12]);
  const first = createFishDesign(), second = createFishDesign();
  first.shape.length = 1.4;
  assert.equal(second.shape.length, 1);
  assert.equal(validateFishDesign(first).ok, true);
  assert.equal(new Set(tails.map((tail) => tail.animationProfile.thrust)).size, tails.length, 'each tail swims differently');
});

test('invalid numbers, unknown parts, colors, patterns, assets and stamps are rejected', () => {
  for (const value of [NaN, Infinity, -Infinity, 0.749, 1.401]) {
    assert.throws(() => changeShape(createFishDesign(), 'length', value), RangeError);
    const design = createFishDesign(); design.shape.length = value;
    assert.equal(validateFishDesign(design).ok, false);
  }
  for (const key of ['bodyId', 'headId', 'tailId', 'finId', 'eyeId', 'mouthId'] as const) {
    assert.throws(() => changePart(createFishDesign(), key, 'missing'), RangeError);
    const design = createFishDesign() as unknown as Record<string, unknown> & { parts: Record<string, unknown> };
    if (key === 'bodyId') design.bodyId = 'missing'; else design.parts[key] = 'missing';
    assert.equal(validateFishDesign(design).ok, false, key);
  }
  assert.throws(() => changeColor(createFishDesign(), 'body', '#123456'), RangeError);
  assert.throws(() => changePattern(createFishDesign(), 'plaid'), RangeError);
  const color = createFishDesign(); color.colors.body = 'url(https://example.com)';
  assert.equal(validateFishDesign(color).ok, false);
  assert.equal(validateFishDesign({}).ok, false);
  assert.equal(validateFishDesign(null).ok, false);
  assert.equal(validateFishDesign({ ...createFishDesign(), schemaVersion: 2 }).ok, false);
  const asset = createFishDesign(); asset.paint.glowAssetId = 'https://example.com/a.png';
  assert.equal(validateFishDesign(asset).ok, false);
  for (const bad of [{ u: 1.2 }, { scale: 0.5 }, { kind: 'skull' }, { color: '#000000' }, { rotation: Infinity }, { id: '' }]) {
    const design = createFishDesign(); design.stamps = [stamp('s1', bad as Partial<Stamp>)];
    assert.equal(validateFishDesign(design).ok, false, JSON.stringify(bad));
  }
  const duplicate = createFishDesign(); duplicate.stamps = [stamp('same'), stamp('same')];
  assert.equal(validateFishDesign(duplicate).ok, false);
  const many = createFishDesign(); many.stamps = Array.from({ length: 25 }, (_, i) => stamp(`s${i}`));
  assert.equal(validateFishDesign(many).ok, false);
});

test('validation removes unknown fields and detaches mutable objects', () => {
  const design = createFishDesign(); design.stamps = [stamp('keep')];
  const result = validateFishDesign({ ...design, injected: 'extra', stamps: [{ ...stamp('keep'), extra: 1 }] });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal('injected' in result.value, false);
  assert.equal('extra' in result.value.stamps[0]!, false);
  result.value.shape.height = 1.3;
  assert.equal(design.shape.height, 1);
});

test('adjustable patterns survive document validation while old documents retain their shape', () => {
  const old = createFishDesign();
  assert.deepEqual(validateFishDesign(old), { ok: true, value: old });
  for (const id of ['clown-bands', 'grouper-spots', 'honeycomb']) {
    const changed = changePatternDetail(changePatternDetail(changePattern(old, id), 'size', 1.3), 'density', 0.8);
    assert.deepEqual(validateFishDesign(JSON.parse(JSON.stringify(changed))), { ok: true, value: changed });
  }
  for (const key of ['size', 'density'] as const) for (const value of [NaN, Infinity, 0, 2, '1', null]) {
    assert.equal(validateFishDesign({ ...old, pattern: { ...old.pattern, [key]: value } }).ok, false);
    if (typeof value === 'number') assert.throws(() => changePatternDetail(old, key, value), RangeError);
  }
  assert.equal('size' in old.pattern, false);
});

test('reset restores only proportions, retaining parts, colors, stamps and paint references', () => {
  const original = createFishDesign(); original.paint.colorAssetId = 'saved-color'; original.stamps = [stamp('a')];
  const changed = changePart(changeShape(original, 'headRatio', 0.4), 'tailId', 'ribbon');
  assert.equal(original.parts.tailId, 'fork');
  const reset = resetShape(changed);
  assert.deepEqual(reset.shape, { length: 1, height: 1, headRatio: 0.3 });
  assert.equal(reset.parts.tailId, 'ribbon');
  assert.equal(reset.paint.colorAssetId, 'saved-color');
  assert.deepEqual(reset.stamps, original.stamps);
});

test('every body × head joins at the neck without a step or kink, inside the canonical box, at all shape extremes', () => {
  for (const body of bodies) for (const head of heads) for (const shape of shapes) {
    const outline = bodyOutline(body, head, shape.headRatio);
    assert.ok(Math.abs(outline.headTop(0) - outline.trunkTop(1)) < 1e-9 && Math.abs(outline.headBottom(0) - outline.trunkBottom(1)) < 1e-9, `${body.id}/${head.id} position`);
    const h = 1e-4;
    const headSlopeTop = (outline.headTop(h) - outline.headTop(0)) / (h * outline.headLength);
    const headSlopeBottom = (outline.headBottom(h) - outline.headBottom(0)) / (h * outline.headLength);
    assert.ok(Math.abs(headSlopeTop - outline.slopeTop) < 0.02 && Math.abs(headSlopeBottom - outline.slopeBottom) < 0.02, `${body.id}/${head.id} tangent`);
    const geometry = getFishGeometry(withParts({ bodyId: body.id, headId: head.id }, shape));
    for (const p of geometry.canonicalContour) assert.ok(p.x >= -0.5 - 1e-9 && p.x <= 0.5 + 1e-9 && p.y >= -0.5 && p.y <= 0.5, `${body.id}/${head.id} box`);
    const half = geometry.canonicalContour.length;
    assert.ok(half > 100);
  }
});

test('eyes stay inside the head region and mouths sit on the head outline for every body × head × shape', () => {
  for (const body of bodies) for (const head of heads) for (const shape of shapes) {
    for (const eye of eyes) {
      const g = getFishGeometry(withParts({ bodyId: body.id, headId: head.id, eyeId: eye.id }, shape));
      const { center, radius } = g.eye;
      assert.ok(radius > 0.004, `${body.id}/${head.id}/${eye.id} visible`);
      assert.ok(pointInPolygon(center, g.head), `${body.id}/${head.id}/${eye.id} in head`);
      for (let k = 0; k < 12; k += 1) {
        const a = k * Math.PI / 6;
        assert.ok(pointInPolygon({ x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius }, g.contour), `${body.id}/${head.id}/${eye.id} inside outline`);
      }
    }
    for (const mouth of mouths) {
      const g = getFishGeometry(withParts({ bodyId: body.id, headId: head.id, mouthId: mouth.id }, shape));
      assert.ok(distanceToPolyline(g.mouth.anchor, g.contour) < 0.003, `${body.id}/${head.id}/${mouth.id} on outline`);
      assert.ok(g.mouth.anchor.x > g.neck.x, `${body.id}/${head.id}/${mouth.id} on head`);
    }
  }
});

test('every tail root matches the peduncle and every fin base hugs the outline', () => {
  for (const body of bodies) for (const shape of shapes) {
    for (const tail of tails) {
      const g = getFishGeometry(withParts({ bodyId: body.id, tailId: tail.id }, shape));
      const first = g.tail.polygon[0]!, last = g.tail.polygon[g.tail.polygon.length - 1]!;
      assert.ok(Math.abs(first.y + g.peduncle.height / 2) < 1e-9 && Math.abs(last.y - g.peduncle.height / 2) < 1e-9, `${body.id}/${tail.id} root height`);
      assert.ok(first.x >= 0 && last.x >= 0, 'root overlaps into the body');
      const top = g.contour[0]!, bottom = g.contour[g.contour.length - 1]!;
      assert.ok(Math.abs(top.y - (g.peduncle.center - g.peduncle.height / 2)) < 1e-9 && Math.abs(bottom.y - (g.peduncle.center + g.peduncle.height / 2)) < 1e-9, `${body.id} peduncle on outline`);
      assert.ok(g.tail.size >= 0.13 && g.tail.size <= 0.46);
    }
    for (const set of finSets) {
      const g = getFishGeometry(withParts({ bodyId: body.id, finId: set.id }, shape));
      assert.equal(g.fins.length, set.fins.length);
      for (const fin of g.fins) {
        const n = 19, inset = fin.polygon.slice(0, n);
        // 鳍根在轮廓之内（被身体盖住），鳍面伸出轮廓之外。
        assert.ok(inset.every((p) => pointInPolygon(p, g.contour) || distanceToPolyline(p, g.contour) < 0.004), `${body.id}/${set.id} base`);
        const outside = fin.polygon.slice(n).filter((p) => !pointInPolygon(p, g.contour)).length;
        assert.ok(outside >= (fin.polygon.length - n) * 0.5, `${body.id}/${set.id} visible`);
      }
      assert.ok(pointInPolygon(g.pectoral.pivot, g.contour), `${body.id}/${set.id} pectoral`);
    }
  }
});

test('all 22,500 part combinations build finite geometry; the editor camera holds every shape of the chosen parts', () => {
  let count = 0;
  for (const body of bodies) for (const head of heads) for (const tail of tails) for (const fin of finSets) for (const eye of eyes) for (const mouth of mouths) {
    const g = getFishGeometry(withParts({ bodyId: body.id, headId: head.id, tailId: tail.id, finId: fin.id, eyeId: eye.id, mouthId: mouth.id }));
    assert.ok(Object.values(g.bounds).every(Number.isFinite) && g.bounds.maxX > g.bounds.minX && g.bounds.maxY > g.bounds.minY);
    count += 1;
  }
  assert.equal(count, 22500);
  for (let index = 0; index < 200; index += 1) {
    const design = randomizeDesign(createFishDesign(), index + 1);
    const camera = getEditorBounds(design);
    for (const shape of [...shapes, design.shape]) {
      const b = getFishGeometry({ ...design, shape }).bounds;
      assert.ok(b.minX >= camera.minX - 1e-9 && b.maxX <= camera.maxX + 1e-9 && b.minY >= camera.minY - 1e-9 && b.maxY <= camera.maxY + 1e-9, `seed ${index + 1}`);
    }
  }
});

test('region hit testing distinguishes head, body, fin and tail for base-color filling', () => {
  for (const body of bodies) {
    const g = getFishGeometry(withParts({ bodyId: body.id }));
    const tip = g.contour.reduce((best, p) => p.x > best.x ? p : best);
    assert.equal(hitRegion(g, { x: tip.x - 0.03, y: tip.y }), 'head', body.id);
    assert.equal(hitRegion(g, { x: -0.18 * g.axes.x, y: g.peduncle.center * 0.3 }), 'body', body.id);
    const fin = g.fins[0]!.polygon, outer = fin[Math.round(fin.length * 0.75)]!;
    const inset = fin[Math.round(fin.length * 0.25)]!;
    assert.equal(hitRegion(g, { x: (outer.x * 3 + inset.x) / 4, y: (outer.y * 3 + inset.y) / 4 }), 'fin', body.id);
    assert.equal(hitRegion(g, { x: g.tail.pivot.x - g.tail.size * 0.15, y: g.tail.pivot.y }), 'tail', body.id);
    assert.equal(hitRegion(g, { x: 5, y: 5 }), null);
  }
});

test('stamps: 24 limit, clamped adjustments and removal never touch other stamps', () => {
  let design = createFishDesign();
  for (let i = 0; i < stampLimits.max; i += 1) design = addStamp(design, stamp(`s${i}`))!;
  assert.equal(design.stamps.length, 24);
  assert.equal(addStamp(design, stamp('extra')), null);
  assert.throws(() => addStamp(createFishDesign(), stamp('bad', { kind: 'skull' })), RangeError);
  const moved = updateStamp(design, 's3', { u: 2, scale: 1, rotation: Math.PI * 3 });
  const s3 = moved.stamps.find((item) => item.id === 's3')!;
  assert.deepEqual([s3.u, s3.scale], [1, stampLimits.scale.max]);
  assert.ok(Math.abs(Math.abs(s3.rotation) - Math.PI) < 1e-9);
  assert.deepEqual(moved.stamps.filter((item) => item.id !== 's3'), design.stamps.filter((item) => item.id !== 's3'));
  assert.equal(removeStamp(moved, 's3').stamps.length, 23);
  assert.equal(design.stamps.find((item) => item.id === 's3')!.u, 0.4, 'input not mutated');
});

test('random designs are reproducible, valid, and keep paint and stamps without mutating the input', () => {
  const original = createFishDesign(); original.paint.colorAssetId = 'paint-1'; original.stamps = [stamp('keep')];
  const snapshot = JSON.stringify(original);
  const a = randomizeDesign(original, 42), b = randomizeDesign(original, 42), c = randomizeDesign(original, 43);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(JSON.stringify(original), snapshot);
  for (let seed = 1; seed <= 300; seed += 1) {
    const design = randomizeDesign(original, seed);
    assert.equal(validateFishDesign(design).ok, true, `seed ${seed}`);
    assert.equal(design.paint.colorAssetId, 'paint-1');
    assert.deepEqual(design.stamps, original.stamps);
  }
});
