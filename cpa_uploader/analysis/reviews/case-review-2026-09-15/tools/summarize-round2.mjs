// 회차 판본의 대표 실측·보조 실측 결과를 요약 파일로 남긴다(기존 파일이 있으면 쓰지 않는다). summarize-round.mjs의 후속판으로 대표 실측 폴더를
// --actual로 지정할 수 있다(호출 없이 끝난 시도를 보존하고 새 폴더에서 재실행한 경우). 기록된 원본 도구는 고치지 않는다.
//   node cpa_uploader/analysis/reviews/case-review-2026-09-15/tools/summarize-round2.mjs --round r04 --version v1 --draft-dir <D> --set-id <ID> [--actual actual-a2] [--supplementary supplementary-v1]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const B = 'cpa_uploader/analysis/reviews/case-review-2026-09-15';
const args = process.argv.slice(2), options = {};
while (args.length) {
  const flag = args.shift(), value = args.shift();
  assert(['--round', '--version', '--draft-dir', '--set-id', '--supplementary', '--actual'].includes(flag) && value && !options[flag], 'Unknown/duplicate argument: ' + flag);
  options[flag] = value;
}
for (const flag of ['--round', '--version', '--draft-dir', '--set-id']) assert(options[flag], 'Missing ' + flag);
const R = `${B}/${options['--round']}`, V = options['--version'], D = options['--draft-dir'].replace(/\\/g, '/').replace(/\/$/, '');
const ref = (file) => ({ file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') });
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const ACTUAL = options['--actual'] ?? 'actual-a';
assert(/^actual-[a-z0-9-]+$/.test(ACTUAL), '--actual must name an actual-* folder');
const main = read(`${R}/execution-${V}/${ACTUAL}/summary.json`);
assert.equal(main.status, 'completed');
const rows = main.rows.map((r) => read(r.observation.file)).flatMap((o) => o.subquestions.map((q) => ({
  entry: o.entry_id, kind: o.kind, subquestion_id: q.subquestion_id, expected: q.expected_points, actual: q.actual_points, delta: q.delta,
  verdict_state_differences: o.result.subquestions.find((s) => s.subquestion_id === q.subquestion_id).criteria
    .filter((c) => o.original_expected.find((e) => e.subquestion_id === q.subquestion_id).expected_verdicts.find((v) => v.criterion_id === c.criterion_id).verdict !== c.verdict)
    .map((c) => c.criterion_id) })));
const supp = options['--supplementary'] ? read(`${R}/${options['--supplementary']}/summary.json`) : null;
const summary = {
  version: 1, round: options['--round'], draft_version: V, set_id: options['--set-id'], created_at: new Date().toISOString(),
  draft: ref(`${D}/sets.json`), content_review: ref(`${R}/root-content-review-${V}.json`),
  grading: { model: 'gpt-5.6-luna', manifest: ref(`${R}/execution-${V}/grading-manifest.json`), summary: ref(`${R}/execution-${V}/${ACTUAL}/summary.json`),
    transport: 'model', actual_sdk_calls: main.actual_sdk_calls, representative_answers: main.representative_subquestion_answers,
    within_tolerance: main.within_tolerance, exact_points: rows.filter((r) => r.delta === 0).length, rows,
    verdict_state_note: '기대 판정과 실제 판정의 상태 차이가 있으면 모두 0점 상태(contradicted/not_met) 사이의 차이인지 rows에서 확인한다. 원 기대값을 바꾸거나 재채점하지 않았다.',
    usd: main.usd, provider_token_totals: main.provider_token_totals },
  supplementary: supp ? { summary: ref(`${R}/${options['--supplementary']}/summary.json`), receipt_denominator: false, actual_sdk_calls: supp.actual_sdk_calls,
    rows: supp.rows.map((r) => ({ id: r.id, strict_matched: r.strict_matched, points: r.subquestions.map((q) => [q.subquestion_id, q.expected_points, q.actual_points]) })), usd: supp.usd } : null,
  total_actual_sdk_calls: main.actual_sdk_calls + (supp?.actual_sdk_calls ?? 0),
  total_usd_provider_usage_arithmetic: main.usd === null || (supp && supp.usd === null) ? null : main.usd + (supp?.usd ?? 0),
  costs_are_provider_usage_arithmetic_not_invoice: true, separate_paid_semantic_review: 'not_run', human_review_performed: false,
  not_done: ['정본·공개본·암호화본 반영', '운영 DB 등록', '원 세트의 활성 릴리스 제외(퇴역)', '승급 receipt 봉인(authorization.production_publication 미승인)', 'coverage links 갱신'],
};
const out = `${R}/summary-${V}.json`;
fs.writeFileSync(out, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
console.log(out, summary.grading.exact_points + '/' + rows.length, 'calls', summary.total_actual_sdk_calls, 'usd', summary.total_usd_provider_usage_arithmetic);
