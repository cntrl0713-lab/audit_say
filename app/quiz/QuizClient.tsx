'use client';

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CircleAlert, Shuffle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAttemptResultAction, gradeQuestionSetV3Action, prepareQuestionSetSubmissionAction, updateReviewItemAction } from '../actions';
import type { PublicLearningQuestionSetV3 } from '../../lib/learningTypes';
import type { QuestionSetGradeResultV3 } from '../../lib/questionV3Grading';
import { StartLearningButton } from '../../components/StartLearningButton';
import { QuizWorkspace } from './QuizWorkspace';
import { answerDraftKey, createAnswerDraft, parseAnswerDraft } from './answerDraft';
import { canResumeSubmissionVersion, parseSubmissionSession, retireLegacySubmissionSessions, sameSubmissionAnswers, submissionSessionKey, type SubmissionSession } from './submissionSession';
import { ALL_TOPICS, createRandomQuizRun, nextRandomQuizRun, questionSetsInScope, quizScopeKey, type QuizScope, type RandomQuizRun } from './randomQuiz';

type ViewState = 'setup' | 'solving' | 'grading' | 'restoring' | 'review';

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export default function QuizClient({ initialSets, learningDbEnabled = false }: {
    initialSets: PublicLearningQuestionSetV3[];
    learningDbEnabled?: boolean;
}) {
    const { user, refreshProfile } = useAuth();
    const userId = user?.id;
    const [view, setView] = useState<ViewState>('setup');
    const [selectedPart, setSelectedPart] = useState<string | null>(null);
    const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
    const [selectedStyle, setSelectedStyle] = useState<'case' | 'standard'>('standard');
    const [activeSet, setActiveSet] = useState<PublicLearningQuestionSetV3 | null>(null);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [result, setResult] = useState<QuestionSetGradeResultV3 | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [attemptId, setAttemptId] = useState<string | null>(null);
    const [previousVersion, setPreviousVersion] = useState(false);
    const [reviewStatus, setReviewStatus] = useState<Record<string, string>>({});
    const [randomRuns, setRandomRuns] = useState<Record<string, RandomQuizRun<PublicLearningQuestionSetV3>>>({});
    const [activeRandomKey, setActiveRandomKey] = useState<string | null>(null);
    const [draftNotice, setDraftNotice] = useState('입력하면 이 탭에 임시 저장됩니다.');
    const draftOwner = useRef<string | undefined>(undefined);
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
        setRandomRuns({});
        setActiveRandomKey(null);
        draftOwner.current = undefined;
        setDraftNotice('입력하면 이 탭에 임시 저장됩니다.');
    }, [user?.id]);

    useEffect(() => {
        if (!userId) return;
        try {
            retireLegacySubmissionSessions(sessionStorage, userId, initialSets.flatMap(set => set.source_set_id ? [set.source_set_id] : []));
        } catch { /* Unavailable browser storage must not prevent a fresh learning session. */ }
    }, [userId, initialSets]);

    const styleSets = useMemo(() => initialSets.filter(set => !set.question_style || set.question_style === selectedStyle), [initialSets, selectedStyle]);
    const parts = useMemo(
        () => [...new Set(styleSets.flatMap(set => set.topics?.map(topic => topic.part) ?? [set.classification.part]))].sort(),
        [styleSets],
    );
    const topicCount = useMemo(
        () => new Set(initialSets.flatMap(set => set.topics?.map(topic => topic.id) ?? [set.classification.topic_id])).size,
        [initialSets],
    );
    const topics = useMemo(() => {
        const grouped = new Map<string, { id: string; title: string; count: number }>();
        for (const set of styleSets) {
          for (const mapped of set.topics ?? [{ id: set.classification.topic_id, part: set.classification.part, title: set.classification.chapter }]) {
            if (mapped.part !== selectedPart) continue;
            const topic = grouped.get(mapped.id);
            if (topic) {
                topic.count += 1;
            } else {
                grouped.set(mapped.id, {
                    id: mapped.id,
                    title: mapped.title,
                    count: 1,
                });
            }
          }
        }
        return [...grouped.values()].sort((left, right) => left.id.localeCompare(right.id));
    }, [styleSets, selectedPart]);
    const subquestionCount = useMemo(
        () => initialSets.reduce((sum, set) => sum + set.subquestions.length, 0),
        [initialSets],
    );
    const selectedScope = selectedPart && selectedTopic ? { part: selectedPart, topicId: selectedTopic, style: selectedStyle } : null;
    const visibleSets = questionSetsInScope(initialSets, selectedScope);
    const activeTopic = topics.find((topic) => topic.id === selectedTopic);
    const selectionTitle = selectedTopic === ALL_TOPICS ? `${selectedPart} 전체 주제` : activeTopic?.title;
    const selectedRandomRun = selectedScope ? randomRuns[quizScopeKey(selectedScope)] : undefined;
    const selectedRandomFinished = !!selectedRandomRun && selectedRandomRun.index + 1 === selectedRandomRun.sets.length;
    const activeRandomRun = activeRandomKey ? randomRuns[activeRandomKey] : undefined;
    const activeRandomFinished = !!activeRandomRun && activeRandomRun.index + 1 === activeRandomRun.sets.length;

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
        const location = new URL(window.location.href);
        location.searchParams.set('set', questionSet.id);
        window.history.replaceState(null, '', location);
        openedQuery.current = `${userId}:${questionSet.id}`;
        draftOwner.current = userId;
        setDraftNotice('입력하면 이 탭에 임시 저장됩니다.');
        let draft: ReturnType<typeof parseAnswerDraft> = null;
        if (userId) {
            try {
                const draftKey = answerDraftKey(userId, questionSet.id);
                if (newSubmission) sessionStorage.removeItem(draftKey);
                else draft = parseAnswerDraft(sessionStorage.getItem(draftKey), userId, questionSet);
                if (draft) { setAnswers(draft.answers); setDraftNotice('이 탭의 임시 답안을 복원했습니다.'); }
            } catch { setDraftNotice('임시 저장을 사용할 수 없습니다. 이동 전에 답안을 복사해 주세요.'); }
        }
        window.scrollTo({ top: 0, behavior: 'instant' });
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
            setAnswers(!saved.completed && draft && draft.savedAt > saved.saved_at ? draft.answers : saved.answers);
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

    const updateAnswer = (id: string, value: string) => {
        const nextAnswers = { ...answers, [id]: value };
        setAnswers(nextAnswers);
        if (!userId || !activeSet || draftOwner.current !== userId) return;
        try {
            sessionStorage.setItem(answerDraftKey(userId, activeSet.id), JSON.stringify(createAnswerDraft(userId, activeSet, nextAnswers)));
            setDraftNotice('이 탭에 임시 저장됨 · 탭을 닫으면 사라질 수 있습니다.');
        } catch { setDraftNotice('임시 저장 실패 · 이동 전에 답안을 복사해 주세요.'); }
    };

    useEffect(() => {
        if (!userId) return;
        const requested = new URLSearchParams(window.location.search).get('set');
        if (!requested || openedQuery.current === `${userId}:${requested}`) return;
        const questionSet = initialSets.find((item) => item.id === requested)
            ?? initialSets.find(item => item.source_set_id === requested);
        if (!questionSet) return;
        openedQuery.current = `${userId}:${requested}`;
        setSelectedPart(questionSet.classification.part);
        setSelectedTopic(questionSet.classification.topic_id);
        if (questionSet.question_style) setSelectedStyle(questionSet.question_style);
        setActiveRandomKey(null);
        startSet(questionSet);
    }, [userId, initialSets, startSet]);

    const playRandom = (scope: QuizScope, reshuffle = false) => {
        const key = quizScopeKey(scope);
        const previous = randomRuns[key];
        const run = !previous || reshuffle
            ? createRandomQuizRun(initialSets, scope)
            : nextRandomQuizRun(previous);
        if (!run) return;
        setRandomRuns((current) => ({ ...current, [key]: run }));
        setActiveRandomKey(key);
        startSet(run.sets[run.index]);
    };

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
                    && canResumeSubmissionVersion(saved, submittedSet)
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
                        learning_unit_id: submittedSet.learning_unit_id,
                        classification_version_ids: submittedSet.classification_version_ids,
                        answers: submittedAnswers,
                    });
                    if (currentUserId.current !== submittedUserId) return;
                    if (!prepared.ok) throw new Error(prepared.message);
                    token = prepared.submission_token;
                    submission.current = {
                        release_id: submittedSet.release_id,
                        set_version_id: submittedSet.set_version_id,
                        learning_unit_id: submittedSet.learning_unit_id,
                        classification_version_ids: submittedSet.classification_version_ids,
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
            if (submittedUserId) {
                try { sessionStorage.removeItem(answerDraftKey(submittedUserId, submittedSet.id)); } catch { /* A completed result remains available through the submission session. */ }
            }
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
        const location = new URL(window.location.href);
        location.searchParams.delete('set');
        window.history.replaceState(null, '', location);
        openedQuery.current = null;
        setView('setup');
        setActiveRandomKey(null);
        setActiveSet(null);
        setAnswers({});
        setResult(null);
        setError(null);
        setAttemptId(null);
        setPreviousVersion(false);
        submission.current = null;
    };

    const randomProgress = activeRandomRun && (
        <p role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-primary">
            <Shuffle aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{activeRandomRun.scope.part} · {activeRandomRun.scope.topicId === ALL_TOPICS ? '전체 주제' : activeSet?.classification.chapter}</span>
            <span>랜덤 {activeRandomRun.index + 1} / {activeRandomRun.sets.length}{activeRandomRun.scope.style === 'standard' ? '물음' : '문제'}</span>
        </p>
    );

    if (view === 'setup') {
        if (!user) return <div className="panel mx-auto my-10 w-full max-w-xl p-6 sm:p-10"><p className="eyebrow">CPA 2차 · 회계감사</p><h1 className="mt-4 text-2xl">한 물음부터 시작하세요.</h1><p className="mb-7 mt-4 text-sm leading-7 text-muted">비회원으로 문제를 풀거나 로그인해 학습 기록을 관리할 수 있습니다.</p><StartLearningButton /><Link href="/login" className="mt-5 inline-flex min-h-11 items-center text-sm text-muted">이미 계정이 있나요? 로그인 →</Link></div>;
        return (
            <div className="mx-auto w-full max-w-6xl space-y-6">
                <header className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                            출처 기반 신규 문제은행
                        </span>
                        <span className="text-xs text-foreground/50">{topicCount}개 주제 · {subquestionCount}개 물음</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-normal text-foreground">회계감사 문제 풀이</h1>
                        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground/60">
                            기준서형은 물음 하나씩, 사례형은 사실관계에 연결된 물음들을 함께 풉니다.
                            한 사례에 여러 주제가 포함될 수 있습니다.
                        </p>
                    </div>
                </header>

                <div role="group" aria-label="학습 유형" className="flex gap-2">
                    {(['standard', 'case'] as const).map(style => <button key={style} type="button"
                        aria-pressed={selectedStyle === style} onClick={() => { setSelectedStyle(style); setSelectedPart(null); setSelectedTopic(null); }}
                        className={`rounded-md border px-4 py-2 text-sm ${selectedStyle === style ? 'border-primary bg-primary/10 text-primary' : 'border-card-border text-foreground/65'}`}>
                        {style === 'standard' ? '기준서형' : '사례형'}
                    </button>)}
                </div>

                {learningDbEnabled && user?.role === 'GUEST' && (
                    <p className="rounded-lg border border-card-border p-4 text-sm text-foreground/60">
                        비회원의 답안과 채점 결과는 제출 후 7일간 보관됩니다. 경험치·랭킹·오답노트는 회원에게 제공됩니다.
                    </p>
                )}

                {initialSets.length === 0 && <p className="py-8 text-sm text-foreground/55">아직 공개된 문제가 없습니다.</p>}

                {initialSets.length > 0 && (
                    <div className="space-y-5 border-y border-card-border py-5">
                        <section aria-labelledby="quiz-part-label" className="space-y-3">
                            <h2 id="quiz-part-label" className="text-sm font-medium">1. Part 선택</h2>
                            <div role="group" aria-labelledby="quiz-part-label" className="flex flex-wrap gap-2">
                                {parts.map((part) => (
                                    <button
                                        key={part}
                                        type="button"
                                        aria-pressed={selectedPart === part}
                                        onClick={() => {
                                            if (selectedPart === part) return;
                                            setSelectedPart(part);
                                            setSelectedTopic(null);
                                        }}
                                        className={`rounded-md border px-3 py-2 text-xs transition-colors ${selectedPart === part
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-card-border bg-card text-foreground/65 hover:bg-card-border/30'
                                            }`}
                                    >
                                        {part}
                                    </button>
                                ))}
                            </div>
                        </section>
                        <section aria-labelledby="quiz-topic-label" className="space-y-3">
                            <h2 id="quiz-topic-label" className="text-sm font-medium">2. 주제 선택</h2>
                            {selectedPart ? (
                                <div role="group" aria-labelledby="quiz-topic-label" className="flex flex-wrap gap-1 rounded-lg border border-card-border bg-card-border/20 p-1">
                                    {[{ id: ALL_TOPICS, title: '전체', count: questionSetsInScope(initialSets, { part: selectedPart, topicId: ALL_TOPICS, style: selectedStyle }).length }, ...topics].map((topic) => (
                                        <button
                                            key={topic.id}
                                            type="button"
                                            aria-pressed={selectedTopic === topic.id}
                                            onClick={() => setSelectedTopic(topic.id)}
                                            className={`flex min-w-0 max-w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-xs leading-5 transition-colors ${selectedTopic === topic.id
                                                ? 'bg-card font-medium text-primary shadow-sm ring-1 ring-card-border'
                                                : 'text-foreground/65 hover:bg-card/70 hover:text-foreground'
                                                }`}
                                        >
                                            <span>{topic.id === ALL_TOPICS ? topic.title : `${topic.id}. ${topic.title}`}</span>
                                            <span className="shrink-0 text-[11px] opacity-70">{topic.count}{selectedStyle === 'case' ? '문제' : '물음'}</span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-foreground/55">Part를 선택하면 해당 Part의 주제가 표시됩니다.</p>
                            )}
                        </section>
                    </div>
                )}

                {selectedScope && selectionTitle ? (
                    <div className="space-y-4">
                        <div aria-live="polite" className="flex flex-wrap items-center justify-between gap-2">
                            <h2 className="text-base font-medium">{selectionTitle}</h2>
                            <p className="text-xs text-foreground/55">
                                {selectedStyle === 'case' && `${visibleSets.length}문제 · `}{visibleSets.reduce((sum, set) => sum + set.subquestions.length, 0)}개 물음
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-card-border bg-card p-4">
                            <div className="space-y-1 text-xs text-foreground/55">
                                <p>선택한 범위의 문제를 중복 없이 무작위로 풀어보세요.</p>
                                {selectedRandomRun && (
                                    <p aria-live="polite">
                                        {selectedRandomFinished
                                            ? '이번 순서의 모든 문제를 확인했습니다. 다시 섞어 시작할 수 있습니다.'
                                            : `이번 랜덤 순서에서 ${selectedRandomRun.index + 1} / ${selectedRandomRun.sets.length}${selectedStyle === 'standard' ? '물음' : '문제'}를 확인했습니다.`}
                                    </p>
                                )}
                                <p>랜덤 순서는 페이지를 새로고침하면 초기화됩니다.</p>
                            </div>
                            <button
                                type="button"
                                disabled={visibleSets.length === 0}
                                onClick={() => playRandom(selectedScope, selectedRandomFinished)}
                                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50 sm:w-auto"
                            >
                                <Shuffle aria-hidden="true" className="h-4 w-4" />
                                {selectedRandomFinished ? '다시 섞어 랜덤 풀기' : selectedRandomRun ? '다음 랜덤 문제' : '랜덤 풀기'}
                            </button>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {visibleSets.map((questionSet) => (
                                <button
                                    key={questionSet.id}
                                    type="button"
                                    onClick={() => {
                                        setActiveRandomKey(null);
                                        startSet(questionSet);
                                    }}
                                    className="group flex min-h-52 flex-col justify-between rounded-lg border border-card-border bg-card p-5 text-left transition-colors hover:border-primary/60 hover:bg-card-border/15"
                                >
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-3 text-xs text-foreground/45">
                                            <span>주제 {questionSet.topics?.map(topic => topic.id).join(' · ') ?? questionSet.classification.topic_id}</span>
                                            <span>{questionSet.max_points}점</span>
                                        </div>
                                        <h3 className="text-base font-medium leading-snug text-foreground group-hover:text-primary">
                                            {questionSet.title}
                                        </h3>
                                        <p className="text-xs leading-relaxed text-foreground/55">
                                            {questionSet.topics?.map(topic => topic.title).join(' · ') ?? questionSet.classification.chapter} · 물음 {questionSet.subquestions.length}개
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
                ) : selectedPart ? (
                    <p className="py-8 text-center text-sm text-foreground/55">주제를 선택하면 해당 주제의 문제가 표시됩니다.</p>
                ) : null}
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
                    <button type="button" onClick={() => startSet(activeSet, true)} className="rounded-md bg-primary px-4 py-2 text-primary-foreground">새 버전으로 다시 풀기</button>
                    <button type="button" onClick={returnToSetup} className="px-3 py-2 text-foreground/55">문제 목록</button>
                </div>
            </div>
        );
        return <QuizWorkspace key={activeSet.id + ':writing'} questionSet={activeSet} answers={answers}
            onAnswer={updateAnswer} onSubmit={submitAnswers} onBack={returnToSetup}
            onRestart={() => startSet(initialSets.find(set => set.id === activeSet.id) ?? activeSet, true)}
            draftNotice={draftNotice} error={error && <div role="alert" className="flex items-start gap-3 rounded-control border border-danger/30 bg-danger/10 p-4 text-sm text-danger"><CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{error}</div>}>
            {randomProgress}
        </QuizWorkspace>;
    }

    if (!result) return null;

    return <div className="space-y-5">
        <QuizWorkspace key={activeSet.id + ':review'} questionSet={activeSet} answers={answers} result={result}
            onAnswer={updateAnswer} onSubmit={submitAnswers} onBack={returnToSetup}
            onRestart={() => startSet(initialSets.find(set => set.id === activeSet.id) ?? activeSet, true)}
            draftNotice={draftNotice}
            error={error && <div role="status" className="panel p-4 text-sm"><p>{error}</p><button type="button" className="mt-2 min-h-11 text-primary" onClick={async () => { try { await refreshProfile(); setError(null); } catch { /* Keep the result and retry notice. */ } }}>프로필 다시 불러오기</button></div>}
            resultAction={learningDbEnabled && user && user.role !== 'GUEST' ? (id) => {
                const logicalId = activeSet.subquestions.find(question => question.id === id)?.logical_subquestion_id;
                if (!logicalId) return null;
                return <div className="flex flex-wrap items-center gap-3 text-sm">
                    <button type="button" disabled={reviewStatus[id] === '저장 중…'} className="button-secondary" onClick={() => {
                        setReviewStatus(current => ({ ...current, [id]: '저장 중…' }));
                        startTransition(async () => {
                            try {
                                const saved = await updateReviewItemAction({ subquestion_id: logicalId, status: 'open' });
                                setReviewStatus(current => ({ ...current, [id]: saved.ok ? '오답노트에 추가했습니다.' : saved.message }));
                            } catch (saveError) {
                                setReviewStatus(current => ({ ...current, [id]: errorMessage(saveError) }));
                            }
                        });
                    }}>오답노트에 추가</button>
                    {reviewStatus[id] && <span role="status" className="text-muted">{reviewStatus[id]}</span>}
                </div>;
            } : undefined}>
            {randomProgress}
            {attemptId && <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted"><p>풀이 결과가 저장되었습니다.</p><Link href={'/history?attempt=' + encodeURIComponent(attemptId)} className="text-primary">풀이 기록 보기 →</Link></div>}
        </QuizWorkspace>
        {activeRandomRun && <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => playRandom(activeRandomRun.scope, activeRandomFinished)} className="button-primary"><Shuffle aria-hidden="true" className="size-4" />{activeRandomFinished ? '다시 섞어 랜덤 풀기' : '다음 랜덤 문제'}</button>
            {activeRandomFinished && <p role="status" className="text-sm text-muted">이번 랜덤 순서를 모두 마쳤습니다.</p>}
        </div>}
    </div>;
}
