// 10번(pilot-04-006) 재구성 초안(감사문서 종합). 원문 인용은 현재 정본의 기존 인용과 등록 전문에서 그대로 복사한다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r05-audit-documentation/build-draft.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r05-audit-documentation';
const BANK = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const FILES = {
    n01: 'cpa_uploader/data/official/delegated-n01-kga200-210-230-2025.txt',
    s05: 'cpa_uploader/data/official/delegated-s05-kga230-context-2025.txt',
    r05: 'cpa_uploader/data/official/case-review-2026-09-15-kga230.md',
};
const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const bank = JSON.parse(fs.readFileSync(BANK, 'utf8'));
const texts = Object.fromEntries(Object.entries(FILES).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));
const ORIGINAL = 'pilot-04-006';
const original = bank.find((s) => s.id === ORIGINAL); assert(original, ORIGINAL);
assert(!bank.some((s) => s.id === 'case-04-audit-documentation-20260917'), 'new set ID must not exist in the bank');
const reuse = (id, setId, refId) => {
    const ref = bank.find((s) => s.id === setId).source_refs.find((r) => r.id === refId);
    assert(ref && ref.content_hash === sha(ref.source_quote) && ref.page === 'KGA 230', `${setId}/${refId}`);
    return { id, file: ref.file, title: ref.title, page: ref.page, source_quote: ref.source_quote, role: 'standard', content_hash: ref.content_hash };
};
const extract = (id, key, paragraph, pdfPage, start, end) => {
    const text = texts[key];
    const i = text.indexOf(start); const j = text.indexOf(end, i);
    assert(i >= 0 && j > i, `${id}: ${start}`);
    assert.equal(text.indexOf(start, i + 1), -1, `${id}: 시작 문구가 유일하지 않음`);
    const quote = text.slice(i, j + end.length);
    const first = text.slice(0, i).split('\n').length;
    const span = `L${first}-L${first + quote.split('\n').length - 1}`;
    return { id, file: FILES[key], title: `KGA 230 문단 ${paragraph}, 2025 개정 전문 원문 PDF ${pdfPage}쪽; ${span}`, page: 'KGA 230', source_quote: quote, role: 'standard', content_hash: sha(quote) };
};

const refs = [
    reuse('kga230-7', ORIGINAL, 'src-486c61dad20d1c3349'),
    extract('kga230-8', 's05', '8', '71~72', '8. 감사인은 이전에 해당 감사에 관여되지 아니한', '때 행한 유의적인 전문가적 판단 (문단 A8-A11 참조)'),
    reuse('kga230-9', 'case-04-documentation-trace-20260914', 'src-e9128a970ca5cfbc5d'),
    reuse('kga230-10', 'case-04-documentation-trace-20260914', 'src-3a02c5c340fba28e3a'),
    reuse('kga230-11', 'case-04-documentation-trace-20260914', 'src-21bdaeecb1163404d0'),
    extract('kga230-13', 'n01', '13', 72, '13. \r\n감사인은 예외적인 상황에서 감사보고서일 후에', '이에 따른 감사문서의 변경자와 검토자 및 그 시기'),
    extract('kga230-14', 'n01', '14', 73, '14. \r\n감사인은 감사와 관련된 문서들을 하나의 감사파일로', '(문단 A21-A22 참조)'),
    reuse('kga230-16', 'pilot-04-005', 'src-4ffcde01b7a6c483ae'),
    extract('kga230-A1', 'n01', 'A1', 73, 'A1. \r\n감사문서를 적시에 충분하고 적합하게', '작성된 것보다는 정확성이 낮을 것이다.'),
    extract('kga230-A4', 'r05', 'A4', 74, 'A4. \n감사인은 교체된 감사조서', '은 감사문서에 포함시킬 필요가 없다.'),
    extract('kga230-A5', 'r05', 'A5', 74, 'A5. \n감사인의 구두설명 자체는', '명확하게 하는 데는 유용할 수 있다.'),
    extract('kga230-A12', 'r05', 'A12', '76~77', 'A12. 식별한 특성의 기록은', '을 실시한 장소와 시기를 기록할 수 있을 것이다.'),
    extract('kga230-A13', 'r05', 'A13', 77, 'A13. 감사기준서 220은', '검토하였는지를 문서화하는 것을 의미한다.'),
    extract('kga230-A15', 'r05', 'A15', 77, 'A15. 정보의 불일치에 대하여', '보존하여야 한다는 것을 의미하는 것은 아니다.'),
    extract('kga230-A20', 'r05', 'A20', '78~79', 'A20. 예외 상황이란', '종책임을 진다.'),
    reuse('kga230-A22', ORIGINAL, 'src-b54be20acba919f30f'),
];
const quote = (id) => refs.find((r) => r.id === id).source_quote;

