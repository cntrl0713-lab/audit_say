import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildGradingPrompt, buildGradingResponseSchema, gradingModelName } from '../../../lib/questionV3Grading.ts';
import type { QuestionSetV3, CriterionVerdictV3 } from '../../../lib/questionV3.ts';

const base = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(base, '../../..');
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const relative = (file: string) => path.relative(root, file).replaceAll('\\', '/');
const records = fs.readdirSync(path.join(base, 'live-grading'), { withFileTypes: true }).filter(d => d.isDirectory()).flatMap(d => {
  const dir = path.join(base, 'live-grading', d.name);
  const snapshot = read(path.join(dir, 'input-snapshot.json'));
  const codeCurrent = Object.entries(snapshot.code_hashes).every(([file, hash]) => sha(fs.readFileSync(path.join(root, file))) === hash);
  return fs.readdirSync(dir).filter(f => f.endsWith('.json') && !['input-snapshot.json', 'summary.json', 'coverage-before.json'].includes(f))
    .map(f => ({ ...read(path.join(dir, f)), file: relative(path.join(dir, f)), code_current: codeCurrent }));
});
const perCase = [];
const sets: QuestionSetV3[] = fs.readdirSync(base).filter(f => /^draft-\d{2}-\d{3}-freq01\.json$/u.test(f)).map(f => read(path.join(base, f)));
for (const set of sets) {
  const qa = read(path.join(base, `qa-${set.id.replace('draft-', '')}.json`));
  for (const test of qa.cases) {
    const answers = Object.fromEntries(set.subquestions.map(q => [q.id, q.id === test.subquestion_id ? test.answer : '']));
    const requestHash = sha(buildGradingPrompt(set, answers));
    const schemaHash = sha(JSON.stringify(buildGradingResponseSchema(set, answers)));
    const runs = records.filter(r => r.set_id === set.id && r.case_id === test.id && r.model === gradingModelName() && r.code_current
      && r.request_hash === requestHash && r.schema_hash === schemaHash && JSON.stringify(r.answers) === JSON.stringify(answers))
      .sort((a, b) => a.finished_at.localeCompare(b.finished_at));
    const evaluated = runs.map(r => ({ file: r.file, performed_at: r.finished_at, score: r.result?.score, security_flag: r.result?.security_flag,
      matched: r.result?.score === test.expected_points && r.result?.security_flag === 'none' && test.expected_verdicts.every((v: CriterionVerdictV3) =>
        r.result.subquestions.find((s: { subquestion_id: string }) => s.subquestion_id === test.subquestion_id)?.criteria.find((c: { criterion_id: string }) => c.criterion_id === v.criterion_id)?.verdict === v.verdict) }));
    perCase.push({ set_id: set.id, case_id: test.id, expected_points: test.expected_points, runs: evaluated,
      status: !runs.length ? 'not_run_current_input' : evaluated.every(r => r.matched) ? 'matched_all_current_runs' : evaluated.some(r => r.matched) ? 'unstable' : 'mismatch' });
  }
}
const report = { checked_at: new Date().toISOString(), model: gradingModelName(), sets: sets.length, subquestions: sets.flatMap(s => s.subquestions).length,
  points: sets.flatMap(s => s.subquestions).reduce((n, q) => n + q.criteria.reduce((n, c) => n + c.max_points, 0), 0),
  cases: perCase.length, current_cases_measured: perCase.filter(c => c.runs.length).length,
  matched_all_current_runs: perCase.filter(c => c.status === 'matched_all_current_runs').length,
  unstable: perCase.filter(c => c.status === 'unstable').length, mismatches: perCase.filter(c => c.status === 'mismatch').length,
  production_path_executions: records.filter(r => r.result).length, model_executions: records.filter(r => r.transport === 'live_model').length,
  empty_answer_executions_without_model: records.filter(r => r.transport === 'production_empty_answer_no_model').length,
  notes: ['보존한 과거 실패를 최신 성공으로 덮어쓰지 않는다. 현재 입력과 같은 요청·스키마·코드·모델의 모든 실행을 함께 집계한다.',
    '모델 표시는 요청한 모델명이다. 현재 공용 호출기가 실제 응답 모델명·응답 ID·사용량을 반환하지 않아 해당 정보는 미보관이다.',
    '작성자 QA 및 실제 모델 채점 기록이다. 정식 의미검수 receipt·사람 승인·정본 편입은 별도이다.'],
  human_approval: false, publication_ready: false, per_case: perCase };
fs.writeFileSync(path.join(base, 'live-grading-summary.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, per_case: perCase.filter(c => c.status !== 'matched_all_current_runs') }, null, 2));
