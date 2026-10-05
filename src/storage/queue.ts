/**
 * 单写队列：本标签页内所有存档写入依次执行，不让两个事务交错读改写。
 * 跨标签页的防覆盖仍靠事务内比较修订号；BroadcastChannel 只用于提醒刷新。
 */
let tail: Promise<unknown> = Promise.resolve();
export function serialWrite<T>(operation: () => Promise<T>): Promise<T> {
  const run = tail.then(operation, operation);
  tail = run.catch(() => undefined);
  return run;
}

export type ChangeKind = 'draft' | 'fish' | 'settings' | 'profile' | 'discovery';
const channelName = 'fishfishfish-changes';
let channel: BroadcastChannel | null = null;
// 同一标签页里的其他 BroadcastChannel 也会收到消息，用标签页 ID 过滤自己的写入。
const tabId = Math.random().toString(36).slice(2);
function getChannel() {
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(channelName);
    // Node 测试环境里不让频道阻止进程退出；浏览器没有该方法。
    (channel as unknown as { unref?: () => void }).unref?.();
  }
  return channel;
}
export function notifyChange(kind: ChangeKind) {
  try { getChannel()?.postMessage({ kind, tabId }); } catch { /* 提醒失败不影响已完成的写入 */ }
}
/** 监听其他标签页的写入；返回取消函数。 */
export function onExternalChange(listener: (kind: ChangeKind) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => undefined;
  const own = new BroadcastChannel(channelName);
  own.onmessage = (event: MessageEvent<{ kind: ChangeKind; tabId: string }>) => { if (event.data.tabId !== tabId) listener(event.data.kind); };
  return () => own.close();
}
