---
title: 출처 기반 문제 생성 워크플로
created: 2026-08-07
updated: 2026-09-12
type: guide
status: reviewed
review_required: false
tags: [audit, question-generation, source-map, quality]
sources: [cpa_uploader/data/회계감사_통합학습자료/00_통합_목차.md, cpa_uploader/data/cpa_question_sets_v3.authoring.json]
confidence: high
---

# 출처 기반 문제 생성 워크플로

## 1. 주제 선택

[[topic-map]]과 [[coverage-map]]에서 보강할 주제를 고른다. 기존 문제가 적은 영역을 우선하되, 문제 수만으로 기준서 범위가 충족되었다고 판단하지 않는다.

[[source-catalog]]의 실제 원자료 단위에서 시작하고 [[source-authoring-design]]의 계획서를 작성한다. 기존 발문을 재구성하는 `adapt_existing_question`과 기준서에서 새 학습목표를 설계하는 `new_from_standard`를 구분한다. 새 목표 경로는 목표·조건·예외·답안 범위를 먼저 정한 뒤 발문을 작성하며, 아래 3절의 기존 발문 추출 단계로 대신하지 않는다.

## 2. 출처 읽기

해당 concept 페이지의 `원자료 탐색`에서 다음 순서로 확인한다.

1. [[source-review-map]]에서 주제별 공식 발췌·검토 보고서·장부의 판본·문단·요구사항·정의
2. 기본이론과 핵심요약의 설명
3. 기출문제의 실제 발문·답안양식
4. 문제연습의 추가 적용사례
5. 기존 JSON의 공통 사실·발문·답안·critical_facts·requirement와 직접 출처 (concept에서 세트 색인으로 이동)

concept와 세트 색인의 정본 명제는 원자료 확인 전에는 확정 정답으로 취급하지 않는다. 통합학습자료는 탐색·대조 계층이며 공식 발췌가 없는 주제의 fallback 사용은 검토 메모에 남긴다. 해당 `topics/topic-XX-design.md`의 주체·조건·예외·시점 지침도 함께 읽는다.

공식 시험 적용 공고와 국내 기준서 본문·부칙을 먼저 확인한다. 로컬 통합본·wiki는 탐색 자료다. 2027년의 2026년 시행 기준 동일 적용은 기존 작업 가정이며, 개정220의 보고기간 기준 시행과 시험 적용은 [별도 메모](../../../docs/archive/과거-검토-증거/reports/question-review-2027/개정-감사기준서-220-시행일-별도-기록.md)로 구분한다.

## 3. 발문만 보고 요구사항 추출

이 단계는 원자료에 실제 발문이 있는 재구성 경로에 적용한다. 기준서 기반 신규 목표는 [[source-authoring-design]]의 목표·발문·답안·criterion 대응표를 먼저 작성한다.

첫 번째 패스에는 모범답안과 해설을 사용하지 않는다.

- 주어진 사실
- 실제 명령 동사
- 답해야 할 대상
- 조건과 시점
- 요구 개수
- 답안양식
- 초과 답안 처리

각 요구사항은 원문에 존재하는 `source_quote`를 가져야 한다.

원문에 일부 선택·초과 항목 제한이 있으면 과거 요구로 기록하고 [확정 수정 정책](../../../docs/plans/주제-01-03-검토에-따른-수정-결정.md)에 따라 범위를 명확히 한 모두 작성 발문으로 전환한다. 원문 인용 자체는 고쳐 쓰지 않는다.

## 4. 관련 물음 묶기

같은 개념, 사례 또는 비교축을 공유하는 물음을 하나의 `linked_question_set`으로 묶는다. 학습상의 권장 순서는 `learning_order`로 둔다. 답안 나열은 `ordered=false`이며 감사절차의 필수 선후관계는 criterion에 보존한다. 수임 전과 계속감사처럼 시점이 다르면 독립 상황임을 명시한다.

## 5. 모범답안 정렬

두 번째 패스에서 모범답안과 기준서를 각 subquestion에 연결한다. 연결할 수 없는 해설 문장은 채점 대상에서 제외하거나 검토 대상으로 표시한다.

## 6. 원자적 criterion 생성

독립적으로 점수를 줄 수 있는 최소 명제로 분할한다. 주체, 행위, 대상, 조건, 부정, 시점, 수치를 핵심 사실로 보존한다.

## 7. 정수 배점 적용

[[question-design]]의 기본 1점 명제 합산을 적용한다. 판단·근거를 분리할지 결합할지 명시하고 모든 득점 요구가 발문에 있는지 확인한다. 1점 criterion에 소수 부분점수를 넣지 않는다.

## 8. 검증

