// r16~r19 운영 반영의 재개 검증. import는 이미 커밋되었고(release 77fc4607, import-response.json 보존) driver.mjs --apply가 그 뒤 단정에서 멈춘 실행을 이어받는다.
// 멈춘 이유는 데이터가 아니라 driver.mjs:137의 단정이다. 이전 회차는 새 세트가 모두 사례형이어서 학습 단위를 `<세트>--case`로만 찾는데,
// 이번 묶음에는 기준서형 분리본 pilot-07-006-standards-20260920이 있어 그 단위 id가 `<세트>--sub4--standard`다(lib/learningUnits.ts learningUnitId).
// driver.mjs는 고치지 않는다. 그 바이트가 preparation.json의 code_files 해시로 고정되어 있고, 이 스크립트가 같은 guard를 다시 통과시켜야 하기 때문이다.
// 이 스크립트는 driver.mjs --apply의 커밋 이후 단계(왕복 검증 → receipt → 독립 검증 → completion)만 같은 계약으로 수행하며, 학습 단위 확인만 유형별로 고쳤다.
//   node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r16-r19/db-import/verify-v1.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { canonicalJson, contentHash } from '../../../../../../lib/learningSubmission.ts';
import { publicLearningSet } from '../../../../../../lib/learningPublic.ts';
import { buildLearningUnits, validateLearningClassification, learningUnitId } from '../../../../../../lib/learningUnits.ts';
import { learningCatalogForBank } from '../../../../../../scripts/import-question-bank-v3.ts';
import { P, N, T, PROJECT, RPC, STAGE, read, sha, ref, write, guard, buildLocal } from './contract.mjs';

const R = N + '/preparation-v1', O = N + '/publication-v1', SELF = fileURLToPath(import.meta.url);
const M = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/publication/db-migration';
const verifier = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/c/verify-final-learning-rollout.ts';
const learningMigration = 'supabase/migrations/20260911030000_cpa_question_learning_units.sql';
const bank = STAGE.authoring, catalogFile = STAGE.catalog;
const configured = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://invalid.local/');
const pick = (f) => ({ signature: f.signature, definition_sha256: f.definition_sha256, acl: f.acl, security_definer: f.security_definer });

async function query(sql, readOnly = true, parameters = [], timeout = 30000) {
    assert.equal(configured.protocol, 'https:'); assert.equal(configured.hostname, PROJECT + '.supabase.co'); assert(process.env.SUPABASE_ACCESS_TOKEN, 'Management token required; never recorded');
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sql, read_only: readOnly, ...(parameters.length ? { parameters } : {}) }), signal: AbortSignal.timeout(timeout) });
    let body; try { body = await response.json(); } catch { throw Object.assign(new Error('Management SQL returned an unreadable response; raw body omitted'), { http_status: response.status }); }
    if (!response.ok) throw Object.assign(new Error('Management SQL request failed; response omitted to protect source data'), { http_status: response.status });
    assert(Array.isArray(body), 'Unexpected Management SQL response shape'); return body;
}
const migrationAfter = () => { const c = read(M + '/completion.json'); assert.equal(c.status, 'case_retirement_guard_installed_and_verified'); guard([c.after]); return read(c.after.file); };
const names = () => migrationAfter().functions.map((f) => { assert(/^[a-z_]+$/.test(f.name)); return f.name; });
const inspectSql = () => `select jsonb_build_object('active',(select jsonb_build_object('release_id',id,'source_file_hash',source_file_hash,'source_document_sha256',encode(sha256(convert_to(source_document,'UTF8')),'hex')) from public.cpa_question_bank_releases where status='active'),'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'signature',p.oid::regprocedure::text,'definition_sha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),'acl',p.proacl::text,'security_definer',p.prosecdef) order by p.proname) from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in (${names().map((n) => "'" + n + "'").join(',')})),'default_role_settings_sha256',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(s) order by setdatabase,setrole),'[]'::jsonb)::text,'UTF8')),'hex') from pg_db_role_setting s)) as inspection`;
const state = async () => (await query(inspectSql()))[0].inspection;
const retirementDocument = () => fs.readFileSync(R + '/retirement-manifest.json', 'utf8');

assert(process.execArgv.includes('--env-file=.env.local'), 'Invoke with --env-file=.env.local');
assert(process.env.SUPABASE_ACCESS_TOKEN && process.env.SUPABASE_SERVICE_ROLE_KEY, 'Management and server credentials are required; values are never recorded');
assert(fs.existsSync(O + '/import-response.json'), 'This resume requires the preserved import response');
assert(!fs.existsSync(O + '/completion.json'), 'Publication already completed');
const prep = read(R + '/preparation.json'); assert.equal(prep.project, PROJECT); assert.equal(prep.rpc, RPC);
const probe = read(R + '/probe-result.json'); assert.equal(probe.result.payload_jsonb_sha256, prep.payload_jsonb_sha256);
const installed = read(P + '/install-completion.json'); assert.equal(installed.status, 'canonical_installed_and_validated');
const inputs = read(O + '/preparation.json').inputs; guard(inputs);
const built = buildLocal(retirementDocument());
assert.equal(ref(bank).sha256, prep.source_file_hash); assert.deepEqual(learningCatalogForBank(read(bank), read(catalogFile)), built.catalog);

