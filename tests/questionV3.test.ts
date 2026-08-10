import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    compilePublicQuestionSet,
    computeQuestionSetMaxPoints,
    isQuestionSetAnswerPayloadV3,
    scoreCriterionVerdicts,
    validateQuestionSetV3,
    verifyCriterionVerdicts,
} from '../lib/questionV3.ts';
import type { CriterionVerdictV3, QuestionSetV3 } from '../lib/questionV3.ts';

function createValidSet(sourceFile: string): QuestionSetV3 {
    return {
        schema_version: '3.0',
        id: 'pilot-01-001',
        type: 'linked_question_set',
        status: 'needs_review',
        title: '감사의 목적과 합리적 확신',
        classification: {
            topic_id: '01',
            part: 'PART1',
            chapter: '감사의 기초',
            domain: 'audit',
            standards: ['KGA 200'],
            tags: ['합리적 확신'],
        },
        source_refs: [
            {
                id: 'src1',
                file: sourceFile,
                source_quote: '합리적인 확신은 높은 수준의 그러나 절대적이지는 아니한 수준의 확신이다.',
                role: 'standard',
            },
        ],
        shared_context: {
            facts: [{ id: 'f1', text: '감사인은 재무제표감사를 수행하고 있다.', scoreable: false }],
        },
        learning_order: ['q1'],
        subquestions: [
            {
                id: 'q1',
                type: 'descriptive',
                prompt: '합리적 확신의 수준을 설명하시오.',
                constraints: {
                    ordered: false,
                    max_entries: null,
                    overflow_policy: 'none',
                },
                selection: { type: 'all', n: null },
                model_answer: ['합리적 확신은 높은 수준이지만 절대적 수준의 확신은 아니다.'],
                requirements: [
                    {
                        id: 'q1.r1',
                        source_ref_id: 'src1',
                        source_quote: '합리적인 확신은 높은 수준의 그러나 절대적이지는 아니한 수준의 확신이다.',
                    },
                ],
                criteria: [
                    {
                        id: 'q1.c1',
                        requirement_id: 'q1.r1',
                        claim: '합리적 확신은 높은 수준의 확신이다.',
                        critical_facts: [],
                        max_points: 1,
                        scores: { met: 1, not_met: 0, contradicted: 0 },
                        source_ref_ids: ['src1'],
                    },
                    {
                        id: 'q1.c2',
                        requirement_id: 'q1.r1',
                        claim: '합리적 확신은 절대적 수준의 확신은 아니다.',
                        critical_facts: [{ id: 'negation', type: 'condition', expected: '절대적이지 않음' }],
                        max_points: 2,
                        scores: { met: 2, partial: 1, not_met: 0, contradicted: 0 },
                        source_ref_ids: ['src1'],
                    },
                ],
            },
        ],
        verification: {
            source_fidelity: 'exact',
            review_status: 'needs_human_review',
            calculation_required: false,
            notes: [],
        },
    };
}

const authoringBankPath = path.resolve('cpa_uploader/data/cpa_question_sets_v3.authoring.json');

test('validateQuestionSetV3 validates source-bound linked question sets', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'question-v3-'));
    const sourceFile = path.join(dir, 'source.md');
    fs.writeFileSync(sourceFile, '# 기준서\n\n합리적인 확신은 높은 수준의 그러나 절대적이지는 아니한 수준의 확신이다.\n');

    const result = validateQuestionSetV3(createValidSet(sourceFile), { verifySourceQuotes: true });
    assert.deepEqual(result.errors, []);
    assert.equal(result.max_points, 3);
});

