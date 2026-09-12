export const ALL_TOPICS = 'all';

export interface QuizScope {
    part: string;
    topicId: string;
    style?: 'case' | 'standard';
}

interface ClassifiedQuestionSet {
    id: string;
    classification: { part: string; topic_id: string };
    question_style?: 'case' | 'standard';
    topics?: Array<{ id: string; part: string }>;
}

export interface RandomQuizRun<T> {
    scope: QuizScope;
    sets: T[];
    index: number;
}

export function quizScopeKey(scope: QuizScope): string {
    return JSON.stringify(scope.style ? [scope.part, scope.topicId, scope.style] : [scope.part, scope.topicId]);
}

export function questionSetsInScope<T extends ClassifiedQuestionSet>(sets: readonly T[], scope: QuizScope | null): T[] {
    if (!scope) return [];
    return sets.filter((set) => (!scope.style || set.question_style === scope.style)
        && (set.topics ?? [{ id: set.classification.topic_id, part: set.classification.part }])
            .some(topic => topic.part === scope.part && (scope.topicId === ALL_TOPICS || topic.id === scope.topicId)));
}

export function createRandomQuizRun<T extends ClassifiedQuestionSet>(
    sets: readonly T[],
    scope: QuizScope,
    random: () => number = Math.random,
): RandomQuizRun<T> | null {
    const ordered = questionSetsInScope(sets, scope);
    if (ordered.length === 0) return null;
    // Fisher–Yates gives every set the same chance without changing the bank's order.
    for (let index = ordered.length - 1; index > 0; index -= 1) {
        const other = Math.floor(random() * (index + 1));
        [ordered[index], ordered[other]] = [ordered[other], ordered[index]];
    }
    return { scope: { ...scope }, sets: ordered, index: 0 };
}

export function nextRandomQuizRun<T>(run: RandomQuizRun<T>): RandomQuizRun<T> | null {
    if (run.index + 1 >= run.sets.length) return null;
    return { ...run, index: run.index + 1 };
}
