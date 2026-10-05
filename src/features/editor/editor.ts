import { computed, ref, shallowRef } from 'vue';
import { brushLimits, stampLimits } from '../../catalog/fish.ts';
import {
  addStamp, changeColor, createFishDesign, randomizeDesign, removeStamp, updateStamp,
} from '../../domain/fish.ts';
import { getFishGeometry, hitRegion, pointInPolygon, type Axes } from '../../domain/geometry.ts';
import { createId } from '../../domain/id.ts';
import type { ColorSlot, FishDesign, Point, Stamp } from '../../domain/types.ts';
import { cropImageData, DesignCommand, PixelCommand } from './commands.ts';
import { History } from './history.ts';
import type { PaintLayer } from './paintLayer.ts';

export type Tool = 'pen' | 'glow' | 'eraser' | 'fill' | 'stamp';
export interface PointerSample { canonical: Point; local: Point; axes: Axes }
const regionSlot: Record<string, ColorSlot> = { head: 'head', body: 'body', fin: 'fin', tail: 'tail' };

/** 工坊编辑状态与命令。所有会改变作品的操作都通过这里进入撤销历史。 */
export function useEditor(color: PaintLayer, glow: PaintLayer, hooks: { paintChanged: () => void }) {
  const design = shallowRef<FishDesign>(createFishDesign());
  const tool = ref<Tool>('pen');
  const brushColor = ref('#24486B');
  const brushWidth = ref<number>(brushLimits.default);
  const stampKind = ref('starfish');
  const selectedStampId = ref<string | null>(null);
  const preview = shallowRef<FishDesign | null>(null);
  const message = ref('');
  /** 笔迹像素每次变化递增，驱动画布重绘。 */
  const paintTick = ref(0);
  const historyTick = ref(0);
  const history = new History(() => { historyTick.value += 1; });
  const canUndo = computed(() => (historyTick.value, history.canUndo));
  const canRedo = computed(() => (historyTick.value, history.canRedo));

  const pixelsChanged = () => { paintTick.value += 1; hooks.paintChanged(); };
  /** 撤销设计时保留当前纹理引用：纹理资产由存档层根据像素管理。 */
  const applyDesign = (next: FishDesign) => { design.value = { ...next, paint: design.value.paint }; };

  function commit(label: string, next: FishDesign) {
    const before = design.value;
    if (JSON.stringify(before) === JSON.stringify(next)) return;
    design.value = next;
    history.push(new DesignCommand(label, before, next, applyDesign));
  }
  /** 拖动滑块等连续操作：期间实时预览，结束时合并为一次撤销。 */
  let gestureStart: FishDesign | null = null;
  function live(next: FishDesign) { if (!gestureStart) gestureStart = design.value; design.value = next; }
  function endLive(label: string) {
    const start = gestureStart; gestureStart = null;
    if (start && JSON.stringify(start) !== JSON.stringify(design.value)) history.push(new DesignCommand(label, start, design.value, applyDesign));
  }

  // —— 笔迹 ——
  let stroke: { layers: PaintLayer[]; before: ImageData[]; label: string } | null = null;
  function beginStroke(sample: PointerSample) {
    const layers = tool.value === 'pen' ? [color] : tool.value === 'glow' ? [glow] : [color, glow];
    const mode = tool.value === 'eraser' ? 'erase' : 'paint';
    stroke = { layers, before: layers.map((layer) => layer.snapshot()), label: tool.value === 'eraser' ? '橡皮' : tool.value === 'glow' ? '发光笔' : '普通笔' };
    for (const layer of layers) { layer.takeDirty(); layer.begin(sample.canonical, sample.axes, { color: brushColor.value, width: brushWidth.value }, mode); }
    paintTick.value += 1;
  }
  function extendStroke(sample: PointerSample) {
    if (!stroke) return;
    for (const layer of stroke.layers) layer.extend(sample.canonical);
    paintTick.value += 1;
  }
  /** 抬笔、取消触摸都提交已画出的部分：一笔是一个撤销单位。 */
  function endStroke() {
    if (!stroke) return;
    const { layers, before, label } = stroke;
    stroke = null;
    const entries = layers.flatMap((layer, index) => {
      layer.end();
      const rect = layer.takeDirty();
      return rect ? [{ layer, rect, before: cropImageData(before[index]!, rect) }] : [];
    });
    if (entries.length) history.push(new PixelCommand(label, entries, pixelsChanged));
    pixelsChanged();
  }
  function clearPaint() {
    const full = { x: 0, y: 0, width: 512, height: 512 };
    const entries = [color, glow].filter((layer) => !layer.isEmpty()).map((layer) => ({ layer, rect: full, before: layer.snapshot() }));
    if (!entries.length) { message.value = '还没有可以清空的笔迹。'; return; }
    for (const entry of entries) entry.layer.clear();
    history.push(new PixelCommand('清空笔迹', entries, pixelsChanged));
    pixelsChanged();
    message.value = '已清空笔迹和发光，可以撤销。';
  }

  // —— 点按：区域换色、印章 ——
  let drag: { id: string; start: FishDesign; offset: Point; moved: boolean } | null = null;
  function hitStamp(sample: PointerSample): Stamp | undefined {
    const { axes } = sample;
    return [...design.value.stamps].reverse().find((stamp) => Math.hypot(sample.local.x - (stamp.u - 0.5) * axes.x, sample.local.y - (stamp.v - 0.5) * axes.y) <= stamp.scale * axes.x / 2 * 1.15);
  }
  function press(sample: PointerSample) {
    if (tool.value === 'pen' || tool.value === 'glow' || tool.value === 'eraser') { beginStroke(sample); return; }
    const geometry = getFishGeometry(design.value);
    if (tool.value === 'fill') {
      const region = hitRegion(geometry, sample.local);
      if (!region) { message.value = '点在鱼的身体、头、鳍或尾巴上，就能换底色。'; return; }
      commit('换底色', changeColor(design.value, regionSlot[region]!, brushColor.value));
      message.value = '';
      return;
    }
    const hit = hitStamp(sample);
    if (hit) {
      selectedStampId.value = hit.id;
      drag = { id: hit.id, start: design.value, offset: { x: hit.u - (sample.canonical.x + 0.5), y: hit.v - (sample.canonical.y + 0.5) }, moved: false };
      return;
    }
    if (!pointInPolygon(sample.local, geometry.contour)) { message.value = '印章要盖在鱼的身体上。'; return; }
    const stamp: Stamp = { id: createId(), kind: stampKind.value, color: brushColor.value, u: sample.canonical.x + 0.5, v: sample.canonical.y + 0.5, scale: stampLimits.scale.default, rotation: 0 };
    const next = addStamp(design.value, stamp);
    if (!next) { message.value = `最多盖 ${stampLimits.max} 枚印章；可以先删掉一枚。`; return; }
    commit('盖印章', next);
    selectedStampId.value = stamp.id;
    message.value = '';
  }
  function move(sample: PointerSample) {
    if (stroke) { extendStroke(sample); return; }
    if (!drag) return;
    drag.moved = true;
    design.value = updateStamp(design.value, drag.id, { u: sample.canonical.x + 0.5 + drag.offset.x, v: sample.canonical.y + 0.5 + drag.offset.y });
  }
  function release() {
    if (stroke) { endStroke(); return; }
    if (drag?.moved) history.push(new DesignCommand('移动印章', drag.start, design.value, applyDesign));
    drag = null;
  }

  const selectedStamp = computed(() => design.value.stamps.find((stamp) => stamp.id === selectedStampId.value) ?? null);
  function adjustStamp(label: string, patch: (stamp: Stamp) => Partial<Omit<Stamp, 'id'>>) {
    const stamp = selectedStamp.value;
    if (stamp) commit(label, updateStamp(design.value, stamp.id, patch(stamp)));
  }
  function deleteStamp() {
    const stamp = selectedStamp.value;
    if (!stamp) return;
    commit('删除印章', removeStamp(design.value, stamp.id));
    selectedStampId.value = null;
  }

  // —— 随机预览：未应用时不改变作品 ——
  function previewRandom(seed = Math.floor(Math.random() * 2 ** 32)) { preview.value = randomizeDesign(design.value, seed); }
  function applyPreview() {
    if (!preview.value) return;
    commit('随机造型', { ...preview.value, paint: design.value.paint, stamps: design.value.stamps });
    preview.value = null;
  }
  function cancelPreview() { preview.value = null; }

  async function undo() { if (!stroke && !drag) { await history.undo(); syncSelection(); } }
  async function redo() { if (!stroke && !drag) { await history.redo(); syncSelection(); } }
  function syncSelection() { if (!selectedStamp.value) selectedStampId.value = null; }

  return {
    design, tool, brushColor, brushWidth, stampKind, selectedStampId, selectedStamp, preview, message, paintTick,
    history, canUndo, canRedo,
    commit, live, endLive, press, move, release, clearPaint, adjustStamp, deleteStamp,
    previewRandom, applyPreview, cancelPreview, undo, redo,
    /** 草稿载入或新建：替换作品并清空历史（刷新后不保留撤销记录）。 */
    load(next: FishDesign | null) { design.value = next ?? createFishDesign(); history.clear(); selectedStampId.value = null; preview.value = null; paintTick.value += 1; },
  };
}
export type Editor = ReturnType<typeof useEditor>;
