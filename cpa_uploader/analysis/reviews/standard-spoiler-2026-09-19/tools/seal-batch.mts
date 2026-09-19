// 실측이 끝난 execution-vN을 비용 통제 검수 배치(batch-vN.json)로 봉인하고, 검증기로 모든 세트의 receipt를 메모리에서 만들어 확인한다.
//   npx tsx cpa_uploader/analysis/reviews/standard-spoiler-2026-09-19/tools/seal-batch.mts --version v1 [--residual residual-findings-v1.json]
// 허용 범위(±1점) 밖 결과가 있으면 --residual 파일에 원인 조사와 내용 재확인 결과가 있어야 한다. 기존 출력이 있으면 쓰지 않는다.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { QuestionSetV3 } from '../../../../../lib/questionV3.ts';
import { assertEfficientEvidenceUnchanged, createEfficientReviewReceipt, createEfficientValidationContext } from '../../../../questionEfficientReview.ts';

const B = 'cpa_uploader/analysis/reviews/standard-spoiler-2026-09-19';
const args = process.argv.slice(2);
const option = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const V = option('--version'); assert(V && /^v\d+$/u.test(V), 'Usage: --version vN [--residual FILE]');
const X = `${B}/execution-${V}`;
const read = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const ref = (file: string) => ({ file, sha256: sha(fs.readFileSync(file)) });
const manifest = read<{ entries: { id: string }[]; bank: { file: string } }>(`${X}/grading-manifest.json`);

interface Row { id: string; status: string; observation?: { file: string; sha256: string } }
const rows: Row[] = [];
let calls = 0, answers = 0, within = 0;
const usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
const costs: (number | null)[] = [];
for (const worker of ['a', 'b', 'c']) {
    const summary = read<{ status: string; rows: Row[]; actual_sdk_calls: number; representative_subquestion_answers: number; within_tolerance: number;
        provider_token_totals: Record<string, number | null>; usd: number | null }>(`${X}/actual-${worker}/summary.json`);
    assert.equal(summary.status, 'completed', `worker ${worker} did not complete`);
    rows.push(...summary.rows); calls += summary.actual_sdk_calls; answers += summary.representative_subquestion_answers; within += summary.within_tolerance;
    for (const key of Object.keys(usage) as (keyof typeof usage)[]) { const n = summary.provider_token_totals[key]; assert(Number.isSafeInteger(n)); usage[key] += n!; }
    costs.push(summary.usd);
}
assert.deepEqual(rows.map((r) => r.id).sort(), manifest.entries.map((e) => e.id).sort(), 'Every manifest entry needs exactly one observation');
for (const row of rows) assert(row.observation && ['within_tolerance', 'outside_tolerance_or_security'].includes(row.status), `${row.id}: ${row.status}`);
const residualFile = option('--residual');
const residual = residualFile ? read<{ findings: unknown[] }>(`${B}/${residualFile}`).findings : [];
const batchFile = `${B}/batch-${V}.json`;
const batch = {
    version: 1, artifact_type: 'cost_controlled_review_batch', created_at: new Date().toISOString(),
    authorization: { evidence: ref(`${B}/authorization.md`), agent_review_and_representative_grading: true, production_publication: true },
    grading_manifest: ref(`${X}/grading-manifest.json`),
    observations: rows.map((row) => row.observation!),
    agent_reviews: read<unknown[]>(`${X}/agent-reviews.json`),
    runtime_snapshots: read<unknown[]>(`${X}/runtime-snapshots.json`),
    residual_grading_findings: residual,
};
fs.writeFileSync(batchFile, `${JSON.stringify(batch, null, 2)}\n`, { flag: 'wx' });
// 검증기로 모든 세트의 receipt를 만든다(관측 재생·기대값·범위·95% 목표·잔여 조사 대조 포함).
const bank = read<QuestionSetV3[]>(manifest.bank.file);
const context = createEfficientValidationContext();
const receipts = bank.map((set) => createEfficientReviewReceipt(ref(batchFile), set, context, process.cwd(), true));
assertEfficientEvidenceUnchanged(context);
const knownCosts = costs.every((c) => typeof c === 'number') ? (costs as number[]).reduce((n, c) => n + c, 0) : null;
fs.writeFileSync(`${B}/batch-${V}-validation.json`, `${JSON.stringify({ version: 1, batch: ref(batchFile), validated_at: new Date().toISOString(),
    sets: receipts.length, observed_answers: answers, within_tolerance: within, ratio: within / answers, residual_findings: residual.length,
    actual_sdk_calls: calls, provider_token_totals: usage, usd_from_provider_usage_arithmetic: knownCosts, costs_are_not_invoice: true,
    receipts: receipts.map((r) => ({ set_id: r.set_id, content_hash: r.content_hash, reviewed_units: r.reviewed_units, observed_answers: r.observed_answers, receipt_hash: r.receipt_hash })) }, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ batch: ref(batchFile), sets: receipts.length, answers, within, ratio: within / answers, calls, usage, usd: knownCosts }, null, 2));
