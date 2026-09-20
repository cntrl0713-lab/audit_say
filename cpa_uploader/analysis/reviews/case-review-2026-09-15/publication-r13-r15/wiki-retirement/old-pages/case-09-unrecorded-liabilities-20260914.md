---
title: "case-09-unrecorded-liabilities-20260914. 후속지급 검사와 누락된 매입채무의 탐색"
created: 2026-08-08
updated: 2026-09-20
type: question
status: generated
review_required: true
tags: [audit, question-generation, quality]
sources: ["cpa_uploader/data/cpa_question_sets_v3.authoring.json","cpa_uploader/data/official/kga500-2025-review08.txt","cpa_uploader/data/official/kga501-505-510-2025-review09.txt","cpa_uploader/data/회계감사_통합학습자료/04_기출문제/기출문제_연도별_해설_A.md","cpa_uploader/data/회계감사_통합학습자료/03_문제연습/고급_회계감사_연습.md","cpa_uploader/analysis/reviews/question-review-2027/09.json"]
confidence: high
---

# case-09-unrecorded-liabilities-20260914. 후속지급 검사와 누락된 매입채무의 탐색


이 페이지는 편집 정본에서 생성한 출제·검토용 색인이다. 정답·채점 조건을 포함하므로 public 문제 배포물에 포함하지 않는다. 원문과 판본 판단은 연결된 출처 및 검토 기록에서 확인한다.
- 주제: [[inventory-litigation-confirmations-opening-balances]] · [[topic-09-design]]
- 정본: [authoring JSON](../../data/cpa_question_sets_v3.authoring.json) · JSON Pointer `/156`
- 상태: published / verified · source_fidelity: reconstructed
- 검토·근거 장부: [09.json](../../analysis/reviews/question-review-2027/09.json)
- 학습 순서: sub1 → sub2 → sub3

## 공통 사실

- fact1 (scoreable=false): 감사팀은 산업용 부품을 제조하는 다온의 2026년 12월 31일 재무제표를 감사한다. 회사의 매입대금은 거래처에 따라 납품 후 30일 또는 60일에 결제된다. 감사팀은 기말 매입채무가 누락될 위험에 대응하고 있으며, 2027년 1월 20일에 현장업무를 마치고 3월 10일에 감사보고서를 발행할 계획이다. 현장 철수 후에도 회사의 지급기록과 매입증빙에 접근할 수 있고, 중요한 12월 매입분 중 일부는 2월에 지급될 예정이다.
- fact2 (scoreable=false): 담당자는 1월 1일부터 1월 20일까지의 주거래통장 출금내역을 매입채무원장과 대조하였다. 발견한 차이가 없자, 현장업무가 종료되므로 후속지급 검사의 대상기간도 1월 20일에 끝내자고 제안하였다. 감사팀이 그 이후의 지급이나 미지급 거래에 관하여 별도로 증거를 입수한 사실은 없다. 여기서는 후속지급 검사의 대상기간을 검토하며, 최종 감사의견이나 표본 수를 결정하지 않는다.
- fact3 (scoreable=false): 감사팀은 추가로 매입채무 조회를 실시하기로 하였다. 조회 담당자는 12월 31일 매입채무원장에서 일정금액 이상인 거래처만 선정하였다. 연간 매입내역에서는 청솔이 주요 공급업체로 나타나지만, 청솔의 기말 장부잔액은 0이다. 청솔과의 거래가 중단되거나 전액 결제되었다는 별도 근거는 아직 확인하지 않았다. 담당자는 잔액이 없으므로 청솔은 조회대상이 될 수 없다고 설명하였다.
- fact4 (scoreable=false): 기간귀속 검토에서는 1월 10일 한빛에 지급한 외상대금이 발견되었다. 회사의 기말 매입채무원장에 한빛 잔액은 없지만, 한빛에서는 12월과 1월 모두 물품을 납품하였다. 지급전표의 적요에는 외상대금이라고만 쓰여 있고 대응하는 세금계산서와 검수기록은 아직 대조하지 않았다. 담당자는 이 지급이 있었다는 사실만으로 2026년 말 매입채무 누락을 확정하려 한다. 다른 담당자의 앞선 제안과 독립적으로 이 판단을 검토한다.

## sub1

유형: descriptive · JSON Pointer `/156/subquestions/0`

### 발문

후속지급 검사의 대상기간을 현장 철수일에 끝내려는 계획을 어떻게 보완해야 하는지 설명하시오. 회사의 결제주기와 아직 검사하지 않은 지급내역을 이유에 연결하시오.

### 모범답안

