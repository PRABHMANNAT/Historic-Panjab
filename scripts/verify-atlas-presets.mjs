import {configureExport,triggerExport,openLayerGroup} from './workspace-ui.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';

// New controls -> saved settings -> bundled geographic sources -> actual
// renderer pixels -> editable SVG/PNG exports. Use an isolated context for the
// full-map check so earlier visits cannot conceal unwanted detail downloads.
const read=async file=>JSON.parse(await fs.readFile(new URL('../'+file,import.meta.url),'utf8'));
const catalog=await read('app/catalog.json'),gurdwaras=await read('app/gurdwara-data.json');
const cities=await read('public/data/cities.geojson');
const byId=new Map(catalog.map(a=>[a.id,a]));
const synthetic=new Set(['delhi-ncr','kashmir-united','tibet-modern-three']);
const regionAreas=catalog.filter(a=>a.level==='region'&&!synthetic.has(a.region));
assert.equal(gurdwaras.length,100);
const takhtIds=gurdwaras.filter(g=>g.tier==='takht').map(g=>g.id);
const featuredIds=gurdwaras.filter(g=>g.tier==='featured').map(g=>g.id);
assert.equal(takhtIds.length,5);assert.equal(featuredIds.length,15);
const fullMaskAreas=regionAreas.filter(a=>!['pk-punjab','pk-kp','islamabad'].includes(a.region));
const fullMasks=await Promise.all(fullMaskAreas.map(async area=>({area,geo:await read('public/data/'+area.region+'-region.geojson')})));
const seed={fills:{'in-d-608':{color:'#8239a8',pattern:'solid'}},regions:Object.fromEntries(regionAreas.map(a=>[a.region,{show:false,province:false,district:a.region==='in-delhi',tehsil:a.region==='in-delhi',uc:false,division:false}])),cities:false,rivers:false,gurdwaras:false};
const output='outputs/atlas-presets';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:process.env.MAP_BROWSER_CHANNEL||'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const results=[];
/** @type {import('playwright').Page|undefined} */
let activePage;

