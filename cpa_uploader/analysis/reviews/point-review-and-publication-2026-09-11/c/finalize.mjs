import fs from 'node:fs';
import crypto from 'node:crypto';
import {base,out,before,sets,changes,key} from './build.mjs';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const classify=JSON.parse(fs.readFileSync('cpa_uploader/analysis/reviews/question-unit-migration-2026-09-11/canonical-classification.json','utf8'));
const cm=new Map(classify.entries.map(e=>[key(e.set_id,e.subquestion_id),e]));
const clone=structuredClone;
const overrides={
 'pilot-13-002/sub2/crit7':'전문가가 비밀유지 요구사항을 준수할 필요성을 합의한다.',
 'pilot-13-003/sub2/crit6':'해당 상황에 적합한 추가적인 감사절차를 수행한다.',
 'pilot-15-004/sub1/crit3':'누락 공시의 포함이 실행가능하고 누락 정보의 충분하고 적합한 증거를 입수한 경우 법규상 금지되지 않는 한 그 공시를 포함한다.',
 'pilot-16-004/sub2/crit8':'강조된 해당 사항과 관련하여 감사의견이 변형되지 않음을 나타낸다.',
 'pilot-16-007/sub2/crit3':'핵심감사사항에 별도의 의견을 제공한다고 기술할 수 없다.',
 'pilot-16-008/sub1/crit1':'가: 당기재무제표에 대한 감사의견을 변형한다.',
 'pilot-16-008/sub1/crit3':'나: 당기재무제표에 대한 감사의견을 변형한다.',
 'pilot-16-008/sub1/crit4':'나: 미해결 사항이 당기수치와 대응수치의 비교가능성에 미치는 영향 때문에 의견을 변형하였다고 변형근거문단에 설명한다.',
 'pilot-16-009/sub1/crit3.p2':'감사보고서일 후 제공되는 문서의 최종본 제공 시점은 제공할 수 있을 때이며, 감사인이 요구절차를 완료할 수 있도록 기업이 발행하기 전이어야 한다.',
 'pilot-17-002/sub1/crit3':'중요한 취약점 여부를 결정할 때 보완통제의 영향을 평가한다.',
 'pilot-17-004/sub2/crit5':'경영진에게 이미 서면으로 커뮤니케이션한 미비점 정보를 반복할 필요는 없다. 이전 서면 전달을 누가 수행했는지는 관계없다.',
 'pilot-18-003/sub2/crit7':'감사보고서일 이후 적시에 최종감사파일 취합의 행정절차를 완료한다.',
 'pilot-18-003/sub2/crit8':'최종감사파일 취합 완료 후 보존기간 종료 전에는 감사문서를 삭제하거나 폐기하지 않는다.',
 'pilot-19-001/sub2/crit2':'검토업무는 제한적 확신을 제공한다.',
 'pilot-19-002/sub2/crit6':'적합한 준거기준',
};
const maintenance={
 '13-001/sub1':'내부감사와 전문가 이용이라는 두 독립 상황의 책임 불경감이 각각 1점이다. 전적인 책임과 불경감은 여기서는 같은 책임 지속의 설명이다.',
 '13-001/sub2':'언급 금지 원칙(법규 예외 포함), 책임에 관한 근거, 예외 시 보고문구라는 세 요구가 이미 분리되어 있다. 예외 조건 자체를 같은 보고조치와 다시 가점하지 않는다.',
 '13-002/sub1':'객관성 지원 정도·적격성·체계적 접근이라는 세 평가대상에 각 1점이다. 조직 위상/정책절차는 객관성 지원 정도의 근거로서 하나의 평가범주이다.',
 '13-003/sub1':'국내 금지 판단 1점과 허용국가의 네 서면동의 내용 각 1점이다. 조건으로 주어진 외국의 허용 요건을 재진술하도록 가점하지 않는다.',
 '13-004/sub1':'전문가 활용 여부를 결정한다는 한 결정만 요구한다. 특정 상황에서 반드시 활용한다는 결론을 새로 요구하지 않는다.',
 '13-004/sub2':'전반적인 감사목적 적합성 평가만 묻는다. 620.12의 세부 평가속성을 답안에 요구하지 않으므로 1점이 적절하다.',
 '13-005/sub1':'활용 불가 판단과 객관성 요건 미충족이라는 근거가 이미 각각 1점이다. 근거에서 판단이 분명하면 판단도 인정한다.',
 '13-006/sub2':'네 개의 대안적 정보입수 경로를 각각 1점으로 유지한다. 유형1 또는 유형2는 동일 보고서 입수 경로의 대안이며 방문/정보절차는 하나의 목적을 갖는 현장 절차이다.',
 '13-007/sub1':'사례 계획의 부적절 판단과 유형1 보고서의 운영효과성 증거 한계를 각각 1점으로 평가한다.',
 '13-007/sub2':'운영효과성 증거의 세 입수 경로가 각각 1점이다. 이용 가능한 경우라는 조건은 보고서 입수 절차에 결속한다.',
 '13-007/sub3':'전문가적 적격성·독립성·기준 적절성이 이미 독립 배점되어 있다.',
 '13-008/sub1':'의견변형이라는 대응과 범위제한이라는 성격을 각각 평가한다. 발문이 배제한 의견 유형 선택을 추가하지 않는다.',
 '13-008/sub2':'법규 예외가 있는 원칙과 예외 시 책임 문구가 이미 나뉜다. 같은 법규 발동조건을 보고문구 점수와 중복 가점하지 않는다.',
 '13-008/sub3':'보고서에 책임 불경감을 명시한다는 단일 내용만 요구한다.',
 '15-001/subq1':'두 단락의 위치와 제목이 각각 1점으로 이미 분리되어 있다.',
 '15-003/sub1':'주어진 네 조합마다 의견 명칭 1점이다. 제시된 중요성·전반성을 다시 쓰는 데 점수를 주지 않는다.',
 '15-003/sub2':'전반성의 세 독립 성립 경우가 각각 1점이다. 각 경우를 성립시키는 조건은 같은 명제에 유지한다.',
 '15-005/sub1':'발문에 주어진 결론에서 적정의견 명칭만 제시하면 되는 단일 요구이다.',
 '15-005/sub2':'확인된 중요왜곡표시와 증거 미입수라는 두 변형 발동원인이 각각 1점이다.',
 '16-001/sub1':'대응수치의 포함 방식·이해 목적, 비교재무제표의 비교 목적·감사 시 의견 언급이 이미 네 점으로 분리되어 있다.',
 '16-001/sub2':'국내 외부감사법상 보고 방식 명칭 한 개만 요구하므로 1점이다.',
 '16-002/sub1':'위험 분야·유의적 감사인 판단·사건거래 영향의 세 평가범주이다. 추정불확실성은 두 번째 범주의 포함 예시이며 별도의 필수 사례를 새로 요구하지 않는다.',
 '16-002/sub2':'관련 공시·선정 이유·감사 대응 방법이 각각 1점이다.',
 '16-004/sub1':'두 문단 각각의 표시공시 여부와 이용자 이해 관련성을 나누어 네 점이다. 기타사항의 감사/책임/보고서는 관련성 범주의 대안적 대상이지 세 문단을 요구하지 않는다.',
 '16-005/sub1':'16-002/sub1과 같은 세 평가범주이며 배점도 3점으로 맞춘다.',
 '16-006/sub1':'개별 KAM 단락 기술 가능 여부의 판단 한 개이다. 그 본질상 KAM 여부와 근거단락 참조는 제외 범위이다.',
 '16-006/sub2':'공시·선정 이유·감사 방법의 세 내용이 독립 배점되어 있다.',
 '16-007/sub1':'원발문이 지정한 두 고려 분야만 각 1점으로 평가한다.',
 '16-008/sub3':'전임감사 사실·의견 유형·변형 시 이유·보고서일이 이미 각 1점이다. 세 상위 범주를 세 점으로 억지로 합치지 않는다.',
 '17-001/subq1':'운영실태보고서 제공 거절의 감사 범위상 성격만 물으므로 범위제한 1점이다. 의견유형 등 후속 조치를 추가하지 않는다.',
 '17-001/subq2':'공식 일곱 구성요소 제목의 명칭만 묻는다. 경영진과 지배기구의 책임, 정의와 한계는 각각 하나의 공식 제목이며 제목 내부 단어를 분해해 세부내용을 추가하지 않는다.',
 '17-003/sub1':'내부회계 의견과 재무제표 통제위험 평가라는 두 증거입수 목적이 각각 1점이다. 충분하고 적합한 증거는 각 목적을 충족하는 증거요건으로 유지한다.',
 '17-003/sub2':'설계 목적·예방발견 능력·실제 운영·수행자 권한·적격성이 이미 다섯 독립 점수이다. 설계조건으로 주어진 사실은 재득점하지 않는다.',
 '17-004/sub1':'통합감사 차원의 계획수행과 통제테스트 설계라는 두 수준의 원칙에 각 1점이다. 구체적인 두 감사목적을 열거하지 않아도 된다.',
 '18-001/subq1':'1200 적용 불가 판단과 일반기준 적용 조치가 각각 1점이다.',
 '18-001/subq2':'지정된 기준서 보론 보고서의 KAM 포함 여부만 요구하므로 1점이다.',
 '18-002/sub2':'당기부터 전진적 적용이라는 적용시점 한 개만 요구한다. 기초잔액·비교정보의 부가 설명을 새 점수로 세지 않는다.',
 '18-004/sub1':'전체 준수 기술과 일반기준 언급이라는 두 금지 판단이 각각 1점이다.',
 '18-004/sub2':'서면합의 조건과 대체적용 방식을 이미 각각 1점으로 평가한다. 18-003/sub1도 이와 같게 복원한다.',
 '19-001/sub1':'주어진 보기 중 세 비인증업무의 명칭만 선택하면 각 1점이다.',
 '19-003/sub1':'목적·이용자·경영진 조치라는 세 수임 이해사항이 각각 1점이다.',
 '19-004/sub2':'세 업무에 적용할 수행기준의 이름을 각각 연결하면 1점이다. 일반 적용조건을 발문이 주었으므로 이를 다시 설명하도록 가점하지 않는다.',
};
const dependence={
 'pilot-14-002/sub1':{'crit3.p2':['crit3']},
 'pilot-16-008/sub1':{'crit2':['crit1'],'crit2.p2':['crit1'],'crit4':['crit3']},
 'pilot-18-002/sub1':{'crit4.p2':['crit1']},
};
function closure(k,ids){const x=new Set(ids);for(let i=0;i<3;i++)for(const id of [...x])for(const child of dependence[k]?.[id]||[])x.add(child);return x;}
function atom(s,q,c){return overrides[key(s.id,q.id)+'/'+c.id]||changes.get(key(s.id,q.id))?.units[c.id]||c.claim.split(/(?<=\.)\s/)[0];}
const audit=[];const cases=[];
function add(s,q,id,kind,answer,met=[],contradicted=[],target=null,reason=''){
 const k=key(s.id,q.id);const yes=closure(k,met);const no=new Set(contradicted);
 const expected_judgments=q.criteria.map(c=>({criterion_id:c.id,verdict:no.has(c.id)?'contradicted':yes.has(c.id)?'met':'not_met'}));
 cases.push({id:k+'/'+id,set_id:s.id,subquestion_id:q.id,kind,target_criterion_id:target,answer,expected_score:expected_judgments.filter(j=>j.verdict==='met').length,expected_judgments,reason});
}
for(const s of sets){
 let modified=false;
 for(const q of s.subquestions){
  const old=before.find(x=>x.id===s.id).subquestions.find(x=>x.id===q.id);const k=key(s.id,q.id);const ch=changes.get(k);const cl=cm.get(k);
  const units=q.criteria.map(c=>({criterion_id:c.id,answer:atom(s,q,c),points:1,source_ref_ids:c.source_ref_ids,requirement_id:c.requirement_id}));
  const min=ch?units.map(u=>u.answer):old.model_answer;
  const large=q.criteria.length>=17;
  audit.push({set_id:s.id,subquestion_id:q.id,parent_topic_id:s.classification.topic_id,question_style:cl.question_style,topic_ids:cl.topic_ids,
   style_decision:'maintain',style_reason:cl.reason,standalone_prompt:cl.standalone_prompt,case_fact_ids:cl.case_fact_ids,
   decision:ch?'adjust':'maintain',before_points:old.criteria.reduce((n,c)=>n+c.max_points,0),after_points:q.criteria.length,
   reason:ch?ch.reasons.join(' '):maintenance[s.id.replace('pilot-','')+'/'+q.id],
   prompt_before:old.prompt,prompt_after:q.prompt,prompt_changed:false,model_answer_changed:false,original_model_answer:old.model_answer,
   minimum_sufficient_answer:min,answer_standard:'문장·표현 수가 아니라 아래 독립 의미 단위를 누적한다. 조건으로 주어진 사실은 필수 재진술하지 않으며, 명시적 반대는 관련 명제에서만 판정한다.',
   required_units:units,criterion_mapping:old.criteria.map(c=>ch?.maps.find(m=>m.old_criterion_id===c.id)||{old_criterion_id:c.id,new_criterion_ids:[c.id],old_claim:c.claim,reason:'기존의 완결된 독립 요구와 1점 계약 유지'}),
   burden:{mode:cl.question_style==='case'?'사실 적용과 판단·근거 서술':q.type==='enumeration'?'지정 범주/명칭 재현':'기준서상 관계·절차·조건의 서술',independent_units:q.criteria.length,writing:large?'한 물음의 서술 부담이 높음; 논리적인 하위 물음으로 분리 권고':q.criteria.length>=8?'여러 범주를 빠짐없이 서술하는 부담이 있음':'현재 물음 범위에서 통상적인 서술량',inference:cl.question_style==='case'?'주어진 사실을 해당 기준에 연결해야 함':'새 사례 판단은 필요 없으며 기준서의 일반 적용조건을 보존함'},
   comparability:ch?'같은 하위 필드·평가 속성에는 1점, 조건을 포함한 하나의 행위나 동의 표현에는 중복 점수 없음':maintenance[s.id.replace('pilot-','')+'/'+q.id],
   split_recommendation:large?(s.id==='pilot-15-002'?{reason:'서술량이 큰 18점 물음',groups:[{range:'700.13(a)~(c)',scope:'회계정책 공시·일관성과 적합성·추정치 및 관련 공시',points:7},{range:'700.13(d)~(f)',scope:'재무제표 정보·공시·용어',points:11}],owner:'root; 원 ID 후보에서 실제 새 물음/계보/분류로 통합 예정'}:{reason:'문서화 전체를 한 번에 묻는 28점 물음',groups:[{scope:'목적과 이해 기준',criterion_ids:['crit4','crit5','crit9'],points:3},{scope:'수행절차·결과·증거·유의적 사안·논의 기록',criterion_prefixes:['crit10','crit11','crit12','crit13'],points:17},{scope:'최종파일 취합·보존·수정추가',criterion_prefixes:['crit6','crit7','crit8','crit14','crit15'],points:8}],owner:'root; 원 ID 후보에서 실제 새 물음/계보/분류로 통합 예정'}):null,
   source_review:{direct_quotes_read:old.requirements.map(r=>({requirement_id:r.id,source_ref_id:r.source_ref_id,source_span:r.source_span,quote_sha256:hash(r.source_quote)})),quotes_unchanged:true,new_edition_determination:false,scope:'저장된 직접 인용과 명시 적용조건 안의 배점 수정. 과거 판본 확인 한계는 기존 verification.notes에서 보존.'},
   status:'local_candidate_reviewed_not_model_verified'});
  if(!ch)continue;modified=true;
  const ids=q.criteria.map(c=>c.id);const answers=units.map(u=>u.answer);
  add(s,q,'original-model','original_model_answer',old.model_answer.join('\n'),ids,[],null,'이전 모범답안 원문을 그대로 보존하고 새 독립 명제별로 만점 기대를 대조함. 이전 점수의 자동 승계가 아님.');
  add(s,q,'minimum-complete','complete',answers.join('\n'),ids,[],null,'각 독립 요구를 모두 충족하는 최소 내용의 조합.');
  add(s,q,'blank','blank','',[],[],null,'기입된 답안이 없으므로 모든 명제 not_met.');
  if(q.type==='enumeration')add(s,q,'reverse-one-sentence','equivalent_expression',answers.toReversed().join(' '),ids,[],null,'열거 역순과 한 문장 형식에서도 같은 요구를 충족한다.');
  for(const [i,u]of units.entries()){
   add(s,q,'partial-'+u.criterion_id,'independent_partial',u.answer,[u.criterion_id],[],u.criterion_id,'해당 내용만 쓴 답안의 부분점수. 명시적인 함축 관계는 별도 장부에 따라 함께 인정한다.');
   const left=ids.filter(x=>x!==u.criterion_id),implied=closure(k,left).has(u.criterion_id);
   add(s,q,'omit-'+u.criterion_id,implied?'implication_preserved':'omission',answers.filter((_,n)=>n!==i).join('\n'),left,[],u.criterion_id,implied?'독립된 결론 문장은 지웠으나 남은 조치/관계에서 결론·명칭이 분명하므로 해당 점수 유지.':'다른 요구는 유지하고 이 요구 내용만 삭제하였다. 같은 대상의 의미가 남은 답안에 없는지 대조함.');
   if(implied){const other=units.find(v=>v.criterion_id!==u.criterion_id&&!closure(k,[v.criterion_id]).has(u.criterion_id));if(other)add(s,q,'true-omission-'+u.criterion_id,'omission',other.answer,[other.criterion_id],[],u.criterion_id,'함축을 발생시키는 조치/관계도 포함하지 않은 실제 누락 대조군. 다른 여러 명제도 누락됨을 기대값에 그대로 반영한다.');}
   add(s,q,'contra-'+u.criterion_id,'contradiction',[...answers.filter((_,n)=>n!==i),'“'+u.answer+'”라는 설명은 옳지 않다.'].join('\n'),left,[u.criterion_id],u.criterion_id,'동일 대상의 올바른 요구를 명시적으로 부정한 반대 답안이다. 관련 없는 독립 명제의 점수는 보존한다.');
  }
 }
 if(modified){s.status='needs_review';s.verification.review_status='needs_human_review';s.verification.notes.push('2026-09-11 C 배점 재검토 후보: 독립 답안 단위별 정수 부분점수 복원. 원문·기존 발문·모범답안 보존, 모델 API 미실행. 과거 검수 기록은 이전 판본 이력이다.');}
}
if(audit.some(a=>!a.reason))throw Error('missing manual maintenance reason');
// 바뀐 허용 범위에서 한쪽 답만 적은 원형 및 조건의 실제 차이를 확인하는 집중 대조군.
function extra(sid,qid,id,kind,answer,met,contra=[],target=null,reason=''){const s=sets.find(s=>s.id==='pilot-'+sid);const q=s.subquestions.find(q=>q.id===qid);add(s,q,id,kind,answer,met,contra,target,reason);}
extra('14-002','sub1','component-relation-implies-name','implication','부문중요성은 그룹재무제표 전체중요성보다 낮게 설정한다.',['crit3','crit3.p2'],[],'crit3','관계를 서술한 답안 자체가 부문중요성 명칭을 포함한다. 다른 두 종류를 열거한 것으로는 보지 않는다.');
extra('16-008','sub1','action-implies-judgment','implication','가: 변형근거문단에서 당기수치와 대응수치를 모두 언급한다.',['crit1','crit2','crit2.p2'],[],'crit1','가의 당기 변형근거 작성 조치가 의견변형 판단을 분명히 함축한다.');
extra('16-008','sub2','qualified-only','independent_partial','한정의견',['crit5'],[],'crit5','원래 두 대안을 묶은 0점 대신 한정의견 명칭에 1점. 다른 의견을 배타적으로 부정하지 않았다.');
extra('16-008','sub2','adverse-only','independent_partial','부적정의견',['crit5.p2'],[],'crit5.p2','다른 허용 대안을 누락한 한쪽 명칭도 독립 1점.');
extra('16-008','sub2','exclusive-qualified','exclusive_negation','한정의견만 가능하고 부적정의견은 불가능하다.',['crit5'],['crit5.p2'],'crit5.p2','한정의견 포함은 맞고 부적정의견 배타 부정만 틀렸다.');
extra('19-001','sub2','inquiry-only','independent_partial','주로 질문을 수행한다.',['crit3'],[],'crit3','질문과 분석적절차를 묶지 않아 한 절차만 정확하게 제시한 부분답안에 1점.');
extra('19-002','sub1','audience-only','independent_partial','인증대상책임자가 아닌 의도된 이용자를 대상으로 한다.',['crit2'],[],'crit2','대상 이용자는 맞지만 신뢰수준 향상 목적을 누락한 실제 부분답안.');
extra('19-002','sub2','one-party-only','independent_partial','삼자관계의 인증대상책임자',['crit4.p2'],[],'crit4.p2','당사자 이름을 요구하므로 한 당사자도 1점.');
extra('19-002','sub2','report-written-only','independent_partial','서면 인증보고서',['crit8'],[],'crit8','보고 형식만 맞으며 업무 성격 적합성은 누락되었다.');
extra('19-004','sub1','independence-exception','condition_boundary','비인증업무 자체가 일률적으로 독립성을 요구하지는 않는다. 다만 법규나 계약이 별도로 요구하여도 독립성을 준수할 필요는 없다.',['crit1'],['crit1.p2'],'crit1.p2','일반원칙 점수는 유지하며 별도 요구가 발동한 때의 예외를 부정한 점수만 0.');
extra('15-004','sub2','legal-exception-boundary','condition_boundary','법규가 핵심감사사항 기재를 요구하는 경우에도 의견거절 보고서에 이를 포함해서는 안 된다.',[],['crit10'],'crit10','법규상 별도 요구라는 실제 예외 조건을 변경했다. 기타정보에 대한 답은 없으므로 해당 명제는 not_met.');
extra('15-004','sub1','quantification-boundary','contradiction','재무적 영향을 설명한다. 계량화가 실무적으로 불가능하면 그 불가능 사실을 보고서에 기술하지 않는다.',['crit1'],['crit1.p3'],'crit1.p3','영향 설명은 맞지만 불가능 시 그 사실의 보고를 명시적으로 부정하였다. 실무상 가능 시 계량화 명제는 언급되지 않았다. 단순 반대 사례이며 조건 경계로 세지 않는다.');
extra('16-003','sub2','agree-versus-refuse','condition_boundary','경영진이 수정을 거부한 경우에만 실제 수정되었는지 확인하고, 수정에 동의한 경우에는 확인하지 않는다.',[],['crit5'],'crit5','동의/거부의 실제 분기 조건을 바꾼 경계이며 다른 수정요청·지배기구 조치를 추가로 답한 것은 아니다.');
extra('18-003','sub1','oral-instead-of-written','condition_boundary','구두로만 합의해도 되고 KGA 1200 대신 일반 감사기준서를 대체 적용할 수 있다.',['crit3.p2'],['crit3'],'crit3','적용 방식은 맞지만 서면합의 조건은 명시적으로 틀렸다.');
extra('18-003','sub2','retention-boundary','condition_boundary','최종감사파일 취합이 끝나면 보존기간이 남아 있어도 감사문서를 삭제해도 된다.',[],['crit8'],'crit8','취합 완료와 보존기간 종료를 혼동한 실제 시점 경계. 수정·추가 절차에 관한 답은 없다.');
extra('17-002','sub2','written-with-wrong-recipient','condition_boundary','유의적 미비점과 중요한 취약점은 경영진에게만 서면 보고하며 지배기구에는 보고하지 않는다.',['crit4','crit4.p3'],['crit4.p2'],'crit4.p2','수신자를 일부 배제하여도 맞는 경영진 수신과 서면 방식을 함께 0점으로 만들지 않는다.');
const qa={schema_version:1,reviewer:'C',status:'author_expected_only_api_not_run',model_api_calls:0,source_question_file:out+'/sets.json',cases,
 expectation_policy:'원문에서 선결정한 새 독립 명제 기대값. 합성 답안은 모두 공개 문항으로만 작성. 과거 모범답안 원문 보존. 원점수·옛 결합기준의 0점을 새 하위 명제로 자동 전파하지 않음.',
 implication_dependencies:dependence,condition_boundary_scope:'실제 조건이 다른 분기·시점·예외의 집중 대조군을 포함한다. 단순 명제 부정을 condition_boundary로 재분류하지 않는다. 원문상 독립 조건을 만들 수 없는 명칭/기록 필드는 부분·누락·명시반대로 검사한다.',
 original_model_answers:before.flatMap(s=>s.subquestions.map(q=>({set_id:s.id,subquestion_id:q.id,answer:q.model_answer,old_points:q.criteria.length}))) };
