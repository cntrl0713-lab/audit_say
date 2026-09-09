import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { lintWiki } from '../cpa_uploader/wiki/scripts/lint-wiki.mjs';

function fixture(context: TestContext): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cpa-wiki-lint-'));
    context.after(() => {
        assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(root).startsWith('cpa-wiki-lint-'));
        fs.rmSync(root, { recursive: true, force: true });
    });
    write(root, 'source.txt', '근거 원문');
    write(root, 'source.md', '# 근거 문서\n\n## 실제 문단\n\n본문\n');
    write(root, 'cpa_uploader/wiki/index.md', '# Wiki\n\n[[first]]\n[[second]]\n');
    write(root, 'cpa_uploader/wiki/concepts/first.md', page('first', '[[second#유효한 문단]]\n[[index]]\n[원문](../../../source.md#실제-문단)\n[발췌](../../../source.txt)'));
    write(root, 'cpa_uploader/wiki/concepts/second.md', page('second', '[[first]]\n[[index]]'));
    return root;
}

function write(root: string, relative: string, content: string): void {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
}

function page(title: string, links: string): string {
    return `---\ntitle: ${title}\ncreated: 2026-09-08\nupdated: 2026-09-09\ntype: concept\nstatus: generated\nreview_required: true\ntags: [audit, quality]\nsources: [source.txt]\nconfidence: medium\n---\n\n# ${title}\n\n## 유효한 문단\n\n${links}\n`;
}

function snapshot(root: string): Array<{ file: string; sha: string; modified: number }> {
    return fs.readdirSync(root, { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => path.join(entry.parentPath, entry.name))
        .sort()
        .map(file => ({ file: path.relative(root, file), sha: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), modified: fs.statSync(file).mtimeMs }));
}

test('wiki lint accepts LF and CRLF frontmatter and headings without changing files', (context) => {
    const root = fixture(context);
    const file = path.join(root, 'cpa_uploader/wiki/concepts/first.md');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replaceAll('\n', '\r\n'));
    const before = snapshot(root);
    const result = lintWiki({ repoDir: root });
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.contentPages, 2);
    assert.deepEqual(snapshot(root), before);
});

test('wiki lint reports malformed metadata values rather than accepting field presence alone', (context) => {
    const root = fixture(context);
    const file = path.join(root, 'cpa_uploader/wiki/concepts/first.md');
    const original = fs.readFileSync(file, 'utf8');
    const cases = [
        ['type: concept', 'type: invalid', 'type 값 오류'],
        ['status: generated', 'status: approved', 'status 값 오류'],
        ['review_required: true', 'review_required: maybe', 'review_required 값 오류'],
        ['confidence: medium', 'confidence: certain', 'confidence 값 오류'],
        ['updated: 2026-09-09', 'updated: 2026-02-30', 'updated 날짜 오류'],
        ['updated: 2026-09-09', 'updated: 2026-09-07', 'updated가 created보다 이전'],
        ['tags: [audit, quality]', 'tags: audit', 'tags는 비어 있지 않은'],
        ['sources: [source.txt]', 'sources: []', 'sources는 비어 있지 않은'],
        ['sources: [source.txt]', 'sources: [missing.txt]', 'source 없음'],
    ];
    for (const [before, after, error] of cases) {
        fs.writeFileSync(file, original.replace(before, after));
        const result = lintWiki({ repoDir: root });
        assert.ok(result.errors.some((message: string) => message.includes(error)), `${after}: ${JSON.stringify(result.errors)}`);
    }
});

test('wiki lint checks local source files and Markdown or wiki heading anchors', (context) => {
    const root = fixture(context);
    const file = path.join(root, 'cpa_uploader/wiki/concepts/first.md');
    fs.appendFileSync(file, '\n[[second#없는 문단]]\n[잘못된 문단](../../../source.md#없는-문단)\n[누락 파일](../../../missing.json)\n[원격 문서](https://example.invalid/missing.md#ignored)\n');
    const errors = lintWiki({ repoDir: root }).errors as string[];
    assert.ok(errors.some(message => message.includes('anchor 없음 #없는 문단')));
    assert.ok(errors.some(message => message.includes('anchor 없음 #없는-문단')));
    assert.ok(errors.some(message => message.includes('source link 없음 ../../../missing.json')));
    assert.equal(errors.length, 3);
});

test('wiki lint ignores illustrative links and headings inside fenced code', (context) => {
    const root = fixture(context);
    const file = path.join(root, 'cpa_uploader/wiki/concepts/first.md');
    fs.appendFileSync(file, '\n```markdown\n[[missing]]\n[missing](missing.md)\n## 가짜 문단\n```\n');
    assert.deepEqual(lintWiki({ repoDir: root }).errors, []);
    fs.appendFileSync(file, '\n[잘못된 자체 링크](#가짜-문단)\n');
    assert.ok(lintWiki({ repoDir: root }).errors.some((message: string) => message.includes('anchor 없음 #가짜-문단')));
});

test('wiki lint requires a dynamic index entry for newly added nested pages', (context) => {
    const root = fixture(context);
    write(root, 'cpa_uploader/wiki/question-generation/topics/topic-01-design.md', page('새 지침', '[[index]]\n[[first]]').replace('type: concept', 'type: guide').replace('status: generated', 'status: reviewed'));
    const errors = lintWiki({ repoDir: root }).errors as string[];
    assert.ok(errors.includes('index.md: [[topic-01-design]] 누락'));
    assert.ok(errors.includes('orphan page: topic-01-design'));
});
