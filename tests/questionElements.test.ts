import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { aggregateQuestionElements, checkQuestionElementOutputs, originalQuestionKey, renderQuestionElements, validateElementInputs } from '../cpa_uploader/questionElements.mjs';

function occurrence(id: string, year = 2025, subquestion = '3') {
    return {
        id, source: { file: `source-${id}.md`, page: 1, start_line: 2, end_line: 2 },
        source_role: 'question', text: '보고서일 후 재무제표 수정이 필요한 사실을 알게 된 경우 감사인이 수행할 절차를 기술하시오. 경영진이 재무제표를 수정한 경우 감사보고서에 미치는 영향도 함께 기술하시오.',
        origin: { kind: 'cpa_exam', year, problem: '4', subquestion, item: null as string | null },
        elements: [{ label: '보고서일 후 새 사실에 대한 감사인의 절차', topic_id: '12', kind: 'procedure' }],
        status: 'extracted', notes: [],
    };
}

test('examination frequency removes reprints and item repetitions but retains different examinations', () => {
    const first = occurrence('A');
    const copy = occurrence('B');
    const index = { ...occurrence('index'), source_role: 'author_index' };
    const item = occurrence('item');
    item.origin.item = '2';
    const earlier = occurrence('earlier', 2023);
    const otherSubquestion = occurrence('other', 2025, '4');
    const result = aggregateQuestionElements([first, copy, index, item, earlier, otherSubquestion]);
    assert.equal(result.elements.length, 1);
    assert.equal(result.elements[0].exam_frequency, 3);
    assert.deepEqual(result.elements[0].exam_years, [2023, 2025]);
    assert.equal(result.elements[0].occurrence_ids.length, 6);
    assert.equal(originalQuestionKey(item.origin), originalQuestionKey(first.origin));
});

test('topic totals count unique subquestions separately from element appearances', () => {
    const first = occurrence('first');
    first.elements.push({ label: '재무제표 수정 시 감사보고서 표시 방법', topic_id: '12', kind: 'procedure' });
    const result = aggregateQuestionElements([first, occurrence('copy')]);
    const completion = result.topics.find(topic => topic.topic_id === '12');
    assert.equal(completion?.element_count, 2);
    assert.equal(completion?.exam_question_count, 1);
    assert.equal(completion?.element_exam_occurrences, 2);
});

test('the reviewed representative prompt prevents reprint-only broad labels from adding frequencies', () => {
    const primary = { ...occurrence('primary'), frequency_authority: true };
    const copy = occurrence('thematic-copy');
    copy.elements[0].label = '후속사건 전반';
    const index = { ...occurrence('index'), source_role: 'author_index' };
    index.elements[0].label = '감사 마무리';
    const result = aggregateQuestionElements([primary, copy, index]);
    assert.equal(result.elements.find(element => element.label === primary.elements[0].label)?.exam_frequency, 1);
    assert.equal(result.elements.find(element => element.label === '후속사건 전반')?.exam_frequency, 0);
    assert.equal(result.elements.find(element => element.label === '감사 마무리')?.exam_frequency, 0);
    assert.equal(result.occurrences.length, 3);
    assert.ok(result.occurrences.find(entry => entry.record_id === copy.id)?.exclusion_reason?.includes('재수록'));
    primary.status = 'needs_review';
    const pending = aggregateQuestionElements([primary, copy, index]);
    assert.ok(pending.elements.every(element => element.exam_frequency === 0));
});

test('unresolved OCR, unknown origin and repeated generic prompts cannot inflate confirmed frequency', () => {
    const unknown = { ...occurrence('unknown'), origin: { kind: 'practice', year: null, problem: null, subquestion: null, item: null } };
    const unresolved = { ...occurrence('OCR', 2024), status: 'needs_review' };
    const confirmed = occurrence('confirmed');
    const result = aggregateQuestionElements([unknown, unresolved, confirmed]);
    assert.equal(result.elements[0].exam_frequency, 1);
    assert.equal(result.elements[0].mock_frequency, 0);
    assert.equal(result.elements[0].unresolved_occurrences.length, 2);
    assert.ok(result.duplicate_candidates.length > 0);
});

test('reviewed aliases merge wording while different conditions remain different requirements', () => {
    const first = occurrence('first');
    const alias = occurrence('alias', 2023);
    alias.elements[0].label = '보고서일 이후 인지한 사실에 대한 후속조치';
    const changedCondition = occurrence('different', 2024);
    changedCondition.elements[0].label = '보고서일 이전 발견한 사실에 대한 감사인의 절차';
    const registry = { elements: [{ id: 'completion-after-report', label: first.elements[0].label, topic_id: '12', aliases: [alias.elements[0].label] }], duplicate_groups: [] };
    const result = aggregateQuestionElements([first, alias, changedCondition], registry);
    assert.equal(result.elements.length, 2);
    assert.equal(result.elements.find(element => element.id === 'completion-after-report')?.exam_frequency, 2);
    assert.throws(() => aggregateQuestionElements([first, alias], {
        elements: [], duplicate_groups: [{ id: 'bad-merge', reason: 'must reject different real years', record_ids: ['first', 'alias'] }],
    }), /Different actual examinations/u);
});

