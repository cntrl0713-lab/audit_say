import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createBillingDatabase, value } from './helpers/cpaBillingDatabase.ts';
import { memberId, otherMemberId } from './helpers/cpaLearningDatabase.ts';
import type { PGlite } from '@electric-sql/pglite';

type Setup = { action:string; subscription_id:number; order_id:string; claim_token:string; billing_key:string|null };
async function start(db:PGlite,userId=memberId,version=1) {
    const token=randomUUID(); const order=`cpa_test_${randomUUID()}`;
    const result=await db.query<Setup>('select * from cpa_begin_subscription_setup($1,$2,$3,120,$4)',[userId,order,token,version]);
    return result.rows[0];
}
async function pay(db:PGlite,userId=memberId,referralId:number|null=null,version=1) {
    const setup=await start(db,userId,version);
    assert.equal(setup.action,'started');
    assert.equal(await value(db,'cpa_set_subscription_setup_billing_key($1,$2,$3,$4,$5)',[setup.subscription_id,setup.claim_token,setup.order_id,`key-${setup.order_id}`,`customer-${userId}`]),true);
    const paymentKey=`payment-${setup.order_id}`;
    const params=[setup.subscription_id,setup.claim_token,setup.order_id,paymentKey,9900,30,referralId];
    const end=await value<string>(db,'cpa_finalize_subscription_setup($1,$2,$3,$4,$5,$6,$7)',params);
    return {...setup,paymentKey,params,end};
}

test('Audit billing grants isolated PRO, preserves CTA role, rejects stale setup and duplicate grant',async()=>{
    const db=await createBillingDatabase();
    try {
        await value(db,"common_join_service($1,'cta')",[memberId]);
        const paid=await pay(db);
        assert.equal(await value(db,'(select role from cpa_users where id=$1)',[memberId]),'PRO');
        assert.equal(await value(db,'(select tier from cta_user where id=$1)',[memberId]),'member');
        assert.equal(await value(db,'(select count(*)::int from cta_subscription)'),0);
        assert.equal(await value(db,'(select count(*)::int from cpa_pro_reward)'),1);
        await value(db,'cpa_finalize_subscription_setup($1,$2,$3,$4,$5,$6,$7)',paid.params);
        assert.equal(await value(db,'(select count(*)::int from cpa_pro_reward)'),1);
        assert.equal(await value(db,'(select count(*)::int from cpa_payment_log)'),1);
        await assert.rejects(start(db,memberId,2),/STALE_MEMBERSHIP/);
        await db.exec(`set role authenticated; set request.jwt.claim.sub='${memberId}'`);
        assert.equal(await value(db,'(select count(*)::int from cpa_payment_log)'),1);
        await assert.rejects(db.query('select toss_billing_key from cpa_subscription'),/permission denied/);
        await assert.rejects(value(db,"cpa_extend_pro($1,30,'manual_admin',null)",[memberId]),/permission denied/);
        await db.exec('reset role; set role service_role');
        await assert.rejects(value(db,"cpa_billing_legacy_extend_pro($1,30,'manual_admin',null)",[memberId]),/permission denied/);
    } finally {await db.close();}
});

test('referral rewards mature after 30 days once for both CPA memberships only',async()=>{
    const db=await createBillingDatabase();
    try {
        const referral=(await db.query<{id:number}>('insert into cpa_referral(referrer_id,referee_id,referrer_membership_version,referee_membership_version) values($1,$2,1,1) returning id',[otherMemberId,memberId])).rows[0].id;
        const paid=await pay(db,memberId,referral);
        assert.equal(await value(db,'cpa_grant_mature_referral_rewards(200)'),0);
        await db.query("update cpa_payment_log set created_at=now()-interval '31 days' where toss_order_id=$1",[paid.order_id]);
        assert.equal(await value(db,'cpa_grant_mature_referral_rewards(200)'),1);
        assert.equal(await value(db,'cpa_grant_mature_referral_rewards(200)'),0);
        assert.equal(await value(db,"(select count(*)::int from cpa_pro_reward where reason in ('referral_given','referral_received'))"),2);
        assert.equal(await value(db,'(select role from cpa_users where id=$1)',[otherMemberId]),'PRO');
        assert.equal(await value(db,'(select count(*)::int from cta_pro_reward)'),0);
        const rewardEnd=await value<string>(db,'(select current_period_end::text from cpa_subscription where user_id=$1)',[otherMemberId]);
        const referralOnlyPaid=await pay(db,otherMemberId);
        assert.ok(new Date(referralOnlyPaid.end).getTime()-new Date(rewardEnd).getTime() >= 30*24*60*60*1000-1000);
        await assert.rejects(db.query('insert into cpa_referral(referrer_id,referee_id) values($1,$2)',[otherMemberId,memberId]),/duplicate key/);
    } finally {await db.close();}
});

