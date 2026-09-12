import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const control = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const work = `${control}/question-style-v1`;
const output = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/s02/structure-v2/t08-c';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const manifestFile = `${control}/final-153-point-policy-v1/manifest.json`;
const manifest = read(manifestFile);
const entry = manifest.entries.find(item => item.plan_id === 'T08-C');
for (const item of [{ file: entry.file, sha256: entry.sha256 }, ...entry.plan_files,
    { file: entry.qa_file, sha256: entry.qa_sha256 }, ...entry.source_files]) assert.equal(hash(item.file), item.sha256);
assert(!fs.existsSync(output), 'Do not overwrite a previous follow-up');
fs.mkdirSync(output, { recursive: true });
const original = read(entry.file)[0];
const set = structuredClone(original);
const oldSub = original.subquestions.find(sub => sub.id === 'sub2');
const movedIds = new Set(oldSub.criteria.slice(8).map(criterion => criterion.id));
const retained = structuredClone(oldSub);
retained.prompt = '경영진측 전문가의 업무를 관련 경영진주장에 대한 감사증거로 사용하려고 한다. 감사기준서 500에 따라 다음 두 영역에서 수행할 사항을 설명하시오. ① 수행업무의 성격·범위·목적 및 관련 전문영역의 이해, ② 발견사항·결론의 적합성 평가.';
retained.criteria = retained.criteria.filter(criterion => !movedIds.has(criterion.id));
retained.model_answer = oldSub.model_answer.slice(0, 8);
retained.requirements = retained.requirements.filter(requirement => retained.criteria.some(criterion => criterion.requirement_id === requirement.id));
const added = structuredClone(oldSub);
added.id = 'sub4';
added.prompt = '경영진측 전문가의 업무에는 유의적 가정과 평가방법, 유의적인 회사 원천데이터 및 외부 시장자료가 사용되었다. 감사기준서 500에 따라 전문가 업무의 적합성을 평가할 때 다음 각 대상에 관하여 검토할 사항을 설명하시오. ① 유의적 가정, ② 평가방법, ③ 회사 원천데이터, ④ 외부 시장자료.';
added.criteria = added.criteria.filter(criterion => movedIds.has(criterion.id));
added.model_answer = oldSub.model_answer.slice(8);
added.requirements = added.requirements.filter(requirement => added.criteria.some(criterion => criterion.requirement_id === requirement.id));
set.subquestions = [set.subquestions[0], retained, added, set.subquestions[2]];
set.learning_order = set.subquestions.map(sub => sub.id);
set.verification.notes.push('2026-09-11 사용자 요청: 기존 sub2의 가정·방법·사용자료 9개 criterion을 새 sub4로 분리했다. 표시 순서는 sub1/sub2/sub4/sub3이며 기존 ID·criterion·정답 명제·공식 인용·총점 22점은 보존한다. 기준서형 학습 분류는 외부 색인에서 관리하고 실제 모델 검증은 새 입력으로 수행해야 한다.');
const questionFile = `${output}/pilot-08-008.json`;
write(questionFile, [set]);
const plan = read(entry.plan_files[0].file);
plan.scope.required_answers = set.subquestions.flatMap(sub => sub.criteria.map(criterion => `${sub.id}/${criterion.id}: ${criterion.claim}`));
plan.existing_question_difference += ' [물음 분할 후속] 기존 sub2의 업무 이해·결론 평가 8점은 sub2에 남기고 가정·방법·자료 검토 9점은 새 sub4로 이동한다. 표시 물음 3은 sub4, 기존 불일치 대응 sub3은 표시 물음 4다. 두 기준서형 물음의 발문에 적용 대상을 직접 명시하고 해설 지식이나 신규 득점요건을 추가하지 않는다.';
const planFile = `${output}/pilot-08-008.authoring-plan.json`;
write(planFile, plan);
const oldQa = read(entry.qa_file);
const qa = { ...oldQa, draft_sha256: hash(questionFile), live_model_grading: 'not_run', human_approval: false,
    predecessor: { file: entry.qa_file, sha256: entry.qa_sha256 }, cases: [] };
