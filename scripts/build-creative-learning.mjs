import fs from 'node:fs';
import assert from 'node:assert/strict';
import { childName } from './lib/observation-names.mjs';
import { creativeTopics, topicAudio } from '../src/features/inspiration/creativeTopics.ts';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, data) => fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
const data = read('public/content/v1/data.json'), audio = read('docs/content/scripts/audio-v1.json'), assets = read('docs/content/assets.json');
const batch = read('docs/content/research/production-batch-v3.json');
const changed = [], date = '2026-10-08';
function upsert(rows, item) { const i = rows.findIndex(r => r.id === item.id); if (i < 0) rows.push(item); else rows[i] = item; }
for (const record of batch.records) {
  const card = data.fish.find(f => f.id === record.id); assert.ok(card);
  card.name = childName(record);
  card.aliases = [...new Set([...(card.aliases ?? []), record.name, card.formalName])];
  const intro = `这是${card.name}。${card.points[0].text}`;
  const clip = audio.records.find(c => c.file === card.introAudio); assert.ok(clip);
  // Expansion can have already updated the script while an old WAV still exists.
  if (clip.text !== intro || card.name !== record.name.replace(/（.*?）/g, '')) changed.push(clip);
  clip.text = intro;
  card.intro[0] = intro;
}
for (const [id, topic] of Object.entries(creativeTopics)) {
  const factIds = [...new Set(topic.examples.flatMap(example => {
    const card = data.fish.find(f => f.id === example.id); assert.ok(card, example.id);
    return example.keys.flatMap(key => { const point = card.points.find(p => p.key === key); assert.ok(point, `${example.id}/${key}`); return point.factIds; });
  }))];
  for (const fact of factIds) assert.ok(data.claims.some(c => c.id === fact && c.status === 'checked'));
  const clip = { id: `VO-CREATE-${id.toUpperCase()}`, text: topic.narration, factIds,
    subjectId: `creation-${id}`, kind: 'creative-prompt', file: topicAudio(id),
    voice: 'Microsoft Huihui Desktop / zh-CN', rate: -1, format: 'PCM 24000 Hz, mono, 16 bit',
    usage: '本地合成试听；公开分发前核对系统语音授权',
    pronunciation: '短句操作点子；引用事实与幻想画法分开，腕足不代表新三维部件' };
  const previous = audio.records.find(c => c.id === clip.id);
  if (previous?.text !== clip.text || !fs.existsSync(`public/content/v1/${clip.file}`)) changed.push(clip);
  upsert(audio.records, clip);
}
for (const clip of changed) upsert(assets.records, { id: clip.id, subjectId: clip.subjectId, type: 'audio',
  localPath: `public/content/v1/${clip.file}`, factIds: clip.factIds, author: clip.voice,
  license: 'System speech voice; local review use; distribution terms not verified', rightsStatus: 'local-review-only',
  allowedUse: '本地试听；正式分发前核对系统声音授权或替换配音', productReady: false, audioReady: true, checkedAt: date });
assert.equal(audio.records.length, 491);
data.clips = audio.records; data.contentUpdatedAt = date; audio.date = date;
write('public/content/v1/data.json', data); write('docs/content/scripts/audio-v1.json', audio); write('docs/content/assets.json', assets);
fs.mkdirSync('.verification', { recursive: true }); write('.verification/creative-learning-clips.json', { records: changed });
fs.writeFileSync('docs/content/scripts/all-fish.md', `# 海洋伙伴点听脚本\n\n${date} · 119 种伙伴，484 段观察与提示声音＋7 段创作点子，共 491 段本地合成试听。\n\n[机器可读主记录](audio-v1.json) · [生成工具](../../../scripts/generate-content-audio.ps1)\n\n| ID | 文本 | 依据 | 文件 |\n| --- | --- | --- | --- |\n${audio.records.map(c => `| ${c.id} | ${c.text} | ${c.factIds.join('、') || '原创提示'} | [WAV](../../../public/content/v1/${c.file}) |`).join('\n')}\n\nMicrosoft Huihui Desktop / zh-CN，Rate -1，24kHz 单声道 16bit PCM；授权记录仍为本地试听。主动点听、切换和离页停止。创作点子不是生物规律或任务要求。\n`);
console.log(JSON.stringify({ renamedIntroClips: changed.filter(c => c.kind !== 'creative-prompt').length, creativePromptClips: changed.filter(c => c.kind === 'creative-prompt').length, total: audio.records.length }));
