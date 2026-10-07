import { FIGHT_CONFIG as C, FIGHT_SIZE } from './config.ts';
import { challengeRules, type Challenge } from '../growth.ts';
import { distanceToShore, mouthPosition } from './state.ts';
import type { ActiveAction, FightInput, FightSample, FightSize, FightState3D, Vec3 } from './state.ts';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const magnitude = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const unit = (v: Vec3): Vec3 => { const length = magnitude(v) || 1; return { x: v.x / length, y: v.y / length, z: v.z / length }; };
function random(state: FightState3D) {
  let value = state.seed;
  value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
  state.seed = value >>> 0;
  return state.seed / 0x100000000;
}
function chooseAction(state: FightState3D): ActiveAction {
  const roll = random(state);
  const primary = { sprinter: 'sprint', weaver: 'lateral', diver: 'dive' } as const;
  const others = (['sprint', 'lateral', 'dive'] as const).filter((action) => action !== primary[state.sample]);
  return roll < 0.72 ? primary[state.sample] : others[roll < 0.86 ? 0 : 1]!;
}
function direction(state: FightState3D): Vec3 {
  const action = state.action === 'telegraph' ? state.nextAction : state.action;
  if (action === 'sprint') return unit({ x: state.lateralSign * 0.28, y: 0.04, z: 1 });
  if (action === 'lateral') return unit({ x: state.lateralSign, y: 0, z: 0.15 });
  if (action === 'dive') return unit({ x: state.lateralSign * 0.18, y: -0.83, z: 0.55 });
  return unit({ x: 1, y: 0, z: 0.12 });
}
function changeAction(state: FightState3D) {
  if (state.action === 'rest') {
    state.nextAction = chooseAction(state); state.lateralSign = random(state) < 0.5 ? -1 : 1;
    state.action = 'telegraph'; state.actionTicks = 36;
  } else if (state.action === 'telegraph') {
    state.action = state.nextAction; state.actionTicks = state.action === 'lateral' ? 144 : state.action === 'dive' ? 150 : 120;
  } else { state.action = 'rest'; state.actionTicks = 210; }
}
export function createFight(sample: FightSample = 'sprinter', seed = 0x739a2b1, size: FightSize = 'small', mouthAnchor: Vec3 = { x: 0.91, y: -0.055, z: 0 }): FightState3D {
  if (!['sprinter', 'weaver', 'diver'].includes(sample) || !Number.isFinite(seed) || !['small', 'large'].includes(size)) throw new Error('Invalid fight configuration');
  const state: FightState3D = {
    phase: 'fighting', sample, seed: (seed >>> 0) || 1, size, reeling: false, reelTurns: 0, mouthAnchor: { ...mouthAnchor },
    fishPosition: { x: 0.7, y: -1.35, z: 4.1 }, fishVelocity: { x: 0, y: 0, z: 0 }, fishHeading: { x: 1, y: 0, z: 0 },
    rodTip: { x: 0, y: 2.1, z: -0.15 }, rodAxis: 0,
    lineLength: 0, tension: 0, fatigue: 0.05,
    action: 'rest', actionTicks: 150, nextAction: 'sprint', lateralSign: 1,
    breakTicks: 0, elapsedTicks: 0, escapeReason: null,
  };
  const hook = mouthPosition(state);
  state.lineLength = Math.hypot(hook.x - state.rodTip.x, hook.y - state.rodTip.y, hook.z - state.rodTip.z);
  return state;
}

