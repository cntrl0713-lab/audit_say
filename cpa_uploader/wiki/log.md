# Wiki Log

> Append-only. 형식: `## [YYYY-MM-DD] action | subject`

## [2026-08-08] create | CPA 회계감사 문제 출제 위키 초기화
- 통합 목차 기반 concept 19개 생성
- 기존 107개 문제와 rubric claim을 topic에 연결
- source manifest, coverage map, generation guides 생성
- 계산 문제 제외, 3개 물음 유형, 정수 요소 배점 정책 적용

## [2026-08-08] update | generated pages rebuilt
- concept, source manifest, topic map, coverage map, index 재생성

## [2026-08-24] update | v3 문제은행 기준으로 위키 재생성
- build-wiki.mjs가 cpa_problems_v2.json 대신 cpa_question_sets_v3.authoring.json(65세트)을 읽도록 교체
- concept 페이지에 v3 세트·criterion 연결 현황 기록, coverage-map에 세트/물음/criterion/published 열 추가
- topic-map·index를 v3 분포로 갱신, source-manifest 재계산
- question-generation 가이드의 sources frontmatter를 v3 authoring 경로로 수정

## [2026-08-24] update | 승급 장부 도입
- needs_review→verified→published 전환을 promote_cpa_v3.ts와 promotions.json 장부로 추적 시작
- 기존 published+verified 65세트의 검수 승인을 소급 기록

## [2026-08-24] fix | pilot-15-003 중복 핵심 사실 보정
- validateQuestionSetV3에 subquestion 단위 critical_facts.expected 정규화 중복 검사 추가
- 검사 도입으로 pilot-15-003 sub1의 crit1·crit3이 동일한 '한정의견' conclusion을 요구하는 결함 발견
- KGA 705 의견변형 표의 두 행 - 중요 왜곡표시 트리거와 감사증거 미입수 트리거 - 을 expected에 각각 명시해 원자성 회복

## [2026-08-24] update | v1 잔재 제거
- requirements.txt, rubric_extraction_prompt.md(Perplexity Space v2 절차), drop_v1_and_relink_review_notes.sql 삭제
- data/problem/ 복제본(D1~D3, D4~D6 중복 그룹) 제거하고 회계감사_통합학습자료를 단일 소스로 확정
- README.md를 v3 파이프라인 기준으로 재작성

## [2026-08-24] create | pilot-03-004 수동 제작
- KGA 210 문단 6·8(전제조건 확인 절차와 미충족 시 수임 금지) 소재, 물음 2개·criterion 5개·5점
- validate_draft_v3.ts 단독 검증 도구 추가(은행 교차 발문 중복 검사 지원)
- 은행 계약을 고정 65개에서 하한 65개로 일반화(validate_cpa_v3.ts, tests/questionV3.test.ts)
- 세트는 needs_review 상태로 편입됨. 게시는 사람 의미 검수 후 promote_cpa_v3.ts로 승급 필요.

## [2026-08-24] create | pilot-10-004 · pilot-12-004 수동 제작
- pilot-10-004: KGA 530 문단 5(c)·7·14 소재, 물음 2개·criterion 4개·4점 (표본위험 정의·표본규모 기준·왜곡표시 투영)
- pilot-12-004: KGA 560 문단 7(a)-(d)·8 소재, 물음 2개·criterion 5개·5점 (후속사건 적극 절차 4가지와 수정요구 사건 식별 시 판단)
- 두 세트 모두 needs_review 상태로 편입. 사람 의미 검수 후 promote_cpa_v3.ts로 승급 필요.
- 배운 점: classification.standards는 계획 기준이 아니라 실제 사용한 KGA source 목록과 일치해야 한다(validate 게이트).

