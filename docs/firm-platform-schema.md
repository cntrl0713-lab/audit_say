# 회계법인 리서치 플랫폼 — 스키마 설계 기록

> 대상: `docs/PLAN_PRD_v2.md` §6·§7·§8 의 구현본
> 정본 SQL: `supabase/migrations/20260907000001_firm_platform_schema.sql`, `..._views.sql`, `..._seed.sql`
> 적용 대상 Supabase 프로젝트: `CTA_tax_law` (`xvifzicrjmbfqaepcfpp`)

---

## 1. PRD 와 달라진 점

### 1-1. 테이블 이름에 `firm_` 접두어를 붙였다

이 Supabase 프로젝트의 `public` 스키마는 **두 앱이 공유**한다.

| 접두어 | 앱 |
|---|---|
| `cta_*` | 세법학 |
| `cpa_*`, `user_cpa` | audit_say 채점 시스템 |

PRD 가 적은 `company` · `users` · `subscriptions` · `chat_messages` 같은 무접두어 이름을
그대로 쓰면 이 규약이 깨지고, 특히 `users` 와 `subscriptions` 는 이미 있는
`cta_user` · `cta_subscription` · `user_cpa` 와 의미가 겹쳐 나중에 어느 앱 것인지
분간이 안 된다. 그래서 리서치 플랫폼 테이블은 전부 `firm_*` 로 뒀다.

| PRD §6 | 실제 테이블 |
|---|---|
| `registered_firm` | `firm_registered` |
| `company` | `firm_company` |
| `engagement` | `firm_engagement` |
| `audit_opinion` | `firm_audit_opinion` |
| `financials` | `firm_financials` |
| `service_contracts` | `firm_service_contract` |
| `firm_profile_yearly` | `firm_profile_yearly` (그대로) |
| `firm_workforce_yearly` | `firm_workforce_yearly` (그대로) |
| `users` | **만들지 않음 — `user_cpa` 재사용** |
| `subscriptions` | `firm_subscription` |
| `chat_messages` | `firm_chat_message` |
| `firm_reviews` | `firm_review` |

뷰도 `v_firm_` 으로 통일했다. PRD 의 `v_company_audit_history` 만
`v_firm_company_audit_history` 로 이름이 바뀌었고 나머지 4개는 PRD 이름 그대로다.

### 1-2. `users` 테이블을 새로 만들지 않았다

audit_say 는 이미 `public.user_cpa` 가 `auth.users(id)` 를 참조하며 role 을 들고 있다.
같은 사이트의 같은 계정이므로 계정 테이블을 하나 더 만들 이유가 없다.
`firm_subscription` · `firm_chat_message` · `firm_review` 는 `auth.users(id)` 를 직접
참조하고, 역할이 필요하면 `user_cpa.role` 을 본다.

### 1-3. `engagement.rcept_no` 를 UNIQUE 로 두지 않았다

PRD 는 `rcept_no` 를 UK 로 적었지만, **공동감사(joint audit)** 면 한 접수번호 아래에
감사인이 둘 이상 잡힌다. UNIQUE 를 걸면 두 번째 법인 적재가 조용히 실패한다.

- 중복 방지 키: `firm_engagement_natural_key unique (firm_id, corp_code, bsns_year)`
- `rcept_no` 는 출처 추적용 일반 인덱스

비기능 요구(§11 "동일 사업연도 재수집 시 중복 방지")는 natural key 가 만족시킨다.

### 1-4. 감사의견을 정규화값과 원문으로 나눴다

`firm_audit_opinion.adt_opinion` 은 `적정/한정/부적정/의견거절` CHECK 이 걸린 정규화값이고,
DART 원문은 `adt_opinion_raw` 에 그대로 남긴다. 정규화 규칙이 바뀌어도 재수집 없이
다시 파싱할 수 있어야 하기 때문이다.

### 1-5. `firm_review` 에 운영용 컬럼을 더했다

PRD §8 의 "신고 n건 이상 시 관리자 검토", "관리자만 숨김 처리"를 담으려면 필드가 필요하다.

- `is_hidden` — 관리자 숨김. 공개 SELECT 정책과 모든 뷰 집계에서 제외된다.
- `report_count` — 신고 누적 수

또 `employment_type` 과 `leave_year` 의 정합성을 CHECK 로 강제했다.
현직이면 `leave_year IS NULL`, 전직이면 `leave_year >= join_year`.

---

## 2. RLS 정책

기존 `supabase-rls.md` STEP 2 의 규칙을 그대로 따른다 — **쓰기 정책은 만들지 않는다.**
적재 배치도, 사용자 쓰기(구독·챗봇·리뷰)도 서버에서 `service_role` 로만 수행한다.
`service_role` 은 RLS 를 우회하므로 정책이 없어도 동작하고, 클라이언트는 anon/authenticated
역할이라 정책이 없으면 쓰기가 막힌다.

| 테이블 | SELECT |
|---|---|
| 공시 8종 (`firm_registered` … `firm_workforce_yearly`) | `anon`, `authenticated` 전체 허용 |
| `firm_subscription` | 본인 행 (`auth.uid() = user_id`) |
| `firm_chat_message` | 본인 행 |
| `firm_review` | 숨김 아닌 행은 전체 공개 + 숨김 행은 작성자 본인 |