/** Exactly one fixed step. Input is copied/validated at the boundary; no Vue, DOM or Three.js. */
export function stepFight(state: FightState3D, input: FightInput, assist = false, challenge: Challenge = 'regular'): FightState3D {
  if (state.phase !== 'fighting') return state;
  if (!Number.isFinite(input.rodAxis) || typeof input.reel !== 'boolean') throw new Error('Invalid fight input');
  const s: FightState3D = { ...state, fishPosition: { ...state.fishPosition }, fishVelocity: { ...state.fishVelocity }, fishHeading: { ...state.fishHeading }, rodTip: { ...state.rodTip } };
  const dt = C.step, size = FIGHT_SIZE[s.size];
  const difficulty = challengeRules[challenge];
  s.reeling = input.reel;
  s.elapsedTicks++; s.actionTicks--;
  if (s.actionTicks <= 0) changeAction(s);
  const headingTarget = direction(s);
  s.fishHeading = unit({ x: s.fishHeading.x + (headingTarget.x - s.fishHeading.x) * dt * 5, y: s.fishHeading.y + (headingTarget.y - s.fishHeading.y) * dt * 5, z: s.fishHeading.z + (headingTarget.z - s.fishHeading.z) * dt * 5 });
  s.rodAxis += (clamp(input.rodAxis, -1, 1) - s.rodAxis) * dt * 6;
  const bend = clamp(state.tension, 0, 1.5);
  s.rodTip = {
    x: state.rodTip.x + (s.rodAxis * 1.35 - state.rodTip.x) * dt * 6,
    y: state.rodTip.y + (2.1 - bend * 0.35 - state.rodTip.y) * dt * 6,
    z: state.rodTip.z + (-0.15 + bend * 0.18 - state.rodTip.z) * dt * 6,
  };
  if (input.reel) s.lineLength = Math.max(C.minLine, s.lineLength - C.reelSpeed * dt);
  else s.lineLength = Math.min(C.maxLine, s.lineLength + C.payoutSpeed * clamp(state.tension, 0, 1) * dt);
  s.reelTurns += Math.max(0, state.lineLength - s.lineLength) / 0.45;
  const hook = mouthPosition(s), delta = { x: hook.x - s.rodTip.x, y: hook.y - s.rodTip.y, z: hook.z - s.rodTip.z };
  const distance = magnitude(delta), n = unit(delta);
  const rodVelocity = { x: (s.rodTip.x - state.rodTip.x) / dt, y: (s.rodTip.y - state.rodTip.y) / dt, z: (s.rodTip.z - state.rodTip.z) / dt };
  const axialSpeed = (s.fishVelocity.x - rodVelocity.x) * n.x + (s.fishVelocity.y - rodVelocity.y) * n.y + (s.fishVelocity.z - rodVelocity.z) * n.z;
  const stretch = Math.max(0, distance - s.lineLength);
  const force = stretch > 0 ? Math.max(0, C.spring * stretch + C.damping * axialSpeed) : 0;
  s.tension = force / C.breakForce;
  const active = s.action !== 'rest' && s.action !== 'telegraph';
  const power = (s.action === 'sprint' ? 9 : s.action === 'lateral' ? 7 : s.action === 'dive' ? 11 : 0.25) * (1 - s.fatigue * 0.82) * size.power * difficulty.power;
  const preferredDepth = -1.2 + s.fatigue;
  const acceleration = {
    x: (headingTarget.x * power - n.x * force - C.drag * s.fishVelocity.x) / (C.mass * size.mass),
    y: (headingTarget.y * power - n.y * force - C.drag * s.fishVelocity.y + (preferredDepth - s.fishPosition.y) * 0.45) / (C.mass * size.mass),
    z: (headingTarget.z * power - n.z * force - C.drag * s.fishVelocity.z) / (C.mass * size.mass),
  };
  s.fishVelocity.x += acceleration.x * dt; s.fishVelocity.y += acceleration.y * dt; s.fishVelocity.z += acceleration.z * dt;
  const speed = magnitude(s.fishVelocity);
  if (speed > C.speedLimit) { const factor = C.speedLimit / speed; s.fishVelocity.x *= factor; s.fishVelocity.y *= factor; s.fishVelocity.z *= factor; }
  for (const axis of ['x', 'y', 'z'] as const) {
    s.fishPosition[axis] += s.fishVelocity[axis] * dt;
    // Body-centre clearance accounts for the prototype's fins/head, not just its origin.
    const [low, high] = axis === 'x' ? [-5.5, 5.5] : axis === 'y' ? [-2.2, -0.45] : [0.12, 14];
    if (s.fishPosition[axis] < low!) { s.fishPosition[axis] = low!; s.fishVelocity[axis] = Math.max(0, s.fishVelocity[axis]); }
    if (s.fishPosition[axis] > high!) { s.fishPosition[axis] = high!; s.fishVelocity[axis] = Math.min(0, s.fishVelocity[axis]); }
  }
  s.fatigue = clamp(s.fatigue + (C.fatigueForceRate * Math.min(s.tension, 1.4) + (active ? C.fatigueActionRate : -C.restRecoveryRate)) * dt / (size.stamina * difficulty.stamina), 0, 1);
  s.breakTicks = s.tension > 1 ? s.breakTicks + 1 : Math.max(0, s.breakTicks - 2);
  if (s.breakTicks >= Math.ceil((assist ? 2 : C.breakSeconds) * difficulty.breakWindow / dt)) { s.phase = 'escaped'; s.escapeReason = 'line'; }
  else if (distanceToShore(s) <= C.landingRadius && s.fishPosition.y >= C.landingDepth && s.fatigue >= C.landingFatigue) { s.phase = 'landing'; s.fishVelocity = { x: 0, y: 0, z: 0 }; }
  else if (s.elapsedTicks >= Math.ceil(C.timeoutSeconds * size.timeout * difficulty.time / dt)) { s.phase = 'escaped'; s.escapeReason = 'timeout'; }
  if (s.phase !== 'fighting') s.reeling = false;
  return s;
}

export function landFish(state: FightState3D): FightState3D {
  return state.phase === 'landing' ? { ...state, phase: 'caught' } : state;
}

export function fightHint(state: FightState3D, surface = false): string {
  if (state.phase === 'caught') return '轻轻抄起了！可以换个动作样本，再练一次。';
  if (state.phase === 'landing') return '已经到岸边了，轻轻抄起。';
  if (state.phase === 'escaped') return state.escapeReason === 'line' ? '拉得太紧，它挣脱了。冲刺和下潜时先松线。' : '这次游得有点远，换个节奏再试试。';
  if (state.action === 'telegraph') return state.nextAction === 'dive' ? (surface ? '浮漂开始下沉，准备松线。' : '鱼头向下了，准备松线。') : state.nextAction === 'lateral' ? `它准备向${state.lateralSign < 0 ? '左' : '右'}横游，向另一边控竿。` : (surface ? '水花变急了，准备松线。' : '尾巴摆快了，准备松线。');
  if (state.action === 'rest') return '它正在喘息，稳住竿，慢慢收线。';
  if (state.action === 'lateral') return `它向${state.lateralSign < 0 ? '左' : '右'}横游，向另一边控竿。`;
  return state.action === 'dive' ? '它在下潜，先松线，等它上浮。' : '它在冲刺，先松线。';
}
