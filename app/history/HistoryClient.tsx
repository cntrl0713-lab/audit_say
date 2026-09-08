'use client';

import { startTransition, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import { getAttemptHistoryAction, getAttemptResultAction } from '../actions';
import { GradeResultDetails } from '../../components/GradeResultDetails';
import { Loading } from '../../components/Loading';
import type { AttemptHistoryItem, AttemptStatus } from '../../lib/learningTypes';
import type { QuestionSetGradeResultV3 } from '../../lib/questionV3Grading';
import { appendHistoryPage } from './historyPagination';

const statusLabels: Record<AttemptStatus, string> = {
    queued: '채점 대기', grading: '채점 중', completed: '채점 완료', failed: '채점 실패',
};

function localDate(value: string): string {
    return new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export default function HistoryClient({ learningDbEnabled }: { learningDbEnabled: boolean }) {
    const { user, loading: authLoading } = useAuth();
    const [history, setHistory] = useState<{ owner: string; items: AttemptHistoryItem[] } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [reload, setReload] = useState(0);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [detail, setDetail] = useState<{ owner: string; result: QuestionSetGradeResultV3 } | null>(null);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [pageError, setPageError] = useState<string | null>(null);
    const pageRequest = useRef(false);
    const historyGeneration = useRef(0);

    useEffect(() => {
        if (!learningDbEnabled || !user?.id) return;
        let cancelled = false;
        const userId = user.id;
        historyGeneration.current += 1;
        pageRequest.current = false;
        startTransition(async () => {
            setLoading(true);
            setLoadingMore(false);
            setError(null);
            setPageError(null);
            setHasMore(false);
            try {
                const items = await getAttemptHistoryAction();
                if (cancelled) return;
                setHistory({ owner: userId, items });
                setHasMore(items.length === 50);
                const requested = new URLSearchParams(window.location.search).get('attempt');
                if (requested) setSelectedId(requested);
            } catch (loadError) {
                if (!cancelled) setError(loadError instanceof Error ? loadError.message : '풀이 기록을 불러오지 못했습니다.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        });
        return () => { cancelled = true; historyGeneration.current += 1; };
    }, [learningDbEnabled, user?.id, reload]);

    const loadMore = () => {
        if (!user?.id || loading || pageRequest.current || !hasMore || history?.owner !== user.id) return;
        const last = history.items.at(-1);
        if (!last) return;
        const owner = user.id;
        const generation = historyGeneration.current;
        pageRequest.current = true;
        setLoadingMore(true);
        setPageError(null);
        startTransition(async () => {
            try {
                const nextPage = await getAttemptHistoryAction({ submitted_at: last.submitted_at, id: last.id });
                if (generation !== historyGeneration.current) return;
                setHistory((current) => current?.owner === owner
                    ? { owner, items: appendHistoryPage(current.items, nextPage) } : current);
                setHasMore(nextPage.length === 50);
            } catch (loadError) {
                if (generation === historyGeneration.current) setPageError(loadError instanceof Error ? loadError.message : '이전 풀이 기록을 불러오지 못했습니다.');
            } finally {
                if (generation === historyGeneration.current) {
                    pageRequest.current = false;
                    setLoadingMore(false);
                }
            }
        });
    };

    useEffect(() => {
        if (!learningDbEnabled || !selectedId || !user?.id) return;
        let cancelled = false;
        const userId = user.id;
        startTransition(async () => {
            setDetail(null);
            setDetailLoading(true);
            setDetailError(null);
            try {
                const response = await getAttemptResultAction(selectedId);
                if (cancelled) return;
                if (response.ok) setDetail({ owner: userId, result: response.result });
                else setDetailError(response.message);
            } catch (loadError) {
                if (!cancelled) setDetailError(loadError instanceof Error ? loadError.message : '채점 결과를 불러오지 못했습니다.');
            } finally {
                if (!cancelled) setDetailLoading(false);
            }
        });
        return () => { cancelled = true; };
    }, [learningDbEnabled, selectedId, user?.id, reload]);

    if (!learningDbEnabled) return <div className="mx-auto w-full max-w-3xl space-y-3"><h1 className="text-xl">풀이 기록</h1><p className="text-sm text-foreground/60">풀이 기록 저장 기능을 준비하고 있습니다. 문제를 풀고 바로 채점 결과를 확인할 수 있습니다.</p><Link href="/quiz" className="text-sm text-primary">문제 풀기</Link></div>;
    if (authLoading) return <Loading label="사용자 정보 불러오는 중" />;
    if (!user) return <div className="mx-auto w-full max-w-3xl space-y-3"><h1 className="text-xl">풀이 기록</h1><p className="text-sm text-foreground/60">로그인하거나 비회원으로 시작하면 자신의 풀이 기록을 확인할 수 있습니다.</p><Link href="/" className="text-sm text-primary">시작 화면으로</Link></div>;
    const items = history?.owner === user.id ? history.items : [];
    const result = detail?.owner === user.id ? detail.result : null;

    return <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
            <div><h1 className="text-xl">풀이 기록</h1><p className="mt-2 text-sm text-foreground/60">제출 당시의 답안과 채점 결과를 확인하세요.</p></div>
            <button type="button" onClick={() => setReload((value) => value + 1)} className="rounded-md border border-card-border px-3 py-2 text-sm">새로고침</button>
        </header>
        {user.role === 'GUEST' && <p className="rounded-lg border border-card-border p-4 text-sm text-foreground/60">비회원 기록은 제출 후 7일간 보관됩니다. 로그인 방식이나 브라우저 세션을 바꾸면 이 기록에 접근할 수 없을 수 있습니다.</p>}
        {loading ? <Loading label="풀이 기록 불러오는 중" /> : error ? <p role="alert" className="text-sm text-danger">{error}</p> : items.length === 0 ? <div className="rounded-lg border border-card-border p-6 text-sm text-foreground/60">아직 저장된 풀이가 없습니다. <Link href="/quiz" className="text-primary">문제 풀기</Link></div> : (
            <div className="overflow-x-auto rounded-lg border border-card-border">
                <table className="w-full text-left text-sm">
                    <thead className="border-b border-card-border text-xs text-foreground/50"><tr><th scope="col" className="p-4 font-medium">문제</th><th scope="col" className="p-4 font-medium">제출 일시 (한국 시간)</th><th scope="col" className="p-4 font-medium">결과</th></tr></thead>
                    <tbody>{items.map((item) => <tr key={item.id} className={`border-b border-card-border/60 last:border-b-0 ${selectedId === item.id ? 'bg-primary/5' : ''}`}>
                        <td className="p-4"><button type="button" disabled={item.status !== 'completed'} onClick={() => setSelectedId(item.id)} className="text-left text-primary disabled:text-foreground/60">{item.title}</button></td>
                        <td className="p-4 text-xs text-foreground/55">{localDate(item.submitted_at)}{item.expires_at && <p className="mt-2 text-foreground/45">비회원 풀이 · {localDate(item.expires_at)}까지 보관</p>}</td>
                        <td className="whitespace-nowrap p-4">{item.status === 'completed' ? `${item.score} / ${item.max_points}점` : statusLabels[item.status]}{item.status === 'failed' && <Link href={`/quiz?set=${encodeURIComponent(item.question_set_id)}`} className="mt-2 block text-xs text-primary">답안 확인 후 다시 요청</Link>}</td>
                    </tr>)}</tbody>
                </table>
            </div>
        )}
        {!loading && !error && items.length > 0 && <div className="space-y-3 text-center">
            {pageError && <p role="alert" className="text-sm text-danger">{pageError}</p>}
            {hasMore ? <button type="button" disabled={loadingMore} onClick={loadMore} className="rounded-md border border-card-border px-5 py-2 text-sm disabled:opacity-50">{loadingMore ? '이전 기록 불러오는 중…' : pageError ? '이전 기록 다시 불러오기' : '이전 풀이 더 보기'}</button> : <p className="text-xs text-foreground/45">저장된 풀이 {items.length}건을 모두 불러왔습니다.</p>}
        </div>}
        {selectedId && <section aria-label="선택한 풀이 결과" className="space-y-4">
            <div className="flex items-center justify-between gap-3"><h2 className="text-lg">채점 결과</h2><button type="button" onClick={() => setSelectedId(null)} className="text-sm text-foreground/50">닫기</button></div>
            {detailLoading ? <Loading label="채점 결과 불러오는 중" /> : detailError ? <p role="alert" className="text-sm text-danger">{detailError}</p> : result && <><p className="text-lg">{result.score} / {result.max_points}점</p><GradeResultDetails result={result} /></>}
        </section>}
    </div>;
}
