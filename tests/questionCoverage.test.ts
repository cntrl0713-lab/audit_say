import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assembleCoverage, bankFile, buildCoverage, coverageDirectory, elementFile, questionHash, renderCoverage, sha, sourceUnitHash } from '../cpa_uploader/analysis/coverage/build-coverage.mjs';
import type { SourceCatalog, SourceUnit } from '../cpa_uploader/questionSourceCatalog.mjs';

const sourceFile = 'cpa_uploader/data/회계감사_통합학습자료/01_감사기준/sample.md';
const quote = '감사인은 서비스조직이 제공하는 서비스의 성격과 이용자기업 내부통제에 미치는 영향을 충분히 이해하여야 한다.';
const hashObject = (value: unknown) => sha(JSON.stringify(value));

function fixture() {
    const element = {
        id: 'service-understanding', label: '서비스조직의 용역 활용 이해', topic_id: '13', catalog_status: 'extracted',
        exam_frequency: 0 as number | null, mock_frequency: 0 as number | null, exam_years: [] as number[],
        exam_questions: [] as string[], mock_questions: [] as string[],
    };
    const unit: SourceUnit = {
        id: 'source-unit-402-9', kind: 'standard', standard: 'KGA 402', paragraph: '9', topicIds: ['13'],
        title: '서비스조직의 이용', context: { section: '요구사항', sectionId: 'requirements' }, authority: 'official_transcription', edition: '2026',
        file: sourceFile, startLine: 4, endLine: 4, quote, contentHash: sha(quote), warnings: [],
        sourceId: 'source-402', page: null, locator: 'KGA 402.9', dependencies: [], provenance: '공식 본문 전사',
    };
    const catalog: SourceCatalog = {
        version: 'source-catalog-context-v1', fingerprint: 'catalog-v1', units: [unit],
        topics: [{ id: '13', title: '타인의 업무 활용', keywords: [] }], sources: [], tocLinks: [], warnings: [],
        registry: { version: 1, editionPolicy: '확인된 판본', topics: [], coherenceGroups: [], topic19: { file: '', metadataFile: '', sections: [] } },
    };
    const set = {
        id: 'pilot-13-001', title: '서비스조직 이해', status: 'needs_review', verification: { review_status: 'needs_human_review' },
        classification: { topic_id: '13', standards: ['KGA 402'] }, shared_context: { facts: [{ id: 'fact1', text: '서비스를 이용하고 있다.' }] },
        source_refs: [{ id: 'ref1', file: sourceFile, title: 'KGA 402.9', source_quote: quote }],
        subquestions: [{ id: 'sub1', prompt: '감사인이 이해해야 할 사항을 설명하시오.', model_answer: [quote], criteria: [
            { id: 'crit1', claim: '서비스의 성격을 이해한다.', source_ref_ids: ['ref1'] },
            { id: 'crit2', claim: '내부통제에 미치는 영향을 이해한다.', source_ref_ids: ['ref1'] },
        ] }],
    };
    return {
        dataset: { version: 1, elements: [element], topics: [{ topic_id: '13', name: '타인의 업무 활용' }] },
        bank: [set], catalog,
        overlay: { version: 1, links: [] },
        inputs: { bank: { file: bankFile, sha256: 'bank-hash' }, elements: { file: elementFile, sha256: 'element-hash' },
            overlay: { file: `${coverageDirectory}/links.json`, sha256: 'overlay-hash' }, source_catalog_fingerprint: 'catalog-v1' },
        gaps: [{ standard: 'KGA 402', score: 0, tier: '공백', name: '이해사항' }],
    };
}

function mappedFixture(relationship = 'direct') {
    const input = fixture();
    const link = {
        id: 'link-1', element_id: input.dataset.elements[0].id, source_unit_ids: [input.catalog.units[0].id],
        target: { set_id: input.bank[0].id, subquestion_id: 'sub1', criterion_ids: ['crit1', 'crit2'] },
        relationship, review_status: 'reviewed', reason: '원발문·원문·물음의 요구 범위를 직접 대조했다.',
        snapshot: { element_sha256: hashObject(input.dataset.elements[0]), question_sha256: questionHash(input.bank[0], input.bank[0].subquestions[0]),
            source_hashes: { [input.catalog.units[0].id]: input.catalog.units[0].contentHash },
            source_metadata_hashes: { [input.catalog.units[0].id]: sourceUnitHash(input.catalog.units[0]) } },
    };
    return { ...input, overlay: { version: 1, links: [link] } };
}

