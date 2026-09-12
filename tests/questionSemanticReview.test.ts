import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Response } from 'openai/resources/responses/responses';
import type { QuestionSetV3 } from '../lib/questionV3.ts';
import { buildReviewChunkInput, completeSemanticReview, createManualReviewTemplate, finalizeManualReview, gradeSemanticReviewReceipt, groundReviewChunk, prepareSemanticReview, reviewQuestionDraft, validateRecordedSemanticReview, validateSemanticReviewReceipt } from '../cpa_uploader/questionSemanticReview.ts';
import { offlineGradeReceipt, offlineReviewResult, offlineReviewChunk, syntheticModelReceipt } from './helpers/questionSemanticReviewFixture.ts';
import { applyQuestionSetJudgment } from '../lib/questionV3Grading.ts';
import { authoringPlanHash } from '../cpa_uploader/questionAuthoringPlan.ts';
import type { QuestionAuthoringPlan } from '../cpa_uploader/questionAuthoringPlan.ts';
import { buildSourceCatalog, createSourcePacket, sourceUnitToRef } from '../cpa_uploader/questionSourceCatalog.mjs';
import { executeReviewGrading, validateReviewGrading } from '../cpa_uploader/questionReviewGrading.ts';
import type { ReviewGradingEvent } from '../cpa_uploader/questionReviewGrading.ts';
import type { SemanticReviewOptions } from '../cpa_uploader/questionSemanticReview.ts';

