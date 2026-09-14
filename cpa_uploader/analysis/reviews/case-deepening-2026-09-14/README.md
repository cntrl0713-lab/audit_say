# 사례형 심화 검토

[제작 배치](../../../drafts/case-deepening-2026-09-14/README.md)의 6사례·18물음·38점을 검토했다. 사용자 확정 분량·정수 부분점수 정책과 검증 후 정본·공개본·운영 DB에 반영하라는 권한을 이어받는다.

## 현재 상태

- 18물음의 원문·사실 의존성·발문·정답·배점·주제·판본·기존 문항 차이를 agent가 대조했고 미해결 내용 결함은 없다. [최종 내용 검토](root-content-review.json)와 제작 배치의 작성자·독립 검토를 함께 보존했다.
- Luna 실제 채점은 모범 18·부분 17·오답 18개, 총 53답안이다. [봉인 요약](sealed-v1/summary.json)의 53개 모두 기대점수와 정확히 일치하며 SDK 호출 18회, 반환 사용량 기준 추정액은 $0.03792655다. 단가는 기존 확인 기록을 적용한 추정값이다.
- 동시 기준서형 재편 이후의 363세트를 보존하여 369세트·546물음·1,869점으로 통합했다. [후속 통합](concurrent-integration-v2.json), [격리 게시 검사](publication-v2/stage-completion.json)와 [정본·공개본·암호화본·분류 설치 검사](publication-v2/install-completion.json)를 통과했다. [작업 간 인계](concurrent-publication-handoff.json)를 받은 뒤 설치했으며 [운영 DB 반영과 독립 조회](db-publication-v2/completion.json)도 완료했다. 운영 릴리스는 `5326b633-3bf3-443f-955e-3c03be1c7ef3`이다.
- [전체 DB 검사](db-publication-v2/verification.json)는 공개·비공개 내용, 기준서형 372물음·사례형 174물음, 학습 단위 439개·주제 연결 705개를 확인했다. [출처 관계 반영](coverage-update.json)은 검토된 신규 6개 관계만 더하고 기존 관계와 빈도 입력을 보존했다.

[문제·모범답안·부분점수 기준](../../../drafts/case-deepening-2026-09-14/review-preview.md)에서 실제 문항을 확인할 수 있다. 내용 검토를 사람 확인 또는 별도 API 의미검수로 기록하지 않는다.

[최종 보고서](../../../../docs/reports/case-deepening-2026-09-14.md)와 [문제·모범답안](../../../drafts/case-deepening-2026-09-14/questions-and-answers.md)을 확정했다. [최종 검사](final-checks-v2/summary.json)의 분석 생성·동기화·보존·wiki 생성·검사 5개를 모두 통과했다. 전체 사례 67개가 사실관계 400자 이상·사례형 물음 2개 이상이며 이번 6개는 모두 3개 물음이다.

## 입력·실행·재사용

- 수동 판단: [A 최종 메모](root-review-notes-a.json), [B 최종 메모](root-review-notes-b.json), [출처 수집 계획](source-evidence-plan.json), [관계 검토](coverage-root-review.json).
- 생성 입력과 실제 실행: `candidate-v1.json`, `classification-v1.json`, `case-qa.json`, `execution-v1/`의 고정 manifest·코드 사본·요청·원응답·토큰·요청 식별자와 `sealed-v1/`의 receipt. 과거 바이트와 기대점수를 수정하지 않는다.
- [판정 상태 조사](grading-state-review.json): 대표 오답 36개 기준에서 기대 `not_met`와 실제 `contradicted`가 달랐으나 모두 0점이다. 실제 오답의 명시적 반대 표현에 맞는 판정임을 대조했고 상태 차이와 원응답을 유지했다.
- [동시 정본 대조](concurrent-bank-content-review.json): 기존 사례 61개의 사실과 156물음은 그대로다. 별도 기준서형 재편의 문항·배점을 보존하고 신규 6사례만 더한 `integration-baseline-v2/`, `candidate-v2.json`, `classification-v2.json`을 별도로 만들었다.
- [원 실측 재사용 검사](concurrent-reuse-validation-v2.json): 새 사례 내용과 실행 코드는 동일하고 6개 receipt도 원본과 일치한다. 생성 요소 자료의 변경은 같은 manifest에 봉인된 raw 보존본으로 해석했다. [6개 관계 후속 대조](coverage-concurrent-review.json)에서도 실제 요소·원발문·빈도·출처·목표 문항은 동일하다. 추가 유료 호출은 0회다.

## 중간 실패와 보존

최초 `publication-v1`은 환경 파일을 빠뜨린 실행 명령 때문에 암호화 키가 로드되지 않아 컴파일에서 멈췄다. [실패 조사](publication-stage-failure-review.json)에 원 로그·결과와 당시 정본 불변을 기록했다. 환경을 적용한 재개 사전검사는 별도 작업의 정본 변경을 검출해 쓰기 전에 중단했다. [재개 준비 결과](resume-publication-validation.json)를 보존하며 원 baseline의 설치를 강행하지 않았다.

새 [게시 도구](post-concurrent-helpers/README.md)는 환경 파일 확인과 격리 경로·동시 변경 검사·백업·잠금·롤백을 유지한다. 원 도구·후속 수정·문법 및 lint 결과는 해당 폴더의 provenance와 static-checks 기록에서 구별한다. 실제 실행은 `publication-v2/`에 보존하며 명령과 준비 상태를 실행 완료로 간주하지 않는다.

첫 최종 색인 검사는 신규 관계의 `relation` 필드를 live 계약인 `relationship`으로 옮기지 않은 오류로 실패했다. [원 실패](final-checks-v1/summary.json), 적용 직후 장부와 원 proposal·의미 검토는 보존했다. [후속 수정](coverage-field-correction.json)은 신규 6개만 필드명을 바꾸며 관계 값·근거·대상·snapshot과 기존 239개는 그대로임을 확인했다. 문항·배점·빈도·DB는 변경하지 않았다. 수정은 [별도 도구](correct-coverage-fields.mjs)에 기록했으며 원 게시 helper를 다시 실행하지 않는다.

## 운영 DB 반영 방식

DB에는 [증분 게시 도구](incremental-db-publication-v2/README.md)를 사용한다. 운영에 저장된 기존 363세트의 원문에 검토된 6사례만 붙여, 격리 게시본 369세트와 원문 바이트 및 전체 import 입력이 같은지 확인한다. 전체 원문을 중복 전송하지 않으면서 기존 import 함수의 전체 검증을 유지한다. 다른 작업의 전송 실패·성공 기록은 출처 사본으로 보존하며 우리 작업의 실패·성공으로 합산하지 않는다.

[로컬 검증](incremental-db-publication-v2/validation.json)과 [독립 검토](incremental-db-publication-v2/independent-review.json)를 거친 뒤 [준비 파일](incremental-db-publication-v2/preparation-v1/preparation.json)의 해시를 지정해 실행했다. 같은 트랜잭션에서 기존 active 릴리스와 원문을 확인하고 기존 판본·순서·분류·주제 보존을 검사한다. 제한시간은 이 트랜잭션에만 적용하며 기본 역할·DB 설정과 함수 권한은 바꾸지 않는다. 실제 요청·응답·조회 검사는 `db-publication-v2/`에 별도로 보존한다.
