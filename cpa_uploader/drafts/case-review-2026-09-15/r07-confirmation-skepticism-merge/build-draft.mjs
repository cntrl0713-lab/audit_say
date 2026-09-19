// 46·7·23번(case-09-confirmation-barrier-20260914, pilot-02-006, pilot-02-007) 병합 초안(외부조회 거부·전문가적 의구심·시간과 비용·고유한계 종합).
// 원문 인용은 현재 정본의 기존 인용과 등록 전문에서 그대로 복사한다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r07-confirmation-skepticism-merge/build-draft.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r07-confirmation-skepticism-merge';
const BANK = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const SET_ID = 'case-09-confirmation-skepticism-20260918';
const FILES = {
    s01: 'cpa_uploader/data/official/delegated-s01-kga200-210-220-320-2025.txt',
};
const ORIGINALS = { barrier: 'case-09-confirmation-barrier-20260914', skepticism: 'pilot-02-006', cost: 'pilot-02-007' };
const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const bank = JSON.parse(fs.readFileSync(BANK, 'utf8'));
const texts = Object.fromEntries(Object.entries(FILES).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));
for (const id of Object.values(ORIGINALS)) assert(bank.some((s) => s.id === id), id);
assert(!bank.some((s) => s.id === SET_ID), 'new set ID must not exist in the bank');
// 기존 인용을 해시 그대로 재사용한다. 제목만 문단·쪽·줄을 알 수 있게 다시 쓴다(같은 파일의 첫 수록 위치).
const reuse = (id, setId, refId, standard, paragraph, pdfPage) => {
    const ref = bank.find((s) => s.id === setId).source_refs.find((r) => r.id === refId);
    assert(ref && ref.content_hash === sha(ref.source_quote) && ref.page === standard, `${setId}/${refId}`);
    const text = fs.readFileSync(ref.file, 'utf8');
    const i = text.indexOf(ref.source_quote); assert(i >= 0, `${setId}/${refId}: 인용이 파일에 없음`);
    const first = text.slice(0, i).split('\n').length;
    const span = `L${first}-L${first + ref.source_quote.split('\n').length - 1}`;
    return { id, file: ref.file, title: `${standard} 문단 ${paragraph}, 2025 개정 전문 원문 PDF ${pdfPage}쪽; ${span}`, page: ref.page,
        source_quote: ref.source_quote, role: 'standard', content_hash: ref.content_hash };
};
// 원 세트 인용 끝의 쪽 머리말·다음 절 제목을 빼고 같은 등록본에서 문단 본문만 발췌한다.
const extract = (id, key, paragraph, pdfPage, start, end) => {
    const text = texts[key];
    const i = text.indexOf(start); const j = text.indexOf(end, i);
    assert(i >= 0 && j > i, `${id}: ${start}`);
    assert.equal(text.indexOf(start, i + 1), -1, `${id}: 시작 문구가 유일하지 않음`);
    const quote = text.slice(i, j + end.length);
    const first = text.slice(0, i).split('\n').length;
    const span = `L${first}-L${first + quote.split('\n').length - 1}`;
    return { id, file: FILES[key], title: `KGA 200 문단 ${paragraph}, 2025 개정 전문 원문 PDF ${pdfPage}쪽; ${span}`, page: 'KGA 200', source_quote: quote, role: 'standard', content_hash: sha(quote) };
};