- 후속지급 검사의 대상기간을 1월 20일에 끝내지 말고 감사보고서일에 근접한 시점까지 확대하여 지급내역을 검토한다.
- 12월 매입분 중 2월에 지급되는 거래가 있으므로, 현장 철수일까지의 검사만으로는 그 뒤 지급되는 누락부채를 발견하지 못할 수 있기 때문이다.

### 답안 계약

selection: `{"type":"all","n":null}` · constraints: `{"ordered":false,"max_entries":null,"overflow_policy":"none"}`

### 학습목표·채점명제와 핵심 조건

| criterion | 정본 명제 | 핵심 사실·조건 | 배점·판정별 점수 | requirement | source |
|---|---|---|---|---|---|
| sub1.c1 | 1월 20일의 종료일을 감사보고서일에 근접한 시점까지 확대하여 후속지급 내역을 검토한다. 현장 재방문 자체는 요구하지 않는다. | application (condition): 1월 20일의 종료일을 감사보고서일에 근접한 시점까지 확대하여 후속지급 내역을 검토한다 | 1; {"met":1,"not_met":0,"contradicted":0} | sub1.r1 | src-52dfce196f620f4099, src-1518221249f4db39b5, src-d17a554e2fd22ebefe |
| sub1.c2 | 30일·60일 결제주기로 12월 매입분의 일부가 2월에 지급된다는 사실을 검사기간 밖의 누락부채 미발견 위험에 연결한다. | application (condition): 30일·60일 결제주기로 12월 매입분의 일부가 2월에 지급된다는 사실을 검사기간 밖의 누락부채 미발견 위험에 연결한다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub1.r2 | src-d17a554e2fd22ebefe, src-52dfce196f620f4099 |

### 요구사항과 직접 근거

| requirement | 문단·페이지·판본 | source | 원문 인용 |
|---|---|---|---|
| sub1.r1 | cpa_uploader/data/회계감사_통합학습자료/04_기출문제/기출문제_연도별_해설_A.md L17795~L17840; 보충출처는 criterion.source_ref_ids와 design.json 참조 | [src-52dfce196f620f4099](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/04_%EA%B8%B0%EC%B6%9C%EB%AC%B8%EC%A0%9C/%EA%B8%B0%EC%B6%9C%EB%AC%B8%EC%A0%9C_%EC%97%B0%EB%8F%84%EB%B3%84_%ED%95%B4%EC%84%A4_A.md) | (1) 기말감사업무 철수일 이후 현금지급이 이루어지는 부외부채가 존재할 수 있기 때문에, 지급검토 대상기간을 감사보 고서일에 근접한 시점까지 확대하여 검토하여야 한다. ⑵ 잔액이 없거나 거의 없더라도, 당기 중 주요 거래처에 대하여 조회서를 발송한다. |
| sub1.r2 | cpa_uploader/data/official/kga500-2025-review08.txt L319~L326; 보충출처는 criterion.source_ref_ids와 design.json 참조 | [src-d17a554e2fd22ebefe](../../data/official/kga500-2025-review08.txt) | A31. 관련성은 감사절차의 목적, 그리고 적절한 경우 고려 중인 경영진주장과의 논리적인 연결 이나 관계에 관한 것이다. 감사증거로 사용될 정보의 관련성은 테스트의 방향에 영향을 받 을 것이다. 예를 들어, 감사절차의 목적이 매입채무의 실재성이나 평가에 있어 과대계상 여 부를 테스트하는 것이라면, 장부에 기록된 매입채무를 테스트하는 것이 관련성 있는 감사 절차가 될 수 있다. 이와 달리, 매입채무의 실재성이나 평가에 있어 과소계상 여부를 테스 트할 때 장부에 기록된 매입채무를 테스트하는 것은 관련성이 없을 것이며, 후속적인 지급 거래, 미지급된 송장, 매입처 계산서 그리고 일치하지 않는 검수보고서 같은 정보를 테스트 하는 것이 관련성이 있을 것이다. |

## sub2

유형: descriptive · JSON Pointer `/156/subquestions/1`

### 발문

청솔을 조회대상에서 제외한 판단을 평가하고, 이 회사의 누락 매입채무를 찾는 목적에 맞게 조회대상 선정방식을 보완하시오. 기말 장부잔액과 연간 매입내역이 서로 다른 정보를 제공한다는 점을 이유에 포함하시오.

### 모범답안

- 기말 장부잔액이 0이라는 이유만으로 청솔을 조회대상에서 제외할 수 없다.
- 청솔처럼 당기 중 주요 거래처인 공급업체는 기말 잔액이 없거나 작아도 고려하여 조회대상을 선정한다.
- 부채가 통째로 누락된 거래처는 기말 매입채무원장에 나타나지 않을 수 있다. 연간 매입내역에는 청솔의 활발한 거래가 나타나므로 기말 장부잔액만으로 조회대상을 한정하면 누락 위험을 놓칠 수 있다.

