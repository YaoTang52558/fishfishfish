import assert from 'node:assert/strict';
import { test } from 'node:test';
import { History, HISTORY_LIMIT, type Command } from '../src/features/editor/history.ts';

function counter() {
  const state = { value: 0 };
  const command = (delta: number, bytes = 10, compressible = false): Command & { compressed: boolean } => {
    const item = {
      label: `+${delta}`, compressed: false, bytes: () => item.compressed ? 1 : bytes,
      undo: () => { state.value -= delta; }, redo: () => { state.value += delta; },
      ...(compressible ? { compress: async () => { item.compressed = true; return true; } } : {}),
    };
    return item;
  };
  const apply = (history: History, delta: number, bytes?: number, compressible?: boolean) => {
    state.value += delta;
    const item = command(delta, bytes, compressible);
    history.push(item);
    return item;
  };
  return { state, apply };
}

test('keeps at least 30 undo steps and redoes them in order', async () => {
  const { state, apply } = counter();
  const history = new History();
  for (let i = 1; i <= 35; i += 1) apply(history, i);
  assert.equal(history.undoCount, HISTORY_LIMIT);
  const total = state.value;
  for (let i = 0; i < 30; i += 1) assert.equal(await history.undo(), true);
  assert.equal(await history.undo(), false, 'only the last 30 are kept');
  assert.equal(state.value, total - [...Array(30).keys()].reduce((sum, i) => sum + (35 - i), 0));
  for (let i = 0; i < 30; i += 1) await history.redo();
  assert.equal(state.value, total);
  assert.equal(history.canRedo, false);
});

test('a new operation after undo clears redo', async () => {
  const { state, apply } = counter();
  const history = new History();
  apply(history, 1); apply(history, 2);
  await history.undo();
  assert.equal(history.canRedo, true);
  apply(history, 5);
  assert.equal(history.canRedo, false);
  assert.equal(state.value, 6);
});

test('over budget, the oldest pixel records are compressed instead of dropping undo steps', async () => {
  const { apply } = counter();
  const history = new History(undefined, 30, 100);
  const old = apply(history, 1, 60, true);
  const recent = apply(history, 2, 60, true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(old.compressed, true);
  assert.equal(recent.compressed, false, 'stops once under budget');
  assert.equal(history.undoCount, 2);
  assert.ok(history.bytes <= 100);
});
