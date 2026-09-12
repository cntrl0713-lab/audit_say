import { BookOpen } from 'lucide-react';
import Link from 'next/link';
import { loadLearningQuestionSetsV3 } from '../../lib/questionV3Repository';

export const dynamic = 'force-dynamic';

export default async function CurriculumPage() {
    const sets = await loadLearningQuestionSetsV3();
    const subquestionCount = sets.reduce((sum, set) => sum + set.subquestions.length, 0);
    const parts = new Map<string, Map<string, typeof sets>>();

    for (const set of sets) for (const topic of set.topics ?? [{ part: set.classification.part, title: set.classification.chapter }]) {
        const chapters = parts.get(topic.part) ?? new Map<string, typeof sets>();
        const chapterSets = chapters.get(topic.title) ?? [];
        chapterSets.push(set);
        chapters.set(topic.title, chapterSets);
        parts.set(topic.part, chapters);
    }

    return (
        <div className="mx-auto w-full max-w-5xl space-y-6 py-4">
            <header className="text-center">
                <BookOpen className="mx-auto h-7 w-7" />
                <h1 className="mt-2 text-2xl font-normal">신규 문제은행 커리큘럼</h1>
                <p className="mt-2 text-sm text-foreground/55">{subquestionCount}개 물음 · 기준서형 {sets.filter(set => set.question_style === 'standard').length}물음 · 사례형 {sets.filter(set => set.question_style === 'case').length}문제</p>
                <p className="mt-2 text-xs text-foreground/45">여러 주제가 연결된 물음·사례는 각 주제에서 찾을 수 있습니다.</p>
            </header>
            {[...parts.entries()].map(([part, chapters]) => (
                <section key={part} className="rounded-lg border border-card-border bg-card p-5">
                    <h2 className="text-base font-medium">{part}</h2>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                        {[...chapters.entries()].map(([chapter, chapterSets]) => (
                            <article key={chapter} className="rounded-md border border-card-border bg-card-border/10 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="text-sm font-medium">{chapter}</h3>
                                    <span className="text-xs text-foreground/45">{chapterSets.length}개</span>
                                </div>
                                <ul className="mt-3 space-y-2">
                                    {chapterSets.map((set) => (
                                        <li key={set.id} className="text-xs leading-5 text-foreground/65">
                                            <Link href={`/quiz?set=${encodeURIComponent(set.id)}`} className="text-primary hover:underline">{set.question_style === 'standard' ? '기준서형' : '사례형'} · {set.title}</Link>
                                        </li>
                                    ))}
                                </ul>
                            </article>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
