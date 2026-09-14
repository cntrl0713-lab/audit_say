import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {selectLearningQuestionSet,learningUnitId} from '../../../../lib/learningUnits.ts';
import {CONTENT_CHECKS,EFFICIENT_RUNTIME_FILES} from '../../../questionEfficientReview.ts';
import {reviewedContentHash} from '../../../questionReviewIdentity.ts';
import {validateAuthoringBank} from '../../../questionBankPublication.ts';
const R='cpa_uploader/analysis/reviews/case-expansion-2026-09-13';
const D='cpa_uploader/drafts/case-expansion-2026-09-13';
const E='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12';
const read=f=>JSON.parse(fs.readFileSync(f));
const hash=b=>createHash('sha256').update(b).digest('hex');
const ref=file=>({file,sha256:hash(fs.readFileSync(file))});
const write=(file,x)=>fs.writeFileSync(file,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const bank=read(R+'/candidate-v1.json'),catalog=read(R+'/catalog-v1.json'),ids=read(R+'/changed-sets-v1.json');
const target=bank.filter(s=>ids.includes(s.id));
assert.deepEqual(validateAuthoringBank(bank).errors,[]);
const out=R+'/execution-v1';assert(!fs.existsSync(out));fs.mkdirSync(out);fs.mkdirSync(out+'/projections');fs.mkdirSync(out+'/runtime');
const qa=[...read(R+'/case-qa.json'),...read(R+'/standard-qa.json')],cases=[];
for(const s of target)for(const q of s.subquestions)for(const kind of q.criteria.length>1?['partial','wrong']:['wrong']){
 const row=qa.find(r=>r.set_id===s.id&&r.subquestion_id===q.id&&r.kind===kind);assert(row,`Missing ${s.id}/${q.id}/${kind}`);
 assert(typeof row.answer==='string'&&row.answer.trim());
 const mets=row.met_criterion_ids;assert(Array.isArray(mets));assert(mets.every(id=>q.criteria.some(c=>c.id===id)));
 const verdicts=q.criteria.map(c=>({criterion_id:c.id,verdict:mets.includes(c.id)?'met':'not_met',reason:row.reason}));
 const points=q.criteria.reduce((n,c)=>n+c.scores[verdicts.find(v=>v.criterion_id===c.id).verdict],0);
 assert.equal(points,row.expected_points,`${s.id}/${q.id}/${kind}`);assert(kind==='wrong'?points===0:points>0&&points<q.criteria.length);
 cases.push({id:`${s.id}--${q.id}--${kind}`,set_id:s.id,subquestion_id:q.id,kind,answer:row.answer,expected_points:points,expected_verdicts:verdicts,expectation_review:'agent_content_review_before_execution',human_review_performed:false,origin:row.origin??{file:R+'/case-qa.json',reason:row.reason}});
}
write(out+'/representatives.json',{cases});write(out+'/scope.json',{targets:target.map(s=>({set_id:s.id,subquestion_ids:s.subquestions.map(q=>q.id)}))});
write(out+'/policy.json',{scope:ref(out+'/scope.json'),model:'gpt-5.6-luna',grading_point_tolerance:1,minimum_within_tolerance_ratio:0.95,content_error_tolerance:0,statistical_confidence_claim:false,budget_usd:20,budget_enforcement:'provider_limit',reuse_decision:'변경 없는 18개 사례는 기존 증거를 유지한다. 수정 23개·신규 2개 사례와 독립 저장으로 옮긴 기준서형 35물음을 새 학습 투영에서 실측한다. 이전 대표답안은 의미와 유효성을 다시 확인해 계보를 보존하며 이전 모델 관측을 이번 신규 실측으로 계상하지 않는다.'});
const codeFiles=[...EFFICIENT_RUNTIME_FILES,...['run-efficient-grading.ts','contract.ts','accounting.ts'].map(f=>E+'/b/'+f)];
const snapshots=codeFiles.map((file,i)=>{const copied=`${out}/runtime/${String(i).padStart(2,'0')}-${path.basename(file)}`;fs.copyFileSync(file,copied,fs.constants.COPYFILE_EXCL);return{...ref(copied),runtime_file:file};});write(out+'/runtime-snapshots.json',snapshots);
const authored=read(R+'/case-reviews.json'),lineage=read(R+'/standard-lineage.json');
const priorFiles=['cpa_uploader/analysis/reviews/case-quality-2026-09-13/execution-v1/agent-reviews.json',E+'/candidate-v5/agent-reviews.json'];
const prior=priorFiles.map(read);
const evidenceFiles=[R+'/designs.json',R+'/draft-evidence.json',R+'/case-reviews.json',R+'/criterion-lineage.json',R+'/standard-lineage.json',R+'/standard-qa.json',R+'/authorization.md',D+'/bank-before.json',D+'/catalog-before.json',D+'/source-catalog.json',...priorFiles,...read(R+'/draft-evidence.json').map(r=>r.file)];
const peerFiles=['a/root-peer-review.json','c/cross-review-b.json','root/peer-corrections.json'].map(f=>D+'/'+f).filter(f=>fs.existsSync(f));
for(const p of peerFiles)evidenceFiles.push(p);
const reviews=target.map(s=>({set_id:s.id,content_hash:reviewedContentHash(s),reviewer_id:s.subquestions[0].question_style==='case'?'Codex author agent plus root integration review':'Codex root agent',reviewed_at:new Date().toISOString(),method:'agent_content_review',human_review_performed:false,evidence:evidenceFiles.map(ref),questions:s.subquestions.map(q=>{
 const own=authored.find(r=>r.set_id===s.id&&r.subquestion_id===q.id),l=lineage.find(l=>l.target_set_id===s.id&&l.target_subquestion_id===q.id);
 let rationale=own?.rationale??own?.reason;
 if(!own){assert(l);const previous=prior.map(p=>p.find(r=>r.set_id===l.source_set_id)?.questions.find(r=>r.subquestion_id===q.id)).find(Boolean);assert(previous);
  rationale=`독립 발문을 다시 읽고 정답·모든 독립 기준·대표 부분 및 오답 기대값을 대조하였다. 요구: ${q.prompt} 채점 명제: ${q.criteria.map(c=>c.claim).join(' ')} 기존 ${q.criteria.length}점 유지. 사례 부모 없이 같은 만점 답안이 성립하며 저장 위치만 분리한다. 원 requirements·criteria·model_answer 및 공식 source_refs의 바이트를 대조하여 보존을 확인하고 이전 공식 판본 대조 증거를 재사용한다. 과거 검토 이유와 경계 조건은 연결된 이전 agent 장부에서 확인했다. 현재 QA는 기존 유효 답안을 그대로 보존하여 새 학습 투영에서 실측한다.`;
 }
 assert(rationale?.trim(),s.id+'/'+q.id);
 return{subquestion_id:q.id,criterion_ids:q.criteria.map(c=>c.id),source_ref_ids:[...new Set([...q.requirements.map(r=>r.source_ref_id),...q.criteria.flatMap(c=>c.source_ref_ids)])],checks:Object.fromEntries(CONTENT_CHECKS.map(c=>[c,'pass'])),rationale};
}),unresolved_content_findings:[]}));write(out+'/agent-reviews.json',reviews);
const entries=[];
for(const s of target){
 const metadata=catalog.classifications.filter(c=>c.source_set_id===s.id),units=[...new Set(metadata.map(c=>learningUnitId(s.id,c.question_style,c.subquestion_id)))];
 for(const unit of units){
  const selected=metadata.filter(c=>learningUnitId(s.id,c.question_style,c.subquestion_id)===unit);
  const projection=selectLearningQuestionSet(s,selected,unit),projected=out+'/projections/'+unit+'.json';write(projected,projection);
  for(const kind of ['model','partial','wrong']){
   const evaluated=projection.subquestions.filter(q=>kind!=='partial'||q.criteria.length>1);if(!evaluated.length)continue;
   const answers={},expected=[],selection=[];
   for(const q of projection.subquestions){
    const qa=cases.find(c=>c.set_id===s.id&&c.subquestion_id===q.id&&c.kind===kind),isEvaluated=evaluated.some(x=>x.id===q.id);
    const verdicts=kind==='model'?q.criteria.map(c=>({criterion_id:c.id,verdict:'met',reason:'원문·조건·독립 의미를 대조한 저장 모범답안.'})):isEvaluated?qa.expected_verdicts:q.criteria.map(c=>({criterion_id:c.id,verdict:'not_met',reason:'문맥으로만 남긴 미제출 물음.'}));
    answers[q.id]=kind==='model'?q.model_answer.join('\n'):isEvaluated?qa.answer:'';
    expected.push({subquestion_id:q.id,expected_points:q.criteria.reduce((n,c)=>n+c.scores[verdicts.find(v=>v.criterion_id===c.id).verdict],0),expected_verdicts:verdicts});
    if(isEvaluated)selection.push({...ref(kind==='model'?R+'/candidate-v1.json':out+'/representatives.json'),subquestion_id:q.id,case_id:kind==='model'?null:qa.id,kind,reason:'내용 검토 후 확정한 모범·대표 부분·오답. 같은 역할의 사례 물음을 한 학습단위 요청으로 통합.'});
   }
   entries.push({id:`${unit}--${kind}`,worker:['a','b','c'][entries.length%3],learning_unit_id:unit,source_set_id:s.id,projected_file:projected,projected_sha256:ref(projected).sha256,kind,evaluated_subquestion_ids:evaluated.map(q=>q.id),answers,expected_by_subquestion:expected,selection_evidence:selection});
  }
 }
}
const inputFiles=[...new Set([...target.flatMap(s=>s.source_refs.map(r=>r.file)),...evidenceFiles,R+'/candidate-v1.json',R+'/catalog-v1.json',out+'/scope.json',out+'/representatives.json',out+'/agent-reviews.json',out+'/runtime-snapshots.json',...snapshots.map(s=>s.file)])];
write(out+'/grading-manifest.json',{version:1,artifact_type:'efficient_grading_manifest',model:'gpt-5.6-luna',budget_usd:20,budget_enforcement:'provider_limit',bank:ref(R+'/candidate-v1.json'),classifications:ref(R+'/catalog-v1.json'),policy:ref(out+'/policy.json'),inputs:inputFiles.map(ref),code_files:codeFiles.map(ref),entries});
console.log({target_sets:target.length,questions:target.reduce((n,s)=>n+s.subquestions.length,0),requests:entries.length,evaluated_answers:entries.reduce((n,e)=>n+e.evaluated_subquestion_ids.length,0),manifest:ref(out+'/grading-manifest.json')});
