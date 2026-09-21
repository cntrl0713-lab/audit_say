// r33~r40 운영 반영의 독립 검증 재개. driver.mjs --apply는 import를 커밋하고 왕복 검증·receipt까지 마쳤으나,
// 독립 검증(02-verify)이 서버 쪽 READ_RPC_FAILED_500으로 실패해 verification.json과 completion.json이 남지 않았다.
// driver.mjs는 "Prior independent verification requires separate reviewed continuation"으로 재실행을 막으므로 이 스크립트로 잇는다.
// 하는 일은 두 가지뿐이다: (1) 같은 인자로 읽기 전용 검증기를 다시 돌려 verification.json을 만들고, (2) completion.json을 쓴다.
// 보존된 02-verify.log와 02-verify.result.json은 고치지 않고, 이번 실행은 03-verify.log에 남긴다. DB 쓰기는 없다.
//   node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r33-r40/db-import/verify-v2.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { P, N, T, PROJECT, STAGE, read, sha, ref, write, guard } from './contract.mjs';

const R = N + '/preparation-v1', O = N + '/publication-v1';
const bank = STAGE.authoring, catalogFile = STAGE.catalog;
const verifier = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/c/verify-final-learning-rollout.ts';
const learningMigration = 'supabase/migrations/20260911030000_cpa_question_learning_units.sql';

const receipt = read(O + '/receipt.json');
assert.equal(receipt.applied, true, 'Receipt must record a committed import');
const prep = read(R + '/preparation.json');
assert.equal(receipt.source_file_hash, prep.source_file_hash);
assert.equal(receipt.bank_content_hash, prep.bank_content_hash);
const roundtrip = read(O + '/roundtrip.json');
assert.equal(roundtrip.status, 'passed', 'Round-trip must already have passed');
const evidence = O + '/verification-evidence.json';
guard([read(evidence).provenance.receipt, read(evidence).provenance.readiness, read(evidence).provenance.import_preparation]);
assert(fs.existsSync(O + '/02-verify.result.json'), 'Preserved prior attempt required');
assert.notEqual(read(O + '/02-verify.result.json').exit_code, 0, 'Prior attempt must be the failed one');
assert(!fs.existsSync(O + '/verification.json'), 'Verification already recorded');
assert(!fs.existsSync(O + '/completion.json'), 'Completion already recorded');

const log = O + '/03-verify.log'; assert(!fs.existsSync(log), 'This continuation runs once');
const fd = fs.openSync(log, 'wx'), started = Date.now();
const env = { ...process.env }; for (const key of Object.keys(env)) if (/OPENAI|ANTHROPIC/i.test(key)) delete env[key]; delete env.NODE_OPTIONS;
let result;
try {
    result = spawnSync(process.execPath, ['--import', 'tsx', verifier, '--read-live', '--bank', bank, '--learning-catalog', catalogFile, '--evidence', evidence,
        '--expected-bank-sha256', ref(bank).sha256, '--expected-catalog-sha256', ref(catalogFile).sha256, '--expected-evidence-sha256', ref(evidence).sha256,
        '--migration', learningMigration, '--expected-migration-sha256', ref(learningMigration).sha256, '--expected-project', PROJECT,
        '--output', O + '/verification.json'], { shell: false, windowsHide: true, stdio: ['ignore', fd, fd], env });
} finally { fs.closeSync(fd); }
write(O + '/03-verify.result.json', { id: '03-verify', exit_code: result.status, signal: result.signal, elapsed_ms: Date.now() - started, log: ref(log),
    continues: ref(O + '/02-verify.result.json'), reason: '02-verify가 READ_RPC_FAILED_500으로 실패해 같은 인자로 다시 실행했다. 읽기 전용이며 DB 쓰기는 없다.' });
assert.equal(result.status, 0, 'Independent verification failed again; inspect ' + log);

const verification = read(O + '/verification.json');
assert.equal(verification.status, 'passed');
write(O + '/completion.json', { status: 'production_published_and_independently_verified', completed_at: new Date().toISOString(),
    release_id: receipt.release_id, project_host: receipt.project_host,
    files: [bank, catalogFile, O + '/receipt.json', O + '/verification.json'].map(ref),
    counts: verification.actual, retired_set_ids: roundtrip.retired_set_ids, new_set_ids: roundtrip.new_set_ids,
    inputs_preserved: true, model_api_calls: 0, import_preparation: ref(R + '/preparation.json'),
    resume_note: 'driver.mjs --apply는 import 커밋과 왕복 검증·receipt까지 마쳤고 독립 검증에서 서버 500(READ_RPC_FAILED_500)으로 멈췄다. 이 파일과 verification.json은 verify-v2.mjs가 같은 인자로 다시 실행해 만들었다. 실패한 시도의 02-verify.log와 02-verify.result.json은 그대로 보존했다.' });
console.log(JSON.stringify({ status: 'production_published_and_independently_verified', release_id: receipt.release_id, counts: verification.actual, output: path.resolve(O) }, null, 2));
