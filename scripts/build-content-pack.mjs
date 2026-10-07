import fs from 'node:fs';
import path from 'node:path';
const date = '2026-10-06';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, value) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n'); };
const upsert = (rows, value) => { const i = rows.findIndex(r => r.id === value.id); if (i < 0) rows.push(value); else rows[i] = value; };
const sources = read('docs/content/sources.json');
const claims = read('docs/content/claims.json');
const assets = read('docs/content/assets.json');
const expansion = read('docs/content/research/production-batch-v2.json');
for (const source of expansion.sources) upsert(sources.records, source);
for (const claim of expansion.claims) upsert(claims.records, claim);
const newSources = [
  ['S-WA-YELLOW','Waikīkī Aquarium','Yellow Tang','https://www.waikikiaquarium.org/experience/animal-guide/fishes/surgeonfishes/yellow-tang/','Description / feeding / nighttime color'],
  ['S-AM-BLUE','Australian Museum / Mark McGrouther','Blue Tang','https://australian.museum/learn/animals/fishes/blue-tang-paracanthurus-hepatus/','Identification / Feeding and diet'],
  ['S-AM-IDOL','Australian Museum / Mark McGrouther','Moorish Idol','https://australian.museum/learn/animals/fishes/moorish-idol-zanclus-cornutus-linnaeus-1758/','Identification'],
  ['S-TW-BREAM','中央研究院生物多樣性研究中心／臺灣魚類資料庫','Acanthopagrus schlegelii','https://catalog.digitalarchives.tw/item/00/42/6e/36.html','形態特徵 / 棲所生態'],
  ['S-TW-KNIFEJAW','中央研究院生物多樣性研究中心／臺灣魚類資料庫','Oplegnathus fasciatus','https://catalog.digitalarchives.tw/item/00/42/6c/9f.html','形態特徵 / 棲所生態'],
  ['S-TW-GIRELLA','中央研究院生物多樣性研究中心／臺灣魚類資料庫','Girella punctata','https://catalog.digitalarchives.tw/item/00/42/6b/6f.html','形態特徵 / 棲所生態；季节描述限于该区域资料'],
  ['S-TW-MARMO','中央研究院生物多樣性研究中心／臺灣魚類資料庫','Sebastiscus marmoratus','https://catalog.digitalarchives.tw/item/00/42/6f/31.html','形態特徵 / 棲所生態'],
  ['S-FB-ROCKFISH','FishBase','Sebastes schlegelii','https://www.fishbase.se/summary/Sebastes-schlegelii.html','Biology / Environment'],
  ['S-FB-GREENLING','FishBase','Hexagrammos otakii','https://www.fishbase.se/summary/Hexagrammos-otakii.html','Biology / Body shape'],
  ['S-ANEMONE-REDSEA2021','Bennett-Smith et al. / Marine Biodiversity Records','Clownfish hosting anemones of the Red Sea','https://link.springer.com/article/10.1186/s41200-021-00216-6','Results / Heteractis magnifica；红海与亚丁湾实地调查；使用旧属名']
];
for (const [id,institution,title,url,notes] of newSources) upsert(sources.records,{id,institution,title,url,checkedAt:date,access:'direct-page',notes});
const fact = (id,subjectId,text,sourceId,conditions = '用于已注明物种的观察；插画为近似示意，不支持逐鳍条、逐鳞计数') => upsert(claims.records,{id,subjectId,text,sourceIds:[sourceId],location:newSources.find(s=>s[0]===sourceId)?.[4] ?? 'see source',conditions,checkedAt:date,reviewer:'primary-agent',status:'checked',publicationStatus:'preview-ready',issue:null});
const rows = [
  ['ZF','zebrasoma-flavescens','S-WA-YELLOW',[
    '身体高而侧扁；常见白天色型为柠檬黄，尾柄两侧各有白色棘。',
    '主要刮食藻类。',
    '夜间黄色会变暗，体侧中线可出现白色条带。'
  ],['白天色型；不是新加坡物种出现证明','来源的物种食性描述，不能把游戏鱼饵权重当真实偏好','昼夜色型有条件，当前插画仅画白天']],
  ['PH','paracanthurus-hepatus','S-AM-BLUE',[
    '身体蓝色并有黑色图案。','尾鳍黄色，上下边缘有黑色条纹。','主要吃浮游动物。'
  ]],
  ['ZC','zanclus-cornutus','S-AM-IDOL',[
    '背鳍延伸为长而弯曲的白色丝状部分。','体侧有两条宽黑带，吻部有黄色鞍状斑。','成鱼眼前有骨质突起，雄鱼通常更明显。'
  ],['可用于大体轮廓对比，不计算鳍条','典型识别特征，插画的白黄区域是示意','限成鱼，插画不是眼前骨突起的放大证据']],
  ['SS','sebastes-schlegelii','S-FB-ROCKFISH',[
    '生活在近岸岩石底质环境。','幼鱼可与漂浮海藻关联。','卵胎生，胚胎在母体内发育后产出幼鱼。'
  ],['西北太平洋温带物种；当前岩礁是虚构主题','限幼鱼阶段；不说所有年龄都住漂浮海藻','不额外断言出生瞬间的泳姿、速度或行为']],
  ['AS','acanthopagrus-schlegelii','S-TW-BREAM',[
    '体色灰黑、有银色光泽，胸鳍橘黄色。','尾鳍分叉。','可栖息沿海内湾与河口等环境。'
  ]],
  ['HO','hexagrammos-otakii','S-FB-GREENLING',[
    '体形延长。','栖息于岩石海岸及人工礁等环境。','卵块可附着小石，雄鱼守护卵块。'
  ],['体形记录不支持把长身体直接等同游得快','西北太平洋温带物种，不宣称是新加坡当地鱼','资料描述的繁殖行为；不是每条画面中的鱼都正护卵']],
  ['OF','oplegnathus-fasciatus','S-TW-KNIFEJAW',[
    '具七条暗色横带，包括穿过眼部的一条。','齿愈合成喙状，能处理带硬壳的食物。','幼鱼可随漂浮海藻活动。'
  ],['画带纹明显的个体；不把该花纹当所有年龄、性别都不变','来源形态与食性摘要，不用插画显示不可见的内部齿列','限幼鱼，不作当地定点出现证据']],
  ['GP','girella-punctata','S-TW-GIRELLA',[
    '体色灰褐至暗褐，鳞片基部有小黑点。','胸鳍基部有暗褐色斑。','资料记载吃藻类与小生物，食性有季节变化。'
  ],['小点的精确鳞片位置看来源；插画不用于鳞片计数','局部观察示意','季节细节只对应台湾来源，不推广为所有地区的统一规律']],
  ['SM','sebastiscus-marmoratus','S-TW-MARMO',[
    '体色可为淡红，色泽随栖息深度等条件变化。','生活在浅海岩礁底部。','食物主要包括小鱼。'
  ],['当前选择红褐示意色型；未把历史横带数重新认证','资料的栖所描述，不证明与其他鱼在同一地点共存','食性摘要，游戏中的鱼饵选择单独配置']]
];
for(const [prefix,id,source,texts,conditions] of rows) texts.forEach((t,i)=>fact(`${prefix}-0${i+1}`,id,t,source,conditions?.[i]));
fact('RM-03','radianthus-magnifica','该种展开的触手细长，末端圆或微膨，常见亮色端部；柱体可红至紫色。','S-ANEMONE-REDSEA2021','2021 论文使用 Heteractis magnifica 旧名；描绘紫柱/绿触手色型，不声称所有个体均如此');
fact('RM-04','radianthus-magnifica','实地调查通常见该种附着在暴露的礁石上。','S-ANEMONE-REDSEA2021','调查范围为红海与亚丁湾；不用于证明新加坡具体海域的配对或分布');
const gas = claims.records.find(r=>r.id==='AH-06');
gas.publicationStatus='excluded'; gas.issue='未取得本种机制证据；2026-10-06 已从运行知识卡替换成经博物馆核对的花纹观察。保留此条供追踪，不进入素材预览。';
for (const r of claims.records) if(r.status==='checked' && r.publicationStatus==='draft') r.publicationStatus='preview-ready';
write('docs/content/sources.json',sources); write('docs/content/claims.json',claims);