`auth.uid()` 는 `(select auth.uid())` 로 감쌌다 — 행마다 재평가되지 않게 하는 기존 관례다.

뷰 5종은 전부 `security_invoker = true` 다. 뷰가 호출자 권한으로 실행되므로 기반 테이블의
RLS 가 그대로 적용되고, 뷰를 RLS 우회 통로로 쓸 수 없다.

---

## 3. 검증

### 3-1. 반복 실행 가능한 뷰 검증 (M2)

`supabase/verification/verify_firm_views.sql` 을 Supabase SQL Editor 에 붙여넣고 Run 한다.
전체가 한 트랜잭션이고 마지막이 ROLLBACK 이라 데이터는 남지 않으며, 어긋난 값이 하나라도
있으면 그 자리에서 예외를 던진다. 성공하면 NOTICE 로 `뷰 검증 통과` 가 찍힌다.

뷰의 집계는 데이터가 없으면 0행이라 "쿼리가 돌아간다"는 것만으로는 아무것도 증명하지
못한다. 그래서 값을 넣어 확인한다.

| 확인하는 것 | 왜 |
|---|---|
| `data_status <> 'ok'` 행이 `avg_client_revenue` 에서 빠지는가 | 금융사 결측이 섞이면 평균이 통째로 왜곡된다 |
| 1인당 매출·급여, 이사 대비 직원, 감사부문 비중 | PRD §4.2-C 파생 지표의 분자·분모 |
| 분모가 없을 때 0 이 아니라 NULL 인가 | 0 을 주면 "1인당 매출 0원"이라는 거짓말이 된다 |
| 고객사 없는 법인이 연도 축에 남는가 | 자체 지표만 있는 법인이 사라지면 안 된다 |
| 용역 없는 engagement 행이 사라지지 않는가 | LEFT JOIN 이 INNER 로 바뀌는 회귀를 잡는다 |
| 감사 이력 첫 연도가 `false` 가 아니라 `NULL` 인가 | 첫 기록은 "변동 없음"이 아니라 "비교 대상 없음"이다 |
| 숨김 리뷰가 집계와 `recent_reviews` 에서 빠지는가 | 관리자 숨김이 뚫리면 안 된다 |
| `recent_reviews` 에 `user_id` 가 없는가 | 익명성 |

어서션에 이빨이 있는지도 역대조했다. 결측 행의 `data_status` 를 `ok` 로 바꿔 넣으면
평균이 1000 → 5499.5 로 바뀌어 검증이 실패한다.

### 3-2. 최초 적용 결과 (2026-09-07)

- 테이블 11개 · 뷰 5개 · 정책 11개 생성, RLS 미적용 테이블 0개, `security_invoker` 미설정 뷰 0개
- 임시 데이터를 넣어 뷰 집계를 대조하고 되돌렸다. 확인한 것:
  - `data_status <> 'ok'` 인 금융사 행이 `avg_client_revenue` 평균에서 빠진다
  - `avg_kam_count`, `revenue_per_employee`, `salary_per_employee`,
    `employee_per_director`, `audit_revenue_ratio` 가 손계산과 일치
  - `v_firm_company_audit_history` 의 첫 연도는 `auditor_changed = NULL`,
    감사인이 바뀐 연도는 `true`
  - `firm_engagement` 삭제 시 의견·재무·용역이 CASCADE 로 함께 지워진다
- Supabase security advisor: `firm_*` 관련 신규 지적 없음
  (`firm_subscription`·`firm_chat_message` 의 `auth_allow_anonymous_sign_ins` WARN 은
  `to authenticated` 정책 전부에 붙는 것으로, 기존 `cta_*`·`user_cpa` 와 같은 등급이다.
  정책 조건이 `auth.uid() = user_id` 라 익명 로그인 사용자도 자기 행만 본다.)

---

## 4. 남은 판단거리

1. **등록회계법인 마스터가 부분 시드다.** 법인명 14곳만 넣었고 `registration_no` ·
   `tier` · `dart_corp_code` 는 전부 NULL 이다. 확인되지 않은 등록번호를 지어내지
   않으려고 비워 뒀다. M1 수집기가 금감원 등록회계법인 목록과 DART `corpCode.xml` 로
   백필해야 하며, 그때 **법인명 자체도 대조**해야 한다.

2. **`firm_review.user_id` 가 공개 조회에 노출된다.** PRD §8 이 "전체 읽기 허용"이라
   테이블 단위로 열었기 때문이다. 실명·이메일은 담지 않지만, 같은 작성자가 쓴 리뷰끼리
   묶이는 것은 드러난다. M6 에서 익명성을 더 조이려면 공개 읽기를 `user_id` 없는
   뷰로 옮기고 테이블 정책은 본인 행으로 좁히면 된다.

3. **`tier` CHECK 이 `가군`/`나군` 두 값이다.** 실제 구분 체계가 다르면 CHECK 을 고쳐야 한다.

4. **평점 항목은 PRD §13-4 대로 미확정이다.** 지금 CHECK 에 박힌 6개 항목·1-5 척도와
   5개 직급(`intern`/`staff`/`senior`/`manager`/`above`)은 M6 착수 전에 다시 본다.
