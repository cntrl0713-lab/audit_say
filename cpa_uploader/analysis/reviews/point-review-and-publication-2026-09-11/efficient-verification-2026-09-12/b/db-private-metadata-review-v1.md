# Private DB DTO 선택 메타데이터 복원 독립 검토

검토자: plan_procedures. 범위: 로컬 코드·정본 읽기 및 최소 수정안. API·DB 읽기/쓰기·공통 코드 변경 0. 운영 postverify의 누락 보고는 총괄의 관측이며, 본 검토자는 로컬 현재 정본에서 13개 critical_facts.scope(4세트)와 319개 source_refs.source_span을 확인했다. 이번 allowlist의 원문 필드는 총 332개이고 모두 문자열이다. 새 migration 구현이나 테스트 통과를 이 설계 검토로 대신하지 않는다.

## 결론

봉인된 normalized rows와 source_document를 수정하지 않고 **private cpa_get_question_version(uuid) wrapper에서만** 누락된 두 선택 필드를 복원하는 방법이 적합하다. 기존 cpa_get_question_version_document(uuid)의 정규화 결과를 기준으로 유지하고, 해시 검증된 원문에서 허용한 경로만 덧붙인다. 현재 public serializer는 정규화 테이블을 직접 조회하므로 해당 함수와 active public bank는 변경하지 않는다. 기존 반환 전체를 source_document의 set으로 교체하거나 JSON 객체 전체를 병합하면 허용하지 않은 필드·상태가 덮어써지므로 사용하지 않는다.

## 실제 계약 근거

- 20260911030000 migration의 private document serializer(745행 이후)는 fact의 id/type/expected만 구성하여 scope를 빠뜨린다. source_refs도 id/file/title/page/source_quote/role/content_hash만 구성하여 source_span이 빠진다. requirements.source_span은 이미 별도 테이블에 저장·반환되므로 그대로 둔다.
- lib/questionV3Grading.ts:208은 critical_facts 객체 전체를 prompt에 전달하고 243행은 scope를 실제 판정범위로 명시한다. 따라서 scope 누락은 단순 표시 문제가 아니다. source_refs.source_span은 원문 위치 추적 보완이며 이 두 누락이 채점에 동일한 방식으로 작용한다고 혼동하지 않는다.
- cpa_question_set_versions는 applicability와 content_hash를 보존한다. release_items는 (release_id,set_id,set_version_id) 및 source-version 복합 FK로 연결되고 source_document는 release에 보관된다. 같은 source version은 여러 release에 재사용될 수 있다.
- lib/questionV3Repository.ts의 readDatabaseQuestionVersion은 이미 release_id/version_id 소속을 확인한 뒤 단일 인자 private RPC를 호출한다. 호환 wrapper의 시그니처를 유지하면 앱/서명토큰/고정 grader의 변경 없이 복원할 수 있다.
- common_accounts의 회원권 wrapper는 제출·채점 저장용이며 이 private 조회 함수의 wrapper가 아니다. 회원권·XP·시도·결과 RPC와 그 원형/권한을 바꿀 이유가 없다.

## 권장 조회 순서와 실패 경계

1. p_version_id의 source version을 조회한다. 없는 ID의 기존 null 반환 계약은 유지하고, 정규화 DTO를 기존 함수와 null-policy 복원으로 구한다. 새로운 helper가 private wrapper를 다시 호출해 순환하지 않도록 한다.
2. release_items.set_version_id = v.id AND release_items.set_id = v.set_id로 source_document 후보를 찾는다. active만 또는 최신 release만 선택하지 않는다. 과거 제출도 동일 version을 읽기 때문이다. 봉인·게시된 source/release에 관한 기존 호출 전제는 유지한다.
3. non-null 문서마다 UTF-8 SHA-256 = release.source_file_hash를 검증한다. JSON 배열이어야 하며 정확한 set.id가 하나만 존재해야 한다. release_items.position의 원문 배열 항목 ID도 동일한지 확인하면 다른 항목 선택을 방지할 수 있다. 중복 set ID·잘못된 배열·문자열 파싱 실패는 오류다.
4. 선택한 원문 set과 v.applicability로 **기존 import의 동일 PostgreSQL JSONB 식**을 계산하여 v.content_hash와 대조한다. application-side canonical hash나 원문 전체 파일 SHA를 version content hash 대신 쓰면 안 된다. status와 verification.review_status 외 필드는 제외하지 않는다.

