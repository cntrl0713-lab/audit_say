import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Ajv from 'ajv';
import type { Response, ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses';
import { enforceTrustedMetadata, generateTopic, main, prepareGenerationPacket, sourceFingerprint } from '../cpa_uploader/generate_cpa_v3.ts';
import { allocateQuestionSetId, draftConflicts, readPendingDrafts, readQuestionBank } from '../cpa_uploader/questionDraftInventory.ts';
import { authoringPlanHash, createQuestionAuthoringPlan } from '../cpa_uploader/questionAuthoringPlan.ts';
import { buildSourceCatalog } from '../cpa_uploader/questionSourceCatalog.mjs';
import type { QuestionSetV3, SourceRefV3 } from '../lib/questionV3.ts';

const guideNames = ['question-design.md', 'question-output-schema.md', 'llm-question-generation-prompt.md', 'question-generation-workflow.md', 'source-authoring-design.md'];
const catalog = buildSourceCatalog();
function temporary(context: TestContext) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cpa-generation-'));
    context.after(() => { assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir())); assert.ok(path.basename(root).startsWith('cpa-generation-')); fs.rmSync(root, { recursive: true, force: true }); });
    return root;
}
function offlineKey(context: TestContext) {
    const previous = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'offline-injected-response-only';
    context.after(() => { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; });
}
// Transport fixtures remain needs_review; these are not approved audit questions.
function readyPlan(topic = '04') {
    const unit = catalog.units.find(unit => unit.topicIds.includes(topic) && unit.kind === 'standard' && unit.paragraph && unit.dependencies.length === 0 && unit.quote.length > 60);
    assert.ok(unit, 'Bounded source fixture for ' + topic);
    const plan = createQuestionAuthoringPlan(topic, [unit.id]);
    Object.assign(plan, { status: 'ready', objective: '원문 명제를 전달하는 오프라인 계약 검사',
        scope: { actors: ['선택 문단의 주체'], timing: ['선택 문단의 시점'], conditions: ['선택 문단의 조건'], exceptions: ['선택 문단의 예외'], required_answers: ['제공한 원문 명제'], exclusions: ['추가 기준이나 수치'] },
        existing_question_difference: '실제 출제 승인용이 아닌 입력·응답 계약 테스트', edition_assumption: '저장된 전사 자료로 검사하며 시험 판본 확정으로 간주하지 않음', unresolved_items: [] });
    return plan;
}
function generatedResponse(params: ResponseCreateParamsNonStreaming) {
    const input = params.input as string;
    const source = (JSON.parse(input.split('[SOURCE_BUNDLE]\n')[1].split('\n\n[출력]')[0]) as SourceRefV3[])[0];
    const id = input.match(/id는 ([\w-]+)로 한다/u)![1];
    const topic = input.match(/classification\.topic_id는 (\d{2})로 한다/u)![1];
    const locators = JSON.parse(input.split('[SOURCE_LOCATORS]\n')[1].split('\n\n[SOURCE_BUNDLE]')[0]) as Record<string, string>;
    return { schema_version: '3.0', id, type: 'linked_question_set', status: 'needs_review', title: '출제 전송 계약 오프라인 검증',
        classification: { topic_id: topic, part: 'PART1', chapter: '검증', domain: 'audit', standards: source.page?.startsWith('KGA ') ? [source.page] : [], tags: [] },
        source_refs: [{ ...source, title: source.title ?? null, page: source.page ?? null, content_hash: source.content_hash ?? null }], shared_context: { facts: [] }, learning_order: ['q1', 'q2'],
        subquestions: ['q1', 'q2'].map(qid => ({ id: qid, type: 'descriptive', prompt: `${id}/${qid} 제공된 기준서의 요구사항을 서술하시오.`,
            constraints: { ordered: false, max_entries: null as number | null, overflow_policy: 'none' }, selection: { type: 'all', n: null as number | null }, model_answer: [source.source_quote],
            requirements: [{ id: `${qid}.req1`, source_ref_id: source.id, source_quote: source.source_quote, source_span: locators[source.id] }],
            criteria: [{ id: `${qid}.c1`, requirement_id: `${qid}.req1`, claim: source.source_quote, critical_facts: [{ id: 'action', type: 'action', expected: source.source_quote }], max_points: 1, scores: { met: 1, partial: null, not_met: 0, contradicted: 0 }, source_ref_ids: [source.id] }] })),
        verification: { source_fidelity: 'exact', review_status: 'needs_human_review', calculation_required: false, notes: [] as string[] } };
}
const completed = (value: unknown) => ({ status: 'completed', output: [], output_text: JSON.stringify(value) }) as unknown as Response;

