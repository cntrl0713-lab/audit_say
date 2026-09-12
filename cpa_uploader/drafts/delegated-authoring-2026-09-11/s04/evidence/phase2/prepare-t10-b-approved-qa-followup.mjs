import fs from 'node:fs';
import crypto from 'node:crypto';
const base='cpa_uploader/drafts/delegated-authoring-2026-09-11/s04',out=base+'/phase-two-followup/t10-b-qa-v2';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const original=base+'/qa-cases-t10-b.json',qa=read(original),before=structuredClone(qa);
const c=qa.cases.find(c=>c.id==='sub1-numbers-only');c.expected_points=2;c.kind='paraphrase';for(const v of c.expected_verdicts){v.verdict='met';v.reason='세부테스트의 현 문맥에서 제2종은 부당수용, 제1종은 부당기각으로 실제 기출해설과 연습 자료에 대응하며 발문은 동등한 분류 표현을 허용한다.';}
c.note='원답안과 ID 보존. 2026-09-11 총괄이 실제 발문·기출해설427쪽·연습649쪽을 독립 대조하여 QA-only 정정 승인. 기존 번호 명칭을 정답에서 배제한 기대0점은 후속2점으로 정정하며 원기대를 별도 보존한다. 학습자료 간 재수록을 독립 출제 빈도로 합산하지 않는다.';
if(qa.cases.length!==51||qa.cases.some((c,i)=>c.id!==before.cases[i].id||c.answer!==before.cases[i].answer))throw Error('Case or answer changed');
fs.mkdirSync(out,{recursive:true});fs.copyFileSync(original,out+'/qa-cases-t10-b.original.json',fs.constants.COPYFILE_EXCL);
const qaFile=out+'/qa-cases-t10-b.followup-01.json';fs.writeFileSync(qaFile,JSON.stringify(qa,null,2)+'\n',{flag:'wx'});
const supplement={version:1,artifact_type:'author_expected_judgments',set_id:'pilot-10-006',cases:[
 {id:'sub1-type-number-reversed',subquestion_id:'sub1',kind:'opposite',answer:'A는 제1종, B는 제2종이다.',expected_points:0,expected_verdicts:['crit1','crit2'].map(criterion_id=>({criterion_id,verdict:'contradicted',reason:'동일한 세부테스트 문맥의 두 표본위험 분류를 반대로 답했다.'})),note:'총괄 승인 번호분류 정정의 실제 역전 대조군. 번호를 배제하지 않으면서 그 반대 의미는 구별한다.'},
 {id:'sub1-conventional-risk-names',subquestion_id:'sub1',kind:'paraphrase',answer:'A는 부당수용위험, B는 부당기각위험이다.',expected_points:2,expected_verdicts:['crit1','crit2'].map(criterion_id=>({criterion_id,verdict:'met',reason:'각 상황의 표본위험을 올바른 명칭으로 분류했다.'})),note:'총괄 승인 후속의 정상 명칭 대조군. 주어진 사실만 반복한 답과 구별한다.'}
]};
fs.writeFileSync(out+'/qa-supplement-t10-b-number-classification.json',JSON.stringify(supplement,null,2)+'\n',{flag:'wx'});
const run=base+'/evidence/phase2/phase-two-v5-bank-v3-after-refill-01-owned/pilot-10-006/author-qa-run1',inputs=read(run+'/inputs.json');
const identities=Object.entries(inputs.hashes).map(([file,sha256])=>({file,sha256,current_sha256:hash(file)}));if(identities.some(v=>v.sha256!==v.current_sha256))throw Error('Same grading identity failed');
const records=fs.readdirSync(run).filter(f=>/^case-\d+-attempt-\d+\.json$/.test(f)).map(f=>({file:run+'/'+f,value:read(run+'/'+f)})).filter(r=>r.value.case_id===c.id&&!r.value.error);
if(records.length!==3)throw Error('Expected3 original valid observations');
const lineage={created_at:new Date().toISOString(),authority:'Parent /root approved QA-only correction after independent reading of actual prompt, criteria, A/B facts and original sources.',original_QA:{file:original,sha256:hash(original)},followup_QA:{file:qaFile,sha256:hash(qaFile),required_cases:51},before:before.cases.find(x=>x.id===c.id),after:c,all_original_answers_preserved:true,question_mutations:0,new_API_calls:0,current_identity_checks:identities,observations:records.map(({file,value:r})=>({file,sha256:hash(file),model:r.model,transport:r.transport,request_hash:r.request_hash,schema_hash:r.schema_hash,score:r.result.score,original_recorded_match:r.matched,current_expected_match:r.result.score===2&&r.result.subquestions.find(q=>q.subquestion_id==='sub1').criteria.every(c=>c.verdict==='met'),note:'Read-only comparison against approved expected values. Actual model observation reused, not a new grading execution.'})),supplement:{file:out+'/qa-supplement-t10-b-number-classification.json',cases:2,status:'prepared_not_executed'}};
fs.writeFileSync(out+'/lineage-diff-and-observations.json',JSON.stringify(lineage,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qa_file:qaFile,sha256:hash(qaFile),cases:51,existing_observations:3,current_match:lineage.observations.every(r=>r.current_expected_match),supplement:supplement.cases.map(c=>c.id)}));
