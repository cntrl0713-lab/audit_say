import { BookOpen } from 'lucide-react';
import { loadPublicQuestionSetsV3 } from '../../lib/questionV3Store';

export const dynamic = 'force-dynamic';

export default function CurriculumPage() {
    const sets = loadPublicQuestionSetsV3();
    const subquestionCount = sets.reduce((sum, set) => sum + set.subquestions.length, 0);
    const parts = new Map<string, Map<string, typeof sets>>();

    for (const set of sets) {
        const chapters = parts.get(set.classification.part) ?? new Map<string, typeof sets>();
        const chapterSets = chapters.get(set.classification.chapter) ?? [];
        chapterSets.push(set);
        chapters.set(set.classification.chapter, chapterSets);
        parts.set(set.classification.part, chapters);
    }

    return (
        <div className="mx-auto w-full max-w-5xl space-y-6 py-4">
            <header className="text-center">
                <BookOpen className="mx-auto h-7 w-7" />
                <h1 className="mt-2 text-2xl font-normal">신규 문제은행 커리큘럼</h1>
                <p className="mt-2 text-sm text-foreground/55">19개 주제, {sets.length}개 세트, {subquestionCount}개 세부 문항의 분포입니다.</p>
            </header>
            {[...parts.entries()].map(([part, chapters]) => (
                <section key={part} className="rounded-lg border border-card-border bg-card p-5">
                    <h2 className="text-base font-medium">{part}</h2>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                        {[...chapters.entries()].map(([chapter, chapterSets]) => (
                            <article key={chapter} className="rounded-md border border-card-border bg-card-border/10 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="text-sm font-medium">{chapter}</h3>
                                    <span className="text-xs text-foreground/45">{chapterSets.length}세트</span>
                                </div>
                                <ul className="mt-3 space-y-2">
                                    {chapterSets.map((set) => (
                                        <li key={set.id} className="text-xs leading-5 text-foreground/65">
                                            <span className="font-mono text-primary">{set.id}</span> · {set.title}
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