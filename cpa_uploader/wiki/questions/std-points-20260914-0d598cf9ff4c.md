---
title: "std-points-20260914-0d598cf9ff4c. 감사기준서 700 문단 16·17에 따라 감사인이 적정의견을 표명하여야 하는 경우와 감사의견을 변형하여야 하는 경우를 모두 설명하시오."
created: 2026-08-08
updated: 2026-09-19
type: question
status: generated
review_required: true
tags: [audit, question-generation, quality]
sources: ["cpa_uploader/data/cpa_question_sets_v3.authoring.json","cpa_uploader/data/official/point-review-b-source-followup-2026-09-11.txt","cpa_uploader/analysis/reviews/question-review-2027/15.json"]
confidence: high
---

# std-points-20260914-0d598cf9ff4c. 감사기준서 700 문단 16·17에 따라 감사인이 적정의견을 표명하여야 하는 경우와 감사의견을 변형하여야 하는 경우를 모두 설명하시오.


이 페이지는 편집 정본에서 생성한 출제·검토용 색인이다. 정답·채점 조건을 포함하므로 public 문제 배포물에 포함하지 않는다. 원문과 판본 판단은 연결된 출처 및 검토 기록에서 확인한다.
- 주제: [[audit-opinions-reports]] · [[topic-15-design]]
- 정본: [authoring JSON](../../data/cpa_question_sets_v3.authoring.json) · JSON Pointer `/317`
- 상태: published / verified · source_fidelity: reconstructed
- 검토·근거 장부: [15.json](../../analysis/reviews/question-review-2027/15.json)
- 학습 순서: sub2

## 공통 사실


## sub2

유형: enumeration · JSON Pointer `/317/subquestions/0`

### 발문

감사기준서 700 문단 16·17에 따라 감사인이 적정의견을 표명하여야 하는 경우와 감사의견을 변형하여야 하는 경우를 모두 설명하시오.

### 모범답안

- 해당 재무보고체계에 따라 중요성의 관점에서 작성되었다고 결론 내리면 적정의견을 표명한다.
- 입수한 감사증거에 근거할 때 재무제표 전체에 중요한 왜곡표시가 있다고 결론 내리거나, 중요한 왜곡표시가 없다고 결론 내릴 충분하고 적합한 감사증거를 입수할 수 없으면 의견을 변형한다.

### 답안 계약

selection: `{"type":"all","n":null}` · constraints: `{"ordered":false,"max_entries":null,"overflow_policy":"none"}`

### 학습목표·채점명제와 핵심 조건

| criterion | 정본 명제 | 핵심 사실·조건 | 배점·판정별 점수 | requirement | source |
|---|---|---|---|---|---|
| crit1 | 재무제표가 중요성의 관점에서 해당 재무보고체계에 따라 작성되었다고 결론 내린 경우 적정의견을 표명한다. 적정의견이라는 명칭만 쓰고 그 조건을 쓰지 않으면 인정하지 않는다. | crit1-fact (conclusion): 적정의견을 표명 / crit1-condition (condition): 재무제표가 중요성의 관점에서 해당 재무보고체계에 따라 작성되었다고 결론 내린 경우 | 1; {"met":1,"not_met":0,"contradicted":0} | req-1 | src-597829e69f241911 |
| crit2 | 증거에 근거하여 재무제표 전체의 중요한 왜곡표시를 결론 내린 경우를 제시함 | crit1-fact (condition): 입수한 감사증거에 근거한 재무제표 전체의 중요한 왜곡표시 결론 | 1; {"met":1,"not_met":0,"contradicted":0} | req-2 | src-6e02e3596ec20748, src-5b1d99a09e00a1b7 |
| crit3 | 재무제표 전체에 중요한 왜곡표시가 없다고 결론 내리기에 충분하고 적합한 증거를 입수할 수 없는 경우를 제시함 | crit2-fact (condition): 재무제표 전체가 중요하게 왜곡표시되지 않았다고 결론 내리기에 충분하고 적합한 감사증거의 입수 불가 | 1; {"met":1,"not_met":0,"contradicted":0} | req-3 | src-65285bb522d3a84c, src-5b1d99a09e00a1b7 |

### 요구사항과 직접 근거

