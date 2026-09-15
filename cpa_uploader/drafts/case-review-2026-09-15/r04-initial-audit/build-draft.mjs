// 29번(pilot-09-010) 재구성 초안(초도감사 종합). 원문 인용은 현재 정본의 원 세트와 등록 전문에서 그대로 복사한다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r04-initial-audit/build-draft.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r04-initial-audit';
const BANK = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const FILES = {
    '300': 'cpa_uploader/data/official/case-review-2026-09-15-kga300.md',
    '315': 'cpa_uploader/data/official/delegated-n02-kga315-2025.txt',
    '500': 'cpa_uploader/data/official/kga500-2025-review08.txt',
    '510': 'cpa_uploader/data/official/kga501-505-510-2025-review09.txt',
    '710': 'cpa_uploader/data/official/kga701-706-710-720-2025-review16.txt',
};
const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const bank = JSON.parse(fs.readFileSync(BANK, 'utf8'));
const texts = Object.fromEntries(Object.entries(FILES).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));
const P10 = 'pilot-09-010';
const original = bank.find((s) => s.id === P10); assert(original, P10);
const reuse = (id, refId) => {
    const ref = original.source_refs.find((r) => r.id === refId); assert(ref && ref.content_hash === sha(ref.source_quote), refId);
    return { id, file: ref.file, title: ref.title, page: ref.page, source_quote: ref.source_quote, role: 'standard', content_hash: ref.content_hash };
};
const extract = (id, standard, paragraph, pdfPage, start, end) => {
    const text = texts[standard];
    const i = text.indexOf(start); const j = text.indexOf(end, i);
    assert(i >= 0 && j > i, `${id}: ${start}`);
    assert.equal(text.indexOf(start, i + 1), -1, `${id}: 시작 문구가 유일하지 않음`);
    const quote = text.slice(i, j + end.length);
    const first = text.slice(0, i).split('\n').length;
    const span = `L${first}-L${first + quote.split('\n').length - 1}`;
    return { id, file: FILES[standard], title: `KGA ${standard} 문단 ${paragraph}, 2025 개정 전문 원문 PDF ${pdfPage}쪽; ${span}`, page: `KGA ${standard}`, source_quote: quote, role: 'standard', content_hash: sha(quote) };
};

const refs = [
    extract('kga300-13', '300', '13', 182, '13. \n감사인은 초도감사를 착수하기 전에', '(문단 A22 참조)'),
    reuse('kga510-5', 'std-510-5'),
    reuse('kga510-6', 'std-510-6'),
    reuse('kga510-7', 'std-510-7'),
    reuse('kga510-9', 'std-510-9'),
    extract('kga510-13', '510', '13', 413, '13. 만약 전기재무제표에 대한 전임감사인의 감사의견에 변형이 있었고', '(문단 A9 참조)'),
    reuse('kga510-A6', 'std-510-A6'),
    reuse('kga510-A7', 'std-510-A7'),
    extract('kga510-A9', '510', 'A9', 415, 'A9. 상황에 따라서는 전임감사인의 의견변형은', '이러한 예일 것이다.'),
    extract('kga500-A32', '500', 'A32', 378, 'A32. 주어진 일군의 감사절차들은', '주장과 관련성이 있을 수도 있다.'),
    extract('kga315-A190b', '315', 'A190(b)', 252, '보고기간말 계정잔액 및 관련 공시에 대한 경영진주장', '시는 적합하게 측정되고 기술되어 있음'),
    extract('kga710-2', '710', '2', 787, '2. 기업의 재무제표에 표시되는 비교정보의 성격은', '비교재무제표 방식에 따라 보고하여야 한다.'),
    extract('kga710-17', '710', '17', 790, '17. 전기재무제표가 전임감사인의 감사를 받은 경우, 전기재무제표에 대한 전임감사인의 감사', '(c) 전임감사인의 감사보고서일'),
];
const quote = (id) => refs.find((r) => r.id === id).source_quote;

