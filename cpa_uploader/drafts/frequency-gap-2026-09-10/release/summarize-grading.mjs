// Prints each per-set grading receipt's mismatched cases with the model's verdict and reason.
import fs from 'node:fs';
import path from 'node:path';

const dir = 'cpa_uploader/drafts/frequency-gap-2026-09-10/release/per-set';
for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.review.json')).sort()) {
    const review = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')).reviews[0];
    const runs = review.grading.runs;
    const bad = runs.filter((run) => !run.matched);
    console.log(`${review.set_id}: ${runs.length - bad.length}/${runs.length} runs matched (${review.grading.model})`);
    for (const run of bad) {
        for (const expected of run.expected) {
            const actual = run.result.subquestions.find((sub) => sub.subquestion_id === expected.subquestion_id)
                ?.criteria.find((criterion) => criterion.criterion_id === expected.criterion_id);
            if (actual?.verdict === expected.verdict) continue;
            const raw = run.judgment?.subquestions.find((sub) => sub.subquestion_id === expected.subquestion_id)
                ?.verdicts.find((verdict) => verdict.criterion_id === expected.criterion_id);
            console.log(`  ✗ ${expected.subquestion_id}/${expected.criterion_id} ${expected.case_kind}: expected ${expected.verdict}, got ${actual?.verdict} (raw ${raw?.verdict})`);
            console.log(`    answer: ${run.answers[expected.subquestion_id].replace(/\n/gu, ' ⏎ ')}`);
            console.log(`    reason: ${raw?.reason ?? '-'}`);
        }
        if (run.result.security_flag !== 'none') console.log(`  ✗ ${run.id}: security_flag=${run.result.security_flag}`);
    }
}
