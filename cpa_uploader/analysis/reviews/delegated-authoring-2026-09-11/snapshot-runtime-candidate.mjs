import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const label=process.argv[2];
if(!label||!/^[a-z0-9-]+$/.test(label))throw Error('새 후보 이름 필요');
const directory=path.join(root,label);
if(fs.existsSync(directory))throw Error('기존 런타임 후보를 덮어쓰지 않습니다.');
const prior=JSON.parse(fs.readFileSync(path.join(root,'runtime-v2-policy/runtime-lock.json'),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const extras=['resume-semantic.ts','run-generated-qa.ts','diagnose-review-unit.ts','freeze-runtime.ts'];
const files=[...new Set([...prior.code_files.map(row=>row.file),...extras.map(file=>path.join(root,file).replaceAll('\\','/'))])];
const snapshots=files.map(file=>({file,bytes:fs.readFileSync(file)}));
fs.mkdirSync(directory,{recursive:true});
for(const row of snapshots){
 const target=path.join(directory,'code',row.file+'.txt');
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(target,row.bytes,{flag:'wx'});
}
const result={created_at:new Date().toISOString(),purpose:'candidate_not_authorized_as_final_runtime_until_coordination_complete',
 files:snapshots.map(row=>({file:row.file,sha256:sha(row.bytes),snapshot:path.join(directory,'code',row.file+'.txt').replaceAll('\\','/'),
  previous_sha256:prior.code_files.find(file=>file.file===row.file)?.sha256||null})),
 changed_during_copy:snapshots.filter(row=>sha(fs.readFileSync(row.file))!==sha(row.bytes)).map(row=>row.file),api_calls:0};
fs.writeFileSync(path.join(directory,'snapshot.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({directory,files:result.files.length,changed_during_copy:result.changed_during_copy}));
if(result.changed_during_copy.length)process.exitCode=1;
