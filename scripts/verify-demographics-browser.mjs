import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {loadMapModel,loadLocalModule} from './load-map-model.mjs';
import {configureExport,triggerExport} from './workspace-ui.mjs';
const model=await loadMapModel(),scope=await loadLocalModule(new URL('../app/scope-model.ts',import.meta.url));
const seed={...model.initial,...scope.scopePreset(model.initial,'single',{scopeRegion:'in-punjab'})};
const district=model.areas.find(a=>a.name==='Amritsar'&&a.level==='district');
const tehsil=model.areas.find(a=>a.parent===district.id&&a.level==='tehsil');
const browser=await chromium.launch({channel:process.env.MAP_BROWSER_CHANNEL||'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
const errors=[],failures=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().includes('localhost'))failures.push(r.status()+' '+r.url());});
const key='punjab-studio-regional-v2';
const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const idle=async()=>{await page.waitForFunction(()=>document.querySelector('.gl-host')?.getAttribute('aria-busy')==='false',null,{timeout:120000});};
await page.addInitScript(({key,seed})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));},{key,seed});
await fs.mkdir('outputs/demographics',{recursive:true});
try{
 await page.goto(process.env.MAP_TEST_URL||'http://localhost:4545/',{waitUntil:'networkidle',timeout:60000});await idle();
 await page.getByRole('button',{name:'Search and add areas',exact:true}).click();
 await page.getByLabel('Find an area',{exact:true}).fill('Amritsar');
 const row=page.locator('.area-search-card[data-area="'+district.id+'"]');await row.waitFor();
 await row.getByRole('button',{name:'Show only Amritsar',exact:true}).click();await idle();
 assert.deepEqual((await saved()).scopeAreas,[district.id]);
 await row.getByRole('button',{name:'Hide Amritsar',exact:true}).click();await idle();assert.ok((await saved()).hidden.includes(district.id));
 await page.getByLabel('Hidden areas only').check();assert.ok(await row.getByRole('button',{name:'Unhide Amritsar',exact:true}).isVisible());
 await page.getByLabel('Find an area',{exact:true}).fill(tehsil.name);
 const child=page.locator('.area-search-card[data-area="'+tehsil.id+'"]');await child.waitFor();
 await child.getByRole('button',{name:'Unhide '+tehsil.name,exact:true}).click();await idle();assert.deepEqual((await saved()).hidden,[]);
 await page.getByLabel('Hidden areas only').uncheck();await page.getByLabel('Find an area',{exact:true}).fill('Nepal');
 await page.locator('.area-search-card[data-area="np-nepal"]').getByRole('button',{name:'Add Nepal to map',exact:true}).click();await idle();
 assert.deepEqual((await saved()).scopeAreas,[district.id,'np-nepal']);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await idle();assert.deepEqual((await saved()).scopeAreas,[district.id]);
 await page.getByRole('button',{name:'Redo',exact:true}).click();await idle();assert.deepEqual((await saved()).scopeAreas,[district.id,'np-nepal']);
 await page.getByRole('tab',{name:'People',exact:true}).click();await page.getByLabel('Demographic map layer').selectOption('language');
 assert.ok(await page.getByText(/No matching largest mother-tongue group records/).isVisible());
 await page.getByLabel('Census profile',{exact:true}).selectOption('in-punjab');await page.getByRole('button',{name:'Show this census region',exact:true}).click();await idle();
 assert.equal((await saved()).scopeRegion,'in-punjab');assert.ok(await page.locator('.demographic-map-legend').getByText('Punjabi',{exact:true}).isVisible());
 await page.screenshot({path:'outputs/demographics/language.png'});
 for(const mode of ['religion','population','literacy','urban']){await page.getByLabel('Demographic map layer').selectOption(mode);await idle();assert.equal((await saved()).demographicMode,mode);}
 await page.getByLabel('Demographic map layer').selectOption('religion');await idle();
 assert.ok(await page.locator('.demographic-map-legend').getByText('Sikh',{exact:true}).isVisible());
 await page.getByLabel('Shrine community').selectOption('Hindu');await page.getByLabel('Show community shrines').check();await idle();
 const shrineCards=page.locator('.community-shrine-list article');assert.ok(await shrineCards.count()>0);
 const first=shrineCards.first();await first.scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>{const image=document.querySelector('.community-shrine-list article img');return image?.complete&&image.naturalWidth>0;},null,{timeout:30000});
 await first.getByRole('button',{name:'Show on map',exact:true}).click();await idle();
 const shrineState=await saved();assert.ok(shrineState.communityShrines);assert.equal(shrineState.shrineCommunity,'Hindu');
 await page.screenshot({path:'outputs/demographics/community-shrine.png'});
 await configureExport(page,{format:'svg',extent:'Full map',width:1600});const svgDownload=page.waitForEvent('download',{timeout:120000}).catch(()=>null);await triggerExport(page);const downloaded=await svgDownload;assert.ok(downloaded,'SVG export completes: '+await page.locator('.statusbar output').innerText());await downloaded.saveAs('outputs/demographics/community.svg');
 const svg=await fs.readFile('outputs/demographics/community.svg','utf8');assert.ok(svg.includes('data-community-shrine'));assert.ok(svg.includes('data:image/jpeg;base64,')||svg.includes('data:image/png;base64,'));assert.ok(svg.includes('demographic-key'));assert.ok(svg.includes('Census 2011'));assert.ok(svg.includes('data-demographic='));
 for(const format of ['png','jpg']){await configureExport(page,{format,width:1000});const download=page.waitForEvent('download',{timeout:120000}).catch(()=>null);await triggerExport(page);const file=await download;assert.ok(file,format+' export succeeds');await file.saveAs('outputs/demographics/community.'+format);const bytes=await fs.readFile('outputs/demographics/community.'+format);assert.ok(bytes.length>10000,format+' contains rendered map and photographs');}
 const saveDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Save',exact:true}).click();await (await saveDownload).saveAs('outputs/demographics/settings.json');
 const exported=JSON.parse(await fs.readFile('outputs/demographics/settings.json','utf8'));assert.equal(exported.demographicMode,'religion');
 await page.reload({waitUntil:'networkidle'});await idle();assert.deepEqual(await saved(),exported,'autosave reload retains all demographic and shrine settings');
 await page.getByRole('tab',{name:'People',exact:true}).click();await page.getByLabel('Demographic map layer').selectOption('none');
 await page.locator('input[type=file]').setInputFiles('outputs/demographics/settings.json');await idle();assert.equal((await saved()).demographicMode,'religion','manual Save/Load restores demographics');
 for(const community of ['Sikh','Hindu','Muslim','Buddhist','Jain','Christian']){await page.getByLabel('Shrine community').selectOption(community);assert.ok(await page.locator('.community-shrine-list article').count()>0);}
 for(const width of [390,700,768]){await page.setViewportSize({width,height:844});await page.getByRole('tab',{name:'People',exact:true}).click();assert.ok(await page.getByLabel('Demographic map layer').isVisible());assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no overflow at '+width);await page.screenshot({path:'outputs/demographics/mobile-'+width+'.png'});}
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
 console.log('Verified global add/isolate, inherited hide/unhide, mixed-country selections, undo/redo, five choropleths, shrine photos, SVG embeds/credits, autosave, Save/Load, and mobile navigation.');
}catch(error){console.error('Browser verification failed:',error.message);console.error('Status:',await page.locator('.statusbar output').innerText().catch(()=>''));console.error('Page errors:',errors);await page.screenshot({path:'outputs/demographics/failure.png'}).catch(()=>{});throw error;}finally{await browser.close();}
