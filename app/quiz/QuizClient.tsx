'use client';

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CircleAlert, RotateCcw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAttemptResultAction, gradeQuestionSetV3Action, prepareQuestionSetSubmissionAction, updateReviewItemAction } from '../actions';
import type { PublicQuestionSetV3 } from '../../lib/questionV3';
import type { PublicLearningQuestionSetV3 } from '../../lib/learningTypes';
import type { QuestionSetGradeResultV3 } from '../../lib/questionV3Grading';
import { QUESTION_V3_ANSWER_MAX_LENGTH } from '../../lib/questionV3Answer';
import { GradeResultDetails } from '../../components/GradeResultDetails';
import { canResumeSubmissionVersion, parseSubmissionSession, sameSubmissionAnswers, submissionSessionKey, type SubmissionSession } from './submissionSession';

type ViewState = 'setup' | 'solving' | 'grading' | 'restoring' | 'review';

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function questionTypeLabel(type: PublicQuestionSetV3['subquestions'][number]['type']): string {
    if (type === 'enumeration') return '열거형';
    if (type === 'judgment') return '판단형';
    return '서술형';
}

export default function QuizClient({ initialSets, learningDbEnabled = false }: {
    initialSets: PublicLearningQuestionSetV3[];
    learningDbEnabled?: boolean;
}) {
    const { user, refreshProfile } = useAuth();
    const userId = user?.id;
    const [view, setView] = useState<ViewState>('setup');
    const [selectedPart, setSelectedPart] = useState('전체');
    const [activeSet, setActiveSet] = useState<PublicLearningQuestionSetV3 | null>(null);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [result, setResult] = useState<QuestionSetGradeResultV3 | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [attemptId, setAttemptId] = useState<string | null>(null);
    const [previousVersion, setPreviousVersion] = useState(false);
    const [reviewStatus, setReviewStatus] = useState<Record<string, string>>({});
    const submitting = useRef(false);
    const submission = useRef<SubmissionSession | null>(null);
    const currentUserId = useRef(user?.id);
    const openedQuery = useRef<string | null>(null);

    useEffect(() => {
        currentUserId.current = user?.id;
        openedQuery.current = null;
        submission.current = null;
        setView('setup');
        setActiveSet(null);
        setResult(null);
        setAnswers({});
        setError(null);
        setAttemptId(null);
        setPreviousVersion(false);
    }, [user?.id]);

    const parts = useMemo(
        () => ['전체', ...new Set(initialSets.map((set) => set.classification.part))],
        [initialSets],
    );
    const subquestionCount = useMemo(
        () => initialSets.reduce((sum, set) => sum + set.subquestions.length, 0),
        [initialSets],
    );
    const visibleSets = selectedPart === '전체'
        ? initialSets
        : initialSets.filter((set) => set.classification.part === selectedPart);

    const startSet = useCallback((questionSet: PublicLearningQuestionSetV3, newSubmission = false) => {
        setActiveSet(questionSet);
        setAnswers(Object.fromEntries(questionSet.subquestions.map((subquestion) => [subquestion.id, ''])));
        setResult(null);
        setError(null);
        setAttemptId(null);
        setPreviousVersion(false);
        setReviewStatus({});
        submission.current = null;
        setView('solving');
        if (!learningDbEnabled || !userId) return;
        const key = submissionSessionKey(userId, questionSet.id);
        try {
            if (newSubmission) {
                sessionStorage.removeItem(key);
                return;
            }
            const saved = parseSubmissionSession(sessionStorage.getItem(key));
            if (!saved) {
                sessionStorage.removeItem(key);
                return;
            }
            if (!canResumeSubmissionVersion(saved, questionSet)) {
                // Keep the prior token until the user explicitly starts a new submission.
                submission.current = saved;
                setAttemptId(saved.attempt_id ?? null);
                setPreviousVersion(true);
                return;
            }
            // An unchanged version in a newer release must still retry its original signed release.
            setActiveSet({ ...questionSet, release_id: saved.release_id });
            submission.current = saved;
            setAnswers(saved.answers);
            if (saved.completed && saved.attempt_id) {
                setView('restoring');
                startTransition(async () => {
                    try {
                        const response = await getAttemptResultAction(saved.attempt_id!);
                        if (currentUserId.current !== userId) return;
                        if (!response.ok) {
                            setError(response.message);
                            setView('solving');
                            return;
                        }
                        setResult(response.result);
                        setAttemptId(response.attempt_id);
                        setView('review');
                    } catch (loadError) {
                        if (currentUserId.current !== userId) return;
                        setError(`이전 결과를 불러오지 못했습니다. 풀이 기록에서 다시 확인해 주세요. ${errorMessage(loadError)}`);
                        setView('solving');
                    }
                });
            } else {
                setError('이전 제출 답안을 복원했습니다. 제출 버튼을 누르면 같은 제출로 다시 요청합니다.');
            }
        } catch {
            setError('이 브라우저에서 제출 복원 기능을 사용할 수 없습니다. 브라우저의 저장소 설정을 확인해 주세요.');
        }
    }, [learningDbEnabled, userId]);

    useEffect(() => {
        if (!userId) return;
        const requested = new URLSearchParams(window.location.search).get('set');
        if (!requested || openedQuery.current === `${userId}:${requested}`) return;
        const questionSet = initialSets.find((item) => item.id === requested);
        if (!questionSet) return;
        openedQuery.current = `${userId}:${requested}`;
        startSet(questionSet);
    }, [userId, initialSets, startSet]);

    const submitAnswers = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!activeSet || submitting.current) return;
        const submittedSet = activeSet;
        const submittedAnswers = { ...answers };
        const submittedUserId = user?.id;
        submitting.current = true;
        setView('grading');
        setError(null);
        startTransition(async () => {
        try {
            let token: string | undefined;
            if (learningDbEnabled) {
                if (!submittedUserId) throw new Error('로그인하거나 비회원으로 시작한 뒤 제출해 주세요.');
                if (!submittedSet.release_id || !submittedSet.set_version_id) throw new Error('문제 버전 정보를 불러오지 못했습니다. 문제 목록을 새로 불러와 주세요.');
                const saved = submission.current;
                if (saved && saved.release_id === submittedSet.release_id
                    && saved.set_version_id === submittedSet.set_version_id
                    && sameSubmissionAnswers(saved.answers, submittedAnswers)) {
                    token = saved.submission_token;
                    // A completed submission is a read. Never regrade it when result recovery fails.
                    if (saved.completed && saved.attempt_id) {
                        const previous = await getAttemptResultAction(saved.attempt_id);
                        if (currentUserId.current !== submittedUserId) return;
                        if (!previous.ok) throw new Error(previous.message);
                        setResult(previous.result);
                        setAttemptId(previous.attempt_id);
                        setView('review');
                        return;
                    }
                } else {
                    const prepared = await prepareQuestionSetSubmissionAction({
                        release_id: submittedSet.release_id,
                        set_version_id: submittedSet.set_version_id,
                        answers: submittedAnswers,
                    });
                    if (currentUserId.current !== submittedUserId) return;
                    if (!prepared.ok) throw new Error(prepared.message);
                    token = prepared.submission_token;
                    submission.current = {
                        release_id: submittedSet.release_id,
                        set_version_id: submittedSet.set_version_id,
                        submission_token: token,
                        answers: submittedAnswers,
                        saved_at: Date.now(),
                    };
                }
                // Persist before grading so a lost response can reuse the exact submission.
                sessionStorage.setItem(submissionSessionKey(submittedUserId, submittedSet.id), JSON.stringify(submission.current));
            }
            const response = learningDbEnabled
                ? await gradeQuestionSetV3Action(submittedSet.id, submittedAnswers, token)
                : await gradeQuestionSetV3Action(submittedSet.id, submittedAnswers);
            if (currentUserId.current !== submittedUserId) return;
            if (!response.ok) {
                setError(response.message);
                setView('solving');
                return;
            }
            setResult(response.result);
            setAttemptId(response.attempt_id ?? null);
            setView('review');
            if (learningDbEnabled && submission.current && submittedUserId) {
                submission.current = { ...submission.current, completed: true, attempt_id: response.attempt_id };
                try {
                    sessionStorage.setItem(submissionSessionKey(submittedUserId, submittedSet.id), JSON.stringify(submission.current));
                } catch {
                    setError('채점은 저장되었으나 브라우저의 결과 복원 정보를 갱신하지 못했습니다. 풀이 기록에서 확인할 수 있습니다.');
                }
            }
            try {
                await refreshProfile();
            } catch {
                setError('채점은 완료되었으나 프로필을 새로 불러오지 못했습니다.');
            }
        } catch (submitError) {
            if (currentUserId.current !== submittedUserId) return;
            setError(errorMessage(submitError));
            setView('solving');
        } finally {
            submitting.current = false;
        }
        });
    };

    const returnToSetup = () => {
        setView('setup');
        setActiveSet(null);
        setAnswers({});
        setResult(null);
        setError(null);
        setAttemptId(null);
        setPreviousVersion(false);
        submission.current = null;
    };

    if (view === 'setup') {
        return (
            <div className="mx-auto w-full max-w-6xl space-y-6">
                <header className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                            출처 기반 신규 문제은행
                        </span>
                        <span className="text-xs text-foreground/50">19개 주제 · {initialSets.length}세트 · {subquestionCount}개 세부 문항</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-normal text-foreground">회계감사 연계형 문제</h1>
                        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground/60">
                            기준서 원문에 근거해 제작된 신규 문제입니다. 하나의 공통 맥락 아래 여러 물음을 풀고,
                            각 물음은 독립적인 채점기준으로 판정됩니다.
                        </p>
                    </div>
                </header>

                {learningDbEnabled && user?.role === 'GUEST' && (
                    <p className="rounded-lg border border-card-border p-4 text-sm text-foreground/60">
                        비회원의 답안과 채점 결과는 제출 후 7일간 보관됩니다. 경험치·랭킹·오답노트는 회원에게 제공됩니다.
                    </p>
                )}

                {initialSets.length === 0 && <p className="py-8 text-sm text-foreground/55">아직 공개된 문제 세트가 없습니다.</p>}

                <div className="flex flex-wrap gap-2 border-y border-card-border py-4">
                    {parts.map((part) => (
                        <button
                            key={part}
                            type="button"
                            onClick={() => setSelectedPart(part)}
                            className={`rounded-md border px-3 py-2 text-xs transition-colors ${selectedPart === part
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-card-border bg-card text-foreground/65 hover:bg-card-border/30'
                                }`}
                        >
                            {part}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {visibleSets.map((questionSet) => (
                        <button
                            key={questionSet.id}
                            type="button"
                            onClick={() => startSet(questionSet)}
                            className="group flex min-h-52 flex-col justify-between rounded-lg border border-card-border bg-card p-5 text-left transition-colors hover:border-primary/60 hover:bg-card-border/15"
                        >
                            <div className="space-y-3">
                                <div className="flex items-center justify-between gap-3 text-xs text-foreground/45">
                                    <span>주제 {questionSet.classification.topic_id}</span>
                                    <span>{questionSet.max_points}점</span>
                                </div>
                                <h2 className="text-base font-medium leading-snug text-foreground group-hover:text-primary">
                                    {questionSet.title}
                                </h2>
                                <p className="text-xs leading-relaxed text-foreground/55">
                                    {questionSet.classification.chapter} · 세부 물음 {questionSet.subquestions.length}개
                                </p>
                            </div>
                            <div className="mt-5 flex flex-wrap gap-1.5">
                                {questionSet.classification.standards.map((standard) => (
                                    <span key={standard} className="rounded bg-card-border/40 px-2 py-1 text-[11px] text-foreground/55">
                                        {standard}
                                    </span>
                                ))}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (!activeSet) return null;

    if (view === 'grading' || view === 'restoring') {
        return (
            <div role="status" aria-live="polite" className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center rounded-lg border border-card-border bg-card px-6 py-20 text-center">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <h1 className="mt-5 text-lg font-medium">{view === 'restoring' ? '저장된 채점 결과를 불러오고 있습니다' : '답안을 제출하고 채점하고 있습니다'}</h1>
                <p className="mt-2 text-sm text-foreground/50">{view === 'restoring' ? '이전에 완료한 풀이 결과를 확인합니다.' : '물음별 채점기준에 따라 판정합니다. 잠시만 기다려 주세요.'}</p>
            </div>
        );
    }

    if (view === 'solving') {
        if (previousVersion) return (
            <div className="mx-auto w-full max-w-3xl space-y-5 rounded-lg border border-card-border bg-card p-6">
                <h1 className="text-xl">이전 버전의 제출 정보가 남아 있습니다</h1>
                <p className="text-sm leading-7 text-foreground/65">이 문제의 내용이 개정되었습니다. 풀이 기록에서 이전 제출의 처리 상태와 결과를 확인하세요. 새 버전으로 다시 풀기를 선택하면 별도의 새 제출로 시작합니다.</p>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                    <Link href={attemptId ? `/history?attempt=${encodeURIComponent(attemptId)}` : '/history'} className="rounded-md border border-card-border px-4 py-2 text-primary">이전 풀이 기록 확인</Link>
                    <button type="button" onClick={() => startSet(activeSet, true)} className="rounded-md bg-primary px-4 py-2 text-white">새 버전으로 다시 풀기</button>
                    <button type="button" onClick={returnToSetup} className="px-3 py-2 text-foreground/55">문제 목록</button>
                </div>
            </div>
        );
        return (
            <div className="mx-auto w-full max-w-4xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <button type="button" onClick={returnToSetup} className="flex items-center gap-2 text-sm text-foreground/55 hover:text-foreground">
                        <ArrowLeft className="h-4 w-4" /> 문제 목록
                    </button>
                    {learningDbEnabled && <button type="button" onClick={() => startSet(initialSets.find((set) => set.id === activeSet.id) ?? activeSet, true)} className="text-xs text-foreground/50">답안을 비우고 새로 풀기</button>}
                </div>

                <header className="rounded-lg border border-card-border bg-card p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs text-primary">주제 {activeSet.classification.topic_id}</span>
                        <span className="text-xs text-foreground/50">총 {activeSet.max_points}점</span>
                    </div>
                    <h1 className="mt-3 text-xl font-medium">{activeSet.title}</h1>
                    <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-foreground/55">
                        {activeSet.classification.standards.map((standard) => (
                            <span key={standard} className="rounded border border-card-border px-2 py-1">{standard}</span>
                        ))}
                    </div>
                </header>

                {activeSet.shared_context.facts.length > 0 && (
                    <section className="rounded-lg border border-card-border bg-card p-5">
                        <h2 className="text-xs font-medium uppercase tracking-wider text-foreground/45">공통 사실관계</h2>
                        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/80">
                            {activeSet.shared_context.facts.map((fact) => <li key={fact.id}>· {fact.text}</li>)}
                        </ul>
                    </section>
                )}

                {error && (
                    <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
                        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={submitAnswers} className="space-y-5">
                    {activeSet.subquestions.map((subquestion, index) => (
                        <section key={subquestion.id} className="rounded-lg border border-card-border bg-card p-5 md:p-6">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-medium text-primary">물음 {index + 1} · {questionTypeLabel(subquestion.type)}</span>
                                <span className="text-xs text-foreground/45">{subquestion.max_points}점</span>
                            </div>
                            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground/90">{subquestion.prompt}</p>
                            <label htmlFor={`${subquestion.id}-answer`} className="mt-5 block text-xs font-medium text-foreground/50">
                                답안
                            </label>
                            <textarea
                                id={`${subquestion.id}-answer`}
                                rows={5}
                                maxLength={QUESTION_V3_ANSWER_MAX_LENGTH}
                                value={answers[subquestion.id] ?? ''}
                                onChange={(event) => setAnswers((current) => ({ ...current, [subquestion.id]: event.target.value }))}
                                placeholder="물음에서 요구한 내용을 모두 작성하세요."
                                className="mt-2 w-full rounded-md border border-card-border bg-card-border/20 p-3 text-sm leading-6 text-foreground outline-none transition-colors focus:border-primary"
                            />
                            <p className="mt-1 text-xs text-foreground/45">물음당 최대 5,000자 · 미작성 물음은 0점으로 처리됩니다.</p>
                        </section>
                    ))}
                    <button type="submit" className="w-full rounded-md bg-primary py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover">
                        세트 제출 및 AI 판정
                    </button>
                </form>
            </div>
        );
    }

    if (!result) return null;

    return (
        <div className="mx-auto w-full max-w-5xl space-y-6">
            <header className="rounded-lg border border-card-border bg-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <span className="text-xs text-primary">채점 완료</span>
                        <h1 className="mt-2 text-xl font-medium">{activeSet.title}</h1>
                    </div>
                    <div className="text-right">
                        <span className="block text-xs text-foreground/45">세트 점수</span>
                        <strong className="text-3xl font-normal">{result.score}<span className="text-base text-foreground/50"> / {result.max_points}</span></strong>
                    </div>
                </div>
                <div className="mt-5 flex items-center gap-2 border-t border-card-border pt-4 text-xs text-foreground/55">
                    <ShieldCheck className="h-4 w-4 text-success" />
                    AI 판정 뒤 인용 검증과 정수 배점 계산을 서버에서 다시 수행했습니다.
                </div>
            </header>

            {error && (
                <div role="status" className="rounded-lg border border-card-border bg-card p-4 text-sm">
                    <p>{error}</p>
                    <button type="button" className="mt-2 text-primary" onClick={async () => {
                        try { await refreshProfile(); setError(null); } catch { /* Keep the result and retry notice. */ }
                    }}>프로필 다시 불러오기</button>
                </div>
            )}

            {attemptId && (
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-foreground/60">
                    <p>풀이 결과가 저장되었습니다. 풀이 기록에서 다시 확인할 수 있습니다.</p>
                    <Link href={`/history?attempt=${encodeURIComponent(attemptId)}`} className="text-primary">풀이 기록 보기</Link>
                </div>
            )}

            <GradeResultDetails result={result} subquestionAction={learningDbEnabled && user && user.role !== 'GUEST' ? (id) => {
                const logicalId = activeSet.subquestions.find((question) => question.id === id)?.logical_subquestion_id;
                if (!logicalId) return null;
                return <div className="flex flex-wrap items-center gap-3 text-xs">
                    <button type="button" disabled={reviewStatus[id] === '저장 중…'} className="rounded-md border border-card-border px-3 py-2 text-primary disabled:opacity-50" onClick={() => {
                        setReviewStatus((current) => ({ ...current, [id]: '저장 중…' }));
                        startTransition(async () => {
                            try {
                                const saved = await updateReviewItemAction({ subquestion_id: logicalId, status: 'open' });
                                setReviewStatus((current) => ({ ...current, [id]: saved.ok ? '오답노트에 추가했습니다.' : saved.message }));
                            } catch (saveError) {
                                setReviewStatus((current) => ({ ...current, [id]: errorMessage(saveError) }));
                            }
                        });
                    }}>오답노트에 추가</button>
                    {reviewStatus[id] && <span role="status" className="text-foreground/60">{reviewStatus[id]}</span>}
                </div>;
            } : undefined} />

            <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => startSet(initialSets.find((set) => set.id === activeSet.id) ?? activeSet, true)} className="flex items-center justify-center gap-2 rounded-md border border-card-border py-3 text-sm hover:bg-card-border/20">
                    <RotateCcw className="h-4 w-4" /> 같은 세트 다시 풀기
                </button>
                <button type="button" onClick={returnToSetup} className="rounded-md bg-primary py-3 text-sm font-medium text-white hover:bg-primary-hover">
                    다른 주제 선택
                </button>
            </div>
        </div>
    );
}
