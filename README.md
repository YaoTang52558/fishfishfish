# fishfishfish · 我的海洋

**计划 13–20 的近期样板已接入：** 四主题学习、场景观察、作品筛选与 PNG 鱼卡、可撤销塑形、立体转看与海洋、本机全屏及家庭／海洋记录。见 [本轮交付与边界](docs/REMAINING_STAGE.md)。真机／亲子仍待验收，公网以后再定。局域网开发用 npm run dev:lan。

2026-10-06 · 创造自己的鱼，探索真实鱼类，作品与发现保存在本机。

**产品核心：** 给孩子自由造鱼、发挥想象力与创造力的地方，并从自己的创作出发学习海洋生物知识。钓鱼与探索提供发现和灵感，图鉴回应好奇。下一轮共同讨论见 [产品迭代计划](docs/PRODUCT_EVOLUTION_PLAN.md)。

**当前：** 造鱼、海洋、图鉴、备份与旧版钓鱼已实现；3D 钓鱼 G1–G4 和 G5 教学／自动画质／候选构建已实现。G5 的 iPad 真机、VoiceOver 与亲子试玩尚未验收，正常正式构建仍使用旧钓场。

当前进度、已验证范围和剩余优先级统一看 [PROJECT_STATUS.md](docs/PROJECT_STATUS.md)。阶段历史保留在 [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)，不把历史或电脑模拟结果算作真机通过。

**最新全部计划（2026-10-07）：** [MASTER_PLAN.md](docs/MASTER_PLAN.md) 汇总已完成内容、20 项后续工作、建议顺序与发布边界。

**计划 1–3 的工坊样板已接入：** 中央大鱼、就近图形部位工具、下方颜色画笔；创作／试游／近看统一明亮水色。三步可往返，默认名字可直接入海，再编辑清楚区分更新与另存。说明和相关验证见 [WORKSHOP_STUDIO.md](docs/WORKSHOP_STUDIO.md)。

**计划 4–12 首版已接入：** 跟手指游与双海洋主题、图形语音帮助、嘴巴学习、正式 30 鱼图鉴与生态关系；两钓场地形／声音差异、中央收放线、连续抄鱼庆祝和独立成长设置。试玩入口、相关检查及边界见 [LEARNING_PLAY.md](docs/LEARNING_PLAY.md)。