### 답안 계약

selection: `{"type":"all","n":null}` · constraints: `{"ordered":false,"max_entries":null,"overflow_policy":"none"}`

### 학습목표·채점명제와 핵심 조건

| criterion | 정본 명제 | 핵심 사실·조건 | 배점·판정별 점수 | requirement | source |
|---|---|---|---|---|---|
| sub2.c1 | 청솔의 기말 잔액 0만으로 조회대상에서 제외한 판단을 부적절하다고 판단한다. 청솔을 포함하여 선정해야 한다는 명확한 조치가 이 결론을 함축하면 인정한다. 근거나 조치가 결론을 명백히 함축하면 정해진 결론 문구 없이 판단을 인정한다. 명시적 반대 결론은 이 판단 점수를 주지 않는다. 다른 독립적으로 맞는 근거는 해당 criterion에서 인정한다. | application (condition): 청솔의 기말 잔액 0만으로 조회대상에서 제외한 판단을 부적절하다고 판단한다 | 1; {"met":1,"not_met":0,"contradicted":0} | sub2.r1 | src-52dfce196f620f4099, src-1d25333369649078ec |
| sub2.c2 | 당기 주요 공급업체라는 청솔의 거래사실을 이용하여, 잔액이 없거나 작은 거래처도 포함하도록 조회대상을 선정한다. | application (condition): 당기 주요 공급업체라는 청솔의 거래사실을 이용하여, 잔액이 없거나 작은 거래처도 포함하도록 조회대상을 선정한다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub2.r2 | src-52dfce196f620f4099, src-1d25333369649078ec |
| sub2.c3 | 기말 잔액만으로 정한 모집단에는 부채가 누락된 거래처가 빠질 수 있고, 연간 매입내역은 청솔처럼 그 위험을 조사할 주요 거래처를 포착할 수 있음을 설명한다. | application (condition): 기말 잔액만으로 정한 모집단에는 부채가 누락된 거래처가 빠질 수 있고, 연간 매입내역은 청솔처럼 그 위험을 조사할 주요 거래처를 포착할 수 있음을 설명한다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub2.r3 | src-d17a554e2fd22ebefe, src-52dfce196f620f4099 |

### 요구사항과 직접 근거

| requirement | 문단·페이지·판본 | source | 원문 인용 |
|---|---|---|---|
| sub2.r1 | cpa_uploader/data/회계감사_통합학습자료/04_기출문제/기출문제_연도별_해설_A.md L17795~L17840; 보충출처는 criterion.source_ref_ids와 design.json 참조 | [src-52dfce196f620f4099](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/04_%EA%B8%B0%EC%B6%9C%EB%AC%B8%EC%A0%9C/%EA%B8%B0%EC%B6%9C%EB%AC%B8%EC%A0%9C_%EC%97%B0%EB%8F%84%EB%B3%84_%ED%95%B4%EC%84%A4_A.md) | (1) 기말감사업무 철수일 이후 현금지급이 이루어지는 부외부채가 존재할 수 있기 때문에, 지급검토 대상기간을 감사보 고서일에 근접한 시점까지 확대하여 검토하여야 한다. ⑵ 잔액이 없거나 거의 없더라도, 당기 중 주요 거래처에 대하여 조회서를 발송한다. |
| sub2.r2 | cpa_uploader/data/회계감사_통합학습자료/04_기출문제/기출문제_연도별_해설_A.md L17795~L17840; 보충출처는 criterion.source_ref_ids와 design.json 참조 | [src-52dfce196f620f4099](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/04_%EA%B8%B0%EC%B6%9C%EB%AC%B8%EC%A0%9C/%EA%B8%B0%EC%B6%9C%EB%AC%B8%EC%A0%9C_%EC%97%B0%EB%8F%84%EB%B3%84_%ED%95%B4%EC%84%A4_A.md) | (1) 기말감사업무 철수일 이후 현금지급이 이루어지는 부외부채가 존재할 수 있기 때문에, 지급검토 대상기간을 감사보 고서일에 근접한 시점까지 확대하여 검토하여야 한다. ⑵ 잔액이 없거나 거의 없더라도, 당기 중 주요 거래처에 대하여 조회서를 발송한다. |
| sub2.r3 | cpa_uploader/data/official/kga500-2025-review08.txt L319~L326; 보충출처는 criterion.source_ref_ids와 design.json 참조 | [src-d17a554e2fd22ebefe](../../data/official/kga500-2025-review08.txt) | A31. 관련성은 감사절차의 목적, 그리고 적절한 경우 고려 중인 경영진주장과의 논리적인 연결 이나 관계에 관한 것이다. 감사증거로 사용될 정보의 관련성은 테스트의 방향에 영향을 받 을 것이다. 예를 들어, 감사절차의 목적이 매입채무의 실재성이나 평가에 있어 과대계상 여 부를 테스트하는 것이라면, 장부에 기록된 매입채무를 테스트하는 것이 관련성 있는 감사 절차가 될 수 있다. 이와 달리, 매입채무의 실재성이나 평가에 있어 과소계상 여부를 테스 트할 때 장부에 기록된 매입채무를 테스트하는 것은 관련성이 없을 것이며, 후속적인 지급 거래, 미지급된 송장, 매입처 계산서 그리고 일치하지 않는 검수보고서 같은 정보를 테스트 하는 것이 관련성이 있을 것이다. |

