import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.UMMAH_PLAYWRIGHT_MODULE || '../../verification-tools/node_modules/playwright');
const origin = process.env.UMMAH_AUDIT_ORIGIN || 'http://127.0.0.1:3307';
assert.ok(['127.0.0.1','localhost'].includes(new URL(origin).hostname),'This audit is a disconnected local UI check, not hosted acceptance.');
const out = process.env.UMMAH_AUDIT_OUTPUT ? pathToFileURL(resolve(process.env.UMMAH_AUDIT_OUTPUT)+'/') : new URL('../docs/ummahconnect/evidence/2026-10-15/',import.meta.url);
await fs.mkdir(out,{recursive:true});
const browser = await chromium.launch({executablePath:process.env.UMMAH_CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:process.env.UMMAH_AUDIT_NO_SANDBOX==='local-test-only'?['--no-sandbox']:[]});
const results = {browser:await browser.version(),method:'Desktop Chromium with viewport emulation; NOT real iPhone Safari',mockedAPIs:false,hostedAcceptance:false,routes:[],screenshots:[],api:{}};
try {
  const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page = await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(let i=1;i<=33;i++){
    await page.goto(origin+'/#/screen-'+i);await page.waitForSelector('h1');await page.waitForTimeout(120);
    const heading=await page.locator('h1').first().innerText();assert.ok(heading.trim());
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
    results.routes.push({screen:i,heading,overflow});
    if([2,4,5,6,33].includes(i)){
      const name='screen-'+i+'-chrome-mobile.png';await page.screenshot({path:new URL(name,out).pathname,fullPage:true});results.screenshots.push(name);
    }
  }
  assert.deepEqual(errors,[]);results.pageErrors=errors;
  const health=await fetch(origin+'/api/health');assert.equal(health.status,200);
  for(const [path,method] of [['config','GET'],['spaces','GET'],['submissions','POST'],['reviews','GET']]){
    const response=await fetch(origin+'/api/social/'+path,{method});results.api[path]={status:response.status,body:await response.json()};
  }
  assert.equal(results.api.spaces.status,401);assert.equal(results.api.submissions.status,405);
  assert.equal(results.api.config.body.reviewEnabled,false);
  assert.equal(results.routes.filter(x=>x.overflow).length,0,'Unexpected horizontal overflow');
  await context.close();
  const desktop=await browser.newPage({viewport:{width:1440,height:1000}});await desktop.goto(origin+'/#/screen-4');await desktop.waitForSelector('h1');
  await desktop.screenshot({path:new URL('home-chrome-desktop.png',out).pathname,fullPage:true});results.screenshots.push('home-chrome-desktop.png');
  console.log(JSON.stringify(results,null,2));
} finally {
  await fs.writeFile(new URL('browser-audit.json',out),JSON.stringify(results,null,2)+'\n');await browser.close();
}
