import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import type { QuestionSetV3 } from '../lib/questionV3.ts';
import { compilePublicQuestionSet } from '../lib/questionV3.ts';
import { contentHash } from '../lib/learningSubmission.ts';
import { learningCatalogForBank } from '../scripts/import-question-bank-v3.ts';
import { serializeBank } from '../cpa_uploader/questionCorrection.ts';
import {
    applyTextPatches, assertReleaseInspection, buildReleaseDelta, buildReleaseDeltaSql, compressReleasePack, COMPRESSED_PACK_PASSPHRASE,
    proveReleaseDeltaLocally, releaseInspectionSql,
} from '../cpa_uploader/questionReleaseDelta.ts';
import type { ReleaseDelta, ReleaseInspection } from '../cpa_uploader/questionReleaseDelta.ts';
import { createLearningUnitsDatabase } from './helpers/cpaLearningUnitsDatabase.ts';
import { sampleQuestionSet } from './helpers/cpaLearningDatabase.ts';

const metadataMigration = fs.readFileSync(new URL('../supabase/migrations/20260912060000_cpa_private_source_metadata.sql', import.meta.url), 'utf8');
const memoMigration = fs.readFileSync(new URL('../supabase/migrations/20260921120000_cpa_question_version_source_memo.sql', import.meta.url), 'utf8');
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const topics = [{ id: '01', title: '감사기초', part: 'PART1', position: 1 }];
const catalog = { topics, classifications: [] };

function standardSet(id: string): QuestionSetV3 {
    const set = sampleQuestionSet(id);
    set.subquestions = [set.subquestions[0]]; set.learning_order = ['sub1']; set.shared_context.facts = [];
    const sub = set.subquestions[0];
    sub.type = 'descriptive'; sub.question_style = 'standard'; sub.topic_ids = ['01']; sub.prompt = `${id}의 원칙을 설명하시오.`;
    return set;
}
function caseSet(id: string): QuestionSetV3 {
    const set = sampleQuestionSet(id);
    set.title = `${id} 사례`;
    for (const sub of set.subquestions) { sub.question_style = 'case'; sub.topic_ids = ['01']; sub.prompt = `${id}의 ${sub.id} 사실을 판단하시오.`; }
    return set;
}
function importPayload(sets: QuestionSetV3[]) {
    const document = serializeBank(sets);
    return { sets, source_document: document, source_file_hash: sha(document), bank_content_hash: contentHash({ sets, applicability: {} }),
        public_content_hash: contentHash(sets.map(compilePublicQuestionSet)), evidence: 'isolated release delta baseline', applicability: {},
        ...learningCatalogForBank(sets, catalog) };
}
async function scalar<T>(db: PGlite, sql: string, params: unknown[] = []): Promise<T> {
    return (await db.query<{ v: T }>(`select ${sql} as v`, params)).rows[0].v;
}
async function inspect(db: PGlite): Promise<ReleaseInspection> {
    return assertReleaseInspection((await db.query<{ inspection: unknown }>(releaseInspectionSql())).rows[0].inspection);
}
async function activeItems(db: PGlite) {
    return scalar<{ set_id: string; set_version_id: string; position: number }[]>(db,
        "(select jsonb_agg(jsonb_build_object('set_id',i.set_id,'set_version_id',i.set_version_id,'position',i.position) order by i.position) from cpa_question_bank_release_items i join cpa_question_bank_releases r on r.id=i.release_id and r.status='active')");
}
/** active 릴리스의 판본 조회 메모 적용률(20260921120000). 셋이 같아야 모든 판본이 메모 경로로 조회된다. */
async function memoCoverage(db: PGlite) {
    return scalar<{ items: number; memo_items: number; memo_versions: number }>(db,
        "(select jsonb_build_object('items',(select count(*) from cpa_question_bank_release_items i where i.release_id=r.id),'memo_items',(select count(*) from cpa_question_bank_release_item_source s where s.release_id=r.id),'memo_versions',(select count(*) from cpa_question_bank_release_items i join cpa_question_set_version_source v on v.set_version_id=i.set_version_id where i.release_id=r.id)) from cpa_question_bank_releases r where r.status='active')");
}
async function setup(options: { pgcrypto?: boolean } = {}) {
    const db = await createLearningUnitsDatabase(options.pgcrypto ? { extensions: { pgcrypto } } : {});
    await db.exec(metadataMigration);
    await db.exec(memoMigration);
    // Supabase처럼 pgcrypto를 extensions 스키마에 두고 service_role이 쓸 수 있게 한다.
    if (options.pgcrypto) await db.exec('create schema extensions; create extension pgcrypto with schema extensions; grant usage on schema extensions to service_role;');
    const sets = [standardSet('std-a'), caseSet('case-b'), standardSet('std-c')];
    await scalar(db, 'cpa_import_learning_question_bank($1::jsonb)', [JSON.stringify(importPayload(sets))]);
    return { db, sets, baseline: serializeBank(sets) };
}
async function prepared(db: PGlite, baseline: string, next: QuestionSetV3[], evidence = 'question-release test; corrections: fixture') {
    const inspection = await inspect(db);
    const delta = buildReleaseDelta({ baselineDocument: baseline, document: serializeBank(next), catalog, evidence });
    const proof = await proveReleaseDeltaLocally(delta, baseline);
    const expected = { release_id: inspection.active!.release_id, source_file_hash: inspection.active!.source_file_hash, set_count: inspection.active!.set_count };
    const functions = inspection.functions.map(({ signature, definition_sha256 }) => ({ signature, definition_sha256 }));
    return { delta, proof, inspection, sql: buildReleaseDeltaSql(delta, expected, functions, proof.payloadHash),
        probe: buildReleaseDeltaSql(delta, expected, functions, proof.payloadHash, 'probe') };
}
function lastRow(results: Awaited<ReturnType<PGlite['exec']>>, column: string) {
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]).filter((row) => column in row);
    return rows.at(-1);
}

