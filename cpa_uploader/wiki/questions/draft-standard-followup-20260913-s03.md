---
title: "draft-standard-followup-20260913-s03. 통계적 표본감사의 특성과 임의추출·구획추출"
created: 2026-08-08
updated: 2026-09-15
type: question
status: generated
review_required: true
tags: [audit, question-generation, quality]
sources: ["cpa_uploader/data/cpa_question_sets_v3.authoring.json","cpa_uploader/drafts/standard-followup-2026-09-13/sources/official-excerpts.txt","cpa_uploader/analysis/reviews/question-review-2027/10.json"]
confidence: high
---

# draft-standard-followup-20260913-s03. 통계적 표본감사의 특성과 임의추출·구획추출


이 페이지는 편집 정본에서 생성한 출제·검토용 색인이다. 정답·채점 조건을 포함하므로 public 문제 배포물에 포함하지 않는다. 원문과 판본 판단은 연결된 출처 및 검토 기록에서 확인한다.
- 주제: [[analytics-audit-sampling]] · [[topic-10-design]]
- 정본: [authoring JSON](../../data/cpa_question_sets_v3.authoring.json) · JSON Pointer `/154`
- 상태: published / verified · source_fidelity: reconstructed
- 검토·근거 장부: [10.json](../../analysis/reviews/question-review-2027/10.json)
- 학습 순서: sub1 → sub3 → sub4

## 공통 사실


## sub1

유형: descriptive · JSON Pointer `/154/subquestions/0`

### 발문

감사기준서 530에 따른 통계적 표본감사의 두 가지 특성과 그 충족관계를 설명하시오. 두 특성 중 하나만 갖춘 접근법의 분류와 표본규모가 통계적·비통계적 접근법을 구별하는 타당한 기준인지도 제시하시오.

### 모범답안

- 표본항목을 무작위로 추출한다.
- 표본위험의 측정 등 표본결과의 평가에 확률이론을 적용한다.
- 두 특성을 모두 갖추어야 통계적 표본감사이며 하나만 갖춘 접근법은 비통계적 표본감사이다.
- 표본규모는 통계적 접근법과 비통계적 접근법을 구별하는 타당한 기준이 아니다.

### 답안 계약

selection: `{"type":"all","n":null}` · constraints: `{"ordered":false,"max_entries":null,"overflow_policy":"none"}`

### 학습목표·채점명제와 핵심 조건

| criterion | 정본 명제 | 핵심 사실·조건 | 배점·판정별 점수 | requirement | source |
|---|---|---|---|---|---|
| crit1 | 표본항목을 무작위로 추출한다. | fact1 (action): 표본항목을 무작위로 추출한다. | 1; {"met":1,"not_met":0,"contradicted":0} | req-19435-19441 | src-530-19435-19441 |
| crit2 | 표본위험의 측정 등 표본결과의 평가에 확률이론을 적용한다. | fact2 (action): 표본위험의 측정 등 표본결과의 평가에 확률이론을 적용한다. | 1; {"met":1,"not_met":0,"contradicted":0} | req-19435-19441 | src-530-19435-19441 |
| crit3 | 두 특성을 모두 갖추어야 통계적 표본감사이며 하나만 갖춘 접근법은 비통계적 표본감사이다. | fact3 (action): 두 특성을 모두 갖추어야 통계적 표본감사이며 하나만 갖춘 접근법은 비통계적 표본감사이다. | 1; {"met":1,"not_met":0,"contradicted":0} | req-19435-19441 | src-530-19435-19441 |
| crit4 | 표본규모는 통계적 접근법과 비통계적 접근법을 구별하는 타당한 기준이 아니다. | fact4 (action): 표본규모는 통계적 접근법과 비통계적 접근법을 구별하는 타당한 기준이 아니다. | 1; {"met":1,"not_met":0,"contradicted":0} | req-19566-19569 | src-530-19566-19569 |

### 요구사항과 직접 근거