test('generation requires a ready plan before API access', async context => {
    const argv = process.argv; context.after(() => { process.argv = argv; }); process.argv = argv.slice(0, 2);
    await assert.rejects(() => main(), /--plan/u);
    const plan = readyPlan(); plan.status = 'draft'; let calls = 0;
    await assert.rejects(() => generateTopic('04', async () => { calls++; throw new Error('Unexpected API'); }, [], plan), /미완성/u);
    assert.equal(calls, 0);
});

test('generation includes five guides, bounded plan and source context with strict answer policy', async context => {
    offlineKey(context); const plan = readyPlan(); let calls = 0;
    const draft = await generateTopic('04', async params => {
        calls++; const input = params.input as string;
        for (const name of guideNames) assert.ok(input.includes(`[WIKI_GUIDE: ${name}]`));
        assert.ok(input.includes('[WIKI_GUIDE: topics/topic-04-design.md]')); assert.ok(!input.includes('[WIKI_GUIDE: topics/topic-05-design.md]'));
        assert.ok(input.includes(plan.objective)); assert.ok(input.includes('SOURCE_CONTEXT')); assert.ok(!input.includes('{{concept_page}}'));
        const format = params.text?.format; if (format?.type !== 'json_schema') throw new Error('Missing schema');
        const validate = new Ajv({ allErrors: true }).compile(format.schema); const valid = generatedResponse(params);
        assert.equal(validate(valid), true, JSON.stringify(validate.errors));
        for (const policy of [{ selection: { type: 'best_n', n: 1 } }, { selection: { type: 'at_least_n', n: 1 } }, { selection: { type: 'all', n: 1 } },
            { constraints: { ordered: true, max_entries: null, overflow_policy: 'none' } }, { constraints: { ordered: false, max_entries: 1, overflow_policy: 'none' } }, { constraints: { ordered: false, max_entries: null, overflow_policy: 'ignore_after_limit' } }]) {
            const invalid = structuredClone(valid); Object.assign(invalid.subquestions[0], policy); assert.equal(validate(invalid), false, JSON.stringify(policy));
        }
        valid.verification.notes.push('독립 의미 검토가 아직 필요함'); return completed(valid);
    }, [], plan);
    assert.equal(calls, 1); assert.equal(draft.status, 'needs_review'); assert.equal(draft.verification.review_status, 'needs_human_review');
    assert.ok(draft.verification.notes.includes('독립 의미 검토가 아직 필요함')); assert.ok(draft.verification.notes.includes('출제 계획 해시: ' + authoringPlanHash(plan))); assert.equal(draft.subquestions[0].criteria[0].scores.partial, undefined);
});

test('retired policy and existing bank prompt require replacement responses', async context => {
    offlineKey(context); let calls = 0;
    const draft = await generateTopic('04', async params => { calls++; const raw = generatedResponse(params);
        if (calls === 1) raw.subquestions[0].selection = { type: 'best_n', n: 1 };
        if (calls === 2) raw.subquestions[0].prompt = readQuestionBank()[0].subquestions[0].prompt;
        if (calls > 1) assert.ok((params.input as string).includes('[이전 결과의 검증 오류')); return completed(raw);
    }, [], readyPlan());
    assert.equal(calls, 3); assert.deepEqual(draftConflicts([draft], readQuestionBank()), []);
});

