---
title: 출처 기반 문제 생성 워크플로
created: 2026-08-07
updated: 2026-09-08
type: guide
status: reviewed
review_required: false
tags: [audit, question-generation, source-map, quality]
sources: [cpa_uploader/data/회계감사_통합학습자료/00_통합_목차.md, cpa_uploader/data/cpa_question_sets_v3.authoring.json]
confidence: high
---

# 출처 기반 문제 생성 워크플로

## 1. 주제 선택

[[topic-map]]과 [[coverage-map]]에서 보강할 주제를 고른다. 기존 문제가 적은 영역을 우선하되, 문제 수만으로 기준서 범위가 충족되었다고 판단하지 않는다.

## 2. 출처 읽기

해당 concept 페이지의 `원자료 탐색`에서 다음 순서로 확인한다.

1. 감사기준 통합본의 요구사항·정의
2. 기본이론과 핵심요약의 설명
3. 기출문제의 실제 발문·답안양식
4. 문제연습의 추가 적용사례
5. 기존 JSON의 question seed와 rubric claim

concept 페이지의 기존 rubric claim은 원자료 확인 전에는 확정 정답으로 취급하지 않는다.

공식 시험 적용 공고와 국내 기준서 본문·부칙을 먼저 확인한다. 로컬 통합본·wiki는 탐색 자료다. 2027년의 2026년 시행 기준 동일 적용은 기존 작업 가정이며, 개정220의 보고기간 기준 시행과 시험 적용은 [별도 메모](../../../docs/reports/question-review-2027/kga220-effective-date-note.md)로 구분한다.

## 3. 발문만 보고 요구사항 추출

첫 번째 패스에는 모범답안과 해설을 사용하지 않는다.

- 주어진 사실
- 실제 명령 동사
- 답해야 할 대상
- 조건과 시점
- 요구 개수
- 답안양식
- 초과 답안 처리

각 요구사항은 원문에 존재하는 `source_quote`를 가져야 한다.

원문에 일부 선택·초과 항목 제한이 있으면 과거 요구로 기록하고 [확정 수정 정책](../../../docs/plans/question-review-01-03-remediation.md)에 따라 범위를 명확히 한 모두 작성 발문으로 전환한다. 원문 인용 자체는 고쳐 쓰지 않는다.

## 4. 관련 물음 묶기

같은 개념, 사례 또는 비교축을 공유하는 물음을 하나의 `linked_question_set`으로 묶는다. 학습상의 권장 순서는 `learning_order`로 둔다. 답안 나열은 `ordered=false`이며 감사절차의 필수 선후관계는 criterion에 보존한다. 수임 전과 계속감사처럼 시점이 다르면 독립 상황임을 명시한다.

## 5. 모범답안 정렬

두 번째 패스에서 모범답안과 기준서를 각 subquestion에 연결한다. 연결할 수 없는 해설 문장은 채점 대상에서 제외하거나 검토 대상으로 표시한다.

## 6. 원자적 criterion 생성

독립적으로 점수를 줄 수 있는 최소 명제로 분할한다. 주체, 행위, 대상, 조건, 부정, 시점, 수치를 핵심 사실로 보존한다.

## 7. 정수 배점 적용

[[question-design]]의 기본 1점 명제 합산을 적용한다. 판단·근거를 분리할지 결합할지 명시하고 모든 득점 요구가 발문에 있는지 확인한다. 1점 criterion에 소수 부분점수를 넣지 않는다.

## 8. 검증

- 모든 발문 요구사항이 subquestion으로 반영됨
- 모든 criterion이 subquestion에 연결됨
- 발문이 묻지 않은 criterion이 없음
- source quote가 원문에 실제 존재함
- 기준서 문구·수치·기간을 확인함
- 계산 요구가 없음
- 모두 작성·순서 무제한 정책과 절차의 의미상 순서를 구분함
- 같은 문장의 독립 명제는 득점하고 같은 사실의 중복 배점은 없음
- 명칭만 요구한 답안의 정상 나열과 함축 결론을 인정함
- 저장 모범답안·동의 표현·부분 누락·반대 의미·빈 답안의 기대값과 실제 채점을 대조함

누락 사례는 문장 삭제가 아니라 **명제의 실제 누락**으로 설계한다. 판단 문장을 지워도 남은 조치가 판단을 분명히 함축하면 판단 점수는 유지될 수 있다. 반대로 결론만 쓰고 설명을 누락한 사례도 별도로 확인한다. 기대값 오류가 드러나면 원문·확정 계약을 다시 대조해 교정 이유와 새 버전을 기록하고 옛 기대값·실측을 보존한다. 단지 모델 출력에 맞춰 기대값을 바꾸지 않는다.

## 9. 출력

[[question-output-schema]] 형식으로 별도 draft JSON을 생성하고 `status: needs_review`, `verification.review_status: needs_human_review`로 둔다. 출처·의미 검토 증거와 현재 승급 도구·장부 계약에 따라 상태를 올린다. 위키 검수 상태를 문제은행 검수 완료로 취급하지 않는다.

## 10. 검증·수정과 wiki 동기화

- 신규 제작에는 `$audit-question-author`, 기존 문항의 검증·수정에는 `$audit-question-review` 스킬을 사용한다. 두 스킬이 없으면 이 문서와 저장소 계약으로 진행한다.
- 검토 요청은 발견·수정안을, 수정 요청은 허용된 수정·재검증까지 수행한다. 모델 판정, 인용 검증, 보안 보정, 최종 점수를 구분하고 과거 로그는 보존한다. 정상 명칭 나열의 `salad_detected`만으로 전체 감점하지 않는 정책과 채점 조작 방지를 구분한다.
- 제출·진도가 범위라면 새 제출마다 획득 점수 전액을 경험치로 가산하고 같은 제출 ID의 재시도는 한 번만 가산한다. 결과가 나온 뒤 프로필 갱신 실패로 결과가 사라지지 않게 한다. 이는 목표 정책이며 실제 구현·검증 상태는 현재 코드와 후속 보고서에서 확인한다.
- 출제 규칙·형상·출처·주제 분포가 바뀌면 관련 wiki를 갱신한다. `question-generation/`와 `SCHEMA.md`는 수동 관리한다. 생성 문서는 `build-wiki.mjs`의 입출력을 확인하여 갱신하고 정본의 `classification.topic_id`별 집계와 대조한다.
- `node cpa_uploader/wiki/scripts/lint-wiki.mjs`를 실행하고 `log.md`에 변경·실제 결과를 기록한다. wiki 빌드로 원자료·문제은행을 바꾸지 않는다. 문서만 갱신한 것을 제품 문제 해결로 보고하지 않는다.

## Related

- [[llm-question-generation-prompt]]
- [[source-manifest]]
- [[question-design]]
