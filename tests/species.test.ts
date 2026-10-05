import assert from 'node:assert/strict';
import { test } from 'node:test';
import { palette } from '../src/catalog/fish.ts';
import { habitats } from '../src/catalog/habitats.ts';
import { species, speciesDesign, speciesFor } from '../src/catalog/species.ts';
import { validateFishDesign } from '../src/domain/fish.ts';
import { baits, candidateWeights, spots } from '../src/domain/fishing.ts';

const colors = new Set<string>(palette.map((item) => item.value));

test('12 reviewed species, 6 per fishing scene, with sourced content (A27 content part)', () => {
  assert.equal(species.length, 12);
  assert.equal(new Set(species.map((item) => item.id)).size, 12);
  assert.equal(new Set(species.map((item) => item.scientificName)).size, 12);
  for (const habitat of habitats) assert.equal(speciesFor(habitat.id).length, 6, habitat.id);
  for (const item of species) {
    assert.equal(item.reviewStatus, 'verified', item.id);
    assert.match(item.id, /^[a-z0-9-]+$/);
    assert.ok(item.commonNameZh && item.scientificName.split(' ').length >= 2, item.id);
    for (const field of [item.appearance, item.realDiet, item.realHabitat, item.observation.question, item.observation.answer]) assert.ok(field.trim().length > 1, item.id);
    assert.ok(item.facts.length >= 1, `${item.id} needs a fact`);
    for (const fact of item.facts) {
      // 中国物种名录、中国动物志只提供 HTTP；其余来源均为 HTTPS。
      assert.match(fact.sourceUrl, /^https?:\/\//, item.id);
      assert.match(fact.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok([...fact.text].length <= 60, `${item.id} fact too long`);
    }
    assert.ok(item.sources.length >= 3 && item.sources.every((source) => /^https?:\/\//.test(source.url)));
    // 不沿用未经核实的概括。
    for (const text of [...item.facts.map((fact) => fact.text), item.appearance]) assert.doesNotMatch(text, /完美伪装|夜视|必然游得快/);
  }
});

test('every species renders as a valid fish with palette colors and its own part combination', () => {
  const combos = new Set<string>();
  for (const item of species) {
    const design = speciesDesign(item);
    assert.equal(validateFishDesign(design).ok, true, item.id);
    for (const value of [...Object.values(item.render.colors), item.render.pattern.primary, item.render.pattern.secondary]) assert.ok(colors.has(value), `${item.id} ${value}`);
    combos.add(JSON.stringify([design.bodyId, design.parts, design.colors, design.pattern]));
  }
  assert.equal(combos.size, species.length, 'no two species share one look');
});

test('in each scene every bait can catch something, with different distributions', () => {
  for (const habitat of habitats) {
    const distributions = baits.map((bait) => {
      const weights = candidateWeights(species.map((item) => ({ id: item.id, game: item.game, reviewStatus: item.reviewStatus })), habitat.id, bait.id, 'middle', 'calm');
      assert.ok(weights.length >= 3, `${habitat.id}/${bait.id}`);
      return JSON.stringify(weights.map((w) => [w.id, w.probability.toFixed(3)]));
    });
    assert.equal(new Set(distributions).size, 3, `${habitat.id} baits should differ`);
    for (const spot of spots) assert.ok(candidateWeights(species, habitat.id, 'shrimp', spot.id, 'calm').length > 0);
    assert.ok(new Set(speciesFor(habitat.id).map((item) => item.game.fightPattern)).size === 3, `${habitat.id} should use all three fight patterns`);
  }
});
