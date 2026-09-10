-- 유료화 스키마 — 구독·결제 이력·추천인·보상 (MONETIZATION.md §2, v4)
--
-- 이 마이그레이션이 만드는 것은 네 갈래다.
--   1. cta_user 에 추천 관계 컬럼(referral_code · referred_by)
--   2. 구독 4테이블(cta_subscription · cta_referral · cta_payment_log · cta_pro_reward)
--   3. 보상 지급 RPC 2개(extend_pro · grant_referral_rewards)
--   4. tier 를 서버 전용으로 잠그는 트리거
--
-- **회원가입 장애를 함께 고친다.** 2026-09-01 에 cta_user.nickname 에 NOT NULL 이 걸렸는데
-- handle_new_user() 는 (id, email, tier, exp) 만 INSERT 한다. 기본값이 없으므로 그 시점부터
-- 모든 신규 가입이 트리거에서 NOT NULL 위반으로 실패한다. 아래 교체본은 닉네임 폴백을 넣어
-- 트리거 단독으로도 유효한 행이 만들어지게 한다 — 화면에서 받은 닉네임은 signup 액션이
-- 곧바로 덮어쓰므로 사용자가 보는 값은 달라지지 않는다.
--
-- 운영 적용 완료 — supabase_migrations.schema_migrations 의 20260901045127 로 기록돼 있다.
--
-- 되돌리려면: 아래 CREATE 한 테이블·함수·트리거를 DROP 하고 cta_user 의 두 컬럼을 DROP 한다.
-- handle_new_user() 는 nickname 폴백을 지우면 다시 가입이 깨지므로 그대로 두는 편이 낫다.

-- ── 1. cta_user 추천 컬럼 ──────────────────────────────────────────────

ALTER TABLE public.cta_user
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by   UUID
    REFERENCES public.cta_user(id) ON DELETE SET NULL;

-- referred_by 는 「내가 누구를 통해 들어왔나」를 조회하는 FK 다. 커버링 인덱스가 없으면
-- 추천인 삭제 시 SET NULL 이 전체 스캔을 탄다(20260802004033 과 같은 판단).
CREATE INDEX IF NOT EXISTS idx_cta_user_referred_by
  ON public.cta_user (referred_by);

-- 8자리 대문자 16진 코드. 추천 링크의 내부 식별자이며 화면에는 닉네임만 노출된다.
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT LANGUAGE sql VOLATILE
SET search_path = pg_catalog, public
AS $$
  SELECT upper(substring(md5(random()::text) FROM 1 FOR 8));
$$;

REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM PUBLIC, anon, authenticated;

-- 기존 회원 백필. 코드가 없으면 추천인으로 지목될 수 없으므로 전원에게 채운다.
DO $$
DECLARE
  r      RECORD;
  v_code TEXT;
BEGIN
  FOR r IN SELECT id FROM public.cta_user WHERE referral_code IS NULL LOOP
    LOOP
      v_code := public.generate_referral_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.cta_user WHERE referral_code = v_code);
    END LOOP;
    UPDATE public.cta_user SET referral_code = v_code WHERE id = r.id;
  END LOOP;
END;
$$;

-- ── 2. handle_new_user 교체 (referral_code 발급 + nickname 폴백) ────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_code     TEXT;
  v_nickname TEXT;
BEGIN
  -- 익명 로그인(guest)은 cta_user 행을 만들지 않는다(종전 동작 유지).
  IF new.is_anonymous IS NOT TRUE THEN
    LOOP
      v_code := public.generate_referral_code();
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.cta_user WHERE referral_code = v_code
      );
    END LOOP;

    -- nickname 은 NOT NULL + UNIQUE + lower(nickname) 고유 인덱스다. 가입 화면이 보낸
    -- 닉네임은 signup 액션이 곧바로 upsert 로 덮어쓰므로, 여기서는 제약을 만족시키는
    -- 임시값이면 족하다. 앱의 닉네임 규칙(2~12자 한글·영문·숫자)도 만족시켜 두어야
    -- 사용자가 프로필에서 저장을 누를 때까지 화면이 깨지지 않는다.
    LOOP
      v_nickname := 'user' || upper(substring(md5(random()::text) FROM 1 FOR 8));
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.cta_user WHERE lower(nickname) = lower(v_nickname)
      );
    END LOOP;

    INSERT INTO public.cta_user (id, email, tier, exp, nickname, referral_code)
    VALUES (new.id, new.email, 'member', 0, v_nickname, v_code);
  END IF;
  RETURN new;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ── 3. cta_referral — 추천 관계 ────────────────────────────────────────
-- payment_log 가 이 테이블을 참조하므로 먼저 만든다.

