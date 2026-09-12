import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLearningUnits, learningUnitId, selectLearningQuestionSet, validateLearningClassification } from '../lib/learningUnits.ts';
import type { LearningClassification } from '../lib/learningUnits.ts';
import { compileLearningCatalog } from '../scripts/build-learning-unit-catalog.ts';
import { compilePublicQuestionSet, validateQuestionSetV3 } from '../lib/questionV3.ts';
import { assertBoundAnswers, issueSubmissionToken, verifySubmissionToken } from '../lib/learningSubmission.ts';
import { gradeLearningSubmission } from '../lib/learningService.ts';
import { applyQuestionSetJudgment } from '../lib/questionV3Grading.ts';
import { questionSetsInScope, createRandomQuizRun } from '../app/quiz/randomQuiz.ts';
import { canResumeSubmissionVersion, retireLegacySubmissionSessions, submissionSessionKey } from '../app/quiz/submissionSession.ts';
import { learningCatalogForBank } from '../scripts/import-question-bank-v3.ts';
import { sampleQuestionSet, memberId } from './helpers/cpaLearningDatabase.ts';

const release = '00000000-0000-4000-8000-000000000011';
const version = '00000000-0000-4000-8000-000000000010';
const classificationIds = ['00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000022'];
const topics = [{ id: '01', title: '윤리', part: 'PART1', position: 2 }, { id: '02', title: '기본개념', part: 'PART1', position: 1 }, { id: '08', title: '감사증거', part: 'PART3', position: 5 }];
const source = sampleQuestionSet();
const classifications: LearningClassification[] = source.subquestions.map((sub, index) => ({
    learning_question_id: classificationIds[index], classification_version_id: classificationIds[index],
    source_set_id: source.id, source_set_version_id: version, source_subquestion_version_id: classificationIds[index],
    subquestion_id: sub.id, question_style: index === 0 ? 'case' : 'standard',
    case_set_id: index === 0 ? source.id : null, topic_ids: index === 0 ? ['01', '08'] : ['02'],
    standalone_prompt: index === 0 ? null : '전문가적 의구심의 유지 원칙을 설명하시오.',
    case_fact_ids: index === 0 ? ['f1'] : [], content_hash: 'a'.repeat(64),
}));

test('learning units separate standalone questions from facts and preserve each question topic mapping', () => {
    const before = structuredClone(source);
    const units = buildLearningUnits([{ ...compilePublicQuestionSet(source), release_id: release, set_version_id: version }], classifications, topics);
    assert.equal(units.length, 2);
    const standard = units.find(unit => unit.question_style === 'standard')!;
    const scenario = units.find(unit => unit.question_style === 'case')!;
    assert.equal(standard.subquestions.length, 1);
    assert.deepEqual(standard.shared_context.facts, []);
    assert.equal(standard.case_set_id, null);
    assert.equal(standard.subquestions[0].prompt, classifications[1].standalone_prompt);
    assert.equal(standard.max_points, 1);
    assert.deepEqual(scenario.topics!.map(topic => topic.id), ['01', '08']);
    assert.deepEqual(scenario.shared_context, source.shared_context);
    assert.deepEqual(source, before);
    assert.equal(JSON.stringify(units).includes('model_answer'), false);
    assert.equal(JSON.stringify(units).includes('critical_facts'), false);
    assert.equal(questionSetsInScope(units, { part: 'PART3', topicId: '08', style: 'case' })[0].id, scenario.id);
    assert.equal(createRandomQuizRun(units, { part: 'PART1', topicId: 'all', style: 'case' })!.sets.length, 1);
    assert.equal(questionSetsInScope(units, { part: 'PART1', topicId: 'all', style: 'standard' }).length, 1);
});

test('incomplete/duplicate classification, unknown topic, wrong version and invalid parent fail closed', () => {
    const sets = [{ ...compilePublicQuestionSet(source), set_version_id: version }];
    assert.throws(() => buildLearningUnits(sets, classifications.slice(0, 1), topics), /분류가 없습니다/);
    assert.throws(() => buildLearningUnits(sets, [...classifications, classifications[0]], topics), /중복/);
    assert.throws(() => buildLearningUnits(sets, [{ ...classifications[0], topic_ids: ['99'] }, classifications[1]], topics), /주제/);
    assert.throws(() => buildLearningUnits(sets, [{ ...classifications[0], source_set_version_id: release }, classifications[1]], topics), /판본/);
    assert.throws(() => validateLearningClassification({ ...classifications[0], case_set_id: null }), /부모/);
    assert.throws(() => validateLearningClassification({ ...classifications[1], standalone_prompt: '' }), /발문/);
    assert.throws(() => buildLearningUnits([{ ...sets[0], shared_context: { facts: [] } }], classifications, topics), /사실관계/);
});

