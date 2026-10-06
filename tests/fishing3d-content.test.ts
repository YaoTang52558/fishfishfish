import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { species } from '../src/catalog/species.ts';
import { candidateWeights } from '../src/domain/fishing.ts';
import { fishingContent, speciesMouth } from '../src/domain/fishing3d/content.ts';
import { commandRound, createRound, stepRound } from '../src/domain/fishing3d/round.ts';
import { createRoundSession } from '../src/features/fishing3d/round.ts';
test('G4 两钓场所有已审核物种都有明确动作与模型，三饵三落点均有候选',()=>{
  for(const habitat of ['reef-edge','coastal-rock'] as const){const c=fishingContent(habitat);assert.equal(c.pool.length,6);
    for(const f of c.pool){assert.ok(c.samples[f.id]);assert.deepEqual(c.mouthAnchors![f.id],speciesMouth(f.id));}
    for(const bait of ['shrimp','algae','lure'] as const)for(const spot of ['near','middle','far'] as const)assert.ok(candidateWeights(c.pool,habitat,bait,spot,'calm').length>0);
  }
});
test('G4 每种鱼与三个落点的正确收放策略可抄起；物种大小和嘴锚点不被替换',()=>{
 for(const fish of species)for(const spot of ['near','middle','far'] as const)for(let seed=1;seed<=5;seed++){
  const content={...fishingContent(fish.game.habitatId),pool:[fish]};let s=commandRound(createRound(seed),{type:'cast',bait:'shrimp',spot,attemptId:'model-'+fish.id,seed},content);
  while(s.phase==='casting'||s.phase==='waiting')s=stepRound(s);s=commandRound(s,{type:'pull'},content);
  assert.equal(s.fight!.size,fish.game.size);assert.deepEqual(s.fight!.mouthAnchor,speciesMouth(fish.id));
  while(s.phase==='fighting'){const f=s.fight!,a=f.action==='telegraph'?f.nextAction:f.action;s=stepRound(s,{reel:['rest','lateral'].includes(a)&&f.tension<.9,rodAxis:a==='lateral'?-f.lateralSign:0});}
  assert.equal(s.phase,'landing',`${fish.id}/${spot}/${seed}/${s.escape}`);s=commandRound(s,{type:'land'},content);assert.equal(s.speciesId,fish.id);
 }
});
test('G4 GLB 文件符合清单、嘴锚点和动画契约，单鱼不超过 8k 三角形',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../public/models/fishing/asset-manifest.json',import.meta.url),'utf8'));assert.equal(manifest.assets.length,12);let total=0;
 for(const item of manifest.assets){const bytes=readFileSync(new URL('../public/'+item.path,import.meta.url));assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.length,item.bytes);assert.ok(item.triangles<=8000);assert.deepEqual(item.mouthAnchor,speciesMouth(item.id));
  const size=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+size).toString());assert.ok(gltf.nodes.some((n:{name:string})=>n.name==='tail'));const mouth=gltf.nodes.find((n:{name:string})=>n.name==='mouth');assert.ok(Math.abs(mouth.translation[0]+.018-item.mouthAnchor.x)<1e-6);assert.ok(gltf.animations.length);assert.ok(gltf.images.length);total+=bytes.length;
 }assert.ok(total<4*1024*1024);
});
test('G4 手绘偶遇用独立随机流，不能改变同 seed 的捕获抽样与搏鱼',()=>{
 const content=fishingContent('reef-edge'),a=createRoundSession(content,42),b=createRoundSession(content,42);b.visitors(['original-a']);
 for(let i=0;i<700;i++){a.step();b.step();}assert.deepEqual(a.read(),b.read());
 for(const s of [a,b])s.command({type:'cast',bait:'shrimp',spot:'near',attemptId:'same',seed:123});
 for(let i=0;i<750;i++){if(a.read().phase==='bite')a.command({type:'pull'});if(b.read().phase==='bite')b.command({type:'pull'});a.step();b.step();}assert.deepEqual(a.read(),b.read());
});
