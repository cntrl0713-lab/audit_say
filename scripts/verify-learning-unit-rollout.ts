import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { contentHash } from '../lib/learningSubmission.ts';
import { compilePublicQuestionSet } from '../lib/questionV3.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';
import { publicLearningSet } from '../lib/learningPublic.ts';
import { buildLearningUnits } from '../lib/learningUnits.ts';
import type { LearningClassification, LearningTopic } from '../lib/learningUnits.ts';

const directory = 'cpa_uploader/analysis/reviews/question-unit-migration-2026-09-11';
const beforeFile = `${directory}/remote-before.json`, afterFile = `${directory}/remote-after.json`;
const receiptFile = `${directory}/rollout-receipt.json`, outputFile = `${directory}/post-verification.json`;
const catalogFile = 'cpa_uploader/data/learning-question-classifications.json';
const migrationFile = 'supabase/migrations/20260911030000_cpa_question_learning_units.sql';
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
type Source = { id: string; set_id: string; revision: number; sealed_at: string; content_hash: string; release_ids: string[]; question_set: QuestionSetV3 };
type Release = { id: string; status: string; bank_content_hash: string; public_content_hash: string };
type Snapshot = { inspected_at: string; project: string; migration_exists: boolean; versions: Source[];
    releases: Release[]; counts: Record<string, number>; schema: Array<{ name: string; md5: string }> };
interface Live {
    counts: Record<string, number>; source_versions: Source[]; releases: Release[];
    public_versions: Array<{ id: string; question_set: unknown }>;
    active_public: unknown[]; active_classifications: LearningClassification[]; topics: LearningTopic[];
    membership_wrappers: Array<{ name: string; md5: string }>;
    tables: Array<{ name: string; rls: boolean; browser_table_access: boolean; browser_column_read: boolean; service_select: boolean }>;
    functions: Array<{ name: string; signature: string; browser_execute: boolean; service_execute: boolean }>;
    migration_source_sha256: string;
}

