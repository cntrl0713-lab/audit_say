'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    getAdminQuestions,
    getAllUsersAction,
    updateUserRoleAction,
    updateQuestionAction,
    deleteQuestionAction
} from '../actions';
import { ROLE_NAMES } from '../../lib/utils';
import { AuditQuestion, UserProfile } from '../../lib/db';
import { Loading } from '../../components/Loading';
import { Search } from 'lucide-react';

export default function AdminPage() {
    const { user, loading: authLoading } = useAuth();

    // Tab states
    const [activeTab, setActiveTab] = useState<'edit' | 'users'>('edit');

    // Common states
    const [questions, setQuestions] = useState<AuditQuestion[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State: Edit Question
    const [partFilter, setPartFilter] = useState('전체');
    const [chapFilter, setChapFilter] = useState('전체');
    const [searchTitle, setSearchTitle] = useState('');
    const [selectedQId, setSelectedQId] = useState<number | null>(null);

    // Form Fields: Edit Target
    const [editPart, setEditPart] = useState('');
    const [editChap, setEditChap] = useState('');
    const [editStd, setEditStd] = useState('');
    const [editTitle, setEditTitle] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editModelAns, setEditModelAns] = useState('');
    const [editExpl, setEditExpl] = useState('');
    const [editRubric, setEditRubric] = useState('[]');

    // User role change states
    const [selectedUser, setSelectedUser] = useState('');
    const [newRole, setNewRole] = useState<'MEMBER' | 'ADMIN' | 'PRO' | 'GUEST'>('MEMBER');

    // Load everything
    const loadAdminData = async () => {
        try {
            const qs = await getAdminQuestions();
            setQuestions(qs);

            const allUsers = await getAllUsersAction();
            setUsers(allUsers);
        } catch (err) {
            console.error('관리자 리소스 로드 에러:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading) {
            if (user?.role === 'ADMIN') {
                loadAdminData();
            } else {
                setLoading(false);
            }
        }
    }, [user, authLoading]);

    if (loading) {
        return <Loading />;
    }

    // Auth block
    if (!user || user.role !== 'ADMIN') {
        return (
            <div className="max-w-3xl mx-auto w-full py-8">
                <h1 className="text-xl">접근 권한이 없습니다</h1>
                <p className="text-sm text-foreground/55 mt-1.5">관리자 등급에서만 열 수 있는 페이지입니다.</p>
            </div>
        );
    }

    // --- Edit Target Loaded ---
    const handleLoadQuestionToEdit = (q: AuditQuestion) => {
        setSelectedQId(q.id);
        setEditPart(String(q.part));
        setEditChap(String(q.chapter));
        setEditStd(q.standard || '');
        setEditTitle(q.question_title);
        setEditDesc(q.question_description);

        // Model answer pre fill
        setEditModelAns(Array.isArray(q.model_answer) ? q.model_answer.join('\n') : String(q.model_answer));
        setEditExpl(q.explanation || '');
        setEditRubric(q.rubric ? JSON.stringify(q.rubric, null, 2) : '[]');
    };

    // --- Save Edited Question ---
    const handleUpdateQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedQId || isSubmitting) return;

        setIsSubmitting(true);

        const partNum = editPart.match(/\d+/) ? editPart.match(/\d+/)![0] : editPart;
        const chapNum = editChap.match(/\d+/) ? editChap.match(/\d+/)![0] : editChap;

        const modelAnsArray = editModelAns.split('\n').map((m) => m.trim()).filter(Boolean);

        try {
            const success = await updateQuestionAction(selectedQId, {
                part: partNum,
                chapter: chapNum,
                standard: editStd,
                question_title: editTitle,
                question_description: editDesc,
                model_answer: modelAnsArray,
                explanation: editExpl,
                rubric: editRubric
            });

            if (success) {
                setSuccessMsg('수정 사항을 저장했습니다.');
                setErrorMsg(null);
                // Reload db data
                const qs = await getAdminQuestions();
                setQuestions(qs);
            } else {
                setErrorMsg('저장에 실패했습니다.');
            }
        } catch (e: any) {
            setErrorMsg(`서버 오류: ${e.message || String(e)}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Delete Question ---
    const handleDeleteQuestion = async () => {
        if (!selectedQId) return;
        if (!confirm('이 문제를 삭제할까요? 되돌릴 수 없습니다.')) return;

        // deleteQuestionAction은 권한 검증 실패·DB 오류를 throw로 알린다. try 없이 두면
        // 처리되지 않은 rejection이 되어 화면에 아무 변화가 없다.
        try {
            const success = await deleteQuestionAction(selectedQId);
            if (success) {
                setSuccessMsg('문제를 삭제했습니다.');
                setErrorMsg(null);
                setSelectedQId(null);
                // Reload db data
                const qs = await getAdminQuestions();
                setQuestions(qs);
            } else {
                setErrorMsg('문제 삭제에 실패했습니다.');
            }
        } catch (e: any) {
            setSuccessMsg(null);
            setErrorMsg(`문제 삭제 실패: ${e.message || String(e)}`);
        }
    };

    // --- Change User Role ---
    const handleChangeRole = async () => {
        if (!selectedUser) return;

        // Removed hardcoded '준영2' check; server handles authorization completely.

        try {
            const success = await updateUserRoleAction(selectedUser, newRole);
            if (success) {
                setSuccessMsg(`선택한 사용자의 등급을 ${newRole}로 변경했습니다.`);
                setErrorMsg(null);
                // Reload users list
                const allUsers = await getAllUsersAction();
                setUsers(allUsers);
            } else {
                setErrorMsg('권한 변경에 실패했습니다.');
            }
        } catch (e: any) {
            setSuccessMsg(null);
            setErrorMsg(`권한 변경 실패: ${e.message || String(e)}`);
        }
    };

    // Filter logic for manage tab
    const getFilteredQuestions = () => {
        return questions.filter((q) => {
            const matchPart = partFilter === '전체' || String(q.part) === partFilter;
            const matchChap = chapFilter === '전체' || String(q.chapter) === chapFilter;
            const matchSearch = q.question_title.toLowerCase().includes(searchTitle.toLowerCase());
            return matchPart && matchChap && matchSearch;
        });
    };

    const filteredQs = getFilteredQuestions();

    return (
        <div className="max-w-5xl mx-auto w-full space-y-6 py-8">
            {/* Title */}
            <h1 className="text-xl">관리자</h1>

            {/* Messages */}
            {successMsg && (
                <div className="p-4 bg-success/15 border border-success/30 text-success text-sm font-medium rounded-md animate-fade-in">
                    {successMsg}
                </div>
            )}
            {errorMsg && (
                <div className="p-4 bg-danger/15 border border-danger/30 text-danger text-sm font-medium rounded-md animate-fade-in">
                    {errorMsg}
                </div>
            )}

            {/* Tab Menu */}
            <div className="flex gap-6 border-b border-card-border">
                <button
                    onClick={() => { setActiveTab('edit'); setErrorMsg(null); setSuccessMsg(null); }}
                    className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${activeTab === 'edit' ? 'border-foreground text-foreground' : 'border-transparent text-foreground/45 hover:text-foreground/75'
                        }`}
                >
                    문제 관리
                </button>
                <button
                    onClick={() => { setActiveTab('users'); setErrorMsg(null); setSuccessMsg(null); }}
                    className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${activeTab === 'users' ? 'border-foreground text-foreground' : 'border-transparent text-foreground/45 hover:text-foreground/75'
                        }`}
                >
                    회원 관리
                </button>
            </div>

            {/* Tab Contents */}
            <div className="space-y-6">

                {/* TAB 1: MANAGE/EDIT QUESTIONS */}
                {activeTab === 'edit' && (
                    <div className="space-y-6">

                        {/* Search Filter Panel */}
                        <div className="bg-card border border-card-border p-5 rounded-lg flex flex-col md:flex-row gap-4 items-end">
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                                <div>
                                    <label className="block text-sm text-foreground/70 mb-1.5">Part 필터</label>
                                    <select
                                        value={partFilter}
                                        onChange={(e) => setPartFilter(e.target.value)}
                                        className="w-full bg-card-border/30 border border-card-border focus:border-primary text-foreground rounded-md px-3 py-2 text-sm focus:outline-none"
                                    >
                                        <option value="전체">전체 Parts</option>
                                        {Array.from(new Set(questions.map((q) => String(q.part)))).sort().map((p) => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm text-foreground/70 mb-1.5">Chapter 필터</label>
                                    <select
                                        value={chapFilter}
                                        onChange={(e) => setChapFilter(e.target.value)}
                                        className="w-full bg-card-border/30 border border-card-border focus:border-primary text-foreground rounded-md px-3 py-2 text-sm focus:outline-none"
                                    >
                                        <option value="전체">전체 Chapters</option>
                                        {Array.from(new Set(questions.map((q) => String(q.chapter)))).sort().map((chap) => (
                                            <option key={chap} value={chap}>{chap === 'Unknown' ? 'Unknown' : `Ch.${chap}`}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm text-foreground/70 mb-1.5">제목 검색</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="문제 제목 검색"
                                            value={searchTitle}
                                            onChange={(e) => setSearchTitle(e.target.value)}
                                            className="w-full bg-card-border/30 border border-card-border focus:border-primary text-foreground rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none"
                                        />
                                        <Search className="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Questions Selector List */}
                        <div className="bg-card border border-card-border rounded-lg p-5">
                            <label htmlFor="admin-question-select" className="block text-sm text-foreground/70 mb-1.5">
                                수정할 문제
                            </label>

                            {filteredQs.length === 0 ? (
                                <p className="text-sm text-foreground/50 py-2.5">검색 조건에 맞는 문제가 없습니다.</p>
                            ) : (
                                <select
                                    id="admin-question-select"
                                    onChange={(e) => {
                                        const qData = filteredQs.find((q) => q.id === Number(e.target.value));
                                        if (qData) handleLoadQuestionToEdit(qData);
                                    }}
                                    value={selectedQId || ''}
                                    className="w-full bg-card-border/30 border border-card-border focus:border-primary text-foreground rounded-md px-3 py-2.5 text-sm"
                                >
                                    <option value="">문제 선택 ({filteredQs.length}건)</option>
                                    {filteredQs.map((q) => (
                                        <option key={q.id} value={q.id}>
                                            [{q.id}] (Ch.{q.chapter}) {q.question_title}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Editable Form Segment */}
                        {selectedQId && (
                            <form onSubmit={handleUpdateQuestion} className="bg-card border border-card-border p-6 rounded-lg space-y-4">
                                <div className="flex items-center justify-between gap-4 border-b border-card-border pb-3">
                                    <h2 className="text-base text-foreground">문제 수정 (ID {selectedQId})</h2>
                                    <button
                                        type="button"
                                        onClick={handleDeleteQuestion}
                                        className="px-3 py-1.5 rounded-md text-xs font-medium border border-danger/30 text-danger hover:bg-danger/10 transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                        삭제
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm text-foreground/70 mb-1.5">Part 코드</label>
                                        <input
                                            type="text"
                                            value={editPart}
                                            onChange={(e) => setEditPart(e.target.value)}
                                            className="w-full bg-card-border/30 border border-card-border focus:border-primary text-foreground rounded-md px-3 py-2 text-sm focus:outline-none"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm text-foreground/70 mb-1.5">Chapter 코드</label>
                                        <input
                                            type="text"
                                            value={editChap}
                                            onChange={(e) => setEditChap(e.target.value)}
                                            className="w-full bg-card-border/30 border border-card-border focus:border-primary text-foreground rounded-md px-3 py-2 text-sm focus:outline-none"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm text-foreground/70 mb-1.5">감사기준</label>
                                        <input
                                            type="text"
                                            value={editStd}
                                            onChange={(e) => setEditStd(e.target.value)}
                                            className="w-full bg-card-border/30 border border-card-border focus:border-primary text-foreground rounded-md px-3 py-2 text-sm focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm text-foreground/70 mb-1.5">문제 제목</label>
                                    <input
                                        type="text"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        className="w-full bg-card-border/30 border border-card-border focus:border-primary text-foreground rounded-md px-3.5 py-2.5 text-sm focus:outline-none font-medium"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-foreground/70 mb-1.5">문제 지문</label>
                                    <textarea
                                        rows={6}
                                        value={editDesc}
                                        onChange={(e) => setEditDesc(e.target.value)}
                                        className="w-full bg-card-border/30 border border-card-border focus:border-primary text-foreground rounded-md p-3 text-sm focus:outline-none"
                                        required
                                    />
                                </div>

                                {/* 키워드 입력란은 제거했다: v2에서 채점 키워드는 루브릭의 variants가
                                    담당하고, fetchAllQuestions는 keywords를 항상 빈 배열로 반환하며
                                    updateQuestion도 keywords를 저장하지 않는다 — 입력해도 조용히 버려졌다. */}
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="block text-sm text-foreground/70 mb-1.5">모범 답안 (줄바꿈으로 구분)</label>
                                        <textarea
                                            rows={5}
                                            value={editModelAns}
                                            onChange={(e) => setEditModelAns(e.target.value)}
                                            className="w-full bg-card-border/30 border border-card-border focus:border-primary text-foreground rounded-md p-3 text-sm focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm text-foreground/70 mb-1.5">해설</label>
                                    <textarea
                                        rows={3}
                                        value={editExpl}
                                        onChange={(e) => setEditExpl(e.target.value)}
                                        className="w-full bg-card-border/30 border border-card-border focus:border-primary text-foreground rounded-md p-3 text-sm focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-foreground/70 mb-1.5">루브릭 (JSON)</label>
                                    <textarea
                                        rows={6}
                                        value={editRubric}
                                        onChange={(e) => setEditRubric(e.target.value)}
                                        className="w-full bg-card-border/30 border border-card-border focus:border-primary text-foreground rounded-md p-3 text-sm focus:outline-none font-mono"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`w-full py-2.5 font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${isSubmitting ? 'bg-primary/50 text-white/50 cursor-not-allowed' : 'bg-primary hover:bg-primary-hover text-white cursor-pointer'}`}
                                >
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 border-2 border-white/50 border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <span>저장</span>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                )}

                {/* TAB 2: USER PROFILE MANAGEMENT */}
                {activeTab === 'users' && (
                    <div className="space-y-6">
                        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
                            <div className="p-4 border-b border-card-border">
                                <h2 className="text-sm font-medium text-foreground">회원 목록</h2>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead>
                                        <tr className="bg-card-border/10 border-b border-card-border text-xs uppercase tracking-wider text-foreground/50 font-medium">
                                            <th className="px-6 py-3">닉네임</th>
                                            <th className="px-6 py-3">권한 등급</th>
                                            <th className="px-6 py-3">경험치</th>
                                            <th className="px-6 py-3">레벨</th>
                                            <th className="px-6 py-3 text-right">가입일</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-card-border">
                                        {users.map((u) => (
                                            <tr key={u.id} className="hover:bg-card-border/20 transition-colors">
                                                <td className="px-6 py-3.5 font-medium text-foreground">{u.username}</td>
                                                <td className="px-6 py-3.5 text-xs font-normal text-foreground/60">
                                                    {ROLE_NAMES[u.role] || u.role}
                                                </td>
                                                <td className="px-6 py-3.5 font-medium text-foreground">{u.exp} EXP</td>
                                                <td className="px-6 py-3.5 font-medium text-foreground/80">Lv.{u.level}</td>
                                                <td className="px-6 py-3.5 text-right text-foreground/45 text-xs">
                                                    {new Date(u.created_at || '').toLocaleDateString('ko-KR')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Change role form */}
                        <div className="bg-card border border-card-border p-6 rounded-lg space-y-4">
                            <h3 className="text-sm font-medium text-foreground/80">회원 등급 변경</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-foreground/70 mb-1.5">사용자 선택</label>
                                    <select
                                        value={selectedUser}
                                        onChange={(e) => setSelectedUser(e.target.value)}
                                        className="w-full bg-card-border/30 border border-card-border focus:border-primary text-foreground rounded-md px-3 py-2 text-sm focus:outline-none"
                                    >
                                        <option value="">사용자 선택</option>
                                        {users.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.username} ({ROLE_NAMES[u.role] || u.role})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm text-foreground/70 mb-1.5">변경할 권한 등급</label>
                                    <select
                                        value={newRole}
                                        onChange={(e) => setNewRole(e.target.value as any)}
                                        className="w-full bg-card-border/30 border border-card-border focus:border-primary text-foreground rounded-md px-3 py-2 text-sm focus:outline-none"
                                    >
                                        {Object.keys(ROLE_NAMES).map((r) => (
                                            <option key={r} value={r}>{ROLE_NAMES[r as keyof typeof ROLE_NAMES]} ({r})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleChangeRole}
                                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-medium rounded-md text-sm transition-colors cursor-pointer"
                            >
                                등급 변경
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
