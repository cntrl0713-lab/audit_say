# 회계법인 리서치 플랫폼 — 스키마 설계 기록

> 대상: `docs/PLAN_PRD_v2.md` §6·§7·§8 의 구현본
> 정본 SQL: `supabase/migrations/20260907000001_firm_platform_schema.sql`, `..._views.sql`, `..._seed.sql`
> 현재 이름 전환: `supabase/migrations/20260908003002_cpa_table_prefix.sql`. 기존 마이그레이션은 역사적 이름을 보존하고 새 마이그레이션을 순서대로 적용한다.
> 적용 대상 Supabase 프로젝트: `CTA_tax_law` (`xvifzicrjmbfqaepcfpp`)

---

## 1. PRD 와 달라진 점

### 1-1. 프로젝트 테이블을 `cpa_` 접두어로 통일했다

이 Supabase 프로젝트의 `public` 스키마는 **두 앱이 공유**한다.

| 접두어 | 앱 |
|---|---|
| `cta_*` | 세법학 |
| `cpa_*` | audit_say 학습·회계법인 리서치 |

PRD 가 적은 `company` · `users` · `subscriptions` · `chat_messages` 같은 무접두어 이름을
그대로 쓰면 이 규약이 깨지고, 특히 `users` 와 `subscriptions` 는 이미 있는
`cta_user` · `cta_subscription` · `cpa_users` 와 의미가 겹쳐 나중에 어느 앱 것인지
분간이 안 된다. 그래서 리서치 플랫폼 테이블은 전부 `cpa_firm_*` 로 뒀다.

| PRD §6 | 실제 테이블 |
|---|---|
| `registered_firm` | `cpa_firm_registered` |
| `company` | `cpa_firm_company` |
| `engagement` | `cpa_firm_engagement` |
| `audit_opinion` | `cpa_firm_audit_opinion` |
| `financials` | `cpa_firm_financials` |
| `service_contracts` | `cpa_firm_service_contract` |
| `firm_profile_yearly` | `cpa_firm_profile_yearly` |
| `firm_workforce_yearly` | `cpa_firm_workforce_yearly` |
| `users` | **만들지 않음 — `cpa_users` 재사용** |
| `subscriptions` | `cpa_firm_subscription` |
| `chat_messages` | `cpa_firm_chat_message` |
| `firm_reviews` | `cpa_firm_review` |

뷰도 `v_firm_` 으로 통일했다. PRD 의 `v_company_audit_history` 만
`v_firm_company_audit_history` 로 이름이 바뀌었고 나머지 4개는 PRD 이름 그대로다.

2026-09-08 변경은 물리 테이블 `user_cpa`→`cpa_users`, `firm_*` 26개→`cpa_firm_*`다. 기존 배포본을 위한 이전 이름은 `security_invoker=true` 호환 뷰로 유지한다. 데이터 사본이 아니며 원본 테이블의 RLS가 적용된다. `v_firm_*` 조회 뷰와 RPC 이름·수집 payload의 `firm_*` 키는 공개 호출 계약이므로 유지한다. 새 코드의 테이블 조회는 `cpa_*`를 사용한다. [전환 기록](cpa-table-prefix.md)을 함께 참조한다.

### 1-2. `users` 테이블을 새로 만들지 않았다

audit_say 는 이미 `public.cpa_users` 가 `auth.users(id)` 를 참조하며 role 을 들고 있다.
같은 사이트의 같은 계정이므로 계정 테이블을 하나 더 만들 이유가 없다.
`cpa_firm_subscription` · `cpa_firm_chat_message` · `cpa_firm_review` 는 `auth.users(id)` 를 직접
참조하고, 역할이 필요하면 `cpa_users.role` 을 본다.

### 1-3. `engagement.rcept_no` 를 UNIQUE 로 두지 않았다

PRD 는 `rcept_no` 를 UK 로 적었지만, **공동감사(joint audit)** 면 한 접수번호 아래에
감사인이 둘 이상 잡힌다. UNIQUE 를 걸면 두 번째 법인 적재가 조용히 실패한다.

- 중복 방지 키: `firm_engagement_natural_key unique (firm_id, corp_code, bsns_year)`
- `rcept_no` 는 출처 추적용 일반 인덱스

비기능 요구(§11 "동일 사업연도 재수집 시 중복 방지")는 natural key 가 만족시킨다.

### 1-4. 감사의견을 정규화값과 원문으로 나눴다

`cpa_firm_audit_opinion.adt_opinion` 은 `적정/한정/부적정/의견거절` CHECK 이 걸린 정규화값이고,
DART 원문은 `adt_opinion_raw` 에 그대로 남긴다. 정규화 규칙이 바뀌어도 재수집 없이
다시 파싱할 수 있어야 하기 때문이다.

