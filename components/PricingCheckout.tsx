'use client';

import { useRef, useState } from 'react';
import Script from 'next/script';
import { CreditCard, LoaderCircle } from 'lucide-react';
import { validateNickname } from '../lib/accountPolicy';
import { billingRequest, billingErrorMessage, referrerStorageKey } from '../lib/billing/client';
import { PRO_MONTHLY_PRICE, PRO_PERIOD_DAYS } from '../lib/billing/plan';
import type { ReferralValidateResponse } from '../lib/billing/types';

declare global {
    interface Window {
        TossPayments?: (clientKey: string) => {
            payment: (options: { customerKey: string }) => {
                requestBillingAuth: (options: {
                    method: 'CARD'; successUrl: string; failUrl: string; customerEmail?: string;
                }) => Promise<void>;
            };
        };
    }
}

interface PricingCheckoutProps {
    membershipVersion: number;
    clientKey: string;
    customerKey: string;
    customerEmail: string | null;
}

export default function PricingCheckout({ membershipVersion, clientKey, customerKey, customerEmail }: PricingCheckoutProps) {
    const [sdkReady, setSdkReady] = useState(false);
    const [nickname, setNickname] = useState('');
    const [checking, setChecking] = useState(false);
    const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const busy = useRef(false);

    async function validateReferrer() {
        const normalized = validateNickname(nickname);
        const result = await billingRequest<ReferralValidateResponse>('/api/referral/validate', { nickname: normalized });
        setNotice({ ok: true, text: `${result.referrerNickname} 님을 확인했습니다.` });
        return result.referrerNickname;
    }

    async function handleValidate() {
        if (busy.current) return;
        busy.current = true;
        setChecking(true);
        setNotice(null);
        try { await validateReferrer(); }
        catch (error) { setNotice({ ok: false, text: billingErrorMessage(error) }); }
        finally { busy.current = false; setChecking(false); }
    }

    async function handleSubscribe() {
        if (busy.current) return;
        if (!sdkReady || !window.TossPayments) {
            setError('결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
            return;
        }
        busy.current = true;
        setStarting(true);
        setError(null);
        try {
            const referrer = nickname.trim() ? await validateReferrer() : null;
            const key = referrerStorageKey(customerKey, membershipVersion);
            try {
                if (referrer) sessionStorage.setItem(key, referrer);
                else sessionStorage.removeItem(key);
            } catch {
                if (referrer) throw new Error('추천인 정보를 보관할 수 없습니다. 브라우저의 사이트 저장 공간을 허용한 뒤 다시 시도해 주세요.');
            }
            await window.TossPayments(clientKey).payment({ customerKey }).requestBillingAuth({
                method: 'CARD',
                successUrl: `${window.location.origin}/billing/success?membershipVersion=${membershipVersion}`,
                failUrl: `${window.location.origin}/billing/fail`,
                ...(customerEmail ? { customerEmail } : {}),
            });
        } catch (error) {
            const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
            const message = billingErrorMessage(error);
            if (!/CANCEL|취소/i.test(code + message)) setError(message);
        } finally {
            busy.current = false;
            setStarting(false);
        }
    }

    return <>
        <Script src="https://js.tosspayments.com/v2/standard" strategy="afterInteractive"
            onReady={() => { setSdkReady(true); setError(null); }}
            onError={() => { setSdkReady(false); setError('결제 모듈을 불러오지 못했습니다. 새로고침해 주세요.'); }} />
        <section className="rounded-panel border border-card-border bg-card p-6 md:p-8" aria-labelledby="checkout-title">
            <h2 id="checkout-title" className="text-lg font-semibold">Pro 구독 시작</h2>
            <p className="mt-2 text-sm leading-6 text-muted">카드를 등록하면 {PRO_MONTHLY_PRICE.toLocaleString('ko-KR')}원이 결제되고 {PRO_PERIOD_DAYS}일 이용 기간이 추가됩니다.</p>
            <div className="mt-6 max-w-lg space-y-3">
                <label htmlFor="referrer-nickname" className="block text-sm font-medium">추천인 닉네임 <span className="font-normal text-muted">(선택)</span></label>
                <div className="flex gap-2">
                    <input id="referrer-nickname" type="text" autoComplete="off" maxLength={12} value={nickname}
                        placeholder="추천해 준 회원의 닉네임" aria-describedby="referrer-help referrer-notice"
                        disabled={checking || starting}
                        onChange={event => { setNickname(event.target.value); setNotice(null); setError(null); }}
                        className="min-h-11 min-w-0 flex-1 rounded-control border border-card-border bg-background px-3 text-sm focus:border-primary focus:outline-none disabled:opacity-60" />
                    <button type="button" onClick={() => { void handleValidate(); }} disabled={checking || starting || !nickname.trim()}
                        className="min-h-11 shrink-0 rounded-control border border-card-border px-4 text-sm hover:bg-surface-soft disabled:opacity-50">{checking ? '확인 중' : '확인'}</button>
                </div>
                <p id="referrer-notice" aria-live="polite" className={`text-sm ${notice?.ok ? 'text-success' : 'text-danger'}`}>{notice?.text}</p>
                <p id="referrer-help" className="text-sm leading-6 text-muted">첫 결제 후 30일 동안 환불이 없으면 추천인과 나 모두 <strong className="text-foreground">{PRO_PERIOD_DAYS}일</strong>이 추가됩니다. 남은 기간이 있으면 그 끝에 이어 붙습니다.</p>
                {error && <p role="alert" className="rounded-control border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
                <button type="button" onClick={() => { void handleSubscribe(); }} disabled={starting || checking || !sdkReady}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50">
                    {starting ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <CreditCard aria-hidden="true" className="size-4" />}
                    {starting ? '결제창을 여는 중' : `카드 등록하고 ${PRO_MONTHLY_PRICE.toLocaleString('ko-KR')}원 결제`}
                </button>
                <p className="text-xs leading-5 text-muted">이후 {PRO_PERIOD_DAYS}일마다 같은 금액이 자동 결제됩니다. 구독 관리에서 언제든 자동 결제를 해지할 수 있으며 남은 기간은 그대로 이용할 수 있습니다. Audit Say 이용권은 세법학 서비스 이용권과 별도입니다.</p>
            </div>
        </section>
    </>;
}