CREATE TABLE IF NOT EXISTS public.cta_referral (
  id           BIGSERIAL   PRIMARY KEY,
  referrer_id  UUID        NOT NULL REFERENCES public.cta_user(id) ON DELETE CASCADE,
  referee_id   UUID        NOT NULL REFERENCES public.cta_user(id) ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','rewarded','cancelled')),
  rewarded_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 피추천인은 평생 한 번만 추천받는다. 보상 재지급의 1차 방어선이다.
  UNIQUE (referee_id),
  CONSTRAINT no_self_referral CHECK (referrer_id <> referee_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_referrer
  ON public.cta_referral (referrer_id, status);

ALTER TABLE public.cta_referral ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_select_own ON public.cta_referral;
CREATE POLICY referral_select_own ON public.cta_referral
  FOR SELECT USING (
    (SELECT auth.uid()) = referrer_id OR (SELECT auth.uid()) = referee_id
  );

-- ── 4. cta_subscription — 구독 상태 ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cta_subscription (
  id                    BIGSERIAL   PRIMARY KEY,
  user_id               UUID        NOT NULL UNIQUE
                        REFERENCES public.cta_user(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_subscription_period_end
  ON public.cta_subscription (status, current_period_end)
  WHERE status IN ('active', 'cancelled');

-- 30분마다 도는 재시도 잡이 훑는 경로. 부분 인덱스라 대상이 없을 때 비용이 0에 가깝다.
CREATE INDEX IF NOT EXISTS idx_subscription_retry
  ON public.cta_subscription (next_retry_at)
  WHERE status = 'past_due' AND next_retry_at IS NOT NULL;

DROP TRIGGER IF EXISTS set_subscription_updated_at ON public.cta_subscription;
CREATE TRIGGER set_subscription_updated_at
  BEFORE UPDATE ON public.cta_subscription
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cta_subscription ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_select_own ON public.cta_subscription;
CREATE POLICY subscription_select_own ON public.cta_subscription
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- RLS 는 행 단위라 빌링키 컬럼을 가리지 못한다. 컬럼 권한으로 따로 닫는다 —
-- 빌링키가 유출되면 customerKey 와 짝지어 임의 결제를 낼 수 있다.
-- 서버는 service_role(RLS·컬럼권한 우회)로 읽으므로 영향이 없다.
REVOKE ALL (toss_billing_key, toss_customer_key)
  ON public.cta_subscription FROM anon, authenticated;

-- ── 5. cta_payment_log — 결제 이력 ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cta_payment_log (
  id               BIGSERIAL   PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES public.cta_user(id) ON DELETE CASCADE,
  subscription_id  BIGINT      REFERENCES public.cta_subscription(id) ON DELETE SET NULL,
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
  referral_id      BIGINT      REFERENCES public.cta_referral(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_log_user
  ON public.cta_payment_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_log_payment_key
  ON public.cta_payment_log (toss_payment_key)
  WHERE toss_payment_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_log_subscription
  ON public.cta_payment_log (subscription_id);

CREATE INDEX IF NOT EXISTS idx_payment_log_referral
  ON public.cta_payment_log (referral_id);

ALTER TABLE public.cta_payment_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_log_select_own ON public.cta_payment_log;
CREATE POLICY payment_log_select_own ON public.cta_payment_log
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- ── 6. cta_pro_reward — 보상 지급 이력 ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cta_pro_reward (
  id           BIGSERIAL   PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES public.cta_user(id) ON DELETE CASCADE,
  reward_days  INT         NOT NULL DEFAULT 30,
  reason       TEXT        NOT NULL
               CHECK (reason IN ('referral_given','referral_received','payment','manual_admin')),
  referral_id  BIGINT      REFERENCES public.cta_referral(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pro_reward_user
  ON public.cta_pro_reward (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pro_reward_referral
  ON public.cta_pro_reward (referral_id);

ALTER TABLE public.cta_pro_reward ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pro_reward_select_own ON public.cta_pro_reward;
CREATE POLICY pro_reward_select_own ON public.cta_pro_reward
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- ── 7. extend_pro() — 구독 기간 연장 ───────────────────────────────────
--
-- 결제 성공과 추천 보상이 공유하는 유일한 연장 경로다. 남은 기간이 있으면 그 끝에
-- 이어 붙이고, 만료됐으면 지금부터 센다 — 그래서 결제 직후 추천 보상이 들어와도
-- 하루도 사라지지 않는다.

CREATE OR REPLACE FUNCTION public.extend_pro(
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
  FROM public.cta_subscription WHERE user_id = p_user_id FOR UPDATE;

  IF v_base IS NULL THEN
    -- 구독 행이 없다 = 결제 없이 보상만 받은 사용자. 빌링키가 없으므로 자동 갱신
    -- 대상이 아니고, 기간이 끝나면 pg_cron 이 member 로 되돌린다.
    INSERT INTO public.cta_subscription (
      user_id, status, current_period_start, current_period_end,
      toss_billing_key, toss_customer_key, cancel_at_period_end
    ) VALUES (
      p_user_id, 'active', NOW(), NOW() + (p_days || ' days')::INTERVAL,
      NULL, NULL, true
    );
  ELSE
    UPDATE public.cta_subscription SET
      status               = 'active',
      current_period_end   = v_base + (p_days || ' days')::INTERVAL,
      cancel_at_period_end = CASE WHEN toss_billing_key IS NULL THEN true ELSE cancel_at_period_end END,
      retry_count          = 0,
      next_retry_at        = NULL,
      updated_at           = NOW()
    WHERE user_id = p_user_id;
  END IF;

  UPDATE public.cta_user SET tier = 'pro' WHERE id = p_user_id AND tier <> 'admin';

  INSERT INTO public.cta_pro_reward (user_id, reward_days, reason, referral_id)
  VALUES (p_user_id, p_days, p_reason, p_referral_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.extend_pro(UUID, INT, TEXT, BIGINT)
  FROM PUBLIC, anon, authenticated;

-- ── 8. grant_referral_rewards() — 추천 보상 원자화 ─────────────────────
--
-- 양쪽 +30일을 한 트랜잭션에서 처리한다. 상태 전환을 먼저 해 두므로 중복 호출이
-- 와도 두 번째부터는 조용히 빠져나간다(멱등).

CREATE OR REPLACE FUNCTION public.grant_referral_rewards(
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
    FROM public.cta_referral
   WHERE id = p_referral_id
   FOR UPDATE;

  IF NOT FOUND OR v_status <> 'pending' THEN
    RETURN false;  -- 이미 처리됐거나 없는 추천 — 재지급하지 않는다
  END IF;

  UPDATE public.cta_referral
     SET status = 'rewarded', rewarded_at = NOW()
   WHERE id = p_referral_id;

  PERFORM public.extend_pro(v_referee_id,  30, 'referral_received', p_referral_id);
  PERFORM public.extend_pro(v_referrer_id, 30, 'referral_given',    p_referral_id);

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_referral_rewards(BIGINT)
  FROM PUBLIC, anon, authenticated;

-- ── 9. tier 를 서버 전용으로 잠근다 ────────────────────────────────────
--
-- 설계 문서는 이것을 RLS UPDATE 정책(WITH CHECK 안에서 cta_user 를 다시 SELECT)으로
-- 적었지만 그대로 쓸 수 없다. 같은 테이블의 정책 안에서 그 테이블을 조회하면 Postgres 가
-- "infinite recursion detected in policy" 로 거절한다. 게다가 cta_user 에는 지금 UPDATE
-- 정책이 아예 없어서(=클라이언트는 이미 UPDATE 불가) 정책을 새로 만드는 쪽이 오히려
-- 권한을 넓히는 방향이다.
--
-- 그래서 트리거로 막는다. 어떤 경로로 들어오든 tier 를 바꾸려면 service_role 이거나
-- 테이블 소유자여야 한다. SECURITY DEFINER 함수(extend_pro)의 UPDATE 는 정의자인
-- postgres 권한으로 돌므로 통과한다.

CREATE OR REPLACE FUNCTION public.guard_cta_user_tier()
  RETURNS trigger LANGUAGE plpgsql
  SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.tier IS DISTINCT FROM OLD.tier
     AND current_user NOT IN ('service_role', 'postgres', 'supabase_admin')
  THEN
    RAISE EXCEPTION 'tier 는 서버(service_role)만 변경할 수 있습니다.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_cta_user_tier() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_tier_change ON public.cta_user;
CREATE TRIGGER guard_tier_change
  BEFORE UPDATE OF tier ON public.cta_user
  FOR EACH ROW EXECUTE FUNCTION public.guard_cta_user_tier();

-- ── 10. cta_user SELECT 정책에 익명 제외 필터 ──────────────────────────
--
-- Supabase 어드바이저가 지적한 항목이다. 익명 세션은 cta_user 행이 없어서 실제로
-- 새는 것은 없지만, 정책이 anon 롤에도 걸려 있으면 나중에 익명 사용자에게 행을
-- 만들어 주는 변경이 들어올 때 조용히 열린다. 술어에서 먼저 닫는다.
ALTER POLICY "Users can select their own data" ON public.cta_user
  USING (
    (SELECT auth.uid()) = id
    AND coalesce(((SELECT auth.jwt()) ->> 'is_anonymous')::boolean, false) IS NOT TRUE
  );
