import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DraftAutosaver, type SaveState, type Timers } from '../src/features/editor/autosave.ts';

function fakeTimers() {
  let now = 0, next = 1;
  const pending = new Map<number, { at: number; callback: () => void }>();
  const timers: Timers = {
    setTimeout(callback, ms) { const id = next++; pending.set(id, { at: now + ms, callback }); return id; },
    clearTimeout(handle) { pending.delete(handle as number); },
  };
  async function advance(ms: number) {
    now += ms;
    for (const [id, timer] of [...pending].sort((a, b) => a[1].at - b[1].at)) if (timer.at <= now) { pending.delete(id); timer.callback(); }
    for (let index = 0; index < 10; index += 1) await Promise.resolve();
  }
  return { timers, advance };
}

test('edits within 500ms are saved once; flush writes immediately', async () => {
  const { timers, advance } = fakeTimers();
  let saves = 0;
  const states: SaveState[] = [];
  const saver = new DraftAutosaver(async () => { saves += 1; }, (state) => states.push(state), 500, timers);
  saver.schedule(); await advance(300); saver.schedule(); await advance(300);
  assert.equal(saves, 0);
  await advance(200);
  assert.equal(saves, 1);
  assert.equal(saver.state, 'saved');
  saver.schedule();
  assert.equal(await saver.flush(), true);
  assert.equal(saves, 2);
  assert.deepEqual(states.filter((state, index) => state !== states[index - 1]).slice(0, 3), ['pending', 'saving', 'saved']);
});

test('changes made while a save is running are saved afterwards; writes never overlap', async () => {
  const { timers, advance } = fakeTimers();
  let running = 0, maxRunning = 0, saves = 0;
  let release: () => void = () => undefined;
  const saver = new DraftAutosaver(() => new Promise<void>((resolve) => {
    running += 1; maxRunning = Math.max(maxRunning, running); saves += 1;
    release = () => { running -= 1; resolve(); };
  }), undefined, 500, timers);
  saver.schedule(); await advance(500);
  saver.schedule();
  const flushed = saver.flush();
  release(); await advance(0);
  release(); assert.equal(await flushed, true);
  assert.equal(saves, 2);
  assert.equal(maxRunning, 1);
  assert.equal(saver.dirty, false);
});

test('a failed save keeps the work dirty and can be retried', async () => {
  const { timers, advance } = fakeTimers();
  let fail = true;
  const saver = new DraftAutosaver(async () => { if (fail) throw new Error('quota'); }, undefined, 500, timers);
  saver.schedule(); await advance(500);
  assert.equal(saver.state, 'error');
  assert.equal(saver.dirty, true);
  assert.equal(await saver.flush(), false);
  fail = false;
  assert.equal(await saver.flush(), true);
  assert.equal(saver.state, 'saved');
});