test('withdrawal keeps unresolved orders for lookup-only reconciliation and blocks account deletion until refund settles',async()=>{
    const db=await createBillingDatabase();
    try {
        const setup=await start(db);
        await value(db,'cpa_set_subscription_setup_billing_key($1,$2,$3,$4,$5)',[setup.subscription_id,setup.claim_token,setup.order_id,'audit-key','audit-customer']);
        const withdrawn=await value<{status:string;billing_review_required:boolean}>(db,"common_withdraw_service($1,'cpa',1)",[memberId]);
        assert.equal(withdrawn.status,'withdrawing');
        assert.equal(withdrawn.billing_review_required,true);
        assert.equal(await value(db,'common_cpa_entitlement_allowed($1,1)',[memberId]),false);
        const end=await value(db,'cpa_finalize_subscription_setup($1,$2,$3,$4,9900,30,null)',[setup.subscription_id,setup.claim_token,setup.order_id,'late-payment']);
        assert.ok(end);
        assert.equal(await value(db,'(select role from cpa_users where id=$1)',[memberId]),'MEMBER');
        assert.equal(await value(db,'(select requires_refund_review from cpa_payment_log where toss_payment_key=$1)',['late-payment']),true);
        assert.equal(await value(db,'(select count(*)::int from cpa_pro_reward)'),0);
        assert.equal(await value(db,'(select count(*)::int from cpa_billing_key_cleanup)'),1);
        const deletion=await value<{ready_for_auth_delete:boolean}>(db,'common_prepare_account_deletion($1)',[memberId]);
        assert.equal(deletion.ready_for_auth_delete,false);
        await assert.rejects(db.query('delete from auth.users where id=$1',[memberId]),/CLEANUP_REQUIRED/);
    } finally {await db.close();}
});

test('uncertain renewals preserve order and failure budget; definitive retry exhaustion expires only CPA',async()=>{
    const db=await createBillingDatabase();
    try {
        const paid=await pay(db);
        await db.query("update cpa_subscription set current_period_end=now()-interval '1 day' where id=$1",[paid.subscription_id]);
        const token=randomUUID();
        const claim=(await db.query<{order_id:string}>('select * from cpa_claim_subscription_billing($1,$2,$3,120)',[paid.subscription_id,'cron',token])).rows[0];
        assert.ok(claim.order_id.startsWith('cpa_'));
        await value(db,'cpa_finalize_billing_failure($1,$2,$3,$4,$5,false)',[paid.subscription_id,token,claim.order_id,'NETWORK_ERROR','uncertain']);
        assert.equal(await value(db,'(select retry_count from cpa_subscription where id=$1)',[paid.subscription_id]),0);
        assert.equal(await value(db,'(select billing_order_id from cpa_subscription where id=$1)',[paid.subscription_id]),claim.order_id);
        for(let attempt=1;attempt<=4;attempt++) {
            await db.query("update cpa_subscription set next_retry_at=now()-interval '1 minute' where id=$1",[paid.subscription_id]);
            const lease=randomUUID();
            const next=(await db.query<{order_id:string}>('select * from cpa_claim_subscription_billing($1,$2,$3,120)',[paid.subscription_id,'retry',lease])).rows[0];
            assert.ok(next);
            await value(db,'cpa_finalize_billing_failure($1,$2,$3,$4,$5,true)',[paid.subscription_id,lease,next.order_id,'REJECT_CARD_PAYMENT','declined']);
            assert.equal(await value(db,'(select retry_count from cpa_subscription where id=$1)',[paid.subscription_id]),attempt);
        }
        assert.equal(await value(db,'(select status from cpa_subscription where id=$1)',[paid.subscription_id]),'expired');
        assert.equal(await value(db,'(select role from cpa_users where id=$1)',[memberId]),'MEMBER');
    } finally {await db.close();}
});