// Children see a short familiar description; project common names remain in parent details.
const fish = [
  {id:'amphiprion-ocellaris',prefix:'AO',name:'小丑鱼',formalName:'眼斑双锯鱼',habitat:'reef',intro:['这是一条小丑鱼，看看它的白带。',['AO-01','AO-02']],invite:'你的鱼想画几条带子？也可以画成弯弯的。',parent:'这里画的是常见橙色型。海葵配对只指本页的明确物种；不是所有鱼都能进入所有海葵。',points:[['BANDS','三条白带','它的头、身体中间和尾根，各有一条白带。',['AO-02'],.48,.46],['FINS','鳍的颜色','看，它的鳍上还有黑色。',['AO-02'],.53,.29],['HOME','海葵伙伴','这种小丑鱼，会和这种海葵一起生活。',['AO-03','RM-01'],.23,.54]]},
  {id:'forcipiger-flavissimus',prefix:'FF',name:'黄镊口鱼',formalName:'黄镊口鱼',habitat:'reef',intro:['看，这条鱼有一张细长的嘴。',['FF-01']],invite:'试着给你的鱼画一张长嘴，再试试短嘴。',parent:'长嘴与探礁缝取食有依据；并不代表所有长嘴鱼都吃同一种食物。黑点在臀鳍而非眼睛或尾鳍。',points:[['MOUTH','长长的嘴','它会到珊瑚枝和礁缝里找食物。',['FF-03'],.2,.42],['SPOT','鳍上的黑点','找找尾根下方的鳍，上面有一个黑点。',['FF-02'],.67,.67],['PAIR','一起活动','它们常常两条一起，也会单独出现。',['FF-05'],.48,.47]]},
  {id:'arothron-hispidus',prefix:'AH',name:'白点河鲀',formalName:'纹腹叉鼻鲀',habitat:'reef',intro:['这条鱼圆圆的，身上有点点和线条。',['AH-01','AH-03']],invite:'上面画点点，下面画线条，或者换一种你喜欢的组合。',parent:'展示正常未膨胀状态。花纹与嘴形有证据；“气囊”旧说法不进入新内容，不靠画面推断游速或膨胀机制。',points:[['PATTERN','点点与线条','上面是白点，下面是浅色线条。',['AH-01'],.5,.4],['RINGS','深浅圆环','看胸鳍根部，一圈深，一圈浅。',['AH-02'],.36,.56],['MOUTH','小小的喙','它的嘴，像一个小喙。',['AH-04'],.2,.55]]},
  {id:'zebrasoma-flavescens',prefix:'ZF',name:'黄刺尾鱼',formalName:'黄高鳍刺尾鱼',habitat:'reef',intro:['这条鱼，白天常常是亮黄色的。',['ZF-01']],invite:'你的鱼在白天和晚上，要穿一样的颜色吗？',parent:'图画白天色型；夜间颜色与条带不能用当前静态图直接观察。它主要吃藻类，鱼饵权重属于游戏设定。',points:[['TAIL','尾根的白刺','看看尾巴根部，这里有一根白色的小刺。',['ZF-01'],.7,.51],['FOOD','吃藻类','它会啃食藻类。',['ZF-02'],.2,.49],['NIGHT','夜晚的颜色','到了晚上，黄色会变暗，身体中间会出现白带。',['ZF-03'],.47,.47]]},
  {id:'paracanthurus-hepatus',prefix:'PH',name:'蓝刺尾鱼',formalName:'黄尾副刺尾鱼',habitat:'reef',intro:['看看这条蓝色的鱼，还有黑色图案。',['PH-01']],invite:'给你的鱼选两种很不一样的颜色，再加一块大图案。',parent:'观察身体、尾鳍和食物；不把所有刺尾鱼都当作吃藻类。这里没有把尾柄刀片与有毒鳍刺混为同一个结构。',points:[['BODY','蓝与黑','蓝色的身体上，有黑色图案。',['PH-01'],.5,.43],['TAIL','黄色尾巴','尾巴是黄色的，上下边缘有黑色。',['PH-02'],.76,.49],['FOOD','小小的食物','它主要吃水里的浮游小动物。',['PH-03'],.2,.52]]},
  {id:'zanclus-cornutus',prefix:'ZC',name:'角镰鱼',formalName:'角镰鱼',habitat:'reef',intro:['看看这条鱼，背鳍拖着长长的白丝。',['ZC-01']],invite:'画一条长鳍，或者画成好多短鳍，都可以。',parent:'长白丝是背鳍的一部分。成鱼眼前骨质突起仅在亲子事实里介绍，当前图不作为该微小结构的准确放大图。',points:[['FIN','长长的背鳍','背上的鳍，像一条长长的白丝。',['ZC-01'],.56,.26],['BANDS','两条黑带','身体上有两条宽宽的黑带。',['ZC-02'],.48,.49],['NOSE','嘴前的黄色','看看嘴巴前面，还有一块黄色。',['ZC-02'],.26,.47]]},
  {id:'sebastes-schlegelii',prefix:'SS',name:'岩礁里的平鲉',formalName:'许氏平鲉',habitat:'rock',intro:['这条鱼，生活在近岸的岩礁。',['SS-01']],invite:'给你的鱼画几块不规则的斑点，再选一块石头旁的家。',parent:'本批核对栖所、幼鱼阶段与卵胎生。灰黑插画是外形近似，旧目录毒性与出生即会游的断言未作为已核对新内容；未使用该部分口播。',points:[['HOME','岩礁的家','它的家，在近岸的岩礁。',['SS-01'],.48,.53],['YOUNG','小鱼与海藻','小时候，它可以和漂浮的海藻一起出现。',['SS-02'],.32,.52],['BABY','鱼宝宝','它的宝宝，先在妈妈身体里发育。',['SS-03'],.58,.51]]},
  {id:'acanthopagrus-schlegelii',prefix:'AS',name:'黑鲷',formalName:'黑棘鲷',habitat:'rock',intro:['这条鱼灰灰的，胸鳍却是橘黄色的。',['AS-01']],invite:'给灰色的鱼，加一块你喜欢的亮色。',parent:'黑棘鲷沿用项目中文名；台湾资料使用黑鲷。只展示来源支持的特征，不把性转变简化为每个个体必然发生。',points:[['FIN','橘色胸鳍','看看身体侧边的鳍，是橘黄色的。',['AS-01'],.37,.56],['TAIL','分叉尾巴','尾巴分成了上下两边。',['AS-02'],.77,.49],['HOME','海湾与河口','它也会生活在海湾和河口。',['AS-03'],.49,.5]]},
  {id:'hexagrammos-otakii',prefix:'HO',name:'六线鱼',formalName:'大泷六线鱼',habitat:'rock',intro:['看看这条鱼，身体长长的。',['HO-01']],invite:'把你的鱼拉长一点，再试试短而圆的身体。',parent:'本批核对体形、岩岸栖所与雄鱼护卵；侧线数量和泳姿不从画面推断。它是温带物种，不称作新加坡本地鱼。',points:[['BODY','长长的身体','它的身体，比圆圆的鱼更长。',['HO-01'],.49,.49],['HOME','岩石海岸','它会住在岩石海岸。',['HO-02'],.28,.54],['EGGS','守护鱼卵','鱼爸爸，会守护附在小石头上的卵。',['HO-03'],.63,.5]]},
  {id:'oplegnathus-fasciatus',prefix:'OF',name:'条石鲷',formalName:'条石鲷',habitat:'rock',intro:['看看这条鱼，有好多黑色带子。',['OF-01']],invite:'画宽带子、细带子，或者把它们变成彩虹色。',parent:'示意带纹明显的个体；七条包括眼部的一条，不要求儿童完成数数题。嘴是齿愈合形成的喙状结构。',points:[['BANDS','七条黑带','这些黑带里，有一条穿过眼睛。',['OF-01'],.43,.48],['MOUTH','像喙的嘴','它的牙齿连在一起，形成了像喙的嘴。',['OF-02'],.22,.53],['YOUNG','小鱼与海藻','小鱼会跟着漂浮的海藻活动。',['OF-03'],.59,.48]]},
  {id:'girella-punctata',prefix:'GP',name:'斑鱾',formalName:'斑鱾',habitat:'rock',intro:['靠近看看，这条鱼身上有小黑点。',['GP-01']],invite:'画一些很小的点，再画几个很大的点，看看有什么不同。',parent:'台湾资料中文名为瓜子鱲，项目沿用斑鱾。食性季节变化属于该区域资料；不当成全球各地相同的季节规律。',points:[['DOTS','小小黑点','鳞片上，有小小的黑点。',['GP-01'],.53,.42],['FIN','胸鳍根部','胸鳍根部，还有一块深色斑。',['GP-02'],.36,.54],['FOOD','吃些什么','它吃藻类，也吃一些小生物。',['GP-03'],.2,.52]]},
  {id:'sebastiscus-marmoratus',prefix:'SM',name:'褐菖鲉',formalName:'褐菖鲉',habitat:'rock',intro:['看看岩礁里的这条鱼，这张图选了红褐色。',['SM-01','SM-02']],invite:'给你的鱼混合两种颜色，画出不规则的花纹。',parent:'颜色有个体和环境条件变化，红褐色是插画选择。尾部按大体轮廓示意，不认证旧资料中的精确横带数。',points:[['COLOR','变化的颜色','它的颜色，会随着生活条件有所不同。',['SM-01'],.49,.46],['HOME','浅海岩礁','它生活在浅海的岩礁底部。',['SM-02'],.28,.51],['FOOD','吃小鱼','它的食物里，主要有小鱼。',['SM-03'],.2,.56]]}
];
const clips=[];
fish.push(...structuredClone(expansion.fish));
const addClip=(id,text,factIds,subjectId,kind='knowledge')=>{ const file=`audio/${id.toLowerCase()}.wav`; clips.push({id,text,factIds,subjectId,kind,file,voice:'Microsoft Huihui Desktop / zh-CN',rate:-1,format:'PCM 24000 Hz, mono, 16 bit',usage:'本地合成试听；公开分发前核对系统语音相关条款与目标发行范围',pronunciation:'孩子入口不用学名；少量鳍、胸鳍、喙等词由图与短句辅助'}); return file; };
for(const card of fish){
  card.scientificName=card.id.split('-').map((s,i)=>i===0?s[0].toUpperCase()+s.slice(1):s).join(' ');
  card.image=`illustrations/${card.id}.webp`;
  card.introAudio=addClip(`VO-${card.prefix}-INTRO`,card.intro[0],card.intro[1],card.id);
  card.points=card.points.map(([key,label,text,factIds,x,y])=>({key,label,text,factIds,x,y,audio:addClip(`VO-${card.prefix}-${key}`,text,factIds,card.id)}));
  card.factIds=[...new Set([...card.intro[1],...card.points.flatMap(p=>p.factIds),...claims.records.filter(r=>r.subjectId===card.id&&r.status==='checked').map(r=>r.id)])];
  card.sourceIds=[...new Set(card.factIds.flatMap(id=>claims.records.find(r=>r.id===id).sourceIds))];
  const packet=`# ${card.formalName} · 内容包 v1\n\n2026-10-06 · ${card.scientificName} · 主要制作：主代理亲自完成。\n\n![原创观察插画](../../../public/content/v1/${card.image})\n\n## 观察与自由创作\n\n孩子入口：${card.intro[0]}\n\n${card.invite}\n\n| 点听 | 短句 | 事实依据 |\n| --- | --- | --- |\n${card.points.map(p=>`| ${p.label} | ${p.text} | ${p.factIds.join('、')} |`).join('\n')}\n\n不是答题关卡。创作不要求与真实鱼一致；不同嘴、鳍、身体和花纹可以自由组合。\n\n## 亲子解释与证据范围\n\n${card.parent}\n\n本页事实引用 [claims.json](../claims.json)：${card.factIds.join('、')}。\n\n${card.sourceIds.map(id=>{const s=sources.records.find(r=>r.id===id);return `- [${s.institution}：${s.title}](${s.url})`;}).join('\n')}\n\n中文短名是孩子入口称呼，正式中文名为项目称呼或工作名；以学名明确对象，未统一认证所有地区俗名。艺术图不是照片，也不是精细分类检索图。\n\n## 已制作素材\n\n- [PNG 原始插画](../../../design/content/v1/illustrations/${card.id}.png)\n- [WebP 透明展示图](../../../public/content/v1/${card.image})\n- [短介绍音频](../../../public/content/v1/${card.introAudio})；另有 3 段点听音频，见 [脚本登记](../scripts/audio-v1.json)。\n- [互动预览](../../../public/content/v1/index.html) 包含局部编号、重听、停止和亲子来源展开。\n\n成品用于素材评审和接入准备。声音为系统合成试听，正式分发的声音授权单列；鱼的真实泳姿、精细三维结构和原目录全部历史行为仍不因插画完成而自动认证。\n`;
  write(`docs/content/species/${card.id}.md`,packet);
}
addClip('VO-RM-INTRO','这是一只海葵，也是这种小丑鱼的伙伴。',['AO-03','RM-01'],'radianthus-magnifica');
addClip('VO-RF-CORAL','珊瑚也是动物。',['RF-01'],'reef-shallows');
for(const [id,text] of [['LOOK','看看真实的鱼。'],['DRAW','回去画你的鱼吧。'],['SAVED','保存好啦。'],['OCEAN','你的鱼，游进海里啦。'],['CAUGHT','钓到啦！'],['AGAIN','再听一遍。']]) addClip(`VO-UI-${id}`,text,[],'interface','operation');
write('docs/content/scripts/audio-v1.json',{schemaVersion:1,date,autoPlay:false,overlap:false,rightsStatus:'local-review-only',records:clips});
write('public/content/v1/data.json',{schemaVersion:1,date,fish,sources:sources.records,claims:claims.records.filter(r=>r.status==='checked'),clips,host:{id:'radianthus-magnifica',name:'海葵伙伴',scientificName:'Radianthus magnifica',image:'illustrations/radianthus-magnifica.webp',audio:'audio/vo-rm-intro.wav',factIds:['AO-03','RM-01','RM-03','RM-04']},environments:[{id:'reef',name:'珊瑚浅海',image:'environments/reef-panorama.webp',description:'沙地通道 · 珊瑚礁体 · 清亮蓝水'},{id:'rock',name:'岩礁海岸',image:'environments/rock-panorama.webp',description:'岩壁石拱 · 卵石底部 · 海藻丛'}]});

