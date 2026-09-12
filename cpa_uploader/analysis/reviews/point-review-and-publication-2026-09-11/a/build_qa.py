"""Compile manually specified semantic expectations; no inference/model/API execution."""
import json, hashlib
from pathlib import Path
P=Path(__file__).resolve().parent
ROOT=P.parents[4]
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
sets=read(P/'sets.json');audit=read(P/'audit.json')
Q={(s['id'],q['id']):q for s in sets for q in s['subquestions']}
A={(e['set_id'],e['subquestion_id']):e['atoms'] for e in read(P/'qa-atoms.json')['questions']}
def K(short,sub):return ('pilot-'+short,'sub'+str(sub))

# Short answers are intentionally minimal meaningful statements, not fragments copied from claim prose.
A[K('01-004',1)]={
 'crit1':'해당 정보를 회계법인에 커뮤니케이션해야 한다.',
 'crit2':'정보 전달의 목적은 회계법인과 업무수행이사가 필요한 조치를 취할 수 있게 하는 것이다.',
 'crit5':'전달의 시급성은 신속히 해야 한다는 것이다.'}
A[K('01-004',2)]={'crit3':'전문직 기준과 해당 법규에 따라 감사를 수행할 수 있는 적격성과 역량이다.','crit4':'해당 상황에 적합한 감사보고서를 발행할 수 있는 능력이다.'}
A[K('02-001',1)]={'crit1':'경영진을 신뢰해도 전문가적 의구심의 유지 필요성은 경감되지 않는다.','crit2':'경영진을 신뢰해도 설득력이 낮은 감사증거에 만족할 수 없다.'}
A[K('03-001',2)]={'crit5':'감사업무 조건 변경 요청의 정당성을 고려한다.','crit6':'감사업무 범위제한의 시사점을 고려한다.'}
A[K('03-004',1)]={'crit1':'재무제표 작성에 적용되는 재무보고체계의 수용가능성을 결정한다.','crit2':'경영진이 자신의 책임을 인정하고 이해한다는 점에 대해 경영진의 동의를 받는다.'}
A[K('03-004',2)]={'crit3':'문단 19의 예외를 제외하고, 재무보고체계가 수용가능하지 않다고 결정한 경우에는 수임해서는 안 된다.','crit4':'경영진의 책임 인정·이해에 관한 동의를 받지 못한 경우에는 수임해서는 안 된다.','crit5':'법규에 의해 감사가 요구되는 경우에는 이 수임 금지가 적용되지 않는다.'}

# Logical entailments evaluated from the complete answer, not old parent verdict propagation.
implies={
 K('02-004',2):{'crit5':['crit4']},
 K('05-002',2):{'crit7':['crit4']},
 K('05-006',2):{'crit3':['crit2'],'crit4':['crit2']},
}
def close(k,ids):
 ids=set(ids)
 while True:
  add={a for c in ids for a in implies.get(k,{}).get(c,[])}-ids
  if not add:return ids
  ids|=add

cases=[]
def add(k,cid,kind,answer,met=(),contra=(),target=None,note='',provenance=None):
 met=set(met);contra=set(contra);assert not met&contra
 criteria=Q[k]['criteria'];allids={c['id'] for c in criteria};assert (met|contra)<=allids
 ev=[{'criterion_id':c['id'],'verdict':'contradicted' if c['id'] in contra else 'met' if c['id'] in met else 'not_met','reason':'답안 전체가 해당 독립 명제를 직접 또는 분명한 함축으로 충족함' if c['id'] in met else '해당 명제를 명시적으로 부정함' if c['id'] in contra else '요구된 독립 명제가 실제 답안에 없음'} for c in criteria]
 rec={'id':f'{k[0]}-{k[1]}-{cid}','set_id':k[0],'subquestion_id':k[1],'kind':kind,'answer':answer,'expected_points':sum(c['max_points'] for c in criteria if c['id'] in met),'expected_verdicts':ev,'note':note,'execution':'not_run'}
 if target:rec['target_criterion_id']=target
 if provenance:rec['provenance']=provenance
 cases.append(rec)

