import Link from 'next/link';
import { Check, Gift } from 'lucide-react';
import PricingCheckout from '../../components/PricingCheckout';
import { AccountError } from '../../lib/accountPolicy';
import { authenticatedBilling } from '../../lib/billing/server';
import { PRO_MONTHLY_PRICE, PRO_PERIOD_DAYS } from '../../lib/billing/plan';
import { formatBillingDate } from '../../lib/billing/client';
import { customerKeyFor, isBillingConfigured } from '../../lib/toss';

export const metadata = { title: '요금제 | Audit Say' };
export const dynamic = 'force-dynamic';

type CheckoutState = { kind: 'login' | 'account' | 'unavailable'; message: string }
    | { kind: 'manage'; periodEnd: string | null; isActive: boolean }
    | { kind: 'checkout'; membershipVersion: number; customerKey: string; customerEmail: string | null; periodEnd: string | null };

async function readCheckout(): Promise<CheckoutState> {
    try {
        const { user, membership, admin } = await authenticatedBilling();
        const { data: subscription, error } = await admin.from('cpa_subscription')
            .select('status,current_period_end,cancel_at_period_end,toss_billing_key')
            .eq('user_id', user.id).eq('membership_version', membership.membership_version).maybeSingle();
        if (error) return { kind: 'unavailable', message: '구독 상태를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.' };
        const active = !!subscription && ['active', 'cancelled'].includes(subscription.status)
            && !!subscription.current_period_end && new Date(subscription.current_period_end).getTime() > Date.now();
        // Reward-only and cancelled subscriptions can register a card again. An
        // automatic subscription must go to management, including renewal retries.
        if (subscription?.toss_billing_key && ['active', 'past_due'].includes(subscription.status) && !subscription.cancel_at_period_end) {
            return { kind: 'manage', periodEnd: subscription.current_period_end, isActive: active };
        }
        if (!isBillingConfigured()) return { kind: 'unavailable', message: '결제 준비 중입니다. 준비가 완료되면 이 화면에서 구독할 수 있습니다.' };
        return { kind: 'checkout', membershipVersion: membership.membership_version, customerKey: customerKeyFor(user.id), customerEmail: user.email ?? null,
            periodEnd: active ? subscription.current_period_end : null };
    } catch (error) {
        if (error instanceof AccountError && error.status === 401) return { kind: 'login', message: '구독하려면 이메일 인증을 마친 회원 계정으로 로그인해 주세요.' };
        if (error instanceof AccountError && [403, 409].includes(error.status)) return { kind: 'account', message: error.message };
        return { kind: 'unavailable', message: '결제 정보를 준비하지 못했습니다. 잠시 후 다시 확인해 주세요.' };
    }
}

export default async function PricingPage() {
    const checkout = await readCheckout();
    const proActive = (checkout.kind === 'manage' && checkout.isActive) || (checkout.kind === 'checkout' && !!checkout.periodEnd);
    const plans = [
        { label: '일반 회원', price: '무료', period: '회원가입 후 이용', highlight: false,
            features: ['문제 풀이와 AI 채점', '풀이 기록과 오답노트', '커리큘럼과 학습 랭킹'] },
        { label: 'Pro', price: `${PRO_MONTHLY_PRICE.toLocaleString('ko-KR')}원`, period: `${PRO_PERIOD_DAYS}일마다 자동 결제`, highlight: true,
            features: [`Pro 이용권 ${PRO_PERIOD_DAYS}일`, '남은 이용 기간에 이어서 추가', '추천인과 나 모두 추가 이용 기간', '언제든 자동 결제 해지'] },
    ];

    return <div className="mx-auto w-full max-w-4xl space-y-7 py-4 md:py-8">
        <header className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Audit Say Membership</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">요금제</h1>
            <p className="mt-4 text-sm leading-7 text-muted">현재 학습 기능은 일반 회원도 무료로 이용할 수 있습니다. Pro 구독은 {PRO_PERIOD_DAYS}일 단위로 자동 갱신되며, 세법학 서비스의 이용권과 별도로 관리됩니다.</p>
        </header>
        <div className="grid gap-5 md:grid-cols-2">
            {plans.map(plan => <section key={plan.label} className={`rounded-panel border bg-card p-6 md:p-8 ${plan.highlight ? 'border-primary' : 'border-card-border'}`}>
                <div className="flex items-center justify-between"><h2 className="text-base font-semibold">{plan.label}</h2>{plan.highlight && proActive && <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">이용 중</span>}</div>
                <p className="mt-6 text-3xl font-semibold tracking-tight">{plan.price}</p>
                <p className="mt-2 text-sm text-muted">{plan.period}</p>
                <ul className="mt-6 space-y-3">{plan.features.map(feature => <li key={feature} className="flex items-start gap-2 text-sm"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />{feature}</li>)}</ul>
            </section>)}
        </div>
        <section className="flex gap-4 rounded-panel border border-card-border bg-surface-soft p-6">
            <Gift aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
            <div><h2 className="text-base font-semibold">함께 시작하면, 양쪽 모두 {PRO_PERIOD_DAYS}일 추가</h2><p className="mt-2 text-sm leading-7 text-muted">첫 결제 시 추천인 닉네임을 입력해 주세요. 결제 후 30일 동안 환불이 없으면 추천인과 나 모두 {PRO_PERIOD_DAYS}일을 받습니다. 남은 이용 기간이 있으면 그 끝에 추가됩니다.</p></div>
        </section>
        {checkout.kind === 'checkout' ? <>
            {checkout.periodEnd && <p className="rounded-control border border-card-border p-4 text-sm leading-6 text-muted">현재 {formatBillingDate(checkout.periodEnd)}까지 이용할 수 있습니다. 지금 구독하면 {PRO_MONTHLY_PRICE.toLocaleString('ko-KR')}원이 결제되고 남은 기간에 {PRO_PERIOD_DAYS}일이 추가됩니다.</p>}
            <PricingCheckout membershipVersion={checkout.membershipVersion} clientKey={process.env.NEXT_PUBLIC_CPA_TOSS_CLIENT_KEY!} customerKey={checkout.customerKey} customerEmail={checkout.customerEmail} />
        </> : <section className="rounded-panel border border-card-border bg-card p-6 md:p-8">
            {checkout.kind === 'manage' ? <>
                <h2 className="text-lg font-semibold">자동 결제가 등록되어 있습니다</h2>
                <p className="mt-3 text-sm leading-6 text-muted">{checkout.isActive && checkout.periodEnd ? `${formatBillingDate(checkout.periodEnd)}까지 Pro를 이용할 수 있습니다.` : '구독 관리에서 현재 결제 상태와 이용 기간을 확인해 주세요.'}</p>
                <Link href="/mypage/subscription" className="mt-5 inline-flex min-h-11 items-center rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover">구독 관리</Link>
            </> : <>
                <p className="text-sm leading-6 text-muted" role={checkout.kind === 'unavailable' ? 'status' : undefined}>{checkout.message}</p>
                {checkout.kind !== 'unavailable' && <Link href={checkout.kind === 'login' ? '/login' : '/account'} className="mt-5 inline-flex min-h-11 items-center rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover">{checkout.kind === 'login' ? '로그인 · 회원가입' : '계정 관리 · 감사 서비스 이용 시작'}</Link>}
            </>}
        </section>}
    </div>;
}
