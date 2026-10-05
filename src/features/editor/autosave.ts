export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';
export interface Timers {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

/**
 * 草稿自动保存：完成操作后防抖，同一时刻只有一个写入。
 * save 回调在开始写入时读取当时的作品快照；写入期间的新改动会在完成后再保存一次。
 */
export class DraftAutosaver {
  state: SaveState = 'idle';
  lastError: unknown = null;
  private generation = 0;
  private savedGeneration = 0;
  private timer: unknown = null;
  private inflight: Promise<void> | null = null;

  private readonly save: () => Promise<void>;
  private readonly onChange: (state: SaveState, error: unknown) => void;
  private readonly delay: number;
  private readonly timers: Timers;

  constructor(save: () => Promise<void>, onChange: (state: SaveState, error: unknown) => void = () => undefined,
    delay = 500, timers: Timers = globalThis as unknown as Timers) {
    this.save = save; this.onChange = onChange; this.delay = delay; this.timers = timers;
  }

  get dirty() { return this.generation !== this.savedGeneration; }

  schedule() {
    this.generation += 1;
    this.clearTimer();
    this.timer = this.timers.setTimeout(() => { this.timer = null; void this.run(); }, this.delay);
    if (!this.inflight) this.set('pending', null);
  }

  /** 立即保存所有未保存改动；返回是否全部写入成功。 */
  async flush(): Promise<boolean> {
    // 保存期间可能又有新改动：重复保存直到没有未保存内容；失败就停下交给调用方。
    for (let attempt = 0; attempt < 5; attempt += 1) {
      this.clearTimer();
      while (this.inflight) await this.inflight;
      this.clearTimer();
      if (!this.dirty) return true;
      await this.run();
      if (this.state === 'error') return false;
    }
    return !this.dirty;
  }

  dispose() { this.clearTimer(); }

  private run(): Promise<void> {
    if (this.inflight) return this.inflight;
    if (!this.dirty) return Promise.resolve();
    const generation = this.generation;
    this.set('saving', null);
    this.inflight = this.save().then(() => {
      this.savedGeneration = Math.max(this.savedGeneration, generation);
      this.inflight = null;
      if (this.dirty) { this.set('pending', null); if (this.timer === null) void this.run(); } else this.set('saved', null);
    }, (error: unknown) => {
      this.inflight = null;
      this.set('error', error);
    });
    return this.inflight;
  }

  private set(state: SaveState, error: unknown) { this.state = state; this.lastError = error; this.onChange(state, error); }
  private clearTimer() { if (this.timer !== null) { this.timers.clearTimeout(this.timer); this.timer = null; } }
}
