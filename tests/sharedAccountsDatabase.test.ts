import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import { createLearningDatabase, importQuestionBank, memberId, otherMemberId, guestId } from './helpers/cpaLearningDatabase.ts';

const migration = readFileSync(new URL('../supabase/migrations/20260910090000_common_accounts.sql', import.meta.url), 'utf8');
// Frozen, byte-identical historical CTA migrations keep this test runnable in an
// audit_say-only checkout. They are fixtures, never a second deployment source.
const ctaMigration = (name: string) => readFileSync(new URL(`fixtures/sharedAccounts/${name}`, import.meta.url), 'utf8');
async function value<T>(db: PGlite, sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<{value:T}>(`select ${sql} as value`, params)).rows[0].value;
}
async function setup() {
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
    await db.exec(readFileSync(new URL('../supabase/migrations/20260909010000_kicpa_jobs.sql',import.meta.url),'utf8'));
    for (const table of ['cpa_review_notes','cpa_firm_chat_message','cpa_firm_review','cpa_firm_subscription']) {
      await db.exec(`create table public.${table}(id bigint generated always as identity primary key,
        user_id uuid not null references auth.users(id) on delete cascade, fixture_payload text)`);
    }
    await db.exec(migration);
    return db;
  } catch (error) { await db.close(); throw error; }
}
type Withdrawal = {status:string; membership_version:number; cleanup_pending:boolean; billing_review_required:boolean};
const join = (db:PGlite,id=memberId,service='cta') => value<Record<string,unknown>>(db,'common_join_service($1,$2)',[id,service]);
const withdraw = (db:PGlite,id=memberId,service='cta',version=1) => value<Withdrawal>(db,'common_withdraw_service($1,$2,$3)',[id,service,version]);

test('common signup reserves nickname without enrolling either service; shared rename, RLS, and verified explicit join', async () => {
  const db=await setup();
  try {
    const fresh=randomUUID();
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'fresh@example.test','{\"nickname\":\"통합계정\"}')",[fresh]);
    assert.equal(await value(db,'(select nickname from common_profiles where id=$1)',[fresh]),'통합계정');
    assert.equal(await value(db,'(select count(*)::int from cta_user where id=$1)',[fresh]),0);
    assert.equal(await value(db,'(select count(*)::int from cpa_users where id=$1)',[fresh]),0);
    await assert.rejects(join(db,fresh),/VERIFIED_ACCOUNT_REQUIRED/);
    await assert.rejects(db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'dup@example.test','{\"nickname\":\"통합계정\"}')",[randomUUID()]),/duplicate key/);
    await db.query('update auth.users set email_confirmed_at=now() where id=$1',[fresh]);
    await join(db,fresh); await join(db,fresh,'cpa');
    assert.equal((await join(db,fresh)).membership_version,1);
    await value(db,'common_update_nickname($1,$2)',[fresh,'SharedName']);
    assert.equal(await value(db,'(select nickname from cta_user where id=$1)',[fresh]),'SharedName');
    assert.equal(await value(db,'(select username from cpa_users where id=$1)',[fresh]),'SharedName');
    await assert.rejects(value(db,'common_update_nickname($1,$2)',[memberId,'sharedname']),/duplicate key/);
    await db.query('update auth.users set email=$2 where id=$1',[fresh,'new@example.test']);
    assert.equal(await value(db,'(select email from cta_user where id=$1)',[fresh]),'new@example.test');
    assert.equal(await value(db,'(select count(*)::int from common_profiles where id=$1)',[guestId]),0);
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${fresh}'`);
    assert.equal(await value(db,'(select count(*)::int from common_profiles)'),1);
    await assert.rejects(value(db,'common_join_service($1,$2)',[fresh,'cta']),/permission denied/);
    await assert.rejects(db.query("update common_profiles set nickname='Hacked' where id=$1",[fresh]),/permission denied/);
    await assert.rejects(db.query("update cta_user set membership_status='active' where id=$1",[fresh]),/permission denied/);
    await db.exec('reset role; set role service_role');
    await assert.rejects(value(db,'common_legacy_extend_pro($1,30,$2,null)',[fresh,'manual_admin']),/permission denied/);
  } finally {await db.close();}
});

