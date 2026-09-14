'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CreditCard, Gift, LoaderCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { billingRequest, billingErrorMessage, formatBillingDate } from '../lib/billing/client';
import { PRO_MONTHLY_PRICE, PRO_PERIOD_DAYS } from '../lib/billing/plan';
import type { BillingCancelResponse, BillingStatusResponse, PaymentStatus, RewardReason } from '../lib/billing/types';

const REWARD_LABELS: Record<RewardReason, string> = {
    payment: '구독 결제', referral_given: '추천 보상 (내가 추천)', referral_received: '추천 보상 (추천받음)', manual_admin: '관리자 지급',
};
const PAYMENT_LABELS: Record<PaymentStatus, string> = { success: '결제 완료', failed: '결제 실패', cancelled: '결제 취소', refunded: '환불' };

export default function SubscriptionView() {
    const [status, setStatus] = useState<BillingStatusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [showCancel, setShowCancel] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [reloadToken, setReloadToken] = useState(0);
    const [loadedOwner, setLoadedOwner] = useState<string | null>(null);
    const busy = useRef(false);
    const { refreshProfile, user, account, loading: authLoading } = useAuth();
    const owner = user && user.role !== 'GUEST' ? `${user.id}:${account?.membership?.version ?? ''}` : null;

    useEffect(() => {
        if (!owner) return;
        const controller = new AbortController();
        void billingRequest<BillingStatusResponse>('/api/billing/status', undefined, controller.signal)
            .then(result => { if (!controller.signal.aborted) { setStatus(result); setError(null); } })
            .catch(error => { if (!controller.signal.aborted) setError(billingErrorMessage(error)); })
            .finally(() => { if (!controller.signal.aborted) { setLoading(false); setLoadedOwner(owner); } });
        return () => controller.abort();
    }, [reloadToken, owner]);

    function reload() {
        setLoading(true);
        setError(null);
        setShowCancel(false);
        setReloadToken(value => value + 1);
    }

    async function cancelSubscription() {
        if (busy.current || !status) return;
        busy.current = true;
        setCancelling(true);
        setActionError(null);
        try {
            const result = await billingRequest<BillingCancelResponse>('/api/billing/cancel', { membershipVersion: status.membershipVersion });
            setNotice(`자동 결제를 해지했습니다. ${formatBillingDate(result.accessUntil)}까지 이용할 수 있습니다.`);
            void refreshProfile();
            reload();
        } catch (error) { setActionError(billingErrorMessage(error)); }
        finally { busy.current = false; setCancelling(false); }
    }

    if (authLoading) return <div role="status" className="py-20 text-center text-sm text-muted">계정을 확인하는 중입니다.</div>;
    if (!owner) return <section className="mx-auto max-w-xl rounded-panel border border-card-border bg-card p-8">
        <h1 className="text-xl font-semibold">구독 관리</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{account ? '감사 서비스 가입 상태를 확인해 주세요.' : '로그인하면 내 구독과 추천 보상을 확인할 수 있습니다.'}</p>
        <Link href={account ? '/account' : '/login'} className="mt-5 inline-flex min-h-11 items-center rounded-control bg-primary px-4 text-sm text-primary-foreground">{account ? '계정 관리' : '로그인 · 회원가입'}</Link>
    </section>;
    if (loading || loadedOwner !== owner) return <div role="status" className="flex items-center justify-center gap-2 py-20 text-sm text-muted"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />구독 정보를 불러오는 중입니다.</div>;
    if (error || !status) return <section className="mx-auto max-w-xl rounded-panel border border-card-border bg-card p-8">
        <h1 className="text-xl font-semibold">구독 정보를 확인하지 못했습니다</h1>
        <p role="alert" className="mt-3 text-sm leading-6 text-muted">{error || '잠시 후 다시 시도해 주세요.'}</p>
        <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={reload} className="min-h-11 rounded-control bg-primary px-4 text-sm text-primary-foreground">다시 확인</button>
            <Link href="/account" className="inline-flex min-h-11 items-center rounded-control border border-card-border px-4 text-sm">계정 관리</Link>
            <Link href="/login" className="inline-flex min-h-11 items-center rounded-control border border-card-border px-4 text-sm">로그인</Link>
        </div>
    </section>;

    const canCancel = ['active', 'past_due'].includes(status.status ?? '') && status.hasBillingKey && !status.cancelAtPeriodEnd;
    const automatic = canCancel;
    const manualPro = account?.entitlement.kind === 'pro' && account.entitlement.expiresAt === null;
    const stateLabel = status.cancelAtPeriodEnd || status.status === 'cancelled' ? '자동 결제 해지됨'
        : status.status === 'past_due' ? '결제 실패 · 재시도 중'
            : status.isActive ? automatic ? '자동 갱신 중' : '이용권 사용 중'
                : status.status === 'active' && status.hasBillingKey ? '자동 결제 확인 중'
                    : manualPro ? '관리자 PRO 이용권' : status.status === 'expired' ? '이용 기간 만료' : '무료 회원';

    return <div className="mx-auto w-full max-w-3xl space-y-6 py-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
            <div><h1 className="text-2xl font-semibold">구독 관리</h1><p className="mt-2 text-sm text-muted">Audit Say 이용권, 결제 내역과 추천 보상을 확인합니다.</p></div>
            <Link href="/pricing" className="text-sm text-primary underline underline-offset-4">요금제 보기</Link>
        </header>
        {notice && <p role="status" className="rounded-control border border-success/30 bg-success/10 p-4 text-sm leading-6 text-success">{notice}</p>}
        <section className="rounded-panel border border-card-border bg-card p-6">
            <div className="flex flex-wrap items-center gap-3"><CreditCard aria-hidden="true" className="size-5 text-primary" /><h2 className="text-lg font-semibold">{status.isActive ? 'Pro' : '현재 이용 상태'}</h2><span className="rounded-full bg-surface-soft px-3 py-1 text-xs text-muted">{stateLabel}</span></div>
            {status.periodEnd ? <p className="mt-4 text-sm leading-6 text-muted">{status.isActive ? '이용 가능 기간' : '마지막 이용 기간'}: <strong className="font-medium text-foreground">{formatBillingDate(status.periodEnd)}</strong>까지</p>
                : <p className="mt-4 text-sm text-muted">아직 구독한 적이 없습니다.</p>}
            {manualPro && <p className="mt-3 text-sm leading-6 text-muted">관리자가 부여한 PRO 이용권을 사용 중입니다. 유료 구독의 해지·만료와 별도로 유지됩니다.</p>}
            {automatic && <p className="mt-2 text-sm leading-6 text-muted">{PRO_PERIOD_DAYS}일마다 {PRO_MONTHLY_PRICE.toLocaleString('ko-KR')}원이 자동 결제됩니다.</p>}
            {status.status === 'past_due' && <p className="mt-3 text-sm leading-6 text-danger">자동 결제에 실패해 재시도하고 있습니다. 아래 결제 내역에서 사유를 확인해 주세요.</p>}
            {status.isActive && !automatic && <p className="mt-3 text-sm leading-6 text-muted">남은 기간 동안 Pro를 이용할 수 있으며, 자동 결제는 진행되지 않습니다. 새로 구독하면 남은 기간에 {PRO_PERIOD_DAYS}일이 추가됩니다.</p>}
            <div className="mt-5">
                {canCancel ? <button type="button" onClick={() => { setShowCancel(true); setActionError(null); }} disabled={cancelling}
                    className="min-h-11 rounded-control border border-card-border px-4 text-sm hover:bg-surface-soft disabled:opacity-50">자동 결제 해지</button>
                    : <Link href="/pricing" className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover">{status.isActive ? '카드 등록하고 구독 재개' : 'Pro 구독하기'}</Link>}
            </div>
            {showCancel && <div className="mt-5 rounded-control border border-card-border bg-surface-soft p-4">
                <h3 className="text-sm font-semibold">자동 결제를 해지할까요?</h3>
                <p className="mt-2 text-sm leading-6 text-muted">이후 자동 결제만 중단되며, 남은 이용 기간은 그대로 유지됩니다.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => { void cancelSubscription(); }} disabled={cancelling} className="min-h-11 rounded-control border border-danger/40 px-4 text-sm text-danger disabled:opacity-50">{cancelling ? '해지 중' : '자동 결제 해지 확정'}</button>
                    <button type="button" onClick={() => setShowCancel(false)} disabled={cancelling} className="min-h-11 rounded-control border border-card-border px-4 text-sm disabled:opacity-50">구독 유지</button>
                </div>
            </div>}
            {actionError && <p role="alert" className="mt-3 text-sm text-danger">{actionError}</p>}
        </section>
        <section className="rounded-panel border border-card-border bg-card p-6">
            <div className="flex items-center gap-2"><Gift aria-hidden="true" className="size-5 text-primary" /><h2 className="text-lg font-semibold">추천인 보상</h2></div>
            <p className="mt-4 text-sm leading-7 text-muted">내 닉네임 <strong className="rounded-control bg-surface-soft px-2 py-1 text-foreground">{status.nickname || '미설정'}</strong>을 알려 주세요. 상대가 첫 결제할 때 입력하고 30일 동안 환불이 없으면 <strong className="text-foreground">양쪽 모두 {PRO_PERIOD_DAYS}일</strong>이 추가됩니다.</p>
            <p className="mt-3 text-sm text-muted">내 추천으로 보상 지급이 완료된 회원: <strong className="text-foreground">{status.referredCount}명</strong></p>
            <p className="mt-2 text-xs leading-5 text-muted">추천 보상은 Audit Say 이용권에 적용됩니다. 세법학 서비스의 구독·보상과 별도로 관리됩니다.</p>
        </section>
        <section className="rounded-panel border border-card-border bg-card p-6">
            <h2 className="text-lg font-semibold">이용 기간 지급 내역</h2>
            {!status.rewardHistory.length ? <p className="mt-4 text-sm text-muted">아직 지급 내역이 없습니다.</p>
                : <ul className="mt-3 divide-y divide-card-border">{status.rewardHistory.map((reward, index) => <li key={`${reward.createdAt}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-4 text-sm">
                    <span>{REWARD_LABELS[reward.reason] ?? reward.reason}</span><span className="text-muted"><strong className="font-medium text-foreground">+{reward.days}일</strong> · {formatBillingDate(reward.createdAt)}</span>
                </li>)}</ul>}
        </section>
        <section className="rounded-panel border border-card-border bg-card p-6">
            <h2 className="text-lg font-semibold">결제 내역</h2>
            {!status.payments.length ? <p className="mt-4 text-sm text-muted">아직 결제 내역이 없습니다.</p>
                : <ul className="mt-3 divide-y divide-card-border">{status.payments.map((payment, index) => <li key={`${payment.createdAt}-${index}`} className="flex flex-wrap items-start justify-between gap-2 py-4 text-sm">
                    <div><p>{payment.amount.toLocaleString('ko-KR')}원 · <span className={payment.status === 'failed' ? 'text-danger' : 'text-muted'}>{PAYMENT_LABELS[payment.status]}</span></p>
                        {payment.failureMessage && <p className="mt-1 max-w-md text-xs leading-5 text-muted">{payment.failureMessage}</p>}</div>
                    <span className="text-muted">{formatBillingDate(payment.createdAt)}</span>
                </li>)}</ul>}
        </section>
    </div>;
}
