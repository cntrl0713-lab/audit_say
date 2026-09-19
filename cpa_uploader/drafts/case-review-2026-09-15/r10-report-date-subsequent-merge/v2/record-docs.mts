// r10 v2 설계 장부·계보·대표 답안 기록(한 번만 실행; 기존 파일이 있으면 쓰지 않는다). v1 장부를 읽어 바뀐 ④와 물음 1만 고친다.
//   npx tsx cpa_uploader/drafts/case-review-2026-09-15/r10-report-date-subsequent-merge/v2/record-docs.mts
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewedContentHash } from '../../../../questionReviewIdentity.ts';
import { computeSubquestionMaxPoints } from '../../../../../lib/questionV3.ts';
import type { QuestionSetV3 } from '../../../../../lib/questionV3.ts';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r10-report-date-subsequent-merge';
const OUT = `${D}/v2`;
const EXAM = 'cpa_uploader/data/회계감사_통합학습자료/04_기출문제/기출문제_연도별_해설_A.md';
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (name: string, value: unknown) => fs.writeFileSync(`${OUT}/${name}`, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const [v1] = read(`${D}/sets.json`) as QuestionSetV3[];
const [set] = read(`${OUT}/sets.json`) as QuestionSetV3[];
const points = (s: QuestionSetV3) => s.subquestions.reduce((n, q) => n + computeSubquestionMaxPoints(q), 0);
const target = reviewedContentHash(set);
const designV1 = read(`${D}/design.json`), qaV1 = read(`${D}/qa.json`);

const items = structuredClone(designV1.items) as Array<Record<string, string>>;
const i4 = items.findIndex((item) => item.no === '④');
items[i4] = { no: '④', fact_id: 'fact2', verdict: '옳지 않음', kind: '판단', basis: 'KGA 700 문단 A66: 감사보고서일은 이 날까지 발생된 사항으로서 감사인이 알게 된 사건과 거래의 영향을 감사인이 고려하였다는 사실을 보고서 이용자에게 알리며, 감사보고서일 후의 사건과 거래에 대한 책임은 감사기준서 560이 다룬다. KGA 560 문단 10: 감사인은 감사보고서일 후에는 재무제표에 대하여 감사절차를 수행할 의무가 없다. 감사보고서일은 3월 12일이므로 제출일인 3월 17일까지의 사건이 고려되었다는 설명은 옳지 않다.', origin: 'v2 새 항목. pilot-15-007이 인용한 KGA 700 문단 A66(감사보고서일의 의미)을 쓴다. v1의 ④(익명 편지의 신체적 위협과 감사위원회에 대한 사후 통지, pilot-15-007 f3 을·sub2 crit2·crit3·crit5)를 대체한다.' };
const questions = structuredClone(designV1.questions) as Array<Record<string, any>>;
const q1 = questions.find((q) => q.subquestion_id === 'sub1')!;
q1.topic_reason = '15: 감사보고서일의 결정과 의미(KGA 700 문단 49·A66·A67·A69)와 업무수행이사 이름 공시의 예외(문단 46·A63)를 사례의 일정과 주주 서한에 적용한다.';
q1.criteria = [
    { id: 'sub1.c1', points: 1, meaning: '식별: ①·④를 고르고 ②·③은 고르지 않음' },
    { id: 'sub1.c2', points: 1, meaning: '①: 이사회(인정된 권한을 가진 기구)의 책임 확인 증거를 포함한 증거 입수일보다 빠를 수 없음, 또는 이사회 승인일 이후로 정함(이유 또는 절차)' },
    { id: 'sub1.c3', points: 1, meaning: '④: 감사보고서일(3월 12일)까지 발생해 알게 된 사건만 고려했다는 뜻이며 제출일까지의 사건은 포함하지 않음, 또는 보고서일 후 감사절차 수행 의무가 없음(이유)' },
];
q1.point_decision = '3점. 식별 1점 + 옳지 않은 항목 두 개(①·④)에 각 1점. 원 pilot-15-007 sub1(4점: 가장 빠른 날짜, 증거·작성·책임 주장의 세 조건)은 옳은 함정 ②(식별 기준)와 ①의 1점으로, sub2 crit1(법적·제재 위협만으로 생략 불가)은 옳은 함정 ③(식별 기준)으로 통합했다. v2의 ④는 원 세트가 인용한 KGA 700 문단 A66(감사보고서일의 의미)을 새로 묻는 항목이며 v1의 ④(신체적 위협과 지배기구 논의)를 대체한다. 날짜 계산의 반복, 세 조건의 완전한 나열, 감사보고서일 정의의 원문 재현은 요구하지 않는다.';

write('design.json', {
    version: 2,
    set_id: set.id,
    route: designV1.route,
    format: designV1.format,
    user_requests: [
        ...designV1.user_requests,
        '2026-09-19 추가 지시: ③(주주의 손해배상 소송·징계 요구)과 ④(익명 편지의 신체적 위협)처럼 두 가지 경우를 모두 나타내는 것은 답안에 대한 힌트가 될 수 있으므로 ④는 다른 요소로 대체하거나 지운다.',
    ],
    previous: { file: `${D}/sets.json`, sha256: sha(`${D}/sets.json`), reviewed_content_sha256: reviewedContentHash(v1), design: `${D}/design.json` },
    review_findings_v1: [
        '사용자 지적: ③(법적 책임·제재의 위협은 이름 생략 사유가 아님, 옳음)과 ④(신체적 위협을 평가해 생략하고 지배기구에 사후 통지, 옳지 않음)가 KGA 700 문단 46·A63의 두 경우(생략 사유가 아닌 위협과 생략 사유가 되는 위협)를 나란히 보여, 한 항목이 다른 항목의 판단 기준을 알려 준다. 학습 단위 계약의 대조 상황 병렬 금지와 같은 취지다.',
    ],
    changes_v2: [
        '④와 그 전제인 익명 편지 사실(자료 2의 둘째 문장)을 없앴다. 이름 공시에 관한 항목은 ③ 하나만 남는다.',
        '새 ④는 업무수행이사가 감사위원회에 감사보고서일이 제출일(3월 17일)까지의 사건을 고려하였다는 뜻이라고 설명한 판단이다(옳지 않음, KGA 700 문단 A66·KGA 560 문단 10). 이름 공시와 무관한 요소여서 ③과 대조되지 않고, ①·②와 다른 측면(감사보고서일의 의미)을 묻는다.',
        '물음 1의 모범답안 ④, sub1.req1(식별 기준)·sub1.req3, sub1.c3(새 이유), sub1.c1의 출처 목록을 바꾸었다. 식별 기준의 옳지 않은 항목 번호(①·④)와 옳은 항목(②·③)은 그대로다. 출처에 KGA 700 문단 A66(s05 등록본 발췌)과 KGA 560 문단 10(48번 원 세트 인용 재사용)을 더했다.',
        '물음 2·3, 자료 1·3·4, 나머지 출처는 v1과 바이트까지 같다. 배점은 물음별 3점, 합계 9점으로 v1과 같다.',
    ],
    items,
    questions,
    spoiler_review: [
        ...designV1.spoiler_review.map((line: string) => line.replace('두 위협 정보는 한 회사의 서로 다른 서한으로 옮겨 ③(옳음)·④(옳지 않음)로 판단하게 했다.', 'v2에서는 두 위협 가운데 법적·제재 위협만 ③(옳음)으로 남기고 신체적 위협과 지배기구 논의 요소는 없앴다(사용자 지적: 두 경우를 함께 보이면 정답 힌트가 됨).')
            .replace('옳지 않은 항목(① “관계가 없다고”, ④ “검토하여 … 평가하고”, ⑦ “경영진이 책임질 일이므로”)에 서로 다른 형태로 두고, 근거 문구가 없는 ⑥·⑧·⑨·⑩을 섞었다.', '옳지 않은 항목(① “관계가 없다고”, ⑦ “경영진이 책임질 일이므로”)에 서로 다른 형태로 두고, 근거 문구가 없는 ④·⑥·⑧·⑨·⑩을 섞었다.')
            .replace('빠뜨린 절차를 부정형으로 적지 않았다(④는 사후에 알린 행위를 적었다).', '빠뜨린 절차를 부정형으로 적지 않았다.')
            .replace('③·④는 같은 문단 46·A63에서 법적·제재 위협과 신체적 위협을 가르는 항목이지만 각각 한 목록 안에 두었다.', '')
            .replace('사실관계는 2,175자로', `사실관계는 v2에서 ${[...set.shared_context.facts.map((f) => f.text).join('\n')].length.toLocaleString('en-US')}자로`)),
        'v2의 ④(감사보고서일의 의미)와 ②(주주총회 승인 전 3월 12일을 보고서일로 정함)는 모두 감사보고서일을 다루지만 같은 기준에서 반대 결론을 가르는 쌍이 아니다. ②의 옳음은 문단 49·A69, ④의 옳지 않음은 문단 A66으로 각각 판단하며, 한 항목의 결론이 다른 항목의 판단 기준을 알려 주지 않는다.',
    ],
    nonduplication: [
        ...designV1.nonduplication,
        'v2의 ④는 감사보고서일의 의미(KGA 700 문단 A66)를 사례 설명의 옳고 그름으로 묻는다. 2014 제49회 문제 1 물음 1(감사보고서일을 특정 일자로 기재하는 이유와 효과)과 2020 제55회 문제 3 물음 5(감사보고서일의 개념)의 쟁점이다. 현재 은행에서 KGA 700 문단 A66을 인용하는 물음은 pilot-15-007뿐이다.',
        'v2에서 빠진 요구: 업무수행이사의 이름을 기재하지 않으려는 경우 그 의도를 지배기구와 논의하여 위협의 발생가능성·심각성에 대한 평가를 알려야 한다는 KGA 700 문단 46 후단(2019 제54회 문제 6 물음 6). 현재 은행에서 이 요구를 묻는 물음은 pilot-15-007 sub2뿐이어서 원 세트가 퇴역하면 은행에 남지 않는다. 필요하면 사례와 분리한 기준서형 물음으로 따로 다룬다.',
    ],
    references_consulted: [
        ...designV1.references_consulted.map((row: { file: string; lines: string; sha256: string }) => ({ ...row, sha256: sha(row.file) })),
        { file: EXAM, lines: 'L21927-L21928 (2014 제49회 문제 1 물음 1: 감사보고서일을 특정 일자로 기재하는 이유와 효과)', sha256: sha(EXAM) },
    ],
    edition: `${designV1.edition} v2에서 더한 KGA 700 문단 A66과 KGA 560 문단 10도 2025·2026 전문의 본문이 같다.`,
    target_reviewed_content_sha256: target,
});

write('lineage.json', {
    version: 1,
    artifact_type: 'case_revision_lineage',
    created_at: '2026-09-19',
    user_instruction: '2026-09-19 대화: ③과 ④처럼 두 가지 경우를 모두 나타내는 것은 답안에 대한 힌트가 될 수 있으므로 ④는 다른 요소로 대체하거나 지운다.',
    from: { file: `${D}/sets.json`, sha256: sha(`${D}/sets.json`), reviewed_content_sha256: reviewedContentHash(v1), lineage: `${D}/lineage.json` },
    target: { set_id: set.id, reviewed_content_sha256: target, points: points(set) },
    item_mapping: [
        ...['①', '②', '③'].map((no) => ({ v1: no, v2: no, change: '문구 유지' })),
        { v1: '④ 익명 편지의 신체적 위협을 평가해 이름을 기재하지 않고 감사보고서 제출 뒤 감사위원회에 사실과 평가 결과를 알림(옳지 않음)', v2: '④ 감사보고서일은 제출일(3월 17일)까지의 사건과 거래의 영향을 고려하였다는 뜻이라고 감사위원회에 설명함(옳지 않음)', change: '대체. 법적·제재 위협(③)과 신체적 위협(v1 ④)의 두 경우를 함께 보이지 않도록 이름 공시와 무관한 감사보고서일의 의미로 바꾸었다.' },
        ...['⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪'].map((no) => ({ v1: no, v2: no, change: '문구 유지' })),
    ],
    removed_facts: ['자료 2 둘째 문장: 3월 9일 업무수행이사의 이름이 공개되면 가족에게 위해를 가하겠다는 익명의 편지 접수'],
    criteria_changes: 'sub1.c3을 ④의 새 이유(감사보고서일까지 발생해 알게 된 사건만 고려했다는 뜻, 또는 보고서일 후 감사절차 수행 의무 없음)로 바꾸었다. sub1.c1은 옳지 않은 항목 번호(①·④)와 옳은 항목(②·③)의 문구가 같고 출처 목록에 KGA 700 문단 A66만 더했다. sub1.req1·sub1.req3과 모범답안 ④를 바꾸었다. 물음 2·3의 criterion은 v1과 같다.',
    original_elements: [
        { from: 'pilot-15-007 f3 을(신체적 피해 정보)·sub2 crit2(유의적 위협의 평가 후 생략)', v1: 'fact2 익명 편지, ④의 평가 부분', v2: 'deleted', reason: '③과 함께 두 경우를 보여 정답 힌트가 된다는 사용자 지적에 따라 삭제했다.' },
        { from: 'pilot-15-007 sub2 crit3·crit5(이름을 기재하지 않으려는 의도의 지배기구 논의, 발생가능성·심각성 평가의 전달)', v1: '④, sub1.c3', v2: 'deleted', reason: '같은 이유로 삭제했다. 현재 은행에서 이 요구를 묻는 물음은 pilot-15-007 sub2뿐이어서 원 세트가 퇴역하면 은행에 남지 않는다(design.json nonduplication).' },
        { from: 'pilot-15-007 source_refs KGA 700 문단 A66(감사보고서일의 의미)', v1: '인용하지 않음', v2: 'fact2 ④, sub1.c3', reason: '원 세트가 인용했지만 득점 요건에 쓰지 않았던 문단을 v2의 새 ④로 묻는다.' },
    ],
    points_change: { from: points(v1), to: points(set), reason: '물음별 3점, 합계 9점으로 같다.' },
    retirement: 'v1과 같다. 원 세 세트(pilot-15-007, case-12-restricted-revision-dual-date-20260914, case-12-post-report-refusal-20260914)는 병합본으로 대체하며 퇴역과 운영 반영은 지정 검토를 모아 한 번에 한다.',
});

// 대표 답안: 물음 1의 부분·오답만 새 ④에 맞게 다시 쓰고 물음 2·3은 v1 답안과 기대 판정을 그대로 쓴다.
const verdicts = (sub: string, rows: [string, string][]) => rows.map(([verdict, reason], i) => ({ criterion_id: `${sub}.c${i + 1}`, verdict, reason }));
const total = (rows: { verdict: string }[]) => rows.reduce((n, v) => n + (v.verdict === 'met' ? 1 : 0), 0);
const sub1Cases = [
    { id: 'r10v2-sub1-partial', subquestion_id: 'sub1', kind: 'partial',
        answer: '옳지 않은 것은 ①, ②, ④이다.\n① 감사보고서일은 이사회가 재무제표에 대한 책임을 확인하였다는 증거를 입수한 날보다 빠를 수 없으므로 이사회 승인 일정과 관계가 없다는 판단은 잘못이다.\n② 주주총회에서 재무제표가 최종 승인된 뒤에 감사보고서일을 정해야 한다.\n④ 감사보고서일은 그날인 3월 12일까지 발생해 감사인이 알게 된 사건의 영향을 고려했다는 뜻이며 제출일까지의 사건은 포함하지 않는다.',
        expected_verdicts: verdicts('sub1', [['contradicted', '옳은 ②를 옳지 않다고 골랐다.'], ['met', '이사회의 책임 확인 증거를 입수한 날보다 빠를 수 없다는 이유를 적었다.'], ['met', '감사보고서일은 3월 12일까지의 사건만 고려했다는 뜻이라는 이유를 적었다.']]),
        reason: '함정 ②를 고른 답에서 식별 점수만 잃고 ①·④의 이유는 유지되는지 확인하는 부분정답이다.' },
    { id: 'r10v2-sub1-wrong', subquestion_id: 'sub1', kind: 'wrong',
        answer: '옳지 않은 것은 ②, ③이다.\n② 주주총회가 재무제표를 최종 승인하기 전에는 감사보고서일을 정할 수 없다.\n③ 손해배상 소송이나 징계 요구도 업무수행이사 개인에 대한 위협이므로 이름을 기재하지 않을 사유가 된다.\n①과 ④는 옳다. 감사보고서일은 재무제표 금액과 공시에 대한 감사절차를 마친 날이면 되고 이사회 승인과는 관계가 없으며, 감사보고서일은 감사보고서를 회사에 제출하는 날까지 발생한 사건을 감사인이 고려하였다는 뜻이다.',
        expected_verdicts: verdicts('sub1', [['contradicted', '옳은 ②·③만 고르고 ①·④가 옳다고 명시했다.'], ['contradicted', '감사보고서일은 이사회 승인과 관계가 없다고 명시했다.'], ['contradicted', '감사보고서일이 제출일까지의 사건을 고려하였다는 뜻이라고 명시했다.']]),
        reason: '함정만 고르고 옳지 않은 항목을 옳다고 쓴 대표 오답이다.' },
].map((row) => ({ ...row, set_id: set.id, expected_points: total(row.expected_verdicts) }));
const cases = [...sub1Cases, ...qaV1.cases.filter((row: { subquestion_id: string }) => row.subquestion_id !== 'sub1')];
for (const row of cases) {
    const sub = set.subquestions.find((q) => q.id === row.subquestion_id)!;
    if (row.expected_verdicts.length !== sub.criteria.length) throw new Error(`criterion coverage: ${row.id}`);
}
const supp = (sub: string, rows: [string, string][]) => ({ expected_points: total(rows.map(([verdict]) => ({ verdict }))), expected_verdicts: verdicts(sub, rows) });
const suppV1 = (id: string) => qaV1.supplementary_cases.find((row: { id: string }) => row.id === id);
const withSub1 = (id: string, newId: string, purpose: string, answer: string, expected: ReturnType<typeof supp>) => {
    const row = suppV1(id);
    return { id: newId, purpose, answers: { ...row.answers, sub1: answer }, expected: { ...row.expected, sub1: expected } };
};
write('qa.json', {
    version: 1, set_id: set.id, method: 'author_expected_verdicts_before_model_grading', human_review_performed: false,
    note: '모범답안은 저장 model_answer를 그대로 쓴다. 부분정답·오답과 기대 판정은 실제 채점 전에 원문·criterion에서 정했다. 물음 2·3의 대표·보조 답안과 기대 판정은 v1과 같고, 물음 1만 바뀐 ④에 맞게 다시 썼다. contradicted와 not_met은 모두 0점이다.',
    previous: { file: `${D}/qa.json`, sha256: sha(`${D}/qa.json`) },
    cases,
    supplementary_cases: [
        withSub1('r10-supp-brief', 'r10v2-supp-brief', '옳지 않은 항목에 이유만(④ 보고서일 후 감사절차 수행 의무 없음, ⑩ 절차 종료일) 또는 보완절차만(①·⑥·⑦·⑨) 짧게 쓴 답이 항목별 1점을 받는지 확인한다. 물음 1의 ④는 대안 이유(보고서일 후 절차 의무 없음)만 적었다.',
            '①, ④\n① 감사보고서일은 이사회의 재무제표 승인일 이후로 정해야 한다.\n④ 감사인은 감사보고서일 후에는 재무제표에 대한 감사절차를 수행할 의무가 없으므로 제출일까지의 사건을 고려했다고 할 수 없다.',
            supp('sub1', [['met', '①·④만 골랐다.'], ['met', '감사보고서일을 이사회 승인일 이후로 정해야 한다는 절차를 적었다.'], ['met', '보고서일 후 감사절차 수행 의무가 없어 제출일까지의 사건을 고려했다고 할 수 없다는 이유를 적었다.']])),
        withSub1('r10-supp-content-identification', 'r10v2-supp-content-identification', '번호 없이 내용으로 옳지 않은 항목을 특정하고, 두 항목의 이유와 보완절차를 한 문장에 함께 쓴 답이 식별 점수와 각 항목 점수를 받는지 확인한다.',
            '재무제표 금액과 공시에 대한 절차만 마치면 이사회 승인과 관계없이 감사보고서일을 정할 수 있다고 본 감사팀의 판단과, 감사보고서일이 제출일인 3월 17일까지의 사건을 고려했다는 뜻이라고 한 업무수행이사의 설명이 옳지 않다. 감사보고서일은 이사회가 재무제표에 대한 책임을 확인한 증거를 입수한 날보다 빠를 수 없고, 그날인 3월 12일까지 발생해 감사인이 알게 된 사건의 영향만 고려했다는 뜻이다.',
            supp('sub1', [['met', '내용으로 ①·④만 특정했다.'], ['met', '이사회의 책임 확인 증거 입수일보다 빠를 수 없다고 적었다.'], ['met', '감사보고서일은 3월 12일까지의 사건만 고려했다는 뜻이라고 적었다.']])),
        withSub1('r10-supp-restated-conclusion', 'r10v2-supp-restated-conclusion', '옳지 않은 항목을 모두 고르되 각 항목에 옳지 않다는 결론만 되풀이하고 원칙·보완절차를 쓰지 않은 답이 식별 점수만 받는지 확인한다(조건 경계).',
            '옳지 않은 것은 ①, ④이다.\n① 3월 8일에 감사팀이 내린 감사보고서일에 관한 판단은 적절하지 않다.\n④ 감사위원회에 대한 업무수행이사의 설명은 적절하지 않다.',
            supp('sub1', [['met', '①·④만 골랐다.'], ['not_met', '감사보고서일의 조건이나 정해야 할 날짜가 없다.'], ['not_met', '감사보고서일의 의미나 보고서일 후 절차 의무에 관한 내용이 없다.']])),
    ],
});
console.log({ target, points: points(set), cases: cases.map((c: { id: string; expected_points: number }) => [c.id, c.expected_points]) });
