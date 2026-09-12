// Explicit frozen-lock reproduction of exactly one original unit/instruction.
// Default is preparation only; --execute makes one API request, with no retry.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import { prepareSemanticReview, reviewChunkSchema, groundReviewChunk } from '../../../../questionSemanticReview.ts';
import { jsonHash } from '../../../../questionReviewIdentity.ts';
import { requestOpenAIStructured } from '../../../../../lib/ai/openaiStructured.ts';
import { extractProductionInstructions, safeHeaders, safeError } from '../../../../analysis/reviews/delegated-authoring-2026-09-11/resume-semantic.ts';

const args = {};
let execute = false;
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i];
  if (key === '--execute') { if (execute) throw Error('Duplicate execute'); execute = true; continue; }
  if (!['--manifest', '--runtime-lock', '--plan-id', '--log', '--unit-id', '--output', '--original-attempt'].includes(key) || !process.argv[i + 1] || args[key]) throw Error('Named manifest/runtime-lock/plan-id/log/unit-id/output required; optional original-attempt and execute');
  args[key] = process.argv[++i];
}
for (const key of ['--manifest', '--runtime-lock', '--plan-id', '--log', '--unit-id', '--output']) if (!args[key]) throw Error(`Missing ${key}`);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
const fileSha = file => sha(fs.readFileSync(file));
const ensure = (condition, detail) => { if (!condition) throw Error(detail); };
const manifest = read(args['--manifest']), lock = read(args['--runtime-lock']);
const matches = manifest.entries.filter(row => row.plan_id === args['--plan-id']);
ensure(matches.length === 1, 'Unique manifest entry required');
const entry = matches[0];
ensure(['N01', 'N06', 'S01', 'S05', 'S06'].includes(entry.package), 'Outside owned packages');
ensure(entry.plan_files.length === 1, 'One exact manual plan required');
const ownRoot = path.resolve(`cpa_uploader/drafts/delegated-authoring-2026-09-11/${entry.package.toLowerCase()}`) + path.sep;
const output = path.resolve(args['--output']);
ensure(output.toLowerCase().startsWith(ownRoot.toLowerCase()) && !fs.existsSync(output), 'New owned output file required');
const snapshots = new Map();
function remember(file, expected = fileSha(file)) {
  ensure(fileSha(file) === expected, `Changed frozen input ${file}`);
  snapshots.set(path.resolve(file), expected);
}
remember(args['--manifest'], lock.manifest_sha256);
remember(args['--runtime-lock']);
remember(fileURLToPath(import.meta.url));
remember('cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/resume-semantic.ts');
for (const item of [lock.comparison_bank, ...lock.code_files, ...(lock.source_files || []),
  {file: entry.file, sha256: entry.sha256}, {file: entry.qa_file, sha256: entry.qa_sha256}, ...entry.plan_files, ...entry.source_files]) remember(item.file, item.sha256);
const guard = () => { for (const [file, expected] of snapshots) ensure(fs.existsSync(file) && fileSha(file) === expected, `Runtime input changed ${file}`); };
const rawSet = read(entry.file), set = Array.isArray(rawSet) ? rawSet[0] : rawSet;
const rawPlan = read(entry.plan_files[0].file), plan = rawPlan.plans ? rawPlan.plans.find(row => row.set_id === set.id) : rawPlan;
const bank = read(lock.comparison_bank.file);
ensure(lock.settings.review_model === 'gpt-5.6-luna' && lock.settings.grading_model === 'gpt-5.6-luna' && lock.settings.review_input_max_chars === 500000, 'Wrong locked model/input budget');
const prepared = prepareSemanticReview(set, {bank: [...bank.filter(peer => peer.id !== set.id), set], authoringPlan: plan, maxInputChars: 500000});
const unit = prepared.units.find(row => row.id === args['--unit-id']);
ensure(unit, 'Original semantic unit not found');
const input = JSON.stringify({...prepared.requestContext, target_unit: unit.id,
  reference_catalog: {fields: unit.fields, sources: prepared.sources.filter(source => unit.sources.includes(source.source_ref_id)).map(source => ({id: source.source_ref_id, quote: source.declared_metadata.source_quote}))}});
