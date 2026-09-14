import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const R='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14/';
const ref=file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const get=name=>fs.readFileSync(R+'code-checks/'+name,'utf8');
assert.match(get('auxiliary-regression.log'),/pass 2/u);
assert.match(get('source-reuse-followup.log'),/pass 1/u);
assert.match(get('efficient-review-followup.log'),/pass 59/u);
assert.equal(get('auxiliary-typecheck-followup.log').trim(),'');
const receipt=JSON.parse(fs.readFileSync(R+'evidence-archive-followup.json','utf8'));
assert.equal(ref('cpa_uploader/questionEfficientReview.ts').sha256,receipt.acceptance_code.current.sha256);
assert(receipt.unchanged_receipts.length===6&&receipt.unchanged_receipts.every(r=>r.identical));
const result={schema_version:1,reviewed_at:'2026-09-14',status:'pass',
 code:ref('cpa_uploader/questionEfficientReview.ts'),
 prior_evidence:ref(R+'evidence-archive-followup.json'),
 tests:[['auxiliary-regression.log',2],['source-reuse-followup.log',1],['efficient-review-followup.log',59]].map(([name,count])=>({log:ref(R+'code-checks/'+name),pass:count,fail:0})),
 typecheck:{status:'pass',exit_code:0,log:ref(R+'code-checks/auxiliary-typecheck-followup.log'),
  prior_failure:ref(R+'code-checks/auxiliary-typecheck.log'),
  resolution:'root가 tsconfig에서 기존 execution runtime 제외와 같은 방식으로 publication-*/runtime/** 보존코드를 제외했다. 평면보존 코드의바이트·경로를 바꾸지 않았다.'},
 preserved:{original_tests:ref(R+'code-checks/tests.log'),original_full_result:{pass:591,fail:1},
  receipts_unchanged:6,reprocessed_answers:54,original_provider_observations:18,actual_new_model_calls:0,
  all_evidence_final_guard_files:receipt.final_guard.files},
 procedure:ref('.agents/skills/audit-question-review/references/cost-controlled-verification.md'),
 limitations:'전체suite를재반복한결과가아니다. 원591통과/1실패를보존하고변경한수락경로의62개표적회귀와타입검사를수행했다. 새승급시code일치검사는유지하며별도새수락batch를root가작성한다.'};
fs.writeFileSync(R+'evidence-archive-followup-resolution.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,targeted_tests:62,typecheck:'pass',unchanged_receipts:6,code_sha256:result.code.sha256}));
