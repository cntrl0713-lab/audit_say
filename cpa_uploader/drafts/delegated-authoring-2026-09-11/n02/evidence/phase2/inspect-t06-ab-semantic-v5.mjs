import fs from 'node:fs';
import crypto from 'node:crypto';
const base='cpa_uploader/drafts/delegated-authoring-2026-09-11/n02';
const control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const manifest=read(`${control}/final-153-v3/manifest.json`);
const comparisonFile=`${control}/final-153-v3/comparison-bank.json`;
const bank=read(comparisonFile);
const sets=Array.isArray(bank)?bank:bank.question_sets;
const rows=[];
for(const [setId,run] of [['pilot-06-006','semantic-v5-bank-v3-after-refill-root-01-2'],['pilot-06-007','semantic-v5-bank-v3-after-refill-root-01-1']]){
 const file=`${base}/phase-two-v5/${setId}/${run}/review/semantic.json`;
 const review=read(file).reviews[0];
 const inputFile=`${base}/${setId}.json`,raw=read(inputFile),question=Array.isArray(raw)?raw[0]:raw;
 const planFile=`${base}/${setId}.authoring-plan.json`;
 rows.push({set_id:setId,receipt_file:file,receipt_file_sha256:hash(fs.readFileSync(file)),receipt_verdict:review.verdict,nonpass:review.units.filter(u=>Object.values(u.checks).some(v=>v!=='pass')).map(u=>({id:u.id,checks:u.checks,rationale:u.rationale})),question_file:inputFile,question_file_sha256:hash(fs.readFileSync(inputFile)),question,plan_file:planFile,plan_file_sha256:hash(fs.readFileSync(planFile)),plan:read(planFile),source_quote_checks:question.source_refs.map(r=>{const body=fs.readFileSync(r.file,'utf8');return{id:r.id,file:r.file,file_sha256:hash(body),source_span:r.source_span,quote_exact_match:body.includes(r.source_quote),quote_hash_matches:hash(r.source_quote)===r.content_hash};})});
}
const result={created_at:new Date().toISOString(),mode:'local_read_only_reasoned_investigation',new_api_calls:0,input_mutations:0,predecessor_note:'The first local evidence read manifest.bank_file, which is the original 104-set authoring bank. This successor explicitly reads the 153-set comparison bank; original evidence is preserved.',manifest_file:`${control}/final-153-v3/manifest.json`,manifest_sha256:hash(fs.readFileSync(`${control}/final-153-v3/manifest.json`)),bank_file:comparisonFile,bank_sha256:hash(fs.readFileSync(comparisonFile)),comparison_set_count:sets.length,inputs:rows,comparison:sets.filter(s=>['pilot-06-003','pilot-06-006','pilot-06-007'].includes(s.id)).map(s=>({id:s.id,shared_context:s.shared_context,subquestions:s.subquestions.map(q=>({id:q.id,prompt:q.prompt,model_answer:q.model_answer,criteria:q.criteria}))}))};
const out=`${base}/evidence/phase2/t06-ab-semantic-v5-local-evidence-v2.json`;
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({out,sets:rows.map(r=>({id:r.set_id,nonpass:r.nonpass,source_checks:r.source_quote_checks.every(c=>c.quote_exact_match&&c.quote_hash_matches)})),peers:result.comparison.map(s=>s.id)},null,2));
