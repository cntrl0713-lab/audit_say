// r04 설계 장부·계보·대표 답안 기록(한 번만 실행; 기존 파일이 있으면 쓰지 않는다).
//   npx tsx cpa_uploader/drafts/case-review-2026-09-15/r04-initial-audit/record-docs.mts
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewedContentHash } from '../../../questionReviewIdentity.ts';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r04-initial-audit';
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
    version: 1, set_id: SET, route: '사례형 재구성(검토 스킬) + 새 사실관계·발문 제작(제작 스킬)',
    format: '물음 1·3·4는 옳고 그름을 구분하는 선택형(번호를 붙인 절차·판단 중 옳지 않은 것을 모두 찾아 번호와 이유 또는 보완절차를 간략히 쓴다), 물음 2는 자료별 경영진주장을 나열하는 열거형이다.',
    user_requests: [
        '물음 1은 수정 방향을 질문해 달라고 했고, 제시한 세 방안 중 계획 단계 선택형(①~⑤, 팀장의 즉시 의견변형 판단을 옳지 않은 항목으로 포함)을 골랐다.',
        '물음 2는 어떤 자료가 어떤 경영진주장에 대한 증거를 제공하는지 나열하는 물음으로 바꾼다. 두 해석 중 수험생이 나열하는 열거형을 골랐다.',
        '물음 3은 당기 실사·수량변동 자료를 바탕으로 기초 재고자산 항목의 평가에 대한 감사증거를 입수하였다는 함정을 둔다.',
        '물음 4(상황 A·B의 변형의견 계열)는 삭제한다.',
        '초도감사와 관련된 물음을 추가하되 요소는 사실관계에 적합하게 고른다.',
        '공통 기준: 암시 제거, 옳고 그름을 구분하는 형식, 이유나 보완절차는 간략히, 연도는 20X1·20X2(대상 연도 2027년).',
    ],
    items: [
        { no: '①', fact_id: 'fact2', verdict: '옳음', kind: '절차', basis: 'KGA 300 문단 13: 초도감사 착수 전에 수임 절차를 수행하고 감사인이 변경된 경우 윤리기준에 따라 전임감사인과 커뮤니케이션한다.', origin: 'new_element' },
        { no: '②', fact_id: 'fact2', verdict: '옳음', kind: '절차', basis: 'KGA 510 문단 5: 최근의 재무제표와 전임감사인의 감사보고서, 공시 등 기초잔액에 관한 정보를 열람한다. 공시 사실은 절차의 옳음을 정당화하는 기준 문구가 아닌 상황 설명이다.', origin: 'new_element' },
        { no: '③', fact_id: 'fact2', verdict: '옳지 않음', kind: '판단', basis: 'KGA 510 문단 6(c): 전임감사인의 감사조서 검토 외에 당기 감사절차가 기초잔액 증거를 제공하는지 평가하거나 특정 감사절차를 수행한다. 조서 열람 불가만으로 증거 입수 불가를 결론 내리고 한정의견을 계획할 수 없다.', origin: 'pilot-09-010/sub1' },
        { no: '④', fact_id: 'fact2', verdict: '옳음', kind: '절차', basis: 'KGA 510 문단 6(a): 전기의 마감잔액이 정확하게 당기로 이월되었는지 결정한다.', origin: 'new_element' },
        { no: '⑤', fact_id: 'fact2', verdict: '옳지 않음', kind: '판단', basis: 'KGA 510 문단 9: 전임감사인의 감사의견에 변형이 있었으면 당기 중요왜곡표시위험을 평가할 때 그 변형을 초래한 사항의 영향을 평가한다.', origin: 'new_element' },
        { no: '(가)·(나)', fact_id: 'fact3', verdict: '열거 대상', kind: '자료', basis: 'KGA 510 문단 A6: 당기 중 회수(지급)된 기초 매출채권(매입채무)은 보고기간 개시일의 실재성, 권리와 의무, 완전성 및 평가에 대한 감사증거 중 일부를 제공한다. 주장 명칭은 KGA 315 문단 A190(b)의 범주명도 인정한다.', origin: 'pilot-09-010/sub2(crit1~4). 매입채무 (나)는 같은 A6 문장에서 추가' },
        { no: '⑥', fact_id: 'fact4', verdict: '옳지 않음(사용자 지정 함정)', kind: '절차·판단', basis: 'KGA 510 문단 A6, KGA 500 문단 A32: 당기 실사와 기초 재고수량 조정은 수량에 관한 증거이며 재고자산의 실재성에 관한 증거는 평가에 관한 증거를 대체하지 못한다. 기초 재고자산 항목의 평가에 대한 절차가 따로 필요하다.', origin: 'pilot-09-010/sub4(crit6·crit7)' },
        { no: '⑦', fact_id: 'fact4', verdict: '옳음(함정)', kind: '절차', basis: 'KGA 510 문단 A6: 매출총이익과 기간귀속에 대한 감사절차는 기초 재고자산에 관한 충분하고 적합한 감사증거를 제공할 수 있는 절차의 하나다.', origin: 'pilot-09-010/sub4(범위 제외였던 요소를 옳은 항목으로)' },
        { no: '⑧', fact_id: 'fact4', verdict: '옳음(함정)', kind: '절차', basis: 'KGA 510 문단 A7: 장기부채는 제3자에 대한 조회를 통하여 기초잔액에 대한 감사증거를 일부 입수할 수 있다.', origin: 'new_element' },
        { no: '⑨', fact_id: 'fact4', verdict: '옳지 않음', kind: '판단', basis: 'KGA 510 문단 7: 기초잔액에 당기재무제표에 중요하게 영향을 미칠 수 있는 왜곡표시가 포함되어 있다는 증거를 입수하면 당기재무제표에 대한 영향을 결정하기 위한 절차를 추가로 수행하고, 왜곡표시가 있으면 경영진·지배기구와 커뮤니케이션한다.', origin: 'new_element' },
        { no: '⑩', fact_id: 'fact5', verdict: '옳음(함정)', kind: '판단', basis: 'KGA 510 문단 13·A9: 전임감사인의 의견변형은 당기에도 계속 관련성이 있고 중요할 때 당기 의견을 변형한다. 전기 범위제한 사항이 당기에 해결되면 관련성이 없을 수 있다. 장기대여금은 전액 회수되었고 감사팀이 충분하고 적합한 증거를 입수했다.', origin: 'new_element' },
        { no: '⑪', fact_id: 'fact5', verdict: '옳음(함정)', kind: '판단', basis: 'KGA 710 문단 2·17: 외부감사법에 따른 감사는 비교재무제표 방식으로 보고하고, 전임감사인이 감사한 전기재무제표의 감사보고서가 재발행되지 않으면 당기재무제표에 대한 의견표명에 추가하여 기타사항문단에 기재한다.', origin: 'new_element' },
        { no: '⑫', fact_id: 'fact5', verdict: '옳지 않음', kind: '판단', basis: 'KGA 710 문단 17(b): 기타사항문단에 전임감사인이 표명한 의견의 유형과, 변형되었으면 그 이유를 기재한다.', origin: 'new_element' },
    ],
    questions: [
        { subquestion_id: 'sub1', question_style: 'case', type: 'judgment', topic_ids: ['09', '04'], case_fact_ids: ['fact1', 'fact2'],
            topic_reason: '09: 초도감사의 기초잔액 절차(KGA 510 문단 5·6·9). 04: ①에서 초도감사 착수 전 수임 절차와 전임감사인과의 커뮤니케이션(KGA 300 문단 13)을 판단해야 한다.',
            criteria: [
                { id: 'sub1.c1', points: 1, meaning: '식별: ③·⑤를 모두 고르고 ①·②·④는 고르지 않음' },
                { id: 'sub1.c2', points: 1, meaning: '③: 다른 경로(당기 절차 평가·특정 절차)로 기초잔액 증거를 입수할 수 있음(이유) 또는 그 절차' },
                { id: 'sub1.c3', points: 1, meaning: '⑤: 전임감사인 의견변형 사유(장기대여금)의 영향을 당기 위험평가에서 평가(이유 또는 절차)' }],
            minimum_sufficient_answer: '③·⑤를 고르고 각각 한 문장씩 이유나 보완절차를 쓴다.',
            point_decision: '3점. 원 sub1(판단 1 + 510.6(c) 두 경로 각 1)의 경로 완전 열거는 기준서 암기이고 발문이 경로 수를 알려 주었으므로 없앴다. 팀장의 판단을 옳지 않은 항목 ③으로 두고 이유나 보완절차 한 가지를 1점, 새 요소 ⑤를 1점, 식별 1점으로 둔다.' },
        { subquestion_id: 'sub2', question_style: 'case', type: 'enumeration', topic_ids: ['09', '08'], case_fact_ids: ['fact1', 'fact3'],
            topic_reason: '09: 초도감사에서 당기 감사절차가 기초잔액 증거를 제공하는지 평가(KGA 510 문단 A6). 08: 증거가 관련되는 경영진주장(KGA 315 문단 A190(b))을 구분해야 한다.',
            criteria: [
                { id: 'sub2.c1', points: 1, meaning: '실재성' },
                { id: 'sub2.c2', points: 1, meaning: '권리와 의무(권리·의무로 나눈 명칭 인정)' },
                { id: 'sub2.c3', points: 1, meaning: '완전성' },
                { id: 'sub2.c4', points: 1, meaning: '평가(정확성, 평가 및 배분 명칭 인정)' }],
            minimum_sufficient_answer: '실재성, 권리와 의무, 완전성, 평가를 나열한다.',
            point_decision: '4점. 열거형으로 A6이 명시한 주장마다 1점이다. 원 sub2의 범위 한계 설명(1점)은 사용자 지시(나열식)에 따라 삭제했다. 두 자료가 같은 주장 목록을 가지므로 자료별 중복 배점(8점)은 두지 않고, 한 번에 나열하거나 한 자료에만 붙여 쓴 주장도 인정한다.',
            classification_note: '자료 (가)·(나)는 사례 회사가 입수한 자료이며 원 sub2와 같은 방식으로 사례 자료에 기준을 적용하는 물음이다. 사용자가 이 사례 안의 물음으로 형식 변경을 지시했으므로 사례형으로 둔다. 답의 핵심이 A6 문장의 주장 목록이라 기준서 지식 의존도가 높다는 한계를 기록한다.' },
        { subquestion_id: 'sub3', question_style: 'case', type: 'judgment', topic_ids: ['09', '08'], case_fact_ids: ['fact1', 'fact4'],
            topic_reason: '09: 기초 재고자산·장기부채·기초잔액 왜곡표시에 대한 절차(KGA 510 문단 A6·A7·7). 08: ⑥에서 실재성(수량)에 관한 증거가 평가에 관한 증거를 대체하지 못함(KGA 500 문단 A32)을 판단해야 한다.',
            criteria: [
                { id: 'sub3.c1', points: 1, meaning: '식별: ⑥·⑨를 모두 고르고 ⑦·⑧은 고르지 않음' },
                { id: 'sub3.c2', points: 1, meaning: '⑥: 수량 조정은 평가 증거가 아님(이유) 또는 기초 재고 평가 절차를 따로 수행(절차)' },
                { id: 'sub3.c3', points: 1, meaning: '⑨: 당기재무제표 영향을 결정하기 위한 추가 절차(이유 또는 절차, 경영진·지배기구 커뮤니케이션도 인정)' }],
            minimum_sufficient_answer: '⑥·⑨를 고르고 각각 한 문장씩 이유나 보완절차를 쓴다.',
            point_decision: '3점. 원 sub4(실사 조정 1 + 평가 절차 1)는 두 절차를 서술하게 했으나, 사용자 지시대로 실사·수량 자료로 평가 증거를 입수했다는 함정 ⑥을 두고 이유나 절차 한 가지를 1점으로 줄였다. 새 요소 ⑨ 1점, 식별 1점.' },
        { subquestion_id: 'sub4', question_style: 'case', type: 'judgment', topic_ids: ['09', '16', '15'], case_fact_ids: ['fact1', 'fact5'],
            topic_reason: '09: 전임감사인 의견변형의 당기 영향(KGA 510 문단 13·A9). 16: 비교재무제표 방식과 전임감사인에 관한 기타사항문단(KGA 710 문단 2·17). 15: ⑩·⑪에서 당기 감사의견의 변형 여부와 의견 대상 기간을 판단해야 한다.',
            criteria: [
                { id: 'sub4.c1', points: 1, meaning: '식별: ⑫만 고르고 ⑩·⑪은 고르지 않음' },
                { id: 'sub4.c2', points: 1, meaning: '⑫: 기타사항문단에 전임감사인 의견의 유형과 변형 사유를 기재(이유 또는 절차)' }],
            minimum_sufficient_answer: '⑫를 고르고 한 문장으로 이유나 보완절차를 쓴다.',
            point_decision: '2점. 사용자가 삭제한 원 물음 4(변형의견 계열 열거, 4점)를 대신해 초도감사의 보고 요소를 새 물음으로 두었다. 옳지 않은 항목은 ⑫ 하나이며 함정 ⑩·⑪은 식별 기준으로만 평가한다.' },
    ],
    spoiler_review: [
        '원 사실관계의 “다른 증거경로는 아직 검토하지 않았다”, 팀장이 “이유만으로 … 곧바로” 변형하려 한다는 문구와 “이들 자료로 충분하고 적합한 증거가 확보되었다는 결론은 아직 내리지 않았다”는 미결 사실, 발문의 “문단 6(c)에서 … 두 증거경로를 모두 제시”, “문단 A6에 따라”, “매출총이익·기간귀속 절차는 범위에서 제외”를 모두 없앴다.',
        '옳지 않은 항목에만 “…이므로” 근거가 붙거나 같은 근거(전기 사항)가 반복되면 근거 문구가 정답 표지가 되므로, ⑤·⑨·⑫의 근거를 서로 다르게 쓰고 옳은 항목 ②·⑧에도 상황 설명인 사실 근거를 두었다.',
        '뒤 단계의 자료 3·4에 기초잔액 절차가 나오는 것은 ③(조서 열람 불가를 이유로 증거 입수 불가 판단)과 논리적으로 이어진다. 사용자가 고른 구성(계획 단계 선택형 + 기초잔액 자료·절차 물음)에서 불가피한 연결이며, 뒤 단계 사실은 ③의 판단을 평가하거나 그 결과를 알려 주지 않는다.',
        '⑩의 옳음을 정하는 장기대여금 회수와 증거 입수 사실은 자료 5 첫 문단에 두었다. ⑥의 결론 문장은 “평가에 관한 증거도”가 아니라 “수량과 평가에 관한 증거”로 써서 첨가 표현이 틀림을 암시하지 않게 했다.',
        '연도는 20X0·20X1·20X2로 썼다. 대상 연도 2027년과 판본 판단은 verification.notes에 기록했다.',
    ],
    nonduplication: [
        '기존 기준서형 중 KGA 510 문단 6·10·A6이나 KGA 710 문단 17의 요구를 일반적으로 묻는 물음과 달리, 이 사례는 초도감사의 착수·기초잔액·보고 단계 절차와 판단을 사실에 적용해 구별하게 한다.',
        '원 pilot-09-010은 재구성 후 퇴역 대상이다. 원 sub3(상황 A·B 변형의견)은 사용자 지시로 삭제했다.',
    ],
    edition: '2025 개정 전문(KGA 300 문단 3, KGA 500 문단 3, KGA 510 문단 2, KGA 710 문단 4: 2026-01-01 이후 개시 보고기간 시행)을 대상 연도 2027년 기준으로 적용했다. KGA 300 문단 13은 2026 전문에서 문단 12로 번호가 바뀌었으나 요구 내용은 같다(출처 계보: cpa_uploader/raw/originals/case-review-2026-09-15/kga300-2025-excerpts.provenance.json).',
    target_reviewed_content_sha256: reviewedContentHash(draft),
});

