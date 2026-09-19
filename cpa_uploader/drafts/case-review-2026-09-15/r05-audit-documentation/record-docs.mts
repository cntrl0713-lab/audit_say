// r05 설계 장부·계보·대표 답안 기록(한 번만 실행; 기존 파일이 있으면 쓰지 않는다).
//   npx tsx cpa_uploader/drafts/case-review-2026-09-15/r05-audit-documentation/record-docs.mts
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewedContentHash } from '../../../questionReviewIdentity.ts';
import { computeSubquestionMaxPoints } from '../../../../lib/questionV3.ts';
import type { QuestionSetV3 } from '../../../../lib/questionV3.ts';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r05-audit-documentation';
const BANK = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (name: string, value: unknown) => fs.writeFileSync(`${D}/${name}`, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const [set] = read(`${D}/sets.json`) as QuestionSetV3[];
const original = (read(BANK) as QuestionSetV3[]).find((s) => s.id === 'pilot-04-006')!;
const points = (s: QuestionSetV3) => s.subquestions.reduce((n, q) => n + computeSubquestionMaxPoints(q), 0);
const target = reviewedContentHash(set);

write('design.json', {
    version: 1,
    set_id: set.id,
    route: '사례형 재구성(검토 스킬) + 새 사실관계·발문 제작(제작 스킬)',
    format: '두 물음 모두 번호를 붙인 절차 ①~⑥·⑦~⑩이 적절한지 각각 판단하고, 적절하지 않은 것은 이유나 보완절차를 간략히 쓰는 판단형이다. 채점은 사례형 선택형 계약(식별 1점 + 적절하지 않은 항목마다 이유 또는 보완절차 1점)을 따른다.',
    user_requests: [
        '10번(pilot-04-006): 해당 문제를 검토해서 스포일러 요소를 없애고 감사문서에 대한 종합문제로 만들어 달라(사실관계의 각 절차가 적절한지와 그 이유를 묻는 문제로 변형).',
        '형식 해석: “각 절차가 적절한지와 그 이유”는 2025 제60회 2차 문제 2 물음 2와 고급회계감사연습의 “각 항목이 적절한지 여부를 기재하고, 적절하지 않은 경우 그 이유를 서술” 형식으로 해석했다. 적절한 항목의 이유와 항목별 판단 점수는 두지 않고, 추측 득점을 막는 사례형 선택형 배점을 적용했다.',
        '공통 기준(2026-09-15): 암시 제거, 옳고 그름을 구분하는 형식, 이유나 보완절차는 간략히, 연도는 20X1·20X2(대상 연도 2027년), 운영 반영은 지정 검토를 모아 한 번에 한다.',
    ],
    items: [
        { no: '①', fact_id: 'fact2', verdict: '적절(함정)', kind: '절차', basis: 'KGA 230 문단 9(a)·A12: 테스트한 항목의 식별 특성을 기록한다. 문서로 구성된 모집단에서 체계적 추출을 하면 문서의 원천, 출발점, 표본추출 간격을 기록하는 방식으로 추출된 문서를 식별할 수 있다. 송장번호를 하나하나 적지 않아도 된다.', origin: 'new_element' },
        { no: '②', fact_id: 'fact2', verdict: '적절하지 않음', kind: '절차', basis: 'KGA 230 문단 7·A1: 감사문서는 적시에 작성한다. 적시 작성은 감사보고서가 확정되기 전에 입수한 증거와 결론을 효과적으로 검토·평가하게 하며, 업무 수행 후 작성한 문서는 정확성이 낮다. 조서 작성과 담당 이사의 검토를 감사보고서일 후로 미룬 것은 A22가 허용하는 행정적 변경(보고서일 전에 입수하여 업무팀원들과 토의·합의한 증거의 문서화)에도 해당하지 않는다.', origin: 'pilot-04-006/sub1(갑의 제안)' },
        { no: '③', fact_id: 'fact2', verdict: '적절하지 않음', kind: '절차', basis: 'KGA 230 문단 8(c)·A5: 유의적 사항, 그 결론과 결론에 도달할 때 행한 유의적인 전문가적 판단을 숙련된 감사인이 이해할 수 있도록 문서화한다. 구두설명 자체는 수행한 업무나 결론의 적절한 근거가 되지 못한다.', origin: 'pilot-04-006 f2의 “검토자는 구두로만 들을 수 있다”는 암시 문장을 독립 항목으로 전환' },
        { no: '④', fact_id: 'fact2', verdict: '적절(함정)', kind: '절차', basis: 'KGA 230 문단 9(c)·A13: 검토자, 검토일, 검토범위를 기록하되 개별 감사조서마다 검토의 증거를 남길 필요는 없고 어떤 업무를 누가 언제 검토했는지 문서화하면 된다. 검토는 감사보고서일 전(3월 10~12일)에 이루어졌다.', origin: 'new_element' },
        { no: '⑤', fact_id: 'fact2', verdict: '적절하지 않음', kind: '절차', basis: 'KGA 230 문단 10: 유의적 사항에 관하여 경영진·지배기구와 행한 토의 내용(사항의 성격, 토의 시기, 토의 상대자 등)을 문서화한다. 토의 결과가 결론에 반영되었다는 이유로 생략할 수 없다.', origin: 'new_element' },
        { no: '⑥', fact_id: 'fact2', verdict: '적절(함정)', kind: '절차', basis: 'KGA 230 문단 11·A4·A15: 유의적 사항에서 결론과 일치하지 않는 정보를 식별하면 처리 방법을 문서화한다(⑥은 경위·결과·판단 근거를 기록함). 교체된 감사조서·초안은 감사문서에 포함할 필요가 없고, 불일치 처리의 문서화 요구가 부정확하거나 교체된 문서의 보존을 뜻하지 않는다.', origin: 'new_element' },
        { no: '⑦', fact_id: 'fact3', verdict: '적절(함정)', kind: '절차', basis: 'KGA 230 문단 14·A22: 보고서일 후 최종감사파일 취합은 행정적 절차이며, 취합 중 교체된 문서의 삭제·폐기와 감사조서의 분류·병합·상호 참조를 할 수 있다. 취합 완료(4월 24일) 전의 삭제이므로 문단 15의 삭제 금지와 관계없다.', origin: 'pilot-04-006/exp1 c1·c2(을의 정리)' },
        { no: '⑧', fact_id: 'fact3', verdict: '적절(함정)', kind: '절차', basis: 'KGA 230 문단 A22: 감사인이 감사보고서일 전에 입수하여 관련 업무팀원들과 토의하고 합의한 감사증거에 대한 문서화는 취합 중 가능한 행정적 변경이다. 증거 입수(보고서일 전), 담당 이사가 참석한 회의의 토의·합의(3월 12일), 조서 작성(취합 기간 3월 22일)이 모두 충족된다.', origin: 'new_element(②와 같은 기준에서 결론이 갈리는 함정)' },
        { no: '⑨', fact_id: 'fact3', verdict: '적절하지 않음', kind: '절차·판단', basis: 'KGA 230 문단 13·A20·A22: 감사보고서일 현재 존재한 사실을 보고서일 후 알게 되어 새로운·추가적인 감사절차(질문·계약서 대조)를 수행하고 결론을 도출하는 것은 행정적 취합과 관계없다. 당면한 상황, 수행한 절차·입수한 증거·도달한 결론·감사보고서에 미친 영향, 감사문서의 변경자·검토자와 그 시기를 문서화한다. 결론이 재무제표 수정 불필요여도 추가 절차를 수행했으므로 문단 13이 적용된다.', origin: 'pilot-04-006/exp1 c3·c4(병의 작업)' },
        { no: '⑩', fact_id: 'fact3', verdict: '적절하지 않음', kind: '절차', basis: 'KGA 230 문단 16: 최종감사파일 취합 완료 후 문단 13 외의 상황으로 기존 감사문서를 수정·추가하면 그 성격과 관계없이 수정·추가하는 구체적 이유와 수정·추가하고 검토한 사람 및 그 시기를 문서화한다.', origin: 'new_element' },
    ],
    questions: [
        { subquestion_id: 'sub1', question_style: 'case', type: 'judgment', topic_ids: ['04'], case_fact_ids: ['fact1', 'fact2'],
            topic_reason: '04: 감사보고서일 전 감사문서의 적시 작성, 형태·내용·범위, 식별 특성, 검토 기록, 토의·불일치 정보의 문서화(KGA 230 문단 7~11, A1·A4·A5·A12·A13·A15)를 사례 절차에 적용한다.',
            criteria: [
                { id: 'sub1.c1', points: 1, meaning: '식별: ②·③·⑤를 적절하지 않다고 판단하고 ①·④·⑥은 적절하지 않다고 판단하지 않음' },
                { id: 'sub1.c2', points: 1, meaning: '②: 감사문서의 적시 작성(보고서일 전 작성·검토) 이유 또는 절차' },
                { id: 'sub1.c3', points: 1, meaning: '③: 유의적 판단의 근거를 조서에 문서화(구두설명만으로는 근거가 되지 못함) 이유 또는 절차' },
                { id: 'sub1.c4', points: 1, meaning: '⑤: 유의적 사항에 관한 경영진·지배기구와의 토의 내용 문서화 이유 또는 절차' },
            ],
            minimum_sufficient_answer: '②·③·⑤를 적절하지 않다고 판단하고(①·④·⑥은 적절) 각각 한 문장씩 이유나 보완절차를 쓴다.',
            point_decision: '4점. 식별 1점 + 적절하지 않은 항목 세 개에 각 1점. 원 sub1(갑의 제안 판단 1 + 최초 작성의 적시성 1 + 취합의 행정적 성격 1)의 적시성 요소는 ②의 이유로 승계하고, 취합의 성격은 물음 2의 ⑦·⑧·⑨ 판단으로 옮겼다. 항목마다 적절 여부를 판단하게 하되 판단마다 1점을 주지 않고 식별 1점으로 두어 추측 득점을 막는다. 토의 기록의 세 요소나 적시 작성의 효익을 완전히 나열하도록 요구하지 않는다. 판단형 물음 하나에 여섯 항목을 두었지만 적절하지 않은 항목마다 한 문장이면 되어 r04 물음 1(5항목·3점)과 부담이 비슷하다.' },
        { subquestion_id: 'sub2', question_style: 'case', type: 'judgment', topic_ids: ['04'], case_fact_ids: ['fact1', 'fact3'],
            topic_reason: '04: 감사보고서일 후 최종감사파일 취합의 행정적 변경과 새로운 감사절차의 구별, 취합 완료 후 수정의 문서화(KGA 230 문단 13·14·16, A20·A22)를 사례 절차에 적용한다.',
            criteria: [
                { id: 'sub2.c1', points: 1, meaning: '식별: ⑨·⑩을 적절하지 않다고 판단하고 ⑦·⑧은 적절하지 않다고 판단하지 않음' },
                { id: 'sub2.c2', points: 1, meaning: '⑨: 새로운·추가적인 절차는 행정적 취합이 아니라는 이유 또는 문단 13 사항의 문서화 절차(일부 사항도 인정)' },
                { id: 'sub2.c3', points: 1, meaning: '⑩: 취합 완료 후 수정은 성격과 관계없이 이유·수정자·검토자와 그 시기를 문서화(일부도 인정)' },
            ],
            minimum_sufficient_answer: '⑨·⑩을 적절하지 않다고 판단하고(⑦·⑧은 적절) 각각 한 문장씩 이유나 보완절차를 쓴다.',
            point_decision: '3점. 식별 1점 + ⑨·⑩ 각 1점. 원 exp1(을·병 각 판단 1 + 설명 1, 4점)이 을과 병을 나란히 따로 물어 서로의 답을 알려 주던 구성을 없애고, 을의 행정적 정리는 적절한 항목 ⑦로, 병의 새 절차는 적절하지 않은 항목 ⑨로 옮겼다. 적절한 항목의 설명 점수(원 exp1.c2)는 함정에 별도 득점 기준을 두지 않는 계약에 따라 없앴고, ⑧(보고서일 전 합의한 증거의 문서화)과 ⑩(취합 완료 후 수정 기록)을 새로 더했다. 문단 13 사항의 완전한 나열은 요구하지 않는다.' },
    ],
    spoiler_review: [
        '원 제목 “감사문서의 적시 작성과 행정적 취합의 경계”, 원 사실관계의 “검토자는 현재 갑의 설명을 구두로만 들을 수 있고, 다른 팀원도 그 판단에 이른 과정을 기록으로 확인할 수 없다”, “조서의 감사증거와 결론은 바꾸지 않으며, 새로운 절차를 수행할 계획도 없다”, 병의 틀린 주장(“을의 작업과 같은 통상적인 파일 취합으로 처리할 수 있다고 말한다”)과 미결 사실(“보고서에 미칠 영향에 대한 판단은 별도로 진행 중이다”), 발문의 “최초 작성과 최종감사파일 취합의 성격을 구별하여”, “작업의 성격에 근거하여”, “추가 절차 필요성이나 감사의견의 종류는 판단하지 마시오”를 모두 없앴다.',
        '을(행정적 정리)과 병(새 절차)을 나란히 따로 묻던 대조 병렬 질문을 없애고 ⑦·⑨로 한 목록에 섞었다. 적절하지 않은 항목의 수는 발문에 밝히지 않는다(물음별 3개·2개).',
        '근거 문구가 정답 표지가 되지 않도록 적절한 항목(① “분량을 줄이기 위하여”, ④ “검토한 조서가 많으므로”, ⑥ “혼동되지 않도록”, ⑦ “더 이상 필요하지 않으므로”, ⑧ “일정이 몰려”)과 적절하지 않은 항목(② “일정이 바빠”, ③ “시간을 줄이기 위하여”, ⑤ “반영되었다고 보아”, ⑨ “이루어졌으므로”, ⑩ “오기이므로”)에 서로 다른 근거를 고루 두었다. “…대신/…하지 않았다” 같은 표현도 적절한 항목 ①·④·⑥과 적절하지 않은 항목 ③·⑤·⑩에 함께 있다. “그러나”, “다만” 같은 연결어는 쓰지 않았다.',
        '②(최초 작성과 검토를 보고서일 후로 미룸)와 ⑧(보고서일 전에 토의·합의한 증거를 취합 중 문서화)은 같은 기준(문단 7·A22)에서 결론이 갈리는 쌍이지만 따로 묻지 않고 두 물음의 목록에 나누어 섞었다. ⑧의 사실은 ②의 판단 결과를 알려 주지 않는다.',
        '①은 주장 방향 논란을 피하려고 “매출 세부테스트”로 썼다(출하기록의 송장을 추출해 매출 기록과 대조). ④의 검토 영역은 다른 항목과 겹치지 않는 차입금·이자비용으로 두어 ②·③·⑤의 결함이 ④의 판단에 섞이지 않게 했다. 판단에 쓰이지 않는 현장감사 기간 문장은 뺐다.',
        '연도는 20X1·20X2로 썼다. 대상 연도 2027년과 판본 판단은 verification.notes에 기록했다.',
    ],
    nonduplication: [
        'pilot-04-005(최종감사파일 보존과 취합 후 설명 보완)는 취합 완료 후 삭제 금지(문단 15)와 모니터링 의견에 따른 설명 추가 시 이유·추가자·검토자와 시기(문단 16)를 묻는다. 이 사례의 ⑩도 문단 16을 쓰지만, 차기 감사 준비 중 발견한 단순 오기의 정정에서 “성격과 관계없이” 기록해야 하는지를 판단하게 하며 문단 15는 묻지 않는다. 사용자가 이 세트를 따로 지정하면 병합 여부를 다시 검토한다.',
        'case-04-documentation-trace-20260914는 검사대상 식별(문단 9(a)·A12의 일자·고유번호, 금액 기준 전부 추출)의 보완, 회사 작성 회의록의 사용(A14), 불일치 정보 처리 기록(문단 11)을 서술로 묻는다. 이 사례는 체계적 추출의 식별 방식(①)과 불일치 처리 후 초안 제외(⑥, A4·A15)를 적절한 항목으로 두어 판단하게 하고, 회의록(A14)은 쓰지 않으며, ⑤는 토의 기록(문단 10) 자체의 누락을 판단하게 한다.',
        '기준서형 draft-standard-additional-20260913-s03(문단 9·10·11 열거), pilot-04-006-standards-20260913(A22 네 범주, 문단 16 문서화 사항), std-points-20260914-218f4f34b5e9(작성 시기·문단 8(a)(b)), std-points-20260914-b49e4b716a04(문단 8(c)), std-points-20260914-d22c23444c4b·std-points-20260914-6e9dfa933285(문단 13)는 기준서 목록을 재현하는 물음이다. 이 사례는 같은 문단을 사례 절차의 적절성 판단에 적용하며 목록의 완전한 나열을 요구하지 않는다.',
        '형식은 2025 제60회 2차 문제 2 물음 2(감사조서 작성·취합 상황의 적절 여부와 적절하지 않은 경우 그 이유)를 참고했다. 그 ①(문서화를 취합기한까지 완료, 아니오)은 이 사례 ②와 같은 쟁점이고, ③(모든 문서를 최종감사파일로 취합, 아니오)은 ⑥의 초안 제외와 관련된다. 원발문 ②(조회서 원본 별도 보관)는 KGA 230의 직접 근거가 약해 쓰지 않았다.',
        '원 pilot-04-006은 재구성 후 퇴역 대상이다. 운영 반영과 퇴역은 지정 검토를 모아 한 번에 한다.',
    ],
    references_consulted: [
        { file: 'cpa_uploader/data/회계감사_통합학습자료/04_기출문제/기출문제_연도별_해설_A.md', lines: 'L1958-L2070 (2025 제60회 2차 문제 2 물음 2와 답안·해설)', sha256: sha('cpa_uploader/data/회계감사_통합학습자료/04_기출문제/기출문제_연도별_해설_A.md') },
        { file: 'cpa_uploader/data/회계감사_통합학습자료/03_문제연습/고급_회계감사_연습.md', lines: 'L1366-L1386 (Section 2 물음 5: 각 항목의 적절 여부와 적절하지 않은 경우 이유 형식, 60일 취합 항목)', sha256: sha('cpa_uploader/data/회계감사_통합학습자료/03_문제연습/고급_회계감사_연습.md') },
    ],
    edition: '2025 개정 전문(KGA 230 문단 4: 2026-01-01 이후 개시 보고기간 시행)을 대상 연도 2027년 기준으로 적용했다. 2026 전문과 대조한 결과 문단 7~16, A1·A4·A5·A12·A15·A22의 요구 내용은 같고 A13 첫 문장과 A20 둘째 문장만 개정 220의 정합 개정으로 표현이 달라졌다(출처 계보: cpa_uploader/raw/originals/case-review-2026-09-15/kga230-2025-excerpts.provenance.json).',
    target_reviewed_content_sha256: target,
});

write('lineage.json', {
    version: 1,
    artifact_type: 'case_merge_lineage',
    created_at: '2026-09-17',
    user_instruction: 'docs/case-question-edit-notes-2026-09-14.md 항목 10(2026-09-17 대화: 스포일러 제거, 감사문서 종합문제, 사실관계의 각 절차가 적절한지와 그 이유를 묻는 문제로 변형)',
    source_bank: { file: BANK, sha256: sha(BANK) },
    sources: [{ set_id: original.id, title: original.title, status: original.status, reviewed_content_sha256: reviewedContentHash(original), points: points(original) }],
    target: { set_id: set.id, reviewed_content_sha256: target, points: points(set) },
    mapping: [
        { from: 'pilot-04-006 f1(한결·한빛, 2026년 개시 보고기간, 감사보고서일 2027-03-15, 취합 완료 예정 4월 20일)', disposition: 'rewritten', to: 'fact1', reason: '실제 연도를 20X1·20X2로 바꾸고, 취합 완료일을 실제 완료(4월 24일)로 두어 ⑦~⑩의 시점 판단에 쓴다. 업무 일정 논의 문장은 판단에 쓰이지 않아 뺐다.' },
        { from: 'pilot-04-006 f2(갑이 2월 대사 절차의 조서를 4월 20일에 처음 작성하자고 제안, 검토자는 구두로만 들을 수 있음)', disposition: 'converted_to_incorrect_item', to: 'fact2 ②(을), sub1.c2', reason: '최초 작성과 검토를 보고서일 후로 미룬 절차를 적절하지 않은 항목으로 두었다. “검토자는 구두로만 들을 수 있다, 다른 팀원도 기록으로 확인할 수 없다”는 암시 문장은 없애고, 구두설명의 한계는 별도 항목 ③(병, A5)으로 분리했다.' },
        { from: 'pilot-04-006 f3(을의 보고서일 후 계정별 분류·상호 참조, 증거·결론 불변과 새 절차 없음 명시)', disposition: 'converted_to_trap', to: 'fact3 ⑦', reason: '행정적 정리를 적절한 항목으로 두고, 판단 기준을 그대로 알려 주던 “증거와 결론은 바꾸지 않으며 새로운 절차를 수행할 계획도 없다”를 없앴다. 교체된 이전 버전 파일의 삭제(A22)를 더했다.' },
        { from: 'pilot-04-006 f4(병의 거래처 새 질문·자료 대조·결론 재검토, 통상 취합이라는 병의 주장, 보고서 영향 판단 진행 중)', disposition: 'converted_to_incorrect_item', to: 'fact3 ⑨, sub2.c2', reason: '등장인물의 틀린 주장과 미결 사실을 없애고, 보고서일 후 새로 알게 된 사실(A20)에 대한 추가 절차와 결론을 감사팀이 취합 절차로 처리한 행위로 바꾸었다.' },
        { from: 'pilot-04-006/sub1 crit1(갑의 제안이 부적절하다는 판단)', disposition: 'merged_into_identification', to: 'sub1.c1', reason: '항목별 판단을 식별 1점으로 채점한다.' },
        { from: 'pilot-04-006/sub1 crit2(최초 작성은 적시에 이루어져야 함)', disposition: 'retained_as_reason', to: 'sub1.c2', reason: '②의 이유로 승계했다.' },
        { from: 'pilot-04-006/sub1 crit10(보고서일 후 취합은 새로운 절차·결론과 관계없는 행정적 정리라는 성격)', disposition: 'moved', to: 'fact3 ⑦·⑧(적절), ⑨(적절하지 않음), sub2.c1·sub2.c2', reason: '취합의 성격 설명을 물음 2의 항목 판단과 ⑨의 이유로 옮겼다.' },
        { from: 'pilot-04-006/exp1 c1(을의 작업은 통상적인 취합에 해당한다는 판단)', disposition: 'converted_to_trap', to: 'fact3 ⑦, sub2.c1', reason: '적절한 항목의 판단은 식별 기준으로만 평가한다.' },
        { from: 'pilot-04-006/exp1 c2(을의 분류·상호 참조는 기존 증거와 결론을 바꾸지 않는 행정적 정리라는 설명)', disposition: 'deleted', to: null, reason: '함정(적절한 항목)에는 별도 득점 기준을 두지 않는 사례형 선택형 배점 계약에 따라 설명 점수를 없앴다.' },
        { from: 'pilot-04-006/exp1 c3(병의 작업은 통상적인 취합이 아니라는 판단)', disposition: 'merged_into_identification', to: 'sub2.c1', reason: '항목별 판단을 식별 1점으로 채점한다.' },
        { from: 'pilot-04-006/exp1 c4(병의 새 질문·대조·재검토는 새로운 절차·결론이라는 설명)', disposition: 'retained_as_reason', to: 'sub2.c2', reason: '⑨의 이유로 승계하고, 문단 13에 따른 문서화 사항을 보완절차로도 인정한다.' },
        { from: 'pilot-04-006/exp1 발문의 제한(병의 추가 절차 필요성이나 감사의견 종류는 판단하지 않음)', disposition: 'deleted', to: null, reason: '⑨의 사실에 재무제표 수정이 필요 없다는 결론을 두어 의견 판단이 필요 없게 했다. 채점은 문서화·취합 성격에 한정한다.' },
        { from: 'new_element', disposition: 'added', to: 'fact2 ①·③·④·⑤·⑥, fact3 ⑧·⑩, sub1.c3·sub1.c4, sub2.c3', reason: '사용자 지시(감사문서 종합문제)에 따라 KGA 230의 식별 특성(9(a)·A12), 구두설명의 한계(8(c)·A5), 검토 기록(9(c)·A13), 토의 기록(10), 불일치 처리와 초안 제외(11·A4·A15), 보고서일 전 합의한 증거의 취합 중 문서화(A22), 취합 완료 후 수정의 기록(16)을 더했다.' },
    ],
    points_change: { from: points(original), to: points(set), reason: '원 3점+4점(판단·설명 결합)에서 4점+3점(식별 + 적절하지 않은 항목별 1점)으로 바뀌었다. 합계가 같은 것은 우연이며, 적절한 항목의 설명 점수를 없애고 새 적절하지 않은 항목(③·⑤·⑩)을 더한 결과다.' },
});

const verdicts = (sub: string, rows: [string, string][]) => rows.map(([verdict, reason], i) => ({ criterion_id: `${sub}.c${i + 1}`, verdict, reason }));
const total = (sub: string, rows: { verdict: string }[]) => rows.reduce((n, v) => n + (v.verdict === 'met' ? 1 : 0), 0);
const cases = [
    { id: 'r05-sub1-partial', subquestion_id: 'sub1', kind: 'partial',
        answer: '① 적절하다.\n② 적절하지 않다. 감사문서는 적시에 작성해야 하므로 조사 내용과 결론을 감사보고서일 전에 조서로 작성하고 검토를 받아야 한다.\n③ 적절하지 않다. 감사인의 구두설명만으로는 결론의 적절한 근거가 되지 못하므로 평가충당금에 관한 판단의 근거를 조서에 기록해야 한다.\n④ 적절하다.\n⑤ 적절하다.\n⑥ 적절하지 않다. 불일치를 확인하는 과정에서 작성한 분석표 초안도 감사파일에 보존해야 한다.',
        expected_verdicts: verdicts('sub1', [['contradicted', '적절하지 않은 ⑤를 적절하다고 하고 적절한 ⑥을 적절하지 않다고 판단했다.'], ['met', '감사문서를 적시에 작성해 보고서일 전에 검토받아야 한다고 적었다.'], ['met', '구두설명만으로는 근거가 되지 못하므로 판단 근거를 조서에 기록해야 한다고 적었다.'], ['contradicted', '⑤가 적절하다고 명시했다.']]),
        reason: '적절하지 않은 ⑤를 빠뜨리고 함정 ⑥을 고른 답에서 식별 점수만 잃고 ②·③의 이유는 유지되는지 확인하는 부분정답이다.' },
    { id: 'r05-sub1-wrong', subquestion_id: 'sub1', kind: 'wrong',
        answer: '① 적절하지 않다. 추출한 송장번호를 모두 조서에 적어야 테스트 대상을 식별할 수 있다.\n② 적절하다. 조서는 최종감사파일 취합 기간 안에만 작성하면 된다.\n③ 적절하다. 검토자가 요청할 때 구두로 설명하면 충분하다.\n④ 적절하지 않다. 검토자는 조서마다 검토 서명을 남겨야 한다.\n⑤ 적절하다. 토의 결과가 결론에 반영되었으므로 토의 내용을 따로 기록할 필요가 없다.\n⑥ 적절하지 않다. 교체한 초안도 모두 감사파일에 포함해야 한다.',
        expected_verdicts: verdicts('sub1', [['contradicted', '적절한 ①·④·⑥만 적절하지 않다고 하고 ②·③·⑤가 적절하다고 명시했다.'], ['contradicted', '취합 기간 안에만 작성하면 된다고 명시했다.'], ['contradicted', '구두로 설명하면 충분하다고 명시했다.'], ['contradicted', '토의 결과가 결론에 반영되면 기록할 필요가 없다고 명시했다.']]),
        reason: '함정만 적절하지 않다고 하고 적절하지 않은 항목을 적절하다고 쓴 대표 오답이다.' },
    { id: 'r05-sub2-partial', subquestion_id: 'sub2', kind: 'partial',
        answer: '⑦ 적절하다.\n⑧ 적절하지 않다. 감사문서는 적시에 작성해야 하므로 감사보고서일 후에 조서를 작성해서는 안 된다.\n⑨ 적절하지 않다. 감사보고서일 후 추가적인 감사절차를 수행한 것은 행정적인 취합 절차가 아니므로 당면한 상황과 감사보고서에 미친 영향, 조서를 변경한 사람과 검토한 사람 및 그 시기를 문서화해야 한다.\n⑩ 적절하지 않다. 취합이 완료된 후 조서를 수정하면 단순한 오기라도 수정 이유와 수정한 사람·검토한 사람 및 그 시기를 문서화해야 한다.',
        expected_verdicts: verdicts('sub2', [['contradicted', '적절한 ⑧을 적절하지 않다고 판단했다.'], ['met', '추가 절차는 행정적 취합이 아니며 문단 13의 사항을 문서화해야 한다고 적었다.'], ['met', '단순 오기라도 수정 이유와 수정자·검토자·시기를 문서화해야 한다고 적었다.']]),
        reason: '함정 ⑧(보고서일 전 합의한 증거의 취합 중 문서화)을 고른 답에서 식별 점수만 잃고 ⑨·⑩의 이유는 유지되는지 확인하는 부분정답이다.' },
    { id: 'r05-sub2-wrong', subquestion_id: 'sub2', kind: 'wrong',
        answer: '⑦ 적절하지 않다. 감사보고서일 후에는 어떠한 조서도 삭제할 수 없다.\n⑧ 적절하지 않다. 조서는 감사보고서일 전에 모두 작성해야 한다.\n⑨ 적절하다. 최종감사파일 취합 기간 중에 수행한 작업이므로 취합 절차로 처리할 수 있다.\n⑩ 적절하다. 결론에 영향이 없는 단순한 오기이므로 정정 기록을 남길 필요가 없다.',
        expected_verdicts: verdicts('sub2', [['contradicted', '함정 ⑦·⑧만 적절하지 않다고 하고 ⑨·⑩이 적절하다고 명시했다.'], ['contradicted', '취합 기간 중 수행했으므로 취합 절차로 처리할 수 있다고 명시했다.'], ['contradicted', '단순 오기이므로 기록할 필요가 없다고 명시했다.']]),
        reason: '함정만 고르고 적절하지 않은 항목을 적절하다고 쓴 대표 오답이다.' },
].map((row) => ({ ...row, set_id: set.id, expected_points: total(row.subquestion_id, row.expected_verdicts) }));
for (const row of cases) {
    const sub = set.subquestions.find((q) => q.id === row.subquestion_id)!;
    if (row.expected_verdicts.length !== sub.criteria.length) throw new Error(`criterion coverage: ${row.id}`);
}
const supp = (sub: string, points: number, rows: [string, string][]) => ({ expected_points: points, expected_verdicts: verdicts(sub, rows) });
write('qa.json', {
    version: 1, set_id: set.id, method: 'author_expected_verdicts_before_model_grading', human_review_performed: false,
    note: '모범답안은 저장 model_answer를 그대로 쓴다. 부분정답·오답과 기대 판정은 실제 채점 전에 원문·criterion에서 정했다. contradicted와 not_met은 모두 0점이다.',
    cases,
    supplementary_cases: [
        { id: 'r05-supp-brief-table', purpose: '항목마다 적절·부적절만 표처럼 적고 적절하지 않은 항목에 이유만(②·⑩) 또는 보완절차만(③·⑤·⑨) 짧게 쓴 답, ⑤·⑨는 문서화 사항 중 일부만 든 답이 항목별 1점을 받는지 확인한다.',
            answers: {
                sub1: '① 적절\n② 부적절 - 감사문서는 적시에 작성해야 한다.\n③ 부적절 - 평가충당금에 관한 판단의 근거를 조서에 기록했어야 한다.\n④ 적절\n⑤ 부적절 - 재무담당이사·감사위원회 위원장과 토의한 일자와 상대방을 조서에 기록했어야 한다.\n⑥ 적절',
                sub2: '⑦ 적절\n⑧ 적절\n⑨ 부적절 - 조서를 변경한 사람과 검토한 사람, 그 시기를 문서화했어야 한다.\n⑩ 부적절 - 취합 완료 후에는 수정의 성격과 관계없이 수정 내역을 문서화해야 한다.',
            },
            expected: {
                sub1: supp('sub1', 4, [['met', '②·③·⑤만 부적절로 판단했다.'], ['met', '적시에 작성해야 한다는 이유를 적었다.'], ['met', '판단 근거를 조서에 기록하는 절차를 적었다.'], ['met', '토의 일자와 상대방을 기록하는 절차(일부 요소)를 적었다.']]),
                sub2: supp('sub2', 3, [['met', '⑨·⑩만 부적절로 판단했다.'], ['met', '변경자·검토자와 그 시기를 문서화하는 절차(일부 사항)를 적었다.'], ['met', '성격과 관계없이 수정 내역을 문서화해야 한다는 원칙을 적었다.']]),
            } },
        { id: 'r05-supp-judgment-only', purpose: '이유나 보완절차 없이 항목마다 적절·부적절만 정확히 쓴 답이 물음마다 식별 1점만 받는지 확인한다.',
            answers: {
                sub1: '① 적절\n② 부적절\n③ 부적절\n④ 적절\n⑤ 부적절\n⑥ 적절',
                sub2: '⑦ 적절\n⑧ 적절\n⑨ 부적절\n⑩ 부적절',
            },
            expected: {
                sub1: supp('sub1', 1, [['met', '②·③·⑤만 부적절로 판단했다.'], ['not_met', '이유나 보완절차를 쓰지 않았다.'], ['not_met', '이유나 보완절차를 쓰지 않았다.'], ['not_met', '이유나 보완절차를 쓰지 않았다.']]),
                sub2: supp('sub2', 1, [['met', '⑨·⑩만 부적절로 판단했다.'], ['not_met', '이유나 보완절차를 쓰지 않았다.'], ['not_met', '이유나 보완절차를 쓰지 않았다.']]),
            } },
    ],
});
console.log({ target, original: reviewedContentHash(original), points: [points(original), points(set)], cases: cases.map((c) => [c.id, c.expected_points]) });
