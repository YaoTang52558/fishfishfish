import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = process.cwd();
const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); } catch {
  sharp = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'));
}
const manifestPath = 'design/content/v1/generation.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const jobs = JSON.parse(fs.readFileSync(process.argv[2] ?? 'design/content/v1/remaining-generation-jobs.json', 'utf8'));
for (const job of jobs) {
  const source = `design/content/v1/${job.kind}/${job.id}.png`;
  const output = `public/content/v1/${job.kind}/${job.id}.webp`;
  const previous = manifest.records.find(item => item.id === job.id);
  if (previous?.prompt === job.prompt && previous?.generationFile === path.basename(job.src) && fs.existsSync(source) && fs.existsSync(output)) continue;
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  if (fs.existsSync(job.src)) fs.copyFileSync(job.src, source);
  else if (!fs.existsSync(source)) throw new Error(`Missing original PNG for ${job.id}`);
  const meta = await sharp(source).metadata();
  await sharp(source).resize({ width: job.kind === 'environments' ? 1920 : 1200, withoutEnlargement: true }).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(output);
  const web = await sharp(output).metadata();
  const record = { id: job.id, source, path: output, engine: 'built-in imagegen', generatedAt: '2026-10-06', prompt: job.prompt, generationFile: path.basename(job.src), width: meta.width, height: meta.height, hasAlpha: meta.hasAlpha, webWidth: web.width, webHeight: web.height, webBytes: fs.statSync(output).size };
  if (job.id.startsWith('ocean-')) record.inputSources = ['design/content/v1/illustrations/fantasy-bubble-star.png', 'design/content/v1/environments/reef-panorama.png'];
  const index = manifest.records.findIndex(item => item.id === job.id);
  if (index === -1) manifest.records.push(record); else manifest.records[index] = record;
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ images: manifest.records.length, webBytes: manifest.records.reduce((n, r) => n + r.webBytes, 0) }));