test('service withdrawal deletes CTA learning but preserves CPA, quota receipts and referral eligibility; stale rejoin writes fail',async()=>{
  const db=await setup();
  try{
    await join(db); await join(db,otherMemberId);
    await db.query('insert into cta_referral(referee_id,referrer_id) values($1,$2)',[memberId,otherMemberId]);
    await value(db,'consume_hint_quota($1,1,1,1)',[memberId]);
    const attempt=await value<string>(db,"reserve_grading_attempt($1,1,'{}',false,3,now()-interval '1 day',1)",[memberId]);
    await db.query("update cta_grading_attempt set result_json='{}' where id=$1",[attempt]);
    await value<string>(db,"reserve_grading_attempt($1,2,'{}',false,3,now()-interval '1 day',1)",[memberId]);
    assert.equal((await withdraw(db)).status,'withdrawn');
    assert.equal(await value(db,'(select count(*)::int from cta_grading_attempt where user_id=$1)',[memberId]),0);
    assert.equal(await value(db,'(select count(*)::int from cta_problem_assist where user_id=$1)',[memberId]),0);
    assert.equal(await value(db,"(select count(*)::int from cta_usage_receipts where user_id=$1 and kind='grade')",[memberId]),2);
    assert.equal(await value(db,'(select membership_status from cpa_users where id=$1)',[memberId]),'active');
    assert.equal(await value(db,'(select exp::int from cpa_users where id=$1)',[memberId]),17);
    assert.equal(await value(db,'(select status from cta_referral where referee_id=$1)',[memberId]),'cancelled');
    assert.equal((await join(db)).membership_version,2);
    assert.equal((await join(db)).tier,'member');
    assert.equal(await value(db,'common_cta_hint_usage($1)',[memberId]),1);
    const quota=await db.query<{allowed:boolean}>('select * from consume_hint_quota($1,2,1,2)',[memberId]);
    assert.equal(quota.rows[0].allowed,false);
    assert.equal(await value(db,"reserve_grading_attempt($1,2,'{}',false,1,now()-interval '1 day',2)",[memberId]),null);
    assert.equal(await value(db,"reserve_grading_attempt($1,2,'{}',false,2,now()-interval '1 day',2)",[memberId]),null);
    await assert.rejects(value(db,"reserve_grading_attempt($1,2,'{}',false,3,now()-interval '1 day',1)",[memberId]),/STALE_MEMBERSHIP/);
    await assert.rejects(withdraw(db),/STALE_MEMBERSHIP/);
    await assert.rejects(db.query("insert into cta_problem_assist(user_id,problem_id,membership_version) values($1,3,1)",[memberId]),/STALE_MEMBERSHIP/);
    await assert.rejects(db.query('insert into cta_referral(referee_id,referrer_id,referee_membership_version) values($1,$2,2)',[memberId,otherMemberId]),/duplicate key/);
    const guestAttempt=await value(db,"reserve_grading_attempt($1,1,'{}',false,1,now()-interval '1 day',null)",[guestId]);
    assert.ok(guestAttempt);
  } finally {await db.close();}
});