def paraphrase(t):
 replacements=[('문서화한다','감사문서에 기록한다'),('식별한다','파악한다'),('시급성은 신속히 해야 한다는 것이다','시급성은 지체 없이 해야 한다는 것이다'),('여전히 적합한지 결정한다','계속 적합한지 판단한다'),('있는지 결정한다','있는지 여부를 판단한다'),('제시한다','밝힌다'),('설명한다','기술한다'),('수행한다','실시한다'),('입수한다','확보한다'),('커뮤니케이션해야 한다','전달할 의무가 있다'),('경감되지 않는다','줄어들지 않는다'),('만족할 수 없다','충분하다고 받아들일 수 없다'),('할 수 있는 능력이다','할 수 있어야 한다는 것이다'),('적격성과 역량이다','적격성과 능력이다'),('금지가 적용되지 않는다','금지의 예외에 해당한다'),('고려한다','검토한다'),('평가한다','평가할 필요가 있다'),('토의한다','논의한다'),('존재한다','남아 있다'),('판단한다','결정한다'),('완전히 제거할 수는 없다','완전한 제거는 불가능하다'),('위험이다','위험을 의미한다'),('함수이다','함수 관계를 가진다'),('포함된다','포함되는 것이다'),('감사절차이다','감사절차를 의미한다'),('아니라고 설명한다','아님을 밝힌다')]
 for x,y in replacements:
  if x in t:return t.replace(x,y)
 return None

