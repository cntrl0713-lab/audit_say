import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileLearningCatalog } from '../../../../scripts/build-learning-unit-catalog.ts';
import { validateAuthoringBank } from '../../../questionBankPublication.ts';
import { compilePublicQuestionSet } from '../../../../lib/questionV3.ts';

const R = 'cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14';
const C1 = R + '/candidate-v1', C2 = R + '/candidate-v2';
const reviewFile = R + '/targeted-clarification.json';
const generatorFile = R + '/build-targeted-clarification.mjs';
const sid = 'std-points-20260914-17c71aee6d2b', qid = 'sub2';
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const hash = b => createHash('sha256').update(b).digest('hex');
const json = x => JSON.stringify(x, null, 2) + '\n';
const ref = file => ({ file, sha256: hash(fs.readFileSync(file)) });
const write = (file, value) => fs.writeFileSync(file, json(value), { flag: 'wx' });
assert(!fs.existsSync(C2), 'Use a fresh candidate; never overwrite a prior candidate');
assert(!fs.existsSync(reviewFile), 'Keep the follow-up review immutable');
const sourceFiles = fs.readdirSync(C1).map(name => C1 + '/' + name);
assert(sourceFiles.every(file => fs.statSync(file).isFile()));
const originalChecks = read(C1 + '/checks.json');
const protectedFiles = [...sourceFiles, ...originalChecks.plan_files.map(p => p.file),
    R + '/qa-06-10.json', R + '/implementation-content-checks.json'];
