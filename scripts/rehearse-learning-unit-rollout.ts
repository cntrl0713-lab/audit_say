import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createLearningUnitsDatabase, applyLearningUnitsMigration } from '../tests/helpers/cpaLearningUnitsDatabase.ts';
import { memberId } from '../tests/helpers/cpaLearningDatabase.ts';
import { contentHash } from '../lib/learningSubmission.ts';
import { publicLearningSet } from '../lib/learningPublic.ts';
import { buildLearningUnits } from '../lib/learningUnits.ts';
import type { LearningClassification, LearningTopic } from '../lib/learningUnits.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';

const directory = 'cpa_uploader/analysis/reviews/question-unit-migration-2026-09-11';
const snapshotFile = `${directory}/remote-before.json`;
const catalogFile = 'cpa_uploader/data/learning-question-classifications.json';
const migrationFile = 'supabase/migrations/20260911030000_cpa_question_learning_units.sql';
const outputFile = `${directory}/rehearsal.json`;
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
type Release = { id: string; status: string; bank_content_hash: string; public_content_hash: string };
type SourceVersion = {
    id: string; set_id: string; revision: number; release_ids: string[]; content_hash: string;
    sealed_at: string; question_set: QuestionSetV3;
};
type Snapshot = { inspected_at: string; project: string; releases: Release[]; versions: SourceVersion[]; counts: Record<string, number> };
type Catalog = { source_file: string; source_file_sha256: string; review_file: string; review_file_sha256: string;
    topics: LearningTopic[]; classifications: LearningClassification[] };
type LocalRelease = { release_id: string; set_count: number; question_versions: Array<{ set_id: string; set_version_id: string }> };
type VersionMapping = {
    remote_version_id: string; local_version_id: string; set_id: string; question_count: number;
    remote_source_content_hash: string; local_source_content_hash: string; source_document_hash: string;
    private_before_hash: string; public_before_hash: string; private_after_hash?: string; public_after_hash?: string;
};
async function scalar<T>(db: PGlite, sql: string, params: unknown[] = []): Promise<T> {
    return (await db.query<{ value: T }>(`select ${sql} as value`, params)).rows[0].value;
}
function differences(left: unknown, right: unknown, at = ''): Array<{ path: string; before: unknown; after: unknown }> {
    if (contentHash(left ?? null) === contentHash(right ?? null)) return [];
    if (left && right && typeof left === 'object' && typeof right === 'object' && Array.isArray(left) === Array.isArray(right)) {
        return [...new Set([...Object.keys(left), ...Object.keys(right)])].flatMap(key => differences(
            (left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key], `${at}/${key}`));
    }
    return [{ path: at, before: left ?? null, after: right ?? null }];
}
function privateKeyPaths(value: unknown, at = ''): string[] {
    if (!value || typeof value !== 'object') return [];
    const forbidden = new Set(['model_answer', 'criteria', 'requirements', 'critical_facts', 'source_quote', 'source_refs', 'decision_correct']);
    return Object.entries(value).flatMap(([key, item]) => [
        ...(forbidden.has(key) ? [`${at}/${key}`] : []), ...privateKeyPaths(item, `${at}/${key}`),
    ]);
}

