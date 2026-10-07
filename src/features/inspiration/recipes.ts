import type { FishDesign } from '../../domain/types.ts';

export type BorrowKind = 'colors' | 'pattern';
export interface FishRecipe { colors: FishDesign['colors']; pattern?: FishDesign['pattern'] }
// Creative approximations using the workshop palette, not biological colour measurements.
const orange = '#F4BA75', cream = '#FFF3D9', gold = '#EAC779', blue = '#24486B';
const grey = '#758F89', aqua = '#8AAFB0', coral = '#E9A598', olive = '#9EAF91';
const schemes: Record<string, [string, string, string, string]> = {
  'amphiprion-ocellaris': [orange, orange, blue, orange],
  'forcipiger-flavissimus': [gold, gold, gold, cream],
  'arothron-hispidus': [olive, olive, cream, grey],
  'zebrasoma-flavescens': [gold, gold, gold, gold],
  'paracanthurus-hepatus': [aqua, blue, blue, gold],
  'zanclus-cornutus': [cream, blue, gold, blue],
  'sebastes-schlegelii': [grey, grey, blue, grey],
  'acanthopagrus-schlegelii': [grey, grey, blue, grey],
  'hexagrammos-otakii': [olive, olive, gold, grey],
  'oplegnathus-fasciatus': [cream, cream, grey, grey],
  'girella-punctata': [grey, grey, blue, blue],
  'sebastiscus-marmoratus': [coral, coral, orange, coral],
  'epinephelus-coioides': [olive, olive, orange, olive],
  'plectropomus-leopardus': [coral, coral, coral, coral],
  'epinephelus-fuscoguttatus': [olive, olive, grey, grey],
  'epinephelus-merra': [cream, olive, olive, olive],
  'epinephelus-lanceolatus': [grey, grey, olive, grey],
  'cephalopholis-argus': [olive, olive, grey, grey],
  'caranx-ignobilis': [grey, grey, blue, grey],
  'sphyraena-barracuda': [aqua, grey, grey, grey],
  'lates-calcarifer': [grey, grey, olive, grey],
  'scomberomorus-commerson': [aqua, grey, blue, grey],
  'scarus-ghobban': [orange, orange, aqua, aqua],
  'pomacanthus-imperator': [blue, blue, gold, gold],
  'trichiurus-lepturus': [aqua, grey, aqua, grey],
  'ostracion-cubicus': [gold, gold, gold, gold],
  'hippocampus-kuda': [gold, orange, cream, gold],
  'gadus-morhua': [olive, olive, grey, olive],
  'thunnus-albacares': [aqua, grey, gold, gold],
  'mobula-birostris': [blue, blue, blue, blue],
};
const motifs: Record<string, FishDesign['pattern']> = {
  'amphiprion-ocellaris': { id: 'clown-bands', primary: cream, secondary: blue },
  'epinephelus-coioides': { id: 'grouper-spots', primary: orange, secondary: grey },
  'plectropomus-leopardus': { id: 'grouper-spots', primary: aqua, secondary: blue },
  'cephalopholis-argus': { id: 'grouper-spots', primary: aqua, secondary: blue },
  'epinephelus-merra': { id: 'honeycomb', primary: olive, secondary: cream },
};
export function fishRecipe(id: string): FishRecipe | null {
  const colors = schemes[id];
  if (!colors) return null;
  return { colors: { body: colors[0], head: colors[1], fin: colors[2], tail: colors[3] },
    ...(motifs[id] ? { pattern: { ...motifs[id], size: 1, density: 1 } } : {}) };
}