const refs = [
    reuse('kga505-8', ORIGINALS.barrier, 'src-32f27450c2d0f4b4a2', 'KGA 505', '8', 402),
    reuse('kga505-9', ORIGINALS.barrier, 'src-ae9fdd747aceba7928', 'KGA 505', '9', 403),
    reuse('kga505-13', ORIGINALS.barrier, 'src-9df7a60acde69be92e', 'KGA 505', '13', 403),
    reuse('kga505-A20', ORIGINALS.barrier, 'src-d7c0dcd0f3e6fc9baf', 'KGA 505', 'A20', 408),
    reuse('kga200-A21', ORIGINALS.skepticism, 'src-6640f5c854f47da022', 'KGA 200', 'A21', 17),
    reuse('kga200-A23', ORIGINALS.skepticism, 'src-f07581097048ae85fe', 'KGA 200', 'A23', 18),
    reuse('kga200-A24', ORIGINALS.skepticism, 'src-4f9de7bfdd1eca2117', 'KGA 200', 'A24', 18),
    reuse('kga200-A25', ORIGINALS.skepticism, 'src-78a78674e7c0cc7e26', 'KGA 200', 'A25', 18),
    extract('kga200-A53', 's01', 'A53', 24, 'A53. 어려움, 시간 또는 비용의 문제 그 자체는', '실행가능하지 않다는 것을 인식한다.'),
    extract('kga200-A54', 's01', 'A54', 24, 'A54. 따라서, 감사인은 다음과 같은 절차를', '테스트나 기타 수단을 사용함'),
    extract('kga200-A57', 's01', 'A57', 25, 'A57. 감사가 감사기준에 따라 적절하게', '적합성에 의해 결정된다.'),
];
const quote = (id) => refs.find((r) => r.id === id).source_quote;