/** One SQL SELECT, sent with read_only:true. No user identities or answers are selected. */
export const verificationQuery = `select jsonb_build_object(
 'migration_source_sha256',(select encode(sha256(convert_to(statements[1],'UTF8')),'hex') from supabase_migrations.schema_migrations where version='20260911030000'),
 'releases',(select jsonb_agg(jsonb_build_object('id',id,'status',status,'bank_content_hash',bank_content_hash,'public_content_hash',public_content_hash) order by release_no) from public.cpa_question_bank_releases),
 'source_versions',(select jsonb_agg(jsonb_build_object('id',v.id,'set_id',v.set_id,'revision',v.revision,'sealed_at',v.sealed_at,'content_hash',v.content_hash,
   'release_ids',(select jsonb_agg(ri.release_id order by ri.release_id) from public.cpa_question_bank_release_items ri where ri.set_version_id=v.id)) order by v.set_id,v.revision) from public.cpa_question_set_versions v),
 'public_versions','[]'::jsonb,'active_public','[]'::jsonb,'active_classifications','[]'::jsonb,
 'topics',(select jsonb_agg(to_jsonb(t) order by position) from public.cpa_learning_topics t),
 'counts',jsonb_build_object(
   'sets',(select count(*) from public.cpa_question_sets),'subquestions',(select count(*) from public.cpa_subquestions),
   'subquestion_versions',(select count(*) from public.cpa_subquestion_versions),
   'attempts',(select count(*) from public.cpa_attempts),'grading_runs',(select count(*) from public.cpa_grading_runs),'xp_events',(select count(*) from public.cpa_xp_events),
   'learning_questions',(select count(*) from public.cpa_learning_questions),
   'classification_versions',(select count(*) from public.cpa_learning_question_versions),
   'sealed_classification_versions',(select count(*) from public.cpa_learning_question_versions where sealed_at is not null),
   'covered_source_question_versions',(select count(distinct source_subquestion_version_id) from public.cpa_learning_question_versions where sealed_at is not null),
   'missing_classifications',(select count(*) from public.cpa_subquestion_versions sq where not exists(select 1 from public.cpa_learning_question_versions v where v.source_subquestion_version_id=sq.id and v.sealed_at is not null)),
   'invalid_lineages',(select count(*) from public.cpa_learning_question_versions v join public.cpa_learning_questions lq on lq.id=v.learning_question_id
     join public.cpa_subquestion_versions sq on sq.id=v.source_subquestion_version_id join public.cpa_question_set_versions q on q.id=sq.set_version_id
     where lq.source_subquestion_id<>sq.subquestion_id or v.source_set_version_id<>sq.set_version_id or v.source_set_id<>q.set_id),
   'invalid_parents',(select count(*) from public.cpa_learning_question_versions v join public.cpa_question_set_versions q on q.id=v.source_set_version_id
     where (v.question_style='standard' and (v.case_set_id is not null or nullif(btrim(v.standalone_prompt),'') is null or cardinality(v.case_fact_ids)<>0))
       or (v.question_style='case' and (v.case_set_id is distinct from v.source_set_id or v.standalone_prompt is not null or jsonb_array_length(q.shared_facts)=0))),
   'invalid_fact_ids',(select count(*) from public.cpa_learning_question_versions v join public.cpa_question_set_versions q on q.id=v.source_set_version_id
     cross join unnest(v.case_fact_ids) f where not exists(select 1 from jsonb_array_elements(q.shared_facts) j where j->>'id'=f)),
   'missing_topics',(select count(*) from public.cpa_learning_question_versions v where not exists(select 1 from public.cpa_learning_question_topics t where t.classification_version_id=v.id)),
   'orphan_topic_links',(select count(*) from public.cpa_learning_question_topics t left join public.cpa_learning_topics r on r.id=t.topic_id where r.id is null),
   'topic_links',(select count(*) from public.cpa_learning_question_topics)),
 'membership_wrappers',(select jsonb_agg(jsonb_build_object('name',p.proname,'md5',md5(pg_get_functiondef(p.oid))) order by p.proname)
   from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('cpa_begin_attempt','cpa_claim_grading_run','cpa_complete_grading_run')),
 'tables',(select jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity,
   'browser_table_access',has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
   'browser_column_read',has_any_column_privilege('anon',c.oid,'SELECT') or has_any_column_privilege('authenticated',c.oid,'SELECT'),
   'service_select',has_table_privilege('service_role',c.oid,'SELECT')) order by c.relname)
   from pg_class c where c.relnamespace='public'::regnamespace and c.relname in ('cpa_learning_questions','cpa_learning_question_versions','cpa_learning_topics','cpa_learning_question_topics','cpa_attempt_learning_selections','cpa_attempt_learning_questions')),
 'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'signature',p.oid::regprocedure::text,
   'browser_execute',has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'),
   'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE')) order by p.proname)
   from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('cpa_import_learning_classifications','cpa_get_learning_classifications','cpa_import_learning_question_bank',
     'common_legacy_cpa_begin_attempt','common_legacy_cpa_claim_grading_run','common_legacy_cpa_complete_grading_run'))
) as verification`;

function privatePaths(value: unknown, at = ''): string[] {
    if (!value || typeof value !== 'object') return [];
    const forbidden = new Set(['model_answer', 'criteria', 'requirements', 'critical_facts', 'source_quote', 'source_refs', 'decision_correct']);
    return Object.entries(value).flatMap(([key, child]) => [...(forbidden.has(key) ? [`${at}/${key}`] : []), ...privatePaths(child, `${at}/${key}`)]);
}
function publicWithoutLogicalId(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(publicWithoutLogicalId);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'logical_subquestion_id').map(([key, item]) => [key, publicWithoutLogicalId(item)]));
}
function sourceShape(value: Source) { return { ...value, release_ids: [...value.release_ids].sort() }; }