const facts = [
    { id: 'fact1', text: '한결회계법인은 20X1년 초 이든회사의 감사인으로 새로 선임되어 이든회사의 20X1년 1월 1일부터 12월 31일까지의 재무제표를 주식회사 등의 외부감사에 관한 법률에 따라 감사하고 있으며, 감사보고서일은 20X2년 3월 중순으로 예정되어 있다. 이든회사의 20X0년 재무제표는 누리회계법인이 감사하였고, 누리회계법인의 20X0년 감사보고서는 20X1년 재무제표와 함께 재발행되지 않는다. 누리회계법인은 20X0년 말 장기대여금의 회수가능성에 관하여 충분하고 적합한 감사증거를 입수하지 못하였다는 이유로 20X0년 재무제표에 대하여 한정의견을 표명하였다. 이든회사는 제조업을 영위하며 재고자산이 총자산의 상당한 부분을 차지한다.' },
    { id: 'fact2', text: [
        '감사 착수와 계획 단계에서 한결회계법인과 감사팀이 수행한 절차와 판단은 다음과 같다.',
        '① 한결회계법인은 이든회사와 감사계약을 체결하기 전에 의뢰인 관계의 수용과 감사업무의 수임 여부에 관한 절차를 수행하고, 누리회계법인과 커뮤니케이션하였다.',
        '② 감사팀은 이든회사가 20X0년 재무제표를 전자공시시스템에 공시하였으므로 공시된 재무제표와 주석, 누리회계법인의 감사보고서를 열람하였다.',
        '③ 누리회계법인은 감사조서를 열람하게 해 달라는 감사팀의 요청에 동의하지 않았다. 팀장은 전임감사인의 감사조서를 검토할 수 없으므로 기초잔액에 관하여 충분하고 적합한 감사증거를 입수할 수 없다고 판단하고, 기초잔액을 사유로 하는 한정의견을 감사계획에 반영하였다.',
        '④ 감사팀은 20X0년 재무제표의 마감잔액이 20X1년 기초잔액으로 정확하게 이월되었는지 확인하였다.',
        '⑤ 감사팀은 누리회계법인의 한정의견을 초래한 장기대여금 문제는 누리회계법인이 이미 감사보고서에서 보고한 사항이므로 20X1년 재무제표의 중요왜곡표시위험을 평가할 때 반영하지 않기로 하였다.',
    ].join('\n') },
    { id: 'fact3', text: [
        '감사팀은 기초잔액과 관련하여 다음 자료를 입수하였다.',
        '(가) 20X1년 초 매출채권 잔액 중 20X1년 중에 회수된 금액의 입금 내역',
        '(나) 20X1년 초 매입채무 잔액 중 20X1년 중에 지급된 금액의 지급 내역',
    ].join('\n') },
    { id: 'fact4', text: [
        '감사팀이 기초잔액에 관하여 수행한 절차와 판단은 다음과 같다.',
        '⑥ 감사팀은 20X1년 말 재고실사에 입회하고, 20X1년 중의 입고·출고 수량 기록을 이용하여 실사 수량을 20X1년 초 재고수량으로 조정하였다. 감사팀은 이 조정 결과를 바탕으로 기초 재고자산 항목의 수량과 평가에 관한 감사증거를 입수하였다고 결론 내렸다.',
        '⑦ 감사팀은 기초 재고자산에 관한 감사증거를 입수하기 위하여 20X1년의 매출총이익률을 분석하고, 20X1년 초 전후의 매출과 매입에 대한 기간귀속을 테스트하였다.',
        '⑧ 감사팀은 이든회사의 장기차입금이 모두 한 은행에서 차입한 것이므로 20X1년 초 장기차입금 잔액을 그 은행에 조회하여 회신을 받고, 회신 내용을 차입약정서와 대조하였다.',
        '⑨ 감사팀은 20X1년 초 매출채권에 20X0년 11월에 부도가 난 거래처에 대한 채권이 포함되어 있고, 이든회사가 20X0년 말에 이 채권에 대한 손실충당금을 인식하지 않은 사실을 알게 되었다. 이 채권 금액은 재무제표 전체에 대한 중요성을 넘는다. 감사팀은 이 사항이 누리회계법인이 감사한 20X0년 재무제표에 관한 것이므로 20X1년 재무제표 감사에서 다룰 사항이 아니라고 보았다.',
    ].join('\n') },
    { id: 'fact5', text: [
        '감사보고서를 작성하는 단계에서 확인된 사항과 감사팀의 판단은 다음과 같다. 누리회계법인이 한정의견의 사유로 삼았던 장기대여금은 20X1년 4월에 전액 회수되었고, 감사팀은 회수 내역을 확인하여 장기대여금이 20X1년 재무제표에 미치는 영향에 관하여 충분하고 적합한 감사증거를 입수하였다.',
        '⑩ 감사팀은 누리회계법인의 한정의견을 초래한 사항이 20X1년 재무제표에 대한 감사의견을 변형할 사유가 되지 않는다고 판단하였다.',
        '⑪ 감사팀은 20X1년 재무제표에 대하여 감사의견을 표명하고, 비교표시되는 20X0년 재무제표에 대하여는 감사의견을 표명하지 않기로 하였다.',
        '⑫ 감사팀은 감사보고서의 기타사항문단에 20X0년 재무제표를 누리회계법인이 감사하였다는 사실과 누리회계법인의 감사보고서일을 기재하고, 누리회계법인이 표명한 의견의 유형과 그 사유는 20X1년 재무제표 이용자에게 필요한 정보가 아니라고 보아 기재하지 않기로 하였다.',
    ].join('\n') },
].map((fact) => ({ ...fact, scoreable: false }));

