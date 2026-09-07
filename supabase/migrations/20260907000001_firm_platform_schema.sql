-- audit_say v2 — 회계법인 리서치 플랫폼 스키마 (M0)
-- 근거 문서: docs/PLAN_PRD_v2.md §6, docs/firm-platform-schema.md
--
-- 네임스페이스 규칙
--   이 Supabase 프로젝트(CTA_tax_law)는 두 앱이 같은 public 스키마를 공유한다.
--     cta_*        세법학
--     cpa_*/user_cpa  audit_say 채점 시스템
--   그래서 PRD가 적은 무접두어 이름(company·users·subscriptions·chat_messages 등)을
--   그대로 쓰지 않는다. 리서치 플랫폼 테이블은 전부 firm_* 로 둔다.
--   PRD ↔ 실제 테이블 대조표는 docs/firm-platform-schema.md 에 있다.
--
-- 계정 테이블(PRD §6.3 users)은 새로 만들지 않는다. audit_say는 이미
-- public.user_cpa 가 auth.users 를 참조하며, 같은 사이트의 같은 계정이므로 재사용한다.

begin;

-- ---------------------------------------------------------------------------
-- 1. 공시 도메인 — 배치가 service_role 로 적재하고 누구나 읽는다
-- ---------------------------------------------------------------------------

-- 등록회계법인 마스터
create table if not exists public.firm_registered (
  firm_id          bigint generated always as identity primary key,
  firm_name        text        not null,
  registration_no  text        unique,
  tier             text        check (tier in ('가군', '나군')),
  alias            text[]      not null default '{}',
  status           text        not null default 'active' check (status in ('active', 'closed')),
  dart_corp_code   char(8)     unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint firm_registered_firm_name_key unique (firm_name)
);

comment on table  public.firm_registered is '등록회계법인 마스터. registration_no·tier·dart_corp_code 는 M1 수집기가 금감원/DART 로 백필한다.';
comment on column public.firm_registered.alias is '법인명 변형 대응(예: 삼일 / PwC / Samil). 수집 시 정규화 매칭에 쓴다.';