```sql
encode(sha256(convert_to(
  jsonb_build_object(
    'question_set', jsonb_set(s - 'status', '{verification}',
                               (s -> 'verification') - 'review_status'),
    'applicability', v.applicability
  )::text, 'UTF8')), 'hex') = v.content_hash
```

5. 검증된 후보가 여럿이면 허용 메타데이터 지도와 필요한 source 내용이 동일한지 확인한다. 동일 판본을 여러 release가 공유하는 정상 사례는 허용하되, 서로 다른 지도·ID·base-field 의미가 있으면 최신을 고르는 대신 오류로 중지한다. status/review_status 차이는 hash 계약대로 허용할 수 있지만 normalized status를 원문 상태로 덮어쓰지 않는다.
6. 모든 linked release의 source_document가 NULL인 legacy에서만 기존 DTO를 그대로 반환한다. NULL 문서와 유효한 non-null 문서가 함께 있으면 유효 문서를 활용한다. 문서가 있는데 hash 불일치·set 누락·잘못된 JSON이 발생한 경우를 legacy로 처리하지 않는다. 유효 후보가 있어도 다른 non-null linked 문서의 오류를 조용히 덮지 않는다.
7. source_refs는 source id, fact는 **subquestion id → criterion id → fact id** 전체 경로로 연결한다. 배열의 같은 인덱스만 믿거나 fact id만 전역 검색하지 않는다. 각 ID가 정확히 한 번 존재해야 하며 normalized parent와 source parent가 대응해야 한다.
8. 문자열인 source_refs[].source_span과 subquestions[].criteria[].critical_facts[].scope만, 현재 normalized 객체에 키가 없을 때 추가한다. 이미 같은 값이면 그대로 두고 다른 값이면 오류로 중지한다. id/file/source_quote/claim/expected/type/scores 등 normalized 필드는 절대로 원문값으로 덮어쓰지 않는다. 대응 객체의 공통 필드가 다르면 source binding 결함으로 거절한다. 미지의 optional 키를 함께 복제하지 않는다.
9. 원본 배열 순서·required null 필드·decision·answer_slots·authored type/topic metadata·verification·점수를 유지한다. jsonb_strip_nulls를 보강 후 전체에 무차별 적용해 constraints.max_entries/selection.n을 다시 잃지 않게 한다. 잘못된 타입의 optional 값은 임의 문자열화하지 않는다.

## 권한·불변성과 성능

기존 cpa_get_question_version(uuid)의 stable/security invoker와 search_path=pg_catalog,public을 유지하는 쪽을 우선한다. 새 helper도 public/anon/authenticated의 기본 EXECUTE를 명시 REVOKE하고 service_role에만 필요한 EXECUTE를 부여한다. SECURITY DEFINER 추가는 이 복원에 필요하지 않으며 RLS/table grant를 확대하지 않는다. public RPC나 public JSON에 원문·scope·source_span·정답이 새로 노출되지 않아야 한다. 반환 오류에 source_document 전문을 포함하지 않는다.

봉인 trigger 우회·disable trigger·기존 rows UPDATE·content_hash 갱신·release 재활성화·재import는 필요 없다. status/학습분류/시도/XP/receipt/원source 바이트는 그대로 두고 읽기 projection만 바꾼다. 문서 파싱과 해시는 한 호출 안에서 동일 release를 한 번씩만 처리하되 전역 캐시나 최신 release 의존성을 도입하지 않는다. 큰 원문 배열의 154세트 전체 postverify 시간도 확인하여 복원 안전성 검사가 운영 조회에 지나친 지연을 주지 않는지 측정한다.

## 필수 로컬 PGlite 및 후속 운영 읽기 검사

