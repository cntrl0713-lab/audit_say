import { resolveAnswerEvidence } from "file:///C:/Users/cntrl/Workspace/study/audit_say/lib/questionV3Evidence.ts";
function record(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('채점 응답 객체 형식 오류');
    return value;
}
function groundJudgment(value, set, answers) {
    const root = record(value);
    if (!Array.isArray(root.subquestions))
        throw new Error('채점 응답에 subquestions 배열이 없습니다.');
    const subquestions = root.subquestions.map((raw) => {
        const sub = record(raw);
        if (typeof sub.subquestion_id !== 'string' || !Array.isArray(sub.verdicts)
            || typeof sub.injection_detected !== 'boolean' || typeof sub.salad_detected !== 'boolean'
            || !Array.isArray(sub.injection_evidence_ids))
            throw new Error('물음 판정/보안 필드 형식 오류');
        const id = sub.subquestion_id;
        const answer = answers[id] ?? '';
        if (sub.injection_detected)
            resolveAnswerEvidence(id, answer, sub.injection_evidence_ids);
        else if (sub.injection_evidence_ids.length)
            throw new Error('보안 판정과 근거가 불일치합니다.');
        const verdicts = sub.verdicts.map((raw) => {
            const v = record(raw);
            if (typeof v.criterion_id !== 'string' || !['met', 'partial', 'not_met', 'contradicted'].includes(String(v.verdict))
                || !Array.isArray(v.evidence_ids) || !(v.reason === null || typeof v.reason === 'string'))
                throw new Error('criterion 판정 형식 오류');
            const criterion = set.subquestions.find(q => q.id === id)?.criteria.find(c => c.id === v.criterion_id);
            if (v.verdict === 'partial' && criterion?.scores.partial === undefined)
                throw new Error('부분점수를 허용하지 않는 criterion입니다.');
            if (v.verdict === 'not_met' && v.evidence_ids.length)
                throw new Error('not_met에는 인용을 지정하지 않습니다.');
            return { criterion_id: v.criterion_id, verdict: v.verdict,
                ...(v.verdict === 'not_met' ? {} : { quote: resolveAnswerEvidence(id, answer, v.evidence_ids) }),
                ...(typeof v.reason === 'string' ? { reason: v.reason } : {}) };
        });
        return { subquestion_id: id, verdicts, injection_detected: sub.injection_detected, salad_detected: sub.salad_detected };
    });
    const result = { subquestions, injection_detected: false, salad_detected: subquestions.some(q => q.salad_detected) };
    validateJudgmentCoverage(set, result);
    return result;
}
function validateJudgmentCoverage(questionSet, judgment) {
    const expectedSubquestionIds = new Set(questionSet.subquestions.map((subquestion) => subquestion.id));
    const actualSubquestionIds = new Set();
    for (const subquestion of judgment.subquestions) {
        if (!expectedSubquestionIds.has(subquestion.subquestion_id)) {
            throw new Error(`채점 응답에 알 수 없는 subquestion id가 있습니다: ${subquestion.subquestion_id}`);
        }
        if (actualSubquestionIds.has(subquestion.subquestion_id)) {
            throw new Error(`채점 응답에 subquestion이 중복되었습니다: ${subquestion.subquestion_id}`);
        }
        actualSubquestionIds.add(subquestion.subquestion_id);
        const expectedCriterionIds = new Set(questionSet.subquestions.find((candidate) => candidate.id === subquestion.subquestion_id).criteria.map((criterion) => criterion.id));
        const actualCriterionIds = new Set();
        for (const verdict of subquestion.verdicts) {
            if (!expectedCriterionIds.has(verdict.criterion_id)) {
                throw new Error(`채점 응답에 알 수 없는 criterion id가 있습니다: ${verdict.criterion_id}`);
            }
            if (actualCriterionIds.has(verdict.criterion_id)) {
                throw new Error(`채점 응답에 criterion이 중복되었습니다: ${verdict.criterion_id}`);
            }
            actualCriterionIds.add(verdict.criterion_id);
        }
        if (actualCriterionIds.size !== expectedCriterionIds.size) {
            throw new Error(`채점 응답의 criterion 수가 맞지 않습니다: ${subquestion.subquestion_id}`);
        }
    }
    if (actualSubquestionIds.size !== expectedSubquestionIds.size) {
        throw new Error('채점 응답의 subquestion 수가 맞지 않습니다.');
    }
}
export { groundJudgment };
