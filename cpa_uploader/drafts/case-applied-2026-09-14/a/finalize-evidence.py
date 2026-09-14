import json, hashlib
from pathlib import Path

ROOT=Path(__file__).resolve().parents[4]
D=ROOT/'cpa_uploader/drafts/case-applied-2026-09-14'
O=D/'a'
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def jsha(v): return hashlib.sha256(json.dumps(v,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
def write(name,v): (O/name).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
sets=read(O/'sets.json'); reviews=read(O/'review.json'); designs=read(O/'design.json')
units={u['id']:u for u in read(D/'source-catalog-final.json')['units']}
notes=[
 ('30·60일 결제와 2월에 지급될 12월 매입을 지우면 왜 1월 20일 검사가 부족한지 적용 이유를 완성할 수 없다.','07의 위험 대응 절차와 08의 완전성에 관련되는 증거 방향이다.','검사기간 보완과 결제주기상의 증거 공백을 묻고 그 두 의미만 채점한다.'),
 ('청솔의 기말 0잔액과 당기 주요 공급업체라는 상반된 두 자료를 대조해야 제외 판단과 선정방법을 완성한다.','09의 외부조회 대상 선정과 08의 누락 모집단 탐색이다.','제외 판단·선정 보완·기말 장부만 사용한 한계를 구별하며 조회발송 통제 목록이나 의견은 묻지 않는다.'),
 ('한빛의 12월·1월 납품과 1월 10일 지급을 구별해야 누락을 확정할 수 없는 대안을 설명한다.','07의 추가 검증 절차와 08의 증거 관련성 및 기간귀속이다.','판단·관련 증빙과 기간 대조·차기 매입 대안의 세 의미를 요구한다. 단순 차기지급 확인을 절차 완성으로 인정하지 않는다.'),
 ('일반질문서 답변 제한과 사건별 직접회신 허용이라는 실제 규칙의 범위를 적용해야 전면 포기 대신의 방법을 정한다.','09 법률고문과의 직접 커뮤니케이션 및 질의서 설계이다.','전면 포기 판단과 허용 범위에 따른 세부질문서 선택을 요구하며 포함사항의 전체 목록은 다음 물음의 목표로 분리한다.'),
 ('초안에는 목록·진행여부·회신 경로만 있고 내부 결과평가·재무추정은 별도 검토표에 있다. 이 차이를 바탕으로 이미 포함된 사항을 제외하고 보완한다.','09 KGA501.A23의 세부질문서 내용에 직접 연결한다.','결과평가·재무영향·평가 타당성 확인·목록 오류 보충의 네 정보목적이며 이미 기재된 목록과 발송자를 중복 배점하지 않는다.'),
 ('서면회신 이후에도 계약조항·책임 범위가 복잡하고 양측 전망이 다르다는 사실이 추가 논의 필요성의 판단 근거이다.','09 KGA501.A24의 법률고문 회합 필요성 판단이다.','회합 검토를 배제한 주장 판단과 이 사건의 예상 결과를 논의할 이유만 요구한다. 대면이 항상 의무가 아니라는 해설에 추가점수를 주지 않는다.'),
 ('조건 없는 검토 이메일, 약정·재무자료 부재, 새봄의 계열사 채무 증가, 해든의 지원 의존도가 각각 증거 보완 대상과 연결된다.','12 KGA570.A16·A19의 중요한 제3자 지원에 관한 증거 평가이다.','약정 존재·조건, 법적 효력, 제공능력이라는 세 대상만 요구한다. 서면조회 고려를 유일한 방법이나 무조건 동시수행 의무로 확대하지 않는다.'),
 ('실제 지원조건 미확정 사실과 주석의 지원추진·정상영업 전망 문구를 대조해야 누락된 계획 상태와 위험 설명을 찾을 수 있다.','12 KGA570.19의 경영진 계획 및 중요한 불확실성 공시이다.','부모에 누락 목록을 제시하지 않고 실제 주석을 주었다. 현재 기재된 현금유출·만기를 반복하면 점수가 없으며 누락된 세 의미를 보완한다.'),
 ('상황 가의 증거확보·공시문구는 fact3과 fact4에, 상황 나의 대체절차 소진·증거공백은 fact4에 있다. 알려진 공시왜곡과 가능한 미발견왜곡을 독립적으로 적용한다.','12 계속기업 공시와 15 KGA705.5·8·9의 의견변형 원인·전반성 판단이다.','두 상황을 비교하는 한 목표를 의견·근거 각 1점으로 다루고 별도 통지·전체 보고서 문구는 요구하지 않는다. 한정의견을 고르려면 필요한 비전반성 조건이 사례에는 없다.'),
]
for r,(fact,topic,prompt) in zip(reviews,notes):
 s=next(s for s in sets if s['id']==r['set_id'])
 q=next(q for q in s['subquestions'] if q['id']==r['subquestion_id'])
 refs={u for c in q['criteria'] for u in c['source_ref_ids']}
 r['set_content_sha256']=jsha(s)
 r['question_content_sha256']=jsha({'facts':s['shared_context'],'question':q})
 r['source_quote_hashes']={x['id']:x['content_hash'] for x in s['source_refs'] if x['id'] in refs}
 r['check_rationales']={
  'fact_dependency':fact,
  'topic_alignment':topic,
  'prompt_answer_alignment':prompt,
  'criterion_source_alignment':'모든 criterion의 직접 근거와 보충 근거를 source_refs 및 requirements에 대조하였다. '+', '.join(sorted(refs))+'; 직접 요구와 관련 적용자료를 구별하고 학습 해설은 사례 적용의 보충 근거로 사용한다.',
  'source_edition':'design.json의 해당 세트 official_edition_comparison에 기록한 2026 공식 원문 본문·적용자료를 기존 등록 인용과 실제 대조하였다. 570.A16·A19는 2026 직접 발췌이고 2025 등록 문구는 동일 정답 내용을 확인하여 재사용한다.',
  'integer_partial_credit':'각 독립 명제에 1점, 미충족·반대는 해당 명제 0점이다. 판단과 조치·이유를 구분하되 함축 결론을 인정하고 명시적 반대 결론만 판단점수에서 제외한다. 이유가 독립적으로 맞으면 전부 0점으로 묶지 않는다.',
  'point_validity':r['rationale'],
  'representative_expectations':'저장 모범답안을 전체 criterion과 대조하여 '+str(len(q['criteria']))+'점, qa.json의 부분답안은 해당 met_criterion_ids만 충족하고 오답·빈 답안은 0점으로 판정하였다. 실제 Luna 채점과 빈 답안 실행 검사는 상위 배치에서 수행하며 이 장부는 내용 기대값 검토이다.'
 }
 r['unresolved']=[]
 old_rationale=r['check_rationales']
 d=next(d for d in designs if d['set_id']==s['id'])
 r['checks']={key:'pass' for key in ['source','answer','prompt','points','style','topics','edition','nonduplication']}
 r['check_rationales']={
  'source':old_rationale['criterion_source_alignment'],
  'answer':old_rationale['representative_expectations']+' '+old_rationale['integer_partial_credit'],
  'prompt':old_rationale['prompt_answer_alignment'],
  'points':old_rationale['point_validity'],
  'style':old_rationale['fact_dependency'],
  'topics':old_rationale['topic_alignment'],
  'edition':old_rationale['source_edition'],
  'nonduplication':d['plan']['existing_question_difference']+' 기존 비교 물음의 발문·답안·criterion·배점은 design.compared_existing_sets에 보존한다.'
 }
write('review.json',reviews)

for d in designs:
 d['comparison_snapshots']=[{'file':str(p.relative_to(ROOT)).replace('\\','/'),'sha256':sha(p),'role':role} for p,role in [(D/'bank-before.json','authoring_bank'),(D/'catalog-before.json','learning_catalog'),(D/'classification-before.json','classification_snapshot')]]
 if d['set_id'].startswith('case-09-legal'):
  d['official_edition_comparison']['ranges']=[r for r in d['official_edition_comparison']['ranges'] if not r['locator'].startswith('KGA501.10')]
  d['official_edition_comparison']['ranges'].insert(0,{'start_line':17786,'end_line':17801,'locator':'KGA501.10 PDF417~418','conclusion':'식별한 소송의 중요왜곡표시위험 및 직접 커뮤니케이션, 경영진 작성·감사인 발송·직접 회신, 법규상 금지 시 대체절차의 조건을 2026 본문에서 대조함.'})
  d['new_case_points'][2]['decision']='조정: 판단·논의 목적 2점. 일률 의무 아님을 별도 점수에서 제거'
 if d['set_id'].startswith('case-12'):
  d['learning_source_comparison'][0]['comparison']='2022 CPA 문제5 물음1의 상황3은 중요한 불확실성 공시부족, 상황4는 모회사 지원능력·확약 증거부족이다. 신규는 공시누락을 학생이 실제 주석에서 찾고 영향의 전반성 사실을 추가하여 각각 부적정의견과 의견거절을 선택하도록 심화한다.'
  d['learning_source_comparison'][1]['comparison']='2022 CPA 문제5 해설의 공시부족→한정/부적정과 증거부족→한정/의견거절 구분을 대조하였다. 신규는 영향범위를 별도 사실로 주어 의견계열의 선택까지 확정한다. 원물음의 추가 보고문단 선택은 이 초안에 요구하지 않는다.'
  d['adjacent_source_exclusions']=[{'file':'cpa_uploader/data/회계감사_통합학습자료/03_문제연습/고급_회계감사_연습.md','file_sha256':sha(ROOT/'cpa_uploader/data/회계감사_통합학습자료/03_문제연습/고급_회계감사_연습.md'),'original_question':'2024 GS2 문제6 물음2·3','question_lines':[7638,7716],'answer_lines':[7745,7801],'pages':[232,233,234,235,236],'relation':'adjacent','reason':'다른 증거문제로 의견거절하면서 별도로 확인한 계속기업 불확실성의 문단 처리와 여러 불확실성의 예외를 다룬다. 이 초안은 별도 보고문단·KGA705.10의 예외를 요구하지 않으므로 그 빈도를 직접 전용하지 않는다.'}]
write('design.json',designs)

A='cpa_uploader/data/회계감사_통합학습자료/04_기출문제/기출문제_연도별_해설_A.md'
G='cpa_uploader/data/회계감사_통합학습자료/03_문제연습/고급_회계감사_연습.md'
proposals=[
 dict(element_id='element-1b1e5ca9366b379e',source_unit_ids=['src-ca392542d5d3425f18','src-52dfce196f620f4099','src-1518221249f4db39b5','src-d17a554e2fd22ebefe'],set_id=sets[0]['id'],subquestion_id='sub1',criterion_ids=['sub1.c1','sub1.c2'],relation='direct',reason='2017 CPA 문제6 물음4(1)의 현장 철수일까지 후속지급 검토를 실시한 절차의 보완을 직접 적용한다. 신규는 30·60일 결제와 2월 지급 사실을 보태 대상기간 확대의 이유를 적용하도록 한다. 같은 세트의 0잔액 업체선정·기간귀속 물음까지 이 요소의 직접 범위로 늘리지 않는다.',original_question_ids=['cpa_exam:2017:6:4'],frequency_kind='past_exam',reprint_treatment='동일 2017 기출의 교재 재수록은 한 원출제로 센다. 2024 GS 모의의 응용은 모의로 별도 구분한다.',source_locations=[dict(file=A,start_line=17584,end_line=17610,page=446),dict(file=A,start_line=17807,end_line=17809,page=451)]),
 dict(element_id='element-10d426452e3fee77',source_unit_ids=['src-8395284d7f416232f1','src-3514bebaf4f2357ca6','src-44f467e33f86e29fb5','src-290ef959185110bc59'],set_id=sets[1]['id'],subquestion_id='sub1',criterion_ids=['sub1.c1','sub1.c2'],relation='adjacent',reason='2024 GS2 문제5 물음2는 세부질문서 대신 일반질문서를 발송하는 상황과 일반질문서 내용을 요구한다. 신규는 일반질문서 회신만 금지된 반대 경계에서 세부질문서 선택을 판단한다. 질의형식 선택이라는 인접 목표를 공유하지만 원물음 전체와 직접 같은 요구로 표시하지 않는다.',original_question_ids=['mock:2024:GS2-5:2'],frequency_kind='mock_adjacent',reprint_treatment='고급연습의 동일 GS 물음 재수록은 같은 원출제이며, 기출 0회나 미연결만으로 새로운 요구를 미출제로 확정하지 않는다.',source_locations=[dict(file=G,start_line=6212,end_line=6237,page=190),dict(file=G,start_line=6285,end_line=6295,page=192)]),
 dict(element_id='element-70afd6069836bef0',source_unit_ids=['src-6f49af9b641f466372','src-db67536f9703564453','src-43f2f13c6e8997734d','src-3d8845cddb0c2ba942','src-fc35744e458b64dae9','src-56c706b48bbd5c9e4e'],set_id=sets[2]['id'],subquestion_id='sub3',criterion_ids=['sub3.c3','sub3.c4'],relation='partial',reason='2022 CPA 문제5 물음1 상황4의 모회사 지원능력·확약서 증거부족에 대한 의견 판단에 대응한다. 신규는 가능한 영향이 자산 대부분과 주요 부채에 걸친다는 사실로 의견거절과 이유를 확정한다. 추가 보고문단 선택은 제외하므로 요소 전체에는 일부 대응이다. 상황 가의 알려진 공시왜곡과 비교하도록 심화하지만 그 요구까지 이 요소에 직접 연결하지 않는다.',original_question_ids=['cpa_exam:2022:5:1'],frequency_kind='past_exam',reprint_treatment='연도별 해설 A와 B의 2022 문제5는 동일 원기출이며 한 번으로 센다. 모의·연습 수와 합산하지 않는다.',source_locations=[dict(file=A,start_line=7741,end_line=7780,page=201),dict(file=A,start_line=7790,end_line=7815,page=202)])
]
elements={e['id']:e for e in read(ROOT/'cpa_uploader/analysis/question-elements/question-elements.json')['elements']}
for p in proposals:
 p['review_status']='needs_review'
 p['target']={'scope':'draft','file':'cpa_uploader/drafts/case-applied-2026-09-14/a/sets.json','set_id':p['set_id'],'subquestion_id':p['subquestion_id'],'criterion_ids':p['criterion_ids']}
 p['element_snapshot_sha256']=jsha(elements[p['element_id']])
 p['source_hashes']={u:units[u]['contentHash'] for u in p['source_unit_ids']}
 for l in p['source_locations']:l['file_sha256']=sha(ROOT/l['file'])
write('coverage-proposals.json',proposals)
print('9 semantic review rows and 3 coverage proposals finalized')
