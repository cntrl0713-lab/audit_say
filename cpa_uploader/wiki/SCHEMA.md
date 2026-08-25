# CPA 회계감사 문제 출제 LLM Wiki 스키마

## Domain

이 위키는 `cpa_uploader/data`의 회계감사 기준·이론·문제연습·기출문제와 `cpa_question_sets_v3.authoring.json`을 연결하여, 출처를 추적할 수 있는 연계형 문제 세트를 만드는 데 사용한다.

## Source of Truth

신뢰 우선순위는 다음과 같다.

1. `data/회계감사_통합학습자료/01_감사기준`의 기준서 통합본
2. `data/회계감사_통합학습자료/02_기본이론`의 설명과 핵심요약
3. `data/회계감사_통합학습자료/04_기출문제`의 실제 발문과 해설
4. `data/회계감사_통합학습자료/03_문제연습`의 발문과 해설
5. `data/cpa_question_sets_v3.authoring.json`의 기존 문제 세트·모범답안·criterion

기존 JSON의 criterion claim은 문제 생성의 **seed**이지 권위 있는 기준서 원문이 아니다. 새 문제를 공개하기 전에는 반드시 상위 출처와 대조한다.

## Wiki Layers

- `raw/source-manifest.md`: 원자료의 경로·크기·해시·중복 상태. 원자료 자체는 `cpa_uploader/data`에 그대로 둔다.
- `concepts/`: 19개 공통 주제별 탐색어, 출처 페이지, 기존 문제 seed, 채점 명제 후보.
- `question-generation/`: 문제 유형, 정수 배점, 생성 절차, 출력 스키마, LLM 프롬프트.
- `_meta/`: 주제 지도와 현재 문제은행 커버리지.
- `index.md`: 모든 위키 페이지의 탐색 인덱스.
- `log.md`: 위키 생성·갱신 이력.

## Conventions

- 파일명은 영문 소문자와 하이픈을 사용한다.
- 모든 콘텐츠 페이지는 YAML frontmatter를 가진다.
- 내부 문서 링크는 이중 대괄호 wikilink 형식을 사용하고 각 페이지는 최소 2개의 outbound link를 가진다.
- 원자료 경로와 페이지 번호를 삭제하거나 추정해서 만들지 않는다.
- 기준서 문구, 수치, 기간, 적용 조건은 원자료 확인 없이 보정하지 않는다.
- 기존 질문의 표현을 바꾸더라도 판단을 바꾸는 사실관계를 임의로 추가하지 않는다.
- 계산을 요구하는 문제는 생성 대상에서 제외한다. 기준서상 수치·기간을 묻는 단답은 계산 문제가 아니다.
- 새 문제는 `descriptive`, `enumeration`, `judgment` 중 하나로 분류한다.
- 관련 물음은 하나의 `linked_question_set`으로 묶고 물음별로 독립 채점한다.
- 배점은 채점요소별 정수로 두며 문제 총점은 합계로 계산한다.
- `best_n` 선택군의 요소는 같은 배점을 가진다.
- 원문에서 실제로 묻지 않은 해설 지식을 채점요소로 추가하지 않는다.

## Frontmatter

```yaml
---
title: 페이지 제목
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: concept | guide | source-map | coverage
status: generated | reviewed
review_required: true | false
tags: [아래 taxonomy의 값]
sources: [프로젝트 루트 기준 경로]
confidence: high | medium | low
---
```

## Tag Taxonomy

- `audit`: 회계감사 공통
- `ethics`: 윤리·독립성·품질관리
- `planning`: 수임·계획·문서화·중요성
- `risk`: 위험평가와 대응
- `control`: 내부통제·통제테스트
- `evidence`: 감사증거와 경영진주장
- `procedures`: 실증절차와 특수절차
- `completion`: 왜곡표시·후속사건·계속기업·서면진술
- `reporting`: 감사의견과 감사보고
- `group-audit`: 그룹재무제표감사
- `icfr`: 내부회계관리제도 감사
- `assurance`: 기타 인증·검토·관련 업무
- `question-generation`: 문제 생성·루브릭·채점
- `source-map`: 원자료 및 출처 탐색
- `quality`: 검수·커버리지·데이터 품질

## Question Page Contract

문제는 위키 페이지로 직접 저장하지 않고, 위키를 근거로 다음 구조의 JSON 초안을 만든다.

1. `source_refs`: 파일·페이지·기준서 코드
2. `shared_context`: 여러 물음이 공유하는 최소 사실
3. `subquestions`: 원문의 독립적인 요구사항
4. `criteria`: 독립적으로 점수를 줄 수 있는 원자적 명제
5. `integer_scoring`: 각 criterion의 0~3점 정수 단계
6. `verification`: 출처 대조와 사람 검수 상태

세부 구조는 [[question-output-schema]]를 따른다.

## Update Policy

- 생성 스크립트가 concept·coverage·source-map 페이지를 재생성할 수 있다.
- 수동 검토 메모는 `question-generation/` 또는 별도 reviewed 페이지에 기록한다.
- 새 데이터가 기존 내용과 충돌하면 기존 내용을 덮어쓰지 말고 `review_required: true`로 표시한다.
- `data` 원자료는 위키 빌드 과정에서 수정하지 않는다.
- 모든 빌드와 lint 결과는 `log.md`에 기록한다.
