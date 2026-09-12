import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

test('production rollout executor rejects fingerprint, project and source drift before any network or mutation',async()=>{
  const tempRoot=await mkdtemp(join(tmpdir(),'common-account-rollout-guards-'));
  const project='abcdefghijklmnopqrst';
  const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
  const script=fileURLToPath(new URL('../scripts/execute-common-account-rollout.mjs',import.meta.url));
  try{
    const hook=join(tempRoot,'deny-network.mjs');
    await writeFile(hook,"globalThis.fetch=async()=>{throw new Error('TEST_NETWORK_FORBIDDEN')};\n");
    await writeFile(join(tempRoot,'.env.local'),`NEXT_PUBLIC_SUPABASE_URL=https://${project}.supabase.co\nSUPABASE_ACCESS_TOKEN=fixture-not-a-token\n`);
    const sql='begin;\ncommit;\n';
    await mkdir(join(tempRoot,'supabase','migrations'),{recursive:true});
    await writeFile(join(tempRoot,'supabase','migrations','20260910090000_common_accounts.sql'),sql);
    const manifest=JSON.stringify({format:1,project,endpoint:`https://${project}.supabase.co`,migration_version:'20260910090000',
      migration_sha256:hash('different reviewed bytes'),blockers:{missing_functions:[],unexpected_public_auth_cascades:[]}});
    const path=join(tempRoot,'manifest.json');await writeFile(path,manifest);
    const run=(fingerprint:string,expectedProject:string)=>spawnSync(process.execPath,[
      '--import',pathToFileURL(hook).href,script,'--apply','--phase','migrate','--manifest',path,'--manifest-sha256',fingerprint,'--expected-project',expectedProject,
    ],{cwd:tempRoot,encoding:'utf8'});
    for(const [fingerprint,expectedProject,message] of [
      ['0'.repeat(64),project,'Prepared manifest fingerprint mismatch'],
      [hash(manifest),'differentprojectxxxxx','Exact production project guard failed'],
      [hash(manifest),project,'Reviewed migration bytes changed'],
    ]){
      const result=run(fingerprint,expectedProject);
      assert.notEqual(result.status,0);
      assert.ok(result.stderr.includes(message),result.stderr);
      assert.ok(!result.stderr.includes('TEST_NETWORK_FORBIDDEN'),'guards must execute before even a read request');
    }
  }finally{
    // Only remove the specific test directory created above, never a computed parent.
    const destination=resolve(tempRoot),base=resolve(tmpdir());
    assert.ok(relative(base,destination).startsWith('common-account-rollout-guards-'));
    await rm(destination,{recursive:true,force:true});
  }
});