const facts = [
    { id: 'fact1', text: '한결회계법인은 한빛회사의 20X1년 1월 1일부터 12월 31일까지의 재무제표를 감사하였으며, 감사보고서일은 20X2년 3월 15일이다. 감사팀은 감사보고서일 후 최종감사파일의 취합을 시작하여 20X2년 4월 24일에 완료하였다.' },
    { id: 'fact2', text: [
        '감사보고서일 전 감사팀의 감사문서 작성과 검토에 관한 내용은 다음과 같다.',
        '① 감사팀원 갑은 매출 세부테스트에서 20X1년 10월 1일부터 12월 31일까지의 출하기록에 있는 송장 중 송장번호 20015번부터 매 40번째 송장을 추출하여 매출 기록과 대조하였다. 갑은 조서의 분량을 줄이기 위하여 추출한 송장번호를 하나하나 적는 대신 추출에 사용한 출하기록의 기간, 시작 송장번호와 추출 간격을 적고, 대조 결과와 함께 수행자와 테스트 종료일을 기록하였다.',
        '② 감사팀원 을은 20X2년 2월에 매출채권 조회 회신과 장부 잔액의 차이를 조사하여 차이의 원인을 파악하였다. 을은 다른 계정의 현장감사 일정이 바빠 조사 내용과 결론을 조서로 작성하는 일은 감사보고서일 후 최종감사파일 취합 기간에 하기로 하고, 담당 이사의 검토도 그 조서를 작성한 뒤에 받기로 하였다.',
        '③ 재고자산 평가는 감사팀이 유의적 사항으로 식별한 영역이다. 감사팀원 병은 진부화 재고의 순실현가능가치에 관한 경영진의 추정을 검토하고, 재고자산 평가충당금이 적정하다는 결론과 검토한 자료의 목록을 조서에 기록하였다. 병은 조서 작성 시간을 줄이기 위하여 결론에 이르면서 내린 판단의 근거는 조서에 적는 대신 검토자가 요청하면 구두로 설명하기로 하였다.',
        '④ 담당 이사는 20X2년 3월 10일부터 12일까지 차입금과 이자비용 영역의 조서를 검토하였다. 담당 이사는 검토한 조서가 많으므로 조서마다 검토 서명을 남기지 않고, 검토한 조서의 범위와 검토자 및 검토일을 검토 기록표에 한꺼번에 기록하였다.',
        '⑤ 감사팀은 20X2년 3월 5일 한빛회사의 재무담당이사 및 감사위원회 위원장과 유형자산 손상에 관한 유의적 사항을 토의하였다. 토의 후 한빛회사는 손상차손을 추가로 인식하였다. 감사팀은 수정된 손상차손 계산 내역과 최종 결론을 조서에 기록하고, 토의 결과가 결론에 반영되었다고 보아 토의 내용은 따로 기록하지 않았다.',
        '⑥ 감사팀원 정은 유의적 위험으로 식별한 매출 기간귀속을 검토하던 중 경영진의 설명과 다른 선적일자가 적힌 선적서류를 발견하였다. 정은 운송회사 확인서로 선적서류의 일자가 잘못 적힌 것임을 확인하고, 그 경위와 결과 및 매출이 적절한 기간에 인식되었다고 판단한 근거를 조서에 기록하였다. 정은 파일이 혼동되지 않도록 확인 과정에서 작성하였다가 교체한 분석표 초안은 감사파일에 포함하지 않았다.',
    ].join('\n') },
    { id: 'fact3', text: [
        '감사보고서일 후 감사팀이 수행한 일은 다음과 같다.',
        '⑦ 감사팀은 최종감사파일 취합 기간에 이미 검토를 마친 조서를 계정별로 분류·병합하고 조서 사이에 상호 참조를 연결하였고, 최종 조서로 교체된 이전 버전의 조서 파일은 더 이상 필요하지 않으므로 삭제하였다.',
        '⑧ 감사팀원 무는 감사보고서일 전에 재고자산 실사차이의 조정 내역을 입수하였고, 20X2년 3월 12일 담당 이사가 참석한 감사팀 회의에서 이를 토의하여 실사차이가 적절히 조정되었다는 결론에 합의하였다. 무는 감사보고서일 직전에 일정이 몰려 이 감사증거에 관한 조서를 최종감사파일 취합 기간인 3월 22일에 작성하였다.',
        '⑨ 20X2년 3월 28일 감사팀은 한빛회사가 20X1년 12월에 대형 거래처와 맺은 판매계약에 반품 조건이 있다는 사실을 새로 알게 되었다. 감사팀은 재무담당이사와 이를 논의하고 거래처에 반품 조건을 질문하여 받은 답변을 계약서와 대조한 결과, 20X1년 재무제표를 수정할 필요가 없다고 결론 내렸다. 감사팀은 이 작업이 최종감사파일 취합 기간 중에 이루어졌으므로 취합 절차의 일부로 보고, 질문에 대한 답변과 대조 결과를 기존 매출 조서에 덧붙여 정리하였다.',
        '⑩ 최종감사파일의 취합이 끝난 뒤인 20X2년 7월, 차기 감사를 준비하던 감사팀원이 20X1년 매입채무 조서에 거래처 코드 하나가 잘못 적혀 있는 것을 발견하였다. 감사팀원은 결론에 영향이 없는 단순한 오기이므로 해당 조서의 거래처 코드를 바로잡고, 정정에 관한 별도의 기록은 남기지 않았다.',
    ].join('\n') },
].map((fact) => ({ ...fact, scoreable: false }));

