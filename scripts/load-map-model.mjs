import fs from 'node:fs/promises';
import ts from 'typescript';

// Exercise the actual editor model offline, embedding all of its static JSON
// imports. New source manifests therefore do not silently bypass model tests.
export async function loadLocalModule(entry){
 const cache=new Map();
 async function moduleUrl(file){
  if(cache.has(file.href))return cache.get(file.href);
  let source=await fs.readFile(file,'utf8');
  for(const match of source.matchAll(/^import (\w+) from '(\.\/[^']+\.json)';$/gm)){
   const value=JSON.parse(await fs.readFile(new URL(match[2],file),'utf8'));
   source=source.replace(match[0],`const ${match[1]}=${JSON.stringify(value)};`);
  }
  let compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  for(const match of compiled.matchAll(/from ['"](\.\/[^'"]+)['"]/g)){
   const dependency=await moduleUrl(new URL(match[1].endsWith('.ts')?match[1]:match[1]+'.ts',file));
   compiled=compiled.replace(match[0],`from '${dependency}'`);
  }
  const url=`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
  cache.set(file.href,url);return url;
 }
 return import(await moduleUrl(entry));
}
export const loadMapModel=()=>loadLocalModule(new URL('../app/map-model.ts',import.meta.url));
