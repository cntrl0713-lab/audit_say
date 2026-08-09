'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, CircleAlert, RotateCcw, ShieldCheck, XCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { gradeQuestionSetV3Action } from '../actions';
import type { PublicQuestionSetV3 } from '../../lib/questionV3';
import type { QuestionSetGradeResultV3 } from '../../lib/questionV3Grading';

type ViewState = 'setup' | 'solving' | 'grading' | 'review';

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function questionTypeLabel(type: PublicQuestionSetV3['subquestions'][number]['type']): string {
    if (type === 'enumeration') return '열거형';
    if (type === 'judgment') return '판단형';
    return '서술형';
}

export default function QuizClient({ initialSets }: { initialSets: PublicQuestionSetV3[] }) {
    const { refreshProfile } = useAuth();
    const [view, setView] = useState<ViewState>('setup');
    const [selectedPart, setSelectedPart] = useState('전체');
    const [activeSet, setActiveSet] = useState<PublicQuestionSetV3 | null>(null);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [result, setResult] = useState<QuestionSetGradeResultV3 | null>(null);
    const [error, setError] = useState<string | null>(null);

    const parts = useMemo(
        () => ['전체', ...new Set(initialSets.map((set) => set.classification.part))],
        [initialSets],
    );
    const visibleSets = selectedPart === '전체'
        ? initialSets
        : initialSets.filter((set) => set.classification.part === selectedPart);

    const startSet = (questionSet: PublicQuestionSetV3) => {
        setActiveSet(questionSet);
        setAnswers(Object.fromEntries(questionSet.subquestions.map((subquestion) => [subquestion.id, ''])));
        setResult(null);
        setError(null);
        setView('solving');
    };

    const submitAnswers = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!activeSet) return;
        setView('grading');
        setError(null);
        try {
            const graded = await gradeQuestionSetV3Action(activeSet.id, answers);
            setResult(graded);
            setView('review');
            await refreshProfile();
        } catch (submitError) {
            setError(errorMessage(submitError));
            setView('solving');
        }
    };

    const returnToSetup = () => {
        setView('setup');
        setActiveSet(null);
        setAnswers({});
        setResult(null);
        setError(null);
    };

    if (view === 'setup') {
        return (
            <div className="mx-auto w-full max-w-6xl space-y-6">
                <header className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                            출처 기반 신규 문제은행
                        </span>
                        <span className="text-xs text-foreground/50">19개 주제 · 45세트 · 90개 세부 문항</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-normal text-foreground">회계감사 연계형 문제</h1>
                        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground/60">
                            기준서 원문에 근거해 제작된 신규 문제입니다. 하나의 공통 맥락 아래 여러 물음을 풀고,
                            각 물음은 독립적인 criterion으로 판정됩니다.
                        </p>
                    </div>
                </header>

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

    if (view === 'grading') {
        return (
            <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center rounded-lg border border-card-border bg-card px-6 py-20 text-center">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <h1 className="mt-5 text-lg font-medium">criterion별 충족 여부를 판정하고 있습니다</h1>
                <p className="mt-2 text-sm text-foreground/50">AI는 판정만 수행하며 점수 계산은 서버 코드가 처리합니다.</p>
            </div>
        );
    }

    if (view === 'solving') {
        return (
            <div className="mx-auto w-full max-w-4xl space-y-6">
                <button type="button" onClick={returnToSetup} className="flex items-center gap-2 text-sm text-foreground/55 hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" /> 문제 목록
                </button>

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
                    <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
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
                                required
                                maxLength={20_000}
                                value={answers[subquestion.id] ?? ''}
                                onChange={(event) => setAnswers((current) => ({ ...current, [subquestion.id]: event.target.value }))}
                                placeholder="물음에서 요구한 결론과 근거를 구분하여 작성하세요."
                                className="mt-2 w-full rounded-md border border-card-border bg-card-border/20 p-3 text-sm leading-6 text-foreground outline-none transition-colors focus:border-primary"
                            />
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

            {result.subquestions.map((subquestion, index) => (
                <section key={subquestion.subquestion_id} className="rounded-lg border border-card-border bg-card p-5 md:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-sm font-medium">물음 {index + 1}</h2>
                        <span className="text-sm">{subquestion.score} / {subquestion.max_points}점</span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-foreground/85">{subquestion.prompt}</p>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="rounded-md border border-card-border bg-card-border/15 p-4">
                            <h3 className="text-xs font-medium text-foreground/45">내 답안</h3>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{subquestion.user_answer || '(미작성)'}</p>
                        </div>
                        <div className="rounded-md border border-success/25 bg-success/5 p-4">
                            <h3 className="text-xs font-medium text-success">모범답안</h3>
                            <ul className="mt-2 space-y-2 text-sm leading-6">
                                {subquestion.model_answer.map((answer) => <li key={answer}>· {answer}</li>)}
                            </ul>
                        </div>
                    </div>

                    <div className="mt-5 space-y-2">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-foreground/45">criterion 판정</h3>
                        {subquestion.criteria.map((criterion) => {
                            const passed = criterion.awarded_points > 0;
                            return (
                                <div key={criterion.criterion_id} className="flex items-start gap-3 rounded-md border border-card-border p-3">
                                    {passed
                                        ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                                        : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm leading-6">{criterion.claim}</p>
                                        {criterion.quote && <p className="mt-1 text-xs text-foreground/45">답안 근거: “{criterion.quote}”</p>}
                                    </div>
                                    <span className="shrink-0 text-xs text-foreground/55">{criterion.awarded_points}/{criterion.max_points}</span>
                                </div>
                            );
                        })}
                    </div>
                </section>
            ))}

            <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => startSet(activeSet)} className="flex items-center justify-center gap-2 rounded-md border border-card-border py-3 text-sm hover:bg-card-border/20">
                    <RotateCcw className="h-4 w-4" /> 같은 세트 다시 풀기
                </button>
                <button type="button" onClick={returnToSetup} className="rounded-md bg-primary py-3 text-sm font-medium text-white hover:bg-primary-hover">
                    다른 주제 선택
                </button>
            </div>
        </div>
    );
}
