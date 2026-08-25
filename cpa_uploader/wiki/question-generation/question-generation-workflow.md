---
title: 출처 기반 문제 생성 워크플로
created: 2026-08-07
updated: 2026-08-07
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

## 4. 관련 물음 묶기

같은 개념, 사례 또는 비교축을 공유하는 물음을 하나의 `linked_question_set`으로 묶는다. 학습상의 권장 순서인 `learning_order`와 채점상 필수 순서인 `ordered`를 구분한다.

## 5. 모범답안 정렬

두 번째 패스에서 모범답안과 기준서를 각 subquestion에 연결한다. 연결할 수 없는 해설 문장은 채점 대상에서 제외하거나 검토 대상으로 표시한다.

## 6. 원자적 criterion 생성

독립적으로 점수를 줄 수 있는 최소 명제로 분할한다. 주체, 행위, 대상, 조건, 부정, 시점, 수치를 핵심 사실로 보존한다.

## 7. 정수 배점 적용

[[question-design]]의 1점/2점 원칙을 적용한다. 1점 criterion에 부분점수가 필요하면 criterion이 충분히 원자적인지 다시 검토한다.

## 8. 검증

- 모든 발문 요구사항이 subquestion으로 반영됨
- 모든 criterion이 subquestion에 연결됨
- 발문이 묻지 않은 criterion이 없음
- source quote가 원문에 실제 존재함
- 기준서 문구·수치·기간을 확인함
- 계산 요구가 없음
- 답안 개수·순서·형식 정책을 보존함
- 동일 answer evidence의 부당한 중복 득점이 없음

## 9. 출력

[[question-output-schema]] 형식으로 draft JSON을 생성하고 `review_status: needs_human_review`로 둔다. 사람이 출처와 답안양식을 확인한 후에만 publish한다.

## Related

- [[llm-question-generation-prompt]]
- [[source-manifest]]
- [[question-design]]
