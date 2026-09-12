import fs from 'node:fs';
import path from 'node:path';
import { applyQuestionSetJudgment, gradeQuestionSetV3, gradingModelName } from 'file:///C:/Users/cntrl/Workspace/study/audit_say/lib/questionV3Grading.ts';
import { jsonHash, sha256 } from 'file:///C:/Users/cntrl/Workspace/study/audit_say/cpa_uploader/questionReviewIdentity.ts';
export function notRunReviewGrading() {
    return { status: 'not_run', transport: 'none', model: null, performed_at: null, description: '실제 gradeQuestionSetV3 검토 사례 실행 전. 의미 대조만으로 채점 실행을 주장하지 않음.', cases_hash: null, grader_hash: null, runs: [] };
}
function graderHash() {
    const root = "C:\\Users\\cntrl\\Workspace\\study\\audit_say";
    return sha256(['lib/questionV3Grading.ts', 'lib/questionV3Evidence.ts', 'lib/questionV3.ts', 'lib/questionV3Answer.ts', 'lib/ai/openaiStructured.ts'].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n'));
}
const loadedGraderHash = graderHash();
/** Identical answers are run once; each covered criterion still has an assertion.
 * The empty-answer scenario exercises the real grader's no-model branch. */
function casePlan(set, cases) {
    const plans = new Map();
    for (const sample of cases) {
        const target = set.subquestions.flatMap((sub) => sub.criteria.map((criterion) => ({ unit_id: `criterion:${sub.id}:${criterion.id}`, sub, criterion }))).find((item) => item.unit_id === sample.unit_id);
        if (!target)
            throw new Error(`채점 사례 criterion이 없습니다: ${sample.unit_id}`);
        const answers = Object.fromEntries(set.subquestions.map((sub) => [sub.id, sub.id === target.sub.id ? sample.answer : '']));
        const id = jsonHash(answers);
        const plan = plans.get(id) || { id, answers, expected: [] };
        plan.expected.push({ unit_id: sample.unit_id, case_kind: sample.kind, subquestion_id: target.sub.id, criterion_id: target.criterion.id, verdict: sample.expected });
        plans.set(id, plan);
    }
    const blank = Object.fromEntries(set.subquestions.map((sub) => [sub.id, '']));
    plans.set('empty-answer', { id: 'empty-answer', answers: blank, expected: set.subquestions.flatMap((sub) => sub.criteria.map((criterion) => ({
            unit_id: `criterion:${sub.id}:${criterion.id}`, case_kind: 'empty_answer', subquestion_id: sub.id, criterion_id: criterion.id, verdict: 'not_met',
        }))) });
    return [...plans.values()];
}
// A condition-boundary answer keeps only part of a claim, and whether that reads as a missing
// or an explicitly narrowed claim varies between identical grading runs. Both score zero, so
// such a case matches either way; an opposite case must still be judged contradicted.
const zeroVerdicts = new Set(['not_met', 'contradicted']);
function verdictMatches(expected, actual) {
    if (actual === expected.verdict)
        return true;
    return expected.case_kind === 'condition_boundary' && zeroVerdicts.has(expected.verdict) && actual !== undefined && zeroVerdicts.has(actual);
}
function matches(plan, result, judgment) {
    const securityDetected = judgment?.injection_detected || judgment?.salad_detected
        || judgment?.subquestions.some((sub) => sub.injection_detected || sub.salad_detected);
    return !securityDetected && result.security_flag === 'none' && (plan.id !== 'empty-answer' || result.score === 0)
        && plan.expected.every((expected) => verdictMatches(expected, result.subquestions.find((sub) => sub.subquestion_id === expected.subquestion_id)?.criteria.find((criterion) => criterion.criterion_id === expected.criterion_id)?.verdict));
}
export async function executeReviewGrading(set, cases, options = {}) {
    const startHash = graderHash();
    const startModel = gradingModelName();
    if (startHash !== loadedGraderHash)
        throw new Error('로드된 채점 코드와 현재 파일이 다릅니다. 새 프로세스에서 다시 실행하십시오.');
    const plans = casePlan(set, cases);
    const runs = [];
    for (const plan of plans) {
        let judgment = null;
        const trace = [];
        let result;
        const identity = { ...plan, transport: options.createResponse ? 'injected_response' : 'model',
            model: startModel, performed_at: new Date().toISOString(), grader_hash: startHash };
        try {
            result = await gradeQuestionSetV3(set, plan.answers, options.apiKey || process.env.OPENAI_API_KEY || '', (value) => { judgment = value; }, options.createResponse, event => trace.push(event));
        }
        catch (error) {
            options.onRun?.(structuredClone({ ...identity, status: 'failed', judgment, trace, error: String(error) }));
            throw error;
        }
        const run = { ...plan, judgment, result, matched: matches(plan, result, judgment) };
        runs.push(run);
        options.onRun?.(structuredClone({ ...identity, ...run, status: 'completed', trace }));
    }
    if (graderHash() !== startHash)
        throw new Error('실제 채점 사례 실행 중 채점 코드가 변경되었습니다. 다시 실행하십시오.');
    if (gradingModelName() !== startModel)
        throw new Error('실제 채점 사례 실행 중 채점 모델 설정이 변경되었습니다. 다시 실행하십시오.');
    return { status: 'completed', transport: options.createResponse ? 'injected_response' : 'model', model: startModel, performed_at: new Date().toISOString(),
        description: options.createResponse ? '주입 응답으로 실제 gradeQuestionSetV3를 실행함. 외부 모델의 의미 정확성을 검증한 결과가 아님.' : '설정된 채점 모델과 실제 gradeQuestionSetV3를 실행하고 코드 인용검증·점수 결과를 기대 판정과 대조함.',
        cases_hash: jsonHash(cases), grader_hash: startHash, runs };
}
export function reviewGradingIntegrityErrors(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return ['실제 채점 실행 기록이 필요합니다.'];
    const run = value;
    if (Object.keys(run).some((key) => !['status', 'transport', 'model', 'performed_at', 'description', 'cases_hash', 'grader_hash', 'runs'].includes(key))
        || run.status !== 'completed' || !['model', 'injected_response'].includes(run.transport) || typeof run.model !== 'string' || !run.model.trim()
        || typeof run.description !== 'string' || !run.description.trim() || typeof run.performed_at !== 'string' || !Number.isFinite(Date.parse(run.performed_at))
        || typeof run.cases_hash !== 'string' || !/^[a-f\d]{64}$/.test(run.cases_hash) || typeof run.grader_hash !== 'string' || !/^[a-f\d]{64}$/.test(run.grader_hash)
        || !Array.isArray(run.runs) || !run.runs.length)
        return ['실제 채점 사례 실행이 완료되지 않았거나 기록 형식이 잘못되었습니다. --grade-cases로 실행하십시오.'];
    return [];
}
function validateJudgment(set, raw) {
    const boolFlags = (value) => (value.injection_detected === undefined || typeof value.injection_detected === 'boolean') && (value.salad_detected === undefined || typeof value.salad_detected === 'boolean');
    if (!raw || typeof raw !== 'object' || Object.keys(raw).some((key) => !['subquestions', 'injection_detected', 'salad_detected'].includes(key)) || !boolFlags(raw)
        || !Array.isArray(raw.subquestions) || raw.subquestions.length !== set.subquestions.length)
        return false;
    const subs = new Set();
    for (const sub of raw.subquestions) {
        if (!sub || typeof sub !== 'object' || Object.keys(sub).some((key) => !['subquestion_id', 'verdicts', 'injection_detected', 'salad_detected'].includes(key)) || !boolFlags(sub))
            return false;
        const expected = set.subquestions.find((item) => item.id === sub.subquestion_id);
        if (!expected || subs.has(sub.subquestion_id) || !Array.isArray(sub.verdicts) || sub.verdicts.length !== expected.criteria.length)
            return false;
        subs.add(sub.subquestion_id);
        const criteria = new Set();
        for (const verdict of sub.verdicts) {
            if (!verdict || typeof verdict !== 'object' || Object.keys(verdict).some((key) => !['criterion_id', 'verdict', 'quote', 'reason'].includes(key))
                || !expected.criteria.some((criterion) => criterion.id === verdict.criterion_id) || criteria.has(verdict.criterion_id)
                || !['met', 'partial', 'not_met', 'contradicted'].includes(verdict.verdict)
                || verdict.quote !== undefined && typeof verdict.quote !== 'string' || verdict.reason !== undefined && typeof verdict.reason !== 'string')
                return false;
            criteria.add(verdict.criterion_id);
        }
    }
    return true;
}
export function auditReviewGrading(raw, set, cases, requireCurrentModel = true) {
    const errors = reviewGradingIntegrityErrors(raw);
    const strict_mismatches = [];
    if (errors.length)
        return { integrity_errors: errors, strict_mismatches };
    const execution = raw;
    if (requireCurrentModel && execution.transport !== 'model')
        errors.push('신규 검수 수락에는 실제 모델 채점이 필요합니다. 주입 응답은 검증용 기록이며 승급 근거로 사용할 수 없습니다.');
    if (requireCurrentModel && execution.model !== gradingModelName())
        errors.push('현재 채점 모델 설정과 실제 채점 사례 실행 모델이 다릅니다. 현재 모델로 사례를 다시 실행하십시오.');
    // Historical receipts retain their original engine identity; accepting a new
    // review still requires the current engine and model. Replay checks remain mandatory.
    if (execution.cases_hash !== jsonHash(cases) || requireCurrentModel && execution.grader_hash !== graderHash())
        errors.push('검토 사례 또는 실제 채점 코드 해시가 변경되었습니다. 채점 사례를 다시 실행하십시오.');
    const plans = casePlan(set, cases);
    const seen = new Set();
    for (const run of execution.runs) {
        const plan = plans.find((candidate) => candidate.id === run?.id);
        if (!plan || seen.has(run.id) || Object.keys(run).some((key) => !['id', 'answers', 'expected', 'judgment', 'result', 'matched'].includes(key))) {
            errors.push('실제 채점 사례가 미등록 또는 중복입니다.');
            continue;
        }
        seen.add(run.id);
        if (jsonHash(run.answers) !== jsonHash(plan.answers) || jsonHash(run.expected) !== jsonHash(plan.expected)) {
            errors.push(`${run.id}: 실제 채점 답안 또는 기대 판정이 다릅니다.`);
            continue;
        }
        if (run.id === 'empty-answer' ? run.judgment !== null : !validateJudgment(set, run.judgment)) {
            errors.push(`${run.id}: 실제 채점 raw judgment 형식·완전성이 잘못되었습니다.`);
            continue;
        }
        const judgment = run.judgment || { subquestions: set.subquestions.map((sub) => ({ subquestion_id: sub.id, verdicts: sub.criteria.map((criterion) => ({ criterion_id: criterion.id, verdict: 'not_met' })) })) };
        const replayed = applyQuestionSetJudgment(set, plan.answers, judgment);
        if (jsonHash(run.result) !== jsonHash(replayed))
            errors.push(`${run.id}: 기록한 점수·인용 결과가 실제 채점 코드 재현과 다릅니다.`);
        const computedMatched = matches(plan, replayed, run.judgment);
        if (run.matched !== computedMatched)
            errors.push(`${run.id}: 기록된 matched 값이 실제 strict 판정과 다릅니다.`);
        if (run.judgment?.injection_detected || run.judgment?.salad_detected
            || run.judgment?.subquestions.some(sub => sub.injection_detected || sub.salad_detected)
            || replayed.security_flag !== 'none')
            errors.push(`${run.id}: 원시 또는 최종 보안 판정 실패는 점수 편차로 수락할 수 없습니다.`);
        if (run.id === 'empty-answer' && replayed.score !== 0)
            errors.push('빈 답안은 정확히 0점이어야 합니다.');
        if (!computedMatched)
            strict_mismatches.push({ run_id: run.id, message: `${run.id}: 실제 채점 결과가 검토 사례의 기대 판정과 다릅니다.` });
    }
    if (seen.size !== plans.length)
        errors.push('실제 채점 사례 또는 빈답안 실행 기록이 누락되었습니다.');
    return { integrity_errors: errors, strict_mismatches };
}
/** No optional acceptance changes this default strict API. */
export function validateReviewGrading(raw, set, cases, requireCurrentModel = true) {
    const audit = auditReviewGrading(raw, set, cases, requireCurrentModel);
    return [...audit.integrity_errors, ...audit.strict_mismatches.map(item => item.message)];
}
