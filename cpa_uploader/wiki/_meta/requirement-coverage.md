---
title: "요구사항·학습목표 연결과 보강 후보"
created: 2026-08-08
updated: 2026-09-09
type: coverage
status: generated
review_required: true
tags: [audit, question-generation, quality]
sources: ["cpa_uploader/data/cpa_question_sets_v3.authoring.json","cpa_uploader/data/회계감사_통합학습자료/01_감사기준"]
confidence: high
---

# 요구사항·학습목표 연결과 보강 후보

## 원자료 단위에서 목표 후보 찾기

[[source-catalog]]의 고유 원자료 단위 6866개를 먼저 탐색한다. 주제별 카탈로그는 기준서·이론·문제연습·기출의 실제 파일·위치·판본·은행 인용 연결을 표시한다. 직접 인용 연결이 없는 단위에서 목표 후보를 찾되, 다른 표현·파일로 출제된 기존 목표가 있는지 실제 발문과 대조한다. [[source-authoring-design]]의 두 경로와 계획서로 목표·조건·예외·답안 범위·기존 차이를 명시한다.

| 주제 | 원자료 단위 | 은행 인용 연결 | 직접 연결 없는 검토 후보 |
|---|---|---|---|
| [[source-catalog-topic-01]] | 938 | 29 | 909 |
| [[source-catalog-topic-02]] | 548 | 20 | 528 |
| [[source-catalog-topic-03]] | 747 | 13 | 734 |
| [[source-catalog-topic-04]] | 1291 | 11 | 1280 |
| [[source-catalog-topic-05]] | 2010 | 15 | 1995 |
| [[source-catalog-topic-06]] | 1623 | 21 | 1602 |
| [[source-catalog-topic-07]] | 1538 | 10 | 1528 |
| [[source-catalog-topic-08]] | 2479 | 13 | 2466 |
| [[source-catalog-topic-09]] | 1006 | 35 | 971 |
| [[source-catalog-topic-10]] | 762 | 17 | 745 |
| [[source-catalog-topic-11]] | 591 | 12 | 579 |
| [[source-catalog-topic-12]] | 865 | 16 | 849 |
| [[source-catalog-topic-13]] | 338 | 12 | 326 |
| [[source-catalog-topic-14]] | 523 | 22 | 501 |
| [[source-catalog-topic-15]] | 1424 | 16 | 1408 |
| [[source-catalog-topic-16]] | 625 | 12 | 613 |
| [[source-catalog-topic-17]] | 459 | 48 | 411 |
| [[source-catalog-topic-18]] | 125 | 11 | 114 |
| [[source-catalog-topic-19]] | 362 | 17 | 345 |
| [[source-catalog-unmapped]] | 263 | 0 | 263 |

은행 인용 연결은 동일 파일·인용 포함 여부이며 학습목표 충족 판정이 아니다. 아래 요구사항 절 유사도 스캔과 별도 범위로 읽는다.

## 기존 은행 대응과 요구사항 절 탐색

정본 requirement 238개와 criterion 521개의 직접 대응은 각 [[topic-map]] → 세트 색인의 ‘학습목표·채점명제와 핵심 조건’ 및 ‘요구사항과 직접 근거’ 표에서 찾는다. ID는 세트·물음 안에서 해석한다. 실제 발문과 조건을 함께 보고 동일 명제 반복과 범위 누락을 검토한다.

아래는 통합학습자료 요구사항 절의 4글자 문자열 겹침 탐색이다. 공식 문단 식별에 의한 내용 검수가 아니다. 15% 미만은 공백 후보, 15% 이상 35% 미만은 낮은 유사도, 35% 이상도 유사 문구 탐지일 뿐 완전한 출제를 뜻하지 않는다. 짧은 절(40개 미만 4-gram)은 제외한다. 현재 파서가 요구사항 절로 분리하지 못한 기준 축: KGA 265, KGA 1200. 이 기준서는 미출제로 판정하지 말고 원문·세트 직접 연결에서 별도로 검토한다. 비KGA 인증·검토 기준의 전체 범위를 이 스캔에 포함했다고 해석하지 않는다.

