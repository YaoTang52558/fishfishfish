import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { SceneResources } from '../src/rendering/fishing3d/resources.ts';
import { createPrototypeFish } from '../src/rendering/fishing3d/fish.ts';
import { createFishingWorld } from '../src/rendering/fishing3d/world.ts';
import { FishingCameras } from '../src/rendering/fishing3d/cameras.ts';
import { SceneClock } from '../src/features/fishing3d/clock.ts';

test('3D 场景时间不受渲染帧率影响，后台恢复不追赶流逝时间', () => {
  const clocks = [30, 60, 120].map((fps) => {
    const clock = new SceneClock();
    for (let i = 0; i <= fps * 10; i++) clock.tick(i * 1000 / fps);
    return clock;
  });
  for (const clock of clocks) {
    assert.ok(Math.abs(clock.time - 10) < 1e-8);
    clock.suspend(); clock.tick(100_000);
    assert.ok(Math.abs(clock.time - 10) < 1e-8);
    clock.tick(100_000 + 1000 / 60);
    assert.ok(Math.abs(clock.time - (10 + 1 / 60)) < 1e-8);
  }
});

test('共享几何只释放一次；晚到资源立即释放；重复退出安全', () => {
  const resources = new SceneResources();
  let disposals = 0;
  const shared = { dispose() { disposals++; } };
  resources.own(shared); resources.own(shared);
  assert.equal(resources.size, 1);
  resources.dispose(); resources.dispose();
  assert.equal(disposals, 1); assert.equal(resources.size, 0);
  resources.own({ dispose() { disposals++; } });
  assert.equal(disposals, 2); assert.equal(resources.size, 0);
});

test('鱼嘴锚点跟随世界位置及转向，原型主鱼不超过 8k 三角形', () => {
  const resources = new SceneResources();
  const fish = createPrototypeFish(resources);
  fish.group.position.set(2, -1.5, 4); fish.group.rotation.y = Math.PI / 2;
  const mouth = fish.mouthPosition(new Vector3());
  assert.ok(mouth.distanceTo(new Vector3(2, -1.555, 3.09)) < 1e-8);
  let triangles = 0;
  fish.group.traverse((node) => {
    if ('geometry' in node) {
      const geometry = node.geometry as import('three').BufferGeometry;
      triangles += (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
    }
  });
  assert.ok(triangles <= 8000, `鱼三角形 ${triangles}`);
  resources.dispose();
});

test('切镜头保持鱼世界位置，快速反向切换从当前镜头连续开始', () => {
  const cameras = new FishingCameras(), fish = new Vector3(1, -1.3, 1.5), original = fish.clone();
  cameras.select('underwater', false, fish);
  cameras.update(0.2, false, fish);
  const intermediate = cameras.camera.position.clone();
  cameras.select('surface', false, fish);
  assert.ok(cameras.camera.position.distanceTo(intermediate) < 1e-8);
  cameras.update(0.5, false, fish);
  assert.ok(cameras.camera.position.distanceTo(new Vector3(5.4, 4.2, 10)) < 1e-8);
  cameras.select('underwater', true, fish);
  assert.ok(cameras.camera.position.distanceTo(fish.clone().add(new Vector3(1.8, 0.65, 4.8))) < 1e-8);
  assert.deepEqual(fish, original);
});

test('切镜头不创建第二条鱼或资源，20 次场景构建与释放不残留所有权', () => {
  for (let i = 0; i < 20; i++) {
    const resources = new SceneResources(), world = createFishingWorld(resources);
    world.update(10, false);
    const fish = world.fishPosition.clone(), owned = resources.size, children = world.scene.children.length;
    world.setView('underwater'); world.setView('surface');
    assert.deepEqual(world.fishPosition, fish);
    assert.equal(resources.size, owned); assert.equal(world.scene.children.length, children);
    resources.dispose(); world.scene.clear();
    assert.equal(resources.size, 0); assert.equal(world.scene.children.length, 0);
  }
});

test('竖屏海面构图同时保留角色草帽、竿尖和浮漂', () => {
  for (const [width, height] of [[349, 418], [664, 578], [1142, 386]]) {
    const cameras = new FishingCameras();
    cameras.resize(width!, height!);
    cameras.camera.updateMatrixWorld();
    for (const point of [new Vector3(-3.78, 2.5, 6.1), new Vector3(-0.7, 3.6, 2.8), new Vector3(2.1, 0.2, 1.1)]) {
      const projected = point.project(cameras.camera);
      assert.ok(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1, `画布 ${width}×${height}：${projected.toArray()}`);
    }
  }
});