export function evaluateVerification(before: Snapshot, after: Snapshot, live: Live,
    catalog: { classifications: LearningClassification[]; topics: LearningTopic[] }, migrationHash: string) {
    const failures: string[] = [];
    const check = (ok: boolean, label: string) => { if (!ok) failures.push(label); };
    check(!before.migration_exists && after.migration_exists, 'Migration presence transition');
    check(live.migration_source_sha256 === migrationHash, 'Installed SQL source SHA256');
    check(contentHash(before.releases) === contentHash(after.releases) && contentHash(before.releases) === contentHash(live.releases), 'Release IDs/status/content hashes unchanged');
    check(before.versions.length === after.versions.length && before.versions.length === live.source_versions.length, 'Source version count unchanged');
    const documents = before.versions.map(version => {
        const saved = after.versions.find(item => item.id === version.id), current = live.source_versions.find(item => item.id === version.id);
        const snapshotSame = Boolean(saved && contentHash(sourceShape(version)) === contentHash(sourceShape(saved)));
        const liveSame = Boolean(current && contentHash(sourceShape(version)) === contentHash(sourceShape(current)));
        check(snapshotSame && liveSame, `Source document/identity ${version.set_id}@${version.revision}`);
        const pub = live.public_versions.find(item => item.id === version.id)?.question_set;
        const expected = compilePublicQuestionSet(version.question_set);
        const publicSame = pub !== undefined && contentHash(publicWithoutLogicalId(pub)) === contentHash(expected);
        check(publicSame, `Public source projection ${version.set_id}@${version.revision}`);
        check(privatePaths(pub).length === 0, `Private fields in public source ${version.set_id}@${version.revision}`);
        return { id: version.id, set_id: version.set_id, revision: version.revision,
            source_hash: contentHash(sourceShape(version)), snapshot_unchanged: snapshotSame, live_unchanged: liveSame,
            expected_public_hash: contentHash(expected), public_hash_excluding_logical_uuid: contentHash(publicWithoutLogicalId(pub ?? null)), public_unchanged: publicSame };
    });
    const expectedQuestionVersions = before.versions.reduce((sum, version) => sum + version.question_set.subquestions.length, 0);
    for (const key of ['sets', 'subquestions', 'subquestion_versions']) check(live.counts[key] === before.counts[key] && after.counts[key] === before.counts[key], `Source count ${key}`);
    for (const key of ['classification_versions', 'sealed_classification_versions', 'covered_source_question_versions']) check(live.counts[key] === expectedQuestionVersions, `Full sealed metadata coverage ${key}`);
    check(live.counts.learning_questions === before.counts.subquestions, 'Stable learning question count');
    for (const key of ['missing_classifications', 'invalid_lineages', 'invalid_parents', 'invalid_fact_ids', 'missing_topics', 'orphan_topic_links']) check(live.counts[key] === 0, key);
    check(contentHash(live.topics) === contentHash(catalog.topics) && live.topics.length === 19, 'Registered OX topics');
    const active = before.releases.find(release => release.status === 'active');
    check(Boolean(active), 'Active release exists');
    check(live.active_classifications.length === 212, 'Active classification count');
    for (const row of live.active_classifications) {
        const expected = catalog.classifications.find(item => item.source_set_id === row.source_set_id && item.subquestion_id === row.subquestion_id);
        const original = before.versions.find(version => version.id === row.source_set_version_id && version.release_ids.includes(active!.id));
        check(Boolean(expected && original && row.source_content_hash === original.content_hash
            && expected.question_style === row.question_style && expected.case_set_id === row.case_set_id
            && expected.standalone_prompt === row.standalone_prompt
            && contentHash([...expected.topic_ids].sort()) === contentHash([...row.topic_ids].sort())
            && contentHash([...(expected.case_fact_ids ?? [])].sort()) === contentHash([...(row.case_fact_ids ?? [])].sort())),
        `Active metadata/source binding ${row.source_set_id}/${row.subquestion_id}`);
    }
    check(live.active_classifications.filter(row => row.question_style === 'standard').length === 208, '208 active standard questions');
    check(live.active_classifications.filter(row => row.question_style === 'case').length === 4, '4 active case questions');
    const units = buildLearningUnits(live.active_public.map(publicLearningSet), live.active_classifications, live.topics);
    check(units.length === 212, '212 active learning units');
    for (const unit of units) {
        check(privatePaths(unit).length === 0, `Private fields in learning unit ${unit.id}`);
        check(unit.subquestions.every(sub => sub.question_style === unit.question_style), `Mixed learning unit ${unit.id}`);
        check(unit.question_style === 'standard' ? unit.case_set_id === null && unit.shared_context.facts.length === 0 && unit.subquestions.length === 1
            : Boolean(unit.case_set_id && unit.shared_context.facts.length), `Learning parent/facts ${unit.id}`);
    }
    check(live.membership_wrappers.length === 3 && live.membership_wrappers.every(row => before.schema.some(old => old.name === row.name && old.md5 === row.md5)), 'Raw membership wrapper MD5 preservation');
    check(live.tables.length === 6 && live.tables.every(table => table.rls && !table.browser_table_access && !table.browser_column_read && table.service_select), 'Table RLS and browser/service privileges');
    check(live.functions.length === 6 && live.functions.every(fn => !fn.browser_execute && fn.service_execute === !fn.name.startsWith('common_legacy_')), 'RPC browser/service privileges and legacy bypass denial');
    const activity = ['attempts', 'grading_runs', 'xp_events'].map(key => ({ table: key, before: before.counts[key],
        after_snapshot: after.counts[key], current: live.counts[key], difference: live.counts[key] - before.counts[key] }));
    return { failures, documents, activity, counts: live.counts, topics: live.topics,
        active: { source_sets: live.active_public.length, questions: live.active_classifications.length,
            standard_questions: 208, case_questions: 4, learning_units: units.length },
        membership_wrappers: live.membership_wrappers, table_security: live.tables, rpc_security: live.functions,
        public_projection_note: 'Before/after snapshots store private source documents. Each public payload is compared to compilePublicQuestionSet(before); only the DB logical UUID field absent from source documents is excluded, not question content.',
        activity_note: 'Aggregate differences are observations, not failures: new users/submissions or retention can legitimately change counts. No personal identifiers or answers were read.' };
}

