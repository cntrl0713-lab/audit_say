import Link from 'next/link';
import BillingSuccess from '../../../components/BillingSuccess';

export const metadata = { title: '결제 처리 | Audit Say', robots: { index: false, follow: false }, referrer: 'no-referrer' as const };

export default async function BillingSuccessPage({ searchParams }: {
    searchParams: Promise<{ customerKey?: string | string[]; authKey?: string | string[]; membershipVersion?: string | string[] }>;
}) {
    const { customerKey, authKey, membershipVersion: rawVersion } = await searchParams;
    const membershipVersion = typeof rawVersion === 'string' && /^[1-9]\d*$/.test(rawVersion) ? Number(rawVersion) : NaN;
    if (typeof customerKey !== 'string' || !customerKey || customerKey.length > 200
        || typeof authKey !== 'string' || !authKey || authKey.length > 2048 || !Number.isSafeInteger(membershipVersion)) {
        return <section className="mx-auto w-full max-w-xl rounded-panel border border-card-border bg-card p-8 text-center">
            <h1 className="text-xl font-semibold">결제 정보를 찾을 수 없습니다</h1>
            <p className="mt-3 text-sm leading-6 text-muted">카드 등록 결과가 올바르게 전달되지 않았습니다. 구독 상태를 확인한 뒤 다시 시작해 주세요.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link href="/mypage/subscription" className="min-h-11 rounded-control bg-primary px-4 py-3 text-sm text-primary-foreground">구독 관리</Link>
                <Link href="/pricing" className="min-h-11 rounded-control border border-card-border px-4 py-3 text-sm">요금제</Link>
            </div>
        </section>;
    }
    return <BillingSuccess key={authKey} customerKey={customerKey} authKey={authKey} membershipVersion={membershipVersion} />;
}
