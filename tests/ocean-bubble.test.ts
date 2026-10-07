import assert from 'node:assert/strict';
import { test } from 'node:test';
import { changeShape, changeTail, createFishDesign } from '../src/domain/fish.ts';
import { getFishGeometry } from '../src/domain/geometry.ts';
import { getSwimProfile, swimFacing } from '../src/domain/swim.ts';
import { followBubble } from '../src/features/ocean/bubblePlay.ts';
import { createOceanFish, oceanPosition, stepOceanFish } from '../src/features/ocean/sim.ts';

test('bubble following reaches points ahead, behind, above and nearby with gradual turns', () => {
  const tank = { halfWidth: 5, halfHeight: 2.7 };
  for (const design of [createFishDesign(), changeTail(createFishDesign(), 'fan'), changeShape(createFishDesign(), 'length', 1.4)]) {
    for (const target of [{ x: 2, y: -.8 }, { x: -2, y: 1 }, { x: .2, y: .1 }, { x: -.2, y: -.1 }]) {
      let fish = createOceanFish('play', getSwimProfile(design), design.shape.length, tank, 11);
      fish = { ...fish, y: 0, swim: { ...fish.swim, x: 0, heading: 1, turn: null } };
      const original = structuredClone({ swim: fish.swim, y: fish.y });
      let arrived = false, previousFacing = 1;
      for (let i = 0; i < 60 * 15 && !arrived; i++) {
        const result = followBubble(fish, target, getFishGeometry(design).mouth.anchor, tank);
        const facing = swimFacing(result.fish.swim);
        assert.ok(Math.abs(facing - previousFacing) < .2, 'no instant flip'); previousFacing = facing;
        assert.ok(Math.abs(oceanPosition(result.fish).x) <= tank.halfWidth); assert.ok(Math.abs(result.fish.y) <= tank.halfHeight);
        if (i === 0) assert.deepEqual({ swim: fish.swim, y: fish.y }, original, 'input simulation is not mutated');
        fish = result.fish; arrived = result.arrived;
      }
      assert.ok(arrived, `${JSON.stringify(target)} with ${design.parts.tailId}/${design.shape.length}`);
      const cruising = stepOceanFish(fish, tank); assert.ok(Number.isFinite(oceanPosition(cruising).x));
    }
  }
});

test('repeated targets and rotation keep the transient fish within the tank', () => {
  const design = createFishDesign(), mouth = getFishGeometry(design).mouth.anchor;
  let tank = { halfWidth: 5, halfHeight: 3 }, fish = createOceanFish('play', getSwimProfile(design), 1, tank, 7);
  for (let i = 0; i < 2400; i++) {
    if (i === 1200) tank = { halfWidth: 5, halfHeight: 1.8 };
    const target = { x: Math.sin(i / 100) * 3.5, y: Math.cos(i / 100) * tank.halfHeight * .35 };
    fish = followBubble(fish, target, mouth, tank).fish;
    const pos = oceanPosition(fish);
    assert.ok(Number.isFinite(pos.x) && Number.isFinite(pos.y)); assert.ok(Math.abs(pos.x) <= 5 && Math.abs(pos.y) <= tank.halfHeight);
  }
});