| requirement | 문단·페이지·판본 | source | 원문 인용 |
|---|---|---|---|
| req-19435-19441 | 530 5(g)·A9; 추출본 L19435–L19441 | [src-530-19435-19441](../../drafts/standard-followup-2026-09-13/sources/official-excerpts.txt) | (g) 통계적 표본감사- 다음의 특성을 모두 갖는 표본감사 접근법 (i) 표본항목을 무작위로 추출함 (ii) 표본위험의 측정 등 표본결과의 평가에 확률이론을 적용함 (i)과 (ii)의 특성을 갖추지 않은 표본감사 접근법은 비통계적 표본감사로 간주된다. |
| req-19566-19569 | 530 5(g)·A9; 추출본 L19566–L19569 | [src-530-19566-19569](../../drafts/standard-followup-2026-09-13/sources/official-excerpts.txt) | A9. 통계적 표본감사 접근법과 비통계적인 표본감사 접근법 중 어느 것을 선택할지 결정하는 것은 감사인의 판단사항이다. 그러나, 표본규모는 통계적 접근법과 비통계적 접근법을 구분 하는 타당한 기준은 아니다. |

## sub3

유형: descriptive · JSON Pointer `/154/subquestions/1`

### 발문

감사기준서 530 보론 4의 임의추출을 설명하시오. 추출방식의 특징, 편의·예측가능성과 모든 항목의 추출기회에 대한 유의사항, 통계적 표본감사에서의 적합성을 제시하시오.

### 모범답안

- 구조적인 기법을 따르지 않고 표본을 추출하는 방법이다.
- 구조적인 기법이 없어도 의도적인 편의나 예측가능성을 피한다.
- 모집단 내 모든 항목이 추출의 기회를 갖도록 한다.
- 통계적 표본감사에서 임의추출은 부적합하다.

### 답안 계약

selection: `{"type":"all","n":null}` · constraints: `{"ordered":false,"max_entries":null,"overflow_policy":"none"}`

### 학습목표·채점명제와 핵심 조건

| criterion | 정본 명제 | 핵심 사실·조건 | 배점·판정별 점수 | requirement | source |
|---|---|---|---|---|---|
| crit1 | 구조적인 기법을 따르지 않고 표본을 추출하는 방법이다. | fact1 (action): 구조적인 기법을 따르지 않고 표본을 추출하는 방법이다. | 1; {"met":1,"not_met":0,"contradicted":0} | req-19896-19900 | src-530-19896-19900 |
| crit2 | 구조적인 기법이 없어도 의도적인 편의나 예측가능성을 피한다. | fact2 (action): 구조적인 기법이 없어도 의도적인 편의나 예측가능성을 피한다. | 1; {"met":1,"not_met":0,"contradicted":0} | req-19896-19900 | src-530-19896-19900 |
| crit3 | 모집단 내 모든 항목이 추출의 기회를 갖도록 한다. 동일한 추출확률까지 요구하는 것은 아니다. | fact3 (action): 모집단 내 모든 항목이 추출의 기회를 갖도록 한다. | 1; {"met":1,"not_met":0,"contradicted":0} | req-19896-19900 | src-530-19896-19900 |
| crit4 | 통계적 표본감사에서 임의추출은 부적합하다. | fact4 (action): 통계적 표본감사에서 임의추출은 부적합하다. | 1; {"met":1,"not_met":0,"contradicted":0} | req-19896-19900 | src-530-19896-19900 |

### 요구사항과 직접 근거

| requirement | 문단·페이지·판본 | source | 원문 인용 |
|---|---|---|---|
| req-19896-19900 | 530 보론4(d); 추출본 L19896–L19900 | [src-530-19896-19900](../../drafts/standard-followup-2026-09-13/sources/official-excerpts.txt) | 임의추출. 임의추출은 감사인이 구조적인 기법을 따르지 않고 표본을 추출하는 것이다. 비 록 구조적인 기법이 적용되지 않더라도 감사인은 의도적인 편의나 예측가능성(예를 들어, 추출하기 어려운 항목은 회피하거나, 각 페이지의 최초 또는 최종 항목만을 선택하거나 배 제하는 것)을 피하고 모집단 내의 모든 항목이 추출의 기회를 갖도록 하고자 할 것이다. 통 계적 표본감사에서 임의추출은 부적합하다. |

## sub4

유형: descriptive · JSON Pointer `/154/subquestions/2`

### 발문

감사기준서 530 보론 4의 구획추출을 정의하고, 표본에 근거하여 전체 모집단에 대한 유효한 추론을 하려는 목적에 일반적으로 적합한지와 그 이유를 설명하시오. 특정 구획을 검사하는 모든 감사절차가 절대 금지된다고 해석하지 않도록 답하시오.

