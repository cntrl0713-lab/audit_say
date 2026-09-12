import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gradeQuestionSetV3, gradingModelName, buildGradingPrompt, buildGradingResponseSchema } from '../../../../lib/questionV3Grading.ts';
import type { QuestionSetJudgmentV3 } from '../../../../lib/questionV3Grading.ts';
import type { QuestionSetV3 } from '../../../../lib/questionV3.ts';

const base = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(base, '../../../..');
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const bank: QuestionSetV3[] = read(path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json'));
const draft: QuestionSetV3 = read(path.join(root, 'cpa_uploader/drafts/frequency-gap-2026-09-10/release/per-set/pilot-05-008.json'))[0];
const ids = ['pilot-05-007', 'pilot-05-008', 'pilot-09-008', 'pilot-13-006', 'pilot-13-007', 'pilot-13-008', 'pilot-15-005', 'pilot-16-008', 'pilot-16-009'];
const sets = ids.map(id => [...bank, draft].find(set => set.id === id)!);
if (sets.some(set => !set)) throw new Error('검수 대상 세트 누락');
interface Regression { set_id: string; subquestion_id: string; criterion_id: string; original_answer: string; replacement_answer: string; expected: string; replacement_expected?: string }
const rows: Regression[] = read(path.join(base, 'original-regressions.json')).rows;
const codeFiles = ['lib/questionV3Grading.ts', 'lib/questionV3Evidence.ts', 'lib/questionV3.ts', 'lib/questionV3Answer.ts', 'lib/ai/openaiStructured.ts'];
const codes = Object.fromEntries(codeFiles.map(file => [file, hash(fs.readFileSync(path.join(root, file)))]));
const output = path.join(base, process.argv[2] || 'live-r1');
if (!/^live-[a-z0-9-]+$/u.test(path.basename(output))) throw new Error('Invalid run name');
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'input-snapshot.json'), JSON.stringify({ questions: sets, rows, code_hashes: codes, model: gradingModelName(), mock: false }, null, 2), { flag: 'wx' });
const jobs = sets.map(set => ({ id: `${set.id}-model`, set, answers: Object.fromEntries(set.subquestions.map(q => [q.id, q.model_answer.join('\n')])),
    expected: set.subquestions.flatMap(q => q.criteria.map(c => ({ subquestion_id: q.id, criterion_id: c.id, verdict: 'met' }))) }));
for (const row of rows) for (const variant of ['original', 'replacement'] as const) for (let repeat = 1; repeat <= 3; repeat++) {
    const set = sets.find(set => set.id === row.set_id)!;
    jobs.push({ id: `${set.id}-${row.subquestion_id}-${row.criterion_id}-${variant}-${repeat}`, set,
        answers: Object.fromEntries(set.subquestions.map(q => [q.id, q.id === row.subquestion_id ? row[`${variant}_answer`] : ''])),
        expected: [{ subquestion_id: row.subquestion_id, criterion_id: row.criterion_id, verdict: variant === 'replacement' ? row.replacement_expected ?? row.expected : row.expected }] });
}
void (async () => {
    let next = 0;
    const results: Array<Record<string, unknown>> = [];
    await Promise.all(Array.from({ length: 3 }, async () => {
        while (next < jobs.length) {
            const job = jobs[next++];
            const trace: unknown[] = [];
            let judgment: QuestionSetJudgmentV3 | undefined;
            const started = new Date().toISOString();
            let record: Record<string, unknown>;
            try {
                const result = await gradeQuestionSetV3(job.set, job.answers, process.env.OPENAI_API_KEY,
                    value => { judgment = value; }, undefined, event => trace.push(event));
                const matched = result.security_flag === 'none' && !judgment?.subquestions.some(q => q.injection_detected)
                    && job.expected.every(e => result.subquestions.find(q => q.subquestion_id === e.subquestion_id)?.criteria.find(c => c.criterion_id === e.criterion_id)?.verdict === e.verdict);
                record = { id: job.id, set_id: job.set.id, answers: job.answers, expected: job.expected, result, judgment, trace, matched };
            } catch (error) { record = { id: job.id, set_id: job.set.id, answers: job.answers, expected: job.expected, trace, error: String(error), matched: false }; }
            Object.assign(record, { started_at: started, finished_at: new Date().toISOString(), model: gradingModelName(),
                request_hash: hash(buildGradingPrompt(job.set, job.answers)), schema_hash: hash(JSON.stringify(buildGradingResponseSchema(job.set, job.answers))) });
            fs.writeFileSync(path.join(output, `${job.id}.json`), JSON.stringify(record, null, 2), { flag: 'wx' });
            results.push(record);
            console.log(JSON.stringify({ id: job.id, matched: record.matched, error: record.error ?? null }));
        }
    }));
    const unchanged = codeFiles.every(file => codes[file] === hash(fs.readFileSync(path.join(root, file))));
    fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify({ planned: jobs.length, recorded: results.length, matched: results.filter(r => r.matched).length, code_unchanged: unchanged, results }, null, 2), { flag: 'wx' });
    if (!unchanged || results.some(r => !r.matched)) process.exitCode = 1;
})();