| 경계 | 기대 결과 |
| --- | --- |
| 현재 원문과 동일한 13 scope / 319 source_span | 정확히 복원되고 다른 필드·점수·정규화 rows·source 바이트 불변 |
| 복원된 네 세트의 실제 buildGradingPrompt | 현재 고정 정본에서 만든 prompt와 동일; scope 13개 포함 |
| 두 optional 필드가 없는 legacy + source_document NULL | 원 private DTO와 완전 동일, 새 null/빈문자 키를 만들지 않음 |
| null 문서와 정상 문서를 공유하는 같은 version | 정상 문서로 복원하며 release 최신 여부에 의존하지 않음 |
| 같은 version을 두 active/retired 이력 release가 공유 | 문서가 다르게 포맷되어도 각각 file SHA 및 동일 semantic content hash 확인 후 같은 복원값 |
| 다른 revision·다른 set의 같은 fact/source ID | 섞이지 않음; version/release/전체 ID 경로로 분리 |
| file SHA·version hash·applicability 중 하나라도 다름 | 명시 오류, legacy fallback 금지 |
| 원문 중복 set ID·q/c/fact/source ID 또는 linkage 누락 | 명시 오류, LIMIT 1이나 첫 인덱스로 임의 선택 금지 |
| 동일 version linked 문서 사이 허용 지도 충돌 | 명시 오류, 최신 release 우선 금지 |
| normalized claim/expected/type/source_quote 등과 불일치 | 원문으로 덮어쓰지 않고 오류 |
| 이미 존재하는 optional 값 같음/다름 | 같으면 유지, 다르면 오류; 객체/배열/null 값은 허용 문자열로 변환하지 않음 |
| 추가 임의 private/public 필드가 원문에 있음 | allowlist 두 경로 외 자동 복원 금지 |
| anon/authenticated direct function/helper 호출 | 거절; service-role private 조회만 허용 |
| public DTO·active bank·회원권 wrapper·attempt/XP/과거 결과 | 이전 해시/내용/건수 유지, 비밀값 새 노출 없음 |
| 이전에 실패한 postverify와 후속 verification-v2 | 실패 원기록 보존 후 같은 검사로 전수 재대조; 실제 결과만 완료 기록 |

## 대상 scope 세트와 잔여 사항

- pilot-16-011: sub1 crit1/crit2 각 1개(2개).
- pilot-17-005: sub2 crit4/crit5 각 1개(2개).
- pilot-10-007: sub2 crit7/crit15/crit16/crit17(4개).
- pilot-10-007-standards: sub4 crit5/crit11/crit12/crit14/crit13(5개).

현재 TypeScript interface에는 scope와 source_ref.source_span이 명시되지 않았지만 raw JSON 객체는 런타임에 살아 있고 grader는 fact 전체를 전달한다. 고정된 grader나 interface를 이번 DB 보정 명목으로 바꾸지 말고 실제 RPC 반환→validateQuestionSetV3→buildGradingPrompt 경로로 값이 유지되는지 검사한다. 새로운 의미 기준이나 점수의 추가가 아니라 검수·실측한 같은 원문 입력 복원이다. 복원 후 기존 실제 실측과 runtime prompt의 동일성은 해시로 확인하며, 이 확인 전에는 앞선 실측을 수정 전 DB prompt에도 적용되었다고 주장하지 않는다.

## 검토 당시 입력 해시

- supabase/migrations/20260908024404_cpa_learning_schema.sql — 97e8ef14f4fb3b288b36cecb2e5e1810779b9cc83865d90361da431c884fdf56
- supabase/migrations/20260908024413_cpa_question_bank_rpc.sql — ed7e15d6d69f95ab1e97246328bb5e25189336cd004c4d8b5a52262f385acd83
- supabase/migrations/20260911030000_cpa_question_learning_units.sql — 6e45c144bf661fa10afd0d001cd0879d3d09c0b2d67d91ef45c70801e96f837b
- supabase/migrations/20260910090000_common_accounts.sql — fb71373d0ec587f9747024c988b7d25f84bccfec9761178f4cef17e782e3ef98
- lib/questionV3Repository.ts — eaceb96404095c6e71c1e492d662da0c909e04cdf24d0f656215d233731ce893
- lib/questionV3Grading.ts — aae10461df894ccbad948f55e25787c15775be40c8337638f161ac2389394d2c
- cpa_uploader/data/cpa_question_sets_v3.authoring.json — 4891f97bcfc98cdeda77567b59657577da184317df199fd53c859004728acd80

총괄 안내에 따라 C가 작성 중인 20260912060000_cpa_private_source_metadata.sql의 실제 구현·경계 테스트는 별도 후속 독립 검토 대상이다. 이 문서는 설계 의견이며 migration 적용/운영 정상화 완료 보고가 아니다.
