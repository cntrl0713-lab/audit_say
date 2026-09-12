# 공통 계정 DB 구현 및 전환

2026-09-10 운영 적용 완료. 기존 계정 910개 초기화와 두 서비스 배포를 마쳤으며 [운영 전환 결과](통합-계정-운영-전환-완료-2026-09-10.md)에 근거를 기록했다.

## 적용 단위

정본은 `supabase/migrations/20260910090000_common_accounts.sql`이다. CTA 저장소의 같은 이름 파일은 바이트가 같은 사본이며, 두 저장소가 사용하는 **공유 DB에 한 번만 적용**한다. CPA 학습 스키마/RPC와 CTA 유료화/보안 경계 마이그레이션이 선행되어야 한다. 서로 다른 과거 migration 이력을 가진 두 저장소에서 무조건 `db push`를 실행하지 않는다.

이 마이그레이션 자체는 기존 Auth 회원을 삭제하지 않는다. 기존 회원의 닉네임은 CTA → CPA → Auth 메타데이터 순서로 가져오고, 형식이 다르거나 이미 사용 중이면 새 이름을 부여한다. 이번에는 적용 후 별도 실행기로 승인된 기존 계정 초기화를 완료했다. 미처리 결제는 없었고, 관리자 지정은 사용자 요청에 따라 추후 진행한다.

## 정본과 호환 필드

- `auth.users`: UUID, 현재 이메일, 비밀번호, 이메일 인증.
- `common_profiles`: 공통 닉네임과 `active / locked / deleting` 계정 상태. 닉네임은 앞뒤 공백 제거 후 한글 완성형·영문·숫자 2~12자, `lower(nickname)` 전역 UNIQUE.
- `cpa_users / cta_user`: 각 서비스 가입 상태, 가입 회차, 관리자 여부, 제재 재가입 차단, 경험치 등. 상태는 `active / suspended / withdrawing / withdrawn`; `membership_version`은 첫 가입 1, 명시적 재가입에만 증가한다.
- 기존 `username / nickname / email` 복사본은 DB 트리거가 정본으로부터 유지하는 호환 컬럼이다. 앱이 독립 수정하지 않는다. `role / tier`는 기존 화면·이용권 코드와의 호환 값이며 관리자 판단은 별도 `is_service_admin`으로 한다.

Auth 가입 트리거는 공통 프로필만 만든다. 다른 서비스를 자동 가입시키지 않는다. 익명 계정에는 공통 프로필이 없다. 메타데이터의 `nickname`(`username` 호환) 중복은 Auth 가입 transaction 자체를 거절한다. 회원가입 요청은 서비스·유료·관리 권한을 지정할 수 없다.

## 서버 RPC 계약

모든 아래 RPC는 `service_role` 전용이다. 앱 서버가 Auth 재검증으로 얻은 UUID만 전달해야 한다. 사용자 브라우저에는 공통 프로필 본인 행 SELECT만 허용한다.

| RPC | 입력 / 결과 |
|---|---|
| `common_ensure_profile` | `p_user_id, p_nickname?` → 공통 프로필 JSON. 이미 있으면 그대로 반환 |
| `common_update_nickname` | `p_user_id, p_nickname` → 변경한 공통 프로필 JSON |
| `common_join_service` | `p_user_id, p_service='cpa'\|'cta'` → 해당 서비스 행 JSON. 인증 이메일·정상 계정 필요 |
| `common_assert_service_access` | `p_user_id, p_service, p_membership_version?` → 현재 회차. 계정/서비스 잠금 및 전달된 회차 불일치 거절 |
| `common_withdraw_service` | `p_user_id, p_service, p_expected_version?` → `status, membership_version, cleanup_pending, cleanup_count, billing_review_required` |
| `common_prepare_account_deletion` | `p_user_id` → `cpa, cta, ready_for_auth_delete`. 계정을 deleting으로 바꾸며 Auth 자체는 삭제하지 않음 |
| `common_cta_hint_usage` | `p_user_id` → 서버 KST 오늘 사용한 고유 문제 수. 탈퇴 시 보관한 한도 사용도 포함 |

`withdraw` 결과 상태는 `not_joined / withdrawing / withdrawn`이다. 가입하지 않은 서비스는 새 프로필을 생성하지 않는다. 미해결 결제 주문이나 빌링키 삭제 작업이 남으면 `cleanup_pending=true`, 상태가 `withdrawing`이다. 외부 정리가 끝나면 같은 RPC를 재호출하여 `withdrawn`으로 완료한다. `withdrawn`이고 `billing_review_required=true`인 경우 서비스 종료는 완료되었고 환불 검토가 별도로 남아 있다. 전체 Auth 삭제는 해당 검토까지 끝나야 가능하다.

기존 CPA `cpa_begin_attempt` payload의 회원 요청에는 `membership_version`이 필수다. `cpa_update_review_item`도 마지막 `p_membership_version` 인자를 받는다. claim/complete/fail은 시도 행에 저장한 회차로 재검증한다. 게스트의 회차는 NULL이다.

