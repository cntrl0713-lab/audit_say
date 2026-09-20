// 사례형 지정 검토 r16~r19의 운영 DB 반영: 원 9세트 퇴역과 새 5세트 추가를 한 릴리스로 적용한다. publication-r13-r15/db-import/driver.mjs를 옮겼다.
// 새 5세트에는 r17에서 분리 보존한 기준서형 세트 pilot-07-006-standards-20260920이 포함된다(퇴역 없이 추가만 한다).
//   --prepare : 사례형 퇴역 함수 설치 결과(r01~r04 반영의 publication/db-migration/after.json, 2026-09-16 적용)와 직전 운영 반영(사례형 r12~r15, release 3518cda6)을 읽기 전용으로 참조해
//               퇴역 manifest, 로컬 복원 증명, guarded SQL을 만든다(네트워크 없음). 새 마이그레이션은 실행하지 않는다.
//   --probe   : 같은 복원 SQL을 운영 DB의 read-only 트랜잭션에서 실행해 payload 해시만 대조한다(쓰기 없음). 한 준비당 한 번만 성공한다.
//   --apply   : 검토한 SQL을 한 번 실행하고 왕복·독립 검증까지 수행한다. 실패 시 자동 재시도하지 않는다.
//   --inspect : 사전 조건 없이 현재 active release만 그대로 읽어 보고한다(쓰기 없음, 몇 번이든 재실행 가능). apply가 불확실하게 끝났을 때 커밋 여부를 확인한다.
//   node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r16-r19/db-import/driver.mjs <mode> [--expected-preparation-sha256 SHA]
// 기록(준비·probe·반영 결과)은 이 폴더에, 전송 pack·SQL 사본은 커밋하지 않는 tmp/case-review-publication-r16-r19/db-import/에 둔다.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { canonicalJson, contentHash } from '../../../../../../lib/learningSubmission.ts';
import { publicLearningSet } from '../../../../../../lib/learningPublic.ts';
import { buildLearningUnits, validateLearningClassification } from '../../../../../../lib/learningUnits.ts';
import { learningCatalogForBank, validateRetirementManifest } from '../../../../../../scripts/import-question-bank-v3.ts';
import { P, N, T, PROJECT, RPC, STAGE, PRIOR_RELEASE, plan, read, sha, ref, write, guard, baselineSource, buildLocal, buildSql, localProof } from './contract.mjs';

const R = N + '/preparation-v1', RT = T + '/db-import/preparation-v1', O = N + '/publication-v1';
// 사례형 퇴역 함수 마이그레이션은 r01~r04 반영 때 한 번 적용했고 그대로 운영에 있다. 새로 실행하지 않고 그 완료 기록을 읽기 전용으로(함수 정의 확인에만) 참조한다.
const M = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/publication/db-migration';
const bank = STAGE.authoring, publicFile = STAGE.public, catalogFile = STAGE.catalog;
const verifier = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/c/verify-final-learning-rollout.ts';
const learningMigration = 'supabase/migrations/20260911030000_cpa_question_learning_units.sql';
const mode = process.argv[2]; assert(['--prepare', '--probe', '--apply', '--inspect'].includes(mode));
if (mode === '--apply') { assert.equal(process.argv.length, 5); assert.equal(process.argv[3], '--expected-preparation-sha256'); } else assert.equal(process.argv.length, 3);
const configured = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://invalid.local/');
const pick = (f) => ({ signature: f.signature, definition_sha256: f.definition_sha256, acl: f.acl, security_definer: f.security_definer });

