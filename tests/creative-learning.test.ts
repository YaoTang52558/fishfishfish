import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { creativeTopics, topicAudio } from '../src/features/inspiration/creativeTopics.ts';
import { fishRecipe } from '../src/features/inspiration/recipes.ts';
import type { ObservationFish, ObservationPoint } from '../src/features/inspiration/content.ts';
const data = JSON.parse(fs.readFileSync('public/content/v1/data.json', 'utf8')) as {
  fish: ObservationFish[]; claims: {id: string; status: string; sourceIds: string[]}[];
  sources: {id: string}[]; clips: {file: string; factIds: string[]; text: string}[];
};
test('creation topics and their narration trace every selected feature to checked observation facts', () => {
  assert.equal(Object.keys(creativeTopics).length, 7);
  for (const [id, topic] of Object.entries(creativeTopics)) {
    const clip = data.clips.find(c => c.file === topicAudio(id as keyof typeof creativeTopics));
    assert.ok(clip); assert.equal(clip.text, topic.narration);
    for (const example of topic.examples) {
      const fish = data.fish.find(f => f.id === example.id); assert.ok(fish);
      for (const key of example.keys) {
        const point: ObservationPoint | undefined = fish.points.find(p => p.key === key); assert.ok(point, `${example.id}/${key}`);
        const factIds: string[] = point.factIds;
        for (const factId of factIds) {
          const fact: typeof data.claims[number] | undefined = data.claims.find(c => c.id === factId); assert.equal(fact?.status, 'checked');
          assert.ok(fact?.sourceIds.every(s => data.sources.some(source => source.id === s)));
          assert.ok(clip.factIds.includes(factId));
        }
      }
    }
  }
});
test('common child names remain searchable by formal name without merging different species', () => {
  for (const id of ['penaeus-monodon', 'paralithodes-camtschaticus', 'babylonia-areolata', 'magallana-gigas']) {
    const fish = data.fish.find(f => f.id === id)!;
    assert.ok(!fish.name.includes('（')); assert.ok(fish.aliases?.includes(fish.formalName));
    assert.ok(fish.intro[0].startsWith(`这是${fish.name}。`));
    assert.equal(data.clips.find(c => c.file === fish.introAudio)?.text, fish.intro[0]);
  }
  assert.equal(data.fish.find(f => f.id === 'babylonia-areolata')?.name, '花螺');
  assert.notEqual(data.fish.find(f => f.id === 'loligo-vulgaris')?.name, data.fish.find(f => f.id === 'sepioteuthis-lessoniana')?.name);
  assert.equal(fishRecipe('penaeus-monodon')?.pattern?.id, 'bands');
  assert.equal(fishRecipe('babylonia-areolata')?.pattern?.id, 'spots');
});