### 1-5. `cpa_firm_review` 에 운영용 컬럼을 더했다

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
| 공시 8종 (`cpa_firm_registered` … `cpa_firm_workforce_yearly`) | `anon`, `authenticated` 전체 허용 |
| `cpa_firm_subscription` | 본인 행 (`auth.uid() = user_id`) |
| `cpa_firm_chat_message` | 본인 행 |
| `cpa_firm_review` | 숨김 아닌 행은 전체 공개 + 숨김 행은 작성자 본인 |

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
  - `cpa_firm_engagement` 삭제 시 의견·재무·용역이 CASCADE 로 함께 지워진다
- Supabase security advisor: `cpa_firm_*` 관련 신규 지적 없음
  (`cpa_firm_subscription`·`cpa_firm_chat_message` 의 `auth_allow_anonymous_sign_ins` WARN 은
  `to authenticated` 정책 전부에 붙는 것으로, 기존 `cta_*`·`cpa_users` 와 같은 등급이다.
  정책 조건이 `auth.uid() = user_id` 라 익명 로그인 사용자도 자기 행만 본다.)

---

## 4. 남은 판단거리

> **2026-09-08 F004 구현 상태 갱신**: 아래 M0의 28곳 기록은 과거 상태다. P0 후 운영 마스터는
> 최초 63곳에서 F004 발견 모집단 266곳을 보강해 운영 마스터는 269곳이다(조회 범위 내 F004가 없는 기존 3곳 포함).
> 기본 F004와 2026 확장 마이그레이션을 적용했다. 현행 지원 범위와 실행 방법은
> [수집기 안내](../scripts/firm_collector/README.md)를 참조한다. F004 제출 여부를 상장사 감사인 등록으로 해석하지 않는다.

1. **등록회계법인 마스터가 아직 부분적이다.** 현재 28곳이며 가군 4곳만 군이
   확정돼 있다. `registration_no` 와 `dart_corp_code` 는 전부 NULL 이다 — 확인되지 않은
   등록번호를 지어내지 않으려고 비워 뒀고, DART 코드는 M1 수집기가 `corpCode.xml` 로
   백필한다.

   출처 문서 기준 2025년 8월말 등록법인은 39곳(가4·나16·다19)인데 마스터에는 28곳뿐이다.
   문서의 나군·다군 명단이 2019년 도입 당시 **"예시"**여서 전수가 아니기 때문이다.
   **모자란 곳은 M1 수집 보고서의 `unmatchedAuditors` 로 드러난다** — 마스터에 없는
   감사인이 나오면 그 이름이 보고서에 남으므로, 그것으로 역추적해 채우는 것이 순서다.

   또 `성현회계법인` 은 M0 에서 내가 넣은 것이고 출처 문서의 예시 명단에는 없다.
   명단이 전수가 아니라 부재가 곧 미등록을 뜻하지는 않지만, **검증되지 않은 행**이라는
   점은 기록해 둔다. 수집 결과 한 번도 감사인으로 나오지 않으면 지운다.

2. **`cpa_firm_review.user_id` 가 공개 조회에 노출된다.** PRD §8 이 "전체 읽기 허용"이라
   테이블 단위로 열었기 때문이다. 실명·이메일은 담지 않지만, 같은 작성자가 쓴 리뷰끼리
   묶이는 것은 드러난다. M6 에서 익명성을 더 조이려면 공개 읽기를 `user_id` 없는
   뷰로 옮기고 테이블 정책은 본인 행으로 좁히면 된다.

3. **`tier` CHECK 은 가·나·다·라 4개 군이다** (2026-09-08 보정,
   `20260908000001_firm_tier_and_master.sql`). M0 에서는 PRD §6.2 를 따라 `가군`/`나군`
   두 값만 걸었는데, 감사인 등록제의 실제 체계는 4개 군이라 다군·라군을 넣을 수 없었다.
   가군 4곳만 확정돼 있고 나머지 24곳은 `tier IS NULL` 이다 — 출처 문서가 법인별 군
   매핑을 담고 있지 않다(중견/중형/소형은 군 구분이 아니다).

   > **2026-07 외부감사규정 개정의 "특례가군"은 아직 모델에 없다.** 감사품질 평가가
   > 우수한 나군 법인에게 대형 상장사 수임을 허용하는 제도인데, 별도 군 라벨인지
   > 나군에 붙는 자격인지 확인되지 않아 넣지 않았다. 필요해지면 `tier` 값을 늘리기보다
   > 별도 불리언으로 두는 편이 맞다 — 소속 회계사 수 기준의 군과 성격이 다르다.

4. **평점 항목은 PRD §13-4 대로 미확정이다.** 지금 CHECK 에 박힌 6개 항목·1-5 척도와
   5개 직급(`intern`/`staff`/`senior`/`manager`/`above`)은 M6 착수 전에 다시 본다.

## 5. F004 회계법인 사업보고서 확장

