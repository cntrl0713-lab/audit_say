import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

// Read-only production inspection. No write RPC, release activation, or model call.
const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const output = `${base}/production-apply-request-2026-09-12-01`;
const candidateDir = `${base}/c/prepared-reviewed-v8`;
const candidateFile = `${candidateDir}/candidate-authoring.json`;
const canonicalFile = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const sha = value => createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(file, 'utf8');
const identity = file => ({ file, sha256: sha(fs.readFileSync(file)) });
const candidateText = read(candidateFile);
if (sha(candidateText) !== '11618f57625ae6ec71630f6413411ad513291674573e4eb0f028d129c0eab90b') throw new Error('Candidate identity changed');
for (const file of ['preflight.json', 'import-check.json', 'import-check.log']) {
  if (fs.existsSync(`${output}/${file}`)) throw new Error('Output already exists');
}
const before = [canonicalFile, candidateFile, `${candidateDir}/candidate-public.json`,
  `${candidateDir}/learning-question-classifications.json`, 'cpa_uploader/data/cpa_question_sets_v3.promotions.json'].map(identity);
const run = spawnSync(process.execPath, [
  'node_modules/tsx/dist/cli.mjs', 'scripts/import-question-bank-v3.ts',
  '--learning-catalog', `${candidateDir}/learning-question-classifications.json`,
  '--report', `${output}/import-check.json`,
], { cwd: process.cwd(), encoding: 'utf8', timeout: 90000,
  env: { ...process.env, CPA_QUESTION_V3_AUTHORING_PATH: path.resolve(candidateFile),
    CPA_QUESTION_V3_PUBLIC_PATH: path.resolve(`${candidateDir}/candidate-public.json`),
    CPA_QUESTION_V3_PROMOTIONS_PATH: path.resolve('cpa_uploader/data/cpa_question_sets_v3.promotions.json') } });
fs.writeFileSync(`${output}/import-check.log`, `${run.stdout ?? ''}\n${run.stderr ?? ''}`, { flag: 'wx' });
if (!fs.existsSync(`${output}/import-check.json`)) throw new Error('Importer did not produce readiness report');
const candidate = JSON.parse(candidateText);
const canonical = JSON.parse(read(canonicalFile));
const count = sets => ({ sets: sets.length, subquestions: sets.reduce((n, s) => n + s.subquestions.length, 0),
  points: sets.reduce((n, s) => n + s.subquestions.reduce((m, q) => m + q.criteria.reduce((p, c) => p + c.max_points, 0), 0), 0) });
const compare = baseline => {
  const byId = new Map(baseline.map(s => [s.id, s]));
  const ids = new Set(candidate.map(s => s.id));
  return { added_ids: candidate.filter(s => !byId.has(s.id)).map(s => s.id),
    changed_ids: candidate.filter(s => byId.has(s.id) && JSON.stringify(byId.get(s.id)) !== JSON.stringify(s)).map(s => s.id),
    unchanged_ids: candidate.filter(s => byId.has(s.id) && JSON.stringify(byId.get(s.id)) === JSON.stringify(s)).map(s => s.id),
    removed_ids: baseline.filter(s => !ids.has(s.id)).map(s => s.id) };
};
const report = { checked_at: new Date().toISOString(), requested_action: '운영DB적용', applied: false,
  model_api_calls: 0, db_write_calls: 0, canonical: count(canonical), candidate: count(candidate),
  candidate_vs_canonical: compare(canonical), importer_exit_code: run.status,
  importer_readiness: JSON.parse(read(`${output}/import-check.json`)), before, live: null };
try {
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname;
  if (host !== 'xvifzicrjmbfqaepcfpp.supabase.co' || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('DB_IDENTITY_OR_CONFIG_UNAVAILABLE');
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const active = await client.rpc('cpa_get_active_question_bank');
  if (active.error || !Array.isArray(active.data) || !active.data.length) throw new Error('ACTIVE_BANK_READ_FAILED');
  const ids = [...new Set(active.data.map(s => s.release_id))];
  if (ids.length !== 1 || !ids[0]) throw new Error('ACTIVE_RELEASE_ID_INVALID');
  const release = await client.from('cpa_question_bank_releases')
    .select('id,status,source_document,source_file_hash,bank_content_hash,public_content_hash').eq('id', ids[0]).single();
  if (release.error || typeof release.data?.source_document !== 'string') throw new Error('RELEASE_SOURCE_READ_FAILED');
  const source = release.data.source_document;
  if (sha(source) !== release.data.source_file_hash) throw new Error('RELEASE_SOURCE_HASH_MISMATCH');
  const sets = JSON.parse(source);
  report.live = { read_succeeded: true, project_host: host, release_id: ids[0], status: release.data.status,
    source_file_hash: release.data.source_file_hash, source_bytes_equal_local_canonical: source === read(canonicalFile),
    counts: count(sets), candidate_diff: compare(sets),
    operations: ['cpa_get_active_question_bank (read)', 'cpa_question_bank_releases SELECT by release id'] };
} catch (error) {
  report.live = { read_succeeded: false, error_code: ['DB_IDENTITY_OR_CONFIG_UNAVAILABLE', 'ACTIVE_BANK_READ_FAILED',
    'ACTIVE_RELEASE_ID_INVALID', 'RELEASE_SOURCE_READ_FAILED', 'RELEASE_SOURCE_HASH_MISMATCH'].includes(error.message)
    ? error.message : 'READ_ONLY_DB_CHECK_FAILED' };
}
report.after = before.map(row => identity(row.file));
report.local_inputs_unchanged = JSON.stringify(report.before) === JSON.stringify(report.after);
fs.writeFileSync(`${output}/preflight.json`, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ applied: false, ready: report.importer_readiness.ready,
  importer_errors: report.importer_readiness.errors.length, candidate: report.candidate,
  live: report.live?.read_succeeded ? { ...report.live, candidate_diff: Object.fromEntries(Object.entries(report.live.candidate_diff).map(([key, value]) => [key, value.length])) } : report.live,
  local_inputs_unchanged: report.local_inputs_unchanged, model_api_calls: 0, db_write_calls: 0 }));
