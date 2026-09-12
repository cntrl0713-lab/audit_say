'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock3, FileText, Maximize2, Minimize2, Pause, Play, RotateCcw } from 'lucide-react';
import type { PublicLearningQuestionSetV3 } from '../../lib/learningTypes';
import type { QuestionSetGradeResultV3 } from '../../lib/questionV3Grading';
import { QUESTION_V3_ANSWER_MAX_LENGTH } from '../../lib/questionV3Answer';
import { GradeResultDetails } from '../../components/GradeResultDetails';

export function QuizWorkspace({ questionSet, answers, onAnswer, onSubmit, onBack, onRestart, draftNotice, error, result, resultAction, children }: {
  questionSet: PublicLearningQuestionSetV3;
  answers: Record<string, string>;
  onAnswer: (id: string, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  onRestart: () => void;
  draftNotice: string;
  error: ReactNode;
  result?: QuestionSetGradeResultV3;
  resultAction?: (id: string) => ReactNode;
  children?: ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [mobileView, setMobileView] = useState<'reading' | 'answer' | 'result'>(result ? 'result' : 'answer');
  const [expanded, setExpanded] = useState(false);
  const [width, setWidth] = useState(44);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running || result) return;
    const start = Date.now();
    const interval = window.setInterval(() => setElapsed(elapsed + Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(interval);
    // The interval is anchored to the start of each running segment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, result]);
  const questions = questionSet.subquestions;
  const question = questions[index] ?? questions[0];
  const hasFacts = questionSet.question_style !== 'standard' && questionSet.shared_context.facts.length > 0;
  const completed = questions.filter(item => (answers[item.id] ?? '').trim()).length;
  const selectedResult = result?.subquestions.find(item => item.subquestion_id === question.id);
  const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const seconds = (elapsed % 60).toString().padStart(2, '0');
  return <div className={`mx-auto w-full space-y-5 ${hasFacts ? '' : 'max-w-4xl'}`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted"><ArrowLeft className="size-4" aria-hidden="true" />문제 목록</button>
      <span className="text-xs text-muted">{result ? '채점 완료' : '회계감사 · 학습 공간'}</span>
    </div>
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div className="min-w-0"><p className="eyebrow">{questionSet.question_style === 'standard' ? '기준서형' : '사례형'} · {questions.length}물음 · 총 {questionSet.max_points}점</p><h1 className="mt-3 text-xl leading-8 sm:text-2xl">{questionSet.question_style === 'standard' ? `${questionSet.classification.chapter} · 기준서형` : questionSet.title}</h1></div>
      {result && <div className="shrink-0"><p className="text-xs text-muted">총점</p><p className="mt-1 text-3xl font-semibold tabular-nums">{result.score}<span className="ml-1 text-base font-normal text-muted">/ {result.max_points}점</span></p></div>}
    </header>
    {!hasFacts && <div className="flex flex-wrap gap-2">{questionSet.classification.standards.map(standard => <span key={standard} className="rounded bg-surface-soft px-2 py-1 text-xs text-muted">{standard}</span>)}</div>}
    {children}
    {error}
    <div className="panel overflow-clip">
      <nav aria-label="풀이 화면 전환" className="sticky top-32 z-20 flex border-b border-card-border bg-card md:top-20 lg:hidden">
        {([{ id: 'reading', label: hasFacts ? '사례' : '물음' }, { id: 'answer', label: result ? '제출 답안' : '답안 작성' }, { id: 'result', label: '채점 결과' }] as const).map(tab => <button type="button" key={tab.id} aria-pressed={mobileView === tab.id} disabled={tab.id === 'result' && !result} onClick={() => setMobileView(tab.id)} className={`min-h-12 flex-1 border-b-2 px-2 text-sm disabled:cursor-not-allowed disabled:text-muted/50 ${mobileView === tab.id ? 'border-primary font-medium' : 'border-transparent text-muted'}`}>{tab.label}</button>)}
      </nav>
      <div className={hasFacts ? 'lg:grid lg:grid-cols-[var(--case-width)_minmax(0,1fr)]' : ''} style={{ '--case-width': `${width}%` } as React.CSSProperties}>
        <section aria-label={hasFacts ? '사례 본문' : '물음 본문'} className={`min-w-0 p-5 sm:p-6 ${mobileView === 'reading' ? 'block' : 'hidden'} ${hasFacts ? 'lg:block lg:border-r lg:border-card-border' : 'lg:hidden'}`}>
          <h2 className="flex items-center gap-2 text-base"><FileText aria-hidden="true" className="size-4 text-muted" />{hasFacts ? '공통 사실관계' : '물음 읽기'}</h2>
          <div className="mt-4 flex flex-wrap gap-2">{questionSet.classification.standards.map(standard => <span key={standard} className="rounded bg-surface-soft px-2 py-1 text-xs text-muted">{standard}</span>)}</div>
          {hasFacts && <label className="mt-4 hidden items-center gap-3 text-xs text-muted lg:flex">사례 패널 너비 <input aria-label="사례 패널 너비" type="range" min="35" max="55" value={width} onChange={event => setWidth(Number(event.target.value))} className="w-20 accent-primary" /><span className="w-8 tabular-nums">{width}%</span></label>}
          {hasFacts ? questionSet.shared_context.facts.map((fact, factIndex) => <details key={fact.id} open className="mt-5 border-t border-card-border pt-4"><summary className="min-h-8 text-sm font-medium">자료 {factIndex + 1}</summary><p className="mt-3 whitespace-pre-wrap break-words text-base leading-8">{fact.text}</p></details>) : <p className="mt-5 whitespace-pre-wrap text-base leading-8">{question.prompt}</p>}
        </section>
        <div className={`min-w-0 ${mobileView === 'reading' ? 'hidden lg:block' : ''}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-card-border bg-surface-soft/35 px-5 py-3 sm:px-6">
            <nav aria-label="물음 이동" className="flex flex-wrap items-center gap-2"><span className="mr-1 text-xs text-muted">물음</span>{questions.map((item, itemIndex) => <button type="button" key={item.id} aria-current={index === itemIndex ? 'step' : undefined} aria-label={`물음 ${itemIndex + 1}${(answers[item.id] ?? '').trim() ? ', 작성됨' : ', 미작성'}`} onClick={() => setIndex(itemIndex)} className={`inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-control border px-2 text-sm ${index === itemIndex ? 'border-primary bg-primary text-primary-foreground' : 'border-card-border bg-card text-muted'}`}>{itemIndex + 1}{(answers[item.id] ?? '').trim() && <Check aria-hidden="true" className="size-3" />}</button>)}</nav>
            <div className="flex items-center gap-3"><span className="text-xs text-muted">{result ? `${questions.length}물음 채점` : `작성 ${completed}/${questions.length}`}</span>{!result && <button type="button" aria-pressed={running} onClick={() => setRunning(!running)} className="inline-flex min-h-10 items-center gap-2 rounded-control px-2 text-xs text-muted" aria-label={`경과 시간 ${minutes}분 ${seconds}초, ${running ? '타이머 일시정지' : '타이머 시작'}`}><Clock3 className="size-3.5" aria-hidden="true" /><span className="tabular-nums">{minutes}:{seconds}</span>{running ? <Pause className="size-3" aria-hidden="true" /> : <Play className="size-3" aria-hidden="true" />}</button>}</div>
          </div>
          <div className="px-5 pt-5 sm:px-6"><h2 className="text-base">물음 {index + 1} <span className="ml-2 text-xs font-normal text-muted">{question.type === 'enumeration' ? '열거형' : question.type === 'judgment' ? '판단형' : '서술형'} · {question.max_points}점</span></h2></div>
          <form onSubmit={onSubmit} className={`${mobileView === 'result' ? 'hidden lg:block' : ''} px-5 pb-5 pt-3 sm:px-6 sm:pb-6`}>
            {questions.map((item, itemIndex) => <section key={item.id} hidden={index !== itemIndex}>
              <p className="whitespace-pre-wrap break-words text-base leading-8">{item.prompt}</p>
              {item.topic_ids && <p className="mt-3 text-xs leading-6 text-muted">{item.topic_ids.map(id => questionSet.topics?.find(topic => topic.id === id)?.title ?? id).join(' · ')}</p>}
              <div className="mt-4 flex items-center justify-between gap-3">
                <label htmlFor={`${item.id}-answer`} className="text-sm font-medium">{result ? '제출한 답안' : '답안 작성'}</label>
                {!result && <button type="button" className="inline-flex min-h-11 items-center justify-center gap-1.5 text-xs text-muted" aria-label={expanded ? '답안 영역 기본 크기' : '답안 영역 확대'} aria-pressed={expanded} aria-controls={`${item.id}-answer`} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 aria-hidden="true" className="size-3.5" /> : <Maximize2 aria-hidden="true" className="size-3.5" />}{expanded ? '기본 크기' : '입력란 늘리기'}</button>}
              </div>
              <textarea id={`${item.id}-answer`} rows={5} maxLength={QUESTION_V3_ANSWER_MAX_LENGTH} readOnly={!!result}
                value={result?.subquestions.find(sub => sub.subquestion_id === item.id)?.user_answer ?? answers[item.id] ?? ''}
                onChange={event => onAnswer(item.id, event.target.value)} aria-describedby={`${item.id}-count`}
                placeholder="물음에서 요구한 내용을 모두 작성하세요."
                className={`mt-1 w-full resize-y rounded-control border border-card-border bg-background p-3 text-base leading-8 focus:border-primary ${expanded ? 'min-h-[50dvh]' : 'min-h-40'}`} />
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted"><span>{result ? '채점에 사용된 답안' : draftNotice}</span><span id={`${item.id}-count`} className="tabular-nums">{(result?.subquestions.find(sub => sub.subquestion_id === item.id)?.user_answer ?? answers[item.id] ?? '').length.toLocaleString()} / 5,000자</span></div>
            </section>)}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <button type="button" disabled={index === 0} className="button-secondary" onClick={() => setIndex(Math.max(0, index - 1))}><ArrowLeft aria-hidden="true" className="size-4" />이전 물음</button>
              {index < questions.length - 1 && <button type="button" className="button-secondary" onClick={() => setIndex(index + 1)}>다음 물음<ArrowRight aria-hidden="true" className="size-4" /></button>}
            </div>
            {!result && <div className="mt-6 border-t border-card-border pt-5"><p className="mb-3 text-xs leading-6 text-muted">{hasFacts ? `이 사례의 ${questions.length}개 물음을 함께 제출합니다. ` : ''}미작성 물음은 0점으로 처리됩니다.</p><button type="submit" className="button-primary w-full">{hasFacts ? `이 사례 답안 제출 · ${questions.length}물음` : '답안 제출 및 AI 채점'}<ArrowRight className="size-4" aria-hidden="true" /></button></div>}
          </form>
          {selectedResult && result && <div className={`${mobileView === 'result' ? 'block' : 'hidden'} border-t border-card-border lg:block`}><GradeResultDetails result={{ ...result, subquestions: [selectedResult] }} questionOffset={index} subquestionAction={resultAction} embedded /></div>}
        </div>
      </div>
    </div>
    {result && <button type="button" onClick={onRestart} className="button-secondary"><RotateCcw aria-hidden="true" className="size-4" />같은 문제 다시 풀기</button>}
  </div>;
}