test('v3 authoring bank follows the planned 65-set topic distribution', {
    skip: !fs.existsSync(authoringBankPath),
}, () => {
    const sets = JSON.parse(fs.readFileSync(authoringBankPath, 'utf8')) as QuestionSetV3[];
    const countsByTopic = new Map<string, number>();
    const expectedCounts = new Map<string, number>([
        ['01', 3],
        ['02', 4],
        ['03', 3],
        ['04', 3],
        ['05', 4],
        ['06', 4],
        ['07', 3],
        ['08', 4],
        ['09', 3],
        ['10', 3],
        ['11', 3],
        ['12', 3],
        ['13', 3],
        ['14', 4],
        ['15', 4],
        ['16', 4],
        ['17', 3],
        ['18', 3],
        ['19', 4],
    ]);

    for (const set of sets) {
        const topicId = set.classification.topic_id;
        countsByTopic.set(topicId, (countsByTopic.get(topicId) ?? 0) + 1);
    }

    assert.equal(sets.length, 65);
    assert.equal(new Set(sets.map((set) => set.id)).size, 65);
    assert.ok(sets.every((set) => set.status === 'published'));
    assert.ok(sets.every((set) => set.verification.review_status === 'verified'));
    const prompts = sets.flatMap((set) => set.subquestions.map((subquestion) => (
        subquestion.prompt.replace(/\s+/g, '').toLowerCase()
    )));
    const sourceQuotes = sets.flatMap((set) => set.source_refs.map((source) => (
        source.source_quote.replace(/\s+/g, '').toLowerCase()
    )));
    assert.equal(new Set(prompts).size, prompts.length, 'subquestion prompts must be unique');
    assert.equal(new Set(sourceQuotes).size, sourceQuotes.length, 'source quotes must be unique');
    for (const set of sets) {
        const normalizedModelAnswers = set.subquestions.flatMap((subquestion) => (
            subquestion.model_answer.map((answer) => answer.replace(/\s+/g, '').toLowerCase())
        ));
        for (const tag of set.classification.tags) {
            const normalizedTag = tag.replace(/\s+/g, '').toLowerCase();
            assert.ok(
                !normalizedModelAnswers.includes(normalizedTag),
                `${set.id} public tag must not reveal a model answer`,
            );
        }
        assert.ok(
            computeQuestionSetMaxPoints(set) <= 8,
            `${set.id} should not exceed eight grading points`,
        );
    }
    for (const [topicId, expectedCount] of expectedCounts) {
        assert.equal(
            countsByTopic.get(topicId),
            expectedCount,
            `topic ${topicId} should contain ${expectedCount} sets`,
        );
        for (let index = 1; index <= expectedCount; index += 1) {
            const suffix = String(index).padStart(3, '0');
            assert.ok(sets.some((set) => set.id === `pilot-${topicId}-${suffix}`));
        }
    }
});

test('validateQuestionSetV3 rejects ungrounded requirements and invalid partial scoring', () => {
    const set = createValidSet('missing.md');
    set.subquestions[0].requirements[0].source_quote = '원문에 존재하지 않는 문장';
    set.subquestions[0].criteria[0].scores = {
        met: 1,
        partial: 1,
        not_met: 0,
        contradicted: 0,
    };

    const result = validateQuestionSetV3(set, { verifySourceQuotes: true });
    assert.ok(result.errors.some((error) => error.includes('source_quote')));
    assert.ok(result.errors.some((error) => error.includes('1점 criterion은 partial')));
});

test('validateQuestionSetV3 requires criterion evidence to include its requirement source', () => {
    const set = createValidSet('source.md');
    set.source_refs.push({
        id: 'src2',
        file: 'other.md',
        source_quote: '다른 요구사항의 근거',
        role: 'standard',
    });
    set.subquestions[0].criteria[0].source_ref_ids = ['src2'];

    const result = validateQuestionSetV3(set);
    assert.ok(result.errors.some((error) => error.includes('requirement의 source_ref_id')));
});

test('validateQuestionSetV3 reports malformed LLM subquestions without throwing', () => {
    const malformed = createValidSet('source.md') as unknown as Record<string, unknown>;
    malformed.subquestions = [{ id: 'q1', requirement: {}, criterion: {} }];

    assert.doesNotThrow(() => validateQuestionSetV3(malformed));
    const result = validateQuestionSetV3(malformed);
    assert.ok(result.errors.some((error) => error.includes('criteria')));
    assert.equal(result.max_points, 0);
});

test('computeQuestionSetMaxPoints honors best_n without forcing a ten-point total', () => {
    const set = createValidSet('source.md');
    set.subquestions[0].selection = { type: 'best_n', n: 1 };
    set.subquestions[0].criteria[0].max_points = 2;
    set.subquestions[0].criteria[0].scores = { met: 2, partial: 1, not_met: 0, contradicted: 0 };

    assert.equal(computeQuestionSetMaxPoints(set), 2);
});

