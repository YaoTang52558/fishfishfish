export interface Vec3 { x: number; y: number; z: number }
export type FishAction = 'telegraph' | 'sprint' | 'lateral' | 'dive' | 'rest';
export type ActiveAction = Exclude<FishAction, 'telegraph'>;
export type FightSample = 'sprinter' | 'weaver' | 'diver';
export type FightSize = 'small' | 'large';
export interface FightInput { reel: boolean; rodAxis: number }
export interface FightState3D {
  phase: 'fighting' | 'landing' | 'caught' | 'escaped';
  sample: FightSample; seed: number; size: FightSize;
  reeling: boolean; reelTurns: number;
  mouthAnchor: Vec3;
  fishPosition: Vec3; fishVelocity: Vec3; fishHeading: Vec3; rodTip: Vec3;
  rodAxis: number; lineLength: number; tension: number; fatigue: number;
  action: FishAction; actionTicks: number; nextAction: ActiveAction; lateralSign: number;
  breakTicks: number; elapsedTicks: number; escapeReason: 'line' | 'timeout' | null;
}
export const emptyFightInput = (): FightInput => ({ reel: false, rodAxis: 0 });
export const distanceToShore = (state: FightState3D) => Math.hypot(state.fishPosition.x, state.fishPosition.z);

// Local model forward is +X. This yaw/pitch basis is also used by the 3D renderer.
export function mouthPosition(state: Pick<FightState3D, 'fishPosition' | 'fishHeading'> & Partial<Pick<FightState3D, 'mouthAnchor'>>): Vec3 {
  const p = state.fishPosition, h = state.fishHeading;
  const horizontal = Math.hypot(h.x, h.z);
  const ux = horizontal > 1e-8 ? -h.y * h.x / horizontal : -h.y;
  const uz = horizontal > 1e-8 ? -h.y * h.z / horizontal : 0;
  const a = state.mouthAnchor ?? { x: 0.91, y: -0.055, z: 0 };
  return { x: p.x + h.x * a.x + ux * a.y, y: p.y + h.y * a.x + horizontal * a.y, z: p.z + h.z * a.x + uz * a.y };
}