**海洋素材包 v1 已制作：** 30 鱼观察卡、32 张透明插画、4 张海洋画面、7 张可编辑 SVG、128 段中文试听（新增 18 鱼，含六种石斑）。打开 [互动素材预览](http://127.0.0.1:5175/content/v1/index.html)，文件和来源见 [素材交付文档](docs/content/README.md)。素材评审页独立于当前游戏，尚未替换 3D 场景。

## 运行与构建

**工坊灵感已接入：** 在 [创造工坊](http://127.0.0.1:5175/create) 点「看看鱼」，选择并点听 30 鱼，把参考留在画布旁；也可先在自己的鱼上试颜色或白带／圆点／蜂窝纹，喜欢再应用，保留笔迹并可撤销。说明和有限验证见 [工坊灵感样板](docs/WORKSHOP_INSPIRATION.md)。

**作品近看与入海展示已接入：** 画布下点「近看」，放大整条鱼、花纹和脸，转身、暂停或看发光笔迹；保存后新鱼游入海洋，出现欢迎提示。海洋作品卡也能近看与找鱼。说明和有限验证见 [作品展示样板](docs/FISH_SHOWCASE.md)。

**浅海与陪玩样板已接入：** [我的海洋](http://127.0.0.1:5175/ocean) 采用已制作的珊瑚全景，扩大主画面；在画面旁近看、找鱼或玩泡泡，点听一句玩法说明。陪玩只改变临时游动，不改作品或笔迹。见 [浅海与泡泡说明](docs/OCEAN_PLAY.md)。

**作品图片卡已接入：** 海里的鱼稍微放大，选中鱼显示在前面；下方作品卡保留实际造型、笔迹和印章，收起的鱼也能认出。点正在海里的卡回到画面找鱼，随时明确收起或放回。预览只在本页内存中，不增加存档资产。

已验证 Windows、Node **22.22.3**、npm **10.9.8**；要求 Node 22.12+ 的 22.x 与 npm 10。依赖版本以 `package.json`、`package-lock.json` 为准，使用 `npm ci` 复现。

```sh
npm ci
npm run dev
```

| 用途 | 命令 | 地址 / 输出 |
| --- | --- | --- |
| 开发 | `npm run dev` | 本机 `http://127.0.0.1:5173/` |
| 局域网开发试玩 | `npm run dev:lan` | 同一 Wi-Fi 的 `http://电脑IPv4:5175/create`、`/ocean`、`/playtest` |
| 正常正式构建 | `npm run build` | `dist/`，钓鱼仍为旧版 |
| 正常构建预览 | `npm run preview` | 本机 `http://127.0.0.1:4173/` |
| G5 候选构建 | `npm run build:3d-preview` | `dist-fishing-preview/`，普通钓鱼导航进入 3D |
| 平板候选试玩 | `npm run preview:3d` | 局域网 `http://电脑IPv4:4174/preview/fishing-3d` |

路由采用 HTML5 history，部署时需回退到 `index.html`。发布平台尚未选定，没有公网部署。不同主机／端口的存档彼此独立，跨来源使用设置页备份导入导出。

## 3D 钓鱼入口

- [完整流程](http://127.0.0.1:5173/dev/fishing-3d)：两钓场、每场 6 种鱼；选饵／落点 → 咬钩提竿 → 海面控竿和收放线 → 抄起 → 知识卡 → 放生。
- [近岸岩礁](http://127.0.0.1:5173/dev/fishing-3d?habitat=coastal-rock)。
- [12 种鱼模型总览](http://127.0.0.1:5173/dev/fishing-3d/models)。
- [三动作练习](http://127.0.0.1:5173/dev/fishing-3d/practice)：保留水下观察，不写捕获记录。

完整流程固定在海面拉鱼，鼓轮随实际收线量转动；大鱼按物种大小增加拉力和耐力。知识可跳过，放生保留已保存发现。辅助延长提竿窗口、协助横游并可自动抄起；WebGL 失败可用同规则 Canvas 继续。默认静音，减少动态保留操作反馈。真实鱼资料与游戏难度配置分开。

平板访问、60 秒记录导出、真实触摸／读屏与家庭表单见 [G5_PLAYTEST.md](docs/G5_PLAYTEST.md)。

## 已有玩法与数据

工坊有 5 身体、5 头型、6 尾、6 套鳍、5 眼、5 嘴，比例调整、12 色、13 花纹、6 印章、普通／发光笔迹、30 步撤销重做、随机预览和 15 秒试游。新增三种花纹可调大小、间距或疏密。可命名、选性格、保存、再次编辑；本机最多 30 条作品、海洋最多 20 条同屏。

IndexedDB 保存草稿、作品、两层 PNG 和捕获；草稿 500ms 防抖，离页尝试完成保存。备份导入前校验数据并实际解码图片，确认后原子替换；失败保留当前作品或重试入口。图鉴分「海洋发现」和「我的创造」，灵感配色可撤销，原创鱼可以独立随机路过钓场。

## 验证方式

```sh
npm run typecheck
npm test
npm run build
```

最近一次完整回归为 **98 项通过**，正常与候选构建通过；具体阶段与设备范围见状态文档。这些不是完整 MVP 或真机验收的结论。

开发中按改动范围验证：文档只查链接和一致性；布局／动画只查相关画面与输入；规则／存档跑相关测试；阶段收尾或正式接入再执行一次完整回归和对应构建。已有检查通过、没有新相关变更时不重复执行。

## 文档索引

| 文件 | 职责 |
| --- | --- |
| [PROJECT_STATUS.md](docs/PROJECT_STATUS.md) | 当前状态、证据摘要、剩余工作与优先级；接手先读 |
| [PRODUCT_EVOLUTION_PLAN.md](docs/PRODUCT_EVOLUTION_PLAN.md) | 一年级亲子体验、游戏品质、成长难度与海洋知识体系的迭代讨论稿 |
| [CONTENT_ASSET_PLAN.md](docs/CONTENT_ASSET_PLAN.md) | 资料与素材准备：首批范围、证据与许可字段、Luna 调研交付及制作顺序 |
| [首批海洋内容包](docs/content/README.md) | 已开始执行：12 鱼盘点、三鱼与海葵资料、珊瑚浅海简报、来源／素材登记与短语音草案 |
| [FISH_DIVERSITY_RESEARCH.md](docs/FISH_DIVERSITY_RESEARCH.md) | 基础鱼类调研：24 个候选对象、20–30 种扩展范围与创作结构适配 |
| [PRD.md](docs/PRD.md) | 产品范围、需求编号、体验与完整 MVP 门槛 |
| [TECHNICAL_DESIGN.md](docs/TECHNICAL_DESIGN.md) | 模块、数据／备份契约、工坊与渲染、旧版／新版规则边界 |
| [FISHING_3D_DESIGN.md](docs/FISHING_3D_DESIGN.md) | 现行 3D 镜头、规则、资源预算和 G1–G5 验收条件 |
| [G5_PLAYTEST.md](docs/G5_PLAYTEST.md) | iPad 与亲子试玩步骤、待填写的实际记录 |
| [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | 开发顺序与逐阶段历史交付，不作为实时待办 |
| [FISHING_REDESIGN.md](docs/FISHING_REDESIGN.md) | 2026-10-05 调研归档；旧镜头设想已被后续反馈修订 |
| [DESIGN_ASSETS.md](docs/DESIGN_ASSETS.md) | 概念图来源与使用范围 |

## 模型维护与协作

12 份原创 GLB 和清单位于 `public/models/fishing/`，可编辑网格为 `src/rendering/fishing3d/species.ts`。开发服务运行时，用现有 Playwright 环境执行 `node scripts/export-fishing-models.cjs`；未在项目安装 Playwright 时，用 `FISH_PLAYWRIGHT_MODULE` 指向已有包。重新导出后须检查模型总览，再更新清单审核状态。

仓库为 `C:\tang\code\fish`，根目录 README 作为 GitHub 入口，项目文档集中在 `docs/`，概念图片保留在 `design/`；技能的 `SKILL.md` 保留规定路径。已有功能与用户未提交改动应保留；账号、商城、公共分享、跨设备同步、深海等 P1/P2 不在当前验收范围。可按明确需求使用 [branch-commit 技能](.agents/skills/branch-commit/SKILL.md) 做本地提交；推送、合并和部署按具体授权执行。

## 产品参考来源

需求主要来自用户提供的 PRD 和讨论。2026-10-05 的设计记录参考了 [Singapore Oceanarium 的 Art-quarium 介绍](https://www.singaporeoceanarium.com/en/animals-habitats/into-the-deep.html)，借鉴组合特征、创造数字鱼和了解适应性的互动方向。投影、命名、数字鱼卡与商业成效未在当时来源核对中证实，保留为本产品创意；本次文档整理没有重新查阅外部资料。