- 탐색 절 189개: 공백 후보 26, 낮은 유사도 67, 유사 문구 탐지 96
- 전체 절별 결과: `node cpa_uploader/wiki/scripts/gap-scan.mjs --sections`

| 기준서 | 공백 후보 | 낮은 유사도 | 유사 문구 탐지 |
|---|---|---|---|
| KGA 200 | 0 | 1 | 3 |
| KGA 210 | 1 | 0 | 6 |
| KGA 220 | 0 | 4 | 3 |
| KGA 230 | 0 | 1 | 1 |
| KGA 240 | 5 | 3 | 3 |
| KGA 250 | 2 | 2 | 0 |
| KGA 260 | 2 | 2 | 0 |
| KGA 300 | 0 | 1 | 4 |
| KGA 315 | 0 | 3 | 1 |
| KGA 320 | 0 | 1 | 2 |
| KGA 330 | 1 | 3 | 1 |
| KGA 402 | 5 | 0 | 0 |
| KGA 450 | 0 | 3 | 4 |
| KGA 500 | 0 | 1 | 3 |
| KGA 501 | 1 | 1 | 2 |
| KGA 505 | 1 | 0 | 4 |
| KGA 510 | 0 | 2 | 0 |
| KGA 520 | 0 | 0 | 3 |
| KGA 530 | 0 | 1 | 4 |
| KGA 540 | 2 | 7 | 6 |
| KGA 550 | 0 | 4 | 2 |
| KGA 560 | 0 | 0 | 4 |
| KGA 570 | 0 | 4 | 4 |
| KGA 580 | 1 | 3 | 2 |
| KGA 600 | 0 | 4 | 2 |
| KGA 610 | 1 | 2 | 2 |
| KGA 620 | 0 | 2 | 5 |
| KGA 700 | 1 | 1 | 1 |
| KGA 701 | 0 | 2 | 2 |
| KGA 705 | 0 | 2 | 5 |
| KGA 706 | 0 | 0 | 3 |
| KGA 710 | 2 | 0 | 0 |
| KGA 720 | 1 | 3 | 3 |
| KGA 1100 | 0 | 4 | 11 |

## 공백 후보의 실제 절 위치

