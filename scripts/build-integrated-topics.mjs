import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const content = JSON.parse(readFileSync('public/content/v1/data.json', 'utf8'));
const definitions = [
  ['mouth', '嘴与找食物', ['forcipiger-flavissimus', 'scarus-ghobban'], ['MOUTH', 'FOOD']],
  ['fin', '鳍的结构', ['zanclus-cornutus', 'sphyraena-barracuda'], ['FIN', 'FINS']],
  ['tail', '不同的尾部', ['hippocampus-kuda', 'trichiurus-lepturus'], ['TAIL']],
  ['shape', '盒子和大翅膀', ['ostracion-cubicus', 'mobula-birostris'], ['BODY', 'FINS']],
  ['reef', '珊瑚、海葵与伙伴', ['amphiprion-ocellaris'], ['HOME']],
  ['rock', '守卵与礁底家园', ['hexagrammos-otakii', 'sebastiscus-marmoratus'], ['EGGS', 'HOME']],
];
const topics = definitions.map(([id, title, subjects, keys]) => ({ id, title, specimens: subjects.map(subject => {
  const fish = content.fish.find(f => f.id === subject); assert.ok(fish, subject);
  const points = fish.points.filter(p => keys.includes(p.key)); assert.ok(points.length, subject);
  const factIds = [...new Set(points.flatMap(p => p.factIds))];
  const facts = factIds.map(id => { const fact = content.claims.find(c => c.id === id); assert.ok(fact && fact.status === 'checked', id); assert.ok(fact.sourceIds.every(source => content.sources.some(s => s.id === source))); return { id, text: fact.text, conditions: fact.conditions, checkedAt: fact.checkedAt, sourceIds: fact.sourceIds }; });
  return { id: fish.id, name: fish.name, scientificName: fish.scientificName, image: fish.image, introAudio: fish.introAudio, points, facts };
}) }));
const environment = ['RF-01', 'RF-02', 'RF-03', ...content.host.factIds].filter((id, i, arr) => arr.indexOf(id) === i).map(id => { const c = content.claims.find(c => c.id === id); assert.ok(c && c.status === 'checked', id); return c; });
const used = new Set([...topics.flatMap(t => t.specimens.flatMap(f => f.facts.flatMap(c => c.sourceIds))), ...environment.flatMap(c => c.sourceIds)]);
const result = { date: '2026-10-07', status: 'integrated-playable-sample', producedSpecies: 30, fishingSpecies: 12, remainingCandidatesProduced: false, topics, environment, sources: content.sources.filter(s => used.has(s.id)), model: { type: 'procedural-original-design', mirroredSide: true, finStructure: 'flat-paired-pectoral-and-dorsal-ventral', swimming: 'game-animation-not-species-science' } };
writeFileSync('docs/content/research/integrated-topics.json', JSON.stringify(result, null, 2) + '\n'); console.log(`Indexed ${topics.length} themes with checked facts and source links.`);
