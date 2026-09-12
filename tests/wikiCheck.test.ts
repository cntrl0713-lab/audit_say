import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildWiki } from '../cpa_uploader/wiki/scripts/build-wiki.mjs';
import { checkSourceNavigation, checkWiki, normalizeGeneratedPage } from '../cpa_uploader/wiki/scripts/check-wiki.mjs';
import { buildSourceCatalog } from '../cpa_uploader/questionSourceCatalog.mjs';
import type { QuestionSetV3 } from '../lib/questionV3.ts';

function write(root: string, relative: string, content: string): void {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
}

function fixture(context: TestContext): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cpa-wiki-check-'));
    context.after(() => {
        assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(root).startsWith('cpa-wiki-check-'));
        fs.rmSync(root, { recursive: true, force: true });
    });
    fs.mkdirSync(path.join(root, 'cpa_uploader'), { recursive: true });
    fs.cpSync('cpa_uploader/data', path.join(root, 'cpa_uploader/data'), { recursive: true });
    // The current bank may cite a retained authoring batch outside data/.
    const currentBank = JSON.parse(fs.readFileSync('cpa_uploader/data/cpa_question_sets_v3.authoring.json', 'utf8')) as QuestionSetV3[];
    for (const relative of new Set(currentBank.flatMap(set => set.source_refs.map(source => source.file)))) {
        const source = path.resolve(relative);
        assert.ok(source.startsWith(path.resolve('.') + path.sep));
        if (!fs.existsSync(path.join(root, relative))) write(root, relative, fs.readFileSync(source, 'utf8'));
    }
    write(root, 'cpa_uploader/config/question-source-registry.json', fs.readFileSync('cpa_uploader/config/question-source-registry.json', 'utf8'));
    write(root, 'docs/archive/과거-검토-증거/reports/question-review-2027/개정-감사기준서-220-시행일-별도-기록.md', '# 판본 메모\n');
    write(root, 'cpa_uploader/analysis/reviews/question-review-2027/standards-register.json', '{}\n');
    write(root, 'cpa_uploader/wiki/SCHEMA.md', '# 스키마\n');
    write(root, 'cpa_uploader/wiki/log.md', '# 갱신 기록\n');
    const guides = ['question-design', 'question-output-schema', 'llm-question-generation-prompt', 'question-generation-workflow', 'source-authoring-design', 'question-elements'];
    for (const slug of guides) {
        write(root, `cpa_uploader/wiki/question-generation/${slug}.md`, guide(slug));
    }
    for (let index = 1; index <= 19; index++) {
        const slug = `topic-${String(index).padStart(2, '0')}-design`;
        write(root, `cpa_uploader/wiki/question-generation/topics/${slug}.md`, guide(slug));
    }
    return root;
}

function guide(title: string): string {
    return `---\ntitle: ${title}\ncreated: 2026-09-08\nupdated: 2026-09-09\ntype: guide\nstatus: reviewed\nreview_required: false\ntags: [audit, question-generation]\nsources: [cpa_uploader/data/cpa_question_sets_v3.authoring.json]\nconfidence: high\n---\n\n# ${title}\n\n[[topic-map]]\n[[coverage-map]]\n`;
}

function recordPages(root: string, date = '2026-09-09'): Map<string, string> {
    const built = buildWiki({ repoDir: root, date });
    for (const [relative, content] of built.pages) write(root, `cpa_uploader/wiki/${relative}`, content);
    return built.pages;
}

function snapshot(root: string): Array<{ file: string; sha: string; modified: number }> {
    return fs.readdirSync(root, { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => path.join(entry.parentPath, entry.name))
        .sort()
        .map(file => ({ file: path.relative(root, file), sha: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), modified: fs.statSync(file).mtimeMs }));
}

function alterBank(root: string, mutate: (bank: QuestionSetV3[]) => void): void {
    const relative = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
    const bank = JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8')) as QuestionSetV3[];
    mutate(bank);
    write(root, relative, `${JSON.stringify(bank, null, 2)}\n`);
}

test('wiki check compares the pure build without writing and ignores only build dates or line endings', (context) => {
    const root = fixture(context);
    const beforeBuild = snapshot(root);
    const preview = buildWiki({ repoDir: root, date: '2026-09-09' });
    assert.ok(preview.pages.size > 19);
    assert.deepEqual(snapshot(root), beforeBuild, 'the build preview must not write');
    const pages = recordPages(root);
    for (const [relative, content] of pages) {
        write(root, `cpa_uploader/wiki/${relative}`, content.replace(/^updated: \d{4}-\d{2}-\d{2}$/mu, 'updated: 2026-09-10').replaceAll('\n', '\r\n'));
    }
    const beforeCheck = snapshot(root);
    const result = checkWiki({ repoDir: root });
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.drift, []);
    assert.deepEqual(snapshot(root), beforeCheck, 'freshness checks must not write');
    assert.notEqual(normalizeGeneratedPage('기준서 시행일 2026-09-09\n'), normalizeGeneratedPage('기준서 시행일 2026-09-10\n'));
});

