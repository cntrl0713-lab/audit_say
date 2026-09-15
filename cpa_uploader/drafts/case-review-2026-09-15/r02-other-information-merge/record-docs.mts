// r02 설계 장부·계보·대표 답안 기록(한 번만 실행; 기존 파일이 있으면 쓰지 않는다).
//   npx tsx cpa_uploader/drafts/case-review-2026-09-15/r02-other-information-merge/record-docs.mts
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewedContentHash } from '../../../questionReviewIdentity.ts';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r02-other-information-merge';
const BANK = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const sha = (p: string) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const bank = JSON.parse(fs.readFileSync(BANK, 'utf8'));
const [draft] = JSON.parse(fs.readFileSync(`${D}/sets.json`, 'utf8'));
const SET: string = draft.id;
const src = (id: string) => {
    const s = bank.find((x: { id: string }) => x.id === id);
    return { set_id: id, title: s.title, status: s.status, reviewed_content_sha256: reviewedContentHash(s),
        points: s.subquestions.reduce((n: number, q: { criteria: { max_points: number }[] }) => n + q.criteria.reduce((m, c) => m + c.max_points, 0), 0) };
};
const v = (criterion_id: string, verdict: string, reason: string) => ({ criterion_id, verdict, reason });
const write = (name: string, value: unknown) => fs.writeFileSync(`${D}/${name}`, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });

