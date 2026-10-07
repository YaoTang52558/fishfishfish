# 我的海洋 · fishfishfish

让孩子自由造鱼、画花纹、试游并放进自己的海洋，从创作认识真实海洋生物。优先面向新加坡小学一二年级、iPad 9 或同等平板。

当前已有创作闭环、119 种海洋伙伴图鉴、自己的海洋和 3D 钓鱼候选版。工坊默认可以画，大鱼旁可画／擦／换色／捏形；首页能继续草稿或最近作品。完整三维仍为样板，iPad、VoiceOver 和亲子正式验收待完成。公网以后再定，大屏只在本机全屏展示。

## 开始试玩

要求 Node 22.12+ 的 22.x、npm 10；已验证 Node 22.22.3、npm 10.9.8。先运行 npm ci。

| 用途 | 命令 | 入口 |
| --- | --- | --- |
| 本机开发 | npm run dev | http://127.0.0.1:5173/create |
| 局域网开发 | npm run dev:lan | 同一 Wi-Fi：http://电脑IPv4:5175/create、/ocean、/journal |
| 新钓场开发 | npm run dev:lan | /dev/fishing-3d?habitat=coastal-rock |
| 正常构建／预览 | npm run build、npm run preview | dist，4173；普通钓鱼仍为旧版 |
| 压缩候选／平板试玩 | npm run build:3d-preview、npm run preview:3d | dist-fishing-preview，电脑IPv4:4174；普通钓鱼导航进入 3D |

保持电脑和服务运行。2026-10-07 WLAN 曾为 192.168.1.132，每次核对实际 IPv4。主机、端口、浏览器或设备不同有独立存档；换设备用「家长」里的完整备份，PNG 鱼卡不能继续编辑。当前没有账号或同步。

## 文档与验证

- [文档索引](docs/README.md)：当前规则、计划、内容依据和历史归档的统一入口。
- [项目状态](docs/PROJECT_STATUS.md)、[完整计划](docs/MASTER_PLAN.md)：功能／样板／待验收分别计算。
- [儿童体验与整改](docs/CHILD_EXPERIENCE.md)：这一轮实际调整与待试玩问题。
- [内容素材及来源](docs/content/README.md)：119 种观察伙伴（80 鱼＋39 其他生物）与 12 种钓鱼池分开计算。
- [G5 真机与家庭验收](docs/G5_PLAYTEST.md)：正式入口切换依赖真实记录。

规则／存档改动跑相关检查；页面改动看对应输入与画面；阶段收尾跑 npm run test、npm run build。儿童体验专项脚本：node scripts/verify-child-experience.mjs（隔离 Edge 测试，默认本机 5175）；文档链接：node scripts/check-doc-links.mjs。

数据在 IndexedDB 本地保存；默认提示音关闭，主动点听可播放并停止；可减少动态和手动调整帮助／挑战／知识深度，不要求每日游玩。HTML5 history 部署需回退 index.html；公网平台尚未选择。
