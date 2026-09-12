import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Content/schema inspection only. No accounts, answers, service keys or tokens are recorded.
process.loadEnvFile('.env.local');
const endpoint = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
const project = endpoint.hostname.split('.')[0];
if (!/^[a-z0-9]{20}$/.test(project) || endpoint.hostname !== `${project}.supabase.co`) throw new Error('Unexpected database project');
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('Management token missing');
const query = `select jsonb_build_object(
  'releases',(select jsonb_agg(jsonb_build_object('id',id,'status',status,'bank_content_hash',bank_content_hash,'public_content_hash',public_content_hash) order by release_no) from public.cpa_question_bank_releases),
  'versions',(select jsonb_agg(jsonb_build_object('id',v.id,'set_id',v.set_id,'revision',v.revision,'content_hash',v.content_hash,'sealed_at',v.sealed_at,
    'release_ids',(select jsonb_agg(ri.release_id) from public.cpa_question_bank_release_items ri where ri.set_version_id=v.id)) order by v.set_id,v.revision) from public.cpa_question_set_versions v),
  'schema',(select jsonb_agg(jsonb_build_object('name',p.proname,'md5',md5(pg_get_functiondef(p.oid))) order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('cpa_begin_attempt','cpa_claim_grading_run','cpa_complete_grading_run','common_legacy_cpa_begin_attempt','common_legacy_cpa_claim_grading_run','common_legacy_cpa_complete_grading_run')),
  'counts',jsonb_build_object('sets',(select count(*) from public.cpa_question_sets),'subquestions',(select count(*) from public.cpa_subquestions),'subquestion_versions',(select count(*) from public.cpa_subquestion_versions),'attempts',(select count(*) from public.cpa_attempts),'grading_runs',(select count(*) from public.cpa_grading_runs),'xp_events',(select count(*) from public.cpa_xp_events)),
  'migration_exists',to_regclass('public.cpa_learning_question_versions') is not null
) as snapshot`;
const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, read_only: true }), signal: AbortSignal.timeout(30000),
});
if (!response.ok) {
    const detail = (await response.text()).replace(/Bearer\s+[^\s"']+/gi, '[redacted]').slice(0, 800);
    throw new Error(`Read-only database inspection failed (${response.status}): ${detail}`);
}
const rows = await response.json();
if (!Array.isArray(rows) || !rows[0]?.snapshot) throw new Error('Unexpected database snapshot');
const snapshot = { inspected_at: new Date().toISOString(), project, ...rows[0].snapshot };
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) throw new Error('Server database credential missing');
for (let index = 0; index < snapshot.versions.length; index += 6) {
    await Promise.all(snapshot.versions.slice(index, index + 6).map(async version => {
        const result = await fetch(`${endpoint.origin}/rest/v1/rpc/cpa_get_question_version`, {
            method: 'POST', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_version_id: version.id }), signal: AbortSignal.timeout(30000),
        });
        if (!result.ok) throw new Error(`Read-only question version fetch failed (${result.status})`);
        version.question_set = await result.json();
    }));
}
const output = resolve(process.argv[2] ?? 'cpa_uploader/analysis/reviews/question-unit-migration-2026-09-11/remote-before.json');
await mkdir(dirname(output), { recursive: true });
const bytes = JSON.stringify(snapshot, null, 2) + '\n';
await writeFile(output, bytes, { flag: 'wx' });
console.log(JSON.stringify({ output, sha256: createHash('sha256').update(bytes).digest('hex'), counts: snapshot.counts,
    releases: snapshot.releases.map(({ id, status }) => ({ id, status })), version_count: snapshot.versions.length, migration_exists: snapshot.migration_exists }, null, 2));
