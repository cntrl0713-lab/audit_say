// Read-only core/bank/ledger comparison. All writes are evidence under c/.
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import {createHash} from 'node:crypto';
import {transformSync} from 'esbuild';
import * as current from '../../../../questionSemanticReview.ts';
import {validatePromotionLedger} from '../../../../questionBankPublication.ts';
import {offlineReviewResult,offlineReviewChunk} from '../../../../../tests/helpers/questionSemanticReviewFixture.ts';
import {OpenAIRequestError} from '../../../../../lib/ai/openaiStructured.ts';

async function main(){
 const b='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
 const read=(f:string)=>JSON.parse(fs.readFileSync(f,'utf8'));
 const hash=(f:string)=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
 const oldFile=b+'/review-request-clarification-v1/questionSemanticReview.ts.before.txt';
 const files=[oldFile,'cpa_uploader/questionSemanticReview.ts',b+'/canonical-before.json','cpa_uploader/data/cpa_question_sets_v3.promotions.json'];
 const input=files.map(file=>({file,sha256:hash(file)}));
 // The exact before source is transpiled and instantiated only in memory. Its
 // relative imports resolve at the original directory. No old core copy is written.
 const ctor=Module as any;
 const memoryModule=new ctor(path.resolve('cpa_uploader/__read_only_semantic_before__.cjs'));
 memoryModule.filename=path.resolve('cpa_uploader/__read_only_semantic_before__.cjs');
 memoryModule.paths=ctor._nodeModulePaths(path.resolve('cpa_uploader'));
 memoryModule._compile(transformSync(fs.readFileSync(oldFile,'utf8'),{loader:'ts',format:'cjs',target:'node22'}).code,memoryModule.filename);
 const before=memoryModule.exports as typeof current;
 const bank=read(b+'/canonical-before.json');
 const changed=new Set(read(b+'/prepared-reviewed-v1/summary.json').canonical.changed_sets);
 const untouched=bank.filter((s:any)=>!changed.has(s.id));
 const ledger=read('cpa_uploader/data/cpa_question_sets_v3.promotions.json');
 const unionImpact=bank.flatMap((s:any)=>s.subquestions.flatMap((q:any)=>{
  const req=q.requirements.map((r:any)=>r.source_ref_id);
  const extra=[...new Set(q.criteria.flatMap((c:any)=>c.source_ref_ids).filter((x:any)=>!req.includes(x)))];
  return extra.length?[{set_id:s.id,subquestion_id:q.id,changed_target:changed.has(s.id),criterion_only_sources:extra}]:[];
 }));
 const historical:any[]=[];
 for(const s of bank){
  const verified=ledger.entries.filter((e:any)=>e.set_id===s.id&&e.to_status==='verified').at(-1);
  if(!verified?.semantic_review)continue;
  const oldErrors=before.validateRecordedSemanticReview(verified.semantic_review,s);
  const newErrors=current.validateRecordedSemanticReview(verified.semantic_review,s);
  historical.push({set_id:s.id,changed_target:changed.has(s.id),receipt_hash:verified.semantic_review.receipt_hash,before_errors:oldErrors,current_errors:newErrors,same_result:JSON.stringify(oldErrors)===JSON.stringify(newErrors)});
 }
 const untouchedLedger=current.validateRecordedSemanticReview; // Deliberately do not synthesize receipts for backfilled entries.
 void untouchedLedger;
 const untouchedLedgerErrors=validatePromotionLedger(untouched,ledger,true);
 const allLedgerErrors=validatePromotionLedger(bank,ledger,true);
 const fixture=structuredClone(bank.find((s:any)=>s.id==='pilot-01-001'));
 fixture.id='semantic-independent-read-only-fixture';fixture.status='needs_review';fixture.verification.review_status='needs_human_review';
 const q=fixture.subquestions[0];const reqs=new Set(q.requirements.map((r:any)=>r.source_ref_id));
 const supplemental=fixture.source_refs.find((r:any)=>!reqs.has(r.id));q.criteria[0].source_ref_ids.push(supplemental.id);
 const opts={bank:[],maxInputChars:500000,apiKey:'offline-no-network',model:'offline-only'};
 const p=current.prepareSemanticReview(fixture,opts),oldp=before.prepareSemanticReview(fixture,opts);
 const unit=p.units.find(u=>u.id===`subquestion:${q.id}`)!;
 const payload=JSON.parse(current.buildReviewChunkInput(p,unit));
 const raw=offlineReviewChunk(offlineReviewResult(p),unit.id);
 const rejected=(fn:()=>unknown)=>{try{fn();return false;}catch{return true;}};
 const mutations={missing_source:structuredClone(raw),duplicated_source_same_length:structuredClone(raw),missing_field:structuredClone(raw),duplicated_field_same_length:structuredClone(raw)};
 mutations.missing_source.source_ref_ids.pop();
 mutations.duplicated_source_same_length.source_ref_ids[mutations.duplicated_source_same_length.source_ref_ids.length-1]=mutations.duplicated_source_same_length.source_ref_ids[0];
 mutations.missing_field.reviewed_field_ids.pop();
 mutations.duplicated_field_same_length.reviewed_field_ids[mutations.duplicated_field_same_length.reviewed_field_ids.length-1]=mutations.duplicated_field_same_length.reviewed_field_ids[0];
 const schemaChecks=Object.fromEntries(Object.entries(mutations).map(([k,v])=>[k,rejected(()=>current.groundReviewChunk(v,p,unit))]));
 const statusEvents:any[]=[];
 for(const status of [401,503]){
  let calls=0;const events:any[]=[];
  try{await current.reviewQuestionDraft(fixture,{...opts,onChunk:e=>events.push(e)},async()=>{calls++;throw new OpenAIRequestError('transport','isolated synthetic error',{status,retryable:status===503});});}catch{}
  statusEvents.push({injected_status:status,callback_calls:calls,events:events.map(e=>({error_code:e.error_code,error_status:e.error_status,error_retryable:e.error_retryable,transport:e.transport,response:e.response??null}))});
 }
 const report={version:1,method:'exact before source instantiated in memory; actual canonical ledger read-only replay; isolated callback-only schema/error probes',api_calls:0,core_or_bank_or_ledger_writes:0,input_files:input,input_files_unchanged:input.every(f=>hash(f.file)===f.sha256),unchanged_canonical_sets:untouched.length,unchanged_canonical_questions:untouched.reduce((n:number,s:any)=>n+s.subquestions.length,0),union_impact:unionImpact,historical_receipts:historical,untouched_ledger_errors:untouchedLedgerErrors,all_original_ledger_errors:allLedgerErrors,synthetic_union:{before_sources:oldp.units.find(u=>u.id===unit.id)!.sources,after_sources:unit.sources,required_input_ids:payload.target_reference_requirements,source_in_reference_catalog:payload.reference_catalog.sources.some((s:any)=>s.id===supplemental.id),complete_chunk_accepted:!rejected(()=>current.groundReviewChunk(raw,p,unit)),invalid_chunks_rejected:schemaChecks},synthetic_error_events:statusEvents};
 const output=b+'/c/semantic-clarification-independent-evidence.json';fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({untouched:untouched.length,untouchedLedgerErrors,allLedgerErrors,historical:historical.map(r=>({set_id:r.set_id,old_errors:r.before_errors.length,new_errors:r.current_errors.length,same:r.same_result})),schemaChecks,statusEvents:statusEvents.map(x=>({status:x.injected_status,calls:x.callback_calls,events:x.events})),output},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
