import type { BodyOutline, Axes } from './geometry.ts';
import type { FishDesign, Point, Bounds } from './types.ts';
export interface ArmRoot { x: number; y: number; length: number; radius: number; spread: number; curl: number; index: number }
export interface ArmSection extends Point { radius: number; nx: number; ny: number }
export const armSegments = 24;
/** Attachment stays just inside the current trunk, including direct sculpting. */
export function buildArmRoots(design: FishDesign, outline: BodyOutline, axes: Axes): ArmRoot[] {
  if (!design.arms) return [];
  const { count, length, curl } = design.arms;
  return Array.from({ length: count }, (_, index) => {
    const fraction = count === 1 ? .5 : index / (count - 1), s = .32 + fraction * .53;
    const radius = .027 * axes.x;
    return { x: outline.trunkX(s) * axes.x, y: outline.trunkBottom(s) * axes.y - radius * .65,
      length: length * axes.x, radius, spread: (fraction - .5) * 1.15, curl, index };
  });
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
