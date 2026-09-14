import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
if(fs.existsSync(path.join(dir,'baseline.json')))throw Error('Implementation baseline already exists; do not overwrite.');
const names={bank:'cpa_uploader/data/cpa_question_sets_v3.authoring.json',catalog:'cpa_uploader/data/learning-question-classifications.json',promotions:'cpa_uploader/data/cpa_question_sets_v3.promotions.json',public:'cpa_uploader/data/cpa_question_sets_v3.public.json'};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const inputs=Object.entries(names).map(([name,file])=>{const bytes=fs.readFileSync(file);fs.writeFileSync(path.join(dir,name+'.snapshot.json'),bytes);return {file,snapshot:name+'.snapshot.json',sha256:sha(bytes)};});
const bank=JSON.parse(fs.readFileSync(names.bank)),catalog=JSON.parse(fs.readFileSync(names.catalog));
const old=JSON.parse(fs.readFileSync(path.join(dir,'../standard-points-2026-09-14/inventory.json')));
const current=new Map(bank.flatMap(s=>s.subquestions.map(q=>[s.id+'/'+q.id,{s,q}])));
const changed=[];
for(const item of old.questions){const now=current.get(item.key);if(!now||JSON.stringify(now.q)!==JSON.stringify(item.question))changed.push(item.key);}
const baseline={created_at:new Date().toISOString(),authorization:'User: 정본·공개본·운영 DB의 물음이나 배점에 모두 반영해줘',inputs,sets:bank.length,questions:current.size,standard_questions:catalog.classifications.filter(c=>c.question_style==='standard').length,changed_reviewed_questions:changed,grading_model:'gpt-5.6-luna',grading_policy:{points_tolerance:1,target_fraction:0.95},budget:{user_specified_amount:null,policy:'No extra semantic API calls; representative grading only; stop on provider limit.'}};
fs.writeFileSync(path.join(dir,'baseline.json'),JSON.stringify(baseline,null,2)+'\n');
console.log(JSON.stringify(baseline,null,2));
