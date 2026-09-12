import fs from 'node:fs';
import crypto from 'node:crypto';
const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const manifestFile = `${base}/execution-all-v6/manifest.json`;
const master = read(manifestFile);
const canary = read(`${base}/execution-resumes/handoff-001/canary/manifest.json`);
const remaining = read(`${base}/execution-resumes/handoff-001/remaining/manifest.json`);
const changed = new Set(read(`${base}/prepared-reviewed-v6/summary.json`).canonical.changed_sets);
const learning = read(`${base}/a/learning-unit-smoke-v3/manifest.json`);
const entries = master.jobs.map(job => {
  const set = read(job.file);
  const firstWave = canary.jobs.find(row => row.set_id === job.set_id);
  const assigned = firstWave || remaining.jobs.find(row => row.set_id === job.set_id);
  return { set_id: job.set_id, category: changed.has(job.set_id) ? 'existing_revision' : 'new',
    wave: firstWave ? 'canary' : 'remaining', worker: assigned.worker,
    file: job.file, plan_file: job.plan_file, qa_file: job.qa_file,
    semantic_units: job.semantic_units, criteria: job.criteria, author_qa_cases: job.author_qa_cases,
    learning_units: learning.entries.filter(row => row.source_set_id === job.set_id).map(row => row.learning_unit_id),
    local_preflight: 'passed', author_qa_preparation: 'passed_expected_score_replay_only',
    current_semantic_review: 'not_run', current_formal_grading: 'not_run', current_author_qa_model: 'not_run',
    current_learning_nonempty_model: 'not_run', human_review: 'not_asserted', publication: 'not_applied',
    subquestions: set.subquestions.map(sub => ({ subquestion_id: sub.id,
      criterion_ids: sub.criteria.map(criterion => criterion.id),
      semantic_review: 'not_run', formal_grading: 'not_run', author_qa_model: 'not_run' })) };
});
const result = { version: 'question-verification-2026-09-11-handoff-001', created_at: new Date().toISOString(),
  immutable_baseline: true, source_manifest: { file: manifestFile, sha256: crypto.createHash('sha256').update(fs.readFileSync(manifestFile)).digest('hex') },
  note: '이 표는 현재 후보의 미실행 인계 기준선이다. 실제 실행 후 후속 버전으로 상태와 증거를 기록하며 과거 통과를 합산하지 않는다.',
  sets: entries.length, questions: entries.reduce((n, entry) => n + entry.subquestions.length, 0), entries };
fs.writeFileSync(`${base}/verification-progress-001.json`, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
const lines = ['# 문항별 전수검증 인계 기준선', '', '현재 후보는 전부 로컬 사전검사·QA 준비 완료이며 실제 의미검수·정식 채점·작성자 QA 모델 채점·비빈답 학습 채점은 미실행이다. 과거 실행의 pass는 이 표에 합산하지 않는다. 물음·criterion별 ID와 상태는 [JSON](verification-progress-001.json)에 있다.', '',
  '| 세트 | 구분 | wave/담당 | 물음 | criterion | 의미단위 | 작성자 QA | 학습 단위 |', '| --- | --- | --- | --- | --- | --- | --- | --- |'];
for (const entry of entries) lines.push(`| ${entry.set_id} | ${entry.category === 'new' ? '신규' : '기존 수정'} | ${entry.wave}/${entry.worker} | ${entry.subquestions.length} | ${entry.criteria} | ${entry.semantic_units} | ${entry.author_qa_cases} | ${entry.learning_units.length} |`);
fs.writeFileSync(`${base}/verification-progress-001.md`, lines.join('\n') + '\n', { flag: 'wx' });
console.log(JSON.stringify({ sets: result.sets, questions: result.questions, api_calls: 0 }));
