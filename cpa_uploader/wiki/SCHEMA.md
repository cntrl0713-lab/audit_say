# CPA 회계감사 문제 출제 LLM Wiki 스키마

## Domain

이 위키는 `cpa_uploader/data`의 회계감사 기준·이론·문제연습·기출문제와 `cpa_question_sets_v3.authoring.json`을 연결하여, 출처를 추적할 수 있는 사례형 문제와 기준서형 독립 물음을 만드는 데 사용한다. 제작·학습 표시·DB 계보·선택 제출의 공통 계약은 [물음별 학습 단위](../../docs/물음별-학습-단위와-분류-계약.md)에서 관리한다.

## Source of Truth

적용 연도는 공식 시험 적용 공고와 국내 기준서의 확정 본문·부칙으로 확인한다. 아래 로컬 자료는 탐색·대조 계층이며 공식 판본과 불일치하면 공식 근거를 우선한다.

기반 원자료와 실제 검증에 사용한 원본·추출본·페이지 이미지는 [raw 보관소](../raw/README.md)에 모으고 원래 위치·해시·판본의 계보를 남긴다. 기존 등록 입력과 과거 검수의 경로는 유지한다. `wiki/raw/`는 생성 색인이고 `cpa_uploader/raw/`가 실제 자료 보관소다. 제작·검증 시 필수 대조는 [공통 출처 검증 지침](../../.agents/skills/audit-question-review/references/source-evidence.md)을 따른다.

1. `data/official/`의 공식 발췌와 검토 보고서의 공식 URL·판본·문단 기록; `data/회계감사_통합학습자료/01_감사기준`은 탐색·대조용 통합본
2. `data/회계감사_통합학습자료/02_기본이론`의 설명과 핵심요약
3. `data/회계감사_통합학습자료/04_기출문제`의 실제 발문과 해설
4. `data/회계감사_통합학습자료/03_문제연습`의 발문과 해설
5. `data/cpa_question_sets_v3.authoring.json`의 기존 문제 세트·모범답안·criterion

기존 JSON의 criterion claim은 문제 생성의 **seed**이지 권위 있는 기준서 원문이 아니다. 새 문제를 공개하기 전에는 반드시 상위 출처와 대조한다.

## Wiki Layers

- `raw/source-manifest.md`: 현행 등록 입력의 경로·크기·해시·중복 상태와 실제 `cpa_uploader/raw/` 보관소의 연결. 기존 입력 경로는 보존하며 수집한 자료·누락은 보관소의 매니페스트로 확인한다.
- `concepts/`: 19개 공통 주제별 탐색어, 공통 사실·실제 발문, 세트 색인과 주제 지침·검토 기록 연결.
- `questions/`: 정본에서 생성한 세트별 발문·모범답안·critical_facts·배점·requirement·직접 출처·검수 메모 색인. 비공개 채점 정보를 포함하므로 public 배포 대상이 아니다.
- `question-generation/`: 공통 문제 유형·정수 배점·생성 절차·스키마·프롬프트와 `topics/`의 주제별 조건·예외 지침.
- `question-generation/question-elements.md`: 연습·기출에서 추출한 구체 요구사항·재수록 제거 빈도와 원자료 기반 출제 계획의 연결. 추출 데이터는 `cpa_uploader/analysis/question-elements/`에서 관리한다.
- `_meta/`: 주제·분포 지도, 요구사항별 보강 후보, 직접 출처·검토·판본 지도.
- `_meta/source-catalog*`: 기준서·이론·문제연습·기출의 실제 단위·위치와 은행 인용 연결. 단위 분리와 인용 연결은 내용상 출제 범위 충족이나 미출제를 확정하지 않는다.
- `index.md`: 모든 위키 페이지의 탐색 인덱스.
- `log.md`: 위키 생성·갱신 이력.

## Topic Navigation

탐색 순서는 [[ox-study-order]]에서 `필수암기_OX_200제.md`의 필수암기 장별 흐름에 맞춘다. 첫 화면·주제 지도·주제 지침 목록·문제 목록·주제별 원자료 카탈로그는 같은 대표 학습 순서를 사용한다. 여러 장에 걸친 주제는 장별 안내에서 반복 연결하고 각 concept에 이전·다음 주제와 해당 원문 페이지를 표시한다.

