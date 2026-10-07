import fs from 'node:fs';
import path from 'node:path';
const files=['docs/content/README.md','docs/content/research/next-batch-v2.md',...JSON.parse(fs.readFileSync('public/content/v1/data.json','utf8')).fish.map(f=>'docs/content/species/'+f.id+'.md')];
const broken=[];let links=0;
for(const file of files)for(const match of fs.readFileSync(file,'utf8').matchAll(/\]\(([^)]+)\)/g)){
const target=match[1];if(/^(https?:|#)/.test(target))continue;links++;
const resolved=path.resolve(path.dirname(file),target.split('#')[0]);if(!fs.existsSync(resolved))broken.push({file,target});
}
if(broken.length)throw new Error(JSON.stringify(broken));
console.log(JSON.stringify({documents:files.length,localLinks:links,broken:0}));
