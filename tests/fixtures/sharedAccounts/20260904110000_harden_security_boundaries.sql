-- 서버 전용 쓰기 경계, 힌트 quota 원자화, 결제 회차 선점·멱등성 보강.
BEGIN;

-- 운영 write 경로를 오래 막지 않는다. 잠금을 즉시 얻지 못하거나 전체 migration이
-- 길어지면 transaction 전체를 취소하고, 운영 상태를 확인한 뒤 다시 시도한다.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';

-- 채점·학습보조 기록은 서버만 쓴다.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.cta_grading_attempt FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Users can insert their own attempts" ON public.cta_grading_attempt;
ALTER TABLE public.cta_grading_attempt
  ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_cta_grading_attempt_reservation_expires_at
  ON public.cta_grading_attempt (reservation_expires_at)
  WHERE result_json IS NULL AND reservation_expires_at IS NOT NULL;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.cta_problem_assist FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS problem_assist_insert_own ON public.cta_problem_assist;
DROP POLICY IF EXISTS problem_assist_update_own ON public.cta_problem_assist;

CREATE OR REPLACE FUNCTION public.consume_hint_quota(
  p_user_id UUID,
  p_problem_id BIGINT,
  p_limit INT
)
RETURNS TABLE(allowed BOOLEAN, used_count INT, already_used BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_today TIMESTAMPTZ := date_trunc('day', timezone('Asia/Seoul', now())) AT TIME ZONE 'Asia/Seoul';
  v_used INT;
  v_already BOOLEAN;
BEGIN
  IF p_limit IS NOT NULL AND p_limit < 0 THEN RAISE EXCEPTION 'hint limit must be non-negative'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT || ':' || v_today::TEXT, 0));

  SELECT EXISTS (
    SELECT 1 FROM public.cta_problem_assist
     WHERE user_id = p_user_id AND problem_id = p_problem_id AND hint_used_at >= v_today
  ) INTO v_already;

  SELECT count(*)::INT INTO v_used
    FROM public.cta_problem_assist
   WHERE user_id = p_user_id AND hint_used_at >= v_today;

  IF NOT v_already AND p_limit IS NOT NULL AND v_used >= p_limit THEN
    RETURN QUERY SELECT false, v_used, false;
    RETURN;
  END IF;

  INSERT INTO public.cta_problem_assist (user_id, problem_id, hint_used_at)
  VALUES (p_user_id, p_problem_id, now())
  ON CONFLICT (user_id, problem_id)
  DO UPDATE SET hint_used_at = EXCLUDED.hint_used_at;

  RETURN QUERY SELECT true, CASE WHEN v_already THEN v_used ELSE v_used + 1 END, v_already;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_hint_quota(UUID, BIGINT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_hint_quota(UUID, BIGINT, INT) TO service_role;

-- 승인 전에 회차·주문번호·lease를 영속화한다.
ALTER TABLE public.cta_subscription
  ADD COLUMN IF NOT EXISTS billing_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_order_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_claim_token UUID,
  ADD COLUMN IF NOT EXISTS billing_claimed_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_setup_state TEXT;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.cta_subscription FROM PUBLIC, anon, authenticated;
ALTER TABLE public.cta_subscription DROP CONSTRAINT IF EXISTS cta_subscription_billing_setup_state_check;
ALTER TABLE public.cta_subscription ADD CONSTRAINT cta_subscription_billing_setup_state_check
  CHECK (billing_setup_state IS NULL OR billing_setup_state IN ('pending', 'review'));
-- table-level SELECT가 있으면 민감 컬럼의 column REVOKE가 deny로 작동하지 않는다. 구독 조회는
-- 서버 API만 제공하므로 일반 역할의 전체 SELECT를 명시적으로 회수한다.
REVOKE SELECT ON public.cta_subscription FROM PUBLIC, anon, authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_billing_order_id
  ON public.cta_subscription (billing_order_id) WHERE billing_order_id IS NOT NULL;

ALTER TABLE public.cta_payment_log ADD COLUMN IF NOT EXISTS billing_period_end TIMESTAMPTZ;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.cta_payment_log FROM PUBLIC, anon, authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_success_subscription_period
  ON public.cta_payment_log (subscription_id, billing_period_end)
  WHERE status = 'success' AND subscription_id IS NOT NULL AND billing_period_end IS NOT NULL;

-- Toss에서 검증했지만 성공 원장이 아직 커밋되지 않은 취소 이벤트를 유실하지 않는다.
CREATE TABLE IF NOT EXISTS public.cta_verified_payment_cancellation (
  payment_key TEXT PRIMARY KEY,
  toss_order_id TEXT NOT NULL,
  amount INT NOT NULL CHECK (amount > 0),
  partial BOOLEAN NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cta_verified_payment_cancellation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cta_verified_payment_cancellation FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.cta_billing_key_cleanup (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_id BIGINT,
  billing_key TEXT NOT NULL UNIQUE,
  attempt_count INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claim_token UUID,
  claimed_until TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cta_billing_key_cleanup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cta_billing_key_cleanup FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_billing_key_cleanup(
  p_user_id UUID, p_subscription_id BIGINT, p_billing_key TEXT
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_billing_key IS NULL OR p_billing_key = '' THEN RETURN false; END IF;
  INSERT INTO public.cta_billing_key_cleanup (user_id, subscription_id, billing_key)
  VALUES (p_user_id, p_subscription_id, p_billing_key)
  ON CONFLICT (billing_key) DO UPDATE SET
    next_attempt_at = least(public.cta_billing_key_cleanup.next_attempt_at, now()),
    last_error = NULL;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_billing_key_cleanup(UUID, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_billing_key_cleanup(UUID, BIGINT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_billing_key_cleanup(
  p_claim_token UUID, p_lease_seconds INT DEFAULT 120
)
RETURNS TABLE(id BIGINT, billing_key TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_cleanup public.cta_billing_key_cleanup%ROWTYPE;
BEGIN
  IF p_lease_seconds < 30 OR p_lease_seconds > 600 THEN RAISE EXCEPTION 'invalid cleanup lease'; END IF;
  SELECT c.* INTO v_cleanup FROM public.cta_billing_key_cleanup c
   WHERE c.next_attempt_at <= now()
     AND (c.claim_token IS NULL OR c.claimed_until < now())
     AND NOT EXISTS (
       SELECT 1 FROM public.cta_subscription s
        WHERE s.toss_billing_key = c.billing_key
          AND (NOT s.cancel_at_period_end OR s.billing_setup_state IS NOT NULL
               OR s.billing_order_id IS NOT NULL OR s.billing_claim_token IS NOT NULL)
     )
   ORDER BY c.next_attempt_at, c.id
   FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.cta_billing_key_cleanup c SET
    claim_token = p_claim_token,
    claimed_until = now() + make_interval(secs => p_lease_seconds)
   WHERE c.id = v_cleanup.id;
  RETURN QUERY SELECT v_cleanup.id, v_cleanup.billing_key;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_billing_key_cleanup(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_billing_key_cleanup(UUID, INT) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_billing_key_cleanup(
  p_id BIGINT, p_claim_token UUID, p_succeeded BOOLEAN, p_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_cleanup public.cta_billing_key_cleanup%ROWTYPE;
BEGIN
  SELECT c.* INTO v_cleanup FROM public.cta_billing_key_cleanup c WHERE c.id = p_id FOR UPDATE;
  IF NOT FOUND OR v_cleanup.claim_token IS DISTINCT FROM p_claim_token
     OR v_cleanup.claimed_until IS NULL OR v_cleanup.claimed_until < now() THEN RETURN false; END IF;
  IF p_succeeded THEN
    UPDATE public.cta_subscription s SET toss_billing_key = NULL, toss_customer_key = NULL
     WHERE s.id = v_cleanup.subscription_id AND s.toss_billing_key = v_cleanup.billing_key
       AND s.cancel_at_period_end AND s.billing_setup_state IS NULL
       AND s.billing_order_id IS NULL AND s.billing_claim_token IS NULL;
    DELETE FROM public.cta_billing_key_cleanup WHERE id = v_cleanup.id;
  ELSE
    UPDATE public.cta_billing_key_cleanup SET
      attempt_count = v_cleanup.attempt_count + 1,
      next_attempt_at = now() + CASE WHEN v_cleanup.attempt_count < 3 THEN interval '15 minutes' ELSE interval '6 hours' END,
      claim_token = NULL, claimed_until = NULL,
      last_error = left(coalesce(p_error, 'cleanup failed'), 500)
     WHERE id = v_cleanup.id;
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_billing_key_cleanup(BIGINT, UUID, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_billing_key_cleanup(BIGINT, UUID, BOOLEAN, TEXT) TO service_role;

-- reward·결제 경로가 같은 사용자의 구독 행 부재를 동시에 관찰하지 못하게 한다.
CREATE OR REPLACE FUNCTION public.extend_pro(
  p_user_id UUID, p_days INT, p_reason TEXT, p_referral_id BIGINT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_base TIMESTAMPTZ;
BEGIN
  IF p_days < 1 OR p_days > 3650 THEN RAISE EXCEPTION 'invalid extension days'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('subscription-user:' || p_user_id::TEXT, 0));
  SELECT CASE WHEN current_period_end IS NULL OR current_period_end < now() THEN now()
              ELSE current_period_end END
    INTO v_base FROM public.cta_subscription WHERE user_id = p_user_id FOR UPDATE;
  IF v_base IS NULL THEN
    INSERT INTO public.cta_subscription (
      user_id, status, current_period_start, current_period_end,
      toss_billing_key, toss_customer_key, cancel_at_period_end
    ) VALUES (
      p_user_id, 'active', now(), now() + make_interval(days => p_days),
      NULL, NULL, true
    );
  ELSE
    UPDATE public.cta_subscription SET
      status = 'active', current_period_end = v_base + make_interval(days => p_days),
      cancel_at_period_end = CASE WHEN toss_billing_key IS NULL THEN true ELSE cancel_at_period_end END,
      retry_count = 0, next_retry_at = NULL, updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
  UPDATE public.cta_user SET tier = 'pro' WHERE id = p_user_id AND tier <> 'admin';
  INSERT INTO public.cta_pro_reward (user_id, reward_days, reason, referral_id)
  VALUES (p_user_id, p_days, p_reason, p_referral_id);
END;
$$;
REVOKE ALL ON FUNCTION public.extend_pro(UUID, INT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.extend_pro(UUID, INT, TEXT, BIGINT) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_subscription_billing(
  p_subscription_id BIGINT,
  p_trigger TEXT,
  p_claim_token UUID,
  p_lease_seconds INT DEFAULT 120
)
RETURNS TABLE(
  id BIGINT, user_id UUID, status TEXT, current_period_end TIMESTAMPTZ,
  toss_billing_key TEXT, toss_customer_key TEXT, retry_count INT, order_id TEXT,
  reconcile_only BOOLEAN, cancel_at_period_end BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_sub public.cta_subscription%ROWTYPE;
  v_order TEXT;
BEGIN
  IF p_trigger NOT IN ('cron', 'retry') OR p_lease_seconds < 30 OR p_lease_seconds > 600 THEN
    RAISE EXCEPTION 'invalid billing claim request';
  END IF;

  SELECT s.* INTO v_sub
    FROM public.cta_subscription s
   WHERE s.id = p_subscription_id
     AND s.toss_billing_key IS NOT NULL
     AND s.billing_setup_state IS NULL
     AND (s.billing_claim_token IS NULL OR s.billing_claimed_until < now())
     AND (
       (s.billing_order_id IS NOT NULL AND s.next_retry_at IS NOT NULL AND s.next_retry_at <= now())
       OR (s.billing_order_id IS NULL AND s.cancel_at_period_end = false AND (
         (p_trigger = 'cron' AND s.status = 'active' AND s.current_period_end <= now())
         OR (p_trigger = 'retry' AND s.status = 'past_due' AND s.next_retry_at IS NOT NULL AND s.next_retry_at <= now())
       ))
     )
   FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_sub.billing_order_id IS NOT NULL THEN
    v_order := v_sub.billing_order_id;
  ELSE
    v_order := 'cta_r_' || v_sub.id::TEXT || '_' ||
      floor(extract(epoch FROM v_sub.current_period_end))::BIGINT::TEXT || '_' || v_sub.retry_count::TEXT;
  END IF;

  UPDATE public.cta_subscription s
     SET billing_period_end = CASE WHEN v_sub.billing_order_id IS NULL
                                  THEN v_sub.current_period_end ELSE v_sub.billing_period_end END,
         billing_order_id = v_order,
         billing_claim_token = p_claim_token,
         billing_claimed_until = now() + make_interval(secs => p_lease_seconds),
         next_retry_at = now() + make_interval(secs => p_lease_seconds)
   WHERE s.id = v_sub.id;

  RETURN QUERY SELECT s.id, s.user_id, s.status, s.current_period_end,
    s.toss_billing_key, s.toss_customer_key, s.retry_count, s.billing_order_id,
    (v_sub.billing_order_id IS NOT NULL), s.cancel_at_period_end
    FROM public.cta_subscription s WHERE s.id = v_sub.id;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_subscription_billing(BIGINT, TEXT, UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_subscription_billing(BIGINT, TEXT, UUID, INT) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_billing_success(
  p_subscription_id BIGINT, p_claim_token UUID, p_order_id TEXT,
  p_payment_key TEXT, p_amount INT, p_days INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_sub public.cta_subscription%ROWTYPE;
  v_preserve_cancellation BOOLEAN;
BEGIN
  IF p_amount <> 9900 OR p_days <> 30 OR p_payment_key IS NULL OR p_payment_key = '' THEN
    RAISE EXCEPTION 'invalid successful payment payload';
  END IF;
  SELECT s.* INTO v_sub FROM public.cta_subscription s WHERE s.id = p_subscription_id FOR UPDATE;
  IF NOT FOUND OR v_sub.billing_claim_token IS DISTINCT FROM p_claim_token
    OR v_sub.billing_order_id IS DISTINCT FROM p_order_id OR v_sub.billing_period_end IS NULL
    OR v_sub.billing_claimed_until IS NULL OR v_sub.billing_claimed_until < now() THEN
    RETURN false;
  END IF;
  -- 명시적 해지 API는 claim 중 갱신을 거부한다. 여기서 보이는 해지 상태는 과거 결제
  -- 환불과의 경쟁이므로, 이미 승인된 현재 회차는 원장에 남기되 다음 자동갱신은 되살리지 않는다.
  v_preserve_cancellation := v_sub.cancel_at_period_end OR v_sub.status = 'cancelled';

  IF EXISTS (SELECT 1 FROM public.cta_payment_log WHERE subscription_id = p_subscription_id
    AND billing_period_end = v_sub.billing_period_end AND status = 'success') THEN
    UPDATE public.cta_subscription SET billing_order_id = NULL,
      billing_claim_token = NULL, billing_claimed_until = NULL
      WHERE id = p_subscription_id;
    RETURN true;
  END IF;

  PERFORM public.extend_pro(v_sub.user_id, p_days, 'payment', NULL);
  INSERT INTO public.cta_payment_log (
    user_id, subscription_id, status, amount, toss_payment_key, toss_order_id, billing_period_end
  ) VALUES (
    v_sub.user_id, v_sub.id, 'success', p_amount, p_payment_key, p_order_id, v_sub.billing_period_end
  );
  UPDATE public.cta_subscription SET
    status = CASE WHEN v_preserve_cancellation THEN 'cancelled' ELSE 'active' END,
    cancel_at_period_end = v_preserve_cancellation,
    cancelled_at = CASE WHEN v_preserve_cancellation THEN COALESCE(v_sub.cancelled_at, now()) ELSE NULL END,
    retry_count = 0, next_retry_at = NULL, billing_order_id = NULL,
    billing_claim_token = NULL, billing_claimed_until = NULL
    WHERE id = v_sub.id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_billing_success(BIGINT, UUID, TEXT, TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_billing_success(BIGINT, UUID, TEXT, TEXT, INT, INT) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_billing_failure(
  p_subscription_id BIGINT, p_claim_token UUID, p_order_id TEXT,
  p_code TEXT, p_message TEXT, p_definitive BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_sub public.cta_subscription%ROWTYPE;
  v_retry INT;
  v_next TIMESTAMPTZ;
  v_expired BOOLEAN;
  v_has_future BOOLEAN;
BEGIN
  SELECT s.* INTO v_sub FROM public.cta_subscription s WHERE s.id = p_subscription_id FOR UPDATE;
  IF NOT FOUND OR v_sub.billing_claim_token IS DISTINCT FROM p_claim_token
    OR v_sub.billing_order_id IS DISTINCT FROM p_order_id THEN RETURN false; END IF;

  v_has_future := v_sub.current_period_end > now();

  IF NOT p_definitive THEN
    UPDATE public.cta_subscription SET
      status = CASE WHEN v_sub.cancel_at_period_end THEN 'cancelled'
                    WHEN v_has_future THEN 'active' ELSE 'past_due' END,
      next_retry_at = now() + interval '15 minutes',
      billing_claim_token = NULL, billing_claimed_until = NULL WHERE id = v_sub.id;
    RETURN true;
  END IF;

  v_retry := v_sub.retry_count + 1;
  v_expired := v_retry > 3;
  v_next := CASE v_retry WHEN 1 THEN now() + interval '1 hour'
    WHEN 2 THEN now() + interval '12 hours' WHEN 3 THEN now() + interval '24 hours' ELSE NULL END;
  IF v_sub.cancel_at_period_end THEN
    UPDATE public.cta_subscription SET status = 'cancelled', next_retry_at = NULL,
      billing_order_id = NULL, billing_claim_token = NULL, billing_claimed_until = NULL
      WHERE id = v_sub.id;
  ELSIF v_has_future THEN
    -- 보상·다른 성공 회차가 이미 미래 이용기간을 만들었다면 이 과거 실패로 권한을 회수하지 않는다.
    UPDATE public.cta_subscription SET status = 'active', next_retry_at = NULL,
      billing_order_id = NULL, billing_claim_token = NULL, billing_claimed_until = NULL
      WHERE id = v_sub.id;
  ELSE
    UPDATE public.cta_subscription SET status = CASE WHEN v_expired THEN 'expired' ELSE 'past_due' END,
      retry_count = v_retry, next_retry_at = v_next, billing_order_id = NULL,
      billing_claim_token = NULL, billing_claimed_until = NULL WHERE id = v_sub.id;
  END IF;
  IF NOT v_has_future THEN
    UPDATE public.cta_user SET tier = 'member' WHERE id = v_sub.user_id AND tier = 'pro';
  END IF;
  INSERT INTO public.cta_payment_log (
    user_id, subscription_id, status, amount, toss_order_id, failure_code, failure_message, billing_period_end
  ) VALUES (
    v_sub.user_id, v_sub.id, 'failed', 9900, p_order_id,
    left(coalesce(p_code, 'PAYMENT_FAILED'), 100), left(coalesce(p_message, '결제에 실패했습니다.'), 500),
    v_sub.billing_period_end
  ) ON CONFLICT (toss_order_id) DO NOTHING;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_billing_failure(BIGINT, UUID, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_billing_failure(BIGINT, UUID, TEXT, TEXT, TEXT, BOOLEAN) TO service_role;

-- 사용자의 해지는 외부 승인 요청과 경합해도 즉시 기록한다. 미해결 주문·setup은 지우지 않고
-- 조회 전용 reconciliation이 끝날 때까지 보존한다.
CREATE OR REPLACE FUNCTION public.cancel_subscription_renewal(p_user_id UUID)
RETURNS TABLE(
  id BIGINT, billing_key TEXT, current_period_end TIMESTAMPTZ,
  reconciliation_pending BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_sub public.cta_subscription%ROWTYPE;
BEGIN
  SELECT s.* INTO v_sub FROM public.cta_subscription s WHERE s.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.cta_subscription s SET
    status = 'cancelled', cancel_at_period_end = true,
    cancelled_at = COALESCE(s.cancelled_at, now()),
    next_retry_at = CASE WHEN s.billing_order_id IS NOT NULL THEN now() ELSE s.next_retry_at END,
    updated_at = now()
  WHERE s.id = v_sub.id
  RETURNING s.* INTO v_sub;

  IF v_sub.toss_billing_key IS NOT NULL THEN
    PERFORM public.enqueue_billing_key_cleanup(v_sub.user_id, v_sub.id, v_sub.toss_billing_key);
  END IF;

  RETURN QUERY SELECT v_sub.id, v_sub.toss_billing_key, v_sub.current_period_end,
    (v_sub.billing_order_id IS NOT NULL OR v_sub.billing_setup_state IS NOT NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_subscription_renewal(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_subscription_renewal(UUID) TO service_role;

-- 최초 카드 등록도 사용자 행을 먼저 선점한다. pending/review 요청은 저장된 orderId와
-- billingKey를 재사용하고, 유효 lease가 있으면 두 번째 요청은 busy로 끝난다.
CREATE OR REPLACE FUNCTION public.begin_subscription_setup(
  p_user_id UUID, p_order_id TEXT, p_claim_token UUID, p_lease_seconds INT DEFAULT 120
)
RETURNS TABLE(action TEXT, subscription_id BIGINT, order_id TEXT, claim_token UUID, billing_key TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_sub public.cta_subscription%ROWTYPE;
BEGIN
  IF p_order_id !~ '^[A-Za-z0-9_-]{6,64}$' OR p_lease_seconds < 30 OR p_lease_seconds > 600 THEN
    RAISE EXCEPTION 'invalid subscription setup claim';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('billing-setup:' || p_user_id::TEXT, 0));
  SELECT s.* INTO v_sub FROM public.cta_subscription s WHERE s.user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.cta_subscription (
      user_id, status, current_period_start, current_period_end,
      billing_setup_state, billing_order_id, billing_claim_token, billing_claimed_until
    ) VALUES (
      p_user_id, 'expired', now(), now(), 'pending', p_order_id, p_claim_token,
      now() + make_interval(secs => p_lease_seconds)
    ) RETURNING * INTO v_sub;
    RETURN QUERY SELECT 'started'::TEXT, v_sub.id, v_sub.billing_order_id,
      v_sub.billing_claim_token, v_sub.toss_billing_key;
    RETURN;
  END IF;

  IF v_sub.billing_setup_state IS NULL
     AND v_sub.status = 'active' AND NOT v_sub.cancel_at_period_end
     AND v_sub.current_period_end > now() THEN
    RETURN QUERY SELECT 'already_subscribed'::TEXT, v_sub.id,
      v_sub.billing_order_id, NULL::UUID, v_sub.toss_billing_key;
    RETURN;
  END IF;

  IF v_sub.billing_claim_token IS NOT NULL AND v_sub.billing_claimed_until >= now() THEN
    RETURN QUERY SELECT 'busy'::TEXT, v_sub.id,
      v_sub.billing_order_id, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  -- setup이 아닌 결제 결과 불명 회차가 남아 있으면 카드 재등록으로 우회하지 않는다.
  IF v_sub.billing_setup_state IS NULL AND v_sub.billing_order_id IS NOT NULL THEN
    RETURN QUERY SELECT 'billing_recovery_pending'::TEXT, v_sub.id,
      v_sub.billing_order_id, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  UPDATE public.cta_subscription
     SET billing_setup_state = 'pending',
         billing_order_id = CASE WHEN v_sub.billing_setup_state IN ('pending', 'review')
                                      AND v_sub.billing_order_id IS NOT NULL
                                 THEN v_sub.billing_order_id ELSE p_order_id END,
         billing_claim_token = p_claim_token,
         billing_claimed_until = now() + make_interval(secs => p_lease_seconds),
         toss_billing_key = CASE WHEN v_sub.billing_setup_state IN ('pending', 'review')
                                      AND v_sub.billing_order_id IS NOT NULL
                                 THEN v_sub.toss_billing_key ELSE NULL END,
         toss_customer_key = CASE WHEN v_sub.billing_setup_state IN ('pending', 'review')
                                       AND v_sub.billing_order_id IS NOT NULL
                                  THEN v_sub.toss_customer_key ELSE NULL END,
         cancel_at_period_end = CASE WHEN v_sub.billing_setup_state IN ('pending', 'review')
                                          AND v_sub.billing_order_id IS NOT NULL
                                     THEN v_sub.cancel_at_period_end ELSE false END,
         cancelled_at = CASE WHEN v_sub.billing_setup_state IN ('pending', 'review')
                                  AND v_sub.billing_order_id IS NOT NULL
                             THEN v_sub.cancelled_at ELSE NULL END
   WHERE id = v_sub.id
   RETURNING * INTO v_sub;

  RETURN QUERY SELECT
    CASE WHEN v_sub.toss_billing_key IS NULL THEN 'started'::TEXT ELSE 'resumed'::TEXT END,
    v_sub.id, v_sub.billing_order_id, v_sub.billing_claim_token, v_sub.toss_billing_key;
END;
$$;
REVOKE ALL ON FUNCTION public.begin_subscription_setup(UUID, TEXT, UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_subscription_setup(UUID, TEXT, UUID, INT) TO service_role;

CREATE OR REPLACE FUNCTION public.set_subscription_setup_billing_key(
  p_subscription_id BIGINT, p_claim_token UUID, p_order_id TEXT,
  p_billing_key TEXT, p_customer_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_billing_key IS NULL OR p_billing_key = '' OR p_customer_key IS NULL OR p_customer_key = '' THEN
    RETURN false;
  END IF;
  UPDATE public.cta_subscription
     SET toss_billing_key = p_billing_key, toss_customer_key = p_customer_key
   WHERE id = p_subscription_id
     AND billing_setup_state = 'pending'
     AND billing_claim_token = p_claim_token
     AND billing_order_id = p_order_id
     AND billing_claimed_until >= now();
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.set_subscription_setup_billing_key(BIGINT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_subscription_setup_billing_key(BIGINT, UUID, TEXT, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_subscription_setup(
  p_subscription_id BIGINT, p_claim_token UUID, p_order_id TEXT,
  p_payment_key TEXT, p_amount INT, p_days INT, p_referral_id BIGINT DEFAULT NULL
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_sub public.cta_subscription%ROWTYPE;
  v_period_end TIMESTAMPTZ;
BEGIN
  IF p_amount <> 9900 OR p_days <> 30 OR p_payment_key IS NULL OR p_payment_key = '' THEN
    RAISE EXCEPTION 'invalid initial payment payload';
  END IF;
  SELECT s.* INTO v_sub FROM public.cta_subscription s WHERE s.id = p_subscription_id FOR UPDATE;
  IF NOT FOUND OR v_sub.billing_setup_state <> 'pending'
    OR v_sub.billing_claim_token IS DISTINCT FROM p_claim_token
    OR v_sub.billing_order_id IS DISTINCT FROM p_order_id
    OR v_sub.toss_billing_key IS NULL OR v_sub.toss_customer_key IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_referral_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cta_referral r
     WHERE r.id = p_referral_id AND r.referee_id = v_sub.user_id AND r.status = 'pending'
  ) THEN
    p_referral_id := NULL;
  END IF;
  IF p_referral_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.cta_payment_log p
     WHERE p.user_id = v_sub.user_id AND p.status = 'success'
  ) THEN
    p_referral_id := NULL;
  END IF;

  PERFORM public.extend_pro(v_sub.user_id, p_days, 'payment', NULL);
  UPDATE public.cta_subscription SET
    status = CASE WHEN v_sub.cancel_at_period_end THEN 'cancelled' ELSE 'active' END,
    cancel_at_period_end = v_sub.cancel_at_period_end,
    cancelled_at = CASE WHEN v_sub.cancel_at_period_end THEN COALESCE(v_sub.cancelled_at, now()) ELSE NULL END,
    retry_count = 0, next_retry_at = NULL WHERE id = v_sub.id;
  INSERT INTO public.cta_payment_log (
    user_id, subscription_id, status, amount, toss_payment_key, toss_order_id, billing_period_end, referral_id
  ) VALUES (
    v_sub.user_id, v_sub.id, 'success', p_amount, p_payment_key, p_order_id, v_sub.current_period_end, p_referral_id
  );
  UPDATE public.cta_subscription SET billing_setup_state = NULL, billing_order_id = NULL,
    billing_claim_token = NULL, billing_claimed_until = NULL WHERE id = v_sub.id
    RETURNING current_period_end INTO v_period_end;
  RETURN v_period_end;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_subscription_setup(BIGINT, UUID, TEXT, TEXT, INT, INT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_subscription_setup(BIGINT, UUID, TEXT, TEXT, INT, INT, BIGINT) TO service_role;

CREATE OR REPLACE FUNCTION public.abort_subscription_setup(
  p_subscription_id BIGINT, p_claim_token UUID, p_order_id TEXT, p_definitive BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_sub public.cta_subscription%ROWTYPE;
BEGIN
  IF p_definitive THEN
    SELECT s.* INTO v_sub FROM public.cta_subscription s
     WHERE s.id = p_subscription_id AND s.billing_setup_state = 'pending'
       AND s.billing_claim_token = p_claim_token AND s.billing_order_id = p_order_id
     FOR UPDATE;
    IF FOUND AND v_sub.toss_billing_key IS NOT NULL THEN
      PERFORM public.enqueue_billing_key_cleanup(v_sub.user_id, v_sub.id, v_sub.toss_billing_key);
    END IF;
    UPDATE public.cta_subscription SET billing_setup_state = NULL, billing_order_id = NULL,
      billing_claim_token = NULL, billing_claimed_until = NULL,
      toss_billing_key = NULL, toss_customer_key = NULL
      WHERE id = p_subscription_id AND billing_setup_state = 'pending'
        AND billing_claim_token = p_claim_token AND billing_order_id = p_order_id;
  ELSE
    UPDATE public.cta_subscription SET billing_setup_state = 'review',
      billing_claim_token = NULL, billing_claimed_until = NULL
      WHERE id = p_subscription_id AND billing_setup_state = 'pending'
        AND billing_claim_token = p_claim_token AND billing_order_id = p_order_id;
  END IF;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.abort_subscription_setup(BIGINT, UUID, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.abort_subscription_setup(BIGINT, UUID, TEXT, BOOLEAN) TO service_role;

-- 추천 보상은 최초 결제 finalizer가 성공 원장과 원자 결속하고 30일 뒤 확정한다.
DROP FUNCTION IF EXISTS public.link_payment_referral(UUID, TEXT, BIGINT);

CREATE OR REPLACE FUNCTION public.grant_mature_referral_rewards(p_limit INT DEFAULT 200)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_referral RECORD;
  v_granted INT := 0;
BEGIN
  IF p_limit < 1 OR p_limit > 1000 THEN RAISE EXCEPTION 'invalid referral grant limit'; END IF;
  FOR v_referral IN
    SELECT r.id
      FROM public.cta_referral r
      JOIN public.cta_payment_log p ON p.referral_id = r.id
     WHERE r.status = 'pending'
       AND p.status = 'success'
       AND p.created_at <= now() - interval '30 days'
     ORDER BY p.created_at, r.id
     LIMIT p_limit
     FOR UPDATE OF r, p SKIP LOCKED
  LOOP
    IF public.grant_referral_rewards(v_referral.id) THEN
      v_granted := v_granted + 1;
    END IF;
  END LOOP;
  RETURN v_granted;
END;
$$;
REVOKE ALL ON FUNCTION public.grant_mature_referral_rewards(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_mature_referral_rewards(INT) TO service_role;

-- Toss에서 재조회해 검증한 취소만 전달된다. 부분환불은 결제·추천 자격만 바꾸고 구독
-- 전체를 끊지 않는다. 전액환불은 결제가 더한 30일만 빼서 이후 보상 기간을 보존한다.
CREATE OR REPLACE FUNCTION public.apply_verified_payment_cancellation(
  p_payment_key TEXT, p_partial BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_log public.cta_payment_log%ROWTYPE;
  v_sub public.cta_subscription%ROWTYPE;
  v_new_end TIMESTAMPTZ;
  v_payment_end TIMESTAMPTZ;
  v_remaining_access INTERVAL;
  v_is_latest_payment BOOLEAN;
BEGIN
  -- subscription을 먼저 잠가 성공 finalizer(같은 잠금 순서)와 직렬화한다. 최초 조회는
  -- subscription_id를 찾기 위한 힌트일 뿐이며, 잠금 뒤 결제 행을 다시 읽어 판정한다.
  SELECT p.* INTO v_log FROM public.cta_payment_log p WHERE p.toss_payment_key = p_payment_key;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_log.subscription_id IS NOT NULL THEN
    SELECT s.* INTO v_sub FROM public.cta_subscription s
     WHERE s.id = v_log.subscription_id FOR UPDATE;
  END IF;
  SELECT p.* INTO v_log FROM public.cta_payment_log p
   WHERE p.toss_payment_key = p_payment_key FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_log.status = 'cancelled' OR (v_log.status = 'refunded' AND p_partial) THEN RETURN true; END IF;

  UPDATE public.cta_payment_log
     SET status = CASE WHEN p_partial THEN 'refunded' ELSE 'cancelled' END
   WHERE id = v_log.id;
  IF v_log.referral_id IS NOT NULL THEN
    UPDATE public.cta_referral SET status = 'cancelled'
     WHERE id = v_log.referral_id AND status = 'pending';
  END IF;
  IF p_partial OR v_log.subscription_id IS NULL OR v_sub.id IS NULL
     OR v_log.billing_period_end IS NULL THEN RETURN true; END IF;

  v_payment_end := v_log.billing_period_end + interval '30 days';
  v_remaining_access := greatest(
    interval '0', v_payment_end - greatest(now(), v_log.billing_period_end)
  );
  v_new_end := greatest(now(), v_sub.current_period_end - v_remaining_access);
  v_is_latest_payment := NOT EXISTS (
    SELECT 1 FROM public.cta_payment_log p
     WHERE p.subscription_id = v_sub.id AND p.id <> v_log.id
       AND p.status IN ('success', 'refunded')
       AND p.billing_period_end > v_log.billing_period_end
  ) AND NOT (
    v_sub.billing_order_id IS NOT NULL
    AND v_sub.billing_period_end > v_log.billing_period_end
  );
  UPDATE public.cta_subscription SET
    current_period_end = v_new_end,
    status = CASE WHEN v_is_latest_payment THEN 'cancelled' ELSE v_sub.status END,
    cancel_at_period_end = CASE WHEN v_is_latest_payment THEN true ELSE v_sub.cancel_at_period_end END,
    cancelled_at = CASE WHEN v_is_latest_payment THEN COALESCE(v_sub.cancelled_at, now()) ELSE v_sub.cancelled_at END,
    next_retry_at = CASE WHEN v_is_latest_payment THEN NULL ELSE v_sub.next_retry_at END
   WHERE id = v_sub.id;
  UPDATE public.cta_user SET tier = CASE WHEN v_new_end <= now() THEN 'member' ELSE 'pro' END
   WHERE id = v_sub.user_id AND tier <> 'admin';
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_verified_payment_cancellation(TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_verified_payment_cancellation(TEXT, BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.record_verified_payment_cancellation(
  p_payment_key TEXT, p_order_id TEXT, p_amount INT, p_partial BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_log public.cta_payment_log%ROWTYPE;
BEGIN
  IF p_payment_key IS NULL OR p_payment_key = '' OR p_order_id IS NULL OR p_order_id = ''
     OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid verified cancellation'; END IF;

  INSERT INTO public.cta_verified_payment_cancellation (
    payment_key, toss_order_id, amount, partial
  ) VALUES (p_payment_key, p_order_id, p_amount, p_partial)
  ON CONFLICT (payment_key) DO UPDATE SET
    partial = public.cta_verified_payment_cancellation.partial AND EXCLUDED.partial,
    observed_at = now()
  WHERE public.cta_verified_payment_cancellation.toss_order_id = EXCLUDED.toss_order_id
    AND public.cta_verified_payment_cancellation.amount = EXCLUDED.amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'verified cancellation identity mismatch'; END IF;

  SELECT p.* INTO v_log FROM public.cta_payment_log p
   WHERE p.toss_payment_key = p_payment_key;
  IF NOT FOUND THEN RETURN true; END IF;
  IF v_log.toss_order_id IS DISTINCT FROM p_order_id OR v_log.amount IS DISTINCT FROM p_amount THEN
    RAISE EXCEPTION 'verified cancellation payment mismatch';
  END IF;
  PERFORM public.apply_verified_payment_cancellation(p_payment_key, p_partial);
  DELETE FROM public.cta_verified_payment_cancellation WHERE payment_key = p_payment_key;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.record_verified_payment_cancellation(TEXT, TEXT, INT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_verified_payment_cancellation(TEXT, TEXT, INT, BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_pending_payment_cancellation_after_log()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_pending public.cta_verified_payment_cancellation%ROWTYPE;
BEGIN
  SELECT c.* INTO v_pending FROM public.cta_verified_payment_cancellation c
   WHERE c.payment_key = NEW.toss_payment_key FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF v_pending.toss_order_id IS DISTINCT FROM NEW.toss_order_id
     OR v_pending.amount IS DISTINCT FROM NEW.amount THEN
    RAISE EXCEPTION 'pending cancellation payment mismatch';
  END IF;
  PERFORM public.apply_verified_payment_cancellation(NEW.toss_payment_key, v_pending.partial);
  DELETE FROM public.cta_verified_payment_cancellation WHERE payment_key = NEW.toss_payment_key;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_pending_payment_cancellation_after_log() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS apply_pending_payment_cancellation_after_log ON public.cta_payment_log;
CREATE TRIGGER apply_pending_payment_cancellation_after_log
  AFTER INSERT ON public.cta_payment_log
  FOR EACH ROW WHEN (NEW.status = 'success' AND NEW.toss_payment_key IS NOT NULL)
  EXECUTE FUNCTION public.apply_pending_payment_cancellation_after_log();

-- 외부 broker가 서명된 전체 identity와 nonce를 승인 SQL과 같은 transaction에서 기록한다.
-- 로컬 실행자에게 이 테이블이나 범용 SQL 실행 권한을 주지 않는다.
CREATE TABLE IF NOT EXISTS public.cta_production_apply_receipt (
  nonce UUID PRIMARY KEY,
  manifest JSONB NOT NULL,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.cta_production_apply_receipt ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cta_production_apply_receipt FROM PUBLIC, anon, authenticated, service_role;

-- 서버리스 인스턴스가 여러 개여도 공유되는 고정 창 rate limiter.
CREATE TABLE IF NOT EXISTS public.cta_api_rate_limit (
  actor_key TEXT NOT NULL,
  action TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INT NOT NULL CHECK (request_count > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (actor_key, action, window_start)
);
CREATE INDEX IF NOT EXISTS idx_cta_api_rate_limit_expires_at
  ON public.cta_api_rate_limit (expires_at);
ALTER TABLE public.cta_api_rate_limit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cta_api_rate_limit FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(
  p_actor_key TEXT, p_action TEXT, p_limit INT, p_window_seconds INT
)
RETURNS TABLE(allowed BOOLEAN, remaining INT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_window TIMESTAMPTZ;
  v_count INT;
BEGIN
  IF length(p_actor_key) < 3 OR length(p_actor_key) > 200
    OR p_action !~ '^[a-z0-9:_-]{1,60}$'
    OR p_limit < 1 OR p_limit > 10000
    OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid rate limit request';
  END IF;
  DELETE FROM public.cta_api_rate_limit
   WHERE ctid IN (
     SELECT ctid FROM public.cta_api_rate_limit
      WHERE expires_at < now()
      ORDER BY expires_at
      LIMIT 100
   );
  v_window := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.cta_api_rate_limit AS r (
    actor_key, action, window_start, request_count, expires_at
  ) VALUES (
    p_actor_key, p_action, v_window, 1, v_window + make_interval(secs => p_window_seconds * 2)
  )
  ON CONFLICT (actor_key, action, window_start)
  DO UPDATE SET request_count = r.request_count + 1
    WHERE r.request_count < p_limit
  RETURNING request_count INTO v_count;

  IF v_count IS NULL THEN
    SELECT request_count INTO v_count FROM public.cta_api_rate_limit
     WHERE actor_key = p_actor_key AND action = p_action AND window_start = v_window;
    RETURN QUERY SELECT false, 0;
  ELSE
    RETURN QUERY SELECT true, greatest(0, p_limit - v_count);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_api_rate_limit(TEXT, TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(TEXT, TEXT, INT, INT) TO service_role;

-- 일일 한도 판정과 채점 시도 행 생성을 한 transaction에서 수행한다.
CREATE OR REPLACE FUNCTION public.reserve_grading_attempt(
  p_user_id UUID,
  p_problem_id BIGINT,
  p_answers_json JSONB,
  p_hint_used BOOLEAN,
  p_limit INT,
  p_window_start TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count INT;
  v_id UUID;
BEGIN
  IF p_limit IS NOT NULL AND p_limit < 1 THEN RAISE EXCEPTION 'invalid grade limit'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('grade:' || p_user_id::TEXT || ':' || p_window_start::TEXT, 0));
  -- 서버가 선점 직후 종료돼도 장애 한 번이 하루 quota를 계속 점유하지 않게 한다.
  DELETE FROM public.cta_grading_attempt
   WHERE user_id = p_user_id
     AND result_json IS NULL
     AND reservation_expires_at <= now();
  IF p_limit IS NOT NULL THEN
    SELECT count(*)::INT INTO v_count FROM public.cta_grading_attempt
     WHERE user_id = p_user_id
       AND created_at >= p_window_start
       AND (result_json IS NOT NULL OR reservation_expires_at > now());
    IF v_count >= p_limit THEN RETURN NULL; END IF;
  END IF;

  INSERT INTO public.cta_grading_attempt (
    user_id, problem_id, answers_json, result_json, hint_used, reservation_expires_at
  ) VALUES (
    p_user_id, p_problem_id, p_answers_json, NULL, p_hint_used,
    now() + interval '2 minutes'
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_grading_attempt(UUID, BIGINT, JSONB, BOOLEAN, INT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_grading_attempt(UUID, BIGINT, JSONB, BOOLEAN, INT, TIMESTAMPTZ)
  TO service_role;

-- numeric gate 초안의 freshness 검증과 전체 UPDATE를 한 transaction에서 수행한다.
CREATE OR REPLACE FUNCTION public.apply_numeric_json_batch(p_rows JSONB)
RETURNS INT
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_expected INT;
  v_locked INT;
  v_updated INT;
BEGIN
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'numeric_json batch must be a non-empty array';
  END IF;
  v_expected := jsonb_array_length(p_rows);

  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_rows)
      AS x(rubric_id BIGINT, expected_example_answer_text TEXT, expected_numeric_json TEXT, numeric_json JSONB)
     WHERE x.rubric_id IS NULL OR jsonb_typeof(x.numeric_json) IS DISTINCT FROM 'object'
  ) THEN RAISE EXCEPTION 'invalid numeric_json batch row'; END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_rows)
      AS x(rubric_id BIGINT, expected_example_answer_text TEXT, expected_numeric_json TEXT, numeric_json JSONB)
     GROUP BY x.rubric_id HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'duplicate rubric_id'; END IF;

  PERFORM r.id
    FROM public.cta_subquestion_rubric r
    JOIN jsonb_to_recordset(p_rows)
      AS x(rubric_id BIGINT, expected_example_answer_text TEXT, expected_numeric_json TEXT, numeric_json JSONB)
      ON x.rubric_id = r.id
   ORDER BY r.id
   FOR UPDATE OF r;
  GET DIAGNOSTICS v_locked = ROW_COUNT;
  IF v_locked <> v_expected THEN RAISE EXCEPTION 'missing rubric_id'; END IF;

  IF EXISTS (
    SELECT 1
      FROM public.cta_subquestion_rubric r
      JOIN jsonb_to_recordset(p_rows)
        AS x(rubric_id BIGINT, expected_example_answer_text TEXT, expected_numeric_json TEXT, numeric_json JSONB)
        ON x.rubric_id = r.id
     WHERE r.example_answer_text IS DISTINCT FROM x.expected_example_answer_text
        OR r.numeric_json IS DISTINCT FROM x.expected_numeric_json
  ) THEN RAISE EXCEPTION 'rubric snapshot mismatch'; END IF;

  UPDATE public.cta_subquestion_rubric r
     SET numeric_json = x.numeric_json::TEXT
    FROM jsonb_to_recordset(p_rows)
      AS x(rubric_id BIGINT, expected_example_answer_text TEXT, expected_numeric_json TEXT, numeric_json JSONB)
   WHERE r.id = x.rubric_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> v_expected THEN RAISE EXCEPTION 'numeric_json update count mismatch'; END IF;
  RETURN v_updated;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_numeric_json_batch(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_numeric_json_batch(JSONB) TO service_role;

COMMIT;
