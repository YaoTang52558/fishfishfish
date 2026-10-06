import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AdaptiveQuality, PerformanceRecorder, frameStats } from '../src/features/fishing3d/performance.ts';

test('G5 自动降画质需要两个完整慢窗口，恢复窗口会清除累计，手动选择不被覆盖', () => {
  const quality = new AdaptiveQuality(), slow = frameStats(Array(125).fill(40)), fast = frameStats(Array(300).fill(1000 / 60));
  assert.equal(quality.observe({ ...slow, seconds: 4.99 }), 'standard');
  assert.equal(quality.observe(slow), 'standard'); assert.equal(quality.observe(fast), 'standard');
  assert.equal(quality.observe(slow), 'standard'); assert.equal(quality.observe(slow), 'low');
  assert.equal(quality.observe(fast), 'low'); // no repeated quality oscillation
  quality.set('standard'); assert.equal(quality.observe(slow), 'standard'); assert.equal(quality.observe(slow), 'standard');
  quality.set('auto'); assert.equal(quality.observe(slow), 'standard'); assert.equal(quality.observe(slow), 'low');
  quality.set('auto'); quality.observe(slow); quality.interrupt(); assert.equal(quality.observe(slow), 'standard');
  const uneven = frameStats([...Array(480).fill(16), ...Array(30).fill(75)]); assert.ok(uneven.fps > 30); assert.equal(uneven.p95, 75);
  quality.set('auto'); quality.observe(uneven); assert.equal(quality.observe(uneven), 'low');
});
test('G5 60 秒记录冻结结果；暂停、中断和预算超标不能算连续实测通过', () => {
  const good = new PerformanceRecorder(); for (let i = 0; i < 1800; i++) good.add(1000 / 30, 80, 150000);
  while (!good.read().complete) good.add(1000 / 30, 80, 150000);
  assert.equal(good.read().passesFrameBudget, true); const snapshot = good.read(); good.interrupt(); good.add(200, 100, 160000); assert.deepEqual(good.read(), snapshot);
  for (const issue of ['interruption', 'calls', 'triangles', 'frames']) {
    const bad = new PerformanceRecorder(); if (issue === 'interruption') bad.interrupt();
    for (let i = 0; i < 1801; i++) bad.add(issue === 'frames' ? 60 : 1000 / 30, issue === 'calls' ? 81 : 80, issue === 'triangles' ? 150001 : 150000);
    assert.equal(bad.read().passesFrameBudget, false, issue);
  }
  const partial = new PerformanceRecorder(); partial.add(16, 70, 100000); assert.equal(partial.read().passesFrameBudget, false);
});
