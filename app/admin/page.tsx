'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Settings, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAllUsersAction, getQuestionSetsV3, updateUserRoleAction } from '../actions';
import { ROLE_NAMES } from '../../lib/utils';
import type { UserProfile } from '../../lib/db';
import type { PublicQuestionSetV3 } from '../../lib/questionV3';

type AdminTab = 'questions' | 'users';

export default function AdminPage() {
    const { user, loading: authLoading } = useAuth();
    const [activeTab, setActiveTab] = useState<AdminTab>('questions');
    const [questionSets, setQuestionSets] = useState<PublicQuestionSetV3[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [partFilter, setPartFilter] = useState('전체');
    const [searchTitle, setSearchTitle] = useState('');
    const [selectedUser, setSelectedUser] = useState('');
    const [newRole, setNewRole] = useState<UserProfile['role']>('MEMBER');
    const [loaded, setLoaded] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        if (authLoading) return;
        if (user?.role !== 'ADMIN') return;
        Promise.all([getQuestionSetsV3(), getAllUsersAction()])
            .then(([sets, allUsers]) => {
                setQuestionSets(sets);
                setUsers(allUsers);
            })
            .catch((error: unknown) => setMessage(error instanceof Error ? error.message : String(error)))
            .finally(() => setLoaded(true));
    }, [authLoading, user]);

    const filteredSets = useMemo(() => questionSets.filter((set) => {
        const matchesPart = partFilter === '전체' || set.classification.part === partFilter;
        const matchesTitle = set.title.toLowerCase().includes(searchTitle.toLowerCase());
        return matchesPart && matchesTitle;
    }), [partFilter, questionSets, searchTitle]);

    const changeRole = async () => {
        if (!selectedUser) return;
        const success = await updateUserRoleAction(selectedUser, newRole);
        if (!success) {
            setMessage('권한 변경에 실패했습니다.');
            return;
        }
        setUsers((current) => current.map((candidate) => (
            candidate.id === selectedUser ? { ...candidate, role: newRole } : candidate
        )));
        setMessage('사용자 권한을 변경했습니다.');
    };

    if (authLoading || (user?.role === 'ADMIN' && !loaded)) {
        return <div className="py-20 text-center text-sm text-foreground/60">관리자 데이터를 불러오는 중입니다.</div>;
    }

    if (!user || user.role !== 'ADMIN') {
        return (
            <div className="mx-auto max-w-md rounded-lg border border-card-border bg-card p-8 text-center">
                <ShieldAlert className="mx-auto h-12 w-12 text-foreground/40" />
                <h1 className="mt-4 text-xl">접근 권한이 없습니다.</h1>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-6xl space-y-6 py-4">
            <header className="flex items-center gap-3">
                <Settings className="h-6 w-6 text-foreground/70" />
                <div>
                    <h1 className="text-2xl font-normal">관리자 제어반</h1>
                    <p className="mt-1 text-sm text-foreground/50">신규 v3 문제은행과 회원 권한을 관리합니다.</p>
                </div>
            </header>

            {message && <div className="rounded-md border border-card-border bg-card p-3 text-sm">{message}</div>}

            <div className="flex border-b border-card-border">
                <button type="button" onClick={() => setActiveTab('questions')} className={`px-5 pb-3 text-sm ${activeTab === 'questions' ? 'border-b-2 border-primary text-foreground' : 'text-foreground/45'}`}>
                    문제은행 현황
                </button>
                <button type="button" onClick={() => setActiveTab('users')} className={`px-5 pb-3 text-sm ${activeTab === 'users' ? 'border-b-2 border-primary text-foreground' : 'text-foreground/45'}`}>
                    회원 권한 관리
                </button>
            </div>

            {activeTab === 'questions' ? (
                <section className="space-y-4">
                    <div className="grid gap-3 rounded-lg border border-card-border bg-card p-4 sm:grid-cols-2">
                        <select value={partFilter} onChange={(event) => setPartFilter(event.target.value)} className="rounded-md border border-card-border bg-card-border/20 px-3 py-2 text-sm">
                            <option value="전체">전체 PART</option>
                            {[...new Set(questionSets.map((set) => set.classification.part))].map((part) => <option key={part}>{part}</option>)}
                        </select>
                        <label className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-foreground/35" />
                            <input value={searchTitle} onChange={(event) => setSearchTitle(event.target.value)} placeholder="문제 제목 검색" className="w-full rounded-md border border-card-border bg-card-border/20 py-2 pl-9 pr-3 text-sm" />
                        </label>
                    </div>
                    <div className="rounded-lg border border-card-border bg-card">
                        <div className="border-b border-card-border p-4 text-sm text-foreground/60">45세트 중 {filteredSets.length}세트 표시</div>
                        <div className="divide-y divide-card-border">
                            {filteredSets.map((set) => (
                                <article key={set.id} className="grid gap-2 p-4 md:grid-cols-[9rem_1fr_auto] md:items-center">
                                    <span className="font-mono text-xs text-primary">{set.id}</span>
                                    <div>
                                        <h2 className="text-sm font-medium">{set.title}</h2>
                                        <p className="mt-1 text-xs text-foreground/45">{set.classification.chapter} · {set.classification.standards.join(', ') || '기초이론'}</p>
                                    </div>
                                    <span className="text-xs text-foreground/50">{set.subquestions.length}문항 · {set.max_points}점</span>
                                </article>
                            ))}
                        </div>
                    </div>
                    <p className="text-xs leading-5 text-foreground/45">문제 내용 수정은 검증된 authoring 파이프라인에서만 수행하며 웹 관리자 화면에서는 직접 편집하지 않습니다.</p>
                </section>
            ) : (
                <section className="space-y-5">
                    <div className="overflow-x-auto rounded-lg border border-card-border bg-card">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-card-border bg-card-border/15 text-xs text-foreground/45">
                                <tr><th className="px-5 py-3">닉네임</th><th className="px-5 py-3">권한</th><th className="px-5 py-3">경험치</th><th className="px-5 py-3">레벨</th></tr>
                            </thead>
                            <tbody className="divide-y divide-card-border">
                                {users.map((candidate) => (
                                    <tr key={candidate.id}><td className="px-5 py-3">{candidate.username}</td><td className="px-5 py-3">{ROLE_NAMES[candidate.role]}</td><td className="px-5 py-3">{candidate.exp}</td><td className="px-5 py-3">Lv.{candidate.level}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="grid gap-3 rounded-lg border border-card-border bg-card p-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
                        <label className="text-xs text-foreground/50">사용자
                            <select value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)} className="mt-1 block w-full rounded-md border border-card-border bg-card-border/20 px-3 py-2 text-sm text-foreground">
                                <option value="">선택</option>
                                {users.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.username}</option>)}
                            </select>
                        </label>
                        <label className="text-xs text-foreground/50">권한
                            <select value={newRole} onChange={(event) => setNewRole(event.target.value as UserProfile['role'])} className="mt-1 block w-full rounded-md border border-card-border bg-card-border/20 px-3 py-2 text-sm text-foreground">
                                {Object.entries(ROLE_NAMES).map(([role, name]) => <option key={role} value={role}>{name}</option>)}
                            </select>
                        </label>
                        <button type="button" onClick={changeRole} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">권한 적용</button>
                    </div>
                </section>
            )}
        </div>
    );
}