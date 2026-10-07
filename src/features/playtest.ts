export const playtestItems = [
  { id: 'create', title: '造型、普通笔和发光笔', hint: '画几笔，捏轮廓、换部件、撤销；观察画笔是否跟手。' },
  { id: 'save', title: '试游、入海、刷新与再次编辑', hint: '修改原作或另存，确认名字、两层笔迹和造型完整。' },
  { id: 'find', title: '作品找回、收起与鱼卡', hint: '让孩子自己找一条鱼；收起再放回，导出图片。' },
  { id: 'knowledge', title: '观察、语音与回去创作', hint: '看看嘴／鳍／尾／身形，点听、停、重听，比较两条鱼。' },
  { id: 'fishing', title: '两个钓场与自然时长操作', hint: '抛竿、咬钩、左右控竿与松手放线；是否需要成人接手？' },
  { id: 'capture', title: '抄鱼、放生与图鉴记录', hint: '钓到、放生、刷新后找回记录，不能重复记账。' },
  { id: 'touch', title: '双指、转屏和取消触摸', hint: '收线＋控竿，回主屏／前台，横竖屏；没有粘住按钮。' },
  { id: 'sound', title: '静音、语音与减少动态', hint: '手动点听，关弹窗和后台会停止；减少动态还能完成玩法。' },
  { id: 'accessibility', title: 'VoiceOver 和字体放大', hint: '实际开启读屏，操作教学、收线、知识卡；文字能阅读。' },
  { id: 'backup', title: '跨设备备份', hint: '导出文件，再在另一个独立测试浏览器导入；比较作品和笔迹。' },
  { id: 'volume', title: '立体作品与海洋样板', hint: '旋转、暂停、恢复、点鱼；普通海洋与立体海洋各留 60 秒记录。' },
  { id: 'display', title: '大屏展示', hint: '可选：在家庭大屏打开指定地址，更新和结束连接。' },
] as const;
export type TestOutcome = 'unmeasured' | 'passed' | 'failed';
export function summarizePlaytest(rows: { outcome: TestOutcome }[]) { return { total: rows.length, passed: rows.filter(r => r.outcome === 'passed').length, failed: rows.filter(r => r.outcome === 'failed').length, unmeasured: rows.filter(r => r.outcome === 'unmeasured').length }; }