### 모범답안

- 모집단 안에서 이웃하는 항목들로 구성된 하나 또는 복수의 구획을 선택하는 방법이다.
- 전체 모집단을 추론하는 표본감사에는 일반적으로 적합하지 않다. 특정 구획의 항목을 조사하는 절차 자체가 항상 금지되는 것은 아니다.
- 대부분의 모집단은 연속된 항목끼리는 서로 유사하지만 다른 부분의 항목들은 다른 특징을 가져 그 구획이 전체를 대표하기 어렵기 때문이다.

### 답안 계약

selection: `{"type":"all","n":null}` · constraints: `{"ordered":false,"max_entries":null,"overflow_policy":"none"}`

### 학습목표·채점명제와 핵심 조건

| criterion | 정본 명제 | 핵심 사실·조건 | 배점·판정별 점수 | requirement | source |
|---|---|---|---|---|---|
| crit1 | 모집단 안에서 이웃하는 항목들로 구성된 하나 또는 복수의 구획을 선택하는 방법이다. | fact1 (action): 모집단 안에서 이웃하는 항목들로 구성된 하나 또는 복수의 구획을 선택하는 방법이다. | 1; {"met":1,"not_met":0,"contradicted":0} | req-19902-19907 | src-530-19902-19907 |
| crit2 | 전체 모집단을 추론하는 표본감사에는 일반적으로 적합하지 않다. "일반적으로" 등으로 절대적 금지가 아님이 드러나면 특정 구획의 항목을 조사하는 절차가 항상 금지되는 것은 아니라는 부연을 따로 쓰지 않아도 인정한다. 구획추출이나 특정 구획의 조사가 언제나 금지된다고 단정하면 인정하지 않는다. | fact2 (action): 전체 모집단을 추론하는 표본감사에는 일반적으로 적합하지 않다. | 1; {"met":1,"not_met":0,"contradicted":0} | req-19902-19907 | src-530-19902-19907 |
| crit3 | 대부분의 모집단은 연속된 항목끼리는 서로 유사하지만 다른 부분의 항목들은 다른 특징을 가져 그 구획이 전체를 대표하기 어렵기 때문이다. | fact3 (action): 대부분의 모집단은 연속된 항목끼리는 서로 유사하지만 다른 부분의 항목들은 다른 특징을 가져 그 구획이 전체를 대표하기 어렵기 때문이다. | 1; {"met":1,"not_met":0,"contradicted":0} | req-19902-19907 | src-530-19902-19907 |

### 요구사항과 직접 근거

| requirement | 문단·페이지·판본 | source | 원문 인용 |
|---|---|---|---|
| req-19902-19907 | 530 보론4(e); 추출본 L19902–L19907 | [src-530-19902-19907](../../drafts/standard-followup-2026-09-13/sources/official-excerpts.txt) | 구획추출. 구획추출은 모집단내의 이웃하는 항목으로 구성된 하나(또는 복수)의 구획을 선 택하는 방법이다. 대부분의 모집단은 연속된 항목들은 서로 유사한 특성을 가지며 모집단 의 다른 부분에 있는 항목들은 다른 특징을 가지도록 구성되어 있으므로, 구획추출은 일반 적으로 표본감사에서 사용될 수 없다. 비록 경우에 따라 특정 구획의 항목을 조사하는 감 사절차가 적합할 수 있으나, 감사인이 표본에 근거하여 전체 모집단에 대하여 유효한 추론 을 하고자 할 경우 구획추출이 적절한 표본추출 기법이 되는 경우는 드물 것이다 |

## 출처 파일·위치

