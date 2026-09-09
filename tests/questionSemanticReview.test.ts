import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Response } from 'openai/resources/responses/responses';
import type { QuestionSetV3 } from '../lib/questionV3.ts';
import { completeSemanticReview, createManualReviewTemplate, finalizeManualReview, gradeSemanticReviewReceipt, prepareSemanticReview, reviewQuestionDraft, validateSemanticReviewReceipt } from '../cpa_uploader/questionSemanticReview.ts';
import { offlineGradeReceipt, offlineReviewResult } from './helpers/questionSemanticReviewFixture.ts';
import { authoringPlanHash } from '../cpa_uploader/questionAuthoringPlan.ts';
import type { QuestionAuthoringPlan } from '../cpa_uploader/questionAuthoringPlan.ts';
import { buildSourceCatalog, createSourcePacket, sourceUnitToRef } from '../cpa_uploader/questionSourceCatalog.mjs';
import { validateReviewGrading } from '../cpa_uploader/questionReviewGrading.ts';

const root = process.cwd();
const bank = JSON.parse(fs.readFileSync(path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json'), 'utf8')) as QuestionSetV3[];
function fixture() {
    const set = structuredClone(bank[0]); set.id = 'semantic-offline-fixture'; set.status = 'needs_review'; set.verification.review_status = 'needs_human_review';
    return { set, options: { bank, apiKey: 'offline-callback-key', model: 'configured-test-model' } };
}
const execution = { method: 'manual_reasoned' as const, model: null, performed_at: '2026-09-09T00:00:00Z', description: '오프라인 판정 fixture; 실제 의미 정확성 보증 아님' };

test('independent injected review binds every unit, actual source and case without changing draft status', async () => {
    const { set, options } = fixture(); const before = structuredClone(set); let called = 0;
    const receipt = await reviewQuestionDraft(set, options, async (request) => {
        called += 1; assert.equal(request.model, options.model); assert.equal(request.store, false);
        const context = JSON.parse(String(request.input));
        assert.ok(context.source_excerpts[0].quote.includes(set.source_refs[0].source_quote));
        assert.ok(String(request.input).length < 120000);
        assert.ok(context.known_source_metadata[0].registered_sources.length);
        assert.equal(context.existing_bank.length, bank.length);
        const raw = offlineReviewResult(prepareSemanticReview(set, options));
        return { status: 'completed', output: [], output_text: JSON.stringify(raw) } as unknown as Response;
    });
    assert.equal(called, 1); assert.deepEqual(set, before); assert.equal(receipt.verdict, 'pass');
    assert.equal(receipt.units.length, set.subquestions.length + set.subquestions.reduce((n, sub) => n + sub.criteria.length, 0));
    assert.equal(receipt.cases.length, set.subquestions.reduce((n, sub) => n + sub.criteria.length, 0) * 5);
    assert.match(validateSemanticReviewReceipt(receipt, set, options).join('\n'), /実際|실제 채점 사례 실행/);
    const graded = await offlineGradeReceipt(receipt, set, bank);
    assert.equal(graded.grading.transport, 'injected_response');
    assert.deepEqual(validateSemanticReviewReceipt(graded, set, options), []);
});

test('a reviewer-reported reversed claim or uncertain condition cannot produce an acceptable pass receipt', async () => {
    for (const status of ['fail', 'uncertain'] as const) {
        const { set, options } = fixture();
        set.subquestions[1].criteria[0].claim = '업무품질관리검토를 수행하면 업무수행이사의 책임은 경감된다고 판단함';
        const receipt = await reviewQuestionDraft(set, options, async (request) => {
            assert.ok(String(request.input).includes('책임은 경감된다고'));
            const raw = offlineReviewResult(prepareSemanticReview(set, options));
            raw.units.at(-1)!.checks[status === 'fail' ? 'source_support' : 'conditions_exceptions'] = status;
            raw.units.at(-1)!.rationale = status === 'fail' ? '실제 원문은 경감되지 않는다고 하므로 claim이 반대임' : '조건 적용의 검토가 미완료됨';
            return { status: 'completed', output: [], output_text: JSON.stringify(raw) } as unknown as Response;
        });
        assert.equal(receipt.verdict, status);
        assert.match(validateSemanticReviewReceipt(receipt, set, options).join('\n'), /pass가 아닙니다/);
    }
});

test('local evidence and completeness validation rejects fabricated quotes, duplicate units and empty cases', () => {
    const { set, options } = fixture(); const prepared = prepareSemanticReview(set, options);
    const mutate = [
        (raw: ReturnType<typeof offlineReviewResult>) => { raw.units[0].source_quotes[0].quote = '실제 원문에 없는 조작된 인용'; },
        (raw: ReturnType<typeof offlineReviewResult>) => { raw.units[0].source_quotes[0].quote = set.source_refs[0].source_quote.slice(0, 3); },
        (raw: ReturnType<typeof offlineReviewResult>) => { raw.units.push(structuredClone(raw.units[0])); },
        (raw: ReturnType<typeof offlineReviewResult>) => { raw.units.pop(); },
        (raw: ReturnType<typeof offlineReviewResult>) => { raw.cases = []; },
        (raw: ReturnType<typeof offlineReviewResult>) => { raw.cases[1].answer = ' '; },
        (raw: ReturnType<typeof offlineReviewResult>) => { raw.cases.push(structuredClone(raw.cases[0])); },
        (raw: ReturnType<typeof offlineReviewResult>) => { raw.units[1].draft_quotes = raw.units[1].draft_quotes.filter((quote) => !quote.path.endsWith('.expected')); },
        (raw: ReturnType<typeof offlineReviewResult>) => { Object.assign(raw, { invented_approval: true }); },
    ];
    for (const change of mutate) { const raw = offlineReviewResult(prepared); change(raw); assert.throws(() => completeSemanticReview(prepared, raw, execution)); }
    const template = createManualReviewTemplate(prepared);
    assert.notDeepEqual(validateSemanticReviewReceipt(template, set, options), []);
});

test('generated draft review requires its ready plan and rejects mismatched packet linkage', () => {
    const { set, options } = fixture();
    const catalog = buildSourceCatalog({ repoDir: root });
    const used = new Set(set.subquestions.flatMap((sub) => sub.requirements.map((req) => req.source_ref_id)));
    // Packet identity fixture uses two compact, dependency-complete paragraphs;
    // it does not claim these synthetic mappings are semantically correct.
    const packetUnits = catalog.units.filter((unit) => unit.standard === 'KGA 220' && !unit.dependencies.length);
    const selected = set.source_refs.filter((source) => used.has(source.id)).map((source, index) => ({ old: source, unit: packetUnits[index] }));
    assert.ok(selected.every((entry) => entry.unit));
    set.source_refs = selected.map(({ unit }) => { const ref = sourceUnitToRef(unit); return { id: ref.id, file: ref.file, title: ref.title, page: ref.page, source_quote: ref.source_quote, role: ref.role, content_hash: ref.content_hash }; });
    for (const sub of set.subquestions) {
        for (const req of sub.requirements) { const ref = sourceUnitToRef(selected.find((entry) => entry.old.id === req.source_ref_id)!.unit); req.source_ref_id = ref.id; req.source_quote = ref.source_quote; req.source_span = ref.source_span; }
        for (const criterion of sub.criteria) criterion.source_ref_ids = criterion.source_ref_ids.map((id) => selected.find((entry) => entry.old.id === id)!.unit.id);
    }
    const plan: QuestionAuthoringPlan = { version: 1, topic_id: '01', mode: 'new_from_standard', status: 'ready', objective: '검토 정의와 책임의 구별',
        scope: { actors: ['감사인'], timing: ['보고서일 이전'], conditions: ['검토 수행'], exceptions: ['책임 경감 없음'], required_answers: ['정의와 책임'], exclusions: ['계산 제외'] },
        question_types: ['descriptive', 'judgment'], source_unit_ids: selected.map((entry) => entry.unit.id), existing_question_difference: '테스트용 형상', unresolved_items: [],
        edition_assumption: '2027 시험에 2026 시행기준 동일 적용 가정; 최종 공고 미확정' };
    set.verification.notes.push(`출제 계획 해시: ${authoringPlanHash(plan)}`);
    assert.throws(() => prepareSemanticReview(set, options), /sidecar가 필요/);
    assert.throws(() => prepareSemanticReview(set, { ...options, authoringPlan: plan }), /packet sidecar도 필요/);
    const packet = { ...createSourcePacket({ catalog, topicId: '01', sourceIds: plan.source_unit_ids }), set_id: set.id, plan_hash: authoringPlanHash(plan) };
    set.verification.notes.push(`출처 묶음 해시: ${packet.fingerprint}`);
    assert.doesNotThrow(() => prepareSemanticReview(set, { ...options, authoringPlan: { ...plan, set_id: set.id }, packet }));
    assert.throws(() => prepareSemanticReview(set, { ...options, authoringPlan: plan, packet: { ...packet, plan_hash: '0'.repeat(64) } }), /계획\/세트 연결/);
    assert.throws(() => prepareSemanticReview(set, { ...options, authoringPlan: plan, packet: { ...packet, sourceRefs: [] } }), /catalog 재구성/);
    for (const mutate of [
        (value: typeof packet) => { value.fingerprint = '0'.repeat(64); },
        (value: typeof packet) => { value.primary = []; },
        (value: typeof packet) => { value.units[0].edition = '위조 판본'; },
        (value: typeof packet) => { value.units[0].locator = '존재하지 않는 문단'; },
    ]) { const forged = structuredClone(packet); mutate(forged); assert.throws(() => prepareSemanticReview(set, { ...options, authoringPlan: plan, packet: forged }), /catalog 재구성/); }
    assert.throws(() => prepareSemanticReview(set, { ...options, authoringPlan: { ...plan, edition_assumption: '다른 확정 기준' } }), /해시가 다릅니다/);
});

test('content, source bytes, bank and receipt identities cannot be silently refreshed', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-semantic-identity-'));
    try {
        const { set, options } = fixture();
        for (const [i, source] of set.source_refs.entries()) {
            const file = path.join(dir, `source-${i}.md`); fs.writeFileSync(file, source.source_quote); source.file = file;
        }
        const prepared = prepareSemanticReview(set, options); const receipt = completeSemanticReview(prepared, offlineReviewResult(prepared), execution);
        const changed = structuredClone(set); changed.subquestions[0].criteria[0].claim += '변경';
        assert.match(validateSemanticReviewReceipt(receipt, changed, options).join('\n'), /내용 해시/);
        const changedBank = structuredClone(bank); changedBank[0].title += '변경';
        assert.match(validateSemanticReviewReceipt(receipt, set, { ...options, bank: changedBank }).join('\n'), /비교 은행/);
        const tampered = structuredClone(receipt); tampered.units[0].rationale += '변조';
        assert.match(validateSemanticReviewReceipt(tampered, set, options).join('\n'), /receipt\/context 해시/);
        fs.appendFileSync(set.source_refs[0].file, '\n원문 주변 조건 변경');
        assert.match(validateSemanticReviewReceipt(receipt, set, options).join('\n'), /source 파일/);
        assert.throws(() => finalizeManualReview(prepareSemanticReview(set, options), receipt, '원문 확인'), /해시가 변경/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('actual manual CLI produces an incomplete template then validates completed evidence without model calls or status changes', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-semantic-cli-'));
    try {
        const { set, options } = fixture();
        const draft = path.join(dir, 'draft.json'); const bankFile = path.join(dir, 'bank.json'); const template = path.join(dir, 'template.json');
        const completed = path.join(dir, 'completed.json'); const review = path.join(dir, 'review.json');
        fs.writeFileSync(draft, JSON.stringify([set])); fs.writeFileSync(bankFile, JSON.stringify(bank));
        const plan = { version: 1, set_id: set.id, topic_id: '01', mode: 'new_from_standard', status: 'ready', objective: '검토 정의와 책임의 구별',
            scope: { actors: ['감사인'], timing: ['보고서일 이전'], conditions: ['검토 수행'], exceptions: ['책임 경감 없음'], required_answers: ['정의와 책임'], exclusions: ['계산 제외'] },
            question_types: ['descriptive', 'judgment'], source_unit_ids: ['offline-source'], existing_question_difference: '테스트용 신규 형상', unresolved_items: [],
            edition_assumption: '2027 시험에 2026 시행기준 동일 적용 가정; 최종 공고 미확정' };
        fs.writeFileSync(`${draft}.authoring-plan.json`, JSON.stringify({ artifact_type: 'question_authoring_plan', plans: [plan] }));
        const before = fs.readFileSync(draft);
        const run = (args: string[]) => spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'cpa_uploader/review_question_draft_v3.ts', '--file', draft, '--bank', bankFile, ...args],
            { cwd: root, encoding: 'utf8', timeout: 30000, env: { ...process.env, OPENAI_API_KEY: '', CPA_REVIEW_MODEL: '', CPA_GENERATION_MODEL: '' } });
        const first = run(['--manual-template', '--output', template]); assert.equal(first.status, 0, first.stderr);
        const doc = JSON.parse(fs.readFileSync(template, 'utf8'));
        assert.equal(doc.reviews[0].verdict, 'uncertain'); assert.deepEqual(doc.reviews[0].context.authoring_plan, plan);
        assert.notEqual(run(['--manual-input', template, '--description', '아직 미완성', '--output', review]).status, 0);
        assert.equal(fs.existsSync(review), false);
        const prepared = prepareSemanticReview(set, { ...options, authoringPlan: plan, packet: null });
        Object.assign(doc.reviews[0], offlineReviewResult(prepared)); fs.writeFileSync(completed, JSON.stringify(doc));
        const final = run(['--manual-input', completed, '--description', '격리 테스트 수동 입력 구조 검증. 실제 운영 검수 아님', '--output', review]);
        assert.equal(final.status, 0, final.stderr); assert.deepEqual(fs.readFileSync(draft), before);
        const receipt = JSON.parse(fs.readFileSync(review, 'utf8')).reviews[0];
        assert.equal(receipt.execution.method, 'manual_reasoned'); assert.equal(receipt.verdict, 'pass');
        assert.equal(receipt.grading.status, 'not_run');
        assert.match(validateSemanticReviewReceipt(receipt, set, { ...options, authoringPlan: plan, packet: null }).join('\n'), /실제 채점 사례 실행/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('semantic inputs are bounded without silently dropping bank peers or actual source verification', () => {
    const { set, options } = fixture(); const prepared = prepareSemanticReview(set, options);
    assert.equal(prepared.requestChars, JSON.stringify(prepared.requestContext).length);
    assert.ok(prepared.requestChars < 120000);
    assert.throws(() => prepareSemanticReview(set, { ...options, maxInputChars: 1000 }), /예산 1000자를 초과/);
    const criticalField = prepareSemanticReview(set, options).units[0].fields;
    assert.ok(Object.keys(criticalField).some((key) => key.endsWith('.source_quote')));
});

test('actual grader case records include empty answers and reject missing, mismatched or forged scoring results', async () => {
    const { set, options } = fixture(); const prepared = prepareSemanticReview(set, options);
    const receipt = completeSemanticReview(prepared, offlineReviewResult(prepared), execution);
    const graded = await offlineGradeReceipt(receipt, set, bank);
    const blank = graded.grading.runs.find((run) => run.id === 'empty-answer')!;
    assert.equal(blank.judgment, null); assert.equal(blank.result.score, 0); assert.ok(blank.matched);
    assert.deepEqual(validateReviewGrading(graded.grading, set, receipt.cases), []);
    const omitted = structuredClone(graded.grading); omitted.runs = omitted.runs.filter((run) => run.id !== 'empty-answer');
    assert.match(validateReviewGrading(omitted, set, receipt.cases).join('\n'), /빈답안 실행 기록/);
    const forged = structuredClone(graded.grading); forged.runs[0].result.score += 1;
    assert.match(validateReviewGrading(forged, set, receipt.cases).join('\n'), /점수·인용 결과/);
    const previousModel = process.env.CPA_GRADING_MODEL;
    try {
        process.env.CPA_GRADING_MODEL = 'changed-offline-model';
        assert.match(validateSemanticReviewReceipt(graded, set, options).join('\n'), /채점 모델 설정/);
    } finally { if (previousModel === undefined) delete process.env.CPA_GRADING_MODEL; else process.env.CPA_GRADING_MODEL = previousModel; }
    const wrong = await gradeSemanticReviewReceipt(receipt, set, { ...options }, async () => ({ status: 'completed', output: [], output_text: JSON.stringify({
        subquestions: set.subquestions.map((sub) => ({ subquestion_id: sub.id, verdicts: sub.criteria.map((criterion) => ({ criterion_id: criterion.id, verdict: 'not_met', quote: null, reason: '주입한 의도적 불일치' })) })),
    }) }) as unknown as Response);
    assert.match(validateSemanticReviewReceipt(wrong, set, options).join('\n'), /기대 판정과 다릅니다/);
});

test('omission may expect partial only for a criterion that defines partial credit', async () => {
    const { set, options } = fixture();
    const criterion = set.subquestions[0].criteria[0];
    const originalPrepared = prepareSemanticReview(set, options); const disallowed = offlineReviewResult(originalPrepared);
    disallowed.cases.find((sample) => sample.unit_id === `criterion:${set.subquestions[0].id}:${criterion.id}` && sample.kind === 'omission')!.expected = 'partial';
    assert.throws(() => completeSemanticReview(originalPrepared, disallowed, execution), /부분점수 계약/);
    criterion.max_points = 2; criterion.scores.met = 2; criterion.scores.partial = 1;
    const prepared = prepareSemanticReview(set, options); const raw = offlineReviewResult(prepared);
    const sample = raw.cases.find((item) => item.unit_id === `criterion:${set.subquestions[0].id}:${criterion.id}` && item.kind === 'omission')!; sample.expected = 'partial';
    const graded = await offlineGradeReceipt(completeSemanticReview(prepared, raw, execution), set, bank);
    assert.deepEqual(validateSemanticReviewReceipt(graded, set, options), []);
    assert.ok(graded.grading.runs.some((run) => run.result.subquestions[0].criteria.some((item) => item.verdict === 'partial')));
});
