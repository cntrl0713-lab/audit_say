import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { buildSourceCatalog } = await import(pathToFileURL(path.resolve('cpa_uploader/questionSourceCatalog.mjs')));
const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const own = `${D}/c/r4-execution-v1/semantic-followup-09-locators`;
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const desc = file => ({ file, sha256: sha(fs.readFileSync(file)) });
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (name, value) => { const file = `${own}/${name}`; fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); return desc(file); };
const sourceFile = 'cpa_uploader/data/official/kga501-505-510-2025-review09.txt';
const catalog = buildSourceCatalog({ repoDir: process.cwd() });
const units = catalog.units.filter(u => u.file === sourceFile);
const norm = s => s.replace(/\s/g, '');
const repeats = units.filter(u => /-\d+$/.test(u.id)).map(u => {
  const first = units.find(v => v.standard === u.standard && v.paragraph === u.paragraph && v.startLine < u.startLine); assert(first);
  return { id: u.id, standard: u.standard, paragraph: u.paragraph, registered_page: u.page, repeated_lines: [u.startLine, u.endLine], quote_sha256: u.contentHash,
    first_occurrence: { id: first.id, page: first.page, lines: [first.startLine, first.endLine], quote_sha256: first.contentHash },
    first_contains_repeated_quote_ignoring_whitespace: norm(first.quote).includes(norm(u.quote)),
    page_differs: u.page !== first.page,
    status: u.page === first.page ? 'same_page_not_an_observed_conflict' : u.paragraph === 'A23' ? 'cross_page_range_needs_explicit_408_409_provenance' : 'wrong_inherited_page_same_original_body' };
});
const affected = repeats.filter(u => u.page_differs), affectedIds = new Set(affected.map(u => u.id));
assert.equal(repeats.length, 20); assert.equal(affected.length, 16);
assert.equal(affected.filter(u => u.first_contains_repeated_quote_ignoring_whitespace).length, 15);
const masterFile = `${D}/a/execution-all-v9/manifest.json`, master = read(masterFile);
const planRefs = master.jobs.map(j => { const raw = read(j.plan_file), plan = raw.plans ? raw.plans.find(p => p.set_id === j.set_id) : raw; assert(plan?.source_unit_ids);
  return { set_id: j.set_id, plan_file: j.plan_file, affected_unit_ids: plan.source_unit_ids.filter(id => affectedIds.has(id)) }; }).filter(x => x.affected_unit_ids.length);
const bank = read(master.bank_file), bankRefs = bank.map(s => ({ set_id: s.id, source_ref_ids: s.source_refs.filter(r => r.file === sourceFile).map(r => r.id) })).filter(x => x.source_ref_ids.length);
const ledgerFile = 'cpa_uploader/data/cpa_question_sets_v3.promotions.json', ledger = read(ledgerFile), ledgerRefs = [];
function walk(v, pointer) { if (!v || typeof v !== 'object') return; if (affectedIds.has(v.id)) ledgerRefs.push({ pointer, id: v.id, locator: v.locator ?? null }); for (const [k, x] of Object.entries(v)) walk(x, `${pointer}/${k}`); }
walk(ledger, '');
const simulated = catalog.units.map(u => { const e = affected.find(x => x.id === u.id && x.first_contains_repeated_quote_ignoring_whitespace); if (!e) return u;
  return { ...u, page: e.first_occurrence.page, locator: u.locator.replace(`원문 페이지 ${u.page};`, `원문 페이지 ${e.first_occurrence.page};`) }; });
const simulation = simulated.flatMap((u, i) => { const old = catalog.units[i]; if (u === old) return [];
  assert.equal(u.id, old.id); assert.equal(u.quote, old.quote); assert.equal(u.contentHash, old.contentHash);
  const undo = { ...u, page: old.page, locator: old.locator }; assert.deepEqual(undo, old);
  return [{ id: u.id, before_page: old.page, proposed_page: u.page, before_locator: old.locator, proposed_locator: u.locator, all_other_fields_same: true }]; });