test('a reviewed reprint of an examination keeps the original examination identity', () => {
    const first = occurrence('exam');
    const copy = { ...occurrence('practice'), origin: { kind: 'practice', year: null, problem: null, subquestion: null, item: null } };
    const registry = { elements: [], duplicate_groups: [{ id: 'copy', reason: '원시험과 공통사실·발문 대조', record_ids: ['exam', 'practice'] }] };
    const result = aggregateQuestionElements([first, copy], registry);
    assert.equal(result.elements[0].exam_frequency, 1);
    assert.equal(result.question_groups.length, 1);
    assert.equal(result.elements[0].unresolved_occurrences.length, 0);
});

test('a compound source label splits only through explicit mappings and keeps one topic question', () => {
    const row = occurrence('compound');
    row.elements = [{ label: '독립성 위협의 식별과 안전장치 제시', topic_id: '01', kind: 'list' }];
    const registry = {
        elements: [{ id: 'threat', label: '독립성 위협 식별', topic_id: '01' }, { id: 'safeguard', label: '안전장치 제시', topic_id: '01' }],
        mappings: [{ source_label: row.elements[0].label, element_ids: ['threat', 'safeguard'] }], duplicate_groups: [],
    };
    const result = aggregateQuestionElements([row], registry);
    assert.equal(result.elements.length, 2);
    assert.ok(result.elements.every(element => element.exam_frequency === 1));
    assert.equal(result.topics.find(topic => topic.topic_id === '01')?.exam_question_count, 1);
    registry.mappings[0].element_ids = [];
    assert.throws(() => aggregateQuestionElements([row], registry), /Invalid element expansion/u);
});

