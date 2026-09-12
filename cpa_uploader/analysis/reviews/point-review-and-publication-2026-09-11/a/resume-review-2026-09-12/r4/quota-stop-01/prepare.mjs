import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const R = `${D}/execution-resumes/resume-2026-09-12-v4`;
const Q = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/validation-resumes/resume-2026-09-12-v4';
const T = `${D}/a/resume-review-2026-09-12/r4/transport-retry-01`;
const O = `${D}/a/resume-review-2026-09-12/r4/quota-stop-01`;
const read = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
const hash = f => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const id = file => ({ file, sha256: hash(file) });
const verify = pin => assert.equal(hash(pin.file), pin.sha256, pin.file);
const lines = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse) : [];
const write = (name, value) => fs.writeFileSync(`${O}/${name}`, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const evidence = new Map(), observedFiles = new Map();
const pin = file => { const row = id(file); evidence.set(file, row); return row; };
const observe = file => { observedFiles.set(file, fs.existsSync(file)); return fs.existsSync(file); };
const pinFolder = folder => { if (!fs.existsSync(folder)) return; for (const e of fs.readdirSync(folder, { withFileTypes: true })) {
    if (e.isFile()) pin(`${folder}/${e.name}`); else if (e.isDirectory()) pinFolder(`${folder}/${e.name}`);
} };
const manifests = {
    canary: { file: `${R}/canary/manifest.json`, sha256: '6c7280e7aaf55e6b968d874ddb155e3342224bcff051b0ebd61d48ecfd5bc495' },
    remaining: { file: `${R}/remaining/manifest.json`, sha256: '4779c9882a4c54bda3b3e3344e5962a7e5508ea0b8482b868043eaca56ad4f2b' },
    retry: { file: `${T}/manifest.json`, sha256: 'c23614d2db86c08d58a4b9b06298a285d3d14e6f23b12ccc68ea3b04f4e04b34' },
    pending: { file: `${T}/pending-manifest.json`, sha256: '1fd8ea479db627f2aa93a348058bb6ec3a4b5b50100887f1210da9ddeeb71e8f' },
};
Object.values(manifests).forEach(p => { verify(p); pin(p.file); });
const frozenFile = `${R}/frozen-inputs.json`;
assert.equal(hash(frozenFile), '2d037253d8fc7955906f141014a9e3a1caf5b47e65dad436d940b7abc181deef');
pin(frozenFile); const frozen = read(frozenFile); assert.equal(frozen.files.length, 3065); frozen.files.forEach(verify);
const canary = read(manifests.canary.file), original = read(manifests.remaining.file);
const allJobs = [...canary.jobs, ...original.jobs];
assert.equal(allJobs.length, 119); assert.equal(new Set(allJobs.map(j => j.set_id)).size, 119);
assert.equal(allJobs.reduce((n, j) => n + j.semantic_units, 0), 1393);
for (const j of allJobs) {
    verify({ file: j.file, sha256: j.sha256 }); verify({ file: j.plan_file, sha256: j.plan_sha256 });
    verify({ file: j.qa_file, sha256: j.qa_sha256 }); j.source_files.forEach(verify);
}
const scans = [], entries = [];
function semantic(folder, manifest, job) {
    const receiptFile = `${folder}/semantic.json`, summaryFile = `${folder}/summary.json`, requestFile = `${folder}/request.json`;
    if (!observe(requestFile)) { observe(receiptFile); return null; }
    pinFolder(folder); const request = read(requestFile);
    assert.equal(request.manifest_sha256, manifest.sha256); request.frozen_files.forEach(verify);
    const chunkFile = `${receiptFile}.chunks.jsonl`, rows = lines(chunkFile), summary = observe(summaryFile) ? read(summaryFile) : null;
    const success = rows.filter(r => r.response), errors = rows.filter(r => !r.response);
    assert(rows.every(r => r.set_id === job.set_id && r.model === 'gpt-5.6-luna' && r.transport === 'model'));
    const present = observe(receiptFile), receipt = present ? read(receiptFile).reviews[0] : null;
    if (receipt) {
        assert.equal(receipt.set_id, job.set_id); assert.equal(receipt.execution.transport, 'model');
        assert.equal(receipt.execution.model, original.review_model); assert.equal(receipt.units.length, job.semantic_units);
        assert.equal(hash(receiptFile), summary.receipt_sha256); assert.equal(summary.input_sha256, job.sha256);
        assert(['pass', 'semantic_nonpass'].includes(summary.outcome));
        assert(success.every(r => r.content_hash === receipt.content_hash && r.bank_hash === receipt.bank_hash));
    }
    const result = { set_id: job.set_id, worker: job.worker, run_directory: folder, manifest, request: pin(requestFile),
        receipt: receipt ? pin(receiptFile) : null, summary: summary ? pin(summaryFile) : null,
        raw: fs.existsSync(chunkFile) ? pin(chunkFile) : null, state: receipt ? receipt.verdict : 'partial',
        units_expected: job.semantic_units, successful_response_observations: success.length,
        successful_unit_ids: [...new Set(success.map(r => r.unit_id))],
        errors: errors.map(r => ({ unit_id: r.unit_id, attempt: r.attempt, performed_at: r.performed_at,
            error: r.error, code: r.error_code, status: r.error_status, retryable: r.error_retryable })),
        nonpass_units: summary?.nonpass_units ?? [], nonpass_cases: summary?.nonpass_cases ?? [] };
    scans.push(result); return result;
}
const hasRawSecurity = judgment => !!judgment && [judgment, ...(judgment.subquestions ?? [])].some(x => x.injection_detected === true || x.salad_detected === true);
function grading(job, cohort) {
    const folder = `${R}/${cohort}/grading-${job.worker}/${job.set_id}`, file = `${folder}/grading.json`;
    if (!observe(file)) return { state: 'not_run' };
    pinFolder(folder); const request = read(`${folder}/request.json`), review = read(file).reviews[0], g = review.grading;
    assert.equal(request.manifest_sha256, manifests[cohort].sha256); request.frozen_files.forEach(verify);
    assert.equal(review.set_id, job.set_id); assert.equal(g.status, 'completed'); assert.equal(g.transport, 'model'); assert.equal(g.model, 'gpt-5.6-luna');
    const rawFile = `${file}.grading.jsonl`, raw = lines(rawFile);
    assert.equal(raw.length, g.runs.length);
    raw.forEach((r, i) => { assert.equal(r.id, g.runs[i].id); assert.deepEqual(r.answers, g.runs[i].answers); assert.equal(r.matched, g.runs[i].matched); });
    return { state: 'completed', receipt: pin(file), raw: pin(rawFile), runs: g.runs.length,
        strict_matches: g.runs.filter(r => r.matched).length, strict_mismatch_run_ids: g.runs.filter(r => !r.matched).map(r => r.id),
        actual_successful_responses: raw.reduce((n, r) => n + r.trace.filter(t => t.response).length, 0),
        actual_error_observations: raw.reduce((n, r) => n + r.trace.filter(t => t.error).length, 0),
        blank_no_model_runs: g.runs.filter(r => !r.judgment).length,
        raw_security_flags: raw.filter(r => hasRawSecurity(r.judgment)).length,
        acceptance_note: '엄격 원판정 보존. 물음당 ±1점 수용 여부는 연결된 개별 검토 장부에서 별도로 확인하며 이 수집이 원판정을 변경하지 않는다.' };
}
function qa(job, cohort) {
    const folder = `${Q}/${cohort}/author-qa-${job.worker}/${job.set_id}`, file = `${folder}/author-qa/summary.json`;
    if (!observe(file)) return { state: 'not_run', planned_cases: job.author_qa_cases };
    pinFolder(folder); const s = read(file), request = read(`${folder}/request.json`);
    assert.equal(request.manifest_sha256, manifests[cohort].sha256); request.frozen_files.forEach(verify);
    assert.equal(s.set_id, job.set_id); assert.equal(s.model, 'gpt-5.6-luna');
    assert.equal(s.planned_cases, job.author_qa_cases); assert.equal(s.recorded_cases, s.planned_cases);
    const records = s.records.map(r => read(`${folder}/author-qa/${r.file}`));
    const originals = read(job.qa_file).cases;
    for (const r of records) {
        const expected = originals.find(c => c.id === r.case_id); assert(expected); assert.deepEqual(r.expected, expected);
        assert.equal(r.answers[expected.subquestion_id], expected.answer); assert.equal(r.model, 'gpt-5.6-luna');
    }
    return { state: 'completed', summary: pin(file), planned_cases: s.planned_cases, unique_recorded_cases: s.recorded_cases,
        observations: records.length, strictly_consistent_case_count: s.recorded_cases - s.mismatched_case_ids.length,
        strict_match_observations: records.filter(r => r.matched).length, strict_mismatch_case_ids: s.mismatched_case_ids,
        actual_successful_responses: records.reduce((n, r) => n + (r.trace ?? []).filter(t => t.response).length, 0),
        actual_error_observations: records.reduce((n, r) => n + (r.trace ?? []).filter(t => t.error).length, 0),
        blank_no_model_observations: records.filter(r => !r.raw_judgment).length,
        raw_security_flags: records.filter(r => hasRawSecurity(r.raw_judgment)).length, original_qa_answers_and_expected_preserved: true };
}
for (const job of allJobs) {
    const cohort = canary.jobs.some(j => j.set_id === job.set_id) ? 'canary' : 'remaining';
    const history = [semantic(`${R}/${cohort}/semantic-${job.worker}/${job.set_id}`, manifests[cohort], job)].filter(Boolean);
    if (job.set_id === 'pilot-05-001') history.push(semantic(`${T}/semantic-a/${job.set_id}`, manifests.retry, job));
    const latest = semantic(`${T}/pending-semantic-${job.worker}/${job.set_id}`, manifests.pending, job); if (latest) history.push(latest);
    const full = history.filter(h => h.receipt); assert(full.length <= 1, `Multiple full receipts: ${job.set_id}`);
    const chosen = full[0] ?? history.at(-1) ?? null;
    entries.push({ set_id: job.set_id, worker: job.worker, input: { file: job.file, sha256: job.sha256 },
        semantic: { state: chosen?.state ?? 'not_started', selected_receipt: chosen?.receipt ?? null, history,
            resume_pending: !full.length, prior_successful_units_to_reexecute: full.length ? [] : [...new Set(history.flatMap(h => h.successful_unit_ids))],
            whole_set_fresh_execution_required: !full.length && history.length > 0, cache_reuse: false },
        formal_grading: grading(job, cohort), author_qa: qa(job, cohort) });
}
const done = entries.filter(e => e.semantic.selected_receipt), pendingIds = new Set(entries.filter(e => e.semantic.resume_pending).map(e => e.set_id));
const jobs = original.jobs.filter(j => pendingIds.has(j.set_id));
assert.equal(done.length, 19); assert.equal(jobs.length, 100); assert.equal(pendingIds.size, jobs.length);
assert.equal(entries.filter(e => e.semantic.state === 'pass').length, 15);
assert.equal(entries.filter(e => e.semantic.state === 'partial').length, 3); assert.equal(entries.filter(e => e.semantic.state === 'not_started').length, 97);
assert.deepEqual(jobs, read(manifests.pending.file).jobs.filter(j => pendingIds.has(j.set_id)));
assert.deepEqual(['a', 'b', 'c'].map(w => jobs.filter(j => j.worker === w).length), [30, 36, 34]);
const workers = ['a', 'b', 'c'].map(w => ({ id: w, sets: jobs.filter(j => j.worker === w).length,
    units: jobs.filter(j => j.worker === w).reduce((n, j) => n + j.semantic_units, 0) }));
const diagnosis = pin(`${D}/api-availability-v2/diagnosis.json`), diagnosisData = read(diagnosis.file);
assert.equal(diagnosisData.actual_new_requests, 1); assert.equal(diagnosisData.provider.code, 'credit_balance_exhausted');
assert.equal(diagnosisData.provider.type, 'insufficient_quota');
const inactiveFollowups = ['pilot-02-004', 'pilot-06-002', 'pilot-09-003', 'pilot-09-005'].map(set_id => ({ set_id,
    state: 'separate_inactive_plan_followup_not_selected_in_this_manifest', active_plan: (() => { const j = allJobs.find(j => j.set_id === set_id); return { file: j.plan_file, sha256: j.plan_sha256 }; })() }));
const totals = { reviewed_set_scope: 119, semantic_units: 1393, full_semantic_receipts: done.length,
    semantic_pass: entries.filter(e => e.semantic.state === 'pass').length,
    semantic_nonpass: entries.filter(e => ['fail', 'uncertain'].includes(e.semantic.state)).length,
    semantic_partial: 3, semantic_not_started: 97, pending_semantic_sets: jobs.length,
    pending_semantic_units: jobs.reduce((n, j) => n + j.semantic_units, 0),
    semantic_successful_response_observations: scans.reduce((n, s) => n + s.successful_response_observations, 0),
    semantic_error_observations: scans.reduce((n, s) => n + s.errors.length, 0),
    formal_completed_sets: entries.filter(e => e.formal_grading.state === 'completed').length,
    formal_runs: entries.reduce((n, e) => n + (e.formal_grading.runs ?? 0), 0),
    formal_strict_matches: entries.reduce((n, e) => n + (e.formal_grading.strict_matches ?? 0), 0),
    formal_actual_successful_responses: entries.reduce((n, e) => n + (e.formal_grading.actual_successful_responses ?? 0), 0),
    author_qa_completed_sets: entries.filter(e => e.author_qa.state === 'completed').length,
    author_qa_planned_all_sets: allJobs.reduce((n, j) => n + j.author_qa_cases, 0),
    author_qa_unique_recorded: entries.reduce((n, e) => n + (e.author_qa.unique_recorded_cases ?? 0), 0),
    author_qa_observations: entries.reduce((n, e) => n + (e.author_qa.observations ?? 0), 0),
    author_qa_strictly_consistent_cases: entries.reduce((n, e) => n + (e.author_qa.strictly_consistent_case_count ?? 0), 0),
    author_qa_actual_successful_responses: entries.reduce((n, e) => n + (e.author_qa.actual_successful_responses ?? 0), 0) };
const duplicateOld = scans.find(s => s.set_id === 'pilot-05-001' && !s.receipt), duplicateNew = scans.find(s => s.set_id === 'pilot-05-001' && s.receipt);
const oldRows = lines(duplicateOld.raw.file).filter(r => r.response), newRows = lines(duplicateNew.raw.file).filter(r => r.response);
const duplicates = oldRows.map(old => { const fresh = newRows.find(r => r.unit_id === old.unit_id); assert(fresh);
    for (const k of ['input_hash', 'schema_hash', 'model', 'content_hash', 'bank_hash']) assert.equal(old[k], fresh[k]);
    return { set_id: 'pilot-05-001', unit_id: old.unit_id, old_raw: duplicateOld.raw, new_raw: duplicateNew.raw,
        input_hash: old.input_hash, schema_hash: old.schema_hash, cached: false, real_duplicate_request: true }; });
assert.equal(duplicates.length, 1);
const acceptanceRecords = [
    `${D}/a/resume-review-2026-09-12/r4/canary-generated-tolerance-bound-review.json`,
    `${D}/a/resume-review-2026-09-12/r4/canary-completed.json`,
    `${D}/b/resume-review-2026-09-12/r4/canary-report.json`,
    `${D}/c/r4-execution-v1/canary-verification.json`,
].map(pin);
const manifest = { ...original, created_at: new Date().toISOString(), purpose: 'quota_stop_pending100_semantic_preparation_only',
    predecessor: manifests.remaining, immediate_predecessor: manifests.pending, jobs, workers, max_concurrent_workers: 1,
    scheduling: { maximum_actual_semantic_streams: 1, order: ['a', 'b', 'c'], stop_on_execution_error: true,
        new_api_execution_started_by_this_preparation: false, actual_execution_requires_refill_and_coordinator_resume: true },
    completion_exclusions: done.map(e => ({ set_id: e.set_id, verdict: e.semantic.state, receipt: e.semantic.selected_receipt })),
    original_partial_history: entries.filter(e => e.semantic.state === 'partial').map(e => ({ set_id: e.set_id, worker: e.worker,
        history: e.semantic.history, previous_successful_unit_ids: e.semantic.prior_successful_units_to_reexecute,
        fresh_full_set_required: true, duplicate_actual_observations_must_be_recorded: true, partial_cache_reuse: false })),
    inactive_source_plan_followups: inactiveFollowups, quota_diagnosis: diagnosis,
    preflight_reuse_basis: 'Every retained job, bank, source, plan, QA and code identity is exactly unchanged from the verified R4 master. The job subset is the only semantic scope change; no prior partial response is a new full receipt.' };
frozen.files.forEach(verify); [...evidence.values()].forEach(verify);
for (const [file, exists] of observedFiles) assert.equal(fs.existsSync(file), exists, `Execution state changed: ${file}`);
write('pending-manifest.json', manifest);
const runner = `${D}/b/validation-worker-v3.mjs`, dryruns = [];
for (const w of ['a', 'b', 'c']) {
    const output = `${O}/semantic-${w}`; assert(!fs.existsSync(output));
    const args = [runner, '--manifest', `${O}/pending-manifest.json`, '--worker', w, '--phase', 'semantic', '--output', output, '--stop-file', `${O}/STOP`, '--dry-run'];
    const r = spawnSync(process.execPath, args, { env: { ...process.env, CPA_GRADING_MODEL: 'gpt-5.6-luna', CPA_REVIEW_MODEL: 'gpt-5.6-luna', CPA_REVIEW_INPUT_MAX_CHARS: '500000' }, encoding: 'utf8', windowsHide: true });
    assert.equal(r.status, 0, r.stderr); const parsed = JSON.parse(r.stdout); assert.equal(parsed.api_calls, 0); assert.equal(parsed.subprocesses, 0);
    assert.equal(parsed.jobs.length, workers.find(worker => worker.id === w).sets); assert(!fs.existsSync(output));
    dryruns.push({ worker: w, argv: args, exit_code: r.status, result: parsed });
}
frozen.files.forEach(verify); [...evidence.values()].forEach(verify);
write('dry-runs.json', { api_calls: 0, production_subprocesses: 0, dryruns });
write('status-119.json', { version: 1, observed_at: new Date().toISOString(), scope: 'Current R4 plus explicit transport followups only; older epochs remain historical.',
    manifests, totals, entries, semantic_raw_histories: scans, duplicate_successful_actual_observations: duplicates,
    nonformal_quota_diagnostic: { ...diagnosisData, preserved_inputs: undefined, file_identity: diagnosis,
        counted_as_formal_semantic_success: false, locally_replayed_units_are_not_new_requests: true },
    inactive_source_plan_followups: inactiveFollowups, grading_acceptance_evidence: acceptanceRecords,
    grading_acceptance_does_not_override_strict_results: true, learning_smoke_actual_calls: 0,
    all_verification_complete: false, human_confirmation: false, database_modified: false });
write('preserved-evidence.json', { captured_at: new Date().toISOString(), inputs: [...evidence.values()], observed_files: [...observedFiles].map(([file, exists]) => ({ file, exists })) });
write('checks.json', { api_calls: 0, original_frozen_files_verified_before_and_after: frozen.files.length,
    original_frozen_manifest: id(frozenFile), all_bank_code_source_plan_qa_unchanged: true,
    all_119_rows_present: true, pending_100_exact_original_job_subset: true, inactive_source_plans_not_selected: true,
    missing_or_duplicate_sets: 0, workers, totals, dry_runs: 3, production_subprocesses: 0,
    actual_output_directories_created: false, manifest: id(`${O}/pending-manifest.json`), tool: id(`${O}/prepare.mjs`) });
const table = entries.map(e => `| ${e.set_id} | ${e.worker} | ${e.semantic.state} | ${e.formal_grading.state === 'completed' ? `${e.formal_grading.strict_matches}/${e.formal_grading.runs} 엄격일치` : '미실행'} | ${e.author_qa.state === 'completed' ? `${e.author_qa.strictly_consistent_case_count}/${e.author_qa.unique_recorded_cases} 일관일치` : '미실행'} |`).join('\n');
fs.writeFileSync(`${O}/README.md`, `# 잔액 소진 중단 후 재개 준비\n\n이 묶음은 API 0회의 준비 자료다. 현재 119세트 중 의미검수 완료는 19세트(통과 15, 비통과·불확실 4), 부분 실행은 3세트, 미착수는 97세트다. 전체 검증·사람 확인·DB 반영 완료를 뜻하지 않는다.\n\n100세트 재개 목록은 A 30 → B 36 → C 34의 원 담당 label과 기존 입력을 보존한다. 부분 실행된 pilot-10-002, pilot-04-005, pilot-05-007은 이전 성공 원시를 보존하며 새 전체 세트 실행 때 중복 관측을 별도 기록해야 한다. 기존 성공을 새 요청으로 바꾸거나 부분 로그를 완료 receipt로 사용하지 않는다. 02/06/09의 별도 출처 계획 후속은 비활성이다.\n\n정식 사례 채점은 3세트 ${totals.formal_runs}고유 실행 중 ${totals.formal_strict_matches}엄격 일치다. 작성자 QA는 94개 중 92개가 모든 관측에서 엄격 일치하며, 내부 반복을 포함해 총 98관측이다. 허용 편차에 관한 개별 판단은 원판정과 분리된 연결 장부를 참조한다. 나머지 116세트의 실제 사례 채점·작성자 QA 및 249학습단위 smoke는 미실행이다.\n\n현재 R4와 후속의 의미검수 실제 성공 응답 관측은 ${totals.semantic_successful_response_observations}개, 오류 관측은 ${totals.semantic_error_observations}개다. 이 가운데 pilot-05-001의 성공 1개는 같은 입력의 실제 중복 호출이다. 총괄의 별도 전송 진단은 신규 요청 1회에서 credit_balance_exhausted/insufficient_quota를 확인했다. 진단 당시 과거 10개 응답의 로컬 재생은 신규 모델 호출도 정식 receipt도 아니다.\n\n[100세트 manifest](pending-manifest.json), [119세트 전체 상태와 증거](status-119.json), [보존 해시](preserved-evidence.json), [3개 무호출 dry-run](dry-runs.json), [검사 결과](checks.json)를 함께 읽는다. 고정 3065개 입력과 출처·코드·계획·QA를 전후 검증했고 새 실제 출력 폴더는 만들지 않았다. 충전 확인과 총괄의 별도 재개 신호 전에는 실제 실행하지 않는다.\n\n| 세트 | 원 담당 | 의미검수 | 정식 생성사례 채점 | 작성자 QA |\n| --- | --- | --- | --- | --- |\n${table}\n`, { flag: 'wx' });
console.log(JSON.stringify({ manifest: id(`${O}/pending-manifest.json`), totals, workers, api_calls: 0, dry_runs: 3 }));