const errors=[];const allkeys=new Set();
for(const a of audit){if(allkeys.has(key(a.set_id,a.subquestion_id)))errors.push('duplicate audit');allkeys.add(key(a.set_id,a.subquestion_id));if(a.after_points!==a.required_units.length)errors.push('audit points');}
const caseids=new Set();
for(const c of cases){if(caseids.has(c.id))errors.push('duplicate case '+c.id);caseids.add(c.id);const q=sets.find(s=>s.id===c.set_id).subquestions.find(q=>q.id===c.subquestion_id);if(c.expected_judgments.length!==q.criteria.length||new Set(c.expected_judgments.map(j=>j.criterion_id)).size!==q.criteria.length)errors.push('QA shape '+c.id);if(c.expected_score!==c.expected_judgments.filter(j=>j.verdict==='met').length)errors.push('QA sum '+c.id);for(const j of c.expected_judgments)if(!q.criteria.some(x=>x.id===j.criterion_id))errors.push('QA unknown '+c.id);}
for(const s of sets){const old=before.find(x=>x.id===s.id);if(JSON.stringify(s.source_refs)!==JSON.stringify(old.source_refs))errors.push('changed source '+s.id);if(JSON.stringify(s.shared_context)!==JSON.stringify(old.shared_context))errors.push('changed facts '+s.id);for(const q of s.subquestions){const o=old.subquestions.find(x=>x.id===q.id);for(const k of ['prompt','model_answer','requirements'])if(JSON.stringify(q[k])!==JSON.stringify(o[k]))errors.push('changed '+k+' '+s.id+'/'+q.id);}}
if(errors.length)throw Error(errors.join('\n'));
const summary={sets:sets.length,questions:audit.length,before_points:before.flatMap(s=>s.subquestions).flatMap(q=>q.criteria).length,after_points:sets.flatMap(s=>s.subquestions).flatMap(q=>q.criteria).length,adjusted_questions:changes.size,maintained_questions:audit.length-changes.size,qa_cases:cases.length,qa_questions:new Set(cases.map(c=>key(c.set_id,c.subquestion_id))).size,model_api_calls:0,errors};
fs.writeFileSync(out+'/sets.json',JSON.stringify(sets,null,2)+'\n');
fs.writeFileSync(out+'/audit.json',JSON.stringify({schema_version:1,reviewer:'C',input_file:base+'/canonical-before.json',input_sha256:hash(fs.readFileSync(base+'/canonical-before.json')),status:'candidate_local_review_only',summary,entries:audit},null,2)+'\n');
fs.writeFileSync(out+'/qa.json',JSON.stringify(qa,null,2)+'\n');
fs.writeFileSync(out+'/static-validation.json',JSON.stringify({summary,source_refs_exactly_preserved:true,facts_exactly_preserved:true,prompts_exactly_preserved:true,original_model_answers_exactly_preserved:true,requirements_exactly_preserved:true,files:['sets.json','audit.json','qa.json','build.mjs','finalize.mjs'].map(file=>({file:out+'/'+file,sha256:hash(fs.readFileSync(out+'/'+file))})),validation_scope:'합산·ID·대상 범위·원본 보존의 로컬 검사이며 모델 의미판정·API·DB 쓰기는 0회이다.'},null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
