'use client';

import { startTransition, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import { getReviewItemsAction, updateReviewItemAction } from '../actions';
import { Loading } from '../../components/Loading';
import type { ReviewItem, ReviewItemStatus } from '../../lib/learningTypes';

const filters: Array<{ status: ReviewItemStatus; label: string }> = [
    { status: 'open', label: '복습 중' }, { status: 'resolved', label: '해결 완료' }, { status: 'removed', label: '해제한 물음' },
];

export default function ReviewNotesClient({ learningDbEnabled }: { learningDbEnabled: boolean }) {
    const { user, loading: authLoading } = useAuth();
    const userId = user?.id;
    const userRole = user?.role;
    const [filter, setFilter] = useState<ReviewItemStatus>('open');
    const [data, setData] = useState<{ owner: string; items: ReviewItem[] } | null>(null);
    const [memos, setMemos] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [saving, setSaving] = useState<string | null>(null);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        if (!learningDbEnabled || !userId || userRole === 'GUEST') return;
        let cancelled = false;
        startTransition(async () => {
            setLoading(true);
            setError(null);
            try {
                const items = await getReviewItemsAction(filter);
                if (cancelled) return;
                setData({ owner: userId, items });
            } catch (loadError) {
                if (!cancelled) setError(loadError instanceof Error ? loadError.message : '오답노트를 불러오지 못했습니다.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        });
        return () => { cancelled = true; };
    }, [learningDbEnabled, userId, userRole, filter, reload]);

    const save = (item: ReviewItem, status: ReviewItemStatus) => {
        if (saving) return;
        setSaving(item.id);
        setError(null);
        setNotice(null);
        startTransition(async () => {
            try {
                const response = await updateReviewItemAction({ subquestion_id: item.subquestion_id, status, memo: memos[`${userId}:${item.id}`] ?? item.memo });
                if (!response.ok) { setError(response.message); return; }
                setNotice(status === item.status ? '메모를 저장했습니다.' : status === 'resolved' ? '해결 완료로 표시했습니다.' : status === 'removed' ? '오답노트에서 해제했습니다.' : '복습 중으로 옮겼습니다.');
                setReload((value) => value + 1);
            } catch (saveError) {
                setError(saveError instanceof Error ? saveError.message : '오답노트를 저장하지 못했습니다.');
            } finally {
                setSaving(null);
            }
        });
    };

    if (!learningDbEnabled) return <div className="mx-auto w-full max-w-3xl space-y-3"><h1 className="text-xl">오답노트</h1><p className="text-sm text-foreground/60">물음별 오답노트 기능을 준비하고 있습니다. 문제를 풀고 채점 결과에서 답안을 비교해 보세요.</p><Link href="/quiz" className="text-sm text-primary">문제 풀기</Link></div>;
    if (authLoading) return <Loading label="사용자 정보 불러오는 중" />;
    if (!user || user.role === 'GUEST') return <div className="mx-auto w-full max-w-3xl space-y-3"><h1 className="text-xl">오답노트</h1><p className="text-sm text-foreground/60">오답노트는 회원 기능입니다. 비회원 풀이 결과는 풀이 기록에서 7일간 확인할 수 있습니다.</p><Link href={user ? '/history' : '/'} className="text-sm text-primary">{user ? '풀이 기록 보기' : '로그인하기'}</Link></div>;
    const items = data?.owner === user.id ? data.items : [];

    return <div className="mx-auto w-full max-w-4xl space-y-6">
        <header><h1 className="text-xl">오답노트</h1><p className="mt-2 text-sm leading-6 text-foreground/60">감점된 물음이 자동으로 모입니다. 다시 풀어 만점을 받아도 직접 해결 표시할 때까지 유지됩니다.</p></header>
        <div className="flex flex-wrap items-center gap-2" aria-label="오답노트 상태">
            {filters.map(({ status, label }) => <button type="button" key={status} aria-pressed={filter === status} onClick={() => { if (status === filter) return; setLoading(true); setFilter(status); setNotice(null); }} className={`rounded-md border px-3 py-2 text-sm ${filter === status ? 'border-primary bg-primary/10 text-primary' : 'border-card-border text-foreground/60'}`}>{label}</button>)}
            <button type="button" onClick={() => setReload((value) => value + 1)} className="ml-auto text-sm text-foreground/55">새로고침</button>
        </div>
        {error && <p role="alert" className="rounded-lg border border-danger/30 p-4 text-sm text-danger">{error}</p>}
        {notice && <p role="status" className="text-sm text-success">{notice}</p>}
        {loading ? <Loading label="오답노트 불러오는 중" /> : !error && items.length === 0 ? <div className="rounded-lg border border-card-border p-6 text-sm text-foreground/55">이 상태에 해당하는 물음이 없습니다. 채점 결과에서도 물음을 직접 추가할 수 있습니다.</div> : items.map((item) => (
            <article key={item.id} className="space-y-4 rounded-lg border border-card-border bg-card p-5">
                <header className="flex flex-wrap items-start justify-between gap-3"><h2 className="text-sm font-medium">{item.title}</h2><span className="text-xs text-foreground/45">{new Date(item.updated_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</span></header>
                <p className="whitespace-pre-wrap text-sm leading-7">{item.prompt}</p>
                <div><label htmlFor={`memo-${item.id}`} className="text-xs text-foreground/55">복습 메모</label><textarea id={`memo-${item.id}`} rows={3} maxLength={5000} value={memos[`${userId}:${item.id}`] ?? item.memo} onChange={(event) => setMemos((current) => ({ ...current, [`${userId}:${item.id}`]: event.target.value }))} placeholder="놓친 개념이나 다음에 확인할 내용을 적어보세요." className="mt-2 w-full rounded-md border border-card-border p-3 text-sm leading-6 outline-none focus:border-primary" /></div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <button type="button" disabled={saving !== null} onClick={() => save(item, item.status)} className="rounded-md border border-card-border px-3 py-2 disabled:opacity-50">{saving === item.id ? '저장 중…' : '메모 저장'}</button>
                    {item.status !== 'resolved' && <button type="button" disabled={saving !== null} onClick={() => save(item, 'resolved')} className="rounded-md border border-success/30 px-3 py-2 text-success disabled:opacity-50">해결 표시</button>}
                    {item.status !== 'open' && <button type="button" disabled={saving !== null} onClick={() => save(item, 'open')} className="rounded-md border border-primary/30 px-3 py-2 text-primary disabled:opacity-50">다시 복습</button>}
                    {item.status !== 'removed' && <button type="button" disabled={saving !== null} onClick={() => save(item, 'removed')} className="rounded-md border border-card-border px-3 py-2 text-foreground/55 disabled:opacity-50">해제</button>}
                    {item.last_failed_attempt_id && <Link href={`/history?attempt=${encodeURIComponent(item.last_failed_attempt_id)}`} className="px-2 py-2 text-primary">오답 당시 풀이</Link>}
                    {item.last_attempt_id && item.last_attempt_id !== item.last_failed_attempt_id && <Link href={`/history?attempt=${encodeURIComponent(item.last_attempt_id)}`} className="px-2 py-2 text-primary">최근 풀이 보기</Link>}
                    <Link href={`/quiz?set=${encodeURIComponent(item.question_set_id)}`} className="px-2 py-2 text-primary">문제 풀기</Link>
                </div>
            </article>
        ))}
    </div>;
}
