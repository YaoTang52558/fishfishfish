import { commandRound, createRound, stepRound } from '../../domain/fishing3d/round.ts';
import type { RoundCommand, RoundContent, RoundState } from '../../domain/fishing3d/round.ts';
import { emptyFightInput } from '../../domain/fishing3d/state.ts';
import type { FightInput } from '../../domain/fishing3d/state.ts';
import { createEncounter, stepEncounter } from '../../domain/fishing.ts';
import { seededRandom } from '../../domain/fish.ts';

/** Renderer-independent owner; resource rebuilds attach to this same round. */
export function createRoundSession(content: RoundContent, seed: number, assist = false) {
  let state = createRound(seed, assist), input = emptyFightInput();
  let encounter = createEncounter(), visitors: readonly string[] = [];
  const visitorRandom = seededRandom(seed ^ 0x37fe10);
  const listeners = new Set<(state: RoundState) => void>();
  const publish = () => { for (const listener of listeners) listener(state); };
  return {
    content,
    encounter: () => encounter,
    visitors(ids: readonly string[]) { visitors = [...ids]; },
    pendingEncounter: () => !encounter.checked || encounter.scheduled && !encounter.shown,
    read: () => state,
    publish,
    subscribe(listener: (state: RoundState) => void) { listeners.add(listener); listener(state); return () => { listeners.delete(listener); }; },
    command(command: RoundCommand) {
      state = commandRound(state, command, content);
      if (command.type !== 'setAssist') input = emptyFightInput();
      publish();
    },
    input(value: FightInput) { input = state.phase === 'fighting' ? { ...value } : emptyFightInput(); },
    clearInput() {
      input = emptyFightInput();
      if (state.fight?.reeling) { state = { ...state, fight: { ...state.fight, reeling: false } }; publish(); }
    },
    step() {
      const previous = state; state = stepRound(state, input);
      const shown = encounter.shown;
      encounter = stepEncounter(encounter, { phase: state.phase === 'setup' ? 'setup' : state.phase === 'waiting' ? 'waiting' : 'fighting', waitDuration: state.waitTicks / 60, phaseTime: state.ticks / 60 }, 1 / 60, visitors, visitorRandom);
      if (state.phase !== previous.phase) input = emptyFightInput();
      if (state.phase !== previous.phase || state.fight?.action !== previous.fight?.action || shown !== encounter.shown) publish();
    },
  };
}
export type RoundSession = ReturnType<typeof createRoundSession>;