test('delta patches reproduce the canonical bytes and reject removals, reorders and unchanged banks', () => {
    const sets = [standardSet('std-a'), caseSet('case-b'), standardSet('std-c')];
    const baseline = serializeBank(sets);
    const next = structuredClone(sets); next[1].subquestions[0].criteria[0].claim += ' 보완'; next.push(standardSet('std-d'));
    const delta: ReleaseDelta = buildReleaseDelta({ baselineDocument: baseline, document: serializeBank(next), catalog, evidence: 'fixture' });
    assert.deepEqual(delta.replacedIds, ['case-b']);
    assert.deepEqual(delta.appendedIds, ['std-d']);
    assert.equal(applyTextPatches(baseline, delta.patches), serializeBank(next));
    assert.ok(delta.patches.every((patch) => patch.text.length < serializeBank(next).length / 2), 'only changed sets travel');
    assert.throws(() => buildReleaseDelta({ baselineDocument: baseline, document: serializeBank(sets.slice(1)), catalog, evidence: 'x' }), /순서|적습니다/);
    assert.throws(() => buildReleaseDelta({ baselineDocument: baseline, document: serializeBank([sets[1], sets[0], sets[2]]), catalog, evidence: 'x' }), /순서/);
    assert.throws(() => buildReleaseDelta({ baselineDocument: baseline, document: baseline, catalog, evidence: 'x' }), /변경이 없습니다/);
    const draft = structuredClone(next); draft[3].status = 'verified';
    assert.throws(() => buildReleaseDelta({ baselineDocument: baseline, document: serializeBank(draft), catalog, evidence: 'x' }), /게시·검수/);
    assert.throws(() => buildReleaseDelta({ baselineDocument: `${baseline} `, document: serializeBank(next), catalog, evidence: 'x' }), /직렬화/);
});

test('the local proof detects a changed baseline even when the first or every set is replaced', async () => {
    const sets = [standardSet('std-a'), caseSet('case-b')];
    const baseline = serializeBank(sets);
    const first = structuredClone(sets); first[0].title += ' 보완';
    const all = structuredClone(first); all[1].title += ' 보완';
    for (const next of [first, all]) {
        const delta = buildReleaseDelta({ baselineDocument: baseline, document: serializeBank(next), catalog, evidence: 'fixture' });
        const { proof } = await proveReleaseDeltaLocally(delta, baseline);
        assert.equal(proof.tampered_baseline_detected, true);
        assert.equal(proof.final_source_sha256, sha(serializeBank(next)));
    }
});