정본 SQL: `supabase/migrations/20260908000002_firm_annual_reports.sql`.
지원 범위와 실행 방법: [수집기 안내](../scripts/firm_collector/README.md).

| 신규 테이블 | 용도 | 조회 |
|---|---|---|
| cpa_firm_personnel_cost_yearly | 임직원·품질관리 비용, 표/계정 매칭 방법 | 공개 |
| cpa_firm_income_statement_line | 손익 원문 계정 순서·금액 | 공개 |
| cpa_firm_audit_record_yearly | 시장·개별/연결 감사실적 | 공개 |
| cpa_firm_audit_client | 연결 지배회사 명단·종속회사 수·의견 | 공개 |
| cpa_firm_cpa_tenure_yearly | 부문별 등록회계사 경력, 총 이동 인원 | 공개 |
| cpa_firm_audit_input_yearly | 경력 구간별 감사 인력·시간 | 공개 |
| cpa_firm_quality_staff | 품질관리 조직·인력 | 공개 |
| cpa_firm_inspection_result | 감사보고서/감사인 감리 서술 | 공개 |
| cpa_firm_director_discipline | 성명 제외 징계 사항 | 공개 |
| cpa_firm_certification_yearly | 전문자격증별 인원 | 공개 |
| cpa_firm_director_profile_yearly | 사원·이사 경력 집계, 소규모 통계 억제 | 공개 |
| cpa_firm_director | 사원·이사 실명·경력·출자비율 | 관리자 |
| cpa_firm_director_pay | 사용자 추가 지시에 따른 실명/마스킹 보수 | 관리자 |
| cpa_firm_annual_form_cell | 허용된 집계 표의 전 칸·전기·전전기 원문 | 공개 |
| cpa_firm_annual_collection | 채택 공시·파서 버전·해시·검토 신호 | 공개 |

기존 프로필/인력에는 `fy_start_date`, `fy_end_date`, `fy_seq`, `source_rcept_dt`를 추가한다.
프로필은 `revenue_other`, 인력은 `employee_other`, `director_pay_total`, `director_pay_count`를 추가한다.
마스터에는 `acc_mt`, `induty_code`를 추가하며 등록번호·군은 추정하지 않는다.

모든 신규 테이블은 RLS 활성화. 개인 명세 두 테이블에는 SELECT 정책이 없어
anon/authenticated는 0행이며 service_role만 읽고 쓴다. 관리자 서버는 `assertAdmin()`을 거친다.
기존 `queries.ts`는 개인 명세를 조회하지 않으며 `adminQueries.ts`를 별도로 둔다.

`replace_firm_annual_report`는 service_role만 실행한다. 표 전체 교체가 한 트랜잭션이며
부분 실패 시 기존 행이 유지된다. 같은 법인/연도의 더 오래된 접수 공시와 다른 결산일은 거부한다.
자연키가 없는 상세 행도 교체되므로 정정 후 줄어든 행이 잔존하지 않는다.

`v_firm_summary`는 고객사 사업연도만 집계하고 기존 자체 지표 컬럼은 호환성을 위해 NULL을 반환한다.
자체 지표는 `v_firm_annual_summary`로 옮기고 결산일이 같은 프로필·인력만 조인한다.
고객사 미확보를 고객사 0곳으로 만들지 않으며, 고객사가 없는 법인도 마스터 검색과 자체 정보 탭에 접근할 수 있다.

사용자 지시에 따라 접수 조회는 실행 당일까지 확대했다. 적재 대상 결산연도는 2024·2025·2026이며 서식 1.8·6.0을 지원한다.
현대 2024는 사용자 지시에 따라 제20기(3개월)를 제외하고 제19기를 저장한다. 제외 근거는 수집 보고서에 보존한다.
그 밖의 복수 결산기는 기존 연도 키에서 여전히 보류하며 자동 합산하지 않는다.

### 실적 분석 기준연도 — 2026-09-08 후속 결정

회계법인 자체 지표는 `v_firm_annual_summary.fy_start_year`(보고기간 시작연도)로 분석·표시한다.
`fy_start_date`에서 직접 계산하며 종료연도에서 1을 빼지 않는다. 기존 테이블의 `bsns_year`는
원문 명세 조인용 결산말 연도 키로 보존한다. 같은 시작연도의 복수 기수는 실제 시작일·종료일로 구분하고
같은 연도의 한 행으로 합산하지 않는다. 기존 721보고기간은 그대로 유지된다.
현대 제19기: 2023년 시작 실적, 제21기: 2024년 시작 실적. 제20기는 사용자 결정대로 제외한다.
고객사 `bsns_year`의 의미는 바꾸지 않으며, 실제 감사대상 연도를 회계법인 시작연도와 같다고 추정하지 않는다.
F004 제출 자체는 상장회사 감사인 등록 확인이 아니며, 연결 명단이 개별감사 전수 명단도 아니다.
