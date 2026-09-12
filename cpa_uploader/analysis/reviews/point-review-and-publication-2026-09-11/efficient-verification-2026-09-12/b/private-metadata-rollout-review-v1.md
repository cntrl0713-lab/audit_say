# Private metadata migration·적용 실행기 독립 검토

현재 파일의 읽기 검토를 완료하고 **사용자 중지 지시에 따라 마감**한다. 추가 차단 결함은 발견하지 못했다. 실제 DB 적용·원격 검증·모델 호출은 수행하지 않았다. C의 테스트 결과를 이 검토자가 실행한 것으로 표시하지 않는다.

| 검토 입력 | SHA-256 |
| --- | --- |
| runner (cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/private-metadata-rollout.mjs) | 4632c1c6b80292ea42197d252ab529a679e5241b4ce2e6ce024ccea581a51c0a |
| migration (supabase/migrations/20260912060000_cpa_private_source_metadata.sql) | a6a6300fd1f1df32fe822f137f832f07f306ed1ada5ecb9c98c301882c35a789 |
| before (cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/db-private-metadata-v1/before.json) | 90446134f72bf5ce440cf536e5604f4901367194da0869e317ded5187b1c5f63 |
| c_test_log (cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/c/private-source-metadata-v1/migration-test-v1.log) | 20ffa5b03a890fb827356e0f00a7ce2458dde18a6b9c7f0898d98c5d3ae7b92f |

## 실행기 검토

초기 TOCTOU 결함은 해결되었다. 전에는 transaction 밖의 전체 상태 비교 후 내부에서는 일부 필드만 검사했다. 현재는 advisory import lock과 release/release_items/version 테이블 share lock을 얻은 뒤 snapshotQuery 전체를 다시 실행해 before.state와 JSONB 동등성을 검사한다. active/source·release/version/item fingerprint·기존 5함수 정의/ACL/security·migration 부재가 동일한 트랜잭션 경계에서 확인된다.

CLI는 알 수 없는 옵션·중복·누락·잘못된 SHA와 prepare의 추가 인자를 거절한다. before 및 migration은 읽은 동일 바이트로 해시를 확인하고 SQL literal의 apostrophe를 escape하며 standard_conforming_strings를 고정한다. DO 구분자는 body SHA 기반이며 충돌을 검사한다. 원 SQL 전체는 schema_migrations.statements에 보존되고 reload notify와 DDL은 한 트랜잭션으로 구성된다.

write 요청 전에 request.json을 wx로 기록하므로 불확실한 응답 뒤 기존 기록을 덮어쓰며 자동 재시도하지 않는다. receipt는 applied:true/postcheck:pending이고 전체 사후조건 성공은 별도 postconditions.json으로 기록한다. source/release/version/item identity와 unrelated 4함수, wrapper ACL/security를 대조한다. helper는 service-only·stable·security invoker·정확한 search_path까지 확인한다. fingerprint가 모든 DB 행의 모든 열을 포괄한다고 확대 해석하지 않으며 전체 payload 검사는 다음 단계다.

## SQL 검토

원문 UTF-8 파일 SHA, release_items의 정확 version/set/position, v.applicability를 포함한 기존 import의 PostgreSQL JSONB content hash가 결속된다. 같은 version에 연결된 모든 non-null 원문을 검사하므로 최신 release를 임의 선택하지 않는다. 부서진 문서가 하나라도 있으면 다른 정상 문서로 덮지 않으며 진짜 source_document 없는 legacy만 기존 DTO를 반환한다.

후속 보강으로 normalized 일반 필드와 원문의 동등성도 검사한다. top/source/q/criterion/fact에 차이가 있으면 원문으로 덮어쓰지 않고 오류다. 실제 복원은 source_refs.source_span과 critical_facts.scope 두 경로에만 한정되고 source ID 및 q→criterion→fact의 단일 ID 경로로 연결한다. null optional은 기존 strip-null 정책대로 absent이며 빈 문자열은 보존한다. 필드 collision·잘못된 타입·ID 중복/누락을 거절한다.

기존 normalized/public serializer, 원 source_document, 봉인 rows, receipt, 점수, 회원권·시도·XP wrapper는 수정하지 않는다. 앱의 release/version 사전 결속과 private RPC 시그니처도 유지한다. 원 import 도중 private wrapper를 호출하는 SQL 경로는 발견하지 못해 새 sealed-release 확인과 import 순서의 충돌도 찾지 못했다.

## 실제 검사와 미완료

C의 migration-test-v1.log에서 **40/40 통과·실패 0**을 읽었다. production importer/SQL wrapper를 이용한 로컬 현재154+이전104=258세트, 일반 필드 불일치·다중 archive·hash/applicability·ID 경로·null·collision 경계가 포함된다. 이는 C의 실측 로그 참조이며 B는 재실행하지 않았다. C가 이미 착수한 promptpayload 추가 검사 결과는 본 마감 시점에 확인되지 않았다.

다음은 **미완료**다.

- 운영 DB DDL 적용.
- 전체 운영 postcheck. 총괄 재개 범위의 158 전체 검사와 C의 154+104 로컬 fixture를 같은 것으로 세지 않는다.
- 운영 DB의 모든 과거 sealed source version 호환 확인.
- 적용 후 RPC→검증→실제 grading payload의 원문 동일성 확인.

기존 실패 verification.json과 원래 DB source/rows는 보존하고, 재개 시 새 verification-v2 등 후속 기록으로 검사해야 한다. 당시 request.json·receipt.json·after.json은 아직 없었으며, 이 마감 이후 상태를 추정하지 않는다.

## 검토한 정확 명령 형태 — 현재 실행 금지

```text
node cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/private-metadata-rollout.mjs --apply --expected-before-sha256 90446134f72bf5ce440cf536e5604f4901367194da0869e317ded5187b1c5f63 --expected-migration-sha256 a6a6300fd1f1df32fe822f137f832f07f306ed1ada5ecb9c98c301882c35a789
```

위 명령은 현재 검토한 파일·before 조합의 문법만 기록한 것이다. 사용자 중지 지시가 유지되는 동안 실행하지 않는다. 이후 총괄이 재개 범위·현재 상태·해시와 동결 여부를 다시 확인해야 하며, 바뀐 DB 상태를 과거 before 파일의 해시 갱신으로 덮어쓰지 않는다.

B 실행 범위: 모델 API 0, DB 읽기/쓰기 0, production 코드 수정 0, 추가 테스트 실행 0. 문서·JSON 두 신규 결과만 작성하고 중지한다.