async function query(sql, readOnly = true, parameters = [], timeout = 30000) {
    assert.equal(configured.protocol, 'https:'); assert.equal(configured.hostname, PROJECT + '.supabase.co'); assert(process.env.SUPABASE_ACCESS_TOKEN, 'Management token required; never recorded');
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sql, read_only: readOnly, ...(parameters.length ? { parameters } : {}) }), signal: AbortSignal.timeout(timeout) });
    let body; try { body = await response.json(); } catch { throw Object.assign(new Error('Management SQL returned an unreadable response; raw body omitted'), { http_status: response.status, sqlstate: null }); }
    if (!response.ok) { const text = typeof body?.message === 'string' ? body.message : ''; throw Object.assign(new Error('Management SQL request failed; response omitted to protect source data'), { http_status: response.status, sqlstate: text.match(/ERROR:\s+([0-9A-Z]{5}):/)?.[1] ?? null, exception: text.match(/ERROR:\s+[0-9A-Z]{5}:\s*([^\n]{0,160})/)?.[1] ?? null }); }
    assert(Array.isArray(body), 'Unexpected Management SQL response shape'); return body;
}
const migrationAfter = () => { const c = read(M + '/completion.json'); assert.equal(c.status, 'case_retirement_guard_installed_and_verified'); guard([c.after]); return read(c.after.file); };
const names = () => migrationAfter().functions.map((f) => { assert(/^[a-z_]+$/.test(f.name)); return f.name; });
const inspectSql = () => `select jsonb_build_object('active',(select jsonb_build_object('release_id',id,'source_file_hash',source_file_hash,'source_document_sha256',encode(sha256(convert_to(source_document,'UTF8')),'hex')) from public.cpa_question_bank_releases where status='active'),'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'signature',p.oid::regprocedure::text,'definition_sha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),'acl',p.proacl::text,'security_definer',p.prosecdef) order by p.proname) from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in (${names().map((n) => "'" + n + "'").join(',')})),'default_role_settings_sha256',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(s) order by setdatabase,setrole),'[]'::jsonb)::text,'UTF8')),'hex') from pg_db_role_setting s)) as inspection`;
const state = async () => (await query(inspectSql()))[0].inspection;
const retirementDocument = () => fs.readFileSync(R + '/retirement-manifest.json', 'utf8');

