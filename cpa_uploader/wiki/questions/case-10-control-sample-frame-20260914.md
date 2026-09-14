---
title: "case-10-control-sample-frame-20260914. 출고승인 통제의 모집단과 표본항목 처리"
created: 2026-08-08
updated: 2026-09-14
type: question
status: generated
review_required: true
tags: [audit, question-generation, quality]
sources: ["cpa_uploader/data/cpa_question_sets_v3.authoring.json","cpa_uploader/data/official/kga520-530-2025-review10.txt","cpa_uploader/analysis/reviews/question-review-2027/10.json"]
confidence: high
---

# case-10-control-sample-frame-20260914. 출고승인 통제의 모집단과 표본항목 처리


이 페이지는 편집 정본에서 생성한 출제·검토용 색인이다. 정답·채점 조건을 포함하므로 public 문제 배포물에 포함하지 않는다. 원문과 판본 판단은 연결된 출처 및 검토 기록에서 확인한다.
- 주제: [[analytics-audit-sampling]] · [[topic-10-design]]
- 정본: [authoring JSON](../../data/cpa_question_sets_v3.authoring.json) · JSON Pointer `/172`
- 상태: published / verified · source_fidelity: reconstructed
- 검토·근거 장부: [10.json](../../analysis/reviews/question-review-2027/10.json)
- 학습 순서: sub1 → sub2 → sub3

## 공통 사실

- fact1 (scoreable=false): 한빛회계법인은 부품을 판매하는 늘봄회사의 2026년 1월 1일부터 12월 31일까지의 재무제표를 감사하고 있다. 회사의 출고담당자는 영업부서의 출고지시서와 승인권자의 사전 승인을 확인한 뒤 물품을 내보내야 한다. 감사팀은 이 승인 통제에 의존하여 관련 중요왜곡표시위험을 낮게 평가하고 통계적 표본감사로 운영효과성을 테스트하려 한다. 담당자는 ERP에서 승인완료 표시가 있는 출고지시서만 내려받아 표본을 뽑았다. 그러나 승인 표시 없이 물품이 출고된 거래도 있을 수 있다. ERP에는 승인 여부와 관계없이 모든 발행번호를 보존하는 별도 대장이 있고, 창고에는 출고기록이 남아 있다.
- fact2 (scoreable=false): 이후 감사팀이 모집단의 범위를 바로잡아 다시 선정한 항목 중 가 항목은 고객이 출고 전에 주문을 취소한 건이다. 감사인은 취소기록과 창고자료를 대조하여 지시서가 적법하게 무효화되었고 실제 출고도 없어 승인 통제를 위반한 거래가 아니라는 데 만족하였다. 나 항목은 물품이 실제로 출고되었지만 승인기록 파일이 분실된 건이다. 해당 항목에 설계한 문서검사뿐 아니라 적절한 대체적 절차도 수행할 수 없어 승인 통제의 준수 여부에 대한 증거를 얻지 못했다. 담당자는 두 항목 모두 서류 확인이 어렵다는 이유로 정상적으로 승인된 다른 항목으로 교체하려 한다.
- fact3 (scoreable=false): 감사팀이 이러한 항목들을 올바르게 처리한 후 확정한 표본이탈률은 8%로, 계획 시 예상이탈률 1%보다 높고 허용이탈률 5%도 초과하였다. 처음에 낮게 평가한 위험을 뒷받침할 추가 감사증거는 아직 입수하지 않았다. 담당자는 발견된 건수가 많지 않고 해당 출고금액도 작으므로 최초 위험평가를 그대로 유지하자고 제안한다. 표본규모나 이탈률을 새로 계산할 필요는 없다.

## sub1

유형: descriptive · JSON Pointer `/172/subquestions/0`

### 발문

승인완료 표시가 있는 출고지시서만 사용한 모집단의 문제점을 설명하고, 이번 통제테스트에 맞게 모집단과 그 완전성 확인 절차를 보완하시오.

