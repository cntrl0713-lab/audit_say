import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { applyQuestionSetJudgment } from '../../../../lib/questionV3Grading.ts';

const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const output = `${base}/qa-prepared-v5`;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const identity = file => ({ file, sha256: sha(fs.readFileSync(file)) });
const serial = value => JSON.stringify(value, null, 2) + '\n';
assert(!fs.existsSync(output), 'Preserve existing QA bundles');
const predecessor = identity(`${base}/qa-prepared-v4/manifest.json`), previous = read(predecessor.file);
const bankFile = `${base}/prepared-reviewed-v7/candidate-authoring.json`, bank = read(bankFile);
assert.equal(identity(bankFile).sha256, '2867c39aead6225d2fdb46e1114a94abf323b275d48714e2c38dde12fb5d6f50');
const supplementFile = `${base}/c/resume-review-2026-09-12/pilot-03-001-sub1-qa-supplement.json`;
const supplement = read(supplementFile);
assert.equal(identity(supplementFile).sha256, 'eccb30f63cf16785564c576fc2e264ca1f636c55f22d2354a64de651933bfd5e');
assert.equal(supplement.cases.length, 5);
assert.equal(identity(supplement.original_qa.file).sha256, supplement.original_qa.sha256);
const original = read(supplement.original_qa.file);
const merged = { ...original, cases: [...original.cases, ...supplement.cases],
    scope_followup: { predecessor: supplement.original_qa, supplement: identity(supplementFile), execution: 'not_run' } };
assert.equal(new Set(merged.cases.map(row => row.id)).size, merged.cases.length);
assert.deepEqual(merged.cases.slice(0, original.cases.length), original.cases);
let checked = 0;
for (const entry of previous.entries) {
    assert.equal(identity(entry.file).sha256, entry.sha256);
    const set = bank.find(set => set.id === entry.set_id);
    const priorSet = read(previous.bank_file).find(set => set.id === entry.set_id);
    assert.deepEqual(set.subquestions.map(q => [q.id, q.model_answer, q.criteria]), priorSet.subquestions.map(q => [q.id, q.model_answer, q.criteria]));
    const cases = entry.set_id === supplement.set_id ? merged.cases : read(entry.file).cases;
    for (const row of cases) {
        const question = set.subquestions.find(sub => sub.id === row.subquestion_id);
        const byId = new Map(row.expected_verdicts.map(verdict => [verdict.criterion_id, verdict]));
        assert.equal(byId.size, question.criteria.length);
        assert.equal(row.expected_verdicts.length, question.criteria.length);
        const answers = Object.fromEntries(set.subquestions.map(sub => [sub.id, sub.id === question.id ? row.answer : '']));
        const judgment = { subquestions: set.subquestions.map(sub => ({ subquestion_id: sub.id,
            verdicts: sub.criteria.map(c => ({ criterion_id: c.id, verdict: sub.id === question.id ? byId.get(c.id).verdict : 'not_met',
                quote: sub.id === question.id && byId.get(c.id).verdict === 'met' ? row.answer : undefined })) })) };
        assert.equal(applyQuestionSetJudgment(set, answers, judgment).score, row.expected_points, `${set.id}/${row.id}`);
        checked++;
    }
}
assert.equal(checked, previous.unique_cases + supplement.cases.length);
fs.mkdirSync(output);
const mergedFile = `${output}/pilot-03-001.json`;
fs.writeFileSync(mergedFile, serial(merged), { flag: 'wx' });
const entries = previous.entries.map(entry => entry.set_id === supplement.set_id ? { ...entry, ...identity(mergedFile),
    cases: merged.cases.length, nonempty_cases: merged.cases.filter(row => row.answer.trim()).length } : entry);
fs.writeFileSync(`${output}/manifest.json`, serial({ ...previous, created_at: new Date().toISOString(), predecessor,
    bank_file: bankFile, bank_sha256: identity(bankFile).sha256, inputs: [...previous.inputs, identity(supplementFile)],
    source_cases: previous.source_cases + supplement.cases.length,
    projected_plus_current_cases: previous.projected_plus_current_cases + supplement.cases.length,
    checked_cases: previous.checked_cases + supplement.cases.length,
    unique_cases: checked, current_replayed_unique_cases: checked, entries,
    status: 'prior_expected_vectors_preserved_with_five_new_scope_boundaries_offline_replay_only',
    supplemental_qa: identity(supplementFile), api_calls: 0,
    preservation: 'All prior 6029 answers and expected vectors remain unchanged. Five source-grounded sub1 scope boundary cases added; this is expectation replay, not model verification.' }), { flag: 'wx' });
console.log(JSON.stringify({ output, unique_cases: checked, preserved_cases: previous.unique_cases, new_cases: supplement.cases.length, api_calls: 0 }));
