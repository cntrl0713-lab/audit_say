# S03 — 특정항목·법규·타인의 업무

**1차 수동 초안: 5세트·13물음·62점, 작성자 QA 274개.** 실제 의미검수·모델 채점은 전체49 비교은행 고정 후 수행한다. 정본편입·게시·배포는 이번 범위에 없다. 최신 상태와 해시는 [인계](handoff.md)와 [lineage](lineage.json)에서 확인한다.

| 계획 ID | 실제 초안 | 물음별 점수 | QA |
|---|---|---|---:|
| T09-C | [pilot-09-009](pilot-09-009.json) | 5 / 6 / 4 | 65 |
| T09-D | [pilot-09-010](pilot-09-010.json) | 3 / 7 / 2 | 56 |
| T05-C | [pilot-05-010](pilot-05-010.json) | 2 / 4 | 30 |
| T13-B | [pilot-13-010](pilot-13-010.json) | 4 / 8 / 6 | 74 |
| T13-C | [pilot-13-011](pilot-13-011.json) | 9 / 2 | 49 |

[배정서](../../../../docs/plans/question-authoring-by-topic-2026-09-11/assignments/S03-특정항목-법규-타인의-업무.md)의 잠정36점을 독립 요구에 맞춰62점으로 조정했다. 세트·물음 수는 그대로다. [변경표](design-changes.json)는 13물음 전부의 전후점수·명제·이유를 기록한다. 원기출에서 제외한 예시나 선택사항을 완전열거로 확장한 범위도 별도로 표시한다.

2027 CPA 대비, 기본2026년 개시 보고기간을 전제로 공식2025/2026 전문의 선택98문단을 대조했다. [공식 출처와 설계범위](scope-and-sources.md), [판본 대조](sources/edition-comparison.json), [등록 카탈로그](sources/registered-catalog.json)를 함께 읽는다. 250.10의202X 표기는 추정하지 않고 가상의 두 법규 유형에 관한 책임 요구 자체를 적용하는 사례로 제한했다.

[정적 검사](static-check.json)는 정확한 인용, 계획, 정수배점, QA 형상, ID와 비교은행 충돌 및 명시400,000자 한도의 무호출 입력 준비를 검사한다. [QA 범위](qa-coverage.json)는62criterion 각각의 만점·동의표현·누락·반대·조건경계를 가리킨다. 작성자 기대값을 모델 측정결과로 읽지 않는다.

[빈도 증거](frequency-evidence.json)는9개 요소의 기출·모의·연습·필수암기/OX 교재 수록·원출처 미확정을 분리한다. [학습 원발문·답안](learning-original-context.json), [정본23세트 대조](comparison-notes.json), [coverage 제안](coverage-proposal.json)의13관계는 서로 다른 역할이다. coverage 입력과 snapshot의 공통 반영은 총괄이 최종content를 기준으로 처리한다.

[선행·후속 경계](peer-scope-handoff.md)와 [2차 재개요건](phase2-followups.md)을 인계한다. 수동 evidence-packet은 자동 생성 source packet이 아니다. 실제 검수는 각 파일의 `.authoring-plan.json`을 `--plan`으로, 총괄이 고정한 비교은행을 `--bank`로 전달한다. 필요한 문맥은 실제 `source_refs`와 plan 안에 들어 있으며 별도 장부가 자동 입력된다고 가정하지 않는다.
