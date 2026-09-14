import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const R='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14',O=R+'/retirement-history-verification-v1';
const helper=R+'/verify-retirement-history.mjs',receiptFile=R+'/db-publication-v5/receipt.json',preparationFile=O+'/after-readiness.json';
const read=f=>JSON.parse(fs.readFileSync(f)),ref=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const write=(file,data)=>fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n',{flag:'wx'}),guard=inputs=>{for(const x of inputs)assert.equal(ref(x.file).sha256,x.sha256,'History verification input changed: '+x.file);};
const args=[helper,'--after',receiptFile],mode=process.argv[2];assert(['--prepare','--run'].includes(mode));
if(mode==='--prepare'){
 assert(!fs.existsSync(preparationFile));assert(!fs.existsSync(O+'/after.json'));
 const original=read(O+'/preparation.json');guard([original.before,original.plan,original.candidate]);
 const before=read(original.before.file),plan=read(original.plan.file),candidate=read(original.candidate.file),receipt=read(receiptFile),roundtrip=read(R+'/db-publication-v5/roundtrip.json');
 assert.equal(receipt.applied,true);assert.equal(receipt.release_id,'291abae8-15e8-4f88-aff0-e755cd7c1b1f');assert.equal(receipt.retirement_manifest.expected_active_release_id,before.active.release_id);assert.deepEqual([...receipt.retirement_manifest.retired_set_ids].sort(),[...plan.retired_set_ids].sort());assert.equal(receipt.retirement_manifest_sha256,ref(R+'/retirement-manifest.json').sha256);
 assert.equal(roundtrip.status,'passed');assert.equal(roundtrip.after.active.release_id,receipt.release_id);assert.deepEqual(roundtrip.after.active.items.map(x=>x.set_id),candidate.map(x=>x.id));
 const inputs=[original.before,original.plan,original.candidate,...[helper,R+'/run-retirement-history-after.mjs',receiptFile,R+'/retirement-manifest.json',R+'/db-publication-v5/roundtrip.json',R+'/concurrent-additions-v1/baseline.json',O+'/preparation.json'].map(ref)];guard(inputs);
 write(preparationFile,{prepared_at:new Date().toISOString(),status:'prepared_local_only_waiting_for_other_database_reads',database_requests:0,inputs,args,expected_release_id:receipt.release_id,expected_retired_sets:plan.retired_set_ids.length,expected_active_sets:candidate.length,expected_active_questions:candidate.reduce((n,s)=>n+s.subquestions.length,0),historical_tables:Object.fromEntries(Object.entries(before.tables).map(([k,v])=>[k,v.count])),verification_scope:['Exact 55 retired IDs and ordered final active set IDs.','Every prior row key and content hash for 12 historical tables. Attempt lifecycle columns may advance; identity, answer hash, release/version and submission identity must be preserved.','Previous source snapshots and release-item links remain available.','All six concurrent case set version IDs remain unchanged.','Active release and source-document hash remain bound to the applied v5 receipt before and after sequential readback.']});
 console.log(JSON.stringify({status:'prepared_local_only',database_requests:0,preparation:ref(preparationFile)}));
}else{
 assert.equal(process.argv[3],'--expected-preparation-sha256');assert.equal(process.argv[4],ref(preparationFile).sha256);const prep=read(preparationFile);guard(prep.inputs);assert.deepEqual(prep.args,args);assert(!fs.existsSync(O+'/after.json'));assert(!fs.existsSync(O+'/after-execution.json'));
 const log=O+'/after-execution.log',fd=fs.openSync(log,'wx'),started=Date.now();let result;
 try{result=spawnSync(process.execPath,args,{shell:false,windowsHide:true,env:process.env,stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);}
 write(O+'/after-execution.json',{started_at:new Date(started).toISOString(),elapsed_ms:Date.now()-started,exit_code:result.status,signal:result.signal,read_only:true,preparation:ref(preparationFile),log:ref(log)});assert.equal(result.status,0,'History readback failed; preserve the log and inspect it');guard(prep.inputs);const after=read(O+'/after.json');assert.equal(after.status,'passed');assert.equal(after.active.release_id,prep.expected_release_id);
 console.log(JSON.stringify({status:'passed',retired_sets:after.retired_set_count,active_sets:after.active_set_count,all_previous_rows_preserved:after.all_previous_rows_preserved,concurrent_case_versions_preserved:after.concurrent_case_versions_preserved,verification:ref(O+'/after.json')}));
}
