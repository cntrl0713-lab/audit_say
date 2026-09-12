import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { contentHash } from '../lib/learningSubmission.ts';
import type { LearningClassification, LearningTopic } from '../lib/learningUnits.ts';

const directory = 'cpa_uploader/analysis/reviews/question-unit-migration-2026-09-11';
const migration = 'supabase/migrations/20260911030000_cpa_question_learning_units.sql';
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const sqlLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`;
type RemoteSnapshot = {
    project: string;
    releases: Array<{ id: string; status: string; bank_content_hash: string; public_content_hash: string }>;
    versions: Array<{ id: string; set_id: string; content_hash: string; release_ids: string[]; question_set: { subquestions: Array<{ id: string }> } }>;
    counts: Record<string, number>;
    schema: Array<{ name: string; md5: string }>;
};
interface RolloutPlan {
    format: 1; project: string; migration_file: string; migration_sha256: string;
    snapshot_file: string; snapshot_sha256: string; catalog_file: string; catalog_sha256: string;
    releases: RemoteSnapshot['releases']; versions: Array<{ id: string; content_hash: string }>;
    functions: RemoteSnapshot['schema'];
    imports: Array<{ release_id: string; topics: LearningTopic[]; entries: Array<Record<string, unknown>> }>;
    scope: string;
}

export function prepareRollout(): RolloutPlan {
    const snapshotFile = `${directory}/remote-before.json`, catalogFile = 'cpa_uploader/data/learning-question-classifications.json';
    const snapshotBytes = fs.readFileSync(snapshotFile, 'utf8'), catalogBytes = fs.readFileSync(catalogFile, 'utf8');
    const snapshot: RemoteSnapshot = JSON.parse(snapshotBytes);
    const catalog = JSON.parse(catalogBytes) as { classifications: LearningClassification[]; topics: LearningTopic[]; review_file: string; review_file_sha256: string; source_file: string; source_file_sha256: string };
    if (sha(fs.readFileSync(catalog.review_file)) !== catalog.review_file_sha256 || sha(fs.readFileSync(catalog.source_file)) !== catalog.source_file_sha256) throw new Error('분류 입력이 변경되었습니다.');
    const reviewed = JSON.parse(fs.readFileSync(catalog.source_file, 'utf8')) as Array<{ id: string; shared_context: unknown; subquestions: Array<{ id: string; prompt: string; model_answer: string[] }> }>;
    for (const version of snapshot.versions) {
        const source = reviewed.find(set => set.id === version.set_id);
        const remote = version.question_set as typeof source;
        if (!source || !remote || contentHash(source.shared_context) !== contentHash(remote.shared_context)
            || remote.subquestions.some(sub => { const original = source.subquestions.find(q => q.id === sub.id); return !original || original.prompt !== sub.prompt || contentHash(original.model_answer) !== contentHash(sub.model_answer); })) {
            throw new Error(`실제 DB 원문과 분류 검토 원문의 사실·요구가 다릅니다: ${version.set_id}`);
        }
    }
    return {
        format: 1, project: snapshot.project, migration_file: migration, migration_sha256: sha(fs.readFileSync(migration)),
        snapshot_file: snapshotFile, snapshot_sha256: sha(snapshotBytes), catalog_file: catalogFile, catalog_sha256: sha(catalogBytes),
        releases: snapshot.releases, versions: snapshot.versions.map(({ id, content_hash }) => ({ id, content_hash })), functions: snapshot.schema,
        scope: '기존·과거 DB 물음의 학습 유형/주제 메타데이터와 선택 제출 구조만 이관. 문제 원문·정답·배점·릴리스·초안 게시·앱 배포는 변경하지 않음.',
        imports: snapshot.releases.filter(release => ['active', 'retired'].includes(release.status)).map(release => ({
            release_id: release.id, topics: catalog.topics,
            entries: snapshot.versions.filter(version => version.release_ids.includes(release.id)).flatMap(version => version.question_set.subquestions.map(sub => {
                const classification = catalog.classifications.find(row => row.source_set_id === version.set_id && row.subquestion_id === sub.id);
                if (!classification) throw new Error('이관 분류에 빠진 DB 물음이 있습니다.');
                return { set_id: version.set_id, subquestion_id: sub.id, source_content_hash: version.content_hash,
                    question_style: classification.question_style, topic_ids: classification.topic_ids,
                    standalone_prompt: classification.standalone_prompt, case_fact_ids: classification.case_fact_ids ?? [] };
            })),
        })),
    };
}

export async function main(args = process.argv.slice(2)) {
    const option = (name: string) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
    const planFile = option('--plan') ?? `${directory}/rollout-plan.json`;
    if (!args.includes('--apply')) {
        const plan = prepareRollout(), bytes = JSON.stringify(plan, null, 2) + '\n';
        fs.writeFileSync(planFile, bytes, { flag: 'wx' });
        console.log(JSON.stringify({ plan_file: planFile, plan_sha256: sha(bytes), project: plan.project,
            releases: plan.imports.map(item => ({ release_id: item.release_id, questions: item.entries.length })), source_versions: plan.versions.length,
            scope: plan.scope, applied: false }, null, 2));
        return;
    }
    const bytes = fs.readFileSync(planFile, 'utf8'), plan: RolloutPlan = JSON.parse(bytes);
    if (plan.format !== 1 || option('--expected-plan-hash') !== sha(bytes)) throw new Error('검토한 이관 계획 해시를 명시해야 합니다.');
    if (JSON.stringify(prepareRollout()) !== JSON.stringify(plan)) throw new Error('계획 이후 입력·SQL이 바뀌었습니다. 새 경로로 준비하세요.');
    process.loadEnvFile('.env.local');
    const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
    if (project !== plan.project || project !== option('--expected-project') || !/^[a-z0-9]{20}$/.test(project)) throw new Error('적용 DB 프로젝트가 일치하지 않습니다.');
    const token = process.env.SUPABASE_ACCESS_TOKEN;
    if (!token) throw new Error('DB 관리 연결이 없습니다.');
    const sql = fs.readFileSync(plan.migration_file, 'utf8');
    const versionValues = plan.versions.map(item => `(${sqlLiteral(item.id)}::uuid,${sqlLiteral(item.content_hash)})`).join(',');
    const releaseValues = plan.releases.map(item => `(${sqlLiteral(item.id)}::uuid,${sqlLiteral(item.status)},${sqlLiteral(item.bank_content_hash)},${sqlLiteral(item.public_content_hash)})`).join(',');
    if (plan.functions.length !== 6) throw new Error('검토할 제출·회원권 RPC 목록이 누락되었습니다.');
    const functionValues = plan.functions.map(item => `(${sqlLiteral(item.name)},${sqlLiteral(item.md5)})`).join(',');
    const transaction = `begin;