const responseFile = O + '/import-response.json', response = read(responseFile).response;
assert.equal(response.length, 1); assert.equal(response[0].effective_role, 'service_role'); assert.equal(response[0].statement_timeout, '2min');
const data = response[0].receipt; assert(data?.release_id); assert.equal(data.set_count, built.sets.length); assert.equal(data.retirement_manifest_sha256, sha(retirementDocument()));

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: active, error: publicError } = await db.rpc('cpa_get_active_question_bank'); assert(!publicError && Array.isArray(active), 'Public roundtrip failed');
assert.deepEqual([...new Set(active.map((s) => s.release_id))], [data.release_id]);
const projected = active.map(publicLearningSet).map((s) => { delete s.release_id; delete s.set_version_id; for (const q of s.subquestions) delete q.logical_subquestion_id; return s; });
assert.equal(canonicalJson(projected), canonicalJson(built.compiled));
const { data: classes, error: classError } = await db.rpc('cpa_get_learning_classifications', { p_release_id: data.release_id }); assert(!classError && Array.isArray(classes), 'Classification roundtrip failed');
const rows = classes.map(validateLearningClassification), seen = new Set(); assert.equal(rows.length, built.catalog.learning_classifications.length);
for (const row of rows) { const key = row.source_set_id + '/' + row.subquestion_id; assert(!seen.has(key)); seen.add(key);
    const expected = built.catalog.learning_classifications.find((x) => x.set_id === row.source_set_id && x.subquestion_id === row.subquestion_id); assert(expected);
    assert.equal(row.question_style, expected.question_style); assert.equal(row.case_set_id, expected.question_style === 'case' ? expected.set_id : null); assert.equal(row.standalone_prompt, expected.standalone_prompt);
    assert.deepEqual([...row.topic_ids].sort(), [...expected.topic_ids].sort()); assert.deepEqual([...(row.case_fact_ids ?? [])].sort(), [...expected.case_fact_ids].sort()); }
const stored = (await query("select source_document,source_file_hash,bank_content_hash,public_content_hash,validation_report->'retirement_authorization' as retirement from public.cpa_question_bank_releases where id=$1::uuid and status='active'", true, [data.release_id]))[0];
assert(stored); assert.equal(stored.source_document, built.document); assert.equal(sha(stored.source_document), prep.source_file_hash);
for (const key of ['source_file_hash', 'bank_content_hash', 'public_content_hash']) assert.equal(stored[key], prep[key]);
assert.deepEqual(stored.retirement, built.metadata.retirement);
const retiredActive = await query("select count(*)::int as n from public.cpa_question_bank_release_items where release_id=$1::uuid and set_id=any($2::text[])", true, [data.release_id, `{${built.retiredIds.join(',')}}`]);
assert.equal(retiredActive[0].n, 0);
const topics = await query('select id,title,part,position from public.cpa_learning_topics order by position');
assert.deepEqual(topics, [...built.catalog.learning_topics].sort((a, b) => a.position - b.position));
const units = buildLearningUnits(active.map(publicLearningSet), rows, built.catalog.learning_topics), after = await state(), before = read(O + '/before.json');
assert.equal(after.active.release_id, data.release_id); assert.equal(after.active.source_file_hash, prep.source_file_hash); assert.equal(after.active.source_document_sha256, prep.source_file_hash);
assert.deepEqual(after.functions, before.functions); assert.equal(after.default_role_settings_sha256, before.default_role_settings_sha256); guard(inputs);

// 학습 단위 확인(고친 부분): 사례형은 세트당 한 단위, 기준서형은 물음마다 한 단위다(learningUnitId).
const unitChecks = [];
for (const id of built.newIds) {
    const set = built.sets.find((s) => s.id === id);
    const styles = [...new Set(set.subquestions.map((q) => built.catalog.learning_classifications.find((c) => c.set_id === id && c.subquestion_id === q.id)?.question_style))];
    assert.equal(styles.length, 1, 'Mixed styles in a new set: ' + id); const style = styles[0]; assert(style, 'Missing classification for ' + id);
    if (style === 'case') {
        const unit = units.find((u) => u.id === learningUnitId(id, 'case')); assert(unit, 'New case unit missing: ' + id);
        assert.deepEqual(unit.subquestions.map((q) => q.prompt), set.subquestions.map((q) => q.prompt));
        unitChecks.push({ set_id: id, question_style: style, unit_ids: [unit.id], subquestions: unit.subquestions.length });
    } else {
        const ids = [];
        for (const q of set.subquestions) {
            const unit = units.find((u) => u.id === learningUnitId(id, 'standard', q.id)); assert(unit, 'New standard unit missing: ' + id + '/' + q.id);
            assert.deepEqual(unit.subquestions.map((x) => x.prompt), [q.prompt]); assert.deepEqual(unit.shared_context?.facts ?? [], []); ids.push(unit.id);
        }
        unitChecks.push({ set_id: id, question_style: style, unit_ids: ids, subquestions: set.subquestions.length });
    }
}
for (const id of built.retiredIds) assert(!units.some((u) => u.id.startsWith(id + '--')), 'Retired unit still active: ' + id);

