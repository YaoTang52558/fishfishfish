import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--autoplay-policy=no-user-gesture-required']});
const errors=[],badResponses=[],results=[];
fs.mkdirSync('design/content/v1/qa',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)badResponses.push({url:r.url(),status:r.status()});});
  const previewUrl=process.env.FISH_CONTENT_PREVIEW_URL||'http://127.0.0.1:5175/content/v1/index.html';
  await page.goto(previewUrl);await page.locator('.fish-option').last().waitFor();
  const buttons=page.locator('.fish-option');assert.equal(await buttons.count(),30);
  for(let i=0;i<30;i++){await buttons.nth(i).click();await page.waitForFunction(()=>{const im=document.querySelector('#fish-image');return im.complete&&im.naturalWidth>0;});assert.equal(await page.locator('.point').count(),3);}
  await page.locator('[data-fish-filter="grouper"]').click();assert.equal(await page.locator('.fish-option:visible').count(),6);await page.locator('[data-fish-filter="shape"]').click();assert.equal(await page.locator('.fish-option:visible').count(),4);await page.locator('[data-fish-filter="all"]').click();assert.equal(await page.locator('.fish-option:visible').count(),30);
  await buttons.first().click();await page.locator('#intro').click();await page.waitForFunction(()=>!document.querySelector('#stop').disabled);await page.waitForTimeout(500);assert.equal(await page.locator('#spoken-text').innerText(),'这是一条小丑鱼，看看它的白带。');await page.locator('#stop').click();assert.ok(await page.locator('#stop').isDisabled());
  await page.locator('.point').first().click();assert.match(await page.locator('#spoken-text').innerText(),/白带/);await buttons.nth(1).click();assert.ok(await page.locator('#stop').isDisabled());
  await page.locator('[data-world="rock"]').click();assert.match(await page.locator('#world-image').getAttribute('src'),/rock-panorama/);await page.locator('[data-world="reef"]').click();
  await page.locator('#arrival').click();assert.ok(await page.locator('#viewer').isVisible());assert.match(await page.locator('#viewer-image').getAttribute('src'),/ocean-arrival/);await page.locator('#close-viewer').click();
  await buttons.first().click();await page.locator('details summary').click();assert.ok(await page.locator('#parent-content a').count()>0);await page.locator('details summary').click();
  for(const viewport of [{width:1440,height:1000},{width:1024,height:768},{width:768,height:1024}]){
    await page.setViewportSize(viewport);await page.evaluate(()=>scrollTo(0,0));
    await page.evaluate(()=>document.querySelectorAll('img').forEach(im=>im.loading='eager'));await page.locator('.guide').last().scrollIntoViewIfNeeded();await page.waitForFunction(()=>Array.from(document.images).every(im=>im.complete&&im.naturalWidth>0));await page.evaluate(()=>scrollTo(0,0));
    const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));assert.ok(width.scroll<=width.client,`horizontal overflow ${viewport.width}`);
    const screenshot=`design/content/v1/qa/preview-${viewport.width}x${viewport.height}.png`;await page.screenshot({path:screenshot,fullPage:true});results.push({viewport,screenshot,noHorizontalOverflow:true});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);
  fs.writeFileSync('docs/content/browser-verification-v1.json',JSON.stringify({date:'2026-10-06',browser:'Headless Edge desktop and tablet-size viewports; not physical iPad',checks:['30 selectable fish and image decoding','six grouper and four special-body filters','intro / point audio / stop / switching stops playback','two distinct scene images','arrival modal and close','parent source links','all visible image loads','no horizontal overflow at three sizes','no page errors or HTTP failures'],results,errors,badResponses},null,2)+'\n');console.log(JSON.stringify({views:results.length,errors,badResponses}));
}finally{await browser.close();}
