// r31에서 분리 보존하는 기준서형 세트의 후보 은행·실제 채점 입력 생성기.
// 배치 공용 tools/build-round3.mjs는 모든 물음이 question_style 'case'임을 단언하므로 기준서형에는 쓸 수 없다.
// 이 파일은 build-round3.mjs의 절차를 그대로 따르되 기준서형 물음(학습 단위가 물음마다 생긴다)에 맞추고, 후보 검증에서
// 현재 정본 + 이 회차의 두 초안(사례형·기준서형)을 함께 메모리에서 validateAuthoringBank로 확인한다.
// 기존 tools/의 파일은 고치지 않는다. 기존 출력이 있으면 쓰지 않는다.
//
//   node --import tsx cpa_uploader/drafts/case-review-2026-09-15/r31-comparative-restatement-extension/build-standards-round.mjs candidate
//   node --import tsx cpa_uploader/drafts/case-review-2026-09-15/r31-comparative-restatement-extension/build-standards-round.mjs execution

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { selectLearningQuestionSet, learningUnitId } from '../../../../lib/learningUnits.ts';
import { computeSubquestionMaxPoints, compilePublicQuestionSet } from '../../../../lib/questionV3.ts';
import { contentHash } from '../../../../lib/learningSubmission.ts';
import { compileLearningCatalog } from '../../../../scripts/build-learning-unit-catalog.ts';
import { CONTENT_CHECKS, EFFICIENT_RUNTIME_FILES } from '../../../questionEfficientReview.ts';
import { reviewedContentHash } from '../../../questionReviewIdentity.ts';
import { validateAuthoringBank } from '../../../questionBankPublication.ts';

const B = 'cpa_uploader/analysis/reviews/case-review-2026-09-15';
const R = `${B}/r31`;
const D = 'cpa_uploader/drafts/case-review-2026-09-15/r31-comparative-restatement-extension';
const V = 'v1';
const BANK = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const CATALOG = 'cpa_uploader/data/learning-question-classifications.json';
const SET_ID = 'pilot-16-008-standards-20260921';
const CASE_SET_ID = 'case-16-comparative-restatement-20260921';

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const ref = (file) => ({ file, sha256: hash(fs.readFileSync(file)) });
const serialize = (value) => JSON.stringify(value, null, 2) + '\n';
const write = (file, value) => fs.writeFileSync(file, serialize(value), { flag: 'wx' });
const sorted = (values) => [...values].sort();

const mode = process.argv[2];
assert(['candidate', 'execution'].includes(mode), 'Usage: candidate|execution');

const rootFile = `${R}/root-content-review-standards-${V}.json`;
const draftFiles = ['standards-sets.json', 'design-standards.json', 'lineage.json', 'qa-standards.json', 'build-draft.mjs'].map((name) => `${D}/${name}`);
for (const file of [...draftFiles, rootFile]) assert(fs.existsSync(file), 'Missing input: ' + file);
const [draft] = read(`${D}/standards-sets.json`);
assert.equal(draft.id, SET_ID);
const rootReview = read(rootFile);
assert.equal(rootReview.method, 'agent_content_review');
assert.equal(rootReview.human_review_performed, false);
assert.equal(rootReview.target.reviewed_content_sha256, reviewedContentHash(draft), 'Reviewed draft changed');
assert.deepEqual(rootReview.unresolved_content_findings, []);
assert.deepEqual(sorted(rootReview.questions.map((q) => q.subquestion_id)), sorted(draft.subquestions.map((q) => q.id)));
for (const q of rootReview.questions) for (const check of CONTENT_CHECKS) assert.equal(q.checks[check], 'pass', check);

