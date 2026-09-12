import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import {buildSourceCatalog} from '../../../questionSourceCatalog.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url)),root=process.cwd(),errors:string[]=[];let links=0;
const read=(f:string)=>JSON.parse(fs.readFileSync(f,'utf8'));const hash=(f:string)=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.md'))){
 const body=fs.readFileSync(path.join(dir,f),'utf8');
 for(const m of body.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)){
  const target=m[1].replace(/^<|>$/g,'').split('#')[0];if(!target||/^https?:/.test(target))continue;links++;
  if(!fs.existsSync(path.resolve(dir,decodeURIComponent(target))))errors.push(`${f}: missing ${target}`);
 }
}
const handoff=read(path.join(dir,'handoff.json'));for(const row of handoff.outputs){
 for(const [fileKey,hashKey] of [['file','draft_sha256'],['authoring_plan_file','authoring_plan_sha256'],['qa_file','qa_sha256']])if(hash(path.resolve(root,row[fileKey]))!==row[hashKey])errors.push(`${row.set_id}: hash mismatch ${fileKey}`);
 const qa=read(path.resolve(root,row.qa_file));if(qa.draft_sha256!==row.draft_sha256)errors.push(`${row.set_id}: QA version mismatch`);
}
for(const a of handoff.artifacts)if(hash(path.resolve(root,a.file))!==a.sha256)errors.push(`artifact hash ${a.file}`);
const catalog=buildSourceCatalog({repoDir:root});const valid=new Set(catalog.units.map(u=>u.id));const freq=read(path.join(dir,'frequency-evidence.json'));const elementIds=new Set(freq.elements.map((e:any)=>e.id));
const rels=read(path.join(dir,'coverage-proposal.json')).relationships;
for(const r of rels){
 if(!elementIds.has(r.element_id))errors.push(`element ${r.element_id}`);for(const id of r.source_unit_ids)if(!valid.has(id))errors.push(`source ${id}`);
 const set=read(path.resolve(root,r.target.file));const sub=set.subquestions.find((q:any)=>q.id===r.target.subquestion_id);if(set.id!==r.target.set_id||!sub)errors.push(`target ${r.target.set_id}`);
 for(const id of r.target.criterion_ids)if(!sub?.criteria.some((c:any)=>c.id===id))errors.push(`criterion ${id}`);
}
const report={artifact_type:'s06_artifact_integrity',version:1,performed_at:new Date().toISOString(),links,coverage_relationships:rels.length,errors,status:errors.length?'fail':'pass',model_calls:0};
fs.writeFileSync(path.join(dir,'artifact-integrity-check.json'),JSON.stringify(report,null,2)+'\n');console.log(report);if(errors.length)process.exitCode=1;
