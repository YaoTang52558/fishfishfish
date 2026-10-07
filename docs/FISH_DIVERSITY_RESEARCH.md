# 基础鱼类种类与创作扩展调研

2026-10-06 · 初步检索与现有代码评估。相关准备流程见 [资料与素材计划](CONTENT_ASSET_PLAN.md)。

**本页数量路线为早期方案。** 最新 [扩展初筛 v2](content/research/expansion-shortlist-v2.md) 为 40 个新增候选＋原有 12 鱼，共 52 个对象；其中新增 18 种已制作，总成品 30 种。名单与产出见 [本批选材和交付](content/research/next-batch-v2.md)。候选、二维观察素材与游戏三维模型分别计数。

## 1. 结论与数量口径

建议把下一轮真实鱼参考库规划为 **20 种的第一目标，逐步到约 24–30 种**，同时完善几个有明显差异的创作结构。这个范围是内容与制作的初步估计，不是已实现数量、工期承诺或性能测试结论。

本次整理了 **24 个对象的候选池：现有 12 种＋优先研究的 8 种＋需要较多结构／动作适配的 4 种**。现有 12 种继续保留，是否都适合放进同一个新场景需另查环境组合；候选加入资料库、图鉴、创作参考与钓鱼池分别决定。

| 数量口径 | 指的是什么 | 当前与建议 |
| --- | --- | --- |
| 真实物种 | 有明确学名、可核对资料和独立识别特征的生物 | 当前 12 种；优先研究新增 8 种，形成总数 20 的内容目标；特殊对象再分批补充 |
| 创作基础结构 | 鱼体、部件连接、可编辑参数和动作的一套基础 | 当前有 5 个身体选项，但不等于已经支持所有真实鱼形；先提高通用、侧扁、圆胖等结构，扩展后可形成约 8–10 类制作结构 |
| 幻想创作 | 孩子组合部件、改比例、配色和自由绘画的作品 | 组合空间很大；作品总数不作为真实物种数，视觉质量与表达能力还需要样板评价 |
| 同屏数量 | 一次在海洋中同时呈现的对象 | 当前目标上限 20；资料库扩展到 30 不要求同时显示 30，iPad 实际表现仍需验证 |

首轮不把“20–30 种资料”理解成“立即制作 20–30 个完整 3D 创作模型”。原创鱼完整 3D、特定物种模型和图片素材各有独立的制作／接入工作。

## 2. 鱼类范围与分类方式

本轮围绕海洋与海岸主题，先调研海水鱼。金鱼、锦鲤、斗鱼等淡水创作主题可以以后单独设计，不混入珊瑚礁的真实生态说明。