test('citation overlap and text similarity remain evidence candidates without semantic coverage', () => {
    const registry = assembleCoverage(fixture());
    assert.equal(registry.citations.length, 2);
    assert.ok(registry.citations.every(citation => citation.kind === 'citation_overlap' && citation.semantic_status === 'not_assessed'));
    assert.equal(registry.elements[0].mapping_status, 'unmapped_not_absence');
    assert.equal(registry.topics.find(topic => topic.id === '13')?.reviewed_direct_elements, 0);
    assert.equal(registry.gap_candidates[0].assessment, 'text_similarity_candidate_only');
    assert.match(registry.policy, /미출제 확정이 아니다/u);
    const input = fixture();
    input.catalog.units[0].quote = '다른 내용';
    const unmatched = assembleCoverage(input);
    assert.equal(unmatched.citations.length, 0);
    assert.equal(unmatched.unmatched_citations.length, 2);
    assert.ok(unmatched.unmatched_citations.every(citation => citation.reason.includes('미출제 판정 아님')));
    assert.equal(unmatched.elements[0].mapping_status, 'unmapped_not_absence');
});

test('zero frequency is preserved separately from unknown frequency and never becomes an absence verdict', () => {
    const input = fixture();
    input.dataset.elements.push({ ...input.dataset.elements[0], id: 'unresolved-frequency', label: '빈도 미확인 요구', exam_frequency: null, mock_frequency: null });
    const registry = assembleCoverage(input);
    assert.equal(registry.elements[0].exam_frequency, 0);
    assert.equal(registry.elements[0].mock_frequency, 0);
    assert.equal(registry.elements[1].exam_frequency, null);
    assert.equal(registry.elements[1].mock_frequency, null);
    assert.ok(registry.elements.every((element: { mapping_status: string }) => element.mapping_status === 'unmapped_not_absence'));
    const markdown = renderCoverage(registry).get(`${coverageDirectory}/topics/13.md`)!;
    assert.match(markdown, /service-understanding \| 서비스조직의 용역 활용 이해 \| 0 \| 0 \|/u);
    assert.ok(markdown.includes('unresolved-frequency | 빈도 미확인 요구 | 미확인 | 미확인 |'));
});

test('only a current reviewed direct relation with a target confirms semantic coverage', () => {
    const direct = assembleCoverage(mappedFixture());
    assert.equal(direct.links[0].confirms_semantic_coverage, true);
    assert.equal(direct.elements[0].mapping_status, 'reviewed_direct_link');
    for (const relationship of ['partial', 'broader', 'adjacent', 'excluded']) {
        const registry = assembleCoverage(mappedFixture(relationship));
        assert.equal(registry.links[0].confirms_semantic_coverage, false, relationship);
        assert.equal(registry.topics.find(topic => topic.id === '13')?.reviewed_direct_elements, 0, relationship);
        assert.notEqual(registry.elements[0].mapping_status, 'reviewed_direct_link', relationship);
    }
    const pending = mappedFixture();
    pending.overlay.links[0].review_status = 'needs_review';
    assert.equal(assembleCoverage(pending).links[0].confirms_semantic_coverage, false);
    const withoutTarget = mappedFixture();
    const registry = assembleCoverage({ ...withoutTarget, overlay: { version: 1, links: [{ ...withoutTarget.overlay.links[0], target: null }] } });
    assert.equal(registry.links[0].confirms_semantic_coverage, false);
});

test('element, question, context and source-unit changes return reviewed mappings to needs_review', () => {
    const mutations = [
        { input: 'element', change: (value: ReturnType<typeof mappedFixture>) => { value.dataset.elements[0].label += ' 변경'; } },
        { input: 'question', change: (value: ReturnType<typeof mappedFixture>) => { value.bank[0].subquestions[0].criteria[0].claim += ' 추가 조건'; } },
        { input: 'question', change: (value: ReturnType<typeof mappedFixture>) => { value.bank[0].shared_context.facts[0].text += ' 새 사실'; } },
        { input: 'question', change: (value: ReturnType<typeof mappedFixture>) => { value.bank[0].source_refs[0].source_quote += ' 추가 문단'; } },
        { input: 'source-unit-402-9', change: (value: ReturnType<typeof mappedFixture>) => { value.catalog.units[0].contentHash = sha('changed source unit'); } },
    ];
    for (const mutation of mutations) {
        const input = mappedFixture();
        mutation.change(input);
        const registry = assembleCoverage(input);
        assert.equal(registry.links[0].review_status, 'reviewed');
        assert.equal(registry.links[0].effective_review_status, 'needs_review');
        assert.equal(registry.links[0].freshness, 'stale');
        assert.ok(registry.links[0].changed_inputs.includes(mutation.input));
        assert.equal(registry.links[0].confirms_semantic_coverage, false);
        assert.equal(registry.elements[0].mapping_status, 'mapping_needs_review');
        assert.equal(registry.review_queue.length, 1);
    }
});

