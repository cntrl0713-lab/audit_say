// 60·21 사례 병합 초안(기타정보 종합). 원문 인용은 현재 정본의 원 세트와 등록 전문에서 그대로 복사한다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r02-other-information-merge/build-draft.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r02-other-information-merge';
const BANK = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const KGA720 = 'cpa_uploader/data/official/kga701-706-710-720-2025-review16.txt';
const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const bank = JSON.parse(fs.readFileSync(BANK, 'utf8'));
const text = fs.readFileSync(KGA720, 'utf8');
const original = (id) => { const set = bank.find((s) => s.id === id); assert(set, id); return set; };
const from = (setId, refId) => original(setId).source_refs.find((r) => r.id === refId);
const between = (start, end) => {
    const i = text.indexOf(start); const j = text.indexOf(end, i);
    assert(i >= 0 && j > i, start); return text.slice(i, j + end.length);
};
const lines = (quote) => {
    const i = text.indexOf(quote); assert(i >= 0);
    const first = text.slice(0, i).split('\n').length; return `L${first}-L${first + quote.split('\n').length - 1}`;
};
const reuse = (id, setId, refId) => {
    const ref = from(setId, refId); assert(ref && ref.content_hash === sha(ref.source_quote), refId);
    return { id, file: ref.file, title: ref.title, page: ref.page, source_quote: ref.source_quote, role: 'standard', content_hash: ref.content_hash };
};
const extract = (id, paragraph, start, end) => {
    const quote = between(start, end);
    return { id, file: KGA720, title: `KGA 720 문단 ${paragraph}, 2025 개정 전문 원문 PDF; ${lines(quote)}`, page: 'KGA 720', source_quote: quote, role: 'standard', content_hash: sha(quote) };
};

const C60 = 'case-16-other-information-cause-20260914', P21 = 'pilot-16-011';
const refs = [
    extract('kga720-6', '6', '6. 해당 보고 책임을 제외한', '적용된다.'),
    extract('kga720-7b8', '7(b)·8', '(b) 투자설명서를 포함한 증권 공모서류', '확신을 얻을 의무를 부과하지 않는다.'),
    extract('kga720-12b', '12(b)', '(b) 기타정보 – 기업의 사업보고서에', '(문단 A8-A10 참조)'),
    extract('kga720-13', '13', '13. 감사인은 다음 절차를 수행하여야 한다', '(문단 A22 참조)'),
    extract('kga720-14', '14', '14. 감사인은 기타정보를 열람하여야 하며', '(문단 A30-A36 참조)'),
    extract('kga720-15', '15', '15. 문단 14에 따라 기타정보를 열람할 때', '(문단 A24, A37-A38 참조)'),
    reuse('kga720-16', C60, 'src-ec497f319eccccaa60'),
    reuse('kga720-18', P21, 'src-87e1a65de652b59563'),
    reuse('kga720-19', P21, 'src-31015981441beec8fd'),
    reuse('kga720-20', C60, 'src-61b7759438dd4828fe'),
    extract('kga720-21', '21', '21. 감사보고서일에 다음에 해당하는 경우', '(문단 A52 참조)'),
    reuse('kga720-22', P21, 'src-747e9524404bc23daa'),
    reuse('kga720-A45', P21, 'src-0f589d9cb1f0fd052e'),
    reuse('kga720-A49', P21, 'src-97d5f9a4653f4d9b60'),
    reuse('kga720-A50', P21, 'src-d6306fef8876326b2c'),
    reuse('kga705-7', C60, 'src-28ff5f1beeda3219cf'),
    reuse('kga315-37', C60, 'src-9dc3ef023abb077fff'),
    reuse('kga330-6', C60, 'src-b49e40067ef7ebb817'),
];
const quote = (id) => refs.find((r) => r.id === id).source_quote;