test('wiki check detects bank claims, requirements, conditions, source links and identity drift', (context) => {
    const root = fixture(context);
    recordPages(root);
    const bankPath = path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json');
    const original = fs.readFileSync(bankPath, 'utf8');
    const cases: Array<{ name: string; mutate: (bank: QuestionSetV3[]) => void }> = [
        { name: 'claim', mutate: bank => { bank[0].subquestions[0].criteria[0].claim += ' 변경된 채점 명제'; } },
        { name: 'condition', mutate: bank => { bank[0].subquestions[0].criteria[0].critical_facts.push({ id: 'new-condition', type: 'condition', expected: '추가 조건' }); } },
        { name: 'requirement', mutate: bank => { bank[0].subquestions[0].requirements[0].source_quote += ' 변경된 근거'; } },
        { name: 'source', mutate: bank => { bank[0].source_refs[0].content_hash = 'changed-source-hash'; } },
        { name: 'identity', mutate: bank => { bank[0].id = 'pilot-01-revised'; } },
        { name: 'published status', mutate: bank => { bank[0].status = 'needs_review'; } },
    ];
    for (const { name, mutate } of cases) {
        fs.writeFileSync(bankPath, original);
        alterBank(root, mutate);
        const before = snapshot(root);
        const result = checkWiki({ repoDir: root });
        assert.ok(result.errors.length > 0, name);
        assert.ok(result.drift.some((item: { file: string }) => item.file.startsWith('questions/')), `${name}: question detail must be refreshed`);
        assert.deepEqual(snapshot(root), before, `${name}: rejected drift must not rewrite the bank or wiki`);
    }
});

