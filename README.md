# fishfishfish · 我的海洋

2026-10-06 · 创造自己的鱼，探索真实鱼类，作品与发现保存在本机。

**当前：** 造鱼、海洋、图鉴、备份与旧版钓鱼已实现；3D 钓鱼 G1–G4 和 G5 教学／自动画质／候选构建已实现。G5 的 iPad 真机、VoiceOver 与亲子试玩尚未验收，正常正式构建仍使用旧钓场。

当前进度、已验证范围和剩余优先级统一看 [PROJECT_STATUS.md](docs/PROJECT_STATUS.md)。阶段历史保留在 [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)，不把历史或电脑模拟结果算作真机通过。

## 运行与构建

已验证 Windows、Node **22.22.3**、npm **10.9.8**；要求 Node 22.12+ 的 22.x 与 npm 10。依赖版本以 `package.json`、`package-lock.json` 为准，使用 `npm ci` 复现。

```sh
npm ci
npm run dev
```

| 用途 | 命令 | 地址 / 输出 |
| --- | --- | --- |
| 开发 | `npm run dev` | 本机 `http://127.0.0.1:5173/` |
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

工坊有 5 身体、5 头型、6 尾、6 套鳍、5 眼、5 嘴，比例调整、12 色、10 花纹、6 印章、普通／发光笔迹、30 步撤销重做、随机预览和 15 秒试游。可命名、选性格、保存、再次编辑；本机最多 30 条作品、海洋最多 20 条同屏。

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