const one = { met: 1, not_met: 0, contradicted: 0 };
const criterion = (id, type, claim, refIds) => ({
    id, requirement_id: id.replace(/\.c(\d+)$/u, '.req$1'), claim,
    critical_facts: [{ id: `${id}.fact`, type, expected: claim }], max_points: 1, scores: { ...one }, source_ref_ids: refIds,
});
const requirement = (id, refId, span) => ({ id, source_ref_id: refId, source_quote: quote(refId), source_span: span });
const shape = { constraints: { ordered: false, max_entries: null, overflow_policy: 'none' }, selection: { type: 'all', n: null }, decision: null };
const selectPrompt = (stage, range) => `${stage} ${range} 중 감사기준에 비추어 옳지 않은 것을 모두 찾아 번호를 쓰고, 각각에 대하여 옳지 않은 이유나 감사인이 수행하였어야 할 절차를 간략히 서술하시오.`;

const sub1 = {
    id: 'sub1', type: 'judgment', question_style: 'case', topic_ids: ['09', '04'],
    prompt: selectPrompt('감사 착수와 계획 단계의 절차와 판단', '①~⑤'),
    ...shape, answer_slots: [{ id: 'sub1.answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '옳지 않은 것은 ③, ⑤이다. ①은 초도감사 착수 전의 수임 절차와 전임감사인과의 커뮤니케이션, ②는 최근 재무제표와 전임감사인 감사보고서의 열람, ④는 전기 마감잔액의 이월 확인으로 모두 옳다.',
        '③ 전임감사인의 감사조서를 검토할 수 없더라도 당기에 수행한 감사절차가 기초잔액에 관한 증거를 제공하는지 평가하거나 기초잔액에 관한 특정 감사절차를 수행하여 증거를 입수하여야 하며, 그래도 충분하고 적합한 증거를 입수할 수 없을 때 의견변형을 고려한다.',
        '⑤ 전임감사인의 감사의견이 변형되었으므로 당기재무제표의 중요왜곡표시위험을 평가할 때 그 변형을 초래한 장기대여금 문제가 미치는 영향을 평가하여야 한다.',
    ],
    requirements: [
        requirement('sub1.req1', 'kga510-6', 'KGA 300 문단 13, KGA 510 문단 5·6·9; 식별 기준: ③(전임감사인 조서를 검토할 수 없다는 이유로 기초잔액 증거 입수가 불가능하다고 보고 한정의견을 계획), ⑤(전임감사인 의견변형 사유를 당기 위험평가에 반영하지 않음)는 옳지 않다. ①은 문단 300.13, ②는 510.5, ④는 510.6(a)에 따라 옳다.'),
        requirement('sub1.req2', 'kga510-6', 'KGA 510 문단 6(c); 적용: 전임감사인의 감사조서 검토 외에 당기에 수행된 감사절차가 기초잔액에 관한 증거를 제공하는지 평가하거나 기초잔액에 관한 특정 감사절차를 수행한다.'),
        requirement('sub1.req3', 'kga510-9', 'KGA 510 문단 9; 적용: 전임감사인의 감사의견이 변형되었으면 당기재무제표의 중요왜곡표시위험을 평가할 때 그 변형을 초래한 사항이 미치는 영향을 평가한다.'),
    ],
    criteria: [
        criterion('sub1.c1', 'conclusion', '옳지 않은 것으로 ③·⑤를 모두 지적한다. 번호 대신 내용으로 특정해도 인정한다. ③·⑤ 중 하나라도 빠뜨리거나, 옳은 것인 ①(감사계약 체결 전 수임 절차와 전임감사인과의 커뮤니케이션), ②(전기 재무제표·공시와 전임감사인 감사보고서의 열람), ④(전기 마감잔액의 이월 확인)를 옳지 않다고 지적하면 이 점수는 주지 않는다.', ['kga510-6', 'kga300-13', 'kga510-5', 'kga510-9']),
        criterion('sub1.c2', 'action', '③ 전임감사인의 감사조서를 검토할 수 없더라도 당기에 수행한 감사절차가 기초잔액에 관한 증거를 제공하는지 평가하거나 기초잔액에 관한 특정 감사절차를 수행하여 증거를 입수할 수 있으므로, 조서를 볼 수 없다는 사실로 증거 입수가 불가능하다고 보고 의견변형을 계획할 수 없다는 이유 또는 다른 경로로 증거를 입수해야 한다는 절차를 제시한다. 두 경로 중 하나만 들거나 다른 방법으로 기초잔액 증거를 입수해야 한다는 원칙만 써도 인정하며, 경로의 완전한 나열은 요구하지 않는다. 조서를 볼 수 없으면 의견을 변형해야 한다고 쓰면 인정하지 않는다.', ['kga510-6']),
        criterion('sub1.c3', 'action', '⑤ 전기재무제표에 대한 전임감사인의 감사의견이 변형되었으면 당기재무제표의 중요왜곡표시위험을 평가할 때 그 변형을 초래한 사항(장기대여금)이 미치는 영향을 평가해야 한다는 이유나 절차를 제시한다. 장기대여금 문제를 당기 위험평가에 반영해야 한다는 절차나, 전임감사인의 의견변형 사유가 당기 중요왜곡표시위험에 영향을 미칠 수 있다는 이유 중 하나만 써도 인정한다. 전임감사인이 이미 보고했거나 전기 사항이므로 당기 위험평가에서 고려하지 않아도 된다고 쓰면 인정하지 않는다.', ['kga510-9']),
    ],
};

const assertion = (n, name, extra, refIds) => criterion(`sub2.c${n}`, 'action', `(가)·(나)가 보고기간 개시일 잔액의 ${name}에 관한 감사증거를 제공한다고 제시한다. 두 자료를 합쳐 한 번에 나열하거나 자료별로 나누어 써도 인정하며, 자료별로 나눌 때 이 주장을 한 자료에만 붙여 써도 인정한다.${extra}`, refIds);
const sub2 = {
    id: 'sub2', type: 'enumeration', question_style: 'case', topic_ids: ['09', '08'],
    prompt: '기초잔액과 관련하여 감사팀이 입수한 자료 (가)와 (나)가 보고기간 개시일 잔액의 어떤 경영진주장에 관한 감사증거를 제공하는지 모두 나열하시오.',
    ...shape, answer_slots: [{ id: 'sub2.answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '(가)와 (나)는 보고기간 개시일 잔액의 실재성에 관한 감사증거를 제공한다.',
        '(가)와 (나)는 보고기간 개시일 잔액의 권리와 의무(매출채권은 권리, 매입채무는 의무)에 관한 감사증거를 제공한다.',
        '(가)와 (나)는 보고기간 개시일 잔액의 완전성에 관한 감사증거를 제공한다.',
        '(가)와 (나)는 보고기간 개시일 잔액의 평가에 관한 감사증거를 제공한다.',
    ],
    requirements: [1, 2, 3, 4].map((n) => requirement(`sub2.req${n}`, 'kga510-A6', `KGA 510 문단 A6; 요소: ${['실재성', '권리와 의무', '완전성', '평가'][n - 1]}. 당기 중 회수(지급)된 기초 매출채권(매입채무)은 보고기간 개시일의 실재성, 권리와 의무, 완전성 및 평가에 대한 감사증거 중 일부를 제공한다.`)),
    criteria: [
        assertion(1, '실재성', '', ['kga510-A6']),
        assertion(2, '권리와 의무', ' 매출채권은 권리, 매입채무는 의무로 나누어 쓰거나 권리 또는 의무라는 명칭으로 이 주장을 가리켜도 인정한다.', ['kga510-A6', 'kga315-A190b']),
        assertion(3, '완전성', '', ['kga510-A6']),
        assertion(4, '평가', ' 정확성, 평가 및 배분 또는 평가와 배분이라는 명칭도 인정한다.', ['kga510-A6', 'kga315-A190b']),
    ],
};

const sub3 = {
    id: 'sub3', type: 'judgment', question_style: 'case', topic_ids: ['09', '08'],
    prompt: selectPrompt('기초잔액에 관한 절차와 판단', '⑥~⑨'),
    ...shape, answer_slots: [{ id: 'sub3.answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '옳지 않은 것은 ⑥, ⑨이다. ⑦의 매출총이익과 기간귀속에 대한 절차와 ⑧의 장기차입금 조회는 기초잔액에 관한 감사증거를 제공하는 절차로 옳다.',
        '⑥ 당기 실사 결과를 기초 재고수량으로 조정한 결과는 기초 재고수량에 관한 증거이며 평가에 관한 증거를 대신하지 못하므로, 기초 재고자산 항목의 평가에 대한 감사절차를 따로 수행하여야 한다.',
        '⑨ 기초잔액에 당기재무제표에 중요하게 영향을 미칠 수 있는 왜곡표시가 포함되어 있다는 증거를 입수하였으므로, 당기재무제표에 대한 영향을 결정하기 위한 감사절차를 추가로 수행하고 왜곡표시가 있으면 경영진 및 지배기구와 커뮤니케이션하여야 한다.',
    ],
    requirements: [
        requirement('sub3.req1', 'kga510-A6', 'KGA 510 문단 A6·A7·7, KGA 500 문단 A32; 식별 기준: ⑥(실사 수량을 기초수량으로 조정한 결과로 기초 재고 평가에 관한 증거까지 입수했다고 결론), ⑨(당기재무제표에 중요하게 영향을 미칠 수 있는 기초잔액의 왜곡표시 증거를 전기 사항으로 보아 다루지 않음)는 옳지 않다. ⑦은 문단 A6, ⑧은 문단 A7에 따라 옳다.'),
        requirement('sub3.req2', 'kga500-A32', 'KGA 510 문단 A6, KGA 500 문단 A32; 적용: 당기 실사 입회와 기초 재고수량으로의 조정은 수량에 관한 증거이며, 재고자산의 실재성에 관한 증거는 평가에 관한 증거를 대체하지 않으므로 기초 재고자산 항목의 평가에 대한 감사절차를 수행한다.'),
        requirement('sub3.req3', 'kga510-7', 'KGA 510 문단 7; 적용: 기초잔액에 당기재무제표에 중요하게 영향을 미칠 수 있는 왜곡표시가 포함되어 있다는 증거를 입수하면 당기재무제표에 대한 영향을 결정하기 위한 감사절차를 추가로 수행하고, 왜곡표시가 있다고 결론 내리면 경영진 및 지배기구와 커뮤니케이션한다.'),
    ],
    criteria: [
        criterion('sub3.c1', 'conclusion', '옳지 않은 것으로 ⑥·⑨를 모두 지적한다. 번호 대신 내용으로 특정해도 인정한다. ⑥·⑨ 중 하나라도 빠뜨리거나, 옳은 것인 ⑦(기초 재고자산 증거를 위한 매출총이익률 분석과 기초 전후 기간귀속 테스트), ⑧(기초 장기차입금 잔액의 은행 조회와 차입약정서 대조)을 옳지 않다고 지적하면 이 점수는 주지 않는다.', ['kga510-A6', 'kga510-A7', 'kga510-7', 'kga500-A32']),
        criterion('sub3.c2', 'action', '⑥ 실사 수량을 기초 재고수량으로 조정한 결과는 기초 재고의 수량(실재성)에 관한 증거일 뿐 평가에 관한 증거를 대신하지 못하므로 기초 재고자산 항목의 평가에 대한 감사절차를 따로 수행해야 한다는 이유나 절차를 제시한다. 수량 조정은 평가에 관한 증거가 아니라는 이유와 평가 절차가 따로 필요하다는 절차 중 하나만 써도 인정하며, 구체적인 평가 절차의 예시는 요구하지 않는다. 수량 조정으로 평가에 관한 증거도 얻을 수 있다고 쓰면 인정하지 않는다.', ['kga510-A6', 'kga500-A32']),
        criterion('sub3.c3', 'action', '⑨ 기초잔액에 포함된 이 왜곡표시는 당기재무제표에 중요하게 영향을 미칠 수 있으므로 당기 감사에서 다뤄야 한다는 이유, 또는 당기재무제표에 대한 영향을 결정하기 위한 감사절차를 추가로 수행해야 한다는 절차를 제시한다. 이유와 절차 중 하나만 써도 인정하며, 왜곡표시가 있으면 경영진·지배기구와 커뮤니케이션해야 한다는 절차도 인정한다. 전기 사항이므로 다루지 않아도 된다고 쓰면 인정하지 않는다.', ['kga510-7']),
    ],
};

const sub4 = {
    id: 'sub4', type: 'judgment', question_style: 'case', topic_ids: ['09', '16', '15'],
    prompt: selectPrompt('감사보고서를 작성하는 단계의 판단', '⑩~⑫'),
    ...shape, answer_slots: [{ id: 'sub4.answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '옳지 않은 것은 ⑫이다. ⑩은 전임감사인의 의견변형을 초래한 사항이 당기에 해결되어 당기재무제표에 대한 의견과 관련성이 없으므로 옳고, ⑪은 전임감사인이 감사한 전기재무제표에 대해서는 기타사항문단에 기재하고 당기재무제표에 대하여 의견을 표명하므로 옳다.',
        '⑫ 전기재무제표를 전임감사인이 감사하였고 그 감사보고서가 재발행되지 않으므로, 기타사항문단에 전임감사인이 표명한 의견의 유형(한정의견)과 그 사유도 기재하여야 한다.',
    ],
    requirements: [
        requirement('sub4.req1', 'kga710-17', 'KGA 510 문단 13·A9, KGA 710 문단 2·17; 식별 기준: ⑫(기타사항문단에서 전임감사인이 표명한 의견의 유형과 사유를 뺌)는 옳지 않다. ⑩은 510.13·A9(전기 범위제한을 초래한 사항이 당기에 해결됨), ⑪은 710.17(당기재무제표에 대한 의견표명에 추가하여 기타사항문단에 기재)에 따라 옳다.'),
        requirement('sub4.req2', 'kga710-17', 'KGA 710 문단 2·17(b); 적용: 외부감사법에 따른 감사는 비교재무제표 방식으로 보고하며, 전임감사인이 감사한 전기재무제표의 감사보고서가 재발행되지 않으면 기타사항문단에 전임감사인이 표명한 의견의 유형과, 변형되었으면 그 사유를 기재한다.'),
    ],
    criteria: [
        criterion('sub4.c1', 'conclusion', '옳지 않은 것으로 ⑫를 지적한다. 번호 대신 내용으로 특정해도 인정한다. ⑫를 빠뜨리거나, 옳은 것인 ⑩(전임감사인의 한정의견을 초래한 사항이 당기 감사의견의 변형 사유가 되지 않는다는 판단), ⑪(당기재무제표에 대하여 의견을 표명하고 전임감사인이 감사한 전기재무제표에는 의견을 표명하지 않음)을 옳지 않다고 지적하면 이 점수는 주지 않는다.', ['kga710-17', 'kga710-2', 'kga510-13', 'kga510-A9']),
        criterion('sub4.c2', 'action', '⑫ 전기재무제표를 전임감사인이 감사하였고 그 감사보고서가 재발행되지 않으므로 기타사항문단에 전임감사인이 표명한 의견의 유형과, 의견이 변형되었으면 그 사유를 기재해야 한다는 이유나 절차를 제시한다. 한정의견이었다는 사실과 그 사유를 기재해야 한다는 설명도 인정한다. 의견의 유형이나 사유를 기재하지 않아도 된다고 쓰면 인정하지 않는다.', ['kga710-17', 'kga710-2']),
    ],
};

const p10 = original.classification;
const set = {
    schema_version: '3.0', id: 'case-09-initial-audit-20260915', type: 'linked_question_set', status: 'needs_review',
    title: '초도감사에서 기초잔액의 감사절차와 감사보고',
    classification: { topic_id: '09', part: p10.part, chapter: p10.chapter, domain: 'audit', standards: ['KGA 300', 'KGA 315', 'KGA 500', 'KGA 510', 'KGA 710'],
        tags: ['초도감사', '기초잔액', '전임감사인', '사례형'] },
    source_refs: refs, shared_context: { facts }, learning_order: ['sub1', 'sub2', 'sub3', 'sub4'], subquestions: [sub1, sub2, sub3, sub4],
    verification: { source_fidelity: 'reconstructed', review_status: 'needs_human_review', calculation_required: false, notes: [
        '2026-09-15 사용자가 지정한 사례형 검토에 따라 pilot-09-010을 새 세트로 재구성한 초안이다. 사용자 지시대로 물음 1은 착수·계획 단계의 절차 선택형, 물음 2는 자료별 경영진주장 열거형으로 바꾸고, 물음 3(기초재고)에는 당기 실사·수량변동 자료로 기초 재고자산 항목의 평가에 관한 증거를 입수했다는 함정을 두었으며, 물음 4(변형의견 계열)는 삭제하고 초도감사 요소를 사실관계에 맞게 더했다. 원 세트와의 대응은 같은 폴더의 lineage.json에 기록한다.',
        '사용자가 확정한 대상 연도는 2027년이다. 판본 정책에 따라 사례의 20X1년을 2026년 1월 1일 개시 보고기간으로 보고 2025 개정 전문을 기준으로 판단했다. KGA 300 문단 3, KGA 500 문단 3, KGA 510 문단 2, KGA 710 문단 4는 2026년 1월 1일 이후 개시하는 보고기간부터 시행한다. KGA 300 문단 13은 2025 전문 PDF 182쪽에서 새로 발췌해 등록했으며, 2026 전문은 개정 220의 정합 개정으로 같은 요구를 문단 12로 옮겼다(요구 내용 동일). 외부감사법에 따른 감사이므로 KGA 710 문단 2에 따라 비교재무제표 방식을 적용한다. 등록 전문(KGA 300 문단 13, KGA 510 문단 5·6·7·9·13·A6·A7·A9, KGA 500 문단 A32, KGA 315 문단 A190(b), KGA 710 문단 2·17)을 직접 대조했다.',
        '물음 1·3·4는 옳고 그름을 구분하는 선택형이다. 물음마다 옳지 않은 항목 전체를 정확히 고른 식별 1점, 옳지 않은 항목마다 이유 또는 보완절차 중 하나를 핵심 원칙 수준으로 쓴 1점을 둔다. 물음 2는 경영진주장마다 1점인 열거형이다. 함정 ①·②·④·⑦·⑧·⑩·⑪에는 별도 득점 기준이 없다.',
        'agent 내용검토·작성자 기대값과 실제 Luna 채점·사람 확인·정본 수록·운영 DB 반영은 별개이며 이 초안 생성으로 완료되지 않는다.',
    ] },
};
fs.writeFileSync(`${D}/sets.json`, JSON.stringify([set], null, 2) + '\n');
const chars = [...facts.map((f) => f.text).join('\n')].length;
console.log({ set: set.id, facts_characters: chars, points: set.subquestions.map((q) => q.criteria.length), sha256: createHash('sha256').update(fs.readFileSync(`${D}/sets.json`)).digest('hex') });