FishBase 的检索首页在本次搜索中显示 06/2026 版本收录约 **36,700 种鱼**；这是数据库收录量，含海水与淡水，不是海洋鱼数，也不作为本项目内容目标。[FishBase](https://www.fishbase.se/)

海马、鳗鱼、鲨鱼和鳐鱼都可以纳入鱼类主题；鲨鱼与鳐鱼属于软骨鱼。海洋世界还可有其他生物，章鱼、水母、海星、珊瑚和海洋哺乳动物的资料与创作结构另列。[澳大利亚博物馆鱼类入口](https://australian.museum/learn/animals/fishes/)、[鲨鱼与软骨鱼说明](https://australian.museum/publications/sharks/what-is-a-shark/)、[Waikīkī Aquarium 动物分类入口](https://www.waikikiaquarium.org/experience/animal-guide/)

下表按外观、创作需要和常见展示主题组织，**不是统一层级的科学分类表**。正式资料仍保留科、属与种；儿童可通过图形与外观浏览，不要求先学分类名称。[水族馆鱼类主题索引](https://www.waikikiaquarium.org/experience/animal-guide/fishes/)

## 3. 基础类型与制作难度

难度是结合当前 Canvas 编辑器、身体轮廓与摆尾实现的工程判断，不是生物学事实或实测开发时间。

| 内容主题 | 可提供的创作差异 | 当前适配判断 | 优先顺序 |
| --- | --- | --- | --- |
| 小丑鱼与其他雀鲷 | 条纹、局部色块、短小鱼体 | 可复用通用／侧扁结构，校对比例与物种关键特征 | 优先 |
| 蝴蝶鱼 | 高侧扁身体、嘴形、眼部与体侧图案 | 可复用侧扁结构，部分需要嘴与鳍的细节补充 | 优先 |
| 海水神仙鱼 | 侧扁轮廓、不同花纹，部分物种幼成体差异明显 | 基础结构可复用；专用花纹与阶段资料需补充 | 优先 |
| 刺尾鱼 | 身体轮廓、色块与尾柄局部识别 | 已有两种；需保证关键局部在模型与图鉴中可观察 | 优先 |
| 隆头鱼与鹦嘴鱼主题 | 修长比例、嘴形和鳍尾变化 | 隆头鱼可先适配；鹦嘴外形与动作另做细节样板 | 第二批 |
| 石斑、鲷与鲉等岩礁主题 | 头身比例、斑块、鳍的外观 | 多数可复用基础结构，资料与地域组合分别核对 | 第二批 |
| 鲀类 | 圆胖体形、点状图案与鳍动作 | 已有一鱼；仅圆轮廓与摆尾不足以代表真实动作 | 优先完善 |
| 箱鲀 | 箱状身体和小鳍 | 需要新身体轮廓；完整 3D 须表现体积，方头替换不足以完成箱形身体 | 结构扩展 |
| 鳞鲀 | 轮廓、醒目的局部图案与鳍 | 需要专用鳍和花纹；可先做参考／图鉴，再决定创作结构 | 结构扩展 |
| 鳗鱼 | 细长身体与连续波动 | 已有细长选项，但当前主要摆尾动作需增加全身变形 | 结构扩展 |
| 海马与海龙主题 | 竖直姿态、管状吻、尾与附属结构 | 需要独立连接布局、编辑区域与动作；不能只拉长现有鱼 | 较后 |
| 鲨鱼 | 鳍位、尾形、鳃裂与体形 | 需要专门结构、特征与动作；可先作为观察与灵感 | 较后 |
| 鳐鱼 | 宽展的盘形轮廓与胸鳍运动 | 需要盘形结构和相应展示角度；当前“三角身体”不等于完整鳐鱼支持 | 较后 |
| 比目鱼 | 成体不对称的眼位与底栖展示 | 需要两侧性质、眼位和朝向处理，当前单侧镜像机制需适配 | 较后 |

鳗形全身波动及不同鳍的运动可参照 [Florida Museum 游动说明](https://www.floridamuseum.ufl.edu/discover-fish/fish/how-fish-swim/)；箱体结构参照 [黄箱鲀](https://australian.museum/learn/animals/fishes/yellow-boxfish-ostracion-cubicus/)；鳐的盘形与比目鱼眼位分别参照 [大西洋魟](https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/atlantic-stingray/) 与 [眼斑鲆](https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/eyed-flounder/)。这里只提取结构问题，尚未为所有类型建立完整动作资料。

## 4. 24 个候选对象

### 4.1 现有 12 种

本轮从 `src/catalog/species.ts` 核对名称与对象数，未重新核验全部事实：

| 珊瑚外缘的现有对象 | 近岸岩礁的现有对象 |
| --- | --- |
| 眼斑双锯鱼 `Amphiprion ocellaris` | 许氏平鲉 `Sebastes schlegelii` |
| 黄高鳍刺尾鱼 `Zebrasoma flavescens` | 黑棘鲷 `Acanthopagrus schlegelii` |
| 黄尾副刺尾鱼 `Paracanthurus hepatus` | 大泷六线鱼 `Hexagrammos otakii` |
| 黄镊口鱼 `Forcipiger flavissimus` | 条石鲷 `Oplegnathus fasciatus` |
| 纹腹叉鼻鲀 `Arothron hispidus` | 斑鱾 `Girella punctata` |
| 角镰鱼 `Zanclus cornutus` | 褐菖鲉 `Sebastiscus marmoratus` |

两列是现有游戏钓场配置，不是新加坡实物种群调查或实际可捕获清单。

### 4.2 优先新增研究的 8 种

工作标签帮助讨论外观，不作为最终中文规范名称。新增候选均需按准备计划核对接受学名、中文名、生命阶段、素材与场景适用性，当前未写入游戏。

| 工作标签与学名 | 研究用途与需核对的差异 | 本次找到的资料入口 |
| --- | --- | --- |
| 蓝绿雀鲷候选 `Chromis viridis` | 配色与小鱼群主题；需要区分相似种，正式入库前复查身份 | [澳大利亚博物馆野外指南](https://lifg.australian.museum/Group.html?groupId=bWdTTXD5&hierarchyId=CEJQQmVx) |
| 黑白条纹雀鲷候选 `Dascyllus aruanus` | 对比白带与黑白图案；花纹功能解释不能仅从颜色推断 | [博物馆研究说明](https://australian.museum/blog-archive/science/life-lizard-found-eaten/)、[NParks 名录](https://www.nparks.gov.sg/nature/species-list/marine-fishes) |
| 丝鳍蝴蝶鱼候选 `Chaetodon auriga` | 交叉图案、眼部黑带、鳍末端形态的视觉参考 | [博物馆野外指南](https://lifg.australian.museum/Group.html?groupId=aGG72P5b&hierarchyId=qBHH2Q3E) |
| 面罩蝴蝶鱼候选 `Chaetodon lunula` | 与现有长嘴蝴蝶鱼比较局部图案与嘴形 | [水族馆蝴蝶鱼索引](https://www.waikikiaquarium.org/experience/animal-guide/fishes/butterflyfishes/) |
| 帝王神仙鱼候选 `Pomacanthus imperator` | 幼成体花纹比较；两种外观仍算同一个物种 | [博物馆物种资料](https://australian.museum/learn/animals/fishes/emperor-angelfish-pomacanthus-imperator/) |
| 条纹神仙鱼候选 `Pygoplites diacanthus` | 侧扁形与花纹创作参考；关键局部细节待完整资料包核对 | [博物馆神仙鱼索引](https://australian.museum/learn/animals/fishes/pomacanthidae-angelfishes/)、[野外指南身份入口](https://lifg.australian.museum/Group.html?groupId=dowYxyIu) |
| 月尾隆头鱼候选 `Thalassoma lunare` | 身体比例、尾形随阶段变化的观察；先区分幼成体 | [博物馆物种资料](https://australian.museum/learn/animals/fishes/moon-wrasse-thalassoma-lunare/) |
| 蜂窝斑石斑候选 `Epinephelus merra` | 斑块、头身比例与口部参考 | [博物馆野外指南](https://lifg.australian.museum/Group.html?groupId=mnoeslPZ&hierarchyId=qBHH2Q3E) |

优先研究不等于必须全部采用。如果某对象与现有鱼差异不足、身份难确认或合适素材难取得，可以换成同主题的候选。它们增加的是资料、识别和创作参考，不能只应用新配色就宣称完成该物种的准确表现。

### 4.3 特殊结构的 4 种候选

| 对象与学名 | 创作价值与主要新增工作 | 资料入口 |
| --- | --- | --- |
| 黄箱鲀候选 `Ostracion cubicus` | 箱体轮廓、点状图案；新身体结构、局部鳍与阶段外形 | [博物馆资料](https://australian.museum/learn/animals/fishes/yellow-boxfish-ostracion-cubicus/) |
| 花纹鳞鲀候选 `Balistoides conspicillum` | 大色块与大白点、鳍的外形；局部图案与鳍动作 | [博物馆资料](https://australian.museum/learn/animals/fishes/clown-triggerfish-balistoides-conspicillum-bloch-schneider-1801/) |
| 巨型裸胸鳝候选 `Gymnothorax javanicus` | 长身体与斑点、洞穴观察；全身波动和形体适配 | [博物馆资料](https://australian.museum/learn/animals/fishes/giant-moray-gymnothorax-javanicus-bleeker-1859/) |
| 河口海马候选 `Hippocampus kuda` | 竖直鱼体、尾部与生境对比；独立结构和编辑方式 | [NParks 海马资料](https://www.nparks.gov.sg/florafaunaweb/fauna/3/0/305) |

海马资料入口含较早保护状态，不据此直接填写当前状态。它与海葵／珊瑚主题的同场景组合也不能仅凭“都是海洋生物”确定。

## 5. 怎么从 20 走到 30，以及创作结构怎么扩展

| 阶段 | 资料／内容数量 | 创作和表现重点 |
| --- | --- | --- |
| 现有基础 | 12 种 | 提升识别特征、画面、资料和孩子入口；保持作品数据与旧内容可用 |
| 第一扩展目标 | 20 种：现有 12＋优先候选 8 | 通用、侧扁、圆胖等结构与花纹做好；不同鱼有可观察差异；本轮三鱼资料样本仍先验证模板 |
| 特殊结构扩展 | 最多到 24 种候选 | 可先进入图鉴或观察内容；逐种决定箱体、鳗形、海马等是否进入可编辑创作 |
| 再按主题筛选 | 约 30 种作为下一轮规划范围 | 可从鹦嘴鱼、虾虎鱼、鲨鱼、鳐鱼、比目鱼、海龙等主题再选对象；这约 6 个新增位置尚未定物种 |

这里的 30 是分批策划的可选目标，24 个候选的深入审核也尚未完成。超过 30 种可以继续扩展，工作量随专用结构、动画、知识、素材与场景增长；目前没有证据需要把 50 或 100 种定为首版目标。

创作结构建议分开建设：第一步把通用／侧扁／圆胖三类的画面与部件连接做好；随后按兴趣增加细长鳗形、箱体、海马、鲨形、鳐盘形与比目鱼等结构，可形成约 8–10 类基础。具体数量取决于哪些结构需要独立系统、哪些可以合理复用，未开展建模样板验证。

当前五身体、五头、六尾、六鳍、五眼和五嘴，仅离散部件配置就有 `5 × 5 × 6 × 6 × 5 × 5 = 22,500` 种，另外还有比例、配色和自由绘画。这个算式表示配置空间，不表示每种组合都好看、互不相似或等于一种真实鱼；首先要让孩子的想法容易实现，作品有生命感。

## 6. 本次评估发现的结构边界

- 当前原创鱼在 `FishRenderer.ts` 侧面绘制，`swim.ts` 主要控制摆尾、鳍角度与左右转向。创建细长轮廓之后，还需要相应的全身动作才能表现鳗形特色。
- 当前“三角身体”的代码描述借鉴鳐鱼，但轮廓仍走通用头身拼接与侧面绘制。真实鳐鱼的宽展胸鳍、盘形、上下表面及展示角度需要独立处理。
- 当前 `FishDesign` 使用单侧纹理镜像。比目鱼成体双眼位于同一侧的表现需要新的眼位与两侧策略，不能仅改变身体宽高。
- 海马需要竖直姿态、吻与尾部的新连接和编辑区域；箱鲀需要身体而非仅头部的箱状轮廓。
- 真实资料库、可编辑结构、场景出场和捕获规则分别记录。新研究对象不自动加入钓鱼池，也不自动获得完整 3D 表现。

这些是阅读代码与形态资料得出的适配问题，本次没有改代码、做模型或运行游戏回归。

## 7. 新加坡关联与资料质量

[NParks 海洋鱼名录](https://www.nparks.gov.sg/nature/species-list/marine-fishes) 提供本地物种与国家保护状态入口，可为后续本地主题选材；[海岸与海洋生态资料](https://www.nparks.gov.sg/nature/ecosystems/coastal-marine) 可帮助选环境主题。是否本地出现、是否能与其他对象同场景，以及是否适合捕获均需分别核对。

本次提供的是基础种类、候选与可行性评估。新增候选尚待接受学名与中文名复查、逐项知识核对、素材许可与动画参考。引用页面中的照片没有被下载、授权或放入游戏。外观工作标签不作为标准中文命名，保护状态也未写入正式数据。

## 8. 建议后续交付

先按 [准备计划](CONTENT_ASSET_PLAN.md) 完成现有三鱼样本，再对优先 8 个候选分批整理。每个对象交付：身份与逐项来源、整体／局部参考、一个值得创作的特征、一个可观察差异、素材状态、适合的场景与结构工作。

正式选材时比较两点：孩子能否一眼看出不同，能否由它获得新的创作想法。资料深度、视觉辨识和表现质量达到同一标准后，再按本表逐步扩展。当前未启动 Luna 代理或将候选写入生产目录。
