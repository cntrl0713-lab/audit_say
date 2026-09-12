import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// A read-only content audit, not an actual grading run or a semantic approval.
const [manifestFile, label] = process.argv.slice(2);
if (!manifestFile || !label || !/^[a-z0-9-]+$/.test(label)) throw Error('manifest 및 새 실행 이름 필요');
const control = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const output = path.join(control, `${label}.json`);
if (fs.existsSync(output)) throw Error('기존 증거를 덮어쓰지 않습니다.');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest = read(manifestFile);
const errors = [], rows = [];
for (const entry of manifest.entries.filter(e => e.file && e.qa_file)) {
  if (sha(entry.file) !== entry.sha256 || sha(entry.qa_file) !== entry.qa_sha256) {
    errors.push(`${entry.plan_id}: 수집 후 입력 변경`);
    continue;
  }
  const raw = read(entry.file), set = Array.isArray(raw) ? raw[0] : raw;
  const qa = read(entry.qa_file);
  if (qa.version !== 1 || qa.artifact_type !== 'author_expected_judgments' || qa.set_id !== set.id) errors.push(`${entry.plan_id}: QA envelope`);
  if (new Set(qa.cases.map(c => c.id)).size !== qa.cases.length) errors.push(`${entry.plan_id}: QA ID 중복`);
  for (const c of qa.cases) {
    const q = set.subquestions.find(q => q.id === c.subquestion_id);
    if (!q || typeof c.answer !== 'string' || !Number.isInteger(c.expected_points) || !Array.isArray(c.expected_verdicts)) {
      errors.push(`${entry.plan_id}/${c.id}: QA 형상`); continue;
    }
    if (c.expected_verdicts.length !== q.criteria.length || new Set(c.expected_verdicts.map(v => v.criterion_id)).size !== q.criteria.length) errors.push(`${entry.plan_id}/${c.id}: criterion 누락/중복`);
    let score = 0;
    for (const v of c.expected_verdicts) {
      const criterion = q.criteria.find(k => k.id === v.criterion_id);
      if (!criterion || !['met','not_met','contradicted','partial'].includes(v.verdict) || (v.verdict === 'partial' && criterion.scores.partial === undefined)) {
        errors.push(`${entry.plan_id}/${c.id}: criterion/판정 계약`); continue;
      }
      if (v.verdict === 'met') score += criterion.scores.met;
      if (v.verdict === 'partial') score += criterion.scores.partial;
    }
    if (score !== c.expected_points) errors.push(`${entry.plan_id}/${c.id}: 사전 기대점수 합계`);
  }
  for (const q of set.subquestions) {
    const cases = qa.cases.filter(c => c.subquestion_id === q.id);
    const kinds = [...new Set(cases.map(c => c.kind))];
    if (!cases.some(c => c.answer.trim() === '' && c.expected_points === 0)) errors.push(`${entry.plan_id}/${q.id}: 빈 답안 사례 없음`);
    rows.push({ plan_id: entry.plan_id, set_id: set.id, subquestion_id: q.id, cases: cases.length, kinds,
      criteria: q.criteria.map(k => ({ criterion_id: k.id,
        met_cases: cases.filter(c => c.expected_verdicts.some(v => v.criterion_id === k.id && v.verdict === 'met')).map(c => c.id),
        not_met_cases: cases.filter(c => c.answer.trim() && c.expected_verdicts.some(v => v.criterion_id === k.id && v.verdict === 'not_met')).map(c => c.id),
        contradicted_cases: cases.filter(c => c.expected_verdicts.some(v => v.criterion_id === k.id && v.verdict === 'contradicted')).map(c => c.id),
      })) });
  }
}
const result = { created_at: new Date().toISOString(), artifact_type: 'static_qa_contract_audit',
  manifest_file: manifestFile, manifest_sha256: sha(manifestFile), actual_model_calls: 0,
  limitation: '사례 종류의 이름이나 기대판정 출현은 실제 조건 경계·동의표현의 의미 검증을 대신하지 않는다. 기대판정 자체의 타당성은 원문 대조 및 실제 채점 불일치 조사에서 확인한다.',
  sets: new Set(rows.map(r => r.set_id)).size, questions: rows.length,
  cases: rows.reduce((n,r) => n+r.cases,0), errors, rows };
fs.writeFileSync(output, JSON.stringify(result,null,2)+'\n', {flag:'wx'});
console.log(JSON.stringify({output, sets:result.sets, questions:result.questions, cases:result.cases, errors}));
if (errors.length) process.exitCode = 1;