const root = process.cwd();
// Receipt/transport contracts need explicit comparison peers, not the growing corpus.
const fixturePeerIds = ['pilot-01-001', 'pilot-01-002'];
const bank = (JSON.parse(fs.readFileSync(path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json'), 'utf8')) as QuestionSetV3[])
    .filter(set => fixturePeerIds.includes(set.id));
assert.equal(bank.length, fixturePeerIds.length, 'semantic fixture peers must exist');
function fixture() {
    const set = structuredClone(bank[0]); set.id = 'semantic-offline-fixture'; set.status = 'needs_review'; set.verification.review_status = 'needs_human_review';
    return { set, options: { bank, apiKey: 'offline-callback-key', model: 'configured-test-model' } };
}
const execution = { method: 'manual_reasoned' as const, model: null, performed_at: '2026-09-09T00:00:00Z', description: '오프라인 판정 fixture; 실제 의미 정확성 보증 아님' };

test('review excerpts retain the exact quote and locate full source lines across mixed newline files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-semantic-lines-'));
    try {
        const { set, options } = fixture();
        const prefix = `첫째 줄\r\n${'긴 인접 문맥'.repeat(130)}\r\n셋째 줄\n`;
        for (const [i, source] of set.source_refs.entries()) {
            const file = path.join(dir, `source-${i}.txt`);
            fs.writeFileSync(file, prefix + source.source_quote + '\r\n후속 문맥\n');
            source.file = file;
        }
        const prepared = prepareSemanticReview(set, options);
        const context = prepared.requestContext as { source_excerpts: Array<{ file: string; quote: string; line_start: number; line_end: number; source_quote_line_start: number; source_quote_line_end: number }> };
        for (const [i, excerpt] of context.source_excerpts.entries()) {
            const text = fs.readFileSync(excerpt.file, 'utf8');
            const lines = text.split('\n');
            assert.equal(excerpt.source_quote_line_start, 4);
            assert.equal(excerpt.source_quote_line_end, 4 + set.source_refs[i].source_quote.split('\n').length - 1);
            const selectedLines = lines.slice(excerpt.line_start - 1, excerpt.line_end).join('\n');
            assert.equal(excerpt.quote, selectedLines + (excerpt.quote.endsWith('\n') ? '\n' : ''));
            assert.ok(excerpt.quote.includes(set.source_refs[i].source_quote));
            assert.ok(excerpt.line_start <= excerpt.source_quote_line_start);
            assert.ok(excerpt.line_end >= excerpt.source_quote_line_end);
        }
    } finally {
        assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep));
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('split review cannot invent references or omit fields and case kinds during grounding', () => {
    const { set, options } = fixture();
    const prepared = prepareSemanticReview(set, options);
    const unit = prepared.units.find(unit => unit.modelAnswer)!;
    const original = offlineReviewChunk(offlineReviewResult(prepared), unit.id);
    const grounded = groundReviewChunk(original, prepared, unit);
    assert.equal(grounded.cases[0].answer, unit.modelAnswer);
    assert.equal(grounded.units[0].draft_quotes[0].quote, unit.fields[original.reviewed_field_ids[0]]);
    for (const mutate of [
        (raw: typeof original) => { raw.source_ref_ids = ['invented-source']; },
        (raw: typeof original) => { raw.reviewed_field_ids.pop(); },
        (raw: typeof original) => { raw.reviewed_field_ids.push(raw.reviewed_field_ids[0]); },
        (raw: typeof original) => { raw.cases.pop(); },
        (raw: typeof original) => { raw.cases[1].source_ref_ids = []; },
    ]) {
        const raw = structuredClone(original); mutate(raw);
        assert.throws(() => groundReviewChunk(raw, prepared, unit));
    }
});

test('independent injected review binds every unit, actual source and case without changing draft status', async () => {
    const { set, options } = fixture(); const before = structuredClone(set); let called = 0;
    const receipt = await reviewQuestionDraft(set, options, async (request) => {
        called += 1; assert.equal(request.model, options.model); assert.equal(request.store, false);
        const context = JSON.parse(String(request.input));
        assert.ok(context.source_excerpts[0].quote.includes(set.source_refs[0].source_quote));
        assert.ok(String(request.input).length < 160000);
        assert.ok(context.known_source_metadata[0].registered_sources.length);
        assert.equal(context.existing_bank.length, bank.length);
        const raw = offlineReviewResult(prepareSemanticReview(set, options));
        return { status: 'completed', output: [], output_text: JSON.stringify(offlineReviewChunk(raw, JSON.parse(String(request.input)).target_unit)) } as unknown as Response;
    });
    assert.equal(called, prepareSemanticReview(set, options).units.length); assert.deepEqual(set, before); assert.equal(receipt.verdict, 'pass');
    assert.equal(receipt.units.length, set.subquestions.length + set.subquestions.reduce((n, sub) => n + sub.criteria.length, 0));
    assert.equal(receipt.cases.length, set.subquestions.reduce((n, sub) => n + sub.criteria.length, 0) * 5);
    assert.equal(receipt.execution.transport, 'injected_response');
    assert.match(validateSemanticReviewReceipt(receipt, set, options).join('\n'), /実際|실제 채점 사례 실행/);
    let gradingCalled = false;
    await assert.rejects(gradeSemanticReviewReceipt(receipt, set, options, async () => { gradingCalled = true; throw new Error('should not call the grader'); }), /주입 응답으로 수행한 의미검수/);
    assert.equal(gradingCalled, false);
    // Separate manual fixture for testing the grading gate; the injected semantic
    // record itself cannot be upgraded by running only the real grader.
    const manual = completeSemanticReview(prepareSemanticReview(set, options), { units: receipt.units, cases: receipt.cases, notes: receipt.notes }, execution);
    const graded = await offlineGradeReceipt(manual, set, bank);
    assert.equal(graded.grading.transport, 'injected_response');
    assert.match(validateSemanticReviewReceipt(graded, set, options).join('\n'), /주입 응답.*승급 근거/);
    assert.deepEqual(validateReviewGrading(graded.grading, set, receipt.cases, false), []);
    assert.deepEqual(validateSemanticReviewReceipt(syntheticModelReceipt(graded), set, options), []);
    const injectedWithModelGrading = syntheticModelReceipt({ ...graded, execution: receipt.execution });
    assert.match(validateSemanticReviewReceipt(injectedWithModelGrading, set, options).join('\n'), /주입 응답으로 수행한 의미검수/);
    assert.deepEqual(validateRecordedSemanticReview(injectedWithModelGrading, set), [], 'historical replay remains separate from accepting a new review');
    const legacy = syntheticModelReceipt({ ...graded, execution: { ...execution, method: 'model_reasoned', model: options.model } });
    assert.match(validateSemanticReviewReceipt(legacy, set, options).join('\n'), /모델 호출 transport가 기록되지 않은 의미검수/);
    assert.deepEqual(validateRecordedSemanticReview(legacy, set), []);
    const realModelRecord = syntheticModelReceipt({ ...legacy, execution: { ...legacy.execution, transport: 'model' } });
    assert.deepEqual(validateSemanticReviewReceipt(realModelRecord, set, options), []);
});

test('whole-question review retains supplementary criterion evidence and rejects silently omitted provenance', () => {
    const { set, options } = fixture();
    const question = set.subquestions[0];
    const requirementSources = new Set(question.requirements.map(req => req.source_ref_id));
    const supplementary = set.source_refs.find(source => !requirementSources.has(source.id))!;
    assert.ok(supplementary, 'fixture needs a source outside the first question requirements');
    question.criteria[0].source_ref_ids.push(supplementary.id);
    const prepared = prepareSemanticReview(set, options);
    const unit = prepared.units.find(unit => unit.id === `subquestion:${question.id}`)!;
    assert.ok(unit.sources.includes(supplementary.id));
    const input = JSON.parse(buildReviewChunkInput(prepared, unit));
    assert.ok(input.reference_catalog.sources.some((source: { id: string; quote: string }) => source.id === supplementary.id && source.quote === supplementary.source_quote));
    assert.deepEqual(input.target_reference_requirements.required_source_ref_ids, unit.sources);
    const raw = offlineReviewChunk(offlineReviewResult(prepared), unit.id);
    raw.checks.source_support = 'uncertain';
    assert.equal(groundReviewChunk(raw, prepared, unit).units[0].checks.source_support, 'uncertain', 'complete IDs do not imply an approved finding');
    raw.source_ref_ids = raw.source_ref_ids.filter(id => id !== supplementary.id);
    assert.throws(() => groundReviewChunk(raw, prepared, unit));
});

test('historical requirement-only evidence stays readable but cannot satisfy a new union review', async () => {
    const { set, options } = fixture();
    const question = set.subquestions[0];
    const requirementSources = new Set(question.requirements.map(req => req.source_ref_id));
    const extra = set.source_refs.find(source => !requirementSources.has(source.id))!;
    question.criteria[0].source_ref_ids.push(extra.id);
    const prepared = prepareSemanticReview(set, options);
    const current = syntheticModelReceipt(await offlineGradeReceipt(completeSemanticReview(prepared, offlineReviewResult(prepared), execution), set, bank));
    assert.equal(current.execution.source_coverage, 'requirements_and_criteria_v1');
    assert.deepEqual(validateRecordedSemanticReview(current, set), []);
    const incomplete = structuredClone(current);
    incomplete.units.find(unit => unit.id === `subquestion:${question.id}`)!.source_quotes = incomplete.units.find(unit => unit.id === `subquestion:${question.id}`)!.source_quotes.filter(quote => quote.source_ref_id !== extra.id);
    const marked = syntheticModelReceipt(incomplete);
    assert.match(validateRecordedSemanticReview(marked, set).join('\n'), /전체 근거 인용 누락/);
    delete incomplete.execution.source_coverage;
    const historical = syntheticModelReceipt(incomplete);
    const oldBytes = JSON.stringify(historical);
    assert.deepEqual(validateRecordedSemanticReview(historical, set), [], 'only historical reading uses the earlier whole-question contract');
    assert.match(validateSemanticReviewReceipt(historical, set, options).join('\n'), /전체 근거 인용 누락/);
    await assert.rejects(gradeSemanticReviewReceipt(historical, set, options, async () => { throw Error('must not call'); }), /전체 근거 인용 누락/);
    assert.equal(JSON.stringify(historical), oldBytes, 'reading never upgrades historical evidence');
});

test('semantic observers receive snapshots and cannot change a failed review into pass', async () => {
    const { set, options } = fixture();
    const raw = offlineReviewResult(prepareSemanticReview(set, options));
    raw.units[0].checks.source_support = 'fail';
    const receipt = await reviewQuestionDraft(set, { ...options, onChunk(event) {
        const observed = event.response as ReturnType<typeof offlineReviewChunk>;
        observed.checks.source_support = 'pass';
        observed.notes.push('observer-only note');
    } }, async request => ({ status: 'completed', output: [], output_text: JSON.stringify(offlineReviewChunk(raw, JSON.parse(String(request.input)).target_unit)) }) as unknown as Response);
    assert.equal(receipt.verdict, 'fail');
    assert.equal(receipt.units[0].checks.source_support, 'fail');
    assert.ok(!receipt.notes.includes('observer-only note'));
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
            return { status: 'completed', output: [], output_text: JSON.stringify(offlineReviewChunk(raw, JSON.parse(String(request.input)).target_unit)) } as unknown as Response;
        });
        assert.equal(receipt.verdict, status);
        assert.match(validateSemanticReviewReceipt(receipt, set, options).join('\n'), /pass가 아닙니다/);
    }
});

