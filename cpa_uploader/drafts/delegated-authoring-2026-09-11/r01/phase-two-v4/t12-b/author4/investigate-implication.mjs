import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const directory=path.dirname(fileURLToPath(import.meta.url));
const root='cpa_uploader/drafts/delegated-authoring-2026-09-11/r01/';
const file=root+'draft-12-570-freq01.json';
const qa=root+'qa-cases-t12-b.json';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const set=read(file), summary=read(path.join(directory,'author-qa/summary.json'));
const judgments={
 'q1/omit-1':{target:['q1.c1'],classification:'model_interpretation_variation',expected_points:5,reason:'다른 의견변형 사유가 없다는 f2에서 해당 사항으로 의견이 변형되지 않음을 명시한다는 답안은 적정의견을 함축한다. q1.c1.scope가 이 표현을 명시적으로 인정한다. 별도 단락의 기재 내용은 q1.c5, 의견 종류는 q1.c1이라는 서로 다른 평가 대상이며 하나의 문장이 두 대상을 충족할 수 있다.'},
 'q2/omit-1':{target:['q2.c1'],classification:'model_interpretation_failure_repeated_three_times',expected_points:3,reason:'한정의견근거 또는 부적정의견근거 단락을 사용한다는 실제 답안은 요구된 두 의견의 범위를 직접 명명한다. q2.c1.scope는 두 의견근거 단락으로 두 유형을 함축하는 답안을 허용한다. 중요성·전반성 기준이나 의견 표명 동사의 별도 반복은 발문과 계약의 추가 요건이 아니다.'},
 'q1/paragraph-implies-opinion':{target:['q1.c1','q1.c2'],classification:'model_interpretation_variation',expected_points:3,reason:'계속기업 관련 중요한 불확실성 단락에 특정 내용을 명시한다는 문장은 그 이름의 단락을 사용한다는 기재 요구를 충족한다(q1.c2). 의견 비변형의 기재는 f2의 다른 변형사유 없음과 결합하여 적정의견도 함축한다(q1.c1.scope). 불확실성 존재 설명과 주석 환기는 없으므로 c3/c4는 미충족이고 기재 내용 c5만 추가 충족한다.'}
};
const cases=summary.mismatched_case_ids.map(id=>{
 const records=summary.records.filter(r=>r.case_id===id).map(r=>{const p=path.join(directory,'author-qa',r.file);const o=read(p);return{file:p.replaceAll('\\','/'),sha256:hash(p),attempt:o.attempt,model:o.model,transport:o.transport,request_hash:o.request_hash,schema_hash:o.schema_hash,expected_points:o.expected.expected_points,score:o.result.score,matched:o.matched,judgments:o.raw_judgment.subquestions.find(s=>s.subquestion_id===o.expected.subquestion_id).verdicts,security_flag:o.result.security_flag,error:o.error??null};});
 const first=read(records[0].file), sub=set.subquestions.find(s=>s.id===first.expected.subquestion_id);
 return{id,expected:first.expected,prompt:sub.prompt,criteria:sub.criteria,requirements:sub.requirements,analysis:judgments[id],observations:records,repeat_count:records.length,unique_request_hashes:[...new Set(records.map(r=>r.request_hash))],unique_schema_hashes:[...new Set(records.map(r=>r.schema_hash))]};
});
const controls=['q1/model','q2/model','q1/opinion-only','q1/true-omission-opinion-and-nonmodification','q2/true-omission-opinion-types','q1/opposite','q2/opposite','q1/root-single-sentence','q2/root-single-sentence'].map(id=>{const r=summary.records.find(r=>r.case_id===id);const p=path.join(directory,'author-qa',r.file),o=read(p);return{id,file:p.replaceAll('\\','/'),sha256:hash(p),answer:o.expected.answer,expected_points:o.expected.expected_points,score:o.result.score,matched:o.matched};});
const report={recorded_at:new Date().toISOString(),scope:'원문·공통지문·발문·전체 답안·명제별 scope와 실제 v4 3회 기록 대조. 추가 API 호출 없음.',input:{file,sha256:hash(file),qa_file:qa,qa_sha256:hash(qa)},shared_context:set.shared_context,sources:set.source_refs.map(r=>({...r,file_sha256:hash(r.file),exact_quote_present:fs.readFileSync(r.file,'utf8').includes(r.source_quote)})),cases,controls,decision:'원답안·기대값·문항·계획을 변경하지 않는다. 세 불일치 모두 현행 계약의 함축 허용과 불일치하는 실제 모델 판정으로 미해결 상태를 보존한다. 같은 입력을 3회 기록했으므로 근거 없는 추가 재호출을 하지 않는다.'};
fs.writeFileSync(path.join(directory,'implication-investigation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:cases.map(c=>({id:c.id,expected:c.expected.expected_points,scores:c.observations.map(o=>o.score),repeat_count:c.repeat_count})),controls:controls.length,controls_matched:controls.every(c=>c.matched),source_quotes_found:report.sources.every(s=>s.exact_quote_present),api_calls:0}));