if (mode === '--prepare') {
    assert(!fs.existsSync(R + '/preparation.json'), 'Preserve the existing preparation'); assert(!fs.existsSync(O), 'A DB attempt already exists; inspect it before preparing another');
    const installed = read(P + '/install-completion.json'); assert.equal(installed.status, 'canonical_installed_and_validated');
    const after = migrationAfter(), functions = after.functions.map(pick);
    const prior = read(PRIOR_RELEASE + '/completion.json'), priorVerification = read(PRIOR_RELEASE + '/verification.json');
    assert.equal(prior.status, 'production_published_and_independently_verified'); assert.equal(priorVerification.status, 'passed'); assert.deepEqual(priorVerification.failures, []);
    const baselineDocument = baselineSource().document, baselineSets = JSON.parse(baselineDocument);
    const expected = { release_id: prior.release_id, source_file_hash: sha(baselineDocument), set_count: baselineSets.length };
    // 직전 운영 반영이 실제로 적용한 원문(완료 기록의 해시)이 이번 기준 원문과 같은 바이트인지 대조한다.
    assert.equal(prior.files.find((f) => f.file.endsWith('/stage/authoring.json')).sha256, expected.source_file_hash, 'Prior release source differs from this round\'s baseline source');
    assert.equal(priorVerification.actual.sets, baselineSets.length, 'Prior release set count differs from this round\'s baseline source');
    const stageDocument = fs.readFileSync(STAGE.authoring, 'utf8'), sets = JSON.parse(stageDocument);
    const retired = [...plan().retiredIds].sort();
    const manifest = { version: 1, artifact_type: 'question_bank_retirement_manifest',
        authorization: `2026-09-20 사용자 지시 “설계서에 따라서 사례형 문제 제작해서 대체해줘”·“정본 설치하고 운영 반영까지 진행해줘”; ${P}/authorization.md sha256 ${ref(P + '/authorization.md').sha256}; 계획 ${P}/plan.json sha256 ${ref(P + '/plan.json').sha256}; 수락 ${P}/acceptance-completion.json sha256 ${ref(P + '/acceptance-completion.json').sha256}`,
        expected_active_release_id: expected.release_id, expected_active_source_file_hash: expected.source_file_hash, candidate_source_file_hash: sha(stageDocument),
        retired_set_ids: retired, historical_versions_and_learning_attempts: 'preserve', retirement_count: retired.length };
    const document = JSON.stringify(manifest, null, 2) + '\n';
    assert.deepEqual(validateRetirementManifest(document, sha(document), sha(stageDocument), sets), manifest);
    fs.mkdirSync(R, { recursive: true }); fs.writeFileSync(R + '/retirement-manifest.json', document, { flag: 'wx' });
    const built = buildLocal(document), proof = await localProof(built);
    const sql = buildSql(proof.pack, expected, functions, proof.payloadHash), probeSql = buildSql(proof.pack, expected, functions, proof.payloadHash, 'probe');
    const code = ['driver.mjs', 'contract.mjs'].map((name) => N + '/' + name), runtime = ['scripts/import-question-bank-v3.ts', 'lib/questionV3.ts', 'lib/learningSubmission.ts', 'lib/learningPublic.ts', 'lib/learningUnits.ts', verifier, learningMigration];
    // 공유 정본이 아니라 이 회차가 실제로 반영하는 stage 산출물과 기준 원문 사본을 잠근다.
    const inputs = [...Object.values(STAGE).map(ref), built.readinessRef, ...[P + '/stage-completion.json', P + '/install-completion.json', P + '/baseline.json', P + '/plan.json', P + '/authorization.md', P + '/acceptance-completion.json',
        M + '/completion.json', M + '/after.json', PRIOR_RELEASE + '/completion.json', PRIOR_RELEASE + '/verification.json', T + '/baseline/authoring.json', R + '/retirement-manifest.json', ...code, ...runtime].map(ref)]; guard(inputs);
    fs.mkdirSync(RT, { recursive: true });
    write(RT + '/replace-pack.json', proof.pack); fs.writeFileSync(RT + '/guarded-import.sql', sql, { flag: 'wx' }); fs.writeFileSync(RT + '/probe.sql', probeSql, { flag: 'wx' });
    const requestBytes = Buffer.byteLength(JSON.stringify({ query: sql, read_only: false }));
    write(R + '/local-proof.json', { ...proof.proof, checked_at: new Date().toISOString(), sql_transport_bytes: requestBytes, api_calls: 0, db_writes: 0 });
    write(R + '/preparation.json', { version: 1, status: 'locally_prepared_not_applied', prepared_at: new Date().toISOString(), project: PROJECT, rpc: RPC, expected, functions, inputs, baseline_source: built.baselineRef,
        pack: ref(RT + '/replace-pack.json'), sql: ref(RT + '/guarded-import.sql'), probe_sql: ref(RT + '/probe.sql'), transport_copies_committed: false,
        proof: ref(R + '/local-proof.json'), retirement_manifest: ref(R + '/retirement-manifest.json'), payload_jsonb_sha256: proof.payloadHash, source_file_hash: sha(built.document),
        bank_content_hash: built.metadata.bank_content_hash, public_content_hash: built.metadata.public_content_hash, retired_set_ids: built.retiredIds, new_set_ids: built.newIds, statement_timeout_ms: 120000, request_bytes: requestBytes,
        transport: 'management-sql-with-stored-baseline-retire-and-append', changes_to_default_role_or_database_policy: 0, api_calls: 0, db_writes: 0, model_api_calls: 0 });
    console.log(JSON.stringify({ status: 'locally_prepared_not_applied', preparation: ref(R + '/preparation.json'), local_proof: proof.proof, sql_transport_bytes: requestBytes }, null, 2));
} else if (mode === '--probe') {
    const prep = read(R + '/preparation.json'); guard([...prep.inputs, prep.pack, prep.sql, prep.probe_sql, prep.proof, prep.retirement_manifest]); assert(!fs.existsSync(R + '/probe-result.json'));
    const built = buildLocal(retirementDocument()), pack = read(prep.pack.file);
    assert.equal(fs.readFileSync(prep.probe_sql.file, 'utf8'), buildSql(pack, prep.expected, prep.functions, prep.payload_jsonb_sha256, 'probe'));
    const before = await state(); assert.deepEqual(before.functions.map(pick), prep.functions); assert.equal(before.active.release_id, prep.expected.release_id);
    const started = Date.now(); let result;
    try { result = await query(fs.readFileSync(prep.probe_sql.file, 'utf8'), true, [], 150000); }
    catch (error) { write(R + '/probe-failure.json', { failed_at: new Date().toISOString(), elapsed_ms: Date.now() - started, message: error.message, http_status: error.http_status ?? null, sqlstate: error.sqlstate ?? null, exception: error.exception ?? null, api_read_only: true, sql_read_only: true, db_writes: 0 }); throw error; }
    assert.equal(result.length, 1); const row = result[0];
    assert.equal(row.statement_timeout, '2min'); assert.equal(row.transaction_read_only, 'on');
    assert.equal(row.payload_jsonb_sha256, prep.payload_jsonb_sha256, 'Production reconstruction differs from the local payload'); assert.equal(row.source_file_hash, sha(built.document)); assert.equal(row.retained_identical_retired_omitted_new_appended, true);
    assert.deepEqual(await state(), before, 'Database changed during read-only probe');
    write(R + '/probe-result.json', { checked_at: new Date().toISOString(), elapsed_ms: Date.now() - started, read_only_transaction: true, api_read_only: true, result: row, active_release_id: before.active.release_id, db_writes: 0 });
    console.log(JSON.stringify({ status: 'probe_passed', elapsed_ms: Date.now() - started, ...row }));
} else if (mode === '--apply') {
    const value = process.argv[4]; assert.equal(value, ref(R + '/preparation.json').sha256, 'Only the reviewed preparation may run');
    assert(process.execArgv.includes('--env-file=.env.local'), 'Invoke with --env-file=.env.local');
    assert.equal(configured.protocol, 'https:'); assert.equal(configured.hostname, PROJECT + '.supabase.co'); assert.equal(configured.port, ''); assert.equal(configured.username, ''); assert.equal(configured.password, ''); assert.equal(configured.search, ''); assert.equal(configured.hash, ''); assert.equal(configured.pathname, '/');
    assert(process.env.SUPABASE_ACCESS_TOKEN && process.env.SUPABASE_SERVICE_ROLE_KEY, 'Management and server credentials are required; values are never recorded');
    const prep = read(R + '/preparation.json'); assert.equal(prep.project, PROJECT); assert.equal(prep.rpc, RPC);
    const probe = read(R + '/probe-result.json'); assert.equal(probe.result.payload_jsonb_sha256, prep.payload_jsonb_sha256);
    const installed = read(P + '/install-completion.json'); assert.equal(installed.status, 'canonical_installed_and_validated');
    const built = buildLocal(retirementDocument());
    assert.equal(ref(bank).sha256, prep.source_file_hash); assert.equal(canonicalJson(read(publicFile)), canonicalJson(built.compiled)); assert.deepEqual(learningCatalogForBank(read(bank), read(catalogFile)), built.catalog);
    const inputs = [...prep.inputs, prep.pack, prep.sql, prep.probe_sql, prep.proof, prep.retirement_manifest, ref(R + '/preparation.json'), ref(R + '/probe-result.json')]; guard(inputs);
    const pack = read(prep.pack.file); assert.deepEqual(pack, { metadata: built.metadata, patches: built.patches.map(({ kind, index, set_id, start, end, text }) => ({ kind, index, set_id, start, end, text })) });
    assert.equal(fs.readFileSync(prep.sql.file, 'utf8'), buildSql(pack, prep.expected, prep.functions, prep.payload_jsonb_sha256));
    if (!fs.existsSync(O)) {
        const before = await state(); assert.equal(before.active.release_id, prep.expected.release_id); assert.equal(before.active.source_file_hash, prep.expected.source_file_hash); assert.equal(before.active.source_document_sha256, prep.expected.source_file_hash); assert.deepEqual(before.functions.map(pick), prep.functions); guard(inputs);
        fs.mkdirSync(O); write(O + '/before.json', { checked_at: new Date().toISOString(), ...before }); write(O + '/preparation.json', { prepared_at: new Date().toISOString(), inputs, authorization: P + '/authorization.md', import_preparation: ref(R + '/preparation.json') });
        fs.copyFileSync(STAGE.readiness, O + '/readiness.json', fs.constants.COPYFILE_EXCL);
        write(O + '/apply-started.json', { started_at: new Date().toISOString(), preparation: ref(R + '/preparation.json'), sql: prep.sql, expected_active: prep.expected, transport: prep.transport, statement_timeout_ms: 120000, automatic_retry: false });
        const started = Date.now();
        try { const response = await query(fs.readFileSync(prep.sql.file, 'utf8'), false, [], 150000); write(O + '/import-response.json', { received_at: new Date().toISOString(), elapsed_ms: Date.now() - started, response }); }
        catch (error) { write(O + '/import-failure.json', { failed_at: new Date().toISOString(), elapsed_ms: Date.now() - started, message: error.message, http_status: error.http_status ?? null, sqlstate: error.sqlstate ?? null, exception: error.exception ?? null, outcome: 'uncertain_until_readback', automatic_retry: false }); throw error; }
    } else assert(fs.existsSync(O + '/import-response.json'), 'Prior attempt may have committed without a preserved response; inspect the database state instead of retrying');
    assert(!fs.existsSync(O + '/completion.json'), 'Publication already completed'); guard(read(O + '/preparation.json').inputs);
    const responseFile = O + '/import-response.json', response = read(responseFile).response; assert.equal(response.length, 1); assert.equal(response[0].effective_role, 'service_role'); assert.equal(response[0].statement_timeout, '2min');
    const data = response[0].receipt; assert(data?.release_id); assert.equal(data.set_count, built.sets.length); assert.equal(data.retirement_manifest_sha256, sha(retirementDocument()));
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: active, error: publicError } = await db.rpc('cpa_get_active_question_bank'); assert(!publicError && Array.isArray(active), 'Public roundtrip failed'); assert.deepEqual([...new Set(active.map((s) => s.release_id))], [data.release_id]);
    const projected = active.map(publicLearningSet).map((s) => { delete s.release_id; delete s.set_version_id; for (const q of s.subquestions) delete q.logical_subquestion_id; return s; }); assert.equal(canonicalJson(projected), canonicalJson(built.compiled));
    const { data: classes, error: classError } = await db.rpc('cpa_get_learning_classifications', { p_release_id: data.release_id }); assert(!classError && Array.isArray(classes), 'Classification roundtrip failed');
    const rows = classes.map(validateLearningClassification), seen = new Set(); assert.equal(rows.length, built.catalog.learning_classifications.length);
    for (const row of rows) { const key = row.source_set_id + '/' + row.subquestion_id; assert(!seen.has(key)); seen.add(key); const expected = built.catalog.learning_classifications.find((x) => x.set_id === row.source_set_id && x.subquestion_id === row.subquestion_id); assert(expected);
        assert.equal(row.question_style, expected.question_style); assert.equal(row.case_set_id, expected.question_style === 'case' ? expected.set_id : null); assert.equal(row.standalone_prompt, expected.standalone_prompt);
        assert.deepEqual([...row.topic_ids].sort(), [...expected.topic_ids].sort()); assert.deepEqual([...(row.case_fact_ids ?? [])].sort(), [...expected.case_fact_ids].sort()); }
    const stored = (await query("select source_document,source_file_hash,bank_content_hash,public_content_hash,validation_report->'retirement_authorization' as retirement from public.cpa_question_bank_releases where id=$1::uuid and status='active'", true, [data.release_id]))[0];
    assert(stored); assert.equal(stored.source_document, built.document); assert.equal(sha(stored.source_document), prep.source_file_hash); for (const key of ['source_file_hash', 'bank_content_hash', 'public_content_hash']) assert.equal(stored[key], prep[key]);
    assert.deepEqual(stored.retirement, built.metadata.retirement);
    const retiredActive = await query("select count(*)::int as n from public.cpa_question_bank_release_items where release_id=$1::uuid and set_id=any($2::text[])", true, [data.release_id, `{${built.retiredIds.join(',')}}`]); assert.equal(retiredActive[0].n, 0);
    const topics = await query('select id,title,part,position from public.cpa_learning_topics order by position'); assert.deepEqual(topics, [...built.catalog.learning_topics].sort((a, b) => a.position - b.position));
    const units = buildLearningUnits(active.map(publicLearningSet), rows, built.catalog.learning_topics), after = await state(), before = read(O + '/before.json');
    assert.equal(after.active.release_id, data.release_id); assert.equal(after.active.source_file_hash, prep.source_file_hash); assert.equal(after.active.source_document_sha256, prep.source_file_hash); assert.deepEqual(after.functions, before.functions); assert.equal(after.default_role_settings_sha256, before.default_role_settings_sha256); guard(inputs);
    for (const id of built.newIds) { const set = built.sets.find((s) => s.id === id), unit = units.find((u) => u.id === id + '--case'); assert(unit, 'New case unit missing: ' + id); assert.deepEqual(unit.subquestions.map((q) => q.prompt), set.subquestions.map((q) => q.prompt)); }
    for (const id of built.retiredIds) assert(!units.some((u) => u.id.startsWith(id + '--')), 'Retired unit still active: ' + id);
    if (!fs.existsSync(O + '/roundtrip.json')) write(O + '/roundtrip.json', { status: 'passed', checked_at: new Date().toISOString(), source_bytes_identical: true, public_round_trip: true, learning_classification_round_trip: true, learning_topic_round_trip: true,
        transaction_guarded_retained_versions_and_classifications_preserved: true, retired_set_ids: built.retiredIds, new_set_ids: built.newIds, retirement_authorization_stored: true, classification_count: rows.length, learning_unit_count: units.length,
        source_file_hash: prep.source_file_hash, public_content_hash: contentHash(projected), functions_and_acl_unchanged: true, default_role_and_database_settings_unchanged: true, after, original_response: ref(responseFile) });
    if (!fs.existsSync(O + '/receipt.json')) write(O + '/receipt.json', { applied_at: new Date().toISOString(), project_host: PROJECT + '.supabase.co', applied: true, ...data, source_file_hash: prep.source_file_hash, bank_content_hash: prep.bank_content_hash, public_round_trip: true,
        source_bytes_identical: true, content_review_performed: true, progress_initialized: false, learning_classification_count: rows.length, learning_unit_count: units.length, transport: prep.transport, statement_timeout_ms: 120000,
        import_preparation: ref(R + '/preparation.json'), original_response: ref(responseFile), roundtrip: ref(O + '/roundtrip.json') });
    const receipt = read(O + '/receipt.json'); assert.equal(receipt.release_id, data.release_id); assert.equal(receipt.source_file_hash, prep.source_file_hash); assert.equal(receipt.bank_content_hash, prep.bank_content_hash);
    const evidence = O + '/verification-evidence.json'; if (!fs.existsSync(evidence)) write(evidence, { applied: receipt.applied, release_id: receipt.release_id, project_host: receipt.project_host, source_file_hash: receipt.source_file_hash, bank_content_hash: receipt.bank_content_hash,
        public_content_hash: prep.public_content_hash, provenance: { receipt: ref(O + '/receipt.json'), readiness: ref(O + '/readiness.json'), import_preparation: ref(R + '/preparation.json') } });
    guard([read(evidence).provenance.receipt, read(evidence).provenance.readiness]);
    if (!fs.existsSync(O + '/verification.json')) {
        const log = O + '/02-verify.log'; assert(!fs.existsSync(log), 'Prior independent verification requires separate reviewed continuation'); const fd = fs.openSync(log, 'wx'), started = Date.now(); let result;
        const env = { ...process.env }; for (const key of Object.keys(env)) if (/OPENAI|ANTHROPIC/i.test(key)) delete env[key]; delete env.NODE_OPTIONS;
        try { result = spawnSync(process.execPath, ['--import', 'tsx', verifier, '--read-live', '--bank', bank, '--learning-catalog', catalogFile, '--evidence', evidence, '--expected-bank-sha256', ref(bank).sha256, '--expected-catalog-sha256', ref(catalogFile).sha256,
            '--expected-evidence-sha256', ref(evidence).sha256, '--migration', learningMigration, '--expected-migration-sha256', ref(learningMigration).sha256, '--expected-project', PROJECT, '--output', O + '/verification.json'], { shell: false, windowsHide: true, stdio: ['ignore', fd, fd], env }); } finally { fs.closeSync(fd); }
        write(O + '/02-verify.result.json', { id: '02-verify', exit_code: result.status, signal: result.signal, elapsed_ms: Date.now() - started, log: ref(log) }); assert.equal(result.status, 0, 'Independent verification failed; inspect the preserved result');
    }
    const verification = read(O + '/verification.json'); assert.equal(verification.status, 'passed'); guard(inputs);
    write(O + '/completion.json', { status: 'production_published_and_independently_verified', completed_at: new Date().toISOString(), release_id: receipt.release_id, project_host: receipt.project_host, files: [bank, catalogFile, O + '/receipt.json', O + '/verification.json'].map(ref),
        counts: verification.actual, retired_set_ids: built.retiredIds, new_set_ids: built.newIds, inputs_preserved: true, model_api_calls: 0, import_preparation: ref(R + '/preparation.json') });
    console.log(JSON.stringify({ status: 'production_published_and_independently_verified', release_id: receipt.release_id, counts: verification.actual, output: path.resolve(O) }, null, 2));
} else {
    // 읽기 전용 진단: 이전 --apply 시도가 실제로 커밋됐는지 아무것도 가정하지 않고 현재 active release만 그대로 보고한다. 쓰기는 하지 않는다.
    const prep = fs.existsSync(R + '/preparation.json') ? read(R + '/preparation.json') : null;
    const row = await state();
    const report = { mode: 'inspect', checked_at: new Date().toISOString(), read_only: true, db_writes: 0, active: row.active,
        expected_prior_release_id: prep?.expected.release_id ?? null, expected_prior_source_file_hash: prep?.expected.source_file_hash ?? null,
        expected_new_source_file_hash: prep?.source_file_hash ?? null,
        matches_expected_prior_release: prep ? (row.active.release_id === prep.expected.release_id && row.active.source_file_hash === prep.expected.source_file_hash) : null,
        matches_expected_new_release: prep ? row.active.source_file_hash === prep.source_file_hash : null };
    fs.mkdirSync(N + '/inspect', { recursive: true });
    write(N + '/inspect/' + Date.now() + '.json', report);
    console.log(JSON.stringify(report, null, 2));
}
assert.equal(path.resolve(process.argv[1]), fileURLToPath(import.meta.url));