### 모범답안

- 승인완료 항목만 고르면 사전 승인을 받지 않고 출고한 이탈 거래가 모집단에서 제외되어 승인 통제의 운영효과성을 검증하기에 적절하지 않다.
- 승인 여부와 관계없이 당기에 발행된 출고지시서를 포함하도록 모집단을 구성한다.
- 전 발행번호 대장과 창고 출고기록 등을 추출목록과 대조하여 출고지시서 모집단의 누락 여부와 완전성을 확인한다.

### 답안 계약

selection: `{"type":"all","n":null}` · constraints: `{"ordered":false,"max_entries":null,"overflow_policy":"none"}`

### 학습목표·채점명제와 핵심 조건

| criterion | 정본 명제 | 핵심 사실·조건 | 배점·판정별 점수 | requirement | source |
|---|---|---|---|---|---|
| sub1.c1 | 승인완료 항목만 고르면 사전 승인을 받지 않고 출고한 이탈 거래가 모집단에서 제외되어 승인 통제의 운영효과성을 검증하기에 적절하지 않다. | sub1.c1.claim (action): 승인완료 항목만 고르면 사전 승인을 받지 않고 출고한 이탈 거래가 모집단에서 제외되어 승인 통제의 운영효과성을 검증하기에 적절하지 않다. / sub1.c1.scope (condition): 승인 여부로 모집단을 제한하여 바로 발견해야 할 미승인 출고가 제외되는 원인과 감사목적의 불일치를 설명해야 한다. 단순히 모집단이 작다는 설명은 부족하다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub1.r1 | src-78146d7821a5d4d62f |
| sub1.c2 | 승인 여부와 관계없이 당기에 발행된 출고지시서를 포함하도록 모집단을 구성한다. | sub1.c2.claim (action): 승인 여부와 관계없이 당기에 발행된 출고지시서를 포함하도록 모집단을 구성한다. / sub1.c2.scope (condition): 미승인 출고지시서도 추출될 수 있는 범위를 제시한다. 취소 지시서의 개별 처리는 다른 물음의 범위이며 여기서 추가 점수를 주지 않는다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub1.r2 | src-06314b476090d2a131 |
| sub1.c3 | 전 발행번호 대장과 창고 출고기록 등을 추출목록과 대조하여 출고지시서 모집단의 누락 여부와 완전성을 확인한다. | sub1.c3.claim (action): 전 발행번호 대장과 창고 출고기록 등을 추출목록과 대조하여 출고지시서 모집단의 누락 여부와 완전성을 확인한다. / sub1.c3.scope (condition): 발행번호 대장 또는 창고 출고기록을 이용해 추출목록 누락을 조사하는 절차를 인정한다. 두 자료를 모두 나열해야 하는 독립적 숨은 요건은 없다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub1.r3 | src-06314b476090d2a131 |

### 요구사항과 직접 근거