[학습 순서 설정](scripts/ox-study-order.mjs)은 표시 순서와 교재 장별 연결만 관리한다. 주제 ID·slug·문제 ID·원자료 분류·정본 JSON 배열 순서는 유지하며 페이지의 JSON Pointer는 정본 위치를 계속 가리킨다. 주제를 추가하면 [기존 주제 정의](scripts/topic-definitions.mjs)와 학습 순서를 함께 갱신한다. 배열 순서나 ID를 바꾸어 학습 순서를 맞추지 않는다.

## Conventions

- 파일명은 영문 소문자와 하이픈을 사용한다.
- 모든 콘텐츠 페이지는 YAML frontmatter를 가진다.
- 내부 문서 링크는 이중 대괄호 wikilink 형식을 사용하고 각 페이지는 최소 2개의 outbound link를 가진다.
- 원자료 경로와 페이지 번호를 삭제하거나 추정해서 만들지 않는다.
- 기준서 문구, 수치, 기간, 적용 조건은 원자료 확인 없이 보정하지 않는다.
- PDF의 쪽말 각주가 다른 문단의 인용 안에 포함돼 있어도 그 문단의 요구로 자동 귀속하지 않는다. 확인된 귀속은 [원자료 등록 설정](../config/question-source-registry.json)의 `referenceFootnotes`에 파일 해시·각주 본문·호출 원문·소유 문단을 기록한다. 이 연결은 참조 추론만 교정하며 원 인용·행 위치·해시를 바꾸지 않는다.
- 출처 묶음의 필수 문맥이 입력 한도를 넘으면 의도한 문단 ID를 명시해 범위를 좁힌다. 공식 원문이나 필요한 참조를 자르거나, 예산을 맞추려고 학습자료를 공식 자료보다 우선하지 않는다.
- 기존 질문의 표현을 바꾸더라도 판단을 바꾸는 사실관계를 임의로 추가하지 않는다.
- 계산을 요구하는 문제는 생성 대상에서 제외한다. 기준서상 수치·기간을 묻는 단답은 계산 문제가 아니다.
- 답안 `type`은 `descriptive`, `enumeration`, `judgment`이며 학습 유형 `question_style`의 `case`·`standard`와 별개다. 물음마다 실제 요구내용의 `topic_ids`를 하나 이상 연결한다.
- 새 `linked_question_set` 출력은 같은 학습 유형의 1~4개 물음으로 작성한다. 사례형은 부모 사실이 필요하고 사례 지문 아래에는 사례형 물음만 배치한다. 기준서형은 `shared_context.facts=[]`이며 학습·제출은 한 물음씩 독립적으로 구성한다.
- 기존 무메타데이터·혼합 판본은 원문 바이트를 보존하고 분류 sidecar·봉인 DB 메타데이터로 이관한다. 자료 계보와 학습 부모, 독립 발문, 다대다 주제 및 선택 채점의 세부 계약은 공통 문서를 따른다.
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
2. `shared_context`: 사례형의 필요한 부모 사실; 기준서형은 `facts=[]`
3. `subquestions`: 독립적인 요구사항과 물음별 `question_style`·`topic_ids`
4. `criteria`: 독립적으로 점수를 줄 수 있는 원자적 명제
5. 각 criterion의 `max_points`·`scores`: 기본 1점 명제의 정수 합산. `integer_scoring`이라는 별도 필드는 없음
6. `verification`: 출처 대조와 선택한 경로의 검수 상태. 검토자의 종류와 실제 사람 확인 여부는 검수 증거에서 구별한다.

세부 구조는 [[question-output-schema]]를 따른다.

원자료에서 새 학습목표를 설계하거나 기존 발문을 재구성할 때는 [[source-authoring-design]]의 별도 version 1 계획서를 작성한다. 주제·경로·목표·주체·시점·조건·예외·필수 답안·제외 범위·원자료 ID·기존 문제와 차이·판본 가정·미확인 사항을 보존한다. 계획서의 ready는 생성 입력 준비 상태이며 문항 검수나 공식 판본 확정 상태가 아니다.

