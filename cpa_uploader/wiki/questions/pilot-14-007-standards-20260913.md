---
title: "pilot-14-007-standards-20260913. 유의적이지 않은 부문의 추가 업무 대안"
created: 2026-08-08
updated: 2026-09-14
type: question
status: generated
review_required: true
tags: [audit, question-generation, quality]
sources: ["cpa_uploader/data/cpa_question_sets_v3.authoring.json","cpa_uploader/data/official/kga600-2025-review14.txt","cpa_uploader/analysis/reviews/question-review-2027/14.json"]
confidence: high
---

# pilot-14-007-standards-20260913. 유의적이지 않은 부문의 추가 업무 대안


이 페이지는 편집 정본에서 생성한 출제·검토용 색인이다. 정답·채점 조건을 포함하므로 public 문제 배포물에 포함하지 않는다. 원문과 판본 판단은 연결된 출처 및 검토 기록에서 확인한다.
- 주제: [[group-audit]] · [[topic-14-design]]
- 정본: [authoring JSON](../../data/cpa_question_sets_v3.authoring.json) · JSON Pointer `/137`
- 상태: published / verified · source_fidelity: reconstructed
- 검토·근거 장부: [14.json](../../analysis/reviews/question-review-2027/14.json)
- 학습 순서: sub4

## 공통 사실


## sub4

유형: enumeration · JSON Pointer `/137/subquestions/0`

### 발문

그룹감사의견을 위한 충분하고 적합한 증거를 얻기 어려울 것으로 예상하여 유의적이지 않은 부문 중 일부를 추가 업무 대상으로 선정하였다. 감사기준서 600 문단 29에 따라 해당 부문에서 선택할 수 있는 네 업무유형과, 부문재무정보 전체의 감사 또는 검토에 사용할 중요성을 제시하시오.

### 모범답안

- 선정된 개별 부문의 재무정보 전체에 대한 감사를 수행할 수 있다.
- 선정된 부문의 하나 이상의 거래유형·계정잔액 또는 공시에 대한 감사를 수행할 수 있다.
- 선정된 개별 부문의 재무정보 전체에 대한 검토를 수행할 수 있다.
- 선정된 부문에 대하여 특정의 절차를 수행할 수 있다.
- 선정된 부문재무정보 전체에 대한 감사 또는 검토에는 부문중요성을 사용한다.

### 답안 계약

selection: `{"type":"all","n":null}` · constraints: `{"ordered":false,"max_entries":null,"overflow_policy":"none"}`

### 학습목표·채점명제와 핵심 조건

| criterion | 정본 명제 | 핵심 사실·조건 | 배점·판정별 점수 | requirement | source |
|---|---|---|---|---|---|
| sub3.crit2 | 선정된 개별 부문의 재무정보 전체에 대한 감사를 수행할 수 있다. | sub3.crit2.fact (action): 선정된 개별 부문의 재무정보 전체에 대한 감사를 수행할 수 있다. / sub3.crit2.scope (condition): 부문재무정보 감사라는 업무유형을 평가한다. 중요성은 별도 criterion에서 평가한다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub3.req2 | std-29 |
| sub3.crit3 | 선정된 부문의 하나 이상의 거래유형·계정잔액 또는 공시에 대한 감사를 수행할 수 있다. | sub3.crit3.fact (action): 선정된 부문의 하나 이상의 거래유형·계정잔액 또는 공시에 대한 감사를 수행할 수 있다. / sub3.crit3.scope (condition): 하나 이상의 특정 항목을 대상으로 하는 감사 대안이다. 27(b)와 달리 원문 29에 없는 유의적 위험 관련성 표현을 필수요건으로 추가하지 않는다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub3.req3 | std-29 |
| sub3.crit4 | 선정된 개별 부문의 재무정보 전체에 대한 검토를 수행할 수 있다. | sub3.crit4.fact (action): 선정된 개별 부문의 재무정보 전체에 대한 검토를 수행할 수 있다. / sub3.crit4.scope (condition): 감사와 검토를 서로 다른 업무유형으로 인정한다. 검토업무기준 번호·상세 수행절차까지 요구하지 않는다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub3.req4 | std-29 |
| sub3.crit5 | 선정된 부문에 대하여 특정의 절차를 수행할 수 있다. | sub3.crit5.fact (action): 선정된 부문에 대하여 특정의 절차를 수행할 수 있다. / sub3.crit5.scope (condition): 특정절차 또는 특정 감사절차라는 의미를 인정한다. 특정 항목 감사만 쓰는 답과 구별한다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub3.req5 | std-29 |
| sub3.crit6 | 선정된 부문재무정보 전체에 대한 감사 또는 검토에는 부문중요성을 사용한다. | sub3.crit6.fact (action): 선정된 부문재무정보 전체에 대한 감사 또는 검토에는 부문중요성을 사용한다. / sub3.crit6.scope (condition): 전체감사와 검토에 공통 적용하는 중요성 기준 한 명제를 평가한다. 전체감사와 검토 모두를 포괄하는 답이면 1점이며 같은 명칭을 반복하도록 요구하지 않는다. 둘 중 한 업무에만 적용한다고 한정하거나 다른 업무에서는 부정하면 충족하지 않는다. 특정 항목 감사·특정절차 모두에 부문중요성을 일괄 적용해야 한다는 요구는 아니다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub3.req6 | std-29 |