write('lineage.json', {
    version: 1, artifact_type: 'case_merge_lineage', created_at: '2026-09-15',
    user_instruction: 'docs/case-question-edit-notes-2026-09-14.md 항목 29 및 2026-09-15 대화의 선택(물음 1 계획 단계 선택형, 물음 2 열거형, 추가 요소는 사실관계에 맞게)',
    source_bank: { file: BANK, sha256: sha(BANK) }, sources: [src('pilot-09-010')],
    target: { set_id: SET, reviewed_content_sha256: reviewedContentHash(draft), points: 12 },
    mapping: [
        { from: 'pilot-09-010/sub1 crit1 (팀장 계획의 부적절 판단)', disposition: 'converted_to_incorrect_item', to: 'fact2 ③, sub1.c2', reason: '팀장의 계획을 계획 단계 목록의 옳지 않은 항목으로 두고 이유나 보완절차 한 가지를 1점으로 채점한다.' },
        { from: 'pilot-09-010/sub1 crit2·crit3 (510.6(c)의 두 증거경로 열거)', disposition: 'merged_into_reason', to: 'sub1.c2', reason: '경로의 완전 열거는 기준서 암기이므로 없애고, 두 경로 중 하나나 다른 방법으로 증거를 입수한다는 원칙을 ③의 이유·절차로 인정한다.' },
        { from: 'pilot-09-010/sub2 crit1~crit4 (회수내역이 제공하는 실재성·권리·완전성·평가)', disposition: 'retained', to: 'fact3 (가)·(나), sub2.c1~c4', reason: '사용자 지시대로 자료별 경영진주장을 나열하는 열거형으로 바꾸고, 같은 A6 문장의 매입채무 지급내역 (나)를 더했다.' },
        { from: 'pilot-09-010/sub2 crit5 (회수내역만으로 얻는 증거의 범위 한계)', disposition: 'deleted', to: null, reason: '나열식 물음으로 바꾸라는 사용자 지시에 따라 서술 요소를 뺐다.' },
        { from: 'pilot-09-010/sub4 crit6·crit7 (실사 조정, 기초 재고 평가 절차)', disposition: 'converted_to_trap', to: 'fact4 ⑥(옳지 않음), sub3.c2', reason: '사용자 지정 함정: 당기 실사·수량변동 자료로 기초 재고자산 항목의 평가 증거까지 입수했다고 결론 낸 항목으로 바꾸었다.' },
        { from: 'pilot-09-010/sub4 발문의 매출총이익·기간귀속 제외', disposition: 'converted_to_trap', to: 'fact4 ⑦(옳음)', reason: '원 발문이 범위에서 뺀 A6의 세 번째 절차를 옳은 항목으로 두었다.' },
        { from: 'pilot-09-010/sub3 crit1~crit4 (상황 A·B 변형의견 계열)', disposition: 'deleted', to: null, reason: '사용자 지시(물음 4 삭제).' },
        { from: 'pilot-09-010 facts f1·case-team-plan·f2·f3', disposition: 'rewritten', to: 'fact1~fact5', reason: '실제 연도를 20X0·20X1·20X2로 바꾸고 암시·미결 사실과 상황 A·B를 없앴다. 전임감사인의 한정의견(장기대여금), 외부감사법 감사, 감사보고서 미재발행을 새 공통 사실로 두었다.' },
        { from: null, disposition: 'new_elements', to: '①(300.13), ②(510.5), ④(510.6(a)), ⑤(510.9), ⑧(510.A7), ⑨(510.7), ⑩(510.13·A9), ⑪·⑫(710.2·17)', reason: '사용자 요청: 초도감사 관련 요소를 사실관계에 맞게 추가한다.' },
        { from: null, disposition: 'new_criteria', to: 'sub1.c1, sub3.c1, sub4.c1', reason: '선택형 식별 기준. 함정 선택·누락 모두 미득점.' },
    ],
    retirement: { requested_by_user: 'restructure_into_new_set', active_release_exclusion: 'not_performed', note: '원 세트의 활성 릴리스 제외는 사용자 퇴역 승인과 DB 퇴역 경로 확인 뒤 모아서 한 번에 수행한다. 현재 운영 퇴역 RPC는 기준서형 세트만 허용한다.' },
});