test('a topic search retains every question of the matching case, including questions on other topics', () => {
    const metadata = classifications.map((meta, index) => ({ ...meta, question_style: 'case' as const,
        case_set_id: source.id, standalone_prompt: null, topic_ids: index === 0 ? ['01'] : ['08'] }));
    const units = buildLearningUnits([compilePublicQuestionSet(source)], metadata, topics);
    assert.equal(units.length, 1);
    for (const scope of [{ part: 'PART1', topicId: '01' }, { part: 'PART3', topicId: '08' }]) {
        const matching = questionSetsInScope(units, { ...scope, style: 'case' });
        assert.equal(matching.length, 1);
        assert.deepEqual(matching[0].subquestions.map(sub => sub.id), ['sub1', 'sub2']);
        assert.equal(matching[0].max_points, 2);
    }
});

test('standard grading projection contains only the chosen original rubric and freezes its independent prompt', () => {
    const id = learningUnitId(source.id, 'standard', 'sub2');
    const set = selectLearningQuestionSet(source, [classifications[1]], id);
    assert.equal(set.id, source.id, 'source lineage stays stable for historical rubric/result foreign keys');
    assert.deepEqual(set.shared_context.facts, []);
    assert.deepEqual(set.subquestions[0].criteria, source.subquestions[1].criteria);
    assert.deepEqual(set.learning_order, ['sub2']);
    assert.throws(() => selectLearningQuestionSet(source, classifications, id), /일치/);
    assert.throws(() => selectLearningQuestionSet(source, [classifications[1], classifications[1]], id), /일치/);
    const judged = applyQuestionSetJudgment(set, { sub2: '전문가적 의구심 유지' }, { subquestions: [{ subquestion_id: 'sub2', verdicts: [{ criterion_id: 'crit1', verdict: 'met', quote: '전문가적 의구심 유지' }] }] });
    assert.equal(judged.score, 1);
    assert.equal(judged.max_points, 1);
    assert.equal(judged.subquestions.length, 1);
});

test('v2 submission binds unit, selected codes and classification revisions; new revision cannot reuse a saved submission', async () => {
    const id = learningUnitId(source.id, 'standard', 'sub2');
    const set = selectLearningQuestionSet(source, [classifications[1]], id);
    const now = Date.now(), key = 'test-only-learning-unit-signing-key-32-characters';
    const token = issueSubmissionToken({ owner_user_id: memberId, actor_kind: 'member', membership_version: 1,
        release_id: release, set_version_id: version, questionSet: set, answers: { sub2: '' },
        learning_unit_id: id, classification_version_ids: [classificationIds[1]] }, key, now);
    const claims = verifySubmissionToken(token, memberId, [key], now);
    assert.equal(claims.v, 2);
    assert.deepEqual(claims.selected_subquestion_ids, ['sub2']);
    assert.deepEqual(assertBoundAnswers(claims, set, { sub2: '' }), { sub2: '' });
    assert.throws(() => assertBoundAnswers(claims, source, { sub1: '', sub2: '' }), /변경/);
    assert.throws(() => assertBoundAnswers({ ...claims, classification_version_ids: [classificationIds[0]] }, set, { sub2: '' }), /변경/);
    const saved = { release_id: release, set_version_id: version, learning_unit_id: id, classification_version_ids: [classificationIds[1]], submission_token: token, answers: { sub2: '' }, saved_at: now };
    assert.equal(canResumeSubmissionVersion(saved, saved), true);
    assert.equal(canResumeSubmissionVersion(saved, { ...saved, classification_version_ids: [classificationIds[0]] }), false);
    let gradedCount = 0, persistedCount = 0;
    const result = await gradeLearningSubmission(memberId, id, token, { sub2: '' }, {
        signingKeys: [key], apiKey: '', now: () => now,
        loadSet: async () => { throw new Error('Full-set loader must not handle a v2 submission'); },
        loadUnit: async (_r, _v, ids, unit) => { assert.deepEqual(ids, [classificationIds[1]]); assert.equal(unit, id); return set; },
        findAttempt: async () => null, begin: async (_claims, answers) => { assert.deepEqual(answers, { sub2: '' }); return { attempt_id: version }; },
        readResult: async () => null, claim: async () => ({ state: 'claimed', run_id: version, lease_token: release }),
        grade: async gradingSet => { gradedCount++; assert.equal(gradingSet.subquestions.length, 1); return applyQuestionSetJudgment(gradingSet, { sub2: '' }, { subquestions: [] }); },
        complete: async (_o, attempt_id, _r, _l, result) => { persistedCount++; return { attempt_id, status: 'completed', submitted_at: new Date(now).toISOString(), completed_at: new Date(now).toISOString(), expires_at: null, result }; },
        fail: async () => {}, consumeQuota: async () => { throw new Error('Blank submissions need no model quota'); }, consumeSubmissionQuota: async () => true,
    });
    assert.equal(result.ok, true); assert.equal(gradedCount, 1); assert.equal(persistedCount, 1);
});

