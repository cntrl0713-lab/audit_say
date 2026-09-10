'use client';
import { useEffect, useMemo, useState } from 'react';
import { Search, Settings, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAllUsersAction, getQuestionSetsV3, updateUserAdminAction, updateUserRoleAction } from '../actions';
import { DataTable, type DataColumn } from '../(firm)/_components/ui';
import type { UserProfile } from '../../lib/db';
import type { PublicQuestionSetV3 } from '../../lib/questionV3';

type AdminTab = 'questions' | 'users';

const USER_COLUMNS: DataColumn[] = [
    { key: 'username', label: '닉네임' },
    { key: 'role', label: '이용권' },
    { key: 'is_service_admin', label: '감사 관리자' },
    { key: 'exp', label: '경험치', align: 'right' },
    { key: 'level', label: '레벨', align: 'right' },
];

export default function AdminPage() {
    const { user, loading: authLoading } = useAuth();
    const [activeTab, setActiveTab] = useState<AdminTab>('questions');
    const [questionSets, setQuestionSets] = useState<PublicQuestionSetV3[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [partFilter, setPartFilter] = useState('전체');
    const [searchTitle, setSearchTitle] = useState('');
    const [selectedUser, setSelectedUser] = useState('');
    const [newRole, setNewRole] = useState<'MEMBER' | 'PRO'>('MEMBER');
    const [newIsAdmin, setNewIsAdmin] = useState(false);
    const [saving, setSaving] = useState<'entitlement' | 'admin' | null>(null);
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

    const selectUser = (userId: string) => {
        const candidate = users.find((entry) => entry.id === userId);
        setSelectedUser(userId);
        setNewRole(candidate?.role === 'PRO' ? 'PRO' : 'MEMBER');
        setNewIsAdmin(candidate?.is_service_admin === true);
        setMessage(null);
    };

    const changeAccess = async (kind: 'entitlement' | 'admin') => {
        if (!selectedUser || saving) return;
        if (kind === 'admin' && selectedUser === user?.id && !newIsAdmin) {
            setMessage('자신의 감사 관리자 권한은 해제할 수 없습니다.');
            return;
        }
        setSaving(kind);
        setMessage(null);
        try {
            const success = kind === 'entitlement'
                ? await updateUserRoleAction(selectedUser, newRole)
                : await updateUserAdminAction(selectedUser, newIsAdmin);
            if (!success) throw new Error(kind === 'entitlement' ? '감사 이용권 변경에 실패했습니다.' : '감사 관리자 권한 변경에 실패했습니다.');
            const currentUsers = await getAllUsersAction();
            setUsers(currentUsers);
            const updated = currentUsers.find((candidate) => candidate.id === selectedUser);
            setNewRole(updated?.role === 'PRO' ? 'PRO' : 'MEMBER');
            setNewIsAdmin(updated?.is_service_admin === true);
            if (!updated) setSelectedUser('');
            setMessage(kind === 'entitlement' ? '감사 이용권을 변경했습니다.' : '감사 관리자 권한을 변경했습니다.');
        } catch (error: unknown) {
            setMessage(error instanceof Error ? error.message : '변경 내용을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setSaving(null);
        }
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
                    <p className="mt-1 text-sm text-foreground/50">신규 v3 문제은행과 감사 이용권·관리자 권한을 관리합니다.</p>
                </div>
            </header>

            {message && <div role="status" className="rounded-md border border-card-border bg-card p-3 text-sm">{message}</div>}

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
                        <div className="border-b border-card-border p-4 text-sm text-foreground/60">{questionSets.length}세트 중 {filteredSets.length}세트 표시</div>
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
                    <DataTable
                        columns={USER_COLUMNS}
                        rows={users.map((candidate) => [
                            candidate.username,
                            candidate.role === 'PRO' ? 'PRO' : '기본',
                            candidate.is_service_admin ? '관리자' : '일반 사용자',
                            candidate.exp,
                            `Lv.${candidate.level}`,
                        ])}
                    />
                    <div className="space-y-5 rounded-lg border border-card-border bg-card p-5">
                        <label className="text-xs text-foreground/50">사용자
                            <select value={selectedUser} onChange={(event) => selectUser(event.target.value)} disabled={!!saving} className="mt-1 block w-full rounded-md border border-card-border bg-card-border/20 px-3 py-2 text-sm text-foreground disabled:opacity-50">
                                <option value="">선택</option>
                                {users.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.username}</option>)}
                            </select>
                        </label>
                        <div className="grid gap-5 border-t border-card-border pt-5 md:grid-cols-2">
                            <fieldset disabled={!selectedUser || !!saving} className="space-y-3">
                                <legend className="mb-3 text-sm">감사 이용권</legend>
                                <label className="block text-xs text-foreground/50">이용 등급
                                    <select value={newRole} onChange={(event) => setNewRole(event.target.value as 'MEMBER' | 'PRO')} className="mt-1 block w-full rounded-md border border-card-border bg-card-border/20 px-3 py-2 text-sm text-foreground disabled:opacity-50">
                                        <option value="MEMBER">기본</option>
                                        <option value="PRO">PRO</option>
                                    </select>
                                </label>
                                <p className="text-xs leading-5 text-foreground/50">감사 서비스의 유료 기능 이용 여부에 적용됩니다.</p>
                                <button type="button" onClick={() => void changeAccess('entitlement')} className="rounded-md bg-primary px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50">{saving === 'entitlement' ? '저장 중…' : '이용권 적용'}</button>
                            </fieldset>
                            <fieldset disabled={!selectedUser || !!saving || selectedUser === user.id} className="space-y-3">
                                <legend className="mb-3 text-sm">감사 관리자 권한</legend>
                                <label className="flex min-h-10 items-center gap-2 text-sm">
                                    <input type="checkbox" checked={newIsAdmin} onChange={(event) => setNewIsAdmin(event.target.checked)} className="h-4 w-4 accent-primary" />
                                    감사 관리자 권한 부여
                                </label>
                                <p className="text-xs leading-5 text-foreground/50">{selectedUser === user.id ? '자신의 감사 관리자 권한은 해제할 수 없습니다.' : '감사 서비스의 회원·문제 관리에 적용됩니다.'}</p>
                                <button type="button" onClick={() => void changeAccess('admin')} className="rounded-md border border-card-border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">{saving === 'admin' ? '저장 중…' : '관리자 권한 적용'}</button>
                            </fieldset>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
