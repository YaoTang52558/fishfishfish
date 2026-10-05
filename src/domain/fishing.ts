import { seededRandom } from './fish.ts';
import type { HabitatId } from './types.ts';

/*
 * 钓鱼规则（技术设计第 7 节）。全部是游戏难度配置，不代表真实垂钓或鱼类行为。
 * 状态只通过 fishingReducer 改变；界面只发送事件，不直接改张力或进度。
 */
export type BaitId = 'shrimp' | 'algae' | 'lure';
export type CastSpot = 'near' | 'middle' | 'far';
export type FightPattern = 'steady' | 'burst' | 'wave';
export type Clue = 'bubbles' | 'shadow' | 'calm';
export interface SpeciesGame {
  habitatId: HabitatId;
  baitWeights: Record<BaitId, number>;
  castWeights: Record<CastSpot, number>;
  fightPattern: FightPattern;
  baseWeight: number;
  size: 'small' | 'large';
}
export interface FishingSpecies { id: string; game: SpeciesGame; reviewStatus: 'placeholder' | 'verified' }

export const fishingConfig = {
  castSeconds: 0.8,
  waitMin: 3, waitMax: 8,
  biteWindow: 2.5, assistBiteWindow: 5,
  safe: [0.25, 0.75] as const, assistSafe: [0.15, 0.85] as const,
  breakTension: 0.98, breakHold: 1.2, assistBreakHold: 2,
  fightTimeout: 45,
  initialTension: 0.4,
} as const;
export const baits: ReadonlyArray<{ id: BaitId; name: string }> = [
  { id: 'shrimp', name: '虾型饵' }, { id: 'algae', name: '藻食型饵' }, { id: 'lure', name: '拟饵' },
];
export const spots: ReadonlyArray<{ id: CastSpot; name: string }> = [
  { id: 'near', name: '近处' }, { id: 'middle', name: '中段' }, { id: 'far', name: '远处' },
];
export const clueNames: Record<Clue, string> = { bubbles: '冒着小气泡', shadow: '有大鱼影', calm: '水面平静' };

export type Phase = 'setup' | 'casting' | 'waiting' | 'bite' | 'fighting' | 'caught' | 'escaped' | 'released';
export type EscapeReason = 'early' | 'missed' | 'break' | 'timeout';
export interface FishingState {
  phase: Phase;
  attemptId: string | null;
  seed: number;
  speciesId: string | null;
  bait: BaitId | null;
  spot: CastSpot | null;
  clues: Record<CastSpot, Clue>;
  /** 当前阶段已经过的时间（秒）。 */
  phaseTime: number;
  waitDuration: number;
  fight: { pattern: FightPattern; base: number; burstEvery: number; tension: number; progress: number; breakTimer: number; time: number; reeling: boolean };
  escape: EscapeReason | null;
  failStreak: number;
  assist: boolean;
  error: 'no-candidates' | null;
}
export type FishingEvent =
  | { type: 'cast'; spot: CastSpot; bait: BaitId; attemptId: string; seed: number }
  | { type: 'tick'; dt: number }
  | { type: 'pull' }
  | { type: 'reel'; on: boolean }
  | { type: 'release' }
  | { type: 'retry'; clueSeed: number }
  | { type: 'setAssist'; on: boolean }
  | { type: 'cancel' };

/** 每个落点的线索：气泡偏向小鱼，鱼影偏向大鱼，平静无偏向。每轮重新安排。 */
export function arrangeClues(seed: number): Record<CastSpot, Clue> {
  const random = seededRandom(seed);
  const order: Clue[] = ['bubbles', 'shadow', 'calm'];
  for (let i = order.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!]; }
  return { near: order[0]!, middle: order[1]!, far: order[2]! };
}
export function clueWeight(clue: Clue, size: 'small' | 'large') {
  return clue === 'bubbles' ? (size === 'small' ? 1.6 : 1) : clue === 'shadow' ? (size === 'large' ? 1.8 : 1) : 1;
}
/** 候选物种与归一化概率：w = 基础 × 饵 × 落点 × 线索；只含本钓场、权重有限且 > 0 的物种。 */
export function candidateWeights(species: readonly FishingSpecies[], habitatId: HabitatId, bait: BaitId, spot: CastSpot, clue: Clue, allowPlaceholder = false) {
  const entries = species.filter((item) => item.game.habitatId === habitatId && (allowPlaceholder || item.reviewStatus === 'verified')).map((item) => {
    const w = item.game.baseWeight * item.game.baitWeights[bait] * item.game.castWeights[spot] * clueWeight(clue, item.game.size);
    return { id: item.id, weight: Number.isFinite(w) && w > 0 ? w : 0 };
  }).filter((entry) => entry.weight > 0);
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  return entries.map((entry) => ({ id: entry.id, probability: entry.weight / total }));
}