async function setup(name){
 const context=await browser.newContext({viewport:{width:1600,height:1100},acceptDownloads:true});
 await context.addInitScript(seed=>{if(!localStorage.getItem('punjab-studio-regional-v2'))localStorage.setItem('punjab-studio-regional-v2',JSON.stringify(seed));},seed);
 const page=await context.newPage(),errors=[],failures=[],loaded=new Set();activePage=page;
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)failures.push(r.status()+' '+r.url());if(r.ok()&&r.url().includes('/data/'))loaded.add(new URL(r.url()).pathname);});
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('punjab-studio-regional-v2')));
 const idle=async()=>{await page.waitForLoadState('networkidle');await page.waitForFunction(()=>document.querySelector('.gl-host')?.getAttribute('aria-busy')==='false',null,{timeout:120000});};
 const setting=(key,value)=>page.waitForFunction(([k,v])=>JSON.parse(localStorage.getItem('punjab-studio-regional-v2'))[k]===v,[key,value]);
 const choose=async value=>{await openLayerGroup(page,'Geographic view');await page.getByLabel('Geographic map scope',{exact:true}).selectOption(value);await setting('mapScope',value);await idle();};
 const exportFile=async (format,suffix)=>{
  await configureExport(page,{format:format.toUpperCase()});
  await configureExport(page,{extent:'Full map'});
  const download=page.waitForEvent('download',{timeout:120000});
  await triggerExport(page);
  const file=output+'/'+name+'-'+suffix+'.'+format;await(await download).saveAs(file);return file;
 };
 const svg=async suffix=>fs.readFile(await exportFile('svg',suffix),'utf8');
 const success=async details=>{assert.ok(!(await page.locator('.statusbar output').innerText()).includes('Map resource:'),'No renderer resource error');assert.deepEqual(errors,[],name+' page/console errors');assert.deepEqual(failures,[],name+' HTTP failures');results.push({name,...details});console.log('Verified '+name+': '+JSON.stringify(details));await context.close();activePage=undefined;};
 await page.goto(process.env.MAP_TEST_URL||'http://localhost:4545/',{waitUntil:'networkidle',timeout:60000});
 await page.waitForFunction(()=>!document.querySelector('button.primary')?.disabled,null,{timeout:60000});await idle();
 return {page,context,errors,failures,loaded,saved,idle,setting,choose,exportFile,svg,success};
}
const areaIds=svg=>[...new Set([...svg.matchAll(/data-area="([^"]+)"/g)].map(match=>match[1]))];
const overlayIds=(svg,type)=>[...new Set([...svg.matchAll(new RegExp('data-'+type+'="([^"]+)"','g'))].map(match=>match[1]))];
function onlyRegions(svg,regions){const ids=areaIds(svg);assert.ok(ids.length,'Boundary export is not empty');for(const id of ids){const area=byId.get(id);assert.ok(area,'Known exported area '+id);assert.ok(regions.includes(area.region),'No out-of-scope polygon '+id+' ('+area.region+')');}return ids;}
function insideRing(point,ring){let inside=false;const [x,y]=point;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
function inGeometry(point,g){const polygons=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];return polygons.some(rings=>insideRing(point,rings[0])&&!rings.slice(1).some(ring=>insideRing(point,ring)));}
const inFullGeography=point=>fullMasks.some(({area,geo})=>point[0]>=area.bbox[0]&&point[0]<=area.bbox[2]&&point[1]>=area.bbox[1]&&point[1]<=area.bbox[3]&&geo.features.some(f=>inGeometry(point,f.geometry)));
async function colorInput(page,label,color){await page.getByLabel(label,{exact:true}).evaluate((input,color)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,color);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));},color);}
async function canvas(page,name){return page.locator('.maplibregl-canvas').screenshot({path:output+'/'+name+'.png',style:'.regional-map-area > :not(.gl-map){visibility:hidden!important}'});}
async function pixelCount(page,png,color){return page.evaluate(async ([encoded,hex])=>{const im=new Image();im.src='data:image/png;base64,'+encoded;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));let count=0;for(let i=0;i<pixels.length;i+=4)if(rgb.every((v,k)=>pixels[i+k]===v))count++;return count;},[png.toString('base64'),color]);}
async function changedPixels(page,before,after){return page.evaluate(async ([a,b])=>{async function decode(base64){const im=new Image();im.src='data:image/png;base64,'+base64;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);return ctx.getImageData(0,0,c.width,c.height).data;}const [x,y]=await Promise.all([decode(a),decode(b)]);let count=0;for(let i=0;i<x.length;i+=4)if(Math.max(Math.abs(x[i]-y[i]),Math.abs(x[i+1]-y[i+1]),Math.abs(x[i+2]-y[i+2]))>20)count++;return count;},[before.toString('base64'),after.toString('base64')]);}

