# S03 1차 인계

**draft_ready: 5세트·13물음·62점·작성자 QA274사례.** 공식 원문과 계획을 결속한 수동 초안이며 실제 의미검수·모델채점은 미실행이다. 전체49 최종 비교은행 고정 후2차를 재개한다. 정본편입·게시·배포하지 않았다.

| 계획 ID | 실제 초안 | 물음별 점수 | 합계 | QA | SHA-256 |
|---|---|---|---:|---:|---|
| T09-C | [pilot-09-009](pilot-09-009.json) | 5 / 6 / 4 | 15 | 65 | `93e9aceca1819927f807e0534c9f6b0f74743e6ba7201fb84b3ddca69ede948a` |
| T09-D | [pilot-09-010](pilot-09-010.json) | 3 / 7 / 2 | 12 | 56 | `f861d70d3e83d783bbea8727a8909ec134599e25799aab419f83144f928af55f` |
| T05-C | [pilot-05-010](pilot-05-010.json) | 2 / 4 | 6 | 30 | `a699b391505b0878f4009578162fcfe76f67747edefbc54a4b513a21ab62f4e0` |
| T13-B | [pilot-13-010](pilot-13-010.json) | 4 / 8 / 6 | 18 | 74 | `c171dd5452c333e4a9a4efe3ccfc4abd1fa1a826f0ac8b1ff914b96dd83eafd0` |
| T13-C | [pilot-13-011](pilot-13-011.json) | 9 / 2 | 11 | 49 | `6572951367efc00c51d784ed09249bc7b1cc253acc5fdda5f08a0b46116eb82d` |

[총괄49행 ID 장부](../../../analysis/reviews/delegated-authoring-2026-09-11/id-ledger.json)의 S03 배정과 일치한다. [lineage](lineage.json)는13개 계획물음과 실제subquestion,초안·계획·QA·수동근거 해시를 보존한다. 초안 상태는needs_review/needs_human_review이며 사람확인이나 제작완료 상태가 아니다.

잠정36→62점(+26)이다. [변경표](design-changes.json)에 각 물음의 독립명제와 분리 근거를 남겼다. 소송의 질문상대/문서군, 법률고문 소통조건/경로, 기초채권 주장/일부증거 한계, 내부감사업무의 개별 평가, 서비스보고서·실제테스트의 기간 및 보충통제의 독립 평가를 발문에 명시했다. 같은 배분결정의 활용축소/직접업무확대는1점이고 유형 정의 등 주어진 사실은 배점하지 않는다.

[정적 검사](static-check.json), [CLI 검사](cli-validation.json), [전역자료 탐색과 관계검사](inventory-and-relations-check.json)는 오류0이다. 정본+S03 메모리검증,등록 인용의 exact 일치,version1계획,ID/정수합계/QA형상/해시,62criterion별조건경계와 비빈답not_met,명시data+drafts탐색 및 동일ID/발문 충돌을 확인했다. 전체49의 의미적 중복검수 결과로 확대하지 않는다.

400,000자 명시 한도에서 준비용111세트+S03로 무호출 입력을 구성했다. 순서대로 247,860 / 246,766 / 211,373 / 288,341 / 282,624자이며 공식 등록 메타데이터를 모두 확인했다. 기본160,000자 설정이나 비교은행·공식본문을 줄이지 않았다. 최종비교본으로 다시 준비해야 한다.

공식 [등록파일](../../../data/official/delegated-s03-kga-2025.txt)의 SHA-256은 `cc98d534ed8a81cdaf625502c0177d1d193ce7b5193763acd97b3e538a96fbaf`이다. 선택98문단의89개는 공백제거 기준 동일하고9개는 각주 번호·기준서 제목 차이이다. [판본과 범위](scope-and-sources.md)에 실제 확인과 한계를 구분했다.250.10은 양판본 모두202X를 유지하므로 시행일을 추정하지 않고 가상법규 두 유형의250.6/14~16 책임 적용으로 한정했다.610의 국내 직접적 보조 금지를 유지하며 공식23/24와 학습요약22/23을 구별한다.

모델에 필요한 의존문맥은 실제source_refs에,조건·판본판단과 제한은 version1 plan에 들어간다. 각 `.json.authoring-plan.json`을--plan으로 전달하며 수동evidence-packet을--packet으로 넘기지 않는다. 별도 근거장부가 자동 모델입력이라고 가정하지 않았다.

[빈도 증거](frequency-evidence.json)는9요소를13관계행으로 연결하되 반복행을 빈도에 가산하지 않는다. 필수암기/OX 교재 심화18 수록1개와 원출처 미확정 연습711쪽을 기출/모의로 바꾸지 않았다. [원발문·해설15문맥](learning-original-context.json), [정본23세트 대조](comparison-notes.json)를 읽어 차이를 기록했다. 특히T09-D/Q3 상황A는정본09-001/subq1/crit2의 의도된 직접복습1점이며 새 공백으로 주장하지 않는다. [coverage 제안](coverage-proposal.json)의 실제element/src/draft/criterion을 확인했으며 전부needs_review다. 최종snapshot·공통links는 총괄 소유다.

[선행·후속 범위](peer-scope-handoff.md)는 R01 재고시차/조회필수,R02 지배기구 커뮤니케이션,N04 전문가620,N02 일반통제 개념과의 경계를 담았다. [2차 체크포인트](phase2-followups.md)의 누락함축·OR조건·독립평가·시점경계를 실제모델로 확인하고 불일치는 원문/기대값/문항/엔진을 구분하여 수정·재실측한다.

API 호출0회다. 키는.env.local 로드 후 존재만 확인했고 값은 기록하지 않았다. 실제 모델은 총괄 runtime의 gpt-5.6-luna를 따른다. [실행입력](execution-inputs.json)은 현재코드·정책·원문해시이며2차에다시고정한다. S03 작업의 쓰기는s03/에 한정했다. R01/N05 QA후속은 총괄 소유이며 변경하지 않았다.
