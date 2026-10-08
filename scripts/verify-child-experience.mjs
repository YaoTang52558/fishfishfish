import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
let playwright; try { playwright = require('playwright'); } catch { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const browser = await playwright.chromium.launch({ headless:true, executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const origin=process.env.FISH_PREVIEW_ORIGIN || 'http://127.0.0.1:5175';
const errors=[], badResponses=[], checks=[], layouts=[];
mkdirSync('.verification/child-experience',{recursive:true}); mkdirSync('docs/evidence',{recursive:true});
try {
  for(const viewport of [{width:1024,height:768},{width:768,height:1024},{width:390,height:844}]) {
    const context=await browser.newContext({viewport,hasTouch:true,reducedMotion:'reduce',acceptDownloads:true});
    await context.addInitScript(()=>{const Original=window.Audio;window.__reviewVoices=[];window.Audio=class extends Original{constructor(...args){super(...args);window.__reviewVoices.push(this);}};});
    const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)badResponses.push({url:r.url(),status:r.status()});});
    const shot=async name=>page.screenshot({path:`.verification/child-experience/${name}-${viewport.width}.png`});
    const design=()=>page.evaluate(()=>JSON.parse(JSON.stringify(window.__fishEditor.design.value)));
    const profile=()=>page.evaluate(async()=>{const{openDatabase}=await import('/src/storage/db.ts');const{loadProfile}=await import('/src/storage/repository.ts');const db=await openDatabase();try{return await loadProfile(db);}finally{db.close();}});
    await page.goto(origin+'/');const start=page.getByRole('link',{name:'🖌️ 造一条鱼'});await start.waitFor();const startBox=await start.boundingBox();assert(startBox.y+startBox.height<=viewport.height,'Primary creation must fit first screen');await shot('home-empty');await start.click();
    await page.getByRole('button',{name:'试游',exact:true}).waitFor();
    await page.waitForFunction(()=>document.querySelector('.studio-layout')?.inert===false);
    assert.equal(await page.locator('.studio-quicktools button').first().getAttribute('aria-pressed'),'true');
    const canvas=page.locator('.studio-stage>.fish-canvas-stage canvas');await canvas.scrollIntoViewIfNeeded();let box=await canvas.boundingBox();
    await page.mouse.move(box.x+box.width*.49,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.55,box.y+box.height*.53,{steps:8});await page.mouse.up();
    await page.waitForFunction(()=>window.__fishEditor.canUndo.value);
    await page.waitForFunction(()=>!!window.__fishEditor.design.value.paint.colorAssetId);
    const painted=await design();assert((await profile()).draft.design.paint.colorAssetId);await page.getByRole('button',{name:'捏一捏',exact:true}).click();
    assert.equal(await page.locator('.sculpt-handles button').count(),6);const handle=page.locator('.sculpt-handles button').nth(1);await handle.scrollIntoViewIfNeeded();box=await handle.boundingBox();
    if(viewport.width===390){
      const cdp=await context.newCDPSession(page), x=box.x+box.width/2, y=box.y+box.height/2;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:Math.max(1,y-200)}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
    }else{await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2-200,{steps:8});await page.mouse.up();}
    const sculpted=await design();assert.equal(sculpted.sculpt.top[1],-.14);assert.deepEqual(sculpted.paint,painted.paint);
    await page.getByRole('button',{name:'撤销',exact:true}).click();assert.deepEqual(await design(),painted);await page.getByRole('button',{name:'重做',exact:true}).click();assert.deepEqual(await design(),sculpted);await shot('direct-sculpt');
    await page.getByRole('button',{name:'听听这一步怎么玩',exact:true}).click();await page.getByRole('button',{name:'停止讲解',exact:true}).waitFor();
    await page.waitForFunction(()=>window.__reviewVoices.some(a=>!a.paused&&a.currentTime>0));await shot('help');await page.getByRole('button',{name:'收起帮助',exact:true}).click();
    assert(await page.evaluate(()=>window.__reviewVoices.every(a=>a.paused)));
    await page.getByRole('button',{name:'换尾巴',exact:true}).click();await page.getByRole('button',{name:'看看海洋朋友的秘密',exact:true}).click();await page.getByRole('heading',{name:'尾巴都一样吗？'}).waitFor();await page.getByRole('button',{name:'回去继续创作',exact:true}).click();
    await page.getByRole('button',{name:'第一步：创作',exact:true}).click();await page.getByRole('button',{name:'画一画',exact:true}).click();await shot('workshop');
    await page.locator('.stage-toolbar details>summary').click();await page.getByRole('button',{name:'随机造型',exact:true}).click();
    assert.equal(await page.locator('.studio-quicktools').evaluate(el=>el.inert),true);assert.equal(await page.locator('.studio-quickpalette').evaluate(el=>el.inert),true);
    await page.locator('.preview-bar').getByRole('button',{name:'取消',exact:true}).click();assert.deepEqual(await design(),sculpted);
    await page.getByRole('link',{name:'我的海洋，返回首页',exact:true}).click();await page.waitForURL(origin+'/');await page.getByRole('link',{name:/继续创作：/}).waitFor();await page.getByRole('link',{name:'🖌️ 继续画这条鱼'}).waitFor();await shot('home-draft');await page.getByRole('link',{name:/继续创作：/}).click();await page.getByRole('button',{name:'第三步：入海',exact:true}).click();
    await page.getByRole('button',{name:'放进我的海洋',exact:true}).click();await page.waitForURL('**/ocean*');await page.locator('.ocean-list--art').waitFor();let saved=await profile();assert.equal(saved.fish.length,1);assert.deepEqual(saved.fish[0].design.sculpt,sculpted.sculpt);assert(saved.fish[0].design.paint.colorAssetId);
    await page.locator('.ocean-parent-tools').waitFor();assert.equal(await page.locator('.ocean-parent-tools').first().getAttribute('open'),null);await shot('ocean');
    await page.goto(origin+'/journal');await page.locator('.observation-detail').waitFor();assert.equal(await page.locator('.library-search').getAttribute('open'),null);const reading=await page.locator('.library-reading').boundingBox(), list=await page.locator('.library-list').boundingBox();assert(reading.y<=list.y,'Observation before list');await shot('journal');
    await page.locator('.library-search>summary').click();await page.getByRole('combobox',{name:'外形',exact:true}).selectOption('seahorse');assert.equal(await page.locator('.library-list>button').count(),1);await page.locator('.library-list>button').click();await page.getByRole('heading',{name:/海马/}).waitFor();
    await page.goto(origin+'/');await page.getByRole('link',{name:/继续创作：/}).waitFor();assert((await page.getByRole('link',{name:/继续创作：/}).getAttribute('href')).includes('fishId='));
    await page.goto(origin+'/dev/fishing-3d');await page.getByRole('button',{name:'🤝 帮我一下',exact:true}).waitFor();await page.getByRole('button',{name:'🤝 帮我一下',exact:true}).click();await page.waitForFunction(()=>window.__fishRound?.read().assist===true);await page.waitForFunction(()=>window.__fishRound?.read().challenge==='gentle');await shot('fishing-help-choice');
    saved=await profile();assert(saved.settings.assistMode);assert.equal(saved.settings.challenge,'gentle');assert.equal(saved.fish.length,1);
    await page.goto(origin+'/settings');assert.equal(await page.locator('.danger-zone').getAttribute('open'),null);await shot('parent');
    layouts.push({viewport,horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
    assert.equal(layouts.at(-1).horizontalOverflow,false);await context.close();
  }
  checks.push('creation CTA above fold at 1024/768/390','default drawing creates saved paint','direct six-point sculpt; extreme drag clamped; single undo/redo preserves paint; CDP touch at 390','random preview disables quick tools/palette and cancellation preserves design','one-click narration starts and closes cleanly','current part selects knowledge topic','draft/last saved work continuation with accurate primary CTA','default-name save, sculpt and paint survive','big observation before folded filters; filtered fish selectable','explicit gentle assistance persists without changing artwork','parent measurement and destructive tools initially collapsed');
  assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);
  const report={date:new Date().toISOString(),result:'passed',physicalDeviceVerified:false,scope:'isolated Edge child interaction samples; no child or Safari acceptance claim',checks,layouts,errors,badResponses};
  writeFileSync('docs/evidence/child-experience-browser.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
