// Arithmetic/identity study only. This is not a promotion or receipt validator.
// `context` must be built by a future trusted adapter after production integrity,
// semantic, trace, security and provenance validation. Never accept it from a sidecar.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export function hash(value) {
  const sort = item => Array.isArray(item) ? item.map(sort) : item && typeof item === 'object'
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sort(item)])) : item;
  return createHash('sha256').update(JSON.stringify(sort(value))).digest('hex');
}
const key = row => `${row.subquestion_id}/${row.criterion_id}`;
function exactIds(rows, ids, label) {
  assert.equal(rows.length, ids.length, `${label}: incomplete or extra rows`);
  assert.equal(new Set(rows).size, rows.length, `${label}: duplicate IDs`);
  assert.deepEqual([...rows].sort(), [...ids].sort(), `${label}: wrong IDs`);
}

export function evaluateBoundProof(context, proof, { explicitlyRequested = false } = {}) {
  // A caller cannot use tolerance to make strict pass/match fields true.
  if (!explicitlyRequested) return { accepted: false, status: 'strict_contract_unchanged' };
  try {
    assert.equal(context.artifact_type, 'trusted_adapter_fixture_not_a_receipt');
    assert.deepEqual(context.non_score_errors, [], 'non-score failures cannot be waived');
    assert.equal(context.policy.max_absolute_score_delta_per_subquestion, 1, 'policy cannot widen');
    assert.equal(context.policy.grading_model, context.model, 'wrong model');
    assert.equal(context.policy.preserve_expected_and_actual, true);
    assert.equal(context.semantic_verdict, 'pass', 'semantic nonpass cannot be waived');
    assert.deepEqual(proof.binding, context.binding, 'receipt/content/policy/plan/code/request binding differs');
    assert.ok(['complete_exact_expectation', 'conservative_criterion_bounds'].includes(proof.method));
    assert.equal(proof.expectation_derivation, 'source_prompt_rubric_and_whole_answer', 'actual scores are not an expectation source');
    assert.ok(proof.evidence.length > 0, 'source evidence is missing');
    assert.deepEqual(proof.evidence, context.selected_review_evidence, 'unselected source evidence');
    const criteria = context.subquestions.flatMap(sub => sub.criteria.map(c => ({ ...c, criterion_id: c.id, subquestion_id: sub.id })));
    exactIds(proof.criteria.map(key), criteria.map(key), 'criterion coverage');
    const bounds = context.subquestions.map(sub => {
      const rows = proof.criteria.filter(row => row.subquestion_id === sub.id);
      for (const row of rows) {
        const criterion = criteria.find(c => key(c) === key(row));
        assert.ok(Number.isInteger(row.min) && Number.isInteger(row.max) && row.min <= row.max, 'invalid interval');
        const allowed = [0, criterion.scores.met, ...(criterion.scores.partial === undefined ? [] : [criterion.scores.partial])];
        assert.ok(allowed.includes(row.min) && allowed.includes(row.max), 'bounds outside criterion score contract');
        assert.ok(row.reason?.trim(), 'criterion source-based reason missing');
        if (proof.method === 'complete_exact_expectation') assert.equal(row.min, row.max, 'exact proof cannot hide ambiguity');
      }
      return { subquestion_id: sub.id, min: rows.reduce((s, r) => s + r.min, 0), max: rows.reduce((s, r) => s + r.max, 0) };
    });
    exactIds(proof.observations.map(row => row.id), context.observations.map(row => row.id), 'all observations');
    const deviations = [];
    for (const observation of context.observations) {
      const declared = proof.observations.find(row => row.id === observation.id);
      assert.equal(declared.sha256, hash(observation), 'observation identity differs');
      assert.equal(observation.transport, 'model', 'not an actual model observation');
      assert.equal(observation.security_flag, 'none', 'security failure');
      assert.equal(observation.raw_security_clear, true, 'raw security failure');
      assert.equal(observation.replay_matches, true, 'replay failure');
      assert.equal(observation.trace_schema_valid, true, 'trace/schema failure');
      exactIds(observation.subquestions.map(sub => sub.subquestion_id), context.subquestions.map(sub => sub.id), 'actual subquestions');
      for (const bound of bounds) {
        const actual = observation.subquestions.find(sub => sub.subquestion_id === bound.subquestion_id).score;
        assert.ok(Number.isInteger(actual), 'noninteger actual score');
        const maximum = Math.max(Math.abs(actual - bound.min), Math.abs(actual - bound.max));
        deviations.push({ observation_id: observation.id, ...bound, actual, worst_absolute_deviation: maximum });
        assert.ok(maximum <= 1, `${observation.id}/${bound.subquestion_id}: worst deviation ${maximum} exceeds 1`);
      }
    }
    assert.ok(context.observations.length > 0, 'no actual observations');
    return { accepted: true, status: 'arithmetic_proof_only_not_publication_acceptance', deviations };
  } catch (error) { return { accepted: false, status: 'rejected', reason: error.message }; }
}
