import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const base = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(base, 'db-private-metadata-v1');
const options = process.argv.slice(2);
const arg = key => options[options.indexOf(key) + 1];
const seen = new Set();
for (let index = 0; index < options.length; index++) {
  const key = options[index];
  assert(!seen.has(key), 'Duplicate CLI argument');
  seen.add(key);
  if (key === '--prepare' || key === '--apply') continue;
  assert(['--expected-before-sha256', '--expected-migration-sha256'].includes(key), 'Unknown CLI argument');
  assert(/^[a-f0-9]{64}$/.test(options[++index] ?? ''), 'Expected SHA-256 value');
}
assert(options.includes('--prepare') !== options.includes('--apply'));
assert(!options.includes('--prepare') || options.length === 1);
const sha = text => createHash('sha256').update(text).digest('hex');
const literal = text => `'${String(text).replaceAll("'", "''")}'`;
const project = 'xvifzicrjmbfqaepcfpp';
const migrationFile = 'supabase/migrations/20260912060000_cpa_private_source_metadata.sql';
if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local');
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, `${project}.supabase.co`);
const token = process.env.SUPABASE_ACCESS_TOKEN;
assert(token);
const snapshotQuery = `select jsonb_build_object(
 'active',(select jsonb_agg(jsonb_build_object('id',id,'source_file_hash',source_file_hash,'bank_content_hash',bank_content_hash,'public_content_hash',public_content_hash) order by id) from public.cpa_question_bank_releases where status='active'),
 'release_fingerprint',(select encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'source_sha',encode(sha256(convert_to(coalesce(source_document,''),'UTF8')),'hex'),'source_file_hash',source_file_hash,'bank_content_hash',bank_content_hash,'public_content_hash',public_content_hash) order by id),'[]')::text,'UTF8')),'hex') from public.cpa_question_bank_releases),
 'version_fingerprint',(select encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_object('id',id,'set_id',set_id,'hash',content_hash,'sealed_at',sealed_at) order by id),'[]')::text,'UTF8')),'hex') from public.cpa_question_set_versions),
 'item_fingerprint',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(i) order by release_id,position),'[]')::text,'UTF8')),'hex') from public.cpa_question_bank_release_items i),
 'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'definition_sha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),'security_definer',p.prosecdef,'acl',p.proacl::text) order by p.oid::regprocedure::text)
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('cpa_get_question_version','cpa_get_question_version_document','cpa_restore_v3_null_policy','cpa_get_public_question_version','cpa_get_active_question_bank')),
 'migration',(select encode(sha256(convert_to(statements[1],'UTF8')),'hex') from supabase_migrations.schema_migrations where version='20260912060000')
) as state`;
async function query(sql, write = false) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql, read_only: !write }), signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`DB request HTTP ${response.status}; inspect state before retry; response body not logged`);
  const rows = await response.json(); assert(Array.isArray(rows)); return rows;
}
const save = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
if (options.includes('--prepare')) {
  assert(!fs.existsSync(output));
  const state = (await query(snapshotQuery))[0].state;
  assert.equal(state.active.length, 1);
  assert.equal(state.active[0].id, '2fe460a1-8107-40cd-8afd-e6eb539ef997');
  assert.equal(state.active[0].source_file_hash, '4891f97bcfc98cdeda77567b59657577da184317df199fd53c859004728acd80');
  assert.equal(state.migration, null);
  assert.equal(state.functions.length, 5);
  fs.mkdirSync(output);
  save('before.json', { version: 1, captured_at: new Date().toISOString(), project, state, query_sha256: sha(snapshotQuery), db_writes: 0 });
  console.log(JSON.stringify({ status: 'read_only_prepared', before_sha256: sha(fs.readFileSync(path.join(output, 'before.json'))), functions: 5, active_release: state.active[0].id }));
} else {
  assert(options.includes('--expected-before-sha256') && options.includes('--expected-migration-sha256'));
  const beforeBytes = fs.readFileSync(path.join(output, 'before.json'));
  assert.equal(sha(beforeBytes), arg('--expected-before-sha256'));
  const before = JSON.parse(beforeBytes.toString('utf8'));
  const sql = fs.readFileSync(migrationFile, 'utf8');
  assert.equal(sha(sql), arg('--expected-migration-sha256'));
  assert.equal(before.project, project);
  assert.deepEqual((await query(snapshotQuery))[0].state, before.state, 'Remote state changed after preparation');
  assert(!fs.existsSync(path.join(output, 'receipt.json')));
  const guardBody = `declare observed jsonb; begin
    select checked.state into observed from (${snapshotQuery}) checked;
    if observed is distinct from ${literal(JSON.stringify(before.state))}::jsonb then
      raise exception 'Release/version/items/function/ACL state changed after preparation';
    end if;
  end;`;
  const guardTag = '$metadata_guard_' + sha(guardBody).slice(0, 16) + '$';
  assert(!guardBody.includes(guardTag));
  const guard = `do ${guardTag}${guardBody}${guardTag};`;
  const body = sql.replace(/^begin;\r?\n/m, '').replace(/commit;\s*$/, '');
  const transaction = `begin;\nset local statement_timeout='55s';\nset local standard_conforming_strings=on;\nselect pg_advisory_xact_lock(7261202609080502);\nlock table public.cpa_question_bank_releases,public.cpa_question_bank_release_items,public.cpa_question_set_versions in share mode;\n${guard}\n${body}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('20260912060000','cpa_private_source_metadata',array[${literal(sql)}]);\nnotify pgrst,'reload schema';\ncommit;`;
  save('request.json', { prepared_at: new Date().toISOString(), project, before_sha256: sha(beforeBytes), migration_file: migrationFile, migration_sha256: sha(sql), transaction_sha256: sha(transaction), automatic_retry: false });
  const result = await query(transaction, true);
  save('receipt.json', { applied_at: new Date().toISOString(), project, applied: true, migration_file: migrationFile, migration_sha256: sha(sql), before_sha256: sha(beforeBytes), transaction_sha256: sha(transaction), response: result, question_content_writes: false, model_api_calls: 0, postcheck: 'pending' });
  const after = (await query(snapshotQuery))[0].state;
  save('after.json', { captured_at: new Date().toISOString(), project, state: after });
  assert.equal(after.migration, sha(sql));
  for (const key of ['active', 'release_fingerprint', 'version_fingerprint', 'item_fingerprint']) assert.deepEqual(after[key], before.state[key], `Unexpected ${key} change`);
  for (const fn of before.state.functions.filter(x => x.signature !== 'cpa_get_question_version(uuid)')) assert.deepEqual(after.functions.find(x => x.signature === fn.signature), fn, 'Unrelated function changed');
  const wrapper = after.functions.find(x => x.signature === 'cpa_get_question_version(uuid)');
  assert.equal(wrapper.security_definer, false);
  assert.equal(wrapper.acl, before.state.functions.find(x => x.signature === wrapper.signature).acl);
  const helper = (await query(`select pg_get_functiondef(p.oid) as definition,p.prosecdef as security_definer,p.provolatile::text as volatility,p.proconfig as config,
    has_function_privilege('anon',p.oid,'execute') as anon_execute,has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,
    has_function_privilege('service_role',p.oid,'execute') as service_execute
    from pg_proc p where p.oid=to_regprocedure('public.cpa_get_question_version_with_source_metadata(uuid)')`))[0];
  assert(helper);
  assert.equal(helper.security_definer, false);
  assert.equal(helper.volatility, 's');
  assert.equal(helper.anon_execute, false);
  assert.equal(helper.authenticated_execute, false);
  assert.equal(helper.service_execute, true);
  assert.deepEqual(helper.config.map(x => x.replaceAll(' ', '')), ['search_path=pg_catalog,public']);
  save('helper-function.json', helper);
  save('postconditions.json', { checked_at: new Date().toISOString(), passed: true, unchanged_release_version_items: true, unrelated_functions_unchanged: true, wrapper_security_invoker_acl_preserved: true, source_rows_mutated: false });
  console.log(JSON.stringify({ status: 'migration_applied_postconditions_passed', migration_sha256: sha(sql), active_release: after.active[0].id }));
}
