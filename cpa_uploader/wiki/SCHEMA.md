# CPA 회계감사 문제 출제 LLM Wiki 스키마

## Domain

이 위키는 `cpa_uploader/data`의 회계감사 기준·이론·문제연습·기출문제와 `cpa_question_sets_v3.authoring.json`을 연결하여, 출처를 추적할 수 있는 연계형 문제 세트를 만드는 데 사용한다.

## Source of Truth

적용 연도는 공식 시험 적용 공고와 국내 기준서의 확정 본문·부칙으로 확인한다. 아래 로컬 자료는 탐색·대조 계층이며 공식 판본과 불일치하면 공식 근거를 우선한다.

1. `data/official/`의 공식 발췌와 검토 보고서의 공식 URL·판본·문단 기록; `data/회계감사_통합학습자료/01_감사기준`은 탐색·대조용 통합본
2. `data/회계감사_통합학습자료/02_기본이론`의 설명과 핵심요약
3. `data/회계감사_통합학습자료/04_기출문제`의 실제 발문과 해설
4. `data/회계감사_통합학습자료/03_문제연습`의 발문과 해설
5. `data/cpa_question_sets_v3.authoring.json`의 기존 문제 세트·모범답안·criterion

기존 JSON의 criterion claim은 문제 생성의 **seed**이지 권위 있는 기준서 원문이 아니다. 새 문제를 공개하기 전에는 반드시 상위 출처와 대조한다.

## Wiki Layers

- `raw/source-manifest.md`: 원자료의 경로·크기·해시·중복 상태. 원자료 자체는 `cpa_uploader/data`에 그대로 둔다.
- `concepts/`: 19개 공통 주제별 탐색어, 공통 사실·실제 발문, 세트 색인과 주제 지침·검토 기록 연결.
- `questions/`: 정본에서 생성한 세트별 발문·모범답안·critical_facts·배점·requirement·직접 출처·검수 메모 색인. 비공개 채점 정보를 포함하므로 public 배포 대상이 아니다.
- `question-generation/`: 공통 문제 유형·정수 배점·생성 절차·스키마·프롬프트와 `topics/`의 주제별 조건·예외 지침.
- `_meta/`: 주제·분포 지도, 요구사항별 보강 후보, 직접 출처·검토·판본 지도.
- `_meta/source-catalog*`: 기준서·이론·문제연습·기출의 실제 단위·위치와 은행 인용 연결. 단위 분리와 인용 연결은 내용상 출제 범위 충족이나 미출제를 확정하지 않는다.
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
- 열거형은 발문 범위의 항목을 모두 작성한다. `selection={type:'all',n:null}`, `ordered=false`, `max_entries=null`, `overflow_policy='none'`을 사용한다. 감사절차의 의미상 순서와 시점은 criterion에 보존한다.
- 같은 문장이 독립 명제를 충족하면 같은 인용을 허용한다. 명칭을 요구한 답안은 명칭만으로 득점할 수 있다. 요구 조치에서 결론이 분명하면 판단 점수를 인정한다.
- 원문에서 실제로 묻지 않은 해설 지식을 채점요소로 추가하지 않는다.

## Frontmatter

```yaml
---
title: 페이지 제목
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: concept | question | guide | source-map | coverage
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

편집 정본은 JSON이다. `questions/`는 정본을 읽어 생성하는 내부 색인이며 직접 편집하지 않는다. 신규 문제는 위키의 지침과 공식 근거를 바탕으로 다음 구조의 별도 JSON 초안을 만든다.

1. `source_refs`: 파일·페이지·기준서 코드
2. `shared_context`: 여러 물음이 공유하는 최소 사실
3. `subquestions`: 원문의 독립적인 요구사항
4. `criteria`: 독립적으로 점수를 줄 수 있는 원자적 명제
5. 각 criterion의 `max_points`·`scores`: 기본 1점 명제의 정수 합산. `integer_scoring`이라는 별도 필드는 없음
6. `verification`: 출처 대조와 사람 검수 상태

세부 구조는 [[question-output-schema]]를 따른다.

원자료에서 새 학습목표를 설계하거나 기존 발문을 재구성할 때는 [[source-authoring-design]]의 별도 version 1 계획서를 작성한다. 주제·경로·목표·주체·시점·조건·예외·필수 답안·제외 범위·원자료 ID·기존 문제와 차이·판본 가정·미확인 사항을 보존한다. 계획서의 ready는 생성 입력 준비 상태이며 문항 검수나 공식 판본 확정 상태가 아니다.

생성은 draft와 계획·원문 패킷 sidecar를 기록한다. 별도 검수 도구가 문항·실제 출처·계획·비교 은행에 결속된 receipt를 만든다. 의미검수만 pass이면 grading.status=not_run이며 승급할 수 없다. `--grade-cases`로 실제 사례 채점을 실행하고, completed 기록의 기대 판정·인용 검증·점수 재현 및 해시 검증을 통과해야 한다. 신규 verified 승급과 재검수에는 이 `--review`와 실제 사람 검수의 `--evidence`가 모두 필요하다. 이 통과도 의미 정확성·판본 적합성의 보증은 아니다. 기존 무해시 소급 장부의 읽기 호환을 새 receipt 검증이나 과거 변경 탐지 보장으로 해석하지 않는다.

## Update Policy

- DB 저장 구조를 설명할 때 프로젝트 테이블은 `cpa_*` 규약을 따른다. 회원은 `cpa_users`, 회계법인 데이터는 `cpa_firm_*`이며 문제은행 v3의 편집 정본은 JSON 파일이다. [DB 이름 전환 기록](../../docs/cpa-table-prefix.md)을 참조한다. 이전 이름의 호환 뷰를 별도의 물리 테이블로 집계하지 않는다.

- 출제·검증 정책은 [주제01–03 수정 결정](../../docs/plans/question-review-01-03-remediation.md)을 따른다. 문서의 목표와 현재 코드 구현 상태는 별도로 확인한다. 과거 실측을 새 정책의 기대값으로 그대로 재사용하지 않는다.
- 2027년의 2026년 시행 기준 동일 적용은 작업 가정이다. [개정220 시행일 메모](../../docs/reports/question-review-2027/kga220-effective-date-note.md)와 최종 시험 적용 판본을 구분한다.

- `npm run wiki:build`가 concepts·questions·_meta·raw/source-manifest·index를 재생성하고 log에 실행 기록을 추가한다. 공통·주제 지침과 SCHEMA는 수동 관리한다.
- 수동 검토 메모는 `question-generation/` 또는 별도 reviewed 페이지에 기록한다.
- 새 데이터가 기존 내용과 충돌하면 기존 내용을 덮어쓰지 말고 `review_required: true`로 표시한다.
- `data` 원자료는 위키 빌드 과정에서 수정하지 않는다.
- `npm run wiki:check`는 파일을 쓰지 않고 lint 및 현재 정본·출처에서 렌더링한 생성 내용과의 일치를 검사한다. CRLF/LF와 생성 날짜 차이는 허용하되 발문·조건·출처 해시·판본 본문 차이는 허용하지 않는다. pre-commit에서도 실행한다.
- 같은 검사는 생성기와 독립적으로 원본 목차의 원자료 행을 실제 concept 탐색 절과 대조한다. 빈 절, 누락, 다른 파일이나 페이지 목록으로 바뀐 연결을 거절한다.
- 빌드는 `log.md`에 자동 기록하고, lint·check의 실제 결과는 작업자가 기록한다. 과거 로그는 연결된 보관본에 유지한다.
