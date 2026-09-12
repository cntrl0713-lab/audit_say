/** Read current evidence and write N04 relation proposals only. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildSourceCatalog} from '../../../questionSourceCatalog.mjs';
import {specifications} from './content.mjs';
const base=path.resolve('cpa_uploader/drafts/delegated-authoring-2026-09-11/n04');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const write=(f,v)=>fs.writeFileSync(path.join(base,f),JSON.stringify(v,null,2)+'\n');
const dataset='cpa_uploader/analysis/question-elements/question-elements.json',d=read(dataset),catalog=buildSourceCatalog();
const byId=new Map(d.records.map(r=>[r.id,r]));
const mapping=[
 ['T11-A','sub1','element-cde9aa6bdba307e5','partial','원모의는 방법·가정·데이터 선택·적용 위험의 증거 입수가 주어진 뒤 누락된 점추정치 선택·공시를 판단한다. 새 물음은 입력 테스트를 주어진 사실로 두지 않고 여섯 테스트 대상도 완전열거한다. 모의1회는 여섯 신규 세분명제 각각의 직접 빈도가 아니다.','540','22'],
 ['T11-A','sub2','element-691f144435c75602','direct','추정불확실성을 적절히 다루지 않은 경영진에 대한 조건부 후속조치의 범위에 대응한다. 요청과 대응평가·미비점 평가와 존재시 전달을 별개1점으로 명료화한다.','540','27'],
 ['T11-A','sub3','element-99df69e8add0375e','partial','기출변형은 범위가 적정하게 도출되었다는 사실을 주고 종료 여부를 판단한다. 현재 A302 해설도 중요성 배수의 범위를 허용하면서 공시 평가를 요구하므로 기계적 상한으로 읽지 않았다. 새 물음은 범위 도출의 증거·합리성 요건도 직접 쓰게 하므로 이1회를 각 세부요건의 직접 빈도로 쓰지 않는다.','540','29'],
 ['T11-A','sub3','element-178ee3e93aef7362','partial','OX의 범위추정치 절차와 대응하며 범위에 경영진 금액이 포함되었다는 사실만으로 종료할 수 없다는 판단을 추가한다.','540','29'],
 ['T11-B','sub1','element-a04fb6e7374bd897','partial','원기출(2024:5:2(2))은 질문사항 중 하나만 요구했다. 현재는 신원·변동·관계·거래여부·형태·목적 전부를 요구하므로1회가 각 명제의 개별빈도를 뜻하지 않는다.','550','13'],
 ['T11-B','sub2','element-0d07e07d0ad12b2c','partial','원기출(2024:5:2(3))은 예금담보 제공을 발견한 은행확인서가 주된 정답이며 해설 A98~99는 다른 확인서·의사록도 병기한다. 새 물음은550.15의 모든 문서군과 기타 문서의 상황조건을 요구하므로 완전열거 전체의 직접빈도로 쓰지 않는다.','550','15'],
 ['T11-B','sub3','element-88e130407103017b','partial','원기출은550.23(a)의 계약검사 평가사항을 요구한다. 현재는 회계처리와 공시를 분리하고23(b)의 권한 있는 승인 증거를 추가하므로 그 승인명제의 직접기출1회로 쓰지 않는다.','550','23'],
 ['T13-A','sub1','auditor-expert.procedure-design','partial','2020:2:3과2024:5:3은 같은 활용절차 설계범주에서 각각 두 가지만 요구했다. 현재는620.8 다섯 고려사항을 모두 제시하고 외부전문가·종전품질관리 적용 사례로 한정한다.','620','8'],
 ['T13-A','sub2','element-3a52af88b392ee78','partial','2021:3:2는 적격성·역량·객관성 평가가 주어진 후 그 적절성을 판단한다. 새 물음은 세특성을 직접 회상하고 외부전문가 이해·관계 질문을 추가하므로 전체4명제의 직접빈도는 아니다.','620','9'],
 ['T13-A','sub3','auditor-expert.adequacy','partial','2018:4:5의 세 고려범주를 현재620.12의 조건과 세부 평가특성으로 확장한다. 가정/방법과 각 속성을 분리한10점 각각의 독립 기출빈도1회라는 뜻은 아니다.','620','12'],
];
const sliceSource=s=>({file:s.file,start_line:s.start_line,end_line:s.end_line,page:s.page,source_sha256:sha(s.file),text:fs.readFileSync(s.file,'utf8').split(/\r?\n/u).slice(s.start_line-1,s.end_line).join('\n')});
const elements=mapping.map(([plan_id,subquestion_id,id,relationship,reason,standard,paragraph])=>{
 const e=d.elements.find(e=>e.id===id);if(!e)throw Error('Missing element '+id);
 const occurrences=d.occurrences.filter(o=>o.element_id===id);
 const records=[...new Set(occurrences.map(o=>o.record_id))].map(id=>byId.get(id));
 const practice=e.practice_occurrences.map(id=>byId.get(id)).filter(Boolean);
 const ox=practice.filter(r=>r.source.file.includes('필수암기_OX'));
 const units=[...new Set(records.flatMap(r=>[...(r.source_unit_ids??[]),...(r.context_source_unit_ids??[])]))];
 const official=catalog.units.find(u=>u.file==='cpa_uploader/data/official/delegated-n04-kga-2025.txt'&&u.standard==='KGA '+standard&&u.paragraph===paragraph);
 if(!official||units.some(id=>!catalog.units.some(u=>u.id===id)))throw Error('Missing source ID');
 return {plan_id,subquestion_id,element_id:id,label:e.label,relationship,relationship_limit:reason,exam_frequency:e.exam_frequency,mock_frequency:e.mock_frequency,exam_years:e.exam_years,exam_questions:e.exam_questions,mock_questions:e.mock_questions,practice_non_ox:practice.length-ox.length,ox_occurrences:ox.length,practice_occurrences:e.practice_occurrences,source_unit_ids:units,official_source_unit_id:official.id,occurrences,records:records.map(r=>({...r,source_excerpt:sliceSource(r.source),...(r.context_source?{context_excerpt:sliceSource(r.context_source)}:{})}))};
});
write('frequency-evidence.json',{artifact_type:'n04_frequency_evidence',dataset,sha256:sha(dataset),policy:'기출·모의·연습·OX를 분리하며 재수록만 제외한다. 기출변형/선택발문의 전체범위 확대를 별도 설명하고 부분·인접빈도를 개별 신규 명제의 직접 빈도로 전용하지 않는다.',elements});
const bankfile='cpa_uploader/data/cpa_question_sets_v3.authoring.json',bank=read(bankfile),initialfile='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/comparison-initial.json';
write('comparison-notes.json',{artifact_type:'n04_existing_comparison',bank_file:bankfile,bank_sha256:sha(bankfile),initial_comparison_file:initialfile,initial_comparison_sha256:sha(initialfile),initial_comparison_sets:read(initialfile).length,existing_bank:bank.filter(s=>['11','13'].includes(s.classification.topic_id)).map(s=>({set_id:s.id,title:s.title,shared_context:s.shared_context,subquestions:s.subquestions.map(q=>({id:q.id,prompt:q.prompt,model_answer:q.model_answer,criteria:q.criteria.map(c=>({id:c.id,claim:c.claim}))}))})),differences:specifications.map(s=>({plan_id:s.plan_id,difference:s.difference})),peer_boundary:'N02는 일반 기업생성정보 품질절차·통제 이해/실행/운영효과성 구별. N04는 추정치·관계탐색·감사인측 전문가 고유요구. S02는 경영진측 전문가500.8, S03은 내부감사610/서비스조직402. 최종49 비교본은 총괄 고정 후 다시 확인한다.'});
const proposals=elements.map(e=>{const s=specifications.find(s=>s.plan_id===e.plan_id),set=read(path.join(base,s.id+'.json')),q=set.subquestions.find(q=>q.id===e.subquestion_id);return {element_id:e.element_id,source_unit_ids:[...e.source_unit_ids,e.official_source_unit_id],target:{scope:'draft',file:path.relative(process.cwd(),path.join(base,s.id+'.json')).replaceAll('\\','/'),set_id:s.id,subquestion_id:q.id,criterion_ids:q.criteria.map(c=>c.id)},relationship:e.relationship,reason:e.relationship_limit,review_status:'needs_review',evidence:{scope_file:path.relative(process.cwd(),path.join(base,'scope-and-sources.md')).replaceAll('\\','/'),frequency_file:path.relative(process.cwd(),path.join(base,'frequency-evidence.json')).replaceAll('\\','/')}};});
write('coverage-proposal.json',{artifact_type:'coverage_relationship_proposal',package:'N04',status:'proposed_needs_review',snapshot_policy:'총괄이 최종 문항 버전의 의미 대조 후 snapshot과 공통 links 통합을 담당한다. 이 제안은 원문·빈도 본문을 중복 작성하지 않는다.',relationships:proposals});
console.log(JSON.stringify({elements:elements.length,relations:proposals.length,existing_sets:bank.filter(s=>['11','13'].includes(s.classification.topic_id)).length}));
