// r03 v2 설계 장부·계보·대표 답안 기록(한 번만 실행; 기존 파일이 있으면 쓰지 않는다).
//   npx tsx cpa_uploader/drafts/case-review-2026-09-15/r03-payroll-service-merge/v2/record-docs.mts
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewedContentHash } from '../../../../questionReviewIdentity.ts';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r03-payroll-service-merge';
const V2 = `${D}/v2`;
const sha = (p: string) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (name: string, value: unknown) => fs.writeFileSync(`${V2}/${name}`, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const [v1] = read(`${D}/sets.json`), [v2] = read(`${V2}/sets.json`);
const SET: string = v2.id;
const v = (criterion_id: string, verdict: string, reason: string) => ({ criterion_id, verdict, reason });
const chars = (s: { shared_context: { facts: { text: string }[] } }) => [...s.shared_context.facts.map((f) => f.text).join('\n')].length;

write('design.json', {
    version: 1, set_id: SET, route: '사례형 검토·수정(검토 스킬): 사용자가 지적한 사실관계 복잡도를 줄인 v2',
    user_request: '2026-09-15 “59·30번을 「급여업무 위탁과 감사인의 절차」—2물음·7점으로 통합한 수정 초안도 검토해줘. 사실관계가 너무 복잡해보여”',
    previous: { file: `${D}/sets.json`, reviewed_content_sha256: reviewedContentHash(v1), design: `${D}/design.json` },
    review_findings_v1: [
        '답에 쓰이지 않는 사실이 남아 있었다: 감사법인 이름(새길회계법인)·업종, 9월 말 검토 담당자 퇴사와 10월 후임자(원 30번 exp1의 잔재로 v1 채점 기준은 이를 요구하지 않음), 자료 접근 협조(원 59번 sub2의 잔재).',
        '이름이 비슷했다: 감사법인 새길과 서비스조직 새롬, 회사 온유와 하위서비스조직 다온. 원 59번에서는 다온이 회사 이름이어서 병합 뒤 역할이 뒤바뀌었다.',
        '검토조서 기재 ⑤~⑧이 한 문서의 기재로서 서로 모순되었다: ⑤는 보고서가 12월 31일까지의 증거라고 처리하고, ⑥은 잔여기간에 필요한 증거를 정하며(⑤의 오류를 드러냄), ⑧은 보고서 전체를 검토대상에서 제외하였다.',
        '같은 10월에 회사 쪽 검토 담당자 교체와 서비스조직 쪽 시스템 교체(담당자 동일)가 함께 있어 어느 쪽 변경을 판단하는지 헷갈렸다.',
        '정답 판정 자체(②·④·⑤·⑥·⑧ 옳지 않음, ①·③·⑦ 옳음)와 출처(KGA 402.17·18·A32~A34·A38·A40)는 원문과 맞았다.',
    ],
    changes_v2: [
        `사실관계 ${chars(v1)}자 → ${chars(v2)}자. 등장 주체를 감사팀·온유회사·새롬·태림·서비스감사인으로 줄였다(감사법인 이름, 회사 검토 담당자와 후임자 삭제).`,
        '하위서비스조직 이름을 다온에서 태림으로 바꾸어 온유회사와 구별했다.',
        '물음 2의 항목을 한 검토조서의 기재가 아니라 보고서 이용에 관한 감사팀 의견으로 바꾸어 항목 사이의 모순과 앞 항목 정답 노출을 없앴다. ⑦의 “보고서 발행 후” 조건은 판단에 쓰이지 않아 뺐다.',
        '급여업무 담당자가 같다는 사실은 자료 4에 두고 ⑥의 근거로 썼다. 회사 쪽 담당자 교체는 지웠다.',
        '근거 문구가 옳지 않은 항목(②·⑥·⑧)에만 붙지 않도록 옳은 항목 ③(규정이 문서로 정비됨)과 ⑦(예외가 온유회사 지급파일에도 적용되는 통제에서 발생)에도 사실 근거를 두었다.',
        '출처 인용, 쟁점 여덟 개의 옳고 그름, 물음별 배점(3·4점)과 criterion의 득점 요건은 v1과 같다(이름·문구만 맞춤).',
    ],
    items: [
        { no: '①', fact_id: 'fact3', verdict: '옳음', basis: 'KGA 402.17(b): 보충적인 이용자기업 통제가 이용자기업과 관련성이 있는지 결정한다.' },
        { no: '②', fact_id: 'fact3', verdict: '옳지 않음', basis: 'KGA 402.18·A40: 제외된 하위서비스가 감사와 관련되면 그 서비스에 이 기준서의 요구사항을 적용한다.' },
        { no: '③', fact_id: 'fact3', verdict: '옳음', basis: 'KGA 402.17(b): 관련 통제의 설계·실행을 이해한다. 규정은 설계 이해의 자료이며 운영효과성을 입증했다고 하지 않는다.' },
        { no: '④', fact_id: 'fact3', verdict: '옳지 않음', basis: 'KGA 402.17(b): 관련 보충통제의 운영효과성을 테스트한다. 규정과 서비스조직 보고서는 이용자기업 통제의 운영 증거가 아니다.' },
        { no: '⑤', fact_id: 'fact5', verdict: '옳지 않음', basis: 'KGA 402.17(a)·(c)·A32: 보고서 대상기간(1~9월)이 감사목적의 기간과 맞는지 평가하며 10~12월은 별도로 고려한다.' },
        { no: '⑥', fact_id: 'fact5', verdict: '옳지 않음(함정 근거: 담당자 동일)', basis: 'KGA 402.A33·A34: 정보시스템·처리절차의 변경도 유의적 변경으로 잔여기간 추가 증거 결정에 고려한다.' },
        { no: '⑦', fact_id: 'fact5', verdict: '옳음(함정)', basis: 'KGA 402.A38: 예외를 고려할 때 서비스감사인과 논의할 수 있으며 서비스조직의 커뮤니케이션 승인 여부에 따라 달라진다.' },
        { no: '⑧', fact_id: 'fact5', verdict: '옳지 않음', basis: 'KGA 402.A38: 예외가 있다고 보고서가 자동으로 도움이 되지 않는 것은 아니며 통제테스트 평가의 고려사항이다.' },
    ],
    questions: [
        { subquestion_id: 'sub1', question_style: 'case', type: 'judgment', topic_ids: v2.subquestions[0].topic_ids, case_fact_ids: ['fact1', 'fact2', 'fact3'],
            topic_reason: '13: 관련 하위서비스와 보충적인 이용자기업 통제(KGA 402.17(b)·18). 06: 관련성 결정과 설계 이해. 07: 이용자기업 통제의 운영효과성 테스트.',
            criteria: [{ id: 'sub1.c1', points: 1, meaning: '식별: ②·④를 모두 고르고 ①·③은 고르지 않음' }, { id: 'sub1.c2', points: 1, meaning: '②: 관련 하위서비스에 402 적용(이유 또는 절차)' }, { id: 'sub1.c3', points: 1, meaning: '④: 이용자기업 통제의 운영효과성 테스트(이유 또는 절차)' }],
            point_decision: '3점. v1과 같다.' },
        { subquestion_id: 'sub2', question_style: 'case', type: 'judgment', topic_ids: v2.subquestions[1].topic_ids, case_fact_ids: ['fact1', 'fact4', 'fact5'],
            topic_reason: '13: 유형 2 보고서의 대상기간·변경·예외(KGA 402.17·A32~A34·A38). 07: 잔여기간 통제의 추가 증거 판단.',
            criteria: [{ id: 'sub2.c1', points: 1, meaning: '식별: ⑤·⑥·⑧을 모두 고르고 ⑦은 고르지 않음' }, { id: 'sub2.c2', points: 1, meaning: '⑤: 대상기간 한계(이유) 또는 10~12월 추가 증거(절차)' }, { id: 'sub2.c3', points: 1, meaning: '⑥: 시스템·절차 변경은 유의적 변경(이유) 또는 이를 고려한 추가 증거 결정(절차)' }, { id: 'sub2.c4', points: 1, meaning: '⑧: 자동 배제 불가(이유) 또는 예외 영향 평가(절차)' }],
            point_decision: '4점. v1과 같다.' },
    ],
    edition: 'v1과 같다(2026-01-01 이후 개시 보고기간에 적용되는 KGA 402, 2025 개정 전문의 17·18·A32~A34·A38·A40을 2026 전문과 대조).',
    target_reviewed_content_sha256: reviewedContentHash(v2),
});

write('lineage.json', {
    version: 1, artifact_type: 'case_revision_lineage', created_at: '2026-09-15',
    from: { file: `${D}/sets.json`, sha256: sha(`${D}/sets.json`), reviewed_content_sha256: reviewedContentHash(v1), lineage: `${D}/lineage.json` },
    target: { set_id: SET, reviewed_content_sha256: reviewedContentHash(v2), points: 7 },
    item_mapping: [
        { v1: '①', v2: '①', change: '문구 유지' },
        { v1: '②', v2: '②', change: '다온→태림, 문장 축약' },
        { v1: '③', v2: '③', change: '사실 근거(규정이 문서로 정비됨) 추가' },
        { v1: '④', v2: '④', change: '문구 유지' },
        { v1: '⑤ 검토조서 기재', v2: '⑤ 감사팀 의견', change: '연간 증거라고 보는 의견으로 바꿈' },
        { v1: '⑥ 검토조서 기재(잔여기간 증거 결정 중 변경 아님으로 분류)', v2: '⑥ 감사팀 의견', change: '잔여기간 언급을 빼 ⑤의 정답 노출을 없애고 담당자 동일을 근거로 둠' },
        { v1: '⑦ 보고서 발행 후 논의 요청', v2: '⑦ 승인을 얻어 논의', change: '발행 후 조건 삭제, 사실 근거 추가' },
        { v1: '⑧ 보고서 전체를 검토대상에서 제외', v2: '⑧ 보고서 전체를 위험평가에서 제외', change: '의견 형식으로 바꿈' },
    ],
    removed_facts: ['새길회계법인(감사법인 이름)', '제조업', '9월 말 검토 담당자 퇴사와 10월 후임자', '자료 접근 협조', '근태파일에서 받은 직원번호·급여코드를 급여계산시스템에 입력하는 과정의 세부', '보고서 적용 기준의 적합성 확인(적격성·독립성만 남김)'],
    criteria_changes: '득점 요건은 v1과 같다. sub1.c3에서 원 30번의 “후임자별” 검사방법 불요 문구는 후임자 사실을 지워 “월별”로 줄였고, 이름 다온은 태림으로 바꾸었다.',
    retirement: 'v1과 같다. 원 두 세트의 활성 릴리스 제외는 운영 반영 때 모아서 수행한다.',
});

write('qa.json', {
    version: 1, set_id: SET, method: 'author_expected_verdicts_before_model_grading', human_review_performed: false,
    note: '모범답안은 저장 model_answer를 그대로 쓴다. 부분정답·오답과 기대 판정은 실제 채점 전에 원문·criterion에서 정했다. v1 대표 답안을 v2 항목에 맞게 옮겼다. contradicted와 not_met은 모두 0점이다.',
    cases: [
        { id: 'r03v2-sub1-partial', set_id: SET, subquestion_id: 'sub1', kind: 'partial', answer: '②, ④',
            expected_verdicts: [v('sub1.c1', 'met', '옳지 않은 ②·④를 정확히 골랐다.'), v('sub1.c2', 'not_met', '②의 이유나 절차가 없다.'), v('sub1.c3', 'not_met', '④의 이유나 절차가 없다.')],
            expected_points: 1, reason: '번호만 쓴 답이 식별 점수만 받는지 확인한다.' },
        { id: 'r03v2-sub1-wrong', set_id: SET, subquestion_id: 'sub1', kind: 'wrong',
            answer: '옳지 않은 것은 ①과 ③이다. 온유회사의 검토는 급여 감사와 관련된 통제가 아니고, 규정은 설계를 이해하는 자료로도 쓸 수 없다. ②와 ④는 적절하다.',
            expected_verdicts: [v('sub1.c1', 'contradicted', '옳은 ①·③만 고르고 ②·④가 적절하다고 명시했다.'), v('sub1.c2', 'contradicted', '태림의 코드 변환을 제외한 ②가 적절하다고 명시했다.'), v('sub1.c3', 'contradicted', '규정과 보고서로 운영효과성을 결론 낸 ④가 적절하다고 명시했다.')],
            expected_points: 0, reason: '옳은 항목만 고르고 옳지 않은 항목을 적절하다고 쓴 대표 오답이다.' },
        { id: 'r03v2-sub2-partial', set_id: SET, subquestion_id: 'sub2', kind: 'partial',
            answer: '옳지 않은 것은 ⑤, ⑦, ⑧이다.\n⑤ 보고서 대상기간은 1~9월이라 10~12월의 통제 운영까지 입증하지 못한다.\n⑦ 이용자기업 감사인은 서비스감사인과 직접 논의할 수 없다.\n⑧ 예외가 있다는 이유만으로 보고서 전체를 쓸모없다고 할 수는 없다.',
            expected_verdicts: [v('sub2.c1', 'contradicted', '옳은 ⑦을 옳지 않다고 골랐고 ⑥을 빠뜨렸다.'), v('sub2.c2', 'met', '대상기간이 1~9월이라 10~12월을 입증하지 못한다고 적었다.'), v('sub2.c3', 'not_met', '⑥을 다루지 않았다.'), v('sub2.c4', 'met', '예외만으로 보고서 전체가 쓸모없는 것은 아니라고 적었다.')],
            expected_points: 2, reason: '함정 ⑦ 선택과 ⑥ 누락으로 식별 점수를 잃고 ⑤·⑧의 이유는 유지되는지 확인한다.' },
        { id: 'r03v2-sub2-wrong', set_id: SET, subquestion_id: 'sub2', kind: 'wrong',
            answer: '옳지 않은 것은 ⑦이다. 이용자기업 감사인은 서비스감사인과 논의할 수 없다. ⑤, ⑥, ⑧은 모두 적절하다.',
            expected_verdicts: [v('sub2.c1', 'contradicted', '함정 ⑦만 고르고 ⑤·⑥·⑧이 적절하다고 명시했다.'), v('sub2.c2', 'contradicted', '연간 증거라는 ⑤가 적절하다고 명시했다.'), v('sub2.c3', 'contradicted', '변경을 무시한 ⑥이 적절하다고 명시했다.'), v('sub2.c4', 'contradicted', '보고서 전체 제외인 ⑧이 적절하다고 명시했다.')],
            expected_points: 0, reason: '함정만 고르고 옳지 않은 항목을 적절하다고 쓴 대표 오답이다.' },
    ],
    supplementary_cases: [
        { id: 'r03v2-supp-content-or-procedure', purpose: '물음 1은 번호 없이 내용으로 특정한 이유, 물음 2는 간략한 보완절차만 쓴 답이 만점을 받는지 확인한다.',
            answers: {
                sub1: '태림의 급여코드 변환을 보고서 범위 밖이라는 이유로 검토에서 뺀 판단은 옳지 않다. 변환된 코드가 급여액 산정에 쓰여 감사와 관련되기 때문이다. 검토규정과 새롬의 보고서로 직원 명부 대조가 연중 효과적으로 운영되었다고 결론 낸 판단도 옳지 않다. 규정과 서비스조직 보고서는 온유회사에서 그 통제가 실제로 운영되었다는 증거가 아니기 때문이다.',
                sub2: '⑤, ⑥, ⑧이 옳지 않다.\n⑤ 10~12월의 통제 운영에 대해서는 추가 증거를 입수해야 한다.\n⑥ 10월의 시스템 교체와 승인절차 변경을 고려하여 잔여기간에 필요한 추가 증거를 정해야 한다.\n⑧ 승인통제 예외가 온유회사 급여에 미치는 영향을 평가하여 보고서가 제공하는 증거를 판단해야 한다.' },
            expected: {
                sub1: { expected_points: 3, expected_verdicts: [v('sub1.c1', 'met', '②·④를 내용으로 정확히 특정했다.'), v('sub1.c2', 'met', '감사와 관련된 변환이라는 이유를 적었다.'), v('sub1.c3', 'met', '규정과 서비스조직 보고서는 온유회사 통제의 운영 증거가 아니라는 이유를 적었다.')] },
                sub2: { expected_points: 4, expected_verdicts: [v('sub2.c1', 'met', '⑤·⑥·⑧만 정확히 골랐다.'), v('sub2.c2', 'met', '10~12월 추가 증거를 입수하는 절차를 적었다.'), v('sub2.c3', 'met', '변경을 고려한 추가 증거 결정을 적었다.'), v('sub2.c4', 'met', '예외의 영향을 평가하는 절차를 적었다.')] } } },
    ],
});
console.log('r03 v2 design/lineage/qa written', reviewedContentHash(v2));
