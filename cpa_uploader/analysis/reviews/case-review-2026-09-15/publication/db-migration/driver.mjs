// 사례형 세트 퇴역 허용 마이그레이션(20260915090000)의 운영 적용.
//   --prepare : 네트워크 없이 마이그레이션 사본과 보호 조건이 붙은 SQL을 만든다.
//   --apply   : 읽기 전용 조회로 active release·함수 정의가 예상과 같은지 확인한 뒤 SQL을 한 번 실행하고, 다시 읽어 결과를 검증한다. 실패 시 자동 재시도하지 않는다.
//   node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication/db-migration/driver.mjs --prepare|--apply [--expected-preparation-sha256 SHA]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const O = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/publication/db-migration';
const MIGRATION = 'supabase/migrations/20260915090000_cpa_reviewed_case_question_retirements.sql';
const PROJECT = 'xvifzicrjmbfqaepcfpp';
// 직전 퇴역 함수 설치 직후 운영 상태(2026-09-14)와 그 뒤 fix-v4 운영 반영의 active release.
const PRIOR_FUNCTIONS = 'cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14/db-retirement-migration-v1/after.json';
const PRIOR_RELEASE = 'cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v4/db-publication-v1/completion.json';
const CHANGED = 'cpa_assert_reviewed_question_retirements(jsonb)';
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const ref = (file) => ({ file, sha256: sha(fs.readFileSync(file)) });
const write = (file, obj) => { fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', { flag: 'wx' }); return ref(file); };
const mode = process.argv[2]; assert(['--prepare', '--apply'].includes(mode));
if (mode === '--apply') { assert.equal(process.argv.length, 5); assert.equal(process.argv[3], '--expected-preparation-sha256'); } else assert.equal(process.argv.length, 3);
const names = ['cpa_import_question_bank', 'cpa_import_learning_question_bank', 'cpa_get_question_version', 'cpa_get_question_version_with_source_metadata',
    'cpa_assert_reviewed_question_retirements', 'cpa_import_question_bank_with_retirements', 'cpa_import_learning_question_bank_with_retirements'];
const inspection = `select jsonb_build_object(
 'active',(select jsonb_build_object('release_id',id,'source_file_hash',source_file_hash) from public.cpa_question_bank_releases where status='active'),
 'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'name',p.proname,'definition_sha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),'definition',pg_get_functiondef(p.oid),'security_definer',p.prosecdef,'acl',p.proacl::text,'public_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE')) order by p.proname)
 from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in (${names.map((s) => "'" + s + "'").join(',')}))) as inspection`;
const pick = (f) => ({ signature: f.signature, definition_sha256: f.definition_sha256, acl: f.acl, security_definer: f.security_definer, public_execute: f.public_execute, authenticated_execute: f.authenticated_execute, service_execute: f.service_execute });

if (mode === '--prepare') {
    assert(!fs.existsSync(O + '/preparation.json'), 'Preserve the existing preparation');
    const prior = read(PRIOR_FUNCTIONS), release = read(PRIOR_RELEASE);
    assert.equal(prior.functions.length, names.length); assert.equal(release.status, 'production_published_and_independently_verified');
    const expected = { active: { release_id: release.release_id, source_file_hash: release.files.find((f) => f.file.endsWith('cpa_question_sets_v3.authoring.json')).sha256 }, functions: prior.functions.map(pick) };
    const sql = fs.readFileSync(MIGRATION, 'utf8');
    assert.equal((sql.match(/^begin;$/gm) || []).length, 1); assert.equal((sql.match(/^commit;$/gm) || []).length, 1);
    assert.equal((sql.match(/create or replace function public\.cpa_assert_reviewed_question_retirements\(p_payload jsonb\)/g) || []).length, 1);
    assert(!/drop |delete |update |insert |truncate /i.test(sql), 'Migration must not change rows or drop objects');
    fs.copyFileSync(MIGRATION, O + '/migration.sql', fs.constants.COPYFILE_EXCL);
    const guards = expected.functions.map((f) => { assert(/^[a-z_]+\((jsonb|uuid)\)$/.test(f.signature)); assert(/^[a-f0-9]{64}$/.test(f.definition_sha256));
        return `if encode(sha256(convert_to(pg_get_functiondef('public.${f.signature}'::regprocedure),'UTF8')),'hex') <> '${f.definition_sha256}' then raise exception 'Protected function changed before case retirement DDL'; end if;`; }).join('\n');
    assert(/^[a-f0-9-]{36}$/.test(expected.active.release_id) && /^[a-f0-9]{64}$/.test(expected.active.source_file_hash));
    const guarded = `begin;\ndo $case_retirement_preflight$ begin\n${guards}\nif not exists(select 1 from public.cpa_question_bank_releases where status='active' and id='${expected.active.release_id}'::uuid and source_file_hash='${expected.active.source_file_hash}') then raise exception 'Active release changed before case retirement DDL'; end if;\nend $case_retirement_preflight$;\n`
        + sql.replace(/^begin;$/m, '').replace(/^commit;$/m, '') + '\ncommit;\n';
    fs.writeFileSync(O + '/guarded-migration.sql', guarded, { flag: 'wx' });
    const local = { test: 'tests/cpaCaseQuestionRetirementsDatabase.test.ts', regression: 'tests/cpaQuestionRetirementsDatabase.test.ts', note: 'PGlite에서 두 마이그레이션을 차례로 적용해 사례형 퇴역 성공, 다른 7개 함수 정의 불변(퇴역 함수 제외), 역사행·풀이 보존, CAS·완전성·권한 거절을 확인한다.' };
    write(O + '/preparation.json', { version: 1, project: PROJECT, prepared_at: new Date().toISOString(), migration: ref(MIGRATION), snapshot: ref(O + '/migration.sql'), guarded_sql: ref(O + '/guarded-migration.sql'),
        expected, expected_sources: [ref(PRIOR_FUNCTIONS), ref(PRIOR_RELEASE)], changed_function: CHANGED, local_proof: { ...local, files: [ref(local.test), ref(local.regression)] },
        authorization: ref('cpa_uploader/analysis/reviews/case-review-2026-09-15/publication/authorization.md'), api_calls: 0, db_writes: 0 });
    console.log(JSON.stringify({ status: 'prepared_offline', preparation: ref(O + '/preparation.json') }, null, 2));
} else {
    const configured = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://invalid.local/');
    assert.equal(configured.hostname, PROJECT + '.supabase.co'); assert(process.env.SUPABASE_ACCESS_TOKEN, 'Management token required; never recorded');
    assert.equal(process.argv[4], ref(O + '/preparation.json').sha256, 'Only the reviewed preparation may run');
    assert(!fs.existsSync(O + '/apply-started.json'), 'Inspect an uncertain prior DDL attempt before retrying');
    const prep = read(O + '/preparation.json'), inputs = [prep.migration, prep.snapshot, prep.guarded_sql, ...prep.expected_sources, prep.authorization];
    const guard = () => { for (const x of inputs) assert.equal(ref(x.file).sha256, x.sha256, 'Changed prepared migration evidence: ' + x.file); }; guard();
    async function query(sqlText, readOnly) {
        const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: sqlText, read_only: readOnly }), signal: AbortSignal.timeout(60000) });
        let body; try { body = await response.json(); } catch { throw Object.assign(new Error('Management SQL returned an unreadable response'), { http_status: response.status }); }
        if (!response.ok) { const text = typeof body?.message === 'string' ? body.message : ''; throw Object.assign(new Error('Management SQL request failed'), { http_status: response.status, sqlstate: text.match(/ERROR:\s+([0-9A-Z]{5}):/)?.[1] ?? null, exception: text.match(/ERROR:\s+[0-9A-Z]{5}:\s*([^\n]{0,160})/)?.[1] ?? null }); }
        return body;
    }
    const state = async () => (await query(inspection, true))[0].inspection;
    const before = await state();
    assert.deepEqual(before.active, prep.expected.active, 'Active release differs from the reviewed baseline');
    assert.deepEqual(before.functions.map(pick), prep.expected.functions, 'Database functions differ from the reviewed baseline');
    write(O + '/before.json', { checked_at: new Date().toISOString(), read_only: true, ...before });
    write(O + '/apply-started.json', { started_at: new Date().toISOString(), project: PROJECT, preparation: ref(O + '/preparation.json'), automatic_retry: false });
    try { const response = await query(fs.readFileSync(prep.guarded_sql.file, 'utf8'), false); write(O + '/ddl-response.json', { received_at: new Date().toISOString(), response }); }
    catch (error) { write(O + '/ddl-failure.json', { failed_at: new Date().toISOString(), message: error.message, http_status: error.http_status ?? null, sqlstate: error.sqlstate ?? null, exception: error.exception ?? null, outcome: 'uncertain_until_readback', automatic_retry: false }); throw error; }
    const after = await state(); write(O + '/after.json', { checked_at: new Date().toISOString(), read_only: true, ...after });
    assert.deepEqual(after.active, before.active, 'DDL must not publish content');
    for (const old of before.functions) {
        const now = after.functions.find((f) => f.signature === old.signature); assert(now, 'Function missing: ' + old.signature);
        if (old.signature === CHANGED) { assert.notEqual(now.definition_sha256, old.definition_sha256, 'Retirement guard was not replaced'); assert.match(now.definition, /standard or case sets/);
            for (const key of ['acl', 'security_definer', 'public_execute', 'authenticated_execute', 'service_execute']) assert.deepEqual(now[key], old[key], CHANGED + ' ' + key); }
        else assert.deepEqual(pick(now), pick(old), 'Unrelated function changed: ' + old.signature);
    }
    guard();
    write(O + '/completion.json', { status: 'case_retirement_guard_installed_and_verified', completed_at: new Date().toISOString(), project: PROJECT, migration: prep.migration,
        before: ref(O + '/before.json'), after: ref(O + '/after.json'), changed_function: CHANGED, other_functions_unchanged: true, content_releases_unchanged: true, bank_rows_changed: 0, attempts_changed: 0 });
    console.log(JSON.stringify({ status: 'case_retirement_guard_installed_and_verified', completion: ref(O + '/completion.json') }, null, 2));
}