test('evidence validation detects wrong quotes, pages and changed raw source bytes', context => {
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-elements-'));
    context.after(() => {
        assert.equal(path.dirname(path.resolve(repoDir)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(repoDir).startsWith('audit-elements-'));
        fs.rmSync(repoDir, { recursive: true, force: true });
    });
    const file = 'cpa_uploader/data/회계감사_통합학습자료/04_기출문제/sample.md';
    const absolute = path.join(repoDir, file);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    const quote = '보고서일 후 인지한 사실에 대한 감사인의 절차를 기술하시오.';
    const text = `## 원문 페이지 1\r\n${quote}\r\n`;
    fs.writeFileSync(absolute, text);
    const row = { ...occurrence('source'), text: quote, source: { file, page: 1, start_line: 2, end_line: 2 } };
    const dataset = { version: 1, sources: [{ file, pages: 1, sha256: crypto.createHash('sha256').update(text).digest('hex') }], records: [row], unresolved: [] };
    assert.deepEqual(validateElementInputs([dataset], { repoDir }).errors, []);
    const badContext = { ...row, context_source: { file, page: 9, start_line: 1, end_line: 2 } };
    assert.match(validateElementInputs([{ ...dataset, records: [badContext] }], { repoDir }).errors.join('\n'), /Common context page differs/u);
    row.text += ' 다른 내용';
    assert.match(validateElementInputs([dataset], { repoDir }).errors.join('\n'), /Evidence quote differs/u);
    row.text = quote;
    row.source.page = 2;
    assert.match(validateElementInputs([dataset], { repoDir }).errors.join('\n'), /Evidence page differs/u);
    fs.appendFileSync(absolute, '원자료 변경');
    assert.match(validateElementInputs([dataset], { repoDir }).errors.join('\n'), /Source hash differs/u);
});

function renderingFixture() {
    const row = occurrence('render');
    row.source.file = 'cpa_uploader/data/회계감사_통합학습자료/04_기출문제/sample.md';
    const aggregate = aggregateQuestionElements([row]);
    return {
        ...aggregate,
        topics: aggregate.topics.map(topic => ({ ...topic, name: topic.topic_id === '12' ? '감사의 마무리' : '기타' })),
        records: [row],
        validation: { errors: [], sourceFiles: 1, records: 1 },
        coverage: [{ file: row.source.file, pages: 1, question_records: 1, extracted_questions: 1, needs_review_questions: 0, author_index_records: 0 }],
        source_catalog: { version: 1, fingerprint: 'current-source-catalog' },
        policy: { unit: '서로 다른 원시험 물음마다 한 번 집계한다.' },
    };
}

test('the renderer accepts a fixture result and produces portable pages without filesystem access or mutation', context => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-elements-render-'));
    context.after(() => {
        assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(directory).startsWith('audit-elements-render-'));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    const repoDir = path.join(directory, 'not-created');
    const result = renderingFixture();
    const before = JSON.stringify(result);
    const pages = renderQuestionElements(result, { repoDir });
    const base = 'cpa_uploader/analysis/question-elements';
    assert.equal(pages.size, result.topics.length + 4);
    assert.ok([...pages.keys()].every(file => !path.isAbsolute(file) && !file.includes('\\')));
    assert.equal(pages.get(`${base}/question-elements.json`), JSON.stringify(result, null, 2) + '\n');
    const topic = pages.get(`${base}/elements/12.md`)!;
    assert.ok(topic.startsWith('# 12 감사의 마무리 — 출제 요구사항\n\n'));
    assert.ok(topic.includes(result.elements[0].id));
    assert.ok(topic.includes(encodeURI('../../../data/회계감사_통합학습자료/04_기출문제/sample.md')));
    assert.ok(topic.includes('#%EC%9B%90%EB%AC%B8-%ED%8E%98%EC%9D%B4%EC%A7%80-1'));
    assert.deepEqual(pages, renderQuestionElements(result, { repoDir: path.join(directory, 'another-root') }));
    assert.equal(JSON.stringify(result), before);
    assert.equal(fs.existsSync(repoDir), false);
});

test('generated-output checks detect JSON fingerprint, Markdown, missing and extra page drift without writes', context => {
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-elements-check-'));
    context.after(() => {
        assert.equal(path.dirname(path.resolve(repoDir)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(repoDir).startsWith('audit-elements-check-'));
        fs.rmSync(repoDir, { recursive: true, force: true });
    });
    const result = renderingFixture();
    const pages = renderQuestionElements(result, { repoDir });
    const base = 'cpa_uploader/analysis/question-elements';
    for (const [relative, content] of pages) {
        const absolute = path.join(repoDir, relative);
        fs.mkdirSync(path.dirname(absolute), { recursive: true });
        fs.writeFileSync(absolute, content.replace(/\n/gu, '\r\n'));
    }
    // Hand-maintained neighboring files are outside the generated inventory.
    fs.writeFileSync(path.join(repoDir, base, 'README.md'), 'manual documentation\n');
    fs.writeFileSync(path.join(repoDir, base, 'normalization.json'), '{"manual":true}\n');
    const snapshot = () => fs.readdirSync(repoDir, { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile()).map(entry => {
            const file = path.join(entry.parentPath, entry.name);
            return [path.relative(repoDir, file), fs.statSync(file).mtimeMs, fs.readFileSync(file).toString('base64')];
        }).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    const cleanSnapshot = snapshot();
    assert.deepEqual(checkQuestionElementOutputs(pages, { repoDir }), []);
    assert.deepEqual(snapshot(), cleanSnapshot);

    const stale = structuredClone(result);
    stale.source_catalog.fingerprint = 'previous-source-catalog';
    fs.writeFileSync(path.join(repoDir, base, 'question-elements.json'), JSON.stringify(stale, null, 2) + '\n');
    fs.appendFileSync(path.join(repoDir, base, 'frequency.md'), 'changed result\n');
    fs.unlinkSync(path.join(repoDir, base, 'elements/12.md'));
    fs.writeFileSync(path.join(repoDir, base, 'elements/obsolete.md'), 'obsolete generated page\n');
    const driftSnapshot = snapshot();
    assert.deepEqual(checkQuestionElementOutputs(pages, { repoDir }), [
        `Generated output differs: ${base}/question-elements.json`,
        `Missing generated output: ${base}/elements/12.md`,
        `Generated output differs: ${base}/frequency.md`,
        `Unexpected generated element page: ${base}/elements/obsolete.md`,
    ]);
    assert.deepEqual(snapshot(), driftSnapshot);
});

test('generated-output checks ignore only line endings, including for JSON', context => {
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-elements-exact-'));
    context.after(() => {
        assert.equal(path.dirname(path.resolve(repoDir)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(repoDir).startsWith('audit-elements-exact-'));
        fs.rmSync(repoDir, { recursive: true, force: true });
    });
    const relative = 'cpa_uploader/analysis/question-elements/question-elements.json';
    const absolute = path.join(repoDir, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    const expected = '{\n  "source_catalog": { "fingerprint": "current" }\n}\n';
    const pages = new Map([[relative, expected]]);
    fs.writeFileSync(absolute, expected.replace(/\n/gu, '\r\n'));
    assert.deepEqual(checkQuestionElementOutputs(pages, { repoDir }), []);
    fs.writeFileSync(absolute, JSON.stringify(JSON.parse(expected)) + '\n');
    assert.deepEqual(checkQuestionElementOutputs(pages, { repoDir }), [`Generated output differs: ${relative}`]);
});