test('manual PRO survives paid-period expiry and refunds; clearing it preserves valid paid access',async()=>{
    const db=await createBillingDatabase();
    try {
        await db.query('update cpa_users set manual_pro=true where id=$1',[memberId]);
        assert.equal(await value(db,'(select role from cpa_users where id=$1)',[memberId]),'PRO');
        const paid=await pay(db);
        await db.query('update cpa_users set manual_pro=false where id=$1',[memberId]);
        assert.equal(await value(db,'(select role from cpa_users where id=$1)',[memberId]),'PRO');
        await db.query('update cpa_users set manual_pro=true where id=$1',[memberId]);
        await value(db,'cpa_record_verified_payment_cancellation($1,$2,9900,false)',[paid.paymentKey,paid.order_id]);
        assert.equal(await value(db,'(select role from cpa_users where id=$1)',[memberId]),'PRO');
        assert.equal(await value(db,'(select manual_pro from cpa_users where id=$1)',[memberId]),true);
        await db.exec(`set role authenticated; set request.jwt.claim.sub='${memberId}'`);
        await assert.rejects(db.query('update cpa_users set manual_pro=true where id=$1',[memberId]),/permission denied/);
        await db.exec('reset role');
        await value(db,"common_withdraw_service($1,'cpa',1)",[memberId]);
        assert.equal(await value(db,'(select manual_pro from cpa_users where id=$1)',[memberId]),false);
        assert.equal(await value(db,'(select role from cpa_users where id=$1)',[memberId]),'MEMBER');
    } finally {await db.close();}
});

test('refunded first payment cancels pending referral reward and authenticated reads remain owner-scoped',async()=>{
    const db=await createBillingDatabase();
    try {
        const referral=(await db.query<{id:number}>('insert into cpa_referral(referrer_id,referee_id,referrer_membership_version,referee_membership_version) values($1,$2,1,1) returning id',[otherMemberId,memberId])).rows[0].id;
        const paid=await pay(db,memberId,referral);
        assert.equal(await value(db,'cpa_record_verified_payment_cancellation($1,$2,9900,false)',[paid.paymentKey,paid.order_id]),true);
        assert.equal(await value(db,'(select status from cpa_referral where id=$1)',[referral]),'cancelled');
        await db.query("update cpa_payment_log set created_at=now()-interval '31 days' where toss_order_id=$1",[paid.order_id]);
        assert.equal(await value(db,'cpa_grant_mature_referral_rewards(200)'),0);
        await db.exec(`set role authenticated; set request.jwt.claim.sub='${otherMemberId}'`);
        assert.equal(await value(db,'(select count(*)::int from cpa_payment_log)'),0);
        await db.exec('reset role');
        await value(db,"common_withdraw_service($1,'cpa',1)",[otherMemberId]);
        await assert.rejects(db.query('insert into cpa_referral(referrer_id,referee_id,referrer_membership_version,referee_membership_version) values($1,$2,1,1)',[otherMemberId,otherMemberId]),/SERVICE_INACTIVE/);
    } finally {await db.close();}
});

test('service-role checkout works and final account deletion anonymizes finance only after CPA key cleanup',async()=>{
    const db=await createBillingDatabase();
    try {
        const fresh=randomUUID();
        await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,'fresh@example.test',now(),'{\"nickname\":\"BillingNew\"}')",[fresh]);
        await db.exec('set role service_role');
        await value(db,"common_join_service($1,'cpa')",[fresh]);
        assert.match(await value<string>(db,'(select referral_code from cpa_users where id=$1)',[fresh]),/^[A-F0-9]{8}$/);
        const paid=await pay(db,fresh);
        await value(db,'cpa_record_verified_payment_cancellation($1,$2,9900,false)',[paid.paymentKey,paid.order_id]);
        await value(db,'common_prepare_account_deletion($1)',[fresh]);
        const token=randomUUID();
        const cleanup=(await db.query<{id:number}>('select * from cpa_claim_billing_key_cleanup($1,120)',[token])).rows[0];
        assert.ok(cleanup);
        await value(db,'cpa_finalize_billing_key_cleanup($1,$2,true,null)',[cleanup.id,token]);
        const state=await value<{ready_for_auth_delete:boolean}>(db,'common_prepare_account_deletion($1)',[fresh]);
        assert.equal(state.ready_for_auth_delete,true);
        await db.exec('reset role');
        await db.query('delete from auth.users where id=$1',[fresh]);
        assert.equal(await value(db,'(select user_id from cpa_payment_log where toss_payment_key=$1)',[paid.paymentKey]),null);
        assert.equal(await value(db,'(select count(*)::int from cpa_payment_log)'),1);
        assert.equal(await value(db,'(select user_id from cpa_subscription where id=$1)',[paid.subscription_id]),null);
    } finally {await db.close();}
});