-- 감사대상회사 마스터
create table if not exists public.firm_company (
  corp_code   char(8) primary key,
  corp_name   text    not null,
  corp_cls    text    check (corp_cls in ('Y', 'K', 'N', 'E')),
  stock_code  text,
  listed_yn   boolean not null default false,
  induty      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on column public.firm_company.corp_cls is 'DART corp_cls. Y=유가증권 K=코스닥 N=코넥스 E=기타(비상장).';

-- 회계법인 × 회사 × 사업연도 허브
create table if not exists public.firm_engagement (
  engagement_id bigint generated always as identity primary key,
  firm_id       bigint   not null references public.firm_registered(firm_id) on delete restrict,
  corp_code     char(8)  not null references public.firm_company(corp_code)  on delete restrict,
  bsns_year     smallint not null check (bsns_year between 1990 and 2100),
  rcept_no      text,
  created_at    timestamptz not null default now(),
  constraint firm_engagement_natural_key unique (firm_id, corp_code, bsns_year)
);

-- rcept_no 는 UNIQUE 로 두지 않는다. 공동감사(joint audit)면 한 접수번호 아래에
-- 감사인이 둘 이상 잡히므로 UNIQUE 를 걸면 두 번째 법인의 적재가 실패한다.
-- 재수집 중복 방지는 firm_engagement_natural_key 가 담당한다.
create index if not exists firm_engagement_rcept_no_idx on public.firm_engagement (rcept_no);
create index if not exists firm_engagement_firm_year_idx on public.firm_engagement (firm_id, bsns_year);
create index if not exists firm_engagement_corp_year_idx on public.firm_engagement (corp_code, bsns_year desc);

comment on column public.firm_engagement.rcept_no is '원천 접수번호. 출처 추적용이며 중복 방지 키가 아니다(공동감사 시 중복 가능).';

-- 감사의견 · KAM
create table if not exists public.firm_audit_opinion (
  opinion_id       bigint generated always as identity primary key,
  engagement_id    bigint not null unique references public.firm_engagement(engagement_id) on delete cascade,
  adt_opinion      text   check (adt_opinion in ('적정', '한정', '부적정', '의견거절')),
  adt_opinion_raw  text,
  emph_matter      text,
  kam_text         text,
  kam_count        smallint check (kam_count >= 0),
  created_at       timestamptz not null default now()
);

comment on column public.firm_audit_opinion.adt_opinion is '정규화된 감사의견. 정규화에 실패하면 NULL 로 두고 원문은 adt_opinion_raw 에 남긴다.';
comment on column public.firm_audit_opinion.adt_opinion_raw is 'DART 원문 그대로. 정규화 규칙이 바뀌어도 재파싱할 수 있게 보존한다.';

-- 재무 3지표
create table if not exists public.firm_financials (
  financial_id     bigint generated always as identity primary key,
  engagement_id    bigint  not null unique references public.firm_engagement(engagement_id) on delete cascade,
  revenue          numeric,
  operating_profit numeric,
  net_income       numeric,
  fs_div           text    check (fs_div in ('CFS', 'OFS')),
  fallback_yn      boolean not null default false,
  data_status      text    not null default 'ok'
                     check (data_status in ('ok', 'missing', 'financial_corp', 'parse_failed')),
  created_at       timestamptz not null default now()
);

comment on column public.firm_financials.fallback_yn is '연결(CFS)이 없어 별도(OFS)로 대체했으면 true. PRD §4.4.';
comment on column public.firm_financials.data_status is 'financial_corp = 금융회사라 3지표 구조가 달라 결측. P2에서 보완한다.';

-- 감사 · 비감사 용역
create table if not exists public.firm_service_contract (
  contract_id     bigint generated always as identity primary key,
  engagement_id   bigint not null references public.firm_engagement(engagement_id) on delete cascade,
  contract_type   text   not null check (contract_type in ('audit', 'nonaudit')),
  contract_date   date,
  service_content text,
  service_period  text,
  service_fee     numeric,
  created_at      timestamptz not null default now()
);

create index if not exists firm_service_contract_engagement_idx
  on public.firm_service_contract (engagement_id, contract_type);

-- 회계법인 연도별 재무 (사업보고서 API)
create table if not exists public.firm_profile_yearly (
  profile_id       bigint generated always as identity primary key,
  firm_id          bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year        smallint not null check (bsns_year between 1990 and 2100),
  revenue_total    numeric,
  revenue_audit    numeric,
  revenue_tax      numeric,
  revenue_advisory numeric,
  operating_income numeric,
  net_income       numeric,
  source_rcept_no  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint firm_profile_yearly_natural_key unique (firm_id, bsns_year)
);

comment on column public.firm_profile_yearly.revenue_audit is '사업부문별 매출. 구조화 API 미지원이면 NULL 이고 P2 원문 파싱으로 채운다. PRD §4.2-B, §13-2.';

-- 회계법인 연도별 인력 (사업보고서 API)
create table if not exists public.firm_workforce_yearly (
  workforce_id      bigint generated always as identity primary key,
  firm_id           bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year         smallint not null check (bsns_year between 1990 and 2100),
  director_count    integer  check (director_count >= 0),
  employee_total    integer  check (employee_total >= 0),
  employee_audit    integer  check (employee_audit >= 0),
  employee_tax      integer  check (employee_tax >= 0),
  employee_advisory integer  check (employee_advisory >= 0),
  salary_total      numeric,
  salary_avg        numeric,
  source_rcept_no   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint firm_workforce_yearly_natural_key unique (firm_id, bsns_year)
);

comment on column public.firm_workforce_yearly.employee_total is '직원 현황 기준 직원 수. 등록회계사 수와 다르다 — 1인당 지표는 이 값을 분모로 쓴다. PRD §4.2-C 참고.';

-- ---------------------------------------------------------------------------
-- 2. 서비스 도메인 — 사용자 활동
-- ---------------------------------------------------------------------------

create table if not exists public.firm_subscription (
  subscription_id bigint generated always as identity primary key,
  user_id         uuid   not null references auth.users(id) on delete cascade,
  firm_id         bigint references public.firm_registered(firm_id) on delete cascade,
  plan            text   not null default 'free'   check (plan   in ('free', 'basic', 'pro')),
  status          text   not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  expires_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint firm_subscription_user_firm_key unique nulls not distinct (user_id, firm_id)
);

comment on column public.firm_subscription.firm_id is 'NULL 이면 법인 지정 없는 전체 구독. UNIQUE NULLS NOT DISTINCT 라서 전체 구독도 1인 1건이다.';

create table if not exists public.firm_chat_message (
  message_id bigint generated always as identity primary key,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  firm_id    bigint references public.firm_registered(firm_id) on delete set null,
  question   text   not null,
  answer     text,
  created_at timestamptz not null default now()
);

create index if not exists firm_chat_message_user_idx on public.firm_chat_message (user_id, created_at desc);

create table if not exists public.firm_review (
  review_id       bigint generated always as identity primary key,
  firm_id         bigint   not null references public.firm_registered(firm_id) on delete cascade,
  user_id         uuid     not null references auth.users(id) on delete cascade,
  employment_type text     not null check (employment_type in ('current', 'former')),
  position        text     not null check (position in ('intern', 'staff', 'senior', 'manager', 'above')),
  join_year       smallint not null check (join_year between 1960 and 2100),
  leave_year      smallint check (leave_year between 1960 and 2100),
  score_wlb       smallint not null check (score_wlb      between 1 and 5),
  score_growth    smallint not null check (score_growth   between 1 and 5),
  score_pay       smallint not null check (score_pay      between 1 and 5),
  score_culture   smallint not null check (score_culture  between 1 and 5),
  score_workload  smallint not null check (score_workload between 1 and 5),
  score_overall   smallint not null check (score_overall  between 1 and 5),
  review_text     text,
  is_verified     boolean  not null default false,
  is_anonymous    boolean  not null default true,
  is_hidden       boolean  not null default false,
  report_count    integer  not null default 0 check (report_count >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- PRD §8: 회원당 법인 1개에 리뷰 1건
  constraint firm_review_user_firm_key unique (firm_id, user_id),
  -- 현직이면 퇴사연도가 없고, 전직이면 있어야 한다
  constraint firm_review_leave_year_ck check (
    (employment_type = 'current' and leave_year is null)
    or (employment_type = 'former' and leave_year is not null and leave_year >= join_year)
  )
);

create index if not exists firm_review_firm_idx on public.firm_review (firm_id) where is_hidden = false;

comment on column public.firm_review.score_workload is '업무 강도 1-5. 낮을수록 과중하다는 뜻이라 다른 항목과 방향이 같다(높을수록 좋음).';
comment on column public.firm_review.is_hidden is '관리자 숨김 처리. 숨김 행은 공개 SELECT 정책에서 제외된다.';
comment on column public.firm_review.user_id is '작성자. 공개 조회 시에도 컬럼 자체는 노출되므로 같은 작성자의 리뷰끼리 상관관계는 드러난다 — 실명·이메일은 담지 않는다. docs/firm-platform-schema.md "남은 판단거리" 참고.';

-- ---------------------------------------------------------------------------
-- 3. RLS
--    쓰기 정책은 만들지 않는다. 적재 배치와 사용자 쓰기 모두 서버에서
--    service_role 로만 수행한다 — supabase-rls.md STEP 2 의 기존 규칙과 같다.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  public_tables text[] := array[
    'firm_registered', 'firm_company', 'firm_engagement', 'firm_audit_opinion',
    'firm_financials', 'firm_service_contract', 'firm_profile_yearly', 'firm_workforce_yearly'
  ];
  private_tables text[] := array['firm_subscription', 'firm_chat_message', 'firm_review'];
begin
  -- 재실행 대비: 이 마이그레이션이 만드는 정책만 걷어낸다
  foreach t in array public_tables || private_tables loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  -- 공시 데이터 8종: 공개 읽기 (PRD §8)
  foreach t in array public_tables loop
    execute format('drop policy if exists %I on public.%I', t || '_select_public', t);
    execute format($f$
      create policy %I on public.%I
        for select to anon, authenticated
        using (true)
    $f$, t || '_select_public', t);
  end loop;
end $$;

-- 구독 · 챗봇 이력: 본인 행만
drop policy if exists firm_subscription_select_own on public.firm_subscription;
create policy firm_subscription_select_own on public.firm_subscription
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists firm_chat_message_select_own on public.firm_chat_message;
create policy firm_chat_message_select_own on public.firm_chat_message
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- 평점: 숨김되지 않은 리뷰는 전체 공개, 숨김 리뷰는 작성자 본인만 (PRD §8)
drop policy if exists firm_review_select_public on public.firm_review;
create policy firm_review_select_public on public.firm_review
  for select to anon, authenticated
  using (is_hidden = false or (select auth.uid()) = user_id);

commit;
