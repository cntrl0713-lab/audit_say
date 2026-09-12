import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const base=path.resolve('cpa_uploader/drafts/delegated-authoring-2026-09-11/n04'),dest=path.join(base,'metadata-followup');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const manifest=read(path.join(dest,'preservation-manifest.json')),lineage=read(path.join(base,'lineage.json')),errors=[];
for(const e of manifest.files)if(sha(e.preserved_file)!==e.sha256)errors.push('Preserved bytes changed '+e.original_file);
const diffs=(a,b,p='')=>{if(JSON.stringify(a)===JSON.stringify(b))return [];if(!a||!b||typeof a!=='object'||typeof b!=='object')return [{path:p,before:a,after:b}];return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>diffs(a[k],b[k],p?p+'.'+k:k));};
const changes=[];
for(const e of lineage.sets){
 const name=path.basename(e.actual_file),previous=path.join(dest,'prior-part4',name+'.txt'),delta=diffs(read(previous),read(e.actual_file));
 if(e.set_id==='pilot-13-009'){if(JSON.stringify(delta)!==JSON.stringify([{path:'classification.part',before:'PART4',after:'PART3'}]))errors.push('Unexpected semantic or metadata change');}else if(delta.length)errors.push('Unexpected other candidate change '+e.set_id);
 const oldQa=path.join(dest,'prior-part4',path.basename(e.qa_file)+'.txt'),qaDelta=diffs(read(oldQa),read(e.qa_file));
 if(qaDelta.some(x=>x.path!=='draft_sha256'))errors.push('Unexpected QA case change');
 const oldPlan=path.join(dest,'prior-part4',path.basename(e.plan_file)+'.txt');if(sha(oldPlan)!==sha(e.plan_file))errors.push('Unexpected plan change');
 changes.push({set_id:e.set_id,previous_sha256:sha(previous),current_sha256:sha(e.actual_file),differences:delta,qa_differences:qaDelta,qa_sha256:sha(e.qa_file),plan_unchanged:true,plan_sha256:sha(e.plan_file)});
}
const evidence=[];
for(const name of ['static-check.json','cli-validation.json','inventory-and-relations-check.json','execution-inputs.json','handoff-check.json']){const input=path.join(base,name),output=path.join(dest,'after-'+name);fs.copyFileSync(input,output);evidence.push({file:path.relative(process.cwd(),output).replaceAll('\\','/'),sha256:sha(output)});}
const result={recorded_at:new Date().toISOString(),stage:'draft_ready',change:'N04/T13-A 분류 part를 주제13 정본과 동일한 PART3으로 수정',preserved_files:manifest.files.length,sets:3,questions:9,points:53,qa_cases:214,source_and_question_text_unchanged:true,models_called:0,changes,evidence,errors};
fs.writeFileSync(path.join(dest,'result.json'),JSON.stringify(result,null,2)+'\n');
if(errors.length)throw Error(errors.join('\n'));
console.log(JSON.stringify({errors,changes:changes.map(c=>({set_id:c.set_id,differences:c.differences,sha256:c.current_sha256})),preserved_files:manifest.files.length}));