const observations = Object.fromEntries(['model', 'partial', 'wrong'].map(kind => {
    const file = R + '/execution-v1/actual-b/' + sid + '--' + qid + '--' + kind + '/observation.json';
    protectedFiles.push(file);
    return [kind, { ...ref(file), value: read(file) }];
}));
const protectedBefore = protectedFiles.map(ref);
const bank1 = read(C1 + '/bank.json'), bank2 = structuredClone(bank1);
const original = bank1.find(s => s.id === sid), revised = bank2.find(s => s.id === sid);
assert(original && revised && original.subquestions.length === 1);
const q1 = original.subquestions[0], q2 = revised.subquestions[0];
assert.equal(q1.id, qid);
assert.deepEqual(q1.criteria.map(c => c.id), ['crit7', 'crit12', 'crit8', 'crit9']);
const prompt = '감사기준서 315 문단 26(a)에서 식별한 통제를 바탕으로, 문단 26(b)~(c)에 따라 IT 사용 관련 위험과 통제에 관하여 식별할 사항을 모두 제시하시오.';
revised.title = prompt;
q2.prompt = prompt;
const scopes = {
    crit7: '식별된 통제에 기초한다는 점은 발문의 전제이므로 답안에 반복하지 않아도 된다. IT 사용 위험이 따르는 IT 응용프로그램의 식별을 쓰면 인정한다. 식별된 통제와 무관하다고 명시적으로 부정하면 인정하지 않는다.',
    crit12: '식별된 통제에 기초한다는 점은 발문의 전제이므로 답안에 반복하지 않아도 된다. IT 사용 위험이 따르는 IT 환경의 기타 측면의 식별을 쓰면 인정한다. 식별된 통제와 무관하다고 명시적으로 부정하면 인정하지 않는다.',
};
for (const criterion of q2.criteria.filter(c => c.id in scopes)) {
    assert.equal(criterion.critical_facts.length, 1);
    assert.equal(criterion.critical_facts[0].scope, undefined);
    criterion.critical_facts[0].scope = scopes[criterion.id];
}
const reverted = structuredClone(bank2), revert = reverted.find(s => s.id === sid);
revert.title = original.title;
revert.subquestions[0].prompt = q1.prompt;
for (const criterion of revert.subquestions[0].criteria.filter(c => c.id in scopes)) delete criterion.critical_facts[0].scope;
assert.deepEqual(reverted, bank1, 'Exactly title, prompt and the two specified fact scopes may change');
assert.deepEqual(q2.model_answer, q1.model_answer);
assert.equal(q2.criteria.reduce((sum, c) => sum + c.max_points, 0), 4);
const valid = validateAuthoringBank(bank2);
assert.deepEqual(valid.errors, []);
const representatives1 = read(C1 + '/representatives.json');
const originalRepresentatives = representatives1.filter(r => r.set_id === sid && r.subquestion_id === qid);
assert.deepEqual(originalRepresentatives.map(r => r.kind), ['partial', 'wrong']);
const partial = originalRepresentatives.find(r => r.kind === 'partial');
assert.equal(partial.answer, 'IT 사용 위험이 따르는 IT 응용프로그램과 IT 환경의 기타 측면을 식별한다.');
assert.deepEqual(partial.met_criterion_ids, ['crit7', 'crit12']);
assert.equal(partial.expected_points, 2);
assert.equal(observations.partial.value.result.score, 0);
assert.equal(observations.partial.value.original_expected[0].expected_points, 2);
assert.equal(observations.partial.value.answers[qid], partial.answer);
for (const kind of ['model', 'partial', 'wrong']) assert.equal(observations[kind].value.transport, 'model');
const source = original.source_refs[0];
assert.equal(original.source_refs.length, 1);
assert(fs.readFileSync(source.file, 'utf8').replace(/\s+/g, '').includes(source.source_quote.replace(/\s+/g, '')));
assert.equal(hash(source.source_quote), source.content_hash);
const sourceReview = '담당 agent가 KGA 315.26(a)~(c)의 원발문·4개 criterion·critical_facts·저장 모범 및 실제 부분답을 직접 대조했다. 한국공인회계사회 2025 전문 PDF 202~203쪽과 2026 전문 PDF 227~228쪽을 직접 읽었다. 문단26(b)의 식별된 통제를 바탕으로 한다는 연결과 IT 응용프로그램·기타 IT 환경 두 대상, 문단26(c)의 IT 위험·IT 일반통제 두 요구가 양 판본에서 일치한다. 연결 발췌의 전체 인용도 원 등록 파일과 공백 정규화 후 일치한다. 이번 변경은 26(a)의 연결을 발문 전제로 명시하고 그 전제를 답안에 반복할 필요가 없다고 범위를 설명한다. 식별된 통제와 무관하다는 명시적 부정은 허용하지 않는다. 대상의 수식어인 IT 사용 위험이 따르는이라는 표현만으로 위험 자체를 식별한다는 crit8의 별도 수행까지 인정하지 않는다. 원문 요구·모범·claim·배점·출처는 유지한다. 2026 문단26(d)에 추가된 A175~A181 참조 표시는 이번 문단26(b)~(c)의 의미 변경이 아니며 대상 밖이다. 보존 원본의 수집 계보와 공식 2026 전문 게시번호11786004332051은 기존 raw 매니페스트와 보존 공식 목록에 연결된다. 이는 새 agent 검토이며 후속 실제 채점은 아직 실행하지 않았다.';
const bank2Bytes = json(bank2);
const review = {
    version: 1, reviewed_at: '2026-09-14', reviewer: 'Codex agent /root/review_11_14',
    kind: 'targeted_prompt_premise_and_fact_scope_clarification', set_id: sid, subquestion_id: qid,
    original_candidate: ref(C1 + '/bank.json'), candidate: { file: C2 + '/bank.json', sha256: hash(bank2Bytes) },
    original_prompt: q1.prompt, revised_prompt: prompt,
    changed_fields: ['title', 'subquestions[0].prompt', 'subquestions[0].criteria[0].critical_facts[0].scope', 'subquestions[0].criteria[1].critical_facts[0].scope'],
    scopes, original_points: 4, revised_points: 4,
    unchanged: ['set/question/criterion IDs', 'all other sets', 'stored model_answer', 'criterion claims and expected facts', 'points and scores', 'source_refs and requirements', 'question style and topic IDs', 'original representative answers and expected points'],
    observed_error: {
        file: observations.partial.file, sha256: observations.partial.sha256, actual_transport: 'model', model: observations.partial.value.model,
        expected_points: 2, actual_points: 0, delta: -2, within_tolerance: false,
        criterion_reasons: observations.partial.value.judgment.subquestions[0].verdicts.slice(0, 2),
        diagnosis: '답안의 두 식별 대상은 모두 정확하나 모델이 발문상 통제 식별 전제를 답안에 다시 쓰도록 요구하여 각 1점을 과소채점하였다. 원 source와 기대2점은 올바르다. 전제가 더 명백히 드러나도록 발문과 해당 critical_facts의 scope를 보완한다.'
    },
    source_review: sourceReview,
    source_evidence: [
        { ...ref(source.file), source_ref_id: source.id, quote_sha256: source.content_hash },
        { ...ref('cpa_uploader/raw/materials/verification/b6b3a965c25cdb5b/kga-2025.pdf'), edition: '2025', pages: [202, 203], reviewed_paragraphs: ['315.26(a)', '315.26(b)', '315.26(c)'] },
        { ...ref('cpa_uploader/raw/materials/verification/59020bf1eba001c1/kga-2026-full.pdf'), edition: '2026', pages: [227, 228], reviewed_paragraphs: ['315.26(a)', '315.26(b)', '315.26(c)'] }
    ],
    representative_reviews: [
        { kind: 'model', answer: q1.model_answer.join('\n'), stored_model_answer: q1.model_answer, met_criterion_ids: q1.criteria.map(c => c.id), expected_points: 4,
            rationale: '첫 문장에 통제를 바탕으로 응용프로그램·기타 환경 식별, 둘째 문장에 해당 IT 위험·대처 IT 일반통제 식별이 모두 있다. 새 발문·scope에서도 4개 기준을 충족하며 원 저장 배열을 변경하지 않는다.', prior_observation: { file: observations.model.file, sha256: observations.model.sha256, actual_points: observations.model.value.result.score } },
        { ...partial, rationale: '응용프로그램과 기타 IT 환경 두 대상의 식별이 있어 crit7/crit12 각 1점이다. 발문에 명시한 통제 기반은 반복하지 않아도 된다. 위험이 따르는은 대상의 범위를 제한하며 IT 사용 위험 자체의 식별(crit8), 그 위험에 대처하는 일반통제 식별(crit9)은 쓰지 않아 0점이다. 원래 유효한 반례와 기대2점을 그대로 보존한다.' },
        { ...originalRepresentatives.find(r => r.kind === 'wrong'), rationale: '일반통제가 모든 감사위험을 없앤다는 잘못된 일반 주장뿐이며 응용프로그램·기타환경·IT 위험·관련 일반통제의 식별을 제시하지 않는다. 기타환경 파악을 명시적으로 부정하므로 새 scope에서도 0점이다.', prior_observation: { file: observations.wrong.file, sha256: observations.wrong.sha256, actual_points: observations.wrong.value.result.score } },
        { kind: 'explicit_contradiction_boundary', answer: '식별된 통제와는 무관하게 IT 사용 위험이 따르는 IT 응용프로그램과 IT 환경의 기타 측면을 식별한다.', met_criterion_ids: [], expected_points: 0,
            rationale: '단순 전제 생략과 명시적 부정을 구별한다. 이 답안은 통제 기반을 부정하므로 crit7/crit12를 충족하지 않으며 위험 자체나 일반통제 식별도 없어 전체 0점이다. 후속 원모범·부분·오답 실측에 필요시 추가할 수 있는 새 경계 답안이다.' }
    ],
    expectations_changed_to_match_model: false, actual_followup_model_calls: 0, human_review_performed: false,
    status: 'content_review_pass_followup_grading_pending', unresolved_content_findings: [],
    original_evidence_preservation: 'candidate-v1, plans, frozen QA and execution-v1 observations are read-only. Candidate-v2 uses a separate individual follow-up review and does not rewrite prior approval or measured results.'
};
write(reviewFile, review);
const followup = ref(reviewFile);
fs.mkdirSync(C2);
for (const file of sourceFiles) fs.copyFileSync(file, C2 + '/' + file.slice(C1.length + 1), fs.constants.COPYFILE_EXCL);
const replace = (name, value) => fs.writeFileSync(C2 + '/' + name, json(value));
replace('bank.json', bank2);
const newSets = read(C1 + '/new-sets.json').map(s => s.id === sid ? structuredClone(revised) : s);
assert(newSets.some(s => s.id === sid));
replace('new-sets.json', newSets);
replace('public.json', bank2.map(compilePublicQuestionSet));
const classificationReview = read(C1 + '/classification-review.json');
const matchingEntry = classificationReview.entries.filter(e => e.set_id === sid && e.subquestion_id === qid);
assert.equal(matchingEntry.length, 1);
matchingEntry[0].standalone_prompt = prompt;
matchingEntry[0].reason += ' 2026-09-14 개별 후속 명료화: 통제 기반을 발문 전제로 명시하였다. 분류와 주제는 유지한다. 근거: ' + reviewFile;
classificationReview.source_file = C2 + '/bank.json';
classificationReview.source_file_sha256 = ref(C2 + '/bank.json').sha256;
classificationReview.targeted_followup = followup;
replace('classification-review.json', classificationReview);
const catalog1 = read(C1 + '/catalog.json');
const compiled = compileLearningCatalog(bank2, classificationReview.entries, catalog1.topics);
const catalog2 = { ...catalog1, source_file: C2 + '/bank.json', source_file_sha256: ref(C2 + '/bank.json').sha256,
    review_file: C2 + '/classification-review.json', review_file_sha256: ref(C2 + '/classification-review.json').sha256, classifications: compiled.classifications };
