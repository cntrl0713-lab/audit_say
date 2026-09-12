import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const directory=`${control}/point-policy-implementation-v1`;
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifestFile=`${control}/final-153-v3/manifest-plan-followup-02.json`;
const overlayFile=`${control}/active-qa-overrides-v3-plan-followup-02.json`;
const lockFile=`${control}/runtime-v5-bank-v3-plan-followup-02/runtime-lock.json`;
const manifest=read(manifestFile),overlay=read(overlayFile),lock=read(lockFile);
const identities=[...lock.code_files,...lock.source_files,...lock.protected_files,lock.comparison_bank,
 ...manifest.entries.flatMap(entry=>[{file:entry.file,sha256:entry.sha256},{file:entry.qa_file,sha256:entry.qa_sha256},...entry.plan_files]),
 ...overlay.overrides.map(item=>item.identity)];
for(const item of identities)if(hash(item.file)!==item.sha256)throw Error(`Prior bytes changed: ${item.file}`);
const files=new Map(identities.map(item=>[item.file,item.sha256]));
for(const file of [manifestFile,overlayFile,lockFile])files.set(file,hash(file));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(item=>item.isDirectory()
 ? item.name==='point-policy-v1'?[]:walk(path.join(dir,item.name)):[path.join(dir,item.name)]);
for(const file of walk('cpa_uploader/drafts/delegated-authoring-2026-09-11'))files.set(file.replaceAll('\\','/'),hash(file));
const output=`${directory}/baseline.json`;
fs.writeFileSync(output,JSON.stringify({created_at:new Date().toISOString(),manifest_file:manifestFile,qa_overlay_file:overlayFile,
 api_calls:0,points:433,sets:49,subquestions:131,files:[...files].map(([file,sha256])=>({file,sha256}))},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,protected_files:files.size,prior_manifest_and_runtime_unchanged:true,api_calls:0}));
