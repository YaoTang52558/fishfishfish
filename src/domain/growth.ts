/** Independent, manually selected game settings. They never gate fish or rewards. */
export type Challenge = 'gentle' | 'regular' | 'hard';
export type KnowledgeDepth = 'simple' | 'curious';
export const growthPresets = [
  { id: 'together', icon: '🤝', name: '一起玩', assistMode: true, challenge: 'gentle', knowledgeDepth: 'simple' },
  { id: 'explore', icon: '🐟', name: '自己探索', assistMode: false, challenge: 'regular', knowledgeDepth: 'simple' },
  { id: 'challenge', icon: '🌊', name: '挑战一下', assistMode: false, challenge: 'hard', knowledgeDepth: 'curious' },
] as const;
export const challengeRules: Readonly<Record<Challenge, { power: number; stamina: number; breakWindow: number; time: number }>> = {
  gentle: { power: .8, stamina: .8, breakWindow: 1.5, time: 1.35 },
  regular: { power: 1, stamina: 1, breakWindow: 1, time: 1 },
  hard: { power: 1.12, stamina: 1.12, breakWindow: .85, time: 1 },
};