test('current bank lifecycle status is displayed without invalidating unchanged semantic mapping content', () => {
    const input = mappedFixture();
    const oldHash = questionHash(input.bank[0], input.bank[0].subquestions[0]);
    input.bank[0].status = 'published';
    input.bank[0].verification.review_status = 'verified';
    const registry = assembleCoverage(input);
    assert.equal(questionHash(input.bank[0], input.bank[0].subquestions[0]), oldHash);
    assert.equal(registry.links[0].freshness, 'current');
    assert.equal(registry.links[0].target?.bank_status, 'published');
    assert.equal(registry.links[0].target?.verification_status, 'verified');
    assert.equal(registry.questions[0].bank_status, 'published');
    assert.equal(registry.questions[0].verification_status, 'verified');
    assert.equal(registry.topics.find(topic => topic.id === '13')?.needs_review_sets, 0);
    assert.equal(registry.topics.find(topic => topic.id === '13')?.published_sets, 1);
    assert.match(registry.scope, /운영 DB 배포 현황이 아님/u);
});

test('source edition, authority and provenance changes invalidate reviewed mappings even when quotation bytes stay equal', () => {
    const mutations = [
        (unit: SourceUnit) => { unit.edition = '2027 revised'; },
        (unit: SourceUnit) => { unit.authority = 'learning_material'; },
        (unit: SourceUnit) => { unit.provenance = '다른 판본에서 가져온 전사'; },
        (unit: SourceUnit) => { unit.context.section = '적용자료'; },
    ];
    for (const change of mutations) {
        const input = mappedFixture();
        const originalContentHash = input.catalog.units[0].contentHash;
        change(input.catalog.units[0]);
        assert.equal(input.catalog.units[0].contentHash, originalContentHash);
        const registry = assembleCoverage(input);
        assert.equal(registry.links[0].effective_review_status, 'needs_review');
        assert.deepEqual(registry.links[0].changed_inputs, ['source-unit-402-9:metadata']);
        assert.equal(registry.links[0].confirms_semantic_coverage, false);
    }
    const legacy = mappedFixture();
    legacy.overlay.links[0].snapshot.source_metadata_hashes = {};
    assert.equal(assembleCoverage(legacy).links[0].effective_review_status, 'needs_review');
});

test('a reviewed draft mapping resolves its file and ID separately without becoming current bank coverage', () => {
    const input = mappedFixture();
    const file = 'cpa_uploader/drafts/fixture/per-set/pilot-13-001.json';
    const draft = structuredClone(input.bank[0]);
    draft.subquestions[0].prompt += ' 추가 초안 요구';
    const link = { ...input.overlay.links[0], target: { ...input.overlay.links[0].target, scope: 'draft', file },
        snapshot: { ...input.overlay.links[0].snapshot, question_sha256: questionHash(draft, draft.subquestions[0]) } };
    const prepared = { ...input, overlay: { version: 1, links: [link] }, drafts: [{ file, set: draft }] };
    const registry = assembleCoverage(prepared);
    assert.equal(registry.links[0].freshness, 'current');
    assert.equal(registry.links[0].target?.scope, 'draft');
    assert.equal(registry.links[0].target?.bank_status, null);
    assert.equal(registry.links[0].target?.draft_status, 'needs_review');
    assert.equal(registry.links[0].confirms_semantic_coverage, false);
    assert.equal(registry.elements[0].mapping_status, 'mapping_needs_review');
    assert.equal(registry.summary.sets, 1);
    assert.equal(registry.questions[0].prompt, input.bank[0].subquestions[0].prompt);
    const withoutBank = assembleCoverage({ ...prepared, bank: [] });
    assert.equal(withoutBank.summary.sets, 0);
    assert.equal(withoutBank.questions.length, 0);
    assert.equal(withoutBank.links[0].target?.scope, 'draft');
    assert.throws(() => assembleCoverage({ ...prepared, drafts: [] }), /없는 물음/u);
    assert.throws(() => assembleCoverage({ ...prepared, drafts: [{ file: file + '.wrong', set: draft }] }), /없는 물음/u);
    assert.throws(() => assembleCoverage({ ...prepared, drafts: [{ file, set: { ...draft, id: 'another-id' } }] }), /없는 물음/u);
    assert.equal(assembleCoverage({ ...prepared, drafts: [...prepared.drafts, { file: file + '.other', set: draft }] }).links[0].freshness, 'current');
    assert.throws(() => assembleCoverage({ ...prepared, drafts: [...prepared.drafts, { file, set: structuredClone(draft) }] }), /중복/u);
    const duplicateQuestion = structuredClone(draft);
    duplicateQuestion.subquestions.push(structuredClone(duplicateQuestion.subquestions[0]));
    assert.throws(() => assembleCoverage({ ...prepared, drafts: [{ file, set: duplicateQuestion }] }), /물음 ID 중복/u);
    const duplicateCriterion = structuredClone(draft);
    duplicateCriterion.subquestions[0].criteria.push(structuredClone(duplicateCriterion.subquestions[0].criteria[0]));
    assert.throws(() => assembleCoverage({ ...prepared, drafts: [{ file, set: duplicateCriterion }] }), /criterion ID 중복/u);
});