## [2026-08-24] create | 10세트 일괄 제작 및 승급 (3차)
- pilot-04-004(230 적시작성·문서화 3요건), pilot-04-005(230 취합 후 삭제금지 + 320 중요성 문서화)
- pilot-12-005(450 문단9·13 왜곡표시 수정 요청·과거기간 커뮤니케이션), pilot-12-006(450 문단9·12 원인조사·지배기구 커뮤니케이션)
- pilot-09-004(505 문단8·9 발송거부 시 절차), pilot-09-005(505 문단10~11 회신 신뢰성)
- pilot-13-004(620 문단7·12 전문가 활용 필요성·적합성 평가)
- pilot-16-005(701 문단9·11 KAM 결정 고려분야·도입문구), pilot-16-006(701 문단12~13 변형의견 KAM 금지·개별 기술)
- pilot-07-004(330 문단8~9 통제테스트 설계 요건·의존 정도별 증거)
- 게이트가 잡아준 것: 1물음 세트(linked set 계약 위반) 4건, 주제 범위 밖 source 2건, quote 교차 중복 1건 → 모두 보정 후 통과
- 사용자 지시로 사람 검수를 생략하고 verified 승급(장부 78건). published 전환은 차기 compile 시점에 전체 대상으로 수행.


## [2026-08-24] create | 신규 10세트 수동 제작 (pilot-*-005·006·007·004)
- 주제 02·05·06·07·08·09·12·14·16·17에 각 1세트씩 추가 (물음 2개씩, 총 20물음)
- validate_draft_v3 --against-bank로 편입 전 교차 중복 검사 후 은행 편입
- 통합 단계에서 validate가 잡은 3건 보정: pilot-02-005 범위 밖 KGA 315 source 제거(KGA 200 A35로 재구성),
  pilot-14-005 source page 누락 보완, pilot-17-004 중복 quote를 문단 10 소재로 교체
- 10세트 모두 needs_review 상태. 게시는 사람 의미 검수 후 promote_cpa_v3.ts 승급 필요.


## [2026-08-24] create | 신규 5세트 수동 제작 (배치3)
- 주제 01·10·11·13·18에 각 1세트 추가 (pilot-01-004·10-005·11-004·13-005·18-004)
- KGA 220 문단 13·14(b), KGA 530 문단 8·14, KGA 540 문단 18·20, KGA 610 문단 15·17(c), KGA 1200 문단 4·5 원문 대조 완료
- pilot-11-004는 편입 후 validate가 물음 수(2~3개) 계약 위반을 잡아 sub2(KGA 540 문단 20)를 보강
- 5세트 모두 needs_review. 게시는 사람 의미 검수 후 promote_cpa_v3.ts 승급 필요.


## [2026-08-24] create | 미커버 원문 논점 3세트 추가 제작 (배치4)
- pilot-05-006: KGA 240 문단 33(b)(ii) 소급 재검토·(c) 비경상 거래 사업 논리성 평가
- pilot-12-008: KGA 450 문단 5 clearly trivial 집계 기준·문단 8 커뮤니케이션과 수정 요청
- pilot-09-007: KGA 505 문단 7 조회 통제 유지 절차·문단 12 미회신 대체절차·문단 14 불일치 조사
- 3세트 모두 needs_review. 게시는 사람 의미 검수 후 promote_cpa_v3.ts 승급 필요.


## [2026-08-24] update | 신규 18세트 일괄 verified 승급
- 소유자 지시로 needs_review 18세트를 promote_cpa_v3.ts로 verified 승급 (장부 86~96건)
- 근거: 구조·출처 quote·교차 중복 자동검증 통과, 개별 사람 의미 검수는 미실시(장부에 명시)


## [2026-08-24] update | 전체 은행 게시
- verified 31세트를 published로 승급(장부 97~127건). 기존 published 65세트는 멱등 no-op으로 건너뜀.
- promote_cpa_v3.ts에 재게시 멱등성 추가: 이미 published인 세트는 건너뛰고 나머지만 승급.
- review_status를 status와 동기화(verified 승급 시 needs_human_review 잔여 해소).
- npm run questions:v3:compile로 암호화 배포물 96세트 생성 완료. 라이브 게시 상태.

## [2026-09-08] update | 확정 출제·검증 정책과 주제 집계 반영

