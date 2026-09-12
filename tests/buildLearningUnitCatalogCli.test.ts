import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { main } from '../scripts/build-learning-unit-catalog.ts';
import { sampleQuestionSet } from './helpers/cpaLearningDatabase.ts';
import { studyTopics } from '../cpa_uploader/wiki/scripts/ox-study-order.mjs';

const fallback = 'cpa_uploader/analysis/reviews/question-unit-migration-2026-09-11/canonical-classification.json';
const sourceFile = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const defaultOutput = 'cpa_uploader/data/learning-question-classifications.json';
const followupFile = 'reviews/followup-classification.json';
const coverageFile = 'cpa_uploader/analysis/coverage/registry.json';
const sha = (value: Buffer) => createHash('sha256').update(value).digest('hex');

function fixture() {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-learning-catalog-cli-'));
    const absolute = (file: string) => path.resolve(cwd, file);
    const write = (file: string, value: unknown) => {
        fs.mkdirSync(path.dirname(absolute(file)), { recursive: true });
        fs.writeFileSync(absolute(file), JSON.stringify(value, null, 2) + '\n');
    };
    const sets = studyTopics.map(topic => {
        assert(topic);
        const set = sampleQuestionSet();
        set.id = `fixture-${topic.id}`;
        set.classification.topic_id = topic.id;
        return set;
    });
    write(sourceFile, sets);
    write(coverageFile, { topics: studyTopics.map(topic => ({ id: topic!.id, title: `주제 ${topic!.id}` })) });
    const entries = sets.flatMap(set => set.subquestions.map(sub => ({
        set_id: set.id, subquestion_id: sub.id, question_style: 'standard', topic_ids: [set.classification.topic_id],
        standalone_prompt: null as string | null, case_fact_ids: [], reason: '일반 원칙을 독립적으로 재현하는 기준서 물음.',
    })));
    const review = { source_file: sourceFile, source_file_sha256: sha(fs.readFileSync(absolute(sourceFile))), entries };
    write(fallback, review);
    const next = structuredClone(review);
    next.entries[0] = { ...next.entries[0], standalone_prompt: '후속 독립 발문으로 같은 기준서 원칙을 설명하시오.' };
    write(followupFile, next);
    const originals = [sourceFile, fallback, followupFile, coverageFile].map(file => ({ file, bytes: fs.readFileSync(absolute(file)) }));
    const assertOriginals = () => {
        for (const original of originals) assert.deepEqual(fs.readFileSync(absolute(original.file)), original.bytes, `${original.file} remains byte-identical`);
    };
    return { cwd, absolute, write, review, next, assertOriginals, cleanup() {
        // The resolved, exclusively created temporary root is verified before deletion.
        assert(path.dirname(cwd) === os.tmpdir() && path.basename(cwd).startsWith('audit-learning-catalog-cli-'));
        fs.rmSync(cwd, { recursive: true, force: true });
    } };
}

test('explicit follow-up review generates a catalog and later default/check runs follow its recorded review', () => {
    const f = fixture();
    try {
        main(['--review', followupFile], f.cwd);
        const first = fs.readFileSync(f.absolute(defaultOutput));
        const catalog = JSON.parse(first.toString('utf8'));
        assert.equal(catalog.review_file, followupFile);
        assert.equal(catalog.review_file_sha256, sha(fs.readFileSync(f.absolute(followupFile))));
        assert.equal(catalog.classifications.length, f.next.entries.length);
        assert.equal(catalog.classifications[0].standalone_prompt, f.next.entries[0].standalone_prompt);
        main(['--check'], f.cwd);
        main([], f.cwd);
        assert.deepEqual(fs.readFileSync(f.absolute(defaultOutput)), first);
        f.assertOriginals();
    } finally { f.cleanup(); }
});