assert.deepEqual(catalog2.classifications.filter(c => c.source_set_id !== sid), catalog1.classifications.filter(c => c.source_set_id !== sid));
assert.equal(catalog2.classifications.find(c => c.source_set_id === sid).learning_question_id, catalog1.classifications.find(c => c.source_set_id === sid).learning_question_id);
replace('catalog.json', catalog2);
const contentReviews = read(C1 + '/content-reviews.json');
const content = contentReviews.find(r => r.set_id === sid && r.subquestion_id === qid);
assert(content);
content.targeted_followup = followup;
content.rationale += ' 후속 실측의 전제 반복 과소채점에 대하여 발문·두 scope를 명료화하였다. 요구 요소 및 4점은 유지한다.';
content.source_review += ' 후속 직접 원문 대조: ' + sourceReview;
replace('content-reviews.json', contentReviews);
const representatives2 = structuredClone(representatives1);
for (const row of representatives2.filter(r => r.set_id === sid && r.subquestion_id === qid)) {
    row.targeted_followup = followup;
    row.reason += row.kind === 'partial'
        ? ' 후속 검토에서도 통제 기반은 발문 전제이므로 반복 없이 crit7/crit12를 인정한다. 대상의 수식어만으로 crit8의 별도 위험 식별을 인정하지 않는다. 원답안과 기대2점은 유지한다.'
        : ' 후속 발문·scope에 대조해도 원답안은 네 식별 요구를 충족하지 않으므로 기대0점을 유지한다.';
}
replace('representatives.json', representatives2);
write(C2 + '/qa-targeted-clarification.json', { version: 1, candidate: ref(C2 + '/bank.json'), followup,
    reviewer: review.reviewer, reviewed_at: review.reviewed_at, status: 'pass', actual_model_calls: 0,
    questions: [{ set_id: sid, subquestion_id: qid, prompt, criterion_ids: q2.criteria.map(c => c.id), source_review: sourceReview,
        representatives: review.representative_reviews, unresolved: [] }] });
