-- Audit Say: CTA billing policy with isolated CPA finance and entitlements.
-- Requires 20260910090000_common_accounts.sql in the shared Supabase database.
-- Port of CTA monetization, hardened billing, and membership safeguards; does not
-- alter CTA billing tables or RPCs. Apply once; production rollout is separate.
begin;
set local lock_timeout='5s';

-- Existing operational PRO grants remain distinct from paid subscriptions.
alter table public.cpa_users add column manual_pro boolean not null default false;
update public.cpa_users set manual_pro=(role='PRO');

create function public.cpa_set_updated_at()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin new.updated_at:=now(); return new; end $$;

ALTER TABLE public.cpa_users
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by   UUID
    REFERENCES public.cpa_users(id) ON DELETE SET NULL;

-- referred_by 는 「내가 누구를 통해 들어왔나」를 조회하는 FK 다. 커버링 인덱스가 없으면
-- 추천인 삭제 시 SET NULL 이 전체 스캔을 탄다(20260802004033 과 같은 판단).
CREATE INDEX IF NOT EXISTS idx_cpa_users_referred_by
  ON public.cpa_users (referred_by);

-- 8자리 대문자 16진 코드. 추천 링크의 내부 식별자이며 화면에는 닉네임만 노출된다.
CREATE OR REPLACE FUNCTION public.cpa_generate_referral_code()
RETURNS TEXT LANGUAGE sql VOLATILE
SET search_path = pg_catalog, public
AS $$
  SELECT upper(substring(md5(random()::text) FROM 1 FOR 8));
$$;

REVOKE EXECUTE ON FUNCTION public.cpa_generate_referral_code() FROM PUBLIC, anon, authenticated;

-- 기존 회원 백필. 코드가 없으면 추천인으로 지목될 수 없으므로 전원에게 채운다.
DO $$
DECLARE
  r      RECORD;
  v_code TEXT;
BEGIN
  FOR r IN SELECT id FROM public.cpa_users WHERE referral_code IS NULL LOOP
    LOOP
      v_code := public.cpa_generate_referral_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.cpa_users WHERE referral_code = v_code);
    END LOOP;
    UPDATE public.cpa_users SET referral_code = v_code WHERE id = r.id;
  END LOOP;
END;
$$;

-- ── 3. cpa_referral — 추천 관계 ────────────────────────────────────────
-- payment_log 가 이 테이블을 참조하므로 먼저 만든다.

CREATE TABLE IF NOT EXISTS public.cpa_referral (
  id           BIGSERIAL   PRIMARY KEY,
  referrer_id  UUID        NOT NULL REFERENCES public.cpa_users(id) ON DELETE CASCADE,
  referee_id   UUID        NOT NULL REFERENCES public.cpa_users(id) ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','rewarded','cancelled')),
  rewarded_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 피추천인은 평생 한 번만 추천받는다. 보상 재지급의 1차 방어선이다.
  UNIQUE (referee_id),
  CONSTRAINT no_self_referral CHECK (referrer_id <> referee_id)
);

CREATE INDEX IF NOT EXISTS idx_cpa_referral_referrer
  ON public.cpa_referral (referrer_id, status);

ALTER TABLE public.cpa_referral ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_select_own ON public.cpa_referral;
CREATE POLICY referral_select_own ON public.cpa_referral
  FOR SELECT USING (
    (SELECT auth.uid()) = referrer_id OR (SELECT auth.uid()) = referee_id
  );