| source | 직접 출처 | page | 인용 SHA-256 |
|---|---|---|---|
| src-530-19435-19441 | [KICPA 2026년 7월 개정 전문. 해당 기준의 일반 요구를 출제하며 시험 적용연도는 별도로 확정하지 않는다. 원 추출본 L19435–L19441](../../drafts/standard-followup-2026-09-13/sources/official-excerpts.txt) | KGA 530 | 665820753f36dff5d3b5461292fc838882f55f8c11716ea05814a233658178a2 |
| src-530-19566-19569 | [KICPA 2026년 7월 개정 전문. 해당 기준의 일반 요구를 출제하며 시험 적용연도는 별도로 확정하지 않는다. 원 추출본 L19566–L19569](../../drafts/standard-followup-2026-09-13/sources/official-excerpts.txt) | KGA 530 | 53d4d60286a66f48993ff87c2ce2db7c80f0bfc6c36b635c793f310c79f4bea3 |
| src-530-19885-19887 | [KICPA 2026년 7월 개정 전문. 해당 기준의 일반 요구를 출제하며 시험 적용연도는 별도로 확정하지 않는다. 원 추출본 L19885–L19887](../../drafts/standard-followup-2026-09-13/sources/official-excerpts.txt) | KGA 530 | 5c33acabdb2819a10ee45503c14ed2e6cb9c52a2dcc4a07cf93f999f97074480 |
| src-530-19885-19888 | [KICPA 2026년 7월 개정 전문. 해당 기준의 일반 요구를 출제하며 시험 적용연도는 별도로 확정하지 않는다. 원 추출본 L19885–L19888](../../drafts/standard-followup-2026-09-13/sources/official-excerpts.txt) | KGA 530 | 8b05deb585eeaf82a8c9e6ffeb64208ea4c028ad89d18739d4b94c87fab2a738 |
| src-530-19887-19888 | [KICPA 2026년 7월 개정 전문. 해당 기준의 일반 요구를 출제하며 시험 적용연도는 별도로 확정하지 않는다. 원 추출본 L19887–L19888](../../drafts/standard-followup-2026-09-13/sources/official-excerpts.txt) | KGA 530 | 06621a382ea857ac89c551aecf3cdc97b47adb4c2f6ca5688089e308ccbb555a |
| src-530-19889-19891 | [KICPA 2026년 7월 개정 전문. 해당 기준의 일반 요구를 출제하며 시험 적용연도는 별도로 확정하지 않는다. 원 추출본 L19889–L19891](../../drafts/standard-followup-2026-09-13/sources/official-excerpts.txt) | KGA 530 | 76dc437fa7f75e248e082d739191939649562b3989a0603cdbf52da009d0d2a4 |
| src-530-19896-19900 | [KICPA 2026년 7월 개정 전문. 해당 기준의 일반 요구를 출제하며 시험 적용연도는 별도로 확정하지 않는다. 원 추출본 L19896–L19900](../../drafts/standard-followup-2026-09-13/sources/official-excerpts.txt) | KGA 530 | 68e10b83b927acb065ac108c7b14996ec2fe44f66115e8e823497f33ea083da6 |
| src-530-19902-19907 | [KICPA 2026년 7월 개정 전문. 해당 기준의 일반 요구를 출제하며 시험 적용연도는 별도로 확정하지 않는다. 원 추출본 L19902–L19907](../../drafts/standard-followup-2026-09-13/sources/official-excerpts.txt) | KGA 530 | d4c038d2170fd37b2c67318c1202c2878e8cb19e0fcb178aa2c7ed5c6f287912 |

## 판본·검수 메모

- KICPA 2026년 7월 개정 전문. 해당 기준의 일반 요구를 출제하며 시험 적용연도는 별도로 확정하지 않는다.
- 담당 agent 의미검수와 실제 Luna 채점은 배치 증거로 구분한다. 사람 확인·정본 편입·게시를 의미하지 않는다.
- 2026-09-14 신규 기준서형 전수 검증 B2 후속: sub4 crit2의 채점기준 문구와 핵심 사실만 고쳤다. 발문·모범답안·배점·기대값은 같다. 근거: cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v3/changes.json
- 2026-09-14 신규 기준서형 전수 검증 O1 후속: 재편 뒤 남은 물음(sub1·sub3·sub4)에 맞게 세트 제목을 "통계적 표본감사와 표본추출 방법"에서 "통계적 표본감사의 특성과 임의추출·구획추출"로 바꾸었다. 분류 태그의 원 제목은 재편 전후 물음을 묶는 계보 표시로 유지한다. 발문·모범답안·배점은 같다. 근거: cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v4/changes.json

2027 시험 적용 여부는 아래 판본 기록과 공식 시험 공고 확인 상태를 따른다. 게시 상태 또는 이 색인의 생성 상태로 대신 확정하지 않는다.

## Related

- [[source-review-map]]
- [[requirement-coverage]]
