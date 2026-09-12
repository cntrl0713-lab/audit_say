import fs from 'node:fs';
import path from 'node:path';
import { completeSemanticReview, prepareSemanticReview, semanticReceiptIntegrityErrors, validateSemanticReviewReceipt } from '../../../questionSemanticReview.ts';
import type { SemanticReviewReceipt } from '../../../questionSemanticReview.ts';
import type { QuestionSetV3 } from '../../../../lib/questionV3.ts';
import { jsonHash, sha256 } from '../../../questionReviewIdentity.ts';

// This index revalidates recorded evidence locally. It performs no model calls.
type Identity = { file: string; sha256: string };
type Entry = { plan_id: string; set_id: string; file: string; sha256: string; plan_files: Identity[]; source_files: Identity[] };
type Runtime = { mock: boolean; review_model: string; grading_model: string; args: string[]; code_hashes: Record<string, string> };
const control = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const batch = 'cpa_uploader/drafts/delegated-authoring-2026-09-11';
const [label, manifestFile, lockFile] = process.argv.slice(2);
if (!label || !/^[a-z0-9-]+$/.test(label) || !manifestFile || !lockFile) throw Error('label manifest lock required');
const output = path.join(control, `semantic-evidence-index-${label}.json`);
if (fs.existsSync(output)) throw Error('Existing index is immutable');
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;
const hash = (file: string) => sha256(fs.readFileSync(file));
const samePath = (a: string, b: string) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const lock = read<{ manifest_sha256: string; comparison_bank: Identity; code_files: Identity[]; source_files: Identity[]; settings: { review_model: string; grading_model: string; review_input_max_chars: number } }>(lockFile);
const manifest = read<{ entries: Entry[] }>(manifestFile);
for (const item of [{ file: manifestFile, sha256: lock.manifest_sha256 }, lock.comparison_bank, ...lock.code_files, ...lock.source_files]) {
    if (hash(item.file) !== item.sha256) throw Error(`Active identity changed: ${item.file}`);
}
const bank = read<QuestionSetV3[]>(lock.comparison_bank.file);
const prepared = new Map(manifest.entries.map(entry => {
    for (const item of [{ file: entry.file, sha256: entry.sha256 }, ...entry.plan_files, ...entry.source_files]) if (hash(item.file) !== item.sha256) throw Error(`Entry changed: ${item.file}`);
    const raw = read<QuestionSetV3 | QuestionSetV3[]>(entry.file);
    if (Array.isArray(raw) && raw.length !== 1) throw Error('Single set expected');
    const set = Array.isArray(raw) ? raw[0] : raw;
    const planRaw = read<{ plans?: Array<{ set_id: string }> }>(entry.plan_files[0].file);
    const plan = planRaw.plans ? planRaw.plans.find(item => item.set_id === set.id) : planRaw;
    const options = { bank: [...bank.filter(peer => peer.id !== set.id), set], authoringPlan: plan, maxInputChars: lock.settings.review_input_max_chars };
    return [set.id, { entry, set, options, prepared: prepareSemanticReview(set, options) }];
}));
function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(path.join(dir, item.name)) : [path.join(dir, item.name)]);
}
const files = walk(batch);
const records: Array<Record<string, unknown>> = [];
const excluded: Record<string, number> = {};
const invalid: Array<{ file: string; errors: string[] }> = [];
const skip = (reason: string) => { excluded[reason] = (excluded[reason] || 0) + 1; };
for (const file of files.filter(item => path.basename(item) === 'semantic.json')) {
    const runtimeFile = file + '.runtime.json', resultFile = file + '.runtime-result.json';
    if (!fs.existsSync(runtimeFile) || !fs.existsSync(resultFile)) { skip('no_runtime_pair'); continue; }
    const doc = read<{ reviews: SemanticReviewReceipt[] }>(file);
    if (!Array.isArray(doc.reviews) || doc.reviews.length !== 1) { skip('not_single_receipt'); continue; }
    const receipt = doc.reviews[0], current = prepared.get(receipt.set_id);
    if (!current) { skip('outside_active_selection'); continue; }
    const runtime = read<Runtime>(runtimeFile);
    const result = read<{ completed_receipt?: boolean; changed_code_files: string[]; changed_input_files?: string[]; new_actual_api_requests?: number }>(resultFile);
    const bankIndex = runtime.args.indexOf('--bank');
    if (bankIndex < 0 || !samePath(runtime.args[bankIndex + 1], lock.comparison_bank.file)) { skip('other_bank'); continue; }
    if (lock.code_files.some(item => !Object.entries(runtime.code_hashes).some(([file, digest]) => samePath(file, item.file) && digest === item.sha256))) { skip('other_runtime'); continue; }
    if (receipt.context_hash !== jsonHash(current.prepared.context)) { skip('other_plan_context'); continue; }
    let errors: string[] = [];
    if (runtime.mock !== false || runtime.review_model !== lock.settings.review_model || runtime.grading_model !== lock.settings.grading_model) errors.push('model or actual runtime mismatch');
    if (result.completed_receipt === false || result.changed_code_files.length || result.changed_input_files?.length) errors.push('incomplete or changed inputs');
    if (receipt.execution.method !== 'model_reasoned' || receipt.execution.transport !== 'model') errors.push('not actual model semantic evidence');
    const admissionErrors = semanticReceiptIntegrityErrors(receipt, false);
    errors.push(...admissionErrors);
    try {
        const rebuilt = completeSemanticReview(current.prepared, { units: receipt.units, cases: receipt.cases, notes: receipt.notes }, receipt.execution);
        if (rebuilt.receipt_hash !== receipt.receipt_hash) errors.push('receipt does not rebuild against current inputs');
        else if (rebuilt.verdict === receipt.verdict && ['fail', 'uncertain'].includes(receipt.verdict)) {
            // A faithfully recorded negative result remains evidence, without becoming admissible.
            const negativeOutcome = `${receipt.set_id}: 의미검수 결과가 pass가 아닙니다 (${receipt.verdict}).`;
            errors = errors.filter(error => error !== negativeOutcome);
        }
    } catch (error) { errors.push(String(error)); }
    if (errors.length) { invalid.push({ file, errors }); continue; }
    records.push({ plan_id: current.entry.plan_id, set_id: receipt.set_id, file, sha256: hash(file), runtime_file: runtimeFile, runtime_sha256: hash(runtimeFile), result_file: resultFile, result_sha256: hash(resultFile), receipt_hash: receipt.receipt_hash, cases_hash: jsonHash(receipt.cases), verdict: receipt.verdict, admission_errors: admissionErrors, units: receipt.units.length, cases: receipt.cases.length, new_actual_api_requests: result.new_actual_api_requests ?? null, grading_status: receipt.grading.status, nonpass_units: receipt.units.filter(unit => Object.values(unit.checks).some(value => value !== 'pass')), nonpass_cases: receipt.cases.filter(sample => sample.verdict !== 'pass') });
}
const graded: Array<Record<string, unknown>> = [];
for (const file of files.filter(item => path.basename(item) === 'graded-initial.json')) {
    const inputsFile = path.join(path.dirname(file), 'inputs.json');
    if (!fs.existsSync(inputsFile)) continue;
    const inputs = read<{ semantic_file?: string; semantic_sha256?: string; mode?: string }>(inputsFile);
    const original = records.find(record => inputs.semantic_file && samePath(String(record.file), inputs.semantic_file) && record.sha256 === inputs.semantic_sha256);
    if (!original) { skip('graded_other_semantic'); continue; }
    const receipt = read<{ reviews: SemanticReviewReceipt[] }>(file).reviews[0], current = prepared.get(receipt.set_id)!;
    const integrity = semanticReceiptIntegrityErrors(receipt, false);
    if (receipt.grading.transport !== 'model' || inputs.mode !== 'actual_model') integrity.push('grading not actual production model');
    if (jsonHash(receipt.cases) !== original.cases_hash) integrity.push('generated cases differ from source semantic');
    if (integrity.length) { invalid.push({ file, errors: integrity }); continue; }
    const summaryFile = path.join(path.dirname(file), 'summary.json');
    graded.push({ plan_id: current.entry.plan_id, file, sha256: hash(file), semantic_file: inputs.semantic_file, semantic_sha256: inputs.semantic_sha256, grading_status: receipt.grading.status, validation_errors: validateSemanticReviewReceipt(receipt, current.set, current.options), summary: fs.existsSync(summaryFile) ? read<unknown>(summaryFile) : null, followup_incomplete: !fs.existsSync(summaryFile) });
}
const result = { recorded_at: new Date().toISOString(), manifest: { file: manifestFile, sha256: hash(manifestFile) }, runtime_lock: { file: lockFile, sha256: hash(lockFile) }, indexer_sha256: hash(process.argv[1]), execution: 'local integrity and current input revalidation; no model calls', totals: { active_sets: prepared.size, sets_with_current_model_receipt: new Set(records.map(record => record.set_id)).size, receipt_count: records.length, pass_receipts: records.filter(record => record.verdict === 'pass').length, other_receipts: records.filter(record => record.verdict !== 'pass').length, sets_with_actual_generated_grading: new Set(graded.map(record => record.plan_id)).size, invalid_records: invalid.length }, records, graded, invalid, excluded, promotion_or_publication: false };
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, ...result.totals, excluded, invalid }));