try{
 {
  const t=await setup('geographic-scopes');
  await t.choose('single');await t.page.getByLabel('Individual map region',{exact:true}).selectOption('in-delhi');await t.idle();
  const delhi=onlyRegions(await t.svg('only-delhi'),['in-delhi']);assert.ok(delhi.some(id=>byId.get(id).level==='district'));assert.ok(delhi.some(id=>byId.get(id).level==='tehsil'));
  await t.page.getByRole('button',{name:'Show Delhi NCR',exact:true}).click();await t.setting('delhiView','ncr');await t.idle();
  assert.equal((await t.saved()).mapScope,'atlas','NCR clears an incompatible individual scope');const ncr=await t.svg('ncr');assert.ok(areaIds(ncr).includes('delhi-ncr'));assert.ok(!areaIds(ncr).includes('in-haryana-d-58'));
  await t.choose('tricity');
  const tricity=await t.svg('tricity'),tricityIds=onlyRegions(tricity,['chandigarh','in-punjab','in-haryana']);
  for(const id of ['chandigarh','in-d-608','in-haryana-d-70'])assert.ok(tricityIds.includes(id),'Tricity includes source context '+id);
  assert.ok(!tricityIds.includes('in-punjab')&&!tricityIds.includes('in-haryana'),'Tricity does not draw whole parent states');
  const tricityParents=new Set(['in-d-608','in-haryana-d-70']);for(const id of tricityIds){const a=byId.get(id);assert.ok(a.region==='chandigarh'||tricityParents.has(id)||tricityParents.has(a.parent),'Tricity hierarchy only');}
  assert.match(tricity,/not an exact urban/);
  const purple=await pixelCount(t.page,await canvas(t.page,'tricity-painted-context'),'#8239a8');assert.ok(purple>100,'Inherited saved district fill is actually drawn in Tricity');
  await t.choose('combination');
  await t.page.getByRole('checkbox',{name:'Include Punjab · Pakistan in geographic scope',exact:true}).uncheck();
  await t.page.getByRole('checkbox',{name:'Include Delhi (National Capital Territory) in geographic scope',exact:true}).check();await t.idle();
  const combo=onlyRegions(await t.svg('combination'),['in-punjab','in-delhi']);assert.ok(combo.includes('in-punjab')&&combo.includes('in-delhi'));
  await t.choose('historic-punjab');const historic=onlyRegions(await t.svg('historic-context'),['in-punjab','pk-punjab','in-haryana','in-himachal','chandigarh']);assert.ok(historic.includes('pk-punjab'),'Previously enabled coherent Pakistan cannot hide standalone Punjabi context');
  await t.page.getByRole('checkbox',{name:'Include Haryana in geographic scope',exact:true}).uncheck();await t.idle();
  const before=await t.saved();assert.equal(before.fills['in-d-608'].color,'#8239a8','Scope changes preserve prior paints');
  await t.page.reload({waitUntil:'networkidle'});await t.idle();const restored=await t.saved();assert.equal(restored.mapScope,'historic-punjab');assert.deepEqual(restored.historicRegions,before.historicRegions);assert.deepEqual(restored.fills,before.fills);
  onlyRegions(await t.svg('historic-restored'),['in-punjab','pk-punjab','in-himachal','chandigarh']);
  await t.page.setViewportSize({width:390,height:844});await t.page.screenshot({path:output+'/mobile.png'});assert.ok(await t.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No mobile horizontal overflow');
  await t.success({singleDelhi:true,ncr:true,tricity:true,tricityColorPixels:purple,combination:true,editableHistoricContext:true,reload:true,mobile:true});
 }
 {
  const t=await setup('full-map');await t.choose('full');
  assert.equal((await t.saved()).fullDetail,false);
  const outlineSvg=await t.svg('outlines');const outlines=areaIds(outlineSvg);assert.ok(outlines.length>35,'All available geography outlines are available');assert.ok(outlines.every(id=>byId.get(id)?.level==='region'),'Full default exports only outlines');
  const detailRequest=url=>/-((?:province|district|tehsil|uc|division))(?:-labels)?\.geojson$/.test(url);
  assert.equal([...t.loaded].filter(detailRequest).length,0,'Full default does not download all detail datasets');
  await t.page.getByRole('checkbox',{name:'Include enabled detail layers',exact:true}).check();await t.idle();
  const detailSvg=await t.svg('enabled-details');assert.ok(areaIds(detailSvg).some(id=>byId.get(id)?.region==='in-delhi'&&byId.get(id)?.level==='tehsil'));
  assert.ok([...t.loaded].filter(detailRequest).every(url=>url.startsWith('/data/in-delhi-')),'Full detail only follows saved enabled detail flags');
  await t.success({outlines:outlines.length,noAutomaticDetailDownloads:true,enabledDetailPreference:true});
 }
 {
  const t=await setup('overlays');await t.choose('single');await t.page.getByLabel('Individual map region',{exact:true}).selectOption('in-delhi');await t.idle();
  await t.page.getByRole('tab',{name:'Overlays',exact:true}).click();await t.page.getByRole('checkbox',{name:'Show major cities',exact:true}).check();await t.page.getByLabel('City selection',{exact:true}).selectOption('major');
  await t.page.getByRole('checkbox',{name:'Auto-color city markers',exact:true}).uncheck();await colorInput(t.page,'City highlight color','#ed1736');await t.setting('cityColor','#ed1736');await t.idle();
  const cityPixels=await pixelCount(t.page,await canvas(t.page,'delhi-cities'),'#ed1736');assert.ok(cityPixels>12,'Custom major-city highlights render in WebGL');
  const delhiRegions=await read('public/data/in-delhi-region.geojson'),citySvg=await t.svg('delhi-cities');const cityIds=overlayIds(citySvg,'city');assert.ok(cityIds.length>0,'Selected Delhi contains major cities');
  for(const id of cityIds){const city=cities.features.find(f=>String(f.id)===id);assert.ok(city,'Known city ID '+id);assert.ok(delhiRegions.features.some(f=>inGeometry(city.geometry.coordinates,f.geometry)),'City is inside Delhi polygon, not merely its bounding box');}
  assert.ok(citySvg.includes('#ed1736')&&citySvg.includes('Natural Earth'));
  const previousPaints=(await t.saved()).fills;await t.page.getByRole('button',{name:'Auto-color major-city districts',exact:true}).click();
  await t.page.waitForFunction(count=>Object.keys(JSON.parse(localStorage.getItem('punjab-studio-regional-v2')).fills).length>count,Object.keys(previousPaints).length);const colored=(await t.saved()).fills;
  for(const id of Object.keys(colored).filter(id=>!previousPaints[id]))assert.equal(byId.get(id)?.region,'in-delhi','Only scoped city districts get auto-colored');
  await t.page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual((await t.saved()).fills,previousPaints);await t.page.getByRole('button',{name:'Redo',exact:true}).click();assert.deepEqual((await t.saved()).fills,colored);
  await t.page.getByRole('checkbox',{name:'Show rivers',exact:true}).check();await colorInput(t.page,'River color','#00c2a8');await t.setting('riverColor','#00c2a8');await t.idle();
  const riverPixels=await pixelCount(t.page,await canvas(t.page,'delhi-rivers'),'#00c2a8');assert.ok(riverPixels>20,'Custom river color renders on the canvas');
  const riverSvg=await t.svg('delhi-rivers');assert.ok(overlayIds(riverSvg,'river').length>0&&riverSvg.includes('#00c2a8'));
  await t.page.getByRole('tab',{name:'Overlays',exact:true}).click();await t.page.getByRole('checkbox',{name:'Show major cities',exact:true}).uncheck();await t.page.getByRole('checkbox',{name:'Show rivers',exact:true}).uncheck();
  await t.choose('full');await t.page.getByRole('tab',{name:'Overlays',exact:true}).click();await t.page.getByRole('checkbox',{name:'Show gurdwaras',exact:true}).check();assert.equal(await t.page.getByLabel('Find a gurdwara',{exact:true}).locator('option').count(),101,'Picker includes all 100 curated sites plus placeholder');
  await t.page.getByLabel('Gurdwara selection',{exact:true}).selectOption('takht');await t.page.getByRole('checkbox',{name:'Show gurdwara names',exact:true}).uncheck();await t.page.getByRole('button',{name:'Fit shown gurdwaras',exact:true}).click();await t.idle();
  const takhtSvg=await t.svg('five-takhts');assert.deepEqual(overlayIds(takhtSvg,'gurdwara').sort((a,b)=>a.localeCompare(b)),[...takhtIds].sort((a,b)=>a.localeCompare(b)));assert.equal([...takhtSvg.matchAll(/data-gurdwara-tier="takht"/g)].length,5);
  const withShrines=await canvas(t.page,'five-takhts');await t.page.getByRole('tab',{name:'Overlays',exact:true}).click();await t.page.getByRole('checkbox',{name:'Show gurdwaras',exact:true}).uncheck();await t.idle();const withoutShrines=await canvas(t.page,'without-takhts');const shrinePixels=await changedPixels(t.page,withoutShrines,withShrines);assert.ok(shrinePixels>100,'Dedicated Takht sprites actually affect the WebGL map');
  await t.page.getByRole('tab',{name:'Overlays',exact:true}).click();await t.page.getByRole('checkbox',{name:'Show gurdwaras',exact:true}).check();await t.page.getByLabel('Gurdwara selection',{exact:true}).selectOption('featured');await t.idle();const featured=await t.svg('featured-fifteen');assert.deepEqual(overlayIds(featured,'gurdwara').sort((a,b)=>a.localeCompare(b)),[...featuredIds].sort((a,b)=>a.localeCompare(b)));assert.ok(featured.includes('gs-harmandir-sahib')&&featured.includes('gs-fatehgarh-sahib')&&featured.includes('gs-jyoti-sarup-sahib'));
  await t.page.getByLabel('Gurdwara selection',{exact:true}).selectOption('special');await t.idle();assert.equal(overlayIds(await t.svg('twenty-special-sites'),'gurdwara').length,20);
  await t.page.getByLabel('Gurdwara selection',{exact:true}).selectOption('all');await t.page.getByRole('checkbox',{name:'Show gurdwara names',exact:true}).check();await t.idle();const allSites=await t.svg('all-shrines');const expectedSites=gurdwaras.filter(g=>inFullGeography(g.coordinates)).map(g=>g.id).sort((a,b)=>a.localeCompare(b));assert.deepEqual(overlayIds(allSites,'gurdwara').sort((a,b)=>a.localeCompare(b)),expectedSites,'All—and only—catalog sites inside supplied geographic outlines are exported');assert.ok(/SGPC|Shiromani|gurdwara-sources|Curated/i.test(allSites),'Shrine provenance is retained in exports');
  await configureExport(t.page,{width:1200});const png=await fs.readFile(await t.exportFile('png','all-shrines'));assert.equal(png.subarray(1,4).toString(),'PNG');
  const download=t.page.waitForEvent('download');await t.page.getByRole('button',{name:'Save',exact:true}).click();const file=output+'/overlay-settings.json';await(await download).saveAs(file);const expected=await t.saved();
  await t.page.getByRole('tab',{name:'Overlays',exact:true}).click();await t.page.getByRole('checkbox',{name:'Show gurdwaras',exact:true}).uncheck();await t.page.locator('input[type=file]').setInputFiles(file);await t.setting('gurdwaras',true);await t.idle();const restored=await t.saved();
  for(const key of ['mapScope','fullDetail','cities','cityMode','cityAutoColors','cityColor','rivers','riverColor','gurdwaras','gurdwaraFilter','gurdwaraLabels'])assert.equal(restored[key],expected[key],'Settings Load restores '+key);
  await t.page.reload({waitUntil:'networkidle'});await t.idle();const reloaded=await t.saved();for(const key of ['mapScope','cityColor','riverColor','gurdwaras','gurdwaraFilter'])assert.equal(reloaded[key],expected[key]);assert.deepEqual(reloaded.fills,expected.fills);
  await t.success({scopedMajorCities:cityIds.length,cityPixels,cityDistrictAutoColor:true,undoRedo:true,riverPixels,gurdwaraCatalog:100,sitesInsideSuppliedMap:expectedSites.length,takhts:5,featured:15,special:20,shrinePixels,pngSvg:true,saveLoadReload:true});
 }
 console.log(JSON.stringify({result:'passed',checks:results}));
}catch(error){if(activePage){await activePage.screenshot({path:output+'/failure.png',fullPage:true}).catch(()=>{});console.log((await activePage.locator('body').innerText()).slice(0,2600));}throw error;}
finally{await browser.close();}
