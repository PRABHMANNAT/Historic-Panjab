import {configureExport,triggerExport,openLayerGroup} from './workspace-ui.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';

const read=async file=>JSON.parse(await fs.readFile(new URL('../'+file,import.meta.url),'utf8'));
const catalog=await read('app/catalog.json'),divisions=await read('app/pakistan-division-areas.json'),sources=await read('app/pakistan-division-sources.json');
const byId=new Map([...catalog,...divisions].map(a=>[a.id,a]));
const seed={fills:{},regions:Object.fromEntries(catalog.filter(a=>a.level==='region').map(a=>[a.region,{show:false,province:false,district:false,tehsil:false,uc:false,division:false}]))};
const browser=await chromium.launch({channel:process.env.MAP_BROWSER_CHANNEL||'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1600,height:1100},acceptDownloads:true});
await context.addInitScript(seed=>{if(!localStorage.getItem('punjab-studio-regional-v2'))localStorage.setItem('punjab-studio-regional-v2',JSON.stringify(seed));},seed);
const page=await context.newPage(),errors=[],failures=[],loaded=new Set();
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)failures.push(r.status()+' '+r.url());if(r.ok()&&r.url().includes('/data/'))loaded.add(new URL(r.url()).pathname);});
const output='outputs/pakistan-divisions';await fs.mkdir(output,{recursive:true});
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('punjab-studio-regional-v2')));
const idle=async()=>{await page.waitForLoadState('networkidle');await page.waitForFunction(()=>document.querySelector('.gl-host')?.getAttribute('aria-busy')==='false',null,{timeout:120000});};
const level=kind=>page.locator('.area-levels').getByRole('button',{name:kind==='province'?'Provinces / regional units':kind==='district'?'Districts':kind==='tehsil'?'Tehsils':'Divisions',exact:true}).click();
const exportSvg=async name=>{await configureExport(page,{format:'SVG'});await configureExport(page,{extent:'Full map'});const download=page.waitForEvent('download',{timeout:120000});await triggerExport(page);const path=output+'/'+name+'.svg';await(await download).saveAs(path);return fs.readFile(path,'utf8');};
try{
 await page.goto(process.env.MAP_TEST_URL||'http://localhost:4545/',{waitUntil:'networkidle',timeout:60000});await page.waitForFunction(()=>!document.querySelector('button.primary')?.disabled,null,{timeout:60000});
 await openLayerGroup(page,'Countries & territories');await page.getByLabel('Country map view',{exact:true}).selectOption('pk-country');await page.getByRole('checkbox',{name:'Country tehsil layer',exact:true}).check();
 await openLayerGroup(page,'Regions & boundaries');const card=page.locator('.region-card').filter({has:page.locator('label[for="reg-pk-country"]')});await card.getByRole('button',{name:'Divisions',exact:true}).click();await idle();
 assert.equal((await saved()).regions['pk-country'].division,true);
 for(const kind of ['province','district','tehsil','division'])for(const suffix of ['','-labels'])assert.ok(loaded.has('/data/pk-country-'+kind+suffix+'.geojson'),'Pakistan '+kind+' source loaded');
 await page.getByRole('tab',{name:'Areas',exact:true}).click();
 for(const [kind,count] of [['province',7],['district',160],['tehsil',577],['division',36]]){await level(kind);assert.equal(await page.locator('.area-row').count(),count,'Pakistan '+kind+' listing');}
 await level('province');const sindh=byId.get('pk-country-p-pk7');assert.ok(sindh);
 const provinceRow=page.locator('.area-row[data-area="'+sindh.id+'"]');await provinceRow.locator('.area-name').click();await page.waitForFunction(id=>!!JSON.parse(localStorage.getItem('punjab-studio-regional-v2')).fills[id],sindh.id);await provinceRow.getByRole('button',{name:'Zoom to '+sindh.name,exact:true}).click();await idle();
 const pixels=await page.locator('.maplibregl-canvas').screenshot({path:output+'/sindh-colored.png',style:'.regional-map-area > :not(.gl-map){visibility:hidden!important}'});
 const blue=await page.evaluate(async encoded=>{const im=new Image();im.src='data:image/png;base64,'+encoded;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);const p=ctx.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<p.length;i+=4)if(p[i]===39&&p[i+1]===100&&p[i+2]===216)n++;return n;},pixels.toString('base64'));
 assert.ok(blue>200,'Sindh province color inherits into actually rendered district/tehsil polygons');
 const svg=await exportSvg('all-provinces-divisions');const ids=[...new Set([...svg.matchAll(/data-area="([^"]+)"/g)].map(m=>m[1]))];assert.ok(ids.every(id=>byId.get(id)?.region==='pk-country'),'No legacy Punjab/KP or Indian map leaks into Pakistan view');
 assert.equal(ids.filter(id=>byId.get(id)?.level==='division').length,36);for(const division of divisions)assert.ok(ids.includes(division.id),'Export includes '+division.name+' source-era division');
 assert.ok(svg.includes('PBS frozen 01-03-2023')&&svg.includes('WFP/OCHA 2022')&&svg.includes('CC BY-IGO'),'Source edition/license qualifications survive export');
 await level('division');const chosen=divisions.find(d=>d.name==='Karachi');assert.ok(chosen);const row=page.locator('.area-row[data-area="'+chosen.id+'"]');await row.getByRole('button',{name:'Show/hide '+chosen.name,exact:true}).click();await idle();assert.ok((await saved()).hidden.includes(chosen.id));assert.ok(!(await exportSvg('hidden-karachi-division')).includes('data-area="'+chosen.id+'"'),'Hiding division removes its outline from export');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await page.waitForFunction(id=>!JSON.parse(localStorage.getItem('punjab-studio-regional-v2')).hidden.includes(id),chosen.id);await idle();
 const expected=await saved();await page.reload({waitUntil:'networkidle'});await idle();const restored=await saved();assert.equal(restored.countryView,'pk-country');assert.equal(restored.regions['pk-country'].division,true);assert.deepEqual(restored.fills,expected.fills);
 assert.ok(!(await page.locator('.statusbar output').innerText()).includes('Map resource:'));assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
 console.log(JSON.stringify({result:'passed',provinces:7,districts:160,tehsils:577,divisions:sources.count,provinceInheritedPixels:blue,svgSourceQualification:true,hideUndo:true,reload:true}));
}catch(error){await page.screenshot({path:output+'/failure.png',fullPage:true}).catch(()=>{});console.log(JSON.stringify({errors,failures,body:(await page.locator('body').innerText()).slice(0,2300)}));throw error;}
finally{await browser.close();}