test('invented evidence locations and unsupported review signals are rejected without correction', async context => {
    offlineKey(context); const plan = readyPlan(); const packet = prepareGenerationPacket(plan); let fixture: ReturnType<typeof generatedResponse> | undefined;
    await generateTopic('04', async params => { fixture = generatedResponse(params); return completed(fixture); }, [], plan); assert.ok(fixture);
    const mutations: Array<(value: NonNullable<typeof fixture>) => void> = [
        v => { v.status = 'published'; }, v => { v.verification.review_status = 'verified'; }, v => { v.verification.source_fidelity = 'reconstructed'; }, v => { v.verification.calculation_required = true; },
        v => { (v.verification as unknown as Record<string, unknown>).notes = [null]; }, v => { v.source_refs[0].source_quote = '출처에 없는 인용'; }, v => { v.source_refs[0].file = '../wrong.txt'; },
        v => { v.subquestions[0].requirements[0].source_span = 'L999999; 가짜 문단'; }, v => { v.subquestions[0].requirements[0].source_quote = '조건을 생략한 인용'; }, v => { v.subquestions[0].criteria[0].source_ref_ids = ['unknown']; }];
    for (const mutate of mutations) { const raw: ReturnType<typeof generatedResponse> = structuredClone(fixture); mutate(raw); const before: string = JSON.stringify(raw); assert.throws(() => enforceTrustedMetadata(raw, '04', packet.sourceRefs, fixture!.id, plan)); assert.equal(JSON.stringify(raw), before); }
});

test('19 topics accept explicit bounded source plans and return distinct review-pending fixtures', async context => {
    offlineKey(context); const batch: QuestionSetV3[] = [];
    for (let index = 1; index <= 19; index++) { const topic = String(index).padStart(2, '0'); batch.push(await generateTopic(topic, async params => completed(generatedResponse(params)), batch, readyPlan(topic))); }
    assert.equal(new Set(batch.map(set => set.id)).size, 19); assert.ok(batch.every(set => set.status === 'needs_review')); assert.deepEqual(draftConflicts(batch, readQuestionBank()), []);
});

test('unresolved source dependencies stop generation before API access', async () => {
    const unit = catalog.units.find(unit => unit.topicIds.includes('01') && unit.dependencies.some(ref => !ref.targetId)); assert.ok(unit);
    const plan = readyPlan('01'); plan.source_unit_ids = [unit.id]; let calls = 0;
    await assert.rejects(() => generateTopic('01', async () => { calls++; throw new Error('Unexpected API'); }, [], plan), /문맥이 미완성|예산/u); assert.equal(calls, 0);
});

test('fingerprint tracks raw source changes and plan/topic guide changes', context => {
    const root = temporary(context);
    for (const file of [...catalog.sources.map(source => source.file), catalog.registry.topic19.metadataFile, 'cpa_uploader/data/회계감사_통합학습자료/00_통합_목차.md', 'cpa_uploader/config/question-source-registry.json', 'cpa_uploader/generate_cpa_v3.ts', 'cpa_uploader/questionAuthoringPlan.ts', 'cpa_uploader/questionSourceCatalog.mjs', 'cpa_uploader/questionDraftInventory.ts', 'lib/questionV3.ts', 'cpa_uploader/data/cpa_question_sets_v3.authoring.json']) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.copyFileSync(file, path.join(root, file)); }
    fs.mkdirSync(path.join(root, 'cpa_uploader/wiki/concepts'), { recursive: true }); fs.mkdirSync(path.join(root, 'cpa_uploader/wiki/question-generation/topics'), { recursive: true });
    for (const name of guideNames) fs.writeFileSync(path.join(root, 'cpa_uploader/wiki/question-generation', name), '# current rules');
    let previous = sourceFingerprint(root); assert.equal(sourceFingerprint(root), previous);
    for (const file of ['cpa_uploader/wiki/question-generation/source-authoring-design.md', 'cpa_uploader/wiki/question-generation/topics/topic-04-design.md', 'cpa_uploader/questionAuthoringPlan.ts', catalog.sources.find(source => source.kind === 'past_exam')!.file]) { fs.appendFileSync(path.join(root, file), '\nChanged source or contract\n'); const current = sourceFingerprint(root); assert.notEqual(current, previous, file); previous = current; }
});