export function createFishingState(clueSeed: number, assist = false): FishingState {
  return {
    phase: 'setup', attemptId: null, seed: 0, speciesId: null, bait: null, spot: null, clues: arrangeClues(clueSeed),
    phaseTime: 0, waitDuration: 0,
    fight: { pattern: 'steady', base: 0.35, burstEvery: 5, tension: fishingConfig.initialTension, progress: 0, breakTimer: 0, time: 0, reeling: false },
    escape: null, failStreak: 0, assist, error: null,
  };
}

/** 阻力 r(t)：标准恒定、冲刺型间歇升到 0.8、摆动型平滑起伏。 */
export function resistance(fight: FishingState['fight']): number {
  const { pattern, base, time, burstEvery } = fight;
  if (pattern === 'burst') return (time % burstEvery) > burstEvery - 1.2 ? 0.8 : base;
  if (pattern === 'wave') return base + 0.15 * Math.sin(time * 2 * Math.PI / 3.5);
  return base;
}
export function safeZone(assist: boolean) { return assist ? fishingConfig.assistSafe : fishingConfig.safe; }
export function biteWindow(assist: boolean) { return assist ? fishingConfig.assistBiteWindow : fishingConfig.biteWindow; }
/** 连续失败两次后建议开启辅助模式（玩家随时可以手动开启）。 */
export function suggestAssist(state: FishingState) { return state.failStreak >= 2 && !state.assist; }

const escape = (state: FishingState, reason: EscapeReason): FishingState => ({ ...state, phase: 'escaped', escape: reason, phaseTime: 0, failStreak: state.failStreak + 1, fight: { ...state.fight, reeling: false } });

