---
title: "pilot-03-005-standards-20260913. 감사 전제조건의 정보 접근과 계약서 기재사항"
created: 2026-08-08
updated: 2026-09-20
type: question
status: generated
review_required: true
tags: [audit, question-generation, quality]
sources: ["cpa_uploader/data/cpa_question_sets_v3.authoring.json","cpa_uploader/data/official/delegated-n01-kga200-210-230-2025.txt","cpa_uploader/analysis/reviews/question-review-2027/03.json"]
confidence: high
---

# pilot-03-005-standards-20260913. 감사 전제조건의 정보 접근과 계약서 기재사항


이 페이지는 편집 정본에서 생성한 출제·검토용 색인이다. 정답·채점 조건을 포함하므로 public 문제 배포물에 포함하지 않는다. 원문과 판본 판단은 연결된 출처 및 검토 기록에서 확인한다.
- 주제: [[engagement-acceptance-contract]] · [[topic-03-design]]
- 정본: [authoring JSON](../../data/cpa_question_sets_v3.authoring.json) · JSON Pointer `/111`
- 상태: published / verified · source_fidelity: reconstructed
- 검토·근거 장부: [03.json](../../analysis/reviews/question-review-2027/03.json)
- 학습 순서: sub1

## 공통 사실


## sub1

유형: enumeration · JSON Pointer `/111/subquestions/0`

### 발문

감사를 위한 전제조건과 관련하여 경영진이 감사인에게 제공할 책임을 인정하고 이해한다는 동의를 받아야 하는 정보·접근권의 세 범주를 모두 제시하시오.

### 모범답안

- 기록·문서·기타사항 등 재무제표 작성과 관련하여 경영진이 알고 있는 모든 정보에 대한 접근이다.
- 감사인이 감사목적으로 경영진에게 요청하는 추가적인 정보이다.
- 감사인이 감사증거를 입수하기 위하여 필요하다고 판단한 기업 내부 관계자들에 대한 제한 없는 접근이다.

### 답안 계약

selection: `{"type":"all","n":null}` · constraints: `{"ordered":false,"max_entries":null,"overflow_policy":"none"}`

### 학습목표·채점명제와 핵심 조건

| criterion | 정본 명제 | 핵심 사실·조건 | 배점·판정별 점수 | requirement | source |
|---|---|---|---|---|---|
| crit1 | 경영진이 알고 있는 재무제표 작성 관련 모든 정보에 대한 접근을 제시한다. 장부·문서는 예시이므로 그 예시만으로 범위를 제한하지 않는다. | crit1.fact (condition): 경영진이 알고 있는 재무제표 작성 관련 모든 정보에 대한 접근을 제시한다. 장부·문서는 예시이므로 그 예시만으로 범위를 제한하지 않는다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub1.req1 | src-fdfd62f7d764e46a4c |
| crit2 | 감사인이 감사목적으로 경영진에게 요청하는 추가적인 정보의 제공을 제시한다. 경영진이 필요성을 인정한 자료만 제공한다는 제한은 반대이다. | crit2.fact (action): 감사인이 감사목적으로 경영진에게 요청하는 추가적인 정보의 제공을 제시한다. 경영진이 필요성을 인정한 자료만 제공한다는 제한은 반대이다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub1.req1 | src-fdfd62f7d764e46a4c |
| crit3 | 감사인이 감사증거 입수에 필요하다고 판단한 기업 내부 관계자에 대한 제한 없는 접근을 제시한다. 기업 외의 모든 제3자에 대한 강제 조사권과 구별한다. | crit3.fact (condition): 감사인이 감사증거 입수에 필요하다고 판단한 기업 내부 관계자에 대한 제한 없는 접근을 제시한다. 기업 외의 모든 제3자에 대한 강제 조사권과 구별한다. | 1; {"met":1,"not_met":0,"contradicted":0} | sub1.req1 | src-fdfd62f7d764e46a4c |

### 요구사항과 직접 근거

