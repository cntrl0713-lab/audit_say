import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const fileRef=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});

export function partitionSourceInventory(paths,materialsRoot='cpa_uploader/raw/materials'){
 const root=path.resolve(materialsRoot),byIdentity=new Map();
 for(const file of paths){
  assert(typeof file==='string'&&file.trim());assert(fs.statSync(file).isFile(),'Source must be an existing file: '+file);
  const real=fs.realpathSync(file);if(!byIdentity.has(real))byIdentity.set(real,file);
 }
 const entries=[],excluded=[];
 for(const [resolved,file]of [...byIdentity.entries()].sort((a,b)=>a[1].localeCompare(b[1]))){
  const relative=path.relative(root,resolved),archived=relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));
  const identity=fileRef(file);
  if(archived)excluded.push({...identity,reason:'Already preserved under raw/materials. Bind this exact file and its render/extraction provenance in the root source-evidence plan; do not recollect it.'});
  else entries.push({original_path:file,sha256:identity.sha256,category:file.replaceAll('\\','/').includes('/data/official/')?'official':file.includes('회계감사_통합학습자료')?'learning':'verification',role:'신규 세 사례의 공식 근거·기출·연습 원문과 판본·추출·시각대조 계보 보존'});
 }
 return {entries,excluded};
}