-- ── 4. cpa_subscription — 구독 상태 ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cpa_subscription (
  id                    BIGSERIAL   PRIMARY KEY,
  user_id               UUID        NOT NULL UNIQUE
                        REFERENCES public.cpa_users(id) ON DELETE CASCADE,
  status                TEXT        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','cancelled','past_due','expired')),
  current_period_start  TIMESTAMPTZ NOT NULL,
  current_period_end    TIMESTAMPTZ NOT NULL,
  -- NULL = 추천 보상 전용 구독. 자동결제가 불가능하므로 만료되면 그대로 강등된다.
  toss_billing_key      TEXT        DEFAULT NULL,
  toss_customer_key     TEXT        DEFAULT NULL,
  cancel_at_period_end  BOOLEAN     NOT NULL DEFAULT false,
  cancelled_at          TIMESTAMPTZ,
  retry_count           INT         NOT NULL DEFAULT 0,
  next_retry_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cpa_subscription_period_end
  ON public.cpa_subscription (status, current_period_end)
  WHERE status IN ('active', 'cancelled');

-- 30분마다 도는 재시도 잡이 훑는 경로. 부분 인덱스라 대상이 없을 때 비용이 0에 가깝다.
CREATE INDEX IF NOT EXISTS idx_cpa_subscription_retry
  ON public.cpa_subscription (next_retry_at)
  WHERE status = 'past_due' AND next_retry_at IS NOT NULL;

DROP TRIGGER IF EXISTS set_subscription_updated_at ON public.cpa_subscription;
CREATE TRIGGER set_subscription_updated_at
  BEFORE UPDATE ON public.cpa_subscription
  FOR EACH ROW EXECUTE FUNCTION public.cpa_set_updated_at();

ALTER TABLE public.cpa_subscription ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_select_own ON public.cpa_subscription;
CREATE POLICY subscription_select_own ON public.cpa_subscription
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- RLS 는 행 단위라 빌링키 컬럼을 가리지 못한다. 컬럼 권한으로 따로 닫는다 —
-- 빌링키가 유출되면 customerKey 와 짝지어 임의 결제를 낼 수 있다.
-- 서버는 service_role(RLS·컬럼권한 우회)로 읽으므로 영향이 없다.
REVOKE ALL (toss_billing_key, toss_customer_key)
  ON public.cpa_subscription FROM anon, authenticated;

-- ── 5. cpa_payment_log — 결제 이력 ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cpa_payment_log (
  id               BIGSERIAL   PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES public.cpa_users(id) ON DELETE CASCADE,
  subscription_id  BIGINT      REFERENCES public.cpa_subscription(id) ON DELETE SET NULL,
  status           TEXT        NOT NULL
                   CHECK (status IN ('success','failed','cancelled','refunded')),
  amount           INT         NOT NULL DEFAULT 9900,
  currency         TEXT        NOT NULL DEFAULT 'KRW',
  toss_payment_key TEXT,
  -- 주문번호 고유 제약이 결제 멱등성의 최종 방어선이다. 같은 orderId 로 두 번
  -- 기록되지 않으므로, 웹훅 재전송(최대 7회)이 와도 이력이 부풀지 않는다.
  toss_order_id    TEXT UNIQUE,
  failure_code     TEXT,
  failure_message  TEXT,
  referral_id      BIGINT      REFERENCES public.cpa_referral(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cpa_payment_log_user
  ON public.cpa_payment_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cpa_payment_log_payment_key
  ON public.cpa_payment_log (toss_payment_key)
  WHERE toss_payment_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cpa_payment_log_subscription
  ON public.cpa_payment_log (subscription_id);

CREATE INDEX IF NOT EXISTS idx_cpa_payment_log_referral
  ON public.cpa_payment_log (referral_id);

ALTER TABLE public.cpa_payment_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_log_select_own ON public.cpa_payment_log;
CREATE POLICY payment_log_select_own ON public.cpa_payment_log
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- ── 6. cpa_pro_reward — 보상 지급 이력 ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cpa_pro_reward (
  id           BIGSERIAL   PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES public.cpa_users(id) ON DELETE CASCADE,
  reward_days  INT         NOT NULL DEFAULT 30,
  reason       TEXT        NOT NULL
               CHECK (reason IN ('referral_given','referral_received','payment','manual_admin')),
  referral_id  BIGINT      REFERENCES public.cpa_referral(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cpa_pro_reward_user
  ON public.cpa_pro_reward (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cpa_pro_reward_referral
  ON public.cpa_pro_reward (referral_id);

ALTER TABLE public.cpa_pro_reward ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pro_reward_select_own ON public.cpa_pro_reward;
CREATE POLICY pro_reward_select_own ON public.cpa_pro_reward
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- ── 7. cpa_extend_pro() — 구독 기간 연장 ───────────────────────────────────
--
-- 결제 성공과 추천 보상이 공유하는 유일한 연장 경로다. 남은 기간이 있으면 그 끝에
-- 이어 붙이고, 만료됐으면 지금부터 센다 — 그래서 결제 직후 추천 보상이 들어와도
-- 하루도 사라지지 않는다.

CREATE OR REPLACE FUNCTION public.cpa_extend_pro(
  p_user_id UUID, p_days INT, p_reason TEXT, p_referral_id BIGINT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_base TIMESTAMPTZ;
BEGIN
  -- 동시 호출(추천 보상 2건이 겹치는 경우)에 기간이 덮어써지지 않도록 행을 잠근다.
  SELECT CASE
    WHEN current_period_end IS NULL OR current_period_end < NOW() THEN NOW()
    ELSE current_period_end
  END INTO v_base
  FROM public.cpa_subscription WHERE user_id = p_user_id FOR UPDATE;

  IF v_base IS NULL THEN
    -- 구독 행이 없다 = 결제 없이 보상만 받은 사용자. 빌링키가 없으므로 자동 갱신
    -- 대상이 아니고, 기간이 끝나면 pg_cron 이 member 로 되돌린다.
    INSERT INTO public.cpa_subscription (
      user_id, status, current_period_start, current_period_end,
      toss_billing_key, toss_customer_key, cancel_at_period_end
    ) VALUES (
      p_user_id, 'active', NOW(), NOW() + (p_days || ' days')::INTERVAL,
      NULL, NULL, true
    );
  ELSE
    UPDATE public.cpa_subscription SET
      status               = 'active',
      current_period_end   = v_base + (p_days || ' days')::INTERVAL,
      cancel_at_period_end = CASE WHEN toss_billing_key IS NULL THEN true ELSE cancel_at_period_end END,
      retry_count          = 0,
      next_retry_at        = NULL,
      updated_at           = NOW()
    WHERE user_id = p_user_id;
  END IF;

  UPDATE public.cpa_users SET role = 'PRO' WHERE id = p_user_id AND role <> 'ADMIN';

  INSERT INTO public.cpa_pro_reward (user_id, reward_days, reason, referral_id)
  VALUES (p_user_id, p_days, p_reason, p_referral_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cpa_extend_pro(UUID, INT, TEXT, BIGINT)
  FROM PUBLIC, anon, authenticated;

-- ── 8. cpa_grant_referral_rewards() — 추천 보상 원자화 ─────────────────────
--
-- 양쪽 +30일을 한 트랜잭션에서 처리한다. 상태 전환을 먼저 해 두므로 중복 호출이
-- 와도 두 번째부터는 조용히 빠져나간다(멱등).

CREATE OR REPLACE FUNCTION public.cpa_grant_referral_rewards(
  p_referral_id BIGINT
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_referrer_id UUID;
  v_referee_id  UUID;
  v_status      TEXT;
BEGIN
  SELECT referrer_id, referee_id, status
    INTO v_referrer_id, v_referee_id, v_status
    FROM public.cpa_referral
   WHERE id = p_referral_id
   FOR UPDATE;

  IF NOT FOUND OR v_status <> 'pending' THEN
    RETURN false;  -- 이미 처리됐거나 없는 추천 — 재지급하지 않는다
  END IF;

  UPDATE public.cpa_referral
     SET status = 'rewarded', rewarded_at = NOW()
   WHERE id = p_referral_id;

  PERFORM public.cpa_extend_pro(v_referee_id,  30, 'referral_received', p_referral_id);
  PERFORM public.cpa_extend_pro(v_referrer_id, 30, 'referral_given',    p_referral_id);

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cpa_grant_referral_rewards(BIGINT)
  FROM PUBLIC, anon, authenticated;

ALTER TABLE public.cpa_subscription
  ADD COLUMN IF NOT EXISTS billing_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_order_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_claim_token UUID,
  ADD COLUMN IF NOT EXISTS billing_claimed_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_setup_state TEXT;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.cpa_subscription FROM PUBLIC, anon, authenticated;
ALTER TABLE public.cpa_subscription DROP CONSTRAINT IF EXISTS cpa_subscription_billing_setup_state_check;
ALTER TABLE public.cpa_subscription ADD CONSTRAINT cpa_subscription_billing_setup_state_check
  CHECK (billing_setup_state IS NULL OR billing_setup_state IN ('pending', 'review'));
-- table-level SELECT가 있으면 민감 컬럼의 column REVOKE가 deny로 작동하지 않는다. 구독 조회는
-- 서버 API만 제공하므로 일반 역할의 전체 SELECT를 명시적으로 회수한다.
REVOKE SELECT ON public.cpa_subscription FROM PUBLIC, anon, authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cpa_subscription_billing_order_id
  ON public.cpa_subscription (billing_order_id) WHERE billing_order_id IS NOT NULL;

ALTER TABLE public.cpa_payment_log ADD COLUMN IF NOT EXISTS billing_period_end TIMESTAMPTZ;
-- The immutable billing cycle anchor can predate the actual entitlement grant
-- (overdue renewal), or rewards can move the grant base after a cycle is claimed.
ALTER TABLE public.cpa_payment_log ADD COLUMN IF NOT EXISTS granted_period_start TIMESTAMPTZ;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.cpa_payment_log FROM PUBLIC, anon, authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cpa_payment_success_subscription_period
  ON public.cpa_payment_log (subscription_id, billing_period_end)
  WHERE status = 'success' AND subscription_id IS NOT NULL AND billing_period_end IS NOT NULL;

-- Toss에서 검증했지만 성공 원장이 아직 커밋되지 않은 취소 이벤트를 유실하지 않는다.
CREATE TABLE IF NOT EXISTS public.cpa_verified_payment_cancellation (
  payment_key TEXT PRIMARY KEY,
  toss_order_id TEXT NOT NULL,
  amount INT NOT NULL CHECK (amount > 0),
  partial BOOLEAN NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cpa_verified_payment_cancellation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cpa_verified_payment_cancellation FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.cpa_billing_key_cleanup (
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
ALTER TABLE public.cpa_billing_key_cleanup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cpa_billing_key_cleanup FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cpa_enqueue_billing_key_cleanup(
  p_user_id UUID, p_subscription_id BIGINT, p_billing_key TEXT
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_billing_key IS NULL OR p_billing_key = '' THEN RETURN false; END IF;
  INSERT INTO public.cpa_billing_key_cleanup (user_id, subscription_id, billing_key)
  VALUES (p_user_id, p_subscription_id, p_billing_key)
  ON CONFLICT (billing_key) DO UPDATE SET
    next_attempt_at = least(public.cpa_billing_key_cleanup.next_attempt_at, now()),
    last_error = NULL;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.cpa_enqueue_billing_key_cleanup(UUID, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cpa_enqueue_billing_key_cleanup(UUID, BIGINT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.cpa_claim_billing_key_cleanup(
  p_claim_token UUID, p_lease_seconds INT DEFAULT 120
)
RETURNS TABLE(id BIGINT, billing_key TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_cleanup public.cpa_billing_key_cleanup%ROWTYPE;
BEGIN
  IF p_lease_seconds < 30 OR p_lease_seconds > 600 THEN RAISE EXCEPTION 'invalid cleanup lease'; END IF;
  SELECT c.* INTO v_cleanup FROM public.cpa_billing_key_cleanup c
   WHERE c.next_attempt_at <= now()
     AND (c.claim_token IS NULL OR c.claimed_until < now())
     AND NOT EXISTS (
       SELECT 1 FROM public.cpa_subscription s
        WHERE s.toss_billing_key = c.billing_key
          AND (NOT s.cancel_at_period_end OR s.billing_setup_state IS NOT NULL
               OR s.billing_order_id IS NOT NULL OR s.billing_claim_token IS NOT NULL)
     )
   ORDER BY c.next_attempt_at, c.id
   FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.cpa_billing_key_cleanup c SET
    claim_token = p_claim_token,
    claimed_until = now() + make_interval(secs => p_lease_seconds)
   WHERE c.id = v_cleanup.id;
  RETURN QUERY SELECT v_cleanup.id, v_cleanup.billing_key;
END;
$$;
REVOKE ALL ON FUNCTION public.cpa_claim_billing_key_cleanup(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cpa_claim_billing_key_cleanup(UUID, INT) TO service_role;

CREATE OR REPLACE FUNCTION public.cpa_finalize_billing_key_cleanup(
  p_id BIGINT, p_claim_token UUID, p_succeeded BOOLEAN, p_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_cleanup public.cpa_billing_key_cleanup%ROWTYPE;
BEGIN
  SELECT c.* INTO v_cleanup FROM public.cpa_billing_key_cleanup c WHERE c.id = p_id FOR UPDATE;
  IF NOT FOUND OR v_cleanup.claim_token IS DISTINCT FROM p_claim_token
     OR v_cleanup.claimed_until IS NULL OR v_cleanup.claimed_until < now() THEN RETURN false; END IF;
  IF p_succeeded THEN
    UPDATE public.cpa_subscription s SET toss_billing_key = NULL, toss_customer_key = NULL
     WHERE s.id = v_cleanup.subscription_id AND s.toss_billing_key = v_cleanup.billing_key
       AND s.cancel_at_period_end AND s.billing_setup_state IS NULL
       AND s.billing_order_id IS NULL AND s.billing_claim_token IS NULL;
    DELETE FROM public.cpa_billing_key_cleanup WHERE id = v_cleanup.id;
  ELSE
    UPDATE public.cpa_billing_key_cleanup SET
      attempt_count = v_cleanup.attempt_count + 1,
      next_attempt_at = now() + CASE WHEN v_cleanup.attempt_count < 3 THEN interval '15 minutes' ELSE interval '6 hours' END,
      claim_token = NULL, claimed_until = NULL,
      last_error = left(coalesce(p_error, 'cleanup failed'), 500)
     WHERE id = v_cleanup.id;
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.cpa_finalize_billing_key_cleanup(BIGINT, UUID, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cpa_finalize_billing_key_cleanup(BIGINT, UUID, BOOLEAN, TEXT) TO service_role;

-- reward·결제 경로가 같은 사용자의 구독 행 부재를 동시에 관찰하지 못하게 한다.
CREATE OR REPLACE FUNCTION public.cpa_extend_pro(
  p_user_id UUID, p_days INT, p_reason TEXT, p_referral_id BIGINT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_base TIMESTAMPTZ;
BEGIN
  IF p_days < 1 OR p_days > 3650 THEN RAISE EXCEPTION 'invalid extension days'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('cpa-subscription-user:' || p_user_id::TEXT, 0));
  SELECT CASE WHEN current_period_end IS NULL OR current_period_end < now() THEN now()
              ELSE current_period_end END
    INTO v_base FROM public.cpa_subscription WHERE user_id = p_user_id FOR UPDATE;
  IF v_base IS NULL THEN
    INSERT INTO public.cpa_subscription (
      user_id, status, current_period_start, current_period_end,
      toss_billing_key, toss_customer_key, cancel_at_period_end
    ) VALUES (
      p_user_id, 'active', now(), now() + make_interval(days => p_days),
      NULL, NULL, true
    );
  ELSE
    UPDATE public.cpa_subscription SET
      status = 'active', current_period_end = v_base + make_interval(days => p_days),
      cancel_at_period_end = CASE WHEN toss_billing_key IS NULL THEN true ELSE cancel_at_period_end END,
      retry_count = CASE WHEN billing_order_id IS NULL THEN 0 ELSE retry_count END,
      next_retry_at = CASE WHEN billing_order_id IS NULL THEN NULL ELSE next_retry_at END,
      updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
  UPDATE public.cpa_users SET role = 'PRO' WHERE id = p_user_id AND role <> 'ADMIN';
  INSERT INTO public.cpa_pro_reward (user_id, reward_days, reason, referral_id)
  VALUES (p_user_id, p_days, p_reason, p_referral_id);
END;
$$;
REVOKE ALL ON FUNCTION public.cpa_extend_pro(UUID, INT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cpa_extend_pro(UUID, INT, TEXT, BIGINT) TO service_role;

CREATE OR REPLACE FUNCTION public.cpa_claim_subscription_billing(
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
  v_sub public.cpa_subscription%ROWTYPE;
  v_order TEXT;
BEGIN
  IF p_trigger NOT IN ('cron', 'retry') OR p_lease_seconds < 30 OR p_lease_seconds > 600 THEN
    RAISE EXCEPTION 'invalid billing claim request';
  END IF;

  SELECT s.* INTO v_sub
    FROM public.cpa_subscription s
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
    v_order := 'cpa_r_' || v_sub.id::TEXT || '_' ||
      floor(extract(epoch FROM v_sub.current_period_end))::BIGINT::TEXT || '_' || v_sub.retry_count::TEXT;
  END IF;

  UPDATE public.cpa_subscription s
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
    FROM public.cpa_subscription s WHERE s.id = v_sub.id;
END;
$$;
REVOKE ALL ON FUNCTION public.cpa_claim_subscription_billing(BIGINT, TEXT, UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cpa_claim_subscription_billing(BIGINT, TEXT, UUID, INT) TO service_role;

CREATE OR REPLACE FUNCTION public.cpa_finalize_billing_success(
  p_subscription_id BIGINT, p_claim_token UUID, p_order_id TEXT,
  p_payment_key TEXT, p_amount INT, p_days INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_sub public.cpa_subscription%ROWTYPE;
  v_preserve_cancellation BOOLEAN;
  v_granted_start TIMESTAMPTZ;
BEGIN
  IF p_amount <> 9900 OR p_days <> 30 OR p_payment_key IS NULL OR p_payment_key = '' THEN
    RAISE EXCEPTION 'invalid successful payment payload';
  END IF;
  SELECT s.* INTO v_sub FROM public.cpa_subscription s WHERE s.id = p_subscription_id FOR UPDATE;
  IF NOT FOUND OR v_sub.billing_claim_token IS DISTINCT FROM p_claim_token
    OR v_sub.billing_order_id IS DISTINCT FROM p_order_id OR v_sub.billing_period_end IS NULL
    OR v_sub.billing_claimed_until IS NULL OR v_sub.billing_claimed_until < now() THEN
    RETURN false;
  END IF;
  -- 명시적 해지 API는 claim 중 갱신을 거부한다. 여기서 보이는 해지 상태는 과거 결제
  -- 환불과의 경쟁이므로, 이미 승인된 현재 회차는 원장에 남기되 다음 자동갱신은 되살리지 않는다.
  v_preserve_cancellation := v_sub.cancel_at_period_end OR v_sub.status = 'cancelled';

  IF EXISTS (SELECT 1 FROM public.cpa_payment_log WHERE subscription_id = p_subscription_id
    AND billing_period_end = v_sub.billing_period_end AND status = 'success') THEN
    UPDATE public.cpa_subscription SET billing_order_id = NULL,
      billing_claim_token = NULL, billing_claimed_until = NULL
      WHERE id = p_subscription_id;
    RETURN true;
  END IF;

  v_granted_start := greatest(now(), v_sub.current_period_end);
  PERFORM public.cpa_extend_pro(v_sub.user_id, p_days, 'payment', NULL);
  INSERT INTO public.cpa_payment_log (
    user_id, subscription_id, status, amount, toss_payment_key, toss_order_id, billing_period_end, granted_period_start
  ) VALUES (
    v_sub.user_id, v_sub.id, 'success', p_amount, p_payment_key, p_order_id, v_sub.billing_period_end, v_granted_start
  );
  -- The INSERT trigger may apply a verified cancellation that arrived before
  -- this success log. Preserve that cancellation as well as the pre-claim flag.
  SELECT v_preserve_cancellation OR s.cancel_at_period_end OR s.status='cancelled'
    INTO v_preserve_cancellation FROM public.cpa_subscription s WHERE s.id=v_sub.id;
  UPDATE public.cpa_subscription SET
    status = CASE WHEN v_preserve_cancellation THEN 'cancelled' ELSE 'active' END,
    cancel_at_period_end = v_preserve_cancellation,
    cancelled_at = CASE WHEN v_preserve_cancellation THEN COALESCE(v_sub.cancelled_at, now()) ELSE NULL END,
    retry_count = 0, next_retry_at = NULL, billing_order_id = NULL,
    billing_claim_token = NULL, billing_claimed_until = NULL
    WHERE id = v_sub.id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.cpa_finalize_billing_success(BIGINT, UUID, TEXT, TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cpa_finalize_billing_success(BIGINT, UUID, TEXT, TEXT, INT, INT) TO service_role;

CREATE OR REPLACE FUNCTION public.cpa_finalize_billing_failure(
  p_subscription_id BIGINT, p_claim_token UUID, p_order_id TEXT,
  p_code TEXT, p_message TEXT, p_definitive BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_sub public.cpa_subscription%ROWTYPE;
  v_retry INT;
  v_next TIMESTAMPTZ;
  v_expired BOOLEAN;
  v_has_future BOOLEAN;
BEGIN
  SELECT s.* INTO v_sub FROM public.cpa_subscription s WHERE s.id = p_subscription_id FOR UPDATE;
  IF NOT FOUND OR v_sub.billing_claim_token IS DISTINCT FROM p_claim_token
    OR v_sub.billing_order_id IS DISTINCT FROM p_order_id THEN RETURN false; END IF;

  v_has_future := v_sub.current_period_end > now();

  IF NOT p_definitive THEN
    UPDATE public.cpa_subscription SET
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
    UPDATE public.cpa_subscription SET status = 'cancelled', next_retry_at = NULL,
      billing_order_id = NULL, billing_claim_token = NULL, billing_claimed_until = NULL
      WHERE id = v_sub.id;
  ELSIF v_has_future THEN
    -- 보상·다른 성공 회차가 이미 미래 이용기간을 만들었다면 이 과거 실패로 권한을 회수하지 않는다.
    UPDATE public.cpa_subscription SET status = 'active', next_retry_at = NULL,
      billing_order_id = NULL, billing_claim_token = NULL, billing_claimed_until = NULL
      WHERE id = v_sub.id;
  ELSE
    UPDATE public.cpa_subscription SET status = CASE WHEN v_expired THEN 'expired' ELSE 'past_due' END,
      retry_count = v_retry, next_retry_at = v_next, billing_order_id = NULL,
      billing_claim_token = NULL, billing_claimed_until = NULL WHERE id = v_sub.id;
  END IF;
  IF NOT v_has_future THEN
    UPDATE public.cpa_users SET role = 'MEMBER' WHERE id = v_sub.user_id AND role = 'PRO';
  END IF;
  INSERT INTO public.cpa_payment_log (
    user_id, subscription_id, status, amount, toss_order_id, failure_code, failure_message, billing_period_end
  ) VALUES (
    v_sub.user_id, v_sub.id, 'failed', 9900, p_order_id,
    left(coalesce(p_code, 'PAYMENT_FAILED'), 100), left(coalesce(p_message, '결제에 실패했습니다.'), 500),
    v_sub.billing_period_end
  ) ON CONFLICT (toss_order_id) DO NOTHING;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.cpa_finalize_billing_failure(BIGINT, UUID, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cpa_finalize_billing_failure(BIGINT, UUID, TEXT, TEXT, TEXT, BOOLEAN) TO service_role;

-- 사용자의 해지는 외부 승인 요청과 경합해도 즉시 기록한다. 미해결 주문·setup은 지우지 않고
-- 조회 전용 reconciliation이 끝날 때까지 보존한다.
CREATE OR REPLACE FUNCTION public.cpa_cancel_subscription_renewal(p_user_id UUID)
RETURNS TABLE(
  id BIGINT, billing_key TEXT, current_period_end TIMESTAMPTZ,
  reconciliation_pending BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_sub public.cpa_subscription%ROWTYPE;
BEGIN
  SELECT s.* INTO v_sub FROM public.cpa_subscription s WHERE s.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.cpa_subscription s SET
    status = 'cancelled', cancel_at_period_end = true,
    cancelled_at = COALESCE(s.cancelled_at, now()),
    next_retry_at = CASE WHEN s.billing_order_id IS NOT NULL THEN now() ELSE s.next_retry_at END,
    updated_at = now()
  WHERE s.id = v_sub.id
  RETURNING s.* INTO v_sub;

  IF v_sub.toss_billing_key IS NOT NULL THEN
    PERFORM public.cpa_enqueue_billing_key_cleanup(v_sub.user_id, v_sub.id, v_sub.toss_billing_key);
  END IF;

  RETURN QUERY SELECT v_sub.id, v_sub.toss_billing_key, v_sub.current_period_end,
    (v_sub.billing_order_id IS NOT NULL OR v_sub.billing_setup_state IS NOT NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.cpa_cancel_subscription_renewal(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cpa_cancel_subscription_renewal(UUID) TO service_role;

-- 최초 카드 등록도 사용자 행을 먼저 선점한다. pending/review 요청은 저장된 orderId와
-- billingKey를 재사용하고, 유효 lease가 있으면 두 번째 요청은 busy로 끝난다.
CREATE OR REPLACE FUNCTION public.cpa_begin_subscription_setup(
  p_user_id UUID, p_order_id TEXT, p_claim_token UUID, p_lease_seconds INT DEFAULT 120
)
RETURNS TABLE(action TEXT, subscription_id BIGINT, order_id TEXT, claim_token UUID, billing_key TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_sub public.cpa_subscription%ROWTYPE;
BEGIN
  IF p_order_id !~ '^[A-Za-z0-9_-]{6,64}$' OR p_lease_seconds < 30 OR p_lease_seconds > 600 THEN
    RAISE EXCEPTION 'invalid subscription setup claim';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('cpa-billing-setup:' || p_user_id::TEXT, 0));
  SELECT s.* INTO v_sub FROM public.cpa_subscription s WHERE s.user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.cpa_subscription (
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
     AND v_sub.toss_billing_key IS NOT NULL
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

  UPDATE public.cpa_subscription
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
REVOKE ALL ON FUNCTION public.cpa_begin_subscription_setup(UUID, TEXT, UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cpa_begin_subscription_setup(UUID, TEXT, UUID, INT) TO service_role;

CREATE OR REPLACE FUNCTION public.cpa_set_subscription_setup_billing_key(
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
  UPDATE public.cpa_subscription
     SET toss_billing_key = p_billing_key, toss_customer_key = p_customer_key
   WHERE id = p_subscription_id
     AND billing_setup_state = 'pending'
     AND billing_claim_token = p_claim_token
     AND billing_order_id = p_order_id
     AND billing_claimed_until >= now();
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.cpa_set_subscription_setup_billing_key(BIGINT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cpa_set_subscription_setup_billing_key(BIGINT, UUID, TEXT, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.cpa_finalize_subscription_setup(
  p_subscription_id BIGINT, p_claim_token UUID, p_order_id TEXT,
  p_payment_key TEXT, p_amount INT, p_days INT, p_referral_id BIGINT DEFAULT NULL
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_sub public.cpa_subscription%ROWTYPE;
  v_period_end TIMESTAMPTZ;
  v_granted_start TIMESTAMPTZ;
BEGIN
  IF p_amount <> 9900 OR p_days <> 30 OR p_payment_key IS NULL OR p_payment_key = '' THEN
    RAISE EXCEPTION 'invalid initial payment payload';
  END IF;
  SELECT s.* INTO v_sub FROM public.cpa_subscription s WHERE s.id = p_subscription_id FOR UPDATE;
  IF NOT FOUND OR v_sub.billing_setup_state <> 'pending'
    OR v_sub.billing_claim_token IS DISTINCT FROM p_claim_token
    OR v_sub.billing_order_id IS DISTINCT FROM p_order_id
    OR v_sub.toss_billing_key IS NULL OR v_sub.toss_customer_key IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_referral_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cpa_referral r
     WHERE r.id = p_referral_id AND r.referee_id = v_sub.user_id AND r.status = 'pending'
  ) THEN
    p_referral_id := NULL;
  END IF;
  IF p_referral_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.cpa_payment_log p
     WHERE p.user_id = v_sub.user_id AND p.status = 'success'
  ) THEN
    p_referral_id := NULL;
  END IF;

  v_granted_start := greatest(now(), v_sub.current_period_end);
  PERFORM public.cpa_extend_pro(v_sub.user_id, p_days, 'payment', NULL);
  UPDATE public.cpa_subscription SET
    status = CASE WHEN v_sub.cancel_at_period_end THEN 'cancelled' ELSE 'active' END,
    cancel_at_period_end = v_sub.cancel_at_period_end,
    cancelled_at = CASE WHEN v_sub.cancel_at_period_end THEN COALESCE(v_sub.cancelled_at, now()) ELSE NULL END,
    retry_count = 0, next_retry_at = NULL WHERE id = v_sub.id;
  INSERT INTO public.cpa_payment_log (
    user_id, subscription_id, status, amount, toss_payment_key, toss_order_id, billing_period_end, granted_period_start, referral_id
  ) VALUES (
    v_sub.user_id, v_sub.id, 'success', p_amount, p_payment_key, p_order_id, v_sub.current_period_end, v_granted_start, p_referral_id
  );
  UPDATE public.cpa_subscription SET billing_setup_state = NULL, billing_order_id = NULL,
    billing_claim_token = NULL, billing_claimed_until = NULL WHERE id = v_sub.id
    RETURNING current_period_end INTO v_period_end;
  RETURN v_period_end;
END;
$$;
REVOKE ALL ON FUNCTION public.cpa_finalize_subscription_setup(BIGINT, UUID, TEXT, TEXT, INT, INT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cpa_finalize_subscription_setup(BIGINT, UUID, TEXT, TEXT, INT, INT, BIGINT) TO service_role;

CREATE OR REPLACE FUNCTION public.cpa_abort_subscription_setup(
  p_subscription_id BIGINT, p_claim_token UUID, p_order_id TEXT, p_definitive BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_sub public.cpa_subscription%ROWTYPE;
BEGIN
  IF p_definitive THEN
    SELECT s.* INTO v_sub FROM public.cpa_subscription s
     WHERE s.id = p_subscription_id AND s.billing_setup_state = 'pending'
       AND s.billing_claim_token = p_claim_token AND s.billing_order_id = p_order_id
     FOR UPDATE;
    IF FOUND AND v_sub.toss_billing_key IS NOT NULL THEN
      PERFORM public.cpa_enqueue_billing_key_cleanup(v_sub.user_id, v_sub.id, v_sub.toss_billing_key);
    END IF;
    UPDATE public.cpa_subscription SET billing_setup_state = NULL, billing_order_id = NULL,
      billing_claim_token = NULL, billing_claimed_until = NULL,
      toss_billing_key = NULL, toss_customer_key = NULL
      WHERE id = p_subscription_id AND billing_setup_state = 'pending'
        AND billing_claim_token = p_claim_token AND billing_order_id = p_order_id;
  ELSE
    UPDATE public.cpa_subscription SET billing_setup_state = 'review',
      billing_claim_token = NULL, billing_claimed_until = NULL
      WHERE id = p_subscription_id AND billing_setup_state = 'pending'
        AND billing_claim_token = p_claim_token AND billing_order_id = p_order_id;
  END IF;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.cpa_abort_subscription_setup(BIGINT, UUID, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cpa_abort_subscription_setup(BIGINT, UUID, TEXT, BOOLEAN) TO service_role;

-- 추천 보상은 최초 결제 finalizer가 성공 원장과 원자 결속하고 30일 뒤 확정한다.
DROP FUNCTION IF EXISTS public.link_payment_referral(UUID, TEXT, BIGINT);

CREATE OR REPLACE FUNCTION public.cpa_grant_mature_referral_rewards(p_limit INT DEFAULT 200)
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
      FROM public.cpa_referral r
      JOIN public.cpa_payment_log p ON p.referral_id = r.id
     WHERE r.status = 'pending'
       AND p.status = 'success'
       AND p.created_at <= now() - interval '30 days'
     ORDER BY p.created_at, r.id
     LIMIT p_limit
     FOR UPDATE OF r, p SKIP LOCKED
  LOOP
    IF public.cpa_grant_referral_rewards(v_referral.id) THEN
      v_granted := v_granted + 1;
    END IF;
  END LOOP;
  RETURN v_granted;
END;
$$;
REVOKE ALL ON FUNCTION public.cpa_grant_mature_referral_rewards(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cpa_grant_mature_referral_rewards(INT) TO service_role;

-- Toss에서 재조회해 검증한 취소만 전달된다. 부분환불은 결제·추천 자격만 바꾸고 구독
-- 전체를 끊지 않는다. 전액환불은 결제가 더한 30일만 빼서 이후 보상 기간을 보존한다.
CREATE OR REPLACE FUNCTION public.cpa_apply_verified_payment_cancellation(
  p_payment_key TEXT, p_partial BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_log public.cpa_payment_log%ROWTYPE;
  v_sub public.cpa_subscription%ROWTYPE;
  v_new_end TIMESTAMPTZ;
  v_payment_end TIMESTAMPTZ;
  v_granted_start TIMESTAMPTZ;
  v_remaining_access INTERVAL;
  v_is_latest_payment BOOLEAN;
BEGIN
  -- subscription을 먼저 잠가 성공 finalizer(같은 잠금 순서)와 직렬화한다. 최초 조회는
  -- subscription_id를 찾기 위한 힌트일 뿐이며, 잠금 뒤 결제 행을 다시 읽어 판정한다.
  SELECT p.* INTO v_log FROM public.cpa_payment_log p WHERE p.toss_payment_key = p_payment_key;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_log.subscription_id IS NOT NULL THEN
    SELECT s.* INTO v_sub FROM public.cpa_subscription s
     WHERE s.id = v_log.subscription_id FOR UPDATE;
  END IF;
  SELECT p.* INTO v_log FROM public.cpa_payment_log p
   WHERE p.toss_payment_key = p_payment_key FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_log.status = 'cancelled' OR (v_log.status = 'refunded' AND p_partial) THEN RETURN true; END IF;

  UPDATE public.cpa_payment_log
     SET status = CASE WHEN p_partial THEN 'refunded' ELSE 'cancelled' END
   WHERE id = v_log.id;
  IF v_log.referral_id IS NOT NULL THEN
    UPDATE public.cpa_referral SET status = 'cancelled'
     WHERE id = v_log.referral_id AND status = 'pending';
  END IF;
  IF p_partial OR v_log.subscription_id IS NULL OR v_sub.id IS NULL
     OR v_log.billing_period_end IS NULL THEN RETURN true; END IF;

  v_granted_start := coalesce(v_log.granted_period_start, greatest(v_log.billing_period_end, v_log.created_at));
  v_payment_end := v_granted_start + interval '30 days';
  v_remaining_access := greatest(
    interval '0', v_payment_end - greatest(now(), v_granted_start)
  );
  v_new_end := greatest(now(), v_sub.current_period_end - v_remaining_access);
  v_is_latest_payment := NOT EXISTS (
    SELECT 1 FROM public.cpa_payment_log p
     WHERE p.subscription_id = v_sub.id AND p.id <> v_log.id
       AND p.status IN ('success', 'refunded')
       AND p.billing_period_end > v_log.billing_period_end
  ) AND NOT (
    v_sub.billing_order_id IS NOT NULL
    AND v_sub.billing_period_end > v_log.billing_period_end
  );
  UPDATE public.cpa_subscription SET
    current_period_end = v_new_end,
    status = CASE WHEN v_is_latest_payment THEN 'cancelled' ELSE v_sub.status END,
    cancel_at_period_end = CASE WHEN v_is_latest_payment THEN true ELSE v_sub.cancel_at_period_end END,
    cancelled_at = CASE WHEN v_is_latest_payment THEN COALESCE(v_sub.cancelled_at, now()) ELSE v_sub.cancelled_at END,
    next_retry_at = CASE WHEN v_is_latest_payment THEN NULL ELSE v_sub.next_retry_at END
   WHERE id = v_sub.id;
  UPDATE public.cpa_users SET role = CASE WHEN v_new_end <= now() THEN 'MEMBER' ELSE 'PRO' END
   WHERE id = v_sub.user_id AND role <> 'ADMIN';
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.cpa_apply_verified_payment_cancellation(TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cpa_apply_verified_payment_cancellation(TEXT, BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.cpa_record_verified_payment_cancellation(
  p_payment_key TEXT, p_order_id TEXT, p_amount INT, p_partial BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_log public.cpa_payment_log%ROWTYPE;
BEGIN
  IF p_payment_key IS NULL OR p_payment_key = '' OR p_order_id IS NULL OR p_order_id = ''
     OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid verified cancellation'; END IF;

  INSERT INTO public.cpa_verified_payment_cancellation (
    payment_key, toss_order_id, amount, partial
  ) VALUES (p_payment_key, p_order_id, p_amount, p_partial)
  ON CONFLICT (payment_key) DO UPDATE SET
    partial = public.cpa_verified_payment_cancellation.partial AND EXCLUDED.partial,
    observed_at = now()
  WHERE public.cpa_verified_payment_cancellation.toss_order_id = EXCLUDED.toss_order_id
    AND public.cpa_verified_payment_cancellation.amount = EXCLUDED.amount;
  IF NOT FOUND THEN RAISE EXCEPTION 'verified cancellation identity mismatch'; END IF;

  SELECT p.* INTO v_log FROM public.cpa_payment_log p
   WHERE p.toss_payment_key = p_payment_key;
  IF NOT FOUND THEN RETURN true; END IF;
  IF v_log.toss_order_id IS DISTINCT FROM p_order_id OR v_log.amount IS DISTINCT FROM p_amount THEN
    RAISE EXCEPTION 'verified cancellation payment mismatch';
  END IF;
  PERFORM public.cpa_apply_verified_payment_cancellation(p_payment_key, p_partial);
  DELETE FROM public.cpa_verified_payment_cancellation WHERE payment_key = p_payment_key;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.cpa_record_verified_payment_cancellation(TEXT, TEXT, INT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cpa_record_verified_payment_cancellation(TEXT, TEXT, INT, BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.cpa_apply_pending_payment_cancellation_after_log()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_pending public.cpa_verified_payment_cancellation%ROWTYPE;
BEGIN
  SELECT c.* INTO v_pending FROM public.cpa_verified_payment_cancellation c
   WHERE c.payment_key = NEW.toss_payment_key FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF v_pending.toss_order_id IS DISTINCT FROM NEW.toss_order_id
     OR v_pending.amount IS DISTINCT FROM NEW.amount THEN
    RAISE EXCEPTION 'pending cancellation payment mismatch';
  END IF;
  PERFORM public.cpa_apply_verified_payment_cancellation(NEW.toss_payment_key, v_pending.partial);
  DELETE FROM public.cpa_verified_payment_cancellation WHERE payment_key = NEW.toss_payment_key;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.cpa_apply_pending_payment_cancellation_after_log() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS cpa_apply_pending_payment_cancellation_after_log ON public.cpa_payment_log;
CREATE TRIGGER cpa_apply_pending_payment_cancellation_after_log
  AFTER INSERT ON public.cpa_payment_log
  FOR EACH ROW WHEN (NEW.status = 'success' AND NEW.toss_payment_key IS NOT NULL)
  EXECUTE FUNCTION public.cpa_apply_pending_payment_cancellation_after_log();

-- Financial records survive full Auth deletion with their owner references nulled.
do $$ declare t text; c text; fk record;
begin
  for t,c in select * from (values ('cpa_subscription','user_id'),('cpa_payment_log','user_id'),
    ('cpa_pro_reward','user_id'),('cpa_referral','referrer_id'),('cpa_referral','referee_id')) v(t,c) loop
    for fk in select k.conname from pg_constraint k join pg_attribute a
      on a.attrelid=k.conrelid and a.attnum=any(k.conkey)
      where k.conrelid=('public.'||t)::regclass and k.contype='f' and a.attname=c
        and k.confrelid='public.cpa_users'::regclass loop
      execute format('alter table public.%I drop constraint %I',t,fk.conname);
    end loop;
    execute format('alter table public.%I alter column %I drop not null',t,c);
    execute format('alter table public.%I add constraint %I foreign key(%I) references public.cpa_users(id) on delete set null',t,t||'_'||c||'_retained_fk',c);
  end loop;
end $$;


alter table public.cpa_subscription add column membership_version bigint not null default 1,
  add column withdrawal_started_at timestamptz;
alter table public.cpa_referral add column referrer_membership_version bigint not null default 1,
  add column referee_membership_version bigint not null default 1;
alter table public.cpa_payment_log add column requires_refund_review boolean not null default false,
  add column membership_version bigint not null default 1;

create function public.common_cpa_entitlement_allowed(p_user_id uuid,p_membership_version bigint)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select exists(select 1 from public.cpa_users u join public.common_profiles p on p.id=u.id
    where u.id=p_user_id and u.membership_status='active' and u.membership_version=p_membership_version and p.account_status='active');
$$;

create function public.cpa_billing_guard_subscription()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_version bigint;
begin
  if tg_op='INSERT' then
    new.membership_version:=coalesce(nullif(current_setting('cpa.billing_operation_version',true),'')::bigint,new.membership_version);
  elsif new.membership_version is distinct from old.membership_version and
    nullif(current_setting('cpa.billing_operation_version',true),'')::bigint is distinct from new.membership_version then
    raise exception 'COMMON_STALE_MEMBERSHIP';
  end if;
  if not public.common_cpa_entitlement_allowed(new.user_id,new.membership_version) then
    -- Keep reconciliation order/lease fields and verified payment evidence, but a
    -- stale provider callback can never restore access or schedule a new charge.
    new.status:='expired'; new.cancel_at_period_end:=true;
    new.current_period_end:=least(new.current_period_end,now());
    new.cancelled_at:=coalesce(new.cancelled_at,now());
    if new.billing_order_id is null then new.next_retry_at:=null; end if;
  end if;
  return new;
end $$;
create trigger common_subscription_membership before insert or update on public.cpa_subscription
for each row execute function public.cpa_billing_guard_subscription();

create function public.cpa_billing_queue_inactive_billing_key()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if new.toss_billing_key is not null and not public.common_cpa_entitlement_allowed(new.user_id,new.membership_version) then
    perform public.cpa_enqueue_billing_key_cleanup(new.user_id,new.id,new.toss_billing_key);
  end if;
  return new;
end $$;
create trigger common_inactive_billing_key after insert or update of toss_billing_key,status on public.cpa_subscription
for each row execute function public.cpa_billing_queue_inactive_billing_key();

create function public.cpa_billing_guard_payment_evidence()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_version bigint;
begin
  select membership_version into v_version from public.cpa_subscription where id=new.subscription_id;
  if tg_op='INSERT' then new.membership_version:=coalesce(v_version,new.membership_version); end if;
  if new.status='success' and not public.common_cpa_entitlement_allowed(new.user_id,v_version) then
    new.requires_refund_review:=true; new.referral_id:=null;
  end if;
  -- 'refunded' denotes a partial cancellation in the existing integration. It
  -- does not by itself settle a late payment's remaining refund review.
  if new.status='cancelled' then new.requires_refund_review:=false; end if;
  return new;
end $$;
create trigger common_payment_membership before insert or update of status on public.cpa_payment_log
for each row execute function public.cpa_billing_guard_payment_evidence();

-- Renewal keeps the old billing/idempotency logic. Ended memberships may only
-- reconcile a previously persisted order, including a pending initial setup.
alter function public.cpa_claim_subscription_billing(bigint,text,uuid,int) rename to cpa_billing_legacy_claim_subscription_billing;
create function public.cpa_claim_subscription_billing(p_subscription_id bigint,p_trigger text,p_claim_token uuid,p_lease_seconds integer default 120)
returns table(id bigint,user_id uuid,status text,current_period_end timestamptz,toss_billing_key text,toss_customer_key text,
  retry_count integer,order_id text,reconcile_only boolean,cancel_at_period_end boolean,membership_version bigint,billing_setup_state text)
language plpgsql security definer set search_path=pg_catalog,public as $$
declare s public.cpa_subscription%rowtype;
begin
  if p_trigger not in ('cron','retry') or p_lease_seconds not between 30 and 600 then raise exception 'invalid billing claim request'; end if;
  select * into s from public.cpa_subscription where cpa_subscription.id=p_subscription_id;
  if not found then return; end if;
  -- All membership-affecting paths lock account -> service -> subscription.
  perform 1 from public.common_profiles where common_profiles.id=s.user_id for update;
  perform 1 from public.cpa_users where cpa_users.id=s.user_id for update;
  select * into s from public.cpa_subscription where cpa_subscription.id=p_subscription_id for update;
  if not public.common_cpa_entitlement_allowed(s.user_id,s.membership_version) then
    if s.billing_order_id is null or (s.billing_claim_token is not null and s.billing_claimed_until>=now())
      or (s.next_retry_at is not null and s.next_retry_at>now()) then return; end if;
    update public.cpa_subscription set billing_claim_token=p_claim_token,
      billing_claimed_until=now()+make_interval(secs=>p_lease_seconds),
      billing_setup_state=case when s.billing_setup_state is not null then 'pending' else null end
      where cpa_subscription.id=s.id returning * into s;
    return query select s.id,s.user_id,s.status,s.current_period_end,s.toss_billing_key,s.toss_customer_key,
      s.retry_count,s.billing_order_id,true,true,s.membership_version,s.billing_setup_state;
  else
    return query select b.*,s.membership_version,s.billing_setup_state
      from public.cpa_billing_legacy_claim_subscription_billing(p_subscription_id,p_trigger,p_claim_token,p_lease_seconds) b;
  end if;
end $$;

alter function public.cpa_extend_pro(uuid,int,text,bigint) rename to cpa_billing_legacy_extend_pro;
create function public.cpa_billing_lock_cpa_subscription(p_subscription_id bigint)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_user uuid;
begin
  select user_id into v_user from public.cpa_subscription where id=p_subscription_id;
  perform 1 from public.common_profiles where id=v_user for update;
  perform 1 from public.cpa_users where id=v_user for update;
end $$;
alter function public.cpa_apply_verified_payment_cancellation(text,boolean) rename to cpa_billing_legacy_apply_verified_payment_cancellation;
create function public.cpa_apply_verified_payment_cancellation(p_payment_key text,p_partial boolean)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare p public.cpa_payment_log%rowtype; s public.cpa_subscription%rowtype;
begin
  select * into p from public.cpa_payment_log where toss_payment_key=p_payment_key;
  if not found then return false; end if;
  perform public.cpa_billing_lock_cpa_subscription(p.subscription_id);
  select * into s from public.cpa_subscription where id=p.subscription_id for update;
  select * into p from public.cpa_payment_log where toss_payment_key=p_payment_key for update;
  if s.id is not null and p.membership_version<>s.membership_version then
    -- A previous membership's refund settles only its own payment. Reusing the
    -- subscription PK on rejoin must not deduct new access or cancel new renewal.
    if p.status='cancelled' or (p.status='refunded' and p_partial) then return true; end if;
    update public.cpa_payment_log set status=case when p_partial then 'refunded' else 'cancelled' end where id=p.id;
    update public.cpa_referral set status='cancelled' where id=p.referral_id and status='pending';
    return true;
  end if;
  return public.cpa_billing_legacy_apply_verified_payment_cancellation(p_payment_key,p_partial);
end $$;
alter function public.cpa_finalize_billing_success(bigint,uuid,text,text,int,int) rename to cpa_billing_legacy_finalize_billing_success;
create function public.cpa_finalize_billing_success(p_subscription_id bigint,p_claim_token uuid,p_order_id text,p_payment_key text,p_amount integer,p_days integer)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  perform public.cpa_billing_lock_cpa_subscription(p_subscription_id);
  return public.cpa_billing_legacy_finalize_billing_success(p_subscription_id,p_claim_token,p_order_id,p_payment_key,p_amount,p_days);
end $$;
alter function public.cpa_finalize_subscription_setup(bigint,uuid,text,text,int,int,bigint) rename to cpa_billing_legacy_finalize_subscription_setup;
create function public.cpa_finalize_subscription_setup(p_subscription_id bigint,p_claim_token uuid,p_order_id text,p_payment_key text,p_amount integer,p_days integer,p_referral_id bigint default null)
returns timestamptz language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  perform public.cpa_billing_lock_cpa_subscription(p_subscription_id);
  return public.cpa_billing_legacy_finalize_subscription_setup(p_subscription_id,p_claim_token,p_order_id,p_payment_key,p_amount,p_days,p_referral_id);
end $$;

create function public.cpa_extend_pro(p_user_id uuid,p_days integer,p_reason text,p_referral_id bigint default null)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_version bigint; v_current bigint;
begin
  -- A member lock serializes grant/withdraw. Inactive grants deliberately perform
  -- no writes so verified late payment finalizers can still preserve their logs.
  select u.membership_version into v_current from public.cpa_users u join public.common_profiles p on p.id=u.id
    where u.id=p_user_id and u.membership_status='active' and p.account_status='active' for update of p,u;
  if not found then return; end if;
  if p_referral_id is not null then
    select case when referrer_id=p_user_id then referrer_membership_version
      when referee_id=p_user_id then referee_membership_version end into v_version
      from public.cpa_referral where id=p_referral_id;
  else select membership_version into v_version from public.cpa_subscription where user_id=p_user_id;
  end if;
  if v_version is not null and v_version<>v_current then return; end if;
  perform set_config('cpa.billing_operation_version',v_current::text,true);
  perform public.cpa_billing_legacy_extend_pro(p_user_id,p_days,p_reason,p_referral_id);
  perform set_config('cpa.billing_operation_version','',true);
end $$;

alter function public.cpa_begin_subscription_setup(uuid,text,uuid,int) rename to cpa_billing_legacy_begin_subscription_setup;
create function public.cpa_begin_subscription_setup(p_user_id uuid,p_order_id text,p_claim_token uuid,p_lease_seconds integer default 120,p_membership_version bigint default null)
returns table(action text,subscription_id bigint,order_id text,claim_token uuid,billing_key text)
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if p_membership_version is null then raise exception 'COMMON_MEMBERSHIP_VERSION_REQUIRED'; end if;
  perform public.common_assert_service_access(p_user_id,'cpa',p_membership_version);
  perform set_config('cpa.billing_operation_version',p_membership_version::text,true);
  -- A rejoin is allowed only after old payment/key cleanup completed.
  update public.cpa_subscription s set membership_version=p_membership_version,withdrawal_started_at=null
    where s.user_id=p_user_id and s.membership_version<>p_membership_version
      and s.billing_order_id is null and s.billing_setup_state is null
      and s.toss_billing_key is null;
  return query select * from public.cpa_billing_legacy_begin_subscription_setup(p_user_id,p_order_id,p_claim_token,p_lease_seconds);
  perform set_config('cpa.billing_operation_version','',true);
end $$;

-- Capture both participants' service epochs. Direct insertion still has to provide
alter function public.cpa_cancel_subscription_renewal(uuid) rename to cpa_billing_legacy_cancel_subscription_renewal;
create function public.cpa_cancel_subscription_renewal(p_user_id uuid,p_membership_version bigint default null)
returns table(id bigint,billing_key text,current_period_end timestamptz,reconciliation_pending boolean)
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if p_membership_version is null then raise exception 'COMMON_MEMBERSHIP_VERSION_REQUIRED'; end if;
  perform public.common_assert_service_access(p_user_id,'cpa',p_membership_version);
  return query select * from public.cpa_billing_legacy_cancel_subscription_renewal(p_user_id);
end $$;

-- Capture both participants' service epochs. Direct insertion still has to provide
-- the referee's request epoch; automatic current-epoch guessing would admit stale tabs.
create function public.cpa_billing_guard_referral()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if tg_op='INSERT' then
    perform public.common_assert_service_access(new.referee_id,'cpa',new.referee_membership_version);
    perform public.common_assert_service_access(new.referrer_id,'cpa',new.referrer_membership_version);
  elsif (new.referrer_id,new.referee_id,new.referrer_membership_version,new.referee_membership_version)
    is distinct from (old.referrer_id,old.referee_id,old.referrer_membership_version,old.referee_membership_version)
    and not (new.referrer_id is null or new.referee_id is null) then
    raise exception 'COMMON_REFERRAL_IDENTITY_IMMUTABLE';
  end if;
  return new;
end $$;
create trigger common_referral_membership before insert or update on public.cpa_referral for each row execute function public.cpa_billing_guard_referral();
alter function public.cpa_grant_referral_rewards(bigint) rename to cpa_billing_legacy_grant_referral_rewards;
create function public.cpa_grant_referral_rewards(p_referral_id bigint)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.cpa_referral%rowtype; u record;
begin
  select * into r from public.cpa_referral where id=p_referral_id;
  if not found or r.status<>'pending' then return false; end if;
  -- Canonical UUID order avoids opposite referral chains taking member locks backwards.
  for u in select id from public.common_profiles where id in(r.referrer_id,r.referee_id) order by id for update loop null; end loop;
  if not public.common_cpa_entitlement_allowed(r.referrer_id,r.referrer_membership_version)
    or not public.common_cpa_entitlement_allowed(r.referee_id,r.referee_membership_version) then
    update public.cpa_referral set status='cancelled' where id=r.id and status='pending'; return false;
  end if;
  return public.cpa_billing_legacy_grant_referral_rewards(p_referral_id);
end $$;



-- Every financial mutation is server-only. Authenticated members can read only
-- their own safe subscription fields, payment history and referral rewards.
revoke all on public.cpa_subscription, public.cpa_payment_log, public.cpa_referral,
  public.cpa_pro_reward, public.cpa_billing_key_cleanup, public.cpa_verified_payment_cancellation
  from public, anon, authenticated;
grant all on public.cpa_subscription, public.cpa_payment_log, public.cpa_referral,
  public.cpa_pro_reward, public.cpa_billing_key_cleanup, public.cpa_verified_payment_cancellation to service_role;
grant select(id,user_id,status,current_period_start,current_period_end,cancel_at_period_end,
  cancelled_at,retry_count,next_retry_at,created_at,updated_at,membership_version)
  on public.cpa_subscription to authenticated;
grant select on public.cpa_payment_log,public.cpa_referral,public.cpa_pro_reward to authenticated;
alter policy subscription_select_own on public.cpa_subscription to authenticated;
alter policy payment_log_select_own on public.cpa_payment_log to authenticated;
alter policy referral_select_own on public.cpa_referral to authenticated;
alter policy pro_reward_select_own on public.cpa_pro_reward to authenticated;
grant usage,select on sequence public.cpa_subscription_id_seq,public.cpa_payment_log_id_seq,
  public.cpa_referral_id_seq,public.cpa_pro_reward_id_seq,public.cpa_billing_key_cleanup_id_seq to service_role;

create function public.cpa_assign_referral_code()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if new.referral_code is null then
    loop
      new.referral_code:=public.cpa_generate_referral_code();
      exit when not exists(select 1 from public.cpa_users where referral_code=new.referral_code);
    end loop;
  end if;
  return new;
end $$;
create trigger cpa_assign_referral_code before insert on public.cpa_users
  for each row execute function public.cpa_assign_referral_code();

create or replace function public.common_withdraw_service(p_user_id uuid,p_service text,p_expected_version bigint default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_row jsonb; s public.cta_subscription%rowtype; cpa_sub public.cpa_subscription%rowtype; v_pending integer:=0; v_review boolean:=false; v_status text; v_table text;
begin
  if p_service not in ('cpa','cta') or p_service is null then raise exception 'COMMON_INVALID_SERVICE'; end if;
  perform 1 from public.common_profiles where id=p_user_id for update;
  if not found then raise exception 'COMMON_PROFILE_REQUIRED'; end if;
  if p_service='cpa' then select to_jsonb(u) into v_row from public.cpa_users u where id=p_user_id for update;
  else select to_jsonb(u) into v_row from public.cta_user u where id=p_user_id for update; end if;
  if v_row is null then
    return jsonb_build_object('status','not_joined','membership_version',null,'cleanup_pending',false,'billing_review_required',false);
  end if;
  if p_expected_version is not null and p_expected_version<>(v_row->>'membership_version')::bigint then raise exception 'COMMON_STALE_MEMBERSHIP'; end if;
  perform set_config('common.membership_write',p_user_id::text,true);
  if p_service='cpa' then
    update public.cpa_users set membership_status='withdrawing',rejoin_blocked=rejoin_blocked or membership_status='suspended' where id=p_user_id;
    perform set_config('common.withdraw_user',p_user_id::text,true);
    delete from public.cpa_review_items where user_id=p_user_id;
    delete from public.cpa_xp_events where user_id=p_user_id;
    delete from public.cpa_attempts where owner_user_id=p_user_id;
    foreach v_table in array array['cpa_kicpa_jobs_subscribers','cpa_review_notes','cpa_firm_chat_message','cpa_firm_review','cpa_firm_subscription'] loop
      if to_regclass('public.'||v_table) is not null then
        execute format('delete from public.%I where user_id=$1',v_table) using p_user_id;
      end if;
    end loop;
    perform set_config('cpa.learning_progress_write','on',true);
    update public.cpa_users set exp=0,level=1,role='MEMBER',manual_pro=false,is_service_admin=false,membership_status='withdrawn' where id=p_user_id;
    perform set_config('cpa.learning_progress_write','',true);
    perform set_config('common.withdraw_user','',true);
    update public.cpa_referral set status='cancelled'
      where status='pending' and (referee_id=p_user_id or referrer_id=p_user_id);
    select * into cpa_sub from public.cpa_subscription where user_id=p_user_id for update;
    if found then
      update public.cpa_subscription set status='expired',cancel_at_period_end=true,
        withdrawal_started_at=coalesce(withdrawal_started_at,now()),
        cancelled_at=coalesce(cancelled_at,now()),current_period_end=least(current_period_end,now()),
        next_retry_at=case when billing_order_id is null then null else coalesce(next_retry_at,now()) end
        where id=cpa_sub.id;
      if cpa_sub.toss_billing_key is not null then
        perform public.cpa_enqueue_billing_key_cleanup(p_user_id,cpa_sub.id,cpa_sub.toss_billing_key);
      end if;
      v_review:=cpa_sub.billing_order_id is not null or cpa_sub.billing_setup_state is not null
        or cpa_sub.billing_claim_token is not null;
    end if;
    select count(*) into v_pending from public.cpa_billing_key_cleanup where user_id=p_user_id;
    v_status:=case when v_pending>0 or v_review then 'withdrawing' else 'withdrawn' end;
    update public.cpa_users set membership_status=v_status where id=p_user_id;
    v_review:=v_review or exists(select 1 from public.cpa_payment_log where user_id=p_user_id and requires_refund_review);
  else
    update public.cta_user set membership_status='withdrawing',rejoin_blocked=rejoin_blocked or membership_status='suspended',
      tier='member',exp=0,is_service_admin=false where id=p_user_id;
    insert into public.cta_usage_receipts(user_id,kind,receipt_key,used_at)
      select user_id,'grade',id::text,created_at from public.cta_grading_attempt
      where user_id=p_user_id and (result_json is not null or reservation_expires_at>now())
        and created_at>=date_trunc('day',timezone('Asia/Seoul',now())) at time zone 'Asia/Seoul'
      on conflict(user_id,kind,receipt_key) do nothing;
    insert into public.cta_usage_receipts(user_id,kind,receipt_key,used_at)
      select user_id,'hint',problem_id::text,hint_used_at from public.cta_problem_assist
      where user_id=p_user_id and hint_used_at>=date_trunc('day',timezone('Asia/Seoul',now())) at time zone 'Asia/Seoul'
      on conflict(user_id,kind,receipt_key) do update set used_at=greatest(public.cta_usage_receipts.used_at,excluded.used_at);
    delete from public.cta_grading_attempt where user_id=p_user_id;
    delete from public.cta_problem_assist where user_id=p_user_id;
    update public.cta_referral set status='cancelled' where status='pending' and (referee_id=p_user_id or referrer_id=p_user_id);
    select * into s from public.cta_subscription where user_id=p_user_id for update;
    if found then
      -- Outstanding order/lease state is preserved for provider reconciliation.
      update public.cta_subscription set status='expired',cancel_at_period_end=true,
        withdrawal_started_at=coalesce(withdrawal_started_at,now()),
        cancelled_at=coalesce(cancelled_at,now()),current_period_end=least(current_period_end,now()),
        next_retry_at=case when billing_order_id is null then null else coalesce(next_retry_at,now()) end
        where id=s.id;
      if s.toss_billing_key is not null then perform public.enqueue_billing_key_cleanup(p_user_id,s.id,s.toss_billing_key); end if;
      v_review:=s.billing_order_id is not null or s.billing_setup_state is not null or s.billing_claim_token is not null;
    end if;
    select count(*) into v_pending from public.cta_billing_key_cleanup where user_id=p_user_id;
    v_status:=case when v_pending>0 or v_review then 'withdrawing' else 'withdrawn' end;
    update public.cta_user set membership_status=v_status where id=p_user_id;
    v_review:=v_review or exists(select 1 from public.cta_payment_log where user_id=p_user_id and requires_refund_review);
  end if;
  perform set_config('common.membership_write','',true);
  return jsonb_build_object('status',v_status,'membership_version',(v_row->>'membership_version')::bigint,
    'cleanup_pending',v_status='withdrawing','cleanup_count',v_pending,'billing_review_required',v_review);
end $$;

create or replace function public.common_prepare_account_deletion(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_cpa jsonb; v_cta jsonb; v_ready boolean;
begin
  update public.common_profiles set account_status='deleting',updated_at=now() where id=p_user_id;
  if not found then raise exception 'COMMON_PROFILE_REQUIRED'; end if;
  v_cpa:=public.common_withdraw_service(p_user_id,'cpa');
  v_cta:=public.common_withdraw_service(p_user_id,'cta');
  v_ready:=v_cpa->>'status' in ('not_joined','withdrawn') and v_cta->>'status' in ('not_joined','withdrawn')
    and not (v_cta->>'billing_review_required')::boolean
    and not (v_cpa->>'billing_review_required')::boolean;
  return jsonb_build_object('cpa',v_cpa,'cta',v_cta,'ready_for_auth_delete',v_ready);
end $$;

create or replace function public.common_guard_auth_deletion()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if coalesce(old.is_anonymous,false) then return old; end if;
  if not exists(select 1 from public.common_profiles where id=old.id and account_status='deleting')
    or exists(select 1 from public.cpa_users where id=old.id and membership_status<>'withdrawn')
    or exists(select 1 from public.cta_user where id=old.id and membership_status<>'withdrawn')
    or exists(select 1 from public.cta_billing_key_cleanup where user_id=old.id)
    or exists(select 1 from public.cta_subscription where user_id=old.id and
      (toss_billing_key is not null or billing_order_id is not null or billing_setup_state is not null or billing_claim_token is not null))
    or exists(select 1 from public.cta_payment_log where user_id=old.id and requires_refund_review)
    or exists(select 1 from public.cpa_billing_key_cleanup where user_id=old.id)
    or exists(select 1 from public.cpa_subscription where user_id=old.id and
      (toss_billing_key is not null or billing_order_id is not null or billing_setup_state is not null or billing_claim_token is not null))
    or exists(select 1 from public.cpa_payment_log where user_id=old.id and requires_refund_review) then
    raise exception 'COMMON_ACCOUNT_CLEANUP_REQUIRED';
  end if;
  return old;
end $$;



create table public.cpa_billing_payment_resolution_log (
  id bigint generated always as identity primary key,
  subscription_id bigint not null, order_id text not null unique,
  resolution text not null check(resolution='provider_confirmed_no_charge'),
  evidence text not null check(length(btrim(evidence)) between 30 and 2000),
  resolved_by name not null default current_user, resolved_at timestamptz not null default now()
);
alter table public.cpa_billing_payment_resolution_log enable row level security;
revoke all on public.cpa_billing_payment_resolution_log from public,anon,authenticated,service_role;

create function public.cpa_resolve_withdrawn_order_no_charge(p_subscription_id bigint,p_order_id text,p_evidence text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare s public.cpa_subscription%rowtype;
begin
  if p_evidence is null or length(btrim(p_evidence)) not between 30 and 2000 then raise exception 'COMMON_PROVIDER_EVIDENCE_REQUIRED'; end if;
  perform public.cpa_billing_lock_cpa_subscription(p_subscription_id);
  select * into s from public.cpa_subscription where id=p_subscription_id for update;
  if not found or s.billing_order_id is distinct from p_order_id or p_order_id is null then raise exception 'COMMON_ORDER_MISMATCH'; end if;
  if not exists(select 1 from public.cpa_users where id=s.user_id and membership_status in ('withdrawing','withdrawn')) then
    raise exception 'COMMON_SERVICE_MUST_BE_WITHDRAWING';
  end if;
  -- The elapsed interval is a minimum guard, never a replacement for the external
  -- evidence/explicit operator attestation required by this function's contract.
  if s.withdrawal_started_at is null or s.withdrawal_started_at>now()-interval '15 minutes'
    or (s.billing_claim_token is not null and (s.billing_claimed_until is null or s.billing_claimed_until>=now())) then
    raise exception 'COMMON_PAYMENT_MAY_BE_IN_FLIGHT';
  end if;
  if exists(select 1 from public.cpa_payment_log where toss_order_id=p_order_id and status in ('success','refunded','cancelled')) then
    raise exception 'COMMON_KNOWN_PAYMENT_REQUIRES_RECONCILIATION';
  end if;
  insert into public.cpa_billing_payment_resolution_log(subscription_id,order_id,resolution,evidence)
    values(s.id,p_order_id,'provider_confirmed_no_charge',btrim(p_evidence));
  insert into public.cpa_payment_log(user_id,subscription_id,status,toss_order_id,failure_code,failure_message,membership_version)
    values(s.user_id,s.id,'failed',p_order_id,'OPERATOR_VERIFIED_NO_CHARGE','Provider original order and transaction records checked; see owner resolution log.',s.membership_version)
    on conflict(toss_order_id) do nothing;
  if s.toss_billing_key is not null then perform public.cpa_enqueue_billing_key_cleanup(s.user_id,s.id,s.toss_billing_key); end if;
  update public.cpa_subscription set billing_order_id=null,billing_setup_state=null,billing_claim_token=null,billing_claimed_until=null,
    next_retry_at=null,status='expired',cancel_at_period_end=true where id=s.id;
  return jsonb_build_object('resolved',true,'subscription_id',s.id,'billing_key_cleanup_pending',s.toss_billing_key is not null);
end $$;



-- Billing expiry/refunds remove only paid access. An explicit operational PRO
-- grant survives, and removing that grant cannot cancel an active paid period.
create function public.cpa_billing_guard_manual_pro()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if new.manual_pro is distinct from old.manual_pro
    and current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'manual_pro is server-only' using errcode='insufficient_privilege';
  end if;
  if new.membership_status<>'active' or not exists(
    select 1 from public.common_profiles where id=new.id and account_status='active') then
    new.role:='MEMBER';
  elsif new.role<>'ADMIN' then
    if new.manual_pro or exists(select 1 from public.cpa_subscription where user_id=new.id
      and membership_version=new.membership_version and current_period_end>now()
      and status in ('active','cancelled')) then new.role:='PRO';
    else new.role:='MEMBER'; end if;
  end if;
  return new;
end $$;
create trigger cpa_billing_manual_pro_guard before update of manual_pro,role on public.cpa_users
  for each row execute function public.cpa_billing_guard_manual_pro();
revoke all on function public.cpa_billing_guard_manual_pro() from public,anon,authenticated,service_role;

-- Private implementations can be reached only through membership-aware wrappers.
do $$ declare f record;
begin
  for f in select p.oid::regprocedure as signature,p.proname,p.prorettype from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and
    (p.proname in ('cpa_generate_referral_code','cpa_set_updated_at','cpa_extend_pro','cpa_grant_referral_rewards','cpa_enqueue_billing_key_cleanup','cpa_claim_billing_key_cleanup','cpa_finalize_billing_key_cleanup','cpa_claim_subscription_billing','cpa_finalize_billing_success','cpa_finalize_billing_failure','cpa_cancel_subscription_renewal','cpa_begin_subscription_setup','cpa_set_subscription_setup_billing_key','cpa_finalize_subscription_setup','cpa_abort_subscription_setup','cpa_grant_mature_referral_rewards','cpa_apply_verified_payment_cancellation','cpa_record_verified_payment_cancellation','cpa_apply_pending_payment_cancellation_after_log','common_cpa_entitlement_allowed','cpa_billing_guard_subscription','cpa_billing_queue_inactive_billing_key','cpa_billing_guard_payment_evidence','cpa_billing_legacy_claim_subscription_billing','cpa_billing_legacy_extend_pro','cpa_billing_lock_cpa_subscription','cpa_billing_legacy_apply_verified_payment_cancellation','cpa_billing_legacy_finalize_billing_success','cpa_billing_legacy_finalize_subscription_setup','cpa_billing_legacy_begin_subscription_setup','cpa_billing_legacy_cancel_subscription_renewal','cpa_billing_guard_referral','cpa_billing_legacy_grant_referral_rewards','cpa_assign_referral_code','cpa_resolve_withdrawn_order_no_charge')
      or p.proname like 'cpa_billing_legacy_%') loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
    if f.proname not like 'cpa_billing_legacy_%' and f.proname<>'cpa_resolve_withdrawn_order_no_charge'
      and f.prorettype<>'trigger'::regtype then
      execute format('grant execute on function %s to service_role',f.signature);
    end if;
  end loop;
end $$;
commit;
