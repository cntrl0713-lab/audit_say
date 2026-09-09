---
title: LLM 문제 생성 프롬프트
created: 2026-08-07
updated: 2026-09-09
type: guide
status: reviewed
review_required: false
tags: [audit, question-generation, source-map, quality]
sources: [cpa_uploader/data/회계감사_통합학습자료/00_통합_목차.md, cpa_uploader/data/cpa_question_sets_v3.authoring.json]
confidence: high
---

# LLM 문제 생성 프롬프트

아래 템플릿에 [[source-authoring-design]]의 완성된 계획과 실제 원자료 문맥 패킷을 함께 넣어 사용한다. 실행 생성기는 실제 응답 스키마·계획·SOURCE_PACKET 및 SOURCE_BUNDLE을 제공한다.

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
- 출처에 없는 기준서 문단, 기간, 수치, 정답의 전제·결론을 만들지 않는다. 새 발문이나 명시한 사례 설정을 실제 원문 인용·기출로 꾸미지 않는다.
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
1. 계획의 mode·목표·조건·예외·답안 범위·원자료 단위와 의존 문맥을 확인한다.
2. adapt_existing_question이면 실제 발문만 먼저 읽고 given facts, requirements, constraints를 추출한다. new_from_standard이면 기준서에서 정한 새 목표를 요구하는 발문을 설계한다. 제공되지 않은 기출 발문·해설을 만들어 넣지 않는다.
3. 관련 물음을 묶고 계획의 답안 범위 및 직접 원문을 각 requirement에 연결한다.
4. 발문·정답 명제·criterion·직접 근거를 대응시키고 누락·중복을 확인한다.
5. 공식 적용 판본·문단·예외를 확인하고 최종 인용 해시와 source fidelity를 기록한다.
6. schema_version='3.0', status='needs_review', verification.review_status='needs_human_review'로 초안을 작성한다.

출력:
- 설명문 없이 question-output-schema에 맞는 JSON 하나만 출력한다.

[CONCEPT PAGE]
{{concept_page}}

[AUTHORING PLAN]
{{authoring_plan}}

[SOURCE PACKET: CONTEXT AND DEPENDENCIES]
{{source_packet}}

[SOURCE: QUESTION]
{{source_question_if_present}}

[SOURCE: ANSWER/EXPLANATION]
{{source_answer}}

[SOURCE: STANDARD]
{{source_standard}}
```

## 사용 시 주의

concept·기존 정답이나 은행 인용 연결만으로 출제하지 않는다. 원자료 카탈로그에서 선택한 실제 단위와 필요한 문맥·참조 문단을 제공한다. 재구성 경로에는 실제 발문이 필요하고, 기준서 신규 목표 경로에는 기준서 원문과 완성된 계획이 필요하다.

생성 응답의 출처 ID·파일·위치·인용·해시는 제공된 패킷과 일치해야 한다. 생성 뒤 구조·원문 검증, 별도 의미검수, 실제 사례 채점·점수 재현 검증을 거친다. 의미검수만 pass이고 grading.status=not_run인 receipt로는 승급할 수 없다. 신규 verified 승급에는 검증을 통과한 receipt와 실제 사람 검수 근거가 모두 필요하며 생성기가 검수 완료로 상태를 올리지 않는다.

이 템플릿은 [확정 수정 정책](../../../docs/plans/question-review-01-03-remediation.md)을 반영한다. 실행 생성기와 채점 코드의 지원 여부는 별도 확인한다. 적용 연도·판본을 입력에 포함하고 2027년 동일 적용 가정을 다른 연도로 확장하지 않는다.

## Related

- [[question-generation-workflow]]
- [[question-output-schema]]
- [[source-manifest]]
