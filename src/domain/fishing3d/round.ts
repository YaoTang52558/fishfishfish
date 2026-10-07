import { arrangeClues, biteWindow, candidateWeights } from '../fishing.ts';
import type { BaitId, CastSpot, Clue, FishingSpecies } from '../fishing.ts';
import { seededRandom } from '../fish.ts';
import type { HabitatId } from '../types.ts';
import { createFight, landFish, stepFight } from './simulate.ts';
import { emptyFightInput, mouthPosition } from './state.ts';
import type { FightInput, FightSample, FightState3D, Vec3 } from './state.ts';
import { CAST_MOTION } from './cast.ts';
import type { Challenge } from '../growth.ts';

export type RoundPhase = 'setup' | 'casting' | 'waiting' | 'bite' | 'fighting' | 'landing' | 'caught' | 'released' | 'escaped';
export interface RoundState {
  phase: RoundPhase; ticks: number; waitTicks: number; seed: number;
  attemptId: string | null; speciesId: string | null; bait: BaitId | null; spot: CastSpot | null;
  clues: Record<CastSpot, Clue>; fight: FightState3D | null; assist: boolean; failStreak: number;
  escape: 'early' | 'missed' | 'line' | 'timeout' | null; error: 'no-candidates' | null;
  challenge: Challenge;
}
export interface RoundContent { pool: readonly FishingSpecies[]; habitatId: HabitatId; samples: Readonly<Record<string, FightSample>>; mouthAnchors?: Readonly<Record<string, Vec3>> }
export type RoundCommand =
  | { type: 'cast'; bait: BaitId; spot: CastSpot; attemptId: string; seed: number }
  | { type: 'pull' | 'land' | 'release' | 'cancel' }
  | { type: 'retry'; seed: number }
  | { type: 'setAssist'; on: boolean };
// Challenge changes are accepted only between casts; help can be switched during play.
export type ChallengeCommand = { type: 'setChallenge'; value: Challenge };
// Separate both distance and lateral direction so the surface camera shows three distinct areas.
export const castPosition = (spot: CastSpot): Vec3 => ({ x: spot === 'near' ? -1.6 : spot === 'far' ? 4.4 : 1, y: 0, z: spot === 'near' ? 2.8 : spot === 'far' ? 11 : 6.5 });
export const roundActive = (s: RoundState) => ['casting', 'waiting', 'bite', 'fighting', 'landing', 'released'].includes(s.phase);
export function createRound(seed: number, assist = false, challenge: Challenge = 'regular'): RoundState {
  return { phase: 'setup', ticks: 0, waitTicks: 0, seed, attemptId: null, speciesId: null, bait: null, spot: null,
    clues: arrangeClues(seed), fight: null, assist, challenge, failStreak: 0, escape: null, error: null };
}
const escaped = (s: RoundState, reason: RoundState['escape']): RoundState => ({ ...s, phase: 'escaped', ticks: 0, escape: reason, failStreak: s.failStreak + 1 });
export function commandRound(s: RoundState, command: RoundCommand | ChallengeCommand, content: RoundContent): RoundState {
  switch (command.type) {
    case 'setAssist': return { ...s, assist: command.on };
    case 'setChallenge': return ['setup', 'escaped', 'caught'].includes(s.phase) && ['gentle', 'regular', 'hard'].includes(command.value) ? { ...s, challenge: command.value } : s;
    case 'cancel': return { ...createRound(s.seed, s.assist, s.challenge), clues: s.clues, failStreak: s.failStreak };
    case 'cast': {
      if (s.phase !== 'setup' || !command.attemptId || !Number.isFinite(command.seed)
        || !['shrimp', 'algae', 'lure'].includes(command.bait) || !['near', 'middle', 'far'].includes(command.spot)) return s;
      // Only preloaded, explicitly mapped species can enter this round. No placeholder substitution.
      const weights = candidateWeights(content.pool.filter(item => content.samples[item.id]), content.habitatId, command.bait, command.spot, s.clues[command.spot]);
      if (!weights.length) return { ...s, error: 'no-candidates' };
      const random = seededRandom(command.seed); let roll = random(), id = weights[weights.length - 1]!.id;
      for (const entry of weights) { if (roll < entry.probability) { id = entry.id; break; } roll -= entry.probability; }
      return { ...s, phase: 'casting', ticks: 0, seed: command.seed, attemptId: command.attemptId, speciesId: id,
        bait: command.bait, spot: command.spot, waitTicks: Math.ceil((3 + random() * 5) * 60), fight: null, escape: null, error: null };
    }
    case 'pull': {
      if (s.phase === 'waiting') return escaped(s, 'early');
      if (s.phase !== 'bite' || !s.speciesId || !s.spot) return s;
      const size = content.pool.find(item => item.id === s.speciesId)!.game.size;
      const fight = createFight(content.samples[s.speciesId], s.seed ^ 0x739a2b1, size, content.mouthAnchors?.[s.speciesId]);
      const p = castPosition(s.spot); fight.fishPosition = { ...p, y: -1.35 };
      const hook = mouthPosition(fight), tip = fight.rodTip;
      fight.lineLength = Math.hypot(hook.x - tip.x, hook.y - tip.y, hook.z - tip.z);
      return { ...s, phase: 'fighting', ticks: 0, fight };
    }
    case 'land': return s.phase === 'landing' && s.fight ? { ...s, phase: 'caught', ticks: 0, failStreak: 0, fight: landFish(s.fight) } : s;
    case 'release': return s.phase === 'caught' ? { ...s, phase: 'released', ticks: 0 } : s;
    case 'retry': return ['escaped', 'released'].includes(s.phase) ? { ...createRound(command.seed, s.assist, s.challenge), failStreak: s.failStreak } : s;
  }
}
/** One 1/60 second business step, shared by WebGL and Canvas. Camera transitions never own time. */
export function stepRound(s: RoundState, input: FightInput = emptyFightInput()): RoundState {
  const ticks = s.ticks + 1;
  if (s.phase === 'casting') return ticks >= CAST_MOTION.totalTicks ? { ...s, phase: 'waiting', ticks: 0 } : { ...s, ticks };
  if (s.phase === 'waiting') return ticks >= s.waitTicks ? { ...s, phase: 'bite', ticks: 0 } : { ...s, ticks };
  if (s.phase === 'bite') return ticks >= Math.ceil(biteWindow(s.assist) * 60) ? escaped(s, 'missed') : { ...s, ticks };
  if (s.phase === 'released') return ticks >= 72 ? { ...createRound(s.seed + 1, s.assist, s.challenge), failStreak: s.failStreak } : { ...s, ticks };
  if (s.phase === 'caught') return { ...s, ticks: Math.min(180, ticks) };
  if (s.phase === 'landing' && s.assist && s.fight) return { ...s, phase: 'caught', ticks: 0, failStreak: 0, fight: landFish(s.fight) };
  if (s.phase !== 'fighting' || !s.fight) return s;
  const action = s.fight.action === 'telegraph' ? s.fight.nextAction : s.fight.action;
  const rodAxis = s.assist && action === 'lateral' ? -s.fight.lateralSign : input.rodAxis;
  const reel = input.reel && !(s.assist && action !== 'rest' && s.fight.tension > .8);
  const fight = stepFight(s.fight, { reel, rodAxis }, s.assist, s.challenge);
  if (fight.phase === 'escaped') return { ...escaped(s, fight.escapeReason), fight };
  return { ...s, ticks: fight.phase === s.phase ? ticks : 0, phase: fight.phase, fight };
}