/** Offline only: no environment loading, network client, remote connection or model call. */
export async function main() {
    if (fs.existsSync(outputFile)) throw new Error(`기존 리허설 증거를 덮어쓰지 않습니다: ${outputFile}`);
    const startedAt = new Date().toISOString();
    const guardedFiles = [snapshotFile, catalogFile, migrationFile,
        'supabase/migrations/20260908024413_cpa_question_bank_rpc.sql',
        'tests/helpers/cpaLearningUnitsDatabase.ts', 'tests/helpers/cpaLearningDatabase.ts',
        'lib/learningUnits.ts', 'lib/learningPublic.ts'];
    const inputs: Record<string, string> = Object.fromEntries(guardedFiles.map(file => [file, sha(fs.readFileSync(file))]));
    const snapshot: Snapshot = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
    const catalog: Catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
    for (const [file, expected] of [[catalog.source_file, catalog.source_file_sha256], [catalog.review_file, catalog.review_file_sha256]]) {
        assert.equal(sha(fs.readFileSync(file)), expected, `Catalog dependency changed: ${file}`);
        inputs[file] = expected;
    }
    assert.equal(snapshot.versions.length, 109);
    assert.equal(snapshot.versions.reduce((sum, version) => sum + version.question_set.subquestions.length, 0), 222);
    assert.equal(catalog.classifications.length, 212);
    const byQuestion = new Map(catalog.classifications.map(row => [`${row.source_set_id}/${row.subquestion_id}`, row]));
    assert.equal(byQuestion.size, catalog.classifications.length);
    const reviewedSources: QuestionSetV3[] = JSON.parse(fs.readFileSync(catalog.source_file, 'utf8'));
    const historicalDifferences: Array<{ source_version_id: string; set_id: string; differences: ReturnType<typeof differences> }> = [];
    for (const version of snapshot.versions) {
        const canonical = reviewedSources.find(set => set.id === version.set_id);
        assert.ok(canonical, `No reviewed source: ${version.set_id}`);
        assert.deepEqual(version.question_set.shared_context, canonical.shared_context);
        for (const sub of version.question_set.subquestions) {
            const current: QuestionSetV3['subquestions'][number] | undefined = canonical.subquestions.find(q => q.id === sub.id);
            assert.ok(current); assert.equal(sub.prompt, current.prompt); assert.deepEqual(sub.model_answer, current.model_answer);
        }
        const changes = differences(version.question_set, canonical);
        if (changes.length) historicalDifferences.push({ source_version_id: version.id, set_id: version.set_id, differences: changes });
    }
    const db = await createLearningUnitsDatabase({ applyLearningUnits: false });
    const mapping = new Map<string, VersionMapping>();
    const localReleases: Array<{ remote: Release; local: LocalRelease }> = [];
    const report: Record<string, unknown> = { format: 1, started_at: startedAt, environment: 'isolated local PGlite',
        status: 'running', snapshot_inspected_at: snapshot.inspected_at, inputs, remote_network_calls: 0,
        remote_writes: 0, model_calls: 0, source_files_modified: false,
        scope: 'Snapshot reconstruction and metadata migration only; no semantic review, grading or publication authorization.',
        historical_source_differences: historicalDifferences };
    try {
        // Preserve source chronology: the first import is retired only by the
        // second real release. No source status or review label is rewritten.
        const releases = [...snapshot.releases].sort((a, b) => Number(a.status === 'active') - Number(b.status === 'active'));
        for (const release of releases) {
            const versions = snapshot.versions.filter(version => version.release_ids.includes(release.id)).sort((a, b) => a.set_id.localeCompare(b.set_id));
            const sets = versions.map(version => version.question_set);
            assert.ok(sets.every(set => set.status === 'published' && set.verification.review_status === 'verified'));
            const payload = { sets, source_document: JSON.stringify(sets), source_file_hash: sha(JSON.stringify(sets)),
                bank_content_hash: release.bank_content_hash, public_content_hash: release.public_content_hash,
                evidence: 'Offline reconstruction of the already-published remote snapshot; no new content review.', actor_user_id: memberId };
            const local = await scalar<LocalRelease>(db, 'cpa_import_question_bank($1)', [JSON.stringify(payload)]);
            assert.equal(local.set_count, versions.length);
            localReleases.push({ remote: release, local });
            for (const version of versions) {
                const id = local.question_versions.find(item => item.set_id === version.set_id)?.set_version_id;
                assert.ok(id);
                const privateSet = await scalar<QuestionSetV3>(db, 'cpa_get_question_version($1)', [id]);
                const rawDifferences = differences(version.question_set, privateSet);
                assert.deepEqual(rawDifferences, [], `Reconstruction changed source ${version.set_id}: ${JSON.stringify(rawDifferences)}`);
                const publicSet = await scalar(db, 'cpa_get_public_question_version($1)', [id]);
                assert.deepEqual(privateKeyPaths(publicSet), []);
                const existing = mapping.get(version.id);
                if (existing) assert.equal(existing.local_version_id, id, 'Shared versions must be reused across releases');
                else mapping.set(version.id, { remote_version_id: version.id, local_version_id: id, set_id: version.set_id,
                    question_count: privateSet.subquestions.length, remote_source_content_hash: version.content_hash,
                    local_source_content_hash: await scalar<string>(db, '(select content_hash from cpa_question_set_versions where id=$1)', [id]),
                    source_document_hash: contentHash(version.question_set), private_before_hash: contentHash(privateSet), public_before_hash: contentHash(publicSet) });
            }
        }
        assert.equal(mapping.size, 109);
        assert.equal(await scalar(db, '(select count(*)::int from cpa_subquestion_versions)'), 222);
        const sourceHashesBefore = await scalar(db, '(select jsonb_agg(jsonb_build_array(id,content_hash) order by id) from cpa_question_set_versions)');
        const releaseStateBefore = await scalar(db, '(select jsonb_agg(to_jsonb(r) order by id) from cpa_question_bank_releases r)');
        const sourcePublicBefore = await scalar(db, 'cpa_get_active_question_bank()');
        await applyLearningUnitsMigration(db);
        const classificationImports: Array<Record<string, unknown>> = [];
        for (const { remote, local } of localReleases) {
            const entries = snapshot.versions.filter(version => version.release_ids.includes(remote.id)).flatMap(version => version.question_set.subquestions.map(sub => {
                const row = byQuestion.get(`${version.set_id}/${sub.id}`); assert.ok(row);
                return { set_id: version.set_id, subquestion_id: sub.id, source_content_hash: mapping.get(version.id)!.local_source_content_hash,
                    question_style: row.question_style, topic_ids: row.topic_ids, standalone_prompt: row.standalone_prompt, case_fact_ids: row.case_fact_ids ?? [] };
            }));
            const payload = { release_id: local.release_id, topics: catalog.topics, entries };
            const rows = await scalar<LearningClassification[]>(db, 'cpa_import_learning_classifications($1)', [JSON.stringify(payload)]);
            assert.equal(rows.length, entries.length);
            const versionCount = await scalar(db, '(select count(*)::int from cpa_learning_question_versions)');
            const repeated = await scalar<LearningClassification[]>(db, 'cpa_import_learning_classifications($1)', [JSON.stringify(payload)]);
            assert.deepEqual(repeated, rows);
            assert.equal(await scalar(db, '(select count(*)::int from cpa_learning_question_versions)'), versionCount);
            classificationImports.push({ remote_release_id: remote.id, local_release_id: local.release_id, status: remote.status,
                questions: rows.length, classification_rows_hash: contentHash(rows), repeated_rows_hash: contentHash(repeated), idempotent: true });
        }
        const metadataCount = await scalar<number>(db, '(select count(*)::int from cpa_learning_question_versions)');
        assert.equal(metadataCount, 222);
        assert.equal(await scalar(db, '(select count(distinct source_subquestion_version_id)::int from cpa_learning_question_versions)'), 222);
        assert.equal(await scalar(db, '(select count(*)::int from cpa_learning_questions)'), 212);
        for (const value of mapping.values()) {
            const privateSet = await scalar<QuestionSetV3>(db, 'cpa_get_question_version($1)', [value.local_version_id]);
            const publicSet = await scalar(db, 'cpa_get_public_question_version($1)', [value.local_version_id]);
            value.private_after_hash = contentHash(privateSet); value.public_after_hash = contentHash(publicSet);
            assert.equal(value.private_after_hash, value.private_before_hash); assert.equal(value.public_after_hash, value.public_before_hash);
            assert.deepEqual(privateKeyPaths(publicSet), []);
        }
        assert.deepEqual(await scalar(db, '(select jsonb_agg(jsonb_build_array(id,content_hash) order by id) from cpa_question_set_versions)'), sourceHashesBefore);
        assert.deepEqual(await scalar(db, '(select jsonb_agg(to_jsonb(r) order by id) from cpa_question_bank_releases r)'), releaseStateBefore);
        assert.deepEqual(await scalar(db, 'cpa_get_active_question_bank()'), sourcePublicBefore);
        const active = localReleases.find(item => item.remote.status === 'active')!;
        const activeRows = await scalar<LearningClassification[]>(db, 'cpa_get_learning_classifications($1)', [active.local.release_id]);
        const publicEnvelopes = await scalar<unknown[]>(db, 'cpa_get_active_question_bank()');
        const units = buildLearningUnits(publicEnvelopes.map(publicLearningSet), activeRows, catalog.topics);
        assert.equal(activeRows.length, 212);
        assert.equal(activeRows.filter(row => row.question_style === 'standard').length, 208);
        assert.equal(activeRows.filter(row => row.question_style === 'case').length, 4);
        for (const unit of units) {
            assert.deepEqual(privateKeyPaths(unit), []);
            assert.ok(unit.subquestions.every(sub => sub.question_style === unit.question_style));
            if (unit.question_style === 'standard') {
                assert.equal(unit.subquestions.length, 1); assert.equal(unit.case_set_id, null); assert.deepEqual(unit.shared_context.facts, []);
            } else { assert.ok(unit.case_set_id); assert.ok(unit.shared_context.facts.length); }
        }
        assert.equal(await scalar(db, '(select count(*)::int from cpa_learning_question_topics t left join cpa_learning_topics r on r.id=t.topic_id where r.id is null)'), 0);
        assert.deepEqual((await db.query<LearningTopic>('select * from cpa_learning_topics order by position')).rows, catalog.topics);
        for (const [file, hash] of Object.entries(inputs)) assert.equal(sha(fs.readFileSync(file)), hash, `Input changed during rehearsal: ${file}`);
        Object.assign(report, { status: 'passed', finished_at: new Date().toISOString(), source_versions: 109, source_question_versions: 222,
            stable_learning_questions: 212, classification_versions: metadataCount, release_imports: classificationImports,
            active: { source_sets: publicEnvelopes.length, questions: activeRows.length, standard_questions: 208, case_questions: 4,
                learning_units: units.length, standard_units: units.filter(unit => unit.question_style === 'standard').length,
                case_units: units.filter(unit => unit.question_style === 'case').length,
                topic_links: activeRows.reduce((sum, row) => sum + row.topic_ids.length, 0) },
            registered_topics: catalog.topics.length,
            total_topic_links: await scalar(db, '(select count(*)::int from cpa_learning_question_topics)'),
            checks: { snapshot_private_roundtrip: 'exact', all_109_private_and_public_versions_unchanged: true,
                release_records_unchanged: true, source_hashes_unchanged: true, public_private_fields_absent: true,
                standard_parent_null_and_facts_empty: true, topic_foreign_keys_valid: true, repeated_import_added_versions: 0,
                authoring_and_review_input_hashes_unchanged: true },
            source_content_hash_note: 'Local source hash may differ because snapshot reconstruction lacks original applicability metadata; local UUID/hash mapping is explicit and source document equality is checked independently.',
            versions: [...mapping.values()] });
    } catch (error) {
        Object.assign(report, { status: 'failed', finished_at: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error), versions_reconstructed: mapping.size, versions: [...mapping.values()] });
        throw error;
    } finally {
        await db.close();
        fs.writeFileSync(outputFile, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
        console.log(JSON.stringify({ output: outputFile, status: report.status, source_versions: report.source_versions,
            classification_versions: report.classification_versions, active: report.active, remote_writes: 0, model_calls: 0 }, null, 2));
    }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