const caseLineage = [];
for (const sample of oldQa.cases) {
    if (sample.subquestion_id !== 'sub2') { qa.cases.push(structuredClone(sample)); continue; }
    for (const sub of [retained, added]) {
        const ids = new Set(sub.criteria.map(criterion => criterion.id));
        const next = { ...structuredClone(sample), id: `${sample.id}--${sub.id}`, subquestion_id: sub.id,
            expected_verdicts: sample.expected_verdicts.filter(verdict => ids.has(verdict.criterion_id)),
            predecessor_case_id: sample.id };
        if (next.target_criterion_id && !ids.has(next.target_criterion_id)) delete next.target_criterion_id;
        next.expected_points = next.expected_verdicts.reduce((sum, verdict) => sum + sub.criteria.find(c => c.id === verdict.criterion_id).scores[verdict.verdict], 0);
        next.note = (next.note || '') + ' [구조 분할] 원답안 전체를 보존하고 이 물음으로 배정된 동일 명제의 기존 기대판정만 연결한다. 다른 물음의 정답 내용에는 점수를 주지 않는다. 실제 모델 판정이 아니다.';
        qa.cases.push(next);
        caseLineage.push({ old_case_id: sample.id, new_case_id: next.id, from: 'sub2', to: sub.id, answer_unchanged: next.answer === sample.answer });
    }
}
for (const sub of [retained, added]) {
    for (const [kind, answer] of [['model_answer', sub.model_answer.join('\n')], ['empty_answer', ''], ['reverse_order', [...sub.model_answer].reverse().join('\n')], ['single_sentence', sub.model_answer.join(' ')]]) {
        qa.cases.push({ id: `${sub.id}-split-${kind}`, subquestion_id: sub.id, kind, answer,
            expected_points: answer ? sub.criteria.length : 0,
            expected_verdicts: sub.criteria.map(criterion => ({ criterion_id: criterion.id, verdict: answer ? 'met' : 'not_met', reason: answer ? '분할된 물음의 모든 정답 명제가 포함된다.' : '빈 답안이다.' })),
            note: '새 물음별 모범답안·빈 답안·역순·한 문장 기대값. API 미실행.' });
    }
}
const qaFile = `${output}/qa-cases-t08-c.json`;
write(qaFile, qa);
const flat = value => value.subquestions.flatMap(sub => sub.criteria).sort((a, b) => a.id.localeCompare(b.id));
assert.deepEqual(flat(set), flat(original));
assert.deepEqual(set.source_refs, original.source_refs);
assert.deepEqual(set.shared_context, original.shared_context);
assert.deepEqual(set.subquestions[0], original.subquestions[0]);
assert.deepEqual(set.subquestions[3], original.subquestions[2]);
write(`${output}/lineage.json`, {
    predecessor_manifest: { file: manifestFile, sha256: hash(manifestFile) },
    predecessor: { file: entry.file, sha256: entry.sha256, plan_files: entry.plan_files, qa_file: entry.qa_file, qa_sha256: entry.qa_sha256 },
    current: { question_file: questionFile, sha256: hash(questionFile), plan_file: planFile, plan_sha256: hash(planFile), qa_file: qaFile, qa_sha256: hash(qaFile) },
    approved_change: 'T08-C 물음2를 업무 이해·결론 평가와 가정·방법·사용자료 검토로 분할; 학습 탐색에 기준서형/사례형 구분',
    display_order: set.subquestions.map((sub, i) => ({ display_number: i + 1, id: sub.id, points: sub.criteria.reduce((sum, c) => sum + c.max_points, 0) })),
    criterion_mapping: oldSub.criteria.map(criterion => ({ criterion_id: criterion.id, from: 'sub2', to: movedIds.has(criterion.id) ? 'sub4' : 'sub2', content_unchanged: true })),
    source_model_answers_preserved: true, old_qa_cases: oldQa.cases.length, current_qa_cases: qa.cases.length, case_lineage: caseLineage,
    api_calls: 0, model_semantic_review: 'not_run', model_grading: 'not_run', human_approval: false,
});
write(`${work}/t08-c.json`, { reviewer: 'root', entries: set.subquestions.map(sub => ({ set_id: set.id, subquestion_id: sub.id,
    style: sub.id === 'sub1' ? 'case' : 'standard', mixed: sub.id === 'sub1',
    case_fact_ids: sub.id === 'sub1' ? ['fact2', 'fact3'] : [],
    reason: sub.id === 'sub1' ? '전문가 자격·실제 수행능력과 보수약정의 구체 사실을 적격성·역량·객관성 평가에 연결해야 한다.'
        : sub.id === 'sub2' ? '업무 이해와 발견·결론 평가의 일반 검토사항을 설명하면 충족하며 구체 자료의 결론을 판단하지 않는다.'
        : sub.id === 'sub4' ? '적용 대상과 유의성 조건을 발문에 지정했고 각 대상에 대한 기준서상 검토요소를 설명하면 충족한다.'
        : '불일치·신뢰성 의문이라는 발동조건이 주어졌고 기준서 500.11의 두 일반 대응을 설명하면 충족한다.' })) });
console.log(JSON.stringify({ questionFile, points: [3, 8, 9, 2], qa_cases: qa.cases.length, api_calls: 0 }));
