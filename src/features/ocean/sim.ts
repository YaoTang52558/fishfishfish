import { seededRandom } from '../../domain/fish.ts';
import { createSwimState, SIM_STEP, stepSwim, type SwimProfile, type SwimState } from '../../domain/swim.ts';

/*
 * 海洋巡游（游戏表现，不是生态模拟）：每条鱼在 巡游 → 停留 → 转身 → 巡游 之间切换。
 * 坐标以“世界单位”计，默认身长 1 的鱼长 1 个单位；水箱中心为原点。
 * 离开页面后不在后台推进，也不累计游动距离。
 */
export type OceanMode = 'cruise' | 'idle' | 'turn';
export interface OceanFish {
  id: string;
  swim: SwimState;
  y: number;
  targetY: number;
  mode: 'cruise' | 'idle';
  timer: number;
  bodyLength: number;
  profile: SwimProfile;
  random: () => number;
}
export interface Tank { halfWidth: number; halfHeight: number }

export function createOceanFish(id: string, profile: SwimProfile, bodyLength: number, tank: Tank, seed: number): OceanFish {
  const random = seededRandom(seed);
  const swim = createSwimState();
  swim.x = (random() * 2 - 1) * tank.halfWidth * 0.8;
  swim.heading = random() < 0.5 ? 1 : -1;
  swim.tailPhase = random() * Math.PI * 2;
  const y = (random() * 2 - 1) * tank.halfHeight * 0.7;
  return { id, swim, y, targetY: y, mode: 'cruise', timer: 3 + random() * 4, bodyLength, profile, random };
}

export function oceanMode(fish: OceanFish): OceanMode { return fish.swim.turn !== null ? 'turn' : fish.mode; }

export function stepOceanFish(fish: OceanFish, tank: Tank, dt = SIM_STEP): OceanFish {
  const { random } = fish;
  // stepSwim 以身长为单位；水箱半宽按这条鱼的身长换算，并留出身体半长。
  const halfWidthBL = Math.max(0, tank.halfWidth / fish.bodyLength - 0.6);
  let mode = fish.mode, timer = fish.timer - dt, targetY = fish.targetY;
  const pace = mode === 'idle' ? 0.12 : 1;
  const xBL = fish.swim.x;
  const swim = stepSwim({ ...fish.swim, x: xBL }, fish.profile, halfWidthBL, dt, pace);
  if (timer <= 0 && swim.turn === null) {
    if (mode === 'cruise' && random() < 0.35) { mode = 'idle'; timer = 1.5 + random() * 1.5; }
    else {
      if (mode === 'idle' && random() < 0.4) swim.turn = 0; // 停留后偶尔原地转身
      mode = 'cruise'; timer = 3 + random() * 5;
      const margin = Math.min(tank.halfHeight * 0.85, Math.max(0, tank.halfHeight - fish.bodyLength * 0.5));
      targetY = (random() * 2 - 1) * margin;
    }
  }
  const y = fish.y + (targetY - fish.y) * Math.min(1, dt * (mode === 'idle' ? 0.2 : 0.6));
  return { ...fish, swim, y, targetY, mode, timer };
}
/** 世界坐标中的鱼位置。 */
export function oceanPosition(fish: OceanFish) { return { x: fish.swim.x * fish.bodyLength, y: fish.y }; }
