import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
const page=await browser.newPage({viewport:{width:1024,height:768},reducedMotion:'reduce'});
await page.goto('http://127.0.0.1:5175/content/v1/index.html#fish');
await page.locator('[data-fish-filter="grouper"]').click();
await page.locator('[data-id="cephalopholis-argus"]').click();
await page.locator('#fish-image').evaluate(im=>im.decode());
await page.locator('.fish-section').screenshot({path:'design/content/v1/qa/grouper-preview.png'});
await page.locator('[data-fish-filter="shape"]').click();
for(const id of ['hippocampus-kuda','mobula-birostris','trichiurus-lepturus']){
 await page.locator('[data-id="'+id+'"]').click();
 await page.locator('#fish-image').evaluate(im=>im.decode());
 await page.locator('.fish-card').screenshot({path:'design/content/v1/qa/'+id+'-card.png'});
}
await page.goto('http://127.0.0.1:5175/content/v1/guides/grouper-families.svg');
await page.locator('svg').screenshot({path:'design/content/v1/qa/grouper-families.png'});
console.log('Saved grouper comparison and special-body preview captures.');
}finally{await browser.close();}
