---
title: "case-10-completion-analytics-20260914. 감사종료를 앞둔 매출·운송비 자료의 검토"
created: 2026-08-08
updated: 2026-09-15
type: question
status: generated
review_required: true
tags: [audit, question-generation, quality]
sources: ["cpa_uploader/data/cpa_question_sets_v3.authoring.json","cpa_uploader/data/official/delegated-s04-kga-2025.txt","cpa_uploader/data/official/kga315-330-2025-review06.txt","cpa_uploader/analysis/reviews/question-review-2027/10.json"]
confidence: high
---

# case-10-completion-analytics-20260914. 감사종료를 앞둔 매출·운송비 자료의 검토


이 페이지는 편집 정본에서 생성한 출제·검토용 색인이다. 정답·채점 조건을 포함하므로 public 문제 배포물에 포함하지 않는다. 원문과 판본 판단은 연결된 출처 및 검토 기록에서 확인한다.
- 주제: [[analytics-audit-sampling]] · [[topic-10-design]]
- 정본: [authoring JSON](../../data/cpa_question_sets_v3.authoring.json) · JSON Pointer `/361`
- 상태: published / verified · source_fidelity: reconstructed
- 검토·근거 장부: [10.json](../../analysis/reviews/question-review-2027/10.json)
- 학습 순서: sub1 → sub2 → sub3

## 공통 사실

- fact1 (scoreable=false): 가람회계법인은 생활용품 판매회사 해솔의 2026년 12월 31일 재무제표를 감사한다. 2027년 2월 말 현재 계획한 계정별 세부테스트를 마치고 최종 재무제표를 받았다. 위험평가 때는 상반기 자료로 매출과 이익률을 분석하였다. 이후 감사팀은 회사가 하반기에 낮은 이익률의 도매판매를 줄이고 높은 이익률의 직영판매를 늘린 사실을 계약과 거래자료에서 파악하였다. 담당자 갑은 상반기에 분석적절차를 수행했고 세부테스트도 끝났으므로 최종 재무제표에 대한 분석을 생략하자고 제안하였다.
- fact2 (scoreable=false): 책임자는 최종 자료를 살펴보다 도매부문의 12월 매출액만 전월보다 크게 늘어난 것을 발견하였다. 같은 상품의 판매단가는 변하지 않았고, 창고에서 고객에게 실제 출하한 수량은 오히려 줄었다. 증가액은 12월 마지막 사흘에 기록한 몇몇 거래에 집중되어 있었다. 감사팀은 아직 그 거래의 고객 인수자료나 1월 반품내역을 확인하지 않았다. 기존 매출감사 절차는 연중 고르게 분포한 거래를 대상으로 완료되었으며, 이 관계는 앞선 위험평가 자료에 반영되지 않았다. 그 원인은 아직 밝혀지지 않았다.
- fact3 (scoreable=false): 매출과 별도로 연간 외주운송비도 전년보다 크게 줄었다. 재무이사는 7월부터 주요 배송구간을 자체 운송으로 바꾸었기 때문이라고 설명하였다. 감사팀은 다른 계정의 감사 중 운송업체와 체결한 6월 말 계약종료 합의서와 정산내역을 이미 검사하였다. 또한 7월 이후 회사 차량의 운행기록을 배송명세와 대조하고 자체 운송기사의 급여 지급내역을 확인해 두었다. 팀원 을은 이런 자료가 있어도 경영진 설명을 들은 후에는 반드시 새 외부증거를 다시 받아야만 그 설명을 뒷받침할 수 있다고 주장하였다.

## sub1

유형: judgment · JSON Pointer `/361/subquestions/0`

### 발문

갑의 생략 제안을 평가하고, 종결 시점에 해솔의 최종 재무제표를 어떤 기업 이해와 연결하여 무엇을 확인해야 하는지 설명하시오. 실증적 분석절차의 설계요건이나 계산은 묻지 않는다.

### 모범답안

- 상반기 위험평가 분석과 계정별 세부테스트를 마쳤다는 이유로 감사종료에 근접한 분석적절차를 생략할 수 없다.
- 하반기에 낮은 이익률의 도매판매에서 높은 이익률의 직영판매로 비중이 바뀌었다는 이해와 최종 재무제표의 매출 구성·이익률 등 관계가 일관되는지 분석하여 전반적인 결론을 내리고, 개별 부문에 관해 감사 중 형성한 결론을 확인한다.

### 답안 계약

selection: `{"type":"all","n":null}` · constraints: `{"ordered":false,"max_entries":null,"overflow_policy":"none"}`