if (mode === 'candidate') {
    const bank = read(BANK), catalog = read(CATALOG);
    assert.equal(catalog.source_file_sha256, ref(BANK).sha256, 'Current catalog must describe the current bank');
    const review = read(catalog.review_file);
    assert.equal(review.source_file_sha256, ref(BANK).sha256);
    const [caseDraft] = read(`${D}/sets.json`);
    assert.equal(caseDraft.id, CASE_SET_ID);
    assert(!bank.some((set) => set.id === SET_ID || set.id === CASE_SET_ID), 'This round adds new set IDs');
    // 현재 정본 + 이 회차의 두 초안을 메모리에서 함께 검증한다. 전체 은행 사본은 쓰지 않는다.
    const full = [...bank, caseDraft, draft];
    const checked = validateAuthoringBank(full);
    assert.deepEqual(checked.errors, []);

    const design = read(`${D}/design-standards.json`);
    const caseDesign = read(`${D}/design.json`);
    const entries = draft.subquestions.map((question) => {
        const row = design.questions.find((q) => q.subquestion_id === question.id);
        assert.deepEqual(row.topic_ids, question.topic_ids);
        assert.equal(row.question_style, 'standard');
        assert.deepEqual(row.case_fact_ids, []);
        assert.equal(row.standalone_prompt, question.prompt, 'standalone_prompt는 독립 발문과 같아야 한다');
        return { set_id: SET_ID, subquestion_id: question.id, question_style: 'standard', topic_ids: question.topic_ids,
            standalone_prompt: row.standalone_prompt, case_fact_ids: [],
            reason: `${row.topic_reason} ${row.classification_note}` };
    });
    const caseEntries = caseDraft.subquestions.map((question) => {
        const row = caseDesign.questions.find((q) => q.subquestion_id === question.id);
        return { set_id: CASE_SET_ID, subquestion_id: question.id, question_style: 'case', topic_ids: question.topic_ids,
            standalone_prompt: null, case_fact_ids: row.case_fact_ids, reason: `${row.topic_reason} ${row.classification_note}` };
    });
    // 전체 후보의 분류도 메모리에서 컴파일해 두 초안의 새 항목이 현재 분류와 함께 성립하는지 확인한다.
    compileLearningCatalog(full, [...review.entries, ...caseEntries, ...entries], catalog.topics);

    write(`${R}/baseline-standards-${V}.json`, {
        bank: ref(BANK), catalog: ref(CATALOG), classification_review: ref(catalog.review_file),
        sets: bank.length, questions: bank.reduce((n, s) => n + s.subquestions.length, 0),
        draft: ref(`${D}/standards-sets.json`), case_draft: ref(`${D}/sets.json`),
        full_candidate_in_memory: { written: false, sha256: hash(serialize(full)), sets: full.length,
            questions: checked.subquestionCount, criteria: checked.criterionCount, points: checked.totalPoints,
            validate_authoring_bank_errors: checked.errors,
            note: '현재 정본 뒤에 이 회차의 사례형 초안과 기준서형 초안을 차례로 붙인 전체 후보를 메모리에서 검증하고 분류를 함께 컴파일했다. 전체 은행 사본은 쓰지 않았다.' },
    });
    const candidateFile = `${R}/candidate-standards-${V}.json`;
    write(candidateFile, [draft]);
    const classificationFile = `${R}/classification-standards-${V}.json`;
    write(classificationFile, { source_file: candidateFile, source_file_sha256: ref(candidateFile).sha256, entries });
    const { classifications, units } = compileLearningCatalog([draft], entries, catalog.topics);
    write(`${R}/catalog-standards-${V}.json`, { schema_version: 1, source_file: candidateFile,
        source_file_sha256: ref(candidateFile).sha256, public_content_hash: contentHash([draft].map(compilePublicQuestionSet)),
        review_file: classificationFile, review_file_sha256: ref(classificationFile).sha256, topics: catalog.topics, classifications });
    console.log({ full_candidate: { sets: full.length, questions: checked.subquestionCount, criteria: checked.criterionCount, points: checked.totalPoints },
        partial_candidate: { sets: 1, questions: draft.subquestions.length, classifications: classifications.length, learning_units: units.length } });
} else {
    const bankFile = `${R}/candidate-standards-${V}.json`, catalogFile = `${R}/catalog-standards-${V}.json`;
    const bank = read(bankFile), catalog = read(catalogFile), set = bank.find((s) => s.id === SET_ID);
    assert(set); assert.equal(bank.length, 1);
    assert.deepEqual(set, draft, 'Candidate must contain the exact reviewed draft');
    const bankWide = /^(topic_id \d+ 세트 수는 최소 \d+개여야 하지만 \d+개입니다\.|문제 은행은 최소 \d+개 세트를 유지해야 하지만 \d+개입니다\.)$/u;
    assert.deepEqual(validateAuthoringBank(bank).errors.filter((error) => !bankWide.test(error)), []);
    const baseline = read(`${R}/baseline-standards-${V}.json`);
    assert.equal(baseline.draft.sha256, ref(`${D}/standards-sets.json`).sha256);
    assert.deepEqual(baseline.full_candidate_in_memory.validate_authoring_bank_errors, []);
    assert.equal(catalog.source_file_sha256, ref(bankFile).sha256, 'Catalog must describe exact candidate bytes');
    assert.equal(set.status, 'needs_review');
    assert.equal(set.verification.review_status, 'needs_human_review');
    const policyInput = read(`${B}/policy-input.json`);
    assert.equal(policyInput.budget_enforcement, 'not_specified');
    assert.equal(policyInput.budget_usd, null);

    const qaFile = `${D}/qa-standards.json`, qa = read(qaFile), cases = [];
    for (const question of set.subquestions) {
        const maximum = computeSubquestionMaxPoints(question);
        for (const kind of maximum > 1 ? ['partial', 'wrong'] : ['wrong']) {
            const rows = qa.cases.filter((row) => row.subquestion_id === question.id && row.kind === kind);
            assert.equal(rows.length, 1, `${question.id}/${kind}`);
            const row = rows[0];
            assert.deepEqual(sorted(row.expected_verdicts.map((v) => v.criterion_id)), sorted(question.criteria.map((c) => c.id)));
            const points = question.criteria.reduce((n, c) => n + c.scores[row.expected_verdicts.find((v) => v.criterion_id === c.id).verdict], 0);
            assert.equal(points, row.expected_points);
            assert(kind === 'wrong' ? points === 0 : points > 0 && points < maximum);
            cases.push({ id: row.id, set_id: SET_ID, subquestion_id: question.id, kind, answer: row.answer, expected_points: points,
                expected_verdicts: row.expected_verdicts, expectation_review: 'agent_content_review_before_execution',
                human_review_performed: false, origin: { file: qaFile, reason: row.reason } });
        }
    }

    const evidenceFiles = [`${B}/authorization.md`, `${B}/policy-input.json`, rootFile, ...draftFiles,
        `${R}/baseline-standards-${V}.json`, `${R}/classification-standards-${V}.json`];
    const reviews = [{ set_id: SET_ID, content_hash: reviewedContentHash(set), reviewer_id: rootReview.reviewer_id,
        reviewed_at: rootReview.reviewed_at, method: 'agent_content_review', human_review_performed: false,
        evidence: evidenceFiles.map(ref),
        questions: set.subquestions.map((question) => {
            const row = rootReview.questions.find((q) => q.subquestion_id === question.id);
            return { subquestion_id: question.id, criterion_ids: question.criteria.map((c) => c.id),
                source_ref_ids: [...new Set([...question.requirements.map((r) => r.source_ref_id), ...question.criteria.flatMap((c) => c.source_ref_ids)])],
                checks: row.checks, rationale: row.rationale };
        }), unresolved_content_findings: [] }];

    const out = `${R}/execution-standards-${V}`;
    assert(!fs.existsSync(out), 'Use a new version for a retry; preserve previous evidence');
    fs.mkdirSync(out); fs.mkdirSync(out + '/projections'); fs.mkdirSync(out + '/runtime');
    write(out + '/representatives.json', { cases });
    write(out + '/scope.json', { targets: [{ set_id: SET_ID, subquestion_ids: set.subquestions.map((q) => q.id) }] });
    write(out + '/policy.json', { scope: ref(out + '/scope.json'), model: 'gpt-5.6-luna', grading_point_tolerance: 1,
        minimum_within_tolerance_ratio: 0.95, content_error_tolerance: 0, statistical_confidence_claim: false,
        budget_usd: policyInput.budget_usd, budget_enforcement: policyInput.budget_enforcement,
        provider_limit_errors_stop_all_workers: true, monetary_limit_not_inferred_from_prior_batches: true,
        reuse_decision: `${V} 기준서형 초안 1세트·2물음을 검토한다. 원 pilot-16-008의 실측 기록은 없고 발문도 달라 재사용하지 않으며 분모에 넣지 않는다. 기준서형은 물음마다 학습 단위가 따로 생겨 한 요청이 한 물음만 담으므로, 모범·부분·오답 역할을 물음마다 실측해 모두 6요청이 된다(r17·r21의 기준서형 세트는 1물음이어서 3요청이었다). 모범답안 요청이 사례 지문 없는 독립 물음으로 만점이 되는지를 함께 확인한다. 채점 은행은 이 세트만 담은 부분 은행이다.` });
    write(out + '/agent-reviews.json', reviews);

    const codeFiles = [...new Set([...EFFICIENT_RUNTIME_FILES, ...['run-efficient-grading.ts', 'contract.ts', 'accounting.ts'].map((file) => `${B}/tools/${file}`)])];
    const snapshots = codeFiles.map((file, index) => {
        const copied = `${out}/runtime/${String(index).padStart(2, '0')}-${path.basename(file)}`;
        fs.copyFileSync(file, copied, fs.constants.COPYFILE_EXCL);
        return { ...ref(copied), runtime_file: file };
    });
    write(out + '/runtime-snapshots.json', snapshots);

    const metadata = catalog.classifications.filter((c) => c.source_set_id === SET_ID);
    assert.equal(metadata.length, set.subquestions.length);
    assert(metadata.every((c) => c.question_style === 'standard'));
    // 기준서형은 물음마다 학습 단위가 따로 생긴다(<세트ID>--<물음ID>--standard). r17·r21의 기준서형
    // 세트는 물음이 하나여서 단위도 하나였으나 이 회차는 둘이므로 단위마다 투영과 요청을 만든다.
    const units = [...new Set(metadata.map((c) => learningUnitId(SET_ID, c.question_style, c.subquestion_id)))];
    assert.equal(units.length, set.subquestions.length, '기준서형은 물음마다 학습 단위가 하나씩이어야 한다');
    const projections = units.map((unit) => {
        // 투영은 그 학습 단위에 속한 분류만 받는다. 세트의 분류를 통째로 넘기면
        // selectLearningQuestionSet이 "학습 단위와 물음 판본이 일치하지 않습니다"로 멈춘다.
        const unitMetadata = metadata.filter((c) => learningUnitId(SET_ID, c.question_style, c.subquestion_id) === unit);
        assert.equal(unitMetadata.length, 1, '기준서형 학습 단위에는 물음이 하나만 속한다');
        const projection = selectLearningQuestionSet(set, unitMetadata, unit);
        assert.deepEqual(projection.shared_context.facts, [], '기준서형 투영에는 사례 사실이 없어야 한다');
        assert.equal(projection.subquestions.length, 1, '기준서형 투영에는 물음이 하나만 있어야 한다');
        const projectedFile = out + '/projections/' + unit + '.json';
        write(projectedFile, projection);
        return { unit, projection, projectedFile };
    });

    const entries = projections.flatMap(({ unit, projection, projectedFile }) => ['model', 'partial', 'wrong'].map((kind) => {
        const answers = {}, expected = [], selection = [];
        for (const question of projection.subquestions) {
            const representative = cases.find((row) => row.subquestion_id === question.id && row.kind === kind);
            const verdicts = kind === 'model'
                ? question.criteria.map((c) => ({ criterion_id: c.id, verdict: 'met', reason: '직접 출처·독립 발문·득점 조건을 대조한 저장 모범답안.' }))
                : representative.expected_verdicts;
            answers[question.id] = kind === 'model' ? question.model_answer.join('\n') : representative.answer;
            expected.push({ subquestion_id: question.id,
                expected_points: question.criteria.reduce((n, c) => n + c.scores[verdicts.find((v) => v.criterion_id === c.id).verdict], 0),
                expected_verdicts: verdicts });
            selection.push({ ...ref(kind === 'model' ? bankFile : out + '/representatives.json'), subquestion_id: question.id,
                case_id: kind === 'model' ? null : representative.id, kind,
                reason: '원문과 현재 criterion에서 실행 전에 확정한 대표 답안. 기준서형 독립 물음 하나를 한 요청으로 채점한다.' });
        }
        return { id: `${unit}--${kind}`, worker: 'a', learning_unit_id: unit, source_set_id: SET_ID,
            projected_file: projectedFile, projected_sha256: ref(projectedFile).sha256, kind,
            evaluated_subquestion_ids: projection.subquestions.map((q) => q.id),
            answers, expected_by_subquestion: expected, selection_evidence: selection };
    }));

    const inputFiles = [...new Set([...set.source_refs.map((s) => s.file), ...evidenceFiles, `${D}/build-standards-round.mjs`,
        bankFile, catalogFile, out + '/scope.json', out + '/representatives.json', out + '/agent-reviews.json',
        out + '/runtime-snapshots.json', ...snapshots.map((s) => s.file)])];
    write(out + '/grading-manifest.json', { version: 1, artifact_type: 'efficient_grading_manifest', model: 'gpt-5.6-luna',
        budget_usd: policyInput.budget_usd, budget_enforcement: policyInput.budget_enforcement,
        bank: ref(bankFile), classifications: ref(catalogFile), policy: ref(out + '/policy.json'),
        inputs: inputFiles.map(ref), code_files: codeFiles.map(ref), entries });
    console.log(JSON.stringify({ requests: entries.length,
        evaluated_answers: entries.reduce((n, e) => n + e.evaluated_subquestion_ids.length, 0),
        learning_units: units, manifest: ref(out + '/grading-manifest.json'), actual_sdk_calls: 0 }, null, 2));
}