test('delta SQL publishes only the corrected set as a new version through the real importer', async () => {
    const { db, sets, baseline } = await setup();
    try {
        const before = await activeItems(db);
        assert.deepEqual(await memoCoverage(db), { items: 3, memo_items: 0, memo_versions: 0 }, 'a release imported without the release tool has no memo yet');
        const next = structuredClone(sets); next[1].subquestions[0].criteria[0].claim += ' 보완';
        const { sql, probe, proof } = await prepared(db, baseline, next);
        const probed = lastRow(await db.exec(probe), 'payload_jsonb_sha256')!;
        assert.equal(probed.payload_jsonb_sha256, proof.payloadHash);
        assert.equal(probed.unchanged_sets_identical, true);
        assert.equal(probed.transaction_read_only, 'on');
        assert.deepEqual(await activeItems(db), before, 'probe does not write');
        assert.deepEqual(await memoCoverage(db), { items: 3, memo_items: 0, memo_versions: 0 }, 'probe does not back-fill');
        const receipt = lastRow(await db.exec(sql), 'receipt')!.receipt as { release_id: string; reused: boolean };
        assert.equal(receipt.reused, false);
        const after = await activeItems(db);
        assert.deepEqual(after.map((item) => item.set_id), ['std-a', 'case-b', 'std-c']);
        assert.equal(after[0].set_version_id, before[0].set_version_id);
        assert.equal(after[2].set_version_id, before[2].set_version_id);
        assert.notEqual(after[1].set_version_id, before[1].set_version_id);
        const stored = await scalar<string>(db, "(select source_document from cpa_question_bank_releases where status='active')");
        assert.equal(stored, serializeBank(next));
        // 같은 transaction에서 새 릴리스의 판본 조회 메모를 채운다. 점검 결과도 같은 적용률을 보고한다.
        assert.deepEqual(await memoCoverage(db), { items: 3, memo_items: 3, memo_versions: 3 });
        assert.deepEqual((await inspect(db)).memo, { items: 3, memo_items: 3, memo_versions: 3 });
        const evidence = await scalar<string[]>(db, "(select jsonb_agg(evidence) from cpa_question_review_events where set_version_id=$1::uuid)", [after[1].set_version_id]);
        assert.ok(evidence.every((text) => text.includes('question-release test')));
        // 같은 SQL을 다시 보내면 기준 릴리스가 바뀌었으므로 아무것도 쓰지 않고 거절한다.
        await assert.rejects(db.exec(sql), /Active baseline changed/);
        await db.exec('rollback');
        assert.deepEqual(await activeItems(db), after);
    } finally { await db.close(); }
});

test('delta SQL appends new sets and refuses tampered packs or changed reviewed functions', async () => {
    const { db, sets, baseline } = await setup();
    try {
        const before = await activeItems(db);
        const next = [...structuredClone(sets), standardSet('std-d')];
        const { sql, delta } = await prepared(db, baseline, next);
        const tamperedText = delta.patches[0].text.replace('std-d의 원칙', 'std-d의 변조 원칙');
        assert.notEqual(tamperedText, delta.patches[0].text);
        const tampered = sql.replace(JSON.stringify(delta.patches[0].text).slice(1, -1), JSON.stringify(tamperedText).slice(1, -1));
        assert.notEqual(tampered, sql);
        // 복원 payload의 해시가 다르면 guard가 payload를 null로 바꾸고 importer가 거절한다.
        await assert.rejects(db.exec(tampered), /Complete learning catalog required/);
        await db.exec('rollback');
        assert.deepEqual(await activeItems(db), before, 'a tampered pack writes nothing');
        await db.exec("create or replace function public.cpa_normalize_fact(p_value text) returns text language sql immutable as $$select lower(regexp_replace(coalesce(p_value,''),'\\s+','','g'))$$");
        await assert.rejects(db.exec(sql), /Reviewed function changed/);
        await db.exec('rollback');
        assert.deepEqual(await activeItems(db), before);
    } finally { await db.close(); }
    const fresh = await setup();
    try {
        const before = await activeItems(fresh.db);
        const next = [...structuredClone(fresh.sets), standardSet('std-d')];
        const { sql } = await prepared(fresh.db, fresh.baseline, next);
        await fresh.db.exec(sql);
        const after = await activeItems(fresh.db);
        assert.deepEqual(after.slice(0, 3), before);
        assert.equal(after[3].set_id, 'std-d');
        assert.equal(after[3].position, 4);
        assert.deepEqual(await memoCoverage(fresh.db), { items: 4, memo_items: 4, memo_versions: 4 }, 'appended sets are memoised too');
    } finally { await fresh.db.close(); }
});

