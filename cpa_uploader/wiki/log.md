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
