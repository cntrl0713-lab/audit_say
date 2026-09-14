# 원래 릴리스를 보존하는 사례 3개 추가 게시

현재 격리 게시본이 integration-baseline의 모든 원문 객체·배열 순서를 보존하고 정확히 검토된 3개 ID만 추가했는지 먼저 확인한다. 기존 원문은 운영 DB의 active release에 저장된 source_document에서 읽고 추가 원문과 전체 학습 메타데이터만 보내며, 최종 source_document와 정식 importer 전체 payload가 원래 stage와 같은지는 로컬 PostgreSQL 엔진 PGlite로 검증한다. 준비 전후의 글자·바이트 수와 해시는 실행 입력에서 계산한다.

이전 실제 DB roundtrip의 함수 정의·권한 스냅샷은 sources/prior-db-roundtrip.json에 바이트 보존했다. 새 source-provenance.json은 원 코드와 사본 및 여기서 추출한 installed-functions-after.json의 해시를 연결한다. 새 독립 code review는 independent-review.json에 status=passed_static_review, human_review_performed=false, unresolved_findings=[], files=[{file,sha256}]로 기록하며 driver·append-contract·source-provenance의 현재 해시를 반드시 포함해야 한다. 이 문서는 검토 완료를 대신하지 않는다.

root는 현재 active release를 읽기 조회로 확인한 뒤 아래 준비 명령의 ROOT_VERIFIED_ACTIVE_UUID에 넣는다. 이전 배치 릴리스 ID를 기본값으로 쓰지 않는다. prepare는 운영 DB·네트워크·모델을 호출하지 않는다.

```text
node --import tsx cpa_uploader/analysis/reviews/case-trio-2026-09-14/incremental-db-publication-v1/driver.mjs --prepare --expected-active-release-id ROOT_VERIFIED_ACTIVE_UUID
```

root가 preparation-v1/preparation.json 및 local-proof/guarded-import.sql의 현재 해시·원문 보존·3개 ID·전송량을 검토한 후 실제 SHA를 다음 명령에 넣는다. 정본 설치가 완료되어야 apply가 가능하다.

```text
node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/case-trio-2026-09-14/incremental-db-publication-v1/driver.mjs --apply --expected-preparation-sha256 PREPARATION_SHA256
```

실행은 HTTPS 프로젝트 xvifzicrjmbfqaepcfpp, 빈 포트·사용자 정보, 실제 env 파일과 승인된 입력을 검사한다. Management SQL에서 BEGIN/SET LOCAL ROLE service_role/SET LOCAL statement_timeout=120s 및 기존 importer와 같은 advisory transaction lock을 사용한다. 같은 트랜잭션의 예상 active ID·기존 source hash·실제 원문 SHA, 복원 payload JSONB hash를 대조한 뒤 정식 cpa_import_learning_question_bank를 한 번 호출한다. COMMIT 전 기존 set version/position/classification, 주제와 최종 전체 ID/순서 보존을 검사한다. 영구 함수·권한·역할 설정을 바꾸지 않는다.

db-publication-v1/apply-started.json을 먼저 기록하고 응답을 보존한 후 source 원문·공개본·분류·주제를 다시 조회한다. 기존 독립 verifier가 공개·비공개 전체 내용을 확인해 통과해야 completion.json을 만든다. API·모델 자격증명은 출력하지 않는다.

실패 또는 응답 불명확 시 apply를 반복하지 않는다. 성공한 원 import-response.json이 실제로 남아 있는 경우에만 같은 SHA의 `--verify`로 나머지 읽기 검사를 이어갈 수 있다. 원응답이 없거나 독립 verifier 실행 로그가 실패 상태로 남았으면 먼저 별도 읽기 조사를 하고 새 후속 증거를 기록한다. 기존 출력·로그·receipt를 덮어쓰거나 실패를 미실행으로 치환하지 않는다.

tests/append-transaction.test.mjs는 로컬 합성 schema에서 실제 생성 SQL의 정상 commit·CAS 거부·원판본/분류/순서/추가 ID 훼손 rollback을 검사한다. 정식 운영 importer 내부 검증을 대신하지 않는다. validation.json은 문법·lint·로컬 테스트만 기록하며 이번 production 적용은 db-publication-v1 결과로만 판단한다.