const changes = ['bank.json', 'catalog.json', 'checks.json', 'classification-review.json', 'content-reviews.json', 'new-sets.json', 'public.json', 'representatives.json'];
for (const file of sourceFiles.filter(f => !changes.includes(f.slice(C1.length + 1))))
    assert.equal(ref(file).sha256, ref(C2 + '/' + file.slice(C1.length + 1)).sha256);
replace('checks.json', { ...originalChecks, candidate_version: 'candidate-v2', cloned_from: ref(C1 + '/checks.json'),
    original_candidate: ref(C1 + '/bank.json'), candidate: ref(C2 + '/bank.json'),
    targeted_followups: [{ ...followup, set_id: sid, subquestion_id: qid, generator: ref(generatorFile), changed_fields: review.changed_fields,
        meaning: 'Original plan remains preserved; this separate follow-up clarifies a prompt premise and scopes after an actual grading defect.' }],
    clone_checks: { unchanged_all_other_set_objects: true, unchanged_model_answers: true, unchanged_criteria_ids_claims_points: true,
        only_four_allowed_content_paths_changed: true, unchanged_non_target_classifications: true,
        unchanged_lineage_retained_subsets_retired_sets: true, previous_evidence_preserved: true },
    sets: bank2.length, questions: valid.subquestionCount, criteria: valid.criterionCount, points: valid.totalPoints, errors: valid.errors });
for (const before of protectedBefore) assert.equal(ref(before.file).sha256, before.sha256, 'Protected input changed: ' + before.file);
console.log(json({ candidate: ref(C2 + '/bank.json'), catalog: ref(C2 + '/catalog.json'), followup,
    generator: ref(generatorFile), changed_sets: 1, changed_questions: 1, points: valid.totalPoints, errors: valid.errors }));