생성은 draft와 계획·원문 패킷 sidecar를 기록한다. 현재 검증 범위·호출 수·승급 경로는 [공통 검토 스킬의 비용 통제 계약](../../.agents/skills/audit-question-review/references/cost-controlled-verification.md)을 따른다. 기본 경로는 agent의 전수 내용 대조와 실제 Luna 대표 채점을 결속한 `--efficient-review` 증거다. 기준별 API 전수검사를 선택한 경우 기존 `--review`·`--grade-cases` 경로의 엄격한 receipt 계약을 그대로 적용한다. 어느 경로든 형상·해시 검사만으로 의미검수를 대신하지 않으며, 검토자 종류와 사람 확인·게시 승인·DB 반영을 구별한다. 95%·±1점은 채점 일관성 기준이고 wiki·모범답안 등 기반 자료의 오류를 허용하지 않는다. 기존 무해시 소급 장부의 읽기 호환은 새 검수 승인이나 과거 변경 탐지 보장이 아니다.

## Update Policy

- [[authoring-dashboard]]는 `analysis/coverage`의 수동 연결 장부와 현재 요소 데이터·원자료·은행을 대조한 통합 진입점이다. 인용 연결·빈도·의미 대응 검토·은행 상태를 분리한다. 관계 미작성은 미출제 판정이 아니다.
- 자료별 정본과 수동/생성 구분은 [관리 규칙](../../docs/출제-검토-자료-관리.md)을 따른다. 분석 입력 변경 후 `analysis:build` → `analysis:check` → `wiki:build` → `wiki:check`를 실행한다. 과거 검토 JSON·실행 증거는 `cpa_uploader/analysis/reviews/`에 보존하고 사람이 읽는 보고 이력은 `docs/`에 둔다.

- DB 저장 구조를 설명할 때 프로젝트 테이블은 `cpa_*` 규약을 따른다. 회원은 `cpa_users`, 회계법인 데이터는 `cpa_firm_*`이며 문제은행 v3의 편집 정본은 JSON 파일이다. [DB 이름 전환 기록](../../docs/프로젝트-테이블-cpa-접두어-전환.md)을 참조한다. 이전 이름의 호환 뷰를 별도의 물리 테이블로 집계하지 않는다.
- 학습 분류 DB와 원문 v3 판본은 [물음별 학습 단위 계약](../../docs/물음별-학습-단위와-분류-계약.md)의 계보로 연결한다. 기준서형의 `source_set_id`를 학습 부모로 표시하지 않으며 봉인된 분류·과거 제출을 최신 판본으로 덮어쓰지 않는다.

- 출제·검증 정책은 [주제01–03 수정 결정](../../docs/plans/주제-01-03-검토에-따른-수정-결정.md)을 따른다. 문서의 목표와 현재 코드 구현 상태는 별도로 확인한다. 과거 실측을 새 정책의 기대값으로 그대로 재사용하지 않는다.
- 2027년의 2026년 시행 기준 동일 적용은 작업 가정이다. [개정220 시행일 메모](../../docs/archive/과거-검토-증거/reports/question-review-2027/개정-감사기준서-220-시행일-별도-기록.md)와 최종 시험 적용 판본을 구분한다.

- `npm run wiki:build`가 concepts·questions·_meta·raw/source-manifest·index를 재생성하고 log에 실행 기록을 추가한다. 공통·주제 지침과 SCHEMA는 수동 관리한다.
- 수동 검토 메모는 `question-generation/` 또는 별도 reviewed 페이지에 기록한다.
- 새 데이터가 기존 내용과 충돌하면 기존 내용을 덮어쓰지 말고 `review_required: true`로 표시한다.
- `data` 원자료는 위키 빌드 과정에서 수정하지 않는다.
- `npm run wiki:check`는 파일을 쓰지 않고 lint 및 현재 정본·출처에서 렌더링한 생성 내용과의 일치를 검사한다. CRLF/LF와 생성 날짜 차이는 허용하되 발문·조건·출처 해시·판본 본문 차이는 허용하지 않는다. pre-commit에서도 실행한다.
- 같은 검사는 생성기와 독립적으로 원본 목차의 원자료 행을 실제 concept 탐색 절과 대조한다. 빈 절, 누락, 다른 파일이나 페이지 목록으로 바뀐 연결을 거절한다.
- 빌드는 `log.md`에 자동 기록하고, lint·check의 실제 결과는 작업자가 기록한다. 과거 로그는 연결된 보관본에 유지한다.