### 학습목표·채점명제와 핵심 조건

| criterion | 정본 명제 | 핵심 사실·조건 | 배점·판정별 점수 | requirement | source |
|---|---|---|---|---|---|
| sub1.c1 | 갑이 제시한 상반기 분석과 세부테스트 완료만으로 종결 분석을 생략할 수 없다고 판단한다. 종결 분석을 수행해야 한다는 조치가 이를 명확히 함축해도 인정한다. 명시적으로 생략 가능하다고 결론내리면 판단점수는 주지 않는다. | sub1.c1.fact (conclusion): 갑이 제시한 상반기 분석과 세부테스트 완료만으로 종결 분석을 생략할 수 없다고 판단한다. 종결 분석을 수행해야 한다는 조치가 이를 명확히 함축해도 인정한다. 명시적으로 생략 가능하다고 결론내리면 판단점수는 주지 않는다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub1.req1 | src-e67ae1831db41aa655, src-5c224e2b3d26cb7abb |
| sub1.c2 | 도매에서 직영으로 판매비중이 변했다는 기업 이해를 최종 매출 구성·이익률 등 재무제표 관계와 대조하여 일관성에 관한 전반적인 결론을 내린다는 목적을 설명한다. 기준서의 전반적 결론이라는 문구만 쓰고 해당 판매구조 변화와 연결하지 않으면 부족하다. 일관성 판단·개별 감사결론 확인을 중복 가점하지 않는다. | sub1.c2.fact (action): 도매에서 직영으로 판매비중이 변했다는 기업 이해를 최종 매출 구성·이익률 등 재무제표 관계와 대조하여 일관성에 관한 전반적인 결론을 내린다는 목적을 설명한다. 기준서의 전반적 결론이라는 문구만 쓰고 해당 판매구조 변화와 연결하지 않으면 부족하다. 일관성 판단·개별 감사결론 확인을 중복 가점하지 않는다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub1.req1 | src-e67ae1831db41aa655, src-93c9a60b32ac6a97bd |

### 요구사항과 직접 근거

| requirement | 문단·페이지·판본 | source | 원문 인용 |
|---|---|---|---|
| sub1.req1 | 2026 KGA 520.6; PDF 450; cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt L19126~19129; 등록 cpa_uploader/data/official/delegated-s04-kga-2025.txt L331~333 | [src-e67ae1831db41aa655](../../data/official/delegated-s04-kga-2025.txt) | 6. 감사인은 감사의 종료시점에 근접하여 기업에 대하여 이해한 바와 재무제표가 일관성이 있 는지에 대하여 전반적인 결론을 내리기 위하여 분석적절차를 설계하고 수행하여야 한다. (문단 A17-A19 참조) |
| sub1.req2 | 2026 KGA 520.A19; PDF 455; cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt L19317~19318; 등록 cpa_uploader/data/official/delegated-s04-kga-2025.txt L532~533 | [src-5c224e2b3d26cb7abb](../../data/official/delegated-s04-kga-2025.txt) | A19. 문단 6에 따라 수행된 분석적절차는 위험평가절차로서 수행된 분석적절차와 유사할 수 있 다. |
| sub1.req3 | 2026 KGA 520.A17; PDF 454; cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt L19301~19303; 등록 cpa_uploader/data/official/delegated-s04-kga-2025.txt L515~517 | [src-93c9a60b32ac6a97bd](../../data/official/delegated-s04-kga-2025.txt) | A17. 문단 6에 따라 설계되고 수행된 분석적절차의 결과로부터 도출된 결론은 재무제표의 개별 부문이나 요소에 대하여 감사 중 형성한 결론을 확인하기 위한 것이다. 이는 감사인이 감 사의견의 근거가 되는 합리적인 결론을 도출하는데 도움이 된다. |

## sub2

유형: descriptive · JSON Pointer `/361/subquestions/1`

### 발문

도매부문의 자료 관계에서 새로 검토할 매출의 중요왜곡표시위험 하나를 추론하고, 그 위험에 대응하도록 기존 감사계획에 보완할 구체적 절차 하나를 설명하시오. 거래가 잘못 기록되었다고 확정하거나 금액을 계산할 필요는 없다.

### 모범답안

- 단가가 같은데 출하수량은 감소하고 기말 매출만 급증한 관계는 실제 거래 없이 매출을 기록했거나 이듬해 매출을 앞당겨 기록했을 위험을 시사한다. 그중 발생사실 또는 기간귀속 위험 하나를 자료 관계에 연결하여 새로 검토한다.
- 이 위험을 반영하여 기존 위험평가와 계획된 추가감사절차를 수정한다. 예를 들어 12월 마지막 사흘에 집중된 매출을 대상으로 고객 인수자료와 실제 출하일을 장부 기록일에 대조하는 절차를 보완하여 매출의 발생 또는 기간귀속을 확인한다.

