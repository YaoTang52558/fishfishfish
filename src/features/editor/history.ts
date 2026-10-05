/**
 * 命令历史：保留最近 30 次已完成操作。像素命令超出内存预算时，
 * 把最旧的像素记录压缩成 PNG，而不是丢弃步骤，保证 30 步可撤销。
 */
export interface Command {
  readonly label: string;
  /** 当前占用的内存（字节），未压缩像素按 RGBA 计算。 */
  bytes(): number;
  undo(): void | Promise<void>;
  redo(): void | Promise<void>;
  /** 可选：压缩像素记录以降低内存；返回压缩后是否变小。 */
  compress?(): Promise<boolean>;
}

export const HISTORY_LIMIT = 30;
export const HISTORY_BUDGET = 48 * 1024 * 1024;

export class History {
  private past: Command[] = [];
  private future: Command[] = [];
  private busy: Promise<void> | null = null;
  private readonly limit: number;
  private readonly budget: number;
  private readonly onChange: () => void;

  constructor(onChange: () => void = () => undefined, limit = HISTORY_LIMIT, budget = HISTORY_BUDGET) {
    this.onChange = onChange; this.limit = limit; this.budget = budget;
  }

  get canUndo() { return this.past.length > 0 && !this.busy; }
  get canRedo() { return this.future.length > 0 && !this.busy; }
  get undoCount() { return this.past.length; }
  get redoCount() { return this.future.length; }
  get bytes() { return [...this.past, ...this.future].reduce((sum, command) => sum + command.bytes(), 0); }

  /** 记录一个已经执行完成的操作；新操作清空 redo。 */
  push(command: Command) {
    this.future = [];
    this.past.push(command);
    while (this.past.length > this.limit) this.past.shift();
    this.onChange();
    void this.enforceBudget();
  }
  async undo(): Promise<boolean> { return this.step(this.past, this.future, 'undo'); }
  async redo(): Promise<boolean> { return this.step(this.future, this.past, 'redo'); }
  clear() { this.past = []; this.future = []; this.onChange(); }
  /** 等待正在进行的撤销/重做与压缩完成。 */
  async idle() { while (this.busy || this.compression) await (this.busy ?? this.compression); }

  private async step(from: Command[], to: Command[], action: 'undo' | 'redo') {
    while (this.busy) await this.busy;
    // 不与压缩同时改写同一条记录。
    while (this.compression) await this.compression;
    const command = from.pop();
    if (!command) return false;
    let done!: () => void;
    this.busy = new Promise<void>((resolve) => { done = resolve; });
    try { await command[action](); to.push(command); } catch (error) { from.push(command); throw error; } finally {
      this.busy = null; done(); this.onChange();
    }
    return true;
  }

  private compression: Promise<void> | null = null;
  private recheck = false;
  private enforceBudget() {
    // 压缩进行中又有新操作：结束后再检查一轮，不漏掉后来的记录。
    if (this.compression) { this.recheck = true; return this.compression; }
    this.compression = (async () => {
      // 先让同一轮同步发生的操作全部入栈，再统一检查。
      await Promise.resolve();
      do {
        this.recheck = false;
        // 从最旧的记录开始压缩，最近的操作保持即时撤销；撤销/重做进行时先等待。
        for (const command of [...this.past, ...this.future.slice().reverse()]) {
          if (this.bytes <= this.budget) break;
          while (this.busy) await this.busy;
          if (command.compress) await command.compress();
        }
      } while (this.recheck);
    })().finally(() => { this.compression = null; });
    return this.compression;
  }
}