test('compressed transport restores the same payload in PostgreSQL, rejects wrong or tampered containers and publishes once', async () => {
    const { db, sets, baseline } = await setup({ pgcrypto: true });
    try {
        const before = await activeItems(db);
        const next = structuredClone(sets); next[1].subquestions[0].criteria[0].claim += ' 보완'; next[2].title += ' 보완';
        const inspection = await inspect(db);
        const delta = buildReleaseDelta({ baselineDocument: baseline, document: serializeBank(next), catalog, evidence: 'question-release compressed test' });
        const compressed = await compressReleasePack(delta);
        const transport = { kind: 'compressed' as const, base64: compressed.base64 };
        const { payloadHash, proof } = await proveReleaseDeltaLocally(delta, baseline, transport);
        assert.equal(proof.transport, 'compressed');
        assert.equal(payloadHash, (await proveReleaseDeltaLocally(delta, baseline)).payloadHash, 'both transports restore the same payload');
        const expected = { release_id: inspection.active!.release_id, source_file_hash: inspection.active!.source_file_hash, set_count: inspection.active!.set_count };
        const functions = inspection.functions.map(({ signature, definition_sha256 }) => ({ signature, definition_sha256 }));
        const sql = buildReleaseDeltaSql(delta, expected, functions, payloadHash, 'apply', transport);
        const probe = buildReleaseDeltaSql(delta, expected, functions, payloadHash, 'probe', transport);
        assert.ok(!sql.includes(JSON.stringify(delta.patches[0].text).slice(1, 60)), 'patch text does not travel as plain SQL');
        assert.ok(sql.length < buildReleaseDeltaSql(delta, expected, functions, payloadHash).length, 'the compressed request is smaller');
        const probed = lastRow(await db.exec(probe), 'payload_jsonb_sha256')!;
        assert.equal(probed.payload_jsonb_sha256, payloadHash);
        assert.equal(probed.unchanged_sets_identical, true);
        assert.equal(probed.transaction_read_only, 'on');
        // 잘못된 암호로는 풀리지 않고, 공개 암호로 다시 만든 변조 pack은 payload 해시 guard가 막는다. 둘 다 쓰지 않는다.
        await assert.rejects(db.exec(sql.replaceAll(`'${COMPRESSED_PACK_PASSPHRASE}'`, "'wrong-passphrase'")), /Wrong key or corrupt data/);
        await db.exec('rollback');
        const tamperedDelta = { ...delta, patches: delta.patches.map((patch, index) => index ? patch : { ...patch, text: patch.text.replace('보완', '변조') }) };
        assert.notEqual(tamperedDelta.patches[0].text, delta.patches[0].text);
        const tampered = sql.replace(compressed.base64, (await compressReleasePack(tamperedDelta)).base64);
        await assert.rejects(db.exec(tampered), /Complete learning catalog required/);
        await db.exec('rollback');
        assert.deepEqual(await activeItems(db), before, 'rejected containers write nothing');
        const receipt = lastRow(await db.exec(sql), 'receipt')!.receipt as { reused: boolean };
        assert.equal(receipt.reused, false);
        const after = await activeItems(db);
        assert.equal(after[0].set_version_id, before[0].set_version_id);
        assert.notEqual(after[1].set_version_id, before[1].set_version_id);
        assert.notEqual(after[2].set_version_id, before[2].set_version_id);
        assert.equal(await scalar<string>(db, "(select source_document from cpa_question_bank_releases where status='active')"), serializeBank(next));
        assert.deepEqual(await memoCoverage(db), { items: 3, memo_items: 3, memo_versions: 3 });
        await assert.rejects(db.exec(sql), /Active baseline changed/);
        await db.exec('rollback');
    } finally { await db.close(); }
});