| requirement | 문단·페이지·판본 | source | 원문 인용 |
|---|---|---|---|
| sub1.r1 | KGA 530 문단 6; L139-L143; 적용범위: 승인 여부로 모집단을 제한하여 바로 발견해야 할 미승인 출고가 제외되는 원인과 감사목적의 불일치를 설명해야 한다. 단순히 모집단이 작다는 설명은 부족하다. | [src-78146d7821a5d4d62f](../../data/official/kga520-530-2025-review10.txt) | 6. 감사인은 감사표본을 설계할 때 감사절차의 목적과 표본을 도출할 모집단의 특성을 고려하 여야 한다. (문단 A4-A9 참조) === PDF page 433 === 감사기준서 530 ‘표본감사’ 433 / 974 |
| sub1.r2 | KGA 530 문단 A5; L194-L200; 적용범위: 미승인 출고지시서도 추출될 수 있는 범위를 제시한다. 취소 지시서의 개별 처리는 다른 물음의 범위이며 여기서 추가 점수를 주지 않는다. | [src-06314b476090d2a131](../../data/official/kga520-530-2025-review10.txt) | A5. 감사인은 감사표본을 설계할 때 달성되어야 할 특정 목적과 그러한 목적을 가장 잘 달성할 수 있는 감사절차의 조합을 고려사항으로 포함시킨다. 감사인은 입수한 감사증거의 성격과 발생가능한 이탈이나 왜곡표시의 조건들, 또는 해당 감사증거의 기타 특성을 고려할 경우, 이탈 또는 왜곡표시를 구성하는 것이 무엇이며 표본감사를 위해 어떤 모집단을 이용할 것 인지 정의하는데 도움이 될 것이다. 감사인이 표본감사를 수행할 때 감사기준서 500의 문 단 9의 요구사항을 충족시키기 위하여는, 표본이 도출된 모집단이 완전하다는 증거를 입수 하기 위한 감사절차를 수행한다. |
| sub1.r3 | KGA 530 문단 A5; L194-L200; 적용범위: 발행번호 대장 또는 창고 출고기록을 이용해 추출목록 누락을 조사하는 절차를 인정한다. 두 자료를 모두 나열해야 하는 독립적 숨은 요건은 없다. | [src-06314b476090d2a131](../../data/official/kga520-530-2025-review10.txt) | A5. 감사인은 감사표본을 설계할 때 달성되어야 할 특정 목적과 그러한 목적을 가장 잘 달성할 수 있는 감사절차의 조합을 고려사항으로 포함시킨다. 감사인은 입수한 감사증거의 성격과 발생가능한 이탈이나 왜곡표시의 조건들, 또는 해당 감사증거의 기타 특성을 고려할 경우, 이탈 또는 왜곡표시를 구성하는 것이 무엇이며 표본감사를 위해 어떤 모집단을 이용할 것 인지 정의하는데 도움이 될 것이다. 감사인이 표본감사를 수행할 때 감사기준서 500의 문 단 9의 요구사항을 충족시키기 위하여는, 표본이 도출된 모집단이 완전하다는 증거를 입수 하기 위한 감사절차를 수행한다. |

## sub2

유형: descriptive · JSON Pointer `/172/subquestions/1`

### 발문

가 항목과 나 항목을 각각 다른 표본항목으로 교체하려는 처리가 적절한지 판단하고, 취소·출고 사실과 증거 입수 가능성을 근거로 각 항목의 올바른 처리방법을 설명하시오.

### 모범답안

- 가 항목은 적법하게 무효화되었고 실제 출고가 없어 이탈도 아니므로, 적절하게 선택한 대체항목에 감사절차를 수행한다.
- 나 항목은 실제 출고에 관한 설계된 절차와 적절한 대체적 절차를 모두 수행할 수 없으므로 다른 항목으로 바꾸지 않고 승인 통제로부터의 이탈로 취급한다.

### 답안 계약

selection: `{"type":"all","n":null}` · constraints: `{"ordered":false,"max_entries":null,"overflow_policy":"none"}`

### 학습목표·채점명제와 핵심 조건