test('split reviews record transient transport and malformed JSON failures and retry the same unit once', async () => {
    for (const failure of ['transport', 'invalid_json', 'empty'] as const) {
        const { set, options } = fixture();
        const prepared = prepareSemanticReview(set, options);
        const raw = offlineReviewResult(prepared);
        const events: Parameters<NonNullable<SemanticReviewOptions['onChunk']>>[0][] = [];
        let calls = 0;
        const receipt = await reviewQuestionDraft(set, { ...options, onChunk: event => events.push(event) }, async request => {
            calls++;
            if (calls === 1) {
                if (failure === 'transport') throw Object.assign(new Error('service unavailable'), { status: 503 });
                return { status: 'completed', output: [], output_text: failure === 'empty' ? '' : '{bad JSON' } as unknown as Response;
            }
            return { status: 'completed', output: [], output_text: JSON.stringify(offlineReviewChunk(raw, JSON.parse(String(request.input)).target_unit)) } as unknown as Response;
        });
        assert.equal(receipt.verdict, 'pass');
        assert.equal(calls, prepared.units.length + 1);
        assert.equal(events[0].error_code, failure);
        if (failure === 'transport') {
            assert.equal(events[0].error_status, 503);
            assert.equal(events[0].error_retryable, true);
        }
        assert.ok(events.every(event => event.transport === 'injected_response'));
        assert.equal(events[0].response, null);
        assert.equal(events[1].unit_id, events[0].unit_id);
        assert.equal(events[1].attempt, 2);
        assert.equal(events[1].error, undefined);
        assert.match(events[0].input_hash, /^[a-f0-9]{64}$/);
        assert.match(events[0].schema_hash, /^[a-f0-9]{64}$/);
    }
});

