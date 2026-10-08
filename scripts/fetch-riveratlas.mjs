// Fetch just Asia and Europe/Middle East from the official CC BY 4.0 archive.
// Range requests avoid downloading the 2.4 GB global archive. Large DBFs are
// reduced while streaming; only the source fields used by this map are kept.
import fs from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createInflateRaw} from 'node:zlib';
const url='https://ndownloader.figshare.com/files/20087486';
await fs.mkdir('work/riveratlas',{recursive:true});
async function range(start,end){const r=await fetch(url,{headers:{Range:`bytes=${start}-${end}`}});if(r.status!==206)throw Error('Range download failed: '+r.status);return r;}
const tail=Buffer.from(await (await range('',65536)).arrayBuffer());
const entries=[];
for(let i=0;i<tail.length-46;i++){
 if(tail.readUInt32LE(i)!==0x02014b50)continue;
 const nl=tail.readUInt16LE(i+28),el=tail.readUInt16LE(i+30),cl=tail.readUInt16LE(i+32),name=tail.subarray(i+46,i+46+nl).toString();
 if(/RiverATLAS_v10_(as|eu)\.(shp|dbf)$/.test(name))entries.push({name,size:tail.readUInt32LE(i+20),offset:tail.readUInt32LE(i+42)});
 i+=45+nl+el+cl;
}
function attributes(){
 let bytes=Buffer.alloc(0),header=0,length=0,fields=[],count=0,expected=0;
 return new Transform({transform(chunk,_,done){try{
  bytes=Buffer.concat([bytes,chunk]);
  if(!header){if(bytes.length<32)return done();header=bytes.readUInt16LE(8);length=bytes.readUInt16LE(10);expected=bytes.readUInt32LE(4);}
  if(!fields.length){if(bytes.length<header)return done();let offset=1;for(let p=32;p<header-1;p+=32){fields.push({name:bytes.subarray(p,p+11).toString().replace(/\0.*/,''),size:bytes[p+16],offset});offset+=bytes[p+16];}bytes=bytes.subarray(header);}
  const rows=Math.min(Math.floor(bytes.length/length),expected-count),out=Buffer.alloc(rows*16);
  for(let i=0;i<rows;i++){const get=name=>{const f=fields.find(f=>f.name.toUpperCase()===name);if(!f)throw Error('Missing '+name);return Number(bytes.subarray(i*length+f.offset,i*length+f.offset+f.size).toString());};out.writeUInt32LE(get('HYRIV_ID'),i*16);out.writeUInt32LE(get('ORD_STRA'),i*16+4);out.writeFloatLE(get('DIS_AV_CMS'),i*16+8);out.writeFloatLE(get('UPLAND_SKM'),i*16+12);}
  count+=rows;bytes=bytes.subarray(rows*length);if(out.length)this.push(out);done();
 }catch(e){done(e);}},flush(done){done(count===expected?undefined:Error('Incomplete source attribute records'));}});
}
// Two downloads at a time, with bounded buffers.
for(let i=0;i<entries.length;i+=2)await Promise.all(entries.slice(i,i+2).map(async e=>{
 const filename='work/riveratlas/'+e.name.split('/').at(-1).replace('.dbf','.attrs');
 try{await fs.access(filename);console.log('Cached',filename);return;}catch{}
 const head=Buffer.from(await (await range(e.offset,e.offset+511)).arrayBuffer());
 const begin=e.offset+30+head.readUInt16LE(26)+head.readUInt16LE(28);
 const response=await range(begin,begin+e.size-1),stages=[Readable.fromWeb(response.body),createInflateRaw()];
 if(e.name.endsWith('.dbf'))stages.push(attributes());
 stages.push(createWriteStream(filename+'.partial'));
 await pipeline(stages);await fs.rename(filename+'.partial',filename);console.log('Fetched',filename);
}));