write('qa.json', {
    version: 1, set_id: SET, method: 'author_expected_verdicts_before_model_grading', human_review_performed: false,
    note: '모범답안은 저장 model_answer를 그대로 쓴다. 부분정답·오답과 기대 판정은 실제 채점 전에 원문·criterion에서 정했다. contradicted와 not_met은 모두 0점이다.',
    cases: [
        { id: 'r04-sub1-partial', set_id: SET, subquestion_id: 'sub1', kind: 'partial',
            answer: '옳지 않은 것은 ③, ④, ⑤이다.\n③ 전임감사인의 감사조서를 볼 수 없더라도 당기 감사절차에서 얻은 증거를 평가하거나 기초잔액에 대한 별도의 감사절차를 수행해 증거를 입수할 수 있으므로, 곧바로 한정의견을 계획하면 안 된다.\n④ 전기 마감잔액은 전임감사인이 이미 감사하였으므로 이월 여부를 다시 확인할 필요가 없다.\n⑤ 전임감사인이 한정의견을 표명한 장기대여금 문제는 당기 위험평가에서 그 영향을 평가해야 한다.',
            expected_verdicts: [v('sub1.c1', 'contradicted', '옳은 ④를 옳지 않다고 골랐다.'), v('sub1.c2', 'met', '다른 경로로 기초잔액 증거를 입수할 수 있다는 이유를 적었다.'),
                v('sub1.c3', 'met', '장기대여금 문제의 영향을 당기 위험평가에서 평가해야 한다고 적었다.')],
            expected_points: 2, reason: '함정 ④ 선택으로 식별 점수만 잃고 ③·⑤의 이유는 유지되는지 확인하는 부분정답이다.' },
        { id: 'r04-sub1-wrong', set_id: SET, subquestion_id: 'sub1', kind: 'wrong',
            answer: '옳지 않은 것은 ①과 ②이다.\n① 감사계약을 체결하기 전에는 전임감사인과 커뮤니케이션할 수 없다.\n② 전임감사인의 감사보고서는 이미 공시되었으므로 다시 열람할 필요가 없다.\n③, ④, ⑤는 적절하다. 전임감사인의 조서를 볼 수 없으면 기초잔액의 증거를 얻을 수 없으므로 한정의견을 계획하는 것이 맞다.',
            expected_verdicts: [v('sub1.c1', 'contradicted', '①·②만 고르고 ③·⑤가 적절하다고 명시했다.'), v('sub1.c2', 'contradicted', '조서를 볼 수 없으면 증거를 얻을 수 없다고 명시했다.'),
                v('sub1.c3', 'contradicted', '장기대여금 문제를 위험평가에 반영하지 않은 ⑤가 적절하다고 명시했다.')],
            expected_points: 0, reason: '옳은 항목만 고르고 옳지 않은 항목을 적절하다고 쓴 대표 오답이다.' },
        { id: 'r04-sub2-partial', set_id: SET, subquestion_id: 'sub2', kind: 'partial',
            answer: '(가)와 (나)는 보고기간 개시일 잔액의 실재성과 완전성에 관한 감사증거를 제공한다.',
            expected_verdicts: [v('sub2.c1', 'met', '실재성을 나열했다.'), v('sub2.c2', 'not_met', '권리와 의무를 나열하지 않았다.'),
                v('sub2.c3', 'met', '완전성을 나열했다.'), v('sub2.c4', 'not_met', '평가를 나열하지 않았다.')],
            expected_points: 2, reason: '네 주장 중 두 개만 나열한 부분정답이다.' },
        { id: 'r04-sub2-wrong', set_id: SET, subquestion_id: 'sub2', kind: 'wrong',
            answer: '(가)와 (나)는 20X1년 중 거래의 발생사실과 기간귀속에 관한 증거일 뿐, 보고기간 개시일 잔액에 관한 경영진주장의 감사증거는 제공하지 않는다.',
            expected_verdicts: [v('sub2.c1', 'contradicted', '개시일 잔액의 주장에 관한 증거를 제공하지 않는다고 명시했다.'), v('sub2.c2', 'contradicted', '같은 이유로 권리와 의무를 부정했다.'),
                v('sub2.c3', 'contradicted', '같은 이유로 완전성을 부정했다.'), v('sub2.c4', 'contradicted', '같은 이유로 평가를 부정했다.')],
            expected_points: 0, reason: '거래 주장만 들고 개시일 잔액에 관한 증거 제공을 부정한 대표 오답이다.' },
        { id: 'r04-sub3-partial', set_id: SET, subquestion_id: 'sub3', kind: 'partial',
            answer: '옳지 않은 것은 ⑥이다.\n⑥ 실사 수량을 기초 재고수량으로 조정한 결과는 수량에 관한 증거일 뿐이므로, 기초 재고자산 항목의 평가에 대해서는 단가와 원가 기록을 테스트하는 등 별도의 절차를 수행해야 한다.',
            expected_verdicts: [v('sub3.c1', 'not_met', '옳지 않은 ⑨를 빠뜨렸다.'), v('sub3.c2', 'met', '수량 조정은 평가 증거가 아니며 평가 절차가 따로 필요하다고 적었다.'),
                v('sub3.c3', 'not_met', '⑨를 다루지 않았다.')],
            expected_points: 1, reason: '함정 없이 옳지 않은 항목 하나를 빠뜨린 부분정답이다.' },
        { id: 'r04-sub3-wrong', set_id: SET, subquestion_id: 'sub3', kind: 'wrong',
            answer: '옳지 않은 것은 ⑦과 ⑧이다.\n⑦ 매출총이익률 분석과 기간귀속 테스트는 당기 거래에 관한 절차이므로 기초 재고자산의 증거가 되지 않는다.\n⑧ 조회는 기말 잔액에 대해서만 할 수 있다.\n⑥과 ⑨는 적절하다. 실사 수량을 기초수량으로 조정했다면 기초 재고의 평가까지 확인한 것이고, 부도 채권은 전기 감사인이 책임질 사항이다.',
            expected_verdicts: [v('sub3.c1', 'contradicted', '함정 ⑦·⑧만 고르고 ⑥·⑨가 적절하다고 명시했다.'), v('sub3.c2', 'contradicted', '수량 조정으로 평가까지 확인했다고 명시했다.'),
                v('sub3.c3', 'contradicted', '부도 채권은 전기 감사인이 책임질 사항이라며 ⑨가 적절하다고 명시했다.')],
            expected_points: 0, reason: '함정만 고르고 옳지 않은 항목을 적절하다고 쓴 대표 오답이다.' },
        { id: 'r04-sub4-partial', set_id: SET, subquestion_id: 'sub4', kind: 'partial',
            answer: '옳지 않은 것은 ⑩, ⑫이다.\n⑩ 전임감사인이 한정의견을 표명했으므로 당기에도 감사의견을 한정해야 한다.\n⑫ 기타사항문단에는 전임감사인이 표명한 의견의 유형(한정의견)과 그 사유도 기재해야 한다.',
            expected_verdicts: [v('sub4.c1', 'contradicted', '옳은 ⑩을 옳지 않다고 골랐다.'), v('sub4.c2', 'met', '전임감사인 의견의 유형과 사유를 기재해야 한다고 적었다.')],
            expected_points: 1, reason: '함정 ⑩ 선택으로 식별 점수만 잃고 ⑫의 이유는 유지되는지 확인하는 부분정답이다.' },
        { id: 'r04-sub4-wrong', set_id: SET, subquestion_id: 'sub4', kind: 'wrong',
            answer: '옳지 않은 것은 ⑪이다.\n⑪ 외부감사법에 따른 감사는 비교재무제표 방식이므로 20X0년 재무제표에 대해서도 감사의견을 표명해야 한다.\n⑩과 ⑫는 적절하다. 전임감사인 의견의 유형과 사유는 전임감사인의 감사보고서에 있으므로 기재하지 않아도 된다.',
            expected_verdicts: [v('sub4.c1', 'contradicted', '함정 ⑪만 고르고 ⑫가 적절하다고 명시했다.'), v('sub4.c2', 'contradicted', '의견의 유형과 사유를 기재하지 않아도 된다고 명시했다.')],
            expected_points: 0, reason: '함정만 고르고 옳지 않은 항목을 적절하다고 쓴 대표 오답이다.' },
    ],
    supplementary_cases: [
        { id: 'r04-supp-boundaries', purpose: '물음 1은 보완절차만, 물음 3·4는 이유만 쓴 답이 항목별 1점을 받는지, 물음 2는 자료별로 나누어 한 자료에만 붙인 주장과 KGA 315의 범주명(정확성, 평가 및 배분)을 인정하는지 확인한다.',
            answers: {
                sub1: '③, ⑤가 옳지 않다.\n③ 당기에 수행한 감사절차에서 기초잔액에 관한 증거를 찾거나 기초잔액에 대한 별도 절차를 수행했어야 한다.\n⑤ 장기대여금의 회수가능성 문제를 20X1년 위험평가에 반영했어야 한다.',
                sub2: '(가) 매출채권: 실재성, 권리, 정확성·평가 및 배분\n(나) 매입채무: 완전성, 의무',
                sub3: '⑥, ⑨가 옳지 않다.\n⑥ 실사 수량을 기초수량으로 조정한 결과는 수량에 관한 증거일 뿐 평가에 관한 증거가 아니기 때문이다.\n⑨ 기초잔액에 포함된 이 왜곡표시는 20X1년 재무제표에 중요한 영향을 미칠 수 있기 때문이다.',
                sub4: '⑫가 옳지 않다. 전임감사인이 감사한 전기재무제표에 대해서는 기타사항문단에 전임감사인이 표명한 의견의 유형과 그 의견이 변형된 사유를 기재하도록 되어 있기 때문이다.' },
            expected: {
                sub1: { expected_points: 3, expected_verdicts: [v('sub1.c1', 'met', '③·⑤만 정확히 골랐다.'), v('sub1.c2', 'met', '당기 절차 증거 평가·별도 절차 수행을 적었다.'), v('sub1.c3', 'met', '장기대여금 문제를 위험평가에 반영하는 절차를 적었다.')] },
                sub2: { expected_points: 4, expected_verdicts: [v('sub2.c1', 'met', '실재성을 (가)에 붙여 나열했다.'), v('sub2.c2', 'met', '권리·의무로 나누어 썼다.'), v('sub2.c3', 'met', '완전성을 (나)에 붙여 나열했다.'), v('sub2.c4', 'met', '정확성·평가 및 배분 명칭을 썼다.')] },
                sub3: { expected_points: 3, expected_verdicts: [v('sub3.c1', 'met', '⑥·⑨만 정확히 골랐다.'), v('sub3.c2', 'met', '수량 조정은 평가 증거가 아니라는 이유를 적었다.'), v('sub3.c3', 'met', '당기재무제표에 중요한 영향을 미칠 수 있다는 이유를 적었다.')] },
                sub4: { expected_points: 2, expected_verdicts: [v('sub4.c1', 'met', '⑫만 골랐다.'), v('sub4.c2', 'met', '의견의 유형과 변형 사유를 기재해야 한다는 이유를 적었다.')] } } },
    ],
});
console.log('design/lineage/qa written', reviewedContentHash(draft));