export async function main(args = process.argv.slice(2)) {
    if (args.includes('--apply')) throw new Error('읽기 전용 검증은 --apply를 허용하지 않습니다.');
    const option = (name: string) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
    if (fs.existsSync(outputFile)) throw new Error('기존 사후 검증 기록을 덮어쓰지 않습니다.');
    const files = [beforeFile, afterFile, receiptFile, catalogFile, migrationFile, 'scripts/verify-learning-unit-rollout.ts', 'lib/learningUnits.ts', 'lib/learningPublic.ts', 'lib/questionV3.ts'];
    const inputs = Object.fromEntries(files.map(file => [file, sha(fs.readFileSync(file))]));
    const before: Snapshot = JSON.parse(fs.readFileSync(beforeFile, 'utf8')), after: Snapshot = JSON.parse(fs.readFileSync(afterFile, 'utf8'));
    const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8')) as { project: string; applied_at: string; migration_sha256: string };
    const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8')) as { classifications: LearningClassification[]; topics: LearningTopic[] };
    if (receipt.project !== before.project || after.project !== before.project || receipt.migration_sha256 !== inputs[migrationFile]) throw new Error('적용 증거·프로젝트·SQL 해시가 다릅니다.');
    process.loadEnvFile('.env.local');
    const endpoint = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''); const project = endpoint.hostname.split('.')[0];
    if (project !== before.project || project !== option('--expected-project') || !/^[a-z0-9]{20}$/.test(project)
        || endpoint.hostname !== `${project}.supabase.co`) throw new Error('조회할 DB 프로젝트가 일치하지 않습니다.');
    const token = process.env.SUPABASE_ACCESS_TOKEN; if (!token) throw new Error('읽기 전용 DB 관리 연결이 없습니다.');
    const requestedAt = new Date().toISOString();
    const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: verificationQuery, read_only: true }), signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`읽기 전용 검증 실패 (${response.status}); 응답 본문은 비밀정보 보호를 위해 출력하지 않습니다.`);
    const result = await response.json() as Array<{ verification: Live }>;
    if (!Array.isArray(result) || !result[0]?.verification) throw new Error('읽기 전용 DB 응답 형식이 올바르지 않습니다.');
    const live = result[0].verification;
    if (live.migration_source_sha256 !== inputs[migrationFile]) throw new Error('적용 SQL이 검토한 읽기 RPC 구현과 다릅니다.');
    // The Management API's read-only role may inspect tables, but cannot execute
    // service-only functions. Read RPCs use the server credential, as inspection
    // already does. The allowlist contains no writing or grading functions.
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error('읽기 RPC 서버 연결이 없습니다.');
    type ReadRpc = 'cpa_get_question_version' | 'cpa_get_public_question_version' | 'cpa_get_active_question_bank' | 'cpa_get_learning_classifications';
    const rpcCounts: Partial<Record<ReadRpc, number>> = {};
    async function rpc<T>(name: ReadRpc, payload: unknown): Promise<T> {
        const fetched = await fetch(`${endpoint.origin}/rest/v1/rpc/${name}`, {
            method: 'POST', headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload), signal: AbortSignal.timeout(30000),
        });
        if (!fetched.ok) throw new Error(`읽기 전용 ${name} 조회 실패 (${fetched.status}); 응답 본문은 출력하지 않습니다.`);
        rpcCounts[name] = (rpcCounts[name] ?? 0) + 1;
        return await fetched.json() as T;
    }
    const activeRelease = live.releases.find(release => release.status === 'active');
    if (!activeRelease) throw new Error('활성 릴리스가 없습니다.');
    [live.active_public, live.active_classifications] = await Promise.all([
        rpc<unknown[]>('cpa_get_active_question_bank', {}),
        rpc<LearningClassification[]>('cpa_get_learning_classifications', { p_release_id: activeRelease.id, p_classification_version_ids: null }),
    ]);
    for (let index = 0; index < live.source_versions.length; index += 6) {
        const projections = await Promise.all(live.source_versions.slice(index, index + 6).map(async version => {
            const [privateSet, publicSet] = await Promise.all([
                rpc<QuestionSetV3>('cpa_get_question_version', { p_version_id: version.id }),
                rpc<unknown>('cpa_get_public_question_version', { p_version_id: version.id }),
            ]);
            version.question_set = privateSet;
            return { id: version.id, question_set: publicSet };
        }));
        live.public_versions.push(...projections);
    }
    const evaluated = evaluateVerification(before, after, live, catalog, inputs[migrationFile]);
    for (const [file, hash] of Object.entries(inputs)) if (sha(fs.readFileSync(file)) !== hash) throw new Error(`검증 중 입력이 변경되었습니다: ${file}`);
    const report = { format: 1, status: evaluated.failures.length ? 'failed' : 'passed', project, applied_at: receipt.applied_at,
        before_inspected_at: before.inspected_at, after_inspected_at: after.inspected_at, requested_at: requestedAt,
        verified_at: new Date().toISOString(), inputs, query_sha256: sha(verificationQuery), response_content_hash: contentHash(result[0].verification),
        requests: [{ kind: 'Supabase Management database query', http_status: response.status, read_only: true },
            ...Object.entries(rpcCounts).map(([name, count]) => ({ kind: 'REST read-only RPC', name, count, http_status: 200 }))],
        transport_note: 'Management read_only SELECT inspects tables and privileges; service-only read functions use the REST RPC allowlist. No mutation function was called.',
        remote_write_queries: 0, model_api_calls: 0, ...evaluated };
    fs.writeFileSync(outputFile, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ output: outputFile, status: report.status, failures: report.failures,
        active: report.active, activity: report.activity, remote_write_queries: 0, model_api_calls: 0 }, null, 2));
    if (report.failures.length) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
