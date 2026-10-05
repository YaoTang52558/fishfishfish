import { Vector3 } from 'three';
import type { Vec3 } from '../../domain/fishing3d/state.ts';

/** G1 shore is at world Z=5.5. Domain +Z points offshore, world offshore is -Z. */
export const toWorld = (p: Vec3, target = new Vector3()) => target.set(p.x - 0.7, p.y, 5.5 - p.z);
