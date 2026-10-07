# 现有鱼类与素材盘点

2026-10-06 · 读取 `src/catalog/species.ts` 与 `public/models/fishing/asset-manifest.json`。

现有 12 鱼均有外形、食性、栖息地、最大长度、2 条带来源的知识、1 组观察问答、渲染与游戏配置。共 24 条知识，46 个来源登记位置（不是 46 个独立来源）。12 个模型文件存在，清单记录原创程序网格与 `illustration-reviewed`。名称与既有 `verified` 为历史状态，本轮没有全部重新核实。

二维观察素材现为 **30 种**；下面 12 鱼表仍是已有游戏目录和模型盘点。新增 18 鱼不自动成为游戏模型／钓鱼池，详见 [扩展交付](delivery-v2.json)。

## 逐鱼素材覆盖

每种鱼已制作一张原创透明插画、完整观察卡和四段中文试听；事实覆盖以 claims.json 为准，不把尚未核对的历史功能当作新事实。

| 项目 ID | 中文标签／学名 | 既有知识／来源数 | 当前体形工具 | 下一步资料主题 | 本轮 |
| --- | --- | --- | --- | --- | --- |
| amphiprion-ocellaris | 眼斑双锯鱼 / Amphiprion ocellaris | 2 / 4 | streamlined | 白带分区、海葵关系、典型与地域色型 | 观察素材已完成 |
| zebrasoma-flavescens | 黄高鳍刺尾鱼 / Zebrasoma flavescens | 2 / 4 | compressed | 高体侧扁、背鳍、尾柄局部 | 观察素材已完成 |
| paracanthurus-hepatus | 黄尾副刺尾鱼 / Paracanthurus hepatus | 2 / 4 | compressed | 黑色体纹与黄尾、藏入珊瑚的行为证据 | 观察素材已完成 |
| forcipiger-flavissimus | 黄镊口鱼 / Forcipiger flavissimus | 2 / 4 | compressed | 长吻取食、臀鳍黑点、相似种 | 观察素材已完成 |
| arothron-hispidus | 纹腹叉鼻鲀 / Arothron hispidus | 2 / 4 | round | 上点下线、鳃口环纹、正常膨胀机制 | 素材完成；机制不讲 |
| zanclus-cornutus | 角镰鱼 / Zanclus cornutus | 2 / 4 | compressed | 背鳍延长部分、条带与轮廓 | 观察素材已完成 |
| sebastes-schlegelii | 许氏平鲉 / Sebastes schlegelii | 2 / 3 | wedge | 头与鳍局部、底栖环境，补图像证据 | 观察素材已完成 |
| acanthopagrus-schlegelii | 黑棘鲷 / Acanthopagrus schlegelii | 2 / 4 | compressed | 银灰配色与鳞片、嘴／食性对照 | 观察素材已完成 |
| hexagrammos-otakii | 大泷六线鱼 / Hexagrammos otakii | 2 / 4 | streamlined | 斑纹变化与相似种、鳍形 | 观察素材已完成 |
| oplegnathus-fasciatus | 条石鲷 / Oplegnathus fasciatus | 2 / 4 | compressed | 条带、嘴部与生长阶段，避免颜色一刀切 | 观察素材已完成 |
| girella-punctata | 斑鱾 / Girella punctata | 2 / 3 | compressed | 鳞片斑点与辨识、食性证据 | 观察素材已完成 |
| sebastiscus-marmoratus | 褐菖鲉 / Sebastiscus marmoratus | 2 / 4 | wedge | 斑纹与礁石环境、与许氏平鲉对比 | 观察素材已完成 |

## 字段覆盖与缺口

| 资料层 | 当前覆盖 | 本轮新增 |
| --- | --- | --- |
| 身份／常用名 | 12 条学名与中文标签；已保存来源入口 | 12 鱼新文案关联身份与来源，中文规范名未全部重核；海葵记录新旧学名 |
| 原子知识来源 | 24 条知识带 URL 与日期；外形／食性等为物种级来源集合 | 新事实记录来源段落、适用条件与审核状态 |
| 行为／生态关系 | 零散文字，缺独立关系登记 | 小丑鱼—明确海葵宿主关系；动作未查全 |
| 创作联系 | 渲染部件与图案已有 | 嘴／点／线／带的观察和绘画入口 |
| 儿童语音 | 128 段实际 WAV | 每鱼介绍＋三个点听；知识关联事实 ID |
| 参考图片许可 | 物种页链接不是逐图许可 | 6 个照片候选逐件登记；均未成为新增运行资源 |
| 模型 | 12 份 GLB，历史插画审查 | 三样本关联现有模型；尚未做新增资料的视觉核对 |
| 场景／地域 | 游戏分两钓场；游戏参数独立 | 珊瑚与岩礁两种不同构图，四张画面；新加坡记录不自动构成同域生态 |

## 优先问题

1. AH-06：现有河鲀“气囊”器官和膨胀机制待查；新脚本排除，游戏文案已替换成花纹观察。
2. 新旧海葵学名需映射，不新增第二个生物对象；发布前复查接受名详情。
3. 每个模型需要核对辨识特征和局部位置；颜色和比例仍可保留游戏美术取舍，并注明示意。
4. 真实游动、嘴部动作和环境同域记录缺口继续留空；通用动画不作为生物事实。
5. 其余 9 鱼本轮已补观察资料和素材，仍不把所有旧事实重新认证；新增 18 鱼成品及其余候选见 [种类调研](../archive/2026-10/FISH_DIVERSITY_RESEARCH.md)。

成品数量与复用入口见 [素材包 v1](README.md)，尺寸、透明、音频检查见 [verification-v1.json](verification-v1.json)。
