'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    getUserReviewNotesAction,
    deleteReviewNoteAction,
    getStructureData
} from '../actions';
import { ROLE_NAMES, StructureData, compareChapters } from '../../lib/utils';
import { ReviewNote } from '../../lib/db';
import { Loading } from '../../components/Loading';
import { Trash2, ChevronDown, ChevronRight } from 'lucide-react';

export default function ProfilePage() {
    const { user, loading: authLoading } = useAuth();

    // States
    const [activeTab, setActiveTab] = useState<'stats' | 'notes'>('stats');
    const [notes, setNotes] = useState<ReviewNote[]>([]);
    const [structure, setStructure] = useState<StructureData | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedParts, setExpandedParts] = useState<{ [part: string]: boolean }>({});
    const [expandedChaps, setExpandedChaps] = useState<{ [chap: string]: boolean }>({});

    useEffect(() => {
        async function loadProfileData() {
            if (!user) {
                setLoading(false);
                return;
            }
            try {
                const struct = await getStructureData();
                setStructure(struct);

                if (user.role === 'PRO' || user.role === 'ADMIN') {
                    const fetchedNotes = await getUserReviewNotesAction(user.id);
                    setNotes(fetchedNotes);
                }
            } catch (err) {
                console.error('프로필 세션 로드 중 에러:', err);
            } finally {
                setLoading(false);
            }
        }
        loadProfileData();
    }, [user]);

    if (loading || authLoading) {
        return <Loading />;
    }

    if (!user) {
        return (
            <div className="max-w-3xl mx-auto w-full py-8">
                <h1 className="text-xl">로그인이 필요합니다</h1>
                <p className="text-sm text-foreground/55 mt-1.5">홈 화면에서 로그인한 뒤 다시 열어주세요.</p>
            </div>
        );
    }

    const isPaidOrAdmin = user.role === 'PRO' || user.role === 'ADMIN';

    // Toggle Part collapse
    const togglePart = (part: string) => {
        setExpandedParts((prev) => ({ ...prev, [part]: !prev[part] }));
    };

    // Toggle Chapter collapse
    const toggleChap = (chap: string) => {
        setExpandedChaps((prev) => ({ ...prev, [chap]: !prev[chap] }));
    };

    const handleDeleteNote = async (noteId: number) => {
        if (!confirm('이 오답 노트를 삭제할까요?')) return;
        // 세션이 만료되면 서버 액션이 throw한다 — catch가 없으면 삭제도 안 되고
        // 사용자에게 아무 안내도 가지 않는다.
        try {
            const success = await deleteReviewNoteAction(noteId);
            if (success) {
                setNotes((prev) => prev.filter((note) => note.id !== noteId));
            } else {
                alert('오답 노트 삭제에 실패했습니다.');
            }
        } catch (e: any) {
            alert(`오답 노트 삭제 실패: ${e.message || String(e)}`);
        }
    };

    // Prepare grouped notes hierarchy
    const getGroupedNotes = () => {
        const grouped: { [part: string]: { [chap: string]: ReviewNote[] } } = {};

        notes.forEach((note) => {
            // Find Part containing the chapter
            let notePart = '기타';
            let noteChap = note.chapter || '미분류';

            if (structure && note.chapter) {
                const cNum = note.chapter.match(/\d+/) ? note.chapter.match(/\d+/)![0] : note.chapter;
                let found = false;
                for (const pName of Object.keys(structure.hierarchy)) {
                    const chaps = structure.hierarchy[pName];
                    for (const cKey of Object.keys(chaps)) {
                        const cKeyNum = cKey.match(/\d+/) ? cKey.match(/\d+/)![0] : cKey;
                        if (cKeyNum === cNum) {
                            notePart = pName;
                            noteChap = structure.nameMap[cKey] || cKey;
                            found = true;
                            break;
                        }
                    }
                    if (found) break;
                }
            }

            if (!grouped[notePart]) grouped[notePart] = {};
            if (!grouped[notePart][noteChap]) grouped[notePart][noteChap] = [];
            grouped[notePart][noteChap].push(note);
        });

        return grouped;
    };

    const groupedNotes = getGroupedNotes();
    const rawRoleName = ROLE_NAMES[user.role] || user.role;
    // 채점 불가(-1)로 저장된 과거 노트는 평균에서 제외한다 — 0~10 척도 밖의 값이라
    // 섞이면 평균이 실제보다 낮게 나온다.
    const scoredNotes = notes.filter((n) => n.score >= 0);
    const averageScore = scoredNotes.length > 0
        ? (scoredNotes.reduce((acc, n) => acc + n.score, 0) / scoredNotes.length).toFixed(1)
        : null;

    // 보관된 오답 노트를 Part 단위로 집계한다. 별도 통계 테이블 없이 이미 불러온 데이터만 쓴다.
    const notesByPart = Object.keys(groupedNotes)
        .map((partName) => ({
            part: partName,
            count: Object.values(groupedNotes[partName]).reduce((acc, list) => acc + list.length, 0),
        }))
        .sort((a, b) => b.count - a.count);

    // Format model answer as Bullet HTML tags
    const renderModelAnswer = (mAns: any) => {
        if (!mAns) return <p className="text-foreground/40">등록된 모범 답안 없음</p>;
        let list: string[] = [];

        if (Array.isArray(mAns)) {
            list = mAns;
        } else if (typeof mAns === 'string' && mAns.startsWith('[')) {
            try {
                const parsed = JSON.parse(mAns.replace(/'/g, '"'));
                if (Array.isArray(parsed)) list = parsed;
                else list = [mAns];
            } catch {
                list = [mAns];
            }
        } else {
            list = String(mAns).split('\n');
        }

        return (
            <ul className="list-disc list-outside pl-4 space-y-1">
                {list.map((item, i) => (
                    <li key={i}>{item}</li>
                ))}
            </ul>
        );
    };

    return (
        <div className="max-w-3xl mx-auto w-full py-8 space-y-8">
            {/* Profile Overview */}
            <header className="space-y-4">
                <div>
                    <h1 className="text-2xl text-foreground">{user.username}</h1>
                    <p className="text-sm text-foreground/55 mt-1.5">
                        {rawRoleName} · 레벨 {user.level} · 누적 {user.exp} EXP
                    </p>
                </div>

                <div className="max-w-sm">
                    <div className="flex justify-between text-xs text-foreground/50 mb-1.5">
                        <span>다음 레벨까지</span>
                        <span>{user.exp % 100} / 100 EXP</span>
                    </div>
                    <div className="w-full h-1 bg-card-border rounded-full overflow-hidden">
                        <div
                            className="h-full bg-foreground/40 transition-all duration-500"
                            style={{ width: `${user.exp % 100}%` }}
                        />
                    </div>
                </div>
            </header>

            {/* Tabs Menu */}
            <div className="flex gap-6 border-b border-card-border">
                <button
                    onClick={() => setActiveTab('stats')}
                    className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${activeTab === 'stats'
                        ? 'border-foreground text-foreground'
                        : 'border-transparent text-foreground/45 hover:text-foreground/75'
                        }`}
                >
                    학습 통계
                </button>
                <button
                    onClick={() => setActiveTab('notes')}
                    className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${activeTab === 'notes'
                        ? 'border-foreground text-foreground'
                        : 'border-transparent text-foreground/45 hover:text-foreground/75'
                        }`}
                >
                    오답 노트
                </button>
            </div>

            {/* Tab Context Container */}
            <div className="space-y-6">

                {/* TAB 1: Dashboard Stats */}
                {activeTab === 'stats' && (
                    <div className="space-y-8">
                        <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
                            <div>
                                <dt className="text-xs text-foreground/50">누적 경험치</dt>
                                <dd className="text-xl text-foreground mt-1 tabular-nums">{user.exp}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-foreground/50">레벨</dt>
                                <dd className="text-xl text-foreground mt-1 tabular-nums">{user.level}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-foreground/50">보관 오답 노트</dt>
                                <dd className="text-xl text-foreground mt-1 tabular-nums">
                                    {isPaidOrAdmin ? notes.length : 0}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs text-foreground/50">오답 노트 평균 점수</dt>
                                <dd className="text-xl text-foreground mt-1 tabular-nums">
                                    {averageScore ?? '—'}
                                    {averageScore && <span className="text-sm text-foreground/45"> / 10</span>}
                                </dd>
                            </div>
                        </dl>

                        <div className="space-y-3">
                            <h2 className="text-sm font-medium text-foreground">Part별 오답 노트 분포</h2>

                            {!isPaidOrAdmin ? (
                                <p className="text-sm text-foreground/50 leading-relaxed">
                                    오답 노트는 등록공인회계사 등급부터 보관되며, 분포도 그때 함께 집계됩니다.
                                </p>
                            ) : notesByPart.length === 0 ? (
                                <p className="text-sm text-foreground/50 leading-relaxed">
                                    아직 보관된 오답 노트가 없습니다.
                                </p>
                            ) : (
                                <div className="space-y-2.5">
                                    {notesByPart.map(({ part, count }) => (
                                        <div key={part} className="flex items-center gap-4 text-sm">
                                            <span className="w-44 shrink-0 truncate text-foreground/75">{part}</span>
                                            <div className="flex-1 h-1 bg-card-border rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-foreground/40"
                                                    style={{ width: `${(count / notes.length) * 100}%` }}
                                                />
                                            </div>
                                            <span className="w-10 text-right tabular-nums text-foreground/60">{count}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 2: Notes Review */}
                {activeTab === 'notes' && (
                    <div className="space-y-4">
                        {!isPaidOrAdmin ? (
                            <div className="py-6 space-y-2">
                                <h3 className="text-base text-foreground">오답 노트를 이용할 수 없는 등급입니다</h3>
                                <p className="text-sm text-foreground/55 leading-relaxed">
                                    오답 노트 보관은 등록공인회계사와 관리자 등급에서 제공됩니다.
                                </p>
                            </div>
                        ) : notes.length === 0 ? (
                            <div className="py-6 space-y-2">
                                <h3 className="text-base text-foreground">보관된 오답 노트가 없습니다</h3>
                                <p className="text-sm text-foreground/55 leading-relaxed">
                                    채점 결과 화면에서 직접 저장하거나, 5점 이하로 채점된 문제는 자동으로 보관됩니다.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {Object.keys(groupedNotes).map((partName) => {
                                    const partExpanded = expandedParts[partName];
                                    const chaps = groupedNotes[partName];

                                    return (
                                        <div key={partName} className="bg-card border border-card-border rounded-lg overflow-hidden">
                                            {/* Part Header */}
                                            <button
                                                onClick={() => togglePart(partName)}
                                                aria-expanded={!!partExpanded}
                                                className={`w-full px-5 py-3.5 hover:bg-card-border/25 transition-colors flex items-center justify-between text-left cursor-pointer text-sm font-medium text-foreground ${partExpanded ? 'border-b border-card-border' : ''
                                                    }`}
                                            >
                                                <span>{partName}</span>
                                                {partExpanded ? (
                                                    <ChevronDown className="w-4 h-4 text-foreground/45" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4 text-foreground/45" />
                                                )}
                                            </button>

                                            {/* Part Chapters */}
                                            {partExpanded && (
                                                <div className="p-5 space-y-4 divide-y divide-card-border/40">
                                                    {Object.keys(chaps).sort(compareChapters).map((chapName, cIdx) => {
                                                        const chapExpanded = expandedChaps[chapName];
                                                        const listNotes = chaps[chapName];

                                                        return (
                                                            <div key={chapName} className={`${cIdx > 0 ? 'pt-4' : ''} space-y-2`}>
                                                                <button
                                                                    onClick={() => toggleChap(chapName)}
                                                                    aria-expanded={!!chapExpanded}
                                                                    className="w-full flex items-center gap-2 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors cursor-pointer text-left"
                                                                >
                                                                    {chapExpanded ? (
                                                                        <ChevronDown className="w-4 h-4 text-foreground/45" />
                                                                    ) : (
                                                                        <ChevronRight className="w-4 h-4 text-foreground/45" />
                                                                    )}
                                                                    <span>{chapName}</span>
                                                                    <span className="text-xs font-normal text-foreground/45">
                                                                        {listNotes.length}
                                                                    </span>
                                                                </button>

                                                                {chapExpanded && (
                                                                    <div className="pl-6 space-y-4 mt-3">
                                                                        {listNotes.map((note) => (
                                                                            <div
                                                                                key={note.id}
                                                                                className="border-t border-card-border pt-4 space-y-3 relative group"
                                                                            >
                                                                                {/* Delete Button */}
                                                                                <button
                                                                                    onClick={() => handleDeleteNote(note.id)}
                                                                                    className="absolute top-4 right-0 p-1.5 text-foreground/35 hover:text-danger md:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer"
                                                                                    aria-label="오답 노트 삭제"
                                                                                >
                                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                                </button>

                                                                                <div className="text-xs text-foreground/45 pr-8">
                                                                                    기준서 {note.standard_code || '미지정'} · {note.score}점 ·{' '}
                                                                                    {new Date(note.created_at || '').toLocaleDateString('ko-KR')}
                                                                                </div>

                                                                                <p className="text-sm text-foreground leading-relaxed">
                                                                                    {note.question_description}
                                                                                </p>

                                                                                {/* User answer segment */}
                                                                                <div className="text-sm">
                                                                                    <span className="text-xs text-foreground/50 block mb-1">내 답안</span>
                                                                                    <div className="text-foreground/75 whitespace-pre-wrap leading-relaxed">
                                                                                        {note.user_answer || '답안 없음'}
                                                                                    </div>
                                                                                </div>

                                                                                {/* Model answer segment */}
                                                                                <div className="text-sm">
                                                                                    <span className="text-xs text-foreground/50 block mb-1">모범 답안</span>
                                                                                    <div className="text-foreground/75 leading-relaxed">
                                                                                        {renderModelAnswer(note.model_answer)}
                                                                                    </div>
                                                                                </div>

                                                                                {/* Explanation segment */}
                                                                                {note.explanation && (
                                                                                    <div className="text-sm">
                                                                                        <span className="text-xs text-foreground/50 block mb-1">해설</span>
                                                                                        <p className="text-foreground/75 leading-relaxed">{note.explanation}</p>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
}
