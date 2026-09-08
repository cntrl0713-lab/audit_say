'use client';

import { startTransition, useEffect, useState } from 'react';
import { getLeaderboardAction } from '../actions';
import { ROLE_NAMES } from '../../lib/utils';
import { Loading } from '../../components/Loading';
import type { LeaderboardEntry, RankingPeriod } from '../../lib/learningTypes';

const periods: Array<{ id: RankingPeriod; label: string; description: string }> = [
    { id: 'all', label: '누적', description: '누적 경험치 기준 상위 10명입니다.' },
    { id: 'week', label: '이번 주', description: '한국 시간 월요일 00:00부터 획득한 경험치 기준입니다.' },
    { id: 'month', label: '이번 달', description: '한국 시간 이번 달 1일 00:00부터 획득한 경험치 기준입니다.' },
];

export default function RankingClient({ periodsEnabled }: { periodsEnabled: boolean }) {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [period, setPeriod] = useState<RankingPeriod>('all');
    const [reload, setReload] = useState(0);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function loadLeaderboard() {
            setLoading(true);
            setErrorMsg(null);
            try {
                const data = await getLeaderboardAction(period);
                if (!cancelled) setLeaderboard(data);
            } catch (err) {
                if (!cancelled) setErrorMsg(err instanceof Error ? err.message : '랭킹 데이터를 불러오는 데 실패했습니다.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        startTransition(loadLeaderboard);
        return () => { cancelled = true; };
    }, [period, reload]);

    return (
        <div className="max-w-3xl mx-auto w-full py-8 space-y-6">
            <header>
                <h1 className="text-xl">랭킹</h1>
                <p className="text-sm text-foreground/55 mt-1.5">{periods.find((item) => item.id === period)?.description}</p>
            </header>

            <div className="flex gap-2" aria-label="랭킹 집계 기간">
                {periods.map((item) => <button key={item.id} type="button" aria-pressed={period === item.id} disabled={!periodsEnabled && item.id !== 'all'}
                    onClick={() => { if (period === item.id) return; setLoading(true); setPeriod(item.id); }}
                    className={`rounded-md border px-4 py-2 text-sm disabled:opacity-40 ${period === item.id ? 'border-primary bg-primary/10 text-primary' : 'border-card-border text-foreground/60'}`}>
                    {item.label}
                </button>)}
            </div>
            {!periodsEnabled && <p className="text-xs text-foreground/50">주간·월간 랭킹은 풀이 기록 저장 기능과 함께 제공할 예정입니다.</p>}

            {loading ? <Loading label="랭킹 불러오는 중" /> : errorMsg ? (
                <div role="alert" className="rounded-lg border border-danger/30 p-4 text-sm">
                    <p className="text-danger">{errorMsg}</p>
                    <button type="button" onClick={() => setReload((value) => value + 1)} className="mt-3 text-primary">다시 불러오기</button>
                </div>
            ) : leaderboard.length === 0 ? (
                <p className="text-sm text-foreground/50 py-8 border-t border-card-border">
                    아직 집계된 기록이 없습니다.
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead>
                            <tr className="border-b border-card-border text-xs text-foreground/50">
                                <th scope="col" className="py-2.5 pr-4 font-medium w-12">#</th>
                                <th scope="col" className="py-2.5 pr-4 font-medium">학습자</th>
                                <th scope="col" className="py-2.5 pr-4 font-medium">등급</th>
                                <th scope="col" className="py-2.5 pr-4 font-medium text-right">레벨</th>
                                <th scope="col" className="py-2.5 font-medium text-right">경험치</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboard.map((userItem, index) => {
                                const roleName = ROLE_NAMES[userItem.role] || userItem.role;
                                return (
                                    <tr
                                        key={`${userItem.rank}-${userItem.username}`}
                                        className="border-b border-card-border/70 hover:bg-card-border/20 transition-colors"
                                    >
                                        <td className="py-3 pr-4 tabular-nums text-foreground/45">{userItem.rank}</td>
                                        <td className={`py-3 pr-4 ${index === 0 ? 'font-medium text-foreground' : 'text-foreground/90'}`}>
                                            {userItem.username}
                                        </td>
                                        <td className="py-3 pr-4 text-foreground/55">{roleName}</td>
                                        <td className="py-3 pr-4 text-right tabular-nums text-foreground/75">
                                            {userItem.level}
                                        </td>
                                        <td className="py-3 text-right tabular-nums text-foreground">
                                            {userItem.exp.toLocaleString('ko-KR')}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
