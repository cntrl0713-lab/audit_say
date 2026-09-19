---
title: "draft-standard-gap-20260913-g02. 전수조사가 적합할 수 있는 상황"
created: 2026-08-08
updated: 2026-09-19
type: question
status: generated
review_required: true
tags: [audit, question-generation, quality]
sources: ["cpa_uploader/data/cpa_question_sets_v3.authoring.json","cpa_uploader/drafts/standard-gap-2026-09-13/sources/kga-2026-excerpts.txt","cpa_uploader/analysis/reviews/question-review-2027/08.json"]
confidence: high
---

# draft-standard-gap-20260913-g02. 전수조사가 적합할 수 있는 상황


이 페이지는 편집 정본에서 생성한 출제·검토용 색인이다. 정답·채점 조건을 포함하므로 public 문제 배포물에 포함하지 않는다. 원문과 판본 판단은 연결된 출처 및 검토 기록에서 확인한다.
- 주제: [[audit-evidence-assertions]] · [[topic-08-design]]
- 정본: [authoring JSON](../../data/cpa_question_sets_v3.authoring.json) · JSON Pointer `/134`
- 상태: published / verified · source_fidelity: reconstructed
- 검토·근거 장부: [08.json](../../analysis/reviews/question-review-2027/08.json)
- 학습 순서: sub1

## 공통 사실


## sub1

유형: enumeration · JSON Pointer `/134/subquestions/0`

### 발문

감사증거를 입수하기 위해 거래유형이나 계정잔액의 전체 모집단 또는 그 안의 계층화된 집단을 전수조사하는 것이 적합할 수 있는 상황을 감사기준서 500의 예시에 따라 모두 설명하시오.

### 모범답안

- 모집단이 금액이 큰 소수의 항목으로 구성된 경우이다.
- 유의적 위험이 존재하고 다른 방법으로 충분하고 적합한 감사증거를 얻을 수 없는 경우이다.
- 정보시스템이 자동으로 수행하는 계산이나 기타 처리의 반복적 특성 때문에 전수조사가 비용 측면에서 효과적인 경우이다.

### 답안 계약

selection: `{"type":"all","n":null}` · constraints: `{"ordered":false,"max_entries":null,"overflow_policy":"none"}`

### 학습목표·채점명제와 핵심 조건

| criterion | 정본 명제 | 핵심 사실·조건 | 배점·판정별 점수 | requirement | source |
|---|---|---|---|---|---|
| crit1 | 모집단이 금액이 큰 소수의 항목으로 구성된 경우이다. | fact1 (conclusion): 모집단이 금액이 큰 소수의 항목으로 구성된 경우이다. | 1; {"met":1,"not_met":0,"contradicted":0} | req-17615-17616 | src-500-17615-17616 |
| crit2 | 유의적 위험이 존재하고 다른 방법으로 충분하고 적합한 감사증거를 얻을 수 없는 경우이다. 유의적 위험만으로 전수조사가 의무라는 답은 인정하지 않는다. | fact2 (conclusion): 유의적 위험이 존재하고 다른 방법으로 충분하고 적합한 감사증거를 얻을 수 없는 경우이다. | 1; {"met":1,"not_met":0,"contradicted":0} | req-17617-17619 | src-500-17617-17619 |
| crit3 | 정보시스템이 자동으로 수행하는 계산이나 기타 처리의 반복적 특성 때문에 전수조사가 비용 측면에서 효과적인 경우이다. | fact3 (conclusion): 정보시스템이 자동으로 수행하는 계산이나 기타 처리의 반복적 특성 때문에 전수조사가 비용 측면에서 효과적인 경우이다. | 1; {"met":1,"not_met":0,"contradicted":0} | req-17620-17621 | src-500-17620-17621 |

### 요구사항과 직접 근거

