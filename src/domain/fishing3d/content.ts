import { speciesFor } from '../../catalog/species.ts';
import type { HabitatId } from '../types.ts';
import type { FightSample, Vec3 } from './state.ts';
import type { RoundContent } from './round.ts';
/** Explicit game behavior mapping, independent of biological facts. */
export const speciesActions: Readonly<Record<string, FightSample>> = {
  'amphiprion-ocellaris': 'weaver', 'zebrasoma-flavescens': 'weaver', 'paracanthurus-hepatus': 'sprinter',
  'forcipiger-flavissimus': 'diver', 'arothron-hispidus': 'weaver', 'zanclus-cornutus': 'sprinter',
  'sebastes-schlegelii': 'diver', 'acanthopagrus-schlegelii': 'sprinter', 'hexagrammos-otakii': 'weaver',
  'oplegnathus-fasciatus': 'diver', 'girella-punctata': 'weaver', 'sebastiscus-marmoratus': 'diver',
};
export const speciesMouth = (id: string): Vec3 => ({ x: id === 'forcipiger-flavissimus' ? 1.22 : id === 'zanclus-cornutus' ? 1.05 : 0.91, y: -0.055, z: 0 });
export function fishingContent(habitatId: HabitatId): RoundContent {
  const pool = speciesFor(habitatId);
  return { habitatId, pool, samples: Object.fromEntries(pool.map(f => [f.id, speciesActions[f.id]!])), mouthAnchors: Object.fromEntries(pool.map(f => [f.id, speciesMouth(f.id)])) };
}