const one = { met: 1, not_met: 0, contradicted: 0 };
const criterion = (id, type, claim, refIds) => ({
    id, requirement_id: id.replace(/\.c(\d+)$/u, '.req$1'), claim,
    critical_facts: [{ id: `${id}.fact`, type, expected: claim }], max_points: 1, scores: { ...one }, source_ref_ids: refIds,
});
const requirement = (id, refId, span) => ({ id, source_ref_id: refId, source_quote: quote(refId), source_span: span });
const shape = { constraints: { ordered: false, max_entries: null, overflow_policy: 'none' }, selection: { type: 'all', n: null }, decision: null };
const judgePrompt = (stage, range) => `${stage} ${range}이 감사기준에 비추어 적절한지 각각 판단하고, 적절하지 않은 것은 그 이유나 감사인이 수행하였어야 할 절차를 간략히 서술하시오.`;
const identification = (wrong, particle, right) => `적절하지 않은 것으로 ${wrong}${particle} 모두 판단한다. 항목마다 적절 여부를 쓰거나 적절하지 않은 것만 골라 써도 인정하고, 번호 대신 내용으로 특정하거나 이유·보완절차로 적절하지 않다는 판단이 분명히 드러나도 인정한다. ${wrong} 중 하나라도 적절하다고 판단하거나 빠뜨리거나, 적절한 것인 ${right}을 적절하지 않다고 판단하면 이 점수는 주지 않는다.`;