write('design.json', {
    version: 1, set_id: SET, route: '사례형 병합 수정(검토 스킬) + 새 사실관계·발문 제작(제작 스킬)',
    format: '옳고 그름을 구분하는 선택형: 번호를 붙인 절차·판단 중 옳지 않은 것을 모두 찾아 번호와 이유 또는 보완절차를 간략히 쓴다.',
    user_requests: ['60·21을 한 문제로 합친다.', '옳은 절차·판단과 옳지 않은 절차·판단을 함께 두고 옳지 않은 것을 찾아 이유나 보완절차를 서술하게 한다.',
        '기타정보에 관해 물어볼 다른 요소가 있으면 추가해 종합 문제로 만든다.', '연도는 20X1·20X2로 쓰고 대상 연도는 2027년이다.', '후속절차나 이유를 너무 구체적으로 요구하지 않는다.'],
    items: [
        { no: '①', fact_id: 'fact2', verdict: '옳음(함정)', kind: '절차', basis: 'KGA 720 문단 13(a)·(c): 사업보고서를 구성하는 문서와 발행 시기를 경영진과 논의해 정하고, 감사보고서일 후에 제공될 문서는 발행 전 최종본 제공에 관한 서면진술을 요청한다.', origin: 'new_element' },
        { no: '②', fact_id: 'fact2', verdict: '옳지 않음', kind: '판단', basis: 'KGA 720 문단 7(b)·12(b): 투자설명서를 포함한 증권 공모서류에는 적용되지 않으며 기타정보는 사업보고서에 포함된 정보이다.', origin: 'new_element' },
        { no: '③', fact_id: 'fact2', verdict: '옳음(함정)', kind: '절차', basis: 'KGA 720 문단 16: 중요한 불일치로 보이면 경영진과 논의하고 필요하면 기타정보·재무제표 중 어디에 중요한 왜곡표시가 있는지 결론 내리기 위한 절차를 수행한다. 재무제표 감사가 거의 끝났어도 재무제표를 옳다고 전제하지 않는다.', origin: 'case-16-other-information-cause-20260914/sub1' },
        { no: '④', fact_id: 'fact2', verdict: '옳지 않음', kind: '절차·판단', basis: 'KGA 720 문단 16(c)·20, KGA 315 문단 37, KGA 330 문단 6: 기업과 기업환경에 대한 이해가 갱신될 필요가 있으면 위험평가와 추가감사절차를 수정한다.', origin: 'case-16-other-information-cause-20260914/sub3' },
        { no: '⑤', fact_id: 'fact2', verdict: '옳지 않음', kind: '판단', basis: 'KGA 720 문단 14·15: 기타정보를 열람하고, 재무제표나 감사인의 지식과 관련 없는 기타정보가 중요하게 왜곡표시된 것으로 보이는 징후에 주의를 유지한다.', origin: 'new_element' },
        { no: '⑥', fact_id: 'fact3', verdict: '옳지 않음', kind: '판단', basis: 'KGA 705 문단 7(a), KGA 720 문단 20: 충분한 증거로 확인된 재무제표의 중요하지만 전반적이지 않은 미수정왜곡표시는 한정의견 사유이며 기타정보 단락으로 대신하지 않는다.', origin: 'case-16-other-information-cause-20260914/sub2' },
        { no: '⑦', fact_id: 'fact3', verdict: '옳음(함정)', kind: '판단·절차', basis: 'KGA 720 문단 18(a)·A45: 수정 거부만으로 재무제표 의견을 거절하지 않으며(성실성·증거 신뢰성 의문이 있는 드문 경우 제외) 감사보고서에서 어떻게 다룰지 지배기구와 커뮤니케이션한다. 사실관계상 해지는 불가능하고 성실성 의문이 없다.', origin: 'pilot-16-011/sub1' },
        { no: '⑧', fact_id: 'fact3', verdict: '옳지 않음', kind: '절차', basis: 'KGA 720 문단 22(e)(ii): 기타정보에 중요한 미수정왜곡표시가 있다고 결론 내렸으면 기타정보 단락에 이를 기술한다.', origin: 'pilot-16-011/sub1' },
        { no: '⑨', fact_id: 'fact3', verdict: '옳음(함정)', kind: '절차', basis: 'KGA 720 문단 21(a)·22(b): 상장기업은 감사보고서일 전에 입수한 기타정보와 감사보고서일 후 입수할 것으로 예상되는 기타정보를 식별한다.', origin: 'new_element' },
        { no: '⑩', fact_id: 'fact4', verdict: '옳음(함정)', kind: '절차', basis: 'KGA 720 문단 6·17·19: 기타정보에 관한 책임은 입수 시점과 관계없이 적용되며 중요한 왜곡표시는 경영진에게 수정을 요구하고 거부되면 지배기구와 커뮤니케이션한다.', origin: 'pilot-16-011/exp1' },
        { no: '⑪', fact_id: 'fact4', verdict: '옳지 않음', kind: '판단', basis: 'KGA 720 문단 19(b)·A49·A50: 지배기구와 커뮤니케이션한 뒤에도 수정되지 않으면 법적 권리와 의무를 고려해 이용자가 주의를 기울이도록 적절한 조치를 취한다.', origin: 'pilot-16-011/exp1' },
    ],
    questions: [
        { subquestion_id: 'sub1', question_style: 'case', type: 'judgment', topic_ids: ['16', '06', '07'], case_fact_ids: ['fact1', 'fact2'],
            topic_reason: '16: 기타정보의 입수·적용 범위·열람과 불일치 대응(KGA 720). 06·07: ④에서 기타정보로 드러난 사실에 따라 위험평가(KGA 315)와 추가감사절차(KGA 330)를 수정해야 한다.',
            criteria: [
                { id: 'sub1.c1', points: 1, meaning: '식별: ②·④·⑤를 모두 고르고 함정 ①·③은 고르지 않음' },
                { id: 'sub1.c2', points: 1, meaning: '②: 증권 공모서류는 적용 대상 아님(이유) 또는 기타정보에서 제외(절차)' },
                { id: 'sub1.c3', points: 1, meaning: '④: 이해 갱신·위험평가 또는 재고 평가 절차 수정(이유 또는 절차 중 하나)' },
                { id: 'sub1.c4', points: 1, meaning: '⑤: 관련 없는 기타정보도 열람하며 왜곡표시 징후에 주의(이유 또는 절차)' }],
            minimum_sufficient_answer: '②·④·⑤를 고르고 각각 한 문장씩 이유나 보완절차를 쓴다.',
            point_decision: '4점. 옳지 않은 항목마다 이유나 보완절차 한 가지를 1점으로 두고(사용자 지시: 구체적 후속절차를 요구하지 않음), 함정을 구별한 식별 1점을 둔다. 원 60 sub1·sub3(각 2점)은 조치의 세부를 요구했으나 새 형식은 핵심 원칙 수준 한 가지로 줄였다.' },
        { subquestion_id: 'sub2', question_style: 'case', type: 'judgment', topic_ids: ['16', '15'], case_fact_ids: ['fact1', 'fact3', 'fact4'],
            topic_reason: '16: 기타정보의 미수정왜곡표시 대응·기타정보 단락·감사보고서일 후 조치(KGA 720). 15: ⑥에서 재무제표 왜곡표시에 대한 감사의견(KGA 705)을 판단해야 한다.',
            criteria: [
                { id: 'sub2.c1', points: 1, meaning: '식별: ⑥·⑧·⑪을 모두 고르고 함정 ⑦·⑨·⑩은 고르지 않음' },
                { id: 'sub2.c2', points: 1, meaning: '⑥: 재무제표 왜곡표시는 감사의견으로 다룸(이유) 또는 한정의견(판단)' },
                { id: 'sub2.c3', points: 1, meaning: '⑧: 기타정보 단락에 미수정왜곡표시 기술(이유 또는 절차)' },
                { id: 'sub2.c4', points: 1, meaning: '⑪: 법적 권리·의무를 고려한 적절한 조치(이유 또는 절차 하나)' }],
            minimum_sufficient_answer: '⑥·⑧·⑪을 고르고 각각 한 문장씩 이유나 보완절차를 쓴다.',
            point_decision: '4점. 원 60 sub2(2점)와 21 sub1(3점)·exp1(2점)의 판단·조치 가운데 옳지 않은 항목 세 개를 이유나 보완절차 1점씩으로 채점하고 식별 1점을 둔다. 함정 ⑦·⑨·⑩은 식별 기준으로만 평가한다.' },
    ],
    spoiler_review: [
        '원 60의 팀원 갑·을·병 제안과 “보완하시오”, “누구와 무엇을 논의하고” 같은 결론형 발문, 원 21의 “의견거절이 자동으로 필요한지”, “고려할 사항과 목적” 발문을 모두 없앴다.',
        '원 60에서 틀린 제안이던 사업보고서 삭제 요구는, 뒤 단계의 조사 결과(자료 3)가 앞 항목의 정답을 드러내지 않도록 ③을 옳은 절차(차이 논의와 재무제표 조사)로 바꾸었다.',
        '⑦의 옳음을 확정하는 성실성 판단과 해지 불가 사실은 ⑦과 떨어진 자료 3 첫 문단에 두었다. 절차 문장에는 결론을 암시하는 연결어를 넣지 않았다.',
        '연도는 20X1·20X2로 썼다. 대상 연도 2027년과 KGA 720 적용대상 판단은 verification.notes에 기록했다.',
    ],
    nonduplication: [
        '기존 기준서형 가운데 KGA 720 문단 22 기타정보 단락 구성요소나 문단 18·19 대응을 일반적으로 묻는 물음과 달리, 이 사례는 절차·판단의 옳고 그름을 사실에 적용해 구별하게 한다.',
        '원 60·21은 병합 후 퇴역 대상이다. 원 21 sub1의 의견거절 자동 여부는 함정 ⑦로, 기타정보 단락 기술은 ⑧로 옮겼다.',
    ],
    edition: 'KGA 720 2025 개정 전문(문단 10: 주권상장법인·직전 사업연도말 자산총액 5천억원 이상은 2026-01-01 이후 개시 보고기간 시행)을 대상 연도 2027년 기준으로 적용했다. 원 두 세트의 판본과 같다.',
    target_reviewed_content_sha256: reviewedContentHash(draft),
});