const facts = [
    { id: 'fact1', text: '한결회계법인은 주권상장법인 세온회사의 20X1년 1월 1일부터 12월 31일까지의 재무제표를 감사하고 있다. 세온회사의 직전 사업연도말 자산총액은 8천억원이며, 감사보고서일은 20X2년 3월 중순으로 예정되어 있다. 세온회사는 금융감독원에 제출하는 사업보고서와 별도로 정기주주총회에서 주주에게 배포할 연차보고서를 매년 작성한다. 두 문서에는 모두 재무제표와 감사보고서가 포함되며 회사의 영업과 재무성과가 설명된다. 사업보고서는 감사보고서일 전에, 연차보고서는 감사보고서일 후에 완성될 예정이다. 세온회사는 20X1년 중 신주를 발행하면서 투자설명서도 작성하였다.' },
    { id: 'fact2', text: [
        '감사보고서일 전에 감사팀이 수행한 절차와 판단은 다음과 같다.',
        '① 감사팀은 경영진과 논의하여 사업보고서와 연차보고서의 구성과 발행 시기를 확인하고, 연차보고서의 최종본을 주주에게 배포하기 전에 감사인에게 제공하겠다는 서면진술을 경영진에게 요청하였다.',
        '② 감사팀은 투자설명서에도 재무정보가 포함되어 있으므로 투자설명서를 기타정보로 보아 열람하고, 감사보고서의 기타정보 단락에서 이를 식별하기로 하였다.',
        '③ 사업보고서는 대리점에 보낸 상품의 일부를 대리점이 판매할 때까지 회사가 책임지는 위탁상품이라고 설명하는 반면, 재무제표에는 그 상품을 발송일에 전액 매출로 기록하였다. 감사팀은 재무제표 감사절차를 대부분 마친 상태에서 이 차이를 경영진과 논의하고, 대리점 계약조건과 기말 판매내역을 조사하여 재무제표와 사업보고서 중 어느 쪽에 수정이 필요한지 판단하기로 하였다.',
        '④ 사업보고서에는 특수제품 공장이 11월부터 가동을 중단하였다고 기재되어 있고, 감사팀이 입수한 행정명령서와 생산기록도 이와 일치하였다. 감사팀은 이 기재가 사실이므로 기타정보에 문제가 없다고 보고, 공장의 정상 가동과 특수제품 재고의 계속 판매를 전제로 세운 재고 감사계획을 그대로 수행하였다.',
        '⑤ 감사팀은 사업보고서 중 지배구조와 환경경영에 관한 설명은 재무제표나 감사에서 얻은 지식과 관련이 없으므로 감사인이 고려할 대상이 아니라고 보고, 그 부분은 읽지 않았다.',
    ].join('\n') },
    { id: 'fact3', text: [
        '감사보고서를 작성하는 단계에서 확인된 사항은 다음과 같다. ③의 조사 결과, 기말 현재 대리점이 판매하지 않은 위탁상품을 발송일에 매출로 기록한 것은 적용 재무보고체계에 어긋나 매출과 매출채권이 중요하게 과대계상된 것으로 확인되었다. 이에 대한 감사증거는 충분하고 적합하며, 그 영향은 매출·매출채권과 이에 직접 관련된 항목에 국한되어 재무제표의 상당한 부분을 차지하지 않는다. 경영진은 재무제표의 수정을 거부하였다. 한편 사업보고서의 경영성과 설명은 재무제표에 반영된 영업손실을 영업이익으로 서술하고 있어, 감사팀은 기타정보에 중요한 왜곡표시가 있다고 결론 내렸다. 경영진과 지배기구에 수정을 요구하였으나 수정되지 않았다. 감사팀은 수정 거부 사유를 검토한 결과 경영진이나 지배기구의 성실성, 감사 중 입수한 진술의 신뢰성에 의문을 가질 사정은 발견하지 못하였으며, 관련 법규상 감사계약은 해지할 수 없다.',
        '⑥ 감사팀은 매출 과대계상이 사업보고서와의 차이를 계기로 발견된 사항이므로 감사보고서의 기타정보 단락에 이를 기술하고, 재무제표에 대하여는 적정의견을 표명하기로 하였다.',
        '⑦ 감사팀은 영업손익 설명의 수정 거부를 재무제표 감사의견을 변형하는 사유로 보지 않았으며, 감사보고서에서 이 왜곡표시를 어떻게 다룰 계획인지 지배기구와 커뮤니케이션하였다.',
        '⑧ 감사팀은 영업손익 설명의 왜곡표시를 이미 지배기구와 커뮤니케이션하였으므로, 기타정보 단락에는 보고할 사항이 없다고 기재하기로 하였다.',
        '⑨ 기타정보 단락에는 감사보고서일 전에 입수한 사업보고서와 함께, 감사보고서일 후에 입수할 것으로 예상되는 연차보고서를 식별하였다.',
    ].join('\n') },
    { id: 'fact4', text: [
        '감사보고서일 후의 절차와 판단은 다음과 같다.',
        '⑩ 감사팀은 주주 배포 전에 제공받은 연차보고서 최종본을 열람하였다. 연차보고서에는 주요 차입금을 모두 상환했다고 기재되어 있었고, 감사팀은 그 차입금이 여전히 남아 있음을 확인하여 기타정보에 중요한 왜곡표시가 있다고 결론 내렸다. 감사팀은 경영진에게 수정을 요구하였고, 수정되지 않자 지배기구와 커뮤니케이션하여 수정을 요구하였다.',
        '⑪ 연차보고서가 수정되지 않은 채 주주에게 배포되자, 감사팀은 감사보고서일이 이미 지났으므로 추가 조치 없이 이 사항을 종결하였다.',
    ].join('\n') },
].map((fact) => ({ ...fact, scoreable: false }));

