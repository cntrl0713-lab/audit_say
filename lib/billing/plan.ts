/**
 * 요금제 상수와 결제 주기 계산.
 *
 * 금액·주기·재시도 간격이 라우트·Edge Function·화면 세 곳에 흩어지면
 * 「화면에는 9,900원인데 실제로는 다른 금액이 승인되는」 종류의 사고가 난다.
 * 값을 여기 한 곳에만 둔다.
 *
 * Edge Function(Deno)은 이 파일을 import 할 수 없으므로 같은 값을
 * `supabase/functions/process-cpa-billing/index.ts` 에도 적어 두었다. 한쪽을 고치면
 * 다른 쪽도 고쳐야 하며, tests/billingApi.test.ts 가 두 값이 어긋나면 실패한다.
 */

/** pro 월 구독료(원). cpa_payment_log.amount 의 기본값과 같아야 한다. */
export const PRO_MONTHLY_PRICE = 9900

/**
 * 결제 1회가 부여하는 이용 기간(일). 추천 보상 1건도 같은 길이다.
 *
 * **기간을 더하는 규칙 자체는 DB 의 `cpa_extend_pro()` 가 단독으로 갖는다** — 남은 기간이
 * 있으면 그 끝에서, 없으면 지금부터 센다. 앱에서 같은 계산을 다시 구현하면 두 벌이
 * 어긋날 뿐 막을 수 있는 사고가 없으므로, 여기서는 일수만 정하고 계산은 넘긴다.
 */
export const PRO_PERIOD_DAYS = 30

/** Toss 결제창·영수증에 표시되는 주문명 */
export const PRO_ORDER_NAME = 'Audit Say pro 구독 (1개월)'

/**
 * 결제 실패 후 다음 재시도 시각. `null` 이면 재시도를 멈추고 구독을 만료시킨다.
 *
 * **간격을 스케줄이 아니라 데이터로 정하는 이유**: 1h·12h·24h 를 pg_cron 잡 3개로
 * 나누면 실패 시각과 잡 시각이 어긋나 실제 간격이 최대 한 주기만큼 흔들린다.
 * 실패할 때마다 이 함수로 다음 시각을 계산해 적어 두고, 30분 잡이 「때가 된 것」만
 * 고르면 간격이 의도대로 지켜진다.
 *
 * @param retryCount 이번 실패까지 누적된 실패 횟수(1부터 시작)
 */
export function calcNextRetryAt(retryCount: number, now: Date = new Date()): Date | null {
    const HOUR = 60 * 60 * 1000
    if (retryCount === 1) return new Date(now.getTime() + 1 * HOUR)
    if (retryCount === 2) return new Date(now.getTime() + 12 * HOUR)
    if (retryCount === 3) return new Date(now.getTime() + 24 * HOUR)
    return null
}

/** 재시도를 더 하지 않고 만료 처리해야 하는 실패 횟수 */
export const MAX_BILLING_RETRIES = 3

/**
 * Toss 주문번호를 만든다.
 *
 * Toss 규격은 영문·숫자·`-`·`_` 6~64자다. `cpa_payment_log.toss_order_id` 에 UNIQUE 가
 * 걸려 있어 이 값이 결제 멱등성의 최종 방어선이므로, 시각만으로 만들지 않고
 * 난수를 섞는다(같은 밀리초에 두 요청이 들어오는 경우).
 */
export function generateOrderId(prefix = 'cpa'): string {
    const stamp = Date.now().toString(36)
    const rand = Math.random().toString(36).slice(2, 10)
    return `${prefix}_${stamp}_${rand}`
}
