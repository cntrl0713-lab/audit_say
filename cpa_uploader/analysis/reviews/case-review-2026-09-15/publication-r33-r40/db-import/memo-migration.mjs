// 판본 조회 RPC 메모 migration(20260921120000_cpa_question_version_source_memo)의 운영 적용과 백필.
//   --prepare : 네트워크 없이 예상 상태(이 묶음의 운영 반영 92948c50이 남긴 active release·함수 정의)와 보호 조건이 붙은 SQL을 만든다.
//   --apply --expected-preparation-sha256 SHA : 읽기 전용 조회로 예상 상태를 확인한 뒤 DDL을 한 번 실행하고, 저장 원문이 있는
//               릴리스마다 백필 함수를 한 번씩 부른 뒤 다시 읽어 검증한다. 실패 시 자동 재시도하지 않는다.
//   --backfill : DDL이 끝난 뒤 백필과 적용률 확인만 다시 한다(멱등).
//   node --env-file=.env.local cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r33-r40/db-import/memo-migration.mjs --prepare
// 로컬 증명: tests/cpaQuestionVersionSourceMemoDatabase.test.ts (PGlite에서 같은 migration을 적용해 백필 전후 DTO 동일·권한·불일치 거절을 확인).
// 운영 DB 변경이므로 --apply는 사용자가 실행한다. 기록은 memo-migration-v1/에 남기고 토큰·응답 본문은 기록하지 않는다.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const N = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r33-r40/db-import', O = N + '/memo-migration-v1';
const MIGRATION = 'supabase/migrations/20260921120000_cpa_question_version_source_memo.sql', VERSION = '20260921120000', NAME = 'cpa_question_version_source_memo';
const PROJECT = 'xvifzicrjmbfqaepcfpp';
const ROUNDTRIP = N + '/publication-v1/roundtrip.json', RECEIPT = N + '/publication-v1/receipt.json', DIAGNOSIS = N + '/publication-v1/diagnosis-v1.json';
const LOCAL_PROOF = 'tests/cpaQuestionVersionSourceMemoDatabase.test.ts';
const CHANGED = 'cpa_get_question_version_with_source_metadata(uuid)', ADDED = 'cpa_backfill_release_item_source(uuid)';
const TABLES = ['cpa_question_set_version_source', 'cpa_question_bank_release_item_source'];
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const ref = (file) => ({ file, sha256: sha(fs.readFileSync(file)) });
const write = (file, obj) => { fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', { flag: 'wx' }); return ref(file); };
const literal = (text) => `'${String(text).replaceAll("'", "''")}'`;
const uuid = (value) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const pick = (f) => ({ signature: f.signature, definition_sha256: f.definition_sha256, acl: f.acl, security_definer: f.security_definer });
const mode = process.argv[2]; assert(['--prepare', '--apply', '--backfill'].includes(mode), 'usage: --prepare | --apply --expected-preparation-sha256 SHA | --backfill');
if (mode === '--apply') { assert.equal(process.argv.length, 5); assert.equal(process.argv[3], '--expected-preparation-sha256'); } else assert.equal(process.argv.length, 3);
const names = ['cpa_import_question_bank', 'cpa_import_learning_question_bank', 'cpa_get_question_version', 'cpa_get_question_version_document', 'cpa_get_question_version_with_source_metadata',
    'cpa_assert_reviewed_question_retirements', 'cpa_import_question_bank_with_retirements', 'cpa_import_learning_question_bank_with_retirements', 'cpa_backfill_release_item_source'];
const inspection = `select jsonb_build_object(
 'active',(select jsonb_build_object('release_id',r.id,'source_file_hash',r.source_file_hash,'items',(select count(*) from public.cpa_question_bank_release_items i where i.release_id=r.id)) from public.cpa_question_bank_releases r where r.status='active'),
 'releases',(select jsonb_agg(jsonb_build_object('id',r.id,'release_no',r.release_no,'status',r.status,'has_document',r.source_document is not null,'items',(select count(*) from public.cpa_question_bank_release_items i where i.release_id=r.id)) order by r.release_no) from public.cpa_question_bank_releases r),
 'release_fingerprint',(select encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'source_file_hash',source_file_hash,'bank_content_hash',bank_content_hash,'public_content_hash',public_content_hash,'published_at',published_at) order by id),'[]')::text,'UTF8')),'hex') from public.cpa_question_bank_releases),
 'version_fingerprint',(select encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_object('id',id,'set_id',set_id,'hash',content_hash,'sealed_at',sealed_at) order by id),'[]')::text,'UTF8')),'hex') from public.cpa_question_set_versions),
 'item_fingerprint',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(i) order by release_id,position),'[]')::text,'UTF8')),'hex') from public.cpa_question_bank_release_items i),
 'tables',(select jsonb_object_agg(t,to_regclass('public.'||t)::text) from unnest(array[${TABLES.map((t) => "'" + t + "'").join(',')}]) as t),
 'migration',(select encode(sha256(convert_to(statements[1],'UTF8')),'hex') from supabase_migrations.schema_migrations where version='${VERSION}'),
 'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'name',p.proname,'definition_sha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),'security_definer',p.prosecdef,'acl',p.proacl::text,'volatility',p.provolatile::text,'config',p.proconfig,'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE')) order by p.proname)
   from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in (${names.map((s) => "'" + s + "'").join(',')})),
 'default_role_settings_sha256',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(s) order by setdatabase,setrole),'[]'::jsonb)::text,'UTF8')),'hex') from pg_db_role_setting s)
) as inspection`;
const coverage = `select jsonb_agg(jsonb_build_object('release_id',r.id,'release_no',r.release_no,'status',r.status,
 'items',(select count(*) from public.cpa_question_bank_release_items i where i.release_id=r.id),
 'memo_items',(select count(*) from public.cpa_question_bank_release_item_source s where s.release_id=r.id),
 'memo_versions',(select count(*) from public.cpa_question_bank_release_items i join public.cpa_question_set_version_source v on v.set_version_id=i.set_version_id where i.release_id=r.id)) order by r.release_no) as coverage
 from public.cpa_question_bank_releases r where r.source_document is not null`;

if (mode === '--prepare') {
    assert(!fs.existsSync(O), 'Preserve the existing preparation: ' + O);
    const roundtrip = read(ROUNDTRIP), receipt = read(RECEIPT), diagnosis = read(DIAGNOSIS);
    assert.equal(roundtrip.status, 'passed'); assert.equal(receipt.applied, true); assert.equal(receipt.release_id, roundtrip.after.active.release_id);
    assert.equal(diagnosis.read_only, true); assert.equal(diagnosis.versions_checked, diagnosis.ok + diagnosis.failures.length);
    const expected = { active: { release_id: receipt.release_id, source_file_hash: roundtrip.after.active.source_file_hash }, functions: roundtrip.after.functions.map(pick) };
    assert.equal(expected.functions.length, 7); assert(expected.functions.some((f) => f.signature === CHANGED)); assert(!expected.functions.some((f) => f.signature === ADDED));
    assert(uuid(expected.active.release_id) && /^[a-f0-9]{64}$/.test(expected.active.source_file_hash));
    const sql = fs.readFileSync(MIGRATION, 'utf8');
    assert.equal((sql.match(/^begin;$/gm) || []).length, 1); assert.equal((sql.match(/^commit;$/gm) || []).length, 1);
    assert(!/^\s*(drop|delete|update|truncate)\b/im.test(sql), 'Migration must not drop objects or change existing rows');
    for (const pattern of [/^create table public\.cpa_question_set_version_source \($/m, /^create table public\.cpa_question_bank_release_item_source \($/m,
        /^create function public\.cpa_backfill_release_item_source\(p_release_id uuid default null\) returns int$/m, /^create or replace function public\.cpa_get_question_version_with_source_metadata\(p_version_id uuid\) returns jsonb$/m])
        assert.equal((sql.match(pattern) || []).length, 1, 'Migration shape: ' + pattern);
    fs.mkdirSync(O); fs.copyFileSync(MIGRATION, O + '/migration.sql', fs.constants.COPYFILE_EXCL);
    const guards = expected.functions.map((f) => { assert(/^[a-z_]+\((jsonb|uuid)\)$/.test(f.signature)); assert(/^[a-f0-9]{64}$/.test(f.definition_sha256));
        return `if encode(sha256(convert_to(pg_get_functiondef('public.${f.signature}'::regprocedure),'UTF8')),'hex') <> '${f.definition_sha256}' then raise exception 'Protected function changed before memo DDL: ${f.signature}'; end if;`; }).join('\n');
    const body = sql.replace(/^begin;$/m, '').replace(/^commit;$/m, '');
    const guarded = `begin;\nset local statement_timeout='55s';\nset local standard_conforming_strings=on;\n`
        + `lock table public.cpa_question_bank_releases,public.cpa_question_bank_release_items,public.cpa_question_set_versions in share mode;\n`
        + `do $memo_preflight$ begin\n${guards}\n`
        + `if not exists(select 1 from public.cpa_question_bank_releases where status='active' and id='${expected.active.release_id}'::uuid and source_file_hash='${expected.active.source_file_hash}') then raise exception 'Active release changed before memo DDL'; end if;\n`
        + `if ${TABLES.map((t) => `to_regclass('public.${t}') is not null`).join(' or ')} then raise exception 'Memo tables already exist'; end if;\n`
        + `if to_regprocedure('public.${ADDED}') is not null then raise exception 'Backfill function already exists'; end if;\n`
        + `if exists(select 1 from supabase_migrations.schema_migrations where version='${VERSION}') then raise exception 'Migration ${VERSION} already recorded'; end if;\n`
        + `end $memo_preflight$;\n${body}\n`
        + `insert into supabase_migrations.schema_migrations(version,name,statements) values('${VERSION}','${NAME}',array[${literal(sql)}]);\n`
        + `notify pgrst,'reload schema';\ncommit;\n`;
    fs.writeFileSync(O + '/guarded-migration.sql', guarded, { flag: 'wx' });
    const local = { test: LOCAL_PROOF, note: 'PGlite에서 사적 메타데이터·퇴역 migration 위에 같은 migration을 적용해 백필 전후 DTO 동일, 사적 메타데이터 주입, 권한·RLS, 위치 불일치·조각 누락 거절, 이후 릴리스 백필을 확인한다.', file: ref(LOCAL_PROOF) };
    write(O + '/preparation.json', { version: 1, project: PROJECT, prepared_at: new Date().toISOString(), migration: ref(MIGRATION), migration_version: VERSION, snapshot: ref(O + '/migration.sql'),
        guarded_sql: ref(O + '/guarded-migration.sql'), expected, expected_sources: [ref(ROUNDTRIP), ref(RECEIPT), ref(DIAGNOSIS)], changed_function: CHANGED, added_function: ADDED, tables: TABLES, local_proof: local,
        backfill: 'apply는 DDL 뒤 저장 원문이 있는 릴리스마다 cpa_backfill_release_item_source(release_id)를 한 번씩 부른다(멱등). 활성 릴리스의 모든 항목에 메모가 있어야 완료로 본다.',
        api_calls: 0, db_writes: 0 });
    const preparation = ref(O + '/preparation.json');
    console.log(JSON.stringify({ status: 'prepared_offline', preparation }, null, 2));
    console.log(`\n다음 명령(운영 DB 변경, 사용자가 실행):\n  node --env-file=.env.local ${N}/memo-migration.mjs --apply --expected-preparation-sha256 ${preparation.sha256}`);
} else {
    if (!process.env.SUPABASE_ACCESS_TOKEN && fs.existsSync('.env.local')) process.loadEnvFile('.env.local');
    const configured = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://invalid.local/');
    assert.equal(configured.hostname, PROJECT + '.supabase.co', '대상 프로젝트가 다르다'); assert(process.env.SUPABASE_ACCESS_TOKEN, 'SUPABASE_ACCESS_TOKEN 필요(.env.local); 기록에 남기지 않는다');
    async function query(sqlText, readOnly, timeout = 60000) {
        const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: sqlText, read_only: readOnly }), signal: AbortSignal.timeout(timeout) });
        let body; try { body = await response.json(); } catch { throw Object.assign(new Error('Management SQL returned an unreadable response'), { http_status: response.status }); }
        if (!response.ok) { const text = typeof body?.message === 'string' ? body.message : ''; throw Object.assign(new Error('Management SQL request failed (HTTP ' + response.status + ')' + (text ? ': ' + text.slice(0, 200) : '')), { http_status: response.status, sqlstate: text.match(/ERROR:\s+([0-9A-Z]{5}):/)?.[1] ?? null, exception: text.match(/ERROR:\s+[0-9A-Z]{5}:\s*([^\n]{0,160})/)?.[1] ?? null }); }
        return body;
    }
    const state = async () => (await query(inspection, true))[0].inspection;
    const failure = (file, error, extra) => write(file, { failed_at: new Date().toISOString(), message: error.message, http_status: error.http_status ?? null, sqlstate: error.sqlstate ?? null, exception: error.exception ?? null, automatic_retry: false, ...extra });
    async function backfill(current, label) {
        const releases = current.releases.filter((r) => r.has_document), rows = [];
        console.log(`저장 원문이 있는 릴리스 ${releases.length}개를 release_no 순서로 백필한다(릴리스마다 한 번, 멱등).`);
        for (const r of releases) {
            assert(uuid(r.id)); const started = Date.now();
            let result; try { result = await query(`select public.cpa_backfill_release_item_source('${r.id}'::uuid) as rows_written`, false, 150000); }
            catch (error) { failure(O + `/${label}-failure.json`, error, { release_id: r.id, completed_releases: rows }); throw error; }
            rows.push({ release_id: r.id, release_no: r.release_no, status: r.status, items: r.items, rows_written: result[0].rows_written, elapsed_ms: Date.now() - started });
            console.log(`  ${String(r.release_no).padStart(3)} ${r.status.padEnd(8)} ${r.id}: 항목 ${r.items}, 백필 ${result[0].rows_written}행 (${Date.now() - started}ms)`);
        }
        const cov = (await query(coverage, true))[0].coverage;
        const active = cov.find((c) => c.release_id === current.active.release_id); assert(active, 'Active release has no source document');
        const incomplete = cov.filter((c) => c.memo_items !== c.items || c.memo_versions !== c.items).map((c) => c.release_id);
        const record = write(O + `/${label}.json`, { checked_at: new Date().toISOString(), releases_backfilled: rows, coverage: cov, active_release: active, incomplete_releases: incomplete, db_writes: rows.length });
        console.log('활성 릴리스 메모 적용률: ' + JSON.stringify(active));
        if (incomplete.length) console.log('주의: 항목과 메모가 어긋난 릴리스(백필이 건너뜀): ' + incomplete.join(', '));
        assert.equal(active.memo_items, active.items, 'Active release memo incomplete'); assert.equal(active.memo_versions, active.items, 'Active release version memo incomplete');
        return record;
    }
    if (mode === '--apply') {
        assert.equal(process.argv[4], ref(O + '/preparation.json').sha256, 'Only the reviewed preparation may run');
        assert(!fs.existsSync(O + '/apply-started.json'), 'Inspect an uncertain prior DDL attempt before retrying');
        const prep = read(O + '/preparation.json'), inputs = [prep.migration, prep.snapshot, prep.guarded_sql, ...prep.expected_sources, prep.local_proof.file];
        const guardInputs = () => { for (const x of inputs) assert.equal(ref(x.file).sha256, x.sha256, 'Changed prepared evidence: ' + x.file); }; guardInputs();
        const before = await state();
        assert.deepEqual({ release_id: before.active.release_id, source_file_hash: before.active.source_file_hash }, prep.expected.active, 'Active release differs from the reviewed baseline');
        for (const f of prep.expected.functions) { const now = before.functions.find((x) => x.signature === f.signature); assert(now, 'Function missing: ' + f.signature); assert.deepEqual(pick(now), f, 'Function differs from the reviewed baseline: ' + f.signature); }
        assert(!before.functions.some((f) => f.signature === ADDED), 'Backfill function already exists'); for (const t of TABLES) assert.equal(before.tables[t], null, 'Memo table already exists: ' + t); assert.equal(before.migration, null, 'Migration already recorded');
        write(O + '/before.json', { checked_at: new Date().toISOString(), read_only: true, ...before });
        write(O + '/apply-started.json', { started_at: new Date().toISOString(), project: PROJECT, preparation: ref(O + '/preparation.json'), automatic_retry: false });
        try { const response = await query(fs.readFileSync(prep.guarded_sql.file, 'utf8'), false, 90000); write(O + '/ddl-response.json', { received_at: new Date().toISOString(), response }); }
        catch (error) { failure(O + '/ddl-failure.json', error, { outcome: 'uncertain_until_readback' }); throw error; }
        const after = await state(); write(O + '/after.json', { checked_at: new Date().toISOString(), read_only: true, ...after });
        assert.deepEqual(after.active, before.active, 'DDL must not publish content');
        for (const key of ['releases', 'release_fingerprint', 'version_fingerprint', 'item_fingerprint', 'default_role_settings_sha256']) assert.deepEqual(after[key], before[key], 'Unexpected change: ' + key);
        for (const t of TABLES) assert(typeof after.tables[t] === 'string' && after.tables[t].endsWith(t), 'Memo table missing: ' + t);
        assert.equal(after.migration, sha(fs.readFileSync(prep.migration.file, 'utf8')), 'Migration was not recorded with the same bytes');
        for (const old of before.functions) {
            const now = after.functions.find((f) => f.signature === old.signature); assert(now, 'Function missing: ' + old.signature);
            if (old.signature === CHANGED) { assert.notEqual(now.definition_sha256, old.definition_sha256, 'Memo lookup was not installed'); assert.deepEqual({ ...now, definition_sha256: null }, { ...old, definition_sha256: null }, CHANGED + ' privileges or attributes changed'); }
            else assert.deepEqual(now, old, 'Unrelated function changed: ' + old.signature);
        }
        const added = after.functions.find((f) => f.signature === ADDED); assert(added, 'Backfill function missing');
        assert.deepEqual({ security_definer: added.security_definer, volatility: added.volatility, anon: added.anon_execute, authenticated: added.authenticated_execute, service: added.service_execute, config: (added.config ?? []).map((x) => x.replaceAll(' ', '')) },
            { security_definer: false, volatility: 'v', anon: false, authenticated: false, service: true, config: ['search_path=pg_catalog,public'] }, 'Backfill function attributes');
        guardInputs();
        const backfilled = await backfill(after, 'backfill');
        write(O + '/completion.json', { status: 'memo_migration_applied_and_backfilled', completed_at: new Date().toISOString(), project: PROJECT, migration: prep.migration, migration_version: VERSION,
            before: ref(O + '/before.json'), after: ref(O + '/after.json'), ddl_response: ref(O + '/ddl-response.json'), backfill: backfilled, changed_function: CHANGED, added_function: ADDED, tables: TABLES,
            other_functions_unchanged: true, content_releases_unchanged: true, attempts_changed: 0, question_content_writes: false, model_api_calls: 0,
            next: `node --env-file=.env.local --import tsx ${N}/verify-v3.mjs` });
        console.log(JSON.stringify({ status: 'memo_migration_applied_and_backfilled', completion: ref(O + '/completion.json') }, null, 2));
        console.log(`\n다음 명령(읽기 전용 독립 검증):\n  node --env-file=.env.local --import tsx ${N}/verify-v3.mjs`);
    } else {
        assert(fs.existsSync(O + '/after.json'), 'DDL has not been applied yet (no after.json); run --apply first');
        const current = await state(); for (const t of TABLES) assert(typeof current.tables[t] === 'string', 'Memo table missing: ' + t);
        const attempt = fs.readdirSync(O).filter((f) => /^backfill-retry-\d+\.json$/.test(f)).length + 1;
        const record = await backfill(current, `backfill-retry-${attempt}`);
        console.log(JSON.stringify({ status: 'backfill_complete', record }, null, 2));
    }
}