const sub1 = {
    id: 'sub1', type: 'judgment', question_style: 'case', topic_ids: ['04'],
    prompt: judgePrompt('감사보고서일 전의 감사문서 작성과 검토에 관한', '①~⑥'),
    ...shape, answer_slots: [{ id: 'sub1.answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '적절하지 않은 것은 ②, ③, ⑤이다. ①(체계적 추출의 원천·시작점·추출 간격 기록), ④(조서마다 서명하지 않고 검토한 범위·검토자·검토일을 기록), ⑥(불일치를 해소한 경위와 판단 근거를 기록하고 교체한 초안은 제외)은 적절하다.',
        '② 감사문서는 적시에 작성하여야 하므로 조사 내용과 결론을 조사할 때 조서로 작성하고 감사보고서일 전에 검토받아야 한다. 감사보고서일 후의 취합 기간은 최초 문서화를 미루는 기간이 아니다.',
        '③ 유의적 사항에 관하여 결론에 도달할 때 행한 유의적인 전문가적 판단은 조서에 문서화하여야 하며, 감사인의 구두설명만으로는 결론의 적절한 근거가 되지 못한다.',
        '⑤ 유의적 사항에 관하여 경영진 및 지배기구와 토의한 내용은 해당 사항의 성격, 토의 시기와 토의 상대자를 포함하여 문서화하여야 한다.',
    ],
    requirements: [
        requirement('sub1.req1', 'kga230-9', 'KGA 230 문단 7·8·9·10·11, A4·A5·A12·A13·A15; 식별 기준: ②(조서 작성과 담당 이사 검토를 감사보고서일 후 취합 기간으로 미룸), ③(유의적 사항에 관한 판단의 근거를 조서에 적지 않고 구두설명에 맡김), ⑤(유의적 사항에 관한 경영진·지배기구와의 토의를 기록하지 않음)는 적절하지 않다. ①은 문단 9(a)·A12(체계적 추출은 원천·출발점·추출 간격으로 식별), ④는 문단 9(c)·A13(조서마다 검토 증거를 남길 필요 없이 검토한 업무·검토자·검토일 기록), ⑥은 문단 11·A4·A15(불일치 처리 과정 기록, 교체된 초안은 포함 불필요)에 따라 적절하다.'),
        requirement('sub1.req2', 'kga230-7', 'KGA 230 문단 7·A1; 적용: 감사문서는 적시에 작성하여야 하며, 적시에 작성하면 감사보고서가 확정되기 전에 입수한 증거와 결론을 효과적으로 검토·평가할 수 있다. 조서 작성과 검토를 감사보고서일 후로 미룬 ②는 이에 어긋난다.'),
        requirement('sub1.req3', 'kga230-8', 'KGA 230 문단 8(c)·A5; 적용: 유의적 사항과 결론, 결론에 도달할 때 행한 유의적인 전문가적 판단을 숙련된 감사인이 이해할 수 있도록 문서화하여야 하며, 구두설명 자체는 수행한 업무나 결론의 적절한 근거가 되지 못한다.'),
        requirement('sub1.req4', 'kga230-10', 'KGA 230 문단 10; 적용: 유의적 사항에 관하여 경영진·지배기구와 행한 토의 내용은 해당 사항의 성격, 토의 시기, 토의 상대자를 포함하여 문서화한다. 토의 결과가 결론에 반영되었다는 이유로 생략할 수 없다.'),
    ],
    criteria: [
        criterion('sub1.c1', 'conclusion', identification('②·③·⑤', '를', '①(체계적 추출에서 출하기록의 기간·시작 송장번호·추출 간격을 기록), ④(조서마다 검토 서명을 남기지 않고 검토한 조서의 범위·검토자·검토일을 검토 기록표에 기록), ⑥(선적일자 불일치를 확인한 경위·결과와 판단 근거를 기록하고 교체한 분석표 초안을 감사파일에서 제외)'), ['kga230-9', 'kga230-7', 'kga230-8', 'kga230-10', 'kga230-11', 'kga230-A4', 'kga230-A5', 'kga230-A12', 'kga230-A13', 'kga230-A15']),
        criterion('sub1.c2', 'action', '② 감사문서는 적시에 작성해야 하므로 조사 내용과 결론을 조사 시점에 조서로 작성하고 감사보고서일 전에 검토받아야 한다는 이유나 절차를 제시한다. 감사문서를 적시에 작성해야 한다는 이유, 감사보고서가 확정되기 전에 증거와 결론을 검토·평가할 수 있도록 작성해야 한다는 이유, 감사보고서일 후의 취합 기간에는 최초 문서화를 미룰 수 없다는 이유, 감사보고서일 전에 조서를 작성하고 검토받아야 한다는 절차 중 하나만 써도 인정한다. 최종감사파일 취합 기간 안에만 작성하면 된다고 쓰면 인정하지 않는다.', ['kga230-7', 'kga230-A1']),
        criterion('sub1.c3', 'action', '③ 유의적 사항에 관하여 결론에 도달할 때 내린 유의적인 전문가적 판단(평가충당금이 적정하다고 본 판단의 근거)을 조서에 문서화해야 한다는 이유나 절차를 제시한다. 구두설명만으로는 수행한 업무나 결론의 적절한 근거가 되지 못한다는 이유, 이전에 관여하지 않은 숙련된 감사인이 이해할 수 있도록 판단 근거를 기록해야 한다는 이유, 판단의 근거를 조서에 기록해야 한다는 절차 중 하나만 써도 인정한다. 요청이 있을 때 구두로 설명하면 충분하다고 쓰면 인정하지 않는다.', ['kga230-8', 'kga230-A5']),
        criterion('sub1.c4', 'action', '⑤ 유의적 사항에 관하여 경영진·지배기구와 토의한 내용을 문서화해야 한다는 이유나 절차를 제시한다. 토의한 사항의 성격, 토의 시기, 토의 상대자 중 일부만 들거나 토의 내용을 조서에 기록해야 한다는 원칙만 써도 인정하며, 세 요소의 완전한 나열은 요구하지 않는다. 토의 결과가 결론에 반영되었으면 토의 내용은 기록하지 않아도 된다고 쓰면 인정하지 않는다.', ['kga230-10']),
    ],
};

const sub2 = {
    id: 'sub2', type: 'judgment', question_style: 'case', topic_ids: ['04'],
    prompt: judgePrompt('감사보고서일 후의 조치', '⑦~⑩'),
    ...shape, answer_slots: [{ id: 'sub2.answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '적절하지 않은 것은 ⑨, ⑩이다. ⑦(조서의 분류·병합·상호 참조와 교체된 문서의 삭제)과 ⑧(감사보고서일 전에 입수하여 관련 업무팀원들과 토의하고 합의한 감사증거의 문서화)은 최종감사파일 취합 기간에 할 수 있는 행정적 변경이므로 적절하다.',
        '⑨ 감사보고서일 후 새로운 감사절차나 추가적인 감사절차를 수행하고 결론을 내린 것은 행정적인 취합 절차가 아니므로, 당면한 상황, 수행한 절차·입수한 감사증거·도달한 결론과 감사보고서에 미친 영향, 조서를 변경한 사람과 검토한 사람 및 그 시기를 문서화하여야 한다.',
        '⑩ 최종감사파일의 취합이 완료된 후 기존 조서를 수정할 때에는 수정의 성격과 관계없이 수정하는 구체적 이유와 수정하고 검토한 사람 및 그 시기를 문서화하여야 한다.',
    ],
    requirements: [
        requirement('sub2.req1', 'kga230-A22', 'KGA 230 문단 13·14·16, A20·A22; 식별 기준: ⑨(감사보고서일 후 새로 알게 된 사실에 대하여 추가 절차를 수행하고 결론을 내린 작업을 취합 절차로 처리), ⑩(취합 완료 후 조서를 정정하면서 기록을 남기지 않음)는 적절하지 않다. ⑦(조서의 분류·병합·상호 참조, 교체된 문서의 삭제)과 ⑧(감사보고서일 전에 입수하여 관련 업무팀원들과 토의하고 합의한 감사증거의 문서화)은 문단 14·A22의 행정적 변경으로 적절하다.'),
        requirement('sub2.req2', 'kga230-13', 'KGA 230 문단 13·A20·A22; 적용: 감사보고서일 현재 존재한 사실을 보고서일 후 알게 되어 새로운 감사절차나 추가적인 감사절차를 수행하거나 새로운 결론을 도출하는 것은 행정적 취합과 관계없으므로, 당면한 상황, 수행한 절차·입수한 증거·도달한 결론과 감사보고서에 미친 영향, 감사문서의 변경자·검토자와 그 시기를 문서화한다.'),
        requirement('sub2.req3', 'kga230-16', 'KGA 230 문단 16; 적용: 최종감사파일의 취합이 완료된 후 문단 13 외의 상황으로 기존 감사문서를 수정하면 수정의 성격과 관계없이 수정하는 구체적 이유와 수정·검토한 사람 및 그 시기를 문서화한다.'),
    ],
    criteria: [
        criterion('sub2.c1', 'conclusion', identification('⑨·⑩', '을', '⑦(취합 기간에 조서를 분류·병합하고 상호 참조를 연결하며 교체된 이전 버전 조서 파일을 삭제), ⑧(감사보고서일 전에 입수하고 담당 이사가 참석한 회의에서 토의·합의한 감사증거의 조서를 취합 기간에 작성)'), ['kga230-A22', 'kga230-13', 'kga230-14', 'kga230-16', 'kga230-A20']),
        criterion('sub2.c2', 'action', '⑨ 감사보고서일 후 새로운 감사절차나 추가적인 감사절차를 수행하고 결론을 내린 작업은 행정적인 최종감사파일 취합에 해당하지 않는다는 이유, 또는 당면한 상황, 수행한 절차·입수한 감사증거·도달한 결론과 감사보고서에 미친 영향, 조서의 변경자·검토자와 그 시기를 문서화해야 한다는 절차를 제시한다. 이유만 쓰거나, 절차로 이들 사항 중 일부(예: 당면한 상황, 감사보고서에 미친 영향, 변경자·검토자와 그 시기)를 문서화해야 한다고 써도 인정하며, 모든 사항의 나열은 요구하지 않는다. 취합 기간 중에 수행했으므로 취합 절차로 처리해도 된다고 쓰거나, 답변과 대조 결과를 기존 조서에 덧붙이는 것만 제시하면 인정하지 않는다.', ['kga230-13', 'kga230-A22', 'kga230-A20']),
        criterion('sub2.c3', 'action', '⑩ 최종감사파일의 취합이 완료된 후 기존 조서를 수정할 때에는 단순한 오기의 정정이라도 수정하는 구체적 이유와 수정·검토한 사람 및 그 시기를 문서화해야 한다는 이유나 절차를 제시한다. 수정의 성격과 관계없이 수정 내역을 문서화해야 한다는 원칙만 쓰거나, 수정 이유, 수정한 사람, 검토한 사람, 그 시기 중 일부만 들어도 인정한다. 결론에 영향이 없는 단순한 오기이므로 기록하지 않아도 된다고 쓰면 인정하지 않는다.', ['kga230-16']),
    ],
};

const p = original.classification;
const set = {
    schema_version: '3.0', id: 'case-04-audit-documentation-20260917', type: 'linked_question_set', status: 'needs_review',
    title: '감사문서의 작성·검토와 최종감사파일의 취합',
    classification: { topic_id: '04', part: p.part, chapter: p.chapter, domain: 'audit', standards: ['KGA 230'],
        tags: ['감사문서', '최종감사파일', '사례형'] },
    source_refs: refs, shared_context: { facts }, learning_order: ['sub1', 'sub2'], subquestions: [sub1, sub2],
    verification: { source_fidelity: 'reconstructed', review_status: 'needs_human_review', calculation_required: false, notes: [
        '2026-09-17 사용자가 지정한 사례형 검토에 따라 pilot-04-006을 감사문서 종합 사례로 재구성한 초안이다. 사용자 지시대로 정답을 암시하던 사실·발문·제목을 없애고, 사실관계에 제시한 각 절차가 적절한지와 그 이유를 묻는 형식(적절하지 않은 것은 이유나 보완절차를 간략히)으로 바꾸었다. 원 세트와의 대응은 같은 폴더의 lineage.json에 기록한다.',
        '사용자가 확정한 대상 연도는 2027년이다. 판본 정책에 따라 사례의 20X1년을 2026년 1월 1일 개시 보고기간으로 보고 2025 개정 전문을 기준으로 판단했다(KGA 230 문단 4: 2026년 1월 1일 이후 개시하는 보고기간부터 시행). 2026 전문과 대조한 결과 문단 7~16과 A1·A4·A5·A12·A15·A22의 요구 내용은 같고, A13 첫 문장과 A20 둘째 문장은 개정 220의 정합 개정으로 표현만 달라졌으며 판단에 쓰는 내용은 같다. A4·A5·A12·A13·A15·A20은 2025 전문 PDF 74·76~79쪽에서 새로 발췌해 등록했다. 등록 전문(KGA 230 문단 7·8·9·10·11·13·14·16, A1·A4·A5·A12·A13·A15·A20·A22)을 직접 대조했다.',
        '두 물음 모두 각 절차의 적절 여부를 판단하게 하되, 채점은 사례형 선택형 기준을 따른다. 물음마다 적절하지 않은 항목 전체를 정확히 판단한 식별 1점, 적절하지 않은 항목마다 이유 또는 보완절차 중 하나를 핵심 원칙 수준으로 쓴 1점을 둔다. 적절한 항목 ①·④·⑥·⑦·⑧의 이유에는 별도 득점 기준이 없다.',
        'agent 내용검토·작성자 기대값과 실제 Luna 채점·사람 확인·정본 수록·운영 DB 반영은 별개이며 이 초안 생성으로 완료되지 않는다.',
    ] },
};
fs.writeFileSync(`${D}/sets.json`, JSON.stringify([set], null, 2) + '\n');
const chars = [...facts.map((f) => f.text).join('\n')].length;
assert(chars >= 400, 'facts must be at least 400 characters');
console.log({ set: set.id, facts_characters: chars, points: set.subquestions.map((q) => q.criteria.length), sha256: createHash('sha256').update(fs.readFileSync(`${D}/sets.json`)).digest('hex') });
