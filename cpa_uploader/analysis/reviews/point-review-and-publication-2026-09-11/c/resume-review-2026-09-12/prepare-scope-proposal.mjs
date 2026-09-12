import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const wave = D + '/execution-resumes/handoff-001/canary';
const dir = path.dirname(fileURLToPath(import.meta.url));
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const paths = {
  manifest: wave + '/manifest.json',
  worker_summary: wave + '/semantic-c/summary.json',
  receipt: wave + '/semantic-c/pilot-03-001/semantic.json',
  raw: wave + '/semantic-c/pilot-03-001/semantic.json.chunks.jsonl',
  question: D + '/execution-all-v6/sets/pilot-03-001.json',
  plan: D + '/official-review-plans-v2/pilot-03-001.json',
  source: 'cpa_uploader/data/official/delegated-n01-kga200-210-230-2025.txt',
  classification_review: D + '/prepared-reviewed-v6/classification-review.json',
  classification_materialized: D + '/prepared-reviewed-v6/learning-question-classifications.json',
  author_qa: D + '/qa-prepared-v1/pilot-03-001.json',
};
const evidence = Object.entries(paths).map(([role, file]) => ({ role, file, sha256: sha(fs.readFileSync(file)) }));
const set = read(paths.question), plan = read(paths.plan), receipt = read(paths.receipt).reviews[0];
const worker = read(paths.worker_summary);
const raw = fs.readFileSync(paths.raw, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
const source = fs.readFileSync(paths.source, 'utf8'), lines = source.split(/\r?\n/);
const sub = set.subquestions.find(row => row.id === 'sub1');
const review = read(paths.classification_review).entries.find(row => row.set_id === set.id && row.subquestion_id === sub.id);
const materialized = read(paths.classification_materialized).classifications.find(row => row.source_set_id === set.id && row.subquestion_id === sub.id);
const qa = read(paths.author_qa);
const beforePrompt = sub.prompt;
const afterPrompt = '경영진이 감사에 필요한 정보를 제공하거나 확보할 능력이 있다는 일반적 전제 아래, 감사인이 감사업무를 수임하기 위해 경영진으로부터 확인받아야 하는 전제조건의 핵심 내용을 기술하고, 경영진이 이러한 책임을 인정하지 않을 경우 해당 업무 수임의 적합성을 법규상 예외와 함께 설명하시오. 수임 후 경영진에게 전달할 사항은 답안 범위에서 제외한다.';
const addedCondition = 'sub1은 경영진이 감사에 필요한 정보를 제공하거나 확보할 능력이 있다는 일반적 적용 전제를 발문에 명시한다. 이 능력은 경영진의 책임 인정·이해와 서로 다르며 전제의 반복은 득점하지 않는다. crit3은 해당 정보 제공·확보 책임의 인정·이해를 확인하는 요구를 유지한다. 주어진 능력을 책임 인정으로 대신하거나 책임 확인이 불필요하다고 명시하는 답은 충족으로 보지 않는다. 능력 조건 자체를 새 필수 답안 명제나 점수로 추가하지 않는다.';
const requiredIndex = plan.scope.required_answers.findIndex(text => text.includes('pilot-03-001/sub1 '));
const newRequired = plan.scope.required_answers[requiredIndex].replace(beforePrompt, afterPrompt);
const newReason = '경영진이 정보를 제공·확보할 능력이 있다는 일반 적용 전제 아래, 수임 전제조건인 경영진 책임 인정과 불인정 시 수임 적합성·법규상 예외를 재현하는 기준서형이다. 수임 후 경영진에게 전달할 사항은 제외하고, 능력이라는 주어진 전제는 책임 인정·이해 확인과 구별하여 미득점으로 둔다.';
const nonpass = receipt.units.filter(unit => Object.values(unit.checks).some(check => check !== 'pass'));
const selectedTrace = raw.find(row => row.unit_id === 'subquestion:sub1');
const sourceEvidence = [
  { paragraph: 'KGA 210.6(b)', line_start: 325, line_end: 343, role: '경영진 책임 인정·이해에 대한 동의라는 요구사항; 세 상세 접근 경로를 새 점수로 확대하지 않는다.' },
  { paragraph: 'KGA 210.A11', line_start: 422, line_end: 432, role: '정보 제공·확보 능력 조건은 감사인의 합리적 기대에 결합되어 있고, 경영진 책임 인정·이해 전제와 구별된다.' },
  { paragraph: 'KGA 210.A14', line_start: 452, line_end: 456, role: '수임 부적합과 법규상 강제 예외, 강제 수임 이후의 중요성·보고서 시사점 전달은 시간과 행위가 다른 요구이다.' },
].map(row => ({ ...row, file: paths.source, quote: lines.slice(row.line_start - 1, row.line_end).join('\n'), quote_normalization: 'CRLF to LF only for displayed line excerpt; original registered file is unchanged.' }));
const proposal = {
  version: 1,
  prepared_at: new Date().toISOString(),
  set_id: set.id,
  subquestion_id: sub.id,
  status: 'local_proposal_for_root_followup_bank_only',
  mutation_scope: 'Only this evidence/proposal file is written. Original question, plan, source, classification, QA and receipt are unchanged.',
  additional_api_calls_for_proposal: 0,
  evidence,
  actual_execution: {
    started_at: worker.started_at,
    finished_at: worker.finished_at,
    semantic_verdict: receipt.verdict,
    model: receipt.execution.model,
    transport: receipt.execution.transport,
    observed_unit_responses: raw.length,
    distinct_units: new Set(raw.map(row => row.unit_id)).size,
    per_unit_attempts: raw.map(row => ({ unit_id: row.unit_id, attempt: row.attempt, input_hash: row.input_hash, schema_hash: row.schema_hash })),
    all_pass_units: receipt.units.length - nonpass.length,
    nonpass_units: nonpass,
    grading_status: receipt.grading.status,
    grading_runs: receipt.grading.runs.length,
    running_process: false,
    quota_error_observed: false,
    interpretation: 'Eight completed model responses, one content-uncertain subquestion unit; no transport/execution failure and no grading calls. The single uncertain observation is not a three-run reproducibility conclusion.',
  },
  investigation: {
    A11: '원 A11은 경영진 책임 인정·이해 전제와, 정보를 제공·확보할 능력이 있는 한 감사인이 정보입수에 합리적 기대를 가진다는 설명을 구별한다. 6(b)의 책임 동의 요구에는 능력 자체를 독립 채점할 요구가 없다. 원 답안은 책임 확인을 요구할 뿐 능력과 무관한 정보 확보 보장이나 책임 면제를 명시하지 않으므로 명백한 반대 답안으로 볼 근거는 없다. 다만 능력 조건이 학생 발문에 없다는 모호성은 이를 일반 적용 전제로 드러내어 해소하는 것이 가능하다.',
    A14: '현재 발문은 수임 적합성과 법규상 예외를 묻는다. 강제 수임이 된 뒤 경영진에게 설명하는 별도 조치는 plan.scope.exclusions에 이미 제외되어 있고 receipt.context.authoring_plan에도 실제 저장돼 있다. 현 criterion:sub1:crit4 검수도 그 범위로 pass였다. 별도 통지를 누락한 답안을 자동 미완성으로 취급하는 것은 현재 요구를 넓힌 판단이다. 발문에서 수임 후 전달사항 제외를 직접 밝히되, 강제수임이라는 답안의 예외 명칭을 미리 나열하지 않는 표현을 제안한다.',
    not_a_receipt_override: '원 uncertain·원시 요청/스키마 해시·생성 사례를 보존한다. 로컬 대조가 실제 pass나 사람 검수를 대체하지 않으며 root의 후속 은행 고정 후 별도 실제 검수가 필요하다.',
  },
  source_evidence: sourceEvidence,
  changes: [
    { artifact: 'question', file: paths.question, selector: { set_id: set.id, subquestion_id: sub.id }, field: 'prompt', before: beforePrompt, after: afterPrompt, reason: '이미 적용하는 능력 조건과 제외 범위를 학생이 읽는 발문에 명시. 책임 동의·수임 판단 및 점수는 동일.' },
    { artifact: 'plan', file: paths.plan, selector: { set_id: set.id }, field: 'scope.conditions', before: plan.scope.conditions, after: [...plan.scope.conditions, addedCondition], reason: '능력 전제 재진술을 득점하지 않으며 책임 인정·이해 확인과 구별함을 명시.' },
    { artifact: 'plan', file: paths.plan, selector: { set_id: set.id }, field: `scope.required_answers[${requiredIndex}]`, before: plan.scope.required_answers[requiredIndex], after: newRequired, reason: '실제 발문과 계획의 발문 인용을 동기화; 독립 요구 텍스트는 그대로 보존.' },
    { artifact: 'classification_review', file: paths.classification_review, selector: { set_id: set.id, subquestion_id: sub.id }, field: 'reason', before: review.reason, after: newReason, reason: '일반 적용 전제이므로 사례 사실 해석을 새로 요구하지 않음.' },
    { artifact: 'classification_review', file: paths.classification_review, selector: { set_id: set.id, subquestion_id: sub.id }, field: 'standalone_prompt', before: review.standalone_prompt, after: afterPrompt, reason: '독립 풀이 발문을 새 원발문과 정확히 동기화한다.' },
  ],
  unchanged_contract: {
    criteria: sub.criteria,
    model_answer: sub.model_answer,
    max_points: sub.criteria.reduce((n, item) => n + item.max_points, 0),
    subquestion_count: set.subquestions.length,
    question_style: review.question_style,
    topic_ids: review.topic_ids,
    case_fact_ids: review.case_fact_ids,
    shared_context: set.shared_context,
    source_refs: set.source_refs.map(row => ({ id: row.id, file: row.file, content_hash: row.content_hash })),
  },
  classification_downstream: {
    review_standalone_prompt_before: review.standalone_prompt,
    review_standalone_prompt_after: afterPrompt,
    explanation: '기준서형과 topic03을 유지한다. review의 독립 발문은 수정 원발문과 정확히 같은 문자열로 명시하고, 생성 catalog/DB metadata는 새 은행에서 재생성한다.',
    generated_standalone_prompt_before: materialized.standalone_prompt,
    generated_standalone_prompt_after: afterPrompt,
    regenerate_source_hash_classification_version_and_learning_catalog: true,
    do_not_edit_generated_metadata_by_hand: true,
  },
  qa_impact: {
    author_qa_file: paths.author_qa,
    existing_cases: qa.cases.length,
    existing_case_subquestion_ids: [...new Set(qa.cases.map(item => item.subquestion_id))],
    existing_ids_answers_expectations: 'unchanged; no expected verdict is retuned to this model result',
    semantic_generated_cases: receipt.cases.length,
    semantic_generated_by_subquestion: Object.fromEntries(set.subquestions.map(question => [question.id, receipt.cases.filter(item => item.unit_id.startsWith(`criterion:${question.id}:`) || item.unit_id === `subquestion:${question.id}`).length])),
    generated_grading: 'not_run; preserve original cases even if followup review generates another set',
    required_followup_boundaries: [
      '책임 인정·이해 확인을 적은 원 모범답안은 능력 전제를 반복하지 않아도 같은 만점 기대를 유지한다.',
      '능력이 있다는 사실만 반복하고 책임 인정·이해의 확인을 쓰지 않은 답을 crit3 충족으로 만들지 않는다.',
      '법규상 예외를 가진 수임 부적합 판단은 후속 경영진 통지를 적지 않아도 crit4 충족이며, 통지를 적은 것만으로 수임 판단 누락을 채우지 않는다.',
      '책임을 인정하지 않아도 법규상 강제가 아닌 업무를 자유롭게 수임할 수 있다는 명시 반대는 crit4 불충족을 유지한다.',
    ],
    limitation: '현재 author QA15개는 sub2의 13개와 sub1의 current/sub1/stored-model(4점), current/sub1/blank(0점) 2개다. 기존 답안·기대값을 전부 보존한다. sub1에는 다섯 가지 추가 경계를 별도 제안하며, 이번 semantic에서 생성된 sub1 20사례와 함께 실제 채점은 아직 미실행이다.',
  },
  selected_uncertain_observation: { unit_id: selectedTrace.unit_id, input_hash: selectedTrace.input_hash, schema_hash: selectedTrace.schema_hash, response: selectedTrace.response },
  guards: {
    source_refs_exact_in_registered_file: set.source_refs.filter(row => row.file === paths.source).every(row => source.includes(row.source_quote)),
    plan_received_same_exclusion: JSON.stringify(receipt.context.authoring_plan.scope.exclusions) === JSON.stringify(plan.scope.exclusions),
    scope_only_required_answer_change: newRequired.replace(afterPrompt, beforePrompt) === plan.scope.required_answers[requiredIndex],
    all_original_bytes_preserved: evidence.every(row => sha(fs.readFileSync(row.file)) === row.sha256),
  },
};
proposal.predecessor_file = D + '/c/resume-review-2026-09-12/pilot-03-001-scope-proposal.json';
proposal.predecessor_note = '첫 로컬안 보존. 후속 v2는 단독 발문을 명시적으로 동기화하고, 실제 semantic case.unit_id에 따라 생성 사례를 집계하여 sub1=20/sub2=10으로 바로잡는다. 최초 설명의 author QA15개가 sub2에만 있다는 오류도 바로잡는다: 실제 sub2=13, sub1=2(모범·빈답)이다. 원시 모델 응답과 기대값은 변경하지 않는다.';
fs.writeFileSync(path.join(dir, 'pilot-03-001-scope-proposal-v2.json'), JSON.stringify(proposal, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ file: 'pilot-03-001-scope-proposal-v2.json', sha256: sha(fs.readFileSync(path.join(dir, 'pilot-03-001-scope-proposal-v2.json'))), guards: proposal.guards, cases: proposal.qa_impact.semantic_generated_by_subquestion, changes: proposal.changes.length }, null, 2));
