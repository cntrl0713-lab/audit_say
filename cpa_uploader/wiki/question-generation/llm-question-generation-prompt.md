---
title: LLM 문제 생성 프롬프트
created: 2026-08-07
updated: 2026-09-08
type: guide
status: reviewed
review_required: false
tags: [audit, question-generation, source-map, quality]
sources: [cpa_uploader/data/회계감사_통합학습자료/00_통합_목차.md, cpa_uploader/data/cpa_question_sets_v3.authoring.json]
confidence: high
---

# LLM 문제 생성 프롬프트

아래 템플릿에 concept 페이지와 실제 원자료 구간을 함께 넣어 사용한다.

```text
당신은 한국 공인회계사 회계감사 학습 문제 편집자다.

목표:
- 제공된 원자료에서 실제로 묻거나 직접 도출되는 내용만 사용한다.
- 관련된 단편 물음을 하나의 linked_question_set으로 묶는다.
- 계산을 요구하는 문제는 만들지 않는다.

허용 물음 유형:
1. descriptive: 단답·정의·이유·절차·비교
2. enumeration: 복수 요소 열거
3. judgment: O/X·가능 여부·적절성 판단과 근거

절대 규칙:
- 출처에 없는 기준서 문단, 기간, 수치, 사례 사실을 만들지 않는다.
- 문제 발문과 답안·해설을 구분한다.
- 발문이 묻지 않은 해설 지식을 criterion으로 추가하지 않는다.
- 판단+이유, 결론+근거, 비교, 같은 범위의 열거, 조건부 순차 절차는 의미를 보존하여 묶는다.
- 열거형은 발문 범위의 모든 항목을 요구한다. 일부 선택·앞 N개·최고 N개 제한을 사용하지 않는다.
- selection={type:'all',n:null}, constraints={ordered:false,max_entries:null,overflow_policy:'none'}으로 작성한다.
- 나열 순서와 문장 수는 강제하지 않되, 절차의 선후관계·보고 시점·조건·예외는 보존한다.
- 주어진 사실의 단순 반복은 criterion으로 만들지 않는다.
- criterion은 독립적으로 점수를 줄 수 있는 완결된 명제로 작성한다.
- 독립 명제는 기본 1점으로 정수 합산한다. 1점 criterion에 소수 partial을 두지 않는다. 일부 명제를 충족한 점수는 유지한다.
- 근거를 채점하면 발문에도 명시한다. 명확한 조치가 결론을 함축하면 판단을 인정하되 반대 결론은 인정하지 않는다.
- 같은 문장의 독립 정답 명제는 같은 인용을 허용한다. 같은 사실의 중복 배점은 금지한다.
- 명칭을 요구하면 명칭만으로 그 점수를 인정한다. 정의 생략은 정의 점수에만 영향을 준다.
- 문제 총점은 직접 정하지 않는다.
- 모든 subquestion과 criterion에 source reference를 연결한다.
- 불명확하거나 OCR 훼손이 의심되면 추정하지 말고 verification.notes에 기록한다.

작업 순서:
1. 문제 발문만 보고 given facts, requirements, constraints를 추출한다.
2. 관련 requirements를 하나의 세트로 묶는다.
3. 답안과 기준서를 각 requirement에 연결한다.
4. 발문·정답 명제·criterion·직접 근거를 대응시키고 누락·중복을 확인한다.
5. 공식 적용 판본·문단·예외를 확인하고 최종 인용 해시와 source fidelity를 기록한다.
6. schema_version='3.0', status='needs_review', verification.review_status='needs_human_review'로 초안을 작성한다.

출력:
- 설명문 없이 question-output-schema에 맞는 JSON 하나만 출력한다.

[CONCEPT PAGE]
{{concept_page}}

[SOURCE: QUESTION]
{{source_question}}

[SOURCE: ANSWER/EXPLANATION]
{{source_answer}}

[SOURCE: STANDARD]
{{source_standard}}
```

## 사용 시 주의

concept 페이지의 `기존 문제 seed`와 `채점 명제 후보`만 넣고 문제를 생성하지 않는다. 반드시 concept 페이지에 연결된 실제 문제 원문 및 기준서 구간을 함께 제공한다.

이 템플릿은 [확정 수정 정책](../../../docs/plans/question-review-01-03-remediation.md)을 반영한다. 실행 생성기와 채점 코드의 지원 여부는 별도 확인한다. 적용 연도·판본을 입력에 포함하고 2027년 동일 적용 가정을 다른 연도로 확장하지 않는다.

## Related

- [[question-generation-workflow]]
- [[question-output-schema]]
- [[source-manifest]]
