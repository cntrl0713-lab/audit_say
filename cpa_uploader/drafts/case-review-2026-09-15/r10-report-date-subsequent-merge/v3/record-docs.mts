// r10 v3 설계 장부·계보·대표 답안 기록(한 번만 실행; 기존 파일이 있으면 쓰지 않는다). v2 장부를 읽어 바뀐 ①과 물음 1만 고친다.
//   npx tsx cpa_uploader/drafts/case-review-2026-09-15/r10-report-date-subsequent-merge/v3/record-docs.mts
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewedContentHash } from '../../../../questionReviewIdentity.ts';
import { computeSubquestionMaxPoints } from '../../../../../lib/questionV3.ts';
import type { QuestionSetV3 } from '../../../../../lib/questionV3.ts';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r10-report-date-subsequent-merge';
const PREV = `${D}/v2`, OUT = `${D}/v3`;
const CONTRACT = 'docs/물음별-학습-단위와-분류-계약.md';
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (name: string, value: unknown) => fs.writeFileSync(`${OUT}/${name}`, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const [v2] = read(`${PREV}/sets.json`) as QuestionSetV3[];
const [set] = read(`${OUT}/sets.json`) as QuestionSetV3[];
const points = (s: QuestionSetV3) => s.subquestions.reduce((n, q) => n + computeSubquestionMaxPoints(q), 0);
const target = reviewedContentHash(set);
const designV2 = read(`${PREV}/design.json`), qaV2 = read(`${PREV}/qa.json`);
const chars = [...set.shared_context.facts.map((f) => f.text).join('\n')].length;

const items = structuredClone(designV2.items) as Array<Record<string, string>>;
items[items.findIndex((item) => item.no === '①')] = { no: '①', fact_id: 'fact2', verdict: '옳지 않음', kind: '판단', basis: 'KGA 700 문단 28(c): 감사의견근거 단락에는 감사인이 감사와 관련된 윤리적 요구사항에 따라 기업으로부터 독립적이며 그러한 요구사항에 따른 기타의 윤리적 책임들을 이행하였다는 기술을 포함하여야 하고, 그 기술에는 관련 윤리적 요구사항의 원천에 대한 관할지의 표시 또는 국제윤리기준에 대한 언급이 포함되어야 한다. 감사위원회에 독립성 준수 확인서를 제출한 것으로 감사보고서의 이 기술을 대신할 수 없다.', origin: 'v3 새 항목(감사보고서 작성 단계의 보고서 요소, 주제15). v2까지의 ①(감사보고서일은 금액·공시 절차 완료일로 정하면 되고 이사회 승인 일정과 관계없다는 판단, pilot-15-007 sub1 crit2~crit4)을 대체한다.' };
const i2 = items.findIndex((item) => item.no === '②');
items[i2] = { ...items[i2], basis: `${items[i2].basis} v3에서는 이사회 승인이 필요하다는 짝 항목(v2 ①)을 없애 이 항목이 주주총회 승인을 이사회 승인과 혼동하게 하는 함정으로만 작동한다(사용자 지시).` };
const questions = structuredClone(designV2.questions) as Array<Record<string, any>>;
const q1 = questions.find((q) => q.subquestion_id === 'sub1')!;
q1.topic_reason = '15: 감사의견근거 단락의 독립성 기술(KGA 700 문단 28(c)), 감사보고서일의 결정과 의미(문단 49·A66·A69), 업무수행이사 이름 공시의 예외(문단 46·A63)를 사례의 보고서 작성 판단·일정·주주 서한에 적용한다.';
q1.criteria = [
    { id: 'sub1.c1', points: 1, meaning: '식별: ①·④를 고르고 ②·③은 고르지 않음' },
    { id: 'sub1.c2', points: 1, meaning: '①: 감사의견근거 단락에 독립성·윤리적 책임 이행에 관한 기술을 포함해야 하며 감사위원회 확인서로 대신할 수 없음(이유 또는 절차)' },
    { id: 'sub1.c3', points: 1, meaning: '④: 감사보고서일(3월 12일)까지 발생해 알게 된 사건만 고려했다는 뜻이며 제출일까지의 사건은 포함하지 않음, 또는 보고서일 후 감사절차 수행 의무가 없음(이유)' },
];
q1.point_decision = '3점. 식별 1점 + 옳지 않은 항목 두 개(①·④)에 각 1점. 원 pilot-15-007 sub1(4점: 가장 빠른 날짜, 증거·작성·책임 주장의 세 조건)은 옳은 함정 ②(주주총회 승인을 이사회 승인과 혼동하게 함, 식별 기준)로, sub2 crit1(법적·제재 위협만으로 생략 불가)은 옳은 함정 ③(식별 기준)으로 통합했다. ①은 v3 새 항목(감사의견근거 단락의 독립성 기술), ④는 v2 새 항목(감사보고서일의 의미)이다. 감사보고서일의 증거 조건(이사회 승인 등)은 ②의 함정 판단으로만 묻고 옳지 않은 항목의 이유로는 묻지 않는다. 윤리적 요구사항의 원천 표시, 감사보고서일 정의의 원문 재현은 요구하지 않는다.';

write('design.json', {
    version: 3,
    set_id: set.id,
    route: designV2.route,
    format: designV2.format,
    user_requests: [
        ...designV2.user_requests,
        '2026-09-19 추가 지시: 주주총회 승인을 이사회 승인으로 착각하도록 한 ②를 함정으로 두고 ①을 대체한다. 그리고 지침에 반영한다.',
    ],
    previous: { file: `${PREV}/sets.json`, sha256: sha(`${PREV}/sets.json`), reviewed_content_sha256: reviewedContentHash(v2), design: `${PREV}/design.json` },
    review_findings_v2: [
        'v2의 ①(감사보고서일은 이사회 승인 일정과 관계없다는 판단, 옳지 않음)과 ②(주주총회의 최종 승인 전 날짜를 감사보고서일로 정함, 옳음)는 감사보고서일 전에 필요한 승인과 필요 없는 승인이라는 두 경우를 나란히 보여, ③·④에서 사용자가 지적한 것과 같은 정답 힌트가 된다(agent가 v2 보고 때 확인을 요청했고 사용자가 ① 대체를 지시).',
    ],
    changes_v3: [
        '①을 업무수행이사가 감사위원회에 독립성 준수 확인서를 제출한 것으로 충분하다고 보고 감사의견근거 단락에서 독립성·윤리적 책임에 관한 기술을 빼기로 한 판단(옳지 않음, KGA 700 문단 28(c))으로 바꾸었다. 감사보고서일의 선후 조건이 아닌 보고서 요소여서 ②와 짝을 이루지 않는다.',
        '②는 그대로 두어 주주총회 승인을 이사회 승인과 혼동하게 하는 함정으로만 쓴다. 이사회 승인일(3월 10일)은 자료 1의 사실로 남는다.',
        '물음 1의 모범답안 ①, sub1.req1·sub1.req2, sub1.c2, sub1.c1의 출처 목록을 바꾸었다. 출처에 KGA 700 문단 28(주제15 등록본 발췌)을 더하고 쓰지 않게 된 문단 A67을 뺐다. 식별 기준의 옳지 않은 항목(①·④)과 옳은 항목(②·③)의 번호와 문구는 v2와 같다.',
        `물음 2·3, 자료 1·3·4, 자료 2의 ②~④는 v2와 바이트까지 같다. 사실관계는 ${chars.toLocaleString('en-US')}자, 배점은 물음별 3점·합계 9점으로 같다.`,
        '지침 반영: 학습 단위 계약의 “대조되는 두 경우를 함께 두지 않음”(선택형 목록 안에 섞는 것 포함)과 “한 사실에서 반대 결론이 나오는 병합”을 고치고, 제작·검토 스킬과 AGENTS.md, 수정 요청서의 공통 수정 기준에 같은 취지를 더했다.',
    ],
    items,
    questions,
    spoiler_review: [
        ...designV2.spoiler_review.map((line: string) => line
            .replace('옳지 않은 항목(① “관계가 없다고”, ⑦ “경영진이 책임질 일이므로”)', '옳지 않은 항목(① “충분하다고 보고”, ⑦ “경영진이 책임질 일이므로”)')
            .replace(`사실관계는 v2에서 2,081자로`, `사실관계는 v3에서 ${chars.toLocaleString('en-US')}자로`)),
        'v3에서는 감사보고서일 전에 필요한 승인(이사회)과 필요 없는 승인(주주총회)을 함께 보이던 v2의 ①·②에서 ①을 없애고, ②만 주주총회 승인을 이사회 승인과 혼동하게 하는 함정으로 남겼다. 새 ①(감사의견근거 단락의 독립성 기술)은 날짜·승인과 관계없는 보고서 요소다. 물음 2·3에는 같은 조건의 두 경우가 없다: ⑤는 보고서 제출 뒤 수정 거부라는 한 상황의 대응이고, ⑨(보고서 전체 일자 변경)·⑩(추가 일자를 승인일로)은 같은 문단의 서로 다른 잘못이며, ⑪은 허용되는 보고 방법 하나다.',
    ],
    nonduplication: [
        ...designV2.nonduplication,
        'v3의 ①은 적정의견 감사보고서의 감사의견근거 단락에 들어갈 독립성·윤리적 책임 기술(KGA 700 문단 28(c))을 사례 판단으로 묻는다. pilot-15-001 subq1은 감사의견·감사의견근거 단락의 배치와 제목만 묻고, 같은 날 다른 세션의 r11(case-15-scope-limitation-disclaimer-20260919) ⑫와 std-points-20260914-817048b7fa92 sub2는 의견거절 시 감사인의 책임 단락(KGA 705 문단 28)에 남는 독립성 기술을 다루므로 요구가 다르다.',
    ],
    references_consulted: [
        ...designV2.references_consulted.map((row: { file: string; lines: string; sha256: string }) => ({ ...row, sha256: sha(row.file) })),
        { file: CONTRACT, lines: '사례형 발문과 절차 선택형: 대조되는 두 경우를 함께 두지 않음(2026-09-19 개정)', sha256: sha(CONTRACT) },
    ],
    edition: `${designV2.edition} v3에서 더한 KGA 700 문단 28도 2025·2026 전문의 본문이 같다.`,
    target_reviewed_content_sha256: target,
});

write('lineage.json', {
    version: 1,
    artifact_type: 'case_revision_lineage',
    created_at: '2026-09-19',
    user_instruction: '2026-09-19 대화: 주주총회 승인을 이사회 승인으로 착각하도록 한 ②를 함정으로 두고 ①을 대체한다. 지침에 반영한다.',
    from: { file: `${PREV}/sets.json`, sha256: sha(`${PREV}/sets.json`), reviewed_content_sha256: reviewedContentHash(v2), lineage: `${PREV}/lineage.json` },
    target: { set_id: set.id, reviewed_content_sha256: target, points: points(set) },
    item_mapping: [
        { v2: '① 감사보고서일은 금액·공시 절차 완료일로 정하면 되고 이사회의 재무제표 승인 일정과 관계없다는 감사팀의 판단(옳지 않음)', v3: '① 감사위원회에 독립성 준수 확인서를 제출한 것으로 충분하다고 보고 감사의견근거 단락에서 독립성·윤리적 책임에 관한 기술을 빼기로 한 업무수행이사의 판단(옳지 않음)', change: '대체. ②와 함께 감사보고서일 전에 필요한 승인과 필요 없는 승인의 두 경우를 보이지 않도록 날짜·승인과 무관한 보고서 요소로 바꾸었다.' },
        { v2: '② 정기주주총회의 최종 승인 전인 3월 12일을 감사보고서일로 정함(옳음)', v3: '②', change: '문구 유지. 주주총회 승인을 이사회 승인과 혼동하게 하는 함정으로만 쓴다.' },
        ...['③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪'].map((no) => ({ v2: no, v3: no, change: '문구 유지' })),
    ],
    removed_facts: [],
    criteria_changes: 'sub1.c2를 ①의 새 이유(감사의견근거 단락에 독립성·윤리적 책임 기술을 포함해야 하며 감사위원회 확인서로 대신할 수 없음)로 바꾸었다. sub1.c1은 옳지 않은 항목 번호(①·④)와 옳은 항목(②·③)의 문구가 같고 출처 목록에서 KGA 700 문단 A67을 빼고 문단 28을 더했다. sub1.req1·sub1.req2와 모범답안 ①을 바꾸었다. 물음 2·3의 criterion은 v2와 같다.',
    original_elements: [
        { from: 'pilot-15-007 sub1 crit2~crit4(감사보고서일의 증거 조건: 충분하고 적합한 증거, 모든 단위재무제표와 공시의 작성, 인정된 권한을 가진 기구의 책임 주장)', v2: '①, sub1.c2', v3: 'converted_to_trap', reason: '옳지 않은 항목의 이유로는 묻지 않고, 주주총회 승인을 이사회 승인과 혼동하게 하는 ②의 함정 판단(식별 기준)으로만 남겼다. 이사회 승인일은 자료 1의 사실로 남는다.' },
        { from: 'pilot-15-007 source_refs KGA 700 문단 A67', v2: '①의 근거', v3: 'removed_from_sources', reason: '①을 바꾸어 쓰지 않게 되었다.' },
        { from: '(원 세트에 없음) KGA 700 문단 28(c) 감사의견근거 단락의 독립성 기술', v2: '없음', v3: 'fact2 ①, sub1.c2', reason: '같은 주제(15)의 보고서 요소로 ①을 대체했다. 학습 단위 계약의 병합 기준(같은 주제의 다른 기준서 요구로 종합 문제 확장)을 따른다.' },
    ],
    points_change: { from: points(v2), to: points(set), reason: '물음별 3점, 합계 9점으로 같다.' },
    retirement: 'v1·v2와 같다. 원 세 세트(pilot-15-007, case-12-restricted-revision-dual-date-20260914, case-12-post-report-refusal-20260914)는 병합본으로 대체하며 퇴역과 운영 반영은 지정 검토를 모아 한 번에 한다.',
});

// 대표 답안: 물음 1의 부분·오답만 새 ①에 맞게 다시 쓰고 물음 2·3은 v2(=v1) 답안과 기대 판정을 그대로 쓴다.
const verdicts = (sub: string, rows: [string, string][]) => rows.map(([verdict, reason], k) => ({ criterion_id: `${sub}.c${k + 1}`, verdict, reason }));
const total = (rows: { verdict: string }[]) => rows.reduce((n, v) => n + (v.verdict === 'met' ? 1 : 0), 0);
const sub1Cases = [
    { id: 'r10v3-sub1-partial', subquestion_id: 'sub1', kind: 'partial',
        answer: '옳지 않은 것은 ①, ②, ④이다.\n① 감사의견근거 단락에는 감사인이 독립적이며 윤리적 책임을 이행하였다는 기술을 넣어야 하므로 감사위원회에 낸 확인서로 대신할 수 없다.\n② 주주총회에서 재무제표가 최종 승인된 뒤에 감사보고서일을 정해야 한다.\n④ 감사보고서일은 그날인 3월 12일까지 발생해 감사인이 알게 된 사건의 영향을 고려했다는 뜻이며 제출일까지의 사건은 포함하지 않는다.',
        expected_verdicts: verdicts('sub1', [['contradicted', '옳은 ②를 옳지 않다고 골랐다.'], ['met', '감사의견근거 단락에 독립성 기술을 넣어야 하며 확인서로 대신할 수 없다는 이유를 적었다.'], ['met', '감사보고서일은 3월 12일까지의 사건만 고려했다는 뜻이라는 이유를 적었다.']]),
        reason: '함정 ②(주주총회 승인을 이사회 승인과 혼동)를 고른 답에서 식별 점수만 잃고 ①·④의 이유는 유지되는지 확인하는 부분정답이다.' },
    { id: 'r10v3-sub1-wrong', subquestion_id: 'sub1', kind: 'wrong',
        answer: '옳지 않은 것은 ②, ③이다.\n② 주주총회가 재무제표를 최종 승인하기 전에는 감사보고서일을 정할 수 없다.\n③ 손해배상 소송이나 징계 요구도 업무수행이사 개인에 대한 위협이므로 이름을 기재하지 않을 사유가 된다.\n①과 ④는 옳다. 감사위원회에 독립성 준수 확인서를 제출했으면 감사보고서에는 독립성에 관한 기술을 넣지 않아도 되고, 감사보고서일은 감사보고서를 회사에 제출하는 날까지 발생한 사건을 감사인이 고려하였다는 뜻이다.',
        expected_verdicts: verdicts('sub1', [['contradicted', '옳은 ②·③만 고르고 ①·④가 옳다고 명시했다.'], ['contradicted', '확인서를 제출했으면 감사보고서에 독립성 기술을 넣지 않아도 된다고 명시했다.'], ['contradicted', '감사보고서일이 제출일까지의 사건을 고려하였다는 뜻이라고 명시했다.']]),
        reason: '함정만 고르고 옳지 않은 항목을 옳다고 쓴 대표 오답이다.' },
].map((row) => ({ ...row, set_id: set.id, expected_points: total(row.expected_verdicts) }));
const cases = [...sub1Cases, ...qaV2.cases.filter((row: { subquestion_id: string }) => row.subquestion_id !== 'sub1')];
for (const row of cases) {
    const sub = set.subquestions.find((q) => q.id === row.subquestion_id)!;
    if (row.expected_verdicts.length !== sub.criteria.length) throw new Error(`criterion coverage: ${row.id}`);
}
const supp = (sub: string, rows: [string, string][]) => ({ expected_points: total(rows.map(([verdict]) => ({ verdict }))), expected_verdicts: verdicts(sub, rows) });
const suppV2 = (id: string) => qaV2.supplementary_cases.find((row: { id: string }) => row.id === id);
const withSub1 = (id: string, newId: string, purpose: string, answer: string, expected: ReturnType<typeof supp>) => {
    const row = suppV2(id);
    return { id: newId, purpose, answers: { ...row.answers, sub1: answer }, expected: { ...row.expected, sub1: expected } };
};
write('qa.json', {
    version: 1, set_id: set.id, method: 'author_expected_verdicts_before_model_grading', human_review_performed: false,
    note: '모범답안은 저장 model_answer를 그대로 쓴다. 부분정답·오답과 기대 판정은 실제 채점 전에 원문·criterion에서 정했다. 물음 2·3의 대표·보조 답안과 기대 판정은 v2(=v1)와 같고, 물음 1만 바뀐 ①에 맞게 다시 썼다. contradicted와 not_met은 모두 0점이다.',
    previous: { file: `${PREV}/qa.json`, sha256: sha(`${PREV}/qa.json`) },
    cases,
    supplementary_cases: [
        withSub1('r10v2-supp-brief', 'r10v3-supp-brief', '옳지 않은 항목에 이유만(④ 보고서일 후 감사절차 수행 의무 없음, ⑩ 절차 종료일) 또는 보완절차만(①·⑥·⑦·⑨) 짧게 쓴 답이 항목별 1점을 받는지 확인한다. 물음 1의 ①은 독립성 기술을 감사의견근거 단락에 넣어야 한다는 절차만 적었다.',
            '①, ④\n① 독립성과 윤리적 책임에 관한 기술을 감사의견근거 단락에 넣어야 한다.\n④ 감사인은 감사보고서일 후에는 재무제표에 대한 감사절차를 수행할 의무가 없으므로 제출일까지의 사건을 고려했다고 할 수 없다.',
            supp('sub1', [['met', '①·④만 골랐다.'], ['met', '독립성 기술을 감사의견근거 단락에 넣어야 한다는 절차를 적었다.'], ['met', '보고서일 후 감사절차 수행 의무가 없어 제출일까지의 사건을 고려했다고 할 수 없다는 이유를 적었다.']])),
        withSub1('r10v2-supp-content-identification', 'r10v3-supp-content-identification', '번호 없이 내용으로 옳지 않은 항목을 특정하고, 두 항목의 이유와 보완절차를 한 문장에 함께 쓴 답이 식별 점수와 각 항목 점수를 받는지 확인한다.',
            '감사위원회에 독립성 준수 확인서를 냈다는 이유로 감사의견근거 단락에서 독립성 기술을 뺀 결정과, 감사보고서일이 제출일인 3월 17일까지의 사건을 고려했다는 뜻이라고 한 업무수행이사의 설명이 옳지 않다. 독립성과 윤리적 책임에 관한 기술은 감사보고서의 감사의견근거 단락에 있어야 하고, 감사보고서일은 그날인 3월 12일까지 발생해 감사인이 알게 된 사건의 영향만 고려했다는 뜻이다.',
            supp('sub1', [['met', '내용으로 ①·④만 특정했다.'], ['met', '독립성 기술은 감사의견근거 단락에 있어야 한다고 적었다.'], ['met', '감사보고서일은 3월 12일까지의 사건만 고려했다는 뜻이라고 적었다.']])),
        withSub1('r10v2-supp-restated-conclusion', 'r10v3-supp-restated-conclusion', '옳지 않은 항목을 모두 고르되 각 항목에 옳지 않다는 결론만 되풀이하고 원칙·보완절차를 쓰지 않은 답이 식별 점수만 받는지 확인한다(조건 경계).',
            '옳지 않은 것은 ①, ④이다.\n① 감사의견근거 단락에 관한 업무수행이사의 결정은 적절하지 않다.\n④ 감사위원회에 대한 업무수행이사의 설명은 적절하지 않다.',
            supp('sub1', [['met', '①·④만 골랐다.'], ['not_met', '감사의견근거 단락에 들어갈 독립성 기술에 관한 내용이 없다.'], ['not_met', '감사보고서일의 의미나 보고서일 후 절차 의무에 관한 내용이 없다.']])),
    ],
});
console.log({ target, points: points(set), cases: cases.map((c: { id: string; expected_points: number }) => [c.id, c.expected_points]) });
