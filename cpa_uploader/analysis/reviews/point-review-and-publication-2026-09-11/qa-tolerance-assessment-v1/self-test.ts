import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { assessObservation } from './assess.ts';
import type { QuestionSetV3 } from '../../../../../lib/questionV3.ts';

// Original actual artifacts are read-only. Mutations below exist only in memory
// to test rejection boundaries; they are not new author expectations/receipts.
const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const folder = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/validation-resumes/resume-2026-09-12-v4/canary/author-qa-b/pilot-05-003/author-qa';
const recordFile = `${folder}/case-0036-attempt-1.json`, inputFile = `${folder}/inputs.json`;
const sha = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const initial = [recordFile, inputFile].map(file => ({ file, sha256: sha(file) }));
const record = JSON.parse(fs.readFileSync(recordFile, 'utf8')) as Parameters<typeof assessObservation>[2];
const set = JSON.parse(fs.readFileSync(inputFile, 'utf8')).question_set as QuestionSetV3;
const cases: Array<{ name: string; outcome: string }> = [];
async function main() {
assert.equal((await assessObservation(set, record.expected, record)).status, 'accepted_with_grading_deviation');
cases.push({ name: 'actual preserved expected2 actual3 accepted separately', outcome: 'pass' });
const reject = async (name: string, mutate: (value: typeof record) => void) => {
    const copy = structuredClone(record); mutate(copy);
    await assert.rejects(() => assessObservation(set, record.expected, copy));
    cases.push({ name, outcome: 'pass' });
};
await reject('strict matched flag cannot be rewritten', value => { value.matched = true; });
await reject('altered recorded score rejected', value => { value.result.score = 2; });
await reject('altered expected answer rejected', value => { value.expected.expected_points = 3; });
await reject('altered answer rejected', value => { value.answers.sub1 += ' 적시에'; });
await reject('unobserved model upgrade rejected', value => { value.model = 'gpt-5.6-terra'; });
await reject('injected transport cannot impersonate actual response', value => { value.transport = 'injected_response'; });
await reject('missing raw trace rejected', value => { value.trace = []; });
await reject('extra observation hidden inside trace rejected', value => { value.trace.push(structuredClone(value.trace[0])); });
await reject('transport error cannot be waived', value => { value.error = { status: 429 }; });
await reject('trace error cannot be waived', value => { value.trace[0].error = 'schema failure'; });
await reject('request hash changed rejected', value => { value.request_hash = '0'.repeat(64); });
await reject('schema hash changed rejected', value => { value.schema_hash = '0'.repeat(64); });
await reject('final result security cannot be waived', value => { value.result.security_flag = 'injection'; });
await reject('raw security cannot be waived', value => {
    (value.trace[0].response as { subquestions: Array<{ salad_detected: boolean }> }).subquestions[0].salad_detected = true;
});
const over = structuredClone(record);
delete over.expected.expected_by_subquestion;
over.expected.expected_points = 0;
over.expected.expected_verdicts = over.expected.expected_verdicts.map(row => ({ ...row, verdict: 'not_met', reason: 'Synthetic boundary fixture only' }));
over.exact_verdict_differences = structuredClone(over.expected.expected_verdicts);
over.verdict_differences = structuredClone(over.expected.expected_verdicts);
assert.equal((await assessObservation(set, over.expected, over)).status, 'outside_authorized_tolerance');
cases.push({ name: 'synthetic three-point deviation not accepted', outcome: 'pass' });
for (const row of initial) assert.equal(sha(row.file), row.sha256, 'Actual artifact changed');
const output = `${base}/qa-tolerance-assessment-v1/self-test-results.json`;
fs.writeFileSync(output, JSON.stringify({ scope: 'local replay and in-memory negative fixtures only', actual_new_model_calls: 0,
    source: initial, assessor: { file: `${base}/qa-tolerance-assessment-v1/assess.ts`, sha256: sha(`${base}/qa-tolerance-assessment-v1/assess.ts`) },
    cases, passed: cases.length, originals_modified: false }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ passed: cases.length, actual_new_model_calls: 0 }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