| requirement | 문단·페이지·판본 | source | 원문 인용 |
|---|---|---|---|
| sub1.req1 | L319-L343; KGA 210 문단 6; PDF 34쪽; 수동 확인한 연속 인용 | [src-fdfd62f7d764e46a4c](../../data/official/delegated-n01-kga200-210-230-2025.txt) | 6. 감사인은 감사를 위한 전제조건이 존재하는지 여부를 확인하기 위하여, 다음의 절차를 수 행하여야 한다. (a) 재무제표 작성에 적용되는 재무보고체계가 수용가능한지 여부를 결정함 (문단 A2- A10 참조) (b) 경영진이 다음과 같은 책임을 인정하고 이해하고 있다는 점에 대하여 경영진의 동의 를 받음 (문단 A11-A14, A20 참조) (i) 관련성이 있는 경우 재무제표의 공정표시를 포함하여, 해당 재무보고체계에 따라 재무제표를 작성할 책임 (문단 A15 참조) (ii) 부정이나 오류로 인한 중요한 왜곡표시가 없는 재무제표를 작성하기 위해 경 영진이 필요하다고 결정한 내부통제에 대한 책임 (문단 A16-A19 참조) (iii) 감사인에게 다음 사항들을 제공할 책임 a. 기록, 문서, 기타사항 등 재무제표의 작성과 관련하여 경영진이 알고 있 는 모든 정보에 대한 접근 b. 감사인이 감사목적으로 경영진에게 요청하는 추가적인 정보 c. 감사인이 감사증거를 입수하기 위하여 필요하다고 판단한 기업 내부의 관계자들에 대한 제한없는 접근 |

## 출처 파일·위치

| source | 직접 출처 | page | 인용 SHA-256 |
|---|---|---|---|
| src-fdfd62f7d764e46a4c | [KGA 210: 감사업무 조건의 합의](../../data/official/delegated-n01-kga200-210-230-2025.txt) | KGA 210 | 1cf14588815d8348de22e9b037caba9c273970f47ec8808a98f0280ab9e40b64 |
| src-5c9add477e4276728a | [KGA 210: 감사업무 조건의 합의](../../data/official/delegated-n01-kga200-210-230-2025.txt) | KGA 210 | 2d77d9ba4300f9ea4d2ff60faee9cb1fff08f928130326cb377342134475a4bd |

## 판본·검수 메모

- 계획 ID: T03-A; 수동 제작, 총괄 배정 ID 사용.
- 사례·발문·답안을 수동으로 재구성하였다. 등록된 source ID와 공식 파일을 사용하며 인용은 해당 카탈로그 문단 전체 또는 정확한 연속 부분이다. 수동 인용·의존 문맥·판본 대조는 manual-source-evidence.md에 기록한다.
- 2027년 CPA 시험 대비이며 사례는 2026-01-01 개시 보고기간이다. KICPA 2025년11월 전문의 2026 시행 요구를 사용하고 2026년7월 전문의 해당 본문·하위항목·적용자료와 대조했다. 2026 전문의 연계 품질관리 문구는 개정220의 미래 시행과 구별한다. 직접 채점 명제는 두 전문에서 유지됨을 확인했으며, 210.10은 공식 양 판본 모두 (a)~(f)의 여섯 항목이다. 금융위원회 공고가 개별 판본을 지정했다는 주장은 하지 않는다.
- 수동 저작 version 1 계획을 sidecar로 유지한다. 자동 생성 packet을 사용하거나 완전하다고 선언하지 않는다. 실패한 예비 packet 실행은 문항 파일을 생성하지 않았다.
- source_refs에는 직접 requirement 근거 외에 명시적인 주변 문맥도 포함하여 모델 검수 입력에 전달한다. 요구사항·criterion으로 연결하지 않은 주변 문단은 숨은 배점 요건이 아니다.
- 초안 준비 단계. 형상·인용 검사는 의미검수·실제 모델 채점·사람 승인과 별개이다.
- 2026-09-11 사용자 확정: 사례 사실과의 연계가 필요한 물음은 사례형, 기준서만으로 답할 수 있는 물음은 기준서형. 기준서형은 사례 지문 없이 독립 발문으로 구성한다. 학습 묶음은 유형별로 분리한다. 정답·criterion·출처·ID·배점은 유지하며 모델 검증 완료로 승계하지 않는다.
- 2026-09-13 사례 보강에 따른 독립 기준서형 저장 분리. 기존 학습 발문·답안·기준·정수 배점과 공식 인용을 보존. 과거 source_set_id와 새 ID의 대응은 case-expansion-2026-09-13/standard-lineage.json 참조.

2027 시험 적용 여부는 아래 판본 기록과 공식 시험 공고 확인 상태를 따른다. 게시 상태 또는 이 색인의 생성 상태로 대신 확정하지 않는다.

## Related

- [[source-review-map]]
- [[requirement-coverage]]