| criterion | 정본 명제 | 핵심 사실·조건 | 배점·판정별 점수 | requirement | source |
|---|---|---|---|---|---|
| sub2.c1 | 가 항목은 적법하게 무효화되었고 실제 출고가 없어 이탈도 아니므로, 적절하게 선택한 대체항목에 감사절차를 수행한다. | sub2.c1.claim (action): 가 항목은 적법하게 무효화되었고 실제 출고가 없어 이탈도 아니므로, 적절하게 선택한 대체항목에 감사절차를 수행한다. / sub2.c1.scope (condition): 가의 적법 취소·출고 부재와 이탈 아님을 연결하여 적절히 대체항목을 선택한다는 의미를 인정한다. 이 처리와 판단을 따로 중복 배점하지 않는다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub2.r1 | src-05947565490e447ec2, src-6fece0278d5297114b |
| sub2.c2 | 나 항목은 실제 출고에 관한 설계된 절차와 적절한 대체적 절차를 모두 수행할 수 없으므로 다른 항목으로 바꾸지 않고 승인 통제로부터의 이탈로 취급한다. | sub2.c2.claim (action): 나 항목은 실제 출고에 관한 설계된 절차와 적절한 대체적 절차를 모두 수행할 수 없으므로 다른 항목으로 바꾸지 않고 승인 통제로부터의 이탈로 취급한다. / sub2.c2.scope (condition): 나의 실제 출고에 관한 통제증거를 대체적 절차로도 얻을 수 없다는 조건을 이탈 처리에 연결한다. 원래 항목에서 대체적 증거를 찾는 것과 다른 표본항목으로 교체하는 것을 구별한다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub2.r2 | src-d68deca686d311b790, src-61d530962e748fdf3c |

### 요구사항과 직접 근거

| requirement | 문단·페이지·판본 | source | 원문 인용 |
|---|---|---|---|
| sub2.r1 | KGA 530 문단 10; L150-L151; 적용범위: 가의 적법 취소·출고 부재와 이탈 아님을 연결하여 적절히 대체항목을 선택한다는 의미를 인정한다. 이 처리와 판단을 따로 중복 배점하지 않는다. | [src-05947565490e447ec2](../../data/official/kga520-530-2025-review10.txt) | 10. 감사인은 추출된 항목에 대하여 감사절차를 적용할 수 없을 경우, 대체항목에 대하여 감사 절차를 수행하여야 한다. (문단 A14 참조) |
| sub2.r2 | KGA 530 문단 11; L152-L155; 적용범위: 나의 실제 출고에 관한 통제증거를 대체적 절차로도 얻을 수 없다는 조건을 이탈 처리에 연결한다. 원래 항목에서 대체적 증거를 찾는 것과 다른 표본항목으로 교체하는 것을 구별한다. | [src-d68deca686d311b790](../../data/official/kga520-530-2025-review10.txt) | 11. 감사인이 추출된 항목에 대하여 설계된 감사절차 또는 적절한 대체적 절차를 적용할 수 없 다면, 감사인은 해당 항목을 통제테스트의 경우에는 규정된 통제로부터의 이탈로, 세부테스 트의 경우에는 왜곡표시로 취급하여야 한다. (문단 A15-A16 참조) 이탈과 왜곡표시의 성격과 원인 |

## sub3

유형: judgment · JSON Pointer `/172/subquestions/2`

### 발문

표본 결과를 얻은 뒤에도 최초의 낮은 중요왜곡표시위험 평가를 유지하자는 제안을 평가하시오. 이탈 결과와 추가 증거의 상태를 근거로 위험평가에 미치는 영향을 설명하시오.

### 모범답안

- 현재 증거만으로 최초의 낮은 위험평가를 유지할 수 없으며 관련 중요왜곡표시위험을 높여 평가하여야 한다.
- 표본이탈률 8%는 예상 1%보다 높고 허용 5%도 초과하며, 최초 평가를 뒷받침할 추가 증거가 없어 발견건수나 거래금액이 작다는 이유로 그 결과를 무시할 수 없다.

### 답안 계약

selection: `{"type":"all","n":null}` · constraints: `{"ordered":false,"max_entries":null,"overflow_policy":"none"}`

### 학습목표·채점명제와 핵심 조건

