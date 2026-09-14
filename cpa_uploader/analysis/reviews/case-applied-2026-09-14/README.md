# 사례형 적용 확장 검토

[사용자 범위](authorization.md)에 따른 6개 사례·18개 물음·44점의 제작·검토·정본·운영 DB 반영을 완료했다. [제작 배치](../../../drafts/case-applied-2026-09-14/README.md)의 시작 비교본과 출처·설계·QA를 보존한다.

[전체 결과 보고서](../../../../docs/reports/case-applied-2026-09-14.md) · [전체 문제와 모범답안](../../../drafts/case-applied-2026-09-14/questions-and-answers.md)

## 내용과 실제 채점

[형상 검사](shape-check.json)에서 사례별 3물음과 851–1,047자의 사실관계를 확인했다. 문자 수는 제목·물음을 제외한 facts를 LF 하나로 연결한 Unicode 코드포인트 수이며 공백을 포함한다. [root 내용 검토](root-content-review.json)와 작성자·교차검토에서 18물음의 사실 의존성·발문·정답·정수 부분점수·주제·출처·판본을 전수 대조했다. 미해결 내용 결함은 없으며 agent 검토를 사람의 직접 확인이나 별도 API 의미검수로 기록하지 않았다.

[실행 manifest](execution-v1/grading-manifest.json)에 입력·출처·코드·대표 답안 기대값을 고정했다. [봉인 결과](sealed-v1/summary.json)는 실제 Luna 18회 호출, 고정 대표 답안 54개 중 기대점수와 정확히 일치 54개, ±1점 이내 54개(100%), 범위 밖 0개다. 이는 대표 답안의 관측 결과이며 모든 답안의 정확도 보장이 아니다. 실제 반환 사용량에 고정 단가를 적용한 비용 추정은 약 $0.040199이고, 금액 상한은 미지정이었다. 상세 토큰·요청·응답 식별자는 원 실행에 보존했다.

[오답 상태 구별 후속 검토](state-label-followup.json)는 기대 `not_met`와 실측 `contradicted`의 상태 차이를 점수 차이와 구별한다. 명시적 반대를 구별한 모델 판정은 실제 답안에 부합하며 모두 0점이다. 원 기대 상태·`strict_matched=false`·원응답을 보존했고, 추가 호출이나 기대점수 변경은 하지 않았다.

## 게시와 분석

[격리 게시본 검증](publication-v1/stage-completion.json) 후 [정본 설치](publication-v1/install-completion.json)를 완료했다. 기존 230개 문제의 내용과 이전 승급 이력을 보존했다. [운영 DB 완료](db-publication-v1/completion.json) 릴리스는 `9fde77ff-c4ed-4b4c-b383-8f632d6caf93`이며 [독립 조회](db-publication-v1/verification.json)에서 실제 공개·비공개 내용·분류·집계를 대조했다. 최종 전체 은행은 236문제·510물음·1,840점이다.

[대표 관계 제안](coverage-proposals.json), [원발문·원문 관계 대조](coverage-proposal-review.md), [root 관계 검토](coverage-root-review.json), [공통 연결 반영](coverage-update.json)에 직접 대응 3개·일부 대응 1개·인접 관계 2개를 기록했다. 기출·모의 빈도 입력을 변경하지 않았다. 첫 물음의 주제 07·08과 부모 대표주제 09를 구별한 문구 정정 이력도 제안에 남겼다.

[최종 분석·보존·wiki 검사](final-checks-v2/summary.json) 5개를 모두 통과했다. 최초 분석 생성에서 발생한 registry 파일 열기 오류의 [원 로그](final-checks-v1/analysis-build.log)를 보존하고, 동일 생성기를 새 출력 경로에서 실행한 [재개 기록](final-check-retry-plan.json)을 남겼다. 이후 타입 검사와 재개·보고 코드의 대상 lint도 통과했다. [실행 도구](helpers/README.md)와 그 당시 원본은 변경하지 않았다.
