import fs from 'node:fs';
import {createHash} from 'node:crypto';
const D='cpa_uploader/analysis/reviews/case-quality-2026-09-13/';
const bank=JSON.parse(fs.readFileSync(D+'bank-before.json'));
const catalog=JSON.parse(fs.readFileSync(D+'catalog-before.json')).classifications;
const sourceMap=new Map();const sha=b=>createHash('sha256').update(b).digest('hex');
for(const s of bank)for(const q of s.subquestions){
 if(!catalog.some(c=>c.source_set_id===s.id&&c.subquestion_id===q.id&&c.question_style==='case'))continue;
 for(const id of new Set([...q.requirements.map(r=>r.source_ref_id),...q.criteria.flatMap(c=>c.source_ref_ids)])){
  const r=s.source_refs.find(r=>r.id===id),key=r.file+sha(r.source_quote),bytes=fs.readFileSync(r.file),body=bytes.toString('utf8');
  const at=body.indexOf(r.source_quote);if(at<0)throw Error('Missing exact source '+s.id+'/'+id);
  if(!sourceMap.has(key))sourceMap.set(key,{file:r.file,file_sha256:sha(bytes),quote_sha256:sha(r.source_quote),page:r.page,title:r.title,line:body.slice(0,at).split('\n').length,quote:body.slice(at,at+r.source_quote.length),provenance_header:body.slice(0,Math.min(body.indexOf('# KGA')>0?body.indexOf('# KGA'):700,1800)),users:[]});
  sourceMap.get(key).users.push(s.id+'/'+q.id+'/'+id);
 }
}
const sources=[...sourceMap.values()];fs.writeFileSync(D+'source-evidence-v1.json',JSON.stringify(sources,null,2)+'\n');
const a=Number(process.argv[2]??0),b=Number(process.argv[3]??sources.length);
console.log('Total unique exact source passages: '+sources.length);
for(let i=a;i<Math.min(b,sources.length);i++)console.log('\n'+i+' '+sources[i].page+' '+sources[i].users.join(' ')+'\n'+sources[i].quote.replace(/\s+/g,' '));