test('draft inventory skips typed sidecars and reserves pending and checkpoint IDs', context => {
    const root = temporary(context); const data = path.join(root, 'cpa_uploader/data'); fs.mkdirSync(data, { recursive: true });
    const bank = readQuestionBank(); const reserved = { ...structuredClone(bank[0]), id: 'pilot-01-099' };
    fs.writeFileSync(path.join(data, 'plan.draft.json'), JSON.stringify(readyPlan()));
    for (const [name, value] of Object.entries({ 'unpublished.json': [reserved], 'draft.checkpoint.json': { sets: [{ ...reserved, id: 'pilot-02-099' }] }, 'draft.authoring-plan.json': { artifact_type: 'question_authoring_plan', version: 1, plans: [readyPlan()] }, 'draft.source-packet.json': { artifact_type: 'question_source_packet', version: 1, packets: [] }, 'draft.review.json': { schema_version: '1.0', reviews: [] } })) fs.writeFileSync(path.join(data, name), JSON.stringify(value));
    const pending = readPendingDrafts(root); assert.equal(pending.length, 2); const ids = new Set([...bank, ...pending].map(set => set.id));
    assert.equal(allocateQuestionSetId('01', ids), 'pilot-01-100'); assert.equal(allocateQuestionSetId('02', ids), 'pilot-02-100');
    assert.ok(draftConflicts([bank[0]], bank).some(error => error.includes('세트 id'))); const duplicate = structuredClone(bank[0]); duplicate.id = 'new-test-id'; duplicate.subquestions[0].prompt = ` ${duplicate.subquestions[0].prompt.replace(/ /gu, '\n')} `; assert.ok(draftConflicts([duplicate], bank).some(error => error.includes('발문')));
});

test('offline CLI saves bound sidecars and refuses to overwrite an existing draft', async context => {
    offlineKey(context); const root = temporary(context); const plan = readyPlan(); const planFile = path.join(root, 'plan.json'); const output = path.join(root, 'output.draft.json'); fs.writeFileSync(planFile, JSON.stringify(plan));
    const argv = process.argv; context.after(() => { process.argv = argv; }); process.argv = [...argv.slice(0, 2), '--plan', planFile, '--output', output];
    await main(async params => completed(generatedResponse(params)));
    const sets = JSON.parse(fs.readFileSync(output, 'utf8')) as QuestionSetV3[]; const plans = JSON.parse(fs.readFileSync(output + '.authoring-plan.json', 'utf8')); const packets = JSON.parse(fs.readFileSync(output + '.source-packet.json', 'utf8'));
    assert.equal(sets.length, 1); assert.equal(plans.plans[0].set_id, sets[0].id); assert.equal(authoringPlanHash(plans.plans[0]), authoringPlanHash(plan)); assert.equal(packets.packets[0].plan_hash, authoringPlanHash(plan)); assert.equal(packets.packets[0].set_id, sets[0].id); assert.equal(fs.existsSync(output + '.checkpoint.json'), false);
    const original = fs.readFileSync(output, 'utf8'); await assert.rejects(() => main(async () => { throw new Error('Unexpected API'); }), /이미 존재/u); assert.equal(fs.readFileSync(output, 'utf8'), original);
});

