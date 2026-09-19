---
title: "draft-04-320-freq01-standards-20260913. 중요성과 이용자의 공통 정보수요"
created: 2026-08-08
updated: 2026-09-19
type: question
status: generated
review_required: true
tags: [audit, question-generation, quality]
sources: ["cpa_uploader/data/cpa_question_sets_v3.authoring.json","cpa_uploader/data/official/delegated-r01-kga-2025.txt","cpa_uploader/analysis/reviews/question-review-2027/04.json"]
confidence: high
---

# draft-04-320-freq01-standards-20260913. 중요성과 이용자의 공통 정보수요


이 페이지는 편집 정본에서 생성한 출제·검토용 색인이다. 정답·채점 조건을 포함하므로 public 문제 배포물에 포함하지 않는다. 원문과 판본 판단은 연결된 출처 및 검토 기록에서 확인한다.
- 주제: [[planning-documentation-materiality]] · [[topic-04-design]]
- 정본: [authoring JSON](../../data/cpa_question_sets_v3.authoring.json) · JSON Pointer `/120`
- 상태: published / verified · source_fidelity: reconstructed
- 검토·근거 장부: [04.json](../../analysis/reviews/question-review-2027/04.json)
- 학습 순서: q2

## 공통 사실


## q2

유형: descriptive · JSON Pointer `/120/subquestions/0`

### 발문

중요성 판단에서는 어떤 범위의 재무제표 이용자와 어떤 정보수요를 고려해야 하는가? 특정 개인 이용자의 특수한 정보요구가 다른 이용자들과 다른 경우 그 개인에게 미치는 영향을 어떻게 취급하는지도 설명하시오.

### 모범답안

- 집단으로서 재무제표 이용자들의 공통적인 재무정보 수요를 고려한다.
- 개별 이용자의 정보요구는 다양할 수 있으므로 특정 개별 이용자에게 미치는 영향은 고려하지 않는다.

### 답안 계약

selection: `{"type":"all","n":null}` · constraints: `{"ordered":false,"max_entries":null,"overflow_policy":"none"}`

### 학습목표·채점명제와 핵심 조건

| criterion | 정본 명제 | 핵심 사실·조건 | 배점·판정별 점수 | requirement | source |
|---|---|---|---|---|---|
| q2.c1 | 집단으로서 재무제표 이용자들의 공통적인 재무정보 수요를 고려한다. | q2.c1.fact (conclusion): 집단으로서 재무제표 이용자들의 공통적인 재무정보 수요를 고려한다. | 1; {"met":1,"not_met":0,"contradicted":0} | q2.r1 | src2 |
| q2.c2 | 개별 이용자의 정보요구는 다양할 수 있으므로 특정 개별 이용자에게 미치는 영향은 고려하지 않는다. | q2.c2.fact (conclusion): 개별 이용자의 정보요구는 다양할 수 있으므로 특정 개별 이용자에게 미치는 영향은 고려하지 않는다. | 1; {"met":1,"not_met":0,"contradicted":0} | q2.r1 | src2 |

### 요구사항과 직접 근거

| requirement | 문단·페이지·판본 | source | 원문 인용 |
|---|---|---|---|
| q2.r1 | KGA 320 문단/보론 2; 2025 개정 PDF 305쪽; KGA 320 문단 2 원문 페이지 305; L18-L35 | [src2](../../data/official/delegated-r01-kga-2025.txt) | 2. 재무보고체계는 종종 재무제표의 작성과 표시라는 관점에서 중요성의 개념을 논의한다. 재 무보고체계에서 중요성은 상이한 용어들로 논의되기도 하지만, 일반적으로 다음과 같이 설 명된다.  누락 등 왜곡표시가 개별적으로 또는 집합적으로 재무제표에 기초한 이용자의 경제 적 의사결정에 영향을 미칠 것으로 합리적으로 예상될 수 있는 경우 중요하다고 간 주한다.  중요성에 대한 판단은 주변 상황에 비추어 내려지며, 왜곡표시의 크기나 성격 또는 양자의 결합에 의해 영향을 받는다.  재무제표 이용자에게 중요한 사항인지 여부는 집단으로서 이용자들의 공통적인 재무 정보 수요를 고려하여 판단한다.2 개별 이용자 별 정보 요구사항은 광범위하게 다양 할 수 있으므로 왜곡표시가 특정의 개별 이용자에게 미치는 영향은 고려하지 않는다 |

## 출처 파일·위치

| source | 직접 출처 | page | 인용 SHA-256 |
|---|---|---|---|
| src2 | [KGA 320 문단/보론 2; 2025 개정 PDF 305쪽](../../data/official/delegated-r01-kga-2025.txt) | KGA 320 | 6fa8cab1a47d177e72e5bd6431c86232238d6e6cba75588493b34fedffa5bc8a |

## 판본·검수 메모

- 2027년 CPA 시험 대비. 기본 사례는 2026년 1월 1일 개시 보고기간의 재무제표감사이며 필요한 후속 업무는 2027년에 수행한다. 2025 개정 전문의 해당 본문을 사용하고 2026년 7월 개정 전문의 대응 문단·시행일과 독립 대조했다. 이 6개 기준서는 2026년 1월 1일 이후 개시 보고기간부터 시행되며 570.20/A24-A25의 별도 시행 예외는 이번 22/23의 적용을 바꾸지 않는다. 금융위원회 2027 출제범위 공고에는 특정 기준서 판본 지정이 없다. sources/official-comparison.json 및 총괄 edition-policy.md 참조.
- 기존 물음은 중요성 인하 후 조치와 문서화를 평가한다. 이번에는 예외적 이익 변동 시 벤치마크 수치의 선택과 집단으로서 이용자 정보수요를 평가한다.
- 공식 인용은 발췌 원문과 일치한다. 사례·발문·답안은 범위를 명료화하여 재구성하였다.
- 독립 요구별 정수 1점. 의미가 같은 표현과 답안 전체에서 분명한 판단을 인정한다. 명시적 반대 결론은 해당 criterion에서 불인정한다.
- 작성자 QA 기대 판정의 점수 재생은 실제 모델 의미 채점이나 사람 승인·정식 검수 receipt가 아니다.
- 기존 cpa_uploader/drafts/frequency-priority-2026-09-10/draft-04-320-freq01.json의 R01 검증용 후속본. 원본·정본·과거 receipt를 수정하지 않았다. 1차 작성자 원문 대조·정적검사 단계이며 최종 모델 의미검수·실제 채점은 아직 하지 않았다.
- 2026-09-13 사례형 전수 검토 후속본: 사실 활용·요구 범위 수정. 최종 검수·게시 여부는 새 실행 장부로 확인.
- 2026-09-13 사례 보강에 따른 독립 기준서형 저장 분리. 기존 학습 발문·답안·기준·정수 배점과 공식 인용을 보존. 과거 source_set_id와 새 ID의 대응은 case-expansion-2026-09-13/standard-lineage.json 참조.

2027 시험 적용 여부는 아래 판본 기록과 공식 시험 공고 확인 상태를 따른다. 게시 상태 또는 이 색인의 생성 상태로 대신 확정하지 않는다.

## Related

- [[source-review-map]]
- [[requirement-coverage]]