test('production rollout stops on a concurrently installed jobs schema or new cron before pausing any job',async()=>{
  const tempRoot=await mkdtemp(join(tmpdir(),'common-account-rollout-guards-'));
  const working=join(tempRoot,'audit_say');
  const project='abcdefghijklmnopqrst';
  const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
  const script=fileURLToPath(new URL('../scripts/execute-common-account-rollout.mjs',import.meta.url));
  const relations=['cpa_kicpa_job_boards','cpa_kicpa_job_deliveries','cpa_kicpa_jobs','cpa_kicpa_jobs_subscribers','cpa_kicpa_jobs_subscription_status'].map(name=>({name,kind:null}));
  const jobsSchema={relations,columns:[],functions:[{signature:'one',definition_hash:null},{signature:'two',definition_hash:null},{signature:'three',definition_hash:null}],view_hash:null};
  const content={cpa_sets:1,cpa_set_fingerprint:'fixture-cpa',cta_problems:1,cta_problem_fingerprint:'fixture-cta'};
  const protectedCounts=[{table_name:'cpa_question_sets',row_count:1},{table_name:'cta_problem',row_count:1}];
  const cronJobs=[{jobid:1,jobname:'known-job',schedule:'0 * * * *',active:true,command_fingerprint:'fixture-command'}];
  try{
    const sql='begin;\ncommit;\n';
    for(const directory of [working,join(tempRoot,'CTA_tax_law')]){
      await mkdir(join(directory,'supabase','migrations'),{recursive:true});
      await writeFile(join(directory,'supabase','migrations','20260910090000_common_accounts.sql'),sql);
    }
    await writeFile(join(working,'.env.local'),`NEXT_PUBLIC_SUPABASE_URL=https://${project}.supabase.co\nSUPABASE_ACCESS_TOKEN=fixture-not-a-token\n`);
    const manifest=JSON.stringify({format:1,project,endpoint:`https://${project}.supabase.co`,migration_version:'20260910090000',
      migration_sha256:hash(sql),blockers:{missing_functions:[],unexpected_public_auth_cascades:[]},jobs_schema:jobsSchema,content,
      protected_content_counts:protectedCounts,cron_jobs:cronJobs});
    const path=join(working,'manifest.json');await writeFile(path,manifest);
    for(const [scenario,message] of [['jobs','Jobs schema changed'],['cron','Cron inventory changed']]){
      const hook=join(tempRoot,`${scenario}-fake-readonly-network.mjs`);
      const changedSchema={...jobsSchema,relations:relations.map(row=>row.name==='cpa_kicpa_jobs'?{...row,kind:'r'}:row)};
      await writeFile(hook,`globalThis.fetch=async(_url,options)=>{
        const {query,read_only}=JSON.parse(options.body);
        if(read_only!==true)throw new Error('TEST_MUTATION_REACHED');
        let rows;
        if(query.includes('as jobs_schema'))rows=[{jobs_schema:${JSON.stringify(scenario==='jobs'?changedSchema:jobsSchema)}}];
        else if(query.includes('as cpa_sets'))rows=[${JSON.stringify(content)}];
        else if(query.includes('as table_name,count(*)'))rows=${JSON.stringify(protectedCounts)};
        else if(query.includes('select jobid'))rows=${JSON.stringify([...cronJobs,{...cronJobs[0],jobid:2,jobname:'concurrent-job'}])};
        else throw new Error('TEST_UNEXPECTED_QUERY');
        return new Response(JSON.stringify(rows),{status:200});
      };\n`);
      const result=spawnSync(process.execPath,['--import',pathToFileURL(hook).href,script,'--apply','--phase','pause-cron',
        '--manifest',path,'--manifest-sha256',hash(manifest),'--expected-project',project],{cwd:working,encoding:'utf8'});
      assert.notEqual(result.status,0);
      assert.ok(result.stderr.includes(message),result.stderr);
      assert.ok(!result.stderr.includes('TEST_MUTATION_REACHED'),'all schema/inventory checks precede cron mutation');
    }
  }finally{
    const destination=resolve(tempRoot),base=resolve(tmpdir());
    assert.ok(relative(base,destination).startsWith('common-account-rollout-guards-'));
    await rm(destination,{recursive:true,force:true});
  }
});