- 모든 발문 요구사항이 subquestion으로 반영됨
- 모든 criterion이 subquestion에 연결됨
- 발문이 묻지 않은 criterion이 없음
- source quote가 원문에 실제 존재함
- 기준서 문구·수치·기간을 확인함
- 계산 요구가 없음
- 모두 작성·순서 무제한 정책과 절차의 의미상 순서를 구분함
- 같은 문장의 독립 명제는 득점하고 같은 사실의 중복 배점은 없음
- 명칭만 요구한 답안의 정상 나열과 함축 결론을 인정함
- 저장 모범답안·동의 표현·부분 누락·반대 의미·빈 답안의 기대값과 실제 채점을 대조함

누락 사례는 문장 삭제가 아니라 **명제의 실제 누락**으로 설계한다. 판단 문장을 지워도 남은 조치가 판단을 분명히 함축하면 판단 점수는 유지될 수 있다. 반대로 결론만 쓰고 설명을 누락한 사례도 별도로 확인한다. 기대값 오류가 드러나면 원문·확정 계약을 다시 대조해 교정 이유와 새 버전을 기록하고 옛 기대값·실측을 보존한다. 단지 모델 출력에 맞춰 기대값을 바꾸지 않는다.

## 9. 출력

[[question-output-schema]] 형식으로 별도 draft JSON을 생성하고 `status: needs_review`, `verification.review_status: needs_human_review`로 둔다. 출처·의미 검토 증거와 현재 승급 도구·장부 계약에 따라 상태를 올린다. 위키 검수 상태를 문제은행 검수 완료로 취급하지 않는다.

자동 생성기는 완성된 출제 계획과 원자료 카탈로그의 선택 단위에서 SOURCE_PACKET을 만든다. 기존 은행 등록 여부와 독립적으로 원문 문맥·필요한 참조 문단·판본 기록을 확보하며 미확보 의존이나 필수 문맥 예산 초과는 모델 호출 전에 거절한다. concept의 범위·탐색 정보와 question-design·question-output-schema·llm-question-generation-prompt·이 워크플로·source-authoring-design 및 선택한 주제 지침을 읽는다. 정답의 사실 근거는 패킷의 SOURCE_BUNDLE로 한정하고, 학습자료 계층과 공식 대조 필요를 명시한다. 예시 JSON은 실제 응답 스키마를 대신하지 않는다. 계획·지침·출제 계약·생성기·정본·출처·모델이 달라지면 이전 체크포인트를 재사용하지 않는다. 과거 선택 정책이나 출처 ID·파일·위치·인용·해시가 다른 응답은 조용히 보정하지 않고 거절한다.

성공한 생성은 draft와 함께 `<draft>.authoring-plan.json`, `<draft>.source-packet.json`을 저장한다. 세트별 `set_id` 연결과 계획·원문 기록을 유지하여 독립 의미검수의 입력으로 사용한다. 실제 명령은 [[source-authoring-design]]과 [파이프라인 README](../../README.md)에 있다.

ID는 정본과 미편입 JSON·체크포인트를 조회하여 배정한다. 탐색 범위는 `cpa_uploader/data/`와 지정 출력 폴더의 하위 JSON이다. 생성 결과 반환 및 배치 저장 전에 기존 은행·다른 초안·같은 배치의 ID와 공백 정규화한 동일 발문을 검증한다. 의미상 같은 학습목표인지 여부는 검토자가 별도로 판단한다.

### 신규 초안 편입과 게시 순서

1. `npx tsx cpa_uploader/validate_draft_v3.ts --file <draft.json> --against-bank`로 검증한다. 정본이 없으면 실패하며, 편입 전 신규 초안에 사용한다.
2. 현재 기본 경로는 [공통 비용 통제 계약](../../../.agents/skills/audit-question-review/references/cost-controlled-verification.md)에 따른 agent의 전수 내용·출처·배점 검토와 실제 Luna 대표 채점이다. 해당 경로는 실제 원응답과 사전 선정·내용검토 증거를 묶어 `--efficient-review <batch.json>`으로 승급한다. 95%·±1점은 채점 일관성만 평가하며 내용 오류는 허용하지 않는다. 아래 3~5의 기준별 전수 API receipt 절차는 이 경로 대신 **기준별 전수검사 경로를 선택한 경우** 적용한다. 그 경우 `npx tsx --env-file=.env.local cpa_uploader/review_question_draft_v3.ts --file <draft.json> --grade-cases --output <review.json>`으로 실행하고 기존 엄격한 계약을 유지한다.
3. 모든 물음·criterion의 의미 대조, criterion당 다섯 사례와 빈 답안의 실제 채점·인용 검증·점수를 사람이 원문·판본·조건에 비추어 확인한다. 의미검수만 pass인 receipt는 grading.status=not_run이며 승급할 수 없다. 완료된 의미검수는 `--review-input <의미검수.json> --grade-cases --output <다른 review.json>`으로 실제 채점을 이어간다. completed 표시뿐 아니라 모든 기대 판정과 기록 점수의 코드 재현이 일치해야 한다. 그 통과도 정확성 보증은 아니며 실제 사람 검수 근거를 기록한다.
4. 검수한 초안을 정본에 편입한 뒤 `npm run questions:v3:validate:authoring`으로 public 갱신 전 전체 정본·출처·장부를 검사한다. 의미검수 이후 비교 은행이나 배치가 달라졌다면 현재 비교 대상을 반영한 새 receipt가 필요하다.
5. `npx tsx cpa_uploader/promote_cpa_v3.ts --to verified --sets <ID> --review <review.json> --evidence "실제 사람 검수 기록"`을 실행한다. 의미검수 pass와 실제 사례 채점·점수 재현 검증을 통과한 receipt가 필요하다. status와 review_status를 함께 갱신하고 내용 해시·receipt·검수 요약을 장부에 기록한다.
6. `npx tsx cpa_uploader/promote_cpa_v3.ts --to published --sets <ID> --evidence "게시 근거"`를 실행한다. public을 먼저 만들 필요는 없으며, 전환 결과의 전체 정본이 published·verified·장부 조건을 충족해야 한다. 나머지 미검수 세트는 별도 draft로 관리한다.
7. `npm run questions:v3:compile` 후 `npm run questions:v3:validate`로 암호화본·공개본과 정본의 일치를 확인한다.
8. `npm run wiki:build` 후 `npm run wiki:check`로 생성 색인을 동기화한다.

