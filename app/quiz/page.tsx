'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import {
    getStructureData,
    getNormalizedQuestions,
    gradeQuizBatch,
    saveQuizNoteAction
} from '../actions';
import {
    StructureData,
    getCounts,
    getQuizSet,
    compareChapters,
    compareStandards,
    ROLE_NAMES,
    MAX_ANSWER_LENGTH,
    maxQuestionsForRole
} from '../../lib/utils';
import { AuditQuestion } from '../../lib/db';
import type { GradeRequestItem, GradeResult } from '../../lib/serverUtils';
import { Loading } from '../../components/Loading';

type AppState = 'LOADING' | 'SETUP' | 'SOLVING' | 'REVIEW';

// One graded question: the source question, the user's answer, and the grade result.
type EvalResult = { q: AuditQuestion; ans: string; eval: GradeResult };

// 10점 만점 점수 표시. 눈금은 채점 척도 그대로 두고 별도 장식은 넣지 않는다.
// score < 0은 "0점"이 아니라 채점 자체가 불가했다는 신호(루브릭 검증 실패, 채점 API 오류)라
// 0.0으로 표시하면 답안이 빵점이었다는 뜻으로 잘못 읽힌다.
const ScoreMeter: React.FC<{ score: number }> = ({ score }) => {
    if (score < 0) {
        return (
            <div className="space-y-1">
                <span className="text-2xl text-foreground/60 leading-none">채점 불가</span>
                <p className="text-xs text-foreground/45">채점 의견을 확인해주세요.</p>
            </div>
        );
    }

    const clamped = Math.min(10, score);

    return (
        <div className="space-y-3">
            <div className="flex items-baseline gap-1.5">
                <span className="text-4xl text-foreground leading-none tabular-nums">{clamped.toFixed(1)}</span>
                <span className="text-sm text-foreground/45">/ 10</span>
            </div>

            <div
                className="w-full h-1 bg-card-border rounded-full overflow-hidden"
                role="meter"
                aria-valuenow={clamped}
                aria-valuemin={0}
                aria-valuemax={10}
            >
                <div
                    className="h-full bg-foreground/50 transition-all duration-500"
                    style={{ width: `${clamped * 10}%` }}
                />
            </div>
        </div>
    );
};