후속 DB 문서 갱신: 프로젝트 테이블을 `cpa_*`로 통일한 [전환 기록](../../docs/cpa-table-prefix.md)을 SCHEMA.md에 연결했다. 회원 `cpa_users`·회계법인 `cpa_firm_*`와 이전 이름의 호환 뷰를 구분한다. 이 문서 변경 뒤 wiki lint 오류0·경고0을 확인했다.

- `audit-question-author`·`audit-question-review` 개인 스킬에 필요한 wiki 동기화 절차를 추가했다. 수동 문서와 생성 문서의 관리 범위, 원자료 보존, lint·변경 기록을 명시했다.
- [[question-design]], [[question-generation-workflow]], [[llm-question-generation-prompt]], [[question-output-schema]]와 SCHEMA.md에 모두 작성·정수 배점·함축 결론·동일 문장의 독립 명제·정상 명칭 나열 정책을 반영했다. 제출·진도 검토 시 새 제출마다 전액 가산하고 동일 제출 재시도는 한 번만 적립하는 정책도 연결했다.
- 오래된 3.0-draft·숫자 출처 참조 예시를 현재 v3의 문자열 ID·requirements·검수 상태 구조로 교정했다. 구조 예시와 검증 완료 문항, 목표 정책과 제품 구현 상태를 구분했다.
- build-wiki.mjs가 기준서 일치보다 정본 classification.topic_id를 우선하도록 수정했다. 주제02가01에 합산되던 오류를 해소해 [[coverage-map]]의01은4세트,02는5세트로 갱신했다.
- 생성 범위의 concept·topic/coverage·source manifest·index를 재생성했다. 당시 정본은96세트·192물음·503criterion이며 계획상의 예상504criterion을 현재 수치로 사용하지 않았다. published 집계도 정본과 동기화했으며 내용 검수 완료를 의미하지 않는다.
- 검증:19개 주제의 세트·물음·criterion·published 집계 일치. 생성 전후 data 파일 해시와 수동 문서 보존 확인. wiki lint 오류0·경고0, 타입 검사 통과, 기존 테스트120개 통과, 두 스킬 형식 검증 통과. 이번 wiki 작업에서 문제은행·기준서 원문·채점 코드를 수정하거나 실제 모델을 호출하지 않았다.

## [2026-09-08] update | 주제06 검토 결과와 생성 위키 정확성 보완

- [[question-design]]에 위험평가 문항의 주체·조건·이유 점검표를 추가하고 주제06 검토 보고서와 공식315·330 발췌를 연결했다. 기업 위험평가절차의 발생가능성, IT 통제 실행 확인의 질문 추가절차, 고유위험 평가 측면과 영향요소, 순환 논증 금지를 구분했다.
- 개인 `audit-question-author`·`audit-question-review` 스킬에 주제06 작업 시 해당 지침을 읽도록 안내하고, 이유와 후속 조치의 직접 출처를 각각 연결하도록 보완했다. 상세 기준서 내용을 스킬에 중복 복사하지 않았다.
- build-wiki.mjs의 세트별 유형 분포가 주제 전체 합계를 반복하던 오류를 수정했다. 주제 전체 합계는 범위에 별도로 표시하고96세트 각각의 유형별 합계를 정본과 대조했다.
- [[risk-assessment-internal-control]]과 주제 인덱스에 KGA330 연결을 반영하고, source manifest에 공식 발췌 TXT도 포함했다. 생성 목록을 사람 검수 완료의 보증으로 표현하던 문구를 교정했다.
- 검증: wiki 재생성 성공, lint 오류0·경고0,96세트 유형 집계 일치, 두 개인 스킬 형식 검증 통과. 번들 Python에는 yaml이 없어 첫 형식 검증이 실행되지 않았으나 기존 PyYAML6.0.3이 있는 Python으로 재실행해 통과했다. 타입 검사·은행 검증 및 questionV3 테스트13개 통과.
- 이 후속 작업은 위키·생성기·스킬 수정이다. 앞선 주제06 실측86회의 결과를 새 모델 평가로 집계하지 않는다.