test('checkpoint resume rejects bank ID despite matching plan and source hashes', async context => {
    const root = temporary(context); const plan = readyPlan('01'); const set = structuredClone(readQuestionBank()[0]); set.verification.notes.push('출제 계획 해시: ' + authoringPlanHash(plan));
    const output = path.join(root, 'output.draft.json'); const planFile = path.join(root, 'plan.json'); const checkpoint = output + '.checkpoint.json'; fs.writeFileSync(planFile, JSON.stringify(plan));
    const original = JSON.stringify({ schema_version: '3.0', model: process.env.CPA_GENERATION_MODEL || 'gpt-5.6-luna', source_fingerprint: sourceFingerprint(), plan_hashes: [authoringPlanHash(plan)], sets: [set] }); fs.writeFileSync(checkpoint, original);
    const argv = process.argv; context.after(() => { process.argv = argv; }); process.argv = [...argv.slice(0, 2), '--plan', planFile, '--output', output];
    await assert.rejects(() => main(async () => { throw new Error('Unexpected API'); }), /체크포인트 복원 검증 실패[\s\S]*세트 id/u); assert.equal(fs.existsSync(output), false); assert.equal(fs.readFileSync(checkpoint, 'utf8'), original);
});

test('checkpoint resume rechecks strict source locations and plan types', async context => {
    offlineKey(context); const root = temporary(context); const plan = readyPlan();
    const set = await generateTopic('04', async params => completed(generatedResponse(params)), [], plan);
    const output = path.join(root, 'output.draft.json'); const planFile = path.join(root, 'plan.json'); const checkpoint = output + '.checkpoint.json';
    fs.writeFileSync(planFile, JSON.stringify(plan));
    const argv = process.argv; context.after(() => { process.argv = argv; }); process.argv = [...argv.slice(0, 2), '--plan', planFile, '--output', output];
    for (const mutate of [(value: QuestionSetV3) => { value.subquestions[0].requirements[0].source_span = 'L99999; 잘못된 위치'; },
        (value: QuestionSetV3) => { value.subquestions[0].type = 'enumeration'; }]) {
        const changed = structuredClone(set); mutate(changed);
        fs.writeFileSync(checkpoint, JSON.stringify({ schema_version: '3.0', model: process.env.CPA_GENERATION_MODEL || 'gpt-5.6-luna', source_fingerprint: sourceFingerprint(), plan_hashes: [authoringPlanHash(plan)], sets: [changed] }));
        await assert.rejects(() => main(async () => { throw new Error('Unexpected API'); }), /source_span|물음 유형/u);
        assert.equal(fs.existsSync(output), false);
    }
});

test('practice adaptation reads the selected actual question page and plan preparation stays draft', async context => {
    offlineKey(context); const root = temporary(context);
    const unit = catalog.units.find(unit => unit.kind === 'past_exam' && unit.topicIds.includes('13') && unit.quote.length > 150); assert.ok(unit);
    const plan = readyPlan('13'); plan.mode = 'adapt_existing_question'; plan.source_unit_ids = [unit.id];
    const packet = prepareGenerationPacket(plan); assert.ok(packet.primary.some(source => source.id === unit.id && source.quote === unit.quote));
    await generateTopic('13', async params => { assert.ok((params.input as string).includes('adapt_existing_question')); return completed(generatedResponse(params)); }, [], plan);
    const argv = process.argv; context.after(() => { process.argv = argv; });
    const target = path.join(root, 'plan.json'); process.argv = [...argv.slice(0, 2), '--prepare-plan', target, '--topic', '13', '--mode', 'adapt_existing_question', '--source', unit.id];
    await main(); const prepared = JSON.parse(fs.readFileSync(target, 'utf8')); assert.equal(prepared.status, 'draft'); assert.deepEqual(prepared.source_unit_ids, [unit.id]);
    assert.equal(prepared.mode, 'adapt_existing_question'); await assert.rejects(() => main(), /EEXIST/u);
});