### 요구사항과 직접 근거

| requirement | 문단·페이지·판본 | source | 원문 인용 |
|---|---|---|---|
| sub3.req2 | KGA 600.29; KGA 600 문단 29; L204-L219; 적용범위: 부문재무정보 감사라는 업무유형을 평가한다. 중요성은 별도 criterion에서 평가한다. | [std-29](../../data/official/kga600-2025-review14.txt) |  부문중요성을 사용하여 해당 부문의 재무정보에 대한 감사 |
| sub3.req3 | KGA 600.29; KGA 600 문단 29; L204-L219; 적용범위: 하나 이상의 특정 항목을 대상으로 하는 감사 대안이다. 27(b)와 달리 원문 29에 없는 유의적 위험 관련성 표현을 필수요건으로 추가하지 않는다. | [std-29](../../data/official/kga600-2025-review14.txt) |  하나 이상의 거래유형, 계정잔액 또는 공시에 대한 감사 |
| sub3.req4 | KGA 600.29; KGA 600 문단 29; L204-L219; 적용범위: 감사와 검토를 서로 다른 업무유형으로 인정한다. 검토업무기준 번호·상세 수행절차까지 요구하지 않는다. | [std-29](../../data/official/kga600-2025-review14.txt) |  부문중요성을 사용하여 해당 부문의 재무정보에 대한 검토 |
| sub3.req5 | KGA 600.29; KGA 600 문단 29; L204-L219; 적용범위: 특정절차 또는 특정 감사절차라는 의미를 인정한다. 특정 항목 감사만 쓰는 답과 구별한다. | [std-29](../../data/official/kga600-2025-review14.txt) |  특정의 절차 |
| sub3.req6 | KGA 600.29; KGA 600 문단 29; L204-L219; 적용범위: 전체감사와 검토에 공통 적용하는 중요성 기준 한 명제를 평가한다. 전체감사와 검토 모두를 포괄하는 답이면 1점이며 같은 명칭을 반복하도록 요구하지 않는다. 둘 중 한 업무에만 적용한다고 한정하거나 다른 업무에서는 부정하면 충족하지 않는다. 특정 항목 감사·특정절차 모두에 부문중요성을 일괄 적용해야 한다는 요구는 아니다. | [std-29](../../data/official/kga600-2025-review14.txt) |  부문중요성을 사용하여 해당 부문의 재무정보에 대한 감사  하나 이상의 거래유형, 계정잔액 또는 공시에 대한 감사  부문중요성을 사용하여 해당 부문의 재무정보에 대한 검토 |

## 출처 파일·위치

| source | 직접 출처 | page | 인용 SHA-256 |
|---|---|---|---|
| std-29 | [KGA 600 문단 29, 2025 개정 전문; PDF 596·597](../../data/official/kga600-2025-review14.txt) | KGA 600 | 2ae4a3df258e9c9906957e9d52901316595f7eb2cb28a3cc9a39e3d67ecf9570 |

## 판본·검수 메모

- 2027년 CPA 시험 대비. 기본 사례는 2026년 1월 1일 개시·12월 31일 종료 보고기간의 재무제표감사로, 관련 업무는 2027년에 수행한다. 국내 KGA 600의 2025 개정 전문을 기준으로 한다. 2026 공식 전문의 600.7 및 관련 본문·적용자료를 직접 비교했다. 두 전문의 600.7은 2026년 1월 1일 이후 개시 보고기간부터 시행한다고 명시한다. 2027 금융위원회 시험범위 공고는 특정 판본을 지정하지 않는다. 국제 개정 ISA 600의 도입을 국내 개정 KGA 600 시행으로 간주하지 않는다. 이번 조사에서 별도 국내 개정 600 시행공고는 확보하지 않았으며, 확인한 공식 전문의 범위를 넘어서 부재를 단정하지 않는다.
- 총괄 ID 장부에 따른 수동 제작. 공식 원문 인용은 등록 파일의 exact 부분문자열을 사용하고, 사례·발문·답안은 새로 작성했다.
- 1차 draft_ready는 정적 형상·출처·작성자 QA 준비 상태이다. 실제 의미검수·모델 채점은 최종 비교은행 고정 후 수행한다.
- source packet은 수동 근거 장부 evidence-packet 파일로 구분한다. 생성기 출제 계획 해시 표시가 없는 수동 초안이며 자동 생성 source-packet 계약을 사칭하지 않는다.
- 2026-09-13 사례형 전수 검토 후속본: 사실 활용·요구 범위 수정. 최종 검수·게시 여부는 새 실행 장부로 확인.
- 2026-09-13 사례 보강에 따른 독립 기준서형 저장 분리. 기존 학습 발문·답안·기준·정수 배점과 공식 인용을 보존. 과거 source_set_id와 새 ID의 대응은 case-expansion-2026-09-13/standard-lineage.json 참조.

2027 시험 적용 여부는 아래 판본 기록과 공식 시험 공고 확인 상태를 따른다. 게시 상태 또는 이 색인의 생성 상태로 대신 확정하지 않는다.

## Related

- [[source-review-map]]
- [[requirement-coverage]]
