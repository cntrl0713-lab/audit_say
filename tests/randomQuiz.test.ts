import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_TOPICS, createRandomQuizRun, nextRandomQuizRun, questionSetsInScope, quizScopeKey } from '../app/quiz/randomQuiz.ts';

const bank = [
    { id: 'a', classification: { part: 'PART1', topic_id: '01' }, set_version_id: 'version-a', subquestions: [{ id: 'a-1' }, { id: 'a-2' }] },
    { id: 'b', classification: { part: 'PART1', topic_id: '01' }, set_version_id: 'version-b', subquestions: [{ id: 'b-1' }] },
    { id: 'c', classification: { part: 'PART1', topic_id: '02' }, set_version_id: 'version-c', subquestions: [{ id: 'c-1' }] },
    { id: 'd', classification: { part: 'PART2', topic_id: '01' }, set_version_id: 'version-d', subquestions: [{ id: 'd-1' }] },
];
const partScope = { part: 'PART1', topicId: ALL_TOPICS };
const topicScope = { part: 'PART1', topicId: '01' };

test('전체 includes every topic in the selected Part, while an unselected scope stays empty', () => {
    assert.deepEqual(questionSetsInScope(bank, partScope).map((set) => set.id), ['a', 'b', 'c']);
    assert.deepEqual(questionSetsInScope(bank, topicScope).map((set) => set.id), ['a', 'b']);
    assert.deepEqual(questionSetsInScope(bank, null), []);
    assert.deepEqual(questionSetsInScope(bank, { part: 'PART1', topicId: 'missing' }), []);
});

test('a random run visits every eligible set exactly once and stops instead of silently reshuffling', () => {
    const original = structuredClone(bank);
    const first = createRandomQuizRun(bank, partScope, () => 0)!;
    const visited: string[] = [];
    for (let run: typeof first | null = first; run; run = nextRandomQuizRun(run)) {
        const current: (typeof bank)[number] = run.sets[run.index];
        visited.push(current.id);
        // Keep each complete question set, its version and its linked subquestions intact.
        assert.equal(current, bank.find((set) => set.id === current.id));
    }
    assert.equal(new Set(visited).size, 3);
    assert.deepEqual([...visited].sort(), ['a', 'b', 'c']);
    assert.deepEqual(bank, original);
    assert.equal(first.index, 0);
});

test('random selection uses the same Part and topic boundary as the displayed list', () => {
    for (const scope of [partScope, topicScope, { part: 'PART2', topicId: ALL_TOPICS }]) {
        const run = createRandomQuizRun(bank, scope, () => 0.75)!;
        assert.deepEqual(run.sets.map((set) => set.id).sort(), questionSetsInScope(bank, scope).map((set) => set.id).sort());
        assert.deepEqual(run.scope, scope);
    }
});

test('all six permutations of a three-set Part are equally reachable', () => {
    const permutations = new Set<string>();
    for (let third = 0; third < 3; third += 1) {
        for (let second = 0; second < 2; second += 1) {
            const draws = [(third + 0.5) / 3, (second + 0.5) / 2];
            const run = createRandomQuizRun(bank, partScope, () => draws.shift()!)!;
            permutations.add(run.sets.map((set) => set.id).join(''));
        }
    }
    assert.deepEqual([...permutations].sort(), ['abc', 'acb', 'bac', 'bca', 'cab', 'cba']);
});

test('empty scopes cannot start and a single-set scope ends after its first set', () => {
    assert.equal(createRandomQuizRun([], partScope), null);
    assert.equal(createRandomQuizRun(bank, { part: 'missing', topicId: ALL_TOPICS }), null);
    const only = createRandomQuizRun(bank, { part: 'PART2', topicId: ALL_TOPICS })!;
    assert.equal(only.sets[only.index].id, 'd');
    assert.equal(nextRandomQuizRun(only), null);
});

test('Part and topic queues remain independent when switching scopes or explicitly reshuffling', () => {
    const partRun = createRandomQuizRun(bank, partScope, () => 0)!;
    const topicRun = createRandomQuizRun(bank, topicScope, () => 0.99)!;
    const runs = { [quizScopeKey(partScope)]: partRun, [quizScopeKey(topicScope)]: topicRun };
    const advanced = nextRandomQuizRun(runs[quizScopeKey(partScope)])!;
    runs[quizScopeKey(partScope)] = advanced;
    assert.equal(runs[quizScopeKey(topicScope)].index, 0);
    assert.equal(runs[quizScopeKey(partScope)].index, 1);
    const restarted = createRandomQuizRun(bank, partScope, () => 0.99)!;
    assert.equal(restarted.index, 0);
    assert.deepEqual(restarted.sets.map((set) => set.id), ['a', 'b', 'c']);
    assert.equal(advanced.index, 1);
});