test('full refunds remove a newly granted period after months-expired resubscription or overdue renewal',async()=>{
    const db=await createBillingDatabase();
    try {
        const original=await pay(db);
        await value(db,'cpa_cancel_subscription_renewal($1,1)',[memberId]);
        await db.query("update cpa_subscription set current_period_end=now()-interval '90 days' where id=$1",[original.subscription_id]);
        const resubscribed=await pay(db);
        assert.equal(await value(db,'(select granted_period_start>billing_period_end from cpa_payment_log where toss_payment_key=$1)',[resubscribed.paymentKey]),true);
        await value(db,'cpa_record_verified_payment_cancellation($1,$2,9900,false)',[resubscribed.paymentKey,resubscribed.order_id]);
        assert.equal(await value(db,'(select current_period_end<=now() from cpa_subscription where id=$1)',[original.subscription_id]),true);
        assert.equal(await value(db,'(select role from cpa_users where id=$1)',[memberId]),'MEMBER');

        const other=await pay(db,otherMemberId);
        await db.query("update cpa_subscription set current_period_end=now()-interval '90 days' where id=$1",[other.subscription_id]);
        const token=randomUUID();
        const claim=(await db.query<{order_id:string}>('select * from cpa_claim_subscription_billing($1,$2,$3,120)',[other.subscription_id,'cron',token])).rows[0];
        await value(db,'cpa_finalize_billing_success($1,$2,$3,$4,9900,30)',[other.subscription_id,token,claim.order_id,'overdue-renewal']);
        assert.equal(await value(db,"(select granted_period_start>billing_period_end from cpa_payment_log where toss_payment_key='overdue-renewal')"),true);
        await value(db,'cpa_record_verified_payment_cancellation($1,$2,9900,false)',['overdue-renewal',claim.order_id]);
        assert.equal(await value(db,'(select current_period_end<=now() from cpa_subscription where id=$1)',[other.subscription_id]),true);
        assert.equal(await value(db,'(select role from cpa_users where id=$1)',[otherMemberId]),'MEMBER');
    } finally {await db.close();}
});

test('a refund removes only its grant while preserving stacked paid and referral periods',async()=>{
    const db=await createBillingDatabase();
    try {
        const first=await pay(db);
        await value(db,"cpa_extend_pro($1,30,'referral_given',null)",[memberId]);
        const protectedEnd=await value<string>(db,'(select current_period_end::text from cpa_subscription where id=$1)',[first.subscription_id]);
        await value(db,'cpa_cancel_subscription_renewal($1,1)',[memberId]);
        const second=await pay(db);
        await value(db,'cpa_record_verified_payment_cancellation($1,$2,9900,false)',[second.paymentKey,second.order_id]);
        assert.equal(await value(db,'(select current_period_end::text from cpa_subscription where id=$1)',[first.subscription_id]),protectedEnd);
        assert.equal(await value(db,'(select role from cpa_users where id=$1)',[memberId]),'PRO');
        await value(db,'cpa_record_verified_payment_cancellation($1,$2,9900,false)',[first.paymentKey,first.order_id]);
        assert.equal(await value(db,"(select current_period_end >= now()+interval '30 days'-interval '1 second' and current_period_end<=now()+interval '30 days' from cpa_subscription where id=$1)",[first.subscription_id]),true);
    } finally {await db.close();}
});

