---
title: 연계형 문제 설계와 최소 문제 유형
created: 2026-08-07
updated: 2026-09-09
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

단답, 정의, 목적, 이유, 비교, 절차, 보고사항을 모두 포함한다. 전문용어의 의미와 조건은 `claim`·`critical_facts`로 보존한다. 현재 v3에 없는 `match_mode` 필드를 추가하지 않는다.

### 2. enumeration

발문이 한정한 범위의 항목을 모두 요구한다. 일부 선택을 요구한 원문은 범위와 개정 이유를 기록하고 모두 작성하도록 고친다. `selection={type:'all',n:null}`, `constraints={ordered:false,max_entries:null,overflow_policy:'none'}`을 사용한다. 상위 항목 수와 하위 채점 명제 수를 혼동하지 않는다. 문장·번호·줄바꿈 개수로 정답을 자르지 않는다.

### 3. judgment

O/X, 예/아니오, 가능/불가능, 적절/부적절, 감사의견 등을 묻는다. 근거도 채점하면 발문에 명시한다. 판단과 근거의 분리/결합 배점은 criterion 계약에 적는다. 요구 조치에서 결론이 분명하면 판단을 인정하되 명시적 반대 결론은 인정하지 않는다.

비교형·표형·시기별·조건별·사례형은 별도 채점 유형이 아니다. 이들은 shared context와 subquestion 배치로 표현한다. 서로 다른 시점의 물음은 독립 상황임을 명시한다.

## 분할 규칙

- 독립적으로 답할 수 있는 원문의 번호별 물음은 별도 subquestion으로 만든다.
- 판단+이유, 결론+근거, 비교 자체, 같은 범위의 열거, 조건부 순차 절차는 의미를 보존해 묶는다. 나열 순서는 강제하지 않되 절차의 선후관계는 criterion에서 평가한다.
- `이 경우`처럼 문맥 의존적인 표현은 필요한 주어진 사실을 shared context에 보존한다.
- 원문에 주어진 사실의 단순 반복에는 점수를 주지 않는다.

## 정수 배점

- 기본 원자 요소: 1점, `met=1`, `not_met=0`, 부분점수 없음
- 일부 criterion만 충족하면 그 정수 점수는 유지한다. 모두 작성은 물음 전체의 전부 정답/전부 0점 방식이 아니다.
- 별도 가중치가 필요한 경우 정수 배점과 부분 충족 계약을 명시한다. 1점 criterion에 소수 partial을 넣지 않는다.
- 총점은 저장하지 않고 득점 가능한 요소의 합으로 계산한다.
- 파일럿 당시의 세트 8점 제한은 적용하지 않는다. 발문이 요구하는 독립 명제를 복원했을 때 점수를 잘라내거나 서로 다른 요구를 억지로 묶어 상한에 맞추지 않는다. 요구사항의 추가·분리는 근거와 배점 변화를 검토 장부에 기록한다.
- 같은 문장이 독립 명제들을 충족하면 동일 인용을 허용한다. 동일 사실을 여러 criterion에 중복 배점하지 않는다.

## 생성 금지

- 실제 산술을 요구하는 계산 문제
- 출처에 없는 기준서 문단·기간·수치
- 해설에만 있고 발문이 묻지 않은 지식을 득점요소로 추가한 문제
- 작은 사실 변경으로 결론이 달라질 수 있는 무검수 사례 변형
- 정의·관계·조건을 묻는데 무관한 키워드만으로 통과시키는 기준. 명칭 자체를 요구한 경우에는 명칭만으로 해당 점수를 인정한다.

## 주제별 적용 지침

[수정 결정](../../../docs/plans/question-review-01-03-remediation.md)의 공통 정책을 적용하고, 해당 주제의 조건·예외·판본 메모를 함께 읽는다. 자동 생성기는 [[source-authoring-design]]을 포함한 공통 지침 다섯 문서와 선택한 주제 지침을 입력한다.

- [[topic-01-design]]
- [[topic-02-design]]
- [[topic-03-design]]
- [[topic-04-design]]
- [[topic-05-design]]
- [[topic-06-design]]
- [[topic-07-design]]
- [[topic-08-design]]
- [[topic-09-design]]
- [[topic-10-design]]
- [[topic-11-design]]
- [[topic-12-design]]
- [[topic-13-design]]
- [[topic-14-design]]
- [[topic-15-design]]
- [[topic-16-design]]
- [[topic-17-design]]
- [[topic-18-design]]
- [[topic-19-design]]

## Related

- [[question-generation-workflow]]
- [[question-output-schema]]
- [[coverage-map]]
