# 기존 릴리스 원문을 보존하는 6개 사례 추가 게시

이 도구는 격리 stage의 369세트가 통합 기준 363세트의 모든 객체·순서를 보존하고 정확히 검토된 6개만 뒤에 붙였는지 확인한다. 기존 5,863,528 bytes 원문은 DB의 active release에 보존된 source_document에서 읽고, 추가 6개 원문과 전체 학습 메타데이터만 전송한다. 최종 원문과 완성 payload의 동일성은 로컬 PostgreSQL 엔진 PGlite로 검사한다. 수치는 실행 시 실제 입력에서 다시 계산한다.

source-provenance.json은 읽은 코드·원래 해시·정확한 바이트 사본을 연결한다. 초기 다른 작업의 v3/v4는 당시 미완성 스냅샷으로 보존했다. 이후 v5 completion·receipt·verification과 소스는 별도 사본으로 추가했으며, 이를 우리 도구의 운영 실행 완료로 기록하지 않는다. 초기 source provenance도 sources 안에 보존한다.

## 준비와 실행

저장소 루트에서 다음 명령을 사용한다. --prepare는 환경파일·네트워크·운영 DB 없이 로컬 SQL·파일만 만든다. 다른 작업의 최종 active release는 root가 확인한 값이어야 한다.

```text
node --import tsx cpa_uploader/analysis/reviews/case-deepening-2026-09-14/incremental-db-publication-v2/driver.mjs --prepare --expected-active-release-id 291abae8-15e8-4f88-aff0-e755cd7c1b1f
```

root가 두 작업의 공통 쓰기 종료와 정본 설치를 확인한 뒤 preparation-v1/preparation.json의 실제 SHA256을 검토하여 실행한다. 아래 SHA256은 사용자가 입력할 설명용 자리표시자다.

```text
node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/case-deepening-2026-09-14/incremental-db-publication-v2/driver.mjs --apply --expected-preparation-sha256 PREPARATION_SHA256
```

--apply는 정확한 HTTPS 프로젝트·빈 포트/사용자정보, 준비 입력 해시와 canonical install 결과를 확인한다. 같은 DB 트랜잭션에서 service_role, 120초 statement_timeout, 기존 importer의 advisory lock을 적용한 뒤 예상 active ID·원문 해시·실제 원문 bytes를 확인한다. cpa_import_learning_question_bank(jsonb)는 원래 전체 payload를 받으며, COMMIT 전에 기존 set version·순서·분류와 주제, 최종 전체 ID/순서를 검증한다. 기존 원문·판본이나 적용대상 전체 검증을 생략하지 않는다. 기존 비교용 분류·주제 스냅샷 2개는 트랜잭션 로컬 설정에만 보관하며 영구 DB 객체나 기본 역할 설정을 바꾸지 않는다.

출력은 기존 후속 계약과 같은 ../db-publication-v2에 쓴다. import-response를 먼저 보존하고, 원문·공개본·분류·주제를 다시 조회한 뒤 receipt를 만든다. 기존 독립 verifier가 공개·비공개 전체 문항·분류를 검사하여 passed인 경우에만 completion.json을 만든다. coverage와 write-report는 이 완료 결과를 그대로 사용한다.

응답이 불확실하거나 저장에 실패하면 자동 재시도하지 않는다. --verify는 원 import-response가 실제로 보존된 경우에만 남은 읽기검사를 계속할 수 있다. 원응답이 없으면 별도의 수동 읽기 조사·새 후속 증거가 필요하다. 이전 import, 독립 검사 로그나 완료 파일을 덮어쓰지 않는다.

## 확인 범위

로컬 원문/payload 동등성, PGlite mock transaction의 정상·CAS 거부·판본/분류/순서 훼손·새 ID 누락 시 rollback, 문법·lint 및 agent 정적 검토를 각각 별도 파일에 기록한다. 운영 source 존재·active 상태·실제 API 전송 결과는 --prepare 검사 범위가 아니다. API·DB 적용은 root의 실행 결과로만 판단한다. 원 Luna 실측·sealed-v1을 재사용하며 모델 API 호출은 추가하지 않는다.
