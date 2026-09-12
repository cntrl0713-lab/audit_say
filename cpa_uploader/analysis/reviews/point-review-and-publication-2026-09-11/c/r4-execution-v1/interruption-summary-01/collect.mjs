import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const { prepareSemanticReview, buildReviewChunkInput, reviewChunkSchema, groundReviewChunk, semanticReceiptIntegrityErrors } = await import(pathToFileURL(path.resolve('cpa_uploader/questionSemanticReview.ts')));
const { jsonHash } = await import(pathToFileURL(path.resolve('cpa_uploader/questionReviewIdentity.ts')));
const D='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const R=`${D}/execution-resumes/resume-2026-09-12-v4`;
const own=`${D}/c/r4-execution-v1/interruption-summary-01`;
const json=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const hash=f=>sha(fs.readFileSync(f));
const desc=f=>({file:f,sha256:hash(f)});
const optional=f=>fs.existsSync(f)?desc(f):null;
const freezeFile=`${R}/frozen-inputs.json`,freeze=json(freezeFile);
assert.equal(hash(freezeFile),'2d037253d8fc7955906f141014a9e3a1caf5b47e65dad436d940b7abc181deef');
assert.equal(freeze.files.length,3065);
const differences=[];
for(const f of freeze.files){const actual=hash(f.file);if(actual!==f.sha256)differences.push({file:f.file,expected:f.sha256,actual});}
assert.deepEqual(differences,[]);
const expectedHashes={canary:'6c7280e7aaf55e6b968d874ddb155e3342224bcff051b0ebd61d48ecfd5bc495',remaining:'4779c9882a4c54bda3b3e3344e5962a7e5508ea0b8482b868043eaca56ad4f2b'};
const entries=[];
for(const wave of ['canary','remaining']){
  const manifestFile=`${R}/${wave}/manifest.json`,manifest=json(manifestFile);
  assert.equal(hash(manifestFile),expectedHashes[wave]);
  const bank=json(manifest.bank_file);
  for(const job of manifest.jobs){
    const directory=`${R}/${wave}/semantic-${job.worker}`,folder=`${directory}/${job.set_id}`;
    if(!fs.existsSync(folder)){entries.push({wave,worker:job.worker,set_id:job.set_id,status:'not_started',expected_units:job.semantic_units,observed_valid_units:0,missing_units_count:job.semantic_units});continue;}
    const requestFile=`${folder}/request.json`,summaryFile=`${folder}/summary.json`,receiptFile=`${folder}/semantic.json`,chunksFile=`${receiptFile}.chunks.jsonl`;
    const summary=fs.existsSync(summaryFile)?json(summaryFile):null,receipt=fs.existsSync(receiptFile)?json(receiptFile).reviews[0]:null;
    const value=json(job.file),set=Array.isArray(value)?value[0]:value,plan=json(job.plan_file);
    const prepared=prepareSemanticReview(set,{root:process.cwd(),bank,authoringPlan:plan,maxInputChars:500000});
    assert.equal(prepared.units.length,job.semantic_units);
    const chunks=fs.existsSync(chunksFile)?fs.readFileSync(chunksFile,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)):[];
    const valid=new Map(),returns=[],errors=[];
    for(const chunk of chunks){
      const unit=prepared.units.find(u=>u.id===chunk.unit_id);assert(unit);
      assert.equal(chunk.input_hash,sha(buildReviewChunkInput(prepared,unit)));
      assert.equal(chunk.schema_hash,jsonHash(reviewChunkSchema(unit)));
      assert.equal(chunk.model,'gpt-5.6-luna');assert.equal(chunk.transport,'model');
      if(chunk.error){errors.push({unit_id:chunk.unit_id,attempt:chunk.attempt,error:chunk.error,code:chunk.error_code,status:chunk.error_status,retryable:chunk.error_retryable,has_response:!!chunk.response});continue;}
      assert(chunk.response);
      const grounded=groundReviewChunk(chunk.response,prepared,unit);
      valid.set(unit.id,grounded);
      returns.push({unit_id:unit.id,attempt:chunk.attempt,performed_at:chunk.performed_at,input_hash:chunk.input_hash,schema_hash:chunk.schema_hash,checks:grounded.units[0].checks,case_count:grounded.cases.length});
    }
    const missing=prepared.units.filter(u=>!valid.has(u.id)).map(u=>u.id);
    let status=receipt?'receipt_without_completed_job_summary':'partial_no_receipt';
    let provenance=null;
    if(receipt){
      const expectedNonpassStatus=receipt.verdict==='pass'?[]:[`${job.set_id}: 의미검수 결과가 pass가 아닙니다 (${receipt.verdict}).`];
      assert.deepEqual(semanticReceiptIntegrityErrors(receipt,false),expectedNonpassStatus);
      assert.equal(receipt.content_hash,prepared.contentHash);assert.equal(receipt.bank_hash,prepared.bankHash);
      assert.deepEqual(receipt.source_files,prepared.sourceFiles);
      assert.deepEqual(receipt.context,prepared.context);
      assert.equal(receipt.execution.transport,'model');assert.equal(receipt.execution.model,'gpt-5.6-luna');
      assert.equal(missing.length,0);
      for(const u of receipt.units)assert.deepEqual(u,valid.get(u.id).units[0]);
      for(const c of receipt.cases)assert.deepEqual(c,valid.get(c.unit_id).cases.find(x=>x.kind===c.kind));
      if(summary&&['pass','semantic_nonpass'].includes(summary.outcome)){
        assert.equal(summary.receipt_sha256,hash(receiptFile));assert.equal(summary.input_sha256,job.sha256);
        assert.equal(summary.semantic_verdict,receipt.verdict);assert(!summary.child_signal&&!summary.guard_or_observer_error);
        const runFile=`${directory}/run.json`,run=json(runFile),request=json(requestFile);
        assert.equal(run.manifest_sha256,hash(manifestFile));assert.equal(run.worker,job.worker);assert.equal(run.transport,'production_cli_subprocess');assert.equal(run.mock,false);
        assert.equal(request.manifest_sha256,hash(manifestFile));assert.equal(request.credential_logged,false);
        for(const f of request.frozen_files)assert.equal(hash(f.file),f.sha256);
        status=receipt.verdict==='pass'?'completed_pass_receipt':'completed_nonpass_receipt';
        provenance={manifest_file:manifestFile,manifest_sha256:hash(manifestFile),worker:job.worker,run_directory:directory,run_sha256:hash(runFile),summary_sha256:hash(summaryFile),request_sha256:hash(requestFile),receipt_file:receiptFile,receipt_sha256:hash(receiptFile)};
      }
    }
    entries.push({wave,worker:job.worker,set_id:job.set_id,status,expected_units:job.semantic_units,observed_valid_units:valid.size,missing_units_count:missing.length,missing_unit_ids:missing,receipt_verdict:receipt?.verdict??null,provenance_candidate:provenance,artifacts:{run:optional(`${directory}/run.json`),request:optional(requestFile),job_summary:optional(summaryFile),worker_summary:optional(`${directory}/summary.json`),receipt:optional(receiptFile),chunks:optional(chunksFile),stdout:optional(`${folder}/stdout.log`),stderr:optional(`${folder}/stderr.log`)},actual_returned_observations:returns,recorded_errors:errors,nonpass_units:receipt?.units.filter(u=>Object.values(u.checks).some(v=>v!=='pass'))??[],nonpass_cases:receipt?.cases.filter(c=>c.verdict!=='pass')??[],reuse_boundary:status==='completed_pass_receipt'?'원 manifest/run/request/summary/receipt와 실제 입력이 동일하면 기존 정규 validator를 통과하는 새 provenance 선택으로 참조한다. 옛 receipt 재해시·변경 금지.':status==='completed_nonpass_receipt'?'유효한 비통과 증거로 보존한다. pass로 바꾸어 읽지 않으며 근거 조사와 필요한 후속 검증이 남아 있다.':'부분 응답은 완료 receipt가 아니다. 같은 input/schema/code/source/model을 재대조한 후속 resumer에서만 기존 단위를 연결할 수 있다. 원 출력에 재개하여 덮어쓰지 않는다.'});
  }
}
for(const f of freeze.files)assert.equal(hash(f.file),f.sha256);
const completed=entries.filter(e=>e.status.startsWith('completed_'));
const partial=entries.filter(e=>e.status==='partial_no_receipt');
const notStarted=entries.filter(e=>e.status==='not_started');
const report={version:1,status:'original_r4_interruption_snapshot_api0',checked_at:new Date().toISOString(),scope:'R4 canary/remaining의 원래 semantic-a/b/c 경로. root의 별도 단일세트 재진단·재개 출력은 이 원기록 snapshot에 자동 합치지 않는다.',freeze:{...desc(freezeFile),checked_files:3065,differences:[],checked_before_and_after_collection:true},counts:{selected_sets:entries.length,expected_units:entries.reduce((n,e)=>n+e.expected_units,0),completed_receipts:completed.length,completed_pass:completed.filter(e=>e.status==='completed_pass_receipt').length,completed_nonpass:completed.filter(e=>e.status==='completed_nonpass_receipt').length,partial_sets:partial.length,not_started_sets:notStarted.length,complete_receipt_units:completed.reduce((n,e)=>n+e.expected_units,0),partial_valid_units:partial.reduce((n,e)=>n+e.observed_valid_units,0),units_without_valid_record:entries.reduce((n,e)=>n+e.missing_units_count,0),response_records:entries.reduce((n,e)=>n+(e.actual_returned_observations?.length??0),0),error_records:entries.reduce((n,e)=>n+(e.recorded_errors?.length??0),0)},c_interruption:{action:'Stop-Process -Id 42076 after parent pause instruction',child_pid:42076,worker_pid:41348,terminal_session_id:75787,worker_finished_at:entries.find(e=>e.wave==='remaining'&&e.set_id==='pilot-05-007').artifacts.job_summary?json(entries.find(e=>e.wave==='remaining'&&e.set_id==='pilot-05-007').artifacts.job_summary.file).finished_at:null,owned_processes_absent_confirmed:true,provider_error_observed_in_c:false,reason:'다른 stream의429 원인 확인을 기다리기 위한 중지. C의 execution_error는 강제중단 결과이며 provider429가 아니다.',inflight_unrecorded_request_outcome:'중단 때 진행 중이던 요청의 결과는 알 수 없다. 저장된5응답만 유효 관측으로 센다.',additional_c_api_calls_after_stop:0},entries,canary_grading_qa_c:desc(`${D}/c/r4-execution-v1/canary-verification.json`),reuse_rules:['전체3065입력이 현 값과 일치한다. 옛 입력·원 receipt·원 판정은 변경하지 않는다.','completed_pass_receipt는 새manifest의 명시semantic_provenance 선택으로 기존worker-v3 동일성검사를 통과시킬 후보이며 자동 채택한 것이 아니다.','원worker의 top summary가 없다는 사유만으로 완료job의 run/request/job-summary/receipt를 부정하지 않는다. 현worker-v3는 job단위summary를 검증한다.','nonpass receipt의 실존·유효성과 내용 합격을 구분하고 후속grade의 pass 전제로 쓰지 않는다.','partial response의 input/schema를 전수 재구성·ground 검증했으나 미도달 단위나 완료receipt를 만들지 않는다. 명시 후속 출력에서 잔여 단위를 처리하고 기존raw를 덮어쓰지 않는다.','중단의 최종 미기록request는 성공/실패 어느쪽으로도 세지 않는다. 새phase 전에root의 재개 지시를 기다린다.'],local_verifier_followup:'첫 로컬검사는 nonpass receipt에 함수가 반환하는 비통과 상태문구를 구조오류와 구분하지 못해 중단됐다. 원uncertain을 보존하며 구조/해시/입력 오류가 추가로 없는지 따로 검증했다. 원증거 변경이나API호출은 없었다.',api_calls_by_this_collector:0,common_or_source_or_receipt_writes:0,human_approval:false,publication:false,errors:[]};
const file=`${own}/summary.json`;fs.writeFileSync(file,`${JSON.stringify(report,null,2)}\n`,{flag:'wx'});console.log(JSON.stringify({...desc(file),counts:report.counts,errors:[]}));
