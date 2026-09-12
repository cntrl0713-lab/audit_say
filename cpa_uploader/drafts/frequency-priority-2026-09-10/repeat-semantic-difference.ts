import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gradeQuestionSetV3, gradingModelName } from '../../../lib/questionV3Grading.ts';
const base = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(base, 'semantic-review/engine-final');
const receipt = JSON.parse(fs.readFileSync(path.join(dir, 'draft-09-505-freq01.graded.json'), 'utf8')).reviews[0];
const set = JSON.parse(fs.readFileSync(path.join(base, 'draft-09-505-freq01.json'), 'utf8'));
const failed = receipt.grading.runs.filter((run: { matched: boolean }) => !run.matched);
const output = path.join(dir, '09-505-grading-repeat.json');
if (fs.existsSync(output)) throw new Error('Use a fresh output');
void (async () => {
    const records: unknown[] = [];
    for (const run of failed) for (let repeat = 2; repeat <= 3; repeat++) {
        const trace: unknown[] = [];
        const result = await gradeQuestionSetV3(set, run.answers, process.env.OPENAI_API_KEY, undefined, undefined, event => trace.push(event));
        records.push({ id: run.id, repeat, answers: run.answers, expected: run.expected, trace, result });
        fs.writeFileSync(output, JSON.stringify({ model: gradingModelName(), grader_hash: receipt.grading.grader_hash, receipt_hash: receipt.receipt_hash, records }, null, 2));
        console.log(JSON.stringify({ repeat, score: result.score, verdicts: result.subquestions[1].criteria.map(c => c.verdict) }));
    }
})();
