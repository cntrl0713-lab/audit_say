// r15 v2 생성기. v1과 달라지는 것은 두 물음의 발문뿐이다.
//
//   node --import tsx cpa_uploader/drafts/case-review-2026-09-15/r15-inventory-count-merge/v2/build-draft.mjs
//
// 이유: v1을 만든 뒤 다른 세션이 r12 세트(case-10-analytical-procedures-20260920)를 정본에 설치했는데,
// 그 세트의 두 발문("자료 2의 ①~⑤ 중 …", "자료 3의 ⑥~⑨ 중 …")이 v1의 발문과 바이트가 같아
// validateAuthoringBank가 발문 중복으로 거절한다(정본 설치 후 재검증에서 확인). 은행의 다른 선택형 사례는
// 모두 자료 번호 대신 단계 이름으로 범위를 정하므로 같은 관례로 바꾼다. 사실관계·항목·모범답안·criterion·
// 배점·출처는 v1과 동일하다. v1의 파일과 실행 증거는 그대로 보존한다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAuthoringBank } from '../../../../questionBankPublication.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../../..');
const V1 = path.join(here, '../sets.json');
const BANK = path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json');

const [set] = JSON.parse(fs.readFileSync(V1, 'utf8'));
if (set.id !== 'case-09-inventory-count-20260920') throw new Error('set id 불일치');

const PROMPTS = {
    sub1: '재고자산 실사를 계획하고 실사일에 수행한 절차와 판단 ①~⑤ 중 감사기준에 비추어 옳지 않은 것을 모두 찾아 번호를 쓰고, 각각에 대하여 옳지 않은 이유나 감사인이 수행하였어야 할 절차를 간략히 서술하시오.',
    sub2: '실사일 이후 재무제표일까지의 절차와 판단 ⑥~⑨ 중 감사기준에 비추어 옳지 않은 것을 모두 찾아 번호를 쓰고, 각각에 대하여 옳지 않은 이유나 감사인이 수행하였어야 할 절차를 간략히 서술하시오.',
};

for (const question of set.subquestions) {
    const next = PROMPTS[question.id];
    if (!next) throw new Error('발문이 정의되지 않은 물음: ' + question.id);
    if (next === question.prompt) throw new Error('v1과 같은 발문: ' + question.id);
    question.prompt = next;
}

set.verification.notes.push(
    'v2에서 두 물음의 발문만 바꾸었다. v1을 만든 뒤 다른 세션이 정본에 설치한 case-10-analytical-procedures-20260920의 발문("자료 2의 ①~⑤ 중 …", "자료 3의 ⑥~⑨ 중 …")과 바이트가 같아 validateAuthoringBank가 발문 중복으로 거절하였다. 은행의 다른 선택형 사례가 쓰는 대로 자료 번호 대신 단계 이름으로 범위를 정했다. 사실관계·항목·모범답안·criterion·배점·출처는 v1과 같고, v1의 초안 파일과 실행 증거는 그대로 보존한다.',
);

// 새 정본 + v2 초안이 발문 중복 없이 통과하는지 확인한다(정본 파일은 읽기만 한다).
const bank = JSON.parse(fs.readFileSync(BANK, 'utf8'));
const checked = validateAuthoringBank([...bank, set]);
if (checked.errors.length > 0) throw new Error('validateAuthoringBank 오류: ' + checked.errors.join(' | '));

fs.writeFileSync(path.join(here, 'sets.json'), `${JSON.stringify([set], null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({
    file: 'v2/sets.json',
    id: set.id,
    prompts: set.subquestions.map((q) => q.prompt),
    full_candidate: { sets: bank.length + 1, questions: checked.subquestionCount, points: checked.totalPoints, errors: checked.errors.length },
}, null, 2));
