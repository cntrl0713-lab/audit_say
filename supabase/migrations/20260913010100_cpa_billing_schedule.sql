-- Isolated Audit Say billing jobs. Vault cpa_supabase_url / cpa_service_role_key required.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;  -- 스키마 net 을 스스로 만든다

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- Edge Function 호출을 한 곳에 모은다. cron 잡 본문에는 이 함수 호출만 남으므로
-- 잡 정의를 읽어도 자격증명이 보이지 않는다.
CREATE OR REPLACE FUNCTION private.trigger_process_cpa_billing(p_trigger TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, net
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'cpa_supabase_url';
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'cpa_service_role_key';

  -- 비밀이 아직 등록되지 않았으면 조용히 빠진다. 30분마다 오류를 쌓는 것보다
  -- cron.job_run_details 를 깨끗하게 두는 편이 실제 실패를 눈에 띄게 한다.
  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'process-cpa-billing 건너뜀 — Vault 에 cpa_supabase_url / cpa_service_role_key 가 없습니다.';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/process-cpa-billing',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type',  'application/json'
    ),
    body    := jsonb_build_object('trigger', p_trigger),
    timeout_milliseconds := 30000
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION private.trigger_process_cpa_billing(TEXT)
  FROM PUBLIC, anon, authenticated;

-- 정기 갱신 — KST 01:00
SELECT cron.schedule(
  'cpa-monthly-billing',
  '0 16 * * *',
  $$ SELECT private.trigger_process_cpa_billing('cron'); $$
);

-- 재시도 — 30분마다, 대상은 next_retry_at 이 지난 past_due 만
SELECT cron.schedule(
  'cpa-retry-billing',
  '*/30 * * * *',
  $$ SELECT private.trigger_process_cpa_billing('retry'); $$
);

-- 만료 강등 — KST 01:05. 결제 잡이 끝난 뒤에 돌도록 5분 뒤에 둔다.
-- admin 은 구독과 무관한 등급이므로 건드리지 않는다.
SELECT cron.schedule(
  'cpa-downgrade-expired-pro',
  '5 16 * * *',
  $$
  UPDATE public.cpa_users u SET role = 'MEMBER'
  FROM public.cpa_subscription s
  WHERE u.id = s.user_id
    AND u.role = 'PRO'
    AND s.current_period_end < NOW()
    AND s.status IN ('past_due', 'expired', 'cancelled');
  $$
);