test('unknown element, source, set, subquestion, criterion and duplicate link IDs fail loudly', () => {
    const mutations = [
        { error: /없는 요소 ID/u, change: (value: ReturnType<typeof mappedFixture>) => { value.overlay.links[0].element_id = 'missing'; } },
        { error: /없는 원자료 단위/u, change: (value: ReturnType<typeof mappedFixture>) => { value.overlay.links[0].source_unit_ids = ['missing']; } },
        { error: /없는 물음/u, change: (value: ReturnType<typeof mappedFixture>) => { value.overlay.links[0].target.set_id = 'missing'; } },
        { error: /없는 물음/u, change: (value: ReturnType<typeof mappedFixture>) => { value.overlay.links[0].target.subquestion_id = 'missing'; } },
        { error: /없는 criterion/u, change: (value: ReturnType<typeof mappedFixture>) => { value.overlay.links[0].target.criterion_ids = ['missing']; } },
        { error: /대상 criterion/u, change: (value: ReturnType<typeof mappedFixture>) => { value.overlay.links[0].target.criterion_ids = []; } },
        { error: /연결 ID 없음\/중복/u, change: (value: ReturnType<typeof mappedFixture>) => { value.overlay.links.push(structuredClone(value.overlay.links[0])); } },
        { error: /문제은행 ID 중복/u, change: (value: ReturnType<typeof mappedFixture>) => { value.bank.push(structuredClone(value.bank[0])); } },
        { error: /요소 ID 중복/u, change: (value: ReturnType<typeof mappedFixture>) => { value.dataset.elements.push(structuredClone(value.dataset.elements[0])); } },
        { error: /원자료 단위 ID 중복/u, change: (value: ReturnType<typeof mappedFixture>) => { value.catalog.units.push(structuredClone(value.catalog.units[0])); } },
        { error: /물음 ID 중복/u, change: (value: ReturnType<typeof mappedFixture>) => { value.bank[0].subquestions.push(structuredClone(value.bank[0].subquestions[0])); } },
        { error: /criterion ID 중복/u, change: (value: ReturnType<typeof mappedFixture>) => { value.bank[0].subquestions[0].criteria.push(structuredClone(value.bank[0].subquestions[0].criteria[0])); } },
    ];
    for (const mutation of mutations) {
        const input = mappedFixture();
        mutation.change(input);
        assert.throws(() => assembleCoverage(input), mutation.error);
    }
    const missingReference = fixture();
    missingReference.bank[0].source_refs = [];
    assert.throws(() => assembleCoverage(missingReference), /출처 ref1 없음/u);
});

test('coverage assembly and rendering are deterministic and do not mutate inputs or the registry', () => {
    const input = mappedFixture();
    const before = JSON.stringify(input);
    const first = assembleCoverage(input);
    const second = assembleCoverage(input);
    assert.deepEqual(first, second);
    assert.equal(JSON.stringify(input), before);
    const registryBefore = JSON.stringify(first);
    const pages = renderCoverage(first);
    assert.deepEqual(pages, renderCoverage(first));
    assert.equal(JSON.stringify(first), registryBefore);
    assert.equal(pages.get(`${coverageDirectory}/registry.json`), JSON.stringify(first, null, 2) + '\n');
    assert.equal(pages.size, first.topics.length + 2);
    assert.ok([...pages.keys()].every(file => !path.isAbsolute(file) && !file.includes('\\')));
    const summary = pages.get(`${coverageDirectory}/summary.md`)!;
    assert.ok(summary.includes('../../../docs/출제-검토-자료-관리.md'));
    const topic = pages.get(`${coverageDirectory}/topics/13.md`)!;
    assert.ok(topic.includes('official_transcription: 2026'));
    assert.ok(topic.includes('../../../wiki/questions/pilot-13-001.md'));
    assert.ok(topic.includes('../../question-elements/elements/13.md'));
});

