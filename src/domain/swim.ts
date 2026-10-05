import { finSets, tails } from '../catalog/fish.ts';
import type { FishDesign } from './types.ts';

// 游戏表现参数，不模拟真实流体力学；公式见技术设计第 6 节。
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export const SIM_STEP = 1 / 60;
export const MAX_STEPS_PER_FRAME = 5;

export interface SwimProfile { speed: number; turnRate: number; tailFrequency: number; tailAmplitude: number }
export function getSwimProfile(design: FishDesign): SwimProfile {
  const tail = tails.find((item) => item.id === design.parts.tailId);
  const fins = finSets.find((item) => item.id === design.parts.finId);
  if (!tail || !fins) throw new RangeError('Unknown part');
  const speed = clamp(0.6 + 0.9 * tail.animationProfile.thrust - 0.25 * (design.shape.height - 1), 0.4, 1.5);
  const turnRate = clamp(0.7 + 1.0 * fins.animationProfile.agility - 0.2 * (design.shape.length - 1), 0.5, 1.8);
  return { speed, turnRate, tailFrequency: 1.5 + (speed - 0.4) / 1.1 * 1.5, tailAmplitude: clamp(tail.animationProfile.amplitude, 0.08, 0.3) };
}

/** x、y 以身体长度为单位，tank 中心为 0；facing 在转向时从 ±1 平滑过渡。 */
export interface SwimState { time: number; x: number; heading: 1 | -1; turn: number | null; tailPhase: number }
export function createSwimState(): SwimState { return { time: 0, x: 0, heading: 1, turn: null, tailPhase: 0 }; }

export function turnDuration(profile: SwimProfile) { return Math.PI / (2 * profile.turnRate); }
/** 转身过程中仍向前滑行的距离（身长）；提前这么多开始转身，鱼不会冲出边界。 */
export function turnOvershoot(profile: SwimProfile) { return profile.speed * turnDuration(profile) / Math.PI; }

export function stepSwim(state: SwimState, profile: SwimProfile, halfWidth: number, dt = SIM_STEP, pace = 1): SwimState {
  // 转身时速度随朝向 cos 过渡：先减速到 0 再向反方向加速，不瞬间翻转。
  // 阈值再预留两步：一步是越过阈值的那一步，一步覆盖离散求和比积分多出的滑行。
  let { x, heading, turn } = state;
  const direction = turn === null ? heading : heading * Math.cos(Math.PI * turn);
  x += profile.speed * pace * direction * dt;
  if (turn !== null) {
    turn += dt / turnDuration(profile);
    if (turn >= 1) { turn = null; heading = heading === 1 ? -1 : 1; }
  } else if (heading * x >= Math.max(halfWidth - turnOvershoot(profile) - 2 * profile.speed * dt, 0)) turn = 0;
  const tailPhase = (state.tailPhase + 2 * Math.PI * profile.tailFrequency * (turn === null ? Math.max(pace, 0.35) : 0.7) * dt) % (2 * Math.PI);
  return { time: state.time + dt, x, heading, turn, tailPhase };
}
/** 渲染用朝向：转身过程中横向缩放 heading → cos 过渡，最小保留可见厚度。 */
export function swimFacing(state: SwimState): number {
  if (state.turn === null) return state.heading;
  const value = state.heading * Math.cos(Math.PI * state.turn);
  return Math.abs(value) < 0.08 ? Math.sign(value || -state.heading) * 0.08 : value;
}
export function swimBob(state: SwimState): number { return Math.sin(state.time * 1.3) * 0.06; }
export function tailAngle(state: SwimState, profile: SwimProfile): number { return Math.sin(state.tailPhase) * profile.tailAmplitude; }
/** 胸鳍摆动角：与尾巴错开相位，幅度小。 */
export function finAngle(state: SwimState): number { return Math.sin(state.time * 3.2 + 1.2) * 0.22; }

/** 固定步长累加：单帧最多补 MAX_STEPS_PER_FRAME 步，超出的积压丢弃。 */
export function fixedSteps(accumulator: number, delta: number): { steps: number; accumulator: number } {
  if (!Number.isFinite(delta) || delta <= 0) return { steps: 0, accumulator };
  let total = accumulator + delta;
  let steps = Math.floor(total / SIM_STEP + 1e-9);
  total -= steps * SIM_STEP;
  if (steps > MAX_STEPS_PER_FRAME) { steps = MAX_STEPS_PER_FRAME; total = 0; }
  return { steps, accumulator: Math.max(total, 0) };
}