### 답안 계약

selection: `{"type":"all","n":null}` · constraints: `{"ordered":false,"max_entries":null,"overflow_policy":"none"}`

### 학습목표·채점명제와 핵심 조건

| criterion | 정본 명제 | 핵심 사실·조건 | 배점·판정별 점수 | requirement | source |
|---|---|---|---|---|---|
| sub2.c1 | 도매 매출 급증과 단가 불변·출하 감소의 불일치를 매출의 발생사실 또는 기간귀속에 관한 구체적 왜곡표시 가능성과 연결한다. 두 위험을 모두 쓸 필요가 없으며 주장 명칭이 없어도 가공 또는 조기 인식의 의미가 정확하면 인정한다. 단순히 위험이 높다는 말만은 부족하고, 현재 사실만으로 오류가 확정되었다고 보지 않는다. | sub2.c1.fact (conclusion): 도매 매출 급증과 단가 불변·출하 감소의 불일치를 매출의 발생사실 또는 기간귀속에 관한 구체적 왜곡표시 가능성과 연결한다. 두 위험을 모두 쓸 필요가 없으며 주장 명칭이 없어도 가공 또는 조기 인식의 의미가 정확하면 인정한다. 단순히 위험이 높다는 말만은 부족하고, 현재 사실만으로 오류가 확정되었다고 보지 않는다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub2.req1 | src-805f45ff18dbcd0b6f, src-e7d17e54be2d240805 |
| sub2.c2 | 새 위험에 맞추어 기말 집중 매출을 고객 인수자료·출하자료·후속 반품 등 관련 증거와 대조하는 구체적 절차를 계획에 보완한다. 매출의 발생 또는 적절한 기록기간을 확인하는 사례에 맞는 절차 하나면 인정한다. 위험평가 수정이라는 일반 문구나 절차를 추가한다는 말만으로는 부족하며 구체 절차와 포괄적 계획 수정에 중복 가점하지 않는다. | sub2.c2.fact (action): 새 위험에 맞추어 기말 집중 매출을 고객 인수자료·출하자료·후속 반품 등 관련 증거와 대조하는 구체적 절차를 계획에 보완한다. 매출의 발생 또는 적절한 기록기간을 확인하는 사례에 맞는 절차 하나면 인정한다. 위험평가 수정이라는 일반 문구나 절차를 추가한다는 말만으로는 부족하며 구체 절차와 포괄적 계획 수정에 중복 가점하지 않는다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub2.req1 | src-805f45ff18dbcd0b6f, src-9dc3ef023abb077fff, src-e7d17e54be2d240805 |

### 요구사항과 직접 근거

| requirement | 문단·페이지·판본 | source | 원문 인용 |
|---|---|---|---|
| sub2.req1 | 2026 KGA 520.A18; PDF 454; cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt L19304~19306; 등록 cpa_uploader/data/official/delegated-s04-kga-2025.txt L521~523 | [src-805f45ff18dbcd0b6f](../../data/official/delegated-s04-kga-2025.txt) | A18. 이와 같은 분석적절차의 결과, 이전에 인식되지 않았던 중요왜곡표시위험이 식별될 수도 있을 것이다. 감사기준서 315는 그러한 상황에서 중요왜곡표시위험에 대한 감사인의 평가 를 수정하고 이에 따라 계획된 추가감사절차를 변경할 것을 요구한다.10 |
| sub2.req2 | 2026 KGA 520.7; PDF 450; cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt L19131~19138; 등록 cpa_uploader/data/official/delegated-s04-kga-2025.txt L338~342 | [src-e7d17e54be2d240805](../../data/official/delegated-s04-kga-2025.txt) | 7. 이 감사기준서에 따라 수행된 분석적절차의 결과, 감사인이 다른 관련정보와 일관성이 없 거나 기대치와 유의적인 금액만큼 차이가 있는 변동이나 관계를 식별한 경우에는 그러한 차이에 대하여 다음과 같이 조사하여야 한다. (a) 경영진에게 질문하고 경영진의 답변과 관련성이 있는 적합한 감사증거를 입수함 (b) 그러한 상황에 필요한 기타의 감사절차를 수행함 (문단 A20-A21 참조) |
| sub2.req3 | 2026 KGA 315.37; PDF 229; cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt L9598~9601; 등록 cpa_uploader/data/official/kga315-330-2025-review06.txt L344~346 | [src-9dc3ef023abb077fff](../../data/official/kga315-330-2025-review06.txt) | 37. 최초 중요왜곡표시위험을 식별하고 평가하는 데 근거가 된 감사증거와 일관성이 없는 새로 운 정보를 입수한 경우, 감사인은 그러한 식별 또는 평가를 수정하여야 한다. (문단 A236 참조) |