test('split reviews stop on terminal failures, cap retries and do not retry a failed log observer', async () => {
    for (const failure of ['authentication', 'refusal', 'invalid_json', 'observer', 'configuration'] as const) {
        const { set, options } = fixture();
        const raw = offlineReviewResult(prepareSemanticReview(set, options));
        const events: Parameters<NonNullable<SemanticReviewOptions['onChunk']>>[0][] = [];
        let calls = 0;
        await assert.rejects(reviewQuestionDraft(set, { ...options, ...(failure === 'configuration' ? { model: ' ' } : {}), onChunk(event) {
            events.push(event);
            if (failure === 'observer') throw new Error('checkpoint write failed');
        } }, async request => {
            calls++;
            if (failure === 'authentication') throw Object.assign(new Error('unauthorized'), { status: 401 });
            if (failure === 'refusal') return { status: 'completed', output_text: '', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'cannot comply' }] }] } as unknown as Response;
            return { status: 'completed', output: [], output_text: failure === 'invalid_json' ? '{bad JSON'
                : JSON.stringify(offlineReviewChunk(raw, JSON.parse(String(request.input)).target_unit)) } as unknown as Response;
        }));
        assert.equal(calls, failure === 'configuration' ? 0 : failure === 'invalid_json' ? 2 : 1);
        assert.equal(events.length, failure === 'invalid_json' ? 2 : 1);
        if (failure !== 'observer') assert.ok(events.every(event => event.error));
        if (failure === 'authentication') {
            assert.equal(events[0].error_status, 401);
            assert.equal(events[0].error_retryable, false);
        }
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
        const templateBefore = fs.readFileSync(template);
        const duplicate = run(['--manual-template', '--output', template]);
        assert.notEqual(duplicate.status, 0); assert.match(duplicate.stderr, /검수 출력 파일이 이미 존재/);
        assert.deepEqual(fs.readFileSync(template), templateBefore, 'historical outputs are preserved before any model request or write');
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
        const graded = path.join(dir, 'graded.json');
        assert.notEqual(run(['--review-input', review, '--grade-cases', '--output', graded]).status, 0);
        assert.equal(fs.existsSync(graded), false);
        const failureLog = fs.readFileSync(`${graded}.grading.jsonl`, 'utf8');
        const event = JSON.parse(failureLog.trim());
        assert.equal(event.status, 'failed'); assert.match(event.error, /OPENAI_API_KEY/);
        assert.ok(event.answers && event.expected && event.grader_hash);
        assert.notEqual(run(['--review-input', review, '--grade-cases', '--output', graded]).status, 0);
        assert.equal(fs.readFileSync(`${graded}.grading.jsonl`, 'utf8'), failureLog, 'an existing failure log is not overwritten');
        assert.equal(receipt.grading.status, 'not_run');
        assert.match(validateSemanticReviewReceipt(receipt, set, { ...options, authoringPlan: plan, packet: null }).join('\n'), /실제 채점 사례 실행/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('semantic inputs are bounded without silently dropping bank peers or actual source verification', () => {
    const { set, options } = fixture(); const prepared = prepareSemanticReview(set, options);
    assert.equal(prepared.requestChars, JSON.stringify(prepared.requestContext).length);
    assert.ok(prepared.requestChars < 160000);
    assert.throws(() => prepareSemanticReview(set, { ...options, maxInputChars: 1000 }), /예산 1000자를 초과/);
    const criticalField = prepareSemanticReview(set, options).units[0].fields;
    assert.ok(Object.keys(criticalField).some((key) => key.endsWith('.source_quote')));
    const peer = structuredClone(set);
    peer.id = 'large-bank-peer-preservation';
    const longFact = '비교 문맥 시작 ' + '독립 자료 '.repeat(70000) + ' 비교 문맥 끝';
    peer.shared_context.facts.push({ id: 'long-semantic-context', text: longFact, scoreable: false });
    const expanded = { ...options, bank: [...options.bank, peer] };
    assert.throws(() => prepareSemanticReview(set, { ...expanded, maxInputChars: 200000 }), /예산 200000자를 초과/);
    assert.throws(() => prepareSemanticReview(set, { ...expanded, maxInputChars: 400000 }), /예산 400000자를 초과/);
    const large = prepareSemanticReview(set, { ...expanded, maxInputChars: 500000 });
    assert.ok(large.requestChars > 400000);
    assert.ok(JSON.stringify(large.requestContext).includes(longFact), 'explicit larger budget retains the full peer fact');
    assert.throws(() => prepareSemanticReview(set, { ...expanded, maxInputChars: 500001 }), /1,000~500,000/);
});

test('actual grader case records include empty answers and reject missing, mismatched or forged scoring results', async () => {
    const { set, options } = fixture(); const prepared = prepareSemanticReview(set, options);
    const receipt = completeSemanticReview(prepared, offlineReviewResult(prepared), execution);
    const graded = await offlineGradeReceipt(receipt, set, bank);
    const blank = graded.grading.runs.find((run) => run.id === 'empty-answer')!;
    assert.equal(blank.judgment, null); assert.equal(blank.result.score, 0); assert.ok(blank.matched);
    assert.deepEqual(validateReviewGrading(graded.grading, set, receipt.cases, false), []);
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
        subquestions: set.subquestions.map((sub) => ({ subquestion_id: sub.id, injection_detected: false, injection_evidence_ids: [], salad_detected: false, verdicts: sub.criteria.map((criterion) => ({ criterion_id: criterion.id, verdict: 'not_met', evidence_ids: [], reason: '주입한 의도적 불일치' })) })),
    }) }) as unknown as Response);
    assert.match(validateSemanticReviewReceipt(wrong, set, options).join('\n'), /기대 판정과 다릅니다/);
});

