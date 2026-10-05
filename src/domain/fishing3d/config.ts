import type { FightSample } from './state.ts';

/** Game coefficients, not measurements of real fish or fishing tackle. */
export const FIGHT_CONFIG = Object.freeze({
  version: 'g2.1', step: 1 / 60, mass: 1, spring: 6, damping: 1, drag: 1.5,
  breakForce: 9, reelSpeed: 0.6, payoutSpeed: 1.2, speedLimit: 1.8,
  minLine: 1.5, maxLine: 18, breakSeconds: 1.2, timeoutSeconds: 60,
  landingRadius: 1.2, landingDepth: -0.6, landingFatigue: 0.7,
  fatigueForceRate: 0.11, fatigueActionRate: 0.018, restRecoveryRate: 0.006,
});
export const FIGHT_SAMPLES: readonly { id: FightSample; name: string; description: string }[] = [
  { id: 'sprinter', name: '冲刺型', description: '留意加速的尾巴，冲刺时先松线。' },
  { id: 'weaver', name: '横游型', description: '它会左右横游，向相反方向控竿。' },
  { id: 'diver', name: '下潜型', description: '鱼头向下时松线，喘息时再收。' },
];
