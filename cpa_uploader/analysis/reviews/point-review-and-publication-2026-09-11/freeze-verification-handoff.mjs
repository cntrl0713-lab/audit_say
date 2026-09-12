import fs from 'node:fs';
import crypto from 'node:crypto';
const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const target = `${base}/verification-handoff-001.json`;
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
if (process.argv.includes('--check')) {
  const saved = read(target);
  const errors = saved.files.filter(row => !fs.existsSync(row.file) || hash(row.file) !== row.sha256).map(row => row.file);
  console.log(JSON.stringify({ version: saved.version, checked_files: saved.files.length, errors, api_calls: 0 }, null, 2));
  if (errors.length) process.exitCode = 1;
} else {
  if (fs.existsSync(target)) throw new Error('Handoff snapshot exists; preserve it');
  const master = read(`${base}/execution-all-v6/manifest.json`);
  const locked = new Map();
  const add = row => {
    if (!row.file || !row.sha256) throw new Error('Missing identity');
    if (locked.has(row.file) && locked.get(row.file) !== row.sha256) throw new Error(`Conflicting identity: ${row.file}`);
    if (hash(row.file) !== row.sha256) throw new Error(`Frozen input changed: ${row.file}`);
    locked.set(row.file, row.sha256);
  };
  add({ file: master.bank_file, sha256: master.bank_sha256 });
  for (const row of master.code_files) add(row);
  for (const job of master.jobs) for (const row of [{ file: job.file, sha256: job.sha256 },
    { file: job.plan_file, sha256: job.plan_sha256 }, { file: job.qa_file, sha256: job.qa_sha256 }, ...job.source_files]) add(row);
  const learning = read(`${base}/a/learning-unit-smoke-v3/manifest.json`);
  for (const row of [...learning.inputs, ...learning.code_files, ...learning.entries]) add(row);
  const additional = [
    `${base}/execution-runtime-v5.json`, `${base}/execution-all-v6/manifest.json`, `${base}/execution-all-v6/preflight.json`,
    `${base}/execution-resumes/handoff-001/resume.json`, `${base}/execution-resumes/handoff-001/canary/manifest.json`, `${base}/execution-resumes/handoff-001/remaining/manifest.json`,
    `${base}/execution-canary-v6/STOP`, `${base}/execution-canary-v6/semantic-a/run.json`, `${base}/execution-canary-v6/semantic-a/summary.json`,
    `${base}/qa-prepared-v4/manifest.json`, `${base}/a/learning-unit-smoke-v3/manifest.json`,
    `${base}/prepare-verification-resume.mjs`, `${base}/freeze-verification-handoff.mjs`,
    'cpa_uploader/raw/collections/2026-09-11-initial/manifest.json', 'cpa_uploader/raw/collections/2026-09-11-initial/path-aliases.json',
    'cpa_uploader/data/cpa_question_sets_v3.authoring.json', 'cpa_uploader/data/cpa_question_sets_v3.public.json', 'cpa_uploader/data/cpa_question_sets_v3.promotions.json',
    'data/cpa_question_sets_v3.authoring.enc.json',
    'AGENTS.md', '.agents/skills/audit-question-author/SKILL.md', '.agents/skills/audit-question-review/SKILL.md',
    '.agents/skills/audit-question-review/references/source-evidence.md', '.agents/skills/audit-question-review/references/regression-cases.md',
  ];
  for (const file of additional) add({ file, sha256: hash(file) });
  const stopped = read(`${base}/execution-canary-v6/semantic-a/summary.json`);
  if (stopped.recorded_sets !== 0 || stopped.results.length !== 0 || !stopped.gracefully_stopped) throw new Error('Unexpected current execution state');
  const snapshot = {
    version: 'question-verification-2026-09-11-handoff-001', frozen_at: new Date().toISOString(),
    user_instruction: '현재 상태를 고정하고 완료/미완료를 구분한 보고서·작업요구서를 작성하여 다음 작업에서 전수검증을 수행',
    execution_state: 'deferred_by_user_no_running_model_workers', current_candidate_model_api_calls: 0,
    max_concurrent_workers: 3, model: master.model, review_model: master.review_model,
    bank: { file: master.bank_file, sha256: master.bank_sha256 },
    runtime_file: `${base}/execution-runtime-v5.json`, resume_file: `${base}/execution-resumes/handoff-001/resume.json`,
    selected: { sets: master.jobs.length, questions: master.jobs.reduce((n, job) => n + job.questions, 0),
      criteria: master.jobs.reduce((n, job) => n + job.criteria, 0), semantic_units: master.jobs.reduce((n, job) => n + job.semantic_units, 0),
      author_qa_cases: read(`${base}/qa-prepared-v4/manifest.json`).unique_cases, learning_units: learning.entries.length },
    completed: ['candidate_authoring_and_point_review', 'official_source_remediation_and_quote_completion', 'raw_collection_and_independent_byte_checks',
      'classification_projection_and_structure_checks', 'all_selected_semantic_input_preflight', 'author_qa_preparation_and_expected_score_replay',
      'learning_empty_answer_function_checks', 'runtime_code_targeted_tests', 'analysis_and_wiki_checks', 'fresh_resume_manifest_preparation'],
    incomplete: ['current_candidate_actual_semantic_review', 'current_candidate_formal_model_case_grading', 'author_qa_actual_model_grading',
      'nonempty_learning_model_smoke', 'actual_mismatch_remediation_and_revalidation', 'actual_human_review_evidence',
      'canonical_promotion_and_public_encrypted_compile', 'final_classification_compile', 'production_db_apply_and_roundtrip_verification'],
    historical_evidence_policy: 'Preserve past receipts and partial logs; do not add old pass counts to current candidate completion or rewrite old hashes',
    files: [...locked].sort(([a], [b]) => a.localeCompare(b)).map(([file, sha256]) => ({ file, sha256 })),
  };
  fs.writeFileSync(target, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ file: target, sha256: hash(target), version: snapshot.version, checked_files: locked.size, selected: snapshot.selected, current_candidate_model_api_calls: 0 }, null, 2));
}
