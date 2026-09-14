import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const read=f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const inventory=read('inventory.json'), sourceChecks=read('source-and-scope-checks.json');
const inputs=['review-01-05.json','review-06-10.json','review-10.json','review-11-14.json','review-15-19.json'];
const rows=inputs.flatMap(f=>read(f).map(r=>({...r,review_file:f})));
const qs=new Map(inventory.questions.map(q=>[q.key,q]));
const keys=new Set(),errors=[];
for(const r of rows){
 const q=qs.get(r.key);if(!q){errors.push('unknown '+r.key);continue;}
 if(keys.has(r.key))errors.push('duplicate '+r.key);keys.add(r.key);
 if(!['keep','adjust','split','merge','remove'].includes(r.decision))errors.push('decision '+r.key);
 if(!Number.isInteger(r.proposed_points)||r.proposed_points<0)errors.push('points '+r.key);
 if(r.decision==='remove'&&r.proposed_points!==0)errors.push('remove points '+r.key);
 for(const k of ['rationale','minimum_answer','partial_credit','proposal','source_review'])if(!r[k]||(typeof r[k]==='string'&&!r[k].trim()))errors.push('empty '+r.key+' '+k);
 if(typeof r.proposal==='object'){
  if(Array.isArray(r.proposal.destinations)){
   if(r.proposal.destinations.length===0)errors.push('empty destinations '+r.key);
   for(const d of r.proposal.destinations)if(!qs.has(d.key)||!q.question.criteria.some(c=>c.id===d.criterion_id)||!d.addition||!Number.isInteger(d.points)||d.points<1||!Number.isInteger(d.final_points)||d.final_points<d.points)errors.push('proposal destination '+r.key);
   if(r.proposal.destinations.reduce((n,d)=>n+d.points,0)!==r.proposed_points)errors.push('destination total '+r.key);
  }else if(Array.isArray(r.proposal.parts)&&r.proposal.parts.length){
   if(r.proposal.parts.some(p=>!p.prompt||!Number.isInteger(p.points)||p.points<1))errors.push('proposal part content '+r.key);
   if(r.proposal.parts.reduce((n,p)=>n+p.points,0)!==r.proposed_points)errors.push('proposal part total '+r.key);
  }else errors.push('proposal parts '+r.key);
  if(Object.keys(r.proposal).some(k=>!['parts','integration','followup','destinations','decision_note'].includes(k)))errors.push('unknown proposal field '+r.key);
 }
 const expected=q.question.criteria.map(c=>c.id).sort(),found=r.criterion_reviews.map(c=>c.id).sort();
 if(JSON.stringify(expected)!==JSON.stringify(found))errors.push('criterion coverage '+r.key);
 for(const c of r.criterion_reviews)if(!c.reason||!['keep','split','combine','revise'].includes(c.verdict))errors.push('criterion record '+r.key+'/'+c.id);
 for(const k of r.related_keys)if(!qs.has(k))errors.push('related key '+r.key+' -> '+k);
 if(!Array.isArray(r.issues))errors.push('issues '+r.key);
}
for(const k of qs.keys())if(!keys.has(k))errors.push('missing '+k);
const currentBank=JSON.parse(fs.readFileSync('cpa_uploader/data/cpa_question_sets_v3.authoring.json'));
const currentCatalog=JSON.parse(fs.readFileSync('cpa_uploader/data/learning-question-classifications.json'));
const currentQ=new Map(currentBank.flatMap(s=>s.subquestions.map(q=>[s.id+'/'+q.id,{s,q}])));
const currentC=new Map(currentCatalog.classifications.map(c=>[c.source_set_id+'/'+c.subquestion_id,c]));
const currentStandard=new Set(currentCatalog.classifications.filter(c=>c.question_style==='standard').map(c=>c.source_set_id+'/'+c.subquestion_id));
const changedTargets=[];
for(const q of inventory.questions){
 const cur=currentQ.get(q.key),c=currentC.get(q.key);
 if(!cur||!c||c.question_style!=='standard'||JSON.stringify(cur.q)!==JSON.stringify(q.question)||c.standalone_prompt!==q.classification.standalone_prompt||JSON.stringify(c.topic_ids)!==JSON.stringify(q.classification.topic_ids)||JSON.stringify(cur.s.source_refs.filter(r=>q.source_refs.some(ref=>ref.id===r.id)))!==JSON.stringify(q.source_refs))changedTargets.push(q.key);
}
const newStandard=[...currentStandard].filter(k=>!qs.has(k));
if(changedTargets.length||newStandard.length)errors.push('target changed; new review required');
const changedSources=[...new Map(sourceChecks.sources.map(s=>[s.file,s.file_sha256]))].filter(([file,hash])=>!fs.existsSync(file)||sha(fs.readFileSync(file))!==hash).map(([file])=>file);
if(changedSources.length)errors.push('reviewed source file changed; new review required');
const actions=Object.fromEntries(['keep','adjust','split','merge','remove'].map(a=>[a,rows.filter(r=>r.decision===a).length]));
const pointDistribution={};for(const q of inventory.questions)pointDistribution[q.points]=(pointDistribution[q.points]??0)+1;
const summary={reviewed_at:new Date().toISOString(),scope:'current standard questions only',review_kind:'agent_points_and_structure_review',input_hashes:inventory.inputs,
 current_input_hashes:inventory.inputs.map(x=>({file:x.file,sha256:sha(fs.readFileSync(x.file))})),current_bank_sets:currentBank.length,current_bank_questions:currentQ.size,
 current_standard_questions:currentStandard.size,changed_target_questions:changedTargets,new_standard_questions:newStandard,changed_source_files:changedSources,
 snapshot_bank_sets:inventory.bank_sets,snapshot_bank_questions:inventory.bank_questions,reviewed_questions:rows.length,reviewed_criteria:rows.reduce((n,r)=>n+r.criterion_reviews.length,0),current_points:inventory.standard_points,
 actions,point_distribution:pointDistribution,increased_points:rows.filter(r=>r.proposed_points>qs.get(r.key).points).map(r=>r.key),decreased_points_excluding_removals:rows.filter(r=>r.decision!=='remove'&&r.proposed_points<qs.get(r.key).points).map(r=>r.key),
 actual_grading:{executed:false,api_calls:0,token_usage:'not_applicable',acceptance_rate:null},question_bank_modified_by_this_review:false,published_by_this_review:false,
 validation_errors:errors};
