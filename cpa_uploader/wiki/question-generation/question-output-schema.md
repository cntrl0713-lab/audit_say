---
title: 문제 생성 출력 스키마
created: 2026-08-07
updated: 2026-08-07
type: guide
status: reviewed
review_required: false
tags: [audit, question-generation, quality]
sources: [cpa_uploader/data/cpa_question_sets_v3.authoring.json]
confidence: high
---

# 문제 생성 출력 스키마

```json
{
  "schema_version": "3.0-draft",
  "id": "draft-topic-source-seq",
  "type": "linked_question_set",
  "title": "문제 세트 제목",
  "classification": {
    "topic_id": "01",
    "standards": ["KGA 220"],
    "tags": ["독립성"]
  },
  "source_refs": [
    {
      "file": "cpa_uploader/data/...md",
      "page": "원자료 페이지",
      "source_quote": "실제 발문 또는 근거 문구",
      "role": "question | answer | standard"
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
  "learning_order": ["q1", "q2"],
  "subquestions": [
    {
      "id": "q1",
      "type": "descriptive | enumeration | judgment",
      "prompt": "물음 원문을 정확히 반영한 발문",
      "source_quote": "이 물음을 추출한 원문",
      "constraints": {
        "ordered": false,
        "max_entries": null,
        "overflow_policy": "none | ignore_after_limit"
      },
      "selection": {
        "type": "all | best_n | at_least_n",
        "n": null
      },
      "decision": null,
      "model_answer": ["물음에 직접 대응하는 답안"],
      "criteria": [
        {
          "id": "q1.c1",
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
          "source_ref_ids": [0]
        }
      ]
    }
  ],
  "verification": {
    "source_fidelity": "exact | normalized | reconstructed",
    "review_status": "needs_human_review | verified",
    "calculation_required": false,
    "notes": []
  }
}
```

## Validation Invariants

1. 모든 source quote는 지정한 source file에 실제 존재해야 한다.
2. 모든 subquestion은 최소 하나의 criterion 또는 명시적인 decision 점수를 가진다.
3. 모든 criterion의 배점과 단계별 점수는 정수다.
4. 1점 criterion은 원칙적으로 partial이 없다.
5. `best_n` 후보는 동일 배점이다.
6. 총점은 subquestion과 criterion에서 계산한다.
7. 주어진 사실을 단순 반복한 답안에는 점수를 주지 않는다.
8. 계산이 필요한 문제는 publish하지 않는다.
9. AI는 criterion verdict와 evidence만 반환하고 최종 점수는 코드가 계산한다.

## Related

- [[question-design]]
- [[question-generation-workflow]]
- [[llm-question-generation-prompt]]