| criterion | 정본 명제 | 핵심 사실·조건 | 배점·판정별 점수 | requirement | source |
|---|---|---|---|---|---|
| sub3.c1 | 현재 증거만으로 최초의 낮은 위험평가를 유지할 수 없으며 관련 중요왜곡표시위험을 높여 평가하여야 한다. | sub3.c1.claim (action): 현재 증거만으로 최초의 낮은 위험평가를 유지할 수 없으며 관련 중요왜곡표시위험을 높여 평가하여야 한다. / sub3.c1.scope (condition): 위험을 높이거나 낮은 평가를 재고해야 한다는 조치가 명확하면 별도의 부적절 문구 없이 인정한다. 최초 위험을 그대로 유지한다는 명시적 반대 결론은 이 판단점수만 불인정한다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub3.r1 | src-4449102ca87c36c2b0 |
| sub3.c2 | 표본이탈률 8%는 예상 1%보다 높고 허용 5%도 초과하며, 최초 평가를 뒷받침할 추가 증거가 없어 발견건수나 거래금액이 작다는 이유로 그 결과를 무시할 수 없다. | sub3.c2.claim (action): 표본이탈률 8%는 예상 1%보다 높고 허용 5%도 초과하며, 최초 평가를 뒷받침할 추가 증거가 없어 발견건수나 거래금액이 작다는 이유로 그 결과를 무시할 수 없다. / sub3.c2.scope (condition): 예상보다 높은 이탈 결과와 이를 상쇄할 추가 증거 부재가 최초 평가를 뒷받침하지 못한다는 이유를 연결한다. 수치 자체의 단순 반복에는 점수를 주지 않으며 정확한 수치 재기재 없이 동등한 의미를 인정한다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub3.r2 | src-4449102ca87c36c2b0 |

### 요구사항과 직접 근거

| requirement | 문단·페이지·판본 | source | 원문 인용 |
|---|---|---|---|
| sub3.r1 | KGA 530 문단 A21; L278-L282; 적용범위: 위험을 높이거나 낮은 평가를 재고해야 한다는 조치가 명확하면 별도의 부적절 문구 없이 인정한다. 최초 위험을 그대로 유지한다는 명시적 반대 결론은 이 판단점수만 불인정한다. | [src-4449102ca87c36c2b0](../../data/official/kga520-530-2025-review10.txt) | A21. 통제테스트의 경우 예상과 다른 높은 표본이탈률은 최초의 평가를 입증할 수 있는 추가적 인 감사증거가 입수되지 않는 한 평가된 중요왜곡표시위험을 증가시킨다. 세부테스트의 경 우 예상과 다른 큰 표본왜곡표시 금액은 중요한 왜곡표시가 존재하지 않는다는 추가적인 감사증거가 없는 한 감사인은 특정 거래유형이나 계정잔액이 중요하게 왜곡표시되어 있다 고 믿을 것이다. |
| sub3.r2 | KGA 530 문단 A21; L278-L282; 적용범위: 예상보다 높은 이탈 결과와 이를 상쇄할 추가 증거 부재가 최초 평가를 뒷받침하지 못한다는 이유를 연결한다. 수치 자체의 단순 반복에는 점수를 주지 않으며 정확한 수치 재기재 없이 동등한 의미를 인정한다. | [src-4449102ca87c36c2b0](../../data/official/kga520-530-2025-review10.txt) | A21. 통제테스트의 경우 예상과 다른 높은 표본이탈률은 최초의 평가를 입증할 수 있는 추가적 인 감사증거가 입수되지 않는 한 평가된 중요왜곡표시위험을 증가시킨다. 세부테스트의 경 우 예상과 다른 큰 표본왜곡표시 금액은 중요한 왜곡표시가 존재하지 않는다는 추가적인 감사증거가 없는 한 감사인은 특정 거래유형이나 계정잔액이 중요하게 왜곡표시되어 있다 고 믿을 것이다. |

## 출처 파일·위치