CTA `reserve_grading_attempt`, `consume_hint_quota`, `begin_subscription_setup`, `cancel_subscription_renewal`은 마지막 `p_membership_version` 인자를 받으며 정식 회원에게 필수다. `cta_grading_attempt / cta_problem_assist / cta_subscription / cta_payment_log`에 회차를 저장한다. 추천 관계 INSERT는 `referrer_membership_version / referee_membership_version`을 함께 전달한다. 요청 시작 때 받은 회차를 후속 쓰기에 사용하며, 오래된 요청에서 현재 회차를 다시 읽어 대체하지 않는다.

CPA 채용 알림 테이블과 기존 개인 활동 테이블이 있으면 `cpa_kicpa_jobs_subscribers / cpa_review_notes / cpa_firm_chat_message / cpa_firm_review / cpa_firm_subscription`에도 같은 회차 검사를 설치한다. 신규 INSERT에는 회차 기본값이 없으므로 이전 클라이언트가 현재 회차를 추측하여 가입 상태를 되살릴 수 없다. 이 테이블의 쓰기는 요청 시점의 CPA 회차를 전달한다.

## 탈퇴·결제·삭제 경계

CPA 탈퇴는 리뷰 항목 → 경험치 원장 → 답안/채점 이력 → 채용 알림 및 기존 개인 노트·법인 채팅·개인 후기·법인 서비스 구독 순으로 개인 정보를 지운다. 문제은행·수집된 회계법인 콘텐츠는 유지한다. 기존 불변성 트리거를 일반 쓰기에 그대로 적용하면서 탈퇴 RPC 안에서만 해당 회원 삭제를 허용한다.

CTA 탈퇴는 답안/채점/오답 저장/학습 보조를 삭제한다. 현재 한도 창의 완료 및 진행 중 채점, 힌트 문제 수는 답안 없이 `cta_usage_receipts`에 남겨 재가입 초기화를 막는다. 추천 관계·보상 이력은 유지하고 대기 중 추천 보상은 취소한다. 사용 만료일은 즉시 종료하며 자동갱신은 중단한다.

빌링키 삭제는 기존 `cta_billing_key_cleanup` outbox를 사용한다. 진행 중인 `billing_order_id / billing_setup_state / claim`을 버리지 않는다. 결제 worker는 탈퇴·잠금·이전 회차·삭제된 계정에서 기존 주문을 **조회만** 하며 신규 승인 요청을 보내지 않는다. 늦게 확인한 성공 결제는 원장에 남기고 `requires_refund_review=true`로 표시하며 이용권·보상을 복구하지 않는다. 미확정 결제 결과를 임의로 실패/환불 완료 처리하지 않는다.

이전 가입 회차 결제의 취소가 재가입 뒤 도착하면 해당 결제·추천 상태만 정리하고 새 이용권·자동갱신을 변경하지 않는다. 기존 결제 API에서 `refunded`는 부분취소이므로 부분취소만으로 늦은 결제의 검토 완료를 표시하지 않는다. 전액취소(`cancelled`) 또는 명시적인 운영 검토 후에 전체 계정 삭제를 재시도한다.

### 승인 요청 전 중단되어 존재하지 않는 결제 주문

setup 선점 직후 서버가 중단되면 원래 주문번호는 DB에 있으나 결제사에는 승인 요청 자체가 없을 수 있다. 조회 404·timeout은 그 사실을 증명하지 않으므로 worker가 자동으로 주문을 지우지 않는다. 다음 운영 절차를 사용한다.

1. 해당 계정의 서비스 상태가 `withdrawing`인지 확인한다. 해당 구독을 처리할 수 있는 **기존 앱 setup 요청과 모든 결제 worker 실행을 중지·종료**하고, 활성 lease·진행 중 외부 요청이 모두 끝났는지 확인한다. worker 하나만 중지하는 것으로 충분하지 않다.
2. 원래 `billing_order_id`와 결제사의 원주문·카드 거래 기록을 조회하여 승인·진행 중 결제가 없음을 별도로 확인한다. 승인 요청을 새로 보내지 않는다. 확인할 수 없으면 검토 상태를 유지하고 결제사 확인을 받는다.
3. DB 소유자만 아래 함수를 실행하고 근거를 기록한다. 최소 15분 경과·lease 종료·알려진 성공 결제 부재 검사는 추가 방어일 뿐, 시간 경과나 404 응답만으로 검증을 대신할 수 없다.

```sql
-- 예시 값을 실제 확인한 구독·원주문·운영 증적 참조로 대체한다.
select public.common_resolve_withdrawn_order_no_charge(
  123,
  'original_order_id',
  '운영 확인 건 CASE-2026-001: 모든 기존 앱·worker 요청 종료 후 결제사 원주문과 거래 기록에서 승인 및 진행 중 결제 없음 확인'
);
```

이 함수는 `service_role`·일반 앱에서 실행할 수 없다. `common_payment_resolution_log`에 처리자·시각·증적을 남기고, 미승인 확인을 실패 원장에 기록한 다음 해당 원주문만 닫는다. 빌링키가 있으면 기존 outbox에 넘긴다. 이후 worker를 재개하여 키 정리를 완료하고 서비스 탈퇴/전체 삭제 RPC를 다시 호출한다. 결제가 이미 확인된 경우 이 함수를 사용할 수 없으며 정상 결제 정산·환불 경로로 해결한다. 근거에 이메일·전체 카드번호·빌링키 등 비밀값을 적지 않는다.