test('condition-boundary cases accept either zero verdict while opposite cases stay contradicted', async () => {
    const { set, options } = fixture(); const prepared = prepareSemanticReview(set, options);
    const raw = offlineReviewResult(prepared);
    for (const sample of raw.cases) if (sample.kind === 'condition_boundary') sample.expected = 'not_met';
    const receipt = completeSemanticReview(prepared, raw, execution);
    // Injects the expected verdicts except for one case kind, which gets `swap` instead.
    const gradeWith = (kind: string, swap: 'met' | 'not_met' | 'contradicted') => gradeSemanticReviewReceipt(receipt, set, { ...options }, async (request) => {
        const payload = JSON.parse(String(request.input).split('<<<GRADING_PAYLOAD_START>>>')[1].split('<<<GRADING_PAYLOAD_END>>>')[0]);
        return { status: 'completed', output: [], output_text: JSON.stringify({ injection_detected: false, salad_detected: false, subquestions: set.subquestions.map((sub) => {
            const answer = payload.subquestions.find((item: { subquestion_id: string }) => item.subquestion_id === sub.id).user_answer;
            return { subquestion_id: sub.id, injection_detected: false, injection_evidence_ids: [], salad_detected: false, verdicts: sub.criteria.map((criterion) => {
                const sample = receipt.cases.find((item) => item.unit_id === `criterion:${sub.id}:${criterion.id}` && item.answer === answer);
                const verdict = sample?.kind === kind ? swap : sample?.expected || 'not_met';
                return { criterion_id: criterion.id, verdict, evidence_ids: verdict === 'not_met' ? [] : [`${sub.id}/e0`], reason: null };
            }) };
        }) }) } as unknown as Response;
    });
    assert.deepEqual(validateSemanticReviewReceipt(syntheticModelReceipt(await gradeWith('condition_boundary', 'contradicted')), set, options), []);
    assert.match(validateSemanticReviewReceipt(await gradeWith('condition_boundary', 'met'), set, options).join('\n'), /기대 판정과 다릅니다/);
    assert.match(validateSemanticReviewReceipt(await gradeWith('opposite', 'not_met'), set, options).join('\n'), /기대 판정과 다릅니다/);
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
    assert.deepEqual(validateSemanticReviewReceipt(syntheticModelReceipt(graded), set, options), []);
    assert.ok(graded.grading.runs.some((run) => run.result.subquestions[0].criteria.some((item) => item.verdict === 'partial')));
});