set local statement_timeout='55s';
select pg_advisory_xact_lock(hashtext('audit-say:learning-unit-migration'));
lock table public.cpa_question_bank_releases,public.cpa_question_bank_release_items,public.cpa_question_set_versions in share row exclusive mode;
do $guard$ begin
 if to_regclass('public.cpa_learning_question_versions') is not null then raise exception 'Learning unit migration already exists; inspect before retry'; end if;
 if (select count(*) from public.cpa_question_set_versions)<>${plan.versions.length} or exists(select 1 from (values ${versionValues}) e(id,hash) left join public.cpa_question_set_versions v on v.id=e.id where v.content_hash is distinct from e.hash) then raise exception 'Source versions changed after inspection'; end if;
 if (select count(*) from public.cpa_question_bank_releases)<>${plan.releases.length} or exists(select 1 from (values ${releaseValues}) e(id,status,hash,public_hash) left join public.cpa_question_bank_releases r on r.id=e.id where r.status is distinct from e.status or r.bank_content_hash is distinct from e.hash or r.public_content_hash is distinct from e.public_hash) then raise exception 'Published releases changed after inspection'; end if;
 if exists(select 1 from (values ${functionValues}) e(name,hash) left join pg_proc p on p.proname=e.name and p.pronamespace='public'::regnamespace where p.oid is null or md5(pg_get_functiondef(p.oid)) is distinct from e.hash) then raise exception 'Submission or membership RPC changed after inspection'; end if;
end $guard$;
${sql.replace(/^begin;\r?\n/m, '').replace(/commit;\s*$/, '')}
${plan.imports.map(item => `select jsonb_array_length(public.cpa_import_learning_classifications(${sqlLiteral(JSON.stringify(item))}::jsonb)) as classified;`).join('\n')}
insert into supabase_migrations.schema_migrations(version,name,statements) values('20260911030000','cpa_question_learning_units',array[${sqlLiteral(sql)}]);
notify pgrst,'reload schema';
commit;`;
    const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: transaction, read_only: false }), signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`DB 이관 응답 오류 (${response.status}). 자동 재적용하지 말고 스키마 존재·트랜잭션 완료부터 확인하세요.`);
    const result: unknown = await response.json();
    const receiptFile = option('--receipt') ?? `${directory}/rollout-receipt.json`;
    const receipt = { applied_at: new Date().toISOString(), project, plan_file: planFile, plan_sha256: sha(bytes), migration_sha256: sha(sql),
        classification_counts: plan.imports.map(item => ({ release_id: item.release_id, questions: item.entries.length })), transaction_response: result,
        new_questions_published: false, app_deployed: false, post_verification: 'pending' };
    fs.writeFileSync(receiptFile, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ receipt: receiptFile, applied: true, post_verification: 'pending' }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