test('validateQuestionSetV3 rejects public tags that reveal a model answer', () => {
    const set = createValidSet('source.md');
    set.classification.tags = [set.subquestions[0].model_answer[0]];

    const result = validateQuestionSetV3(set);

    assert.ok(result.errors.some((error) => error.includes('model_answer')));
});

test('isQuestionSetAnswerPayloadV3 accepts canonical subquestion ids and rejects unsafe payloads', () => {
    assert.equal(isQuestionSetAnswerPayloadV3({ sub1: '답안', sub2: '답안' }), true);
    assert.equal(isQuestionSetAnswerPayloadV3({ 'pilot-19-004.q1': '답안' }), true);
    assert.equal(isQuestionSetAnswerPayloadV3({ 'bad id': '답안' }), false);
    assert.equal(isQuestionSetAnswerPayloadV3({ sub1: 'x'.repeat(5001) }), false);
    assert.equal(isQuestionSetAnswerPayloadV3(Array.from({ length: 11 }, (_, index) => [`q${index}`, '답안'])), false);
});

test('compilePublicQuestionSet strips model answers, requirements, criteria, and source quotes', () => {
    const authoringSet = createValidSet('source.md');
    authoringSet.subquestions[0].decision = {
        options: ['예', '아니오'],
        correct: '예',
    };
    const publicSet = compilePublicQuestionSet(authoringSet);
    const publicSub = publicSet.subquestions[0] as Record<string, unknown>;
    const publicSource = publicSet.sources[0] as Record<string, unknown>;

    assert.equal('model_answer' in publicSub, false);
    assert.equal('requirements' in publicSub, false);
    assert.equal('criteria' in publicSub, false);
    assert.equal('source_quote' in publicSource, false);
    assert.deepEqual(publicSub.decision, { options: ['예', '아니오'] });
    assert.equal(publicSet.max_points, 3);
});

test('scoreCriterionVerdicts computes integer criterion scores in code', () => {
    const set = createValidSet('source.md');
    const verdicts: CriterionVerdictV3[] = [
        { criterion_id: 'q1.c1', verdict: 'met', quote: '높은 수준' },
        { criterion_id: 'q1.c2', verdict: 'partial', quote: '절대적인 확신은 아니다' },
    ];

    const result = scoreCriterionVerdicts(set.subquestions[0], verdicts);
    assert.equal(result.score, 2);
    assert.equal(result.max_points, 3);
    assert.deepEqual(result.criteria.map((item) => item.awarded_points), [1, 1]);
});

test('scoreCriterionVerdicts gives contradicted criteria zero points and caps best_n', () => {
    const set = createValidSet('source.md');
    set.subquestions[0].selection = { type: 'best_n', n: 1 };
    set.subquestions[0].criteria[0].max_points = 2;
    set.subquestions[0].criteria[0].scores = { met: 2, partial: 1, not_met: 0, contradicted: 0 };

    const result = scoreCriterionVerdicts(set.subquestions[0], [
        { criterion_id: 'q1.c1', verdict: 'met', quote: '높은 수준' },
        { criterion_id: 'q1.c2', verdict: 'contradicted', quote: '절대적 확신이다' },
    ]);

    assert.equal(result.score, 2);
    assert.equal(result.max_points, 2);
});

test('verifyCriterionVerdicts rejects hallucinated and duplicated answer quotes', () => {
    const set = createValidSet('source.md');
    const answer = '합리적 확신은 높은 수준이지만 절대적 확신은 아니다.';
    const verified = verifyCriterionVerdicts(answer, set.subquestions[0], [
        { criterion_id: 'q1.c1', verdict: 'met', quote: '높은 수준' },
        { criterion_id: 'q1.c2', verdict: 'met', quote: '높은 수준' },
        { criterion_id: 'unknown', verdict: 'met', quote: '답안에 없는 인용' },
    ]);

    assert.equal(verified.find((item) => item.criterion_id === 'q1.c1')?.verdict, 'not_met');
    assert.equal(verified.find((item) => item.criterion_id === 'q1.c2')?.verdict, 'met');
    assert.equal(verified.some((item) => item.criterion_id === 'unknown'), false);
});