test('historical grading identity stays preserved while a new acceptance requires the current engine', async () => {
    const { set, options } = fixture();
    const prepared = prepareSemanticReview(set, options);
    const receipt = await offlineGradeReceipt(completeSemanticReview(prepared, offlineReviewResult(prepared), execution), set, bank);
    const historical = { ...receipt.grading, grader_hash: '0'.repeat(64) };
    assert.deepEqual(validateReviewGrading(historical, set, receipt.cases, false), []);
    assert.match(validateReviewGrading(historical, set, receipt.cases, true).join('\n'), /코드 해시가 변경/);
    const forged = structuredClone(historical); forged.runs[0].result.score++;
    assert.match(validateReviewGrading(forged, set, receipt.cases, false).join('\n'), /재현과 다릅니다/);
});

test('normal zero-point cases cannot pass because of a subquestion security false positive', async () => {
    const { set, options } = fixture();
    const receipt = await offlineGradeReceipt(completeSemanticReview(prepareSemanticReview(set, options), offlineReviewResult(prepareSemanticReview(set, options)), execution), set, bank);
    for (const flag of ['injection_detected', 'salad_detected'] as const) {
        const grading = structuredClone(receipt.grading);
        const run = grading.runs.find(run => run.expected.length === 1 && run.expected[0].case_kind === 'omission')!;
        const sub = run.judgment!.subquestions.find(sub => sub.subquestion_id === run.expected[0].subquestion_id)!;
        sub[flag] = true;
        run.result = applyQuestionSetJudgment(set, run.answers, run.judgment!);
        // Historical root flags do not always include local flags.
        assert.equal(run.result.security_flag, 'none');
        assert.equal(run.result.score, 0);
        run.matched = true;
        assert.match(validateReviewGrading(grading, set, receipt.cases, false).join('\n'), /기대 판정과 다릅니다/);
    }
});

