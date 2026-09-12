---
title: "draft-09-501-freq01. 재무제표일과 다른 날짜의 재고실사 및 재고변동 통제"
created: 2026-08-08
updated: 2026-09-12
type: question
status: generated
review_required: true
tags: [audit, question-generation, quality]
sources: ["cpa_uploader/data/cpa_question_sets_v3.authoring.json","cpa_uploader/data/official/delegated-r01-kga-2025.txt","cpa_uploader/analysis/reviews/question-review-2027/09.json"]
confidence: high
---

# draft-09-501-freq01. 재무제표일과 다른 날짜의 재고실사 및 재고변동 통제


이 페이지는 편집 정본에서 생성한 출제·검토용 색인이다. 정답·채점 조건을 포함하므로 public 문제 배포물에 포함하지 않는다. 원문과 판본 판단은 연결된 출처 및 검토 기록에서 확인한다.
- 주제: [[inventory-litigation-confirmations-opening-balances]] · [[topic-09-design]]
- 정본: [authoring JSON](../../data/cpa_question_sets_v3.authoring.json) · JSON Pointer `/105`
- 상태: published / verified · source_fidelity: reconstructed
- 검토·근거 장부: [09.json](../../analysis/reviews/question-review-2027/09.json)
- 학습 순서: q1 → q2

## 공통 사실

- f0 (scoreable=false): 이 사례는 2026년 1월 1일부터 12월 31일까지의 보고기간에 대한 재무제표감사이다. 감사보고서일 후의 후속 업무는 2027년에 수행한다.
- f1 (scoreable=false): 나래회사의 재무제표일은 12월 31일이다. 중요한 재고자산의 실무상 실사일을 11월 30일로 정하였고 감사인은 이날 실사에 입회하였다.
- f2 (scoreable=false): 감사인은 재고실사 입회 시 수행할 절차와 최종 재고기록 검사를 별도로 계획하였다. 다음 물음은 실사일과 재무제표일이 다르다는 사실로 인해 필요한 추가 고려사항을 다룬다.

## q1

유형: descriptive · JSON Pointer `/105/subquestions/0`

### 발문

실사일과 재무제표일이 다르므로 감사인이 추가로 수행해야 하는 감사절차를 설명하시오. 추가 절차의 대상 기간과 확인해야 할 사항을 함께 제시하시오.

### 모범답안

- 11월 30일 실사일과 12월 31일 재무제표일 사이의 재고자산 변동이 적절하게 기록되었는지에 관한 감사증거를 얻기 위한 감사절차를 수행한다.

### 답안 계약

selection: `{"type":"all","n":null}` · constraints: `{"ordered":false,"max_entries":null,"overflow_policy":"none"}`

### 학습목표·채점명제와 핵심 조건

| criterion | 정본 명제 | 핵심 사실·조건 | 배점·판정별 점수 | requirement | source |
|---|---|---|---|---|---|
| q1.c1 | 11월 30일 실사일과 12월 31일 재무제표일 사이의 재고자산 변동이 적절하게 기록되었는지에 관한 감사증거를 얻기 위한 감사절차를 수행한다. | q1.c1.fact (conclusion): 11월 30일 실사일과 12월 31일 재무제표일 사이의 재고자산 변동이 적절하게 기록되었는지에 관한 감사증거를 얻기 위한 감사절차를 수행한다. / q1.c1.scope (condition): 기간만 옮겨 쓰면 득점하지 않는다. 그 기간 변동의 적절한 기록을 검증하는 목적·조치를 함께 제시해야 한다. | 1; {"met":1,"not_met":0,"contradicted":0} | q1.r1 | src1 |

### 요구사항과 직접 근거

| requirement | 문단·페이지·판본 | source | 원문 인용 |
|---|---|---|---|
| q1.r1 | KGA 501 문단/보론 5; 2025 개정 PDF 391쪽; KGA 501 문단 5 원문 페이지 391; L51-L57 | [src1](../../data/official/delegated-r01-kga-2025.txt) | 5. 재고자산 실사가 재무제표일이 아닌 일자에 수행될 경우, 감사인은 문단 4에서 요구하는 절차에 추가하여 실사일과 재무제표일 사이의 재고자산 변동이 적절하게 기록되었는지 여 부에 대한 감사증거를 얻기 위한 감사절차를 수행하여야 한다. (문단 A9 – A11 참조) |

## q2

유형: descriptive · JSON Pointer `/105/subquestions/1`

### 발문

재무제표일 외의 날짜에 실시한 재고실사가 감사목적에 적합한지 결정할 때 고려할 재고변동 통제의 효과성 세 측면을 모두 제시하시오. 이러한 고려가 계속기록법을 사용하는 경우에만 적용되는지도 설명하시오.

### 모범답안

- 재고자산 변동에 대한 통제의 설계가 효과적인지 고려한다.
- 재고자산 변동에 대한 통제의 실행이 효과적인지 고려한다.
- 재고자산 변동에 대한 통제의 유지가 효과적인지 고려한다.
- 이 고려는 재고수량을 실사로 결정하는 경우와 계속기록법을 유지하는 경우 모두에 적용된다.

### 답안 계약

selection: `{"type":"all","n":null}` · constraints: `{"ordered":false,"max_entries":null,"overflow_policy":"none"}`

