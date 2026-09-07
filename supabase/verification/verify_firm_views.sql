-- audit_say v2 — 조회 뷰·파생 지표 검증 (M2)
--
-- 전체가 하나의 트랜잭션이고 마지막이 ROLLBACK 이라 실제 데이터는 남지 않는다.
-- 어긋난 값이 하나라도 있으면 그 자리에서 예외를 던지고 멈춘다.
--
-- 실행: Supabase SQL Editor 에 그대로 붙여넣고 Run.
--       성공하면 NOTICE 로 "뷰 검증 통과" 가 찍힌다.
--
-- 왜 필요한가: 뷰의 집계는 데이터가 없으면 0행이라 "돌아간다"는 것만으로는
-- 아무것도 증명하지 못한다. 금융사 결측 행이 평균에서 빠지는지, 1인당 지표의
-- 분모가 맞는지, 감사인 교체 첫 연도가 false 가 아니라 NULL 인지는 값을 넣어 봐야 안다.

begin;

do $$
declare
  firm_a      bigint;  -- 고객사 2곳 + 자체 인력·재무가 있는 법인
  firm_b      bigint;  -- 고객사 1곳, 이듬해 firm_a 의 고객사를 넘겨받는다
  firm_c      bigint;  -- 고객사 없이 자체 지표만 있는 법인
  eng_a1      bigint;
  eng_a2      bigint;
  eng_b1      bigint;
  eng_b2      bigint;
  user_1      uuid;
  user_2      uuid;
  r           record;
  expected    numeric;
  actual      numeric;

  procedure_note text;
