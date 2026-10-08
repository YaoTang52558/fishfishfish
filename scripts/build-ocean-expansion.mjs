/** Extend the observation library while preserving the original fish, host and game pool. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { childName } from './lib/observation-names.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,d)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof d==='string'?d:JSON.stringify(d,null,2)+'\n');};
const upsert=(rows,item)=>{const i=rows.findIndex(r=>r.id===item.id);if(i<0)rows.push(item);else rows[i]=item;};
const batch=read('docs/content/research/production-batch-v3.json'),date=batch.date;
assert.equal(batch.records.length,89);assert.equal(batch.records.filter(r=>r.category==='fish').length,50);
const data=read('public/content/v1/data.json'),sources=read('docs/content/sources.json'),claims=read('docs/content/claims.json'),assets=read('docs/content/assets.json'),audio=read('docs/content/scripts/audio-v1.json');
sources.records=sources.records.filter(s=>!s.id.startsWith('S-VTH-'));
const labels={fish:'鱼',shrimp:'虾与龙虾',crab:'蟹',cephalopod:'鱿鱼与章鱼',gastropod:'螺与鲍鱼',bivalve:'双壳贝',other:'其他伙伴'};
const extraAliases={
  'caranx-ignobilis':['GT','巨型鲹','牛港鲹'],'sphyraena-barracuda':['海狼','梭鱼'],'scarus-ghobban':['鹦哥鱼','鹦嘴鱼'],
  'lates-calcarifer':['海鲈鱼','金目鲈','尖吻鲈'],'dicentrarchus-labrax':['海鲈鱼','欧洲海鲈'],
  'gadus-morhua':['鳕鱼','大西洋鳕鱼'],'gadus-macrocephalus':['鳕鱼','太平洋鳕鱼'],'gadus-chalcogrammus':['鳕鱼','明太鱼','狭鳕'],
  'salmo-salar':['三文鱼','大西洋鲑','鲑鱼'],'thunnus-thynnus':['蓝鳍金枪鱼','吞拿鱼'],'katsuwonus-pelamis':['鲣鱼','金枪鱼'],
  'penaeus-monodon':['虎虾','草虾','黑虎虾'],'penaeus-vannamei':['白虾','白对虾','Litopenaeus vannamei'],
  'penaeus-japonicus':['车虾','竹节虾','Marsupenaeus japonicus'],'penaeus-merguiensis':['香蕉虾','白虾'],
  'pandalus-borealis':['甜虾','北极虾'],'oratosquilla-oratoria':['皮皮虾','虾蛄','濑尿虾'],
  'panulirus-ornatus':['花龙虾','龙虾'],'panulirus-homarus':['青龙虾','龙虾'],'homarus-americanus':['波士顿龙虾','螯龙虾'],
  'scylla-serrata':['青蟹','泥蟹'],'portunus-pelagicus':['花蟹','蓝泳蟹','梭子蟹'],'charybdis-feriata':['红花蟹','十字蟹','Charybdis feriatus'],
  'cancer-pagurus':['面包蟹'],'chionoecetes-opilio':['雪蟹'],'paralithodes-camtschaticus':['帝王蟹','红帝王蟹'],
  'sepioteuthis-lessoniana':['软丝','大鳍鱿鱼','鱿鱼'],'loligo-vulgaris':['鱿鱼','枪乌贼'],'dosidicus-gigas':['鱿鱼','洪堡鱿鱼'],
  'sepia-pharaonis':['墨鱼','乌贼','花枝'],'sepia-officinalis':['墨鱼','乌贼'],'octopus-vulgaris':['章鱼','八爪鱼'],'enteroctopus-dofleini':['章鱼','大章鱼'],
  'haliotis-discus':['鲍鱼'],'haliotis-diversicolor':['鲍鱼','九孔'],'babylonia-areolata':['花螺','东风螺'],'rapana-venosa':['海螺','红螺'],
  'ruditapes-philippinarum':['花蛤','蛤蜊','蛤仔'],'meretrix-meretrix':['蛤蜊','文蛤'],'perna-viridis':['青口','淡菜','贻贝'],
  'mytilus-edulis':['青口','淡菜','贻贝'],'magallana-gigas':['生蚝','牡蛎','Crassostrea gigas'],'pecten-maximus':['扇贝'],
  'tegillarca-granosa':['血蚶','蚶子','Anadara granosa'],'sinonovacula-constricta':['蛏子','毛蛏','泥蛏'],'panopea-generosa':['象拔蚌'],
  'apostichopus-japonicus':['海参','刺参'],'mesocentrotus-nudus':['海胆','北紫海胆','Strongylocentrotus nudus'],'rhopilema-esculentum':['海蜇','水母'],
  'stegostoma-tigrinum':['斑马鲨','Stegostoma fasciatum'],
};
function institution(url){const h=new URL(url).hostname;return h.includes('fao.org')?'FAO 联合国粮农组织':h.includes('noaa.gov')?'NOAA Fisheries':h.includes('australian.museum')?'Australian Museum':h.includes('fishesofaustralia')?'Museums Victoria / Fishes of Australia':h.includes('montereybayaquarium')?'Monterey Bay Aquarium':h.includes('mbari')?'MBARI':h.includes('nparks')?'NParks Singapore':h.includes('marlin')?'Marine Biological Association / MarLIN':h.includes('usgs')?'USGS':h.includes('hro.or.jp')?'北海道立総合研究機構':h.includes('floridamuseum')?'Florida Museum':h.includes('sinica')?'中央研究院／臺灣魚類資料庫':h.includes('marinespecies')?'WoRMS':h.includes('gov.tw')?'台湾政府机构／海洋与渔业资料':h.includes('digitalarchives')?'中央研究院／数位典藏':'机构与研究资料';}
function source(url,r,location){let row=sources.records.find(s=>s.url===url);if(!row){row={id:`S-${r.prefix}-${crypto.createHash('sha256').update(url).digest('hex').slice(0,8).toUpperCase()}`,institution:institution(url),title:r.scientificName,url,checkedAt:date,access:url.endsWith('.pdf')?'direct-pdf':url.includes('bitstreams')||url.includes('marinespecies')?'indexed-account':'direct-page',notes:location};upsert(sources.records,row);}return row.id;}
function clip(id,text,factIds,subjectId){const file=`audio/${id.toLowerCase()}.wav`;upsert(audio.records,{id,text,factIds,subjectId,kind:'knowledge',file,voice:'Microsoft Huihui Desktop / zh-CN',rate:-1,format:'PCM 24000 Hz, mono, 16 bit',usage:'本地合成试听；公开分发前核对系统语音授权',pronunciation:'口播使用中文短名与短句；腕、触腕、管足等术语结合插画'});return file;}
const taxonomySources={
  'stegostoma-tigrinum':'https://www.marinespecies.org/aphia.php?id=220032&p=taxdetails',
  'charybdis-feriata':'https://www.marinespecies.org/aphia.php?id=1779697&p=taxdetails',
  'mesocentrotus-nudus':'https://www.marinespecies.org/aphia.php?p=image&pic=145612',
  'sepia-pharaonis':'https://www.marinespecies.org/aphia.php?id=1666972&p=taxdetails',
};
for(const r of batch.records){
  assert.equal(r.points.length,3,`${r.id} facts not curated`);assert.equal(r.checkedAt,date);
  const factIds=[],sourceIds=[];
  const points=r.points.map((p,i)=>{const id=`${r.prefix}-0${i+1}`,sourceId=source(p.sourceUrl??r.sourceUrl,r,p.sourceLocation??r.sourceLocation);factIds.push(id);sourceIds.push(sourceId);upsert(claims.records,{id,subjectId:r.id,text:p.text,sourceIds:[sourceId],location:p.sourceLocation??r.sourceLocation,conditions:`限本卡明确物种／所选阶段与色型；${r.notes} 图片为艺术示意，不用于逐鳍条、逐肢或壳纹鉴定。`,checkedAt:date,reviewer:'primary-agent',status:'checked',publicationStatus:'preview-ready',issue:null});return {...p,sourceUrl:undefined,sourceLocation:undefined,factIds:[id],x:null,y:null,audio:clip(`VO-${r.prefix}-${p.key}`,p.text,[id],r.id)};});
  if(taxonomySources[r.id])sourceIds.push(source(taxonomySources[r.id],r,'Accepted-name mapping; indexed WoRMS entry'));
  const shortName=childName(r),intro=`这是${shortName}。${points[0].text}`;
  upsert(data.fish,{id:r.id,prefix:r.prefix,name:shortName,formalName:r.name.replace(/（.*?）/g,''),scientificName:r.scientificName,category:r.category,group:r.category==='fish'?'expanded':'marine',aliases:[r.name,r.name.replace(/（.*?）/g,''),...(extraAliases[r.id]??[]),...(r.legacyNames??[])],habitat:'world',aspectRatio:'3 / 2',image:`illustrations/${r.id}.webp`,intro:[intro,[factIds[0]]],introAudio:clip(`VO-${r.prefix}-INTRO`,intro,[factIds[0]],r.id),invite:r.category==='fish'?'试着把喜欢的颜色、花纹或身体，画到自己的鱼上。':'可以把喜欢的颜色、壳纹或腕足，变成自己的幻想鱼。',parent:`${r.notes} 类别按钮用于儿童浏览，科学分类以资料来源为准；观察内容不等于游戏鱼饵、捕获规则或野外可食鉴定。`,points,factIds,sourceIds:[...new Set(sourceIds)]});
  write(`docs/content/species/${r.id}.md`,`# ${r.name}\n\n${r.scientificName} · ${labels[r.category]} · ${date}\n\n![原创活体观察示意](../../../public/content/v1/illustrations/${r.id}.webp)\n\n${r.notes}\n\n${points.map((p,i)=>`- **${p.label}**：${p.text}（${factIds[i]}）`).join('\n')}\n\n资料：${[...new Set([r.sourceUrl,...r.points.map(p=>p.sourceUrl).filter(Boolean),taxonomySources[r.id]].filter(Boolean))].map(url=>`[${institution(url)}](${url})`).join('、')}。位置：${r.sourceLocation}。\n\n[事实表](../claims.json) · [配音脚本](../scripts/audio-v1.json) · [生成提示与原图索引](../../../design/content/v1/generation.json)\n\n每卡一段介绍、三个点听。新卡没有设置未经标定的局部放大坐标。图为 AI 原创艺术示意，非鉴定照片；交付为 2D 插画及图鉴内容，不代表新增三维捕获物种。\n`);
}
for(const card of data.fish){card.category??='fish';card.aliases=[...new Set([...(card.aliases??[]),...(extraAliases[card.id]??[]),...(card.group==='grouper'?['石斑','石斑鱼']:[])])];}
assert.equal(data.fish.length,119);assert.equal(audio.records.filter(c=>c.kind!=='creative-prompt').length,484);
Object.assign(data,{date,contentVersion:3,categories:Object.entries(labels).map(([id,label])=>({id,label,count:data.fish.filter(c=>c.category===id).length}))});
data.claims=claims.records.filter(c=>c.status==='checked'&&c.publicationStatus!=='excluded');data.sources=sources.records;data.clips=audio.records;
sources.checkedAt=claims.checkedAt=assets.checkedAt=audio.date=date;
for(const image of read('design/content/v1/generation.json').records)upsert(assets.records,{id:`GEN-${image.id.toUpperCase()}`,subjectId:image.id,type:image.path.includes('/environments/')?'original-concept':'original-illustration',sourceId:null,sourceUrl:null,localPath:image.path,sourcePath:image.source,author:'Project / built-in imagegen',license:'AI-generated original project artwork; no third-party photo embedded',rightsStatus:'original-generated',allowedUse:'项目观察图鉴与创作灵感',checkedAt:image.generatedAt,downloaded:false,productReady:true,visualReview:batch.records.some(r=>r.id===image.id)?'pending-contact-sheet':'primary-agent-preview',modifications:'WebP export preserving alpha; resize without enlargement',notes:'完整提示与生成尺寸见 generation.json；AI 插画不能代替学术事实来源'});
for(const c of audio.records)upsert(assets.records,{id:c.id,subjectId:c.subjectId,type:'audio',localPath:`public/content/v1/${c.file}`,factIds:c.factIds,author:c.voice,license:'System speech voice; local review use; distribution terms not verified',rightsStatus:'local-review-only',allowedUse:'本地试听；正式分发前核对系统声音授权或替换配音',productReady:false,audioReady:true,checkedAt:date});
write('docs/content/scripts/audio-v1.json',audio);write('docs/content/sources.json',sources);write('docs/content/claims.json',claims);write('docs/content/assets.json',assets);
write('docs/content/scripts/all-fish.md',`# 海洋伙伴点听脚本\n\n${date} · ${data.fish.length} 种观察伙伴 · ${audio.records.length} 段本地合成试听。\n\n[机器可读主记录](audio-v1.json) · [语音生成工具](../../../scripts/generate-content-audio.ps1)\n\n| ID | 文本 | 依据 | 文件 |\n| --- | --- | --- | --- |\n${audio.records.map(c=>`| ${c.id} | ${c.text} | ${c.factIds.join('、')||'原创提示'} | [WAV](../../../public/content/v1/${c.file}) |`).join('\n')}\n\n声音：Microsoft Huihui Desktop / zh-CN，Rate -1，24kHz 单声道 16bit PCM，仅本地试听授权记录。主动点听，切换对象与离页停止，不重叠播放。\n`);
if(!process.argv.includes('--scripts-only')){for(const c of data.fish)assert.ok(fs.existsSync(`public/content/v1/${c.image}`),`Missing illustration ${c.id}`);write('public/content/v1/data.json',data);}
console.log(JSON.stringify({creatures:data.fish.length,categories:data.categories,audio:audio.records.length,sources:sources.records.length,claims:claims.records.length,scriptsOnly:process.argv.includes('--scripts-only')}));
