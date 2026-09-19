import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { compilePublicQuestionSet } from '../lib/questionV3.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';
import { contentHash } from '../lib/learningSubmission.ts';
import { decryptAuthoringQuestionBankV3, encryptAuthoringQuestionBankV3 } from '../lib/questionV3Encryption.ts';
import { reviewedContentHash, snapshotFile } from '../cpa_uploader/questionBankPublication.ts';
import type { PromotionLedger } from '../cpa_uploader/questionBankPublication.ts';
import { applyCorrections, changedSetIds, readCorrectionFile, serializeBank } from '../cpa_uploader/questionCorrection.ts';
import { writeCorrectionEvidence } from '../cpa_uploader/correct_cpa_v3.ts';
import { offlineReviewReceipt } from './helpers/questionSemanticReviewFixture.ts';

const root = process.cwd();
const fixtureDirectory = 'cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14';
const peerIds = [3, 4, 3, 3, 4, 4, 3, 4, 3, 3, 3, 3, 3, 4, 4, 4, 3, 3, 4].flatMap((count, topic) =>
    Array.from({ length: count }, (_, index) => `pilot-${String(topic + 1).padStart(2, '0')}-${String(index + 1).padStart(3, '0')}`));
const secret = 'isolated-correction-regression-test-secret';
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const canonicalFiles = ['cpa_uploader/data/cpa_question_sets_v3.authoring.json', 'cpa_uploader/data/cpa_question_sets_v3.promotions.json',
    'cpa_uploader/data/cpa_question_sets_v3.public.json', 'cpa_uploader/data/learning-question-classifications.json'].map((file) => path.join(root, file));

function node(args: string[], env: NodeJS.ProcessEnv, success = true) {
    const result = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', ...args], { cwd: root, env, encoding: 'utf8', timeout: 600_000 });
    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.error, undefined, output);
    if (success) assert.equal(result.status, 0, output); else assert.notEqual(result.status, 0, output);
    return output;
}

/** 65세트 격리 은행과 장부·공개본·암호화본·분류 카탈로그를 만든다. 실제 정본 경로는 쓰지 않는다. */
function fixture() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-correction-'));
    const file = (name: string) => path.join(directory, name);
    const files = { authoring: file('authoring.json'), ledger: file('ledger.json'), public: file('public.json'), encrypted: file('authoring.enc.json'),
        catalog: file('catalog.json'), initialReview: file('initial-review.json'), review: file('classification-review.json'),
        applied: file('applied'), stage: file('stage'), corrections: file('corrections') };
    const sets = (JSON.parse(fs.readFileSync(path.join(fixtureDirectory, 'bank.snapshot.json'), 'utf8')) as QuestionSetV3[]).filter((set) => peerIds.includes(set.id));
    const authoring = serializeBank(sets);
    fs.writeFileSync(files.authoring, authoring);
    const ledger = JSON.parse(fs.readFileSync(path.join(fixtureDirectory, 'promotions.snapshot.json'), 'utf8')) as PromotionLedger;
    // 소급 장부 항목만 남긴다. 과거 대표 채점 receipt 41건의 재생(검증마다 약 40초)은 이 경로의 검사 대상이 아니다.
    ledger.entries = ledger.entries.filter((entry) => peerIds.includes(entry.set_id) && !entry.content_hash);
    fs.writeFileSync(files.ledger, `${JSON.stringify(ledger, null, 2)}\n`);
    fs.writeFileSync(files.public, `${JSON.stringify(sets.map(compilePublicQuestionSet), null, 2)}\n`);
    fs.writeFileSync(files.encrypted, encryptAuthoringQuestionBankV3(authoring, secret));
    const entries = sets.flatMap((set) => set.subquestions.map((sub) => {
        const style = sub.question_style ?? (set.shared_context.facts.length ? 'case' : 'standard');
        return { set_id: set.id, subquestion_id: sub.id, question_style: style, topic_ids: sub.topic_ids ?? [set.classification.topic_id],
            standalone_prompt: style === 'standard' ? sub.prompt : null, case_fact_ids: [], reason: '격리 분류' };
    }));
    fs.writeFileSync(files.initialReview, `${JSON.stringify({ source_file: files.authoring, source_file_sha256: sha(authoring), entries }, null, 2)}\n`);
    fs.mkdirSync(files.corrections);
    const env: NodeJS.ProcessEnv = { ...process.env, CPA_QUESTION_V3_AUTHORING_PATH: files.authoring, CPA_QUESTION_V3_PROMOTIONS_PATH: files.ledger,
        CPA_QUESTION_V3_PUBLIC_PATH: files.public, CPA_QUESTION_V3_ENCRYPTED_PATH: files.encrypted, CPA_QUESTION_V3_ENCRYPTION_KEY: secret,
        CPA_QUESTION_V3_LEARNING_CATALOG_PATH: files.catalog, CPA_QUESTION_V3_CLASSIFICATION_REVIEW_PATH: files.review,
        CPA_QUESTION_CORRECTIONS_APPLIED_DIR: files.applied, CPA_QUESTION_CORRECTIONS_STAGE_DIR: files.stage };
    node(['scripts/build-learning-unit-catalog.ts', '--review', files.initialReview, '--output', files.catalog], env);
    const paths = { authoring: files.authoring, public: files.public, encrypted: files.encrypted, ledger: files.ledger, catalog: files.catalog,
        classificationReview: files.review, applied: files.applied, stage: files.stage };
    return { directory, files, sets, env, paths };
}
const bytes = (files: Record<string, string>) => Object.fromEntries(['authoring', 'ledger', 'public', 'encrypted', 'catalog']
    .map((name) => [name, fs.readFileSync(files[name])]));

