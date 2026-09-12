import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root='cpa_uploader/drafts/delegated-authoring-2026-09-11/n02/evidence/phase2/phase-two-v4-proposals/';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const groups={
 't06-a':{
  raw:'t06-a-v4-ten-case-raw-investigation.json',
  decision:'문항·계획의 추가 변경은 제안하지 않는다. 10개 불일치의 원답안·기대값은 유지하고 공통 의미 판정의 함축·대안·구체 대상 경계로 총괄에 전달한다. 승인된 sub3 두 기대값 정정은 현행 실측에서 일치했다.',
  cases:{
   'sub1-crit1-surface-omission-implicit':['model_implicit_conclusion','계좌 변경을 혼자 승인하여 부적절 계좌 변경이 가능하다는 이유는 승인 통제의 독립성 결함을 함축한다. 정해진 결함 명칭 문장 재진술을 별도로 요구하지 않는다.'],
   'sub1-crit2-paraphrase':['model_implicit_conclusion','변경자가 자신의 변경을 승인할 수 있다는 위험 설명은 독립 승인 부재를 함께 나타낸다. 발문은 독립된 두 문장을 요구하지 않는다.'],
   'sub1-crit3-surface-omission-implicit':['model_implicit_conclusion','자기 지급을 자기 기록·대사로 은폐할 수 있다는 구체 위험은 해당 직무분리 또는 독립 검토의 결함을 함축한다.'],
   'sub1-crit4-paraphrase':['model_implicit_conclusion','자기 지급과 기록·대사를 연결한 은폐 위험은 다른 명칭을 반복하지 않아도 이 사례의 분리 결함을 식별한다.'],
   'sub2-crit5-surface-omission-implicit':['model_implicit_control','제3자의 변경 승인과 관련 기록을 남기는 조치는 그 위험에 대한 독립 승인 통제를 포함한다. 기록 명제만을 충족한다고 제한할 이유가 없다.'],
   'sub2-crit6-paraphrase':['model_examples_as_mandatory_list','제3자 승인과 변경 계좌에 대한 지급검토가 연결된 기록은 변경·지급 적정성의 증적이다. criterion의 변경 전후·승인 시점 등은 예시이므로 모두의 명칭을 공동 필수목록으로 요구하지 않는다.'],
   'sub2-crit6-opposite':['model_wrong_neighbor_target','변경·승인 로그의 삭제는 A 계좌 변경 증적의 명시적 반대이다. B 은행대사 독립 검토 기록까지 삭제한다고 쓰지 않았으므로 crit8까지 반대로 확대하지 않는다.'],
   'sub2-crit7-paraphrase':['model_ignored_alternative','자금 이체와 대사 검토 분리 및 인력이 적으면 독립 책임자가 대사·조정을 검토한다는 답은 criterion이 허용한 독립 보완 통제를 충족한다. 직접 기록 기능 분리까지 추가로 요구하면 또는 계약을 그리고로 바꾼다.'],
   'sub2-crit7-surface-omission-implicit':['model_implicit_control','독립 검토와 대사 조정 확인의 흔적은 실제 독립 검토 조치를 포함한다. 통제 조치와 증적을 다른 문장으로 분리하는 것은 요구하지 않았다.'],
   'sub2-crit8-paraphrase':['model_implicit_control','독립된 검토자의 대사 확인 증적은 검토 활동을 함축한다. 명시적으로 활동을 부정한 답과 구별한다.']
  },
  source_basis:['KGA315 보론3.20(src-1d496d64105b41f915): 권한부여·업무분장과 실무상 곤란한 경우 보완 통제','KGA315.26(d)(ii), A176/A177: 적용 관찰·검사와 실행(존재·사용); 기간 운영효과성과 구별'],
  approved_sub3_followup:{file:'qa-cases-t06-a.followup-01.json',cases:67,changed_cases:['sub3-crit9-paraphrase','sub3-crit10-opposite'],current_required_both_matched:true,supplement_file:'qa-supplement-t06-a-implementation-boundaries.json',supplement_unique_cases:5,supplement_executions:15,supplement_matched_executions:15}
 },
 't06-b':{
  raw:'t06-b-v4-seven-case-raw-investigation.json',
  decision:'원문/문항은 유지한다. sub2의 연결 단계 및 sub3 증거 범위의 유효 원답안을 보존한다. sub1의 검토를 승인으로 볼 수 있는지 두 사례는 전체 발문·지문을 포함하여 총괄 독립 판정을 요청한다. 모델의 미일치 횟수를 이유로 기대값을 변경하지 않는다.',
  cases:{
   'sub1-all-paraphrases':['author_expectation_boundary_needs_root','원계획은 독립 승인·사전 테스트 없는 변경과 오류 위험을 묶어 요구한다. 답의 검토·시험 및 독립 점검 부재 표현은 위험 연결을 보이지만 검토가 승인 절차를 뜻하는지에는 경계가 있다. 지문에 독립 사전 승인 부재가 이미 주어졌다는 점도 함께 적용해야 한다. 2/3/3 변동만으로 정답/오답을 정하지 않는다. 원답안을 보존하고 총괄이 승인 요건의 유효 동의어인지 판단한다.'],
   'sub1-crit2-paraphrase':['author_expectation_boundary_needs_root','단독 답의 검토와 시험을 거치지 않은 수정은 승인되지 않거나 잘못된 프로그램 변경 위험과 가깝지만 검토와 승인 자체가 항상 같은 행위는 아니다. 발문이 승인·테스트를 명시하고 있어 검토를 독립 승인으로 무조건 읽지 않는다. 반대로 이미 주어진 독립 승인 부재를 재진술하지 않았다는 이유만으로도 감점하지 않는다. 원문·지문 맥락을 포함한 최종 판정 전 기대값은 변경하지 않는다.'],
   'sub2-all-paraphrases':['model_examples_as_mandatory_list','Q2 원계획과 발문은 응용프로그램·환경→그 위험→그 위험에 대처하는 IT 일반통제의 세 단계 연결을 요구한다. Q1 세 결함의 개선통제를 다시 전수 열거하라고 요구하지 않았다. 접근관리와 변경관리 통제를 앞서 식별한 위험과 연결한 답은 마지막 단계 명제를 충족한다.'],
   'sub2-crit4-opposite':['model_explicit_replacement_as_omission','자동통제와 무관한 모든 컴퓨터를 같은 중요도로 나열하면 관련 IT환경 식별을 대신한다는 답은 관련 대상을 식별해야 하는 명제를 대체하는 명시적 오류이다. not_met가 아닌 contradicted 기대를 유지한다.'],
   'sub2-crit6-paraphrase':['model_examples_as_mandatory_list','그 위험을 막거나 발견하는 접근관리와 변경관리 통제를 연결해 확인한다는 답은 315.26(c)(ii)의 관계를 직접 서술한다. criterion의 승인·테스트·이관분리 등은 본 물음의 공동 필수 열거목록이 아니며 원계획 Q2에도 그 추가 요구가 없다.'],
   'sub2-crit6-opposite':['model_explicit_replacement_as_omission','위험과 무관한 명칭 암기로 위험 대응 통제 식별이 완료된다는 답은 위험-통제 연결을 명시적으로 대체/부정한다. 단순히 그 연결을 언급하지 않은 답과 다르다.'],
   'sub3-crit8-paraphrase':['model_implicit_evidence_limit','한 번 실행 확인한 증거와 기간 중 계속 효과적으로 작동했다는 증거는 다르다는 답은 발문이 묻는 증거 범위 한계를 표현한다. 기간 전체 운영효과성의 입증이라고 확대할 수 없다는 의미를 특정 결론 문장이나 설계라는 단어 재진술로 제한하지 않는다.']
  },
  source_basis:['docs/plans/question-authoring-by-topic-2026-09-11/topics/topic-06.md L33: Q1은 결함+위험; L34: Q2는 세 단계 연결; L35: Q3 실행 확인만으로 기간 효과성까지 입증 안 됨','KGA315.26(b)(c) src-8255896e6aab367667: 식별된 IT환경의 관련 위험 및 그 위험에 대처하는 IT 일반통제','KGA315 A166 src-6c554c461256560580/A173 src-650ca2254c12b5e48e/보론6.2 src-7c3f3ebc114e489c97: 승인되지 않은 변경 위험과 ITGC 예시','KGA315 A180 src-6188b7e39abb34ce59: 설계·실행과 운영효과성 테스트 구별']
 }
};
for(const [name,g] of Object.entries(groups)){
 const rawFile=root+g.raw,d=read(rawFile);
 if(d.cases.length!==Object.keys(g.cases).length)throw Error('Case count mismatch');
 const report={created_at:new Date().toISOString(),status:'manual_reasoned_proposal_not_model_validation',set_id:d.set_id,source_raw_file:rawFile,source_raw_sha256:hash(rawFile),question_plan_QA_mutations:0,API_calls:0,source_basis:g.source_basis,decision:g.decision,approved_sub3_followup:g.approved_sub3_followup||null,cases:d.cases.map(c=>{const [classification,reason]=g.cases[c.case_id]||[];if(!classification)throw Error(c.case_id);return {case_id:c.case_id,original_answer:c.answer,original_expected:c.expected,actual_scores:c.scores,minimum_three_preserved:c.runs.length>=3,classification,reason,proposed_current_input_change:null,raw_evidence_file:rawFile};})};
 fs.writeFileSync(root+name+'-v4-reasoned-adjudication.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 const lines=[`# ${d.set_id} 현행 v4 채점 불일치 수동 대조`, '',g.decision,'','기존 원답안·원 QA·모델 3회 원시 결과를 보존했다. 이 문서는 수동 원인 분류이며 모델 실측 통과나 총괄 승인으로 보지 않는다. 문항/계획/QA 수정 및 API 호출은 0회다.','',...g.source_basis.map(x=>'- '+x),'',...report.cases.flatMap(c=>[`## ${c.case_id}`,'',`${c.classification}. 실측 점수 ${c.actual_scores.join('/')}점.`, '',c.reason,''])];
 fs.writeFileSync(root+name+'-v4-reasoned-adjudication.md',lines.join('\n'),{flag:'wx'});
}