test('wiki check catches source bytes changing without a bank edit', (context) => {
    const root = fixture(context);
    recordPages(root);
    const bank = JSON.parse(fs.readFileSync(path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json'), 'utf8')) as QuestionSetV3[];
    fs.appendFileSync(path.join(root, bank[0].source_refs[0].file), '\n출처 파일 변경\n');
    const before = snapshot(root);
    const result = checkWiki({ repoDir: root });
    assert.ok(result.drift.some((item: { file: string }) => item.file === 'raw/source-manifest.md'));
    assert.deepEqual(snapshot(root), before);
});

test('wiki check finds changed metadata, missing pages and obsolete generated pages', (context) => {
    const root = fixture(context);
    const pages = recordPages(root);
    const first = [...pages.keys()].find(relative => relative.startsWith('questions/'))!;
    const second = [...pages.keys()].find(relative => relative.startsWith('concepts/'))!;
    write(root, `cpa_uploader/wiki/${first}`, pages.get(first)!.replace('confidence: medium', 'confidence: low').replace('confidence: high', 'confidence: low'));
    fs.unlinkSync(path.join(root, 'cpa_uploader/wiki', second));
    write(root, 'cpa_uploader/wiki/questions/obsolete-set.md', guide('obsolete').replace('type: guide', 'type: question').replace('status: reviewed', 'status: generated'));
    const result = checkWiki({ repoDir: root });
    assert.ok(result.drift.some((item: { file: string; kind: string }) => item.file === first && item.kind === 'changed'));
    assert.ok(result.drift.some((item: { file: string; kind: string }) => item.file === second && item.kind === 'missing'));
    assert.ok(result.drift.some((item: { file: string; kind: string }) => item.file === 'questions/obsolete-set.md' && item.kind === 'extra'));
});

test('source review maps link historical bank snapshots without reproducing their content', (context) => {
    const root = fixture(context);
    const ledger = {
        baseline: { sentinel: 'legacy-bank-should-not-appear', sets: [{ id: 'historical-set', model_answer: 'obsolete-answer' }] },
        review_record_complete: true,
        target_exam_year: 2027,
    };
    write(root, 'cpa_uploader/analysis/reviews/question-review-2027/05.json', JSON.stringify(ledger));
    const pages = buildWiki({ repoDir: root }).pages;
    const sourceReview = pages.get('_meta/source-review-map.md') as string;
    assert.ok(sourceReview.includes('[05.json](../../analysis/reviews/question-review-2027/05.json)'));
    assert.ok(sourceReview.includes('review_record_complete=true'));
    assert.ok(sourceReview.includes('target_exam_year=2027'));
    for (const content of pages.values()) {
        assert.ok(!content.includes('legacy-bank-should-not-appear'));
        assert.ok(!content.includes('obsolete-answer'));
    }
});

test('wiki check detects review status and edition changes independently of build dates', (context) => {
    const root = fixture(context);
    const relative = 'cpa_uploader/analysis/reviews/question-review-2027/05.json';
    const ledger = { review_record_complete: false, exam_2027_suitable: false, baseline: '2026-09-08', target_exam_year: 2027 };
    write(root, relative, JSON.stringify(ledger));
    recordPages(root);
    for (const mutation of [{ review_record_complete: true }, { baseline: '2026-09-09' }, { target_exam_year: 2028 }]) {
        write(root, relative, JSON.stringify({ ...ledger, ...mutation }));
        const before = snapshot(root);
        const result = checkWiki({ repoDir: root });
        assert.ok(result.drift.some((item: { file: string; kind: string }) => item.file === '_meta/source-review-map.md' && item.kind === 'changed'), JSON.stringify(mutation));
        assert.deepEqual(snapshot(root), before);
    }
});

test('concepts retain all independently counted indented TOC references with exact file and page lists', (context) => {
    const root = fixture(context);
    const rawDir = path.join(root, 'cpa_uploader/data/회계감사_통합학습자료');
    const toc = fs.readFileSync(path.join(rawDir, '00_통합_목차.md'), 'utf8');
    // Count quoted raw paths directly, without relying on any production topic parser.
    const rawReferences = [...toc.matchAll(/`((?:02_기본이론|03_문제연습|04_기출문제)\/[^`]+\.md)`:\s*([^\r\n]+)/gu)];
    assert.equal(rawReferences.length, 151);
    assert.deepEqual(['02_', '03_', '04_'].map(prefix => rawReferences.filter(match => match[1].startsWith(prefix)).length), [37, 57, 57]);
    const pages = buildWiki({ repoDir: root }).pages as Map<string, string>;
    const rendered = [...pages].filter(([relative]) => relative.startsWith('concepts/'));
    assert.equal(rendered.length, 19);
    const references: string[] = [];
    for (const [relative, content] of rendered) {
        const navigation = content.split('## 원자료 탐색\n')[1]?.split('\n## Related')[0];
        assert.ok(navigation?.trim(), relative);
        const links = [...navigation.matchAll(/^- \[[^\]]+\]\(([^)]+)\): (.+)$/gmu)];
        assert.ok(links.length > 0, relative);
        for (const match of links) {
            const target = path.resolve(root, 'cpa_uploader/wiki', path.dirname(relative), decodeURIComponent(match[1]));
            assert.ok(fs.existsSync(target), match[1]);
            references.push(JSON.stringify([path.relative(rawDir, target).split(path.sep).join('/'), match[2]]));
        }
    }
    assert.deepEqual(references.sort(), rawReferences.map(match => JSON.stringify([match[1], match[2]])).sort());
    assert.deepEqual(checkSourceNavigation({ repoDir: root, pages }).errors, []);
});

test('independent navigation gate rejects the formerly blank generated output and equal-count wrong destinations', (context) => {
    const root = fixture(context);
    const pages = buildWiki({ repoDir: root }).pages as Map<string, string>;
    const broken = new Map(pages);
    for (const [relative, content] of pages) {
        if (relative.startsWith('concepts/')) broken.set(relative, content.replace(/(## 원자료 탐색\n)[\s\S]*?(\n## Related)/u, '$1\n$2'));
    }
    const empty = checkSourceNavigation({ repoDir: root, pages: broken });
    assert.equal(empty.expectedLinks, 151);
    assert.equal(empty.actualLinks, 0);
    assert.equal(empty.errors.filter((error: string) => error.includes('비어 있으면 안 됨')).length, 19);
    const first = [...pages.keys()].find(relative => relative.startsWith('concepts/'))!;
    const content = pages.get(first)!;
    for (const mutation of [
        content.replaceAll('02_%EA%B8%B0%EB%B3%B8%EC%9D%B4%EB%A1%A0/%ED%95%B5%EC%8B%AC%EC%9A%94%EC%95%BD.md', '02_%EA%B8%B0%EB%B3%B8%EC%9D%B4%EB%A1%A0/%ED%9A%8C%EA%B3%84%EA%B0%90%EC%82%AC_%EA%B8%B0%EB%B3%B8%EC%9D%B4%EB%A1%A0.md'),
        content.replace(/(## 원자료 탐색\n[\s\S]*?\): )[^\r\n]+/u, '$19999'),
    ]) {
        assert.notEqual(mutation, content);
        const result = checkSourceNavigation({ repoDir: root, pages: new Map(pages).set(first, mutation) });
        assert.equal(result.actualLinks, 151);
        assert.ok(result.errors.some((error: string) => error.includes('누락·위치 불일치')));
    }
    // The standalone check must run the independent gate against disk, even if
    // a future faulty renderer agrees with the incomplete generated documents.
    for (const [relative, content] of broken) write(root, `cpa_uploader/wiki/${relative}`, content);
    const checked = checkWiki({ repoDir: root });
    assert.equal(checked.sourceNavigation?.actualLinks, 0);
    assert.ok(checked.errors.some((error: string) => error.includes('비어 있으면 안 됨')));
});

test('navigation counts adapt to new TOC rows and reject an empty topic at render time', (context) => {
    const root = fixture(context);
    const file = 'cpa_uploader/data/회계감사_통합학습자료/00_통합_목차.md';
    const original = fs.readFileSync(path.join(root, file), 'utf8');
    const row = '  - `04_기출문제/기출문제_주제별_해설.md`: 166\n';
    write(root, file, original.replace('### 02.', `${row}\n### 02.`));
    const pages = buildWiki({ repoDir: root }).pages as Map<string, string>;
    const result = checkSourceNavigation({ repoDir: root, pages });
    assert.deepEqual(result.errors, []);
    assert.equal(result.expectedLinks, 152);
    assert.equal(result.actualLinks, 152);
    write(root, file, original.replace(/(### 01\.[\s\S]*?)(?=### 02\.)/u, block => block.split(/\r?\n/u).filter(line => !line.includes('`.md') && !/^\s*- `.+\.md`:/u.test(line)).join('\n')));
    assert.throws(() => buildWiki({ repoDir: root }), /Missing source navigation for TOC topic 01/u);
});

test('source catalog pages expose raw units and planning links even with an empty question bank', (context) => {
    const root = fixture(context);
    const catalog = buildSourceCatalog({ repoDir: root });
    write(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json', '[]\n');
    const before = snapshot(root);
    const built = buildWiki({ repoDir: root });
    const pages = built.pages as Map<string, string>;
    assert.equal(built.summary.sourceUnits, catalog.units.length);
    assert.equal(built.summary.questionSets, 0);
    const catalogPages = [...pages].filter(([relative]) => relative.startsWith('_meta/source-catalog-'));
    const catalogText = catalogPages.map(([, content]) => content).join('\n');
    const renderedIds = new Set([...catalogText.matchAll(/id="([^"]+)"/gu)].map(match => match[1]));
    const renderedHashes = new Set([...catalogText.matchAll(/\b[a-f0-9]{64}\b/gu)].map(match => match[0]));
    for (const unit of catalog.units) {
        assert.ok(renderedIds.has(unit.id), unit.id);
        assert.ok(renderedHashes.has(unit.contentHash), unit.id);
    }
    assert.ok(catalog.units.some(unit => unit.standard === 'KGA 402'));
    assert.ok(catalog.units.some(unit => unit.kind === 'past_exam' && unit.page === 166 && unit.file.endsWith('기출문제_주제별_해설.md')));
    assert.ok(catalogText.includes('직접 인용 연결 없음 · 목표 검토 후보'));
    assert.ok(pages.get('_meta/requirement-coverage.md')!.includes('## 원자료 단위에서 목표 후보 찾기'));
    assert.ok(pages.get('_meta/requirement-coverage.md')!.includes('현재 파서가 요구사항 절로 분리하지 못한 기준 축:'));
    for (const [relative, content] of catalogPages) {
        assert.ok(content.trimEnd().split('\n').length <= 200, relative);
        assert.ok(pages.get('index.md')!.includes(`[[${path.basename(relative, '.md')}]]`), relative);
    }
    assert.deepEqual(snapshot(root), before);
});

test('source catalog freshness detects unused raw source content and preserves input files', (context) => {
    const root = fixture(context);
    recordPages(root);
    const source = buildSourceCatalog({ repoDir: root }).units.find(unit => unit.kind === 'past_exam' && unit.page === 166 && unit.file.endsWith('기출문제_주제별_해설.md'))!;
    const file = path.join(root, source.file);
    const original = fs.readFileSync(file, 'utf8');
    assert.ok(original.includes(source.quote));
    fs.writeFileSync(file, original.replace(source.quote, `${source.quote}\n원자료변경감지회귀표식`));
    const before = snapshot(root);
    const result = checkWiki({ repoDir: root });
    assert.ok(result.drift.some((entry: { file: string }) => entry.file === '_meta/source-catalog.md'));
    assert.ok(result.drift.some((entry: { file: string }) => entry.file.startsWith('_meta/source-catalog-topic-13')));
    assert.deepEqual(snapshot(root), before);
});