| requirement | 문단·페이지·판본 | source | 원문 인용 |
|---|---|---|---|
| req-17615-17616 | 2026 전문 L17615–17616 | [src-500-17615-17616](../../drafts/standard-gap-2026-09-13/sources/kga-2026-excerpts.txt) |  모집단이 금액이 큰 소수의 항목으로 구성되어 있을 때 |
| req-17617-17619 | 2026 전문 L17617–17619 | [src-500-17617-17619](../../drafts/standard-gap-2026-09-13/sources/kga-2026-excerpts.txt) |  유의적 위험이 존재하며 다른 방법으로는 충분하고 적합한 감사증거를 제공하지 못 할 때 |
| req-17620-17621 | 2026 전문 L17620–17621 | [src-500-17620-17621](../../drafts/standard-gap-2026-09-13/sources/kga-2026-excerpts.txt) | 정보시스템에 의해 자동적으로 수행되는 계산이나 기타 처리는 그 반복적 특성으로 인하여 전수조사가 비용 측면에서 효과적이다. |

## 출처 파일·위치

| source | 직접 출처 | page | 인용 SHA-256 |
|---|---|---|---|
| src-500-17615-17616 | [한국공인회계사회 2026년 7월 개정 전문; 원문 L17615–17616](../../drafts/standard-gap-2026-09-13/sources/kga-2026-excerpts.txt) | KGA 500 | e632668b6e28182bf8a8d7e58cfd82f64a6be257c2cdf1338c4269170f53cde9 |
| src-500-17617-17619 | [한국공인회계사회 2026년 7월 개정 전문; 원문 L17617–17619](../../drafts/standard-gap-2026-09-13/sources/kga-2026-excerpts.txt) | KGA 500 | 7aedbfb2b5722f4a2ec9c578c9245435efb788c85959575a9f5a91225560ae05 |
| src-500-17620-17621 | [한국공인회계사회 2026년 7월 개정 전문; 원문 L17620–17621](../../drafts/standard-gap-2026-09-13/sources/kga-2026-excerpts.txt) | KGA 500 | 24665e212fbfa04fddafc811dba46f8e0246e59b817ba6944b7abd3fbf3144f8 |
| src-500-17632-17636 | [한국공인회계사회 2026년 7월 개정 전문; 원문 L17632–17636](../../drafts/standard-gap-2026-09-13/sources/kga-2026-excerpts.txt) | KGA 500 | a80e95af47ff0f8d1c2820da1930ba275110b875b76e8bf4c30a8510bb63a5f7 |
| src-500-17637-17640 | [한국공인회계사회 2026년 7월 개정 전문; 원문 L17637–17640](../../drafts/standard-gap-2026-09-13/sources/kga-2026-excerpts.txt) | KGA 500 | 19b614579d22575feef057a2c671f87b9b00d728199128b9e78b5eac35c72770 |
| src-500-17641-17643 | [한국공인회계사회 2026년 7월 개정 전문; 원문 L17641–17643](../../drafts/standard-gap-2026-09-13/sources/kga-2026-excerpts.txt) | KGA 500 | 18c2e256bd6ded28f0540a91fc67fe2f9f0d2e54d1c10f29132bd1eeaadab996 |

## 판본·검수 메모

- 한국공인회계사회 보관 2026년 7월 개정 전문을 출제 근거 판본으로 고정한다. 별도 시험 적용연도는 지정하지 않으며 2027년 시험 적용을 확정하지 않는다. 문단 580.5의 2026-01-01 이후 개시 보고기간 시행 문구를 확인했다.
- 수동 독립 초안. agent 내용 검토와 실제 채점 증거는 배치 장부에 별도 보존한다. 사람 내용 확인·정본 승급·게시 상태를 나타내지 않는다.
- 2026-09-14 신규 기준서형 전수 검증 O1 후속: 재편 뒤 남은 물음(sub1)에 맞게 세트 제목을 "전수조사와 특정 항목 추출의 적용"에서 "전수조사가 적합할 수 있는 상황"로 바꾸었다. 분류 태그의 원 제목은 재편 전후 물음을 묶는 계보 표시로 유지한다. 발문·모범답안·배점은 같다. 근거: cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v4/changes.json

2027 시험 적용 여부는 아래 판본 기록과 공식 시험 공고 확인 상태를 따른다. 게시 상태 또는 이 색인의 생성 상태로 대신 확정하지 않는다.

## Related

- [[source-review-map]]
- [[requirement-coverage]]