manual_synonyms={
 ('01-002',2,'crit5'):'독립성 정책·절차를 어긴 정보를 살펴 그 위반이 해당 감사의 독립성을 위협하는지 판단한다.',
 ('01-002',2,'crit6'):'안전장치로 독립성 위협을 없애거나 받아들일 수 있는 수준까지 낮춘다.',
 ('01-002',2,'crit7'):'또는 해지가 적합하다고 보이고 법규에서도 허용한다면 그 감사의 계약 해지 조치를 취한다.',
 ('01-002',2,'crit8'):'적절한 조치로도 해결되지 않으면 지체 없이 회계법인에 알린다.',
 ('01-004',1,'crit2'):'그 취지는 회계법인과 업무수행이사가 필요한 대응을 할 수 있게 하는 데 있다.',
 ('02-004',2,'crit3'):'감사위험을 같은 수준으로 두면 평가된 중요왜곡표시위험이 클수록 허용하는 적발위험은 작아진다.',
 ('02-004',2,'crit5'):'감사에 내재한 한계로 인해 미발견 가능성을 완전히 없애지는 못한다.',
 ('03-002',1,'crit1'):'법률이나 규정에서 수임을 의무화한 때는 예외이다.',
 ('03-002',1,'crit2'):'그런 범위제약이 붙은 업무는 감사로 받아들일 수 없다.',
 ('03-004',1,'crit1'):'재무제표 작성기준으로 선택한 체계를 받아들일 수 있는지 판단한다.',
 ('03-004',1,'crit2'):'경영진에게 자신의 책임을 수용하고 그 의미를 이해하고 있다는 동의를 얻는다.',
 ('03-004',2,'crit3'):'문단 19에 정한 예외 외에는 적용 재무보고체계를 받아들일 수 없다고 판단하면 감사를 맡지 않는다.',
 ('03-004',2,'crit4'):'경영진에게 책임의 수용과 이해에 관한 합의를 얻지 못했으면 감사를 맡지 않는다.',
 ('05-001',1,'crit1'):'경영진이 가담했다고 의심되는 부정은 적절한 때에 지배기구에 알린다.',
 ('05-001',1,'crit2'):'감사를 마치는 데 필요한 감사절차가 어떤 종류인지 지배기구와 토의한다.',
 ('05-001',1,'crit3'):'감사를 마치는 데 필요한 감사절차를 언제 할지 지배기구와 토의한다.',
 ('05-001',1,'crit4'):'감사를 마치는 데 필요한 감사절차를 어느 범위까지 할지 지배기구와 토의한다.',
 ('05-002',2,'crit4'):'추정에 경영진의 치우친 판단이 반영되어 있는지 살핀다.',
 ('05-002',2,'crit6'):'전기 재무제표에 반영한 중요한 추정의 경영진 판단과 가정을 거슬러 다시 살펴본다.',
 ('05-005',2,'crit3'):'평가한 부정 관련 중요왜곡표시위험은 유의적 위험으로 간주한다.',
 ('05-005',2,'crit6'):'미실시 부분이 있다면 그 통제가 실제로 도입되어 실행되었는지 확인한다.',
 ('05-006',2,'crit2'):'법적인 형식만 갖췄다는 확인으로는 검토를 끝낼 수 없다.',
 ('05-007',1,'crit1'):'그 상황에서 전문가에게 부과되는 책임과 법에서 정한 책임을 판별한다.',
 ('05-007',1,'crit5'):'선임 당사자 또는 해당되는 감독기관에 알려야 할 의무가 있는지 판단한다.',
 ('05-007',2,'crit6'):'토의에는 감사계약을 끝낸다는 사실을 담는다.',
 ('05-007',2,'crit4'):'전문가의 의무나 법적 의무로서 해지에 관한 외부 보고가 요구되는지 판별한다.',
 ('05-007',2,'crit8'):'외부 보고 의무의 수신자는 감사를 맡긴 당사자, 해당되는 때에는 규제기관이다.',
 ('05-007',2,'crit9'):'외부 보고 의무의 내용은 감사를 그만둔다는 사실을 포함한다.',
 ('06-002',1,'crit1'):'경영진 및 회사 안의 적절한 관계자에게 물으며, 내부감사 조직이 있다면 그 담당자도 질문 대상에 넣는다.',
 ('06-003',2,'crit11'):'직원에게 묻는 것 외의 절차도 실시해 해당 통제가 도입되어 실행 중인지 확인한다.',
 ('06-005',2,'crit3'):'위험과 통제의 특성에 따라 통제가 효과적으로 운영되는지를 시험하는 것 외에는 충분하고 적합한 증거를 얻을 수 없을 수 있다.',
 ('06-005',2,'crit5'):'그런 위험인지를 가려내는 결과에 따라 추가로 할 감사절차의 설계와 수행이 달라지기 때문이다.',
 ('06-005',2,'crit4'):'그 위험에 대응하는 통제가 효과적으로 운영되는 증거를 얻기 위해 통제 테스트를 계획하여 실시해야 한다.'}

