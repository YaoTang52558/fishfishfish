import fs from 'node:fs';
import path from 'node:path';
function markdown(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? markdown(path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : []); }
const files = ['README.md', ...markdown('docs')], broken = []; let checked = 0;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\[[^\]\n]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)/g)) {
    let target = match[1] ?? match[2]; if (/^(?:https?:|mailto:|app:|codex:|#)/.test(target)) continue;
    target = decodeURIComponent(target.split('#')[0]); if (!target) continue;
    checked++; if (!fs.existsSync(path.resolve(path.dirname(file), target))) broken.push({ file, target });
  }
}
console.log(JSON.stringify({ files: files.length, checked, broken }, null, 2)); if (broken.length) process.exitCode = 1;
