import type {FeatureCollection,Geometry,Position} from 'geojson';
import {areas,areaById,bounds,visible,effectivePaint,paintKey,download,activeMetroLines,metroStationVisible,countries,countryViewById,inCountryScope,type MapDoc,type Area} from './map-model';
import type {MapAPI} from './map-view';
import {scopeFocusBounds,scopeGeometryKeys,scopeLabel,scopeQualification,scopeRegionAllowed} from './scope-model';
import {overlayMasks,pointInMasks,scopedPoints,scopedRivers} from './spatial-overlays';
import {cityPaintColor,majorCity,shrineTierAllowed,type CityProperties} from './overlay-model';
import {gurdwaraIcon,type ShrineSymbolTier} from './gurdwara-icons';
import gurdwaras from './gurdwara-data.json';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const creditLines=(text:string)=>text.split(' ').reduce<string[]>((lines,word)=>{const last=lines.length-1;if(last<0||lines[last].length+word.length>155)lines.push(word);else lines[last]+=' '+word;return lines},[]);
export async function exportMap(doc:MapDoc,api:MapAPI,format:string,width:number,current:boolean){
 const height=Math.round(width*.82),groups=[...new Map(Object.values(doc.fills).map(p=>[paintKey(p),p])).entries()];
 const metroLines=activeMetroLines(doc);
 const activeCountries=countries.filter(c=>doc.regions[c.id]?.show&&scopeRegionAllowed(c.id,doc)&&inCountryScope({region:c.id} as Area,doc));
 const sourceCredits=activeCountries.map(c=>`${c.name}: ${c.source} | ${c.license} | ${c.url}`).join(' ; ');
 const nationalCredits=activeCountries.filter(c=>c.iso!=='chn').map(c=>c.name+': '+c.source.replace(/\s*\(https?:\/\/[^)]*\)/g,'')).join('; ');
 const countryNotice=activeCountries.length?'Regional sources: '+[nationalCredits?'OCHA/HDX · '+nationalCredits+' · CC BY-IGO · https://creativecommons.org/licenses/by/3.0/igo/':'',activeCountries.some(c=>c.iso==='chn')?'cn-atlas (Amll) / CTAmap (Rui Cheng) · ISC/MIT; National Administration of Surveying, Mapping and Geoinformation / Revolutionary GIS via geoBoundaries · PDDL-1.0':''].filter(Boolean).join(' | '):'';
 const contextView=countryViewById.get(doc.countryView);
 const contextNotice=contextView?'Modern Tibet + Qinghai + Sichuan · not traditional Greater Tibet. '+contextView.qualification:'';
 const scopeNotice=scopeQualification(doc);
 const overlayNotice=doc.cities||doc.rivers||doc.basemap==='rivers'?'City centers and generalized major rivers: Natural Earth · public domain · archival overview, not current population or municipal limits.':'';
 const shrineNotice=doc.gurdwaras?'Gurdwara locations © OpenStreetMap contributors (ODbL 1.0) / Wikidata (CC0); identities: SGPC, DSGMC, official district/tourism sources. Approximate points, not surveyed entrances; featured 15 is editorial.':'';
 const divisionNotice=areas.some(a=>a.region==='pk-country'&&a.level==='division'&&visible(a,doc))?'Pakistan divisions: exact WFP/OCHA 2022 district unions with PBS frozen 01-03-2023 membership; supplemental GB notification reports, not current legal surveys.':'';
 const kashmirActive=visible(areaById.get('kashmir-united')!,doc);
 const detailNotice=[doc.delhiView==='ncr'?'NCR · source reconstruction, not a certified current boundary':'',areas.some(a=>a.region==='in-delhi'&&a.level==='uc'&&visible(a,doc))?'Historical Delhi wards · OpenCity/Bharatlas · CC BY-SA 4.0':'',doc.delhiMetro?'© OpenStreetMap contributors · ODbL-1.0 · metro snapshot, not live service':''].filter(Boolean).join(' | ');
 const metroLegendCanvas=(ctx:CanvasRenderingContext2D)=>{if(!metroLines.length)return;const scale=width/1000;ctx.save();ctx.translate(width-210*scale,90*scale);ctx.scale(scale,scale);ctx.fillStyle='#fffffff0';ctx.fillRect(-10,-15,205,metroLines.length*17+33);ctx.fillStyle='#18324a';ctx.font='bold 12px Arial';ctx.fillText('Metro · OSM snapshot',0,0);ctx.font='10px Arial';metroLines.forEach((l,i)=>{ctx.fillStyle=doc.metroLines[l.id].color;ctx.fillRect(0,12+i*17,17,4);ctx.fillStyle='#18324a';ctx.fillText(l.name,24,17+i*17,165);});ctx.restore();};
 const legend=(ctx:CanvasRenderingContext2D)=>{if(!doc.legend||!groups.length)return;const x=width*doc.legendX/100,y=Math.min(height*doc.legendY/100,height-(groups.length*24+55)*width/1000),scale=width/1000;ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.fillStyle='#ffffffed';ctx.fillRect(-12,-27,238,groups.length*24+55);ctx.fillStyle='#18324a';ctx.font='bold 15px Arial';ctx.fillText(doc.legendTitle,0,-4,210);ctx.font='13px Arial';groups.forEach(([k,p],i)=>{ctx.fillStyle=p.color;ctx.fillRect(0,12+i*24,14,14);ctx.fillStyle='#18324a';ctx.fillText(doc.groups[k]||'Group '+(i+1),23,24+i*24,195)});ctx.restore()};
 if(doc.basemap!=='political'&&format!=='svg'){
  const url=await api.snapshot(),img=new Image();await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=reject;img.src=url});const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d')!;ctx.fillStyle=doc.bg;ctx.fillRect(0,0,width,height);ctx.drawImage(img,0,0,width,height);ctx.fillStyle='#ffffffdf';ctx.fillRect(0,0,width,70*width/1000);ctx.fillStyle='#142b44';ctx.font=`bold ${26*width/1000}px Arial`;ctx.fillText(doc.title,25*width/1000,45*width/1000,width*.9);legend(ctx);metroLegendCanvas(ctx);const footer=[scopeNotice,contextNotice,kashmirActive?'Combined J&K · Indian claimed extent · disputed territory':'',divisionNotice,detailNotice,countryNotice,overlayNotice,shrineNotice,'Sources: Esri, Vantor, Earthstar Geographics, HERE, OpenStreetMap contributors · boundary providers'].filter(Boolean).flatMap(creditLines);const fs=width/1000;ctx.fillStyle='#ffffffee';ctx.fillRect(0,height-(footer.length*12+12)*fs,width,(footer.length*12+12)*fs);ctx.fillStyle='#344d65';ctx.font=`${9*fs}px Arial`;footer.forEach((line,i)=>ctx.fillText(line,10*fs,height-(footer.length-i)*12*fs,width-20*fs));const blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,format==='jpg'?'image/jpeg':'image/png',.95));if(!blob)throw Error('Export failed');download(blob,'punjab-regional-map.'+format);return;
 }
 const shown=areas.filter(a=>visible(a,doc)),b=current?api.bounds():doc.mapScope!=='atlas'?scopeFocusBounds(doc)||bounds([]):bounds(shown.filter(a=>a.level==='region'));
 // Exclude off-screen polygons before constructing paths, not only with SVG clipping.
 const list=current?shown.filter(a=>a.bbox[0]<=b[2]&&a.bbox[2]>=b[0]&&a.bbox[1]<=b[3]&&a.bbox[3]>=b[1]):shown;
 const included=new Set(list.map(a=>a.id));
 if(b[0]>b[2])throw Error('Show at least one region before exporting');
 const footerLines=[scopeNotice,contextNotice,kashmirActive?'Combined Jammu & Kashmir · Indian claimed extent · disputed territory, not present control':'',divisionNotice,detailNotice,countryNotice,overlayNotice,shrineNotice,'Esri India · LGD/Bharatlas · WFP/OCHA 2022 · Lahore/HDX detail | Source dates and coverage differ'].filter(Boolean).flatMap(creditLines);
 const footerTop=803-footerLines.length*11;
 const mapBottom=Math.min(780,footerTop-10);
 const merc=(lat:number)=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));const my0=merc(b[1]),my1=merc(b[3]);const sc=Math.min(910/(b[2]-b[0]),(mapBottom-90)/(my1-my0)*Math.PI/180);
 const p=(pos:Position)=>[45+(pos[0]-b[0])*sc,90+(my1-merc(pos[1]))*180/Math.PI*sc];
 const path=(g:Geometry):string=>{if(g.type==='Polygon')return g.coordinates.map(r=>'M'+r.map(c=>p(c).map(v=>v.toFixed(2)).join(',')).join('L')+'Z').join('');if(g.type==='MultiPolygon')return g.coordinates.map(c=>path({type:'Polygon',coordinates:c})).join('');if(g.type==='LineString')return 'M'+g.coordinates.map(c=>p(c).map(v=>v.toFixed(2)).join(',')).join('L');if(g.type==='MultiLineString')return g.coordinates.map(c=>path({type:'LineString',coordinates:c})).join('');return ''};
 const keys=[...new Set(list.map(a=>a.region+'-'+a.level))],cache={...api.getData()};
 const loadLayer=async(k:string)=>{if(!cache[k])cache[k]=await fetch('/data/'+k+'.geojson').then(r=>{if(!r.ok)throw Error('Layer unavailable: '+k);return r.json() as Promise<FeatureCollection>});return cache[k];};
 const metroScoped=doc.delhiMetro&&(doc.mapScope!=='atlas'||doc.delhiView==='ncr'||!!doc.countryView);
 const overlayEnabled=doc.cities||doc.rivers||doc.basemap==='rivers'||doc.gurdwaras||metroScoped;
 // Geographic masks can be hidden or not yet fetched by the live map. Load them
 // independently into an export-local cache so overlays never leak across scope.
 await Promise.all([...new Set([...keys,...(overlayEnabled?scopeGeometryKeys(doc):[])])].map(loadLayer));
 const sources=keys.map(k=>({k,geo:cache[k]}));
 const masks=overlayEnabled?overlayMasks(doc,cache):[];
 const defs=groups.filter(([,p])=>p.pattern!=='solid').map(([k,p])=>`<pattern id="p${esc(k)}" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="${p.color}"/>${p.pattern==='dots'?'<circle cx="4" cy="4" r="1.3" fill="white" opacity=".65"/>':`<path d="${p.pattern==='cross'?'M0 4H8M4 0V8':'M0 8L8 0M-2 2L2 -2M6 10L10 6'}" stroke="white" opacity=".6" stroke-width="1.5"/>`}</pattern>`).join('');
 const pieces:string[]=[];const borderPieces:string[]=[];const labels:Area[]=[];
 for(const level of ['region','province','district','tehsil','uc','division'])for(const {geo}of sources)for(const f of geo.features){const a=areaById.get(String(f.id));if(!a||a.level!==level||!included.has(a.id))continue;const fill=effectivePaint(a,doc);const color=a.level==='division'?'none':fill?(fill.pattern==='solid'?fill.color:`url(#p${esc(paintKey(fill))})`):doc.uncolored;const strokeOn=doc.borders&&(level==='region'||(level==='province'?doc.provinceBorders:level==='district'?doc.districtBorders:level==='tehsil'?doc.tehsilBorders:level==='division'?doc.divisionBorders:doc.detailBorders));pieces.push(`<path data-area="${esc(a.id)}" d="${path(f.geometry)}" fill="${color}" fill-rule="evenodd"/>`);if(strokeOn)borderPieces.push(`<path data-area-border="${esc(a.id)}" d="${path(f.geometry)}" fill="none" stroke="${doc.border}" stroke-width="${doc.width*(level==='region'||level==='division'||level==='province'?1.6:level==='tehsil'?.65:1)}"/>`);if(doc.names&&a.region!=='kashmir-united')labels.push(a)}
 pieces.push(...borderPieces);
 const riverNameLabels:{id:string;name:string;center:number[]}[]=[];
 if(doc.rivers||doc.basemap==='rivers'){
  const rivers=scopedRivers(await loadLayer('rivers'),masks);
  for(const f of rivers.features){
   const id=String(f.id??f.properties?.id??f.properties?.name??''),name=String(f.properties?.name||'');
   pieces.push(`<path data-river="${esc(id)}" d="${path(f.geometry)}" fill="none" stroke="${doc.riverColor}" stroke-width="${doc.riverWidth}" stroke-linecap="round" stroke-linejoin="round"/>`);
   if(doc.riverLabels&&name&&(f.geometry.type==='LineString'||f.geometry.type==='MultiLineString')){
    const parts=(f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.coordinates).map(line=>line.map(p));
    const length=(line:number[][])=>line.slice(1).reduce((n,end,i)=>n+Math.hypot(end[0]-line[i][0],end[1]-line[i][1]),0);
    const longest=parts.sort((a,b)=>length(b)-length(a))[0];
    if(!longest?.length)continue;
    const halfway=length(longest)/2;let travelled=0;
    for(let i=1;i<longest.length;i++){
     const start=longest[i-1],end=longest[i],segment=Math.hypot(end[0]-start[0],end[1]-start[1]);
     if(travelled+segment>=halfway){const t=segment?(halfway-travelled)/segment:0;riverNameLabels.push({id,name,center:[start[0]+(end[0]-start[0])*t,start[1]+(end[1]-start[1])*t]});break;}travelled+=segment;
    }
   }
  }
 }
 const occupied:number[][]=[];
 if(kashmirActive&&doc.names){const context=await fetch('/data/kashmir-context-labels.geojson').then(r=>{if(!r.ok)throw Error('Kashmir context labels not loaded');return r.json() as Promise<FeatureCollection>});for(const f of context.features){if(f.geometry.type!=='Point')continue;const [x,y]=p(f.geometry.coordinates);if(x<20||x>960||y<85||y>mapBottom-5)continue;const name=String(f.properties?.name||''),size=doc.labelSize+2,w=name.length*size*.5;occupied.push([x-w/2,y-size/2,x+w/2,y+size/2]);pieces.push(`<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" fill="#624821" stroke="white" stroke-width="2.8" paint-order="stroke">${esc(name)}</text>`)}}

 for(const a of labels.reverse()){const [x,y]=p(a.center);if(x<20||x>960||y<85||y>mapBottom-5)continue;const size=doc.labelSize,w=a.name.length*size*.5;const box=[x-w/2,y-size/2,x+w/2,y+size/2];if(occupied.some(r=>box[0]<r[2]+4&&box[2]>r[0]-4&&box[1]<r[3]+3&&box[3]>r[1]-3))continue;occupied.push(box);pieces.push(`<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" fill="#18324a" stroke="white" stroke-width="2.8" paint-order="stroke">${esc(a.name)}</text>`)}
 for(const label of riverNameLabels){const [x,y]=label.center;if(x<20||x>960||y<85||y>mapBottom-5)continue;pieces.push(`<text data-river-name="${esc(label.id)}" x="${x}" y="${y}" font-size="11" font-style="italic" text-anchor="middle" fill="${doc.riverColor}" stroke="white" stroke-width="2.8" paint-order="stroke">${esc(label.name)}</text>`);}
 if(doc.cities){
  const cities=scopedPoints(await loadLayer('cities'),masks);
  for(const f of cities.features){
   if(f.geometry.type!=='Point'||!majorCity(f.properties as CityProperties,doc))continue;
   const [x,y]=p(f.geometry.coordinates);if(x<20||x>960||y<85||y>mapBottom-5)continue;
   const properties=f.properties as CityProperties,id=String(f.id??properties.id??properties.name??''),color=cityPaintColor(properties,doc),radius=properties.capital?5.5:(properties.population||0)>=1000000?4.7:3.8;
   pieces.push(`<g data-city="${esc(id)}"><title>${esc(String(properties.name||''))}</title><circle cx="${x}" cy="${y}" r="${radius+3}" fill="${color}" opacity=".18"/><circle cx="${x}" cy="${y}" r="${radius}" fill="${color}" stroke="white" stroke-width="1.3"/>${doc.names?`<text x="${x+radius+3}" y="${y+4}" font-size="12" fill="${color}" stroke="white" stroke-width="2.8" paint-order="stroke">${esc(String(properties.name||''))}</text>`:''}</g>`);
  }
 }
 const exportedShrines:string[]=[];
 if(doc.gurdwaras){
  for(const g of gurdwaras){
   if(!shrineTierAllowed(g.tier,doc)||!pointInMasks(g.coordinates,masks))continue;
   const [x,y]=p(g.coordinates);if(x<20||x>960||y<85||y>mapBottom-5)continue;
   const tier=g.tier as ShrineSymbolTier,size=(tier==='takht'?38:tier==='featured'?34:25)*doc.gurdwaraScale;
   const icon=gurdwaraIcon(tier,tier==='historic'?0:g.iconIndex,doc.gurdwaraColor).replace(/<svg[^>]*>/,'').replace(/<\/svg>$/,'');
   exportedShrines.push(g.id);
   pieces.push(`<g data-gurdwara="${esc(g.id)}" data-gurdwara-tier="${esc(tier)}"><title>${esc(g.name+' · '+g.city)}</title><g transform="translate(${x-size/2},${y-size/2}) scale(${size/56})">${icon}</g>`);
   if(doc.gurdwaraLabels){const labelY=y+size/2+11,labelWidth=g.name.length*5,box=[x-labelWidth/2,labelY-10,x+labelWidth/2,labelY+3];if(!occupied.some(r=>box[0]<r[2]+4&&box[2]>r[0]-4&&box[1]<r[3]+3&&box[3]>r[1]-3)){occupied.push(box);pieces.push(`<text x="${x}" y="${labelY}" font-size="10" text-anchor="middle" fill="#23445b" stroke="white" stroke-width="2.8" paint-order="stroke">${esc(g.name)}</text>`);}}
   pieces.push('</g>');
  }
 }
 if(doc.delhiMetro){
  const fetchMetro=async(kind:string)=>cache['delhi-metro-'+kind]||await fetch('/data/delhi-metro-'+kind+'.geojson').then(r=>{if(!r.ok)throw Error('Metro '+kind+' unavailable');return r.json() as Promise<FeatureCollection>;});
  const [routes,stations]=await Promise.all([fetchMetro('routes'),fetchMetro('stations')]);
  const routeCollection=metroScoped?scopedRivers(routes,masks):routes,stationCollection=metroScoped?scopedPoints(stations,masks):stations;
  const lineIds=new Set(metroLines.map(l=>l.id));
  pieces.push('<g id="metro-tracks">');
  for(const f of routeCollection.features){const id=String(f.id);if(!lineIds.has(id))continue;const shape=path(f.geometry);pieces.push(`<g data-metro-line="${esc(id)}"><path d="${shape}" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="${shape}" fill="none" stroke="${doc.metroLines[id].color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>`);}
  pieces.push('</g><g id="metro-station-points">');
  for(const f of stationCollection.features){if(f.geometry.type!=='Point'||!metroStationVisible(f.properties?.lineIds||[],doc))continue;const [x,y]=p(f.geometry.coordinates);if(x<20||x>960||y<85||y>mapBottom-5)continue;const name=String(f.properties?.name||''),size=10,w=name.length*size*.5,box=[x+5,y-size/2,x+5+w,y+size/2];pieces.push(`<circle data-metro-station="${esc(String(f.id))}" cx="${x}" cy="${y}" r="2.7" fill="white" stroke="#25384b" stroke-width="1.2"/>`);if(doc.names&&!occupied.some(r=>box[0]<r[2]+4&&box[2]>r[0]-4&&box[1]<r[3]+3&&box[3]>r[1]-3)){occupied.push(box);pieces.push(`<text x="${x+5}" y="${y+3}" font-size="10" fill="#25384b" stroke="white" stroke-width="2.8" paint-order="stroke">${esc(name)}</text>`);}}
  pieces.push('</g>');
 }
 const metroKey=metroLines.length?`<g id="metro-line-key" transform="translate(790,90)"><rect x="-10" y="-15" width="205" height="${metroLines.length*17+33}" fill="#fffffff0"/><text font-size="12" font-weight="bold" fill="#18324a">Metro · OSM snapshot</text>${metroLines.map((l,i)=>`<path d="M0 ${14+i*17}H17" stroke="${doc.metroLines[l.id].color}" stroke-width="4"/><text x="24" y="${17+i*17}" font-size="10" fill="#18324a">${esc(l.name)}</text>`).join('')}</g>`:'';
 const lg=doc.legend&&groups.length?`<g transform="translate(${doc.legendX*10},${Math.max(110,Math.min(doc.legendY*8.2,mapBottom-20-groups.length*24))})"><rect x="-12" y="-27" width="238" height="${groups.length*24+55}" fill="#fffffff0"/><text font-size="15" font-weight="bold" fill="#18324a">${esc(doc.legendTitle.slice(0,30))}</text>${groups.map(([k,p],i)=>`<rect x="0" y="${12+i*24}" width="14" height="14" fill="${p.pattern==='solid'?p.color:`url(#p${esc(k)})`}"/><text x="23" y="${24+i*24}" font-size="13" fill="#18324a">${esc((doc.groups[k]||'Group '+(i+1)).slice(0,30))}</text>`).join('')}</g>`:'';
 const metadata={scope:{mode:doc.mapScope,label:scopeLabel(doc),qualification:scopeNotice,bounds:b},sources:{countryCredits:sourceCredits,detailNotice,contextNotice,divisionNotice,overlayNotice,shrineNotice,naturalEarth:'https://www.naturalearthdata.com/about/terms-of-use/',openStreetMap:'https://www.openstreetmap.org/copyright',wikidata:'https://www.wikidata.org/wiki/Wikidata:Licensing',pakistanDivisions:'https://www.pbs.gov.pk/wp-content/uploads/2020/07/List-of-Administrative-Districts-2023.pdf'},overlays:{cityMode:doc.cityMode,cityMinPopulation:doc.cityMinPopulation,cityAutoColors:doc.cityAutoColors,riverColor:doc.riverColor,riverWidth:doc.riverWidth,gurdwaraFilter:doc.gurdwaraFilter,gurdwaraIds:exportedShrines}};
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 820" width="${width}" height="${height}" font-family="Arial,sans-serif"><title>${esc(doc.title)}</title><desc>${esc([scopeNotice,detailNotice,sourceCredits,contextNotice,divisionNotice,overlayNotice,shrineNotice].filter(Boolean).join(' | '))} | Sources and coverage: see repository app/delhi-map-sources.json, app/neighbour-country-sources.json, app/pakistan-division-sources.json and app/gurdwara-sources.json. OpenStreetMap: https://www.openstreetmap.org/copyright; municipal wards: https://bharatlas.com/view/wards_delhi</desc><metadata>${esc(JSON.stringify(metadata))}</metadata><defs>${defs}<clipPath id="extent"><rect x="15" y="80" width="970" height="${mapBottom-80}"/></clipPath></defs><rect width="1000" height="820" fill="${doc.bg}"/><text x="35" y="48" font-size="26" font-weight="bold" fill="#142b44">${esc(doc.title.slice(0,65))}</text><text x="35" y="68" font-size="11" fill="#526477">${esc(scopeLabel(doc))}</text><g clip-path="url(#extent)">${pieces.join('')}</g>${lg}${metroKey}<g id="source-credits"><rect x="0" y="${footerTop-5}" width="1000" height="${825-footerTop}" fill="${doc.bg}"/>${footerLines.map((line,i)=>`<text x="35" y="${footerTop+i*11}" font-size="9" fill="#526477">${esc(line)}</text>`).join('')}</g></svg>`;
 const blob=new Blob([svg],{type:'image/svg+xml'});if(format==='svg'){download(blob,'punjab-regional-map.svg');return}const u=URL.createObjectURL(blob),img=new Image();await new Promise<void>((r,j)=>{img.onload=()=>r();img.onerror=j;img.src=u});const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d')!.drawImage(img,0,0,width,height);URL.revokeObjectURL(u);const png=await new Promise<Blob|null>(r=>canvas.toBlob(r,format==='jpg'?'image/jpeg':'image/png',.95));if(!png)throw Error('Export failed');download(png,'punjab-regional-map.'+format);
}
