import type { FightInput } from '../../domain/fishing3d/state.ts';

export type HoldAction = 'left' | 'right' | 'reel';
/** Each finger/key owns its own hold; releasing one finger cannot release another. */
export class FightInputs {
  private readonly pointers = new Map<number, HoldAction>();
  private readonly keys = new Map<string, HoldAction>();
  private readonly latched = new Set<HoldAction>();
  pointerDown(id: number, action: HoldAction) { this.pointers.set(id, action); }
  pointerUp(id: number) { this.pointers.delete(id); }
  keyDown(key: string, action: HoldAction) { this.keys.set(key, action); }
  keyUp(key: string) { this.keys.delete(key); }
  toggle(action: HoldAction) { if (this.latched.has(action)) this.latched.delete(action); else this.latched.add(action); }
  release(action: HoldAction) {
    for (const [id, value] of this.pointers) if (value === action) this.pointers.delete(id);
    for (const [key, value] of this.keys) if (value === action) this.keys.delete(key);
    this.latched.delete(action);
  }
  clear() { this.pointers.clear(); this.keys.clear(); this.latched.clear(); }
  read(): FightInput {
    const actions = new Set([...this.pointers.values(), ...this.keys.values(), ...this.latched]);
    return { reel: actions.has('reel'), rodAxis: Number(actions.has('right')) - Number(actions.has('left')) };
  }
}
