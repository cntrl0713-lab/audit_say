---
title: 연습·기출의 출제 요구사항과 빈도 활용
created: 2026-09-10
updated: 2026-09-11
type: guide
status: reviewed
review_required: false
tags: [audit, question-generation, source-map]
sources: [cpa_uploader/analysis/question-elements/README.md, cpa_uploader/analysis/question-elements/question-elements.json]
confidence: medium
---

# 연습·기출의 출제 요구사항과 빈도 활용

`03_문제연습`·`04_기출문제`의 실제 사례와 발문에서 구체 요구사항을 추출했다. 큰 주제와 구체 요구사항을 구분하고, 원시험 연도·문제·물음이 같은 재수록을 추가 출제로 세지 않는다. 서로 다른 연도·물음에서 실제 출제되었다면 각각 집계한다.

- [추출 범위·파일 역할·집계 규칙](../../analysis/question-elements/README.md)
- [요구사항 빈도와 주제별 합계](../../analysis/question-elements/frequency.md)
- [원출제와 교재 재수록 연결](../../analysis/question-elements/deduplication.md)
- [실제 발문·요소·원자료 단위 ID](../../analysis/question-elements/question-elements.json)

## 원자료에서 출제 계획으로

빈도 표의 주제 순서는 [[ox-study-order]]를 따른다. 요소를 고른 뒤 연결된 실제 발문과 공통 사례를 읽고, 주체·시점·조건·예외를 확인한다. `record.source_unit_ids`와 `context_source_unit_ids`를 [[source-catalog]]에서 찾아 [[source-authoring-design]]의 기존 발문 재구성 경로에 사용한다. 기존 문제은행과의 목표 차이도 별도로 기록한다.

자료에 있는 저자 「관련 주제」 표와 실제 발문은 구분한다. 연도별 해설 A의 실제 물음을 대표로 기출 빈도를 세고, 다른 교재의 전체·부분 재수록은 원출제에 연결해 근거로 보존한다. 원출제 미확정 기록은 확정 빈도에 포함하지 않는다. 같은 요소가 동일 물음에서 여러 번 언급되어도 그 물음에서는 1회다.

## 해석 범위

확인된 기출 빈도·출제 연도 수·최근 연도를 함께 본다. 기출 빈도, 모의고사 빈도, 재수록을 포함한 수록 기록 수를 합쳐 임의의 중요도 점수를 만들지 않는다. 교재의 `[기출변형]`, OCR 미확정과 동의 표현 미통합 범위는 추출 자료의 안내와 상태를 따른다. 0회는 미출제 또는 중요하지 않음을 뜻하지 않는다.

추출 라벨은 학습목표 후보이며 정답·criterion이 아니다. 판단형 라벨도 사례가 옳다는 뜻이 아니다. 공식 근거와 적용 판본을 대조한 뒤 새 발문·모범답안·채점기준을 설계하고 [[question-generation-workflow]]를 따른다. 과거 계산 문제·일부 작성 제한을 현재 출제 정책으로 그대로 옮기지 않는다.

## 실제 제작 기록

[빈도·공백 기반 9세트 제작 기록](../../../docs/archive/과거-검토-증거/reports/question-authoring-frequency-gap-2026-09-10/README.md)은 기존 A–I 설계안을 요구사항별 빈도와 연결한 결과다. 문제지·모범답안·채점기준과 요소 ID·원출제 위치·기존 은행과의 차이를 함께 제공한다. 동일 요구의 빈도를 찾지 못한 경우와 인접 요구만 확인한 경우를 구분하며, 현재 초안은 `needs_review`로 정본 밖에 보관한다. 이 초안이 생성되었다는 이유로 기존 은행의 공백이 해소되었다고 집계하지 않는다.

## 요구사항별 빈도 기반 보완 배치

[추가 6세트의 문제·모범답안·선정 근거](../../../docs/archive/과거-검토-증거/reports/question-authoring-frequency-priority-2026-09-10/README.md)는 중요성, 재고실사 시차, 공란형 조회, 표본규모, 후속사건 보고서일, 계속기업 공시를 다룬다. 실제 기출 2~4회의 요구를 기존 은행과 대조하여 재구성했으며, 표본규모의 이유 설명과 필수 회신 예외 등 확장 범위는 직접 기출 빈도와 구분하였다.

초안은 [제작 배치](../../drafts/frequency-priority-2026-09-10/README.md)에 보관하고 요소별 관계는 [연결 장부](../../analysis/coverage/README.md)에 검토 대기로 등록했다. 작성자 기대 판정의 점수 재생은 실제 모델 의미 채점이나 사람 승인·정본 편입을 뜻하지 않는다.

## 주제별 다음 제작 계획

[19개 주제의 문제·물음 선정과 상세 계획](../../../docs/plans/question-authoring-by-topic-2026-09-11/README.md)은 OX 학습 순서로 구체 요구사항·빈도·원자료 단위와 현재 은행·별도 초안을 대조한 2026-09-11의 계획이다. 주제별 후보에는 사례 조건, 세부 발문, 예상 답안 명제·잠정 정수 배점, 기존 요구와의 차이, 우선순위와 출제 전 확인사항을 기록했다.

이미 정본에 편입된 초안의 재출제를 피하고 미편입 초안은 후속 검수 기록에 맞춰 이어가도록 구분했다. 이 계획은 신규 문항 생성·실제 채점·사람 승인·관계 검토 완료를 뜻하지 않으며, 작성 당시 입력과 확인 범위는 [입력 기록](../../../docs/plans/question-authoring-by-topic-2026-09-11/계획-수립의-입력-초안-상태와-확인-범위.md)에 보존한다.

[서브에이전트용 14개 작업 배정서](../../../docs/plans/question-authoring-by-topic-2026-09-11/assignments/README.md)는 담당 세트·물음·전용 출력 경로·선행 관계·검증 조건을 명시한다. 공통 출처·ID·비교 은행은 총괄이 관리하고, 작업자는 최대 3개씩 병렬로 배정한다.

## Related

- [[source-authoring-design]]
- [[source-catalog]]
- [[ox-study-order]]
- [[requirement-coverage]]
