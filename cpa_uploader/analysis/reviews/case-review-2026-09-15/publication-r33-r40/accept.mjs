// 지정 검토 r33~r40의 agent 내용 검토와 실제 Luna 대표 실측을 비용 통제 수락 batch로 묶고, 승급 도구와 같은 검증으로 receipt를 만든다.
// publication-r28-r32/accept.mjs를 이 묶음의 계획(plan.json)에 맞춰 옮겼다. 코드는 같고 경로와 기록 문구만 다르다.
//   node --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r33-r40/accept.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createEfficientReviewReceipt, createEfficientValidationContext, assertEfficientEvidenceUnchanged } from '../../../../questionEfficientReview.ts';
import { reviewedContentHash } from '../../../../questionReviewIdentity.ts';

const P = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r33-r40';
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const ref = (file) => ({ file, sha256: sha(fs.readFileSync(file)) });
const write = (file, value) => { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); return ref(file); };
assert(!fs.existsSync(`${P}/acceptance-completion.json`), 'Acceptance already recorded');
const plan = read(`${P}/plan.json`);
const authorization = ref(plan.authorization);
fs.mkdirSync(`${P}/batches`, { recursive: true });
const context = createEfficientValidationContext();
const rounds = plan.rounds.map((round) => {
    const [set] = read(round.draft); assert.equal(set.id, round.set_id); assert.equal(set.status, 'needs_review');
    const E = round.execution, actual = round.actual ?? 'actual-a', manifest = ref(`${E}/grading-manifest.json`), summary = read(`${E}/${actual}/summary.json`);
    assert.equal(summary.status, 'completed'); assert.equal(summary.frozen_input_error, null); assert.equal(summary.new_observations, summary.selected_entries);
    assert.equal(summary.within_tolerance, summary.representative_subquestion_answers);
    const observations = summary.rows.map((row) => row.observation);
    const obs = observations.map((o) => read(o.file));
    assert(obs.every((o) => o.transport === 'model' && o.response_injection === false && o.model === 'gpt-5.6-luna' && o.security_findings.length === 0 && o.within_tolerance));
    const reviews = read(`${E}/agent-reviews.json`); assert.equal(reviews.length, 1); assert.equal(reviews[0].content_hash, reviewedContentHash(set));
    const batch = write(`${P}/batches/${round.round}.json`, { version: 1, artifact_type: 'cost_controlled_review_batch', created_at: new Date().toISOString(),
        authorization: { evidence: authorization, agent_review_and_representative_grading: true, production_publication: true },
        grading_manifest: manifest, observations, agent_reviews: reviews, runtime_snapshots: read(`${E}/runtime-snapshots.json`), residual_grading_findings: [] });
    const receipt = createEfficientReviewReceipt(batch, set, context);
    const rows = obs.flatMap((o) => o.subquestions.map((q) => ({ entry: o.entry_id, kind: o.kind, subquestion_id: q.subquestion_id, expected: q.expected_points, actual: q.actual_points, delta: q.delta })));
    return { round: round.round, set_id: set.id, batch, receipt, observations: obs.length, answers: rows.length, exact_points: rows.filter((r) => r.delta === 0).length,
        strict_matched: obs.filter((o) => o.strict_matched).length, actual_sdk_calls: summary.actual_sdk_calls, usd: summary.new_accounting.usd, tokens: summary.new_accounting.provider_token_totals };
});
assertEfficientEvidenceUnchanged(context);
const completion = write(`${P}/acceptance-completion.json`, { status: 'accepted_for_publication', created_at: new Date().toISOString(), authorization, rounds,
    totals: { sets: rounds.length, representative_answers: rounds.reduce((n, r) => n + r.answers, 0), exact_points: rounds.reduce((n, r) => n + r.exact_points, 0),
        accepted_execution_calls: rounds.reduce((n, r) => n + r.actual_sdk_calls, 0), accepted_execution_usd: rounds.reduce((n, r) => n + r.usd, 0) },
    strict_mismatch_note: '여덟 회차 열 세트의 대표 90답안이 모두 허용 범위 안이고 그 가운데 88개는 기대점수와 정확히 일치했다(delta 0). 둘은 ±1점 안이다: r35 물음 3 부분정답(기대 2점·실제 3점, 대표 부분정답의 경계 설계 문제로 문항 결함이 아니다), r37s 기준서형 물음 1 부분정답(기대 4점·실제 3점, 승계한 criterion의 claim이 지배회사 한정을 요구하는데 답안이 문단 본문 표현만 적었다). 둘 다 정책이 허용한 범위라 기준을 고치거나 재채점하지 않았고 사람 확인 사항으로 남겼다. 그 밖에 예상 contradicted·실제 not_met처럼 0점 상태끼리의 차이가 남아 있으나 점수가 같아 기대값을 바꾸지 않았다.',
    usd_note: '실행기의 고정 단가×반환 사용량 계산이며 청구서 금액이 아니다. 금액 상한은 지정되지 않았다.', human_review_performed: false });
console.log(JSON.stringify({ status: 'accepted_for_publication', completion, rounds: rounds.map((r) => ({ round: r.round, set: r.set_id, exact: `${r.exact_points}/${r.answers}`, receipt: r.receipt.receipt_hash.slice(0, 12) })) }, null, 2));
