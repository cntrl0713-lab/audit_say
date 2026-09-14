'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, LoaderCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { BillingRequestError, billingRequest, billingErrorMessage, formatBillingDate, referrerStorageKey, safeReceiptUrl } from '../lib/billing/client';
import type { BillingSetupRequest, BillingSetupResponse, BillingStatusResponse } from '../lib/billing/types';

type Phase = { kind: 'working' }
    | { kind: 'done'; periodEnd: string; referralPending: boolean; receiptUrl: string | null; recovered?: boolean }
    | { kind: 'failed'; message: string; canRetry: boolean };

export default function BillingSuccess({ authKey, customerKey, membershipVersion }: {
    authKey: string; customerKey: string; membershipVersion: number;
}) {
    const [phase, setPhase] = useState<Phase>({ kind: 'working' });
    const started = useRef(false);
    const busy = useRef(false);
    const originalRequest = useRef<BillingSetupRequest | null>(null);
    const { refreshProfile } = useAuth();

    const run = useCallback(async () => {
        if (busy.current) return;
        busy.current = true;
        setPhase({ kind: 'working' });
        const storageKey = referrerStorageKey(customerKey, membershipVersion);
        if (!originalRequest.current) {
            let referrerNickname: string | undefined;
            try { referrerNickname = sessionStorage.getItem(storageKey) || undefined; } catch { /* Referral is optional. */ }
            originalRequest.current = { authKey, customerKey, membershipVersion, referrerNickname };
        }
        try {
            const result = await billingRequest<BillingSetupResponse>('/api/billing/setup', originalRequest.current);
            setPhase({ kind: 'done', periodEnd: result.periodEnd, referralPending: result.referralPending, receiptUrl: safeReceiptUrl(result.receiptUrl) });
            try { sessionStorage.removeItem(storageKey); } catch { /* Server still prevents duplicate referrals. */ }
            void refreshProfile();
        } catch (error) {
            // A reload after a completed request must recover the existing subscription.
            // It must never open a new payment authorization from this callback.
            if (error instanceof BillingRequestError && error.code === 'ALREADY_SUBSCRIBED') {
                try {
                    const status = await billingRequest<BillingStatusResponse>('/api/billing/status');
                    if (status.membershipVersion === membershipVersion && status.isActive && status.hasBillingKey && status.periodEnd) {
                        setPhase({ kind: 'done', periodEnd: status.periodEnd, referralPending: false, receiptUrl: null, recovered: true });
                        try { sessionStorage.removeItem(storageKey); } catch { /* Best effort. */ }
                        void refreshProfile();
                        return;
                    }
                } catch { /* Keep the original error and offer an explicit status check. */ }
            }
            const canRetry = !(error instanceof BillingRequestError) || error.status >= 500 || error.status === 429
                || ['BILLING_IN_PROGRESS', 'PAYMENT_RECONCILIATION_PENDING', 'ALREADY_SUBSCRIBED', 'PAYMENT_PENDING'].includes(error.code ?? '');
            setPhase({ kind: 'failed', message: billingErrorMessage(error), canRetry });
        } finally { busy.current = false; }
    }, [authKey, customerKey, membershipVersion, refreshProfile]);

    useEffect(() => {
        if (started.current) return;
        started.current = true;
        // One initial request, including React Strict Mode's development remount.
        void run();
    }, [run]);

    return <section className="mx-auto w-full max-w-xl rounded-panel border border-card-border bg-card p-6 text-center md:p-10" aria-live="polite">
        {phase.kind === 'working' ? <>
            <LoaderCircle className="mx-auto size-9 animate-spin text-primary" aria-hidden="true" />
            <h1 className="mt-5 text-xl font-semibold">결제를 처리하고 있습니다</h1>
            <p className="mt-3 text-sm leading-6 text-muted">이 창을 닫지 말고 잠시 기다려 주세요.</p>
        </> : phase.kind === 'failed' ? <>
            <h1 className="text-xl font-semibold">결제 결과를 확인해 주세요</h1>
            <p role="alert" className="mt-4 text-sm leading-6 text-danger">{phase.message}</p>
            <p className="mt-3 text-sm leading-6 text-muted">처리 중인 결제는 구독 관리에서 확인할 수 있습니다. 결과 확인을 다시 시도하면 같은 결제 건을 이어서 확인합니다.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
                {phase.canRetry && <button type="button" onClick={() => { void run(); }} className="min-h-11 rounded-control bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover">결제 결과 다시 확인</button>}
                <Link href="/mypage/subscription" className="min-h-11 rounded-control border border-card-border px-4 py-3 text-sm hover:bg-surface-soft">구독 관리</Link>
                {!phase.canRetry && <Link href="/pricing" className="min-h-11 rounded-control border border-card-border px-4 py-3 text-sm hover:bg-surface-soft">요금제</Link>}
            </div>
        </> : <>
            <CheckCircle2 aria-hidden="true" className="mx-auto size-10 text-success" />
            <h1 className="mt-5 text-xl font-semibold">{phase.recovered ? 'Pro 구독을 확인했습니다' : 'Pro 구독이 시작되었습니다'}</h1>
            <p className="mt-4 text-sm leading-6 text-muted">{formatBillingDate(phase.periodEnd)}까지 이용할 수 있습니다.</p>
            {phase.referralPending && <p className="mt-4 rounded-control bg-success/10 p-4 text-sm leading-6 text-success">추천이 등록되었습니다. 첫 결제 후 30일 동안 환불이 없으면 추천인과 나 모두 30일이 추가됩니다.</p>}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link href="/quiz" className="min-h-11 rounded-control bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover">문제 풀러 가기</Link>
                <Link href="/mypage/subscription" className="min-h-11 rounded-control border border-card-border px-4 py-3 text-sm hover:bg-surface-soft">구독 관리</Link>
                {phase.receiptUrl && <a href={phase.receiptUrl} target="_blank" rel="noopener noreferrer" className="min-h-11 rounded-control border border-card-border px-4 py-3 text-sm hover:bg-surface-soft">영수증<span className="sr-only"> 새 탭</span></a>}
            </div>
        </>}
    </section>;
}
