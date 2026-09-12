import { notFound } from 'next/navigation';
import { loadDraftPreviewData, previewHref, questionPoints as points, styleLabels } from './draftPreviewData';

export const dynamic = 'force-dynamic';
export const metadata = {
    title: '초안 미리보기 | Audit Say',
    robots: { index: false, follow: false },
};

// This preview reads selected drafts only. It never enters the learning bank
// or calls grading/submission actions, and is unavailable outside development.
export default async function DraftPreviewPage({ searchParams }: { searchParams: Promise<{ set?: string; style?: string; sub?: string; topic?: string }> }) {
    if (process.env.NODE_ENV !== 'development') notFound();
    const query = await searchParams;
    const selected = (await loadDraftPreviewData()).find(item => item.set.id === (query.set || 'pilot-08-008'));
    if (!selected) notFound();
    const { set, entry, styles, groups } = selected;
    if (query.style && query.style !== 'standard' && query.style !== 'case') notFound();
    const filter = query.style === 'standard' || query.style === 'case' ? query.style : styles.some(row => row.style === 'standard') ? 'standard' : 'case';
    const group = groups.find(group => group.style === filter
        && (filter === 'case' || !query.sub || group.subquestions[0].id === query.sub));
    if (!group || group.subquestions.length === 0) notFound();
    const questions = group.subquestions;
    const total = group.max_points;

    return (
        <div className="mx-auto w-full max-w-4xl space-y-6">
            <a href={`/quiz/draft-preview/catalog?${new URLSearchParams({ style: filter, ...(query.topic ? { topic: query.topic } : {}) })}`} className="text-sm text-primary">← 유형별 초안 목록</a>
            <header className="rounded-lg border border-card-border bg-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="text-primary">주제 {group.topic_ids.join(' · ')} · {entry.plan_id} · {styleLabels[filter]}</span>
                    <span>총 {total}점</span>
                </div>
                <h1 className="mt-3 text-xl font-medium">{set.title}</h1>
                <p className="mt-3 text-sm text-foreground/60">2027년 CPA 대비 · 요소별 배점 적용본 · 검토 중</p>
                <nav aria-label="학습 유형" className="mt-4 flex flex-wrap gap-2 text-sm">
                    {(['standard', 'case'] as const).filter(style => styles.some(row => row.style === style)).map(style => (
                        <a key={style} href={previewHref(set.id, groups.find(group => group.style === style)!, query.topic)} aria-current={filter === style ? 'page' : undefined} className={`rounded-md px-3 py-2 ${filter === style ? 'bg-primary text-primary-foreground' : 'border border-card-border'}`}>
                            {styleLabels[style]} · {styles.filter(row => row.style === style).length}{style === 'standard' ? '개 독립 물음' : '물음'}
                        </a>
                    ))}
                </nav>
                {filter === 'standard' && <nav aria-label="기준서형 물음 선택" className="mt-5 flex flex-wrap gap-3">
                    {groups.filter(unit => unit.style === 'standard').map(unit => (
                        <a key={unit.subquestions[0].id} href={previewHref(set.id, unit, query.topic)}
                            aria-current={unit === group ? 'page' : undefined}
                            className={`rounded-md border px-3 py-2 text-sm ${unit === group ? 'border-primary text-primary' : 'border-card-border'}`}>
                            물음 {styles.find(row => row.subquestion_id === unit.subquestions[0].id)!.display_number} · {unit.max_points}점
                        </a>
                    ))}
                </nav>}
                {filter === 'case' && <nav aria-label="물음 바로가기" className="mt-5 flex flex-wrap gap-3">
                    {questions.map(question => (
                        <a key={question.id} href={`#${question.id}`} className="rounded-md border border-card-border px-3 py-2 text-sm hover:border-primary">
                            물음 {styles.find(row => row.subquestion_id === question.id)!.display_number} · {points(question)}점
                        </a>
                    ))}
                </nav>}
            </header>

            {filter === 'case' && group.shared_context.facts.length > 0 && <section className="rounded-lg border border-card-border bg-card p-6">
                <h2 className="text-base font-medium">공통 사실관계</h2>
                <ul className="mt-4 space-y-3 text-sm leading-7">
                    {group.shared_context.facts.map((fact) => <li key={fact.id}>{fact.text}</li>)}
                </ul>
            </section>}

            {questions.map(question => (
                <section key={question.id} id={question.id} className="scroll-mt-24 rounded-lg border border-card-border bg-card p-6 target:border-primary">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-medium">물음 {styles.find(row => row.subquestion_id === question.id)!.display_number} <span className="ml-2 text-sm text-foreground/55">{styleLabels[filter]}</span></h2>
                        <span className="rounded bg-primary/10 px-3 py-1 text-sm font-medium text-primary">{points(question)}점</span>
                    </div>
                    <p className="mt-3 text-xs text-primary">주제 {styles.find(row => row.subquestion_id === question.id)!.topic_ids.join(' · ')}</p>
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{question.prompt}</p>
                    <details className="mt-5 border-t border-card-border pt-4" open={set.id === 'pilot-08-008' && ['sub2', 'sub4'].includes(question.id)}>
                        <summary className="cursor-pointer text-sm font-medium">세부 배점 · {question.criteria.length}개 채점 요소</summary>
                        <p className="mt-3 text-xs leading-6 text-foreground/60">충족한 요소의 점수를 합산합니다. 한 문장으로 여러 요소를 충족할 수 있습니다.</p>
                        <ol className="mt-3 divide-y divide-card-border">
                            {question.criteria.map((criterion, criterionIndex) => (
                                <li key={criterion.id} className="flex items-start justify-between gap-4 py-3 text-sm leading-6">
                                    <span>{criterionIndex + 1}. {criterion.claim}</span>
                                    <span className="shrink-0 text-primary">{criterion.max_points}점</span>
                                </li>
                            ))}
                        </ol>
                    </details>
                    <details className="mt-4 border-t border-card-border pt-4">
                        <summary className="cursor-pointer text-sm font-medium">모범답안 보기</summary>
                        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7">
                            {question.model_answer.map((answer, answerIndex) => <li key={answerIndex}>{answer}</li>)}
                        </ul>
                    </details>
                </section>
            ))}
        </div>
    );
}
