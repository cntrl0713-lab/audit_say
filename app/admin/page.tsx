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
import { Trash2, Edit3, Settings, ShieldAlert, Users, Search } from 'lucide-react';

export default function AdminPage() {
    const { user, loading: authLoading, refreshProfile } = useAuth();

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
    const [editKeywords, setEditKeywords] = useState('');
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
        return (
            <div className="flex flex-col items-center justify-center flex-grow py-20">
                <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-foreground/60 font-semibold text-sm">콘솔 데이터 리프레시 중...</p>
            </div>
        );
    }

    // Auth block
    if (!user || user.role !== 'ADMIN') {
        return (
            <div className="max-w-md mx-auto w-full p-8 text-center bg-card border border-card-border rounded-2xl shadow-xl space-y-4">
                <ShieldAlert className="w-16 h-16 text-danger mx-auto animate-pulse" />
                <h2 className="text-xl font-bold text-danger">⛔ 접근 권한이 없습니다.</h2>
                <p className="text-sm text-foreground/60 leading-relaxed font-semibold">
                    이 콘솔은 시스템 총괄 관리자(ADMIN) 전용 기능 구역입니다.
                </p>
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

        // Keywords pre fill
        setEditKeywords(Array.isArray(q.keywords) ? q.keywords.join(', ') : String(q.keywords));

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

        const keywordsArray = editKeywords.split(',').map((k) => k.trim()).filter(Boolean);
        const modelAnsArray = editModelAns.split('\n').map((m) => m.trim()).filter(Boolean);

        try {
            const success = await updateQuestionAction(selectedQId, {
                part: partNum,
                chapter: chapNum,
                standard: editStd,
                question_title: editTitle,
                question_description: editDesc,
                keywords: keywordsArray,
                model_answer: modelAnsArray,
                explanation: editExpl,
                rubric: editRubric
            });

            if (success) {
                setSuccessMsg('수정 사항이 데이터베이스에 영구 반영되었습니다.');
                setErrorMsg(null);
                // Reload db data
                const qs = await getAdminQuestions();
                setQuestions(qs);
            } else {
                setErrorMsg('수정 처리가 실패하였습니다.');
            }
        } catch (e: any) {
            setErrorMsg(`서버 오류 발생: ${e.message || String(e)}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Delete Question ---
    const handleDeleteQuestion = async () => {
        if (!selectedQId) return;
        if (!confirm('문제를 영구 삭제하겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

        const success = await deleteQuestionAction(selectedQId);
        if (success) {
            setSuccessMsg('문제가 성공적으로 삭제되었습니다.');
            setErrorMsg(null);
            setSelectedQId(null);
            // Reload db data
            const qs = await getAdminQuestions();
            setQuestions(qs);
        } else {
            setErrorMsg('데이터베이스 삭제 오퍼레이션이 거부되었습니다.');
        }
    };

    // --- Change User Role ---
    const handleChangeRole = async () => {
        if (!selectedUser) return;

        // Removed hardcoded '준영2' check; server handles authorization completely.

        const success = await updateUserRoleAction(selectedUser, newRole);
        if (success) {
            setSuccessMsg(`사용자 ${selectedUser}의 권한 등급이 ${newRole}로 수정 완료.`);
            setErrorMsg(null);
            // Reload users list
            const allUsers = await getAllUsersAction();
            setUsers(allUsers);
        } else {
            setErrorMsg('권한 변경 오퍼레이션 실패.');
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
        <div className="max-w-5xl mx-auto w-full space-y-8 py-4">
            {/* Title */}
            <div className="flex items-center gap-3">
                <Settings className="w-8 h-8 text-accent animate-spin-slow" />
                <h1 className="text-3xl font-black">⚙️ 관리자 제어반 (Admin Console)</h1>
            </div>

            {/* Messages */}
            {successMsg && (
                <div className="p-4 bg-success/15 border border-success/30 text-success text-sm font-bold rounded-xl animate-fade-in">
                    {successMsg}
                </div>
            )}
            {errorMsg && (
                <div className="p-4 bg-danger/15 border border-danger/30 text-danger text-sm font-bold rounded-xl animate-fade-in">
                    {errorMsg}
                </div>
            )}

            {/* Tab Menu */}
            <div className="flex border-b border-card-border">
                <button
                    onClick={() => { setActiveTab('edit'); setErrorMsg(null); setSuccessMsg(null); }}
                    className={`pb-3 px-6 text-sm font-extrabold border-b-2 transition-all cursor-pointer ${activeTab === 'edit' ? 'border-accent text-accent' : 'border-transparent text-foreground/45 hover:text-foreground/75'
                        }`}
                >
                    🛠️ 문제 수정 / 삭제
                </button>
                <button
                    onClick={() => { setActiveTab('users'); setErrorMsg(null); setSuccessMsg(null); }}
                    className={`pb-3 px-6 text-sm font-extrabold border-b-2 transition-all cursor-pointer ${activeTab === 'users' ? 'border-accent text-accent' : 'border-transparent text-foreground/45 hover:text-foreground/75'
                        }`}
                >
                    👥 회원 권한 관리
                </button>
            </div>

            {/* Tab Contents */}
            <div className="space-y-6">

                {/* TAB 1: MANAGE/EDIT QUESTIONS */}
                {activeTab === 'edit' && (
                    <div className="space-y-6">

                        {/* Search Filter Panel */}
                        <div className="bg-card border border-card-border p-5 rounded-2xl shadow flex flex-col md:flex-row gap-4 items-end">
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                                <div>
                                    <label className="block text-xs font-bold text-foreground/50 mb-1">Part 필터</label>
                                    <select
                                        value={partFilter}
                                        onChange={(e) => setPartFilter(e.target.value)}
                                        className="w-full bg-card-border border border-card-border focus:border-accent text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none"
                                    >
                                        <option value="전체">전체 Parts</option>
                                        {Array.from(new Set(questions.map((q) => String(q.part)))).sort().map((p) => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-foreground/50 mb-1">Chapter 필터</label>
                                    <select
                                        value={chapFilter}
                                        onChange={(e) => setChapFilter(e.target.value)}
                                        className="w-full bg-card-border border border-card-border focus:border-accent text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none"
                                    >
                                        <option value="전체">전체 Chapters</option>
                                        {Array.from(new Set(questions.map((q) => String(q.chapter)))).sort().map((chap) => (
                                            <option key={chap} value={chap}>{chap === 'Unknown' ? 'Unknown' : `Ch.${chap}`}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-foreground/50 mb-1">제목 검색</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="문제 제목 검색어..."
                                            value={searchTitle}
                                            onChange={(e) => setSearchTitle(e.target.value)}
                                            className="w-full bg-card-border border border-card-border focus:border-accent text-foreground rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none"
                                        />
                                        <Search className="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Questions Selector List */}
                        <div className="bg-card border border-card-border rounded-xl p-5 shadow">
                            <label className="block text-xs font-bold text-foreground/50 mb-1.5 uppercase">수정/삭제 대상 문제 풀 선택</label>

                            {filteredQs.length === 0 ? (
                                <p className="text-sm text-foreground/50 py-2.5">검색에 부합하는 문제가 존재하지 않습니다.</p>
                            ) : (
                                <select
                                    onChange={(e) => {
                                        const qData = filteredQs.find((q) => q.id === Number(e.target.value));
                                        if (qData) handleLoadQuestionToEdit(qData);
                                    }}
                                    value={selectedQId || ''}
                                    className="w-full bg-card-border border border-card-border focus:border-accent text-foreground rounded-lg px-3 py-2.5 text-sm"
                                >
                                    <option value="">-- 수정할 문제를 선택하세요 ({filteredQs.length}건 검색됨) --</option>
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
                            <form onSubmit={handleUpdateQuestion} className="bg-card border border-card-border p-6 rounded-2xl shadow-lg space-y-4">
                                <div className="flex items-center justify-between border-b border-card-border pb-3">
                                    <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                                        <Edit3 className="w-5 h-5 text-accent" />
                                        <span>감사문제 상세 정보 수정 (ID: {selectedQId})</span>
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={handleDeleteQuestion}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-danger/10 border border-danger/20 text-danger hover:bg-danger/25 transition-colors cursor-pointer"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>영구 삭제</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-foreground/50 mb-1">Part 코드 (숫자만)</label>
                                        <input
                                            type="text"
                                            value={editPart}
                                            onChange={(e) => setEditPart(e.target.value)}
                                            className="w-full bg-card-border border border-card-border focus:border-accent text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-foreground/50 mb-1">Chapter 코드 (숫자만)</label>
                                        <input
                                            type="text"
                                            value={editChap}
                                            onChange={(e) => setEditChap(e.target.value)}
                                            className="w-full bg-card-border border border-card-border focus:border-accent text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-foreground/50 mb-1">감사기준 (Standard)</label>
                                        <input
                                            type="text"
                                            value={editStd}
                                            onChange={(e) => setEditStd(e.target.value)}
                                            className="w-full bg-card-border border border-card-border focus:border-accent text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-foreground/50 mb-1">문제 제목</label>
                                    <input
                                        type="text"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        className="w-full bg-card-border border border-card-border focus:border-accent text-foreground rounded-lg px-3.5 py-2.5 text-sm focus:outline-none font-bold"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-foreground/50 mb-1">문제 세부 지문</label>
                                    <textarea
                                        rows={6}
                                        value={editDesc}
                                        onChange={(e) => setEditDesc(e.target.value)}
                                        className="w-full bg-card-border border border-card-border focus:border-accent text-foreground rounded-lg p-3 text-sm focus:outline-none"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-foreground/50 mb-1">검색 핵심 키워드 (쉼표 구분)</label>
                                        <textarea
                                            rows={5}
                                            value={editKeywords}
                                            onChange={(e) => setEditKeywords(e.target.value)}
                                            className="w-full bg-card-border border border-card-border focus:border-accent text-foreground rounded-lg p-3 text-sm focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-foreground/50 mb-1">기본 모범답안 문법 (엔터 구분)</label>
                                        <textarea
                                            rows={5}
                                            value={editModelAns}
                                            onChange={(e) => setEditModelAns(e.target.value)}
                                            className="w-full bg-card-border border border-card-border focus:border-accent text-foreground rounded-lg p-3 text-sm focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-foreground/50 mb-1">전문 해설</label>
                                    <textarea
                                        rows={3}
                                        value={editExpl}
                                        onChange={(e) => setEditExpl(e.target.value)}
                                        className="w-full bg-card-border border border-card-border focus:border-accent text-foreground rounded-lg p-3 text-sm focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-foreground/50 mb-1">루브릭 구조 (Rubric JSON)</label>
                                    <textarea
                                        rows={6}
                                        value={editRubric}
                                        onChange={(e) => setEditRubric(e.target.value)}
                                        className="w-full bg-card-border border border-card-border focus:border-accent text-foreground rounded-lg p-3 text-sm focus:outline-none transition-colors font-mono"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`w-full py-3 font-black rounded-lg transition-colors flex items-center justify-center gap-1.5 ${isSubmitting ? 'bg-accent/50 text-background/50 cursor-not-allowed' : 'bg-accent hover:bg-accent text-background cursor-pointer'}`}
                                >
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 border-2 border-background/50 border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <span>데이터베이스 반영 저장하기</span>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                )}

                {/* TAB 2: USER PROFILE MANAGEMENT */}
                {activeTab === 'users' && (
                    <div className="space-y-6">
                        <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-lg">
                            <div className="p-4 bg-card-border/30 border-b border-card-border flex items-center gap-2">
                                <Users className="w-5 h-5 text-accent" />
                                <h3 className="text-sm font-bold text-foreground/75">회원 정보 목록</h3>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead>
                                        <tr className="bg-card-border/10 border-b border-card-border text-xs uppercase tracking-wider text-foreground/45 font-extrabold">
                                            <th className="px-6 py-3.5">닉네임</th>
                                            <th className="px-6 py-3.5">권한 등급</th>
                                            <th className="px-6 py-3.5">경험치</th>
                                            <th className="px-6 py-3.5">레벨</th>
                                            <th className="px-6 py-3.5 text-right">가입 관리일</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-card-border">
                                        {users.map((u) => (
                                            <tr key={u.id} className="hover:bg-card-border/30 transition-colors">
                                                <td className="px-6 py-4 font-bold text-foreground/90">{u.username}</td>
                                                <td className="px-6 py-4 text-xs font-semibold text-foreground/60">
                                                    {ROLE_NAMES[u.role] || u.role}
                                                </td>
                                                <td className="px-6 py-4 font-bold text-warning">{u.exp} EXP</td>
                                                <td className="px-6 py-4 font-bold text-foreground/80">Lv.{u.level}</td>
                                                <td className="px-6 py-4 text-right text-foreground/45 text-xs">
                                                    {new Date(u.created_at || '').toLocaleDateString('ko-KR')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Change role form */}
                        <div className="bg-card border border-card-border p-6 rounded-2xl shadow-lg space-y-4">
                            <h3 className="text-sm font-bold text-foreground/75">회원 등급 변경</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-foreground/50 mb-1">사용자 선택</label>
                                    <select
                                        value={selectedUser}
                                        onChange={(e) => setSelectedUser(e.target.value)}
                                        className="w-full bg-card-border border border-card-border focus:border-accent text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none"
                                    >
                                        <option value="">-- 사용자를 선택하세요 --</option>
                                        {users.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.username} ({ROLE_NAMES[u.role] || u.role})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-foreground/50 mb-1">변경할 권한 등급</label>
                                    <select
                                        value={newRole}
                                        onChange={(e) => setNewRole(e.target.value as any)}
                                        className="w-full bg-card-border border border-card-border focus:border-accent text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none"
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
                                className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-foreground font-bold rounded-lg text-sm transition-colors cursor-pointer"
                            >
                                변경 권한 적용하기
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