## [2026-09-08] update | 주제05 검토 결과와 출처·회귀 지침 보완

- [[question-design]]에 부정·법규·커뮤니케이션의 조건과 예외를 정리하고 주제05 보고서·기준대장을 연결했다. 보고 상대방·시점·서면 여부, 의심과 확정, 고려 가능성과 의무, 수익인식 추정의 예외를 구별한다. 공식2025·2026 전문의 시행일 자리표시자와 교차참조 불일치는 해당 판본의 확인 기록으로 한정했다.
- [[question-output-schema]]의 KGA 출처 식별 예시를 현재 검증 계약에 맞추고 세부 문단·PDF 페이지·판본 기록, 인용 문자열 해시와 첨부파일 해시, 로컬 전재문 일치와 공식 원문 확인을 구별했다.
- [[question-generation-workflow]]와 개인 검토 스킬의 회귀 사례 지침에 문장 삭제 후에도 함축 명제가 남을 수 있음을 반영했다. 기대값 교정에는 원문·확정 계약 근거와 버전 기록을 요구하고 기존 실측을 보존한다.
- 개인 `audit-question-author`·`audit-question-review` 스킬에 주제05 작업 시 위키 지침과 보고서를 읽도록 연결했다. 생성된 주제05 목록·집계는 정본과 이미 일치하여 재생성하지 않았다.
- 검증: wiki lint 오류0·경고0, 두 개인 스킬 형식 검증 통과. 스킬 검증 첫 실행은 Windows 기본 cp949 해독 오류로 중단됐으며 Python UTF-8 모드로 재실행해 통과했다. 이번 후속 변경은 문서·스킬에 한정하며 문제 데이터·채점 코드 변경이나 새 모델 호출은 없다.


## [2026-09-08] update | 주제04 재발 방지 지침과 스킬 연결

- [[question-design]]에 전략·계획 문서화의 중복 인정 방지, 범주와 기준서 번호 구분, 금액·결정 요소의 결합, 작성·취합·보존 및 기산점 구분을 추가했다. 주제04 보고서와 전수 장부를 연결하고 2026 개정300의 항목·문단 이동과 시험 판본 미확정을 구별했다.
- 개인 audit-question-author·audit-question-review 스킬에 주제04 지침과 기존 [[question-output-schema]]의 출처 위치·인용 충실성 절을 읽도록 연결했다. 검토 스킬의 회귀 자료에는 확인된 반례와 변경 없는 계약의 실측 재사용·현재 코드 재처리·병행 수정 확인 경계를 보완했다.
- 생성된 [[planning-documentation-materiality]]는 현재 정본의5세트·26criterion 및 모든 claim과 일치하여 재생성하지 않았다. 출처 필드와 exact의 의미는 병행 수정된 스키마 지침에 이미 있어 중복 절을 추가하지 않았다.
- 검증: wiki lint 오류0·경고0, 두 개인 스킬 quick_validate 통과, 타입 검사 통과, 주제04 집계·claim 및 로컬 참조 링크 확인. 이번 후속 작업은 문서·스킬 수정이며 문제은행·채점 코드 변경이나 추가 모델 실측은 없다.

## [2026-09-08] update | 주제08 감사증거 전수 검토·수정

- 주제08의5세트·10물음·27criterion을 공식KGA500과 대조했다. 두 절차와 네 특성, 일반화의 예외, 표본에서 모집단으로 결론을 내리는 방법, 금융상품인 문서·실물검사의 증거 한계를 정리했다. 총27점 유지.
- [[question-design]]에 감사증거 문항의 범위와 한계 및 다른 문장이 남긴 함축관계의 누락 기대값 작성 지침을 추가했다. [[audit-evidence-assertions]]와 생성 집계는 현행build-wiki로 갱신했다. 개인 audit-question-review 스킬과 회귀 자료에도 참조·주의를 추가했다.
- 검증: 주제08 모의99건·실제94회·경계57건 통과. 관련26테스트·typecheck·전체은행validate·compile·공개본/암호화본 일치 통과. 개인 검토스킬 quick_validate는 python -X utf8로 통과했다.
- wiki lint의 마지막 실행은 오류1·경고0: 병행 주제09가 question-design에 연결한 docs/reports/question-review-2027/09.md가 아직 없어 발생했다. 주제08 보고서 링크는 정상이다. 앞선 미생성07·08 링크는 해소됐다. 타주제의 보고서를 임의 생성하거나 링크를 삭제하지 않았다.


