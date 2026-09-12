/** S03 reads current sources and proposes relationships; no shared writes. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildSourceCatalog} from '../../../questionSourceCatalog.mjs';
import {specifications} from './content.mjs';
const base=path.resolve('cpa_uploader/drafts/delegated-authoring-2026-09-11/s03');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const write=(f,v)=>fs.writeFileSync(path.join(base,f),JSON.stringify(v,null,2)+'\n');
const dataset='cpa_uploader/analysis/question-elements/question-elements.json',d=read(dataset),catalog=buildSourceCatalog();
const sourceFile='cpa_uploader/data/official/delegated-s03-kga-2025.txt';
write('sources/registered-catalog.json',{source_file:sourceFile,sha256:sha(sourceFile),units:catalog.units.filter(u=>u.file===sourceFile)});
const byId=new Map(d.records.map(r=>[r.id,r]));
const mapping=[
 ['T09-C','sub1','element-69d29d9425669da9','partial','원기출2022:8:1은 경영진·내부인원 질문을 예시로 주고 나머지 두 절차만 요구했다. 새 물음은 질문 상대와 두 문서군을 구별한 전체5명제를 요구한다. 예시로 주어진 질문2개를 직접 기출1회로 쓰지 않는다.','501','9',[3,4,5]],
 ['T09-C','sub2','element-69d29d9425669da9','adjacent','같은 소송 영역이나 원발문은 식별절차이고 새 물음의501.10 발동조건·질의서 경로·금지시 대안을 묻지 않았다. 이 빈도는 새6명제의 직접빈도가 아니다.','501','10','all'],
 ['T09-D','sub1','element-6436e7fa2daa2e4f','partial','원기출2025:4:1 첫 항목과 같은 조서 접근불능 판단이다. A36 해설은 다른 절차를 포괄해 제시한다. 새 물음은510.6(c)의 두 대체 증거경로를 모두 요구하므로 각 경로의 독립 직접빈도로 확대하지 않는다.','510','6','all'],
 ['T09-D','sub2','element-1807b60a7009ffdb','partial','2020:9:2는 매출채권 기초잔액 증거절차 한 가지만 요구했다. 새 물음은 당기회수로 얻는 네 주장과 일부증거 한계를 명시적으로 묻는다. 그 세분명제를 각각 기출1회로 계산하지 않는다.','510','A6',[1,2,3,4,5]],
 ['T09-D','sub2','element-56a3b24e4653055c','partial','같은2020:9:2의 재고항목은 추가절차 한 가지만 요구했다. 새 물음은 실사수량의 기초조정과 기초평가 두 경로를 지정하고 매출총이익·기간귀속 추가열거는 제외한다.','510','A6',[6,7]],
 ['T05-C','sub1','element-d1f1fe42facef477','direct','2024:5:4의 직접영향 법규조항에 관한 충분·적합한 준수증거 책임에 직접 대응한다. 유형 정의는 이미 주어진 사실로 별도 배점하지 않는다.','250','14',[1]],
 ['T05-C','sub1','element-212f13e6e6c3526d','direct','2024:5:4의 기타법규에서 중요한 위반을 식별하는 데 도움되는 특정절차 책임에 대응한다. 모든 조항의 법률감사 수준 보증으로 확대하지 않는다.','250','15',[2]],
 ['T05-C','sub2','element-212f13e6e6c3526d','broader','원기출 해설A101에는 질문·왕복문서 검사가 포함된다. 새 물음은 공식250.15의 경영진 및 적절한 경우 지배기구를 구별하고16의 다른절차 중 주의까지 추가한다. 전체4명제의 직접빈도라고 하지 않는다.','250','15','all'],
 ['T13-B','sub1','element-9c2fb48c77c2ceeb','partial','2025:3:3의 유의적위험 공정가치 통제테스트 활용판단과 연결된다. A31 해설은 활용축소를 요구한다. 새 물음은 모든 유의적판단의 담당자·판단/위험의 범위조정·A21 제한된 판단의 경계까지 확장한다.','610','18','all'],
 ['T13-B','sub2','element-c3b4f1dd7afb8a27','direct','필수암기/OX 교재의 심화18번은 이미 수행한 업무의 평가사항 세 범주를 요구한다. 새 물음은 공식610.23의 세 범주 안에서 독립적인8평가를 명료화한다. 수록1개이지 기출/모의1회가 아니다.','610','23','all'],
 ['T13-B','sub3','element-c3b4f1dd7afb8a27','broader','심화18번의 발문은 업무전체에 충분한 절차를 수행한다는 요구를 이미 제시한다. 새 물음은 그 범위와610.24의 일부재수행·네 설계요소를 직접 회상하게 한다. 기존 수록을 신규명제의 직접빈도로 전용하지 않는다.','610','24','all'],
 ['T13-C','sub1','element-58fbcacf7abfce1a','partial','연습교재711~712쪽은 유형2를 그대로 이용할지 추가평가할지 선택하고 그 책임을 설명하게 한다. 새 물음은402.17의 기간·보충통제·테스트·결과 세부절차를 완전열거한다. 원시험 종류·연도 미확정 수록1개를 기출0회 확정이나 모의빈도로 바꾸지 않는다.','402','17','all'],
 ['T13-C','sub2','element-58fbcacf7abfce1a','adjacent','원연습은 보고서 충분·적합성의 추가평가이며 하위서비스 제외·감사관련성 조건을 요구하지 않는다. 새402.18 판단의 직접빈도가 아니다.','402','18','all'],
];
const sliceSource=s=>({file:s.file,start_line:s.start_line,end_line:s.end_line,page:s.page,source_sha256:sha(s.file),text:fs.readFileSync(s.file,'utf8').split(/\r?\n/u).slice(s.start_line-1,s.end_line).join('\n')});
const elements=mapping.map(([plan_id,subquestion_id,id,relationship,reason,standard,paragraph,criteria])=>{
 const e=d.elements.find(e=>e.id===id);if(!e)throw Error('Missing element '+id);
 const occurrences=d.occurrences.filter(o=>o.element_id===id);
 const records=[...new Set(occurrences.map(o=>o.record_id))].map(id=>byId.get(id));
 const practice=e.practice_occurrences.map(id=>byId.get(id)).filter(Boolean);
 const ox=practice.filter(r=>r.source.file.includes('필수암기_OX'));
 const unresolvedOutsidePractice=e.unresolved_occurrences.filter(id=>!e.practice_occurrences.includes(id));
 const units=[...new Set(records.flatMap(r=>[...(r.source_unit_ids??[]),...(r.context_source_unit_ids??[])]))];
 const official=catalog.units.find(u=>u.file===sourceFile&&u.standard==='KGA '+standard&&u.paragraph===paragraph);
 if(!official||units.some(id=>!catalog.units.some(u=>u.id===id)))throw Error('Missing source ID');
 return {plan_id,subquestion_id,element_id:id,label:e.label,relationship,relationship_limit:reason,criterion_numbers:criteria,exam_frequency:e.exam_frequency,mock_frequency:e.mock_frequency,exam_years:e.exam_years,exam_questions:e.exam_questions,mock_questions:e.mock_questions,practice_non_ox:practice.length-ox.length,ox_book_occurrences:ox.length,unresolved_nonpractice_occurrences:unresolvedOutsidePractice,practice_occurrences:e.practice_occurrences,source_unit_ids:units,official_source_unit_id:official.id,occurrences,records:records.map(r=>({...r,source_excerpt:sliceSource(r.source),...(r.context_source?{context_excerpt:sliceSource(r.context_source)}:{})}))};
});
write('frequency-evidence.json',{artifact_type:'s03_frequency_evidence',dataset,sha256:sha(dataset),policy:'E/M 수치는 current JSON 그대로. 교재간 재수록은 원시험1회이며 연습·필수암기/OX 수록·원출처미확정을 분리한다. OX교재의 심화18은 실제 참거짓 OX발문이라고 표현하지 않는다. 관계행의 반복은 빈도 가산이 아니다.',elements});
const bankfile='cpa_uploader/data/cpa_question_sets_v3.authoring.json',bank=read(bankfile),initialfile='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/comparison-initial.json';
write('comparison-notes.json',{artifact_type:'s03_existing_comparison',bank_file:bankfile,bank_sha256:sha(bankfile),initial_comparison_file:initialfile,initial_comparison_sha256:sha(initialfile),initial_comparison_sets:read(initialfile).length,existing_bank:bank.filter(s=>['05','09','13'].includes(s.classification.topic_id)).map(s=>({set_id:s.id,title:s.title,shared_context:s.shared_context,subquestions:s.subquestions.map(q=>({id:q.id,prompt:q.prompt,model_answer:q.model_answer,criteria:q.criteria.map(c=>({id:c.id,claim:c.claim}))}))})),differences:specifications.map(s=>({plan_id:s.plan_id,difference:s.difference})),peer_boundary:'R01은 재고실사 시차·조회필수. R02는260 지배기구 커뮤니케이션. N04는540/550/620 고유요구. N02는 일반 정보품질·통제 설계/실행/운영 구분. S03의501 소송/부문정보·510기초잔액·250법규책임·610 내부감사업무·402 서비스조직은 대상/시점/목적이 다르다. 최종49 비교은행에서 다시 검토한다.'});
if(specifications.every(s=>fs.existsSync(path.join(base,s.id+'.json')))){
 const relationships=elements.map(e=>{const s=specifications.find(s=>s.plan_id===e.plan_id),set=read(path.join(base,s.id+'.json')),q=set.subquestions.find(q=>q.id===e.subquestion_id);return {element_id:e.element_id,source_unit_ids:[...e.source_unit_ids,e.official_source_unit_id],target:{scope:'draft',file:path.relative(process.cwd(),path.join(base,s.id+'.json')).replaceAll('\\','/'),set_id:s.id,subquestion_id:q.id,criterion_ids:q.criteria.filter((c,i)=>e.criterion_numbers==='all'||e.criterion_numbers.includes(i+1)).map(c=>c.id)},relationship:e.relationship,reason:e.relationship_limit,review_status:'needs_review',evidence:{scope_file:path.relative(process.cwd(),path.join(base,'scope-and-sources.md')).replaceAll('\\','/'),frequency_file:path.relative(process.cwd(),path.join(base,'frequency-evidence.json')).replaceAll('\\','/')}};});
 write('coverage-proposal.json',{artifact_type:'coverage_relationship_proposal',package:'S03',status:'proposed_needs_review',snapshot_policy:'최종버전 의미 대조와 snapshot/common links 통합은 총괄 담당.',relationships});
}
console.log(JSON.stringify({element_ids:new Set(elements.map(e=>e.element_id)).size,relation_rows:elements.length,existing_sets:bank.filter(s=>['05','09','13'].includes(s.classification.topic_id)).length}));
