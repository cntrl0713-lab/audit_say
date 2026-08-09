'use client';

import { Award, BookOpen, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ROLE_NAMES } from '../../lib/utils';

export default function ProfilePage() {
    const { user, loading } = useAuth();

    if (loading) return <div className="py-20 text-center text-sm text-foreground/60">프로필을 불러오는 중입니다.</div>;
    if (!user) return <div className="py-20 text-center">로그인이 필요합니다.</div>;

    return (
        <div className="mx-auto w-full max-w-4xl space-y-6 py-4">
            <section className="flex flex-col gap-6 rounded-lg border border-card-border bg-card p-6 md:flex-row md:items-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-card-border bg-card-border/30">
                    <User className="h-10 w-10" />
                </div>
                <div className="flex-1">
                    <h1 className="text-xl font-normal">{user.username}</h1>
                    <p className="mt-1 text-sm text-foreground/50">{ROLE_NAMES[user.role]} · Lv.{user.level}</p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-card-border/60">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${user.exp % 100}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-foreground/40">다음 레벨까지 {user.exp % 100} / 100 EXP</p>
                </div>
                <div className="text-center">
                    <span className="block text-xs text-foreground/45">누적 경험치</span>
                    <strong className="text-2xl font-normal">{user.exp} EXP</strong>
                </div>
            </section>

            <div className="grid gap-5 md:grid-cols-2">
                <section className="rounded-lg border border-card-border bg-card p-6">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <h2 className="mt-3 text-base font-medium">신규 문제은행</h2>
                    <p className="mt-2 text-sm leading-6 text-foreground/60">현재 학습 기록은 v3 criterion 채점 결과에서 획득한 점수만 경험치로 반영합니다.</p>
                </section>
                <section className="rounded-lg border border-card-border bg-card p-6">
                    <Award className="h-5 w-5 text-primary" />
                    <h2 className="mt-3 text-base font-medium">학습 진행</h2>
                    <p className="mt-2 text-sm leading-6 text-foreground/60">기준서 근거와 모범답안을 비교하며 부족한 criterion을 반복 학습하세요.</p>
                </section>
            </div>
        </div>
    );
}