| source | 직접 출처 | page | 인용 SHA-256 |
|---|---|---|---|
| src-78146d7821a5d4d62f | [KGA 530 문단 6; 2025 URL: https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06 2026 comparison URL: https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06; KGA 530 문단 6; L139-L143](../../data/official/kga520-530-2025-review10.txt) | KGA 530 | 09cbae567efdc2a9455171c1a9a92ec0c240d99a64e461d67cd151f86e8b02eb |
| src-06314b476090d2a131 | [KGA 530 문단 A5; 2025 URL: https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06 2026 comparison URL: https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06; KGA 530 문단 A5; L194-L200](../../data/official/kga520-530-2025-review10.txt) | KGA 530 | a1b2473a4f769d8e69a7c0b6d12920547becfbdfd303ec05222bebe14a5b6de4 |
| src-05947565490e447ec2 | [KGA 530 문단 10; 2025 URL: https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06 2026 comparison URL: https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06; KGA 530 문단 10; L150-L151](../../data/official/kga520-530-2025-review10.txt) | KGA 530 | d3a0c63708ac4b877804c931ec41c9c204e0bf7c63d0943f8f6472cef41a1a8c |
| src-d68deca686d311b790 | [KGA 530 문단 11; 2025 URL: https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06 2026 comparison URL: https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06; KGA 530 문단 11; L152-L155](../../data/official/kga520-530-2025-review10.txt) | KGA 530 | a33acb6d4b68a32037e63ffa30e556591225aab93eb9c82c777b5564f0c0b4ad |
| src-6fece0278d5297114b | [KGA 530 문단 A14; 2025 URL: https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06 2026 comparison URL: https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06; KGA 530 문단 A14; L247-L250](../../data/official/kga520-530-2025-review10.txt) | KGA 530 | 8576d4f793042ac0dba4989b561c277ab8acd3d4a5e6e3066805cd442120225f |
| src-61d530962e748fdf3c | [KGA 530 문단 A15; 2025 URL: https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06 2026 comparison URL: https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06; KGA 530 문단 A15; L251-L252](../../data/official/kga520-530-2025-review10.txt) | KGA 530 | f7d6b38aa1448eda262aa0cfe88b649feb1211da2c24bcb25f66ed83a0cf925a |
| src-b5fa93eb3674c68f23 | [KGA 530 문단 15; 2025 URL: https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06 2026 comparison URL: https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06; KGA 530 문단 15; L167-L176](../../data/official/kga520-530-2025-review10.txt) | KGA 530 | 60434af9d3b6f7f3b1279b8267ded1d8845d0070d363c45d4af285969ed5a22d |
| src-4449102ca87c36c2b0 | [KGA 530 문단 A21; 2025 URL: https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06 2026 comparison URL: https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06; KGA 530 문단 A21; L278-L282](../../data/official/kga520-530-2025-review10.txt) | KGA 530 | 74728d754c96092b866e2ff9fc38d96d43411d90a1594fa2200c787f5c6138e8 |

## 판본·검수 메모

- 2026년 1월 1일 개시 재무제표감사로 한정하여 2026 공식 전문의 해당 본문·시행일을 직접 대조하였다. 기출 교재와 고급연습은 원발문·사례 설계의 학습자료이며 공식 시험 원본의 무변형 사본으로 간주하지 않는다. 새 KGA540 전사는 원문 어구의 지정 fragment 모음이며 위치표시·각주 이동은 별도 provenance-v2에 기록했다. 새 문항과 사례는 재구성하였다.
- 수동 제작과 작성자 내용검토를 수행하였다. 실제 Luna 채점·독립 검수·정본 게시 상태는 상위 배치의 후속 증거로 별도 확인한다.
- 모든 물음은 사례의 사실을 해석·적용해야 하며 판단을 함축하는 근거·조치도 인정한다. 정수의 독립 의미 단위 부분점수를 합산한다.

2027 시험 적용 여부는 아래 판본 기록과 공식 시험 공고 확인 상태를 따른다. 게시 상태 또는 이 색인의 생성 상태로 대신 확정하지 않는다.

## Related

- [[source-review-map]]
- [[requirement-coverage]]
