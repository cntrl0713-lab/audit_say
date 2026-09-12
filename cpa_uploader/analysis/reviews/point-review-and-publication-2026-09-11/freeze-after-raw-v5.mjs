import fs from 'node:fs';
import crypto from 'node:crypto';
const root = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const beforeFile = `${root}/execution-runtime-v4.json`;
const before = JSON.parse(fs.readFileSync(beforeFile, 'utf8'));
const changed = before.code_files.filter(row => hash(row.file) !== row.sha256);
if (changed.some(row => row.file !== 'cpa_uploader/questionSourceCatalog.mjs')) throw new Error('Unexpected common code change since runtime v4');
const files = [...before.code_files.map(row => row.file), `${root}/a/run-learning-unit-smoke-v3.ts`];
const runtime = { created_at: new Date().toISOString(), version: 'raw-source-and-footnote-number-freeze-2026-09-11-v5',
  predecessor: { file: beforeFile, sha256: hash(beforeFile) },
  purpose: 'Freeze verified source parser and current grading code after raw archive collection; new execution paths only',
  review_model: before.review_model, grading_model: before.grading_model,
  changed_predecessor_files: changed,
  code_files: files.map(file => ({ file, sha256: hash(file) })),
  preserved_inputs: ['cpa_uploader/raw/collections/2026-09-11-initial/manifest.json', `${root}/prepared-reviewed-v6/candidate-authoring.json`, `${root}/qa-prepared-v4/manifest.json`].map(file => ({ file, sha256: hash(file) })),
  validation: { source_catalog: '15/15 including mismatched footnote number rejection',
    semantic_publication_compatibility: '33/33 on parser ownership followup; number guard does not change valid registry output',
    historical_migration: '5/5 after concurrent documentation-path correction', wiki_tests: '16/16',
    raw_collector: '35/35', source_archive: '471 original/copy pairs independently verified; 146/146 direct wiki data inputs',
    learning_smoke_runner: '18 fixtures and three CLI dry-runs; API not run', typecheck: 'passed', target_lint: 'passed',
    analysis_build_check: 'passed', wiki_build_check: 'passed', student_grading_code: 'unchanged',
    full_suite: 'Earlier run 468/473; five migration failures subsequently retested 5/5; no later full-suite run claimed' } };
fs.writeFileSync(`${root}/execution-runtime-v5.json`, JSON.stringify(runtime, null, 2) + '\n', { flag: 'wx' });
const helper = fs.readFileSync(`${root}/prepare-execution-v5.ts`, 'utf8')
  .replace("?'existing'}-v5", "?'existing'}-v6");
// Replace the output suffix independently from the runtime predecessor name.
const execution = helper.replace("mode==='--new-only'?'new':'existing'}-v5", "mode==='--new-only'?'new':'existing'}-v6")
  .replace('execution-runtime-v4.json', 'execution-runtime-v5.json');
if (!execution.includes("'existing'}-v6")) throw new Error('Execution version update missing');
fs.writeFileSync(`${root}/prepare-execution-v6.ts`, execution, { flag: 'wx' });
const wave = fs.readFileSync(`${root}/prepare-validation-wave-v5.mjs`, 'utf8').replaceAll('execution-all-v5', 'execution-all-v6').replace('execution-${mode}-v5', 'execution-${mode}-v6');
fs.writeFileSync(`${root}/prepare-validation-wave-v6.mjs`, wave, { flag: 'wx' });
console.log(JSON.stringify({ runtime: `${root}/execution-runtime-v5.json`, changed: changed.map(row => row.file), bank_sha256: hash(`${root}/prepared-reviewed-v6/candidate-authoring.json`), api_calls: 0 }));