## 2026-09-08 — 주제07 검토·수정

5세트·10물음·18criterion·18점 유지. 공식330 문단·source hash를 연결하고 위험 대응의 조건·시점·판단, 명칭 답안의 허용 표현, 출처 재인용과 학습목표 중복의 구별을 question-design과 검토 스킬에 반영했다. 생성 문서는 build-wiki.mjs로 갱신했으며 수동 문서와 원자료를 보존했다. 스킬 quick_validate 통과. 실제 모델 최종91회 및 관련41테스트 통과. 2027 최종 시험 판본·실제 인증/DB E2E는 별도 미확정. 상세는 docs/reports/question-review-2027/07.md를 따른다.


주제07 보고서 생성 후 첫 wiki lint(00:48 UTC): 종료코드1, 대상 밖 주제10 보고서 링크 미생성 오류. 이전 요약의 주제09 표기는 기록 오류로 정정한다. 후속 검사 원본은 docs/reports/question-review-2027/grading-cases/07-wiki-final.json에 보존한다.


## 2026-09-08 — 주제09 특정항목 감사증거 전수 수정

- 7세트·14물음 검토,33→35criterion·35점. 조회 통제 네 절차 채점 복원,소송 조건의 동시 충족,실사 대체절차의 증거 미입수 조건,회신 실패 상황과 독립 채점 범위 보완.
- 공식501·505·510 직접 출처·해시 갱신. question-design.md에 주제별 지침 추가,생성 범위의 커버리지 갱신. 기존 로그·수동 문서·원자료 보존.
- 실제178회,후속49회 및 미변경 계약80회에 남은 판정 불일치0건. 모의128사례·77경계,두 폭의28화면 검증. 최종시험판본과실제DB E2E는 별도 미확정. 상세: ../../../docs/reports/question-review-2027/09.md.
- 최초wiki lint는 아직 생성되지 않은07·08·09 보고서 링크3건으로 실패.09 보고서 생성 후 최종 결과는 후속 항목과09-verification.json에 기록한다.


주제07 보고서 생성 후 wiki lint 실제 결과: 종료코드1. question-generation/question-design.md: source link 없음 ../../../docs/reports/question-review-2027/10.md; question-generation/question-design.md: source link 없음 ../../../docs/reports/question-review-2027/11.md (대상 밖 병행 작업). 주제07 링크는 유효하며 원본 결과는 docs/reports/question-review-2027/grading-cases/07-wiki-final.json에 보존.

- 주제09 최종검증 후속: lint 오류2건은 주제10·11 보고서 미생성 링크이며 주제09 링크 오류는 해소했다. 타입 검사·검토스킬 검사·주제09 단독7세트 검증과128채점코드 사례는 통과. 전체은행은 주제15·16의 동시 변경21오류로 실패,관련26테스트 중24통과·2실패. 실패를 전체통과로 보고하지 않는다. 자세한 출력은 docs/reports/question-review-2027/grading-cases/09-verification.json 참조.


## 2026-09-08 — 주제10 검토 반영

- 5세트·10물음·27criterion/27점 유지. 분석절차의 고려사항, 표본항목 교체/증거 불능, 투영 목적·위험 한계, 변이 예외를 question-design에 추가.
- 정본의 제목·유형·criterion을 생성 위키에 반영. 원자료와 수동 문서 보존. 검토 완료와2027 시험 판본 확정을 구별.
- 최종 lint 및 주제 집계·공개/암호화 일치는 docs/reports/question-review-2027/grading-cases/10-checks.json 참조.

