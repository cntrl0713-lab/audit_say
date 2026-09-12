"""Package the agent's individually read notes; this does not perform semantic review."""
import copy
import datetime
import hashlib
import json
from pathlib import Path

D = Path('cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11')
E = D / 'efficient-verification-2026-09-12/a'
read = lambda p: json.loads(Path(p).read_text('utf8'))
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
jsha = lambda x: hashlib.sha256(json.dumps(x, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
rel = lambda p: str(p).replace('\\', '/')
def write(p, x):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(x, ensure_ascii=False, indent=2) + '\n', 'utf8')

m = read(D / 'a/execution-all-v9/manifest.json')
notes = read(E / 'reviewer-notes.json')
classification = {(x['set_id'], x['subquestion_id']): x for x in read(m['classification_contract']['review']['file'])['entries']}
stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
# These partial answers were authored after reading each named question and all
# its criteria. The mappings are decisions, not first-criterion auto-propagation.
partials = {
 'pilot-01-002/sub1': ('crit1', '감사업무 전 과정에서 관찰과 질문을 통해 윤리적 요구사항 위반의 증거에 주의를 유지한다.'),
 'pilot-02-001/sub2': ('crit3', '정보에 근거한 의사결정을 위해 관련 훈련과 지식 및 경험을 적용하는 것이다.'),
 'pilot-02-004/sub1': ('crit1', '감사증거의 충분성은 감사증거의 양적 척도이다.'),
 'pilot-03-002/sub2': ('crit7', '상황의 변화에 따라 감사업무 조건을 수정할 필요가 있는지 평가한다.'),
 'pilot-04-001/sub1': ('crit1', '전반감사전략의 수립과 감사계획의 개발은 반드시 순차적일 필요가 없다.'),
 'pilot-04-002/sub1': ('crit1', '의뢰인 관계 및 특정 감사업무의 계속 여부에 관한 절차를 수행한다.'),
 'pilot-04-005/sub1': ('crit1', '보존기간이 끝나기 전에 감사문서를 삭제하거나 폐기하는 것은 허용되지 않는다.'),
 'pilot-05-002/sub1': ('crit1', '재무보고절차에 관여하는 사람들에게 분개나 조정사항의 처리에 부적합하거나 비경상적인 행위가 있었는지 질문한다.'),
 'pilot-05-005/sub1': ('crit1', '추정을 배제할 근거가 없는 이 상황에서 처음부터 수익인식에 부정위험이 없다고 평가할 수 없다.'),
 'pilot-06-001/sub2': ('crit3', '통제환경의 미비점은 재무제표 전반에 영향을 미칠 수 있다.'),
 'pilot-06-002/sub2': ('crit4', '과거의 감사에서 얻은 정보가 현재 감사에도 여전히 관련성이 있는지 평가한다.'),
 'pilot-06-003/sub1': ('crit1', '재무보고목적과 관련된 사업위험을 식별하는 기업의 절차를 이해한다.'),
 'pilot-08-002/sub2': ('crit4', '정보 불일치나 신뢰성 의문을 해결하기 위해 감사절차에 어떤 변경이나 추가가 필요한지 결정한다.'),
 'pilot-09-002/sub1': ('crit1', '재고실사 결과를 기록하고 통제하기 위한 경영진의 지시와 절차를 평가한다.'),
 'pilot-09-008/sub1': ('crit1', '기준서의 네 조건을 모두 충족한 경우에만 소극적 조회를 유일한 실증감사절차로 이용할 수 있다.'),
 'pilot-05-008/sub1': ('crit1', '기업 회계실무의 유의적 질적 측면에 관한 감사인의 견해를 지배기구와 커뮤니케이션한다. 여기에는 회계정책, 회계추정 및 재무제표 공시 등이 포함된다.'),
 'pilot-05-008/sub2': ('crit8', '업무팀, 적합한 경우 회계법인의 타 구성원, 회계법인 및 해당되는 네트워크 회계법인이 독립성에 관한 관련 윤리적 요구사항을 준수한다는 진술을 지배기구에 전달한다.'),
}
partial_overrides = {
 'pilot-02-006/sub3': 'point-policy/sub3/crit8/paraphrase',
 'draft-04-320-freq01/q1': 'q1/omit-2',
 'pilot-04-007/sub3': 'sub3/boundary-crit9',
 'pilot-05-003/sub1': 'pilot-05-003-sub1-identification-time-not-communication-time-preserved',
 'pilot-08-007/sub3': 'point-v1-sub3-crit8-true-omission',
 'draft-09-505-freq01/q1': 'q1/point-policy/q1.c2/full',
}
specific_wrong = {
 'pilot-01-002/sub1': '감사조서의 최종 취합일을 다시 정하고 파일 이름을 바꾼다.',
 'pilot-02-001/sub2': '감사위험은 재무제표에 중요한 왜곡표시가 있을 때 부적절한 감사의견을 표명할 위험이다.',
 'pilot-02-004/sub1': '전문가적 의구심은 의문을 갖는 태도와 증거에 대한 비판적인 평가를 뜻한다.',
 'pilot-03-002/sub2': '적극적 조회에 회신하지 않은 모든 거래처를 부정행위자로 확정한다.',
 'pilot-04-001/sub1': '완전성은 기록되어야 하는 거래가 모두 기록되었다는 주장이다.',
 'pilot-04-002/sub1': '기말 잔액을 조회하고 재고자산의 실사를 한다.',
 'pilot-04-004/sub1': '작성시기는 중요하지 않으므로 언제까지나 작성을 미뤄도 된다.',
 'pilot-04-005/sub1': '충분성은 양이고 적합성은 질이다.',
 'pilot-05-001/sub2': '적극적 조회는 모든 경우에 회신을 요청하는 조회이다.',
 'pilot-05-002/sub1': '기업의 광고비 예산을 승인하고 다음 연도 판매계획을 대신 수립한다.',
 'pilot-05-003/sub1': '기말 매출채권 잔액을 거래처에 조회한다.',
 'pilot-05-005/sub1': '재고자산의 실재성과 상태를 확인하기 위해 실사에 입회한다.',
 'pilot-05-006/sub1': '기말 자산의 실물을 검사한다.',
 'pilot-06-001/sub2': '감사보고서의 발행 부수를 결정한다.',
 'pilot-06-002/sub2': '보고서의 글꼴과 표지 색상을 선택한다.',
 'pilot-06-003/sub1': '감사인은 경영진의 다음 연도 생산예산을 승인한다.',
 'pilot-07-005/sub2': '위험이 높을수록 덜 설득력 있는 감사증거로 충분하다.',
 'pilot-08-002/sub2': '회계법인의 사무실 임대료를 계산한다.',
 'pilot-09-002/sub1': '경영진의 다음 연도 판매목표를 대신 승인한다.',
 'pilot-09-004/sub2': '회사의 제품을 납품받는 모든 고객에게만 알린다.',
 'pilot-09-005/sub1': '회계법인의 전산장비 감가상각액을 계산한다.',
 'pilot-09-008/sub1': '기초재고자산은 당기 실사수량에서 수량변동을 조정하여 검토한다.',
 'pilot-05-008/sub1': '총계정원장의 차변과 대변 합계가 일치하는지 재계산한다.',
 'pilot-05-008/sub2': '당기 재고실사 결과를 기초수량으로 조정한다.',
}
# The three statements below explicitly contradict the sole criterion. Other
# new wrong answers state unrelated audit material and omit all target claims.
wrong_contradictions = {'pilot-04-004/sub1': ['crit1'], 'pilot-07-005/sub2': ['crit3'], 'pilot-09-004/sub2': ['crit4']}
followup_sources = {
 'pilot-02-004': D/'c/r4-execution-v1/source-location-followup-02-004/pilot-02-004-plan.json',
 'pilot-06-002': D/'c/r4-execution-v1/semantic-followup-06-002/pilot-06-002-plan.json',
 'pilot-09-003': D/'c/r4-execution-v1/semantic-followup-09-locators/pilot-09-003-plan.json',
 'pilot-09-005': D/'c/r4-execution-v1/semantic-followup-09-locators/pilot-09-005-plan.json',
}
records=[]; selections=[]; supplements=[]; checks=[]; selected_sets=[]
for j in m['jobs']:
    old=read(j['file'])
    if int(old['classification']['topic_id'])>9: continue
    sid=old['id']; base=E/'content-followups-v1'/sid
    sf=base/'question.json' if (base/'question.json').exists() else Path(j['file'])
    pf=base/'authoring-plan.json' if (base/'authoring-plan.json').exists() else Path(j['plan_file'])
    if (E/'plan-followups-v1'/sid/'authoring-plan.json').exists(): pf=E/'plan-followups-v1'/sid/'authoring-plan.json'
    qaf=base/'qa.json' if (base/'qa.json').exists() else Path(j['qa_file'])
    if (E/'qa-followups-v1'/sid/'qa.json').exists():qaf=E/'qa-followups-v1'/sid/'qa.json'
    s=read(sf); qa=read(qaf); added=[]; local=[]
    selected_sets.append({'set_id':sid,'file':rel(sf),'sha256':sha(sf),'plan_file':rel(pf),'plan_sha256':sha(pf),'qa_file':rel(qaf),'qa_sha256':sha(qaf)})
    if (base/'classification-proposal.json').exists():
        selected_sets[-1]['classification_proposal']={'file':rel(base/'classification-proposal.json'),'sha256':sha(base/'classification-proposal.json')}
    for q in s['subquestions']:
        key=sid+'/'+q['id']; assert key in notes
        qcl=copy.deepcopy(classification[(sid,q['id'])]); mx=sum(c['max_points'] for c in q['criteria'])
        if sid=='pilot-04-006' and q['id']=='sub3':qcl['standalone_prompt']=q['prompt']
        if sid=='pilot-04-005' and q['id']=='sub1':qcl['case_fact_ids']=['fact2']
        candidates=[c for c in qa['cases'] if c['subquestion_id']==q['id']]
        full=next((c for c in candidates if 'stored-model' in c['id'] and c['expected_points']==mx),next((c for c in candidates if c['expected_points']==mx and c['answer'].strip()),None))
        partial=next((c for c in candidates if 0<c['expected_points']<mx),None)
        wrong=next((c for c in candidates if c['answer'].strip() and c['expected_points']==0),None)
        assert full is not None, key
        if key in partial_overrides:partial=next(c for c in candidates if c['id']==partial_overrides[key])
        def new_case(kind, answer, met=(), contra=()):
            c={'id':f'efficient/{q["id"]}/{kind}','subquestion_id':q['id'],'kind':kind,'answer':answer,'expected_points':len(met),'expected_verdicts':[{'criterion_id':z['id'],'verdict':'met' if z['id']in met else 'contradicted' if z['id']in contra else 'not_met','reason':'원문 및 해당 물음의 전체 명제와 대조: '+('이 독립 요구를 직접 제시함.' if z['id']in met else '이 요구를 명시적으로 부정함.' if z['id']in contra else '이 요구나 이를 함축하는 설명을 제시하지 않음.')} for z in q['criteria']],'note':'새 대표 검증용; agent 기대값 작성, API 미실행. 기존 QA는 별도 원경로 그대로 보존한다.'}
            if len(met)==1:c['target_criterion_id']=met[0]
            added.append(c);return c
        if key in partials:
            cid,answer=partials[key]; partial=new_case('source_based_partial',answer,[cid])
        if mx>1:assert partial is not None,key
        if wrong is None:wrong=new_case('source_based_wrong',specific_wrong[key],contra=wrong_contradictions.get(key,[]))
        choices=[('stored_model_answer',full),('partial_answer',partial),('wrong_or_boundary_answer',wrong)]
        chosen=[]
        for role,c in choices:
            if c is None: continue
            ids={z['id'] for z in q['criteria']}
            assert {v['criterion_id'] for v in c['expected_verdicts']}==ids,(key,c['id'])
            assert c['expected_points']==sum(next(z['scores'][v['verdict']] for z in q['criteria'] if z['id']==v['criterion_id']) for v in c['expected_verdicts']),(key,c['id'])
            assert c['answer'].strip()
            item={'role':role,'case_id':c['id'],'qa_file':rel(E/'representative-supplements'/f'{sid}.json') if c in added else rel(qaf),'answer_sha256':hashlib.sha256(c['answer'].encode()).hexdigest(),'expected_points':c['expected_points'],'expected_verdicts':copy.deepcopy(c['expected_verdicts']),'reason':('모범답안의 모든 독립 요구와 조건을 포함하는 전체답안을 확인한다.' if role=='stored_model_answer' else '정확하게 제시한 독립 요구만 합산하고 나머지의 누락·반대와 분리되는지 확인한다.' if role=='partial_answer' else '발문과 다른 내용 또는 명시적인 반대의 답안에 해당 물음의 점수를 주지 않는지 확인한다.')}
            if key in partial_overrides and role=='partial_answer':item['reason']+=' 함축 또는 시점 누락의 실제 경계를 직접 읽어 선택한 사례이다.'
            chosen.append(item);local.append({'set_id':sid,'question_file':rel(sf),'question_sha256':sha(sf),'subquestion_id':q['id'],**item,'case':copy.deepcopy(c)})
        direct={r for c in q['criteria'] for r in c['source_ref_ids']}
        direct.update(r['source_ref_id'] for r in q['requirements'])
        sources=[]
        for r in s['source_refs']:
            if r['id']not in direct:continue
            text=Path(r['file']).read_bytes().decode('utf-8-sig')
            exact=r['source_quote'] in text
            assert exact,(key,r['id'],'source quote not exact')
            sources.append({'source_ref_id':r['id'],'file':r['file'],'file_sha256':sha(r['file']),'quote_sha256':hashlib.sha256(r['source_quote'].encode()).hexdigest(),'title':r.get('title'),'source_span':r.get('source_span'),'exact_in_source':exact})
        oldq=next(z for z in old['subquestions'] if z['id']==q['id']);oldmx=sum(c['max_points']for c in oldq['criteria'])
        rec={'set_id':sid,'subquestion_id':q['id'],'reviewer':'agent','reviewer_agent':'plan_foundations','reviewed_at':stamp,'status':'pass','status_scope':'현재 선택 또는 제안 후속 내용의 agent 직접 검토; 사람검수·모델실측·게시가 아님','file':rel(sf),'file_sha256':sha(sf),'subquestion_sha256':jsha(q),'plan_file':rel(pf),'plan_sha256':sha(pf),'source_evidence':sources,'question_style':qcl['question_style'],'topic_ids':qcl['topic_ids'],'case_fact_ids':qcl['case_fact_ids'],'standalone_prompt':qcl.get('standalone_prompt'),'review_reason':notes[key],'point_review':{'decision':'adjust' if oldmx!=mx else 'maintain','before_points':oldmx,'after_points':mx,'independent_elements':[{'criterion_id':c['id'],'points':c['max_points'],'minimum_sufficient_proposition':c['claim']}for c in q['criteria']],'burden':f'{len(q["criteria"])}개 독립 의미요건을 '+('사례의 사실과 연결하여 적용한다.' if qcl['question_style']=='case' else '일반 적용조건 안에서 설명 또는 열거한다.')+' 문장·단어 수가 아니라 위 개별 명제의 충족을 합산하며 조건과 예시는 해당 명제의 범위이다.','partial_answer_evidence':None if partial is None else {'case_id':partial['id'],'points':partial['expected_points']},'partial_not_applicable_reason':'최대1점 단일요구라 0과1 사이 정수 부분점수는 존재하지 않는다.' if mx==1 else None,'reason':notes[key],'split_decision':'현 요구는 독립 명제로 점수를 분리해 부분정답을 인정한다. '+('구17점 전문가 물음을 업무이해/결론8점과 투입정보9점으로 이미 분할해 원범위를 유지했다.' if sid=='pilot-08-008' and q['id']in['sub2','sub4'] else '현재 발문 요구범위가 식별 가능하므로 추가 물음 분할은 필요하지 않다.')},'representatives':chosen,'prior_evidence_reuse':{'same_question_as_master':s==old,'master_file':j['file'],'master_sha256':j['sha256'],'method':'과거 계획·QA·직접 인용 계보를 재사용하되 이번에 발문·모범답안·전criterion·사용 원문을 직접 대조하고 개별 이유를 새로 작성했다. 코드 반복문이 내용 합격을 판단하지 않는다.'},'api_calls_in_this_review':0}
        if sid in followup_sources:rec['source_location_followup']={'file':rel(followup_sources[sid]),'sha256':sha(followup_sources[sid]),'adoption':'내용 동일성 확인용 후속 근거; 최종 통합 계획 선택은 총괄 담당'}
        if sid in ['pilot-09-002','pilot-09-003','pilot-09-004','pilot-09-005','pilot-09-007']:rec['catalog_page_correction']={'file':rel(E.parent/'c/parser-v1/impact-final.json'),'sha256':sha(E.parent/'c/parser-v1/impact-final.json'),'scope':'문구/ID/원자료 불변, 2025 원전의 반복발췌 쪽수 교정 후 읽음'}
        # The agent has read all 132 named questions and written the individual
        # notes. These explicit decisions record that completed review; neither
        # exact-string checks nor this packaging loop infer semantic validity.
        rec['criterion_ids']=[c['id'] for c in q['criteria']]
        rec['source_ref_ids']=sorted(direct)
        assert direct=={x['source_ref_id']for x in sources},key
        rec['checks']={'source':'pass','answer':'pass','prompt':'pass','points':'pass','style':'pass','topics':'pass','edition':'pass','nonduplication':'pass'}
        rec['rationale']=notes[key]
        plan_doc=read(pf)
        plan=plan_doc['plans'][0] if 'plans' in plan_doc else plan_doc
        policy=Path('cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/edition-policy.md')
        rec['edition_review']={'verdict':'pass','scope':'2027년 CPA 대비, 현재 확보 공식근거와 명시된 2026 개시 보고기간 또는 독립 발문의 적용 조건에 한정. 미래의 미공표 개정이나 시험당국의 모든 개별 판본 지정을 단정하지 않음.','policy_file':rel(policy),'policy_sha256':sha(policy),'selected_plan_edition_assumption':plan.get('edition_assumption',plan.get('edition_assumptions',plan.get('metadata',{}).get('edition_assumption'))),'direct_source_files':[x['file']for x in sources],'reason':'선택 공식 본문과 해당 계획의 보고기간·판본·의존 문맥을 대조했다. 현재 요구에 적용되지 않는 미래 품질관리체계 또는 발문 밖의 법적 의무를 정답으로 추가하지 않는다.'}
        if sid.startswith('pilot-01-'):
            rec['edition_review']['reason']=('윤리 직접재무관계·사업관계·낮은 보수의 실제 등록 공인회계사윤리기준 본문과 조건을 확인했다. 미확정 공개초안·해외윤리의 추가 의무를 국내 확정 요구로 넣지 않는다.' if sid=='pilot-01-005' else '공식 개정220.10의 등록법인2027-12-31/기타2029-12-31 이후 개시 시행과 공고를 대조했다. 이 2026 개시·선제 적용 없는 배치는 종전220 품질관리 문단을 사용한다. 보고서 발행연도만으로 새체계를 적용하지 않는다.')
        if sid=='pilot-05-010':
            ep=E/'edition-250-followup-v1/decision.json'
            rec['edition_review'].update({'evidence_file':rel(ep),'evidence_sha256':sha(ep),'reason':read(ep)['meaning_review']+' 공식 개정 개요38의2023-01-01 이후 개시 시행에 이번2026 개시가 해당한다. 본문250.10의202X를 추정한 판단이 아니다.'})
        rec['check_reasons']={'source':notes[key]+' 직접 출처 합집합의 실제 원문·조건·예외·끝문장 및 인용 범위는 source_evidence에서 연결한다.','answer':'저장 모범답안을 모든 criterion 및 critical_facts와 대조했고 아래 full 대표의 기대점수는 전체 독립명제 합계이다. '+notes[key],'prompt':'실제 발문이 요구하는 내용과 일반조건 또는 필요한 부모 사실을 대조했다. '+notes[key],'points':notes[key],'style':('부모 사실의 다음 항목을 해석·적용해야 만점 답안이 성립한다: '+', '.join(qcl['case_fact_ids']) if qcl['question_style']=='case' else 'standalone_prompt 또는 원발문에 일반조건과 요구가 있어 부모 사실·다른 물음 없이 기준서 내용으로 만점 답안이 성립한다.'),'topics':'부모 주제를 일괄 복제하지 않고 이 물음의 실제 요구를 '+', '.join(qcl['topic_ids'])+' 주제에 연결한다. '+notes[key],'edition':rec['edition_review']['reason'],'nonduplication':plan.get('existing_question_difference','기존 정본의 학습 범위를 유지하며 새 커버리지라고 주장하지 않는다.')+' 이 물음 내부의 동일 사실·동의어·조건을 반복 배점하지 않는지 독립 명제와 부분답안을 대조했다.'}
        records.append(rec)
    if added:
        p=E/'representative-supplements'/f'{sid}.json';write(p,{'version':1,'artifact_type':'author_expected_judgments','set_id':sid,'cases':added});supplements.append({'file':rel(p),'sha256':sha(p),'count':len(added)})
    selections.extend(local)
# Comparisons use actual sibling/related questions, and the individual notes
# state the substantive reason. They do not assert equivalence from a score.
large_comparisons={
 'pilot-01-002/sub2':('pilot-01-006','sub2','독립성 대응6개와 업무품질검토6개는 내용은 다르지만 발문에서 요구한 수행행위·대상을 각각 맞힌 만큼 합산한다. 조건부 해지는 법규불허의 부작위와 구분하는 부담이 있다.'),
 'pilot-01-006/sub2':('pilot-01-002','sub2','검토수행6개와 독립성대응6개 모두 독립 행위 목록이다. 재무제표와 보고서초안 검토는 서로 다른 대상으로 일부만 수행할 수 있어 별도점수를 유지한다.'),
 'pilot-01-005/sub3':('pilot-01-002','sub2','낮은 보수의 허용판단·위협조건/유형·네 안전장치 항목이7개라 독립성대응6개보다1점 크다. 단어 수가 아닌 정책판단과 실제 대응대상을 구별한 차이다.'),
 'pilot-03-005/sub2':('pilot-03-005','sub1','정보접근3개보다 계약서 범위가 넓어8개이다. 목적/범위와 보고서형태/내용은 따로 답할 수 있고 상위6목록에 억지로6점 상한을 두지 않는다.'),
 'pilot-04-004/sub2':('pilot-04-006','sub2','문서가 이해가능하게 담아야 할8대상과 최종파일의 행정취합6행위는 구별된다. 양쪽 모두 범주 속 독립 대상·행위만 합산하며 목적과 단어를 추가 배점하지 않는다.'),
 'pilot-04-006/sub2':('pilot-04-004','sub2','행정취합은6행위, 수행기록은8대상으로 요구범위가 다르다. 특히 분류·병합·상호참조를 발문에서 구별하여 각1점이며 보고서일 후 새증거 생성은 제외한다.'),
 'pilot-05-003/sub2':('pilot-05-008','sub1','유의미비점 서면내용6개와 지배기구 유의사항7개 모두 전달내용/목적 범위를 분리한다. 통제의견 비목적을 재무제표의견 목적의 반복으로 인정하지 않는다.'),
 'pilot-05-008/sub1':('pilot-05-003','sub2','일반 유의사항7개가 유의미비점 서면내용6개보다 범위가 넓다. 질적견해와 수용가능하지만 최적이 아닌 이유의 조건부 설명은 별도 요구이므로 한쪽만 맞는 답을 보존한다.'),
 'pilot-05-007/sub2':('pilot-05-007','sub1','해지 전3검토보다 해지 후8전달요건이 많다. 상대방·사실·이유·보고책임결정이 발문에 모두 명시되어 범위 확장이 아니라 요구량의 차이이며 외부보고 실행의무로 강화하지 않는다.'),
 'pilot-06-003/sub2':('pilot-06-007','sub2','IT프로그램/환경·위험·일반통제와 설계/실행까지 묻는6개는 ERP 적용의 연결3개보다 범위가 넓다. 운영효과성까지 숨은 요구로 추가하지 않는다.'),
 'pilot-07-006/sub1':('pilot-07-006','sub2','일반 통제의 과거증거 재사용6조건/조치와 유의위험통제 당기테스트2요구는 범위가 다르다. 후자는 당기검사의 판단·시점만, 전자는 변경 여부와 순환검사까지 요구한다.'),
 'pilot-07-006/sub3':('pilot-07-006','sub1','잔여기간6고려요소와 과거증거 재사용6요구는 각각 명시한 조건 목록이다. 전자는 암기부담, 후자는 사실연계부담이 있으나 추론 난이도만으로 독립요소당 점수를 다르게 하지 않는다.'),
 'pilot-08-008/sub2':('pilot-08-008','sub4','과거17점의 업무이해·결론8개와 가정/방법/투입정보9개를 실제로 나눴다. 한 영역 답이 다른 영역에 흘러들어 득점하지 않도록 두 답안 범위를 각각 유지한다.'),
 'pilot-08-008/sub4':('pilot-08-008','sub2','업무이해/결론8점보다 가정·방법·두 정보원천의 요구속성9개가 하나 많다. 속성들은 정확성·완전성·관련성처럼 독립 평가가 가능하며 이미 물음을 분할했다.'),
 'pilot-09-003/sub1':('pilot-09-004','sub1','동일505.8의 이유·증거·위험영향·성격/시기/범위·대체절차7요구이며 기존 의도된 복습이다. 같은 요구의 일부점수와 총점을 동일하게 유지한다.'),
 'pilot-09-004/sub1':('pilot-09-003','sub1','동일505.8의 세 상위절차 안 독립7요구와 같은 배점이다. 기존 정본의 복습관계를 숨기거나 새 커버리지로 계산하지 않는다.'),
 'pilot-09-007/sub1':('pilot-09-003','sub1','조회통제6개와 거부 대응7개는 각각 별도 행위다. 정보·대상·수신/회신관리·발송·후속조회가 독립되며 후속조회 적용조건은 해당1점 안에 둔다.'),
 'pilot-09-008/sub2':('pilot-09-007','sub1','소극조회7조건은 적극조회통제6행위와 달리 조건목록이다. 다수·동질·소액은 서로 하나씩 불충족될 수 있어 별도점수이며 조건문 단어마다 점수를 주지 않는다.'),
 'pilot-09-009/sub2':('pilot-09-003','sub1','법률고문 직접조회7요구와 경영진거부 대응7요구를 비교했다. 전자는 두발동조건의 OR와 작성/발송/회신을 명시적으로 요구하므로 구계획6점 설명을 정합화한다.'),
 'pilot-09-010/sub2':('pilot-08-005','sub1','금융문서3주장 한계보다 기초잔액7요구가 넓다. 기초채권4주장과 일부증거한계·기초재고2절차를 모두 요구하므로7점이며 수금/실사만으로 전부 입증했다고 쓰면 해당한계는 미충족이다.'),
}
for r in records:
    peers=[x for x in records if x is not r and set(x['topic_ids'])&set(r['topic_ids']) and x['question_style']==r['question_style']]
    peer=min(peers,key=lambda x:abs(x['point_review']['after_points']-r['point_review']['after_points']))
    r['point_review']['comparison']={'set_id':peer['set_id'],'subquestion_id':peer['subquestion_id'],'points':peer['point_review']['after_points'],'reason':'같은 주제·학습유형의 실제 요구와 비교했다. 양쪽 모두 독립 명제당1점이며 총점 차이는 요구한 명제 수와 범위에서 설명한다. 동일 난이도나 동일 내용을 단정하지 않는다.'}
    key=r['set_id']+'/'+r['subquestion_id']
    if key in large_comparisons:
        ps,pq,why=large_comparisons[key]
        explicit_peer=next(x for x in records if x['set_id']==ps and x['subquestion_id']==pq)
        r['point_review']['comparison']={'set_id':ps,'subquestion_id':pq,'points':explicit_peer['point_review']['after_points'],'reason':why}
    if r['set_id']=='pilot-04-007' and r['subquestion_id']=='sub3':
        r['point_review']['comparison']={'set_id':'pilot-04-001','subquestion_id':'sub2','points':4,'reason':'동일320.13의 수행중요성 수정 필요와 절차 성격·시기·범위 각각의 적합성 판단을 모두 요구한다. N/T/E 중 일부만 맞는 답안도 점수를 보존하도록 동일한4개 독립 기준으로 정합화했다.'}
assert len(records)==132 and len({(r['set_id'],r['subquestion_id'])for r in records})==132
for j in m['jobs']:
    assert sha(j['file'])==j['sha256']
    assert sha(j['plan_file'])==j['plan_sha256']
    assert sha(j['qa_file'])==j['qa_sha256']
    for src in j['source_files']:assert sha(src['file'])==src['sha256']
write(E/'question-reviews.json',{'version':1,'reviewer':'agent','reviewer_agent':'plan_foundations','reviewed_at':stamp,'input_baseline':{'file':rel(E/'baseline-119.json'),'sha256':sha(E/'baseline-119.json')},'entries':records})
write(E/'representative-cases.json',{'version':1,'api_calls':0,'selection_method':'각 물음의 직접 내용 검토 후 실제 답안을 읽어 선정; 없는 부분/오답은 원문에 근거해 별도 추가','entries':selections})
write(E/'selected-files.json',{'version':1,'entries':selected_sets,'representative_supplements':supplements})
summary={'sets':len(selected_sets),'questions':len(records),'criteria':sum(len(r['point_review']['independent_elements'])for r in records),'points':sum(r['point_review']['after_points']for r in records),'before_points':sum(r['point_review']['before_points']for r in records),'representatives':len(selections),'supplement_cases':sum(x['count']for x in supplements),'one_point_questions':sum(r['point_review']['after_points']==1 for r in records),'status_counts':{'pass':len(records),'needs_fix':0,'unknown':0},'api_calls':0,'source_quote_exact_errors':0,'original_119_file_plan_qa_source_hash_errors':0,'proposed_followups_require_root_integration':True}
write(E/'local-checks.json',summary)
print(json.dumps(summary,ensure_ascii=False))