write('lineage.json', {
    version: 1, artifact_type: 'case_merge_lineage', created_at: '2026-09-15',
    user_instruction: 'docs/case-question-edit-notes-2026-09-14.md 항목 60·21 및 2026-09-15 대화 지시(기타정보 종합 문제로 확장)',
    source_bank: { file: BANK, sha256: sha(BANK) }, sources: [src('case-16-other-information-cause-20260914'), src('pilot-16-011')],
    target: { set_id: SET, reviewed_content_sha256: reviewedContentHash(draft), points: 8 },
    mapping: [
        { from: 'case-16-other-information-cause-20260914/sub1 (c1 경영진 논의, c2 계약조건·판매내역 조사)', disposition: 'converted_to_trap', to: 'fact2 ③(옳음)', reason: '팀원 갑의 삭제 요구 대신 적절한 논의·조사를 옳은 절차로 두어 뒤 단계의 조사 결과가 앞 항목의 정답을 드러내지 않게 했다.' },
        { from: 'case-16-other-information-cause-20260914/sub2 (c1 한정의견, c2 그 이유)', disposition: 'converted_to_incorrect_item', to: 'fact3 ⑥, sub2.c2', reason: '팀원 을의 제안을 팀의 판단으로 바꾸고 이유 또는 판단 한 가지를 1점으로 채점한다.' },
        { from: 'case-16-other-information-cause-20260914/sub3 (c1 위험평가 수정, c2 절차 재설계)', disposition: 'converted_to_incorrect_item', to: 'fact2 ④, sub1.c3', reason: '팀원 병의 제안을 팀의 절차로 바꾸고 이해 갱신·위험평가 수정 또는 절차 보완 중 하나를 1점으로 채점한다.' },
        { from: 'pilot-16-011/sub1 (crit1 의견거절 자동 불필요, crit2 기타정보 단락 기술, crit3 보고계획 전달)', disposition: 'split', to: 'fact3 ⑦(옳음: crit1·crit3), ⑧(옳지 않음: crit2), sub2.c3', reason: '갑의 상황을 같은 회사의 영업손익 설명 왜곡표시로 옮겼다. 의견거절 불필요와 보고계획 전달은 함정으로, 기타정보 단락 기술은 옳지 않은 항목의 채점으로 둔다.' },
        { from: 'pilot-16-011/exp1 (crit1 법적 권리·의무 고려, crit2 이용자 주의 환기 조치)', disposition: 'converted_to_incorrect_item', to: 'fact4 ⑩(옳음), ⑪(옳지 않음), sub2.c4', reason: '을의 상황을 같은 회사의 연차보고서로 옮기고 담당자의 종결 제안을 팀의 판단 ⑪로 바꿨다. 두 의미 단위는 한 가지 이유나 조치로 1점을 준다.' },
        { from: null, disposition: 'new_elements', to: '①(문단 13 서면진술), ②(문단 7(b) 적용 제외), ⑤(문단 14·15 주의 유지), ⑨(문단 21·22(b) 식별)', reason: '사용자 요청: 기타정보에 관해 물어볼 다른 요소를 추가해 종합 문제로 만든다.' },
        { from: null, disposition: 'new_criteria', to: 'sub1.c1, sub2.c1', reason: '선택형 식별 기준. 함정 선택·누락 모두 미득점.' },
    ],
    retirement: { requested_by_user: 'merge_into_one_problem', active_release_exclusion: 'not_performed', note: '원 두 세트의 활성 릴리스 제외는 사용자 퇴역 승인과 DB 퇴역 경로 확인 뒤 별도로 수행한다. 현재 운영 퇴역 RPC는 기준서형 세트만 허용한다.' },
});

