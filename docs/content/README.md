# 海洋资料与素材包 v1 · 扩展批次已完成

当前生产安排见 [素材计划](../CONTENT_ASSET_PLAN.md)，总文档入口见 [索引](../README.md)。物种卡、事实、来源、资产清单和机器脚本保留原路径；生产历史仅作追溯。新增捏形操作语音独立记录在 [儿童帮助脚本](scripts/child-help-audio.json)，不计入 128 段观察声音。

2026-10-07 游戏接入：四个创作学习主题、礁区／岩礁观察和参数三维样板，见 [主题事实索引](research/integrated-topics.json) 与 [实现范围](../archive/2026-10/REMAINING_STAGE.md)。真实鱼插画与语音数量保持本表口径；原创三维鱼从孩子设计生成，不增加钓鱼物种。

2026-10-06 · 主代理亲自制作与核对 · 面向新加坡小学一年级孩子的自由造鱼和观察学习。

**30 种真实鱼的观察素材已完成**（原有 12＋新增 18，含六种石斑）。打开 [互动素材预览](http://127.0.0.1:5175/content/v1/index.html#fish)，可按图片选鱼、筛选石斑或特别体形、点听、放大与查看亲子来源。

## 成品清单

| 成品 | 数量 | 文件 |
| --- | --- | --- |
| 鱼类观察卡 | 30 份 | [species/](species)、[预览数据](../../public/content/v1/data.json)，每鱼介绍、三个点听、创作邀请及亲子解释 |
| 原创透明插画 | 32 张 | [30 鱼＋海葵＋幻想鱼 WebP](../../public/content/v1/illustrations)、[原始 PNG](../../design/content/v1/illustrations) |
| 海洋画面 | 4 张 | [environments/](../../public/content/v1/environments)，珊瑚全景、岩礁全景、近看与入海分镜 |
| 可编辑参考图 | 7 张 | [guides/](../../public/content/v1/guides)，包含 [六种石斑对比](../../public/content/v1/guides/grouper-families.svg) |
| 中文实际试听 | 128 段 | [audio/](../../public/content/v1/audio)、[完整脚本](scripts/all-fish.md)、[JSON 脚本](scripts/audio-v1.json) |
| 来源登记 | 38 项 | [sources.json](sources.json)，博物馆、水族馆、政府机构、数据库与原始研究 |
| 事实与疑点 | 103 条 | [claims.json](claims.json)，102 条经来源核对、1 条历史机制疑点排除 |
| 明确物种关系 | 1 组 | [relationships.json](relationships.json)，眼斑双锯鱼与明确海葵宿主 |

声音为 Microsoft Huihui Desktop 的本地系统合成试听，PCM 24kHz／16bit／单声道。每鱼四段声音，由孩子主动点听；切换鱼、筛选或离开页面停止播放。图形为原创 AI 插画与原生 SVG 标注，未导入第三方照片；“泡泡星”是幻想示例。

## 新增 18 鱼

- 石斑六种：橙点石斑、东星斑、老虎斑、蜂窝石斑、龙趸、蓝点石斑，逐种指定学名和所选色型。
- 近海兴趣：GT 大鲹、海狼／大魣、亚洲海鲈、康氏马鲛。
- 礁区花纹：蓝纹鹦嘴鱼、帝王神仙鱼。
- 特别体形：大头带鱼、黄箱鲀、河口海马。
- 世界海域：大西洋鳕、黄鳍金枪鱼、巨型蝠鲼。

带鱼没有扇形尾鳍，海马竖直展示，蝠鲼用展开胸鳍的背面视角。黄箱鲀选择幼鱼色型；神仙鱼、龙趸选择成鱼；鹦嘴鱼明确初始阶段。中文俗名是工作称呼，准确对象用学名定位。

## 资料与复用

- [准备计划 v0.4](../archive/2026-10/CONTENT_ASSET_PLAN.md)、[已有游戏目录与观察素材盘点](inventory.md)。
- [52 对象候选库](research/expansion-shortlist-v2.md)、[本批名单与理由](research/next-batch-v2.md)、[新增逐条事实和制作定义](research/production-batch-v2.json)。
- [总交付登记](delivery-v1.json)、[本批 18 鱼交付](delivery-v2.json)。
- [素材登记](assets.json)、[生成提示与尺寸](../../design/content/v1/generation.json)、[本批生成输入](../../design/content/v1/generation-jobs-v2.json)、[文件哈希](../../public/content/v1/integrity.json)。
- [素材文件检查](verification-v1.json)、[预览检查](browser-verification-v1.json)、[截图](../../design/content/v1/qa)。
- [珊瑚浅海](themes/reef-shallows.md)、[岩礁海岸](themes/coastal-rock.md)、[创作部件参考](themes/creation-reference.md)。

启动开发服务后访问 `/content/v1/index.html`。SVG 内嵌原创 WebP，可独立保存并编辑文字标注。脚本位于项目 scripts/：导出图像、构建鱼卡、合成新增声音、素材检查与预览检查均可复现，图像生成输入已保存。

## 交付范围

工坊观察与借灵感已接入：在 [创造工坊](http://127.0.0.1:5175/create) 点「看看鱼」，可选鱼、点听、查看来源，把参考留在画布旁继续画。30 鱼可试色卡配色；白带、圆点与蜂窝三种花纹可预览改色、调大小／间距／疏密，喜欢再用，原笔迹和印章保留且可撤销。实现与有限验证见 [工坊灵感样板](../archive/2026-10/WORKSHOP_INSPIRATION.md)。完整鱼类造型和入海表现继续推进。

已完成二维观察素材与互动评审页，游戏仍保留既有 12 鱼模型，没有新增 GLB 或替换 3D 场景。海马和蝠鲼先用于观察、创作和海洋灵感，不进入普通捕获池；大西洋鳕不当作新加坡珊瑚礁当地鱼。候选库剩余 22 个对象尚未制作。

珊瑚全景已接入 [我的海洋](http://127.0.0.1:5175/ocean) 的二维背景，支持作品展示与泡泡陪玩，见 [样板说明](../archive/2026-10/OCEAN_PLAY.md)。新增一段玩法点听放在 `public/audio/`，单独记录，不并入本素材包的 128 段计数。

事实核对记录来源和适用条件，艺术图不是精细分类检索图，也不证明全部鱼在同一海域共存。系统声音为本地试听版，正式分发授权状态见素材登记。iPad 9 真机听感与孩子体验留待试玩。

本批只检查素材引用、透明导出、实际声音及预览交互和布局，没有运行全量游戏测试或构建。


## 2026-10-07：素材接入更新

现有 30 鱼资料已进入正式图鉴及嘴巴学习，小丑鱼—明确海葵—珊瑚礁样板复用本包的事实与声音。新增食性核对记录在 [关系接入核对](research/reef-relations-integration.json)，新增 13 段玩法／1 段食物讲解和 2 段程序海浪位于 `public/audio/`，独立于当前 `content/v1` 完整性清单及 128 段口径。游戏接入与证据见 [计划 4–12 交付](../archive/2026-10/LEARNING_PLAY.md)。
