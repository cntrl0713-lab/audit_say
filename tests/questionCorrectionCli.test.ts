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
import { applySpecs } from '../cpa_uploader/questionReplacement.ts';
import { questionHash } from '../cpa_uploader/analysis/coverage/build-coverage.mjs';
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
        applied: file('applied'), stage: file('stage'), coverageLinks: file('links.json'), corrections: file('corrections') };
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
        CPA_QUESTION_CORRECTIONS_APPLIED_DIR: files.applied, CPA_QUESTION_CORRECTIONS_STAGE_DIR: files.stage, CPA_QUESTION_COVERAGE_LINKS_PATH: files.coverageLinks };
    node(['scripts/build-learning-unit-catalog.ts', '--review', files.initialReview, '--output', files.catalog], env);
    const paths = { authoring: files.authoring, public: files.public, encrypted: files.encrypted, ledger: files.ledger, catalog: files.catalog,
        classificationReview: files.review, applied: files.applied, stage: files.stage, coverageLinks: files.coverageLinks };
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
        const candidate = applySpecs(f.sets, [readCorrectionFile(spec).correction]).sets;
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

test('replacement CLI scaffolds a whole-set spec, demands coverage retargets, and installs a restructured set', async () => {
    const real = canonicalFiles.map(snapshotFile);
    const f = fixture();
    try {
        const target = f.sets.find((set) => set.subquestions.length === 2)!;
        const first = target.subquestions[0], second = target.subquestions[1];
        const linksFile = path.join(f.directory, 'links.json');
        fs.writeFileSync(linksFile, `${JSON.stringify({ version: 1, policy: '격리', links: [{ id: 'link-1', element_id: 'element-x', source_unit_ids: [],
            target: { set_id: target.id, subquestion_id: first.id, criterion_ids: [first.criteria[0].id] }, relationship: 'direct', review_status: 'reviewed', reason: '격리 관계',
            snapshot: { element_sha256: 'e', question_sha256: 'old', source_hashes: {}, source_metadata_hashes: {} } }] }, null, 2)}\n`);
        const env = { ...f.env, CPA_QUESTION_COVERAGE_LINKS_PATH: linksFile };
        const id = `20260922-${target.id}--restructure`;
        const spec = path.join(f.files.corrections, `${id}.json`);
        const scaffolded = node(['cpa_uploader/correct_cpa_v3.ts', 'scaffold', '--replace', '--set', target.id, '--slug', 'restructure', '--date', '20260922', '--summary', '물음을 하나 더한다', '--out', spec], env);
        assert.match(scaffolded, /은행 관계 1건: link-1/);
        assert.match(node(['cpa_uploader/correct_cpa_v3.ts', 'check', spec], env, false), /TODO 불가/);

        const value = JSON.parse(fs.readFileSync(spec, 'utf8'));
        const replacement = value.replacement as QuestionSetV3;
        const oldCrit = replacement.subquestions[0].criteria[0].id, newCrit = `${oldCrit}r`;
        replacement.subquestions[0].criteria[0].id = newCrit;
        const third = structuredClone(replacement.subquestions[1]);
        third.id = 'sub3'; third.prompt = `${second.prompt} (추가 물음)`;
        for (const requirement of third.requirements) requirement.id = `${requirement.id}r`;
        for (const criterion of third.criteria) { criterion.id = `${criterion.id}x`; criterion.requirement_id = `${criterion.requirement_id}r`; }
        replacement.subquestions.push(third);
        replacement.learning_order = [...replacement.learning_order, 'sub3'];
        value.lineage.reason = '둘째 물음을 복제해 셋째 물음으로 더하고 첫 criterion의 ID를 바꾼다(격리 테스트).';
        for (const row of value.lineage.subquestions) row.note = '그대로 승계';
        value.lineage.subquestions.push({ before: null, after: 'sub3', disposition: 'added', note: '둘째 물음의 복제' });
        for (const row of value.lineage.criteria) {
            row.note = '그대로 승계';
            if (row.before === `${first.id}/${oldCrit}`) { row.after = `${first.id}/${newCrit}`; row.disposition = 'rewritten'; row.note = 'ID 변경'; }
        }
        for (const criterion of third.criteria) value.lineage.criteria.push({ before: null, after: `sub3/${criterion.id}`, disposition: 'added', note: '복제' });
        const secondEntry = value.classification_entries.find((entry: { subquestion_id: string }) => entry.subquestion_id === second.id);
        value.classification_entries.push({ ...secondEntry, subquestion_id: 'sub3', standalone_prompt: secondEntry.question_style === 'standard' ? third.prompt : null });
        for (const entry of value.classification_entries) entry.reason = '격리 분류';
        fs.writeFileSync(spec, `${JSON.stringify(value, null, 2)}\n`);
        assert.match(node(['cpa_uploader/correct_cpa_v3.ts', 'check', spec], env, false), /coverage_retargets/);
        value.coverage_retargets = [{ link_id: 'link-1', target: { subquestion_id: first.id, criterion_ids: [newCrit] }, review_status: 'reviewed', reason: 'criterion ID만 바뀌었다.' }];
        fs.writeFileSync(spec, `${JSON.stringify(value, null, 2)}\n`);
        const checked = node(['cpa_uploader/correct_cpa_v3.ts', 'check', spec], env);
        assert.match(checked, /은행 전체 검증 통과: 65세트/);
        assert.match(checked, /관계 장부: 대상 관계 1건, 재연결 1건/);

        const candidate = applySpecs(f.sets, [readCorrectionFile(spec).correction]).sets;
        const receipt = await offlineReviewReceipt(candidate.find((set) => set.id === target.id)!, candidate);
        const reviewFile = path.join(f.directory, 'review-replacement.json');
        fs.writeFileSync(reviewFile, JSON.stringify({ schema_version: '1.0', reviews: [receipt] }));
        const before = bytes(f.files);
        node(['cpa_uploader/correct_cpa_v3.ts', 'publish', spec, '--review', reviewFile, '--evidence', '격리 교체 근거'], env);
        const document = fs.readFileSync(f.files.authoring, 'utf8');
        assert.deepEqual(changedSetIds(before.authoring.toString('utf8'), document), [target.id]);
        const installed = (JSON.parse(document) as QuestionSetV3[]).find((set) => set.id === target.id)!;
        assert.deepEqual(installed.subquestions.map((sub) => sub.id), [first.id, second.id, 'sub3']);
        const ledger = JSON.parse(fs.readFileSync(f.files.ledger, 'utf8')) as PromotionLedger;
        const prior = JSON.parse(before.ledger.toString('utf8')) as PromotionLedger;
        assert.deepEqual(ledger.entries.slice(prior.entries.length).map((entry) => [entry.set_id, entry.to_status]), [[target.id, 'verified'], [target.id, 'published']]);
        const links = JSON.parse(fs.readFileSync(linksFile, 'utf8'));
        assert.deepEqual(links.links[0].target, { set_id: target.id, subquestion_id: first.id, criterion_ids: [newCrit] });
        assert.equal(links.links[0].review_status, 'reviewed');
        assert.equal(links.links[0].snapshot.question_sha256, questionHash(installed, installed.subquestions[0]));
        node(['scripts/build-learning-unit-catalog.ts', '--check', '--output', f.files.catalog], env);
        const catalog = JSON.parse(fs.readFileSync(f.files.catalog, 'utf8'));
        assert.ok(catalog.classifications.some((row: { source_set_id: string; subquestion_id: string }) => row.source_set_id === target.id && row.subquestion_id === 'sub3'));
        node(['cpa_uploader/validate_cpa_v3.ts'], env);
        const record = JSON.parse(fs.readFileSync(path.join(f.files.applied, `${id}.json`), 'utf8'));
        assert.equal(record.artifact_type, 'question_set_replacement_application');
        assert.equal(record.lineage.reason, value.lineage.reason);
        assert.equal(record.coverage[0].link_id, 'link-1');
        assert.equal(record.content_hash.after, reviewedContentHash(installed));
        assert.match(node(['cpa_uploader/correct_cpa_v3.ts', 'check', spec], env, false), /이미 게시 기록/);
    } finally {
        fs.rmSync(f.directory, { recursive: true, force: true });
        assert.deepEqual(canonicalFiles.map(snapshotFile), real, 'real canonical files remain untouched');
    }
});
