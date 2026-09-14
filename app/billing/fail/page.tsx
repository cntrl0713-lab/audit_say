import Link from 'next/link';

export const metadata = { title: '카드 등록 결과 | Audit Say', robots: { index: false, follow: false } };

const MESSAGES: Record<string, string> = {
    PAY_PROCESS_CANCELED: '카드 등록을 취소했습니다. 원할 때 다시 시작할 수 있습니다.',
    USER_CANCEL: '카드 등록을 취소했습니다. 원할 때 다시 시작할 수 있습니다.',
    PAY_PROCESS_ABORTED: '카드 등록이 중단되었습니다. 잠시 후 다시 시도해 주세요.',
    REJECT_CARD_COMPANY: '카드사에서 거절했습니다. 카드 정보를 확인하거나 다른 카드를 등록해 주세요.',
};

export default async function BillingFailPage({ searchParams }: {
    searchParams: Promise<{ code?: string | string[]; message?: string | string[] }>;
}) {
    const { code } = await searchParams;
    const message = typeof code === 'string' ? MESSAGES[code] : null;
    return <section className="mx-auto w-full max-w-xl rounded-panel border border-card-border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold">카드 등록이 완료되지 않았습니다</h1>
        <p className="mt-4 text-sm leading-6 text-muted">{message || '카드 등록을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.'}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/pricing" className="min-h-11 rounded-control bg-primary px-4 py-3 text-sm text-primary-foreground hover:bg-primary-hover">다시 시도</Link>
            <Link href="/mypage/subscription" className="min-h-11 rounded-control border border-card-border px-4 py-3 text-sm hover:bg-surface-soft">구독 관리</Link>
        </div>
    </section>;
}