test('CPA withdrawal respects immutable history boundary, removes retained attempts, and rejects old tokens after rejoin',async()=>{
  const db=await setup();
  try{
    const bank=await importQuestionBank(db);
    await value(db,'cpa_initialize_learning_progress()');
    const answers={sub1:'독립성을 유지한다.',sub2:'전문가적 의구심을 유지한다.'};
    const payload={owner_user_id:memberId,actor_kind:'member',membership_version:1,release_id:bank.release_id,
      set_id:bank.question_versions[0].set_id,set_version_id:bank.question_versions[0].set_version_id,
      submission_key:randomUUID(),answers_hash:createHash('sha256').update(JSON.stringify(answers)).digest('hex'),
      submitted_at:await value(db,'clock_timestamp()::text'),expires_at:null,answers};
    const attempt=await value<{attempt_id:string}>(db,'cpa_begin_attempt($1::jsonb)',[JSON.stringify(payload)]);
    await db.query('insert into cpa_kicpa_jobs_subscribers(user_id,membership_version) values($1,1)',[memberId]);
    for (const table of ['cpa_review_notes','cpa_firm_chat_message','cpa_firm_review','cpa_firm_subscription']) {
      await assert.rejects(db.query(`insert into ${table}(user_id) values($1)`,[memberId]),/MEMBERSHIP_VERSION_REQUIRED/);
      await db.query(`insert into ${table}(user_id,membership_version) values($1,1)`,[memberId]);
    }
    await value(db,'cpa_claim_grading_run($1,$2,$3)',[attempt.attempt_id,memberId,JSON.stringify({engine_version:'test',grading_contract_hash:'test'})]);
    await assert.rejects(db.query('delete from cpa_attempts where id=$1',[attempt.attempt_id]),/cannot be deleted directly/);
    await assert.rejects(db.query('delete from cpa_xp_events where user_id=$1',[memberId]),/append-only/);
    assert.equal((await withdraw(db,memberId,'cpa')).status,'withdrawn');
    assert.equal(await value(db,'(select count(*)::int from cpa_attempts where owner_user_id=$1)',[memberId]),0);
    assert.equal(await value(db,'(select count(*)::int from cpa_xp_events where user_id=$1)',[memberId]),0);
    assert.equal(await value(db,'(select exp::int from cpa_users where id=$1)',[memberId]),0);
    assert.equal(await value(db,'(select count(*)::int from cpa_kicpa_jobs_subscribers where user_id=$1)',[memberId]),0);
    for (const table of ['cpa_review_notes','cpa_firm_chat_message','cpa_firm_review','cpa_firm_subscription']) {
      assert.equal(await value(db,`(select count(*)::int from ${table} where user_id=$1)`,[memberId]),0);
    }
    assert.ok(await value<number>(db,'(select count(*)::int from cpa_question_sets)'));
    await join(db,memberId,'cpa');
    await assert.rejects(db.query('insert into cpa_kicpa_jobs_subscribers(user_id,membership_version) values($1,1)',[memberId]),/STALE_MEMBERSHIP/);
    for (const table of ['cpa_review_notes','cpa_firm_chat_message','cpa_firm_review','cpa_firm_subscription']) {
      await assert.rejects(db.query(`insert into ${table}(user_id,membership_version) values($1,1)`,[memberId]),/STALE_MEMBERSHIP/);
    }
    await assert.rejects(value(db,'cpa_begin_attempt($1::jsonb)',[JSON.stringify(payload)]),/STALE_MEMBERSHIP/);
    await assert.rejects(value(db,'cpa_claim_grading_run($1,$2,$3)',[attempt.attempt_id,memberId,'{}']),/Attempt not found/);
  } finally {await db.close();}
});

test('billing worker can reclaim ended initial setup for lookup only and cannot claim a new order after withdrawal',async()=>{
  const db=await setup();
  try{
    await join(db);
    const firstClaim=randomUUID();
    const setupRow=(await db.query<{subscription_id:number}>('select * from begin_subscription_setup($1,$2,$3,120,1)',[memberId,'recovery_order',firstClaim])).rows[0];
    await value(db,'set_subscription_setup_billing_key($1,$2,$3,$4,$5)',[setupRow.subscription_id,firstClaim,'recovery_order','cleanup-key','customer']);
    await withdraw(db);
    const recoveryClaim=randomUUID();
    assert.equal((await db.query('select * from claim_subscription_billing($1,$2,$3,120)',[setupRow.subscription_id,'cron',recoveryClaim])).rows.length,0);
    await db.query("update cta_subscription set billing_claimed_until=now()-interval '1 second' where id=$1",[setupRow.subscription_id]);
    const recovered=(await db.query<{reconcile_only:boolean;cancel_at_period_end:boolean;billing_setup_state:string;membership_version:number}>('select * from claim_subscription_billing($1,$2,$3,120)',[setupRow.subscription_id,'cron',recoveryClaim])).rows[0];
    assert.equal(recovered.reconcile_only,true);assert.equal(recovered.cancel_at_period_end,true);
    assert.equal(recovered.billing_setup_state,'pending');assert.equal(recovered.membership_version,1);
    assert.equal(await value(db,'abort_subscription_setup($1,$2,$3,true)',[setupRow.subscription_id,recoveryClaim,'recovery_order']),true);
    assert.equal((await db.query('select * from claim_subscription_billing($1,$2,$3,120)',[setupRow.subscription_id,'cron',randomUUID()])).rows.length,0);
    assert.equal(await value(db,'(select count(*)::int from cta_billing_key_cleanup where user_id=$1)',[memberId]),1);
  }finally{await db.close();}
});