test('actual review grading checkpoints completed runs and a later failure without producing a receipt', async () => {
    const { set, options } = fixture();
    const cases = offlineReviewResult(prepareSemanticReview(set, options)).cases.slice(0, 2);
    const events: ReviewGradingEvent[] = [];
    let calls = 0;
    await assert.rejects(executeReviewGrading(set, cases, { apiKey: 'offline-test-key', onRun: event => events.push(event), createResponse: async () => {
        calls++;
        if (calls > 1) throw Object.assign(new Error('unauthorized'), { status: 401 });
        return { status: 'completed', output: [], output_text: JSON.stringify({ subquestions: set.subquestions.map(sub => ({
            subquestion_id: sub.id, injection_detected: false, injection_evidence_ids: [], salad_detected: false,
            verdicts: sub.criteria.map(criterion => ({ criterion_id: criterion.id, verdict: 'not_met', evidence_ids: [], reason: null })),
        })) }) } as unknown as Response;
    } }));
    assert.equal(calls, 2); assert.equal(events.length, 2);
    assert.equal(events[0].status, 'completed'); assert.ok(events[0].result);
    assert.equal(events[1].status, 'failed'); assert.equal(events[1].result, undefined);
    assert.ok(events[1].error); assert.ok(events.every(event => event.trace.length));
    assert.ok(events.every(event => event.transport === 'injected_response'));
});

test('grading observers cannot mutate stored answers, judgments or scores', async () => {
    const { set, options } = fixture();
    const cases = offlineReviewResult(prepareSemanticReview(set, options)).cases.slice(0, 1);
    const grading = await executeReviewGrading(set, cases, { apiKey: 'offline-test-key', onRun(event) {
        event.answers[set.subquestions[0].id] = 'observer-only replacement';
        event.expected.length = 0;
        if (event.result) event.result.score = 999;
        if (event.judgment) event.judgment.subquestions.length = 0;
    }, createResponse: async () => ({ status: 'completed', output: [], output_text: JSON.stringify({ subquestions: set.subquestions.map(sub => ({
        subquestion_id: sub.id, injection_detected: false, injection_evidence_ids: [], salad_detected: false,
        verdicts: sub.criteria.map(criterion => ({ criterion_id: criterion.id, verdict: 'not_met', evidence_ids: [], reason: null })),
    })) }) }) as unknown as Response });
    assert.equal(grading.runs[0].answers[set.subquestions[0].id], cases[0].answer);
    assert.ok(grading.runs[0].expected.length > 0);
    assert.equal(grading.runs[0].result.score, 0);
    assert.equal(grading.runs[0].judgment!.subquestions.length, set.subquestions.length);
    assert.equal(grading.runs[1].answers[set.subquestions[0].id], '');
});
