# 原创素材源文件 v1

2026-10-06 · 本轮主代理亲自制作。

| 目录／记录 | 内容 |
| --- | --- |
| illustrations/ | 30 鱼、1 海葵、1 幻想鱼的原始透明 PNG |
| environments/ | 珊瑚浅海、岩礁海岸、作品近看、入海三幅分镜的原始 PNG |
| guides/ | 六张可编辑 SVG，内嵌项目原创图形 |
| generation.json | 各图实际提示、原始文件、引用输入、尺寸、WebP 导出与字节数 |
| qa/ | 电脑与两种平板尺寸的页面截图；不是实体 iPad 验收 |

轻量展示文件与实际声音在 [public/content/v1](../../../public/content/v1/)，全部资料在 [docs/content](../../../docs/content/README.md)。生成工具为内置 imagegen，SVG 标注由原生代码制作。素材中的幻想示例不是真实鱼，也不是孩子已创作的作品。

导出工具：[export-content-images.mjs](../../../scripts/export-content-images.mjs)（需要 Sharp）。内容与 SVG 组装：[build-content-pack.mjs](../../../scripts/build-content-pack.mjs)。声音：[generate-content-audio.ps1](../../../scripts/generate-content-audio.ps1)。文件检查：[check-content-pack.mjs](../../../scripts/check-content-pack.mjs)。浏览器检查：[preview-content-qa.mjs](../../../scripts/preview-content-qa.mjs)。

图形保留原始生成文件副本，不删外部生成目录。声音是 Microsoft Huihui Desktop 系统音色合成的本地试听版，文本独立可编辑；声音授权状态见素材登记。

扩展批次 18 张原图的生成输入见 [generation-jobs-v2.json](generation-jobs-v2.json)，汇总仍以 generation.json 为准。六种石斑对比参考为 guides/grouper-families.svg。