/** CLI 비계를 만들고 criterion 하나의 명제를 고친다. */
function authorCorrection(f: ReturnType<typeof fixture>, set: QuestionSetV3) {
    const sub = set.subquestions[0], crit = sub.criteria[0];
    const id = `20260919-${set.id}--claim-subject`;
    const file = path.join(f.files.corrections, `${id}.json`);
    node(['cpa_uploader/correct_cpa_v3.ts', 'scaffold', '--set', set.id, '--slug', 'claim-subject', '--date', '20260919', '--summary', '명제의 주체를 분명히 한다',
        '--target', `crit=${sub.id}/${crit.id}:claim`, '--out', file], f.env);
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    value.patches[0].set = `${crit.claim} (감사인이)`;
    value.patches[0].reason = '누가 수행하는지 명제에 적는다.';
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    return file;
}

test('correction CLI checks, writes a subset evidence bank and installs only the corrected set', async () => {
    const real = canonicalFiles.map(snapshotFile);
    const f = fixture();
    try {
        const target = f.sets[0];
        const spec = authorCorrection(f, target);
        const before = bytes(f.files);
        const checked = node(['cpa_uploader/correct_cpa_v3.ts', 'check', spec], f.env);
        assert.match(checked, /은행 전체 검증 통과: 65세트/);
        assert.deepEqual(bytes(f.files), before, 'check writes nothing');

        const evidence = writeCorrectionEvidence(root, f.paths, [spec], path.join(f.directory, 'evidence'));
        const subset = JSON.parse(fs.readFileSync(path.join(f.directory, 'evidence/correction-bank.json'), 'utf8')) as QuestionSetV3[];
        assert.deepEqual(subset.map((set) => set.id), [target.id]);
        const catalog = JSON.parse(fs.readFileSync(path.join(f.directory, 'evidence/correction-catalog.json'), 'utf8'));
        assert.equal(catalog.source_file_sha256, sha(fs.readFileSync(path.join(f.directory, 'evidence/correction-bank.json'))));
        assert.ok(catalog.classifications.every((row: { source_content_hash: string }) => row.source_content_hash === contentHash(subset[0])));
        assert.equal(evidence.comparison.committed, false);

        // 검수 근거: 수정 후 전체 은행을 비교 은행으로 한 격리 receipt(테스트 전용 합성 기록).
        const candidate = applyCorrections(f.sets, [readCorrectionFile(spec).correction]).sets;
        const receipt = await offlineReviewReceipt(candidate[0], candidate);
        const reviewFile = path.join(f.directory, 'review.json');
        fs.writeFileSync(reviewFile, JSON.stringify({ schema_version: '1.0', reviews: [receipt] }));
        assert.match(node(['cpa_uploader/correct_cpa_v3.ts', 'publish', spec, '--evidence', '격리 게시'], f.env, false), /--efficient-review 또는 --review/);
        const staged = node(['cpa_uploader/correct_cpa_v3.ts', 'publish', spec, '--review', reviewFile, '--evidence', '격리 재검수 근거', '--stage-only'], f.env);
        assert.match(staged, /설치 안 함/);
        assert.deepEqual(bytes(f.files), before, 'stage-only never installs');
        node(['cpa_uploader/correct_cpa_v3.ts', 'publish', spec, '--review', reviewFile, '--evidence', '격리 재검수 근거'], f.env);

        const document = fs.readFileSync(f.files.authoring, 'utf8');
        assert.deepEqual(changedSetIds(before.authoring.toString('utf8'), document), [target.id]);
        assert.equal(document, serializeBank(candidate));
        const ledger = JSON.parse(fs.readFileSync(f.files.ledger, 'utf8')) as PromotionLedger;
        const prior = JSON.parse(before.ledger.toString('utf8')) as PromotionLedger;
        assert.deepEqual(ledger.entries.slice(0, prior.entries.length), prior.entries, 'the ledger is append-only');
        assert.deepEqual(ledger.entries.slice(prior.entries.length).map((entry) => [entry.set_id, entry.to_status]), [[target.id, 'verified'], [target.id, 'published']]);
        const publicBefore = JSON.parse(before.public.toString('utf8')), publicAfter = JSON.parse(fs.readFileSync(f.files.public, 'utf8'));
        assert.deepEqual(publicAfter, publicBefore, 'a criterion wording fix does not change the public bank');
        assert.equal(decryptAuthoringQuestionBankV3(fs.readFileSync(f.files.encrypted, 'utf8'), secret), document);
        node(['scripts/build-learning-unit-catalog.ts', '--check', '--output', f.files.catalog], f.env);
        const living = JSON.parse(fs.readFileSync(f.files.review, 'utf8'));
        assert.equal(living.source_file_sha256, sha(document));
        node(['cpa_uploader/validate_cpa_v3.ts'], f.env);

        const record = JSON.parse(fs.readFileSync(path.join(f.files.applied, `20260919-${target.id}--claim-subject.json`), 'utf8'));
        assert.equal(record.set_id, target.id);
        assert.equal(record.content_hash.after, reviewedContentHash(candidate[0]));
        assert.equal(record.spec.sha256, sha(fs.readFileSync(spec)));
        assert.equal(record.ledger_entries.length, 2);
        assert.equal(record.review.route, 'semantic_review');

        const installed = bytes(f.files);
        assert.match(node(['cpa_uploader/correct_cpa_v3.ts', 'publish', spec, '--review', reviewFile, '--evidence', '재시도'], f.env, false), /이미 게시 기록/);
        assert.match(node(['cpa_uploader/correct_cpa_v3.ts', 'check', spec], f.env, false), /이미 게시 기록/);
        assert.deepEqual(bytes(f.files), installed, 'a correction is applied once');
    } finally {
        fs.rmSync(f.directory, { recursive: true, force: true });
        assert.deepEqual(canonicalFiles.map(snapshotFile), real, 'real canonical files remain untouched');
    }
});

