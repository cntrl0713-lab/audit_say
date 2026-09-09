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

test('validateQuestionSetV3 rejects legacy, invalid, and omitted answer selection fields', () => {
    const cases: Array<{
        policy: 'constraints' | 'selection';
        field: string;
        rejected: unknown[];
    }> = [
        { policy: 'selection', field: 'type', rejected: ['best_n', 'at_least_n', 'unknown', null, undefined] },
        { policy: 'selection', field: 'n', rejected: [1, 0, -1, '1', undefined] },
        { policy: 'constraints', field: 'ordered', rejected: [true, 'false', null, undefined] },
        { policy: 'constraints', field: 'max_entries', rejected: [1, 0, -1, '1', undefined] },
        { policy: 'constraints', field: 'overflow_policy', rejected: ['ignore_after_limit', 'unknown', null, undefined] },
    ];

    for (const { policy, field, rejected } of cases) {
        for (const value of rejected) {
            const set = createValidSet('source.md');
            const record = set.subquestions[0][policy] as Record<string, unknown>;
            if (value === undefined) delete record[field];
            else record[field] = value;

            const result = validateQuestionSetV3(set);
            assert.ok(
                result.errors.some(error => error.includes(`${policy}.${field}`)),
                `${policy}.${field}=${String(value)} must be rejected`,
            );
        }
    }
});

test('validateQuestionSetV3 rejects missing or malformed answer selection objects without throwing', () => {
    for (const policy of ['constraints', 'selection'] as const) {
        for (const value of [undefined, null, [], false, 'all']) {
            const set = createValidSet('source.md');
            const subquestion = set.subquestions[0] as unknown as Record<string, unknown>;
            if (value === undefined) delete subquestion[policy];
            else subquestion[policy] = value;

            const result = validateQuestionSetV3(set);
            assert.ok(result.errors.some(error => error.includes(`${policy} 형식`)), `${policy}=${String(value)}`);
            assert.equal(result.max_points, 3);
        }
    }
});

test('stored published constraints remain readable without relaxing new authoring or all-criterion scoring', () => {
    const set = createValidSet('source.md');
    set.subquestions[0].constraints = { ordered: true, max_entries: 1, overflow_policy: 'ignore_after_limit' };
    const options = { allowStoredAnswerConstraints: true };
    assert.ok(validateQuestionSetV3(set, options).errors.some(error => error.includes('constraints')),
        'An unreviewed draft cannot use stored-version compatibility');
    set.status = 'published';
    assert.ok(validateQuestionSetV3(set, options).errors.some(error => error.includes('constraints')),
        'Published status alone does not establish reviewed stored content');
    set.verification.review_status = 'verified';
    const before = structuredClone(set);
    assert.deepEqual(validateQuestionSetV3(set, options).errors, []);
    assert.deepEqual(set, before, 'Reading a stored version must not rewrite it');
    assert.ok(validateQuestionSetV3(set).errors.some(error => error.includes('constraints')),
        'The default authoring/import contract remains strict for published content too');
    assert.equal(computeQuestionSetMaxPoints(set), 3);
    assert.equal(scoreCriterionVerdicts(set.subquestions[0], [
        { criterion_id: 'q1.c1', verdict: 'met' },
        { criterion_id: 'q1.c2', verdict: 'met' },
    ]).score, 3, 'Historical display limits cannot truncate criterion points');
    for (const constraints of [
        { ordered: false, max_entries: 0, overflow_policy: 'none' },
        { ordered: false, max_entries: 1.5, overflow_policy: 'none' },
        { ordered: 'true', max_entries: null, overflow_policy: 'none' },
        { ordered: false, max_entries: null, overflow_policy: 'invalid' },
        { ordered: false, overflow_policy: 'none' },
    ]) {
        const invalid = structuredClone(set);
        Object.assign(invalid, { subquestions: [{ ...invalid.subquestions[0], constraints }] });
        assert.ok(validateQuestionSetV3(invalid, options).errors.some(error => error.includes('constraints')));
    }
    Object.assign(set.subquestions[0].selection, { type: 'best_n', n: 1 });
    assert.ok(validateQuestionSetV3(set, options).errors.some(error => error.includes('selection')),
        'Stored compatibility never enables retired selection/scoring');
});