for k,aa in A.items():
 ids=list(aa);full=' '.join(aa.values())
 add(k,'full','complete',full,ids,note='모든 독립 요구를 한 답안에 함께 작성한다.')
 add(k,'stored-model-answer','complete',' '.join(Q[k]['model_answer']),ids,note='실제 수정 후보의 저장 모범답안이 만점을 충족하는지 확인할 사례.')
 add(k,'empty','empty','',note='빈 답안; API 호출 없이 0점 처리해야 함.')
 add(k,'irrelevant','omission','감사보고서의 글자 크기를 보기 좋게 맞춘다.',note='빈 문자열이 아닌 무관 답안; 모든 요구가 실제로 누락된다.')
 add(k,'reverse','reverse_order',' '.join(reversed(list(aa.values()))),ids,note='기재 순서로 항목을 자르지 않음; 의미상 조건은 각 문장에 유지.')
 add(k,'duplicate','duplicate',' '.join([full,full]),ids,note='동일 명제 반복은 한 번씩만 득점.')
 for c,t in aa.items():
  met=close(k,[c]);add(k,'only-'+c,'independent_partial',t,met,target=c,note='이 독립 내용만 작성. 같은 답이 다른 판단을 분명히 함축하면 그 판단도 인정한다.' if len(met)>1 else '다른 요구를 쓰지 않은 한쪽 부분정답.')
  remaining=[i for i in ids if i!=c];m=close(k,remaining)
  add(k,'omit-'+c,'implicit_boundary' if c in m else 'omission',' '.join(aa[i] for i in remaining),m,target=c,note='결론 문장을 지웠지만 남은 이유·조치가 결론을 함축하여 누락이 아님.' if c in m else '나머지 독립 정답은 모두 유지하고 이 명제만 실제 누락.')
  negative=f'“{t}”라는 설명은 옳지 않다.'
  add(k,'opposite-'+c,'contradiction',' '.join([aa[i] for i in remaining]+[negative]),set(remaining),[c],c,note='대상 명제에만 명시적 부정을 붙임. 다른 독립 정답은 유지하되 실제 모델에서는 상호 오염 여부도 확인해야 함.')
  pt=manual_synonyms.get((k[0].removeprefix('pilot-'),int(k[1].removeprefix('sub')),c),paraphrase(t))
  if pt:add(k,'synonym-'+c,'paraphrase',pt,met,target=c,note='요구 내용과 조건을 유지한 동의 표현. 접두어만 붙인 원답 재사용이 아님.')