test('migration request and history preserve reviewed SQL containing JavaScript replacement metacharacters byte-for-byte',async()=>{
  const tempRoot=await mkdtemp(join(tmpdir(),'common-account-rollout-guards-'));
  const working=join(tempRoot,'audit_say');
  const project='abcdefghijklmnopqrst';
  const hash=(text:string,algorithm='sha256')=>createHash(algorithm).update(text).digest('hex');
  const script=fileURLToPath(new URL('../scripts/execute-common-account-rollout.mjs',import.meta.url));
  const account='10000000-0000-4000-8000-000000000001';
  const relations=['cpa_kicpa_job_boards','cpa_kicpa_job_deliveries','cpa_kicpa_jobs','cpa_kicpa_jobs_subscribers','cpa_kicpa_jobs_subscription_status'].map(name=>({name,kind:null}));
  const jobsSchema={relations,columns:[],functions:[{signature:'one',definition_hash:null},{signature:'two',definition_hash:null},{signature:'three',definition_hash:null}],view_hash:null};
  const content={cpa_sets:1,cpa_set_fingerprint:'fixture-cpa',cta_problems:1,cta_problem_fingerprint:'fixture-cta'};
  const protectedCounts=[{table_name:'cpa_question_sets',row_count:1},{table_name:'cta_problem',row_count:1}];
  const cronJobs=[{jobid:1,jobname:'known-job',schedule:'0 * * * *',active:true,command_fingerprint:'fixture-command'}];
  try{
    // The real migration has dollar-quoted PL/pgSQL and regexes ending in $'.
    // These bytes are literal SQL; they must never act as JS replacement tokens.
    const sql=["begin;","create function public.fixture() returns text language plpgsql as $$",
      "begin return '^[가-힣A-Za-z0-9]{2,12}$'; end $$;","-- preserve $& and $` and $$ as literal text","commit;",''].join('\n');
    for(const directory of [working,join(tempRoot,'CTA_tax_law')]){
      await mkdir(join(directory,'supabase','migrations'),{recursive:true});
      await writeFile(join(directory,'supabase','migrations','20260910090000_common_accounts.sql'),sql);
    }
    await writeFile(join(working,'.env.local'),`NEXT_PUBLIC_SUPABASE_URL=https://${project}.supabase.co\nSUPABASE_ACCESS_TOKEN=fixture-not-a-token\n`);
    const manifest=JSON.stringify({format:1,project,endpoint:`https://${project}.supabase.co`,migration_version:'20260910090000',
      migration_sha256:hash(sql),blockers:{missing_functions:[],unexpected_public_auth_cascades:[]},jobs_schema:jobsSchema,content,
      protected_content_counts:protectedCounts,cron_jobs:cronJobs,state:{functions:[]},expected_auth_count:1,auth_id_fingerprint:hash(account,'md5')});
    const path=join(working,'manifest.json');await writeFile(path,manifest);
    const capture=join(tempRoot,'captured-sql.json');
    const hook=join(tempRoot,'fixture-management-api.mjs');
    await writeFile(hook,`import {appendFile} from 'node:fs/promises';
      globalThis.fetch=async(url,options)=>{
        if(url.endsWith('/config/auth'))return new Response(JSON.stringify({disable_signup:true,external_anonymous_users_enabled:false}),{status:200});
        const {query,read_only}=JSON.parse(options.body);
        if(read_only===false){await appendFile(${JSON.stringify(capture)},JSON.stringify(query)+'\\n');return new Response('[]',{status:200});}
        let rows;
        if(query.includes('as jobs_schema'))rows=[{jobs_schema:${JSON.stringify(jobsSchema)}}];
        else if(query.includes('as cpa_sets'))rows=[${JSON.stringify(content)}];
        else if(query.includes('as table_name,count(*)'))rows=${JSON.stringify(protectedCounts)};
        else if(query.includes('select jobid'))rows=${JSON.stringify(cronJobs.map(job=>({...job,active:false})))};
        else if(query.includes('as cancellation_inbox'))rows=[{subscriptions:0,cleanup:0,cancellation_inbox:0}];
        else if(query.includes('select id::text'))rows=[{id:${JSON.stringify(account)},anonymous:true}];
        else if(query.includes('as common_exists'))rows=[{common_exists:false,version_exists:false}];
        else if(query.includes('select column_name'))rows=[{column_name:'version'},{column_name:'name'},{column_name:'statements'}];
        else throw new Error('TEST_UNEXPECTED_QUERY');
        return new Response(JSON.stringify(rows),{status:200});
      };\n`);
    const result=spawnSync(process.execPath,['--import',pathToFileURL(hook).href,script,'--apply','--phase','migrate','--maintenance-confirmed',
      '--manifest',path,'--manifest-sha256',hash(manifest),'--expected-project',project],{cwd:working,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const requests=(await readFile(capture,'utf8')).trim().split('\n').map(line=>JSON.parse(line));
    assert.equal(requests.length,1,'the executor sends exactly one transactional migration request');
    const historyPrefix="insert into supabase_migrations.schema_migrations(version,name,statements) values('20260910090000','common_accounts',array['";
    const historySuffix="']);\ncommit;";
    const originalBody=sql.slice(0,sql.lastIndexOf('commit;'));
    const expected=originalBody+historyPrefix+sql.replaceAll("'","''")+historySuffix;
    assert.equal(requests[0],expected,'every original SQL byte and every stored migration byte must be preserved');
    const historyText=requests[0].slice(originalBody.length+historyPrefix.length,-historySuffix.length).replaceAll("''","'");
    assert.equal(historyText,sql,'migration history round-trips to the exact reviewed source');
    assert.equal(hash(historyText),hash(sql));
  }finally{
    const destination=resolve(tempRoot),base=resolve(tmpdir());
    assert.ok(relative(base,destination).startsWith('common-account-rollout-guards-'));
    await rm(destination,{recursive:true,force:true});
  }
});