test('custom output is reproducible without --review and missing catalog uses only the legacy fallback', () => {
    const f = fixture();
    try {
        main(['--review', followupFile, '--output', 'generated/followup.json'], f.cwd);
        const before = fs.readFileSync(f.absolute('generated/followup.json'));
        main(['--output', 'generated/followup.json', '--check'], f.cwd);
        assert.deepEqual(fs.readFileSync(f.absolute('generated/followup.json')), before);
        assert.equal(fs.existsSync(f.absolute(defaultOutput)), false);
        main(['--output', 'generated/legacy.json'], f.cwd);
        assert.equal(JSON.parse(fs.readFileSync(f.absolute('generated/legacy.json'), 'utf8')).review_file, fallback);
        f.assertOriginals();
    } finally { f.cleanup(); }
});

test('strict parsing rejects unknown, repeated, missing-value and positional options without writes', () => {
    const f = fixture();
    try {
        for (const args of [['--unknown'], ['--check', '--check'], ['--review'], ['--output', '--check'],
            ['--review', followupFile, '--review', fallback], ['--output', 'a', '--output', 'b'], ['--check', 'true']]) {
            assert.throws(() => main(args, f.cwd), /옵션|값/);
        }
        assert.equal(fs.existsSync(f.absolute(defaultOutput)), false);
        f.assertOriginals();
    } finally { f.cleanup(); }
});

test('check is read-only and stale source hashes fail before creating or replacing a catalog', () => {
    const f = fixture();
    try {
        assert.throws(() => main(['--review', followupFile, '--check'], f.cwd), /산출물/);
        assert.equal(fs.existsSync(f.absolute(defaultOutput)), false);
        main(['--review', followupFile], f.cwd);
        const catalog = fs.readFileSync(f.absolute(defaultOutput));
        fs.appendFileSync(f.absolute(sourceFile), '\n');
        assert.throws(() => main(['--check'], f.cwd), /원본 해시/);
        assert.throws(() => main([], f.cwd), /원본 해시/);
        assert.deepEqual(fs.readFileSync(f.absolute(defaultOutput)), catalog);
    } finally { f.cleanup(); }
});

test('existing review, source, other inputs and hard-link aliases cannot be catalog outputs', () => {
    const f = fixture();
    try {
        for (const output of [followupFile, fallback, sourceFile, coverageFile]) {
            assert.throws(() => main(['--review', followupFile, '--output', output], f.cwd), /덮어쓸|다른 경로/);
        }
        const alias = f.absolute('source-alias.json');
        fs.linkSync(f.absolute(sourceFile), alias);
        assert.throws(() => main(['--review', followupFile, '--output', alias], f.cwd), /덮어쓸|다른 경로/);
        f.assertOriginals();
    } finally { f.cleanup(); }
});

test('an existing malformed catalog never silently falls back and check detects changed classification', () => {
    const f = fixture();
    try {
        f.write(defaultOutput, { schema_version: 1, classifications: [] });
        assert.throws(() => main([], f.cwd), /카탈로그/);
        fs.unlinkSync(f.absolute(defaultOutput));
        main(['--review', followupFile], f.cwd);
        const prior = fs.readFileSync(f.absolute(defaultOutput));
        const next = structuredClone(f.next);
        // Select a distinct, registered topic rather than duplicate topic IDs.
        next.entries[0].topic_ids = [next.entries[0].topic_ids[0], next.entries[2].topic_ids[0]];
        f.write(followupFile, next);
        assert.throws(() => main(['--check'], f.cwd), /산출물/);
        assert.deepEqual(fs.readFileSync(f.absolute(defaultOutput)), prior);
        main([], f.cwd);
        main(['--check'], f.cwd);
        assert.notDeepEqual(fs.readFileSync(f.absolute(defaultOutput)), prior);
    } finally { f.cleanup(); }
});

test('follow-up reviews retain full classification and registered-topic validation', () => {
    const f = fixture();
    try {
        f.write(followupFile, { ...f.next, entries: f.next.entries.slice(1) });
        assert.throws(() => main(['--review', followupFile], f.cwd), /분류가 없습니다/);
        const wrong = structuredClone(f.next);
        wrong.entries[0].topic_ids = ['99']; f.write(followupFile, wrong);
        assert.throws(() => main(['--review', followupFile], f.cwd), /주제/);
        assert.equal(fs.existsSync(f.absolute(defaultOutput)), false);
    } finally { f.cleanup(); }
});
