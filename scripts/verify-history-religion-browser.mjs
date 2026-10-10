import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {loadMapModel,loadLocalModule} from './load-map-model.mjs';
import {configureExport,triggerExport} from './workspace-ui.mjs';
const model=await loadMapModel(),scope=await loadLocalModule(new URL('../app/scope-model.ts',import.meta.url)),history=await loadLocalModule(new URL('../app/empire-model.ts',import.meta.url)),people=await loadLocalModule(new URL('../app/demographic-model.ts',import.meta.url));
const district=model.areas.find(a=>a.level==='district'&&a.name==='Amritsar'&&a.region==='in-punjab');
const tehsil=model.areas.find(a=>a.level==='tehsil'&&a.parent===district.id&&people.demographicById.has(a.id));
const pakistanDistrict=model.areas.find(a=>a.region==='pk-punjab'&&a.level==='district'&&people.demographicById.has(a.id));
const pakistanTehsil=model.areas.find(a=>a.level==='tehsil'&&a.parent===pakistanDistrict.id&&people.demographicById.has(a.id));
const seed={...model.initial,...scope.scopePreset(model.initial,'single',{scopeRegion:'in-punjab'}),fills:{[district.id]:{color:'#df635b',pattern:'dots'}}};
const browser=await chromium.launch({channel:process.env.MAP_BROWSER_CHANNEL||'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true}),errors=[],failures=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('localhost')&&r.status()>=400)failures.push(r.status()+' '+r.url());});
const key='punjab-studio-regional-v2';await page.addInitScript(({key,seed})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));},{key,seed});
const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const idle=()=>page.waitForFunction(()=>document.querySelector('.gl-host')?.getAttribute('aria-busy')==='false',null,{timeout:120000});
await fs.mkdir('outputs/history-religion',{recursive:true});
async function chooseArea(area){await page.getByRole('button',{name:'Search and add areas',exact:true}).click();await page.getByLabel('Find an area').fill(area.name);await page.locator('.area-search-card[data-area="'+area.id+'"]').getByRole('button',{name:'Show only '+area.name,exact:true}).click();await idle();}
async function exported(format,path){await configureExport(page,{format,width:1600});const event=page.waitForEvent('download',{timeout:120000});await triggerExport(page);await (await event).saveAs(path);return fs.readFile(path);}
try{
 await page.goto(process.env.MAP_TEST_URL||'http://localhost:4545/',{waitUntil:'networkidle',timeout:60000});await idle();
 await page.getByRole('tab',{name:'History',exact:true}).click();
 for(const empire of history.empires){await page.getByLabel('Historical empire').selectOption(empire.id);await idle();const doc=await saved();assert.equal(doc.empireId,empire.id);assert.equal(doc.mapScope,'full');assert.ok(doc.fullDetail);assert.deepEqual(doc.fills,seed.fills);assert.ok(await page.getByLabel('Empire legend').getByText(empire.name,{exact:true}).isVisible());}
 await page.getByLabel('Empire administrative detail').selectOption('tehsil');await idle();assert.equal((await saved()).empireDetail,'tehsil');
 await page.getByLabel('Empire color',{exact:true}).fill('#7f50bc');await idle();assert.equal((await saved()).empireColor,'#7f50bc');
 await page.screenshot({path:'outputs/history-religion/sikh-empire.png'});
 await chooseArea(district);
 const historicSvg=(await exported('svg','outputs/history-religion/empire.svg')).toString();
 assert.ok(historicSvg.includes('id="empire-key"'));assert.ok(historicSvg.includes('sikh-1839'));assert.ok(historicSvg.includes('fill="#7f50bc"'));assert.ok(historicSvg.includes('approximate'));
 await page.getByRole('tab',{name:'History',exact:true}).click();await page.getByLabel('Historical empire').selectOption('none');await idle();assert.deepEqual((await saved()).fills,seed.fills);
 await page.getByRole('button',{name:'Open religion demographics',exact:true}).click();await idle();assert.equal((await saved()).demographicLevel,'district');
 assert.ok(await page.getByLabel('Demographic legend').getByText('Sikh',{exact:true}).isVisible());
 await page.getByRole('button',{name:'Inspect area',exact:true}).click();
 const box=await page.locator('.maplibregl-canvas').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
 const inspector=page.getByRole('complementary',{name:'Inspected area',exact:true});await inspector.waitFor();assert.equal(await inspector.locator('.religion-share-table>div').count(),8);
 const actual=people.demographicById.get(district.id).religions.find(v=>v.name==='Sikh').share.toFixed(2)+'%';assert.ok((await inspector.innerText()).includes(actual));
 await page.getByLabel('Map color for Sikh',{exact:true}).fill('#a930ab');await idle();assert.equal((await saved()).religionPalette.Sikh,'#a930ab');
 await page.getByRole('button',{name:'Close inspected area',exact:true}).click();
 await page.getByLabel('Demographic map layer').selectOption('religion-share');await page.getByLabel('Religion population share community').selectOption('Muslim');await idle();
 assert.equal(await page.getByLabel('Demographic legend').locator('i').count(),6);assert.ok(await page.getByLabel('Demographic legend').getByText('75% or more',{exact:true}).isVisible());
 const religionSvg=(await exported('svg','outputs/history-religion/religion.svg')).toString();assert.ok(religionSvg.includes('data-demographic="'+district.id+'"'));assert.ok(religionSvg.includes('Muslim population share'));assert.ok(religionSvg.includes('census-2011-c01-03'));
 await page.screenshot({path:'outputs/history-religion/district-religion.png'});
 await chooseArea(tehsil);await page.getByRole('tab',{name:'People',exact:true}).click();await page.getByLabel('Religion administrative level').selectOption('tehsil');await idle();
 assert.ok(await page.getByText(/1 matching tehsils of 1/).isVisible());assert.equal((await saved()).demographicLevel,'tehsil');
 await page.screenshot({path:'outputs/history-religion/tehsil-religion.png'});
 const tehsilSvg=(await exported('svg','outputs/history-religion/tehsil.svg')).toString();assert.ok(tehsilSvg.includes('data-demographic="'+tehsil.id+'"'));
 const png=await exported('png','outputs/history-religion/tehsil.png');assert.equal(png.subarray(1,4).toString(),'PNG');assert.ok(png.length>10000);
 const before=await saved();await page.reload({waitUntil:'networkidle'});await idle();assert.deepEqual(await saved(),before,'all history/religion settings survive reload');
 await page.getByRole('tab',{name:'People',exact:true}).click();await page.getByLabel('Religion population share community').selectOption('Sikh');await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal((await saved()).demographicReligion,'Muslim');await page.getByRole('button',{name:'Redo',exact:true}).click();assert.equal((await saved()).demographicReligion,'Sikh');
 const missing=model.areas.find(a=>a.level==='district'&&a.region==='in-punjab'&&!people.demographicById.has(a.id));await chooseArea(missing);await page.getByRole('tab',{name:'People',exact:true}).click();await page.getByLabel('Religion administrative level').selectOption('district');await idle();assert.ok(await page.getByText(/No matching religion population share records/).isVisible());
 await chooseArea(pakistanDistrict);await page.getByRole('tab',{name:'People',exact:true}).click();await page.getByLabel('Demographic map layer').selectOption('religion');await idle();
 assert.ok(await page.getByLabel('Demographic legend').getByText('Census 2023 · Districts',{exact:true}).isVisible());
 await page.getByLabel('Census profile',{exact:true}).selectOption(pakistanDistrict.id);
 const profile=page.locator('.census-profile');assert.equal(await profile.locator('.religion-share-table>div').count(),8);
 assert.ok((await profile.innerText()).includes('Qadiani / Ahmadi'));assert.ok((await profile.innerText()).includes('Hindu Jati'));
 assert.equal(await profile.getByRole('link').first().getAttribute('href'),'https://www.pbs.gov.pk/result-excel/');
 const pakistanSvg=(await exported('svg','outputs/history-religion/pakistan-religion.svg')).toString();assert.ok(pakistanSvg.includes('Census 2023'));assert.ok(pakistanSvg.includes('pbs-2023-table9-punjab'));
 await page.screenshot({path:'outputs/history-religion/pakistan-district-religion.png'});
 await page.getByLabel('Demographic map layer').selectOption('religion-share');await page.getByLabel('Religion population share community').selectOption('Qadiani / Ahmadi');await idle();assert.ok(await page.getByLabel('Map color for Qadiani / Ahmadi',{exact:true}).isVisible());
 await page.getByLabel('Religion population share community').selectOption('Hindu');await idle();assert.ok(await page.getByText(/No matching religion population share records/).isVisible());
 await chooseArea(pakistanTehsil);await page.getByRole('tab',{name:'People',exact:true}).click();await page.getByLabel('Religion administrative level').selectOption('tehsil');await page.getByLabel('Religion population share community').selectOption('Christian');await idle();assert.ok(await page.getByText(/1 matching tehsils of 1/).isVisible());
 assert.ok(await page.getByLabel('Demographic legend').getByText('Census 2023 · Tehsils / subdivisions',{exact:true}).isVisible());
 for(const width of [390,700,768]){await page.setViewportSize({width,height:844});await page.getByRole('tab',{name:'History',exact:true}).click();assert.ok(await page.getByLabel('Historical empire').isVisible());assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow at '+width);await page.screenshot({path:'outputs/history-religion/mobile-'+width+'.png'});}
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
 console.log('Verified all empire presets, full map/subdivision detail, retained paints, editable floating religion colors, India 2011 and Pakistan Punjab 2023 district/tehsil statistics, source categories, missing records, SVG/PNG exports, reload, undo/redo, and mobile navigation.');
}catch(e){console.error('Page errors:',errors);console.error('HTTP errors:',failures);console.error('Status:',await page.locator('.statusbar output').innerText().catch(()=>''));await page.screenshot({path:'outputs/history-religion/failure.png'}).catch(()=>{});throw e;}finally{await browser.close();}
