import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

const source=readFileSync(new URL('../supabase/functions/process-cpa-billing/index.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source.replace(/^import .*$/gm,''),{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None},
}).outputText;

async function exercise(userId:string|null,allowed:boolean,setup=false,providerStatus='DONE',providerHttpStatus=200) {
    const methods:string[]=[],rpcs:string[]=[];
    let authReads=0;
    const sub={id:1,user_id:userId,membership_version:1,billing_setup_state:setup?'pending':null,status:'active',
        current_period_end:new Date().toISOString(),toss_billing_key:'fake-key',toss_customer_key:'fake-customer',
        retry_count:0,order_id:'cpa_original_order',reconcile_only:setup,cancel_at_period_end:setup};
    const localFetch=async(_url:string,options:RequestInit)=>{
        methods.push(options.method??'GET');
        return Response.json({status:providerStatus,orderId:sub.order_id,totalAmount:9900,paymentKey:'verified-payment'},{status:providerHttpStatus});
    };
    const admin={
        rpc(name:string){
            rpcs.push(name);
            if(name==='cpa_claim_subscription_billing')return{maybeSingle:async()=>({data:sub,error:null})};
            return Promise.resolve({data:name==='common_cpa_entitlement_allowed'?allowed:
                name==='cpa_finalize_subscription_setup'?new Date().toISOString():true,error:null});
        },
        auth:{admin:{getUserById:async(id:string)=>{assert.ok(id);authReads++;return{data:{user:{email:'fixture@example.test'}}};}}},
    };
    const processOne=new Function('Deno','fetch','crypto','console',compiled+';return processOne;')(
        {serve(){}},localFetch,webcrypto,{log(){},error(){}}) as (...args:unknown[])=>Promise<string>;
    const result=await processOne(admin,'fake-provider-secret',{id:1},'cron');
    return{result,methods,rpcs,authReads};
}

test('worker permits new approval only for active CPA membership; withdrawn/null owners only reconcile original orders',async()=>{
    for(const userId of [null,'inactive-user']) {
        const result=await exercise(userId,false);
        assert.equal(result.result,'success');
        assert.deepEqual(result.methods,['GET']);
        assert.equal(result.authReads,0);
        assert.ok(result.rpcs.includes('cpa_finalize_billing_success'));
    }
    const active=await exercise('active-user',true);
    assert.deepEqual(active.methods,['POST']);
    assert.equal(active.authReads,1);
    const setup=await exercise('withdrawn-user',false,true);
    assert.deepEqual(setup.methods,['GET']);
    assert.ok(setup.rpcs.includes('cpa_finalize_subscription_setup'));
    const cancelled=await exercise('withdrawn-user',false,true,'CANCELED');
    assert.equal(cancelled.result,'failed');
    assert.ok(cancelled.rpcs.includes('cpa_abort_subscription_setup'));
    const unknown=await exercise('withdrawn-user',false,false,'UNKNOWN',404);
    assert.equal(unknown.result,'unknown');
    assert.deepEqual(unknown.methods,['GET']);
    assert.equal(unknown.authReads,0);
});

test('worker requires POST, privileged bearer and valid trigger; Audit uses its dedicated Toss secret',async()=>{
    let handler:(req:Request)=>Promise<Response>=()=>Promise.resolve(new Response());
    const requested:string[]=[];
    const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',CPA_TOSS_SECRET_KEY:'fixture-toss'};
    new Function('Deno',compiled)({serve(callback:typeof handler){handler=callback;},env:{get(name:keyof typeof env){requested.push(name);return env[name];}}});
    assert.equal((await handler(new Request('https://fixture/worker'))).status,405);
    assert.equal((await handler(new Request('https://fixture/worker',{method:'POST'}))).status,401);
    assert.equal((await handler(new Request('https://fixture/worker',{method:'POST',headers:{authorization:'Bearer fixture-service'},body:'{"trigger":"arbitrary"}'}))).status,400);
    assert.ok(requested.includes('CPA_TOSS_SECRET_KEY'));
    assert.ok(!requested.includes('TOSS_SECRET_KEY'));
});