begin
  -- 실제 법인에 테스트 실적을 섞으면 기존 데이터 때문에 검사가 실패한다.
  -- 독립된 임시 법인을 생성하고 마지막 ROLLBACK으로 제거한다.
  insert into public.firm_registered(firm_name) values('VERIFY_법인A_' || txid_current()) returning firm_id into firm_a;
  insert into public.firm_registered(firm_name) values('VERIFY_법인B_' || txid_current()) returning firm_id into firm_b;
  insert into public.firm_registered(firm_name) values('VERIFY_법인C_' || txid_current()) returning firm_id into firm_c;

  -- ── 회사 ──────────────────────────────────────────────────────────────────
  insert into public.firm_company (corp_code, corp_name, corp_cls, stock_code, listed_yn, induty) values
    ('99999801', 'VERIFY상장제조', 'Y', '000801', true,  '제조'),
    ('99999802', 'VERIFY비상장',   'E', null,    false, '도매'),
    ('99999803', 'VERIFY코스닥',   'K', '000803', true,  '소프트웨어');

  -- ── 2024: firm_a 가 2곳, firm_b 가 1곳 ────────────────────────────────────
  insert into public.firm_engagement (firm_id, corp_code, bsns_year, rcept_no)
  values (firm_a, '99999801', 2024, 'VERIFY0001') returning engagement_id into eng_a1;

  insert into public.firm_engagement (firm_id, corp_code, bsns_year, rcept_no)
  values (firm_a, '99999802', 2024, 'VERIFY0002') returning engagement_id into eng_a2;

  insert into public.firm_engagement (firm_id, corp_code, bsns_year, rcept_no)
  values (firm_b, '99999803', 2024, 'VERIFY0003') returning engagement_id into eng_b1;

  -- 2025: 99999801 의 감사인이 firm_a → firm_b 로 바뀐다
  insert into public.firm_engagement (firm_id, corp_code, bsns_year, rcept_no)
  values (firm_b, '99999801', 2025, 'VERIFY0004') returning engagement_id into eng_b2;

  insert into public.firm_audit_opinion (engagement_id, adt_opinion, adt_opinion_raw, kam_text, emph_matter, kam_count) values
    (eng_a1, '적정',     '적정',     'KAM 1',  '계속기업 불확실성', 2),
    (eng_a2, '한정',     '한정의견', 'KAM 2',  null,                3),
    (eng_b1, '부적정',   '부적정',   'KAM 3',  null,                1),
    (eng_b2, '의견거절', '의견거절', 'KAM 4',  null,                4);

  -- 99999802 는 금융사 결측이라 평균 계산에서 빠져야 한다 (9999 가 섞이면 실패)
  insert into public.firm_financials (engagement_id, revenue, operating_profit, net_income, fs_div, fallback_yn, data_status) values
    (eng_a1, 1000, 100, 50, 'CFS', false, 'ok'),
    (eng_a2, 9999, 999, 99, 'OFS', true,  'financial_corp'),
    (eng_b1, 2000, 200, 80, 'CFS', false, 'ok');

  insert into public.firm_service_contract (engagement_id, contract_type, service_fee, service_content) values
    (eng_a1, 'audit',    700, '감사'),
    (eng_a1, 'nonaudit', 300, '세무자문'),
    (eng_a1, 'nonaudit', 200, '실사');

  insert into public.firm_profile_yearly (firm_id, bsns_year, revenue_total, revenue_audit, operating_income, net_income) values
    (firm_a, 2024, 1000000, 600000, 120000, 90000),
    (firm_c, 2024,  500000, 400000,  60000, 40000);   -- 고객사 없이 자체 지표만

  insert into public.firm_workforce_yearly (firm_id, bsns_year, director_count, employee_total, salary_total) values
    (firm_a, 2024, 10, 100, 5000000), (firm_c, 2024, null, null, null);

  update public.firm_profile_yearly set fy_end_date='2024-06-30',fy_start_date='2023-07-01' where firm_id in (firm_a,firm_c);
  update public.firm_workforce_yearly set fy_end_date='2024-06-30',fy_start_date='2023-07-01' where firm_id in (firm_a,firm_c);
  insert into public.firm_annual_collection(firm_id,bsns_year,fy_end_date,source_rcept_no,source_rcept_dt,parser_version,payload_hash) values
    (firm_a,2024,'2024-06-30','VERIFY1','2024-09-30','verification','verification'),
    (firm_c,2024,'2024-06-30','VERIFY2','2024-09-30','verification','verification');

  -- ══ v_firm_summary ════════════════════════════════════════════════════════
  select * into r from public.v_firm_summary where firm_id = firm_a and bsns_year = 2024;

  if r.client_count <> 2 then
    raise exception 'v_firm_summary.client_count: 기대 2, 실제 %', r.client_count;
  end if;
  if r.listed_client_count <> 1 or r.unlisted_client_count <> 1 then
    raise exception 'v_firm_summary 상장/비상장: 기대 1/1, 실제 %/%', r.listed_client_count, r.unlisted_client_count;
  end if;

  -- 금융사 결측 행(9999)이 섞였으면 5499.5 가 나온다
  if r.avg_client_revenue <> 1000 then
    raise exception 'v_firm_summary.avg_client_revenue: data_status<>ok 행이 평균에 섞였습니다. 기대 1000, 실제 %', r.avg_client_revenue;
  end if;

  if r.opinion_unqualified_count <> 1 or r.opinion_qualified_count <> 1
     or r.opinion_adverse_count <> 0 or r.opinion_disclaimer_count <> 0 then
    raise exception 'v_firm_summary 의견 분포가 어긋납니다: 적정 % 한정 % 부적정 % 거절 %',
      r.opinion_unqualified_count, r.opinion_qualified_count, r.opinion_adverse_count, r.opinion_disclaimer_count;
  end if;
  if r.opinion_modified_count <> 1 then
    raise exception 'v_firm_summary.opinion_modified_count: 기대 1, 실제 %', r.opinion_modified_count;
  end if;
  if r.avg_kam_count <> 2.5 then
    raise exception 'v_firm_summary.avg_kam_count: 기대 2.5, 실제 %', r.avg_kam_count;
  end if;

  -- 자체 지표를 고객사 사업연도에 조인하지 않는다.
  if r.revenue_per_employee is not null then raise exception '고객사 뷰에 법인 결산 지표가 섞였습니다'; end if;
  select * into r from public.v_firm_annual_summary where firm_id=firm_a and bsns_year=2024;
  if r.revenue_per_employee is distinct from 10000::numeric then      -- 1,000,000 / 100
    raise exception '1인당 매출: 기대 10000, 실제 %', r.revenue_per_employee;
  end if;
  if r.salary_per_employee is distinct from 50000::numeric then       -- 5,000,000 / 100
    raise exception '1인당 급여: 기대 50000, 실제 %', r.salary_per_employee;
  end if;
  if r.employee_per_director is distinct from 10::numeric then        -- 100 / 10
    raise exception '이사 대비 직원: 기대 10, 실제 %', r.employee_per_director;
  end if;
  if r.audit_revenue_ratio is distinct from 0.6::numeric then         -- 600,000 / 1,000,000
    raise exception '감사부문 매출 비중: 기대 0.6, 실제 %', r.audit_revenue_ratio;
  end if;

  -- 고객사 미확보 법인은 자체 지표 뷰에만 나타난다.
  if exists(select 1 from public.v_firm_summary where firm_id=firm_c) then raise exception '고객사 미확보가 0곳으로 노출됐습니다'; end if;
  select * into r from public.v_firm_annual_summary where firm_id = firm_c and bsns_year = 2024;
  if r.audit_revenue_ratio is distinct from 0.8::numeric then
    raise exception 'v_firm_annual_summary: 고객사 없는 법인의 파생 지표가 어긋납니다 (기대 0.8, 실제 %)', r.audit_revenue_ratio;
  end if;

  -- 분모가 없으면 0 이 아니라 NULL 이어야 한다 (0 으로 나누면 터지고, 0 을 주면 거짓말이다)
  if r.revenue_per_employee is not null then
    raise exception 'v_firm_summary: 인력 데이터가 없는데 1인당 매출이 % 로 나옵니다', r.revenue_per_employee;
  end if;

  -- ══ v_firm_clients ════════════════════════════════════════════════════════
  select * into r from public.v_firm_clients where engagement_id = eng_a1;

  if r.market <> '유가증권' then
    raise exception 'v_firm_clients.market: 기대 유가증권, 실제 %', r.market;
  end if;
  if r.audit_fee_total <> 700 then
    raise exception 'v_firm_clients.audit_fee_total: 기대 700, 실제 %', r.audit_fee_total;
  end if;
  if r.nonaudit_fee_total <> 500 then
    raise exception 'v_firm_clients.nonaudit_fee_total: 비감사 2건 합산 기대 500, 실제 %', r.nonaudit_fee_total;
  end if;
  if r.nonaudit_contract_count <> 2 then
    raise exception 'v_firm_clients.nonaudit_contract_count: 기대 2, 실제 %', r.nonaudit_contract_count;
  end if;

  -- 용역이 없는 engagement 도 행이 사라지면 안 된다 (LEFT JOIN 확인)
  select * into r from public.v_firm_clients where engagement_id = eng_a2;
  if r is null then
    raise exception 'v_firm_clients: 용역 없는 engagement 행이 사라졌습니다.';
  end if;
  if r.nonaudit_contract_count <> 0 then
    raise exception 'v_firm_clients: 용역 없는 행의 계약 수는 0 이어야 하는데 % 입니다', r.nonaudit_contract_count;
  end if;

  select count(*) into actual from public.v_firm_clients where firm_id = firm_a and bsns_year = 2024;
  if actual <> 2 then
    raise exception 'v_firm_clients: firm_a 2024 고객사 기대 2, 실제 %', actual;
  end if;

  -- ══ v_firm_kam ════════════════════════════════════════════════════════════
  select count(*) into actual from public.v_firm_kam where firm_id = firm_a and bsns_year = 2024;
  if actual <> 2 then
    raise exception 'v_firm_kam: firm_a 2024 기대 2건, 실제 %', actual;
  end if;

  -- ══ v_firm_company_audit_history ══════════════════════════════════════════
  select * into r from public.v_firm_company_audit_history
   where corp_code = '99999801' and bsns_year = 2024;

  -- 첫 연도는 비교 대상이 없으므로 false 가 아니라 NULL 이어야 한다
  if r.auditor_changed is not null then
    raise exception '감사 이력 첫 연도의 auditor_changed 는 NULL 이어야 하는데 % 입니다', r.auditor_changed;
  end if;
  if r.opinion_changed is not null then
    raise exception '감사 이력 첫 연도의 opinion_changed 는 NULL 이어야 하는데 % 입니다', r.opinion_changed;
  end if;

  select * into r from public.v_firm_company_audit_history
   where corp_code = '99999801' and bsns_year = 2025;

  if r.auditor_changed is not true then
    raise exception '감사인이 바뀐 연도의 auditor_changed 가 % 입니다', r.auditor_changed;
  end if;
  if r.prev_firm_name is distinct from (select firm_name from public.firm_registered where firm_id=firm_a) then
    raise exception 'prev_firm_name: 기대 임시 법인A, 실제 %', r.prev_firm_name;
  end if;
  if r.opinion_changed is not true then
    raise exception '의견이 바뀐 연도의 opinion_changed 가 % 입니다', r.opinion_changed;
  end if;

  -- ══ v_firm_reviews_summary ════════════════════════════════════════════════
  select id into user_1 from auth.users order by created_at limit 1;
  select id into user_2 from auth.users order by created_at offset 1 limit 1;

  if user_1 is null or user_2 is null then
    procedure_note := '  (auth.users 가 2명 미만이라 평점 뷰 검증은 건너뜀)';
  else
    insert into public.firm_review
      (firm_id, user_id, employment_type, position, join_year, leave_year,
       score_wlb, score_growth, score_pay, score_culture, score_workload, score_overall,
       review_text, is_verified, is_hidden)
    values
      (firm_a, user_1, 'current', 'senior',  2020, null, 4, 5, 3, 4, 2, 4, '후기 1', true,  false),
      (firm_a, user_2, 'former',  'manager', 2015, 2022, 2, 3, 5, 2, 4, 3, '후기 2', false, false);

    select * into r from public.v_firm_reviews_summary where firm_id = firm_a;

    if r.review_count <> 2 then
      raise exception 'v_firm_reviews_summary.review_count: 기대 2, 실제 %', r.review_count;
    end if;
    if r.verified_review_count <> 1 then
      raise exception 'v_firm_reviews_summary.verified_review_count: 기대 1, 실제 %', r.verified_review_count;
    end if;
    if r.avg_score_overall <> 3.50 then
      raise exception 'v_firm_reviews_summary.avg_score_overall: 기대 3.50, 실제 %', r.avg_score_overall;
    end if;
    if r.position_distribution -> 'senior' <> to_jsonb(1) then
      raise exception '직급 분포가 어긋납니다: %', r.position_distribution;
    end if;
    if jsonb_array_length(r.recent_reviews) <> 2 then
      raise exception 'recent_reviews 길이: 기대 2, 실제 %', jsonb_array_length(r.recent_reviews);
    end if;
    -- 최근 후기에 작성자 식별자가 실려 나가면 익명성이 깨진다
    if r.recent_reviews -> 0 ? 'user_id' then
      raise exception 'recent_reviews 에 user_id 가 노출됩니다.';
    end if;

    -- 숨김 처리한 리뷰는 집계에서 빠져야 한다
    update public.firm_review set is_hidden = true where firm_id = firm_a and user_id = user_2;
    select * into r from public.v_firm_reviews_summary where firm_id = firm_a;
    if r.review_count <> 1 then
      raise exception '숨김 리뷰가 집계에 남아 있습니다: review_count %', r.review_count;
    end if;
    if r.avg_score_overall <> 4.00 then
      raise exception '숨김 리뷰 제외 후 평균: 기대 4.00, 실제 %', r.avg_score_overall;
    end if;

    procedure_note := '  (평점 뷰 포함)';
  end if;

  -- ══ 리뷰가 없는 법인도 목록에서 빠지면 안 된다 ════════════════════════════
  select * into r from public.v_firm_reviews_summary where firm_id = firm_b;
  if r is null then
    raise exception 'v_firm_reviews_summary: 리뷰 없는 법인이 목록에서 사라졌습니다.';
  end if;
  if r.review_count <> 0 then
    raise exception 'v_firm_reviews_summary: 리뷰 0건인데 review_count 가 % 입니다', r.review_count;
  end if;

  raise notice '뷰 검증 통과 — v_firm_summary · v_firm_clients · v_firm_kam · v_firm_company_audit_history · v_firm_reviews_summary%', procedure_note;
end $$;

-- 검증용 데이터는 남기지 않는다
rollback;