## 2026-09-08 — 주제11 회계추정·특수관계자 검토 및 수정

- 4세트·8물음의24criterion 전수 검토 후25criterion으로 수정. 세 접근방법의 독립 배점, 경영진 편의 평가 이유, 조건부 통제테스트와 미공개 특수관계자 절차를 정합화했다.
- 공식540·550 직접 발췌와2026 전문의13개 대상 발췌를 대조했다. source hash·requirement 위치·생성 집계를 갱신했다.2027 최종 판본 지정은 미확인이다.
- 설계 지침과 로컬 audit-question-review 스킬에 주제11의 대안·조건·이유 경계를 보완했다. 85사례와49코드경계, 실제 UI8조합을 확인했다. 실제 인증/DB E2E는 미실행이다.
- lint 최신 실행은 주제11 링크 오류가 없으나 병행 작업의12·15·16 보고서 링크 부재3건과 question-design 길이 경고1건을 보고했다. 결과는 docs/reports/question-review-2027/grading-cases/11-wiki-lint.json에 보존했다.
- 전체 검증은 한 시점에서 통과했으나 이후 주제18 병행 수정의 출처·총점 및 공개본 불일치가 다시 관측되었다. 이번 문항 변경과 구별해11.md/11.json의 최종 실행 기록에 남긴다.

## 2026-09-08 주제13 검토·수정

5세트·10물음의 공식610·620 출처와 국내 직접적 보조 제한, 보고서 언급의 근거·예외 시 표시, 객관성 기본요건과 범위 조정의 구분을 정합화했다. 21→24criterion·24점. question-design 수동 지침 및 audit-question-review 로컬 스킬 보강, 생성 wiki는 정본으로 갱신했다. 실측·전체 은행의 대상 외 실패·미확인 범위는 docs/reports/question-review-2027/13.md 참조.

## 2026-09-08 주제15 검토·수정

4세트·8물음·27criterion을 전수 검토하여28criterion·28점으로 수정했다. 공식700·705 직접 인용, 금액 왜곡 계량화·미공시 증거 조건·공정표시 고려사항·의견거절 보고의 구체 요건을 복원했다. 배치/제목의 독립 배점과 발문 조건에 대응하는 축약 의견을 정합화했다. 수동 question-design, 생성 커버리지, 로컬 audit-question-review 스킬을 갱신했다. 89사례·52코드경계, 실제UI4세트×2폭 검사와 모델 실측 결과 및 판정종류 P2 한 건은 docs/reports/question-review-2027/15.md에 기록했다. 2027 최종 판본·실인증DB E2E는 미확인이다.


## 2026-09-08 주제14 그룹감사 검토·수정

5세트·10물음·33criterion·33점을 유지하며 공식 KGA600 직접 출처, 부문감사인 감독환경, 전달·보고 방향, 접근 제한의 수임·해지·의견거절 조건, 연결 조정 평가와 후속조치를 수정했다. 문단42의 평가+유의사항 토의 결합criterion을 필수사실로 분리하여 토의누락 오채점을 보정했다. 실제 모델148회 호출과104개 mock 사례,26개 관련 테스트, 타입검사 및10개 화면 조합을 기록했다. 최종 은행검증96세트·192물음·521criterion 통과, 주제14 공개본·암호화본 일치 확인. 보고방향 답안의 not_met/contradicted 분류 차이3회는 모두0점으로 남아 있다.

question-design의 그룹감사 지침과 audit-question-review 로컬 스킬을 갱신했다. 생성 wiki의 주제14 집계5/10/33을 대조했고 스킬 검증은 통과했다. wiki lint는 이번 주제14 관련 오류는 없고, 당시 병행 주제18·12·16의 보고서 링크 부재와 문서 길이 경고가 남았다. 세부 결과와 미확인 범위는 docs/reports/question-review-2027/14.md 및 grading-cases/14-wiki-lint.json에 보존했다.

