# 2026-09-14 사례형 추가 제작 검토

[승인 범위](authorization.md)에 따라 [제작 배치](../../../drafts/case-additional-2026-09-14/README.md)의 새 사례 6개·18물음을 검증한다. 기존 문항과 과거 검토·실측 기록을 보존하고 이번 실행을 별도 기록한다.

새 6사례·18물음·55점을 정본·공개본·운영 DB에 반영했다. 사실관계는 653~822자이며 사례당 정확히 3개 물음이다. 현재 사례는 49개·120물음이다. [문제와 모범답안](../../../drafts/case-additional-2026-09-14/questions-and-answers.md), [결과 보고서](../../../../docs/reports/case-additional-2026-09-14.md)에서 확인할 수 있다.

## 입력·내용 검토

- `baseline.json`과 제작 배치의 시작 snapshot은 원 186세트의 보존본이다. `capture-integration-baseline.mjs`가 병행 게시된 기준서 27세트를 별도로 보존한 [integration-baseline.json](integration-baseline.json)을 만들었다. 기존 213세트의 내용을 바꾸지 않고 신규 6개를 추가했다.
- 수동 입력은 제작자의 설계·문항·내용 검토·QA와 [root-content-review.json](root-content-review.json), 물음별 `root-review-notes-*.json`이다. source·answer·prompt·points·style·topics·edition·nonduplication을 실제 원문과 대조했다. 사람 검토나 유료 API 의미검수로 기록하지 않았다.
- `integrate.mjs`가 `candidate-v1.json`, 분류 검토, `case-reviews.json`, `case-qa.json`, `designs.json`, `shape-check.json`을 생성했다. [전수 분류](catalog-v1.json)와 공식 원문 인용·기존 발문 중복 검사를 통과했다.

## 실제 Luna 채점

[봉인 요약](sealed-v1/summary.json): 모범·대표 부분·오답 54개, 실제 SDK 요청 18개. 기대점수 정확 일치 53개, ±1점 이내 54개(100%). 통계적 신뢰수준이나 향후 모든 답안의 정확도라는 뜻은 아니다.

내부통제 물음1의 부분답안 1개가 기대 2점보다 1점 낮았다. [편차 조사](within-tolerance-notes.json)에 원답안·기대값·모델 이유를 보존했고 추가 호출 없이 허용 범위 내 관측으로 유지했다. 내용 오류나 응답 오류를 허용한 것은 아니다.

실제 반환 사용량은 입력 110,125·출력 12,786토큰이다. 과거에 확인한 고정 단가로 계산한 추정 비용은 $0.04287175이며 미반환 사용량은 없다. 2026-09-12 단가 snapshot과 캐시 상세·요청 식별자는 실제 실행에 보존했다. 이번 금액 상한은 별도 지정되지 않았고 제공자 한도 오류 중단 정책을 적용했다.

`build-execution.mjs` → dry-a/dry-b → actual-a/actual-b → `seal.mjs`의 입력과 출력은 [execution-v1](execution-v1/grading-manifest.json), [sealed-v1](sealed-v1/readiness.json)로 연결된다. [실행 설계](runner-design.md)에 명령과 오류·재개 원칙이 있다. 과거 폴더를 덮어쓰거나 실측 결과를 보기 전 기대값을 사후 수정하지 않는다.

## 게시·운영·분석

- [격리 게시 검사](publication-v1/stage-completion.json), [정본 설치 검사](publication-v1/install-completion.json): 기존 승급 장부를 보존하고 새 verified/published 기록 12개를 추가했다.
- [운영 DB 독립 검증](db-publication-v1/completion.json): 활성 release `dadfbfbc-5433-4b51-9991-59b6289f08e8`, 전체 219세트·464물음·1,690점, 기준서형 344물음·사례형 120물음, 학습단위 393개. 실제 공개·비공개 내용과 분류·주제 관계를 다시 조회했다.
- [coverage 제안](coverage-proposals.json)과 [root 관계 검토](coverage-root-review.json)에 따라 대표 6개 관계만 추가했다. direct 4개·partial 2개이며 기출·모의·재수록의 빈도 입력은 바꾸지 않았다. [변경 장부](coverage-update.json)는 기존 링크 보존과 새 은행 대상을 기록한다.
- 후속 생성 검사: [final-checks-v1](final-checks-v1/summary.json). 분석 생성·검사·과거 자료 보존, wiki 생성·검사를 단계별 로그로 남긴다. 타입 검사와 변경한 실행 helper의 대상 ESLint도 통과했다. 이 검사를 내용 검토나 실제 채점으로 대신 표시하지 않는다.

`publish.mjs`, `deploy.mjs`, `update-coverage.mjs`, `final-checks.mjs`, `write-report.mjs`는 단계별 생성기다. 완료·실패 시점의 파일과 해시를 보존하며 재실행은 새로운 버전 경로에서 수행해야 한다. 실행 후 파일의 현재 값만으로 과거 요청을 재구성하지 않는다.