export default function QuizPage() {
    const router = useRouter();
    const { user, refreshProfile } = useAuth();

    // States
    const [appState, setAppState] = useState<AppState>('LOADING');
    const [structure, setStructure] = useState<StructureData | null>(null);
    const [dbData, setDbData] = useState<AuditQuestion[]>([]);
    const [solvedQuestions, setSolvedQuestions] = useState<Set<string>>(new Set());

    // Selection States
    const [selectedPart, setSelectedPart] = useState('');
    const [selectedChapter, setSelectedChapter] = useState('전체');
    const [selectedStandard, setSelectedStandard] = useState('전체');
    const [selectedCount, setSelectedCount] = useState<number>(1);
    const [savedNotes, setSavedNotes] = useState<Set<number>>(new Set());

    // Quiz Active States
    const [quizList, setQuizList] = useState<AuditQuestion[]>([]);
    const [answers, setAnswers] = useState<{ [id: string]: string }>({});
    const [results, setResults] = useState<EvalResult[]>([]);
    const [reviewIdx, setReviewIdx] = useState(0);
    const [gradingProgress, setGradingProgress] = useState(false);
    const [gradingMessage, setGradingMessage] = useState('');
    const [toastMsg, setToastMsg] = useState<string | null>(null);
    // 서버가 이번 제출로 실제 적립한 경험치. 클라이언트가 계산하지 않는다.
    const [awardedExp, setAwardedExp] = useState(0);

    // Load structure and DB data
    useEffect(() => {
        async function loadData() {
            try {
                const structData = await getStructureData();
                const questions = await getNormalizedQuestions();
                setStructure(structData);
                setDbData(questions);

                // Select first part by default
                const parts = Object.keys(structData.hierarchy).sort();
                if (parts.length > 0) {
                    setSelectedPart(parts[0]);
                }
                setAppState('SETUP');
            } catch (err) {
                console.error('데이터 로그 에러:', err);
                alert('데이터를 로드하는 중 오류가 발생했습니다. 새로고침 해주세요.');
                setAppState('SETUP'); // At least don't stay loading
            }
        }
        loadData();
    }, []);

    const counts = getCounts(dbData);

    // Handle standard dropdown change when Part/Chapter changes
    const getChapterOptions = () => {
        if (!structure || !selectedPart) return [];
        return ['전체', ...Object.keys(structure.hierarchy[selectedPart]).sort(compareChapters)];
    };

    const getStandardOptions = () => {
        if (!structure || !selectedPart) return [];
        if (selectedChapter === '전체') {
            const stdSet = new Set<string>();
            const chaps = structure.hierarchy[selectedPart];
            for (const c of Object.keys(chaps)) {
                chaps[c].forEach((s) => stdSet.add(s));
            }
            return ['전체', ...Array.from(stdSet).sort(compareStandards)];
        } else {
            return ['전체', ...(structure.hierarchy[selectedPart][selectedChapter] || []).sort(compareStandards)];
        }
    };

    // Adjust selectable questions based on user roles.
    // 상한값은 서버가 채점 요청을 검증할 때 쓰는 것과 같은 함수에서 가져온다 — 화면과
    // 서버가 따로 놀면 사용자가 고를 수 있는 문항 수가 서버에서 거절된다.
    const maxCount = maxQuestionsForRole(user?.role || 'GUEST');

    useEffect(() => {
        if (!user) return;
        if (selectedCount > maxCount) setSelectedCount(maxCount);
    }, [user, selectedCount, maxCount]);

    const handleStartQuiz = () => {
        // Map chapter short code to full name for matching
        const targetChap = selectedChapter !== '전체' && structure
            ? (structure.nameMap[selectedChapter] || selectedChapter)
            : '전체';

        const quizSet = getQuizSet(
            dbData,
            selectedPart,
            targetChap,
            selectedStandard,
            selectedCount,
            Array.from(solvedQuestions)
        );

        if (quizSet.length === 0) {
            alert('조건에 맞는 문제가 없습니다. (또는 이미 다 푸셨습니다)');
            return;
        }

        setQuizList(quizSet);
        const initialAnswers: { [id: string]: string } = {};
        quizSet.forEach((q) => {
            initialAnswers[q.id.toString()] = '';
        });
        setAnswers(initialAnswers);
        setAppState('SOLVING');
    };

    const handleAnswerSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setGradingProgress(true);
        setGradingMessage('답안을 채점하는 중');

        // 서버로는 문항 id와 답안만 보낸다. 질문 본문·모범 답안·루브릭은 서버가 qid로
        // DB에서 조회해 채운다 — 클라이언트가 보낸 값이 채점 프롬프트에 들어가면
        // 답안 구분자 방어를 우회하는 프롬프트 주입이 가능해진다.
        const batchItems: GradeRequestItem[] = [];
        const evaluationResults: (EvalResult | null)[] = new Array(quizList.length).fill(null);
        setAwardedExp(0);

        quizList.forEach((q, idx) => {
            const ans = answers[q.id.toString()] || '';
            if (!ans.trim()) {
                evaluationResults[idx] = {
                    q,
                    ans,
                    eval: { score: 0.0, evaluation: '답안을 입력해주세요.' }
                };
            } else {
                batchItems.push({
                    id: idx,
                    qid: Number(q.id),
                    a: ans
                });
            }
        });

        // 2. Call server side AI grading
        if (batchItems.length > 0) {
            setGradingMessage('답안의 논리 전개와 용어 사용을 확인하는 중');
            try {
                const { results: apiResults, awardedExp: gainedExp } = await gradeQuizBatch(batchItems);
                setAwardedExp(gainedExp);

                batchItems.forEach((item) => {
                    const idx = item.id;
                    const res = apiResults[idx];
                    evaluationResults[idx] = {
                        q: quizList[idx],
                        ans: item.a,
                        eval: res || { score: -1, evaluation: '채점 서버 오류가 발생했습니다.' }
                    };
                });
            } catch (err: any) {
                console.error('Grading err:', err);
                // 채점 실패는 0점이 아니라 -1(채점 불가)로 둔다. 0점으로 두면 아래 자동 보관
                // 조건(0 <= score <= 5)에 걸려 서버 오류·요청량 초과 메시지가 오답 노트에
                // 0점짜리 답안으로 영구 저장된다.
                batchItems.forEach((item) => {
                    const idx = item.id;
                    evaluationResults[idx] = {
                        q: quizList[idx],
                        ans: item.a,
                        eval: { score: -1, evaluation: `채점 중 오류가 발생했습니다: ${err.message || String(err)}` }
                    };
                });
            }
        }

        // 3. Save progress for Non-guests
        try {
            if (user.role !== 'GUEST') {
                setGradingMessage('학습 기록을 저장하는 중');
                // Save low score notes (<= 5.0) automatically for PRO or ADMIN
                const autoSaved = new Set<number>();
                for (let i = 0; i < evaluationResults.length; i++) {
                    const r = evaluationResults[i];
                    if (!r) continue;
                    if ((user.role === 'PRO' || user.role === 'ADMIN') && r.eval.score >= 0 && r.eval.score <= 5.0) {
                        try {
                            const success = await saveQuizNoteAction(user.id, Number(r.q.id), r.ans, r.eval.score);
                            if (success) {
                                autoSaved.add(i);
                            }
                        } catch (e) {
                            console.error('자동 보관 실패:', e);
                        }
                    }
                }
                setSavedNotes(autoSaved);

                // 경험치는 gradeQuizBatch가 서버에서 채점 결과로 직접 적립한다.
                // 여기서는 갱신된 값을 다시 읽어오기만 한다.
                await refreshProfile();
            }
        } catch (err) {
            console.error('Error saving progress:', err);
        } finally {
            // Mark as solved in this session
            const updatedSolved = new Set(solvedQuestions);
            quizList.forEach((q) => updatedSolved.add(q.id.toString()));
            setSolvedQuestions(updatedSolved);

            setResults(evaluationResults.filter((r): r is EvalResult => r !== null));
            setReviewIdx(0);
            setGradingProgress(false);
            setAppState('REVIEW');
        }
    };

    const handleSaveReportNote = async () => {
        if (!user || user.role === 'GUEST') return;
        if (savedNotes.has(reviewIdx)) {
            setToastMsg('이미 오답 노트에 저장된 문제입니다.');
            setTimeout(() => setToastMsg(null), 3000);
            return;
        }

        const currentRes = results[reviewIdx];

        try {
            const success = await saveQuizNoteAction(
                user.id,
                Number(currentRes.q.id),
                currentRes.ans,
                currentRes.eval.score
            );

            if (success) {
                setSavedNotes((prev) => {
                    const newSet = new Set(prev);
                    newSet.add(reviewIdx);
                    return newSet;
                });
                setToastMsg('오답 노트에 저장했습니다.');
                setTimeout(() => setToastMsg(null), 3000);
            } else {
                alert('오답 노트 저장에 실패했습니다.');
            }
        } catch (err) {
            console.error('Manual Note Save Error:', err);
            alert('오답 노트 저장 중 오류가 발생했습니다.');
        }
    };

    const handleRetrySetup = () => {
        setAppState('SETUP');
    };

    const handleRetrySameConfig = () => {
        handleStartQuiz();
    };

    // --- Loader View ---
    if (appState === 'LOADING') {
        return <Loading label="문제 불러오는 중" />;
    }

    // --- 1. SETUP STATE ---
    if (appState === 'SETUP') {
        const chapterOpts = getChapterOptions();
        const standardOpts = getStandardOptions();
        const isGuest = user?.role === 'GUEST';
        const isMember = user?.role === 'MEMBER';

        return (
            <div className="max-w-2xl mx-auto w-full bg-card border border-card-border rounded-lg p-6 md:p-8 space-y-6">
                <h1 className="text-xl">문제 범위 선택</h1>

                {isGuest && (
                    <div className="p-3 bg-card-border/40 border border-card-border text-foreground/70 rounded-md text-xs leading-relaxed">
                        비회원 모드에서는 학습 기록과 오답 노트가 저장되지 않습니다.
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Part Selection */}
                    <div>
                        <label htmlFor="quiz-part" className="block text-sm text-foreground/70 mb-1.5">
                            Part
                        </label>
                        <select
                            id="quiz-part"
                            value={selectedPart}
                            onChange={(e) => {
                                setSelectedPart(e.target.value);
                                setSelectedChapter('전체');
                                setSelectedStandard('전체');
                            }}
                            className="w-full bg-card-border/30 border border-card-border focus:border-primary text-foreground rounded-md px-3 py-2 text-sm focus:outline-none transition-colors"
                        >
                            {Object.keys(structure?.hierarchy || {}).sort().map((part) => (
                                <option key={part} value={part}>
                                    {part} ({counts.parts[part] || 0})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Chapter Selection */}
                    <div>
                        <label htmlFor="quiz-chapter" className="block text-sm text-foreground/70 mb-1.5">
                            Chapter
                        </label>
                        <select
                            id="quiz-chapter"
                            value={selectedChapter}
                            onChange={(e) => {
                                setSelectedChapter(e.target.value);
                                setSelectedStandard('전체');
                            }}
                            className="w-full bg-card-border/30 border border-card-border focus:border-primary text-foreground rounded-md px-3 py-2 text-sm focus:outline-none transition-colors"
                        >
                            {chapterOpts.map((chap) => {
                                let display = chap;
                                if (chap !== '전체' && structure) {
                                    const fullName = structure.nameMap[chap] || chap;
                                    const cCount = counts.chapters[fullName] || counts.chapters[chap] || 0;
                                    display = `${fullName} (${cCount})`;
                                }
                                return (
                                    <option key={chap} value={chap}>
                                        {display}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {/* Standard Selection */}
                    <div className="md:col-span-2">
                        <label htmlFor="quiz-standard" className="block text-sm text-foreground/70 mb-1.5">
                            회계감사기준
                        </label>
                        <select
                            id="quiz-standard"
                            value={selectedStandard}
                            onChange={(e) => setSelectedStandard(e.target.value)}
                            className="w-full bg-card-border/30 border border-card-border focus:border-primary text-foreground rounded-md px-3 py-2 text-sm focus:outline-none transition-colors"
                        >
                            {standardOpts.map((std) => (
                                <option key={std} value={std}>
                                    {std === '전체' ? '전체' : `${std} (${counts.standards[std] || 0})`}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Difficulty Access Restriction */}
                <div className="border-t border-card-border pt-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2.5">
                        <span className="text-sm text-foreground/70">문항 수</span>
                        {(isGuest || isMember) && (
                            <span className="text-xs text-foreground/45">
                                {ROLE_NAMES[user?.role || 'GUEST']} 등급은 {maxCount}문제까지 선택할 수 있습니다.
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        {[1, 3, 5].map((cnt) => {
                            const disabled = cnt > maxCount;

                            return (
                                <button
                                    key={cnt}
                                    type="button"
                                    disabled={disabled}
                                    aria-pressed={selectedCount === cnt}
                                    onClick={() => setSelectedCount(cnt)}
                                    className={`py-2.5 rounded-md border text-sm transition-colors cursor-pointer ${disabled
                                        ? 'border-card-border text-foreground/25 cursor-not-allowed'
                                        : selectedCount === cnt
                                            ? 'border-foreground/50 bg-card-border/40 text-foreground font-medium'
                                            : 'border-card-border text-foreground/65 hover:bg-card-border/30'
                                        }`}
                                >
                                    {cnt}문제
                                </button>
                            );
                        })}
                    </div>
                </div>

                <button
                    onClick={handleStartQuiz}
                    className="w-full h-11 bg-primary hover:bg-primary-hover text-white font-medium rounded-md transition-colors text-sm cursor-pointer"
                >
                    시작하기
                </button>
            </div>
        );
    }

    // --- 2. SOLVING STATE ---
    if (appState === 'SOLVING') {
        return (
            <div className="max-w-3xl mx-auto w-full space-y-6">
                <div className="flex items-baseline justify-between gap-4">
                    <h1 className="text-xl">답안 작성</h1>
                    <span className="text-sm text-foreground/50">{quizList.length}문항</span>
                </div>

                {gradingProgress ? (
                    <div className="bg-card border border-card-border rounded-lg py-20">
                        <Loading label={gradingMessage} />
                    </div>
                ) : (
                    <form onSubmit={handleAnswerSubmit} className="space-y-5">
                        {quizList.map((q, idx) => {
                            const fieldId = `answer-${q.id}`;
                            return (
                                <div key={q.id} className="bg-card border border-card-border rounded-lg p-6 space-y-4">
                                    <div className="space-y-2">
                                        <div className="text-xs text-foreground/45">
                                            {idx + 1} / {quizList.length}
                                        </div>
                                        <h2 className="text-base font-medium text-foreground">{q.question_title}</h2>
                                        <p className="text-sm leading-relaxed text-foreground/75 whitespace-pre-wrap">
                                            {q.question_description}
                                        </p>
                                    </div>

                                    <div>
                                        <label htmlFor={fieldId} className="block text-sm text-foreground/70 mb-1.5">
                                            답안
                                        </label>
                                        <textarea
                                            id={fieldId}
                                            rows={5}
                                            value={answers[q.id.toString()] || ''}
                                            onChange={(e) => setAnswers({ ...answers, [q.id.toString()]: e.target.value })}
                                            maxLength={MAX_ANSWER_LENGTH}
                                            placeholder="감사절차와 그 결과의 인과관계가 드러나도록 서술해주세요."
                                            className="w-full bg-card-border/25 border border-card-border focus:border-primary text-foreground rounded-md p-3 text-sm leading-relaxed focus:outline-none transition-colors"
                                            required
                                        />
                                    </div>
                                </div>
                            );
                        })}

                        <button
                            type="submit"
                            className="w-full h-11 bg-primary hover:bg-primary-hover text-white font-medium rounded-md transition-colors text-sm cursor-pointer"
                        >
                            제출하고 채점받기
                        </button>
                    </form>
                )}
            </div>
        );
    }

    // --- 3. REVIEW STATE ---
    if (appState === 'REVIEW') {
        const currentRes = results[reviewIdx];
        if (!currentRes) return null;

        const qData = currentRes.q;
        const uAns = currentRes.ans;
        const evalData = currentRes.eval;
        const isLast = reviewIdx === results.length - 1;
        const isFirst = reviewIdx === 0;

        return (
            <div className="max-w-4xl mx-auto w-full space-y-6">

                {/* Navigation header */}
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-card-border">
                    <h1 className="text-xl">
                        채점 결과 <span className="text-foreground/40 text-base">{reviewIdx + 1} / {results.length}</span>
                    </h1>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setReviewIdx(reviewIdx - 1)}
                            disabled={isFirst}
                            className="px-3 py-1.5 border border-card-border rounded-md text-sm text-foreground/75 hover:bg-card-border/40 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        >
                            이전
                        </button>
                        <button
                            onClick={() => setReviewIdx(reviewIdx + 1)}
                            disabled={isLast}
                            className="px-3 py-1.5 border border-card-border rounded-md text-sm text-foreground/75 hover:bg-card-border/40 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        >
                            다음
                        </button>
                    </div>
                </div>

                {/* 적립 경험치는 제출 단위 값이다. 문항별 점수 카드 안에 두면 문항마다
                    그만큼씩 받은 것처럼 읽히므로, 결과 화면 상단에 한 번만 보여준다. */}
                {awardedExp > 0 && (
                    <p className="text-xs text-foreground/45">
                        이번 제출({results.length}문항)로 {awardedExp} EXP를 적립했습니다.
                    </p>
                )}

                {/* Global Success Notification */}
                {toastMsg && (
                    <div className="p-3 bg-success/10 border border-success/30 text-success text-sm rounded-md">
                        {toastMsg}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">

                    {/* Detailed analysis logs */}
                    <div className="md:col-span-2 space-y-5">

                        {/* Question */}
                        <div className="bg-card border border-card-border rounded-lg p-6 space-y-2">
                            <h2 className="text-base font-medium text-foreground">{qData.question_title}</h2>
                            <p className="text-sm leading-relaxed text-foreground/75 whitespace-pre-wrap">
                                {qData.question_description}
                            </p>
                        </div>

                        {/* Answer Display */}
                        <div className="bg-card border border-card-border rounded-lg p-6 space-y-2">
                            <h3 className="text-sm font-medium text-foreground">내 답안</h3>
                            <p className="text-sm leading-relaxed text-foreground/75 whitespace-pre-wrap">
                                {uAns || '제출한 답안 없음'}
                            </p>
                        </div>

                        {/* Reference Model Answer */}
                        <div className="bg-card border border-card-border rounded-lg p-6 space-y-2">
                            <h3 className="text-sm font-medium text-foreground">모범 답안</h3>
                            <div className="text-sm leading-relaxed text-foreground/75 whitespace-pre-wrap">
                                {currentRes.eval.model_answer || '등록된 모범 답안이 없습니다.'}
                            </div>
                        </div>

                        {/* Feedback */}
                        <div className="bg-card border border-card-border rounded-lg p-6 space-y-2">
                            <h3 className="text-sm font-medium text-foreground">채점 의견</h3>
                            <div className="text-sm leading-relaxed text-foreground/75 whitespace-pre-wrap">
                                {evalData.evaluation}
                            </div>
                        </div>

                    </div>

                    {/* Score */}
                    <div className="bg-card border border-card-border p-6 rounded-lg space-y-5 md:sticky md:top-24">
                        <div className="space-y-3">
                            <h3 className="text-sm text-foreground/55">점수</h3>
                            <ScoreMeter score={evalData.score} />
                        </div>

                        {/* 채점 불가(-1) 결과는 저장하지 않는다 — 노트에 -1점으로 남아
                            프로필의 평균 점수를 0~10 범위 밖으로 끌어내린다. */}
                        {(user?.role === 'PRO' || user?.role === 'ADMIN') && evalData.score >= 0 && (
                            <button
                                onClick={handleSaveReportNote}
                                disabled={savedNotes.has(reviewIdx)}
                                className={`w-full py-2 rounded-md text-sm border transition-colors ${savedNotes.has(reviewIdx)
                                    ? 'border-card-border text-foreground/40 cursor-not-allowed'
                                    : 'border-card-border hover:bg-card-border/40 text-foreground cursor-pointer'
                                    }`}
                            >
                                {savedNotes.has(reviewIdx) ? '오답 노트에 저장됨' : '오답 노트에 저장'}
                            </button>
                        )}

                        {user?.role === 'MEMBER' && (
                            <p className="text-xs text-foreground/45 leading-relaxed">
                                오답 노트 보관은 등록공인회계사 등급부터 이용할 수 있습니다.
                            </p>
                        )}
                    </div>

                </div>

                {/* Ending options */}
                <div className="flex flex-wrap gap-3 pt-2">
                    <button
                        onClick={handleRetrySameConfig}
                        className="px-4 h-10 bg-primary hover:bg-primary-hover text-white font-medium rounded-md transition-colors cursor-pointer text-sm"
                    >
                        같은 범위로 더 풀기
                    </button>

                    <button
                        onClick={handleRetrySetup}
                        className="px-4 h-10 border border-card-border hover:bg-card-border/40 text-foreground font-medium rounded-md transition-colors cursor-pointer text-sm"
                    >
                        범위 다시 선택
                    </button>

                    <button
                        onClick={() => router.push('/')}
                        className="px-4 h-10 text-foreground/60 hover:text-foreground font-medium rounded-md transition-colors cursor-pointer text-sm"
                    >
                        홈으로
                    </button>
                </div>

            </div>
        );
    }

    return null;
}