내용 해시·검수 근거가 기록된 문항은 기록 이후 문항·출처 파일·등록 메타데이터의 불일치를 검사한다. 비용 통제 경로의 기존 verified/published 수정은 [공통 계약](../../../.agents/skills/audit-question-review/references/cost-controlled-verification.md)에 따라 내용 검토·대표 채점의 동일성과 재사용 가능성을 확인하고 `--reverify --efficient-review <batch.json>`으로 새 근거를 기록한다. 변경한 답안 계약이나 기대값을 해시만 바꾸어 재사용하지 않는다.

**기준별 전수검사 경로를 선택한 경우**에는 사례나 채점 코드 해시가 달라지면 해당 경로의 실제 사례 채점도 재실행한다. 실제 재검수를 마친 기존 verified/published 대상은 `npx tsx cpa_uploader/promote_cpa_v3.ts --reverify --to verified --sets <ID> --review <새 review.json> --evidence "새 검수 기록"`으로 근거를 기록하고 다시 게시·컴파일한다. 기존 문항 수정도 이 경로의 실제 재검수와 실제 사례 채점을 완료한 새 receipt로 기록한다. 기존 96세트의 무해시 소급 장부는 읽기 호환을 유지하므로 과거 검수 내용과 현재 내용의 동일성이나 모든 변경의 탐지를 보장하지 않는다. `--backfill-verified`는 기존 기록 확인용이며 신규 승인을 만들지 않는다.

## 10. 검증·수정과 wiki 동기화

- 신규 제작에는 `$audit-question-author`, 기존 문항의 검증·수정에는 `$audit-question-review` 스킬을 사용한다. 두 스킬이 없으면 이 문서와 저장소 계약으로 진행한다.
- 검토 요청은 발견·수정안을, 수정 요청은 허용된 수정·재검증까지 수행한다. 모델 판정, 인용 검증, 보안 보정, 최종 점수를 구분하고 과거 로그는 보존한다. 정상 명칭 나열의 `salad_detected`만으로 전체 감점하지 않는 정책과 채점 조작 방지를 구분한다.
- 제출·진도가 범위라면 새 제출마다 획득 점수 전액을 경험치로 가산하고 같은 제출 ID의 재시도는 한 번만 가산한다. 결과가 나온 뒤 프로필 갱신 실패로 결과가 사라지지 않게 한다. 이는 목표 정책이며 실제 구현·검증 상태는 현재 코드와 후속 보고서에서 확인한다.
- 출제 규칙·형상·출처·주제 분포가 바뀌면 관련 wiki를 갱신한다. `question-generation/`와 `SCHEMA.md`는 수동 관리한다. 생성 문서는 `build-wiki.mjs`의 입출력을 확인하여 갱신하고 정본의 `classification.topic_id`별 집계와 대조한다.
- `npm run wiki:check`로 CRLF/LF 독립 링크·형식 검사와 읽기 전용 생성 내용 대조를 실행한다. 빌드는 `log.md`에 자동 기록하고 검사 결과는 실제 실행 후 기록한다. pre-commit에서도 동기화 검사를 실행한다. wiki 빌드로 원자료·문제은행을 바꾸지 않는다. 문서만 갱신한 것을 제품 문제 해결로 보고하지 않는다.

## Related

- [[llm-question-generation-prompt]]
- [[source-manifest]]
- [[question-design]]
- [[source-authoring-design]]
- [[source-catalog]]