export function fishingReducer(state: FishingState, event: FishingEvent, species: readonly FishingSpecies[], habitatId: HabitatId, allowPlaceholder = false): FishingState {
  switch (event.type) {
    case 'setAssist': return { ...state, assist: event.on };
    case 'cancel':
      // 离开或中断当前一轮：未完成的钓鱼不保存、不计失败。
      return ['casting', 'waiting', 'bite', 'fighting'].includes(state.phase) ? { ...createFishingState(0, state.assist), clues: state.clues, failStreak: state.failStreak } : state;
    case 'cast': {
      if (state.phase !== 'setup') return state;
      const random = seededRandom(event.seed);
      const candidates = candidateWeights(species, habitatId, event.bait, event.spot, state.clues[event.spot], allowPlaceholder);
      if (!candidates.length) return { ...state, error: 'no-candidates' };
      // 同一个随机源依次决定物种、等待时间与阻力，便于用 seed 复现。
      let roll = random(), chosen = candidates[candidates.length - 1]!.id;
      for (const candidate of candidates) { if (roll < candidate.probability) { chosen = candidate.id; break; } roll -= candidate.probability; }
      const waitDuration = fishingConfig.waitMin + random() * (fishingConfig.waitMax - fishingConfig.waitMin);
      const chosenSpecies = species.find((item) => item.id === chosen)!;
      const base = 0.25 + random() * 0.2;
      return {
        ...state, phase: 'casting', attemptId: event.attemptId, seed: event.seed, speciesId: chosen, bait: event.bait, spot: event.spot,
        phaseTime: 0, waitDuration, escape: null, error: null,
        fight: { pattern: chosenSpecies.game.fightPattern, base, burstEvery: 4 + random() * 2, tension: fishingConfig.initialTension, progress: 0, breakTimer: 0, time: 0, reeling: false },
      };
    }
    case 'pull':
      if (state.phase === 'waiting') return escape(state, 'early'); // 窗口前提竿是空竿
      if (state.phase === 'bite') return { ...state, phase: 'fighting', phaseTime: 0 };
      return state;
    case 'reel':
      return state.phase === 'fighting' ? { ...state, fight: { ...state.fight, reeling: event.on } } : state;
    case 'release':
      return state.phase === 'caught' ? { ...state, phase: 'released', phaseTime: 0 } : state;
    case 'retry':
      return state.phase === 'escaped' || state.phase === 'released'
        ? { ...createFishingState(event.clueSeed, state.assist), failStreak: state.failStreak } : state;
    case 'tick': {
      const dt = event.dt;
      if (!(dt > 0) || !Number.isFinite(dt)) return state;
      const phaseTime = state.phaseTime + dt;
      if (state.phase === 'casting') return phaseTime >= fishingConfig.castSeconds ? { ...state, phase: 'waiting', phaseTime: 0 } : { ...state, phaseTime };
      if (state.phase === 'waiting') return phaseTime >= state.waitDuration ? { ...state, phase: 'bite', phaseTime: 0 } : { ...state, phaseTime };
      if (state.phase === 'bite') return phaseTime >= biteWindow(state.assist) ? escape(state, 'missed') : { ...state, phaseTime };
      if (state.phase !== 'fighting') return { ...state, phaseTime };
      const fight = { ...state.fight, time: state.fight.time + dt };
      const u = fight.reeling ? 1 : 0;
      const r = resistance(fight);
      fight.tension = Math.min(1, Math.max(0, fight.tension + dt * (0.55 * u + 0.45 * r - 0.4 * (1 - u) - 0.22)));
      const [low, high] = safeZone(state.assist);
      const safe = fight.tension >= low && fight.tension <= high;
      fight.progress = Math.min(1, Math.max(0, fight.progress + dt * (safe ? (u ? 0.065 : 0.015) : -0.025)));
      // 断线计时只在持续过紧时累积，离开阈值立即清零。
      fight.breakTimer = fight.tension >= fishingConfig.breakTension ? fight.breakTimer + dt : 0;
      const next = { ...state, phaseTime, fight };
      if (fight.progress >= 1) return { ...next, phase: 'caught', phaseTime: 0, failStreak: 0, fight: { ...fight, reeling: false } };
      if (fight.breakTimer >= (state.assist ? fishingConfig.assistBreakHold : fishingConfig.breakHold)) return escape(next, 'break');
      if (fight.time >= fishingConfig.fightTimeout) return escape(next, 'timeout');
      return next;
    }
  }
}

/** 张力的文字与区段（不只靠颜色表达）。 */
export function tensionLabel(state: FishingState): { zone: 'loose' | 'good' | 'tight' | 'danger'; text: string } {
  const [low, high] = safeZone(state.assist);
  const t = state.fight.tension;
  if (t >= 0.9) return { zone: 'danger', text: '太紧了，快松开！' };
  if (t > high) return { zone: 'tight', text: '有点紧，松一松' };
  if (t < low) return { zone: 'loose', text: '太松了，收线' };
  return { zone: 'good', text: '正好，继续' };
}

/*
 * 原创鱼偶遇：独立随机流，不影响物种抽样。进入钓场 10 秒后检查一次，
 * 有喜爱该钓场的原创鱼才以 20% 安排；咬钩或搏鱼时推迟到安全时段；每次进入最多一次。
 */
export interface EncounterState { checked: boolean; scheduled: boolean; shown: boolean; fishId: string | null; elapsed: number }
export function createEncounter(): EncounterState { return { checked: false, scheduled: false, shown: false, fishId: null, elapsed: 0 }; }
export function encounterSafe(state: FishingState) {
  return state.phase === 'setup' || (state.phase === 'waiting' && state.waitDuration - state.phaseTime >= 3);
}
export function stepEncounter(encounter: EncounterState, fishing: FishingState, dt: number, candidates: readonly string[], random: () => number): EncounterState {
  if (encounter.shown) return encounter;
  const elapsed = encounter.elapsed + dt;
  let next = { ...encounter, elapsed };
  if (!next.checked && elapsed >= 10) {
    next.checked = true;
    if (candidates.length && random() < 0.2) next = { ...next, scheduled: true, fishId: candidates[Math.floor(random() * candidates.length)]! };
  }
  if (next.scheduled && !next.shown && encounterSafe(fishing)) next = { ...next, shown: true };
  return next;
}