const impact = write('parser-impact.json', { version: 1, checked_at: new Date().toISOString(), status: 'read_only_cause_and_safe_direction_not_implemented',
  code: desc('cpa_uploader/questionSourceCatalog.mjs'), registry: desc('cpa_uploader/config/question-source-registry.json'), source: desc(sourceFile),
  cause: [
    { lines: '102,127–128', explanation: 'standardUnits가 page를 한 번 초기화하고 PDF 제목을 만날 때만 갱신한다.' },
    { lines: '129–155', explanation: '일반 제목인 직접 문단 발췌를 읽어도 page가 해제되거나 별도 확인되지 않는다.' },
    { lines: '157,163–168', explanation: '대괄호 문단 표시는 flush만 하며 뒤의 번호 문단이 이전 page 값을 그대로 받는다.' },
    { lines: '75–89', explanation: 'paragraph unit ID는 source.file+standard+paragraph+occurrence에 묶이며 page는 ID 입력이 아니다. page는 출력 locator에 포함되므로 정확한 메타데이터 보완으로 ID·quote 보존은 가능하지만 receipt context는 달라진다.' },
  ],
  directly_reviewed_problem_units: affected.filter(u => ['8', '10', '11'].includes(u.paragraph) && u.standard === 'KGA 505'),
  same_file_other_repeated_units: repeats, affected_count: 16, direct_same_body_wrong_page_count: 15, cross_page_range_candidate_count: 1,
  selected_plan_references: { manifest: desc(masterFile), checked_plans: master.jobs.length, entries: planRefs },
  bank_source_file_users: { bank: desc(master.bank_file), entries: bankRefs, limitation: '파일 사용 세트 목록이다. 실제 source_metadata가 각 반복 단위를 포함하는지 전 세트 semantic 재준비는 하지 않았다.' },
  historical_ledger_references: { ledger: desc(ledgerFile), entries: ledgerRefs, limitation: '저장 JSON에서 해당 ID를 직접 찾았다. 아직 새로운 코어로 과거 receipt validation을 수행한 결과가 아니다.' },
  safe_direction: [
    '공통 소유자가 파일 SHA·unit ID·원 범위·quote SHA와 확인한 원전 쪽을 결속한 명시적 locator 보정 입력을 추가하는 방향을 권한다. 자료 바이트를 고치거나 같은 문구가 보인다는 이유만으로 모든 반복 문단의 page를 자동 복사하지 않는다.',
    '번호 문단 15개의 메모리 시뮬레이션은 page/locator만 바꾸고 ID·quote·contentHash·범위·의존성 등 나머지 필드를 그대로 보존함을 확인했다. 실제 파서/registry 수정은 하지 않았다.',
    '505.A23은 원전408–409 두 쪽에 걸친다. 409를408 단일값으로 기계치환하지 말고 실제 원전범위와 시작쪽의 구별을 보존해야 한다.',
    '불명확한 직접 발췌 section의 이전 page 상속은 적어도 경고/미확인으로 분리할 수 있지만 현재 corpus 전역 reset은 미검토 자료까지 바꾸므로 이번 범용 패치로 제안하지 않는다.',
    '실제 적용 전 카탈로그 ID·quote·기존104 정본 ledger 읽기 호환·119 계획/입력/새 semantic context 영향을 검사하고 새 실행 잠금을 만들 필요가 있다. 과거 metadata·receipt 해시를 수정하여 통과시키지 않는다.',
  ],
  memory_only_simulation: simulation, current_registration_corrected: false, plans_are_inactive_explanations_not_catalog_fixes: true,
  api_calls: 0, common_code_changes: 0, original_source_changes: 0, errors: [] });
const R4 = `${D}/execution-resumes/resume-2026-09-12-v4`;
const frozenFile = `${R4}/frozen-inputs.json`, frozen = read(frozenFile);
const smokeFile = `${D}/b/learning-unit-smoke-v6-runtime-inputs.json`, smoke = read(smokeFile);
const checks = [frozen, smoke].map((data, i) => {
  for (const f of data.files) { const file = f.file || f.path; assert.equal(desc(file).sha256, f.sha256 || f.hash); }
  return { manifest: desc(i ? smokeFile : frozenFile), checked_files: data.files.length, current_exact: true };
});
const outputs = ['a', 'b', 'c'].map(worker => ({ worker, output: `${R4}/learning-smoke-${worker}`, exists: fs.existsSync(`${R4}/learning-smoke-${worker}`), actual_calls: 0 }));
assert(outputs.every(o => !o.exists));
const diagnosisFile = `${D}/api-availability-v2/diagnosis.json`, diagnosis = read(diagnosisFile);
assert.equal(diagnosis.provider.code, 'credit_balance_exhausted');
const readiness = write('smoke-readiness.json', { version: 1, checked_at: new Date().toISOString(), status: 'prepared_not_started_provider_quota_stop',
  manifest: desc(`${D}/b/learning-unit-smoke-v6/manifest.json`), runner: desc(`${D}/b/run-learning-unit-smoke-v6.ts`), checks, outputs,
  planned_units: 249, assigned_to_single_C_stream_in_order: ['a', 'b', 'c'], model: 'gpt-5.6-luna',
  actual_nonempty_smoke_calls: 0, current_C_api_processes: 0, previous_static_249_empty_and_fixture_checks: 'parent completed; not relabeled as actual nonempty model observations',
  stop_cause: { evidence: desc(diagnosisFile), http_status: diagnosis.provider.http_status, code: diagnosis.provider.code, type: diagnosis.provider.type, C_diagnostic_calls: 0 },
  start_condition: 'parent가 충전/서비스 복구와 재개를 확인한 뒤 기존 출력이 여전히 비어 있는지·입력 해시를 다시 확인한다. 현재 새 API나 추가 진단을 실행하지 않는다.',
  db_writes: 0, human_approval: false, formal_semantic_acceptance: false });
console.log(JSON.stringify({ impact, readiness, repeated_units: repeats.length, wrong_page: affected.length, simulation: simulation.length,
  selected_plans: planRefs.length, historical_ledger_id_hits: ledgerRefs.length, frozen_checks: checks.map(c => c.checked_files), errors: [] }));
