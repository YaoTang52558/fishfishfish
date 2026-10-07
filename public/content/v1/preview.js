const $ = selector => document.querySelector(selector);
const audio = new Audio();
audio.preload = 'none';
let data, selected, activeButton;
const physical = new Set(['BANDS','FINS','MOUTH','SPOT','PATTERN','RINGS','TAIL','BODY','FIN','NOSE','DOTS','COLOR']);
function stop(){ audio.pause(); audio.currentTime=0; $('#stop').disabled=true; activeButton?.classList.remove('active'); activeButton=null; }
async function play(file,text,button){ stop(); $('#spoken-text').textContent=text; audio.src=new URL(file,location.href).href; activeButton=button; button?.classList.add('active'); $('#stop').disabled=false; try{await audio.play();}catch{stop();$('#spoken-text').textContent='声音暂时没有播放成功，请再点一下。';} }
audio.addEventListener('ended',()=>{ $('#stop').disabled=true; activeButton?.classList.remove('active'); activeButton=null; });
$('#stop').addEventListener('click',stop);
function element(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text)el.textContent=text;return el;}
function showViewer(title,image,caption){stop();$('#viewer-title').textContent=title;$('#viewer-image').src=image;$('#viewer-image').alt=title;$('#viewer-caption').textContent=caption;$('#viewer-download').href=image;$('#viewer').showModal();}
$('#close-viewer').addEventListener('click',()=>$('#viewer').close());
$('#viewer').addEventListener('click',event=>{if(event.target===$('#viewer')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();}});
function choose(card){
  stop();selected=card;$('#fish-name').textContent=card.name;$('#fish-habitat').textContent=({reef:'珊瑚礁的灵感',rock:'岩礁的灵感',nearshore:'海岸与河口的灵感',world:'世界海洋的灵感'})[card.habitat]||'海洋的灵感';$('#fish-image').src=card.image;$('#fish-image').alt=`${card.formalName}的原创外形示意图`;$('#invite').textContent=card.invite;$('#spoken-text').textContent='点一下，听听它的故事。';
  const upright=card.id==='hippocampus-kuda',winged=card.id==='mobula-birostris';$('#specimen').style.aspectRatio=card.aspectRatio??(upright?'2 / 3':winged?'1':'3 / 2');$('#specimen').style.maxWidth=upright?'280px':winged?'440px':'640px';
  document.querySelectorAll('.fish-option').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===card.id)));
  $('#points').replaceChildren();$('#pins').replaceChildren();
  card.points.forEach((point,i)=>{const button=element('button','point');button.type='button';button.append(element('span','',String(i+1)),element('span','',point.label),element('span','speaker','🔊'));button.setAttribute('aria-label',`听听${point.label}`);button.addEventListener('click',()=>play(point.audio,point.text,button));$('#points').append(button);
    if(physical.has(point.key)&&point.x!==null&&point.y!==null){const pin=element('button','pin',String(i+1));pin.type='button';pin.style.left=`${point.x*100}%`;pin.style.top=`${point.y*100}%`;pin.setAttribute('aria-label',`观察点 ${i+1}：${point.label}，点听`);pin.addEventListener('click',()=>play(point.audio,point.text,button));$('#pins').append(pin);}
  });
  const parent=$('#parent-content');parent.replaceChildren(element('h3','',`${card.formalName} · ${card.scientificName}`),element('p','',card.parent));
  for(const id of card.factIds){const fact=data.claims.find(f=>f.id===id);const row=element('div','fact');row.append(element('p','',`${fact.id} · ${fact.text}`),element('small','',fact.conditions));parent.append(row);}
  const list=element('ul');for(const id of card.sourceIds){const source=data.sources.find(s=>s.id===id);const row=element('li');const link=element('a','',`${source.institution}：${source.title}`);link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';row.append(link);list.append(row);}parent.append(list,element('p','',`查阅日期：${data.date}。中文入口名沿用项目目录；图片是原创艺术示意，事实来自以上机构和研究来源。`));
}
$('#intro').addEventListener('click',()=>play(selected.introAudio,selected.intro[0],$('#intro')));
$('#enlarge').addEventListener('click',()=>showViewer(selected.name,selected.image,'真实物种的原创示意插画。具体知识与适用条件见鱼卡的亲子展开。'));
$('#arrival').addEventListener('click',()=>showViewer('自己的鱼，游进海里','environments/ocean-arrival.webp','入海 → 靠近看清自己的花纹 → 游进海洋。泡泡星是原创幻想示例，三幅是画面分镜，不是已经完成的游戏动画。'));
$('#host-audio').addEventListener('click',()=>play(data.host.audio,'这是一只海葵，也是这种小丑鱼的伙伴。',$('#host-audio')));
document.querySelectorAll('[data-world]').forEach(button=>button.addEventListener('click',()=>{const env=data.environments.find(e=>e.id===button.dataset.world);$('#world-image').src=env.image;$('#world-image').alt=`${env.name}：${env.description}`;$('#world-name').textContent=env.name;$('#world-description').textContent=env.description;document.querySelectorAll('[data-world]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}));
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
window.addEventListener('pagehide',stop);
try{
  const response=await fetch('data.json');if(!response.ok)throw new Error('Content data unavailable');data=await response.json();
  for(const card of data.fish){const button=element('button','fish-option');button.type='button';button.dataset.id=card.id;button.setAttribute('aria-pressed','false');button.setAttribute('aria-label',`看看${card.name}`);const image=element('img');image.src=card.image;image.alt='';image.loading='lazy';button.append(image,element('span','',card.name));button.addEventListener('click',()=>choose(card));$('#fish-picker').append(button);}
  const filters=[['all','🌊 全部',()=>true],['fish','🐟 鱼',c=>(c.category??'fish')==='fish'],['shrimp','🦐 虾与龙虾',c=>c.category==='shrimp'],['crab','🦀 蟹',c=>c.category==='crab'],['cephalopod','🦑 鱿鱼与章鱼',c=>c.category==='cephalopod'],['gastropod','🐚 螺与鲍鱼',c=>c.category==='gastropod'],['bivalve','🦪 双壳贝',c=>c.category==='bivalve'],['other','⭐ 其他伙伴',c=>c.category==='other'],['grouper','🔵 石斑',c=>c.group==='grouper']];
  let currentFilter='all';
  function filterFish(id){stop();currentFilter=id;const predicate=filters.find(f=>f[0]===id)[2],query=$('#creature-search').value.trim().toLocaleLowerCase();const visible=data.fish.filter(c=>predicate(c)&&(!query||[c.name,c.formalName,c.scientificName,...(c.aliases??[])].some(n=>n.toLocaleLowerCase().includes(query))));document.querySelectorAll('.fish-option').forEach(b=>{b.hidden=!visible.some(c=>c.id===b.dataset.id);});document.querySelectorAll('[data-fish-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.fishFilter===id)));$('#fish-count').textContent=`${visible.length} 位海洋朋友`;if(visible.length&&!visible.some(c=>c.id===selected?.id))choose(visible[0]);$('#no-matches').hidden=visible.length>0;}
  for(const [id,label] of filters){const button=element('button','',label);button.type='button';button.dataset.fishFilter=id;button.setAttribute('aria-pressed',String(id==='all'));button.addEventListener('click',()=>{$('#creature-search').value='';filterFish(id);});$('#fish-filters').append(button);}
  $('#creature-search').addEventListener('input',()=>filterFish(currentFilter));
  $('#fish-count').textContent=`${data.fish.length} 位海洋朋友`;
  $('#content-count').textContent=`${data.fish.length} 种海洋伙伴 · ${data.fish.filter(c=>(c.category??'fish')==='fish').length} 种鱼 · 1 种海葵 · 两种海洋主题`;
  for(const guide of data.guides){const button=element('button','guide');button.type='button';const image=element('img');image.src=guide.file;image.alt=guide.title;image.loading='lazy';button.append(image,element('span','',`${guide.title} ↗`));button.addEventListener('click',()=>showViewer(guide.title,guide.file,'可编辑 SVG 参考图。真实物种提供观察灵感，幻想作品可以自由发挥。'));$('#guide-list').append(button);}
  choose(data.fish[0]);
}catch(error){$('#load-error').hidden=false;console.error(error);}