const one = { met: 1, not_met: 0, contradicted: 0 };
const criterion = (id, type, claim, refIds) => ({
    id, requirement_id: id.replace(/\.c(\d+)$/u, '.req$1'), claim,
    critical_facts: [{ id: `${id}.fact`, type, expected: claim }], max_points: 1, scores: { ...one }, source_ref_ids: refIds,
});
const requirement = (id, refId, span) => ({ id, source_ref_id: refId, source_quote: quote(refId), source_span: span });
const shape = { constraints: { ordered: false, max_entries: null, overflow_policy: 'none' }, selection: { type: 'all', n: null }, decision: null };

const sub1 = {
    id: 'sub1', type: 'judgment', question_style: 'case', topic_ids: ['16', '06', '07'],
    prompt: '감사보고서일 전에 감사팀이 수행한 절차와 판단 ①~⑤ 중 감사기준에 비추어 옳지 않은 것을 모두 찾아 번호를 쓰고, 각각에 대하여 옳지 않은 이유나 감사팀이 수행하였어야 할 절차를 간략히 서술하시오.',
    ...shape, answer_slots: [{ id: 'sub1.answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '옳지 않은 것은 ②, ④, ⑤이다. ①은 감사보고서일 후에 완성되는 문서의 최종본을 발행 전에 받기 위한 절차이고, ③은 기타정보와 재무제표의 중요한 불일치로 보이는 사항을 경영진과 논의하고 어느 쪽이 왜곡표시되었는지 결론 내리기 위한 절차이므로 옳다.',
        '② 투자설명서를 포함한 증권 공모서류는 기타정보에 관한 감사기준서의 적용 대상이 아니므로 기타정보로 보거나 기타정보 단락에서 식별할 수 없다.',
        '④ 가동중단은 정상 가동을 전제로 한 감사인의 기존 이해·위험평가와 다르므로, 기업과 기업환경에 대한 이해를 갱신하고 특수제품 재고 평가의 위험평가와 감사절차를 수정하여야 한다.',
        '⑤ 재무제표나 감사에서 얻은 지식과 관련이 없는 기타정보도 열람하면서 중요하게 왜곡표시된 것으로 보이는 징후에 주의를 기울여야 한다.',
    ],
    requirements: [
        requirement('sub1.req1', 'kga720-16', 'KGA 720 문단 13·7(b)·12(b)·16·20·14·15; 식별 기준: ②(투자설명서를 기타정보로 봄), ④(가동중단 정보에도 기존 이해·위험평가를 유지), ⑤(관련 없는 기타정보를 읽지 않음)는 옳지 않다. ①은 문단 13(a)·(c), ③은 문단 16에 따라 옳다.'),
        requirement('sub1.req2', 'kga720-7b8', 'KGA 720 문단 7(b)·12(b); 적용: 투자설명서를 포함한 증권 공모서류는 이 기준서가 적용되지 않으며 기타정보는 사업보고서에 포함된 정보이다.'),
        requirement('sub1.req3', 'kga720-20', 'KGA 720 문단 16(c)·20, KGA 315 문단 37, KGA 330 문단 6; 적용: 기타정보를 열람한 결과 기업과 기업환경에 대한 이해가 갱신될 필요가 있으면 관련 기준서에 따라 위험평가와 추가감사절차를 수정한다.'),
        requirement('sub1.req4', 'kga720-15', 'KGA 720 문단 14·15; 적용: 기타정보를 열람하면서 재무제표나 감사인의 지식과 관련이 없는 기타정보가 중요하게 왜곡표시된 것으로 보이는 징후에도 주의를 유지한다.'),
    ],
    criteria: [
        criterion('sub1.c1', 'conclusion', '옳지 않은 것으로 ②·④·⑤를 모두 지적한다. 번호 대신 내용으로 특정해도 인정한다. ②·④·⑤ 중 하나라도 빠뜨리거나, 옳은 것인 ①(연차보고서 최종본의 발행 전 제공에 관한 서면진술 요청)이나 ③(차이를 경영진과 논의하고 재무제표 매출 기록까지 조사)을 옳지 않다고 지적하면 이 점수는 주지 않는다.', ['kga720-16', 'kga720-13', 'kga720-7b8', 'kga720-20', 'kga720-15']),
        criterion('sub1.c2', 'action', '② 투자설명서를 포함한 증권 공모서류는 기타정보에 관한 감사기준서의 적용 대상이 아니므로 기타정보로 보거나 기타정보 단락에서 식별할 수 없다는 이유, 또는 투자설명서를 기타정보에서 제외해야 한다는 절차를 제시한다. 기타정보는 사업보고서에 포함된 정보라는 설명으로 제외 이유를 밝혀도 인정한다. 투자설명서도 기타정보에 포함된다고 쓰면 인정하지 않는다.', ['kga720-7b8', 'kga720-12b']),
        criterion('sub1.c3', 'action', '④ 공장 가동중단은 정상 가동을 전제로 한 감사인의 기존 이해·위험평가와 다르므로 기업과 기업환경에 대한 이해를 갱신하고 특수제품 재고 평가의 위험평가나 감사절차를 수정해야 한다는 이유나 절차를 제시한다. 위험평가를 수정하거나 재고 평가 감사절차를 보완한다는 것 중 하나만 써도 인정하며 구체적 절차의 나열은 요구하지 않는다. 기타정보가 사실이므로 기존 계획을 유지해도 된다고 쓰면 인정하지 않는다.', ['kga720-20', 'kga720-16', 'kga315-37', 'kga330-6']),
        criterion('sub1.c4', 'action', '⑤ 재무제표나 감사에서 얻은 지식과 관련이 없는 기타정보도 열람하면서 중요하게 왜곡표시된 것으로 보이는 징후에 주의를 기울여야 한다는 이유나 절차를 제시한다. 사업보고서의 기타정보 전체를 읽어야 한다는 설명도 인정한다. 관련 없는 부분은 읽지 않아도 된다고 쓰면 인정하지 않는다.', ['kga720-15', 'kga720-14']),
    ],
};
const sub2 = {
    id: 'sub2', type: 'judgment', question_style: 'case', topic_ids: ['16', '15'],
    prompt: '감사보고서 작성 단계와 감사보고서일 후의 절차와 판단 ⑥~⑪ 중 감사기준에 비추어 옳지 않은 것을 모두 찾아 번호를 쓰고, 각각에 대하여 옳지 않은 이유나 감사팀이 수행하였어야 할 절차를 간략히 서술하시오.',
    ...shape, answer_slots: [{ id: 'sub2.answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '옳지 않은 것은 ⑥, ⑧, ⑪이다. 기타정보의 수정 거부만으로 재무제표 의견을 변형하지 않고 보고 계획을 지배기구와 커뮤니케이션한 ⑦, 상장기업으로서 감사보고서일 후 입수 예정인 연차보고서를 식별한 ⑨, 감사보고서일 후 입수한 기타정보를 열람하고 수정을 요구한 ⑩은 옳다.',
        '⑥ 매출 과대계상은 전반적이지 않은 재무제표의 중요한 미수정왜곡표시이므로 기타정보 단락의 기술로 대신할 수 없고, 재무제표에 대하여 한정의견을 표명하여야 한다.',
        '⑧ 기타정보에 중요한 미수정왜곡표시가 있다고 결론 내렸으므로 기타정보 단락에 그 왜곡표시를 기술하여야 하며, 지배기구와 커뮤니케이션했다는 이유로 보고할 사항이 없다고 기재할 수 없다.',
        '⑪ 감사보고서일 후라도 기타정보의 중요한 미수정왜곡표시에 대하여 감사인의 법적 권리와 의무를 고려하여, 예를 들어 법률 조언을 구하고 주주총회에서 알리는 등 감사보고서 이용자가 주의를 기울일 수 있도록 적절한 조치를 취하여야 한다.',
    ],
    requirements: [
        requirement('sub2.req1', 'kga720-18', 'KGA 705 문단 7, KGA 720 문단 18·A45·21·22·6·17·19; 식별 기준: ⑥(재무제표 왜곡표시를 기타정보 단락에만 기술하고 적정의견), ⑧(기타정보의 미수정왜곡표시에 대해 보고할 사항 없음 기재), ⑪(보고서일 후 미수정왜곡표시를 조치 없이 종결)은 옳지 않다. ⑦은 문단 18(a)·A45, ⑨는 문단 21(a)·22(b), ⑩은 문단 6·17·19에 따라 옳다.'),
        requirement('sub2.req2', 'kga705-7', 'KGA 705 문단 7(a), KGA 720 문단 20; 적용: 충분하고 적합한 증거로 확인된 재무제표의 중요하지만 전반적이지 않은 미수정왜곡표시는 한정의견 사유이며 기타정보 단락의 기술로 대신하지 않는다.'),
        requirement('sub2.req3', 'kga720-22', 'KGA 720 문단 22(e)(ii); 적용: 감사보고서일 전에 입수한 기타정보에 중요한 미수정왜곡표시가 있다고 결론 내렸으면 기타정보 단락에 이를 기술한다.'),
        requirement('sub2.req4', 'kga720-19', 'KGA 720 문단 19(b)·A49·A50; 적용: 감사보고서일 후에 결론 내린 기타정보의 중요한 왜곡표시가 지배기구와 커뮤니케이션한 뒤에도 수정되지 않으면 법적 권리와 의무를 고려해 이용자가 주의를 기울이도록 적절한 조치를 취한다.'),
    ],
    criteria: [
        criterion('sub2.c1', 'conclusion', '옳지 않은 것으로 ⑥·⑧·⑪을 모두 지적한다. 번호 대신 내용으로 특정해도 인정한다. ⑥·⑧·⑪ 중 하나라도 빠뜨리거나, 옳은 것인 ⑦(수정 거부를 의견 변형 사유로 보지 않고 보고 계획을 지배기구와 커뮤니케이션), ⑨(감사보고서일 후 입수 예정인 연차보고서의 식별), ⑩(감사보고서일 후 입수한 연차보고서의 열람과 수정 요구)을 옳지 않다고 지적하면 이 점수는 주지 않는다.', ['kga720-18', 'kga720-A45', 'kga720-21', 'kga720-22', 'kga720-6', 'kga720-19', 'kga705-7']),
        criterion('sub2.c2', 'action', '⑥ 매출 과대계상은 전반적이지 않은 재무제표의 중요한 미수정왜곡표시이므로 기타정보 단락의 기술로 대신할 수 없고 재무제표에 대하여 한정의견을 표명해야 한다는 이유나 판단을 제시한다. 한정의견이 필요하다는 판단이나 재무제표의 왜곡표시는 감사의견으로 다뤄야 한다는 이유 중 하나만 써도 인정한다. 적정의견을 유지할 수 있다고 하거나 부적정의견·의견거절을 제시하면 인정하지 않는다.', ['kga705-7', 'kga720-20']),
        criterion('sub2.c3', 'action', '⑧ 기타정보에 중요한 미수정왜곡표시가 있다고 결론 내렸으므로 기타정보 단락에 그 왜곡표시를 기술하는 설명을 포함해야 하며, 지배기구와 커뮤니케이션했다는 이유로 보고할 사항이 없다고 기재할 수 없다는 이유나 절차를 제시한다.', ['kga720-22']),
        criterion('sub2.c4', 'action', '⑪ 감사보고서일 후라도 기타정보의 중요한 미수정왜곡표시에 대하여 감사인의 법적 권리와 의무를 고려하여 감사보고서 이용자가 주의를 기울일 수 있도록 적절한 조치를 취해야 한다는 이유나 절차를 제시한다. 법률 조언, 주주총회에서의 언급, 규제기관과의 커뮤니케이션 같은 조치 하나만 들거나 적절한 조치가 필요하다는 원칙만 써도 인정하며 조치의 나열은 요구하지 않는다. 보고서일 후에는 조치할 필요가 없다고 쓰면 인정하지 않는다.', ['kga720-19', 'kga720-A49', 'kga720-A50']),
    ],
};

const c60 = original(C60).classification;
const set = {
    schema_version: '3.0', id: 'case-16-other-information-20260915', type: 'linked_question_set', status: 'needs_review',
    title: '사업보고서 기타정보에 관한 감사인의 절차와 보고',
    classification: { topic_id: '16', part: c60.part, chapter: c60.chapter, domain: 'audit', standards: ['KGA 315', 'KGA 330', 'KGA 705', 'KGA 720'],
        tags: ['기타정보', '사업보고서', '감사보고서', '사례형'] },
    source_refs: refs, shared_context: { facts }, learning_order: ['sub1', 'sub2'], subquestions: [sub1, sub2],
    verification: { source_fidelity: 'reconstructed', review_status: 'needs_human_review', calculation_required: false, notes: [
        '2026-09-15 사용자가 지정한 사례형 검토에 따라 case-16-other-information-cause-20260914와 pilot-16-011을 한 사례로 합치고, 사용자 요청대로 기타정보의 입수·적용 범위·열람·보고 요소를 더해 종합 문제로 재구성한 초안이다. 원 세트와의 대응은 같은 폴더의 lineage.json에 기록한다.',
        '사용자가 확정한 대상 연도는 2027년이다. 사례의 20X1년은 2027년 시험에 적용되는 2025 개정 전문을 기준으로 판단하며, KGA 720 문단 10의 시행 적용대상(주권상장법인으로 직전 사업연도말 자산총액 5천억원 이상이면 2026년 1월 1일 이후 개시 보고기간부터)에 해당하도록 상장 여부와 자산총액 8천억원을 사실관계에 두었다. 등록된 전문 추출본의 본문(KGA 720 문단 6·7·12·13~22, KGA 705 문단 7, KGA 315 문단 37, KGA 330 문단 6)과 적용자료(KGA 720 문단 A45·A49·A50)를 직접 대조하였다.',
        '옳고 그름을 구분하는 선택형이다. 물음마다 옳지 않은 항목 전체를 정확히 고른 식별 1점, 옳지 않은 항목마다 이유 또는 보완절차 중 하나를 핵심 원칙 수준으로 쓴 1점을 둔다. 함정 ①·③·⑦·⑨·⑩에는 별도 득점 기준이 없다.',
        'agent 내용검토·작성자 기대값과 실제 Luna 채점·사람 확인·정본 수록·운영 DB 반영은 별개이며 이 초안 생성으로 완료되지 않는다.',
    ] },
};
fs.writeFileSync(`${D}/sets.json`, JSON.stringify([set], null, 2) + '\n');
const chars = [...facts.map((f) => f.text).join('\n')].length;
console.log({ set: set.id, facts_characters: chars, points: set.subquestions.map((q) => q.criteria.length), sha256: createHash('sha256').update(fs.readFileSync(`${D}/sets.json`)).digest('hex') });