## sub3

유형: descriptive · JSON Pointer `/156/subquestions/2`

### 발문

한빛에 대한 1월 10일 지급만으로 전기말 매입채무 누락을 확정하려는 판단을 평가하시오. 필요한 기간귀속 확인절차와, 그 확인이 필요한 이유를 설명하시오.

### 모범답안

- 1월 10일에 지급했다는 사실만으로 2026년 말 매입채무 누락을 확정할 수 없다.
- 지급액에 대응하는 세금계산서·납품 및 검수기록 등 매입증빙을 대조하여 관련 매입과 채무가 어느 회계기간에 발생했는지 확인한다.
- 한빛은 12월과 1월 모두 납품하였으므로, 그 지급은 2027년 1월 매입분의 결제일 수도 있다. 차기 지급일과 전기말 채무의 존재는 동일한 사실이 아니다.

### 답안 계약

selection: `{"type":"all","n":null}` · constraints: `{"ordered":false,"max_entries":null,"overflow_policy":"none"}`

### 학습목표·채점명제와 핵심 조건

| criterion | 정본 명제 | 핵심 사실·조건 | 배점·판정별 점수 | requirement | source |
|---|---|---|---|---|---|
| sub3.c1 | 차기 지급만으로 전기말 누락부채를 확정하는 판단을 부적절하다고 판단한다. 귀속을 확인한 후 결정해야 한다는 조치가 명백히 함축하면 인정한다. 근거나 조치가 결론을 명백히 함축하면 정해진 결론 문구 없이 판단을 인정한다. 명시적 반대 결론은 이 판단 점수를 주지 않는다. 다른 독립적으로 맞는 근거는 해당 criterion에서 인정한다. | application (condition): 차기 지급만으로 전기말 누락부채를 확정하는 판단을 부적절하다고 판단한다 | 1; {"met":1,"not_met":0,"contradicted":0} | sub3.r1 | src-a05d2d3b78915d6028, src-1518221249f4db39b5 |
| sub3.c2 | 한빛 지급에 대응하는 매입·납품·검수 증빙을 대조하여 거래와 채무가 발생한 회계기간을 확인하는 절차를 제시한다. | application (condition): 한빛 지급에 대응하는 매입·납품·검수 증빙을 대조하여 거래와 채무가 발생한 회계기간을 확인하는 절차를 제시한다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub3.r2 | src-a05d2d3b78915d6028, src-d17a554e2fd22ebefe |
| sub3.c3 | 12월과 1월 모두 납품했다는 상황 때문에 1월 지급이 당해 1월 매입의 결제일 수도 있어 전기말 부채를 곧바로 입증하지 못함을 설명한다. | application (condition): 12월과 1월 모두 납품했다는 상황 때문에 1월 지급이 당해 1월 매입의 결제일 수도 있어 전기말 부채를 곧바로 입증하지 못함을 설명한다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub3.r3 | src-a05d2d3b78915d6028 |

### 요구사항과 직접 근거

