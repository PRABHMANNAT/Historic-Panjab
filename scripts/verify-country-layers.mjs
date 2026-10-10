import {configureExport,triggerExport,openLayerGroup,downloadSettings} from './workspace-ui.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';

const read=async path=>JSON.parse(await fs.readFile(new URL('../'+path,import.meta.url),'utf8'));
const manifest=await read('app/neighbour-country-sources.json'),catalog=await read('app/catalog.json');
const known=[...manifest.countries.map(c=>c.id),...manifest.views.map(v=>v.id)];
const requested=process.env.MAP_COUNTRY_IDS?.split(',').filter(Boolean)||known;
assert.ok(requested.every(id=>known.includes(id)),'Known country/context IDs');
const seed={fills:{},regions:Object.fromEntries(catalog.filter(a=>a.level==='region').map(a=>[a.region,{show:false,province:false,district:false,tehsil:false,uc:false,division:false}]))};
const browser=await chromium.launch({channel:process.env.MAP_BROWSER_CHANNEL||'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
await fs.mkdir('outputs/countries',{recursive:true});
let verified=0;
try{
 for(const id of requested){
  const source=manifest.countries.find(c=>c.id===id),view=manifest.views.find(v=>v.id===id),ids=view?.regionIds||[id];
  const counts=Object.fromEntries(['province','district','tehsil'].map(level=>[level,catalog.filter(a=>ids.includes(a.region)&&a.level===level).length]));
  const context=await browser.newContext({viewport:{width:1600,height:1100},acceptDownloads:true});
  await context.addInitScript(seed=>{if(!localStorage.getItem('punjab-studio-regional-v2'))localStorage.setItem('punjab-studio-regional-v2',JSON.stringify(seed));},seed);
  const page=await context.newPage(),errors=[],failures=[],loaded=new Set();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)failures.push(r.status()+' '+r.url());if(r.ok()&&r.url().includes('/data/'))loaded.add(new URL(r.url()).pathname);});
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('punjab-studio-regional-v2')));
  const idle=async()=>{await page.waitForLoadState('networkidle');await page.waitForFunction(()=>document.querySelector('.gl-host')?.getAttribute('aria-busy')==='false',null,{timeout:120000});};
  const paintSaved=(areaId,present)=>page.waitForFunction(([id,p])=>!!JSON.parse(localStorage.getItem('punjab-studio-regional-v2')).fills[id]===p,[areaId,present]);
  const chooseLevel=level=>page.locator('.area-levels').getByRole('button',{name:level==='province'?'Provinces / regional units':level==='district'?'Districts':'Tehsils',exact:true}).click();
  const bluePixels=async()=>{
   // Locator screenshots include overlapping DOM. Hide every sibling of the
   // WebGL map so counts prove actual geometry, not legend/button swatches.
   const png=await page.locator('.maplibregl-canvas').screenshot({style:'.regional-map-area > :not(.gl-map){visibility:hidden!important}'});
   return page.evaluate(async encoded=>{const im=new Image();im.src='data:image/png;base64,'+encoded;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);const p=ctx.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<p.length;i+=4)if(p[i]===39&&p[i+1]===100&&p[i+2]===216)n++;return n;},png.toString('base64'));
  };
  const exportFile=async format=>{
   await configureExport(page,{format:format.toUpperCase()});
   const event=page.waitForEvent('download',{timeout:120000});
   await triggerExport(page);
   const file='outputs/countries/'+id+'.'+format;await(await event).saveAs(file);return file;
  };
  try{
   await page.goto(process.env.MAP_TEST_URL||'http://localhost:4545/',{waitUntil:'networkidle',timeout:60000});
   await page.waitForFunction(()=>!document.querySelector('button.primary')?.disabled,null,{timeout:60000});
   await openLayerGroup(page,'Countries & territories');await page.getByLabel('Country map view').selectOption(id);
   if(counts.tehsil)await page.getByRole('checkbox',{name:'Country tehsil layer',exact:true}).check();
   else assert.equal(await page.getByRole('checkbox',{name:'Country tehsil layer',exact:true}).count(),0);
   if(!counts.province)assert.equal(await page.getByRole('checkbox',{name:'Country province layer',exact:true}).count(),0);
   await idle();
   assert.equal((await saved()).countryView,id);
   for(const region of ids)for(const level of ['region','province','district','tehsil']){
    // Combined view replaces the three individual region-outline layers.
    if(view&&level==='region'||!manifest.layers[region+'-'+level])continue;
    for(const suffix of ['','-labels'])assert.ok(loaded.has('/data/'+region+'-'+level+suffix+'.geojson'),region+' '+level+' resource');
   }
   if(view)for(const suffix of ['','-labels'])assert.ok(loaded.has('/data/'+id+'-region'+suffix+'.geojson'));
   const parent=catalog.find(a=>ids.includes(a.region)&&a.level===(counts.province?'province':'district'));
   await page.getByLabel('Isolate a province or regional unit').selectOption(parent.id);await idle();
   assert.equal((await saved()).mapScope,'selection');assert.deepEqual((await saved()).scopeAreas,[parent.id]);
   // Restore the country/context to exercise the original whole-country checks.
   await page.getByLabel('Country map view').selectOption(id);await idle();
   await page.getByRole('tab',{name:'Areas',exact:true}).click();
   for(const level of ['province','district','tehsil']){await chooseLevel(level);assert.equal(await page.locator('.area-row').count(),counts[level],id+' '+level+' list');}
   await chooseLevel(parent.level);
   const parentRow=page.locator('.area-row[data-area="'+parent.id+'"]');
   await parentRow.locator('.area-name').click();await paintSaved(parent.id,true);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await paintSaved(parent.id,false);
   await page.getByRole('button',{name:'Redo',exact:true}).click();await paintSaved(parent.id,true);
   // Largest child bbox makes island maps visible at the camera's zoom cap.
   const children=catalog.filter(a=>a.parent===parent.id);
   const child=children.sort((a,b)=>(b.bbox[2]-b.bbox[0])*(b.bbox[3]-b.bbox[1])-(a.bbox[2]-a.bbox[0])*(a.bbox[3]-a.bbox[1]))[0];
   assert.ok(child);await chooseLevel(child.level);
   await page.getByLabel('Find an area').fill(child.name);
   const childRow=page.locator('.area-row[data-area="'+child.id+'"]');
   assert.equal(await childRow.locator('.area-name i').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(39, 100, 216)','Inherited swatch color');
   await childRow.getByRole('button',{name:'Zoom to '+child.name,exact:true}).click();await idle();
   const pixels=await bluePixels();assert.ok(pixels>50,id+' inherited child geometry is blue on the actual canvas');
   await page.getByLabel('Find an area').fill('');await chooseLevel(parent.level);
   await parentRow.getByRole('button',{name:'Show/hide '+parent.name,exact:true}).click();await idle();
   assert.ok((await saved()).hidden.includes(parent.id));assert.equal(await bluePixels(),0,'Hidden parent removes inherited child fill from canvas');
   await parentRow.getByRole('button',{name:'Show/hide '+parent.name,exact:true}).click();await idle();
   assert.ok(!(await saved()).hidden.includes(parent.id));
   await chooseLevel(child.level);await page.getByLabel('Find an area').fill(child.name);
   await childRow.locator('.area-name').click();await paintSaved(child.id,true);
   await page.screenshot({path:'outputs/countries/'+id+'.png'});
   await configureExport(page,{extent:'Full map'});
   const svg=await fs.readFile(await exportFile('svg'),'utf8');
   assert.ok(svg.includes('data-area="'+child.id+'"'));assert.ok(svg.includes('#2764d8'));assert.ok(/<path[^>]*fill="#2764d8"/.test(svg));
   assert.ok(svg.includes('Regional sources:'));
   assert.ok(svg.includes(source?.iso==='chn'||view?'ISC/MIT':'CC BY-IGO'),'Export attribution');
   if(view){assert.ok(svg.includes('not traditional Greater Tibet'));assert.ok(svg.includes('data-area="'+view.id+'"'));}
   if(['np-nepal','mv-maldives','tibet-modern-three'].includes(id)){
    await configureExport(page,{width:1200});
    const png=await fs.readFile(await exportFile('png'));assert.equal(png.subarray(1,4).toString(),'PNG');
    const event=page.waitForEvent('download');await downloadSettings(page);
    const file='outputs/countries/'+id+'-settings.json';await(await event).saveAs(file);const expected=await saved();
    await page.getByRole('tab',{name:'Layers',exact:true}).click();await openLayerGroup(page,'Countries & territories');await page.getByLabel('Country map view').selectOption('');
    await page.locator('input[type=file]').setInputFiles(file);await page.waitForFunction(id=>JSON.parse(localStorage.getItem('punjab-studio-regional-v2')).countryView===id,id);await idle();
    assert.deepEqual((await saved()).fills,expected.fills);
   }
   const expected=await saved();await page.reload({waitUntil:'networkidle'});await idle();
   assert.equal((await saved()).countryView,id);assert.deepEqual((await saved()).fills,expected.fills);
   for(const region of ids)assert.deepEqual((await saved()).regions[region],expected.regions[region]);
   assert.ok(!(await page.locator('.statusbar output').innerText()).includes('Map resource:'));
   await page.getByRole('button',{name:'Guide & sources',exact:true}).click();
   const guide=await page.getByRole('dialog').innerText();assert.ok(guide.includes(source?.name||view.name));assert.ok(guide.includes('CC BY-IGO')&&guide.includes('PDDL-1.0'));
   await page.keyboard.press('Escape');
   if(id==='np-nepal'||view){await page.setViewportSize({width:390,height:844});await page.screenshot({path:'outputs/countries/'+id+'-mobile.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No mobile overflow');}
   assert.deepEqual(errors,[],id+' browser errors');assert.deepEqual(failures,[],id+' HTTP failures');
   verified++;console.log('Verified '+id+': '+JSON.stringify(counts)+', inherited canvas pixels '+pixels+', hide, undo/redo, SVG, settings and reload.');
  }catch(error){
   await page.screenshot({path:'outputs/countries/'+id+'-failure.png'}).catch(()=>{});
   console.log(JSON.stringify({id,errors,failures,body:(await page.locator('body').innerText()).slice(0,2500)}));throw error;
  }finally{await context.close();}
 }
 console.log(JSON.stringify({result:'passed',countryContexts:verified,isolatedContexts:true,svgExports:true,hierarchyCanvas:true}));
}finally{await browser.close();}
