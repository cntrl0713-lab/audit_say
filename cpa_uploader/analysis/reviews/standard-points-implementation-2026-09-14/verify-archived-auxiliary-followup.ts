import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { QuestionSetV3 } from '../../../../lib/questionV3.ts';
import { createEfficientReviewReceipt, createEfficientValidationContext, assertEfficientEvidenceUnchanged } from '../../../questionEfficientReview.ts';
import type { EfficientReviewReceipt, EfficientReviewBatch, GradingManifest } from '../../../questionEfficientReview.ts';

const R='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14/';
const C='cpa_uploader/analysis/reviews/case-applied-2026-09-14/';
const sha=(bytes: string|Buffer)=>createHash('sha256').update(bytes).digest('hex');
const read=<T>(file:string):T=>JSON.parse(fs.readFileSync(file,'utf8')) as T;
const ref=(file:string)=>({file,sha256:sha(fs.readFileSync(file))});
const bankFile='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const ledgerFile='cpa_uploader/data/cpa_question_sets_v3.promotions.json';
const bank=read<QuestionSetV3[]>(bankFile);
const ledger=read<{entries:{set_id:string;efficient_review?:EfficientReviewReceipt}[]}>(ledgerFile);
const originals=read<QuestionSetV3[]>(R+'coverage-concurrent-sets.snapshot.json');
const receipts=originals.map(s=>{
 const rows=ledger.entries.filter(e=>e.set_id===s.id&&e.efficient_review);
 assert(rows.length); return rows.at(-1)!.efficient_review!;
});
const batchFile=receipts[0].batch;
const batch=read<EfficientReviewBatch>(batchFile.file);
const manifest=read<GradingManifest>(batch.grading_manifest.file);
assert.equal(manifest.reused_observations?.length??0,0,'This check covers the actual original case batch, not an unexamined reuse origin');
const protectedEvidence=[batchFile,batch.grading_manifest,...batch.observations,...batch.runtime_snapshots];
for(const e of protectedEvidence)assert.equal(ref(e.file).sha256,e.sha256);
const gradingFiles=['lib/questionV3Grading.ts','lib/questionV3Evidence.ts','lib/questionV3.ts','lib/questionV3Answer.ts',
 'lib/ai/openaiStructured.ts','lib/learningUnits.ts','lib/learningSubmission.ts','cpa_uploader/questionReviewIdentity.ts'];
const unchangedGradingRuntime=gradingFiles.map(file=>{
 const snapshot=batch.runtime_snapshots.find(s=>s.runtime_file===file);assert(snapshot);
 assert.equal(ref(file).sha256,snapshot.sha256,'Actual grading dependency changed: '+file);
 return{current:ref(file),original:snapshot,identical:true};
});
const oldVerifier=batch.runtime_snapshots.find(s=>s.runtime_file==='cpa_uploader/questionEfficientReview.ts');assert(oldVerifier);
const context=createEfficientValidationContext();
const rows=receipts.map(receipt=>{
 const set=bank.find(s=>s.id===receipt.set_id);assert(set);
 const regenerated=createEfficientReviewReceipt(receipt.batch,set,context,process.cwd(),false);
 assert.deepEqual(regenerated,receipt,'Historical receipt changed');
 return{set_id:set.id,old_receipt_hash:receipt.receipt_hash,reprocessed_receipt_hash:regenerated.receipt_hash,
  identical:true,observed_answers:receipt.observed_answers};
});
assertEfficientEvidenceUnchanged(context);
for(const e of protectedEvidence)assert.equal(ref(e.file).sha256,e.sha256,'Frozen evidence mutated');
const currentDataset='cpa_uploader/analysis/question-elements/question-elements.json';
const rawDataset='cpa_uploader/raw/materials/verification/1f05ad6ee27e403e/question-elements.json';
const before=read<Record<string,unknown>>(rawDataset),after=read<Record<string,unknown>>(currentDataset);
const differingKeys=Object.keys(before).filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k]));
assert.deepEqual(differingKeys,['source_catalog']);
const sourceA=before.source_catalog as Record<string,unknown>,sourceB=after.source_catalog as Record<string,unknown>;
assert.deepEqual(Object.keys(sourceA).filter(k=>sourceA[k]!==sourceB[k]),['fingerprint']);
const result={schema_version:1,reviewed_at:'2026-09-14',status:'pass',reviewer:'agent:/root/review_06_10',
 original_full_test:{...ref(R+'code-checks/tests.log'),tests:592,pass:591,fail:1,
  failure:'questionV3SourceReuse의 단일 valid-bank 검사에서 같은 보조 생성자료 SHA drift를6사례에 보고함. 6개 별도 기능실패가 아니다.'},
 cause:{classification:'historical_auxiliary_generated_view_rebuilt',current:ref(currentDataset),preserved:ref(rawDataset),
  differing_json_paths:['/source_catalog/fingerprint'],original_fingerprint:sourceA.fingerprint,current_fingerprint:sourceB.fingerprint,
  finding:'원발문·요소·빈도·기타 JSON값은 전부 동일하다. 테스트의 실제 작업은 임시 authoring/public 파일이며 원 생성자료를 쓰지 않는다. 해당 test 자체의 변조를 입증할 근거는 없고 현재 파일을 과거 fingerprint로 복구하지 않았다.'},
 acceptance_code:{current:ref('cpa_uploader/questionEfficientReview.ts'),original_snapshot:oldVerifier,
  scope:'새 metadata 수락 경로. original receipt·manifest·runtime snapshot·provider output을 수정하거나 새 model 실행으로 기록하지 않는다.'},
 original_runtime_and_provider_evidence_unchanged:protectedEvidence,
 actual_grading_runtime_unchanged:unchangedGradingRuntime,
 original_batch:batchFile,original_manifest:batch.grading_manifest,original_actual_observations:batch.observations.length,
 reused_origin_count:manifest.reused_observations?.length??0,
 unchanged_receipts:rows,preserved_auxiliary_resolutions:[...(context.preservedAuxiliaryInputs?.values()??[])],
 final_guard:{passed:true,files:context.files.size,scope:'보존raw·수집manifest·원관측·요청·trace등모든읽은증거를 최종 재해시했다.'},
 replay:{actual_model_calls:0,provider_calls_relabelled:0,prompt_schema_result_identity:'기존 createEfficientReviewReceipt의 원요청 재구성·prompt_sha256·schema_hash·raw판정 재처리·결과 동일성 검사를 그대로 통과했다.',
  source_refs_strict:true,primary_inputs_strict:true,new_acceptance_runtime_strict:true},
 followup_tests:[ref(R+'code-checks/source-reuse-followup.log'),ref(R+'code-checks/auxiliary-regression.log')],
 typecheck:{log:ref(R+'code-checks/auxiliary-typecheck.log'),status:'failed_new_unrelated_flat_publication_runtime_copies',
  note:'변경 직후 전체typecheck는exit0이었다. 최종재검사는별도publication-v2/runtime평면복사의상대import결손으로실패하여root가관리한다. runtime원바이트를수정하지 않았다.'},
 limitations:'이 검사는 기존6receipt의 읽기 호환을 확인한다. 새승급은 current code와 frozen code가달라newAcceptance strict가거부하므로root의별도새실행/수락manifest가필요하다. 그실패를우회하거나원code해시를고치지 않았다.'};
fs.writeFileSync(R+'evidence-archive-followup.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,receipts:rows.length,answers:rows.reduce((n,r)=>n+r.observed_answers,0),raw_resolutions:result.preserved_auxiliary_resolutions.length,guarded_files:context.files.size,current_verifier:result.acceptance_code.current.sha256}));
