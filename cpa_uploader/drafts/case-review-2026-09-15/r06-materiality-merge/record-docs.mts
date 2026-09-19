// r06 설계 장부·계보·대표 답안 기록(한 번만 실행; 기존 파일이 있으면 쓰지 않는다).
//   npx tsx cpa_uploader/drafts/case-review-2026-09-15/r06-materiality-merge/record-docs.mts
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewedContentHash } from '../../../questionReviewIdentity.ts';
import { computeSubquestionMaxPoints } from '../../../../lib/questionV3.ts';
import type { QuestionSetV3 } from '../../../../lib/questionV3.ts';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r06-materiality-merge';
const BANK = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const EXAM = 'cpa_uploader/data/회계감사_통합학습자료/04_기출문제/기출문제_연도별_해설_A.md';
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (name: string, value: unknown) => fs.writeFileSync(`${D}/${name}`, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const [set] = read(`${D}/sets.json`) as QuestionSetV3[];
const bank = read(BANK) as QuestionSetV3[];
const originals = ['draft-04-320-freq01', 'pilot-04-007', 'case-04-materiality-reset-20260914'].map((id) => bank.find((s) => s.id === id)!);
const points = (s: QuestionSetV3) => s.subquestions.reduce((n, q) => n + computeSubquestionMaxPoints(q), 0);
const target = reviewedContentHash(set);

write('design.json', {
    version: 1,
    set_id: set.id,
    route: '사례형 병합 재구성(검토 스킬) + 새 사실관계·발문 제작(제작 스킬)',
    format: '두 물음 모두 옳고 그름을 구분하는 선택형이다(번호를 붙인 절차·판단 중 옳지 않은 것을 모두 찾아 번호와 이유 또는 보완절차를 간략히 쓴다). 사용자가 형식을 따로 지정하지 않아 학습 단위 계약의 기본 형식을 적용했다.',
    user_requests: [
        '5번(draft-04-320-freq01)·25번(pilot-04-007)·45번(case-04-materiality-reset-20260914)을 합쳐서 중요성에 관한 종합문제를 만들고 스포일러 요소를 없앤다(2026-09-17).',
        '공통 기준(2026-09-15): 암시 제거, 옳고 그름을 구분하는 형식, 이유나 보완절차는 간략히, 연도는 20X1·20X2(대상 연도 2027년), 운영 반영은 지정 검토를 모아 한 번에 한다.',
    ],
    items: [
        { no: '①', fact_id: 'fact3', verdict: '옳음(함정)', kind: '판단', basis: 'KGA 320 문단 A6: 법인세비용차감전계속영업이익의 예외적인 증감이 있는 상황에서는 과거 실적에 기초하여 정상적 수준으로 조정한 수치를 사용하는 것이 보다 적합하다고 결론 내릴 수 있다. 손상차손은 과거에 없었고 다시 발생할 사정도 없는 일회성 손실이다. 다온회사는 훨씬 작은 회사여서 인수로 인한 조정 필요성은 논점이 되지 않는다.', origin: 'draft-04-320-freq01/q1(정상화 이익 벤치마크)' },
        { no: '②', fact_id: 'fact3', verdict: '옳지 않음', kind: '판단', basis: 'KGA 320 문단 10·A11: 특정 공시에 대하여 전체 중요성보다 작은 왜곡표시가 이용자의 경제적 의사결정에 영향을 줄 것이라고 합리적으로 예상되면 그 공시에 적용할 중요성 수준도 결정한다. 주주들이 인수 대가와 다온회사 실적을 투자 판단의 핵심으로 보고 질문이 인수 관련 주석에 집중되었다(A11: 별도로 공시되는 사업의 특정측면, 유의적인 사업결합 공시에 주의 집중). 공시 금액이 전체 중요성보다 작다거나 이사회 승인을 거쳤다는 사실은 이 판단과 관계없다.', origin: 'draft-04-320-freq01/exp1(팀원의 제안)' },
        { no: '③', fact_id: 'fact3', verdict: '옳지 않음', kind: '판단', basis: 'KGA 320 문단 11·A13: 수행중요성의 결정은 단순한 기계적 계산이 아니라 전문가적 판단이 수반되며, 위험평가 중 갱신된 기업 이해(새 회계시스템 전환, 두 지점의 수작업 연결), 과거 감사에서 식별된 왜곡표시의 성격과 범위(여러 지점의 반품 반영 지연, 일부 미수정)와 이에 따른 당기 왜곡표시의 예상에 영향을 받는다. 일관성을 이유로 전기 비율을 그대로 적용한 것은 이를 고려하지 않은 결정이다.', origin: 'pilot-04-007/sub2·exp1(을의 제안과 세 고려사항)' },
        { no: '④', fact_id: 'fact4', verdict: '옳음(함정)', kind: '판단', basis: 'KGA 320 문단 12·A14: 최초에 설정한 중요성을 다르게 결정했을 정보(주요사업의 처분결정, 실제 재무결과가 최초 예측과 상당히 다를 것)를 감사 중 알게 되면 중요성을 수정한다. 새 예측에서도 일회성 손상차손의 영향은 제외해 ①과 같은 정상화 원칙을 유지했다. 중간감사를 마친 뒤라는 점은 수정 의무에 영향이 없다.', origin: 'case-04-materiality-reset-20260914/sub1(갑의 유지 제안을 옳은 수정 판단으로 전환)' },
        { no: '⑤', fact_id: 'fact4', verdict: '옳지 않음', kind: '판단', basis: 'KGA 320 문단 13: 전체 중요성을 최초보다 낮추는 것이 적합하다고 결정한 경우 수행중요성을 수정하는 것이 필요한지 결정한다. 수행중요성을 감사가 끝날 때까지 고정하는 금액으로 본 판단은 이에 어긋난다.', origin: 'case-04-materiality-reset-20260914/sub2 c1(조건부 후속안의 수행중요성)' },
        { no: '⑥', fact_id: 'fact4', verdict: '옳지 않음', kind: '절차', basis: 'KGA 320 문단 13: 전체 중요성을 낮춘 경우 추가감사절차의 성격, 시기 및 범위가 여전히 적합한지 결정한다. 인력 배정을 이유로 계획 단계의 표본 규모와 일정대로 기말 조회·기간귀속 테스트를 수행하기로 한 것은 이 결정을 거치지 않은 것이다.', origin: 'case-04-materiality-reset-20260914/sub2 c2~c4(분석 방법·일정·표본범위)' },
        { no: '⑦', fact_id: 'fact4', verdict: '옳지 않음', kind: '절차', basis: 'KGA 320 문단 14(a)·(d): 재무제표 전체에 대한 중요성과 그 금액을 결정할 때 고려한 요소, 감사의 진행에 따른 수정내용을 감사문서에 포함한다. 최초 금액을 덮어쓰고 수정 이유를 구두로만 보고하면 수정내용과 고려한 요소가 남지 않는다.', origin: 'case-04-materiality-reset-20260914/sub3(문서화 담당자의 계획)' },
        { no: '⑧', fact_id: 'fact5', verdict: '옳음(함정)', kind: '판단', basis: 'KGA 320 문단 6: 감사인은 왜곡표시와 관련된 상황에 따라 그 금액이 중요성에 미달되더라도 중요하다고 평가할 수 있으며, 미수정왜곡표시가 재무제표에 미치는 영향을 평가할 때 크기뿐 아니라 그 성격과 발생한 특수한 상황도 고려한다.', origin: 'new_element' },
    ],
    questions: [
        { subquestion_id: 'sub1', question_style: 'case', type: 'judgment', topic_ids: ['04'], case_fact_ids: ['fact1', 'fact2', 'fact3'],
            topic_reason: '04: 감사계획 단계의 재무제표 전체 중요성 벤치마크(KGA 320 A6), 특정 공시의 중요성 수준(문단 10·A11), 수행중요성의 결정(문단 11·A13)을 사례 사실에 적용한다.',
            criteria: [
                { id: 'sub1.c1', points: 1, meaning: '식별: ②·③을 고르고 ①은 고르지 않음' },
                { id: 'sub1.c2', points: 1, meaning: '②: 이용자의 관심이 집중된 인수 관련 공시에는 더 낮은 중요성 수준을 결정(이유 또는 절차)' },
                { id: 'sub1.c3', points: 1, meaning: '③: 수행중요성은 기계적 계산이 아닌 전문가적 판단이며 기업 이해·전기 왜곡표시·당기 예상을 고려(이유 또는 절차)' },
            ],
            minimum_sufficient_answer: '②·③을 고르고 각각 한 문장씩 이유나 보완절차를 쓴다.',
            point_decision: '3점. 식별 1점 + 옳지 않은 항목 두 개에 각 1점. 원 draft-04-320-freq01 q1(정상화 이익과 근거 2점)은 함정 ①로 바꾸어 별도 점수를 두지 않고, exp1(판단 1 + 설명 1)은 ②의 식별과 이유로 옮겼다. 원 pilot-04-007의 판단(1)·전문가적 판단(1)·세 고려사항(3)은 ③의 이유 1점으로 통합했다. 세 고려사항을 발문에 나열하던 구성을 없앴으므로 완전한 나열을 요구하지 않는다.' },
        { subquestion_id: 'sub2', question_style: 'case', type: 'judgment', topic_ids: ['04', '12'], case_fact_ids: ['fact1', 'fact4', 'fact5'],
            topic_reason: '04: 감사 진행에 따른 중요성 수정과 그 뒤의 수행중요성·추가감사절차 재검토, 중요성의 문서화(KGA 320 문단 12·13·14, A14). 12: ⑧에서 미수정왜곡표시가 중요한지 평가할 때 크기뿐 아니라 성격을 고려하는지(KGA 320 문단 6)를 판단해야 한다.',
            criteria: [
                { id: 'sub2.c1', points: 1, meaning: '식별: ⑤·⑥·⑦을 고르고 ④·⑧은 고르지 않음' },
                { id: 'sub2.c2', points: 1, meaning: '⑤: 전체 중요성을 낮춘 경우 수행중요성의 수정 필요성 결정(이유 또는 절차)' },
                { id: 'sub2.c3', points: 1, meaning: '⑥: 추가감사절차의 성격·시기·범위가 여전히 적합한지 결정(이유 또는 절차, 일부 측면도 인정)' },
                { id: 'sub2.c4', points: 1, meaning: '⑦: 중요성의 수정내용과 결정 시 고려한 요소의 문서화(이유 또는 절차, 한 측면도 인정)' },
            ],
            minimum_sufficient_answer: '⑤·⑥·⑦을 고르고 각각 한 문장씩 이유나 보완절차를 쓴다.',
            point_decision: '4점. 식별 1점 + 옳지 않은 항목 세 개에 각 1점. 원 case-04-materiality-reset의 sub1(판단 1 + 이유 1)은 옳은 항목 ④로 바꾸어 식별 기준으로만 평가하고, sub2의 수행중요성(1)은 ⑤, 성격·시기·범위(3)는 ⑥의 1점, sub3의 세 문서화 요소(3)는 ⑦의 1점으로 통합했다. 원 발문이 요구한 “분석 방법·일정·표본범위에 각각 연결”과 문서화 요소의 구별 서술은 답안 구성을 알려 주는 암시이므로 없애고, 수험생이 이유나 보완절차를 간략히 쓰게 했다. ⑧은 새 함정이다.' },
    ],
    spoiler_review: [
        'draft-04-320-freq01: 감사팀이 “손실의 일시성과 과거 실적의 비교가능성을 확인했고 수익구조 변화에 따른 것은 아니라고 판단”했다는 결론 문장, 발문의 “감소한 이익을 그대로 사용하는 대신 선택할 수 있는 보다 적합한 이익 수치”, “전체 중요성보다 작은 금액인 인수 관련 공시 항목에도 투자 판단을 바꿀 수 있는 정보가 포함되어 있다”는 결론 문장과 팀원의 틀린 제안, 발문의 “주주들의 정보수요와 공시의 성격을 고려하여”를 없앴다. 손실이 과거에 없었고 다시 발생할 사정이 없다는 사실과 주주들의 관심 집중이라는 사실만 남겼다.',
        'pilot-04-007: 을의 제안에 붙은 “업무 시간을 줄이기 위해 기업의 사정과 무관하게 모든 기업에 동일한 고정 비율을 곱하는 기계적 계산만으로”, “감사팀은 … 당기에도 여러 건의 오류가 발생할 수 있다고 예상한다”, 발문의 ①·②·③ 고려사항 나열을 없앴다. 전기 왜곡표시와 시스템 전환 사실만 남기고 수행중요성 결정은 감사팀의 일관성 논리로 바꾸었다.',
        'case-04-materiality-reset-20260914: “일회성 평가손실 때문이 아니라 수익구조가 축소된 결과이며, 계획 당시에는 알지 못한 정보다”, 갑의 유지 제안과 “조건부 후속안”, 문서화 담당자의 “덮어쓰면 충분하다”는 주장, 발문의 “수행중요성과 추가감사절차로 구별 … 분석 방법·수행 일정·표본범위에 각각 연결”, “계획을 보완하시오 … 구별하여”를 없앴다. 조건부 후속안 대신 감사팀이 중요성을 낮춘 뒤의 실제 절차로 바꾸었다.',
        '원 세 문제의 상반된 전제(일회성 손실로 정상화 vs 구조적 감소로 수정)를 한 회사의 시간 순서로 정리했다. 계획 단계의 일회성 손상차손(①, 옳음)과 10월의 사업부문 처분결정(④, 옳음)은 같은 A6·A14 기준에서 다른 사실을 가르는 쌍이지만 따로 묻지 않고 두 물음의 목록에 나누어 두었다. ④의 새 예측에서도 손상차손의 영향을 제외하여 두 판단이 서로 모순되지 않게 했다.',
        '근거 문구가 정답 표지가 되지 않도록 옳은 항목(① “과거 3년 평균의 절반 수준이 되므로”, ④ “실제 실적 추세와 맞았으므로”)과 옳지 않은 항목(② “승인을 거쳤으므로”, ③ “일관성이 유지된다는 이유로”, ⑤ “금액이라고 판단하여”, ⑥ “배정이 이미 끝나 있어”)에 서로 다른 형태로 두고, 근거가 없는 항목도 옳은 항목(⑧)과 옳지 않은 항목(⑦)에 함께 두었다. “그러나”, “다만” 같은 연결어는 쓰지 않았다.',
        '①의 벤치마크 조정에서 같은 해의 인수가 조정 대상인지 다툼이 생기지 않도록 다온회사가 훨씬 작은 회사라는 사실을 두었다. 금액(원 사례의 5억원·3억원)은 계산을 요구하지 않으므로 뺐다. 연도는 20X1·20X2로 썼다. 옳지 않은 항목 수(물음별 2·3개)는 발문에 밝히지 않는다.',
    ],
    nonduplication: [
        '기준서형 pilot-04-001 sub2(중요성을 낮춘 뒤의 후속 조치 서술), pilot-04-005-standards-20260913(중요성 문서화 사항 열거), draft-04-320-freq01-standards-20260913(이용자의 공통 정보수요), pilot-04-007-standards-20260913(수행중요성 정의), draft-standard-gap-20260913-g08(벤치마크 선정 요인 열거), std-points-20260914-461c50004844(수행중요성 결정 고려사항 서술)는 기준서 내용을 재현하는 물음이다. 이 사례는 같은 문단을 사례 절차의 옳고 그름 판단에 적용하며 목록의 완전한 나열을 요구하지 않는다.',
        '원 세 세트(draft-04-320-freq01, pilot-04-007, case-04-materiality-reset-20260914)는 병합 후 퇴역 대상이다. 운영 반영과 퇴역은 지정 검토를 모아 한 번에 한다.',
        '2024 제59회 2차 문제 6 물음 3(투자자산손상차손으로 일시 감소한 세전이익 대신 정상화한 세전이익·매출액을 벤치마크로 선택)은 ①의 함정과 같은 쟁점이다. 2021 제56회 2차 문제 2 물음 6(중요성 설명의 적절 여부), 2023 제58회 2차 문제 2 해설(감사 중 중요성 수정 후 수행중요성과 추가감사절차 재고려)의 쟁점과 형식을 참고했다.',
    ],
    references_consulted: [
        { file: EXAM, lines: 'L3800-L3905 (2024 제59회 문제 6 물음 3과 답안·해설), L6590-L6613 (2023 제58회 문제 2 해설의 중요성 수정), L8942-L8960 (2021 제56회 문제 2 물음 6)', sha256: sha(EXAM) },
    ],
    edition: '2025 개정 전문(KGA 320 문단 7: 2026-01-01 이후 개시 보고기간 시행)을 대상 연도 2027년 기준으로 적용했다. 2026 전문과 대조한 결과 KGA 320 문단 1~14·A1~A14는 각주의 KGA 315 제목 외에 같다(출처 계보: cpa_uploader/raw/originals/case-review-2026-09-15/kga320-2025-excerpts.provenance.json).',
    target_reviewed_content_sha256: target,
});

write('lineage.json', {
    version: 1,
    artifact_type: 'case_merge_lineage',
    created_at: '2026-09-17',
    user_instruction: 'docs/case-question-edit-notes-2026-09-14.md 항목 5·25·45(2026-09-17 대화: 세 문제를 합쳐 중요성에 관한 종합문제를 만들고 스포일러 요소를 없앤다)',
    source_bank: { file: BANK, sha256: sha(BANK) },
    sources: originals.map((s) => ({ set_id: s.id, title: s.title, status: s.status, reviewed_content_sha256: reviewedContentHash(s), points: points(s) })),
    target: { set_id: set.id, reviewed_content_sha256: target, points: points(set) },
    mapping: [
        { from: 'draft-04-320-freq01 f0(한빛회사, 안정적 계속영업이익, 이용자는 법인세비용차감전계속영업이익에 중점)', disposition: 'rewritten', to: 'fact1', reason: '회사명을 새봄회사로 통일하고 이용자의 중점 항목을 배경 사실로 유지했다. 전기 중요성 자료 검토 문장은 판단에 쓰이지 않아 뺐다.' },
        { from: 'draft-04-320-freq01 f1(일회성 손상차손, 감사팀의 일시성·비교가능성 확인 결론)', disposition: 'rewritten', to: 'fact2, fact3 ①', reason: '감사팀의 결론 문장을 없애고 손실이 과거에 없었고 다시 발생할 사정이 없다는 사실만 남겼다.' },
        { from: 'draft-04-320-freq01 q1 c1·c2(정상적 수준으로 조정한 이익과 그 근거)', disposition: 'converted_to_trap', to: 'fact3 ①(옳음), sub1.c1', reason: '정상화 이익 벤치마크를 옳은 항목으로 두어 식별 기준으로만 평가한다(함정에는 별도 득점 기준을 두지 않는 계약).' },
        { from: 'draft-04-320-freq01 f2·f3(중소기업 인수, 주주 관심, 인수 공시에 전체 중요성만 적용하자는 팀원 제안)', disposition: 'converted_to_incorrect_item', to: 'fact2, fact3 ②, sub1.c2', reason: '“투자 판단을 바꿀 수 있는 정보가 포함되어 있다”는 결론 문장과 팀원의 주장을 없애고 감사팀의 결정으로 바꾸었다.' },
        { from: 'draft-04-320-freq01 exp1 c1(제안이 부적절하다는 판단)', disposition: 'merged_into_identification', to: 'sub1.c1', reason: '식별 1점으로 채점한다.' },
        { from: 'draft-04-320-freq01 exp1 c2(주주 관심과 작은 왜곡표시의 영향을 연결해 별도 중요성 결정)', disposition: 'retained_as_reason', to: 'sub1.c2', reason: '②의 이유 또는 보완절차로 승계했다.' },
        { from: 'pilot-04-007 f1·f3·f4(새봄회사 지점 매출·반품, 전기 반품 지연 왜곡표시, 시스템 전환 후 수작업 연결·담당자 교체)', disposition: 'rewritten', to: 'fact1, fact2', reason: '전기 왜곡표시와 시스템 전환·수작업 연결 사실만 남기고, 담당자 교체와 “당기에도 여러 건의 오류가 발생할 수 있다고 예상한다”는 결론 문장은 뺐다.' },
        { from: 'pilot-04-007 f2(을의 고정 비율 기계적 계산 제안)', disposition: 'converted_to_incorrect_item', to: 'fact3 ③, sub1.c3', reason: '“업무 시간을 줄이기 위해 기업의 사정과 무관하게” 같은 암시를 없애고 감사팀이 일관성을 이유로 전기 비율을 적용한 결정으로 바꾸었다.' },
        { from: 'pilot-04-007 sub2 crit4(제안이 부적절)', disposition: 'merged_into_identification', to: 'sub1.c1', reason: '식별 1점으로 채점한다.' },
        { from: 'pilot-04-007 sub2 crit10(수행중요성 결정에는 전문가적 판단이 필요)', disposition: 'retained_as_reason', to: 'sub1.c3', reason: '③의 이유로 인정한다.' },
        { from: 'pilot-04-007 exp1 c1~c3(갱신된 기업 이해, 전기 왜곡표시의 성격·범위, 당기 왜곡표시 예상)', disposition: 'merged_into_reason', to: 'sub1.c3', reason: '발문의 세 고려사항 나열을 없애고 그중 하나 이상을 반영해야 한다는 보완절차도 ③의 1점으로 인정한다.' },
        { from: 'case-04-materiality-reset-20260914 fact1(도현회사, 전체 중요성 5억원·수행중요성 3억원, 월별 매출 분석·중간감사 일정·표본범위)', disposition: 'rewritten', to: 'fact1, fact4', reason: '금액을 빼고 계획 단계 수행중요성에 따른 중간감사 표본과 기말 조회·기간귀속 테스트로 바꾸었다.' },
        { from: 'case-04-materiality-reset-20260914 fact2(주요사업 처분결정·계약종료, “일회성 평가손실이 아니라 수익구조 축소”, 계획 당시 몰랐던 정보)', disposition: 'rewritten', to: 'fact4', reason: '결론을 요약하던 문장을 없애고, 새 예측이 손상차손을 제외하더라도 최초 금액에 크게 미달한다는 사실로 바꾸었다.' },
        { from: 'case-04-materiality-reset-20260914 sub1 c1·c2(갑의 최초 중요성 유지 제안이 부적절, 새 정보의 의미)', disposition: 'converted_to_trap', to: 'fact4 ④(옳음), sub2.c1', reason: '갑의 틀린 제안을 없애고 감사팀이 중요성을 낮춘 옳은 항목으로 바꾸어 식별 기준으로 평가한다.' },
        { from: 'case-04-materiality-reset-20260914 fact3 조건부 후속안과 sub2 c1(수행중요성 수정 필요성)', disposition: 'converted_to_incorrect_item', to: 'fact4 ⑤, sub2.c2', reason: '조건부 계획을 중요성을 낮춘 뒤의 실제 결정으로 바꾸었다.' },
        { from: 'case-04-materiality-reset-20260914 sub2 c2~c4(분석 방법·일정·표본범위와 추가감사절차의 성격·시기·범위)', disposition: 'merged_into_reason', to: 'fact4 ⑥, sub2.c3', reason: '세 측면을 각각 연결하게 하던 발문을 없애고, 추가감사절차가 여전히 적합한지 결정해야 한다는 이유나 일부 측면의 보완절차를 1점으로 인정한다.' },
        { from: 'case-04-materiality-reset-20260914 fact4·sub3 c1~c3(최종액 덮어쓰기, 구두 인계, 전체·수행중요성의 수정내용과 고려 요소 문서화)', disposition: 'merged_into_reason', to: 'fact4 ⑦, sub2.c4', reason: '문서화 담당자의 주장을 감사팀의 행위로 바꾸고, 수정내용 또는 고려한 요소의 문서화를 ⑦의 1점으로 인정한다. 특정 공시 중요성을 범위에서 뺀다는 안내는 ②가 그 요소를 다루므로 없앴다.' },
        { from: 'new_element', disposition: 'added', to: 'fact5 ⑧, sub2.c1', reason: '중요성 종합 문제로서 미수정왜곡표시를 평가할 때 크기뿐 아니라 성격을 고려한다는 KGA 320 문단 6을 옳은 항목(함정)으로 더했다.' },
    ],
    points_change: { from: originals.reduce((n, s) => n + points(s), 0), to: points(set), reason: '원 세 세트는 판단·근거·요소를 각각 채점해 4점·5점·9점이었다. 선택형으로 바꾸면서 옳은 항목(원 q1, sub1)의 점수를 식별 기준으로 옮기고, 여러 요소의 서술을 옳지 않은 항목별 이유나 보완절차 1점으로 통합해 7점이 되었다.' },
});

const verdicts = (sub: string, rows: [string, string][]) => rows.map(([verdict, reason], i) => ({ criterion_id: `${sub}.c${i + 1}`, verdict, reason }));
const total = (rows: { verdict: string }[]) => rows.reduce((n, v) => n + (v.verdict === 'met' ? 1 : 0), 0);
const cases = [
    { id: 'r06-sub1-partial', subquestion_id: 'sub1', kind: 'partial',
        answer: '옳지 않은 것은 ①, ②, ③이다.\n① 20X1년에 실제로 발생한 손상차손을 제외하면 이익을 부풀리는 것이므로 손상차손을 반영한 예측 이익을 그대로 벤치마크로 써야 한다.\n② 주주들의 관심이 인수 관련 공시에 집중되어 있어 전체 중요성보다 작은 왜곡표시도 투자 판단에 영향을 줄 수 있으므로, 인수 관련 공시에 적용할 더 낮은 중요성 수준을 정해야 한다.\n③ 수행중요성은 기계적 계산이 아니라 전문가적 판단으로 정해야 하므로 전기 반품 지연 왜곡표시와 새 회계시스템 전환을 고려해야 한다.',
        expected_verdicts: verdicts('sub1', [['contradicted', '옳은 ①을 옳지 않다고 골랐다.'], ['met', '주주의 관심 집중과 작은 왜곡표시의 영향을 들어 더 낮은 중요성 수준을 정해야 한다고 적었다.'], ['met', '전문가적 판단과 전기 왜곡표시·시스템 전환 고려를 적었다.']]),
        reason: '함정 ①을 고른 답에서 식별 점수만 잃고 ②·③의 이유는 유지되는지 확인하는 부분정답이다.' },
    { id: 'r06-sub1-wrong', subquestion_id: 'sub1', kind: 'wrong',
        answer: '옳지 않은 것은 ①이다. 손상차손을 반영한 20X1년 예측 이익을 그대로 벤치마크로 써야 한다.\n②는 인수 관련 공시 금액이 모두 전체 중요성보다 작으므로 전체 중요성만 적용하면 되어 옳다.\n③은 매년 같은 비율로 수행중요성을 정해야 감사의 일관성이 유지되므로 옳다.',
        expected_verdicts: verdicts('sub1', [['contradicted', '옳은 ①만 고르고 ②·③이 옳다고 명시했다.'], ['contradicted', '금액이 작으면 전체 중요성만 적용하면 된다고 명시했다.'], ['contradicted', '매년 같은 비율을 적용해야 한다고 명시했다.']]),
        reason: '함정만 고르고 옳지 않은 항목을 옳다고 쓴 대표 오답이다.' },
    { id: 'r06-sub2-partial', subquestion_id: 'sub2', kind: 'partial',
        answer: '옳지 않은 것은 ⑤, ⑦, ⑧이다.\n⑤ 전체 중요성을 낮추었으므로 수행중요성을 수정할 필요가 있는지 결정해야 한다.\n⑦ 중요성의 최초 금액과 수정내용, 수정할 때 고려한 사업부문 처분결정과 새 연간 예측을 조서에 기록해야 한다.\n⑧ 금액이 중요성보다 작은 왜곡표시는 중요하지 않은 것으로 보아야 한다.',
        expected_verdicts: verdicts('sub2', [['contradicted', '옳지 않은 ⑥을 빠뜨리고 옳은 ⑧을 옳지 않다고 골랐다.'], ['met', '수행중요성의 수정 필요성을 결정해야 한다고 적었다.'], ['not_met', '⑥(추가감사절차의 적합성 재검토)을 다루지 않았다.'], ['met', '수정내용과 고려한 요소를 조서에 기록해야 한다고 적었다.']]),
        reason: '옳지 않은 ⑥을 빠뜨리고 함정 ⑧을 고른 답에서 ⑤·⑦의 이유는 유지되는지 확인하는 부분정답이다.' },
    { id: 'r06-sub2-wrong', subquestion_id: 'sub2', kind: 'wrong',
        answer: '옳지 않은 것은 ④, ⑧이다.\n④ 중간감사를 이미 마쳤으므로 중요성을 바꾸면 감사의 일관성이 훼손된다.\n⑧ 금액이 중요성보다 작은 왜곡표시는 중요하지 않다.\n⑤, ⑥, ⑦은 옳다. 수행중요성은 한 번 정하면 감사가 끝날 때까지 유지하고, 인력과 일정 배정이 끝났으면 기말 절차를 계획대로 수행해도 되며, 최종 금액만 남기고 수정 이유는 구두로 보고하면 충분하다.',
        expected_verdicts: verdicts('sub2', [['contradicted', '옳은 ④·⑧만 고르고 ⑤·⑥·⑦이 옳다고 명시했다.'], ['contradicted', '수행중요성은 끝까지 유지한다고 명시했다.'], ['contradicted', '인력과 일정 배정이 끝났으면 계획대로 수행해도 된다고 명시했다.'], ['contradicted', '최종 금액과 구두 보고로 충분하다고 명시했다.']]),
        reason: '함정만 고르고 옳지 않은 항목을 옳다고 쓴 대표 오답이다.' },
].map((row) => ({ ...row, set_id: set.id, expected_points: total(row.expected_verdicts) }));
for (const row of cases) {
    const sub = set.subquestions.find((q) => q.id === row.subquestion_id)!;
    if (row.expected_verdicts.length !== sub.criteria.length) throw new Error(`criterion coverage: ${row.id}`);
}
const supp = (sub: string, rows: [string, string][]) => ({ expected_points: total(rows.map(([verdict]) => ({ verdict }))), expected_verdicts: verdicts(sub, rows) });
write('qa.json', {
    version: 1, set_id: set.id, method: 'author_expected_verdicts_before_model_grading', human_review_performed: false,
    note: '모범답안은 저장 model_answer를 그대로 쓴다. 부분정답·오답과 기대 판정은 실제 채점 전에 원문·criterion에서 정했다. contradicted와 not_met은 모두 0점이다.',
    cases,
    supplementary_cases: [
        { id: 'r06-supp-brief', purpose: '옳지 않은 항목에 이유만(③ 전문가적 판단) 또는 보완절차만(②·⑤·⑥·⑦) 짧게 쓰고, ⑥은 표본 규모 한 측면만, ⑦은 수정 이유(고려한 요소)의 기록만 든 답이 항목별 1점을 받는지 확인한다.',
            answers: {
                sub1: '②, ③\n② 이용자의 관심이 집중된 인수 관련 공시에는 전체 중요성보다 낮은 별도의 중요성 수준을 정했어야 한다.\n③ 수행중요성은 기계적 계산이 아니라 전문가적 판단 사항이다.',
                sub2: '⑤, ⑥, ⑦\n⑤ 수행중요성을 수정할 필요가 있는지 결정했어야 한다.\n⑥ 기말 매출채권 조회의 표본 규모가 낮아진 중요성에서도 충분한지 다시 검토했어야 한다.\n⑦ 중요성을 수정한 이유를 조서에 기록했어야 한다.',
            },
            expected: {
                sub1: supp('sub1', [['met', '②·③만 골랐다.'], ['met', '인수 관련 공시에 별도의 낮은 중요성 수준을 정하는 절차를 적었다.'], ['met', '수행중요성은 전문가적 판단이라는 이유를 적었다.']]),
                sub2: supp('sub2', [['met', '⑤·⑥·⑦만 골랐다.'], ['met', '수행중요성의 수정 필요성 결정을 적었다.'], ['met', '표본 규모(범위)가 여전히 충분한지 재검토하는 절차를 적었다.'], ['met', '수정 이유(고려한 요소)의 문서화를 적었다.']]),
            } },
        { id: 'r06-supp-content-identification', purpose: '번호 없이 내용으로 옳지 않은 항목을 특정하고, ⑤와 ⑥의 보완절차를 한 문장에 함께 쓴 답이 식별 점수와 각 항목 점수를 받는지 확인한다.',
            answers: {
                sub1: '인수 관련 주석 공시에 다른 항목과 같은 전체 중요성을 적용한 결정은 옳지 않다. 주주들의 관심이 집중된 공시여서 더 작은 왜곡표시도 이용자의 의사결정에 영향을 줄 수 있기 때문이다. 전기와 같이 전체 중요성의 75%로 수행중요성을 정한 결정도 옳지 않다. 전기 반품 반영 지연 왜곡표시와 두 지점의 수작업 연결을 고려하여 수행중요성을 정해야 한다.',
                sub2: '수행중요성을 그대로 사용한 것, 기말 조회와 기간귀속 테스트를 당초 표본 규모와 일정대로 수행하기로 한 것, 중요성표의 최초 금액을 덮어쓰고 수정 이유를 구두로만 보고한 것이 옳지 않다. 전체 중요성을 낮추었으면 수행중요성을 수정할 필요가 있는지와 추가감사절차의 성격·시기·범위가 여전히 적합한지를 결정해야 하고, 중요성의 수정내용과 고려한 요소는 조서에 남겨야 한다.',
            },
            expected: {
                sub1: supp('sub1', [['met', '내용으로 ②·③만 특정했다.'], ['met', '주주의 관심 집중으로 작은 왜곡표시도 의사결정에 영향을 줄 수 있다는 이유를 적었다.'], ['met', '전기 왜곡표시와 수작업 연결을 고려해 수행중요성을 정하는 절차를 적었다.']]),
                sub2: supp('sub2', [['met', '내용으로 ⑤·⑥·⑦만 특정했다.'], ['met', '수행중요성의 수정 필요성 결정을 적었다.'], ['met', '추가감사절차의 성격·시기·범위가 여전히 적합한지 결정을 적었다.'], ['met', '수정내용과 고려한 요소의 문서화를 적었다.']]),
            } },
    ],
});
console.log({ target, originals: originals.map((s) => [s.id, points(s)]), points: points(set), cases: cases.map((c) => [c.id, c.expected_points]) });
