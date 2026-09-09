---
title: 문제 생성 출력 스키마
created: 2026-08-07
updated: 2026-09-09
type: guide
status: reviewed
review_required: false
tags: [audit, question-generation, quality]
sources: [cpa_uploader/data/cpa_question_sets_v3.authoring.json]
confidence: high
---

# 문제 생성 출력 스키마

실제 형상은 `lib/questionV3.ts`의 `QuestionSetV3`와 검증기가 기준이다. 아래는 필수 연결을 설명하는 **구조 예시**이며 출처 경로·원문·해시는 실제 자료로 채워야 한다. 그대로 은행에 넣는 검증 완료 문항이 아니다. 생성 스키마와 검증기는 모두 작성·순서 및 개수 무제한 계약만 허용하며, 과거 선택형 설정과 필수 정책 필드 누락을 거절한다.

```json
{
  "schema_version": "3.0",
  "id": "draft-topic-source-seq",
  "type": "linked_question_set",
  "status": "needs_review",
  "title": "문제 세트 제목",
  "classification": {
    "topic_id": "01",
    "part": "PART1",
    "chapter": "감사인의 책임과 품질관리",
    "domain": "ethics",
    "standards": ["KGA 220"],
    "tags": ["독립성"]
  },
  "source_refs": [
    {
      "id": "src1",
      "file": "cpa_uploader/data/...md",
      "page": "KGA 220",
      "source_quote": "실제 발문 또는 근거 문구",
      "role": "standard"
    }
  ],
  "shared_context": {
    "facts": [
      {
        "id": "f1",
        "text": "여러 물음이 공유하는 최소 사실",
        "scoreable": false
      }
    ]
  },
  "learning_order": ["q1"],
  "subquestions": [
    {
      "id": "q1",
      "type": "descriptive",
      "prompt": "물음 원문을 정확히 반영한 발문",
      "constraints": {
        "ordered": false,
        "max_entries": null,
        "overflow_policy": "none"
      },
      "selection": {
        "type": "all",
        "n": null
      },
      "decision": null,
      "model_answer": ["물음에 직접 대응하는 답안"],
      "requirements": [
        {
          "id": "req1",
          "source_ref_id": "src1",
          "source_quote": "이 요구를 직접 지지하는 실제 원문"
        }
      ],
      "criteria": [
        {
          "id": "q1.c1",
          "requirement_id": "req1",
          "claim": "독립적으로 채점 가능한 완결된 명제",
          "critical_facts": [
            {
              "id": "actor",
              "type": "actor",
              "expected": "감사인"
            }
          ],
          "max_points": 1,
          "scores": {
            "met": 1,
            "not_met": 0,
            "contradicted": 0
          },
          "source_ref_ids": ["src1"]
        }
      ]
    }
  ],
  "verification": {
    "source_fidelity": "reconstructed",
    "review_status": "needs_human_review",
    "calculation_required": false,
    "notes": ["구조 예시: 실제 출처와 정답 명제를 채우고 fidelity·해시·의미를 검수해야 함"]
  }
}
```

## Validation Invariants

1. 모든 source quote는 지정한 source file에 실제 존재해야 한다.
2. 모든 subquestion은 requirements와 최소 하나의 criterion을 가진다. decision에 독립 점수를 두지 않으며 판단 배점도 criterion으로 표현한다.
3. 모든 criterion의 배점과 단계별 점수는 정수다.
4. 1점 criterion은 원칙적으로 partial이 없다.
5. 모든 물음은 `selection.type=all`, `n=null`, `ordered=false`, `max_entries=null`, `overflow_policy=none`이다. 의미상의 절차 순서는 critical_facts에 보존한다.
6. 총점은 subquestion과 criterion에서 계산한다.
7. 주어진 사실을 단순 반복한 답안에는 점수를 주지 않는다.
8. 계산이 필요한 문제는 publish하지 않는다.
9. AI는 criterion verdict와 evidence만 반환하고 최종 점수는 코드가 계산한다.
10. source/requirement/criterion 연결은 문자열 ID로 일치해야 한다. 한 requirement에 여러 독립 criterion이 연결될 수 있다.
11. source fidelity는 실제 인용 처리에 맞게 정하고 최종 인용의 content_hash를 재계산한다. 예시의 문자열·자리표시자를 검수 완료 근거로 사용하지 않는다.
12. 공개 변환에는 정답·criterion·requirements·source_quote·decision.correct를 노출하지 않는다. 작성 정본과 공개본을 혼용하지 않는다.
13. `shared_context.facts`는 배열이며 각 fact는 고유한 id와 text를 가지고 `scoreable`은 항상 false다. 공통 지문에는 점수를 두지 않고 점수는 criterion으로만 부여한다. facts는 공개본에 그대로 나가므로 model_answer가 그대로 들어가면 검증 오류이고, model_answer 전문을 포함하면 경고가 발생한다. 사례형 세트는 이 지문에 결론 문장이 섞이지 않았는지 확인한다.
14. 채점 프롬프트에는 `shared_context`가 함께 전달된다. 사례의 전제가 지문에만 있어도 평가자가 이를 보고 판정한다. 다만 공통 지문 자체는 채점 대상이 아니며 지문을 옮겨 적은 답안은 명제를 충족하지 않는다.

