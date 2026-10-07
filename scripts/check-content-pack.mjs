import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
let sharp;try{sharp=require('sharp');}catch{sharp=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));}
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const data=read('public/content/v1/data.json');
const claims=read('docs/content/claims.json').records;
const sources=read('docs/content/sources.json').records;
const generated=read('design/content/v1/generation.json').records;
const clips=read('docs/content/scripts/audio-v1.json').records;
for(const rows of [data.fish,claims,sources,generated,clips]) assert.equal(new Set(rows.map(r=>r.id)).size,rows.length,'duplicate ID');
for(const claim of claims) for(const id of claim.sourceIds) assert.ok(sources.some(s=>s.id===id),`${claim.id} missing source ${id}`);
assert.equal(data.fish.length,119);assert.equal(generated.length,125);assert.equal(clips.length,484);assert.equal(data.guides.length,10);
assert.deepEqual(data.categories.map(c=>[c.id,c.count]),[['fish',80],['shrimp',9],['crab',6],['cephalopod',7],['gastropod',5],['bivalve',9],['other',3]]);
for(const category of data.categories)assert.equal(data.fish.filter(f=>(f.category??'fish')===category.id).length,category.count);
for(const clip of clips)for(const id of clip.factIds)assert.equal(claims.find(c=>c.id===id)?.status,'checked',`${clip.id} unverified fact`);
assert.ok(!data.claims.some(c=>c.id==='AH-06'));
for(const fish of data.fish){assert.ok(fs.existsSync(`docs/content/species/${fish.id}.md`));assert.equal(fish.points.length,3);for(const p of fish.points){if(p.x!==null)assert.ok(p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1);assert.ok(clips.some(c=>c.file===p.audio));}for(const id of fish.factIds)assert.ok(data.claims.some(c=>c.id===id));}
let transparentImages=0;
for(const image of generated){
  const original=await sharp(image.source).metadata(),web=await sharp(image.path).metadata();
  assert.equal(original.width,image.width);assert.equal(web.width,image.webWidth);assert.equal(web.height,image.webHeight);assert.equal(web.hasAlpha,original.hasAlpha);assert.equal(fs.statSync(image.path).size,image.webBytes);
  if(image.path.includes('/illustrations/')){assert.ok(web.hasAlpha);const {data:pixel,info}=await sharp(image.path).extract({left:0,top:0,width:1,height:1}).raw().toBuffer({resolveWithObject:true});assert.ok(pixel[info.channels-1]<=3,`${image.id} visible corner background`);transparentImages++;}
}
const audio=[];
for(const clip of clips){
  const p=`public/content/v1/${clip.file}`,buf=fs.readFileSync(p);assert.equal(buf.toString('ascii',0,4),'RIFF');assert.equal(buf.toString('ascii',8,12),'WAVE');let fmt,pcm;
  for(let off=12;off+8<=buf.length;){const size=buf.readUInt32LE(off+4),id=buf.toString('ascii',off,off+4);if(id==='fmt ')fmt=buf.subarray(off+8,off+8+size);if(id==='data')pcm=buf.subarray(off+8,off+8+size);off+=8+size+(size%2);}
  assert.ok(fmt&&pcm);assert.equal(fmt.readUInt16LE(0),1);assert.equal(fmt.readUInt16LE(2),1);assert.equal(fmt.readUInt32LE(4),24000);assert.equal(fmt.readUInt16LE(14),16);
  let square=0,peak=0;for(let i=0;i<pcm.length;i+=2){const n=pcm.readInt16LE(i);square+=n*n;peak=Math.max(peak,Math.abs(n));}const duration=pcm.length/48000,rms=Math.sqrt(square/(pcm.length/2));assert.ok(duration>.4&&duration<20);assert.ok(rms>100,`${clip.id} silent clip`);audio.push({id:clip.id,file:p,seconds:+duration.toFixed(3),rms:Math.round(rms),peak,bytes:buf.length});
}
for(const guide of data.guides){const p=`public/content/v1/${guide.file}`,svg=fs.readFileSync(p,'utf8');assert.match(svg,/<svg/);assert.match(svg,/data:image\/webp;base64/);assert.ok(fs.existsSync(`design/content/v1/${guide.file}`));for(const id of guide.factIds)assert.ok(data.claims.some(c=>c.id===id));}
const summary={date:data.date,fish:data.fish.length,images:generated.length,transparentImages,guides:data.guides.length,audioClips:audio.length,voice:'Microsoft Huihui Desktop / zh-CN',audioSeconds:+audio.reduce((n,a)=>n+a.seconds,0).toFixed(3),shortestClipSeconds:Math.min(...audio.map(a=>a.seconds)),longestClipSeconds:Math.max(...audio.map(a=>a.seconds)),sources:sources.length,claims:claims.length,checkedClaims:claims.filter(c=>c.status==='checked').length,excludedHistoricalClaims:claims.filter(c=>c.publicationStatus==='excluded').map(c=>c.id),webImageBytes:generated.reduce((n,i)=>n+i.webBytes,0),audioBytes:audio.reduce((n,a)=>n+a.bytes,0),checks:['unique IDs','fact/source/audio references','source and WebP dimensions',`${transparentImages} near-transparent corners (alpha <= 3 / 255)`,`${audio.length} non-silent PCM clips`,`${data.guides.length} self-contained editable SVGs`,'excluded unverified mechanism'],scope:'content pack only; no full game regression; no real iPad or scientific expert approval'};
fs.writeFileSync('docs/content/verification-v1.json',JSON.stringify({summary,audio},null,2)+'\n');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const hashes=walk('public/content/v1').filter(p=>!p.endsWith('integrity.json')).map(p=>({path:p.replaceAll('\\','/'),bytes:fs.statSync(p).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}));
fs.writeFileSync('public/content/v1/integrity.json',JSON.stringify({date:data.date,files:hashes},null,2)+'\n');
console.log(JSON.stringify(summary));
