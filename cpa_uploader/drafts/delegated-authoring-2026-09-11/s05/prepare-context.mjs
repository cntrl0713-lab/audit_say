import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {buildSourceCatalog} from '../../../questionSourceCatalog.mjs';
const base='cpa_uploader/drafts/delegated-authoring-2026-09-11/s05';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const write=(f,v)=>fs.writeFileSync(`${base}/${f}`,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const dataset='cpa_uploader/analysis/question-elements/question-elements.json';
const ds=read(dataset);
const specs=[
 ['T15-A','sub1','element-ef5d9c3e184176bf','direct','의견거절 보고서 문구 오류 수정. 대상재무제표의 올바른 식별 문구는 유지한다.'],
 ['T15-A','sub1','element-9bb585d2816dfcda','partial','적정의견 대비 의견문단의 변경이라는 원요구 일부. 보고서 순서를 득점요건으로 가져오지 않는다.'],
 ['T15-B','sub1','element-b2f3c0a90ae3028a','partial','보고서일 개념과 연결되지만 새 물음은 최초 보고서일 적용 및 선행 조건이다.'],
 ['T15-B','sub2','element-779e55ea9f02ee69','direct','이름 공시 예외와 지배기구 논의 요구.'],
 ['T16-C','sub1','element-8460db7f449233bf','direct','KAM 비공개 예외 및 기업의 기존 공시가 예외를 제한함.'],
 ['T16-C','sub2','element-a8c0fcb632eba82d','direct','KAM 관련 감사문서의 포함사항.'],
 ['T14-C','sub1','element-4acb3c455ddcbb7d','direct','부문 수행중요성 적합성 평가 주체. 별도감사 전체 중요성 검증까지 직접 빈도로 확대하지 않는다.'],
 ['T14-C','sub2','element-1aea5ef018b1970e','direct','명백하게 사소함의 한도 결정 주체.'],
 ['T14-C','sub3','element-b061165738b1707c','direct','부문중요성 합계와 그룹 중요성의 산술배분 오해.'],
];
const catalog=buildSourceCatalog();
const rows=specs.map(([plan_id,subquestion_id,id,relationship,limit])=>{
 const e=ds.elements.find(x=>x.id===id);if(!e)throw Error(id);
 return {plan_id,subquestion_id,element_id:id,label:e.label,relationship,relationship_limit:limit,
   exam_frequency:e.exam_frequency,mock_frequency:e.mock_frequency,exam_years:e.exam_years,exam_questions:e.exam_questions,mock_questions:e.mock_questions,practice_occurrences:e.practice_occurrences,
   records:e.occurrence_ids.map(oid=>{const o=ds.occurrences.find(x=>x.id===oid);const r=ds.records.find(x=>x.id===o.record_id);return {occurrence:o,record:r};})};
});
write('frequency-evidence.json',{artifact_type:'s05_frequency_evidence',dataset,sha256:sha(dataset),
 policy:'기출·모의·연습·OX를 별도로 조회. 재수록만 제외. 초안 범위 확정 전 추적 기록이며 직접 빈도를 인접 요구로 전용하지 않는다.',elements:rows});
const ids=['src-99b4e67e023350f6c4','src-0dc9fbcbc600198ee8','src-4f8451ac36d5edfad8','src-a621a4150903e2048d','src-2195a214336716e50d','src-9969a45adce51c7f98','src-7c74077ed21c20bc17','src-cfff47c9de850e2bcb','src-75befc39644b609adf','src-fc5b3b748a97c1807b','src-01d08fbf3e7d80e6d6','src-ed521f564f02d63424','src-ff21a9c2123bc70901','src-90a5e5026d63dbf6c9'];
write('sources/learning-source-units.json',ids.map(id=>{const u=catalog.units.find(u=>u.id===id);if(!u)throw Error(id);return u;}));
const bankFile='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const bank=read(bankFile);
write('current-bank-context.json',{bank_file:bankFile,bank_sha256:sha(bankFile),sets:bank.filter(s=>['14','15','16'].includes(s.classification.topic_id)).map(s=>({id:s.id,title:s.title,shared_context:s.shared_context,subquestions:s.subquestions.map(q=>({id:q.id,prompt:q.prompt,model_answer:q.model_answer,criteria:q.criteria.map(c=>({id:c.id,claim:c.claim}))}))}))});
console.log(JSON.stringify({elements:rows.length,source_units:ids.length,current_sets:bank.filter(s=>['14','15','16'].includes(s.classification.topic_id)).length}));