# Directly reviewed contextual/condition and entailment boundaries.
add(K('01-002',2),'withdrawal-illegal','condition_boundary','법규가 감사업무 해지를 허용하지 않아도 해지한다.',[],['crit7'],'crit7','해지의 법규 조건을 뒤집은 경우; 다른 절차의 정답을 임의로 추정하지 않음.')
add(K('01-004',1),'purpose-only','independent_partial','목적은 회계법인과 업무수행이사가 필요한 조치를 취할 수 있도록 하는 것이다.',['crit2'],target='crit2',note='목적만 정확하고 커뮤니케이션 의무·시급성은 실제로 쓰지 않았다.')
add(K('01-004',1),'prompt-action-implies','implicit_conclusion','그 정보를 회계법인에 신속히 전달하여 회계법인과 업무수행이사가 필요한 조치를 취할 수 있도록 한다.',['crit1','crit2','crit5'],note='부적절이라는 결론 문구 없이도 요구된 조치가 독자 처리 불가를 명확히 함축한다.')
add(K('01-004',2),'report-inappropriate','condition_boundary','어떤 보고서라도 발행할 수 있으면 된다.',[],['crit4'],'crit4','해당 상황에 적합한 보고서라는 기준을 명시적으로 부정함.')
add(K('02-001',1),'trust-low-evidence','condition_boundary','경영진이 정직하면 설득력이 낮은 증거에도 만족할 수 있다.',[],['crit2'],'crit2','신뢰를 증거 질 저하 허용으로 바꾸는 조건 오류.')
add(K('02-004',2),'not-fixed-risk','condition_boundary','감사위험 수준이 달라져도 두 위험은 언제나 역관계이다.',[],['crit3'],'crit3','주어진 감사위험 수준이라는 적용 조건을 배타적으로 제거함.')
add(K('02-005',1),'not-important-misstatement','condition_boundary','재무제표가 중요하게 왜곡표시되지 않은 경우에만 부적합한 의견을 표명하는 위험이 감사위험이다.',[],['crit1'],'crit1','정의의 중요왜곡표시 존재 조건을 반대로 바꿈.')
add(K('02-005',2),'prior-to-audit-risk','condition_boundary','적발위험은 감사 착수 전에 재무제표가 중요하게 왜곡표시되어 있을 위험이다.',[],['crit3'],'crit3','감사절차의 미발견 위험을 중요왜곡표시위험으로 교체함.')
add(K('03-001',2),'unconditional-accept-change','contradiction','변경 요청은 언제나 정당하다고 보고 범위제한의 시사점도 검토하지 않는다.',[],['crit5','crit6'],note='두 독립 고려사항을 함께 명시적으로 부정한 답안.')
add(K('03-002',1),'given-fact-only','omission','경영진의 범위제한으로 의견거절이 예상된다.',note='발문에 주어진 사실 반복만으로 수임 판단·예외에 가점하지 않음.')
add(K('03-002',1),'mandatory-exception-denied','condition_boundary','법규가 수임을 요구해도 예외 없이 수임해서는 안 된다.',['crit2'],['crit1'],'crit1','일반 수임 금지 판단은 맞고 법규 예외만 명시적으로 틀림.')
add(K('03-004',1),'management-preparation-only','independent_partial','경영진에게 재무제표 작성 책임만 물어보고 내부통제나 정보 제공 책임에 대한 인정·이해는 받을 필요가 없다.',[],['crit2'],'crit2','경영진의 책임 동의 범위를 일부 책임만으로 배타적으로 축소함.')
add(K('03-004',2),'law-exception-only','independent_partial','법규에 의해 감사가 요구되면 수임 금지가 적용되지 않는다.',['crit5'],target='crit5',note='예외만 맞혔으며 두 금지 사유는 제시하지 않았다.')
add(K('04-001',2),'automatic-pm','condition_boundary','전체 중요성을 낮추면 수행중요성도 자동으로 같은 비율만큼 낮춘다.',[],['crit3'],'crit3','필요성 결정을 자동 인하로 바꾼 오답.')
add(K('04-004',2),'wrong-prospective-document','condition_boundary','이미 수행한 절차가 아니라 앞으로 계획한 절차의 성격·시기·범위만 기록하면 된다.',[],['crit2','crit5','crit6'],note='수행한 절차라는 대상·시점을 계획 절차로 배타적으로 바꿈.')
add(K('05-001',1),'after-audit-only','condition_boundary','감사 완료 때까지 언제나 기다린 다음 경영진 연루 부정을 전달한다.',[],['crit1'],'crit1','적시 전달을 일률적인 지연으로 바꾸는 오답.')
add(K('05-002',2),'reasonable-bias-exempt','condition_boundary','개별적으로 합리적인 판단이면 편의가 부정위험을 나타내는지는 평가할 필요가 없다.',[],['crit7'],'crit7','원문이 명시한 합리적인 개별 판단에서도 편의 가능성을 평가하는 조건을 반대로 바꿈.')
add(K('05-003',2),'all-deficiencies','condition_boundary','보고사항은 감사인이 발견하지 않은 모든 미비점까지 빠짐없이 포함해야 한다.',[],['crit8'],'crit8','감사 중 식별되어 충분히 중요한 미비점으로 제한된다는 범위를 반대로 바꿈.')
add(K('05-005',2),'already-performed-repeat','condition_boundary','위험 대처 통제를 이미 식별하고 설계와 실행을 확인했어도 그 세 활동을 무조건 반복한다.',[],['crit4','crit5','crit6'],note='아직 수행하지 않은 부분이라는 조건을 명시적으로 제거함.')
add(K('05-005',2),'operating-instead-design','condition_boundary','통제 설계의 평가는 운영효과성 테스트로 대신하며 별도의 설계 평가는 하지 않는다.',[],['crit5'],'crit5','설계와 운영효과성을 대체할 수 있다는 오류.')
add(K('05-006',2),'legal-only','contradiction','거래의 형식적 적법성만 확인하면 충분하다.',[],['crit2'],target='crit2',note='추가 평가를 제시하지 않았으므로 그 대상 명제들은 not_met이다.')
add(K('05-007',1),'immediate-withdraw','condition_boundary','법규상 해지 가능성을 확인하지 않고 무조건 즉시 해지한다.',[],['crit2'],'crit2','해지 가능성·적절성 고려를 무조건 해지로 대체함.')
add(K('05-007',2),'always-report','condition_boundary','외부 보고 요구사항이 있는지 판단할 필요 없이 항상 보고한다.',[],['crit4'],'crit4','보고 요구 여부의 결정을 무조건 보고로 대체함; 다른 대상·내용은 누락.')
add(K('06-001',1),'controls-running-definition','condition_boundary','위험평가절차는 기업의 통제를 감사인이 직접 운영하는 절차이다.',[],['crit2'],'crit2','감사위험 식별·평가 목적 대신 기업 통제 운영으로 정의함.')
add(K('06-002',1),'exclude-internal-audit','condition_boundary','내부감사기능이 존재하더라도 위험평가 질문 대상에서 그 기능 담당자를 제외한다.',[],['crit1'],'crit1','존재 시 포함해야 할 내부감사 담당자를 명시적으로 제외함.')
add(K('06-003',2),'inquiry-only','condition_boundary','질문만으로 통제 실행 여부를 결정하며 질문 외 절차는 필요 없다.',[],['crit11'],'crit11','실행 여부 결정의 질문에 추가된 절차라는 방법 조건을 부정함.')
add(K('06-005',1),'names-only','omission','고유위험요소, 재무제표 수준 중요왜곡표시위험.',note='두 요인 명칭만으로 영향의 방법·정도를 고려한다는 네 명제는 충족하지 않는다.')
add(K('06-005',2),'substantive-sufficient-anyway','condition_boundary','실증절차만으로 충분한 증거를 얻을 수 없어도 통제테스트를 수행할 필요는 없다.',[],['crit4'],'crit4','그 위험으로 결정된 때의 통제테스트 의무를 명시적으로 부정함.')