test('new authoring supports a standalone question and refuses mixed styles or missing per-question topics', () => {
    const standalone = structuredClone(source);
    standalone.shared_context.facts = [];
    standalone.subquestions = [standalone.subquestions[0]];
    standalone.learning_order = ['sub1'];
    Object.assign(standalone.subquestions[0], { question_style: 'standard', topic_ids: ['01'] });
    assert.deepEqual(validateQuestionSetV3(standalone).errors, []);
    assert.equal(compilePublicQuestionSet(standalone).subquestions[0].question_style, 'standard');
    const missingTopic = structuredClone(standalone); delete missingTopic.subquestions[0].topic_ids;
    assert.ok(validateQuestionSetV3(missingTopic).errors.some(error => error.includes('topic_ids')));
    const withFacts = structuredClone(standalone); withFacts.shared_context = source.shared_context;
    assert.ok(validateQuestionSetV3(withFacts).errors.some(error => error.includes('사실관계 없이')));
    const mixed = structuredClone(source);
    Object.assign(mixed.subquestions[0], { question_style: 'case', topic_ids: ['01'] });
    Object.assign(mixed.subquestions[1], { question_style: 'standard', topic_ids: ['02'] });
    assert.ok(validateQuestionSetV3(mixed).errors.some(error => error.includes('별도 학습 단위')));
});

test('catalog compilation accepts one or many actual topics and never infers missing styles from parent topics', () => {
    const entries = classifications.map(meta => ({ set_id: source.id, subquestion_id: meta.subquestion_id,
        question_style: meta.question_style, topic_ids: meta.topic_ids, standalone_prompt: meta.standalone_prompt,
        case_fact_ids: meta.case_fact_ids!, reason: '판정 근거' }));
    assert.equal(compileLearningCatalog([source], entries, topics).units.length, 2);
    assert.throws(() => compileLearningCatalog([source], entries.slice(0, 1), topics), /분류가 없습니다/);
});

test('retiring legacy browser drafts only removes known full-set submissions of the current owner', () => {
    const current = { release_id: release, set_version_id: version, submission_token: 'test-only', answers: { sub2: '' }, saved_at: Date.now() };
    const unit = learningUnitId(source.id, 'standard', 'sub2');
    const values = new Map([
        [submissionSessionKey(memberId, source.id), JSON.stringify(current)],
        [submissionSessionKey('another-owner', source.id), JSON.stringify(current)],
        [submissionSessionKey(memberId, unit), JSON.stringify({ ...current, learning_unit_id: unit, classification_version_ids: [classificationIds[1]] })],
        ['unrelated-data', 'preserve'],
    ]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, removeItem: (key: string) => { values.delete(key); } };
    assert.equal(retireLegacySubmissionSessions(storage, memberId, [source.id, source.id]), 1);
    assert.equal(values.size, 3);
    assert.equal(values.has(submissionSessionKey('another-owner', source.id)), true);
    assert.equal(values.has(submissionSessionKey(memberId, unit)), true);
    assert.equal(retireLegacySubmissionSessions(storage, memberId, [source.id]), 0);
});

test('bank publication builds complete native or exact-source legacy learning metadata before the atomic RPC', () => {
    const entries = classifications.map(meta => ({ set_id: source.id, subquestion_id: meta.subquestion_id,
        question_style: meta.question_style, topic_ids: meta.topic_ids, standalone_prompt: meta.standalone_prompt,
        case_fact_ids: meta.case_fact_ids!, reason: '검토 근거' }));
    const compiled = compileLearningCatalog([source], entries, topics);
    const catalog = { topics, classifications: compiled.classifications };
    assert.equal(learningCatalogForBank([source], catalog).learning_classifications.length, 2);
    const changed = structuredClone(source); changed.subquestions[0].prompt += ' 바뀐 요구';
    assert.throws(() => learningCatalogForBank([changed], catalog), /검토된 물음 분류/);
    const native = structuredClone(source); native.subquestions = [native.subquestions[0]]; native.learning_order = ['sub1']; native.shared_context.facts = [];
    Object.assign(native.subquestions[0], { question_style: 'standard', topic_ids: ['01'] });
    const payload = learningCatalogForBank([native], { topics, classifications: [] });
    assert.equal(payload.learning_classifications.length, 1);
    assert.equal(payload.learning_classifications[0].standalone_prompt, native.subquestions[0].prompt);
    assert.equal(payload.learning_classifications[0].question_style, 'standard');
});
