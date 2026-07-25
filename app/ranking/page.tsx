'use client';

import React, { useEffect, useState } from 'react';
import { getLeaderboardAction } from '../actions';
import { ROLE_NAMES } from '../../lib/utils';
import { Trophy, Medal, Star, ShieldAlert } from 'lucide-react';

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
        return (
            <div className="flex flex-col items-center justify-center flex-grow py-20">
                <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-foreground/60 font-semibold text-sm">리더보드 집계 중...</p>
            </div>
        );
    }

    if (errorMsg) {
        return (
            <div className="flex flex-col items-center justify-center flex-grow py-20 px-4">
                <ShieldAlert className="w-16 h-16 text-foreground/50 mb-4" />
                <h2 className="text-xl font-normal text-foreground">데이터를 불러오지 못했습니다.</h2>
                <p className="mt-2 text-foreground/60 font-normal text-sm">{errorMsg}</p>
            </div>
        );
    }

    // Segment podium (Top 3) and runners up (Rest)
    const podium = leaderboard.slice(0, 3);
    const runnersUp = leaderboard.slice(3);

    // Position colors and icons for podium
    const getPodiumStyle = (index: number) => {
        switch (index) {
            case 0: // 1st
                return {
                    bg: 'bg-card border-card-border',
                    text: 'text-foreground',
                    badge: '1등',
                };
            case 1: // 2nd
                return {
                    bg: 'bg-card border-card-border',
                    text: 'text-foreground/70',
                    badge: '2등',
                };
            case 2: // 3rd
                return {
                    bg: 'bg-card border-card-border',
                    text: 'text-foreground/70',
                    badge: '3등',
                };
            default:
                return { bg: '', text: '', badge: '' };
        }
    };

    return (
        <div className="max-w-4xl mx-auto w-full space-y-6 py-4">
            {/* Title */}
            <div className="text-center space-y-2">
                <h1 className="text-2xl font-normal flex items-center justify-center gap-2">
                    <Trophy className="w-6 h-6 text-foreground" />
                    <span>명예의 전당 (Leaderboard)</span>
                </h1>
                <p className="text-sm text-foreground/60 font-normal">
                    누적 감사 학습 경험치(EXP) 상위 10명의 회원 랭킹입니다.
                </p>
            </div>

            {leaderboard.length === 0 ? (
                <div className="bg-card border border-card-border p-12 rounded-lg text-center space-y-3">
                    <ShieldAlert className="w-10 h-10 text-foreground/35 mx-auto" />
                    <h3 className="text-base font-normal text-foreground/70">리더보드가 비어 있습니다.</h3>
                    <p className="text-sm text-foreground/50">가장 먼저 가입하여 첫 번째 랭커가 되세요!</p>
                </div>
            ) : (
                <>
                    {/* Top 3 Podium layout */}
                    {podium.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                            {/* Render 2nd, 1st, 3rd logic for visually pleasing desktop layout */}
                            {[1, 0, 2].map((idx) => {
                                const userItem = podium[idx];
                                if (!userItem) return null;
                                const style = getPodiumStyle(idx);
                                const roleName = ROLE_NAMES[userItem.role] || userItem.role;

                                return (
                                    <div
                                        key={userItem.id}
                                        className={`border ${style.bg} rounded-lg p-6 flex flex-col items-center text-center relative ${idx === 0 ? 'border-primary/50' : ''
                                            }`}
                                    >
                                        {/* Badge */}
                                        <span className="absolute top-4 left-4 text-xs font-medium px-2 py-0.5 rounded bg-card-border/40 border border-card-border text-foreground/80">
                                            {style.badge}
                                        </span>

                                        {/* Medal/Trophy Icon */}
                                        <div className="w-12 h-12 bg-card-border/30 border border-card-border rounded-full flex items-center justify-center mb-4 mt-2">
                                            {idx === 0 ? (
                                                <Trophy className="w-6 h-6 text-foreground" />
                                            ) : (
                                                <Medal className={`w-6 h-6 ${style.text}`} />
                                            )}
                                        </div>

                                        <h3 className="text-lg font-medium text-foreground">{userItem.username}</h3>
                                        <p className="text-xs text-foreground/50 mt-1 font-normal">{roleName}</p>

                                        <div className="mt-4 pt-3 border-t border-card-border w-full flex justify-around text-sm">
                                            <div>
                                                <span className="text-[10px] uppercase font-medium text-foreground/45 block">레벨</span>
                                                <span className="font-medium text-foreground">Lv.{userItem.level}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] uppercase font-medium text-foreground/45 block">경험치</span>
                                                <span className="font-medium text-foreground">{userItem.exp} EXP</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Runners Up Table */}
                    {runnersUp.length > 0 && (
                        <div className="bg-card border border-card-border rounded-lg overflow-hidden mt-6">
                            <div className="p-4 bg-card-border/20 border-b border-card-border">
                                <h3 className="text-sm font-medium text-foreground/80 flex items-center gap-1.5">
                                    <Star className="w-4 h-4 text-foreground/70" />
                                    <span>학습자 순위 (4위 ~ 10위)</span>
                                </h3>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead>
                                        <tr className="bg-card-border/10 border-b border-card-border text-xs uppercase tracking-wider text-foreground/50 font-medium">
                                            <th className="px-6 py-3 text-center">순위</th>
                                            <th className="px-6 py-3">학습자명</th>
                                            <th className="px-6 py-3">등급</th>
                                            <th className="px-6 py-3">레벨</th>
                                            <th className="px-6 py-3 text-right">경험치</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-card-border">
                                        {runnersUp.map((userItem, index) => {
                                            const roleName = ROLE_NAMES[userItem.role] || userItem.role;
                                            return (
                                                <tr key={userItem.id} className="hover:bg-card-border/20 transition-colors">
                                                    <td className="px-6 py-3.5 text-center font-medium text-foreground/50">
                                                        {index + 4}위
                                                    </td>
                                                    <td className="px-6 py-3.5 font-medium text-foreground">
                                                        {userItem.username}
                                                    </td>
                                                    <td className="px-6 py-3.5 text-xs font-normal text-foreground/60">
                                                        {roleName}
                                                    </td>
                                                    <td className="px-6 py-3.5 font-medium text-foreground/80">
                                                        Lv.{userItem.level}
                                                    </td>
                                                    <td className="px-6 py-3.5 text-right font-medium text-foreground">
                                                        {userItem.exp} EXP
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