test('a correction made against an older set is refused before anything is staged', () => {
    const f = fixture();
    try {
        const target = f.sets[1];
        const spec = authorCorrection(f, target);
        // 다른 작업이 같은 세트의 다른 필드를 먼저 고쳤다.
        const moved = structuredClone(f.sets); moved[1].title = `${moved[1].title} (다른 작업)`;
        fs.writeFileSync(f.files.authoring, serializeBank(moved));
        const before = bytes(f.files);
        assert.match(node(['cpa_uploader/correct_cpa_v3.ts', 'check', spec], f.env, false), /작성 이후 바뀌었습니다/);
        assert.match(node(['cpa_uploader/correct_cpa_v3.ts', 'publish', spec, '--review', spec, '--evidence', '충돌'], f.env, false), /작성 이후 바뀌었습니다|분류 카탈로그/);
        assert.deepEqual(bytes(f.files), before);
        assert.equal(fs.existsSync(f.files.stage), false, 'nothing was staged');
        const renamed = path.join(f.files.corrections, 'other-name.json');
        fs.copyFileSync(spec, renamed);
        assert.match(node(['cpa_uploader/correct_cpa_v3.ts', 'check', renamed], f.env, false), /파일 이름은/);
    } finally { fs.rmSync(f.directory, { recursive: true, force: true }); }
});
