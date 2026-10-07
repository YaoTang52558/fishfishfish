import { castPosition } from './round.ts';
import type { RoundState } from './round.ts';
import type { Vec3 } from './state.ts';
import type { FightState3D } from './state.ts';
import { CAST_MOTION as C } from './cast.ts';
export { CAST_MOTION } from './cast.ts';
const ease = (t: number) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };
const blend = (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
/** Net presentation uses the current round's same fish; it never changes capture state. */
export function landedFishPosition(s: RoundState, reducedMotion = false): Vec3 {
  const start = { ...(s.fight?.fishPosition ?? { x: 0, y: -.12, z: 1 }), y: -.12 };
  const end = { x: -.35, y: .8, z: 1.6 };
  if (s.phase === 'caught') {
    const u = reducedMotion ? 1 : ease(s.ticks / 81);
    if (u === 1) return end;
    const p = blend(start, end, u); p.y += reducedMotion ? 0 : Math.sin(u * Math.PI) * .35; return p;
  }
  if (s.phase === 'released') { const u = ease(s.ticks / 72); return { x: end.x + u * 1.1, y: end.y - u * 1.35, z: end.z + u * 2.5 }; }
  return start;
}
// Same coordinates as the resting G1 rod tip, expressed in the business coordinate system.
const restTip: Vec3 = { x: 0, y: 3.6, z: 2.7 };
/** Surface presentation keeps the rod up at the shore while the simulation handles underwater forces. */
export function surfaceRodTip(fight: FightState3D): Vec3 {
  const bend = Math.min(1.5, fight.tension);
  return { x: restTip.x + fight.rodAxis * 0.65, y: restTip.y - bend * 0.4, z: restTip.z + bend * 0.15 };
}
export function surfaceFloat(fight: FightState3D, reducedMotion = false): Vec3 {
  const diving = fight.action === 'dive' || (fight.action === 'telegraph' && fight.nextAction === 'dive');
  return { x: fight.fishPosition.x, z: fight.fishPosition.z, y: diving ? -0.09 : 0.045 + (reducedMotion ? 0 : Math.sin(fight.elapsedTicks / 5) * Math.min(0.065, fight.tension * 0.04)) };
}
const grip: Vec3 = { x: -2, y: 1.65, z: -0.1 };
const radius = Math.hypot(restTip.x - grip.x, restTip.y - grip.y, restTip.z - grip.z);
function onGripArc(point: Vec3): Vec3 {
  const scale = radius / Math.hypot(point.x - grip.x, point.y - grip.y, point.z - grip.z);
  return { x: grip.x + (point.x - grip.x) * scale, y: grip.y + (point.y - grip.y) * scale, z: grip.z + (point.z - grip.z) * scale };
}
const backTip = onGripArc({ x: 0.5, y: 2.8, z: -2.9 });
const releaseTip = onGripArc({ x: -0.05, y: 3.4, z: 2.85 });
const followTip = onGripArc({ x: 0.05, y: 2.65, z: 3.22 });
const swing = (a: Vec3, b: Vec3, u: number) => onGripArc(blend(a, b, u));
export function castingPose(s: RoundState, reducedMotion = false): { tip: Vec3; lean: number; arm: number } {
  if (s.phase !== 'casting' || reducedMotion) return { tip: restTip, lean: 0, arm: 0 };
  const tick = s.ticks;
  if (tick <= C.windupTick) {
    const u = ease(tick / C.windupTick);
    return { tip: swing(restTip, backTip, u), lean: -0.07 * u, arm: -0.32 * u };
  }
  if (tick <= C.releaseTick) {
    const u = ease((tick - C.windupTick) / (C.releaseTick - C.windupTick));
    return { tip: swing(backTip, releaseTip, u), lean: -0.07 + 0.15 * u, arm: -0.32 + 0.46 * u };
  }
  const followEnd = C.releaseTick + 12;
  if (tick <= followEnd) return { tip: swing(releaseTip, followTip, ease((tick - C.releaseTick) / 12)), lean: 0.08, arm: 0.14 };
  const u = ease((tick - followEnd) / (C.totalTicks - followEnd));
  return { tip: swing(followTip, restTip, u), lean: 0.08 * (1 - u), arm: 0.14 * (1 - u) };
}
export function splashAge(s: RoundState): number | null {
  if (s.phase === 'casting' && s.ticks >= C.impactTick) return (s.ticks - C.impactTick) / 60;
  if (s.phase === 'waiting' && s.ticks < 30) return (C.totalTicks - C.impactTick + s.ticks) / 60;
  return null;
}
/** Presentation derived from business ticks, never changes the selected species or rules. */
export function bobberPosition(s: RoundState, reducedMotion = false): Vec3 {
  const target = castPosition(s.spot ?? 'middle');
  if (s.phase === 'casting') {
    if (s.ticks < C.releaseTick) {
      const tip = castingPose(s, reducedMotion).tip;
      return { ...tip, y: tip.y - 0.22 };
    }
    const start = reducedMotion ? restTip : releaseTip;
    const u = Math.min(1, (s.ticks - C.releaseTick) / (C.impactTick - C.releaseTick));
    if (u === 1) return target;
    const height = s.spot === 'far' ? 1.8 : s.spot === 'near' ? 1 : 1.35;
    // Constant horizontal travel and a quadratic gravity arc, released from the animated tip.
    return { x: start.x + (target.x - start.x) * u, y: (start.y - 0.22) * (1 - u) + 4 * height * u * (1 - u), z: start.z + (target.z - start.z) * u };
  }
  const seconds = s.ticks / 60;
  // Brief nibble every two seconds; a real bite stays below the surface.
  const nibble = s.phase === 'waiting' && seconds % 2 > 1.65 ? -0.09 : 0;
  return { ...target, y: s.phase === 'bite' ? -0.32 : (reducedMotion ? 0 : Math.sin(seconds * 3) * 0.025) + nibble };
}
