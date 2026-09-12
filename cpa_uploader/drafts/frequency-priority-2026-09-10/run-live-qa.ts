import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { gradeQuestionSetV3, gradingModelName, buildGradingPrompt, buildGradingResponseSchema } from '../../../lib/questionV3Grading.ts';
import type { QuestionSetJudgmentV3 } from '../../../lib/questionV3Grading.ts';
import type { QuestionSetV3, CriterionVerdictV3 } from '../../../lib/questionV3.ts';

const base = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(base, '../../..');
const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const args = process.argv.slice(2);
const runName = args[0] || 'r1';
if (!/^[a-z0-9-]+$/u.test(runName)) throw new Error('Invalid run name');
const output = path.join(base, 'live-grading', runName);
fs.mkdirSync(output, { recursive: true });
const files = fs.readdirSync(base).filter(n => /^draft-\d{2}-\d{3}-freq01\.json$/u.test(n));
const sets: QuestionSetV3[] = files.map(n => read(path.join(base, n)));
const codeFiles = ['lib/questionV3Grading.ts', 'lib/questionV3Evidence.ts', 'lib/questionV3.ts', 'lib/questionV3Answer.ts', 'lib/ai/openaiStructured.ts'];
const codes = Object.fromEntries(codeFiles.map(file => [file, sha(fs.readFileSync(path.join(root, file)))]));
const snapshot = { questions: sets, qa: sets.map(s => read(path.join(base, `qa-${s.id.replace('draft-', '')}.json`))),
  code_hashes: codes, model: gradingModelName(), transport: 'production_gradeQuestionSetV3', mock: false };
const snapshotFile = path.join(output, 'input-snapshot.json');
const serialized = JSON.stringify(snapshot, null, 2) + '\n';
if (fs.existsSync(snapshotFile) && fs.readFileSync(snapshotFile, 'utf8') !== serialized) throw new Error('Inputs changed; use a new run name');
fs.writeFileSync(snapshotFile, serialized);
const selected = args[1];
const failedIds = selected?.startsWith('failures:')
  ? new Set((read(path.join(base, 'live-grading', selected.slice('failures:'.length), 'summary.json')).results as Array<{ set_id: string; case_id: string; matched: boolean }>).filter(r => !r.matched).map(r => `${r.set_id}/${r.case_id}`)) : null;
const jobs = snapshot.qa.flatMap((qa: { set_id: string; cases: Array<{ id: string; subquestion_id: string; answer: string; expected_points: number; expected_verdicts: CriterionVerdictV3[] }> }) => qa.cases.map(test => ({ set: sets.find(s => s.id === qa.set_id)!, test })))
  .filter(j => failedIds ? failedIds.has(`${j.set.id}/${j.test.id}`) : !selected || `${j.set.id}/${j.test.id}`.includes(selected));

void (async () => {
  let stop = false;
  let completed = 0;
  const results: unknown[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
  while (next < jobs.length) {
    const { set, test } = jobs[next++];
    if (stop) break;
    const filename = `${set.id.replace('draft-', '')}-${test.id.replaceAll('/', '-')}.json`;
    const file = path.join(output, filename);
    if (fs.existsSync(file)) { results.push(read(file)); continue; }
    const answers = Object.fromEntries(set.subquestions.map(q => [q.id, q.id === test.subquestion_id ? test.answer : '']));
    let raw: QuestionSetJudgmentV3 | null = null;
    const trace: unknown[] = [];
    const started = new Date().toISOString();
    let record: Record<string, unknown>;
    try {
      const result = await gradeQuestionSetV3(set, answers, process.env.OPENAI_API_KEY || '', value => { raw = value; }, undefined, event => trace.push(event));
      const actual = result.subquestions.find(q => q.subquestion_id === test.subquestion_id)!;
      const differences = test.expected_verdicts.filter(v => actual.criteria.find(c => c.criterion_id === v.criterion_id)?.verdict !== v.verdict);
      record = { set_id: set.id, case_id: test.id, started_at: started, finished_at: new Date().toISOString(), model: gradingModelName(),
        transport: test.answer.trim() ? 'live_model' : 'production_empty_answer_no_model', answers,
        request_hash: sha(buildGradingPrompt(set, answers)), schema_hash: sha(JSON.stringify(buildGradingResponseSchema(set, answers))),
        expected_points: test.expected_points, expected_verdicts: test.expected_verdicts, raw_judgment: raw, trace, result,
        verdict_differences: differences, matched: differences.length === 0 && result.score === test.expected_points && result.security_flag === 'none' };
    } catch (error) {
      const e = error as Error & { code?: string; status?: number };
      record = { set_id: set.id, case_id: test.id, started_at: started, finished_at: new Date().toISOString(), model: gradingModelName(),
        transport: 'live_model_attempt', answers, trace, error: { name: e.name, message: e.message, code: e.code, status: e.status }, matched: false };
      // A credential, model, quota, or transport failure does not justify repeating the whole batch.
      stop = true;
    }
    fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
    results.push(record);
    completed++;
    console.log(JSON.stringify({ set_id: set.id, case_id: test.id, matched: record.matched, error: record.error ?? null, completed }));
  }
  }));
  const unchanged = codeFiles.every(file => codes[file] === sha(fs.readFileSync(path.join(root, file))));
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify({ run: runName, selected: selected ?? null, planned: jobs.length, recorded: results.length,
    stopped_on_execution_error: stop, code_unchanged: unchanged, results }, null, 2) + '\n');
  if (stop || !unchanged) process.exitCode = 1;
})();