test('v3 authoring bank keeps the pilot floor distribution and stays internally consistent', {
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

    // 파일럿 65세트는 하한 계약이다. 은행은 성장할 수 있고(신규 세트 추가),
    // 기존 세트가 삭제돼 주제별 수가 줄어드는 것만 막는다.
    const minimumTotal = 65;
    assert.ok(sets.length >= minimumTotal, `bank should keep at least ${minimumTotal} sets`);
    assert.equal(new Set(sets.map((set) => set.id)).size, sets.length, 'set ids must be unique');
    // 신규 세트는 사람 승인 전까지 needs_review 상태로 남는다(compile 게이트가 published를 강제).
    const legacyPilotIds = new Set(
        [...expectedCounts.keys()].flatMap((topicId) => {
            const count = expectedCounts.get(topicId)!;
            return Array.from({ length: count }, (_, index) => `pilot-${topicId}-${String(index + 1).padStart(3, '0')}`);
        }),
    );
    assert.ok(sets.every((set) => (
        (legacyPilotIds.has(set.id) && set.status === 'published' && set.verification.review_status === 'verified')
        || (!legacyPilotIds.has(set.id) && ['needs_review', 'verified', 'published'].includes(set.status))
    )), 'pilot sets must stay published+verified; new sets must carry a valid status');
    const prompts = sets.flatMap((set) => set.subquestions.map((subquestion) => (
        subquestion.prompt.replace(/\s+/g, '').toLowerCase()
    )));
    assert.equal(new Set(prompts).size, prompts.length, 'subquestion prompts must be unique');
    for (const set of sets) {
        // A standard paragraph can support independent sets. Only redundant
        // source entries inside the same set must be merged.
        const sourceQuotes = set.source_refs.map(source => source.source_quote.replace(/\s+/g, '').toLowerCase());
        assert.equal(new Set(sourceQuotes).size, sourceQuotes.length, `${set.id} source quotes must be unique within the set`);
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
            Number.isInteger(computeQuestionSetMaxPoints(set)) && computeQuestionSetMaxPoints(set) > 0,
            `${set.id} must have a positive integer total derived from its criteria`,
        );
    }
    for (const [topicId, expectedCount] of expectedCounts) {
        assert.ok(
            (countsByTopic.get(topicId) ?? 0) >= expectedCount,
            `topic ${topicId} should contain at least ${expectedCount} sets`,
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

test('validateQuestionSetV3 rejects duplicate critical facts within one subquestion', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'question-v3-'));
    const sourceFile = path.join(dir, 'source.md');
    fs.writeFileSync(sourceFile, '# 기준서\n\n합리적인 확신은 높은 수준의 그러나 절대적이지는 아니한 수준의 확신이다.\n');

    const duplicateFact = { id: 'dup-a', type: 'conclusion' as const, expected: '높은 수준의 확신' };
    const set = createValidSet(sourceFile);
    set.subquestions[0].criteria[0].critical_facts = [duplicateFact];
    // 공백·대소문자만 달라도 정규화하면 같은 사실이므로 중복으로 잡혀야 한다.
    set.subquestions[0].criteria[1].critical_facts = [
        { id: 'dup-b', type: 'conclusion' as const, expected: '높은수준의  확신' },
    ];

    const result = validateQuestionSetV3(set, { verifySourceQuotes: true, cwd: path.dirname(sourceFile) + '/..' });
    assert.ok(result.errors.some((error) => error.includes('핵심 사실(conclusion: 높은수준의  확신)이 q1.c1와 중복됩니다')));

    // 다른 subquestion이라면 같은 사실을 요구해도 정상이다.
    const acrossSubquestions = createValidSet(sourceFile);
    acrossSubquestions.subquestions.push({
        ...structuredClone(acrossSubquestions.subquestions[0]),
        id: 'q2',
        prompt: '다른 물음에서 같은 결론을 묻는다.',
        criteria: [{ ...structuredClone(acrossSubquestions.subquestions[0].criteria[0]), id: 'q2.c1', critical_facts: [duplicateFact] }],
    });
    acrossSubquestions.learning_order = ['q1', 'q2'];
    const ok = validateQuestionSetV3(acrossSubquestions, { verifySourceQuotes: false });
    assert.ok(!ok.errors.some((error) => error.includes('중복됩니다')));
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

test('computeQuestionSetMaxPoints sums every criterion without forcing a ten-point total', () => {
    const set = createValidSet('source.md');
    set.subquestions[0].criteria[0].max_points = 2;
    set.subquestions[0].criteria[0].scores = { met: 2, partial: 1, not_met: 0, contradicted: 0 };

    assert.equal(computeQuestionSetMaxPoints(set), 4);
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

test('scoreCriterionVerdicts preserves earned points when another independent criterion is contradicted or missing', () => {
    const set = createValidSet('source.md');
    set.subquestions[0].criteria[0].max_points = 2;
    set.subquestions[0].criteria[0].scores = { met: 2, partial: 1, not_met: 0, contradicted: 0 };

    const result = scoreCriterionVerdicts(set.subquestions[0], [
        { criterion_id: 'q1.c1', verdict: 'met', quote: '높은 수준' },
        { criterion_id: 'q1.c2', verdict: 'contradicted', quote: '절대적 확신이다' },
    ]);

    assert.equal(result.score, 2);
    assert.equal(result.max_points, 4);
    assert.deepEqual(result.criteria.map(criterion => criterion.awarded_points), [2, 0]);

    const omitted = scoreCriterionVerdicts(set.subquestions[0], [
        { criterion_id: 'q1.c1', verdict: 'met', quote: '높은 수준' },
    ]);
    assert.equal(omitted.score, 2);
    assert.equal(omitted.max_points, 4);
    assert.equal(omitted.criteria[1].verdict, 'not_met');
});

test('legacy selection metadata cannot restore score truncation', () => {
    const set = createValidSet('source.md');
    Object.assign(set.subquestions[0], { selection: { type: 'best_n', n: 1 } });
    assert.ok(validateQuestionSetV3(set).errors.some(error => error.includes('selection.type')));

    const result = scoreCriterionVerdicts(set.subquestions[0], [
        { criterion_id: 'q1.c1', verdict: 'met', quote: '높은 수준' },
        { criterion_id: 'q1.c2', verdict: 'met', quote: '절대적 수준은 아니다' },
    ]);
    assert.equal(result.score, 3);
    assert.equal(result.max_points, 3);
    assert.equal(computeQuestionSetMaxPoints(set), 3);
});

test('verifyCriterionVerdicts allows one real quote for independent criteria and rejects invented evidence', () => {
    const set = createValidSet('source.md');
    const answer = '합리적 확신은 높은 수준이지만 절대적 확신은 아니다.';
    const verified = verifyCriterionVerdicts(answer, set.subquestions[0], [
        { criterion_id: 'q1.c1', verdict: 'met', quote: answer },
        { criterion_id: 'q1.c2', verdict: 'met', quote: answer },
        { criterion_id: 'unknown', verdict: 'met', quote: '답안에 없는 인용' },
    ]);

    assert.equal(verified.find((item) => item.criterion_id === 'q1.c1')?.verdict, 'met');
    assert.equal(verified.find((item) => item.criterion_id === 'q1.c2')?.verdict, 'met');
    assert.equal(verified.some((item) => item.criterion_id === 'unknown'), false);
    assert.equal(verifyCriterionVerdicts(answer, set.subquestions[0], [
        { criterion_id: 'q1.c1', verdict: 'met', quote: '답안에 없는 인용' },
    ])[0].verdict, 'not_met');
});

test('validateQuestionSetV3 guards shared_context contract and public leaks', () => {
    const scoreable = createValidSet('source.md');
    scoreable.shared_context.facts = [
        { id: 'f1', text: '감사인은 재무제표감사를 수행하고 있다.', scoreable: true as unknown as false },
    ];
    assert.ok(validateQuestionSetV3(scoreable).errors.some((error) => error.includes('scoreable=false')));

    const duplicated = createValidSet('source.md');
    duplicated.shared_context.facts = [
        { id: 'f1', text: '첫 번째 사실', scoreable: false },
        { id: 'f1', text: '두 번째 사실', scoreable: false },
    ];
    assert.ok(validateQuestionSetV3(duplicated).errors.some((error) => error.includes('중복 shared_context fact id')));

    const leaked = createValidSet('source.md');
    leaked.shared_context.facts = [
        { id: 'f1', text: leaked.subquestions[0].model_answer[0], scoreable: false },
    ];
    assert.ok(validateQuestionSetV3(leaked).errors.some((error) => error.includes('model_answer가 그대로 노출')));

    const embedded = createValidSet('source.md');
    embedded.shared_context.facts = [
        { id: 'f1', text: `상황: ${embedded.subquestions[0].model_answer[0]} 라고 감사인이 결론지었다.`, scoreable: false },
    ];
    const embeddedResult = validateQuestionSetV3(embedded);
    assert.equal(embeddedResult.errors.length, 0);
    assert.ok(embeddedResult.warnings.some((warning) => warning.includes('model_answer 전문을 포함')));

    const missing = createValidSet('source.md');
    (missing as { shared_context?: unknown }).shared_context = {};
    assert.ok(validateQuestionSetV3(missing).errors.some((error) => error.includes('shared_context.facts는 배열')));
});
