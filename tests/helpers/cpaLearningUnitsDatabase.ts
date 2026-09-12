import { readFileSync } from 'node:fs';
import { createLearningDatabase } from './cpaLearningDatabase.ts';
// Use the actual common-account migration and historical CTA fixtures, so the
// selected-question tests exercise production membership wrappers unchanged.
const migration=readFileSync(new URL('../../supabase/migrations/20260910090000_common_accounts.sql',import.meta.url),'utf8');
const ctaMigration=(name:string)=>readFileSync(new URL('../fixtures/sharedAccounts/'+name,import.meta.url),'utf8');
export async function applyLearningUnitsMigration(db: Awaited<ReturnType<typeof createLearningDatabase>>) {
  await db.exec(readFileSync(new URL('../../supabase/migrations/20260911030000_cpa_question_learning_units.sql',import.meta.url),'utf8'));
}
export async function createLearningUnitsDatabase(options: { applyLearningUnits?: boolean } = {}) {
  const db = await createLearningDatabase({ learningRpc: true });
  try {
    await db.exec(`
      alter table auth.users add column email text, add column email_confirmed_at timestamptz,
        add column raw_user_meta_data jsonb not null default '{}';
      update auth.users set email=id||'@example.test',email_confirmed_at=now();
      create type public.member_tier as enum('guest','member','pro','admin');
      create table public.cta_user(id uuid primary key references auth.users(id) on delete cascade,
        email text,tier public.member_tier not null default 'member',exp integer not null default 0,
        nickname text not null unique,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
      create unique index cta_user_nickname_ci on public.cta_user(lower(nickname));
      alter table public.cta_user enable row level security;
      create policy "Users can select their own data" on public.cta_user for select using(auth.uid()=id);
      create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at:=now();return new;end$$;
      create table public.cta_problem(id integer primary key);
      insert into public.cta_problem values(1),(2),(3),(4);
      create table public.cta_grading_attempt(id uuid primary key default gen_random_uuid(),
        user_id uuid not null references auth.users(id) on delete cascade,problem_id integer references public.cta_problem(id),
        answers_json jsonb,result_json jsonb,created_at timestamptz not null default now(),
        is_saved_note boolean not null default false,note_saved_at timestamptz,hint_used boolean not null default false);
      create table public.cta_problem_assist(id bigserial primary key,user_id uuid not null references auth.users(id) on delete cascade,
        problem_id integer not null references public.cta_problem(id) on delete cascade,
        hint_used_at timestamptz,answer_used_at timestamptz,unique(user_id,problem_id));
    `);
    await db.exec(ctaMigration('20260901140000_add_monetization_schema.sql'));
    await db.exec('create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user()');
    await db.exec(ctaMigration('20260904110000_harden_security_boundaries.sql'));
    await db.exec('create table public.cpa_firm_registered(firm_id bigint primary key)');
    await db.exec(readFileSync(new URL('../../supabase/migrations/20260909010000_kicpa_jobs.sql',import.meta.url),'utf8'));
    for (const table of ['cpa_review_notes','cpa_firm_chat_message','cpa_firm_review','cpa_firm_subscription']) {
      await db.exec(`create table public.${table}(id bigint generated always as identity primary key,
        user_id uuid not null references auth.users(id) on delete cascade, fixture_payload text)`);
    }
    await db.exec(migration);
    if (options.applyLearningUnits !== false) await applyLearningUnitsMigration(db);
    return db;
  } catch (error) { await db.close(); throw error; }
}