const schema = reviewChunkSchema(unit);
const log = args['--log'];
ensure(log.endsWith('.chunks.jsonl'), 'Original actual chunk log required');
const runtimeFile = log.slice(0, -'.chunks.jsonl'.length) + '.runtime.json';
const runtimeResultFile = log.slice(0, -'.chunks.jsonl'.length) + '.runtime-result.json';
const runtime = read(runtimeFile), runtimeResult = read(runtimeResultFile);
ensure(runtime.mock === false && runtime.review_model === lock.settings.review_model && runtime.max_input_chars === 500000, 'Original runtime settings differ');
ensure(Array.isArray(runtimeResult.changed_code_files) && !runtimeResult.changed_code_files.length && !runtimeResult.changed_input_files?.length, 'Unstable original runtime');
for (const [file, expected] of Object.entries(runtime.code_hashes)) remember(file, expected);
for (const file of [log, runtimeFile, runtimeResultFile]) remember(file);
const rows = fs.readFileSync(log, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const available = rows.map((row, index) => ({row, line: index + 1})).filter(item => item.row.unit_id === unit.id);
const selected = args['--original-attempt']
  ? available.find(item => item.row.attempt === Number(args['--original-attempt']) && !item.row.error)
  : available.find(item => !item.row.error && item.row.response != null);
ensure(selected, 'Successful original response required; do not select a favorable later repeat');
const prior = selected.row;
ensure(prior.transport === 'model' && prior.record_kind === 'new_actual_model_request', 'Only original actual model evidence can be reproduced');
ensure(prior.model === lock.settings.review_model && prior.set_id === set.id && prior.content_hash === prepared.contentHash && prior.bank_hash === prepared.bankHash, 'Original model/content/bank mismatch');
ensure(prior.input_hash === sha(input) && prior.schema_hash === jsonHash(schema) && jsonHash(prior.source_files) === jsonHash(prepared.sourceFiles), 'Original exact request/schema/source mismatch');
let instructions = extractProductionInstructions(fs.readFileSync('cpa_uploader/questionSemanticReview.ts', 'utf8'));
let previousError = null;
if (prior.attempt === 2) {
  const preceding = rows.slice(0, selected.line - 1).reverse().find(row => row.unit_id === unit.id && row.attempt === 1);
  ensure(preceding?.error, 'Attempt 2 requires original attempt-1 validation error');
  previousError = preceding.error;
  instructions += ' 직전 응답 검증 오류를 고치되 판정을 임의로 pass로 바꾸지 말라: ' + previousError;
} else ensure(prior.attempt === 1, 'Unsupported original attempt');
ensure(prior.instructions_hash === sha(instructions), 'Exact original retry instruction hash mismatch');
const record = {
  started_at: new Date().toISOString(), plan_id: entry.plan_id, set_id: set.id, unit_id: unit.id,
  mode: execute ? 'one_actual_request' : 'prepare_only', model: prior.model,
  original_log: log, original_log_sha256: fileSha(log), original_line: selected.line,
  original_attempt: prior.attempt, original_previous_validation_error: previousError,
  original_response_hash: jsonHash(prior.response),
  input_hash: sha(input), schema_hash: jsonHash(schema), instructions_hash: sha(instructions),
  content_hash: prepared.contentHash, bank_hash: prepared.bankHash,
  source_files: prepared.sourceFiles, runtime_lock: {file: args['--runtime-lock'], sha256: fileSha(args['--runtime-lock'])},
  checked_input_hashes: Object.fromEntries(snapshots),
  purpose: 'One repetition of the exact original unit, including attempt-2 correction instructions when present. Original response and all earlier repeats remain immutable.',
};
guard();
if (!execute) {
  console.log(JSON.stringify({...record, actual_api_requests: 0}, null, 2));
} else {
  ensure(process.env.OPENAI_API_KEY?.trim(), 'API key unavailable');
  fs.mkdirSync(path.dirname(output), {recursive: true});
  const client = new OpenAI({apiKey: process.env.OPENAI_API_KEY, maxRetries: 0});
  try {
    record.raw_response = await requestOpenAIStructured({apiKey: process.env.OPENAI_API_KEY,
      model: prior.model, name: 'question_semantic_review_unit', schema,
      maxOutputTokens: 6000, instructions, input, timeoutMs: 60000, maxAttempts: 1}, async (params, options) => {
      try {
        const response = await client.responses.create(params, options).withResponse();
        record.http_status = response.response.status; record.request_id = response.request_id;
        record.response_headers = safeHeaders(response.response.headers);
        return response.data;
      } catch (error) { record.provider_error = safeError(error); throw error; }
    });
    guard();
    record.grounded = groundReviewChunk(record.raw_response, prepared, unit);
    record.status = 'response_valid';
  } catch (error) {
    record.status = record.raw_response ? 'local_validation_failed' : 'request_failed';
    record.error = safeError(error);
    record.validation_error = record.raw_response ? String(error) : null;
  }
  record.finished_at = new Date().toISOString();
  record.changed_inputs = [...snapshots].filter(([file, expected]) => !fs.existsSync(file) || fileSha(file) !== expected).map(([file]) => file);
  record.actual_api_requests = 1;
  fs.writeFileSync(output, JSON.stringify(record, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({output, status: record.status, http_status: record.http_status, changed_inputs: record.changed_inputs}));
  if (record.status !== 'response_valid' || record.changed_inputs.length) process.exitCode = 1;
}