fs.writeFileSync(path.join(dir,'completion-checks.json'),JSON.stringify(summary,null,2)+'\n');
if(errors.length)throw Error(errors.join('\n'));
const order=read('classifications.snapshot.json').topics;
const labels={keep:'유지',adjust:'배점·기준 조정',split:'분리',merge:'통합',remove:'삭제·중복 정리'};
const escape=s=>String(s??'').replaceAll('|','\\|').replaceAll('\n',' ');
const sourceText=s=>typeof s==='string'?s:[s.content_notes,s.scope,...(s.references??[]).map(r=>r.file+' — '+r.span)].filter(Boolean).join(' ');
const proposalText=p=>{
 if(typeof p==='string')return p;
 const items=p.destinations?p.destinations.map(d=>`${d.key}에 ${d.points}점 통합: ${d.addition} (다른 통합을 포함한 최종 ${d.final_points}점)`):p.parts.map(part=>`${part.prompt} (${part.points}점)`);
 return '\n\n'+items.map((s,i)=>`${i+1}. ${s}`).join('\n')+[p.integration,p.followup,p.decision_note].filter(Boolean).map(s=>'\n\n'+s).join('');
};
const detailDir=path.join(dir,'details');fs.mkdirSync(detailDir,{recursive:true});
for(const topic of order){
 const selected=inventory.questions.filter(q=>q.topic===topic.id);
 const lines=[`# ${topic.id} ${topic.title}: 기준서형 배점 검토`,'','이 파일은 수동 검토 JSON에서 생성했다. 현재 배점 변경·실제 모델 채점·게시를 뜻하지 않는다. 합치거나 나눈 뒤의 제안 배점과 원 물음의 기여 배점을 구별한다.',''];
 for(const q of selected){const r=rows.find(r=>r.key===q.key);
  lines.push(`## ${q.key}`,'',`현재 ${q.points}점 · ${labels[r.decision]} · 원 물음 요구의 제안 기여점수 ${r.proposed_points}점`,'',`**발문:** ${q.prompt}`,'',`**판정:** ${r.rationale}`,'',`**수정안:** ${proposalText(r.proposal)}`,'',`**최소 충분 답안:** ${r.minimum_answer}`,'',`**부분정답:** ${r.partial_credit}`,'');
  if(r.related_keys.length)lines.push(`**비교·통합 대상:** ${r.related_keys.join(', ')}`,'');
  lines.push('| 기준 ID | 현 배점 | 현행 요구 | 검토 | 이유 |','|---|---:|---|---|---|');
  for(const c of q.question.criteria){const cr=r.criterion_reviews.find(x=>x.id===c.id);lines.push(`| ${c.id} | ${c.max_points} | ${escape(c.claim)} | ${cr.verdict} | ${escape(cr.reason)} |`);}
  lines.push('',`**출처 확인 범위:** ${sourceText(r.source_review)}`,'');
  if(r.issues.length)lines.push('**추가 확인사항:** '+r.issues.join(' / '),'');
 }
 fs.writeFileSync(path.join(detailDir,`topic-${topic.id}.md`),lines.join('\n')+'\n');
}
fs.writeFileSync(path.join(dir,'review-ledger.json'),JSON.stringify({schema_version:1,scope:'standard points review; proposals only',inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(dir,file)))})),questions:inventory.questions.map(q=>({current_points:q.points,topic:q.topic,question_sha256:q.question_sha256,...rows.find(r=>r.key===q.key)}))},null,2)+'\n');
const reportPath='docs/reports/standard-points-2026-09-14.md';
const report=[
'# 기준서형 물음 배점 전수 재검토 — 2026-09-14','',
`기준서형 **${rows.length}물음·${summary.reviewed_criteria}개 채점기준·${inventory.standard_points}점**을 전부 대조했다. 배점·구조 변경을 권고한 원 물음은 **${rows.length-actions.keep}개**이고 ${actions.keep}개는 현행 배점을 유지한다. 유지 물음 중 통합을 받는 대상도 있으므로 이 수치는 새 물음 수가 아니다.`,'',
'낮은 점수의 원인은 독립 명제 하나를 묻는 단답, 다른 물음과 중복되는 요구, 여러 서술요건을 하나의 기준에 묶은 과소배점으로 나뉜다. 높은 점수 역시 독립 목록이 길어서 정당한 경우와 별도 학습목표를 한 물음에 묶은 경우를 구분했다. 모든 점수를 일정 배율로 올리는 방식은 권고하지 않는다.','',
'| 주된 결정 | 원 물음 수 | 처리 방향 |','|---|---:|---|',
`| 유지 | ${actions.keep} | 독립 요구의 정수 부분점수 유지 |`,
`| 배점·기준 조정 | ${actions.adjust} | 결합된 독립 요구를 분리하거나 중복·주어진 답의 점수 제거 |`,
`| 분리 | ${actions.split} | 학습목표별 별도 발문·배점으로 분리 |`,
`| 통합 | ${actions.merge} | 작은 물음의 고유 요구를 지정한 인접 물음에 흡수 |`,
`| 삭제·중복 정리 | ${actions.remove} | 대표 물음에 이미 있는 요구 또는 학습효용이 낮은 단독 물음 정리 |`,'',
`현재 1점 ${pointDistribution[1]}개, 2점 ${pointDistribution[2]}개이며, 8점 이상은 ${inventory.questions.filter(q=>q.points>=8).length}개다. 기존 요구를 기준으로 점수 상향을 제안한 물음은 ${summary.increased_points.length}개, 삭제 외 점수 하향을 제안한 물음은 ${summary.decreased_points_excluding_removals.length}개다. 분리·통합·중복 제거를 함께 조정해야 하므로 제안 기여점수 합계를 새 문제은행 총점으로 확정하지 않았다.`,'',
'## 대표 수정안','',
'| 대상 | 현재 | 제안 | 이유 |','|---|---:|---|---|',
'| draft-standard-gap-20260913-g05/sub1 거래·사건 경영진주장 | 12 | 6 + 6 + 3 + 4 | 명칭과 정의를 나누고 발생·귀속, 기록·공시 등의 독립 의미를 각각 인정 |',
'| draft-standard-gap-20260913-g05/sub2 계정잔액 경영진주장 | 12 | 6 + 6 + 4 + 4 | 권리·의무 및 평가·공시·표시의 독립 의미를 각각 인정 |',
'| pilot-18-003/sub2 감사문서 목적·내용 | 11 | 3 + 5 + 3 | 목적·이해 기준 / 절차·결과·증거 / 유의적 사안·결론·판단 |',
'| pilot-16-009/sub2 기타정보 단락 | 10 | 5 + 5 | 대상·확신범위와 감사인의 책임·보고결과 분리 |',
'| pilot-15-002/sub3 정보 평가 | 9 | 4 + 5 | 질적 특성과 구체 고려사항 분리 |',
'| pilot-15-006-standards-20260913/sub2 | 2 | 4 | 두 단락 각각 법규 비요구/요구의 두 상황을 독립 인정 |',
'| pilot-17-005/sub4 완료불가 통지 | 2 | 3 | 경영진·지배기구·서면방식을 각각 인정. 관련 판단 1점을 합치면 4점 |',
'| pilot-17-001/subq2 보고서 요소 | 7 | 5 | 발문에 이미 제공한 제목·수신인의 점수 제거 |',
'| pilot-10-001/subq2 계층화 효과 | 3 | 2 | 효율성 향상과 표본규모 감소의 같은 효과를 이중 배점하지 않음 |',
'| pilot-16-005/sub1·16-007/sub1 | 3·2 | 중복 제거 | 16-002/sub1의 핵심감사사항 선정분야에 이미 포함 |',
'| pilot-16-001/sub2 | 1 | sub1과 통합해 5 | 비교정보 방식 정의와 외감법 적용방식 연결 |','',
'## 부분점수 판단','',
'- 서로 독립적으로 맞힐 수 있는 행위·대상·보고정보는 각 1점으로 합산한다. 예를 들어 통지 수신자를 맞힌 답을 서면 형식 누락만으로 모두 0점 처리하지 않는다.',
'- 명칭과 설명, 원칙과 예외를 실제로 각각 요구했으면 각각 충족한 만큼 인정한다. 같은 비교범위를 묻는 물음끼리 배점 단위를 맞춘다.',
'- 성립조건·한정어를 빠뜨려 명제의 의미가 틀린 답은 무조건 부분정답으로 쪼개지 않는다. 발문에 주어진 회사·기준·시점 등의 반복도 새 점수로 만들지 않는다.',
'- 판단을 분명하게 함축하는 이유·조치는 판단점수를 인정한다. 같은 효과의 추상 표현과 구체 표현은 이중 가산하지 않는다.',
'- 단일 명칭이나 완결 명제 하나를 묻는 1~2점 물음은 점수 자체가 잘못된 것이 아닐 수 있다. 단독 학습효용과 인접 요구의 중복을 기준으로 통합 여부를 정했다.','',
'## 전수 장부','',
'아래 장부에는 모든 물음의 원발문, 현재/제안 배점, 유지·조정 이유, 최소 충분 답안, 부분정답 예, 모든 criterion의 검토와 출처 확인범위가 있다.','',
'| 주제 | 물음 수 | 현 점수 | 상세 |','|---|---:|---:|---|'];
for(const t of order){const a=inventory.questions.filter(q=>q.topic===t.id);report.push(`| ${t.id} ${t.title} | ${a.length} | ${a.reduce((n,q)=>n+q.points,0)} | [물음별 장부](../../cpa_uploader/analysis/reviews/standard-points-2026-09-14/details/topic-${t.id}.md) |`);}
report.push('','## 범위와 검사','',
`현행 학습분류의 기준서형을 모집단으로 동결했다. 작업 시작 은행은 ${inventory.bank_sets}세트·${inventory.bank_questions}물음이며, 종료 확인 시 ${currentBank.length}세트·${currentQ.size}물음이다. 병행 작업에 의한 사례형 추가가 있었으나 기준서형 ${currentStandard.size}물음의 발문·답안·기준·배점·관련 출처·독립 발문·주제는 동결 입력과 동일했다.`,
'',`초안 폴더에서 기준서형을 명시한 별도 미등록 세트는 ${sourceChecks.unregistered_standard_drafts.length}개였다. 정본에 반영된 초안·과거 보존본을 새 물음으로 중복 집계하지 않았다. 분류 자체의 전체 재판정이나 사례형 배점 검토를 포함한 것은 아니다.`,
'',`출처 파일 ${new Set(sourceChecks.sources.map(s=>s.file)).size}개와 고유 파일·인용 조합 ${sourceChecks.sources.length}개를 확인했다. ${sourceChecks.sources.filter(s=>s.exact_quote_present).length}개는 정확한 문자열이 존재하고, 나머지 ${sourceChecks.sources.filter(s=>!s.exact_quote_present&&s.whitespace_normalized_quote_present).length}개는 공백 정규화 시 일치한다. 이 기계검사는 별도의 내용 대조를 대체하지 않는다. 인용된 기존 로컬 판본을 기준으로 배점구조를 검토했으며, 최신 공식판본·시행공고·시험 적용판본의 전수 재확인은 하지 않았다.`,
'','모든 대상·criterion의 누락/중복, 참조 ID, 정수 제안 배점, 입력 변경 여부를 검사했다. 세부 장부의 미확인 근거와 발문 결함은 후속 수정·검증에서 해결할 사항으로 남겼다.','',
'이번 결과는 검토와 구체 수정안이다. 정본·공개본·운영 DB의 물음이나 배점을 바꾸지 않았고, 유료 API 의미검수·Luna 실제 채점·게시도 수행하지 않았다. 실제 채점의 ±1점·95% 목표 달성률은 산출하지 않았다. 적용할 때는 새 판본으로 발문·답안·criterion·ID 계보를 함께 맞추고, 영향받는 대표 완전/부분/오답을 Luna로 검증해야 한다.','',
'[검토 폴더와 재현 방법](../../cpa_uploader/analysis/reviews/standard-points-2026-09-14/README.md) · [기계 판독 장부](../../cpa_uploader/analysis/reviews/standard-points-2026-09-14/review-ledger.json) · [완전성 검사](../../cpa_uploader/analysis/reviews/standard-points-2026-09-14/completion-checks.json)','');
fs.writeFileSync(reportPath,report.join('\n'));
console.log(JSON.stringify({questions:rows.length,criteria:summary.reviewed_criteria,actions,increased:summary.increased_points.length,decreased_excluding_removals:summary.decreased_points_excluding_removals.length,errors},null,2));