단독 신규 draft는 `npx tsx cpa_uploader/validate_draft_v3.ts --file <draft.json> --against-bank`로 검사한다. 기존 ID를 수정하는 draft는 신규 ID 중복 검사와 구분한다. 구조·인용 검증만으로 내용 적합이나 실제 채점 통과를 보장하지 않는다.

이미 게시된 불변 DB 버전의 과거 constraints는 저장 기록을 바꾸지 않고 읽을 수 있다. 이 호환 처리는 저장 버전 조회에만 명시적으로 적용하며 신규 출제·정본 검증·승급·import에는 적용하지 않는다. 저장 버전도 `selection=all`로 전체 criterion 점수를 합산한다.

## 생성·의미검수 sidecar

출제 계획·원문 문맥 패킷·의미검수 receipt는 위 문항 JSON과 별도 산출물이다. 문항 스키마에 임의 필드를 추가하거나 공개 문제본에 검수 원문·정답·사례를 넣지 않는다.

- `<draft>.authoring-plan.json`: `artifact_type: question_authoring_plan`, version 1, 세트 ID가 연결된 `plans` 배열.
- `<draft>.source-packet.json`: `artifact_type: question_source_packet`, version 1, 세트 ID와 계획 해시가 연결된 `packets` 배열. 선택 원문과 의존 문맥·근거 계층·판본·해시를 보존한다.
- 별도 `<review.json>`: `schema_version: "1.0"`, `reviews` 배열. 모든 물음·criterion의 검토사항, criterion당 다섯 의미 대조 사례, 실인용·근거, 문항·실제 출처 파일·계획·패킷·비교 은행의 식별 해시와 실행 방법을 담는다. `grading`에는 실제 사례 채점의 상태·모델·transport·실행 시점·원래 판정·검증 후 점수·기대 판정 일치·사례/채점 코드 해시를 기록한다.

의미검수 receipt는 `review_question_draft_v3.ts`의 모델 또는 실제 수동 대조 경로로 작성한다. 의미검수만 마치면 pass여도 `grading.status=not_run`이다. `--grade-cases`는 채점 모델 API로 다섯 사례와 빈 답안의 실제 채점 경로를 실행하며, 기존 의미검수에는 `--review-input`을 함께 지정한다. 신규 verified 승급·재검수는 의미검수 pass, grading.status=completed, 모든 기대 판정 일치와 실제 채점 코드의 점수 재현, 입력·사례·채점 코드 해시 검증을 통과한 `--review <review.json>`과 실제 사람 검수의 `--evidence`를 모두 요구한다. 이 통과가 정답·판본 정확성을 보장하지는 않는다. 구체 명령·수동 양식·과거 장부 한계는 [[source-authoring-design]]과 [[question-generation-workflow]]를 따른다.

## 출처 위치와 인용의 충실성

현재 은행 검증기는 KGA 출처의 `source_refs[].page`를 기준서 식별에도 사용한다. 위 예시처럼 `KGA 220`을 쓰고, 세부 문단·PDF 페이지·판본은 연결된 requirement의 `source_span`과 내부 출처 장부에 기록한다. 원자료 카탈로그의 신규 KGA 단위도 page에는 기준서 코드를 유지하고 실제 줄·문단 위치를 source_span으로 전달한다. 기준서 코드 뒤에 문단·쪽수를 덧붙이기 전에 실제 검증 계약을 확인한다. 필드 이름만 보고 일반적인 페이지 번호 칸으로 취급하지 않는다.

`exact`인 인용도 어느 파일과 일치하는지 명시한다. 로컬 전재문과의 문자 일치는 공식 PDF의 서식·판본·의미 검토 완료와 같지 않다. `content_hash`는 최종 인용 문자열의 실제 SHA-256으로 계산하고, 공식 첨부파일 전체 해시는 별도로 기록한다. 원문 자체의 시행일 자리표시자나 교차참조 오류는 source quote를 윤문하여 해소하지 않는다. 직접 근거와 미확정 상태를 [[question-design]] 및 해당 검토 장부에 연결한다.

## Related

- [[question-design]]
- [[question-generation-workflow]]
- [[llm-question-generation-prompt]]
