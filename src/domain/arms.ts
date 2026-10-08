import type { BodyOutline, Axes } from './geometry.ts';
import type { ArmPose, FishDesign, Point, Bounds } from './types.ts';
import { armPoseLimits } from '../catalog/fish.ts';
export interface ArmRoot { x: number; y: number; length: number; radius: number; spread: number; curl: number; index: number }
export interface ArmSection extends Point { radius: number; nx: number; ny: number }
export const armSegments = 24;
export function defaultArmPose(arms: NonNullable<FishDesign['arms']>, index: number): ArmPose {
  const fraction = arms.count === 1 ? .5 : index / (arms.count - 1);
  return { position: .32 + fraction * .53, angle: (fraction - .5) * 1.15, length: arms.length, curl: arms.curl };
}
export function getArmPoses(design: FishDesign): ArmPose[] {
  return design.arms ? Array.from({ length: design.arms.count }, (_, index) => ({ ...(design.arms!.poses?.[index] ?? defaultArmPose(design.arms!, index)) })) : [];
}
/** Attachment stays just inside the current trunk, including direct sculpting. */
export function buildArmRoots(design: FishDesign, outline: BodyOutline, axes: Axes): ArmRoot[] {
  if (!design.arms) return [];
  return getArmPoses(design).map((pose, index) => {
    const s = pose.position;
    const radius = .027 * axes.x;
    return { x: outline.trunkX(s) * axes.x, y: outline.trunkBottom(s) * axes.y - radius * .65,
      length: pose.length * axes.x, radius, spread: pose.angle, curl: pose.curl, index };
  });
}
/** Solve the static endpoint using the same sampled centerline as drawing. */
export function poseForArmTip(root: ArmRoot, point: Point, bodyLength: number): Pick<ArmPose, 'length' | 'angle'> {
  const end = armSections({ ...root, x: 0, y: 0, spread: 0, length: 1 }).at(-1)!;
  const dx = point.x - root.x, dy = point.y - root.y;
  const raw = Math.atan2(dx, dy) - Math.atan2(end.x, end.y);
  const wrapped = Math.atan2(Math.sin(raw), Math.cos(raw));
  return { length: Math.max(armPoseLimits.length.min, Math.min(armPoseLimits.length.max, Math.hypot(dx, dy) / Math.hypot(end.x, end.y) / bodyLength)),
    angle: Math.max(armPoseLimits.angle.min, Math.min(armPoseLimits.angle.max, wrapped)) };
}
/** Fixed editing envelope, sampled once for both curl directions. Half-step
 * errors are <= .025 (angle) + .068 (curl) times the total length. */
let poseEnvelope: Bounds | null = null;
export function getArmPoseEnvelope(): Bounds {
  if (poseEnvelope) return poseEnvelope;
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const index of [0,1]) for (let a = 0; a <= 54; a++) for (let c = 0; c <= 10; c++) {
    const root = { x: 0, y: 0, length: 1, radius: 0, index, spread: armPoseLimits.angle.min + a * .05, curl: c / 10 };
    for (const p of armSections(root)) {
      bounds.minX = Math.min(bounds.minX,p.x); bounds.maxX = Math.max(bounds.maxX,p.x);
      bounds.minY = Math.min(bounds.minY,p.y); bounds.maxY = Math.max(bounds.maxY,p.y);
    }
  }
  return poseEnvelope = { minX: bounds.minX-.1, maxX: bounds.maxX+.1, minY: bounds.minY-.1, maxY: bounds.maxY+.1 };
}
/** Shared centerline for the 2D outline and 3D tube. Motion is a game animation. */
export function armSections(root: ArmRoot, time = 0, animated = false): ArmSection[] {
  let x = root.x, y = root.y;
  const direction = root.index % 2 ? -1 : 1;
  return Array.from({ length: armSegments + 1 }, (_, step) => {
    const t = step / armSegments;
    const sway = animated ? Math.sin(time * 1.8 + root.index * .8 - t * 3) * .16 * t + Math.sin(time * .9 + root.index) * .04 * t : 0;
    const angle = root.spread + direction * root.curl * 3.8 * t * t + sway;
    if (step) { x += Math.sin(angle) * root.length / armSegments; y += Math.cos(angle) * root.length / armSegments; }
    return { x, y, nx: Math.cos(angle), ny: -Math.sin(angle), radius: root.radius * (1 - .94 * t) };
  });
}
export function armPolygon(root: ArmRoot, time = 0, animated = false): Point[] {
  const sections = armSections(root, time, animated);
  return [...sections.map(p => ({ x: p.x + p.nx * p.radius, y: p.y + p.ny * p.radius })),
    ...sections.slice().reverse().map(p => ({ x: p.x - p.nx * p.radius, y: p.y - p.ny * p.radius }))];
}
/** A 0.2-radian sway displaces any centerline point by at most 0.2 * length. */
export function includeArmBounds(bounds: Bounds, roots: ArmRoot[], extraPad = 0, animated = true) {
  for (const root of roots) {
    const pad = root.length * ((animated ? .21 : 0) + extraPad) + root.radius + .01;
    for (const p of armSections(root)) {
      bounds.minX = Math.min(bounds.minX, p.x - pad); bounds.maxX = Math.max(bounds.maxX, p.x + pad);
      bounds.minY = Math.min(bounds.minY, p.y - pad); bounds.maxY = Math.max(bounds.maxY, p.y + pad);
    }
  }
}