| requirement | 문단·페이지·판본 | source | 원문 인용 |
|---|---|---|---|
| sub3.r1 | cpa_uploader/data/회계감사_통합학습자료/03_문제연습/고급_회계감사_연습.md L4195~L4246; 보충출처는 criterion.source_ref_ids와 design.json 참조 | [src-a05d2d3b78915d6028](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/03_%EB%AC%B8%EC%A0%9C%EC%97%B0%EC%8A%B5/%EA%B3%A0%EA%B8%89_%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%EC%97%B0%EC%8A%B5.md) | (주)P 에게 지급한 외상대금을 식별된 왜 곡표시로 판단함 해당 외상대금은 차기 매입에 대한 외상대금 지급일 수도 있으므로 기 간귀속에 대한 추가적인 감사절차를 수행하여야 한다. (차기초에 지급된 내역이라고 해서 무조건 작년도 채무에 대한 지급이라고 볼 수는 없다.) |
| sub3.r2 | cpa_uploader/data/회계감사_통합학습자료/03_문제연습/고급_회계감사_연습.md L4195~L4246; 보충출처는 criterion.source_ref_ids와 design.json 참조 | [src-a05d2d3b78915d6028](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/03_%EB%AC%B8%EC%A0%9C%EC%97%B0%EC%8A%B5/%EA%B3%A0%EA%B8%89_%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%EC%97%B0%EC%8A%B5.md) | (주)P 에게 지급한 외상대금을 식별된 왜 곡표시로 판단함 해당 외상대금은 차기 매입에 대한 외상대금 지급일 수도 있으므로 기 간귀속에 대한 추가적인 감사절차를 수행하여야 한다. (차기초에 지급된 내역이라고 해서 무조건 작년도 채무에 대한 지급이라고 볼 수는 없다.) |
| sub3.r3 | cpa_uploader/data/회계감사_통합학습자료/03_문제연습/고급_회계감사_연습.md L4195~L4246; 보충출처는 criterion.source_ref_ids와 design.json 참조 | [src-a05d2d3b78915d6028](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/03_%EB%AC%B8%EC%A0%9C%EC%97%B0%EC%8A%B5/%EA%B3%A0%EA%B8%89_%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%EC%97%B0%EC%8A%B5.md) | (주)P 에게 지급한 외상대금을 식별된 왜 곡표시로 판단함 해당 외상대금은 차기 매입에 대한 외상대금 지급일 수도 있으므로 기 간귀속에 대한 추가적인 감사절차를 수행하여야 한다. (차기초에 지급된 내역이라고 해서 무조건 작년도 채무에 대한 지급이라고 볼 수는 없다.) |

## 출처 파일·위치

| source | 직접 출처 | page | 인용 SHA-256 |
|---|---|---|---|
| src-1518221249f4db39b5 | [KGA 500 6 등록 원문 PDF 370쪽; L58~L60](../../data/official/kga500-2025-review08.txt) | KGA 500 | 55ffc81ad5a561a8be366e8ce0b08500ff7167d434a679fcdff28678a700fa9e |
| src-d17a554e2fd22ebefe | [KGA 500 A31 등록 원문 PDF 378쪽; L319~L326](../../data/official/kga500-2025-review08.txt) | KGA 500 | da426013d27a70e14591406ddf2a6061c731f4394727b42e61cc150b44dc4032 |
| src-1d25333369649078ec | [KGA 505 7 등록 원문 PDF 402쪽; L238~L246](../../data/official/kga501-505-510-2025-review09.txt) | KGA 505 | 4f54786e82f105f3a75e3292d1988ec43cd50027d1dac0d00ba0aad5803bbab7 |
| src-52dfce196f620f4099 | [기출문제_연도별_해설_A 원문 451쪽; L17795~L17840](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/04_%EA%B8%B0%EC%B6%9C%EB%AC%B8%EC%A0%9C/%EA%B8%B0%EC%B6%9C%EB%AC%B8%EC%A0%9C_%EC%97%B0%EB%8F%84%EB%B3%84_%ED%95%B4%EC%84%A4_A.md) | 원문 451쪽 | 09f56878fd19b92a7aa0f66d02e47c8016c02bf5b4a6a6f7bcc91761231e6497 |
| src-a05d2d3b78915d6028 | [고급_회계감사_연습 원문 129쪽; L4195~L4246](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/03_%EB%AC%B8%EC%A0%9C%EC%97%B0%EC%8A%B5/%EA%B3%A0%EA%B8%89_%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%EC%97%B0%EC%8A%B5.md) | 원문 129쪽 | 015e50c4f1f27be778c32f15e4b71b5e026e1e1b69c935711b1a934d69845d7f |

## 판본·검수 메모

- 새로운 사례 사실을 재구성하였다. 공식 원문과 기존 문항 대조는 design.json을 따른다.
- 작성 agent의 내용 검토와 실제 Luna 채점·독립 검토·게시를 구별한다. 실제 채점은 상위 배치에서 진행한다.

2027 시험 적용 여부는 아래 판본 기록과 공식 시험 공고 확인 상태를 따른다. 게시 상태 또는 이 색인의 생성 상태로 대신 확정하지 않는다.

## Related

- [[source-review-map]]
- [[requirement-coverage]]