공통 계정 삭제는 서버에서 `ready_for_auth_delete=true`를 확인한 다음 Supabase Admin의 기본 hard delete를 호출한다. DB의 Auth BEFORE DELETE 트리거도 완료 상태를 재검사한다. CTA 결제/구독/추천/보상 user FK를 nullable `ON DELETE SET NULL`로 바꿔 거래 PK·주문 멱등키·금액·상태를 보존한다. 해당 보관 행의 `user_id=null`은 정상 상태이며 외부 callback은 새 서비스 권한을 부여하지 않는다. 구체적 보관 기간과 환불 판정은 별도 운영 정책이다.

## 검증과 배포 순서

1. 두 앱과 결제 worker의 새 코드·환경을 준비하고 실제 테이블/함수/트리거/권한 차이를 읽기 전용으로 확인한다.
2. 구버전 앱/worker가 가입·채점·결제를 쓰지 않도록 전환 시간을 확보한다. 새 RPC의 회원 회차 누락을 거절하므로 구버전 혼용을 허용하지 않는다.
3. 공유 DB에 정본 마이그레이션 한 번 적용 후 양쪽 앱과 CTA 결제 worker를 함께 전환한다.
4. 테스트 계정으로 양쪽 가입, 공통 닉네임, 별도 관리자/이용권, 탈퇴·재가입, 지연 채점/결제, 전체 삭제를 확인한다. 초기 운영 관리자 권한은 서비스별 명시 지정한다.

오프라인 검증:

```text
audit_say: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/sharedAccountsDatabase.test.ts
CTA_tax_law: npx tsx tests/verify-common-account-billing-worker.ts
```

DB 테스트는 PGlite PostgreSQL에서 기존 CPA 실제 학습 마이그레이션과 CTA 실제 유료화/보안 마이그레이션을 먼저 실행한 뒤 새 마이그레이션을 실행한다. `tests/fixtures/sharedAccounts`의 CTA SQL 두 파일은 독립 체크아웃 CI용 고정 과거 스냅샷이다. 결제 worker 테스트는 실제 `processOne`을 로컬 Auth/RPC/HTTP 대역과 실행하며 네트워크 요청이나 결제를 발생시키지 않는다.

### 승인된 운영 전환 실행기

`scripts/prepare-common-account-rollout.mjs`는 집계·스키마·기존 cron·공개 Auth 설정만 읽고 `tmp/common-account-rollout-manifest.json`을 준비한다. 계정 UUID 집합은 해시로 고정하며 이메일·닉네임·키를 출력하지 않는다. `tmp/common-account-original-state.json`에는 유지보수 이전 가입 허용 설정과 cron 활성 상태를 별도 보관하므로, 유지보수 후 계정 목록을 새로 고정해도 원래 설정을 잃지 않는다.

`scripts/execute-common-account-rollout.mjs`는 아래 네 단계만 지원한다. 기본 실행은 읽기 전용 미리보기다. 실제 변경에는 `--apply`, 정확한 `--expected-project`, 준비된 파일의 `--manifest-sha256`이 모두 필요하다.

| 단계 | 동작 |
|---|---|
| `pause-cron` | 매니페스트에 고정한 cron ID·이름·일정·명령 해시를 재검증하고 해당 잡만 일시 중지 |
| `migrate` | 계정 집합·콘텐츠 ID 집합·기존 함수 해시를 재검증하고 정본 SQL과 migration 이력을 한 transaction에 적용. 계정은 삭제하지 않음 |
| `reset` | 일치하는 migration 영수증·재검증된 재무 FK 필요. 공통 삭제 준비가 완료된 고정 대상만 Supabase Admin hard delete로 삭제 |
| `resume-cron` | 고정한 원래 잡의 활성 상태만 복원. 새 잡의 상태나 명령은 변경하지 않음 |

`migrate / reset`에는 모든 이전 앱 요청이 종료되었음을 확인한 뒤 `--maintenance-confirmed`도 전달해야 한다. 실행기는 실제 Auth 설정의 `disable_signup=true`, `external_anonymous_users_enabled=false`와 고정 cron 비활성 상태를 재검사한다. 이 전환용 설정은 코드 배포·검증이 끝난 뒤 원래 가입 허용 값으로 복구한다. 최종 콜백 URL 추가·최소 비밀번호 길이 강화 같은 새 운영 설정까지 과거 값으로 되돌리지는 않는다.

새 계정·예상치 못한 결제·콘텐츠 변경이 발견되면 실행기는 중단한다. 삭제는 고정된 UUID 집합에만 제한하며 재시작용 체크포인트는 로컬 `tmp/common-account-reset-checkpoint.json`에 최소 식별자만 비공개로 저장한다. 이 파일을 도구 출력이나 공개 보고서에 포함하지 않는다. 중간 실패 후 재실행해도 새 계정을 삭제 대상으로 추가하지 않는다.
