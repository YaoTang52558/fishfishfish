/** Observation content is independent of the game catalog and fishing pool. */
export interface ObservationPoint {
  key: string;
  label: string;
  text: string;
  audio: string;
  x: number | null;
  y: number | null;
  factIds: string[];
}
export interface ObservationFish {
  id: string;
  name: string;
  formalName: string;
  scientificName: string;
  group?: string;
  image: string;
  intro: [string, string[]];
  introAudio: string;
  invite: string;
  parent: string;
  points: ObservationPoint[];
  sourceIds: string[];
  factIds: string[];
}
export interface ObservationContent {
  date: string;
  fish: ObservationFish[];
  sources: { id: string; institution: string; title: string; url: string }[];
  claims: { id: string; text: string; conditions: string; sourceIds: string[]; subjectId: string }[];
  host: { id: string; name: string; scientificName: string; image: string; audio: string; factIds: string[] };
}

export const contentAsset = (file: string) => `${import.meta.env.BASE_URL}content/v1/${file}`;
const starterIds = new Set(['amphiprion-ocellaris', 'epinephelus-merra', 'scarus-ghobban', 'ostracion-cubicus', 'hippocampus-kuda', 'mobula-birostris']);
export type ObservationGroup = 'starter' | 'grouper' | 'all';
export const observationGroups: { id: ObservationGroup; label: string; icon: string }[] = [
  { id: 'starter', label: '先看看', icon: '🐟' },
  { id: 'grouper', label: '石斑', icon: '🔵' },
  { id: 'all', label: '全部', icon: '🌊' },
];
export function observationFish(fish: ObservationFish[], group: ObservationGroup) {
  return fish.filter(item => group === 'all' || (group === 'grouper' ? item.group === 'grouper' : starterIds.has(item.id)));
}

let pending: Promise<ObservationContent> | null = null;
/** Load when requested; failed requests can be retried without reloading the workshop. */
export function loadObservationContent(): Promise<ObservationContent> {
  if (!pending) pending = fetch(contentAsset('data.json')).then(async response => {
    if (!response.ok) throw new Error('Observation content unavailable');
    const data = await response.json() as ObservationContent;
    if (!Array.isArray(data.fish) || !data.fish.length) throw new Error('Observation content empty');
    return data;
  }).catch(error => { pending = null; throw error; });
  return pending;
}