### 학습목표·채점명제와 핵심 조건

| criterion | 정본 명제 | 핵심 사실·조건 | 배점·판정별 점수 | requirement | source |
|---|---|---|---|---|---|
| q2.c1 | 재고자산 변동에 대한 통제의 설계가 효과적인지 고려한다. | q2.c1.fact (conclusion): 재고자산 변동에 대한 통제의 설계가 효과적인지 고려한다. | 1; {"met":1,"not_met":0,"contradicted":0} | q2.r1 | src2 |
| q2.c2 | 재고자산 변동에 대한 통제의 실행이 효과적인지 고려한다. | q2.c2.fact (conclusion): 재고자산 변동에 대한 통제의 실행이 효과적인지 고려한다. | 1; {"met":1,"not_met":0,"contradicted":0} | q2.r1 | src2 |
| q2.c3 | 재고자산 변동에 대한 통제의 유지가 효과적인지 고려한다. | q2.c3.fact (conclusion): 재고자산 변동에 대한 통제의 유지가 효과적인지 고려한다. | 1; {"met":1,"not_met":0,"contradicted":0} | q2.r1 | src2 |
| q2.c4 | 이 고려는 재고수량을 실사로 결정하는 경우와 계속기록법을 유지하는 경우 모두에 적용된다. | q2.c4.fact (conclusion): 이 고려는 재고수량을 실사로 결정하는 경우와 계속기록법을 유지하는 경우 모두에 적용된다. | 1; {"met":1,"not_met":0,"contradicted":0} | q2.r1 | src2 |

### 요구사항과 직접 근거

| requirement | 문단·페이지·판본 | source | 원문 인용 |
|---|---|---|---|
| q2.r1 | KGA 501 문단/보론 A9; 2025 개정 PDF 394쪽; KGA 501 문단 A9 원문 페이지 394; L58-L64 | [src2](../../data/official/delegated-r01-kga-2025.txt) | A9. 실무상 이유로, 재고자산 실사가 재무제표일 외의 날에 수행될 수 있다. 이것은 경영진이 재고자산 수량을 실사에 의해 결정하는지 또는 계속기록법을 유지하는지 여부와 관계없이 그렇게 될 수가 있다. 어느 경우이든, 재고자산 변동에 대한 통제의 설계, 실행 및 유지의 효과성은 재무제표일 외의 특정일에 수행되는 재고자산 실사가 감사목적에 적합한지 여부 를 결정하게 된다. 감사기준서330은 기중에 수행되는 실증절차에 관한 요구사항을 정하고 관련 지침을 제공한다. 6 |

## 출처 파일·위치

| source | 직접 출처 | page | 인용 SHA-256 |
|---|---|---|---|
| src1 | [KGA 501 문단/보론 5; 2025 개정 PDF 391쪽](../../data/official/delegated-r01-kga-2025.txt) | KGA 501 | 642ba0cac5c1f2abab48433408a9ea91b2ae15d0066ccc27171ba9212fd9df93 |
| src2 | [KGA 501 문단/보론 A9; 2025 개정 PDF 394쪽](../../data/official/delegated-r01-kga-2025.txt) | KGA 501 | 09520b733a3a6210868e76c6bb42d9099c2fdd7d8bca36b4f15210e8461f9ca7 |

## 판본·검수 메모

- 2027년 CPA 시험 대비. 기본 사례는 2026년 1월 1일 개시 보고기간의 재무제표감사이며 필요한 후속 업무는 2027년에 수행한다. 2025 개정 전문의 해당 본문을 사용하고 2026년 7월 개정 전문의 대응 문단·시행일과 독립 대조했다. 이 6개 기준서는 2026년 1월 1일 이후 개시 보고기간부터 시행되며 570.20/A24-A25의 별도 시행 예외는 이번 22/23의 적용을 바꾸지 않는다. 금융위원회 2027 출제범위 공고에는 특정 기준서 판본 지정이 없다. sources/official-comparison.json 및 총괄 edition-policy.md 참조.
- 기존 세트는 입회 중 절차와 입회 실행불가능성에 대한 대응을 다룬다. 이번에는 정상적으로 입회한 실사일과 재무제표일 사이의 변동 기록 및 다른 실사일의 적합성을 정하는 통제를 평가한다.
- 공식 인용은 발췌 원문과 일치한다. 사례·발문·답안은 범위를 명료화하여 재구성하였다.
- 독립 요구별 정수 1점. 의미가 같은 표현과 답안 전체에서 분명한 판단을 인정한다. 명시적 반대 결론은 해당 criterion에서 불인정한다.
- 작성자 QA 기대 판정의 점수 재생은 실제 모델 의미 채점이나 사람 승인·정식 검수 receipt가 아니다.
- 기존 cpa_uploader/drafts/frequency-priority-2026-09-10/draft-09-501-freq01.json의 R01 검증용 후속본. 원본·정본·과거 receipt를 수정하지 않았다. 1차 작성자 원문 대조·정적검사 단계이며 최종 모델 의미검수·실제 채점은 아직 하지 않았다.

2027 시험 적용 여부는 아래 판본 기록과 공식 시험 공고 확인 상태를 따른다. 게시 상태 또는 이 색인의 생성 상태로 대신 확정하지 않는다.

## Related

- [[source-review-map]]
- [[requirement-coverage]]