test('referral extension preserves unknown-order retry state and refund uses the later actual grant base',async()=>{
    const db=await createBillingDatabase();
    try {
        const paid=await pay(db);
        await db.query("update cpa_subscription set current_period_end=now()-interval '1 day',retry_count=2 where id=$1",[paid.subscription_id]);
        const token=randomUUID();
        const claim=(await db.query<{order_id:string}>('select * from cpa_claim_subscription_billing($1,$2,$3,120)',[paid.subscription_id,'cron',token])).rows[0];
        await value(db,'cpa_finalize_billing_failure($1,$2,$3,$4,$5,false)',[paid.subscription_id,token,claim.order_id,'NETWORK_ERROR','uncertain']);
        const retryAt=await value<string>(db,'(select next_retry_at::text from cpa_subscription where id=$1)',[paid.subscription_id]);
        await value(db,"cpa_extend_pro($1,30,'referral_given',null)",[memberId]);
        assert.equal(await value(db,'(select next_retry_at::text from cpa_subscription where id=$1)',[paid.subscription_id]),retryAt);
        assert.equal(await value(db,'(select retry_count from cpa_subscription where id=$1)',[paid.subscription_id]),2);
        const protectedEnd=await value<string>(db,'(select current_period_end::text from cpa_subscription where id=$1)',[paid.subscription_id]);
        await db.query("update cpa_subscription set next_retry_at=now()-interval '1 second' where id=$1",[paid.subscription_id]);
        const renewedToken=randomUUID();
        const retry=(await db.query<{order_id:string}>('select * from cpa_claim_subscription_billing($1,$2,$3,120)',[paid.subscription_id,'retry',renewedToken])).rows[0];
        assert.equal(retry.order_id,claim.order_id);
        await value(db,'cpa_finalize_billing_success($1,$2,$3,$4,9900,30)',[paid.subscription_id,renewedToken,retry.order_id,'after-referral']);
        assert.equal(await value(db,"(select granted_period_start::text from cpa_payment_log where toss_payment_key='after-referral')"),protectedEnd);
        await value(db,'cpa_record_verified_payment_cancellation($1,$2,9900,false)',['after-referral',retry.order_id]);
        assert.equal(await value(db,'(select current_period_end::text from cpa_subscription where id=$1)',[paid.subscription_id]),protectedEnd);
        await db.query("update cpa_subscription set status='past_due' where id=$1",[paid.subscription_id]);
        await db.query('update cpa_users set manual_pro=false where id=$1',[memberId]);
        assert.equal(await value(db,'(select role from cpa_users where id=$1)',[memberId]),'MEMBER');
        await db.query('update cpa_users set manual_pro=true where id=$1',[memberId]);
        assert.equal(await value(db,'(select role from cpa_users where id=$1)',[memberId]),'PRO');
    } finally {await db.close();}
});

test('a verified full cancellation arriving before renewal success log cannot reactivate automatic billing',async()=>{
    const db=await createBillingDatabase();
    try {
        const paid=await pay(db);
        await db.query("update cpa_payment_log set billing_period_end=now()-interval '31 days',granted_period_start=now()-interval '31 days',created_at=now()-interval '31 days' where toss_payment_key=$1",[paid.paymentKey]);
        await db.query("update cpa_subscription set current_period_end=now()-interval '1 day' where id=$1",[paid.subscription_id]);
        const token=randomUUID();
        const claim=(await db.query<{order_id:string}>('select * from cpa_claim_subscription_billing($1,$2,$3,120)',[paid.subscription_id,'cron',token])).rows[0];
        await value(db,'cpa_record_verified_payment_cancellation($1,$2,9900,false)',['early-refund',claim.order_id]);
        assert.equal(await value(db,'(select count(*)::int from cpa_verified_payment_cancellation)'),1);
        assert.equal(await value(db,'cpa_finalize_billing_success($1,$2,$3,$4,9900,30)',[paid.subscription_id,token,claim.order_id,'early-refund']),true);
        assert.equal(await value(db,"(select status from cpa_payment_log where toss_payment_key='early-refund')"),'cancelled');
        assert.equal(await value(db,'(select count(*)::int from cpa_verified_payment_cancellation)'),0);
        assert.equal(await value(db,'(select status from cpa_subscription where id=$1)',[paid.subscription_id]),'cancelled');
        assert.equal(await value(db,'(select cancel_at_period_end from cpa_subscription where id=$1)',[paid.subscription_id]),true);
        assert.equal(await value(db,'(select current_period_end<=now() from cpa_subscription where id=$1)',[paid.subscription_id]),true);
        assert.equal(await value(db,'(select role from cpa_users where id=$1)',[memberId]),'MEMBER');
        const next=await db.query('select * from cpa_claim_subscription_billing($1,$2,$3,120)',[paid.subscription_id,'cron',randomUUID()]);
        assert.equal(next.rows.length,0);
    } finally {await db.close();}
});
