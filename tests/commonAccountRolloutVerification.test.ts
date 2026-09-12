import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

test('post-reset verification requires empty paused state, permits new live users, and rejects a surviving pinned identity without exposing IDs',async()=>{
  const taskRoot=await mkdtemp(join(tmpdir(),'common-account-rollout-verification-'));
  const project='abcdefghijklmnopqrst';
  const oldId='10000000-0000-4000-8000-000000000001';
  const hash=(text:string,algorithm='sha256')=>createHash(algorithm).update(text).digest('hex');
  const script=fileURLToPath(new URL('../scripts/verify-common-account-rollout-state.mjs',import.meta.url));
  const content={cpa_sets:96,cpa_set_fingerprint:'fixture-cpa',cta_problems:134,cta_problem_fingerprint:'fixture-cta'};
  const protectedCounts=Array.from({length:41},(_,index)=>({table_name:`cpa_content_${index}`,row_count:index}));
  const cronJobs=Array.from({length:4},(_,index)=>({jobid:index+1,jobname:`job-${index}`,schedule:'0 * * * *',active:true,command_fingerprint:`hash-${index}`}));
  const jobRelations=['cpa_kicpa_job_boards','cpa_kicpa_job_deliveries','cpa_kicpa_jobs','cpa_kicpa_jobs_subscribers','cpa_kicpa_jobs_subscription_status'].map(name=>({name,kind:null}));
  const tableNames=['common_profiles','cpa_users','cta_user','cpa_attempts','cpa_attempt_answers','cpa_grading_runs','cpa_subquestion_grade_results',
    'cpa_criterion_grade_results','cpa_review_items','cpa_xp_events','cta_grading_attempt','cta_problem_assist','cta_usage_receipts',
    'cpa_review_notes','cpa_firm_chat_message','cpa_firm_review','cpa_firm_subscription','cpa_kicpa_jobs_subscribers','cpa_kicpa_job_deliveries',
    'cta_subscription','cta_payment_log','cta_referral','cta_pro_reward','cta_billing_key_cleanup','cta_verified_payment_cancellation','common_payment_resolution_log'];
  const rpcNames=['cpa_begin_attempt','cpa_claim_grading_run','cpa_complete_grading_run','cpa_fail_grading_run','cpa_update_review_item',
    'consume_hint_quota','reserve_grading_attempt','begin_subscription_setup','claim_subscription_billing','finalize_billing_success',
    'finalize_subscription_setup','apply_verified_payment_cancellation','cancel_subscription_renewal','extend_pro','grant_referral_rewards',
    'common_ensure_profile','common_update_nickname','common_join_service','common_assert_service_access','common_withdraw_service',
    'common_prepare_account_deletion','common_cta_hint_usage','common_resolve_withdrawn_order_no_charge','common_legacy_extend_pro','handle_new_user'];
  const grants=rpcNames.map(name=>({name,signature:`${name}()`,is_trigger:name==='handle_new_user',anon_allowed:false,authenticated_allowed:false,
    service_allowed:!['handle_new_user','common_resolve_withdrawn_order_no_charge','common_legacy_extend_pro'].includes(name)}));
  try{
    const sql='begin;\ncommit;\n';
    await mkdir(join(taskRoot,'supabase','migrations'),{recursive:true});
    await mkdir(join(taskRoot,'tmp'),{recursive:true});
    await writeFile(join(taskRoot,'supabase','migrations','20260910090000_common_accounts.sql'),sql);
    await writeFile(join(taskRoot,'.env.local'),`NEXT_PUBLIC_SUPABASE_URL=https://${project}.supabase.co\nSUPABASE_ACCESS_TOKEN=fixture-not-a-token\n`);
    const manifest=JSON.stringify({format:1,project,endpoint:`https://${project}.supabase.co`,migration_version:'20260910090000',
      migration_sha256:hash(sql),content,protected_content_counts:protectedCounts,jobs_schema:{relations:jobRelations},expected_auth_count:1,auth_id_fingerprint:hash(oldId,'md5'),
      original_maintenance_state:{project,cron_jobs:cronJobs,auth_settings:{disable_signup:false,external_anonymous_users_enabled:true}}});
    const manifestPath=join(taskRoot,'manifest.json');await writeFile(manifestPath,manifest);
    await writeFile(join(taskRoot,'tmp','common-account-reset-checkpoint.json'),JSON.stringify({project,manifest_sha256:hash(manifest),
      targets:[{id:oldId,anonymous:false}],completed:1,finished_at:'2026-09-10T00:00:00Z'}));
    for(const scenario of [
      {stage:'paused',fresh:false,pinned:0,pass:true},
      {stage:'paused',fresh:true,pinned:0,pass:false},
      {stage:'live',fresh:true,pinned:0,pass:true},
      {stage:'live',fresh:true,pinned:1,pass:false},
    ]){
      const hook=join(taskRoot,'mock-readonly.mjs');
      const counts=['auth.users',...tableNames.filter(name=>!name.startsWith('cpa_kicpa'))].map(table_name=>({table_name,row_count:scenario.fresh&&['auth.users','common_profiles'].includes(table_name)?1:0}));
      await writeFile(hook,`globalThis.fetch=async(url,options)=>{
        if(url.endsWith('/config/auth'))return new Response(JSON.stringify({password_min_length:8,
          uri_allow_list:'https://audit-say.vercel.app/auth/callback,https://cta-tax-law.vercel.app/auth/callback',
          disable_signup:${scenario.stage==='paused'},external_anonymous_users_enabled:${scenario.stage==='live'}}),{status:200});
        const {query,read_only}=JSON.parse(options.body);if(read_only!==true)throw new Error('TEST_WRITE_FORBIDDEN');
        let rows;
        if(query.includes('as source_hash'))rows=[{common_exists:true,source_hash:${JSON.stringify(hash(sql,'md5'))}}];
        else if(query.includes('as cpa_sets'))rows=[${JSON.stringify(content)}];
        else if(query.includes("'auth.users' as table_name"))rows=${JSON.stringify(counts)};
        else if(query.includes('as table_name,count(*)'))rows=${JSON.stringify(protectedCounts)};
        else if(query.includes('as present from'))rows=${JSON.stringify(tableNames.map(name=>({name,present:!name.startsWith('cpa_kicpa')})))};
        else if(query.includes('as remaining from auth.users'))rows=[{remaining:${scenario.pinned}}];
        else if(query.includes('as registered_without_common_profile'))rows=[{registered_without_common_profile:0,anonymous_common_profiles:0,cpa_without_common_profile:0,cta_without_common_profile:0}];
        else if(query.includes('select v.name,c.relkind'))rows=${JSON.stringify(jobRelations)};
        else if(query.includes('as anon_allowed'))rows=${JSON.stringify(grants)};
        else if(query.includes('select jobid'))rows=${JSON.stringify(cronJobs.map(job=>({...job,active:scenario.stage==='live'})))};
        else throw new Error('TEST_UNEXPECTED_QUERY');
        return new Response(JSON.stringify(rows),{status:200});
      };\n`);
      const result=spawnSync(process.execPath,['--import',pathToFileURL(hook).href,script,'--stage',scenario.stage,
        '--manifest',manifestPath,'--manifest-sha256',hash(manifest),'--expected-project',project],{cwd:taskRoot,encoding:'utf8'});
      assert.equal(result.status,scenario.pass?0:1,result.stderr||result.stdout);
      const report=JSON.parse(result.stdout);
      assert.equal(report.ok,scenario.pass);
      assert.equal(report.protected_content_tables_checked,41);
      assert.equal(report.pinned_accounts_remaining,scenario.pinned);
      assert.ok(!`${result.stdout}${result.stderr}`.includes(oldId),'pinned identifiers must remain private');
      if(scenario.stage==='paused'&&scenario.fresh)assert.ok(report.failures.some((failure:string)=>failure.includes('not empty')));
      if(scenario.pinned)assert.ok(report.failures.includes('Previously pinned Auth identities remain after reset'));
    }
  }finally{
    const destination=resolve(taskRoot),base=resolve(tmpdir());
    assert.ok(relative(base,destination).startsWith('common-account-rollout-verification-'));
    await rm(destination,{recursive:true,force:true});
  }
});
