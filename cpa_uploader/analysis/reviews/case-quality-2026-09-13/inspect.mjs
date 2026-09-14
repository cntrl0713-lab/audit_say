import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const dir=path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const bankFile='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const catalogFile='cpa_uploader/data/learning-question-classifications.json';
const bank=JSON.parse(fs.readFileSync(bankFile));
const catalog=JSON.parse(fs.readFileSync(catalogFile));
const selected=bank.filter(s=>catalog.classifications.some(c=>c.source_set_id===s.id&&c.question_style==='case'));
if(process.argv.includes('--snapshot')){
  for(const [name,file] of [['bank-before.json',bankFile],['catalog-before.json',catalogFile],['classification-before.json',catalog.review_file]])fs.writeFileSync(path.join(dir,name),fs.readFileSync(file),{flag:'wx'});
  fs.writeFileSync(path.join(dir,'baseline.json'),JSON.stringify({date:'2026-09-13',scope:'Current canonical case learning units; archived drafts are provenance only',bank:{file:bankFile,sha256:createHash('sha256').update(fs.readFileSync(bankFile)).digest('hex')},set_ids:selected.map(s=>s.id),questions:catalog.classifications.filter(c=>c.question_style==='case').map(c=>({set_id:c.source_set_id,subquestion_id:c.subquestion_id}))},null,2)+'\n',{flag:'wx'});
}
const from=Number(process.argv[2])||0,to=Number(process.argv[3])||selected.length;
for(const s of selected.slice(from,to)){
 console.log('\n### '+selected.indexOf(s)+' '+s.id+' '+s.title);
 console.log('FACTS '+JSON.stringify(s.shared_context.facts));
 const qs=s.subquestions.filter(q=>catalog.classifications.some(c=>c.source_set_id===s.id&&c.subquestion_id===q.id&&c.question_style==='case'));
 for(const q of qs){
  console.log('\n'+q.id+' '+q.prompt+'\nANSWER '+q.model_answer.join('\n'));
  for(const c of q.criteria)console.log(c.id+' ['+c.max_points+'] '+c.claim+' | '+c.critical_facts.map(f=>f.expected).filter(t=>t!==c.claim).join('; ')+' SRC '+c.source_ref_ids.join(','));
 }
 const used=new Set(qs.flatMap(q=>q.criteria.flatMap(c=>c.source_ref_ids)));
 if(process.argv.includes('--sources'))for(const ref of s.source_refs.filter(r=>used.has(r.id)))console.log('SOURCE '+ref.id+' '+ref.file+' '+ref.page+' '+ref.source_quote.replace(/\s+/g,' '));
}
