import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise actual TS modules with shared instances and installed dependencies.
// This avoids recursively expanding the large catalog into nested data URLs.
export async function loadLocalModule(entry){
 const cache=new Map();
 function load(file){
  if(cache.has(file))return cache.get(file).exports;
  if(file.endsWith('.json')){const value=JSON.parse(fs.readFileSync(file,'utf8'));cache.set(file,{exports:value});return value;}
  const module={exports:{}};cache.set(file,module);
  const nativeRequire=createRequire(file);
  const require=id=>{
   if(!id.startsWith('.'))return nativeRequire(id);
   const base=path.resolve(path.dirname(file),id),target=path.extname(base)?base:base+'.ts';
   return load(target);
  };
  const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  vm.runInThisContext('(function(require,module,exports){'+source+'\n})',{filename:file})(require,module,module.exports);
  return module.exports;
 }
 return load(fileURLToPath(entry));
}
export const loadMapModel=()=>loadLocalModule(new URL('../app/map-model.ts',import.meta.url));