## sub3

유형: judgment · JSON Pointer `/361/subquestions/2`

### 발문

을의 주장을 평가하고, 외주운송비 감소에 관한 재무이사의 설명을 평가할 때 이미 입수한 자료를 어떻게 사용할 수 있는지 사례에 맞게 설명하시오. 운송비 전체에 대한 감사가 완료되었다는 결론은 요구하지 않는다.

### 모범답안

- 경영진 설명을 들은 뒤 반드시 새 외부증거를 다시 받아야만 한다는 주장은 부적절하다. 이미 감사 중 입수한 관련 증거를 고려하여 설명을 평가할 수 있다.
- 6월 말 외주운송 계약종료·정산자료와 7월 이후 회사 차량의 실제 배송 운행·기사 급여자료를 연결하여, 비용 감소 시점이 외주운송에서 자체 운송으로 바뀐 시점과 부합하는지 평가한다. 이 자료가 설명을 적합하게 뒷받침하는지를 판단하는 것이며, 단지 자료가 있다는 이유로 설명을 무조건 수용하는 것은 아니다.

### 답안 계약

selection: `{"type":"all","n":null}` · constraints: `{"ordered":false,"max_entries":null,"overflow_policy":"none"}`

### 학습목표·채점명제와 핵심 조건

| criterion | 정본 명제 | 핵심 사실·조건 | 배점·판정별 점수 | requirement | source |
|---|---|---|---|---|---|
| sub3.c1 | 이미 입수한 관련 감사증거를 활용할 수 있으므로 설명 후 반드시 새 외부증거를 다시 받아야 한다는 일률적 주장을 배척한다. 기존 자료를 설명의 뒷받침 증거로 활용하여 평가할 수 있다는 조치가 이를 명확히 함축해도 인정한다. 새 외부증거가 언제나 필수라고 명시하면 이 판단은 인정하지 않는다. | sub3.c1.fact (conclusion): 이미 입수한 관련 감사증거를 활용할 수 있으므로 설명 후 반드시 새 외부증거를 다시 받아야 한다는 일률적 주장을 배척한다. 기존 자료를 설명의 뒷받침 증거로 활용하여 평가할 수 있다는 조치가 이를 명확히 함축해도 인정한다. 새 외부증거가 언제나 필수라고 명시하면 이 판단은 인정하지 않는다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub3.req1 | src-e7d17e54be2d240805, src-610dfeb49d38af086d |
| sub3.c2 | 6월 말 외주 계약종료·정산자료와 7월 이후 실제 자체 운송을 보여주는 자료를 연결하여 외주운송비 감소 시점과 자체 운송 전환 설명의 부합 여부를 평가한다. 자체 운송 증거는 차량 운행과 배송의 대조 또는 기사 급여 중 사례에 맞는 자료로 설명하면 되며 모두를 필수로 요구하지 않는다. 단순 자료명 나열이나 경영진의 말만 신뢰한다는 답은 부족하다. | sub3.c2.fact (action): 6월 말 외주 계약종료·정산자료와 7월 이후 실제 자체 운송을 보여주는 자료를 연결하여 외주운송비 감소 시점과 자체 운송 전환 설명의 부합 여부를 평가한다. 자체 운송 증거는 차량 운행과 배송의 대조 또는 기사 급여 중 사례에 맞는 자료로 설명하면 되며 모두를 필수로 요구하지 않는다. 단순 자료명 나열이나 경영진의 말만 신뢰한다는 답은 부족하다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub3.req2 | src-610dfeb49d38af086d, src-e7d17e54be2d240805 |

### 요구사항과 직접 근거

