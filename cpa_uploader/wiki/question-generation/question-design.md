---
title: 연계형 문제 설계와 최소 문제 유형
created: 2026-08-07
updated: 2026-08-07
type: guide
status: reviewed
review_required: false
tags: [audit, question-generation, quality]
sources: [cpa_uploader/data/cpa_question_sets_v3.authoring.json]
confidence: high
---

# 연계형 문제 설계와 최소 문제 유형

## 기본 단위

하나의 공통 주제나 사례 아래 관련 물음을 묶되, 답안과 채점은 `subquestion`별로 분리한다.

```text
linked_question_set
├─ shared_context
├─ subquestion 1 → answer 1 → criteria
├─ subquestion 2 → answer 2 → criteria
└─ subquestion 3 → answer 3 → criteria
```

학습 화면에서는 함께 제시하고, API에는 물음별 답안 슬롯을 전달한다. 관련 개념을 함께 공부하면서 다른 물음의 답안이 잘못 득점되는 것을 막는다.

## 허용 문제 유형

### 1. descriptive

단답, 정의, 목적, 이유, 비교, 절차, 보고사항을 모두 포함한다. 정확한 전문용어는 `match_mode: exact_concept`, 일반 서술은 `match_mode: semantic`을 사용한다.

### 2. enumeration

복수의 독립 요소를 요구하는 물음이다. `selection.type`은 `all`, `best_n`, `at_least_n` 중 하나다. 개수 초과를 무시한다는 원문 지시가 있으면 `overflow_policy: ignore_after_limit`을 기록한다.

### 3. judgment

O/X, 예/아니오, 가능/불가능, 적절/부적절, 감사의견 판단과 그 근거를 묻는다. 판단값과 이유를 별도 구성요소로 채점한다.

비교형·표형·시기별·조건별·사례형은 별도 채점 유형이 아니다. 이들은 shared context, subquestion 배치, presentation 설정으로 표현한다.

## 분할 규칙

- 독립적으로 답할 수 있는 원문의 번호별 물음은 별도 subquestion으로 만든다.
- 판단+이유, 결론+근거, 비교 자체, 개수 제한 열거, 조건부 순차 절차는 하나의 subquestion으로 유지한다.
- `이 경우`처럼 문맥 의존적인 표현은 필요한 주어진 사실을 shared context에 보존한다.
- 원문에 주어진 사실의 단순 반복에는 점수를 주지 않는다.

## 정수 배점

- 기본 원자 요소: 1점, `met=1`, `not_met=0`, 부분점수 없음
- 의미 있는 부분점수가 필요한 요소: 2점, `met=2`, `partial=1`, `not_met=0`
- 3점 요소는 예외적으로만 사용하고 가능하면 분할한다.
- 총점은 저장하지 않고 득점 가능한 요소의 합으로 계산한다.
- `best_n` 선택군의 모든 항목은 동일 배점이어야 한다.

## 생성 금지

- 실제 산술을 요구하는 계산 문제
- 출처에 없는 기준서 문단·기간·수치
- 해설에만 있고 발문이 묻지 않은 지식을 득점요소로 추가한 문제
- 작은 사실 변경으로 결론이 달라질 수 있는 무검수 사례 변형
- 모범답안을 키워드만 늘어놓아도 통과하게 만드는 범용 variants

## Related

- [[question-generation-workflow]]
- [[question-output-schema]]
- [[coverage-map]]