# Preserve decisive historical answer bytes with freshly reasoned child verdicts.
history=[('01','pilot-01-004-omission','sub1',['crit1','crit2','crit5'],[]),
 ('02','judgment-only','sub2',['crit5'],[]),
 ('02','definition-with-wrong-judgment','sub2',['crit3'],['crit5']),
 ('04','materiality-names-without-factors','sub2',['crit3','crit4','crit5','crit6'],[]),
 ('04','common-factors-one-sentence','sub2',['crit3','crit4','crit5','crit6','crit7'],[]),
 ('04','condition-denied','sub2',[],['crit4']),
 ('04','change-without-reason','sub2',['crit6'],['crit7'])]
for topic,cid,sub,met,con in history:
 f=ROOT/f'cpa_uploader/analysis/reviews/question-review-2027/grading-cases/{topic}-cases.json'
 h=next(c for c in read(f) if c['id']==cid);k=(h['set_id'],sub)
 add(k,'historical-'+cid,'historical_regression',h['answers'][sub],met,con,note='원답안 바이트를 보존하고 현재 독립 기준에 따라 새 기대값을 직접 판단했다. 과거 결합 기준 0점/만점을 자동 전파하지 않았다.',provenance={'file':f.relative_to(ROOT).as_posix(),'sha256':sha(f),'case_id':cid,'original_subquestion_id':sub,'old_expected':h.get('expected'),'old_expected_score':h.get('expected_score')})

artifact={'version':1,'artifact_type':'author_expected_judgments','reviewer':'plan_foundations','execution':'local_expected_verdicts_only','sets_file':'sets.json','sets_sha256':sha(P/'sets.json'),'cases':cases,'historical_sources':[{'file':f'cpa_uploader/analysis/reviews/question-review-2027/grading-cases/{t}-cases.json','sha256':sha(ROOT/f'cpa_uploader/analysis/reviews/question-review-2027/grading-cases/{t}-cases.json'),'preservation':'원본 전체 보존; 과거 판정은 새 배점의 정답표로 자동 승계하지 않음'} for t in ['01','02','03','04','05','06']]}
(P/'qa.json').write_text(json.dumps(artifact,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'changed_questions':len(A),'cases':len(cases),'model_api_calls':0},ensure_ascii=False))
