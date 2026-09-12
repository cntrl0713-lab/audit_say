from pathlib import Path
import json,hashlib,os,datetime
B=Path(__file__).resolve().parent;ROOT=Path.cwd()
def read(p):return json.loads(Path(p).read_text(encoding='utf8'))
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def repo(p):return Path(p).resolve().relative_to(ROOT).as_posix()
def link(label,p):return f'[{label}]({os.path.relpath(Path(p).resolve(),B).replace(chr(92),chr(47))})'
def dump(name,obj):(B/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
manifest=read(B/'build-manifest.json');freq=read(B/'frequency-evidence.json');static=read(B/'static-validation-01.json')
setmap={o['plan_id']:read(B/o['file']) for o in manifest['outputs']}
relations=[
('element-5d1ca019e7d2fb20','T17-B','sub2',['crit3','crit4'],'partial','2023 원발문은 회사의 개선통제 운영평가를 감사인이 지적하는 문제다. 새 물음은 감사인의 테스트 계획으로 주체를 바꾸고 동일한 평가기준일·당기 운영기간 한계를 적용한다. 8건이라는 원문 수치나 회사 평가규정을 감사인 표본 최소치로 승격하지 않는다.'),
('element-d7777757fcd1f465','T17-B','sub2',['crit3'],'direct','2019 원발문 중 평가기준일 가까운 테스트와 기간 테스트의 균형 요구를 직접 적용한다. 원물음의 중요성·설계테스트 등 다른 항목은 포함하지 않는다.'),
('element-d7777757fcd1f465','T17-B','sub3',['crit5','crit6'],'adjacent','기중 테스트 후 추가증거와 낮은 잔여기간 위험의 질문가능성은 같은 시기 축의 심화이며, 2019 원발문이 A68을 직접 출제한 것으로 세지 않는다.'),
('element-1baaf21ec64d2ae0','T17-B','sub1',['crit2'],'direct','2024 원발문④의 개별 통제별 의견 증거책임을 직접 판별한다.'),
('element-1baaf21ec64d2ae0','T17-B','sub1',['crit1'],'adjacent','실증결과 무왜곡과 선정통제 자체의 테스트는1100.41의 별도 직접명제이며, 이2024요소의 기출빈도를 그대로 부여하지 않는다.'),
('element-03569b50e6f37ed2','T18-A','sub1',['crit1','crit2','crit3','crit4','crit5','crit6'],'broader','모의2024GS1-2:4의 예시 제외후3개 열거를 전체6범주 요구로 확대했다. 같은 교재280·331재수록은 모의1회로 유지한다.'),
('element-6e4e5e4694361bfb','T18-A','sub2',['crit7','crit8','crit9','crit10'],'direct','필수암기200의 규모정의를 직접 설명한다. 파일명OX라도 현재origin.kind=practice여서 별도연습수록으로 유지한다.'),
('element-6e4e5e4694361bfb','T18-A','sub3',['crit11','crit12','crit13'],'partial','기존 정의를 자산/매출이경계값과같은세사례에 적용하는 심화다. 사례3개를 독립 출제횟수로 세지 않는다.'),
('element-03569b50e6f37ed2','T18-A','sub3',['crit14'],'adjacent','연결작성 질적제외를 실제수치와 결합하는D사례는 열거모의의 적용확장이다. 원모의의제외예시와동일직접문제라고 주장하지 않는다.'),
('element-4885d195f12cba9f','T19-A','sub1',['crit2'],'direct','2015:8:2의 결론빈칸을 전체형식반기재무제표의 결론초안 수정으로 변형한다. 기준명·분석적절차 빈칸은재출제하지않는다.'),
('element-a00398a4176dc20b','T19-A','sub2',['crit3'],'direct','2015:8:1 중 서면진술 생략 주장을 직접 판단한다.'),
('element-0493607fb29f9b7a','T19-A','sub3',['crit4','crit5'],'direct','2015:8:1 중 검토라는이유만으로중요성완화 주장을 판단하고 실제판단근거를 설명한다.'),
('element-d2b8f09383972908','T19-A','sub2',['crit3'],'direct','OX5·10의 서면진술 입수명제를 직접 대조한다. OX2건을 기출횟수에 합산하지 않는다.')]
rels=[]
for eid,pid,sqid,cids,rel,why in relations:
 s=setmap[pid];q=next(q for q in s['subquestions'] if q['id']==sqid);rids={o['record_id'] for o in freq['occurrences'] if o['element_id']==eid}
 sources=sorted({u for r in freq['records'] if r['id'] in rids for u in r.get('source_unit_ids',[])}|{u for c in q['criteria'] if c['id'] in cids for u in c['source_ref_ids']})
 rels.append(dict(element_id=eid,source_unit_ids=sources,target=dict(scope='draft',file=repo(B/f"draft-{s['id']}.json"),set_id=s['id'],subquestion_id=sqid,criterion_ids=cids),relationship=rel,reason=why,review_status='needs_review',evidence_files=[repo(B/'scope-and-sources.md'),repo(B/'frequency-evidence.json')]))
dump('coverage-proposal.json',dict(artifact_type='s06_coverage_proposal',version=1,status='proposal_only',relationships=rels))
scope='''# S06 범위·빈도·기존 은행 대조

2027년 CPA 시험 대비, 현재 확보한 공식 근거와 명시한 2026년 사례를 기준으로 작성했다. 실제 모델 검수·채점 전인 `draft_ready`이며 정본 반영이나 2027 시험당국의 모든 판본 지정을 뜻하지 않는다.

T17-B는 2+2+2=6점, T18-A는 6+4+4=14점, T19-A는 2+1+2=5점이다. 모든 criterion은 1점이다. 잠정25점을 유지하되 독립 열거명제를 점수상한 때문에 합치지 않았다.

## 원발문과 새 요구의 관계

다음 빈도는 기출/모의/별도 연습수록/OX를 구별한다. 미확정 연습수록을 새 독립기출로 합산하지 않는다. 세트 전체가 아닌 물음·criterion 범위에 관계를 부여한다.

| 실제 요소 | 기출·연도 | 모의 | 연습수록 | OX | 대표 원발문·페이지 | 새 요구의 관계 |
|---|---|---:|---:|---:|---|---|
| element-5d1ca019e7d2fb20 |1·2023|0|0|0|2023:3:2, 연도별A141 L5338–5350|T17-B-Q2 partial: 회사평가→감사인테스트 주체변형|
| element-d7777757fcd1f465 |1·2019|0|0|0|2019:5:1, A342 L13532–13557|Q2 균형 direct; Q3 잔여기간 adjacent|
| element-1baaf21ec64d2ae0 |1·2024|0|0|0|2024:2:1, A80 L2926–2945|Q1 B direct; A의무왜곡/자체테스트 adjacent|
| element-03569b50e6f37ed2 |0|1|0|0|2024:GS1-2:4, 고급연습280/331|T18-A-Q1 broader:3→6범주; Q3 D adjacent|
| element-6e4e5e4694361bfb |0|0|1|0|ox-memory-200, 필수암기91 L2754–2757|Q2 direct; Q3 A~C partial|
| element-4885d195f12cba9f |1·2015|0|1*|0|2015:8:2, A546 L21701–21724|T19-A-Q1 결론 direct|
| element-a00398a4176dc20b |1·2015|0|1*|0|2015:8:1, A545 L21684–21696|Q2 direct|
| element-0493607fb29f9b7a |1·2015|0|1*|0|2015:8:1, A545 L21684–21696|Q3 direct|
| element-d2b8f09383972908 |0|0|0|2|ox-review-005/010, 필수암기150|Q2 direct, 기출과 별도|

별표 연습수록은 `origin.kind=unknown`인 주제별연습583/584/587쪽의 해당 발문 기록이며 원출제 미확정이다. 필수암기200은 이름에 OX가 있어도 현재 `origin.kind=practice`인 서술형 재무요건 발문이다. OX5·10은 같은 명제의 수록2건이고 기출2회를 뜻하지 않는다. 원발문·source_unit_ids·재수록 관계와 입력 해시는 아래 기계장부에 보존한다.

## 물음별 설계 경계

T17-B-Q1은1100.41의 선정통제 자체 테스트(실증 무왜곡만으로 대체 불가)와1100.40의 각 관련경영진주장별 선정통제 증거/개별 통제별 의견 책임 구분이다. 원계획에서40과41의 설명 연결이 뒤바뀌어 공식문단대로 교정했다. Q1은 판단과 해당 원칙을 결합하는 관계 명제 각각1점이며 ‘부적절’만 쓰면 충분하지 않다.

T17-B-Q2는43의 시기·기간 균형과A66의 평가기준일 전 새 통제의 충분한 시행을 적용한다.2023 원기출은 회사 평가의 실제8개 표본을 주었지만 새 감사인 문제에 고정8개나 최소개월 규칙을 넣지 않았다. 다음 해 새 거래를 당기 운영기간에 자동 합산할 수 없다는 적용 해석과, 다음 해 입수한 당기 운영증거의 일률 금지는 구별한다. Q3은44의 필요한 추가증거 결정1점과A68의 낮은 잔여위험 질문가능1점이다. A67의 네 요소는 평가한 사실로 주고 열거득점으로 다시 요구하지 않는다. 계획의 막연한 ‘절차 적합성’을 실제 조건분기로 구체화했다. A59 최초 증거의 질문불충분과A68 잔여기간 예외의 충돌 답안을 QA에 넣었다.

T18-A-Q1의 여섯 범주 전체와Q2의 규모기준은 공식1200.2를 직접 따른다. 사례에서 여섯 정답 범주를 미리 나열하지 않았고A/B/C의 질적 제외 없음만 전제로 주었다. 금융회사·사업보고서·지정·연결작성의 법적 범위는 실제 법률조문으로 대조하되 조문번호 암기나 지정세부사유를 추가점수로 묻지 않는다.11조1항 지정은 회사의 자유선임 또는 모든 종류의 지정과 다르다. Q2는 개별/별도 기준1, 직전연도말 자산200억 미만1, 직전연도 매출100억 미만1, 또는1이다. Q3은 A매출/B자산/C양쪽등호/D연결작성의 각 결론·결정적 이유 결합1점이다. 적격은1200을 적용할 수 있는 범위이며 서면합의에 의한 일반기준 선택을 금지하는 뜻이 아니다.

T19-A는 해당 기업의 독립된 연간감사인이 수행하는 전체형식 반기검토이다.46(8)의 공정표시 결론을 쓰며 요약형식46-1의 단순작성 결론과 구분한다. Q1은 나머지 종결절차도 완료했다는 전제에서만 결론을 작성하고, 진행 중 서면진술을 생략한 채 검토를 완료했다고 암시하지 않는다. ‘제한적 확신’과 공식보론의‘보통수준의 확신’은 동의표현이다. Q2는 진술의무 한 명제, Q3은 완화주장 판단과 정보·이용자 요구라는 판단근거 두 명제다. 이유가 판단을 함축하면 별도 결론단어 누락을 감점하지 않으며, 명시적 반대결론과 독립된 이유는 분리평가한다. 연간감사 중요성 금액을 반기에 그대로 복사하는 규칙은 없다.

## 현재 은행·선행 패키지

- pilot-17-003/sub1/crit1~2는 통합감사 두 목적, sub2/crit3~7은 설계·운영효과성 항목이다. N06 pilot-17-005/sub1~3/crit1~8은 중요한 취약점·범위제한·서면진술 거절의 의견과 보고다. 해당 명제는 새 득점에서 제외한다. N06과 동일한2026-12-31평가기준일을 유지한다.
- pilot-18-001/subq1/crit1~2의 비적격시 일반기준 적용,18-002/sub1/crit1~4의 자격상실 후속조치,18-003/sub1/crit1~3 및18-004/sub1~2/crit1~4의 준수표명·서면합의를 반복 출제하지 않는다. 새 자격요건과경계판단이 그 선행 전제를 채운다.
- pilot-19-001/sub2/crit2의 제한적확신은Q1의 의도된 복습 부분이다. crit3의 주절차/추가절차는 묻지 않는다.19-004/sub2/crit3~5의 기준명은 사례로 주며 점수화하지 않는다. S01 pilot-03-006/sub1~3/crit1~7의 감사업무 변경·해지·관련서비스 보고 제한과도 다르다.

S01 scope 문서의 ‘S06 T18-A 중간재무제표 검토’는 계획ID 표기 오류다. 실제 대응은 **T19-A**이며 본 인계에서 이를 명확히 한다. 과거 인계 파일·해시 자체는 덮어쓰지 않았다.

## 검증 상태와 후속 실행

정적검사와 작성자 기대 QA는 실제 모델 의미검수나 실제 채점이 아니다. 각 criterion 완전·동의·진짜누락·반대·조건경계와 물음별 빈답안·역순·한문단·한문장·무관문장 접두, 열거중복 및 판단함축/명시충돌을 포함했다. 모델입력400000자 상한을 명시하여 전체 비교은행을 전달하고 직접35refs 및 필수 보충문맥이 실제 요청객체에 도달하는지 확인했다. 최종49 비교은행과 코드·모델·원문 해시 고정 후 실제 의미검수·생성사례 및 작성자QA 전체 채점·불일치 수정·재채점을 진행한다.
'''
scope+='\n근거 장부: '+link('원발문·빈도 입력',B/'frequency-evidence.json')+' · '+link('현재14세트 발문·답안·criterion 대조',B/'existing-comparison.json')+' · '+link('관계13개 제안',B/'coverage-proposal.json')+' · '+link('상세계획',ROOT/'docs/plans/question-authoring-by-topic-2026-09-11/assignments/s06.md')+' · '+link('공통 계약',ROOT/'docs/plans/question-authoring-by-topic-2026-09-11/assignments/common.md')+'\n'
(B/'scope-and-sources.md').write_text(scope,encoding='utf8')
evidence='# S06 수동 원전·판본·문맥 증거\n\n자동 생성 source packet이 아닌 수동 저작의 근거 장부다. 원전의 실제 문단을 등록 source_refs에 연결했으며 version1 계획을 통해 필수 보충문맥도 모델 입력에 전달한다. 공식 등록파일과 직접 source ID는 아래 목록을 따른다.\n\n'
evidence+='KGA1100/1200 선택27문단의2025·2026 전문 대조는 '+link('비교 전문',B/'sources/kga-edition-comparison.json')+'에서 확인한다. 페이지는2025전문 기준이며2026대응은27쪽 뒤다.1200.2각주 정의는 등록3의원전각주에 놓여 있어2와3을함께전달한다. 1100.43은862–863쪽연속원문, A53은운영빈도까지이어진문맥, A67~68은889쪽이다.\n\n'
evidence+='중간검토2015-20고시는 '+link('FSC 다운로드 원본 HWPML',B/'sources/interim-2015.hwp')+'에서추출했다. 파일확장자HWP이나HTML오류가아닌유효XML이다. 시행2015-07-01,2015-06-30타법개정·67재검토기한신설. '+link('KICPA2014 OLE 원본',B/'sources/interim-2014.hwp')+' 및 '+link('선택문단 비교',B/'sources/interim-edition-comparison.json')+'로대조했다. 9말미절제목유무를제외한선택본문은동일하다.2015공식첨부에는보론4전문이없으므로 '+link('2014 보론4 전체',B/'sources/interim-2014-annex4.txt')+'를그판본그대로보충문맥에넣었다. 과거2015미확보로그를소급변경하지않았다.\n\n'
evidence+='1200법적인용은 '+link('현행 법률대조',B/'sources/legal-edition-check.json')+' 및원문HTML에보존했다. 외부감사법은시행2025-04-01 법률20896호,자본시장법159조는시행2026-08-04 법률21324호의현재본문이다. 회사의질적지위는사실로주므로별도산업전체정의나법정감사의무판정을추가하지않는다. '+link('모델에 직접 전달하는 보충문맥',B/'sources/dependency-context.json')+'에는법률원문·URL·해시·보론4전체와해석범위를함께넣었다.\n\n'
evidence+='공식등록 요청의 입력원본·해시는 '+link('등록제안',B/'source-registration-proposal.json')+'에있고 실제ID·등록SHA는 '+link('KGA 등록 결과',ROOT/'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/source-registration-s06-kga1100-1200.json')+' / '+link('중간검토 등록 결과',ROOT/'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/source-registration-s06-interim-2015.json')+'를따른다.\n\n| 세트 | 공식문단 | 실제 source ID | 파일·등록 locator |\n|---|---|---|---|\n'
for o in manifest['outputs']:
 s=setmap[o['plan_id']]
 for key,id in o['source_map'].items():
  ref=next(r for r in s['source_refs'] if r['id']==id)
  evidence+=f"|{o['plan_id']}|{key}|`{id}`|{link(Path(ref['file']).name,ROOT/ref['file'])} · {ref.get('page','')}|\n"
evidence+='\n각요구의최소연속인용과실제줄범위는물음requirements에있다. 등록문단에포함된후속절제목·각주는원문대로보존했으며별도득점명제로삼지않는다. 필수의존문맥은source_refs/plan.scope.conditions로전달하고수동문서만남기는방식을쓰지않았다.\n'
(B/'manual-source-evidence.md').write_text(evidence,encoding='utf8')
dump('typecheck-01.json',dict(artifact_type='s06_typecheck_evidence',version=1,command='npx tsc --noEmit --incremental false',exit_code=0,stdout='',stderr='',evidence='Executed in shared repository during S06 phase1; unified exec chunk f0f077, exit0,8.2261622seconds. No source mutation by this command.',model_calls=0))
handoff='# S06 1차 인계\n\n**draft_ready:3세트·9물음·25criterion·25점, 작성자QA144사례. 실제모델의미검수·채점0회.**\n\n|계획ID|실제ID|물음배점|QA|산출물|\n|---|---|---|---:|---|\n'
outs=[]
for o in manifest['outputs']:
 s=setmap[o['plan_id']];qf=B/f"qa-cases-{o['plan_id'].lower()}.json";qa=read(qf);pf=B/(o['file']+'.authoring-plan.json');pts=[sum(c['max_points'] for c in q['criteria']) for q in s['subquestions']]
 handoff+=f"|{o['plan_id']}|{o['set_id']}|{' + '.join(map(str,pts))}|{len(qa['cases'])}|{link('문항',B/o['file'])} · {link('계획',pf)} · {link('QA',qf)}|\n"
 outs.append(dict(plan_id=o['plan_id'],set_id=o['set_id'],file=repo(B/o['file']),draft_sha256=sha(B/o['file']),authoring_plan_file=repo(pf),authoring_plan_sha256=sha(pf),qa_file=repo(qf),qa_sha256=sha(qf),questions=o['questions'],criteria=o['criteria'],points=o['points'],qa_cases=len(qa['cases']),status='draft_ready',source_ref_ids=[r['id'] for r in s['source_refs']]))
handoff+='\n현재단일활성후보를총괄ID장부에서선택한149세트(비교146+본인3)에대해형상·원문인용·도메인·ID/발문충돌오류0. 세트별CLI3개통과,TypeScript통과. 직접35refs와수동의존문맥을실제검수입력에전달했으며입력길이는337538/260644/288371자로400000상한이내였다. 이비교본은최종49확정본이아니므로2차에새은행해시로재준비한다.\n\n'
handoff+='주요변경:1100.40/41번호연결정정, T17-B-Q3을낮은잔여위험A68사례로구체화,2023회사평가→감사인계획변형을partial로표시, 중간검토2015공식HWPML전문확보, 전체형식46(8)결론적용,1200숫자/법적인용확인. 세부범위·기출관계·기존criterion차이는 '+link('범위 장부',B/'scope-and-sources.md')+'에있다.\n\n'
handoff+='총괄후속: '+link('coverage13관계 제안',B/'coverage-proposal.json')+'을검토해공용links/snapshot에통합한다. SourceCatalog전체fingerprint가등록후변하면최종문항/계획/검수입력을다시확인한다. 모델의미검수와그생성QA뿐아니라작성자QA144전체실측·불일치수정·재채점이남아있다. 사람승인·정본편입·게시·배포는실행하지않았다. S01범위문서의S06 T18-A중간검토표기는T19-A가맞다는정정을후속문맥으로남겼다.\n\n'
handoff+='증거: '+link('정적검사',B/'static-validation-01.json')+' · '+link('CLI',B/'cli-validation-01.json')+' · '+link('TypeScript',B/'typecheck-01.json')+' · '+link('공식원전',B/'manual-source-evidence.md')+'\n'
(B/'handoff.md').write_text(handoff,encoding='utf8')
dump('handoff.json',dict(artifact_type='s06_phase_one_handoff',version=1,created_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),package='S06',status='draft_ready',totals=dict(sets=3,questions=9,criteria=25,points=25,provisional_points=25,point_delta=0,author_qa_cases=144,live_model_cases=0),outputs=outs,model_calls=0,semantic_review='not_run',live_grading='not_run',human_approval=False,publication=False,validation=dict(static_file=repo(B/'static-validation-01.json'),static_sha256=sha(B/'static-validation-01.json'),cli_file=repo(B/'cli-validation-01.json'),cli_sha256=sha(B/'cli-validation-01.json'),typecheck_file=repo(B/'typecheck-01.json'),typecheck_sha256=sha(B/'typecheck-01.json'),max_input_chars=400000),artifacts=[dict(file=repo(B/f),sha256=sha(B/f)) for f in ['scope-and-sources.md','manual-source-evidence.md','coverage-proposal.json','frequency-evidence.json','existing-comparison.json','sources/dependency-context.json']],next_steps=['Wait for parent final49 comparison bank and runtime hashes','Prepare semantic review with manual version1 plan only','Run all generated cases and all author QA cases','Fix mismatches and rerun changed final input','Parent coverage/source integration; no bank promotion']))
(B/'README.md').write_text('# S06 작업 묶음\n\n3세트·9물음·25점의 수동 초안이다. 준비상태 `draft_ready`; 실제모델 검수·채점은 전체49 비교은행 확정 후 진행한다.\n\n'+link('인계 요약',B/'handoff.md')+' · '+link('범위·빈도·기존문항',B/'scope-and-sources.md')+' · '+link('공식 원전·문맥',B/'manual-source-evidence.md')+' · '+link('기계 인계',B/'handoff.json')+'\n\n현재폴더만쓰기범위이며공용원문등록은총괄이수행했다. `sources/`는공식다운로드와읽기전용추출/대조,`tools/python/`는이폴더내HWP파싱용olefile0.47종속성을보관한다. 정본편입·게시·배포를실행하지않았다.\n',encoding='utf8')
print('handoff',len(outs),'coverage',len(rels))