test('unknown never-submitted provider order requires owner evidence, quiescence delay and no known success before cleanup',async()=>{
  const db=await setup();
  try{
    await join(db);
    const claim=randomUUID(),order='never-submitted-order';
    const setupRow=(await db.query<{subscription_id:number}>('select * from begin_subscription_setup($1,$2,$3,120,1)',[memberId,order,claim])).rows[0];
    const evidence='Provider original order and card transaction records verified with operations ticket CASE-2026-001; no approval exists.';
    await withdraw(db);
    await db.exec('set role service_role');
    await assert.rejects(value(db,'common_resolve_withdrawn_order_no_charge($1,$2,$3)',[setupRow.subscription_id,order,evidence]),/permission denied/);
    await db.exec('reset role');
    await assert.rejects(value(db,'common_resolve_withdrawn_order_no_charge($1,$2,$3)',[setupRow.subscription_id,order,'one 404']),/PROVIDER_EVIDENCE_REQUIRED/);
    await assert.rejects(value(db,'common_resolve_withdrawn_order_no_charge($1,$2,$3)',[setupRow.subscription_id,order,evidence]),/MAY_BE_IN_FLIGHT/);
    await db.query("update cta_subscription set withdrawal_started_at=now()-interval '16 minutes',billing_claimed_until=now()-interval '1 minute' where id=$1",[setupRow.subscription_id]);
    const done=await value<{resolved:boolean}>(db,'common_resolve_withdrawn_order_no_charge($1,$2,$3)',[setupRow.subscription_id,order,evidence]);
    assert.equal(done.resolved,true);
    assert.equal((await withdraw(db)).status,'withdrawn');
    assert.equal(await value(db,'(select resolution from common_payment_resolution_log where order_id=$1)',[order]),'provider_confirmed_no_charge');
    assert.equal(await value(db,'(select failure_code from cta_payment_log where toss_order_id=$1)',[order]),'OPERATOR_VERIFIED_NO_CHARGE');
    assert.equal((await value<{ready_for_auth_delete:boolean}>(db,'common_prepare_account_deletion($1)',[memberId])).ready_for_auth_delete,true);

    await join(db,otherMemberId);
    const secondClaim=randomUUID(),paidOrder='already-approved-order';
    const paid=(await db.query<{subscription_id:number}>('select * from begin_subscription_setup($1,$2,$3,120,1)',[otherMemberId,paidOrder,secondClaim])).rows[0];
    await withdraw(db,otherMemberId);
    await db.query("update cta_subscription set withdrawal_started_at=now()-interval '16 minutes',billing_claimed_until=now()-interval '1 minute' where id=$1",[paid.subscription_id]);
    await db.query("insert into cta_payment_log(user_id,subscription_id,status,toss_order_id,toss_payment_key) values($1,$2,'success',$3,'known-payment')",[otherMemberId,paid.subscription_id,paidOrder]);
    await assert.rejects(value(db,'common_resolve_withdrawn_order_no_charge($1,$2,$3)',[paid.subscription_id,paidOrder,evidence]),/KNOWN_PAYMENT_REQUIRES_RECONCILIATION/);
  }finally{await db.close();}
});

test('withdrawal keeps provider cleanup pending and late verified payment cannot restore entitlement or rewards',async()=>{
  const db=await setup();
  try{
    await join(db);
    const claim=randomUUID(),order='setup_test_order';
    const setupRow=(await db.query<{subscription_id:number}>('select * from begin_subscription_setup($1,$2,$3,120,1)',[memberId,order,claim])).rows[0];
    assert.equal(await value(db,'set_subscription_setup_billing_key($1,$2,$3,$4,$5)',[setupRow.subscription_id,claim,order,'billing-secret','customer']),true);
    const pending=await withdraw(db);
    assert.equal(pending.status,'withdrawing');assert.equal(pending.cleanup_pending,true);
    await assert.rejects(join(db),/REJOIN_UNAVAILABLE/);
    assert.ok(await value(db,'finalize_subscription_setup($1,$2,$3,$4,9900,30,null)',[setupRow.subscription_id,claim,order,'payment-late']));
    assert.equal(await value(db,'(select status from cta_subscription where id=$1)',[setupRow.subscription_id]),'expired');
    assert.equal(await value(db,'(select tier::text from cta_user where id=$1)',[memberId]),'member');
    assert.equal(await value(db,'(select count(*)::int from cta_pro_reward where user_id=$1)',[memberId]),0);
    assert.equal(await value(db,'(select requires_refund_review from cta_payment_log where user_id=$1)',[memberId]),true);
    assert.equal((await value<{ready_for_auth_delete:boolean}>(db,'common_prepare_account_deletion($1)',[memberId])).ready_for_auth_delete,false);
    await assert.rejects(db.query('delete from auth.users where id=$1',[memberId]),/CLEANUP_REQUIRED/);
    const cleanupClaim=randomUUID();
    const cleanup=(await db.query<{id:number}>('select * from claim_billing_key_cleanup($1)',[cleanupClaim])).rows[0];
    assert.ok(cleanup);
    assert.equal(await value(db,'finalize_billing_key_cleanup($1,$2,true,null)',[cleanup.id,cleanupClaim]),true);
    await db.query("update cta_payment_log set status='cancelled' where user_id=$1",[memberId]);
    assert.equal((await value<{ready_for_auth_delete:boolean}>(db,'common_prepare_account_deletion($1)',[memberId])).ready_for_auth_delete,true);
    await db.query('delete from auth.users where id=$1',[memberId]);
    assert.equal(await value(db,"(select count(*)::int from cta_payment_log where toss_payment_key='payment-late' and user_id is null)"),1);
    assert.equal(await value(db,'(select count(*)::int from cta_subscription where id=$1 and user_id is null)',[setupRow.subscription_id]),1);
    assert.equal(await value(db,'(select count(*)::int from common_profiles where id=$1)',[memberId]),0);
  } finally {await db.close();}
});