| requirement | 문단·페이지·판본 | source | 원문 인용 |
|---|---|---|---|
| sub3.req1 | 2026 KGA 520.7; PDF 450; cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt L19131~19138; 등록 cpa_uploader/data/official/delegated-s04-kga-2025.txt L338~342 | [src-e7d17e54be2d240805](../../data/official/delegated-s04-kga-2025.txt) | 7. 이 감사기준서에 따라 수행된 분석적절차의 결과, 감사인이 다른 관련정보와 일관성이 없 거나 기대치와 유의적인 금액만큼 차이가 있는 변동이나 관계를 식별한 경우에는 그러한 차이에 대하여 다음과 같이 조사하여야 한다. (a) 경영진에게 질문하고 경영진의 답변과 관련성이 있는 적합한 감사증거를 입수함 (b) 그러한 상황에 필요한 기타의 감사절차를 수행함 (문단 A20-A21 참조) |
| sub3.req2 | 2026 KGA 520.A20; PDF 455; cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt L19320~19322; 등록 cpa_uploader/data/official/delegated-s04-kga-2025.txt L538~540 | [src-610dfeb49d38af086d](../../data/official/delegated-s04-kga-2025.txt) | A20. 경영진의 답변과 관련된 감사증거는 기업과 그 환경에 대한 감사인의 이해를 고려하여 이 러한 답변을 평가함으로써 입수될 수 있고 감사의 진행 중에 입수한 다른 감사증거를 고려 하여 이러한 답변을 평가함으로써 입수될 수 있을 것이다. |

## 출처 파일·위치

| source | 직접 출처 | page | 인용 SHA-256 |
|---|---|---|---|
| src-e67ae1831db41aa655 | [KGA 520.6; 2026 전문 대조 PDF 450쪽, 원 추출 L19126~19129; 기존 등록 전사 L331~333](../../data/official/delegated-s04-kga-2025.txt) | KGA 520 | b3e52d0aef6e501f113895d505147085ece2570353c1763049978a626ac6432e |
| src-5c224e2b3d26cb7abb | [KGA 520.A19; 2026 전문 대조 PDF 455쪽, 원 추출 L19317~19318; 기존 등록 전사 L532~533](../../data/official/delegated-s04-kga-2025.txt) | KGA 520 | 947b4fcf5ce5409a49e0ece380674f1252eb8eda853d849d98e8ca4030ea739b |
| src-93c9a60b32ac6a97bd | [KGA 520.A17; 2026 전문 대조 PDF 454쪽, 원 추출 L19301~19303; 기존 등록 전사 L515~517](../../data/official/delegated-s04-kga-2025.txt) | KGA 520 | 4b7cacdc337b540529e1c38e701aee24f1f841e3e173952f32296286b0f08284 |
| src-805f45ff18dbcd0b6f | [KGA 520.A18; 2026 전문 대조 PDF 454쪽, 원 추출 L19304~19306; 기존 등록 전사 L521~523](../../data/official/delegated-s04-kga-2025.txt) | KGA 520 | c0fca8982f44e7ab77b633f7dc9c35c9c681f6fc104b88dd127de9a05a6981f3 |
| src-e7d17e54be2d240805 | [KGA 520.7; 2026 전문 대조 PDF 450쪽, 원 추출 L19131~19138; 기존 등록 전사 L338~342](../../data/official/delegated-s04-kga-2025.txt) | KGA 520 | 60989dfbd41f0fd8310767f5da44595288dbad220fb2099ea0009bef5b607419 |
| src-9dc3ef023abb077fff | [KGA 315.37; 2026 전문 대조 PDF 229쪽, 원 추출 L9598~9601; 기존 등록 전사 L344~346](../../data/official/kga315-330-2025-review06.txt) | KGA 315 | df858e93a22f667500786d782227a9f3b09d1b30ff43112cbbb73953364d5489 |
| src-610dfeb49d38af086d | [KGA 520.A20; 2026 전문 대조 PDF 455쪽, 원 추출 L19320~19322; 기존 등록 전사 L538~540](../../data/official/delegated-s04-kga-2025.txt) | KGA 520 | 32cb1b1f0753104a83ec3cf86e7c0aa4772b6aa72cf03c451687a4e87721e954 |

## 판본·검수 메모

- 2026-09-14 사용자 사례형 3개 추가 요청 중 A 담당의 수동 제작 1사례·3물음이다.
- 2026년 1월 1일 개시 보고기간을 가정하여 KICPA 2026 전문과 기존 공식 등록 본문을 직접 대조하였다. 시험 적용판본 확정과는 구별한다.
- agent 의미검수와 작성자 기대값은 a/review.json 및 a/qa.json에 기록한다. 실제 모델채점·사람확인·정본수록·DB등록은 별도이며 이 초안 생성으로 완료되지 않는다.

2027 시험 적용 여부는 아래 판본 기록과 공식 시험 공고 확인 상태를 따른다. 게시 상태 또는 이 색인의 생성 상태로 대신 확정하지 않는다.

## Related

- [[source-review-map]]
- [[requirement-coverage]]
