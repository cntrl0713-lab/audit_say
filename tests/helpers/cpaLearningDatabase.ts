import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import type { QuestionSetV3 } from '../../lib/questionV3.ts';

export const memberId = '00000000-0000-4000-8000-000000000001';
export const otherMemberId = '00000000-0000-4000-8000-000000000002';
export const guestId = '00000000-0000-4000-8000-000000000003';

export async function createLearningDatabase(options: { learningRpc?: boolean } = {}): Promise<PGlite> {
    const db = new PGlite();
    try {
        await db.exec(`
            create role anon; create role authenticated; create role service_role bypassrls;
            grant usage on schema public to anon,authenticated,service_role;
            alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
            create schema auth; grant usage on schema auth to anon,authenticated,service_role;
            create table auth.users(id uuid primary key,is_anonymous boolean not null default false,created_at timestamptz not null default now());
            create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
            create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
            insert into auth.users(id,is_anonymous) values('${memberId}',false),('${otherMemberId}',false),('${guestId}',true);
            create table public.cpa_users(id uuid primary key references auth.users(id) on delete cascade,username text not null,role text not null default 'MEMBER',exp int not null default 0,level int not null default 1,created_at timestamptz not null default now());
            insert into cpa_users(id,username,exp,level) values('${memberId}','member',17,1),('${otherMemberId}','other',0,1);
            alter table cpa_users enable row level security;
            create policy own_read on cpa_users for select to authenticated using(id=auth.uid());
            create policy own_insert on cpa_users for insert to authenticated with check(id=auth.uid());
            create view public.user_cpa with(security_invoker=true) as select * from public.cpa_users;
            comment on view public.user_cpa is 'CPA table-name compatibility view for public.cpa_users';
            revoke all on public.user_cpa from public,postgres,anon,authenticated,service_role;
            grant select,insert,update,delete on public.user_cpa to postgres,anon,authenticated,service_role;
        `);
        const files = ['20260908024404_cpa_learning_schema.sql', '20260908024413_cpa_question_bank_rpc.sql'];
        if (options.learningRpc) files.push('20260908024420_cpa_learning_rpc.sql');
        for (const file of files) {
            await db.exec(fs.readFileSync(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'));
        }
        return db;
    } catch (error) {
        await db.close();
        throw error;
    }
}

export function sampleQuestionSet(id = 'pilot-01-001'): QuestionSetV3 {
    const quote = '감사인은 독립성과 전문가적 의구심을 유지한다.';
    return {
        schema_version: '3.0', id, type: 'linked_question_set', status: 'published', title: '독립성과 의구심',
        classification: { topic_id: '01', part: 'PART1', chapter: '기초', domain: 'audit', standards: ['KGA 200'], tags: ['기초'] },
        source_refs: [{ id: 'src1', file: 'test/source.md', title: '공식 근거', page: 'KGA 200', source_quote: quote, role: 'standard', content_hash: createHash('sha256').update(quote).digest('hex') }],
        shared_context: { facts: [{ id: 'f1', text: '감사인이 업무를 수행한다.', scoreable: false }] },
        learning_order: ['sub2', 'sub1'],
        subquestions: ['독립성', '전문가적 의구심'].map((expected, index) => ({
            id: `sub${index + 1}`, type: index === 0 ? 'judgment' : 'descriptive', prompt: `${expected} 유지 여부를 설명하시오.`,
            constraints: { ordered: false, max_entries: null, overflow_policy: 'none' }, selection: { type: 'all', n: null },
            ...(index === 1 ? { decision: { options: ['유지한다', '유지하지 않는다'], correct: '유지한다' } } : {}),
            model_answer: [`${expected}을 유지한다.`],
            requirements: [{ id: 'req1', source_ref_id: 'src1', source_quote: quote }],
            criteria: [{ id: 'crit1', requirement_id: 'req1', claim: `${expected} 유지`, max_points: 1,
                scores: { met: 1, not_met: 0, contradicted: 0 }, source_ref_ids: ['src1'],
                critical_facts: [{ id: 'fact1', type: 'action', expected: `${expected} 유지` }] }],
        })),
        verification: { source_fidelity: 'exact', review_status: 'verified', calculation_required: false, notes: ['검토 완료'] },
    };
}

export function questionBankPayload(sets: QuestionSetV3[] = [sampleQuestionSet()]) {
    const hash = createHash('sha256').update(JSON.stringify(sets)).digest('hex');
    return { sets, source_file_hash: hash, bank_content_hash: hash, public_content_hash: hash, evidence: '격리 DB 검증', actor_user_id: memberId };
}

export interface ImportedQuestionBank {
    release_id: string;
    set_count: number;
    question_versions: Array<{ set_id: string; set_version_id: string }>;
    reused: boolean;
}

export async function importQuestionBank(db: PGlite, sets: QuestionSetV3[] = [sampleQuestionSet()]): Promise<ImportedQuestionBank> {
    const result = await db.query<{ result: ImportedQuestionBank }>('select public.cpa_import_question_bank($1::jsonb) as result', [JSON.stringify(questionBankPayload(sets))]);
    return result.rows[0].result;
}