| requirement | 문단·페이지·판본 | source | 원문 인용 |
|---|---|---|---|
| req-1 | 한국공인회계사회 회계감사기준 전문(2025년 11월 개정) / 700.16 / PDF p.676; cpa_uploader/data/official/point-review-b-source-followup-2026-09-11.txt L243–L245 | [src-597829e69f241911](../../data/official/point-review-b-source-followup-2026-09-11.txt) | 16. 감사인은 재무제표가 중요성의 관점에서 해당 재무보고체계에 따라 작성되었다고 결론을 내리면 적정의견을 표명하여야 한다. |
| req-2 | 한국공인회계사회 회계감사기준 전문(2025년 11월 개정) / 700.17(a) / PDF p.677; cpa_uploader/data/official/point-review-b-source-followup-2026-09-11.txt L255–L257 | [src-6e02e3596ec20748](../../data/official/point-review-b-source-followup-2026-09-11.txt) | (a) 입수한 감사증거에 근거할 때 재무제표가 전체적으로 중요하게 왜곡표시 되었다고 결론을 내리는 경우 |
| req-3 | 한국공인회계사회 회계감사기준 전문(2025년 11월 개정) / 700.17(b) / PDF p.677; cpa_uploader/data/official/point-review-b-source-followup-2026-09-11.txt L258–L260 | [src-65285bb522d3a84c](../../data/official/point-review-b-source-followup-2026-09-11.txt) | (b) 재무제표가 전체적으로 중요하게 왜곡표시 되지 않았다고 결론을 내릴 수 있을 정도 로 충분하고 적합한 감사증거를 입수할 수 없는 경우 |

## 출처 파일·위치

| source | 직접 출처 | page | 인용 SHA-256 |
|---|---|---|---|
| src-597829e69f241911 | [한국공인회계사회 회계감사기준 전문(2025년 11월 개정) / 700.16 / PDF p.676; cpa_uploader/data/official/point-review-b-source-followup-2026-09-11.txt L243–L245](../../data/official/point-review-b-source-followup-2026-09-11.txt) | KGA 700 | a7c834865331d78af6199482ddd57e31f61c070c3781ac8caa64efe5c1d21b03 |
| src-6e02e3596ec20748 | [한국공인회계사회 회계감사기준 전문(2025년 11월 개정) / 700.17(a) / PDF p.677; cpa_uploader/data/official/point-review-b-source-followup-2026-09-11.txt L255–L257](../../data/official/point-review-b-source-followup-2026-09-11.txt) | KGA 700 | c42f5661d01617680778a5886bc7f8a194fd82a1abca6c13e489144cfedff305 |
| src-5b1d99a09e00a1b7 | [한국공인회계사회 회계감사기준 전문(2025년 11월 개정) / 700.17 본문 / PDF p.676; cpa_uploader/data/official/point-review-b-source-followup-2026-09-11.txt L246–L248](../../data/official/point-review-b-source-followup-2026-09-11.txt) | KGA 700 | 5a8916684b2251c14a0894015d53799a6e48d800b1c89b15e03acd3fba24afe9 |
| src-65285bb522d3a84c | [한국공인회계사회 회계감사기준 전문(2025년 11월 개정) / 700.17(b) / PDF p.677; cpa_uploader/data/official/point-review-b-source-followup-2026-09-11.txt L258–L260](../../data/official/point-review-b-source-followup-2026-09-11.txt) | KGA 700 | 3411c46fb08881989971ea7a3a61bd251108c6af57e90253b8f8ebfe419c3561 |

## 판본·검수 메모

- 2026-09-14 기준서형 배점 검토의 승인된 분리·통합·조정 후속본. 원문 계보: pilot-15-005/sub1, pilot-15-005/sub2
- 결론이 발문에 이미 주어져 적정의견 한 단어만 재현하는 단독 학습량이 작다. 바로 다음 의견변형 두 경우와 합치면 정상/변형의 경계가 된다. 왜곡표시 확정과 증거부족 두 경우를 구분한 2점은 타당하다. 적정의견 1점과 비교 학습으로 통합할 수 있다.
- 등록된 원문 인용과 현재 발문·답안·기준의 의미를 대조하고 기존 적용 판본 범위에서 요구를 재구성했다. cpa_uploader/data/official/point-review-b-source-followup-2026-09-11.txt [한국공인회계사회 회계감사기준 전문(2025년 11월 개정) / 700.16 / PDF p.676; cpa_uploader/data/official/point-review-b-source-followup-2026-09-11.txt L243–L245]; cpa_uploader/data/official/point-review-b-source-followup-2026-09-11.txt [한국공인회계사회 회계감사기준 전문(2025년 11월 개정) / 700.17(a) / PDF p.677; cpa_uploader/data/official/point-review-b-source-followup-2026-09-11.txt L255–L257]; cpa_uploader/data/official/point-review-b-source-followup-2026-09-11.txt [한국공인회계사회 회계감사기준 전문(2025년 11월 개정) / 700.17(b) / PDF p.677; cpa_uploader/data/official/point-review-b-source-followup-2026-09-11.txt L258–L260]
- 검토·실측·게시 단계의 상태는 이번 실행 장부에서 확인한다.

2027 시험 적용 여부는 아래 판본 기록과 공식 시험 공고 확인 상태를 따른다. 게시 상태 또는 이 색인의 생성 상태로 대신 확정하지 않는다.

## Related

- [[source-review-map]]
- [[requirement-coverage]]
