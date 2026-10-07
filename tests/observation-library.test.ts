import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { observationFish, creatureCategory, type ObservationFish } from '../src/features/inspiration/content.ts';
import { fishRecipe } from '../src/features/inspiration/recipes.ts';
const data=JSON.parse(fs.readFileSync('public/content/v1/data.json','utf8')) as {fish:ObservationFish[]};
test('expanded library separates observation, stone groupers and non-fish creative inspiration',()=>{
  assert.equal(data.fish.length,119);
  assert.equal(observationFish(data.fish,'starter').length,6);
  assert.equal(observationFish(data.fish,'grouper').length,6);
  const others=observationFish(data.fish,'marine');assert.equal(others.length,39);assert.ok(others.every(c=>creatureCategory(c)!=='fish'));
  assert.ok(data.fish.find(c=>c.id==='caranx-ignobilis')?.aliases?.includes('GT'));
  assert.ok(data.fish.find(c=>c.id==='babylonia-areolata')?.aliases?.includes('花螺'));
});
test('all observation companions have independent creative palettes without changing existing patterns',()=>{
  for(const f of data.fish){const recipe=fishRecipe(f.id);assert.ok(recipe,f.id);assert.ok(Object.values(recipe.colors).every(c=>/^#[\dA-F]{6}$/i.test(c)));}
  assert.equal(fishRecipe('amphiprion-ocellaris')?.pattern?.id,'clown-bands');
  assert.equal(fishRecipe('octopus-vulgaris')?.pattern,undefined);
  assert.equal(fishRecipe('not-a-species'),null);
});