write(O + '/roundtrip.json', { status: 'passed', checked_at: new Date().toISOString(), source_bytes_identical: true, public_round_trip: true, learning_classification_round_trip: true, learning_topic_round_trip: true,
    transaction_guarded_retained_versions_and_classifications_preserved: true, retired_set_ids: built.retiredIds, new_set_ids: built.newIds, retirement_authorization_stored: true, classification_count: rows.length, learning_unit_count: units.length,
    new_unit_checks: unitChecks, source_file_hash: prep.source_file_hash, public_content_hash: contentHash(projected), functions_and_acl_unchanged: true, default_role_and_database_settings_unchanged: true, after, original_response: ref(responseFile),
    resumed_by: { file: path.relative(process.cwd(), SELF).split(path.sep).join('/'), reason: 'driver.mjs --apply가 커밋 뒤 학습 단위 확인에서 멈췄다. 사례형만 가정한 단위 id 규칙 때문이며 데이터 문제가 아니다. driver.mjs는 code_files 해시 고정 때문에 고치지 않았다.' } });
write(O + '/receipt.json', { applied_at: read(O + '/apply-started.json').started_at, project_host: PROJECT + '.supabase.co', applied: true, ...data, source_file_hash: prep.source_file_hash, bank_content_hash: prep.bank_content_hash, public_round_trip: true,
    source_bytes_identical: true, content_review_performed: true, progress_initialized: false, learning_classification_count: rows.length, learning_unit_count: units.length, transport: prep.transport, statement_timeout_ms: 120000,
    import_preparation: ref(R + '/preparation.json'), original_response: ref(responseFile), roundtrip: ref(O + '/roundtrip.json') });
const receipt = read(O + '/receipt.json'); assert.equal(receipt.release_id, data.release_id); assert.equal(receipt.source_file_hash, prep.source_file_hash); assert.equal(receipt.bank_content_hash, prep.bank_content_hash);
const evidence = O + '/verification-evidence.json';
write(evidence, { applied: receipt.applied, release_id: receipt.release_id, project_host: receipt.project_host, source_file_hash: receipt.source_file_hash, bank_content_hash: receipt.bank_content_hash,
    public_content_hash: prep.public_content_hash, provenance: { receipt: ref(O + '/receipt.json'), readiness: ref(O + '/readiness.json'), import_preparation: ref(R + '/preparation.json') } });
guard([read(evidence).provenance.receipt, read(evidence).provenance.readiness]);

if (!fs.existsSync(O + '/verification.json')) {
    const log = O + '/02-verify.log'; assert(!fs.existsSync(log), 'Prior independent verification requires separate reviewed continuation');
    const fd = fs.openSync(log, 'wx'), started = Date.now(); let result;
    const env = { ...process.env }; for (const key of Object.keys(env)) if (/OPENAI|ANTHROPIC/i.test(key)) delete env[key]; delete env.NODE_OPTIONS;
    try { result = spawnSync(process.execPath, ['--import', 'tsx', verifier, '--read-live', '--bank', bank, '--learning-catalog', catalogFile, '--evidence', evidence, '--expected-bank-sha256', ref(bank).sha256, '--expected-catalog-sha256', ref(catalogFile).sha256,
        '--expected-evidence-sha256', ref(evidence).sha256, '--migration', learningMigration, '--expected-migration-sha256', ref(learningMigration).sha256, '--expected-project', PROJECT, '--output', O + '/verification.json'], { shell: false, windowsHide: true, stdio: ['ignore', fd, fd], env }); } finally { fs.closeSync(fd); }
    write(O + '/02-verify.result.json', { id: '02-verify', exit_code: result.status, signal: result.signal, elapsed_ms: Date.now() - started, log: ref(log) });
    assert.equal(result.status, 0, 'Independent verification failed; inspect the preserved result');
}
const verification = read(O + '/verification.json'); assert.equal(verification.status, 'passed'); guard(inputs);
write(O + '/completion.json', { status: 'production_published_and_independently_verified', completed_at: new Date().toISOString(), release_id: receipt.release_id, project_host: receipt.project_host,
    files: [bank, catalogFile, O + '/receipt.json', O + '/verification.json'].map(ref), counts: verification.actual, retired_set_ids: built.retiredIds, new_set_ids: built.newIds,
    inputs_preserved: true, model_api_calls: 0, import_preparation: ref(R + '/preparation.json'),
    resume_note: 'import는 driver.mjs --apply(2026-09-20)가 한 번 실행해 커밋했고, 그 실행이 학습 단위 확인 단정에서 멈춰 이 스크립트가 커밋 이후 검증만 이어받았다. 새 모델 호출·DB 쓰기는 없다.' });
console.log(JSON.stringify({ status: 'production_published_and_independently_verified', release_id: receipt.release_id, counts: verification.actual, new_unit_checks: unitChecks }, null, 2));
assert.equal(path.resolve(process.argv[1]), SELF);
