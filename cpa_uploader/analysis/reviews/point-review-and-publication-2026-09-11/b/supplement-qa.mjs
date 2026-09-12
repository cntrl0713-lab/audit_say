import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const dir=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Z]:))/i,'$1'));
const qa=JSON.parse(fs.readFileSync(path.join(dir,'qa.json'),'utf8'));
const byKey=new Map(qa.questions.map(q=>[q.set_id+'/'+q.subquestion_id,q]));
const legacyBase='cpa_uploader/analysis/reviews/question-review-2027/grading-cases/';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const legacy=[];
function add(key,id,answer,met=[],contra=[],note='',origin=null){
 const q=byKey.get(key);if(!q)throw Error('unknown question '+key);
 const positives=new Set(met),neg=new Set(contra);
 // All indices below were adjudicated against the new independent propositions.
 // No old score/verdict is automatically propagated into new children.
 const row={id,subquestion_id:q.subquestion_id,kind:origin?'legacy_preserved':'condition_boundary',answer,expected_points:positives.size,expected_verdicts:q.units.map((u,i)=>({criterion_id:u.criterion_id,verdict:neg.has(i)?'contradicted':positives.has(i)?'met':'not_met',reason:neg.has(i)?'원 답안이 이 명제의 대상·조건·결론을 명시적으로 반대로 바꾼다.':positives.has(i)?'전체 답안의 실제 진술 또는 분명한 함축으로 이 독립 명제를 충족한다.':'이 독립 명제의 내용은 없거나 다른 상황·대상만 제시했다.'})),note,...(origin?{origin}:{}),target_criterion_id:q.units[contra[0]??met[0]??0].criterion_id};
 q.cases.push(row);return row;
}
const special={
 '07-overall-design-only':[[0],[],'무엇을 설계·실행하는지 묻는 발문에 전반적 대응을 제시했으므로 실행이라는 주어진 말을 반복하지 않아도 1점이다.'],
 '07-wrong-risk-level':[[],[0],'재무제표 수준의 전반적 대응을 명시적으로 부정한다.'],
 '07-shared-facts-copy':[[],[],'공통사실 반복에는 전반적 대응이라는 정답이 없다.'],
 '08-expert-swapped':[[],[],'감사인측 전문가로 대상을 바꾼 답안은 경영진측 전문가 평가를 제시하지 않는다.'],
 '08-expert-auditor-agreement':[[],[],'620의 업무조건 합의는 500.8의 경영진측 전문가 평가·이해와 다르다.'],
 '08-expert-missing-objectivity':[[0,1,3,4],[],'객관성만 없으므로 해당 1점만 빠진다. 적격성·역량 부분정답을 복원한다.'],
 '08-document-never':[[2],[0,1],'반드시 제공하지 않는다는 한계를 전혀 제공할 수 없다는 부정으로 강화했으므로 소유권·가치 두 점만 미득점이다.'],
 '08-physical-never':[[0],[1,2],'전혀 제공할 수 없다는 단정은 권리·의무와 평가의 한계 진술을 각각 왜곡한다.'],
 '08-physical-missing-valuation':[[0,1],[],'실재성과 권리·의무의 한계는 맞고 평가 한계만 누락했다.'],
 '09-litigation-or':[[0,1],[2],'두 조건의 내용은 맞지만 어느 하나만으로 자동 의견변형한다는 결합 관계는 반대이다.'],
 '09-count-only':[[],[],'네 가지라는 개수는 절차 내용이 아니다.'],
 '09-direct-to-management':[[0,1,4,5],[3],'수신인 표시 확인은 누락, 회신 경로는 반대이다. 요청정보·대상자·발송과 조건부 후속발송은 보존한다.'],
 '09-unreliable-only-more-evidence':[[],[],'505.10의 추가증거만 반복했고 이 물음의 505.11 평가 차원을 제시하지 않았다.'],
 '09-every-failure-governance':[[],[],'지배기구 전달만으로 미회신 대체절차·불일치 조사를 충족하지 않는다.'],
 '09-doubt-procedure-for-refusal':[[],[],'회신 의문 해소 절차는 발송거부 시 요구된 거부사유·시사점·대체절차에 대한 답이 아니다.'],
 '10-data-reliability-no-factors':[[3],[],'신뢰성 평가 행위는 맞아 1점이며 원천 등 다섯 고려는 미언급이다. 옛 복합 0점을 전파하지 않는다.'],
 '10-inquiry-without-evidence':[[0],[],'질문 1점은 인정하고 별도 답변 증거·기타 절차는 미언급이다.'],
 '10-purpose-without-risk-limit':[[0,1],[],'투영 행위와 목적을 인정하며 위험 한계만 누락했다.'],
 '10-projection-wrong-risk-direction':[[0,1],[2],'위험 한계만 반대이며 투영·개괄적 목적의 독립 부분점수는 남긴다.'],
 '11-names-only':[[0,2,4],[],'명칭 세 개가 각1점이다. 원 답안과 옛0점을 보존하되 설명 누락으로 명칭을 함께 소거하지 않는다.'],
 '11-implied-permission':[[0,1],[],'①의 실증전용 설계를 실제 선택한 조치가 허용 판단을 함축한다. ②는 미언급이다.'],
 '11-prior-year-control-only':[[],[3],'당기 시점의 명시적 반대이다. 전기 결과만 이용한다는 답은 이 감사에 필요한 통제테스트를 수행하겠다는 진술이 아니므로 테스트 행위는 미충족이다.'],
 '12-written-date-after':[[0,2,3],[1],'가장 근접한 날이라는 요건과 재무제표·기간 범위는 보존하고 보고서일 후라는 상한 위반만 0점이다.'],
 '12-written-same-day':[[0,1,2,3],[],'같은 날은 가장 근접하고 늦지 않는 날짜이며 모든 재무제표·기간도 명시되어 만점이다.'],
 '12-minutes-optional-choice':[[0,1,4],[2],'이용가능해도 열람을 선택사항으로 바꿔 열람 의무를 부정했다. 이용불가능 시 질문이라는 조건부 행위는 따로 제시하지 않았다.'],
 '12-interim-omitted-existence':[[4],[],'열람할 최근 후속 중간재무제표를 특정한 답은 그 존재를 전제로 한 행위이다. 원 유효 기대1점을 유지한다.'],
 '12-governance-law-ignored':[[0,1,2,4,5],[3],'법규상 예외 명제만 반대이다. 별개로 적은 전달내용·개별 식별·수정요청 점수는 유지한다.'],
 '12-past-impact-names-only':[[0],[],'필요 판단은 명시하지만 두 영향 범위는 없다.'],
 '12-auditor-investigates-only':[[0],[1,2],'경영진에게 조사를 요청할 수 없다는 명시 답으로 수행 주체를 바꿨다. 수정 요청만 인정한다.'],
 '12-missing-management-plan':[[0,1,2],[],'원칙·토의·수정 필요 결정은 맞고 조건부 계획 질문만 누락했다. 기존 복합 0점을 세 하위기준에 전파하지 않는다.'],
 '12-post-report-duty-unconditional':[[],[0,1,2,3],'새 사실을 알아도 모든 의무가 없다고 명시하여 일반원칙의 범위 및 예외의 세 조치를 모두 부정한다.'],
 '12-management-law-ignored':[[0,1,3],[2],'법규 예외만 반대이며 통상 전달내용·적시성·수정요청은 별개로 맞았다.']
};
for(const topic of ['07','08','09','10','11','12']){
 const file=legacyBase+topic+(fs.existsSync(legacyBase+topic+'-v2-cases.json')?'-v2':'')+'-cases.json';
 const raw=fs.readFileSync(file);const list=JSON.parse(raw);
 const relevant=list.filter(c=>Object.entries(c.answers).some(([q,a])=>a&&byKey.has(c.set_id+'/'+q)));
 legacy.push({file,sha256:hash(raw),relevant_case_count:relevant.length,original_cases:relevant,note:'원 답안·옛 기대값·ID를 그대로 보존했다. 선택해 새 QA로 연결한 반례 외 전체 과거 사례가 이번 수정계약으로 재실측·재판정됐다는 뜻은 아니다.'});
 for(const c of relevant){
  for(const [qid,answer] of Object.entries(c.answers)){
   const key=c.set_id+'/'+qid;if(!answer||!byKey.has(key))continue;
   if(c.variant!=='paraphrase'&&!special[c.id])continue;
   const q=byKey.get(key);const [met,contra,note]=c.variant==='paraphrase'?[q.units.map((_,i)=>i),[],'원 동의표현의 실제 명제를 다시 읽어 새 하위기준 모두를 충족함을 확인했다. 원 답안 문자열은 그대로이다.']:special[c.id];
   add(key,`legacy-${c.id}-${qid}`,answer,met,contra,note,{file,file_sha256:hash(raw),case_id:c.id,subquestion_id:qid,original_answer_sha256:hash(answer),old_expected:c.expected,old_expected_set_score:c.expected_score});
  }
 }
}
// Published 09-008 originated in this draft; retain its actual answers and lineage.
{
 const file='cpa_uploader/drafts/frequency-gap-2026-09-10/qa-09-505-001.json';const raw=fs.readFileSync(file);const old=JSON.parse(raw);const q=byKey.get('pilot-09-008/sub2');
 const indices={1:[0,1],2:[2,3,4],3:[5],4:[6]};
 for(const c of old.cases.filter(c=>c.subquestion_id==='sub2')){
  const all=q.units.map((_,i)=>i);let met=all,contra=[];
  const n=Number(c.id.match(/crit(\d)/)?.[1]);const target=indices[n]??[];
  if(c.kind==='omission')met=all.filter(i=>!target.includes(i));
  if(c.kind==='opposite'){met=all.filter(i=>!target.includes(i));contra=target;}
  if(c.kind==='condition_boundary'){
   if(n===1)met=[0,2,3,4,5,6]; // design evidence is not operating-effectiveness evidence.
   if(n===2)met=[0,1,2,3,5,6]; // only amount omitted; count and homogeneity remain.
   if(n===3)met=[0,1,2,3,4,6];
   if(n===4)met=[0,1,2,3,4,5];
  }
  if(c.kind==='empty')met=[];
  add('pilot-09-008/sub2',`legacy-draft-09-505-${c.id}`,c.answer,met,contra,'원 답안의 낮은 위험·운영효과성, 모집단 수·동질성·소액, 낮은 발생률, 무시 사정 미인지 일곱 명제를 직접 재판정했다. 옛 기준 번호와 점수는 계보 자료이며 새 하위기준으로 자동 전파하지 않았다.',{file,file_sha256:hash(raw),case_id:c.id,source_set_id:old.set_id,old_expected_points:c.expected_points,old_expected_verdicts:c.expected_verdicts});
 }
 legacy.push({file,sha256:hash(raw),original_cases:old.cases,note:'원초안 ID와 정본 pilot-09-008 계보를 구별한다. 원 답안과 과거 기대값 모두 보존.'});
}
add('pilot-09-007/sub1','new-unconditional-followup','확인할 정보를 결정한다. 적합한 조회처를 고른다. 수신인 표시와 감사인 직접 회신 정보를 확인하여 설계한다. 조회서를 발송하며 필요 여부와 관계없이 모든 경우 반드시 후속확인조회를 해야 한다.',[0,1,2,3,4],[5],'후속조회 발송의 적용가능 조건만 바꾼 반례이다.');
add('pilot-10-002/sub1','new-specific-factors-only','적합성을 결정할 때 평가된 위험과 해당 세부테스트를 고려한다. 데이터 신뢰성은 정보원천·비교가능성·성격·관련성·작성 통제로 평가한다.',[0,1,2,3,4,5,6,7,8],[],'구체 고려가 해당 상위 평가를 명확히 포함한다. 기대치 및 수용차이 내용은 없다.');
add('pilot-10-002/sub1','new-generic-four-procedures','주장에 대한 분석절차의 적합성을 결정한다. 기대치 도출 데이터의 신뢰성을 평가한다. 기대치를 도출하고 중요한 왜곡표시를 찾을 만큼 정확한지 평가한다. 추가 조사 없이 수용할 차이금액을 결정한다.',[0,3,9,10,11],[],'고려사항 없이 네 상위절차만 제시하되 기대치 도출과 평가라는 두 실제 행위를 포함한 5점이다. 세부 요건을 자동 보충하지 않는다.');
add('pilot-12-004/sub1','new-minutes-absent-no-inquiry','회의록이 있으면 열람한다. 다만 회의록이 아직 없으면 논의사항을 질문할 필요도 없다.',[2],[3],'자료 이용가능성과 미이용가능성의 두 상황을 따로 채점한다.');
add('pilot-11-004/sub2','new-test-name-only','② 통제테스트.',[2],[],'테스트 종류만 맞으면1점이다. 당기 시점은 자동 보충하지 않는다.');
add('pilot-11-004/sub2','new-period-only','② 당기.',[3],[],'시점만 맞은 반대 방향의 독립 부분정답을 확인한다.');
// Audit-only correction of a synthetic contrary to avoid unintended broad denial.
for(const q of qa.questions)for(const c of q.cases){
 if(q.set_id==='pilot-10-003'&&q.subquestion_id==='sub2'&&c.answer.includes('추가 감사절차나 증거 없이 직감만으로 변이로 확정한다.'))c.answer=c.answer.replace('추가 감사절차나 증거 없이 직감만으로 변이로 확정한다.','잔여 모집단에 영향이 없다는 증거를 입수하기 위한 추가 감사절차는 수행할 필요가 없다.');
}
qa.case_count=qa.questions.reduce((n,q)=>n+q.cases.length,0);
qa.legacy_preservation={file:'legacy-qa-preserved.json',rejudged_cases:qa.questions.reduce((n,q)=>n+q.cases.filter(c=>c.origin).length,0),note:'선택 반례와 동의표현은 원 답안을 유지하여 재판정했다. 나머지 과거 사례 원문도 보관하되 재실측으로 주장하지 않는다.'};
fs.writeFileSync(path.join(dir,'qa.json'),JSON.stringify(qa,null,2)+'\n');
fs.writeFileSync(path.join(dir,'legacy-qa-preserved.json'),JSON.stringify({version:1,api_calls:0,sources:legacy},null,2)+'\n');
console.log(JSON.stringify({qa_cases:qa.case_count,legacy_rejudged:qa.legacy_preservation.rejudged_cases,preserved_sources:legacy.length}));
