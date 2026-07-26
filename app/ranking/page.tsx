'use client';

import React, { useEffect, useState } from 'react';
import { getLeaderboardAction } from '../actions';
import { ROLE_NAMES } from '../../lib/utils';
import { Loading } from '../../components/Loading';

interface LeaderboardUser {
    id: string;
    username: string;
    role: 'MEMBER' | 'ADMIN' | 'PRO' | 'GUEST';
    level: number;
    exp: number;
}

export default function RankingPage() {
    const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        async function loadLeaderboard() {
            try {
                const data = await getLeaderboardAction();
                setLeaderboard(data as LeaderboardUser[]);
            } catch (err: any) {
                console.error('랭킹 로드 오류:', err);
                setErrorMsg(err.message || '랭킹 데이터를 불러오는 데 실패했습니다.');
            } finally {
                setLoading(false);
            }
        }
        loadLeaderboard();
    }, []);

    if (loading) {
        return <Loading label="랭킹 불러오는 중" />;
    }

    if (errorMsg) {
        return (
            <div className="max-w-3xl mx-auto w-full py-8">
                <h1 className="text-xl mb-2">랭킹</h1>
                <p className="text-sm text-danger">{errorMsg}</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto w-full py-8 space-y-6">
            <header>
                <h1 className="text-xl">랭킹</h1>
                <p className="text-sm text-foreground/55 mt-1.5">누적 경험치 기준 상위 10명입니다.</p>
            </header>

            {leaderboard.length === 0 ? (
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
                                        key={userItem.id}
                                        className="border-b border-card-border/70 hover:bg-card-border/20 transition-colors"
                                    >
                                        <td className="py-3 pr-4 tabular-nums text-foreground/45">{index + 1}</td>
                                        <td className={`py-3 pr-4 ${index === 0 ? 'font-medium text-foreground' : 'text-foreground/90'}`}>
                                            {userItem.username}
                                        </td>
                                        <td className="py-3 pr-4 text-foreground/55">{roleName}</td>
                                        <td className="py-3 pr-4 text-right tabular-nums text-foreground/75">
                                            {userItem.level}
                                        </td>
                                        <td className="py-3 text-right tabular-nums text-foreground">
                                            {userItem.exp}
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
