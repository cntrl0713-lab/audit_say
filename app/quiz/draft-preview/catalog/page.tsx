import { notFound } from 'next/navigation';
import { loadDraftPreviewData, previewHref, questionPoints, styleLabels } from '../draftPreviewData';

export const dynamic = 'force-dynamic';
export const metadata = { title: '유형별 초안 목록 | Audit Say', robots: { index: false, follow: false } };

export default async function DraftCatalogPage({ searchParams }: { searchParams: Promise<{ style?: string; topic?: string }> }) {
    if (process.env.NODE_ENV !== 'development') notFound();
    const query = await searchParams;
    if (query.style && query.style !== 'standard' && query.style !== 'case') notFound();
    const filter = query.style === 'case' ? 'case' : 'standard';
    const data = await loadDraftPreviewData();
    const units = data.flatMap(item => item.groups.map(group => ({ item, group })));
    const topicOrder = data[0]?.topic_order ?? [];
    const topics = topicOrder.filter(topic => units.some(({ group }) => group.topic_ids.includes(topic)));
    const topic = query.topic || undefined;
    if (topic && !topics.includes(topic)) notFound();
    const totals = { standard: 0, case: 0 };
    const questionTotals = { standard: 0, case: 0 };
    for (const { group } of units) {
        totals[group.style]++;
        questionTotals[group.style] += group.subquestions.length;
    }
    // Filter whole units: finding one matching case question keeps every case question in that source.
    const visible = units.filter(({ group }) => group.style === filter && (!topic || group.topic_ids.includes(topic)))
        .sort((a, b) => topicOrder.indexOf(a.group.topic_ids[0]) - topicOrder.indexOf(b.group.topic_ids[0])
            || a.item.entry.plan_id.localeCompare(b.item.entry.plan_id));
    return (
        <div className="mx-auto w-full max-w-5xl space-y-6">
            <header>
                <p className="text-sm text-primary">2027년 CPA 대비 · 검토 중인 초안</p>
                <h1 className="mt-2 text-2xl">유형별 문제 학습</h1>
                <p className="mt-3 text-sm leading-7 text-foreground/60">{units.length}개 학습 단위 · {questionTotals.standard + questionTotals.case}물음. 기준서형은 한 물음씩, 사례형은 사실관계와 소속 물음 전체를 함께 제시합니다.</p>
                <nav aria-label="학습 유형" className="mt-5 flex gap-3">
                    {(['standard', 'case'] as const).map(style => (
                        <a key={style} href={`?${new URLSearchParams({ style, ...(topic ? { topic } : {}) })}`} aria-current={style === filter ? 'page' : undefined} className={`rounded-md px-4 py-3 text-sm ${style === filter ? 'bg-primary text-primary-foreground' : 'border border-card-border bg-card'}`}>
                            {styleLabels[style]} · {totals[style]}{style === 'standard' ? '개 독립 물음' : `개 사례 · ${questionTotals.case}물음`}
                        </a>
                    ))}
                </nav>
                <form action="/quiz/draft-preview/catalog" method="get" className="mt-5 flex flex-wrap items-center gap-3 text-sm">
                    <input type="hidden" name="style" value={filter} />
                    <label htmlFor="preview-topic">주제</label>
                    <select id="preview-topic" name="topic" defaultValue={topic ?? ''} className="rounded-md border border-card-border bg-card px-3 py-2">
                        <option value="">전체 주제</option>
                        {topics.map(id => <option key={id} value={id}>주제 {id}</option>)}
                    </select>
                    <button type="submit" className="rounded-md border border-card-border px-3 py-2">검색</button>
                </form>
            </header>
            <p className="text-sm text-foreground/65">{filter === 'standard' ? '정의·요건·고려사항·절차·보고 내용 등 기준서의 내용을 확인합니다.' : '제시된 사실을 바탕으로 적용 기준·판단·오류·구체 조치를 도출합니다.'}</p>
            <p className="text-sm text-foreground/65">{visible.length}개 학습 단위{topic ? ` · 주제 ${topic}` : ''}{filter === 'case' && topic ? ' · 사례에 속한 다른 주제의 물음도 모두 표시합니다.' : ''}</p>
            <div className="grid gap-4 md:grid-cols-2">
                {visible.map(({ item: { set, entry, styles }, group }) => (
                    <section key={`${set.id}/${group.style}/${group.style === 'standard' ? group.subquestions[0].id : 'case'}`} className="rounded-lg border border-card-border bg-card p-5">
                        <p className="text-xs text-primary">주제 {group.topic_ids.join(' · ')} · {entry.plan_id} · {group.max_points}점</p>
                        <h2 className="mt-2 text-base font-medium leading-7">{set.title}</h2>
                        <ul className="mt-4 space-y-3">
                            {group.subquestions.map(sub => ({ sub, style: styles.find(row => row.subquestion_id === sub.id)! }))
                                .map(({ sub, style }) => (
                                    <li key={sub.id}>
                                        <a href={`${previewHref(set.id, group, topic)}#${encodeURIComponent(sub.id)}`} className="block rounded-md border border-card-border p-3 text-sm leading-6 hover:border-primary">
                                            <span className="text-primary">물음 {style.display_number} · {questionPoints(sub)}점 · 주제 {style.topic_ids.join(' · ')}{style.mixed ? ' · 기준서 설명 포함' : ''}</span>
                                            <p className="mt-1 line-clamp-3 text-foreground/75">{sub.prompt}</p>
                                        </a>
                                    </li>
                                ))}
                        </ul>
                    </section>
                ))}
            </div>
        </div>
    );
}
