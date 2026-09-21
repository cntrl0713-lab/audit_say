// r33~r40 운영 반영의 독립 검증 재개 (세 번째). 앞선 두 시도는 판본 조회 RPC의 statement timeout으로 멈췄다.
//   02-verify: READ_RPC_FAILED_500 (329초)   03-verify: 같은 오류 (303초)
// 진단(diagnosis-v1.json)에서 343판본 중 340 성공 / 3 실패이고 실패는 전부 57014 statement timeout,
// 무결성 위반 0건임을 확인했다. 원인은 릴리스 누적(22개)에 비례해 커지는 RPC 비용이며
// 2026-09-21 migration(cpa_question_version_source_memo)과 백필로 고쳤다.
//
// 이 스크립트는 그 뒤 검증만 다시 수행한다. driver.mjs --apply는 이미 import를 커밋하고
// 왕복 검증·receipt까지 마쳤으므로 다시 실행하지 않는다. DB 쓰기는 없다.
// 실행 전에 백필이 끝났는지 읽기 전용으로 확인하고, 모자라면 검증을 시작하지 않는다.
//   node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r33-r40/db-import/verify-v3.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { P, N, PROJECT, STAGE, read, ref, write, guard } from './contract.mjs';

const R = N + '/preparation-v1', O = N + '/publication-v1';
const bank = STAGE.authoring, catalogFile = STAGE.catalog;
const verifier = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/c/verify-final-learning-rollout.ts';
const learningMigration = 'supabase/migrations/20260911030000_cpa_question_learning_units.sql';

const receipt = read(O + '/receipt.json');
assert.equal(receipt.applied, true, 'Receipt must record a committed import');
const prep = read(R + '/preparation.json');
assert.equal(receipt.source_file_hash, prep.source_file_hash);
assert.equal(receipt.bank_content_hash, prep.bank_content_hash);
assert.equal(read(O + '/roundtrip.json').status, 'passed', 'Round-trip must already have passed');
const evidence = O + '/verification-evidence.json';
guard([read(evidence).provenance.receipt, read(evidence).provenance.readiness, read(evidence).provenance.import_preparation]);
for (const prior of ['02-verify.result.json', '03-verify.result.json']) {
    assert(fs.existsSync(O + '/' + prior), 'Preserved prior attempt required: ' + prior);
    assert.notEqual(read(O + '/' + prior).exit_code, 0, prior + ' must be a preserved failure');
}
assert(fs.existsSync(O + '/diagnosis-v1.json'), 'Read-only diagnosis must be preserved');
assert(!fs.existsSync(O + '/verification.json'), 'Verification already recorded');
assert(!fs.existsSync(O + '/completion.json'), 'Completion already recorded');

// 백필 확인(읽기 전용). 활성 릴리스의 모든 판본에 메모 행이 있어야 예전 경로로 떨어지지 않는다.
const mt = process.env.SUPABASE_ACCESS_TOKEN;
assert(mt, 'SUPABASE_ACCESS_TOKEN 필요');
const coverageSql = `select jsonb_build_object(
 'release_id',r.id,
 'items',(select count(*) from public.cpa_question_bank_release_items i where i.release_id=r.id),
 'memo_items',(select count(*) from public.cpa_question_bank_release_item_source s where s.release_id=r.id),
 'memo_versions',(select count(*) from public.cpa_question_bank_release_items i
   join public.cpa_question_set_version_source v on v.set_version_id=i.set_version_id where i.release_id=r.id)
) as coverage from public.cpa_question_bank_releases r where r.status='active'`;
const cov = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${mt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: coverageSql, read_only: true }), signal: AbortSignal.timeout(60000) });
assert(cov.ok, 'COVERAGE_QUERY_FAILED_' + cov.status);
const c = (await cov.json())[0].coverage;
console.log('활성 릴리스 메모 적용률:', JSON.stringify(c));
assert.equal(c.memo_items, c.items, '백필이 끝나지 않았다. cpa_backfill_release_item_source()를 먼저 실행한다.');
assert.equal(c.memo_versions, c.items, '판본 조각 메모가 모자란다. 백필을 다시 확인한다.');

const log = O + '/04-verify.log'; assert(!fs.existsSync(log), 'This continuation runs once');
const fd = fs.openSync(log, 'wx'), started = Date.now();
const env = { ...process.env }; for (const key of Object.keys(env)) if (/OPENAI|ANTHROPIC/i.test(key)) delete env[key]; delete env.NODE_OPTIONS;
let result;
try {
    result = spawnSync(process.execPath, ['--import', 'tsx', verifier, '--read-live', '--bank', bank, '--learning-catalog', catalogFile, '--evidence', evidence,
        '--expected-bank-sha256', ref(bank).sha256, '--expected-catalog-sha256', ref(catalogFile).sha256, '--expected-evidence-sha256', ref(evidence).sha256,
        '--migration', learningMigration, '--expected-migration-sha256', ref(learningMigration).sha256, '--expected-project', PROJECT,
        '--output', O + '/verification.json'], { shell: false, windowsHide: true, stdio: ['ignore', fd, fd], env });
} finally { fs.closeSync(fd); }
write(O + '/04-verify.result.json', { id: '04-verify', exit_code: result.status, signal: result.signal, elapsed_ms: Date.now() - started, log: ref(log),
    continues: [ref(O + '/02-verify.result.json'), ref(O + '/03-verify.result.json')], diagnosis: ref(O + '/diagnosis-v1.json'),
    memo_coverage: c, reason: '판본 조회 RPC의 릴리스 누적 비용을 2026-09-21 migration과 백필로 고친 뒤 같은 인자로 다시 실행했다. 읽기 전용이며 DB 쓰기는 없다.' });
assert.equal(result.status, 0, 'Independent verification failed again; inspect ' + log);

const verification = read(O + '/verification.json');
assert.equal(verification.status, 'passed');
write(O + '/completion.json', { status: 'production_published_and_independently_verified', completed_at: new Date().toISOString(),
    release_id: receipt.release_id, project_host: receipt.project_host,
    files: [bank, catalogFile, O + '/receipt.json', O + '/verification.json'].map(ref),
    counts: verification.actual, retired_set_ids: read(O + '/roundtrip.json').retired_set_ids, new_set_ids: read(O + '/roundtrip.json').new_set_ids,
    inputs_preserved: true, model_api_calls: 0, import_preparation: ref(R + '/preparation.json'),
    resume_note: 'driver.mjs --apply는 import 커밋과 왕복 검증·receipt까지 마쳤고 독립 검증에서 판본 조회 RPC의 statement timeout으로 멈췄다(02-verify·03-verify 보존). 읽기 전용 진단(diagnosis-v1.json)으로 343판본 중 3판본의 57014를 확인했고 무결성 위반은 0건이었다. 원인인 릴리스 누적 비용을 migration 20260921120000_cpa_question_version_source_memo와 백필로 고친 뒤 이 스크립트가 같은 인자로 검증을 다시 수행해 이 파일과 verification.json을 만들었다.' });
console.log(JSON.stringify({ status: 'production_published_and_independently_verified', release_id: receipt.release_id, counts: verification.actual, output: path.resolve(O) }, null, 2));
