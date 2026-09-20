---
title: "pilot-12-001-standards-20260913. 미수정왜곡표시에 관한 서면진술"
created: 2026-08-08
updated: 2026-09-20
type: question
status: generated
review_required: true
tags: [audit, question-generation, quality]
sources: ["cpa_uploader/data/cpa_question_sets_v3.authoring.json","cpa_uploader/data/official/kga450-560-570-580-2025-review12.txt","cpa_uploader/analysis/reviews/question-review-2027/12.json"]
confidence: high
---

# pilot-12-001-standards-20260913. 미수정왜곡표시에 관한 서면진술


이 페이지는 편집 정본에서 생성한 출제·검토용 색인이다. 정답·채점 조건을 포함하므로 public 문제 배포물에 포함하지 않는다. 원문과 판본 판단은 연결된 출처 및 검토 기록에서 확인한다.
- 주제: [[completion-subsequent-events-going-concern]] · [[topic-12-design]]
- 정본: [authoring JSON](../../data/cpa_question_sets_v3.authoring.json) · JSON Pointer `/107`
- 상태: published / verified · source_fidelity: exact
- 검토·근거 장부: [12.json](../../analysis/reviews/question-review-2027/12.json)
- 학습 순서: subq1

## 공통 사실


## subq1

유형: descriptive · JSON Pointer `/107/subquestions/0`

### 발문

감사기준서 450 문단 14에 따라 미수정왜곡표시와 관련하여 감사인이 경영진(적절한 경우 지배기구 포함)에게 요청하여야 하는 서면진술의 내용과 그 서면진술에 관한 요구사항을 설명하시오.

### 모범답안

- 감사인은 경영진(적절한 경우 지배기구 포함)에게 미수정왜곡표시가 개별적으로 또는 집합적으로 재무제표 전체에 중요하지 않다고 믿는지에 대한 서면진술을 요청해야 한다.
- 미수정 사항의 요약을 해당 서면진술에 포함하거나 첨부해야 한다.

### 답안 계약

selection: `{"type":"all","n":null}` · constraints: `{"ordered":false,"max_entries":null,"overflow_policy":"none"}`

### 학습목표·채점명제와 핵심 조건

| criterion | 정본 명제 | 핵심 사실·조건 | 배점·판정별 점수 | requirement | source |
|---|---|---|---|---|---|
| crit1 | 미수정왜곡표시가 개별적으로 재무제표 전체에 중요하지 않다고 믿는지에 대한 서면진술을 요청한다. | crit1-core (action): 미수정왜곡표시가 개별적으로 재무제표 전체에 중요하지 않다고 믿는지에 대한 서면진술을 요청한다. | 1; {"met":1,"not_met":0,"contradicted":0} | req1 | src2 |
| crit5 | 미수정왜곡표시가 집합적으로 재무제표 전체에 중요하지 않다고 믿는지에 대한 서면진술을 요청한다. | crit5-core (action): 미수정왜곡표시가 집합적으로 재무제표 전체에 중요하지 않다고 믿는지에 대한 서면진술을 요청한다. | 1; {"met":1,"not_met":0,"contradicted":0} | req1 | src2 |
| crit2 | 미수정 사항의 요약을 서면진술에 포함하거나 첨부한다. | crit2-core (action): 미수정 사항의 요약을 서면진술에 포함하거나 첨부한다. | 1; {"met":1,"not_met":0,"contradicted":0} | req1 | src2 |

### 요구사항과 직접 근거

| requirement | 문단·페이지·판본 | source | 원문 인용 |
|---|---|---|---|
| req1 | KGA 450.14; 2025 개정 PDF 359쪽; 2026년7월 개정과 대조; 2027 동일 적용 가정 | [src2](../../data/official/kga450-560-570-580-2025-review12.txt) | 14. 감사인은 경영진(적절한 경우 지배기구 포함)에게 이들이 미수정왜곡표시가 개별적으로 또 는 집합적으로 재무제표 전체에 중요하지 않다고 믿는지 여부에 대한 서면진술을 요청해야 한다. 그러한 미수정 사항들은 해당 서면진술에 요약되어 포함되거나 첨부되어야 한다. ( 문 단 A29 참조) |

## 출처 파일·위치

| source | 직접 출처 | page | 인용 SHA-256 |
|---|---|---|---|
| src2 | [한국공인회계사회 회계감사기준 전문(2025 개정), 주제12 직접 발췌](../../data/official/kga450-560-570-580-2025-review12.txt) | KGA 450 | 16566d368943cb61e03d07318b61bae19f1e16b94293b16979340b456cf1e613 |

## 판본·검수 메모

- LLM 위키 기반 자동 생성 파일럿. 원문·구조·의미 검수 완료.
- 2026-08-08 의미 품질 검수 지적사항을 결정적으로 보정함. 원문·구조·2차 의미 검수 완료.
- 2026-09-08 주제12 전수 검토: 공식 2025 개정 및 2026년7월 개정 전문 대조, 출처·조건·발문/채점 정합성 수정. 기존 검수·게시 상태 유지. 실측 및 미확정 사항은 docs/archive/과거-검토-증거/reports/question-review-2027/주제12-감사종결-검토-수정-결과.md 참조.
- 2026-09-11 기존 배점 B 후속 후보: 이전 원본과 검수 기록은 canonical-before.json에 보존. 이 후보의 수정 기준은 작성자 원문 대조·로컬 합산만 수행했으며 새 모델 의미검수/채점·사람 확인·게시/DB 반영은 미수행.
- 2026-09-13 사례형 전수 검토 후속본: 사실 활용·요구 범위 수정. 최종 검수·게시 여부는 새 실행 장부로 확인.
- 2026-09-13 사례 보강에 따른 독립 기준서형 저장 분리. 기존 학습 발문·답안·기준·정수 배점과 공식 인용을 보존. 과거 source_set_id와 새 ID의 대응은 case-expansion-2026-09-13/standard-lineage.json 참조.

2027 시험 적용 여부는 아래 판본 기록과 공식 시험 공고 확인 상태를 따른다. 게시 상태 또는 이 색인의 생성 상태로 대신 확정하지 않는다.

## Related

- [[source-review-map]]
- [[requirement-coverage]]