// Editable vector labels around original bitmap illustrations. No external reference photo is embedded.
const xml = s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const embedded = id=>`data:image/webp;base64,${fs.readFileSync(`public/content/v1/illustrations/${id}.webp`).toString('base64')}`;
const shell=(title,subtitle,body)=>`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="800" viewBox="0 0 1200 800" role="img"><title>${xml(title)}</title><desc>${xml(subtitle)}</desc><rect width="1200" height="800" rx="32" fill="#f8f5ec"/><g font-family="Microsoft YaHei, sans-serif" fill="#153e4d"><text x="60" y="80" font-size="36" font-weight="700">${xml(title)}</text><text x="60" y="124" font-size="20">${xml(subtitle)}</text>${body}<text x="60" y="760" font-size="17" fill="#55717a">原创插画与可编辑标注 · 科学观察提供灵感，创作不需要照着画 · 2026-10-06</text></g></svg>`;
const guides=[];
for(const [slug,id,title,labels,facts] of [
  ['clown-bands','amphiprion-ocellaris','白带在哪里？',['头部白带','身体中间白带','尾根白带'],['AO-02']],
  ['forceps-mouth','forcipiger-flavissimus','看看长嘴与黑点',['细长的嘴','头上黑、下白','臀鳍上的黑点'],['FF-01','FF-02','FF-03']],
  ['puffer-pattern','arothron-hispidus','点点、线条和圆环',['上侧白色点点','下侧浅色线条','胸鳍根部深浅环'],['AH-01','AH-02']]
]){
  const card=fish.find(f=>f.id===id); const points=slug==='clown-bands'?[[.32,.46],[.49,.46],[.69,.5]]:slug==='forceps-mouth'?[[.2,.42],[.35,.34],[.67,.67]]:[[.51,.39],[.52,.62],[.36,.56]];
  const body=`<image x="35" y="175" width="820" height="470" href="${embedded(id)}"/>${labels.map((label,i)=>{const x=35+points[i][0]*820,y=175+points[i][1]*470,ly=265+i*120;return `<path d="M${x},${y} L830,${ly-10} L880,${ly-10}" stroke="#1f8395" stroke-width="3" fill="none"/><circle cx="${x}" cy="${y}" r="20" fill="#fff2ba" stroke="#1f8395" stroke-width="3"/><text x="${x}" y="${y+7}" text-anchor="middle" font-size="20">${i+1}</text><text x="900" y="${ly}" font-size="24">${xml(label)}</text>`;}).join('')}<text x="60" y="700" font-size="21">${xml(card.scientificName)} · 依据 ${facts.join(' / ')}</text>`;
  guides.push({id:slug,title,file:`guides/${slug}.svg`,factIds:facts}); write(`public/content/v1/guides/${slug}.svg`,shell(title,'沿着图片找一找，再把喜欢的元素用到你的鱼上。',body));
}
guides.push({id:'host-partners',title:'小丑鱼与它的海葵伙伴',file:'guides/host-partners.svg',factIds:['AO-03','RM-01','RM-03','RM-04']});
write('public/content/v1/guides/host-partners.svg',shell('小丑鱼与它的海葵伙伴','这里只介绍这一对明确物种，不把所有海葵和所有鱼混在一起。',`<image x="80" y="170" width="440" height="390" href="${embedded('amphiprion-ocellaris')}"/><image x="625" y="170" width="490" height="390" href="${embedded('radianthus-magnifica')}"/><path d="M540 400 L610 400" stroke="#1f8395" stroke-width="5"/><text x="75" y="610" font-size="27">眼斑双锯鱼</text><text x="625" y="610" font-size="27">Radianthus magnifica</text><text x="75" y="655" font-size="22">Amphiprion ocellaris</text><text x="75" y="707" font-size="20">依据 AO-03 / RM-01 / RM-03 / RM-04；颜色与比例为示意，未宣称同一新加坡野外地点。</text>`));
guides.push({id:'shape-inspiration',title:'三种身体的灵感',file:'guides/shape-inspiration.svg',factIds:['AO-02','FF-01','AH-03']});
write('public/content/v1/guides/shape-inspiration.svg',shell('三种身体的灵感','观察身体、嘴与鳍的不同，再自由组合。',fish.slice(0,3).map((f,i)=>`<rect x="${45+i*385}" y="210" width="350" height="430" rx="24" fill="#e8f0ea"/><image x="${45+i*385}" y="245" width="350" height="280" href="${embedded(f.id)}"/><text x="${70+i*385}" y="580" font-size="25">${['白带与鳍色','长嘴与高身体','圆身体与点线'][i]}</text>`).join('')+'<text x="60" y="710" font-size="22">外形比较不直接等同速度、力量或游戏难度。</text>'));
guides.push({id:'real-and-imagined',title:'看真实的鱼，画自己的鱼',file:'guides/real-and-imagined.svg',factIds:['AO-02']});
write('public/content/v1/guides/real-and-imagined.svg',shell('看真实的鱼，画自己的鱼','科学图帮助观察；幻想作品不需要变成标准答案。',`<rect x="55" y="190" width="520" height="480" rx="30" fill="#e8f0ea"/><rect x="625" y="190" width="520" height="480" rx="30" fill="#f8e4cc"/><image x="70" y="230" width="490" height="330" href="${embedded('amphiprion-ocellaris')}"/><image x="640" y="230" width="490" height="330" href="${embedded('fantasy-bubble-star')}"/><text x="85" y="610" font-size="28">真实物种的典型白带</text><text x="655" y="610" font-size="28">幻想示例：泡泡星</text><text x="60" y="710" font-size="21">右图是原创 AI 创作示例，不是孩子实际作品，也不是一种真实海洋生物。</text>`));
const groupers=fish.filter(f=>f.group==='grouper');
const grouperTraits=['橙点 + 斜斜的深带','红色底 + 深边蓝点','大斑块 + 密密小点','蜂窝纹 + 浅色缝隙','成鱼灰褐 + 大嘴','褐色底 + 深边蓝点'];
const grouperBody=groupers.map((f,i)=>{const x=40+(i%3)*380,y=145+Math.floor(i/3)*290;return `<rect x="${x}" y="${y}" width="360" height="270" rx="22" fill="#e6eee6"/><image x="${x+10}" y="${y+5}" width="340" height="170" href="${embedded(f.id)}"/><text x="${x+20}" y="${y+196}" font-size="26" font-weight="700">${xml(f.name)}</text><text x="${x+20}" y="${y+232}" font-size="20">${xml(grouperTraits[i])}</text><text x="${x+20}" y="${y+255}" font-size="13">${xml(f.scientificName)} · ${f.prefix}-01</text>`;}).join('');
guides.push({id:'grouper-families',title:'六种石斑，各有自己的花衣服',file:'guides/grouper-families.svg',factIds:groupers.flatMap(f=>f.factIds)});
write('public/content/v1/guides/grouper-families.svg',shell('六种石斑，各有自己的花衣服','比较所选色型的点、带、斑块与身体；图中不按真实大小比例排列。',grouperBody));
for(const guide of guides){fs.mkdirSync('design/content/v1/guides',{recursive:true}); fs.copyFileSync(`public/content/v1/${guide.file}`,`design/content/v1/${guide.file}`);}
const data=read('public/content/v1/data.json');data.guides=guides;write('public/content/v1/data.json',data);
write('docs/content/scripts/all-fish.md',`# ${fish.length} 鱼点听成品脚本\n\n2026-10-06 · ${clips.length} 段本地合成试听。机器可读主记录：[audio-v1.json](audio-v1.json)。短介绍与三个点听由孩子主动播放，支持重听、停止、切换对象时停止。\n\n| ID | 文本 | 依据 | 文件 |\n| --- | --- | --- | --- |\n${clips.map(c=>`| ${c.id} | ${c.text} | ${c.factIds.join('、')||'原创操作提示'} | [WAV](../../../public/content/v1/${c.file}) |`).join('\n')}\n\n声音来源：Microsoft Huihui Desktop，zh-CN，速率 -1；PCM 24kHz / 16bit / 单声道。生成工具：[generate-content-audio.ps1](../../../scripts/generate-content-audio.ps1)。本地试听用途与正式分发授权分别记录，系统语音不标成项目自有配音。儿童理解、真实 iPad 听感与家长审美仍以试玩反馈为准。\n`);
write('docs/content/species/radianthus-magnifica.md',`# Radianthus magnifica · 海葵内容包\n\n2026-10-06 · 主代理亲自制作与核对。旧资料使用 Heteractis magnifica；当前命名映射证据见 RM-01（WoRMS 索引及图片物种标签，详情页读取限制仍登记）。\n\n![海葵原创示意](../../../public/content/v1/illustrations/radianthus-magnifica.webp)\n\n这是与本包眼斑双锯鱼建立宿主关系的一种明确海葵。孩子点听：这是一只海葵，也是这种小丑鱼的伙伴。\n\n形态依据 RM-03、RM-04：2021 年红海与亚丁湾实地研究记录长触手、圆或微膨端部、红至紫色柱体与暴露礁石附着。紫柱与绿触手是选择的示意色型；不是所有个体的唯一颜色，也不证明当前两种鱼葵在同一新加坡地点出现。\n\n- [原始研究：Bennett-Smith 等（2021）](https://link.springer.com/article/10.1186/s41200-021-00216-6)，Results / Heteractis magnifica。\n- [事实表](../claims.json)：AO-03、RM-01、RM-02、RM-03、RM-04。\n- [可编辑配对参考图](../../../public/content/v1/guides/host-partners.svg)\n- [透明 WebP](../../../public/content/v1/illustrations/radianthus-magnifica.webp)、[PNG 原图](../../../design/content/v1/illustrations/radianthus-magnifica.png)、[中文声音](../../../public/content/v1/audio/vo-rm-intro.wav)\n\n完成的是 2D 观察插画与关系素材。制作任务 MAKE-RM-MODEL 的命名来自原计划；本轮没有新增海葵 GLB 或认证触手动画。\n`);
const generation=read('design/content/v1/generation.json');
for(const image of generation.records) upsert(assets.records,{id:`GEN-${image.id.toUpperCase()}`,subjectId:image.id,type:image.path.includes('/environments/')?'original-concept':'original-illustration',sourceId:null,sourceUrl:null,localPath:image.path,sourcePath:image.source,author:'Project / built-in imagegen',license:'AI-generated original project artwork; no third-party photo embedded',rightsStatus:'original-generated',allowedUse:'项目素材预览与后续接入；学术事实以 claims.json 为准，AI 图不是分类鉴定证据',checkedAt:date,downloaded:false,productReady:true,visualReview:'primary-agent-preview',modifications:'WebP export preserving alpha; resize without enlargement',notes:'生成提示、输入引用和尺寸见 design/content/v1/generation.json；成品已看图，家长审美与真机质量尚未验收'});
for(const guide of guides) upsert(assets.records,{id:`SVG-${guide.id.toUpperCase()}`,subjectId:guide.id,type:'original-diagram',localPath:`public/content/v1/${guide.file}`,sourcePath:`design/content/v1/${guide.file}`,factIds:guide.factIds,author:'Project / primary-agent',license:'Original project vector labels with original generated illustrations',rightsStatus:'original',allowedUse:'预览、修改标注与后续内容接入',productReady:true,visualReview:'primary-agent-preview',checkedAt:date});
for(const clip of clips) upsert(assets.records,{id:clip.id,subjectId:clip.subjectId,type:'audio',localPath:`public/content/v1/${clip.file}`,factIds:clip.factIds,author:clip.voice,license:'System speech voice; local review use; distribution terms not verified',rightsStatus:'local-review-only',allowedUse:'本地试听；正式分发前核对系统声音授权或替换项目自有配音',productReady:false,audioReady:true,checkedAt:date,notes:'实际 WAV 已生成；没有把系统声音标成原创或 CC0'});
const completion={ 'MAKE-AO-PATTERN':'public/content/v1/guides/clown-bands.svg','MAKE-FF-MOUTH':'public/content/v1/guides/forceps-mouth.svg','MAKE-AH-PATTERN':'public/content/v1/guides/puffer-pattern.svg','MAKE-RM-MODEL':'public/content/v1/illustrations/radianthus-magnifica.webp','MAKE-SEA-STORYBOARD':'public/content/v1/environments/ocean-arrival.webp','MAKE-VOICE-SAMPLE':'public/content/v1/audio/vo-ao-intro.wav' };
for(const task of assets.records.filter(r=>completion[r.id])) {task.localPath=completion[task.id];task.author=task.type==='audio'?'Microsoft Huihui Desktop':'Project / primary-agent';task.license=task.type==='audio'?'system-voice-local-review':'original-project-artwork';task.rightsStatus=task.type==='audio'?'local-review-only':'original';task.allowedUse=task.type==='audio'?'本地试听':'素材预览与后续接入';task.productReady=task.type!=='audio';task.visualReview='primary-agent-preview';task.completionStatus='produced';task.notes=task.notes.replace(/；2026-10-06 成品已制作。海葵交付为插画，没有新增三维模型。/g,'')+'；2026-10-06 成品已制作。海葵交付为插画，没有新增三维模型。';}
write('docs/content/assets.json',assets);
console.log(JSON.stringify({fish:fish.length,images:generation.records.length,guides:guides.length,audioScripts:clips.length,sources:sources.records.length,claims:claims.records.length,checked:claims.records.filter(c=>c.status==='checked').length}));
