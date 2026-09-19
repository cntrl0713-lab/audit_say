import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { compilePublicQuestionSet } from '../lib/questionV3.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';
import { contentHash } from '../lib/learningSubmission.ts';
import { learningCatalogForBank } from '../scripts/import-question-bank-v3.ts';
import type { PromotionLedger } from '../cpa_uploader/questionBankPublication.ts';
import { serializeBank } from '../cpa_uploader/questionCorrection.ts';
import { main, runRelease } from '../cpa_uploader/publish_question_release.ts';
import type { SqlTransport } from '../cpa_uploader/publish_question_release.ts';
import { createLearningUnitsDatabase } from './helpers/cpaLearningUnitsDatabase.ts';

const root = process.cwd();
const fixtureDirectory = 'cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14';
const peerIds = [3, 4, 3, 3, 4, 4, 3, 4, 3, 3, 3, 3, 3, 4, 4, 4, 3, 3, 4].flatMap((count, topic) =>
    Array.from({ length: count }, (_, index) => `pilot-${String(topic + 1).padStart(2, '0')}-${String(index + 1).padStart(3, '0')}`));
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const project = 'abcdefghijklmnopqrst';

/**
 * Management API처럼 마지막으로 행을 돌려준 문장의 행을 돌려주는 로컬 PostgreSQL 전송.
 * 읽기 전용 요청은 운영처럼 함수 실행 권한이 없는 supabase_read_only_user(pg_read_all_data)로 실행한다.
 */
function localTransport(db: PGlite): SqlTransport {
    return async <T>(sql: string, readOnly: boolean, parameters: unknown[] = []) => {
        if (readOnly) await db.exec('set role supabase_read_only_user');
        try {
            if (parameters.length) return (await db.query<T>(sql, parameters)).rows;
            const results = await db.exec(sql);
            return (results.filter((result) => result.fields.length).at(-1)?.rows ?? []) as T[];
        } finally {
            if (readOnly) await db.exec('rollback; reset role');
        }
    };
}

function withEnvironment<T>(values: Record<string, string>, run: () => Promise<T>): Promise<T> {
    const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
    Object.assign(process.env, values);
    return run().finally(() => {
        for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
    });
}

