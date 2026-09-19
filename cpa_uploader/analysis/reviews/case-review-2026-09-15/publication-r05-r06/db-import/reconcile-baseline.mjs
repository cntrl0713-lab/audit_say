// r05~r06 정본 설치(install) 뒤, 사용자의 다른 작업 세션이 같은 정본 파일의 `pilot-01-005`를 동시에 수정했다.
// db-import의 baselineSource()는 "퇴역 대상 외 모든 세트가 baseline 커밋과 바이트까지 같다"를 전제하므로, 이 동시 편집을
// 반영한 새 기준 커밋(브랜치에는 연결하지 않은 git 객체)을 이미 만들었다. 이 스크립트는 그 커밋이 실제로
// "HEAD 371세트 중 정확히 pilot-01-005 하나만" 바꾼 것인지 재검증하고, 그 결과를 db-import가 읽을 근거 파일로 남긴다.
// 정본 파일이나 git 브랜치는 건드리지 않는다(읽기 전용).
//   node --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r05-r06/db-import/reconcile-baseline.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const P = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r05-r06', N = P + '/db-import', R = N + '/preparation-v2';
const HEAD_COMMIT = 'dc5f072fe8cf698335532ca13f3218bb1eecb28f';
const CHECKPOINT_COMMIT = '1ca22ffd337957dc9ff217743c374bf8e7cfa452';
const CANONICAL_AUTHORING = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const show = (commit) => execFileSync('git', ['show', `${commit}:${CANONICAL_AUTHORING}`], { maxBuffer: 64 * 1024 * 1024, windowsHide: true });

assert.equal(execFileSync('git', ['cat-file', '-t', CHECKPOINT_COMMIT], { windowsHide: true }).toString().trim(), 'commit');
assert.equal(execFileSync('git', ['rev-parse', '--verify', HEAD_COMMIT], { windowsHide: true }).toString().trim(), HEAD_COMMIT);
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { windowsHide: true }).toString().trim(), HEAD_COMMIT, 'main must still point at the recorded commit; this script never moves it');

const headBytes = show(HEAD_COMMIT), checkpointBytes = show(CHECKPOINT_COMMIT), liveBytes = fs.readFileSync(CANONICAL_AUTHORING);
const head = JSON.parse(headBytes), checkpoint = JSON.parse(checkpointBytes), live = JSON.parse(liveBytes);

assert.equal(head.length, 371); assert.equal(checkpoint.length, 371);
assert.deepEqual(head.map((s) => s.id), checkpoint.map((s) => s.id), 'Checkpoint must not add/remove/reorder sets relative to HEAD');

const changed = [];
for (let i = 0; i < head.length; i++) {
    const same = JSON.stringify(head[i]) === JSON.stringify(checkpoint[i]);
    if (!same) changed.push({ index: i, set_id: head[i].id, head_sha256: sha(Buffer.from(JSON.stringify(head[i]))), checkpoint_sha256: sha(Buffer.from(JSON.stringify(checkpoint[i]))) });
}
assert.equal(changed.length, 1, 'Expected exactly one changed set between HEAD and the checkpoint commit');
assert.equal(changed[0].set_id, 'pilot-01-005', 'The one changed set must be the concurrently-edited pilot-01-005');

// r05~r06가 다루는 4개 퇴역 대상, 2개 신규 세트와 겹치지 않는지 확인한다.
const plan = JSON.parse(fs.readFileSync(P + '/plan.json', 'utf8'));
const retiredIds = plan.rounds.flatMap((r) => r.retires), newIds = plan.rounds.map((r) => r.set_id);
assert(!retiredIds.includes('pilot-01-005') && !newIds.includes('pilot-01-005'), 'Concurrent edit must not touch a set this round retires or adds');

// 체크포인트(퇴역 세트 제외)가 현재 정본 파일의 앞부분과 정확히 바이트까지 같은지, 뒤에는 신규 2세트만 그 순서로 있는지 재확인한다.
const retained = checkpoint.filter((s) => !retiredIds.includes(s.id));
assert.equal(retained.length, live.length - newIds.length);
for (let i = 0; i < retained.length; i++) assert.equal(JSON.stringify(retained[i]), JSON.stringify(live[i]), 'Retained set mismatch at ' + i);
assert.deepEqual(live.slice(retained.length).map((s) => s.id), newIds);

const record = {
    version: 1, artifact_type: 'db_import_baseline_reconciliation', created_at: new Date().toISOString(),
    reason: '정본 설치(install-completion.json, 2026-09-18T05:06:46.862Z) 이후, 사용자가 확인한 다른 작업 세션이 같은 정본 파일의 pilot-01-005(주제01)를 동시에 수정했다(2세트→3세트, KGA 220 근거 추가). r05~r06과 무관하다.',
    head_commit: { commit: HEAD_COMMIT, path: CANONICAL_AUTHORING, sha256: sha(headBytes), set_count: head.length },
    checkpoint_commit: { commit: CHECKPOINT_COMMIT, path: CANONICAL_AUTHORING, sha256: sha(checkpointBytes), set_count: checkpoint.length,
        note: '어느 브랜치에도 연결하지 않은 git 객체(git commit-tree만 실행, HEAD·작업 트리·인덱스 불변). db-import baselineSource()가 참조하는 용도로만 존재한다.' },
    old_baseline_json: { file: P + '/baseline.json', recorded_authoring_sha256: '18082e546c3fb99a8169c49d65e708bb5dc3d33802251a2bf5c00525deb4b706',
        note: 'publish.mjs --baseline가 install 이전 시점(정본=HEAD)에 기록한 값이며 그대로 보존한다. pilot-01-005 동시 편집 이후에는 db-import의 참조 값으로 쓰지 않는다.' },
    changed_sets_between_head_and_checkpoint: changed,
    verification: { checkpoint_set_ids_equal_head_set_ids: true, exactly_one_set_changed: true, changed_set_excluded_from_this_round: true,
        retained_sets_match_live_bank_exactly: true, live_bank_tail_is_exactly_new_sets_in_order: true },
    live_bank: { file: CANONICAL_AUTHORING, sha256: sha(liveBytes), set_count: live.length },
};
fs.mkdirSync(R, { recursive: true });
fs.writeFileSync(R + '/baseline-reconciliation.json', JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: 'reconciled', changed: changed[0], checkpoint_commit: CHECKPOINT_COMMIT }, null, 2));