write('qa.json', {
    version: 1, set_id: SET, method: 'author_expected_verdicts_before_model_grading', human_review_performed: false,
    note: '모범답안은 저장 model_answer를 그대로 쓴다. 부분정답·오답과 기대 판정은 실제 채점 전에 원문·criterion에서 정했다. contradicted와 not_met은 모두 0점이다.',
    cases: [
        { id: 'r02-sub1-partial', set_id: SET, subquestion_id: 'sub1', kind: 'partial',
            answer: '옳지 않은 것은 ②, ③, ④이다.\n② 투자설명서 같은 증권 공모서류는 기타정보가 아니므로 기타정보 단락에서 식별하면 안 된다.\n③ 재무제표 감사는 이미 대부분 끝났으므로 차이는 사업보고서만 수정하게 하면 되고 재무제표를 다시 조사할 필요는 없다.\n④ 가동중단은 감사인이 기존에 이해한 내용과 다르므로 재고 평가에 관한 위험평가를 수정하고 감사절차를 보완해야 한다.',
            expected_verdicts: [v('sub1.c1', 'contradicted', '옳은 ③을 옳지 않다고 골랐고 ⑤를 빠뜨렸다.'), v('sub1.c2', 'met', '증권 공모서류는 기타정보가 아니라는 이유를 적었다.'),
                v('sub1.c3', 'met', '기존 이해와 달라 위험평가 수정·절차 보완이 필요하다고 적었다.'), v('sub1.c4', 'not_met', '⑤를 다루지 않았다.')],
            expected_points: 2, reason: '함정 ③ 선택과 ⑤ 누락으로 식별 점수만 잃고 ②·④의 이유는 유지되는지 확인하는 부분정답이다.' },
        { id: 'r02-sub1-wrong', set_id: SET, subquestion_id: 'sub1', kind: 'wrong',
            answer: '옳지 않은 것은 ①과 ③이다.\n① 감사보고서일 후에 완성되는 연차보고서는 감사인의 책임 범위가 아니므로 서면진술을 요청할 필요가 없다.\n③ 재무제표 감사가 끝났으므로 차이가 있으면 사업보고서의 설명을 삭제하게 하면 된다.\n②, ④, ⑤는 적절하다.',
            expected_verdicts: [v('sub1.c1', 'contradicted', '함정 ①·③만 고르고 ②·④·⑤가 적절하다고 명시했다.'), v('sub1.c2', 'contradicted', '투자설명서를 기타정보로 본 ②가 적절하다고 명시했다.'),
                v('sub1.c3', 'contradicted', '기존 계획을 유지한 ④가 적절하다고 명시했다.'), v('sub1.c4', 'contradicted', '관련 없는 기타정보를 읽지 않은 ⑤가 적절하다고 명시했다.')],
            expected_points: 0, reason: '함정만 고르고 옳지 않은 항목을 적절하다고 쓴 대표 오답이다.' },
        { id: 'r02-sub2-partial', set_id: SET, subquestion_id: 'sub2', kind: 'partial',
            answer: '옳지 않은 것은 ⑥, ⑦, ⑪이다.\n⑥ 매출 과대계상은 재무제표의 중요한 왜곡표시이므로 기타정보 단락에 기술하는 것으로는 부족하고 한정의견을 표명해야 한다.\n⑦ 경영진이 기타정보 수정을 거부하였으므로 재무제표에 대한 의견을 거절해야 한다.\n⑪ 감사보고서일이 지났더라도 법률 조언을 받아 주주총회에서 알리는 등 적절한 조치를 취해야 한다.',
            expected_verdicts: [v('sub2.c1', 'contradicted', '옳은 ⑦을 옳지 않다고 골랐고 ⑧을 빠뜨렸다.'), v('sub2.c2', 'met', '재무제표 왜곡표시는 기타정보 단락으로 부족하고 한정의견이 필요하다고 적었다.'),
                v('sub2.c3', 'not_met', '⑧을 다루지 않았다.'), v('sub2.c4', 'met', '법률 조언·주주총회 언급 등 적절한 조치를 적었다.')],
            expected_points: 2, reason: '함정 ⑦(의견거절 오해) 선택과 ⑧ 누락을 담은 부분정답이다.' },
        { id: 'r02-sub2-wrong', set_id: SET, subquestion_id: 'sub2', kind: 'wrong',
            answer: '옳지 않은 것은 ⑨와 ⑩이다.\n⑨ 감사보고서일 후에 입수할 연차보고서는 아직 입수하지 않았으므로 기타정보 단락에 식별할 수 없다.\n⑩ 감사보고서일 후에는 기타정보에 대한 감사인의 책임이 없으므로 연차보고서를 열람할 필요가 없다.\n⑥, ⑧, ⑪은 적절하다.',
            expected_verdicts: [v('sub2.c1', 'contradicted', '함정 ⑨·⑩만 고르고 ⑥·⑧·⑪이 적절하다고 명시했다.'), v('sub2.c2', 'contradicted', '적정의견을 표명한 ⑥이 적절하다고 명시했다.'),
                v('sub2.c3', 'contradicted', '보고할 사항 없음으로 기재한 ⑧이 적절하다고 명시했다.'), v('sub2.c4', 'contradicted', '조치 없이 종결한 ⑪이 적절하다고 명시했다.')],
            expected_points: 0, reason: '함정만 고르고 옳지 않은 항목을 적절하다고 쓴 대표 오답이다.' },
    ],
    supplementary_cases: [
        { id: 'r02-supp-reason-or-procedure', purpose: '물음 1은 보완절차만, 물음 2는 이유만 쓴 답이 항목별 1점을 모두 받는지 확인한다.',
            answers: {
                sub1: '②, ④, ⑤가 옳지 않다.\n② 투자설명서는 기타정보에서 제외해야 한다.\n④ 특수제품 재고의 위험평가를 다시 하고 재고 평가 절차를 보완해야 한다.\n⑤ 지배구조·환경 설명도 읽으면서 왜곡표시로 보이는 징후가 있는지 살펴야 한다.',
                sub2: '⑥, ⑧, ⑪이 옳지 않다.\n⑥ 재무제표 자체의 중요한 왜곡표시는 기타정보 단락이 아니라 감사의견으로 다뤄야 하는 사항이기 때문이다.\n⑧ 기타정보에 중요한 미수정왜곡표시가 있다고 결론 내렸다면 기타정보 단락에 그 내용을 기술해야 하기 때문이다.\n⑪ 감사보고서일이 지나도 수정되지 않은 기타정보의 중요한 왜곡표시에 대해서는 감사인의 법적 권리와 의무를 고려해 대응할 책임이 남기 때문이다.' },
            expected: {
                sub1: { expected_points: 4, expected_verdicts: [v('sub1.c1', 'met', '②·④·⑤만 정확히 골랐다.'), v('sub1.c2', 'met', '투자설명서를 기타정보에서 제외하는 절차를 적었다.'),
                    v('sub1.c3', 'met', '위험평가 재수행·재고 평가 절차 보완을 적었다.'), v('sub1.c4', 'met', '관련 없는 부분도 읽으며 징후를 살피는 절차를 적었다.')] },
                sub2: { expected_points: 4, expected_verdicts: [v('sub2.c1', 'met', '⑥·⑧·⑪만 정확히 골랐다.'), v('sub2.c2', 'met', '재무제표 왜곡표시는 감사의견으로 다룬다는 이유를 적었다.'),
                    v('sub2.c3', 'met', '기타정보 단락에 기술해야 한다는 이유를 적었다.'), v('sub2.c4', 'met', '법적 권리·의무를 고려해 대응할 책임이 남는다는 이유를 적었다.')] } } },
    ],
});
console.log('design/lineage/qa written', reviewedContentHash(draft));