const facts = [
    { id: 'fact1', text: '누리회계법인은 하람회사의 20X1년 1월 1일부터 12월 31일까지의 재무제표를 감사한다. 하람회사는 20X1년 12월 새 거래처인 가온상사와 특별 판매약정을 맺고 거액의 매출과 매출채권을 기록하였다. 이 약정에 일반 판매계약과 다른 반품·대금지급 조건이 있는지는 매출의 인식과 매출채권의 회수권리를 판단하는 데 중요하다. 최종 서명된 약정 원본은 가온상사만 보관하고 있으며, 하람회사는 원본을 보관하지 않았고 약정의 조건을 확인할 수 있는 다른 외부 기록도 없다. 하람회사는 일반 판매를 회계시스템에서 처리하고, 가온상사를 비롯한 몇몇 거래처와 맺은 특별약정은 회계시스템 밖의 약정 요약파일로 관리한다. 요약파일의 가온상사 약정 항목에는 반품 및 지급 조건이 비어 있다.' },
    { id: 'fact2', text: [
        '20X2년 1월 기말감사에서 감사팀은 결산 직전 판매담당자와 재무담당이사가 같은 관리자 계정으로 요약파일의 가온상사 약정 항목을 여러 차례 수정한 기록을 발견하였다. 반품 조건에 관하여 판매담당자는 가온상사가 일정 기간 안에 반품할 수 있다고 설명하였고, 재무담당이사는 반품 조건이 없다고 설명하였다. 감사팀이 가온상사에 반품·지급 조건을 확인하는 적극적 조회서를 보내려 하자, 재무담당이사는 가온상사가 확인 요청을 싫어해 거래관계가 나빠질 것이라며 발송을 거부하였다. 이후 감사팀의 절차와 판단은 다음과 같다.',
        '① 감사팀은 재무담당이사에게 발송을 거부하는 사유를 질문하고, 그 답변을 조서에 기록한 뒤 거래관계에 관한 경영진의 판단을 존중하여 그 사유를 받아들였다.',
        '② 팀장은 재무담당이사가 지난 여러 해의 감사에서 질문에 성실하게 답해 왔다는 점을 들어, 반품 조건에 관한 두 사람의 설명 가운데 재무담당이사의 설명을 감사증거로 채택하였다.',
        '③ 감사팀은 관리자 계정의 공동 사용과 결산 직전의 반복 수정, 두 사람의 서로 다른 설명, 발송 거부가 함께 나타났으므로, 부정 여부를 확인하기 전에 가온상사 매출의 발생과 기간귀속에 관한 부정위험 평가를 높이고 요약파일로 관리되는 다른 특별약정에 대한 감사절차의 범위를 넓혔다.',
        '④ 감사팀은 발송 거부에 대응하여 회사가 보관한 출고증과 가온상사가 일부 입금한 대금 내역을 대조하였고, 그 결과에 근거하여 반품·지급 조건에 관한 결론을 내리기로 하였다.',
        '⑤ 감사팀은 요약파일로 관리되는 특별약정에 감사노력을 집중하고, 회계시스템에서 처리되는 일반 판매는 모든 거래를 추적하는 대신 위험평가 결과에 따라 추출한 표본을 테스트하였다.',
    ].join('\n') },
    { id: 'fact3', text: [
        '재무담당이사는 끝까지 조회서 발송을 허용하지 않았고, 감사팀은 20X2년 2월 말까지 가온상사의 회신을 입수하지 못하였다. 하람회사의 지배기구에는 경영에 참여하지 않는 구성원이 있다. 업무 종결 단계에서 업무수행이사의 조치와 판단은 다음과 같다.',
        '⑥ 업무수행이사는 발송 거부로 가온상사의 회신을 입수하지 못한 사실을 대표이사와 재무담당이사에게 서면으로 알렸다.',
        '⑦ 업무수행이사는 증거를 더 입수하려면 감사보고서 제출기한을 넘기고 감사 예산도 초과하게 되므로, 가온상사 약정의 조건에 관하여 지금까지 입수한 증거로 충분하다고 보고 감사를 종결하기로 하였다.',
    ].join('\n') },
    { id: 'fact4', text: [
        '누리회계법인은 20X2년 3월 하람회사의 감사보고서를 발행하였다. 20X2년 7월 기존 거래처인 나래상사의 직원과 하람회사의 영업직원이 공모하여 20X1년에 허위 매출을 기록하고 감사인에게 보낸 조회 회신까지 조작한 사실이 밝혀졌으며, 이로 인해 20X1년 재무제표에 중요한 왜곡표시가 있었음이 확인되었다. 20X1년 감사에서 감사팀은 나래상사에 적극적 조회를 수행하였고, 받은 회신은 장부와 일치하였다. 이에 관한 법인 내부의 판단은 다음과 같다.',
        '⑧ 법인의 품질관리실은 감사보고서 발행 후 중요한 왜곡표시가 발견되었다는 사실만으로는 나래상사 매출에 관한 당시 감사가 감사기준에 따라 수행되지 않았다고 판단할 수 없다고 보았다.',
        '⑨ 업무수행이사는 공모자들이 조회 회신까지 정교하게 조작하였다는 점에 비추어, 나래상사 매출에 관한 당시 감사가 감사기준에 따라 수행되었다고 결론 내렸다.',
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
// 조사는 번호의 읽기에 맞춘다(④ 사·⑨ 구·⑤ 오 → 를, ⑧ 팔 → 을).
const identification = (wrong, wrongParticle, right, rightParticle) => `옳지 않은 것으로 ${wrong}${wrongParticle} 모두 지적한다. 번호 대신 내용으로 특정해도 인정한다. ${wrong} 중 하나라도 빠뜨리거나, 옳은 것인 ${right}${rightParticle} 옳지 않다고 지적하면 이 점수는 주지 않는다.`;

const sub1 = {
    id: 'sub1', type: 'judgment', question_style: 'case', topic_ids: ['09', '02', '08'],
    prompt: selectPrompt('기말감사 중 감사팀의 절차와 판단', '①~⑤'),
    ...shape, answer_slots: [{ id: 'sub1.answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '옳지 않은 것은 ①, ②, ④이다. ③은 관리자 계정의 공동 사용과 반복 수정, 서로 다른 설명, 발송 거부가 부정의 가능성을 나타낼 수 있는 상황이므로 부정 여부가 확인되기 전이라도 부정위험 평가와 다른 감사절차에 대한 시사점을 반영한 것이고, ⑤는 모든 사항을 누락 없이 추적하는 것은 실행가능하지 않으므로 위험이 높은 분야에 감사노력을 집중하고 나머지는 표본으로 테스트한 것이므로 옳다.',
        '① 경영진이 조회서 발송을 거부하면 그 사유를 질문하는 데 그치지 않고, 가온상사의 요청이나 관련 교신 등 거부 사유의 타당성과 합리성에 관한 감사증거를 구하여야 한다.',
        '② 경영진의 정직성에 대한 과거의 경험이 있더라도 전문가적 의구심을 유지할 필요성이 줄거나 설득력이 낮은 감사증거에 만족할 수 있는 것은 아니므로, 두 사람의 서로 다른 설명에 의문을 갖고 추가 증거로 조사하여 해소하여야 한다.',
        '④ 약정 조건은 가온상사가 보관한 원본 등 기업 외부에서만 확인할 수 있고, 관리자 계정의 공동 사용과 반복 수정 등으로 회사에서 입수한 자료를 신뢰할 수 없으므로 적극적 조회에 대한 회신이 필요하다. 출고증과 입금 내역의 대조 같은 대체적 감사절차로는 필요한 감사증거를 얻을 수 없다.',
    ],
    requirements: [
        requirement('sub1.req1', 'kga505-8', 'KGA 505 문단 8·13·A20, KGA 200 문단 A21·A23·A24·A25·A53·A54; 식별 기준: ①(거부 사유를 질문·기록한 뒤 경영진의 판단을 존중하여 받아들임), ②(과거의 성실한 답변을 이유로 서로 다른 두 설명 가운데 재무담당이사의 설명을 채택), ④(출고증과 일부 입금 내역의 대조 결과로 반품·지급 조건의 결론을 내림)은 옳지 않다. ③은 KGA 505 문단 8(b)와 KGA 200 문단 A21·A24(부정의 가능성을 나타낼 수 있는 상황에서 부정위험을 포함한 위험평가와 다른 감사절차의 성격·시기·범위에 대한 시사점을 평가), ⑤는 KGA 200 문단 A53·A54(모든 사항을 누락 없이 추적하는 것은 실행가능하지 않으며 위험이 가장 높게 예상되는 분야에 감사노력을 집중하고 테스트로 모집단을 조사)에 따라 옳다.'),
        requirement('sub1.req2', 'kga505-8', 'KGA 505 문단 8(a); 적용: 경영진이 조회서 발송을 거부하면 거부 사유를 질문하고 그 타당성과 합리성에 관하여 감사증거를 구한다. 답변의 기록이나 경영진 판단의 존중은 이를 대신하지 못한다.'),
        requirement('sub1.req3', 'kga200-A25', 'KGA 200 문단 A23·A24·A25; 적용: 경영진의 정직성과 성실성에 대한 과거의 경험이 있어도 전문가적 의구심을 유지할 필요성이 경감되거나 설득력이 낮은 감사증거에 만족할 수 없으며, 서로 다른 설명(상반된 감사증거와 질의에 대한 답변)의 신뢰성에 의문을 품고 더 조사하여 해결한다.'),
        requirement('sub1.req4', 'kga505-13', 'KGA 505 문단 13·A20; 적용: 약정 조건을 확인할 정보가 기업 외부(가온상사가 보관한 원본)에서만 입수 가능하고, 관리자 계정의 공동 사용과 반복 수정·서로 다른 설명 등 특정 부정위험요소 때문에 회사에서 입수한 증거를 신뢰할 수 없으므로 적극적 조회에 대한 회신이 필요하다. 이 경우 출고증과 입금 내역의 대조 같은 대체적 감사절차는 필요한 감사증거를 제공하지 못한다.'),
    ],
    criteria: [
        criterion('sub1.c1', 'conclusion', identification('①·②·④', '를', '③(관리자 계정의 공동 사용과 반복 수정, 서로 다른 설명, 발송 거부가 함께 나타나자 부정 여부를 확인하기 전에 부정위험 평가를 높이고 다른 특별약정에 대한 감사절차의 범위를 넓힘), ⑤(특별약정에 감사노력을 집중하고 일반 판매는 모든 거래를 추적하는 대신 위험평가 결과에 따라 추출한 표본을 테스트)', '를'),
            ['kga505-8', 'kga505-13', 'kga505-A20', 'kga200-A21', 'kga200-A23', 'kga200-A24', 'kga200-A25', 'kga200-A53', 'kga200-A54']),
        criterion('sub1.c2', 'action', '① 경영진이 조회서 발송을 거부하면 사유를 질문하고 기록하는 데 그치지 않고, 가온상사의 요청이나 관련 교신 등 그 사유의 타당성과 합리성에 관한 감사증거를 구해야 한다는 이유나 절차를 제시한다. 질문과 답변의 기록만으로는 거부 사유가 타당하고 합리적인지 확인할 수 없다는 이유와, 거부 사유를 뒷받침하는 감사증거를 입수해야 한다는 절차 중 하나만 써도 인정하며 증거의 구체적 종류는 요구하지 않는다. 거래관계에 관한 경영진의 판단이면 증거 없이 받아들여도 된다고 쓰면 인정하지 않는다.', ['kga505-8']),
        criterion('sub1.c3', 'action', '② 경영진의 정직성과 성실성에 대한 과거의 경험이 있더라도 전문가적 의구심을 유지할 필요성이 줄거나 설득력이 낮은 감사증거에 만족할 수 있는 것은 아니라는 이유나, 두 사람의 서로 다른 설명에 의문을 갖고 추가 증거로 조사하여 해소해야 한다는 절차를 제시한다. 둘 중 하나만 써도 인정한다. 과거에 성실하게 답해 온 경영진의 설명은 그대로 채택할 수 있다고 쓰면 인정하지 않는다.', ['kga200-A25', 'kga200-A23', 'kga200-A24']),
        criterion('sub1.c4', 'action', '④ 약정 조건은 가온상사가 보관한 원본 등 기업 외부에서만 확인할 수 있거나, 관리자 계정의 공동 사용과 반복 수정 등 부정위험요소 때문에 회사에서 입수한 자료를 신뢰할 수 없으므로 적극적 조회에 대한 회신이 필요하고, 출고증과 입금 내역의 대조 같은 대체적 감사절차로는 필요한 감사증거를 얻을 수 없다는 이유나 절차를 제시한다. 적극적 조회 회신이 필요한 두 사정 중 하나만 들어도 인정하며, 출고증과 입금 내역이 반품·지급 조건을 확인해 주지 못한다는 이유나 적극적 조회에 대한 회신을 입수해야 한다는 절차도 인정한다. 출고증과 입금 내역을 대조하면 약정 조건에 관한 충분한 증거가 된다고 쓰면 인정하지 않는다.', ['kga505-13', 'kga505-A20']),
    ],
};

const sub2 = {
    id: 'sub2', type: 'judgment', question_style: 'case', topic_ids: ['09', '02', '08'],
    prompt: selectPrompt('업무 종결 단계와 감사보고서 발행 후의 조치와 판단', '⑥~⑨'),
    ...shape, answer_slots: [{ id: 'sub2.answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '옳지 않은 것은 ⑥, ⑦, ⑨이다. ⑧은 감사의 고유한계 때문에 감사기준에 따라 적절히 계획하고 수행한 감사에서도 중요한 왜곡표시가 발견되지 않을 수 있으므로, 사후에 중요한 왜곡표시가 발견되었다는 사실만으로 감사기준을 따르지 않았다고 볼 수 없다는 판단이어서 옳다.',
        '⑥ 경영진의 발송 거부로 필요한 회신과 감사증거를 입수하지 못한 상황은 대표이사와 재무담당이사에게 알리는 데 그치지 않고 지배기구와 커뮤니케이션하여야 한다.',
        '⑦ 시간이나 비용의 문제 그 자체는 설득력이 낮은 감사증거에 만족하는 정당한 근거가 되지 못한다. 필요한 적극적 조회 회신을 입수하지 못했으므로 감사기준서 705에 따라 해당 감사와 감사의견에 대한 시사점을 결정하여야 한다.',
        '⑨ 감사기준에 따라 감사를 수행하였는지는 당시 수행한 감사절차, 입수한 감사증거의 충분성과 적합성, 그 증거의 평가에 기초한 감사보고서의 적합성에 의해 결정되므로, 조작이 정교했다는 사실만으로 결론 내릴 수 없고 이를 검토하여 판단하여야 한다.',
    ],
    requirements: [
        requirement('sub2.req1', 'kga200-A57', 'KGA 505 문단 9·13, KGA 200 문단 A53·A57; 식별 기준: ⑥(회신을 입수하지 못한 사실을 대표이사와 재무담당이사에게 서면으로 알림), ⑦(제출기한과 예산을 이유로 지금까지 입수한 증거로 충분하다고 보고 감사를 종결), ⑨(조작이 정교했다는 점을 들어 당시 감사가 감사기준에 따라 수행되었다고 결론)은 옳지 않다. ⑧은 KGA 200 문단 A57(감사의 고유한계 때문에 적절히 계획·수행된 감사에서도 중요한 왜곡표시가 발견되지 않을 수 있으므로, 차후에 발견되었다는 사실 자체만으로 감사기준에 따른 감사를 수행하지 못했다는 것을 의미하지 않음)에 따라 옳다.'),
        requirement('sub2.req2', 'kga505-9', 'KGA 505 문단 9·13; 적용: 적극적 조회에 대한 회신이 필요한 경우 대체적 감사절차로는 필요한 증거를 얻을 수 없으므로, 경영진의 발송 거부로 회신과 관련성 있고 신뢰할 수 있는 증거를 입수하지 못한 상황은 감사기준서 260에 따라 지배기구와 커뮤니케이션한다. 지배기구에 경영에 참여하지 않는 구성원이 있으므로 대표이사와 재무담당이사에 대한 통보로 대신할 수 없다.'),
        requirement('sub2.req3', 'kga200-A53', 'KGA 200 문단 A53, KGA 505 문단 9·13; 적용: 어려움, 시간 또는 비용의 문제 그 자체는 설득력이 낮은 감사증거에 만족하는 정당한 근거가 되지 못하며, 필요한 적극적 조회 회신을 입수하지 못하면 감사기준서 705에 따라 해당 감사와 감사의견에 대한 시사점을 결정한다.'),
        requirement('sub2.req4', 'kga200-A57', 'KGA 200 문단 A57; 적용: 감사기준에 따라 감사를 수행하였는지는 각 상황에서 수행한 감사절차, 그 결과 입수한 감사증거의 충분성과 적합성, 감사인의 전반적인 목적에 비추어 그 증거를 평가한 결과에 기초한 감사보고서의 적합성에 의해 결정된다. 공모와 조작이 정교했다는 사실만으로 정해지지 않는다.'),
    ],
    criteria: [
        criterion('sub2.c1', 'conclusion', identification('⑥·⑦·⑨', '를', '⑧(감사보고서 발행 후 중요한 왜곡표시가 발견되었다는 사실만으로는 당시 감사가 감사기준에 따라 수행되지 않았다고 판단할 수 없다고 봄)', '을'),
            ['kga505-9', 'kga505-13', 'kga200-A53', 'kga200-A57']),
        criterion('sub2.c2', 'action', '⑥ 경영진의 발송 거부로 필요한 회신과 감사증거를 입수하지 못한 상황은 대표이사와 재무담당이사에게 알리는 데 그치지 않고 지배기구와 커뮤니케이션해야 한다는 이유나 절차를 제시한다. 지배기구에 알려야 한다는 취지면 커뮤니케이션의 형식이나 시기는 요구하지 않는다. 경영진에게 서면으로 알리면 충분하다고 쓰면 인정하지 않는다.', ['kga505-9']),
        criterion('sub2.c3', 'action', '⑦ 시간·비용·어려움의 문제 그 자체는 설득력이 낮은 감사증거에 만족하는 정당한 근거가 되지 못한다는 이유나, 필요한 적극적 조회 회신을 입수하지 못했으므로 감사기준서 705에 따라 해당 감사와 감사의견에 대한 시사점(의견변형의 필요성)을 결정해야 한다는 절차를 제시한다. 둘 중 하나만 써도 인정하며, 한정의견과 의견거절 중 하나를 확정할 필요는 없다. 제출기한이나 예산 때문이라면 지금까지의 증거로 감사를 종결해도 된다고 쓰거나, 왜곡표시가 확인되지 않았으므로 적정의견을 표명하면 된다고 쓰면 인정하지 않는다.', ['kga200-A53', 'kga505-13', 'kga505-9']),
        criterion('sub2.c4', 'action', '⑨ 감사기준에 따라 감사를 수행하였는지는 당시 수행한 감사절차, 입수한 감사증거의 충분성과 적합성, 그 증거의 평가에 기초한 감사보고서의 적합성에 의해 결정된다는 이유나, 이를 검토하여 판단해야 한다는 절차를 제시한다. 세 측면을 모두 나열할 필요는 없으며, 당시 수행한 감사절차나 입수한 감사증거를 검토해야 한다는 취지나, 감사의 고유한계가 설득력이 부족한 감사증거에 만족하는 것을 정당화하지 않는다는 이유도 인정한다. 공모와 조작이 정교했다는 사실만으로 감사가 감사기준에 따라 수행되었다고 볼 수 있다고 쓰면 인정하지 않는다.', ['kga200-A57']),
    ],
};

const p = bank.find((s) => s.id === ORIGINALS.barrier).classification;
const set = {
    schema_version: '3.0', id: SET_ID, type: 'linked_question_set', status: 'needs_review',
    title: '특별 판매약정의 외부조회와 감사증거 평가',
    classification: { topic_id: '09', part: p.part, chapter: p.chapter, domain: 'audit', standards: ['KGA 200', 'KGA 505'],
        tags: ['외부조회', '전문가적 의구심', '사례형'] },
    source_refs: refs, shared_context: { facts }, learning_order: ['sub1', 'sub2'], subquestions: [sub1, sub2],
    verification: { source_fidelity: 'reconstructed', review_status: 'needs_human_review', calculation_required: false, notes: [
        '2026-09-18 사용자가 지정한 사례형 검토에 따라 case-09-confirmation-barrier-20260914(46번), pilot-02-006(7번), pilot-02-007(23번)의 사례형 물음을 하나의 종합 사례로 합친 초안이다. 정답을 암시하던 사실·발문·등장인물의 주장을 없애고, 감사인이 수행한 절차·판단 중 옳지 않은 것을 골라 이유나 보완절차를 간략히 쓰는 선택형으로 바꾸었다. 사용자 결정에 따라 원 세 세트는 pilot-02-006의 기준서형 물음(전문가적 의구심의 정의)까지 모두 퇴역 대상이다. 원 세트와의 대응은 같은 폴더의 lineage.json에 기록한다.',
        '사용자가 확정한 대상 연도는 2027년이다. 판본 정책에 따라 사례의 20X1년을 2026년 1월 1일 개시 보고기간으로 보고 2025 개정 전문을 기준으로 판단했다. 2026 전문(2026년 7월 개정)과 대조한 결과 KGA 200 문단 A21·A23·A24·A25·A53·A54·A57과 KGA 505 문단 8~13·A8~A10·A20의 본문이 같다(A24는 각주 번호만 다름). 등록 전문의 인용을 직접 대조했다.',
        '두 물음 모두 옳고 그름을 구분하는 선택형이다. 물음마다 옳지 않은 항목 전체를 정확히 고른 식별 1점, 옳지 않은 항목마다 이유 또는 보완절차 중 하나를 핵심 원칙 수준으로 쓴 1점을 둔다. 옳은 항목 ③·⑤·⑧에는 별도 득점 기준이 없다.',
        'agent 내용검토·작성자 기대값과 실제 Luna 채점·사람 확인·정본 수록·운영 DB 반영은 별개이며 이 초안 생성으로 완료되지 않는다.',
    ] },
};
fs.writeFileSync(`${D}/sets.json`, JSON.stringify([set], null, 2) + '\n');
const chars = [...facts.map((f) => f.text).join('\n')].length;
assert(chars >= 400, 'facts must be at least 400 characters');
console.log({ set: set.id, facts_characters: chars, points: set.subquestions.map((q) => q.criteria.length), sha256: createHash('sha256').update(fs.readFileSync(`${D}/sets.json`)).digest('hex') });
