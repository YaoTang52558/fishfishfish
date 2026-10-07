import { SIM_STEP, stepSwim, swimFacing } from '../../domain/swim.ts';
import type { Point } from '../../domain/types.ts';
import { oceanPosition, type OceanFish, type Tank } from './sim.ts';

/** A play movement, not a claim about real fish behaviour. Only the transient simulation changes. */
export function followBubble(fish: OceanFish, target: Point, mouth: Point, tank: Tank, dt = SIM_STEP): { fish: OceanFish; arrived: boolean } {
  const position = oceanPosition(fish);
  const maxX = Math.max(0, tank.halfWidth - fish.bodyLength * .8);
  const maxY = Math.max(0, tank.halfHeight - fish.bodyLength * .5);
  const direction: 1 | -1 = target.x >= position.x ? 1 : -1;
  const closeX = Math.abs(target.x - position.x) <= Math.abs(mouth.x) + fish.bodyLength * .12;
  const goalX = closeX ? position.x : Math.max(-maxX, Math.min(maxX, target.x - direction * mouth.x));
  const goalY = Math.max(-maxY, Math.min(maxY, target.y - mouth.y));
  let swim = fish.swim;
  if (swim.turn === null && Math.abs(target.x - position.x) > .08 * fish.bodyLength && direction !== swim.heading) swim = { ...swim, turn: 0 };
  const pace = Math.min(1, Math.abs(goalX - position.x) / (fish.bodyLength * .45));
  const next = stepSwim(swim, fish.profile, Math.max(0, tank.halfWidth / fish.bodyLength - .8), dt, pace);
  next.x = Math.max(-maxX / fish.bodyLength, Math.min(maxX / fish.bodyLength, next.x));
  const speed = fish.profile.speed * fish.bodyLength;
  const y = fish.y + Math.max(-speed * dt, Math.min(speed * dt, (goalY - fish.y) * 2 * dt));
  const guided = { ...fish, swim: next, y: Math.max(-maxY, Math.min(maxY, y)), targetY: goalY, mode: 'cruise' as const, timer: 3 };
  const p = oceanPosition(guided);
  const mouthX = p.x + mouth.x * swimFacing(next), mouthY = p.y + mouth.y;
  const arrived = next.turn === null && (Math.hypot(mouthX - target.x, mouthY - target.y) <= fish.bodyLength * .18
    || (Math.abs(p.x - target.x) <= Math.abs(mouth.x) + fish.bodyLength * .12 && Math.abs(mouthY - target.y) <= fish.bodyLength * .18 && Math.abs(swimFacing(next)) === 1));
  return { fish: guided, arrived };
}