test('release CLI inspects, prepares, probes, applies once and verifies an in-place correction', async (t) => {
    t.mock.method(console, 'log', () => {});
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-release-'));
    const file = (name: string) => path.join(directory, name);
    const db = await createLearningUnitsDatabase({ extensions: { pgcrypto } });
    try {
        await db.exec(fs.readFileSync('supabase/migrations/20260912060000_cpa_private_source_metadata.sql', 'utf8'));
        // 압축 전송 검사용: Supabase처럼 pgcrypto를 extensions 스키마에 둔다.
        await db.exec('create schema extensions; create extension pgcrypto with schema extensions; grant usage on schema extensions to service_role;');
        // 운영의 supabase_read_only_user처럼 모든 행을 읽되(RLS 우회) 함수 실행 권한은 없다.
        await db.exec('create role supabase_read_only_user bypassrls; grant pg_read_all_data to supabase_read_only_user;');
        const sets = (JSON.parse(fs.readFileSync(path.join(fixtureDirectory, 'bank.snapshot.json'), 'utf8')) as QuestionSetV3[]).filter((set) => peerIds.includes(set.id));
        const baseline = serializeBank(sets);
        const entries = (bank: QuestionSetV3[]) => bank.flatMap((set) => set.subquestions.map((sub) => {
            const style = sub.question_style ?? (set.shared_context.facts.length ? 'case' : 'standard');
            return { set_id: set.id, subquestion_id: sub.id, question_style: style, topic_ids: sub.topic_ids ?? [set.classification.topic_id],
                standalone_prompt: style === 'standard' ? sub.prompt : null, case_fact_ids: [], reason: '격리 분류' };
        }));
        const env: Record<string, string> = { CPA_QUESTION_V3_AUTHORING_PATH: file('authoring.json'), CPA_QUESTION_V3_PUBLIC_PATH: file('public.json'),
            CPA_QUESTION_V3_PROMOTIONS_PATH: file('ledger.json'), CPA_QUESTION_V3_ENCRYPTED_PATH: file('authoring.enc.json'),
            CPA_QUESTION_V3_LEARNING_CATALOG_PATH: file('catalog.json'), CPA_QUESTION_RELEASES_DIR: file('releases'),
            CPA_QUESTION_RELEASES_TMP_DIR: file('scratch'), CPA_QUESTION_CORRECTIONS_APPLIED_DIR: file('applied') };
        const writeBank = (bank: QuestionSetV3[]) => {
            const document = serializeBank(bank);
            fs.writeFileSync(file('authoring.json'), document);
            fs.writeFileSync(file('public.json'), `${JSON.stringify(bank.map(compilePublicQuestionSet), null, 2)}\n`);
            fs.writeFileSync(file('review.json'), JSON.stringify({ source_file: file('authoring.json'), source_file_sha256: sha(document), entries: entries(bank) }));
            fs.rmSync(file('catalog.json'), { force: true });
            const built = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/build-learning-unit-catalog.ts', '--review', file('review.json'), '--output', file('catalog.json')],
                { cwd: root, encoding: 'utf8' });
            assert.equal(built.status, 0, built.stderr);
            return JSON.parse(fs.readFileSync(file('catalog.json'), 'utf8'));
        };
        const ledger = JSON.parse(fs.readFileSync(path.join(fixtureDirectory, 'promotions.snapshot.json'), 'utf8')) as PromotionLedger;
        ledger.entries = ledger.entries.filter((entry) => peerIds.includes(entry.set_id) && !entry.content_hash);
        fs.writeFileSync(file('ledger.json'), `${JSON.stringify(ledger, null, 2)}\n`);
        const baselineCatalog = writeBank(sets);
        await db.query('select cpa_import_learning_question_bank($1::jsonb)', [JSON.stringify({ sets, source_document: baseline, source_file_hash: sha(baseline),
            bank_content_hash: contentHash({ sets, applicability: {} }), public_content_hash: contentHash(sets.map(compilePublicQuestionSet)),
            evidence: 'isolated release baseline', applicability: {}, ...learningCatalogForBank(sets, baselineCatalog) })]);
        fs.writeFileSync(file('baseline.json'), baseline);

        // 정본에 설치된 수정: 세트 하나의 criterion 명제.
        const next = structuredClone(sets);
        next[2].subquestions[0].criteria[0].claim += ' (감사인이)';
        writeBank(next);
        const transport = localTransport(db);
        const run = '20260919-claim-subject';
        await withEnvironment(env, async () => {
            await runRelease('inspect', { run, project }, root, transport);
            await assert.rejects(runRelease('probe', { run, project }, root, transport), /prepare를 먼저/);
            const preparation = await runRelease('prepare', { run, baselineFile: file('baseline.json') }, root) as { replaced_set_ids: string[]; unrecorded_changed_set_ids: string[] };
            assert.deepEqual(preparation.replaced_set_ids, [sets[2].id]);
            assert.deepEqual(preparation.unrecorded_changed_set_ids, [sets[2].id], 'no correction record exists in this fixture');
            const records = path.join(file('releases'), run);
            assert.ok(fs.statSync(path.join(records, 'preparation.json')).size < 20_000, 'committed records stay small; SQL lives in tmp');
            await assert.rejects(runRelease('apply', { run, project, expectedPreparation: 'a'.repeat(64) }, root, transport), /probe를 먼저|expected-preparation/);
            await runRelease('probe', { run, project }, root, transport);
            const prepSha = sha(fs.readFileSync(path.join(records, 'preparation.json')));
            await assert.rejects(runRelease('apply', { run, project, expectedPreparation: 'a'.repeat(64) }, root, transport), /검토한 preparation/);
            await runRelease('apply', { run, project, expectedPreparation: prepSha }, root, transport);
            await assert.rejects(runRelease('apply', { run, project, expectedPreparation: prepSha }, root, transport), /자동 재시도하지 않습니다/);
            await runRelease('verify', { run, project }, root, transport);
            const completion = JSON.parse(fs.readFileSync(path.join(records, 'completion.json'), 'utf8'));
            assert.equal(completion.status, 'production_published_and_verified');
            assert.deepEqual(completion.replaced_set_ids, [sets[2].id]);
            const stored = (await db.query<{ ok: boolean }>("select encode(sha256(convert_to(source_document,'UTF8')),'hex')=$1 as ok from cpa_question_bank_releases where status='active'",
                [sha(serializeBank(next))])).rows[0];
            assert.equal(stored.ok, true);
            // 같은 준비물로 다른 실행을 시작해도 운영이 이미 정본과 같으므로 준비 단계에서 멈춘다.
            await runRelease('inspect', { run: '20260919-again', project }, root, transport);
            await assert.rejects(runRelease('prepare', { run: '20260919-again', baselineFile: file('baseline.json') }, root), /이미 현재 정본/);

            // 많은 세트를 바꾼 릴리스처럼 압축 전송으로 준비해도 같은 절차로 게시되고, 기록에 전송 방식과 요청 크기가 남는다.
            const second = structuredClone(next);
            second[3].subquestions[0].criteria[0].claim += ' (재확인)';
            fs.writeFileSync(file('baseline-2.json'), serializeBank(next));
            writeBank(second);
            const compressedRun = '20260919-compressed-pack';
            await runRelease('inspect', { run: compressedRun, project }, root, transport);
            const packed = await runRelease('prepare', { run: compressedRun, baselineFile: file('baseline-2.json'), transport: 'compressed' }, root) as {
                transport: { kind: string; confidentiality_claim: boolean }; request_bytes: { apply: number; probe: number }; sql: { file: string } };
            assert.equal(packed.transport.kind, 'compressed');
            assert.equal(packed.transport.confidentiality_claim, false);
            assert.ok(packed.request_bytes.apply > 0 && packed.request_bytes.probe > 0);
            assert.ok(!fs.readFileSync(path.resolve(root, packed.sql.file), 'utf8').includes('(재확인)'), 'the correction travels only inside the compressed container');
            await runRelease('probe', { run: compressedRun, project }, root, transport);
            const packedRecords = path.join(file('releases'), compressedRun);
            await runRelease('apply', { run: compressedRun, project, expectedPreparation: sha(fs.readFileSync(path.join(packedRecords, 'preparation.json'))) }, root, transport);
            await runRelease('verify', { run: compressedRun, project }, root, transport);
            assert.deepEqual(JSON.parse(fs.readFileSync(path.join(packedRecords, 'completion.json'), 'utf8')).replaced_set_ids, [sets[3].id]);
        });
    } finally {
        await db.close();
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test('prepare rejects an unknown --transport before touching records', async () => {
    await assert.rejects(main(['prepare', '--run', '20260919-unknown-transport', '--transport', 'zip']), /--transport/);
    assert.ok(!fs.existsSync(path.join(root, 'cpa_uploader/releases/20260919-unknown-transport')));
});