test('buildCoverage reads current bank and draft files and fingerprints inputs without modifying fixture files', context => {
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-coverage-'));
    context.after(() => {
        assert.equal(path.dirname(path.resolve(repoDir)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(repoDir).startsWith('audit-coverage-'));
        fs.rmSync(repoDir, { recursive: true, force: true });
    });
    const input = mappedFixture();
    const write = (file: string, content: string) => {
        fs.mkdirSync(path.dirname(path.join(repoDir, file)), { recursive: true });
        fs.writeFileSync(path.join(repoDir, file), content);
    };
    write(bankFile, JSON.stringify(input.bank, null, 2) + '\n');
    write(elementFile, JSON.stringify(input.dataset, null, 2) + '\n');
    write(`${coverageDirectory}/links.json`, JSON.stringify(input.overlay, null, 2) + '\n');
    write(sourceFile, `# KGA 402: 서비스조직\n## 요구사항\n### 이해사항\n${quote}\n`);
    const snapshot = () => fs.readdirSync(repoDir, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile()).map(entry => {
        const file = path.join(entry.parentPath, entry.name);
        return [path.relative(repoDir, file), fs.statSync(file).mtimeMs, sha(fs.readFileSync(file))];
    }).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    const before = snapshot();
    const initial = buildCoverage({ repoDir, catalog: input.catalog });
    assert.equal(initial.questions[0].bank_status, 'needs_review');
    assert.equal(initial.inputs.bank_source_hashes[sourceFile], sha(fs.readFileSync(path.join(repoDir, sourceFile))));
    assert.deepEqual(snapshot(), before);
    input.bank[0].status = 'verified';
    input.bank[0].verification.review_status = 'verified';
    write(bankFile, JSON.stringify(input.bank, null, 2) + '\n');
    const changed = snapshot();
    const current = buildCoverage({ repoDir, catalog: input.catalog, dataset: input.dataset });
    assert.equal(current.questions[0].bank_status, 'verified');
    assert.notEqual(current.inputs.bank.sha256, initial.inputs.bank.sha256);
    assert.equal(current.links[0].freshness, 'current');
    assert.deepEqual(snapshot(), changed);

    const draftFile = 'cpa_uploader/drafts/fixture/per-set/pilot-13-001.json';
    const draft = structuredClone(input.bank[0]);
    draft.status = 'needs_review';
    draft.verification.review_status = 'needs_human_review';
    draft.subquestions[0].prompt += ' 초안 추가 범위';
    write(draftFile, JSON.stringify(draft, null, 2) + '\n');
    const link = { ...input.overlay.links[0], target: { ...input.overlay.links[0].target, scope: 'draft', file: draftFile },
        snapshot: { ...input.overlay.links[0].snapshot, question_sha256: questionHash(draft, draft.subquestions[0]) } };
    write(`${coverageDirectory}/links.json`, JSON.stringify({ version: 1, links: [link] }, null, 2) + '\n');
    const draftSnapshot = snapshot();
    const draftRegistry = buildCoverage({ repoDir, catalog: input.catalog });
    assert.equal(draftRegistry.links[0].target?.draft_status, 'needs_review');
    assert.equal(draftRegistry.links[0].confirms_semantic_coverage, false);
    assert.equal(draftRegistry.inputs.draft_hashes[draftFile], sha(fs.readFileSync(path.join(repoDir, draftFile))));
    assert.deepEqual(snapshot(), draftSnapshot);

    const outsideDrafts = 'cpa_uploader/drafts/../analysis/coverage/other.json';
    write(outsideDrafts, JSON.stringify(draft));
    write(`${coverageDirectory}/links.json`, JSON.stringify({ version: 1, links: [{ ...link, target: { ...link.target, file: outsideDrafts } }] }));
    const invalidSnapshot = snapshot();
    assert.throws(() => buildCoverage({ repoDir, catalog: input.catalog }), /허용되지 않은 초안 경로/u);
    assert.deepEqual(snapshot(), invalidSnapshot);
});
