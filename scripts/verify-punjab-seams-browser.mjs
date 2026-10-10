import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {loadMapModel,loadLocalModule} from './load-map-model.mjs';
import {configureExport,triggerExport} from './workspace-ui.mjs';
const model=await loadMapModel(),scope=await loadLocalModule(new URL('../app/scope-model.ts',import.meta.url));
const baseline=process.env.MAP_SEAM_BASELINE==='1',output='outputs/border-seams/'+(baseline?'before':'after'),probe=[74.64067038262698,31.439573915693014];
await fs.mkdir(output,{recursive:true});
const seed=model.validate({...model.initial,...scope.scopePreset(model.initial,'combination',{scopeRegions:['in-punjab','pk-punjab']}),title:'Punjab · shared border',bg:'#ffffff',uncolored:'#d4dfd5',names:false,borders:false,legend:false,cities:false,rivers:false,fills:Object.fromEntries(model.areas.filter(a=>['in-punjab','pk-punjab'].includes(a.region)&&a.level!=='division').map(a=>[a.id,{color:a.region==='in-punjab'?'#df8354':'#4089ad',pattern:'solid'}])),regions:Object.fromEntries(Object.entries(model.initial.regions).map(([id,r])=>[id,{...r,show:['in-punjab','pk-punjab'].includes(id),district:true,tehsil:false,division:false}]))});
const browser=await chromium.launch({channel:process.env.MAP_BROWSER_CHANNEL||'chrome',headless:true,args:['--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});page.setDefaultTimeout(30000);
const errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('localhost')&&r.status()>=400)failed.push(r.status()+' '+r.url());});
await page.addInitScript(seed=>{if(!localStorage.getItem('punjab-studio-regional-v2'))localStorage.setItem('punjab-studio-regional-v2',JSON.stringify(seed));},seed);
const idle=()=>page.waitForFunction(()=>document.querySelector('.gl-host')?.getAttribute('aria-busy')==='false',null,{timeout:120000});
async function exportFile(format,label){await configureExport(page,{format,extent:'This view',width:1800});const event=page.waitForEvent('download',{timeout:120000});await triggerExport(page);const file=output+'/'+label+'.'+format;await(await event).saveAs(file);return file;}
async function pixel(buffer,x,y){return page.evaluate(async({image,x,y})=>{const img=new Image();img.src='data:image/png;base64,'+image;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return [...ctx.getImageData(Math.round(x),Math.round(y),1,1).data];},{image:buffer.toString('base64'),x,y});}
const merc=latitude=>Math.log(Math.tan(Math.PI/4+latitude*Math.PI/360));
function metadata(svg){return JSON.parse(svg.match(/<metadata>(.*?)<\/metadata>/s)[1].replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&'));}
async function checkView(label){
 const svg=await fs.readFile(await exportFile('svg',label),'utf8'),info=metadata(svg),bounds=info.scope.bounds;
 const box=await page.locator('.gl-host').boundingBox(),image=await page.locator('.gl-host').screenshot({path:output+'/'+label+'-map.png'});
 const live=await pixel(image,(probe[0]-bounds[0])/(bounds[2]-bounds[0])*box.width,(merc(bounds[3])-merc(probe[1]))/(merc(bounds[3])-merc(bounds[1]))*box.height);
 console.log(label+' gap pixel:',live);
 if(baseline)assert.ok(live.slice(0,3).every(n=>n>245),'Baseline reproduces the unassigned white gap');else{assert.ok(live[0]<235&&live[1]<235&&live[2]<235,'The previous gap inherits an area color');assert.ok(info.displayAlignment?.method.includes('cartographic seam'));}
 const png=await fs.readFile(await exportFile('png',label));
 const mapBottom=80+Number(svg.match(/<clipPath id="extent"><rect[^>]*height="([\d.]+)"/)[1]),scale=Math.min(910/(bounds[2]-bounds[0]),(mapBottom-90)/(merc(bounds[3])-merc(bounds[1]))*Math.PI/180);
 const exported=await pixel(png,(45+(probe[0]-bounds[0])*scale)*1.8,(90+(merc(bounds[3])-merc(probe[1]))*180/Math.PI*scale)*1.8);
 if(!baseline)assert.ok(exported.slice(0,3).some(n=>n<230),'PNG export also fills the previous gap');
 await page.screenshot({path:output+'/'+label+'-workspace.png'});return svg;
}
try{
 await page.goto(process.env.MAP_TEST_URL||'http://localhost:4545/',{waitUntil:'networkidle',timeout:60000});await idle();
 // Open a test-only saved map to focus the Lahore–Amritsar frontier precisely.
 await page.evaluate(seed=>new Promise((resolve,reject)=>{const request=indexedDB.open('opencarto-custom-maps',1);request.onupgradeneeded=()=>{const s=request.result.createObjectStore('maps',{keyPath:'id'});s.createIndex('nameKey','nameKey',{unique:true});};request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('maps','readwrite');tx.objectStore('maps').put({id:'border-fixture',name:'Punjab border check',nameKey:'punjab border check',doc:seed,viewBounds:[74.56,31.39,74.72,31.49],createdAt:1,updatedAt:1});tx.oncomplete=()=>{db.close();resolve()};tx.onabort=()=>reject(tx.error);};}),seed);
 await page.getByRole('button',{name:'My maps',exact:true}).click();await page.getByRole('button',{name:'Open Punjab border check',exact:true}).click();await idle();
 const districtSvg=await checkView('districts');
 if(!baseline){
  const bounds=metadata(districtSvg).scope.bounds,box=await page.locator('.gl-host').boundingBox();
  await page.getByLabel('Quick paint color',{exact:true}).fill('#d54c70');
  await page.mouse.click(box.x+(probe[0]-bounds[0])/(bounds[2]-bounds[0])*box.width,box.y+(merc(bounds[3])-merc(probe[1]))/(merc(bounds[3])-merc(bounds[1]))*box.height);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('punjab-studio-regional-v2')).fills.PK617?.color==='#d54c70');
  await idle();await checkView('gap-painted');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await idle();
  await page.getByLabel('Show administrative detail').selectOption('tehsil');await idle();await checkView('tehsils');
  await page.getByLabel('Show administrative detail').selectOption('district');await idle();await page.getByLabel('Find an area',{exact:true}).fill('Lahore');const card=page.locator('.area-search-card[data-area="PK617"]');await card.getByRole('button',{name:'Hide Lahore',exact:true}).click();await idle();const hidden=await fs.readFile(await exportFile('svg','lahore-hidden'),'utf8');assert.ok(!hidden.includes('data-area="PK617"'));assert.ok(hidden.includes('data-area="in-d-27"')||hidden.includes('data-area="in-d-'));await card.getByRole('button',{name:'Unhide Lahore',exact:true}).click();await idle();await checkView('lahore-restored');
  await page.setViewportSize({width:390,height:844});await idle();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:output+'/mobile.png'});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);console.log(baseline?'Reproduced the source gap in the live map.':'Verified aligned district/tehsil borders, colored gap pixels, clicking the repaired gap paints Lahore, SVG/PNG exports, Hide/Unhide and mobile layout.');
}catch(error){console.error('Page errors:',errors,'HTTP errors:',failed);await page.screenshot({path:output+'/failure.png'}).catch(()=>{});throw error;}finally{await browser.close();}
