// r33~r40 독립 검증이 두 번 모두 READ_RPC_FAILED_500으로 멈춘 원인을 좁힌다. 읽기 전용이며 DB 쓰기는 없다.
// verify-final-learning-rollout.ts는 판본마다 cpa_get_question_version을 부르고 500이면 상태 코드만 남긴 채 중단한다.
// 이 도구는 같은 순서로 호출하되 실패해도 멈추지 않고 응답 본문(PostgreSQL 예외 메시지)을 모아 어느 판본에서 어떤 조건이 걸렸는지 보고한다.
//   node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r33-r40/db-import/diagnose-verify.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { verificationQuery } from '../../../point-review-and-publication-2026-09-11/c/verify-final-learning-rollout.ts';
import { P, N, PROJECT, write } from './contract.mjs';

const O = N + '/publication-v1';
const endpoint = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
const mt = process.env.SUPABASE_ACCESS_TOKEN, sk = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(mt && sk, 'SUPABASE_ACCESS_TOKEN·SUPABASE_SERVICE_ROLE_KEY 필요');
assert.equal(endpoint.hostname, `${PROJECT}.supabase.co`, '대상 프로젝트가 다르다');

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${mt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: verificationQuery, read_only: true }), signal: AbortSignal.timeout(60000) });
assert(res.ok, 'READ_ONLY_QUERY_FAILED_' + res.status);
const db = (await res.json())[0].verification;
const versions = db.versions ?? [];
console.log(`판본 ${versions.length}개를 순서대로 조회한다 (읽기 전용).`);

const failures = [];
let ok = 0;
for (const [i, v] of versions.entries()) {
    const r = await fetch(`${endpoint.origin}/rest/v1/rpc/cpa_get_question_version`, {
        method: 'POST', headers: { apikey: sk, Authorization: `Bearer ${sk}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_version_id: v.id }), signal: AbortSignal.timeout(30000) });
    if (r.ok) { ok += 1; await r.text(); continue; }
    const body = await r.text();
    failures.push({ index: i, set_id: v.set_id, version_id: v.id, position: v.position, status: r.status, body: body.slice(0, 600) });
    console.log(`  ✗ [${i}] ${v.set_id} (position ${v.position}) → ${r.status}\n      ${body.slice(0, 300)}`);
}
console.log(`\n성공 ${ok} / 실패 ${failures.length}`);
write(O + '/diagnosis-v1.json', { checked_at: new Date().toISOString(), db_writes: 0, read_only: true,
    versions_checked: versions.length, ok, failures,
    note: '02-verify·03-verify가 READ_RPC_FAILED_500으로 멈춘 지점을 좁히기 위한 읽기 전용 조회다. 실패해도 중단하지 않고 모든 판본을 확인한다.' });
console.log('기록: ' + O + '/diagnosis-v1.json');
