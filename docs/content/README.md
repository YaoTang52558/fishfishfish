# 海洋资料与素材包

2026-10-07 · [当前素材计划](../CONTENT_ASSET_PLAN.md) · [全部文档入口](../README.md)

现有 **119 种观察伙伴：80 种鱼、39 种其他海洋生物**。已接入正式图鉴、创造工坊的观察与借色、互动素材评审页。每卡一段介绍、三个主动点听、创作邀请和亲子来源。

| 类别 | 数量 |
| --- | ---: |
| 鱼（含六种石斑、鲨与鳐） | 80 |
| 虾与龙虾（含虾蛄） | 9 |
| 蟹（含拟石蟹） | 6 |
| 鱿鱼、乌贼与章鱼 | 7 |
| 螺与鲍鱼 | 5 |
| 双壳贝 | 9 |
| 海参、海胆、海蜇 | 3 |

## 成品及主记录

| 成品 | 数量 | 文件 |
| --- | ---: | --- |
| 观察卡 | 119 | [物种文档](species)、[运行数据](../../public/content/v1/data.json) |
| 透明插画 | 121 | 119 伙伴＋海葵＋幻想鱼；[WebP](../../public/content/v1/illustrations)、[PNG](../../design/content/v1/illustrations) |
| 环境／分镜 | 4 | [环境图片](../../public/content/v1/environments) |
| 可编辑参考图 | 10 | [SVG](../../public/content/v1/guides)：六石斑、腕与触腕、龙虾螯、单双壳等 |
| 中文实际点听 | 484 | [声音](../../public/content/v1/audio)、[脚本](scripts/all-fish.md)、[JSON](scripts/audio-v1.json) |
| 事实／来源 | 370／128 | [事实表](claims.json)、[机构来源](sources.json)，369 条核对记录和 1 条排除的历史疑点 |

[新增 89 种名单](research/production-v3.md) · [制作定义](research/production-batch-v3.json) · [素材权利登记](assets.json) · [生成提示与原图尺寸](../../design/content/v1/generation.json) · [文件哈希](../../public/content/v1/integrity.json)

运行开发服务后访问 /journal，或 /content/v1/index.html#fish 评审素材。按类别点大图，也可展开搜索俗名，例如 GT、海狼、三文鱼、花螺、八爪鱼和生蚝。工坊“看看鱼”里新增虾蟹与贝入口，观察后继续自由造鱼。点听不自动播放，切换对象与离页停止。

## 边界与复现

插画是原创 AI 艺术示意，未嵌入第三方照片；不用于精确计数或分类鉴定。科学事实保留来源、阶段、色型、旧名及适用条件。新卡未设置未经图片标定的局部放大点。观察卡不是野外采集或可食判断工具；钓鱼仍为原有 12 种和 12 GLB，原创三维鱼依孩子设计生成。

声音为 Microsoft Huihui Desktop / zh-CN，Rate -1，24kHz 单声道 16bit PCM，本地试听用途；正式分发需核对授权或替换配音。操作帮助、玩法声音和合成海浪在 public/audio/，不计入 484 段观察素材。

复现顺序：export-content-images.mjs generation-jobs-v3.json → build-ocean-expansion.mjs → generate-content-audio.ps1 -SkipExisting → build-ocean-comparisons.mjs → check-content-pack.mjs。均位于项目 scripts；图像生成本身使用保存的完整提示，通过内置 imagegen 单独完成，不由导出脚本生成。旧 build-content-pack.mjs 只构建原 30 鱼，不能单独重跑覆盖新库。

[本轮交付](delivery-v3.json) · [素材检查](verification-v1.json) · [本轮浏览器检查](browser-verification-v3.json)

真实 iPad 9、Safari、儿童理解及科学专家评审仍待完成，模拟视口不等于真机验收。旧批次交付、候选与接入记录保留作历史追溯：[12 鱼](delivery-v1.json)、[新增 18 鱼](delivery-v2.json)、[52 对象初筛](research/expansion-shortlist-v2.md)、[旧制作定义](research/production-batch-v2.json)、[主题索引](research/integrated-topics.json)、[关系事实](research/reef-relations-integration.json)。
