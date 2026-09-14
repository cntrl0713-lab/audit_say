import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const hash=v=>createHash('sha256').update(v).digest('hex');
const dirs=['cpa_uploader/data','cpa_uploader/drafts'];
const files=[];
function visit(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())visit(f);else if(e.name.endsWith('.json'))files.push(f.replaceAll('\\','/'));}}
dirs.forEach(visit);
const sets=new Map();let parsed=0;const invalid=[];
for(const f of files){let j;try{j=JSON.parse(fs.readFileSync(f,'utf8'));parsed++;}catch{invalid.push(f);continue;}
 const list=Array.isArray(j)?j:Array.isArray(j?.sets)?j.sets:[j];
 for(const s of list){if(!s?.id||!Array.isArray(s.subquestions)||!s.classification||!['10','11','14'].includes(s.classification.topic_id))continue;
 const h=hash(JSON.stringify(s)),key=s.id+':'+h;const old=sets.get(key);if(old){old.files.push(f);continue;}
 sets.set(key,{set_id:s.id,hash:h,files:[f],title:s.title,status:s.status,facts:s.shared_context?.facts??[],subquestions:s.subquestions.map(q=>({id:q.id,prompt:q.prompt,model_answer:q.model_answer,criteria:q.criteria?.map(c=>({id:c.id,claim:c.claim,max_points:c.max_points}))}))});
 }
}
const bank=JSON.parse(fs.readFileSync('cpa_uploader/drafts/case-followup-2026-09-14/bank-before.json','utf8'));const bankIds=new Set(bank.map(s=>s.id));
const out={reviewer:'agent:/root/followup_sources_b',scanned_at:new Date().toISOString(),directories:dirs,json_files:files.length,parsed_json_files:parsed,invalid_json_files:invalid,unique_topic_versions:sets.size,entries:[...sets.values()],nonbank_ids:[...new Set([...sets.values()].filter(s=>!bankIds.has(s.set_id)).map(s=>s.set_id))]};
fs.writeFileSync('cpa_uploader/drafts/case-followup-2026-09-14/b/comparison-inventory.json',JSON.stringify(out,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({files:files.length,versions:sets.size,nonbank:out.nonbank_ids}));
