// r01 v3 설계 장부·계보·대표 답안 기록(한 번만 실행; 기존 파일이 있으면 쓰지 않는다).
// v2 대표 답안 원문은 그대로 재사용하고 v3 기준으로 기대 판정만 새로 정한다(실제 채점 전).
//   npx tsx cpa_uploader/drafts/case-review-2026-09-15/r01-group-audit-merge/v3/record-docs.mts
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { reviewedContentHash } from '../../../../questionReviewIdentity.ts';
import { validateAuthoringBank } from '../../../../questionBankPublication.ts';

const P = 'cpa_uploader/drafts/case-review-2026-09-15/r01-group-audit-merge';
const D = `${P}/v3`;
const BANK = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const sha = (p: string) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const [draft] = read(`${D}/sets.json`);
const write = (name: string, value: unknown) => fs.writeFileSync(`${D}/${name}`, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const v = (criterion_id: string, verdict: string, reason: string) => ({ criterion_id, verdict, reason });

const bank = read(BANK);
const retired = ['case-14-component-evidence-gap-20260914', 'pilot-14-006', 'pilot-14-007'];
for (const candidate of [[...bank, draft], [...bank.filter((s: { id: string }) => !retired.includes(s.id)), draft]]) {
    assert.deepEqual(validateAuthoringBank(candidate).errors, []);
}

const v2Design = read(`${P}/v2/design.json`);
const v2Lineage = read(`${P}/v2/lineage.json`);
const v2Qa = read(`${P}/v2/qa.json`);
const answer = (id: string) => { const row = v2Qa.cases.find((c: { id: string }) => c.id === id); assert(row, id); return row.answer as string; };

write('design.json', {
    ...v2Design, version: 3, draft: `${D}/sets.json`, supersedes: { file: `${P}/v2/design.json`, sha256: sha(`${P}/v2/design.json`) },
    change_request: '2026-09-15 사용자: r01도 새 기준(옳지 않은 항목마다 이유나 보완절차 한 가지를 간략히, 구체적 후속절차 요구 없음)으로 맞출 것.',
    questions: [
        { ...v2Design.questions[0],
            criteria: [
                { id: 'sub1.c1', points: 1, meaning: '식별: 옳지 않은 ①·④를 모두 고르고 함정 ②·③은 고르지 않음', sources: ['문단 20', 'A39', 'A40', '27', '29'] },
                { id: 'sub1.c2', points: 1, meaning: '①: 독립성 결격은 관여로 극복 불가(이유) 또는 그룹감사인이 직접 증거 입수(절차) 중 하나', sources: ['A39', '20'] },
                { id: 'sub1.c3', points: 1, meaning: '④: 증거 부족 예상 상황이라 추가 업무 생략 불가(이유) 또는 일부 부문 선정·추가 업무(절차) 중 하나', sources: ['29'] }],
            minimum_sufficient_answer: '①·④를 고르고 각각 한 문장씩 이유나 보완절차를 쓴다.',
            point_decision: '3점. v2의 ①·④ 각 2점(이유·올바른 절차)을 사용자 확정 기준에 따라 항목당 1점(이유 또는 보완절차 중 하나)으로 줄이고 식별 1점을 유지한다.' },
        { ...v2Design.questions[1],
            criteria: [
                { id: 'sub2.c1', points: 1, meaning: '식별: 옳지 않은 ⑦·⑧을 모두 고르고 함정 ⑤·⑥·⑨는 고르지 않음', sources: ['43', 'A62', '41(e)', '11', 'A9', '45', 'A43'] },
                { id: 'sub2.c2', points: 1, meaning: '⑦: 부문 수준 판단은 그룹 평가를 대신 못함(이유) 또는 같은 방향 과대계상 합산 평가(절차) 중 하나', sources: ['A43', 'A44', 'A8', '45', 'A63'] },
                { id: 'sub2.c3', points: 1, meaning: '⑧: 증거 미입수는 미수정왜곡표시가 아님(이유) 또는 구별해 영향 평가(절차) 중 하나', sources: ['45'] }],
            minimum_sufficient_answer: '⑦·⑧을 고르고 각각 한 문장씩 이유나 보완절차를 쓴다.',
            point_decision: '3점. v2의 ⑦ 2점(이유·절차)을 1점으로 줄이고 ⑧ 1점과 식별 1점을 유지한다.' }],
    target_reviewed_content_sha256: reviewedContentHash(draft),
});

write('lineage.json', {
    ...v2Lineage, version: 3, supersedes: { file: `${P}/v2/lineage.json`, sha256: sha(`${P}/v2/lineage.json`) },
    target: { set_id: draft.id, draft: `${D}/sets.json`, reviewed_content_sha256: reviewedContentHash(draft), points: 6 },
    v2_to_v3: [
        { v2: '발문 “각 절차가 옳지 않은 이유와 … 올바른 절차를 설명하시오”', v3: '“각각에 대하여 옳지 않은 이유나 … 수행하였어야 할 절차를 간략히 서술하시오”', reason: '사용자 확정 기준: 이유나 보완절차 한 가지, 구체적 후속절차 요구 없음.' },
        { v2: 'sub1.c2(① 이유)·sub1.c3(① 올바른 절차)', v3: 'sub1.c2(① 이유 또는 절차)', reason: '항목당 1점으로 통합.' },
        { v2: 'sub1.c4(④ 이유)·sub1.c5(④ 올바른 절차)', v3: 'sub1.c3(④ 이유 또는 절차)', reason: '항목당 1점으로 통합.' },
        { v2: 'sub2.c2(⑦ 이유)·sub2.c3(⑦ 올바른 절차)', v3: 'sub2.c2(⑦ 이유 또는 절차)', reason: '항목당 1점으로 통합.' },
        { v2: 'sub2.c4(⑧ 이유·절차 1점)', v3: 'sub2.c3(⑧ 이유 또는 절차)', reason: 'ID만 바꾸고 기준은 그대로.' },
        { v2: 'sub1.c1·sub2.c1(식별)', v3: '같음', reason: '유지.' },
        { v2: '사실관계·출처·모범답안의 식별 문장', v3: '같음', reason: '사실관계와 출처는 바이트까지 같다.' },
    ],
});

write('qa.json', {
    version: 3, set_id: draft.id, draft: `${D}/sets.json`, method: 'author_expected_verdicts_before_model_grading', human_review_performed: false,
    note: 'v2 대표 답안 원문을 그대로 쓰고 v3 기준으로 기대 판정을 실제 채점 전에 다시 정했다. contradicted와 not_met은 모두 0점이다. v2 기대값·실측은 v2 폴더와 execution-v2에 보존한다.',
    cases: [
        { id: 'r01v3-sub1-partial', set_id: draft.id, subquestion_id: 'sub1', kind: 'partial', answer: answer('r01v2-sub1-partial'),
            expected_verdicts: [v('sub1.c1', 'contradicted', '옳은 ③을 옳지 않다고 골랐다.'), v('sub1.c2', 'met', '독립성 결격은 관여로 극복할 수 없어 요청할 수 없다는 이유와 직접 입수 절차를 적었다.'),
                v('sub1.c3', 'met', '증거 부족 예상 상황이므로 유의적이지 않다는 이유만으로 추가 업무를 생략할 수 없다는 이유를 적었다.')],
            expected_points: 2, reason: 'v2 부분정답 원문. 함정 ③ 선택으로 식별 점수만 잃고 ①·④는 이유나 절차 한 가지로 각 1점을 받는지 확인한다.' },
        { id: 'r01v3-sub1-wrong', set_id: draft.id, subquestion_id: 'sub1', kind: 'wrong', answer: answer('r01v2-sub1-wrong'),
            expected_verdicts: [v('sub1.c1', 'contradicted', '옳은 ②·③만 고르고 ①·④가 적절하다고 명시했다.'), v('sub1.c2', 'contradicted', '관여와 조서 검토로 독립성 문제를 보완할 수 있다고 명시했다.'),
                v('sub1.c3', 'contradicted', '분석적절차를 수행했으므로 ④가 적절하다고 명시했다.')],
            expected_points: 0, reason: 'v2 오답 원문. 함정만 고르고 옳지 않은 항목을 적절하다고 쓴 대표 오답이다.' },
        { id: 'r01v3-sub2-partial', set_id: draft.id, subquestion_id: 'sub2', kind: 'partial', answer: answer('r01v2-sub2-partial'),
            expected_verdicts: [v('sub2.c1', 'contradicted', '옳은 ⑨를 옳지 않다고 골랐다.'), v('sub2.c2', 'met', '부문 수준 판단의 한계와 같은 방향 과대계상의 합산 평가를 적었다.'),
                v('sub2.c3', 'contradicted', '목록에 넣지 말라고 하면서 그룹감사의견 판단에서 제외한다고 명시했다.')],
            expected_points: 1, reason: 'v2 부분정답 원문. 함정 ⑨ 선택과 ⑧의 평가 제외 경계를 담는다.' },
        { id: 'r01v3-sub2-wrong', set_id: draft.id, subquestion_id: 'sub2', kind: 'wrong', answer: answer('r01v2-sub2-wrong'),
            expected_verdicts: [v('sub2.c1', 'contradicted', '옳은 ⑤·⑥만 고르고 ⑦·⑧이 적절하다고 명시했다.'), v('sub2.c2', 'contradicted', '부문중요성 미달과 부문 적정의견을 근거로 ⑦이 적절하다고 명시했다.'),
                v('sub2.c3', 'contradicted', '소송충당부채를 미수정왜곡표시 목록에 포함한 처리가 적절하다고 명시했다.')],
            expected_points: 0, reason: 'v2 오답 원문. 함정만 고르고 옳지 않은 항목을 적절하다고 쓴 대표 오답이다.' },
    ],
    supplementary_cases: [
        { id: 'r01v3-supp-reason-or-procedure', purpose: '물음 1은 보완절차만, 물음 2는 이유만 쓴 답이 항목별 1점을 모두 받는지 확인한다.',
            answers: {
                sub1: '①, ④가 옳지 않다.\n① 병에게 맡기지 말고 그룹업무팀이 물류부문의 감사증거를 직접 입수해야 한다.\n④ 판매부문 중 일부를 골라 검토나 특정 절차 같은 추가 업무를 해야 한다.',
                sub2: '⑦, ⑧이 옳지 않다.\n⑦ 부문중요성보다 작다는 것이나 부문감사인의 적정의견은 부문 수준의 판단일 뿐이어서 그룹 전체에서 합친 영향을 대신 판단해 주지 못하기 때문이다.\n⑧ 소송충당부채는 왜곡표시가 확인된 것이 아니라 증거를 얻지 못한 상황일 뿐이므로 미수정왜곡표시로 볼 수 없기 때문이다.' },
            expected: {
                sub1: { expected_points: 3, expected_verdicts: [v('sub1.c1', 'met', '①·④만 정확히 골랐다.'), v('sub1.c2', 'met', '그룹업무팀이 직접 증거를 입수하는 절차를 적었다.'), v('sub1.c3', 'met', '일부 부문을 골라 추가 업무를 수행하는 절차를 적었다.')] },
                sub2: { expected_points: 3, expected_verdicts: [v('sub2.c1', 'met', '⑦·⑧만 정확히 골랐다.'), v('sub2.c2', 'met', '부문 수준 판단이 그룹 평가를 대신하지 못한다는 이유를 적었다.'), v('sub2.c3', 'met', '증거 미입수는 미수정왜곡표시가 아니라는 이유를 적었다.')] } } },
    ],
});
console.log('v3 design/lineage/qa written', reviewedContentHash(draft));