| 기준서 | 학습자료 요구사항 절 | 문자열 겹침 | 최근접 세트 |
|---|---|---|---|
| KGA 402 | [내부통제 등 서비스조직에 의하여 제공되는 서비스에 대한 이해](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/04_%EC%84%9C%EB%B9%84%EC%8A%A4%EC%A1%B0%EC%A7%81%EA%B3%BC_%EC%99%9C%EA%B3%A1%ED%91%9C%EC%8B%9C%ED%8F%89%EA%B0%80.md) | 0% | 연결 없음 |
| KGA 402 | [평가된 중요왜곡표시위험에 대한 대응](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/04_%EC%84%9C%EB%B9%84%EC%8A%A4%EC%A1%B0%EC%A7%81%EA%B3%BC_%EC%99%9C%EA%B3%A1%ED%91%9C%EC%8B%9C%ED%8F%89%EA%B0%80.md) | 0% | 연결 없음 |
| KGA 402 | [하위서비스조직의 서비스가 제외된 유형 1 과 유형 2 보고서](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/04_%EC%84%9C%EB%B9%84%EC%8A%A4%EC%A1%B0%EC%A7%81%EA%B3%BC_%EC%99%9C%EA%B3%A1%ED%91%9C%EC%8B%9C%ED%8F%89%EA%B0%80.md) | 0% | 연결 없음 |
| KGA 402 | [서비스조직이 수행하는 활동에 관련된 부정, 법규위반 및 미수정왜곡표시](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/04_%EC%84%9C%EB%B9%84%EC%8A%A4%EC%A1%B0%EC%A7%81%EA%B3%BC_%EC%99%9C%EA%B3%A1%ED%91%9C%EC%8B%9C%ED%8F%89%EA%B0%80.md) | 0% | 연결 없음 |
| KGA 402 | [이용자기업 감사인에 의한 보고](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/04_%EC%84%9C%EB%B9%84%EC%8A%A4%EC%A1%B0%EC%A7%81%EA%B3%BC_%EC%99%9C%EA%B3%A1%ED%91%9C%EC%8B%9C%ED%8F%89%EA%B0%80.md) | 0% | 연결 없음 |
| KGA 501 | [서면진술](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/05_%EA%B0%90%EC%82%AC%EC%A6%9D%EA%B1%B0%EC%99%80_%EC%84%B8%EB%B6%80%EA%B0%90%EC%82%AC%EC%A0%88%EC%B0%A8.md) | 5.9% | [[pilot-09-002]] |
| KGA 710 | [감사보고](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/07_%EA%B0%90%EC%82%AC%EC%9D%98%EA%B2%AC%EA%B3%BC_%EA%B0%90%EC%82%AC%EB%B3%B4%EA%B3%A0.md) | 6% | [[pilot-16-001]] |
| KGA 250 | [법규준수에 대한 감사인의 고려사항](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/02_%EA%B0%90%EC%82%AC%EC%9D%98_%EA%B8%B0%EB%B3%B8%EC%9B%90%EC%B9%99%EA%B3%BC_%EA%B0%90%EC%82%AC%EC%9D%B8%EC%B1%85%EC%9E%84.md) | 7.2% | [[pilot-05-004]] |
| KGA 710 | [감사절차](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/07_%EA%B0%90%EC%82%AC%EC%9D%98%EA%B2%AC%EA%B3%BC_%EA%B0%90%EC%82%AC%EB%B3%B4%EA%B3%A0.md) | 8.6% | [[pilot-16-001]] |
| KGA 540 | [위험평가절차 및 관련 활동](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/05_%EA%B0%90%EC%82%AC%EC%A6%9D%EA%B1%B0%EC%99%80_%EC%84%B8%EB%B6%80%EA%B0%90%EC%82%AC%EC%A0%88%EC%B0%A8.md) | 8.8% | [[pilot-11-001]] |
| KGA 240 | [감사인이 업무를 계속 수행할 수 없는 경우](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/02_%EA%B0%90%EC%82%AC%EC%9D%98_%EA%B8%B0%EB%B3%B8%EC%9B%90%EC%B9%99%EA%B3%BC_%EA%B0%90%EC%82%AC%EC%9D%B8%EC%B1%85%EC%9E%84.md) | 9.3% | [[pilot-05-002]] |
| KGA 260 | [커뮤니케이션할 사항](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/02_%EA%B0%90%EC%82%AC%EC%9D%98_%EA%B8%B0%EB%B3%B8%EC%9B%90%EC%B9%99%EA%B3%BC_%EA%B0%90%EC%82%AC%EC%9D%B8%EC%B1%85%EC%9E%84.md) | 9.3% | [[pilot-05-001]] |
| KGA 240 | [감사증거의 평가](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/02_%EA%B0%90%EC%82%AC%EC%9D%98_%EA%B8%B0%EB%B3%B8%EC%9B%90%EC%B9%99%EA%B3%BC_%EA%B0%90%EC%82%AC%EC%9D%B8%EC%B1%85%EC%9E%84.md) | 9.9% | [[pilot-05-002]] |
| KGA 240 | [위험평가절차 및 관련 활동](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/02_%EA%B0%90%EC%82%AC%EC%9D%98_%EA%B8%B0%EB%B3%B8%EC%9B%90%EC%B9%99%EA%B3%BC_%EA%B0%90%EC%82%AC%EC%9D%B8%EC%B1%85%EC%9E%84.md) | 10% | [[pilot-05-001]] |
| KGA 240 | [전문가적 의구심](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/02_%EA%B0%90%EC%82%AC%EC%9D%98_%EA%B8%B0%EB%B3%B8%EC%9B%90%EC%B9%99%EA%B3%BC_%EA%B0%90%EC%82%AC%EC%9D%B8%EC%B1%85%EC%9E%84.md) | 10.2% | [[pilot-05-002]] |
| KGA 210 | [업무수임 때의 추가적인 고려사항](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/02_%EA%B0%90%EC%82%AC%EC%9D%98_%EA%B8%B0%EB%B3%B8%EC%9B%90%EC%B9%99%EA%B3%BC_%EA%B0%90%EC%82%AC%EC%9D%B8%EC%B1%85%EC%9E%84.md) | 11.3% | [[pilot-03-004]] |
| KGA 330 | [재무제표 표시의 적절성](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/03_%EA%B3%84%ED%9A%8D_%EC%9C%84%ED%97%98%ED%8F%89%EA%B0%80_%EC%A4%91%EC%9A%94%EC%84%B1%EA%B3%BC_%EB%8C%80%EC%9D%91.md) | 12.2% | [[pilot-07-005]] |
| KGA 540 | [서면진술](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/05_%EA%B0%90%EC%82%AC%EC%A6%9D%EA%B1%B0%EC%99%80_%EC%84%B8%EB%B6%80%EA%B0%90%EC%82%AC%EC%A0%88%EC%B0%A8.md) | 12.2% | [[pilot-11-002]] |
| KGA 260 | [커뮤니케이션 절차](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/02_%EA%B0%90%EC%82%AC%EC%9D%98_%EA%B8%B0%EB%B3%B8%EC%9B%90%EC%B9%99%EA%B3%BC_%EA%B0%90%EC%82%AC%EC%9D%B8%EC%B1%85%EC%9E%84.md) | 12.4% | [[pilot-05-001]] |
| KGA 720 | [기타정보의 입수](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/07_%EA%B0%90%EC%82%AC%EC%9D%98%EA%B2%AC%EA%B3%BC_%EA%B0%90%EC%82%AC%EB%B3%B4%EA%B3%A0.md) | 12.6% | [[pilot-16-003]] |
| KGA 240 | [업무팀 내부의 토의](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/02_%EA%B0%90%EC%82%AC%EC%9D%98_%EA%B8%B0%EB%B3%B8%EC%9B%90%EC%B9%99%EA%B3%BC_%EA%B0%90%EC%82%AC%EC%9D%B8%EC%B1%85%EC%9E%84.md) | 12.8% | [[pilot-05-001]] |
| KGA 700 | [감사보고서](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/07_%EA%B0%90%EC%82%AC%EC%9D%98%EA%B2%AC%EA%B3%BC_%EA%B0%90%EC%82%AC%EB%B3%B4%EA%B3%A0.md) | 14.2% | [[pilot-15-001]] |
| KGA 505 | [소극적 조회](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/05_%EA%B0%90%EC%82%AC%EC%A6%9D%EA%B1%B0%EC%99%80_%EC%84%B8%EB%B6%80%EA%B0%90%EC%82%AC%EC%A0%88%EC%B0%A8.md) | 14.3% | [[pilot-09-001]] |
| KGA 610 | [직접적 보조를 제공하기 위해 내부감사인이 활용될 수 있는지 여부, 활용 영역 및 활용 범위의 결정](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/06_%ED%83%80%EC%9D%B8%EC%9D%98_%EC%97%85%EB%AC%B4%ED%99%9C%EC%9A%A9.md) | 14.4% | [[pilot-13-005]] |
| KGA 250 | [문서화](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/02_%EA%B0%90%EC%82%AC%EC%9D%98_%EA%B8%B0%EB%B3%B8%EC%9B%90%EC%B9%99%EA%B3%BC_%EA%B0%90%EC%82%AC%EC%9D%B8%EC%B1%85%EC%9E%84.md) | 14.5% | [[pilot-05-004]] |
| KGA 580 | [기타 서면진술](../../data/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%ED%86%B5%ED%95%A9%ED%95%99%EC%8A%B5%EC%9E%90%EB%A3%8C/01_%EA%B0%90%EC%82%AC%EA%B8%B0%EC%A4%80/05_%EA%B0%90%EC%82%AC%EC%A6%9D%EA%B1%B0%EC%99%80_%EC%84%B8%EB%B6%80%EA%B0%90%EC%82%AC%EC%A0%88%EC%B0%A8.md) | 14.8% | [[pilot-12-003]] |

KGA 402처럼 직접 출처가 없는 기준서는 세트 수보다 먼저 보강 범위를 검토한다. 후보 절의 실제 학습목표·조건·예외를 공식 원문과 대조한 뒤 출제 여부를 결정하며, 자동 유사도만으로 문항 검수 상태를 올리지 않는다.

## Related

- [[coverage-map]]
- [[source-review-map]]
- [[question-design]]