주제13 마감 검사: 전체 wiki lint는 대상 외 문서 링크 2건 때문에 실패했다: question-generation/question-design.md: source link 없음 ../../../docs/reports/question-review-2027/18.md; question-generation/question-design.md: source link 없음 ../../../docs/reports/question-review-2027/16.md. 주제13 링크 오류는 없다. 스킬 quick_validate UTF-8 모드 통과.

주제15 최종 확인: 타입 검사·관련41테스트·전체은행 검증(96세트/192물음/521criterion/521점)과 컴파일 통과. wiki lint는 주제16·18의 미생성 보고서 링크2건으로 실패, question-design 길이 경고1건. 주제15 링크 오류0. 스킬 UTF-8 검증 통과. 자세한 실행 원본은 docs/reports/question-review-2027/grading-cases/15-final-verification.json에 보존.


## 2026-09-08 — 주제16 감사보고 특수사항 검토·수정

- 7세트·14물음·38criterion/38점 유지. 공식701·706·710·720의 출처·해시, 선정 단계, 개별기술/도입문구, 강조사항의 공시 위치, 기타정보 비교·수정 요구의 채점 계약을 보완.
- 경영진 판단만 쓴 답안의 오채점을3회 재현하고002/005 계약 보강 후 각3회 정상 확인. 실제 모델174회, 최종141모의사례·80경계 및132개 현행 프롬프트 실제 사례에 미해결 불일치0. 빈 사례9개는 모델무호출.
- 생성 위키와 현행 집계 갱신. 최종 typecheck·은행 검증·관련41테스트·스킬검사 통과. wiki lint: 종료코드0,오류0; question-design295줄 분할권고1건. 최종 판본·운영 DB 미확인과 과거 실패는16.md/16.json에 별도 기록.


## 2026-09-08 주제12 전수 검토·수정

8세트·16물음,37→39criterion·39점. 공식450·560·570·580 출처/해시와 발문·정답·조건·채점을 정합화했다. 감사종결 지침 및 개인 검토 스킬을 보완하고 자동 생성 집계를 갱신했다. 실제237호출,최종145개 고유 사례 불일치0;타입·은행·31테스트 통과. wiki lint는 타 주제16·18 보고서 링크 미생성2건으로 실패했고 긴 수동 지침 분할 권고가 남았다. 주제12 링크·39criterion 집계는 일치. 상세 docs/reports/question-review-2027/12.md.

## 2026-09-08 주제17 검토·수정

- 기존4세트·8물음·24criterion을 전수 검토하고26criterion·26점으로 정합화했다. 공식1100 직접 인용·해시와 보고 범위,미비점 평가·보고 조건을 보완했다.
- question-design의 내부회계관리제도 지침을 추가했고 현행 정본으로 생성 문서의 집계를 갱신했다. 상세: docs/reports/question-review-2027/17.md 및17.json.
- 최종 lint-wiki.mjs: 오류0개,question-design 분할 권고1건. 다른 주제의 진행 중 보고서 링크 오류는 최종 검사에서 해소되었으며 본 작업의 단독 수정으로 집계하지 않는다.
- 실제 채점186호출의 중간 불일치와 최종 수정 결과를 구분했다. 최종 점수 불일치0이며,기존 구두보고 반례의0점 판정 분류 차이는 별도 이슈다.2027 사용 적합 및 일부 법규 현행성 미확정.

## 2026-09-08 주제13 후속 링크 정리

계속 진행 요청에 따라 아직 없는 주제16·18 보고서 링크를 현존 검토계획으로 교정하고 보고서 작성 전 상태를 표시했다. 전체 wiki lint 오류0, 문서 분할 권고1건. 주제13 데이터·채점 코드 해시와 원문·공개본·암호화본 일치 재확인, 모델 추가 호출 없음. 결과: docs/reports/question-review-2027/grading-cases/13-followup-wiki.json 및13-followup-validation.json.