test('refund from the old membership preserves a new membership subscription and normal renewal still works',async()=>{
  const db=await setup();
  try{
    await join(db);
    await value(db,"extend_pro($1,30,'manual_admin',null)",[memberId]);
    const subscription=await value<number>(db,'(select id from cta_subscription where user_id=$1)',[memberId]);
    await db.query("insert into cta_payment_log(user_id,subscription_id,status,toss_order_id,toss_payment_key,billing_period_end) values($1,$2,'success','old-membership-payment','old-key',now())",[memberId,subscription]);
    await withdraw(db);await join(db);
    const setupClaim=randomUUID();
    await db.query('select * from begin_subscription_setup($1,$2,$3,120,2)',[memberId,'new-membership-setup',setupClaim]);
    await value(db,'set_subscription_setup_billing_key($1,$2,$3,$4,$5)',[subscription,setupClaim,'new-membership-setup','new-billing-key','customer']);
    await value(db,'finalize_subscription_setup($1,$2,$3,$4,9900,30,null)',[subscription,setupClaim,'new-membership-setup','new-payment-key']);
    const newEnd=await value(db,'(select current_period_end::text from cta_subscription where id=$1)',[subscription]);
    assert.equal(await value(db,'(select membership_version::int from cta_payment_log where toss_payment_key=$1)',['new-payment-key']),2);
    assert.equal(await value(db,'apply_verified_payment_cancellation($1,false)',['old-key']),true);
    assert.equal(await value(db,'(select current_period_end::text from cta_subscription where id=$1)',[subscription]),newEnd);
    assert.equal(await value(db,'(select cancel_at_period_end from cta_subscription where id=$1)',[subscription]),false);
    await db.query("update cta_subscription set current_period_end=now()-interval '1 second' where id=$1",[subscription]);
    const renewalClaim=randomUUID();
    const claim=(await db.query<{order_id:string;membership_version:number}>('select * from claim_subscription_billing($1,$2,$3,120)',[subscription,'cron',renewalClaim])).rows[0];
    assert.ok(claim.order_id);assert.equal(claim.membership_version,2);
    assert.equal(await value(db,'finalize_billing_success($1,$2,$3,$4,9900,30)',[subscription,renewalClaim,claim.order_id,'renewal-payment-key']),true);
    assert.equal(await value(db,'(select status from cta_subscription where id=$1)',[subscription]),'active');
    await assert.rejects(db.query('select * from cancel_subscription_renewal($1,1)',[memberId]),/STALE_MEMBERSHIP/);
  }finally{await db.close();}
});

test('service suspension survives withdraw/rejoin, account lock blocks learning, and service administrators remain separate',async()=>{
  const db=await setup();
  try{
    await join(db);
    await db.query('update cpa_users set is_service_admin=true where id=$1',[memberId]);
    assert.equal(await value(db,'(select is_service_admin from cta_user where id=$1)',[memberId]),false);
    await db.query("update common_profiles set account_status='locked' where id=$1",[memberId]);
    await assert.rejects(value(db,"reserve_grading_attempt($1,1,'{}',false,3,now(),1)",[memberId]),/ACCOUNT_UNAVAILABLE/);
    await db.query("update common_profiles set account_status='active' where id=$1",[memberId]);
    await db.query("update cta_user set membership_status='suspended' where id=$1",[memberId]);
    await withdraw(db);
    await assert.rejects(join(db),/REJOIN_UNAVAILABLE/);
    assert.equal(await value(db,'(select membership_status from cpa_users where id=$1)',[memberId]),'active');
  } finally {await db.close();}
});
