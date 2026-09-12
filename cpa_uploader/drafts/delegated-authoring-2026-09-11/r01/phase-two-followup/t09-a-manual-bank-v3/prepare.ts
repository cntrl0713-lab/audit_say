// Full local comparison proposal, unsigned template only. No API or manual finalization.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {prepareSemanticReview,createManualReviewTemplate} from '../../../../../../cpa_uploader/questionSemanticReview.ts';
const dir=path.dirname(fileURLToPath(import.meta.url));
const control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const read=(f:string)=>JSON.parse(fs.readFileSync(f,'utf8')),sha=(f:string)=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const ref=(file:string)=>({file,sha256:sha(file)});
const lockFile=control+'/runtime-v5-bank-v3-t11b-plan-01/runtime-lock.json',lock=read(lockFile),manifest=read(lock.manifest_file),entry=manifest.entries.find((e:any)=>e.plan_id==='T09-A');
for(const r of [...lock.code_files,...lock.source_files,lock.comparison_bank,{file:entry.file,sha256:entry.sha256},...entry.plan_files])if(sha(r.file)!==r.sha256)throw Error('Frozen input changed');
const set=read(entry.file),plan=read(entry.plan_files[0].file).plans.find((p:any)=>p.set_id===set.id),bank=read(lock.comparison_bank.file);
const semanticFile=path.join(entry.output_directory,'phase-two-v5',entry.set_id,'semantic-v5-bank-v3-root-01-1/review/semantic.json'),source=read(semanticFile).reviews.find((r:any)=>r.set_id===set.id);
const gradingFile=path.join(entry.output_directory,'phase-two-v5/t09-a/generated-bank-v3-refill02-01/failure-evidence.json'),grading=read(gradingFile);
if(grading.failed.length!==1||grading.failed[0].observations.length!==3)throw Error('Expected one failure with three observations');
const prepared=prepareSemanticReview(set,{bank:[...bank.filter((s:any)=>s.id!==set.id),set],authoringPlan:plan,maxInputChars:500000}),template=createManualReviewTemplate(prepared),review=structuredClone(template);
for(const key of ['content_hash','context_hash','bank_hash'])if((template as any)[key]!==source[key])throw Error('Current template and original model receipt differ');
const olderProofFile=path.join(entry.output_directory,'phase-two-followup/t09-a-manual-v5/full-comparison-and-lineage.json'),older=read(olderProofFile);
if(older.source_files.question.sha256!==sha(entry.file))throw Error('Previously examined question changed');
const rows=bank.flatMap((s:any)=>s.id===set.id?[]:s.subquestions.map((q:any)=>({set_id:s.id,subquestion_id:q.id,prompt:q.prompt,criteria:q.criteria.map((c:any)=>({id:c.id,claim:c.claim}))}))); 
const compared=rows.filter((q:any)=>/재고|실사|계속기록|통제.*설계.*실행|기중.*실증/.test(q.prompt+' '+q.criteria.map((c:any)=>c.claim).join(' ')));
if(compared.length!==14||compared.some((q:any)=>!older.bank_scope.compared_rows.some((p:any)=>JSON.stringify(p)===JSON.stringify(q))))throw Error('Re-read changed relevant peer required');
const sourceEvidence=set.source_refs.map((r:any)=>{const text=fs.readFileSync(r.file,'utf8'),i=text.indexOf(r.source_quote);if(i<0)throw Error('Quote absent');return{...r,file_sha256:sha(r.file),actual_start:text.slice(0,i).split('\n').length,actual_end:text.slice(0,i+r.source_quote.length-1).split('\n').length,declared:set.subquestions.flatMap((q:any)=>q.requirements).filter((x:any)=>x.source_ref_id===r.id).map((x:any)=>x.source_span)};});
const reasons=[
 '실사일11/30와재무제표일12/31 사이 변동의 적절한 기록을 확인하는 추가절차·목적을 모두 제시한다. 날짜 사실을 별도로 득점시키지 않는다.',
 '재고 이동 내역의 기록 반영을 확인하는 추가절차로 501.5의 기간과 목적을 보존한다.',
 '기간을 검토한다는 말만 있고 재고변동의 적절한 기록 여부에 관한 절차·증거 목적이 없어 not_met이다.',
 '이 사례의 두 날짜 사이 변동 기록 확인에 필요한 추가절차를 명시 부정하여 contradicted이다.',
 '실사일과 재무제표일이 같은 가상조건에만 답한다. 원 조건에서 필요한 추가절차를 답하지 않아 not_met이며 원 조건 자체의 반대와 구별한다.',
 '전체 모범답안에 설계 효과성 고려가 있고 target c1을 충족한다.',
 '재고변동 통제의 효과적 설계를 검토한다는 의미가 c1과 같다.',
 '실행·유지의 효과성은 제시하지만 설계는 없어서 c1 not_met이다.',
 '설계 효과성 고려 자체를 명시 부정하여 c1 contradicted이다.',
 '설계 효과성을 고려하는 측면은 정확하여 c1 met이다. 계속기록법에만 적용한다는 범위 오류는 별도 c4 contradicted로 남긴다. 원 모델 expected contra는 다른 명제의 오류를 목표 명제에 전가했다. 원 답안은 바꾸지 않는다.',
 '전체 모범답안이 실행 효과성을 명시하여 c2 met이다.',
 '통제가 실제로 수행되고 효과적으로 운영되는지의 평가는 실행 효과성을 충족한다. 이 표현만으로 유지 기간이나 두 기록방식 적용까지 자동 충족시키지 않는다.',
 '설계·유지 효과성은 있으나 실행 효과성은 없어 c2 not_met이다.',
 '실행 효과성을 고려할 필요가 없다는 명시 반대로 c2 contradicted이다.',
 '실제 실행 여부를 고려하지 않겠다는 말은 c2의 명시 반대여서 expected contradicted 자체는 타당하다. 다만 이 문장은 앞 opposite와 같은 직접 부정형이고 주체·대상·시점·적용조건 또는 증거수준을 바꾼 경계가 아니므로 condition_boundary의 역할 충족은 미확정이다. 반대 답안을 경계로 이름만 바꿔 통과시킬 수 없어 이 사례의 검토는 uncertain으로 남긴다.',
 '전체 모범답안은 유지 효과성 고려를 명시하여 c3 met이다.',
 '재고변동 통제가 계속 유지되고 효과적으로 작동하는지의 검토는 유지 효과성과 동등하다.',
 '설계·실행·양 기록방식의 적용은 제시했으나 유지 효과성은 없어 c3 not_met이다.',
 '유지 효과성은 고려할 필요가 없다고 하여 c3 contradicted이다.',
 '실사일이 재무제표일과 같다는 조건으로 바꾸어 501.5/A9의 다른 날짜 실사에 해당하는 유지를 답하지 않는다. 실제 사례의 다른 날짜 실사에 관한 명시 반대라고 확대하지 않고 c3 not_met을 유지한다.',
 '전체 모범답안에 실사 수량결정과 계속기록법 양쪽 적용을 명시하여 c4 met이다.',
 '실사로 정하든 계속기록법을 쓰든 적용된다는 표현은 양쪽 적용과 동등하다.',
 '세 측면은 적었으나 두 기록방식 적용 범위는 답하지 않아 c4 not_met이다.',
 '계속기록법만 적용하고 실사 수량결정은 제외한다고 하여 c4 contradicted이다.',
 '계속기록법의 적용은 별도 판단해야 한다고 유보하여 양쪽 모두라는 명제를 충족하지 않는다. 명시적 적용 배제와 유보를 구별하여 c4 not_met을 유지한다.'
];
if(source.units.length!==7||source.cases.length!==25||reasons.length!==25)throw Error('Incomplete reviewed shape');
review.units=review.units.map((u:any)=>{const old=older.units.find((x:any)=>x.id===u.id),original=source.units.find((x:any)=>x.id===u.id);if(!old||!original)throw Error('Missing examined unit');return {...u,checks:structuredClone(original.checks),rationale:old.rationale+' 현재 v3 은행의 관련14개 발문/criterion을 다시 추출하여 앞선 직접 대조 대상과 모두 동일함을 확인했다. 현재 공식 파일의 인용 실제 행도 다시 확인했다.',source_quotes:original.source_quotes};});
review.cases=source.cases.map((c:any,i:number)=>({...c,expected:i===9?'met':c.expected,verdict:i===14?'uncertain':'pass',rationale:reasons[i]}));
review.notes=['현재 v3 은행과 7단위·25사례 전체를 직접 대조한 미확정 template 제안이다. 최초 model receipt, 이전 v2 관측/제안 및 새 v3 실제 관측은 보존한다.','원 답안25개와 unit_id/kind는 모두 유지한다. c1 경계 기대만 contra→met 제안이다. c2 경계의 종류 충족이 미확정이라 현재 제안은 전체통과 상태가 아니다.','작성자 에이전트의 원문 대조이며 독립된 사람 검수 또는 새 모델 검수라고 표시하지 않는다. manual-input 확정이나 실제 후속 재채점은 실행하지 않았다.'];
const doc={schema_version:1,reviews:[review]};
fs.writeFileSync(path.join(dir,'manual-template.json'),JSON.stringify({schema_version:1,reviews:[template]},null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(dir,'manual-input-proposal.json'),JSON.stringify(doc,null,2)+'\n',{flag:'wx'});
const proof={recorded_at:new Date().toISOString(),api_calls:0,finalized:false,human_reviewed:false,runtime_lock:ref(lockFile),manifest:ref(lock.manifest_file),question:ref(entry.file),plan:ref(entry.plan_files[0].file),bank:ref(lock.comparison_bank.file),original_model_receipt:ref(semanticFile),actual_generated_grading:ref(gradingFile),older_full_comparison:ref(olderProofFile),current_source_evidence:sourceEvidence,bank_comparison:{sets:bank.length,all_prompt_and_claim_rows_scanned:rows.length,selected_rows:compared.length,all_selected_rows_equal_prior_directly_examined_rows:true,rows:compared},units:review.units,cases:review.cases.map((c:any,i:number)=>({index:i,unit_id:c.unit_id,kind:c.kind,answer:c.answer,answer_unchanged:c.answer===source.cases[i].answer,before:source.cases[i].expected,after:c.expected,verdict:c.verdict,rationale:c.rationale})),unresolved:[{index:14,unit_id:'criterion:q2:q2.c2',issue:'Expected contradicted is correct, but condition_boundary currently repeats an explicit opposite instead of changing a true condition. Original case is preserved; a separately evidenced real boundary followup is still required.'}],model_observations_for_changed_expected:grading.failed[0].observations.map((o:any)=>({file:o.file,line:o.line,matched_before:o.event.matched,score:o.event.result.score})),original_receipts_and_bank_unchanged:true};
fs.writeFileSync(path.join(dir,'full-comparison-and-lineage.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({units:7,cases:25,original_answers_preserved:true,expected_changes:1,unresolved_case_kind:1,finalized:false,api_calls:0}));