주제12 최종 위키 재확인(2026-09-08): 병행 주제16·18 보고서가 생성된 후 `lint-wiki.mjs` 재실행 통과(오류0). 긴 log.md·question-design.md의 분할 권고만 남았다. 앞선 링크 미생성 실패 기록은 당시 결과로 보존한다.

## 2026-09-08 주제19 검토·수정

- 4세트·8물음·23criterion/23점 유지. 개정 인증업무 정의·구성요소, 검토절차, 독립성 예외, 수행기준 적용 주체, 특정목적 감사 이탈 조건을 수정했다. 공식 발췌·출처 해시와 KGA200 범위를 갱신했다.
- 정본·공개본·암호화본 일치, 80개 mock 사례·47개 코드 경계, 최종76개 실제 모델 사례와 4세트×2폭 UI를 검증했다. 관련 테스트26개 및 타입·은행 검증 통과.
- question-design과 audit-question-review skill에 재발 방지 지침 추가. wiki lint 최종 오류0/길이 경고2;초기 다른 주제16·18 보고서 링크 미생성 오류는 후속 문서 생성으로 해소됨. 과거 log 기록 보존.
- 국내800·분반기2015 전문 및2027 시험판본 미확인은 docs/reports/question-review-2027/19.md 참조. 실측 기록 완료를 시험 적합 확정으로 처리하지 않았다.
## 2026-09-08 — 주제18 소규모기업 감사 검토·수정

4세트·8물음 전수 검토, 감사문서 누락7요소 복원으로20→27criterion·27점. 적용 범위·전환 절차·준수 표명·문서 작성/취합/보존/변경의 조건을 공식1200 원문과 연결했다. question-design과 검토 스킬에 관련 지침을 추가하고 생성 영역을 현행 빌더로 갱신했다. 파일럿8점 제한은 정수criterion 합산 정책에 맞춰 제거했다.

기본40답안 조합,87mock·51코드 경계,실제 모델87회 및 관련41테스트·typecheck·은행검증 통과. 두 기대표 오류는 원문 재대조 후v2로 교정했고 각3회 원본 실측을 보존했다. 모든 실측 입력 해시 동일 확인 후 raw응답 재처리 불일치0. 공개·암호화본 일치 및16개 화면 검증 완료. 2027 최종 시험 판본·실제 인증/DB 경험치 E2E는 별도 미확정이다.

첫 wiki lint는18·16 보고서 미생성 링크로 실패했고, 두 보고서 생성 후 최종 lint는오류0·문서 길이 경고2로 통과했다. 스킬 quick_validate는Python UTF-8 모드로 통과했다. 상세 근거와 원본 출력: ../../../docs/reports/question-review-2027/18.md 및 grading-cases/18-checks.json.

주제15 계속 진행 최종: 점수 오판정이 관측된v4 축약안을 철회하고v3 정본으로 복원했다. v3의 모든 실측 점수는 일치하지만 잘못된 의견명칭·의견누락 두 사례에서 판정 분류가3회 중1회씩 흔들려P2로 유지한다. 관련41테스트·은행검증·wiki lint 통과. 최종 타입검사는 병행 QuizClient/actions/ranking 불일치14건으로 실패, 문서길이 권고만 남음. UI는 병행 변경의 새 서버액션을 어댑터로 격리하여 재검증. docs/reports/question-review-2027/15.md 및 grading-cases/15-continuation-final.json 참조.


## 2026-09-08 주제14 완료 처리

사용자 요청에 따라 남은 주의사항을 기록하고 검토·수정을 완료 처리했다. 최종 29개 사례·47회 실행에서 점수 불일치 0건이며 두 유형의 0점 답안에서 not_met/contradicted 분류 차이 5건이 남는다. 정본·공개본·암호화본 동기화 및 전체은행 검증(96세트·192물음·521criterion/521점) 통과. 2027 최종 시험 판본·실제 인증/DB E2E는 미확인 상태로 보존한다. 이번 완료 처리에서는 모델 추가 호출 없이 문서·상태만 정리했다. [후속 보고서](../../docs/reports/question-review-2027/14-followup.md).
