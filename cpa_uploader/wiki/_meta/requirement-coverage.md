---
title: "요구사항·학습목표 연결과 보강 후보"
created: 2026-08-08
updated: 2026-09-12
type: coverage
status: generated
review_required: true
tags: [audit, question-generation, quality]
sources: ["cpa_uploader/data/cpa_question_sets_v3.authoring.json","cpa_uploader/data/회계감사_통합학습자료/01_감사기준"]
confidence: high
---

# 요구사항·학습목표 연결과 보강 후보

## 원자료 단위에서 목표 후보 찾기

[[source-catalog]]의 고유 원자료 단위 7824개를 먼저 탐색한다. 주제별 카탈로그는 기준서·이론·문제연습·기출의 실제 파일·위치·판본·은행 인용 연결을 표시한다. 직접 인용 연결이 없는 단위에서 목표 후보를 찾되, 다른 표현·파일로 출제된 기존 목표가 있는지 실제 발문과 대조한다. [[source-authoring-design]]의 두 경로와 계획서로 목표·조건·예외·답안 범위·기존 차이를 명시한다.

| 주제 | 원자료 단위 | 은행 인용 연결 | 직접 연결 없는 검토 후보 |
|---|---|---|---|
| [[source-catalog-topic-02]] | 599 | 38 | 561 |
| [[source-catalog-topic-01]] | 1046 | 72 | 974 |
| [[source-catalog-topic-03]] | 788 | 31 | 757 |
| [[source-catalog-topic-04]] | 1338 | 36 | 1302 |
| [[source-catalog-topic-08]] | 2680 | 88 | 2592 |
| [[source-catalog-topic-06]] | 1710 | 103 | 1607 |
| [[source-catalog-topic-07]] | 1763 | 87 | 1676 |
| [[source-catalog-topic-09]] | 1058 | 77 | 981 |
| [[source-catalog-topic-05]] | 2099 | 39 | 2060 |
| [[source-catalog-topic-11]] | 644 | 62 | 582 |
| [[source-catalog-topic-13]] | 501 | 95 | 406 |
| [[source-catalog-topic-10]] | 1001 | 102 | 899 |
| [[source-catalog-topic-12]] | 939 | 88 | 851 |
| [[source-catalog-topic-15]] | 1466 | 41 | 1425 |
| [[source-catalog-topic-16]] | 704 | 57 | 647 |
| [[source-catalog-topic-14]] | 533 | 54 | 479 |
| [[source-catalog-topic-17]] | 487 | 79 | 408 |
| [[source-catalog-topic-18]] | 129 | 15 | 114 |
| [[source-catalog-topic-19]] | 405 | 26 | 379 |
| [[source-catalog-unmapped]] | 263 | 0 | 263 |

은행 인용 연결은 동일 파일·인용 포함 여부이며 학습목표 충족 판정이 아니다. 아래 요구사항 절 유사도 스캔과 별도 범위로 읽는다.

## 기존 은행 대응과 요구사항 절 탐색

정본 requirement 665개와 criterion 1298개의 직접 대응은 각 [[topic-map]] → 세트 색인의 ‘학습목표·채점명제와 핵심 조건’ 및 ‘요구사항과 직접 근거’ 표에서 찾는다. ID는 세트·물음 안에서 해석한다. 실제 발문과 조건을 함께 보고 동일 명제 반복과 범위 누락을 검토한다.

아래는 통합학습자료 요구사항 절의 4글자 문자열 겹침 탐색이다. 공식 문단 식별에 의한 내용 검수가 아니다. 15% 미만은 공백 후보, 15% 이상 35% 미만은 낮은 유사도, 35% 이상도 유사 문구 탐지일 뿐 완전한 출제를 뜻하지 않는다. 짧은 절(40개 미만 4-gram)은 제외한다. 현재 파서가 요구사항 절로 분리하지 못한 기준 축: KGA 265, KGA 1200. 이 기준서는 미출제로 판정하지 말고 원문·세트 직접 연결에서 별도로 검토한다. 비KGA 인증·검토 기준의 전체 범위를 이 스캔에 포함했다고 해석하지 않는다.

- 탐색 절 189개: 공백 후보 0, 낮은 유사도 35, 유사 문구 탐지 154
- 전체 절별 결과: `node cpa_uploader/wiki/scripts/gap-scan.mjs --sections`

| 기준서 | 공백 후보 | 낮은 유사도 | 유사 문구 탐지 |
|---|---|---|---|
| KGA 200 | 0 | 0 | 4 |
| KGA 210 | 0 | 0 | 7 |
| KGA 220 | 0 | 1 | 6 |
| KGA 230 | 0 | 1 | 1 |
| KGA 240 | 0 | 7 | 4 |
| KGA 250 | 0 | 3 | 1 |
| KGA 260 | 0 | 3 | 1 |
| KGA 300 | 0 | 2 | 3 |
| KGA 315 | 0 | 2 | 2 |
| KGA 320 | 0 | 0 | 3 |
| KGA 330 | 0 | 1 | 4 |
| KGA 402 | 0 | 0 | 5 |
| KGA 450 | 0 | 0 | 7 |
| KGA 500 | 0 | 0 | 4 |
| KGA 501 | 0 | 0 | 4 |
| KGA 505 | 0 | 0 | 5 |
| KGA 510 | 0 | 0 | 2 |
| KGA 520 | 0 | 0 | 3 |
| KGA 530 | 0 | 0 | 5 |
| KGA 540 | 0 | 1 | 14 |
| KGA 550 | 0 | 0 | 6 |
| KGA 560 | 0 | 0 | 4 |
| KGA 570 | 0 | 3 | 5 |
| KGA 580 | 0 | 0 | 6 |
| KGA 600 | 0 | 4 | 2 |
| KGA 610 | 0 | 0 | 5 |
| KGA 620 | 0 | 0 | 7 |
| KGA 700 | 0 | 1 | 2 |
| KGA 701 | 0 | 0 | 4 |
| KGA 705 | 0 | 1 | 6 |
| KGA 706 | 0 | 0 | 3 |
| KGA 710 | 0 | 1 | 1 |
| KGA 720 | 0 | 0 | 7 |
| KGA 1100 | 0 | 4 | 11 |

## 공백 후보의 실제 절 위치

| 기준서 | 학습자료 요구사항 절 | 문자열 겹침 | 최근접 세트 |
|---|---|---|---|


KGA 402처럼 직접 출처가 없는 기준서는 세트 수보다 먼저 보강 범위를 검토한다. 후보 절의 실제 학습목표·조건·예외를 공식 원문과 대조한 뒤 출제 여부를 결정하며, 자동 유사도만으로 문항 검수 상태를 올리지 않는다.

## Related

- [[coverage-map]]
- [[source-review-map]]
- [[question-design]]
