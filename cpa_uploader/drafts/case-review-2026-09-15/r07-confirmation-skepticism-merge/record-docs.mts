// r07 설계 장부·계보·대표 답안 기록(한 번만 실행; 기존 파일이 있으면 쓰지 않는다).
//   npx tsx cpa_uploader/drafts/case-review-2026-09-15/r07-confirmation-skepticism-merge/record-docs.mts
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewedContentHash } from '../../../questionReviewIdentity.ts';
import { computeSubquestionMaxPoints } from '../../../../lib/questionV3.ts';
import type { QuestionSetV3 } from '../../../../lib/questionV3.ts';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r07-confirmation-skepticism-merge';
const BANK = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const EXAM = 'cpa_uploader/data/회계감사_통합학습자료/04_기출문제/기출문제_연도별_해설_A.md';
const EDITIONS = ['cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025-pymupdf-pages.txt', 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt'];
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (name: string, value: unknown) => fs.writeFileSync(`${D}/${name}`, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const [set] = read(`${D}/sets.json`) as QuestionSetV3[];
const bank = read(BANK) as QuestionSetV3[];
const originals = ['case-09-confirmation-barrier-20260914', 'pilot-02-006', 'pilot-02-007'].map((id) => bank.find((s) => s.id === id)!);
const points = (s: QuestionSetV3) => s.subquestions.reduce((n, q) => n + computeSubquestionMaxPoints(q), 0);
const target = reviewedContentHash(set);

write('design.json', {
    version: 1,
    set_id: set.id,
    route: '사례형 병합 재구성(검토 스킬) + 새 사실관계·발문 제작(제작 스킬)',
    format: '두 물음 모두 옳고 그름을 구분하는 선택형이다(번호를 붙인 절차·판단 중 옳지 않은 것을 모두 찾아 번호와 이유 또는 보완절차를 간략히 쓴다). 사용자가 형식을 따로 지정하지 않아 학습 단위 계약의 기본 형식을 적용했고, 구성(2물음·9항목·8점)은 실행 전에 사용자에게 보여 확인받았다.',
    user_requests: [
        '46번(case-09-confirmation-barrier-20260914)·7번(pilot-02-006)·23번(pilot-02-007)을 종합해서 새로운 문제로 만든다. 애매하면 질문한다(2026-09-18).',
        '사용자 선택(2026-09-18): 원 세 세트는 새 문제로 대체하고 모두 퇴역한다. pilot-02-006의 기준서형 물음 1(전문가적 의구심의 정의)도 별도로 보존하지 않고 함께 퇴역한다.',
        '사용자 선택(2026-09-18): 23번의 감사보고서 발행 후 감사수행 평가(KGA 200 A57)를 같은 회사의 발행 후 단계로 넣은 2물음·9항목·8점 구성으로 진행한다.',
        '공통 기준(2026-09-15): 암시 제거, 옳고 그름을 구분하는 형식, 이유나 보완절차는 간략히, 연도는 20X1·20X2(대상 연도 2027년), 운영 반영은 지정 검토를 모아 한 번에 한다.',
    ],
    items: [
        { no: '①', fact_id: 'fact2', verdict: '옳지 않음', kind: '절차', basis: 'KGA 505 문단 8(a): 경영진이 조회서 발송을 거부하면 거부 사유를 질문하고 그 타당성과 합리성에 관하여 감사증거를 구해야 한다. 감사팀은 질문과 답변 기록 뒤 경영진의 판단을 존중해 사유를 받아들였을 뿐 거부 사유를 뒷받침하는 증거를 구하지 않았다.', origin: 'case-09-confirmation-barrier-20260914 sub1 c1(거부 사유의 타당성·합리성에 관한 증거)' },
        { no: '②', fact_id: 'fact2', verdict: '옳지 않음', kind: '판단', basis: 'KGA 200 문단 A25: 경영진의 정직성과 성실성을 믿는다고 해서 전문가적 의구심을 유지할 필요성이 경감되거나 설득력이 낮은 감사증거에 만족할 수 있는 것은 아니다. A23: 전문가적 의구심은 상반된 감사증거와 질의에 대한 답변의 신뢰성에 의문을 품는 것을 포함한다. A24: 신뢰성에 의문이 있거나 부정 가능성의 징후가 있으면 더 조사하고 감사절차의 변경이나 추가가 필요한지 결정한다. 판매담당자와 재무담당이사의 설명이 서로 다르고 요약파일이 결산 직전에 반복 수정되었다.', origin: 'pilot-02-006 f6·sub3(팀장의 과거 신뢰 제안) + case-09-confirmation-barrier-20260914 fact2(설명 불일치)' },
        { no: '③', fact_id: 'fact2', verdict: '옳음(함정)', kind: '판단', basis: 'KGA 505 문단 8(b): 경영진의 거부가 부정위험 등 관련 중요왜곡표시위험에 대한 평가와 다른 감사절차의 성격, 시기 및 범위에 대하여 갖는 시사점을 평가한다. KGA 200 문단 A21·A24: 부정의 존재가능성을 나타내는 것일 수 있는 상황에 주의를 유지하고 부정 가능성의 징후가 있으면 더 조사하여 절차의 변경·추가를 결정한다. 부정이 확인되기를 기다려야 한다는 요건은 없다. 함정 요소: 부정이 확인되지 않았는데 위험평가를 높이고 절차를 넓힌 것이 지나쳐 보인다.', origin: 'case-09-confirmation-barrier-20260914 sub1 c2·c3(위험평가·다른 절차에 대한 시사점) + pilot-02-006 sub2 crit6(부정 가능성 상황)' },
        { no: '④', fact_id: 'fact2', verdict: '옳지 않음', kind: '절차', basis: 'KGA 505 문단 13·A20: 경영진주장을 확인할 정보가 기업 외부에서만 입수 가능하거나 특정 부정위험요소(경영진의 통제무력화, 공모)로 기업에서 입수한 증거를 신뢰할 수 없으면 적극적 조회에 대한 회신이 필요하고, 이 경우 대체적 감사절차는 감사인이 요구하는 증거를 제공하지 못한다. 약정 원본은 가온상사만 보관하고 다른 외부 기록도 없으며, 관리자 계정의 공동 사용·반복 수정과 서로 다른 설명이 있다. 출고증과 일부 입금 내역은 반품·지급 조건을 보여 주지도 않는다.', origin: 'case-09-confirmation-barrier-20260914 fact3·sub2(출고증·입금내역으로 충분하다는 팀원 제안과 적극적 조회의 필요성)' },
        { no: '⑤', fact_id: 'fact2', verdict: '옳음(함정)', kind: '절차', basis: 'KGA 200 문단 A53 후단: 재무제표 이용자들은 존재할 수 있는 모든 정보를 다루거나 모든 사항을 누락 없이 추적하는 것은 실행가능하지 않다는 것을 인식한다. A54: 부정이나 오류로 인한 중요왜곡표시위험이 가장 높게 예상되는 분야에 감사노력을 집중하고 다른 분야에는 상대적으로 적은 노력을 기울이며, 테스트로 모집단의 왜곡표시를 조사한다. 부정위험요소는 요약파일로 관리되는 특별약정에서 나타났고 일반 판매는 회계시스템에서 처리된다. 함정 요소: 부정의 징후가 있으니 모든 거래를 확인해야 할 것처럼 보인다.', origin: 'pilot-02-007 sub2 requirement(KGA 200 A53 후단)에서 가져온 새 함정' },
        { no: '⑥', fact_id: 'fact3', verdict: '옳지 않음', kind: '조치', basis: 'KGA 505 문단 9·13: 적극적 조회 회신이 필요한 경우 대체적 절차는 필요한 증거를 제공하지 못하므로, 거부로 관련성 있고 신뢰할 수 있는 증거를 입수할 수 없으면 감사기준서 260에 따라 지배기구와 커뮤니케이션해야 한다. 지배기구에 경영에 참여하지 않는 구성원이 있어 대표이사·재무담당이사에 대한 서면 통보로 대신할 수 없다.', origin: 'case-09-confirmation-barrier-20260914 sub3 c1(지배기구 커뮤니케이션)' },
        { no: '⑦', fact_id: 'fact3', verdict: '옳지 않음', kind: '판단', basis: 'KGA 200 문단 A53: 어려움, 시간 또는 비용의 문제 그 자체는 대체적인 절차가 없는 감사절차를 생략하거나 보다 설득력이 낮은 감사증거에 만족하는 정당한 근거가 되지 못한다. KGA 505 문단 9·13: 필요한 적극적 조회 회신을 입수하지 못하면 감사기준서 705에 따라 해당 감사와 감사의견에 대한 시사점을 결정해야 한다.', origin: 'pilot-02-007 f2·sub2(예산·일정을 이유로 한 절차 생략과 낮은 설득력 증거 수용) + case-09-confirmation-barrier-20260914 sub3 c2·c3(감사와 감사의견에 대한 시사점)' },
        { no: '⑧', fact_id: 'fact4', verdict: '옳음(함정)', kind: '판단', basis: 'KGA 200 문단 A57: 감사기준에 따라 적절하게 계획·수행된 감사에서도 감사의 고유한계 때문에 중요한 왜곡표시가 발견되지 않을 불가피한 위험이 있으므로, 중요한 왜곡표시가 차후에 발견되었다는 사실 자체만으로 감사기준에 따른 감사를 수행하지 못했다는 것을 의미하지 않는다. 함정 요소: 발행 후 중요한 왜곡표시가 확인되었으니 감사가 실패한 것처럼 보인다.', origin: 'pilot-02-007 f4·sub3 crit6 전단(사후 발견만으로 미준수를 단정할 수 없음)' },
        { no: '⑨', fact_id: 'fact4', verdict: '옳지 않음', kind: '판단', basis: 'KGA 200 문단 A57: 감사기준에 따라 감사를 수행하였는지는 각 상황에서 수행한 감사절차, 그 결과 입수한 감사증거의 충분성과 적합성, 전반적인 목적에 비추어 그 증거를 평가한 결과에 기초한 감사보고서의 적합성에 의해 결정되며, 고유한계는 설득력이 부족한 감사증거에 만족하는 것을 정당화하지 않는다. 조작이 정교했다는 사실만으로 준수를 결론 낼 수 없다.', origin: 'pilot-02-007 f4·sub3 crit6 후단·crit7~crit9(정교한 조작만으로 적절성 확정 불가, 세 평가 측면)' },
    ],
    questions: [
        { subquestion_id: 'sub1', question_style: 'case', type: 'judgment', topic_ids: ['09', '02', '08'], case_fact_ids: ['fact1', 'fact2'],
            topic_reason: '09: 경영진의 조회서 발송 거부에 대한 절차와 적극적 조회 회신이 필요한 경우(KGA 505 문단 8·13·A20)를 사례에 적용한다. 02: 전문가적 의구심(KGA 200 문단 A21·A23~A25)과 모든 사항을 추적할 수 없는 감사에서의 노력 배분(A53·A54)을 판단한다. 08: 서로 다른 설명과 회사 자료의 신뢰성, 대체적 절차로 얻는 증거의 충분성과 적합성을 평가한다.',
            criteria: [
                { id: 'sub1.c1', points: 1, meaning: '식별: ①·②·④를 고르고 ③·⑤는 고르지 않음' },
                { id: 'sub1.c2', points: 1, meaning: '①: 거부 사유의 타당성과 합리성에 관한 감사증거를 구해야 함(이유 또는 절차)' },
                { id: 'sub1.c3', points: 1, meaning: '②: 과거 신뢰로 전문가적 의구심 필요성이 줄지 않고 설득력 낮은 증거에 만족할 수 없음, 또는 서로 다른 설명을 추가 증거로 해소(이유 또는 절차)' },
                { id: 'sub1.c4', points: 1, meaning: '④: 외부에서만 확인 가능하거나 부정위험요소로 회사 자료를 신뢰할 수 없어 적극적 조회 회신이 필요하고 대체적 절차로는 필요한 증거를 얻을 수 없음(이유 또는 절차, 한 사정만 들어도 인정)' },
            ],
            minimum_sufficient_answer: '①·②·④를 고르고 각각 한 문장씩 이유나 보완절차를 쓴다.',
            point_decision: '4점. 식별 1점 + 옳지 않은 항목 세 개(①·②·④)에 각 1점. 원 case-09-confirmation-barrier-20260914 sub1(3점: 거부 사유의 증거, 위험평가 시사점, 다른 절차 시사점)은 ①의 1점과 함정 ③(식별 기준)으로, sub2(3점: 적극적 조회 회신 필요 판단, 외부에서만 입수 가능, 부정위험요소)는 ④의 1점(두 사정 중 하나)과 식별로 통합했다. pilot-02-006 sub2(A21 네 범주 연결, 4점)는 네 독립 상황을 없애고 상반된 설명·부정 가능성 요소를 ②·③에 흡수했으며, sub3(판단·조사·과거 신뢰, 3점)은 ②의 식별과 1점으로 통합했다. ⑤는 pilot-02-007이 인용한 A53 후단에서 가져온 새 함정이다. 항목별 이유는 핵심 원칙 한 가지로 인정하고 증거의 구체적 종류나 두 사정의 동시 서술은 요구하지 않는다.' },
        { subquestion_id: 'sub2', question_style: 'case', type: 'judgment', topic_ids: ['09', '02', '08'], case_fact_ids: ['fact1', 'fact2', 'fact3', 'fact4'],
            topic_reason: '09: 발송 거부로 필요한 회신을 입수하지 못한 경우의 지배기구 커뮤니케이션과 감사·감사의견에 대한 시사점(KGA 505 문단 9·13)을 사례에 적용한다. 02: 시간·비용의 제약(KGA 200 문단 A53)과 사후 발견된 중요한 왜곡표시에 따른 감사수행 평가(A57)를 판단한다. 08: 감사기준 준수 여부를 입수한 감사증거의 충분성과 적합성으로 평가한다.',
            criteria: [
                { id: 'sub2.c1', points: 1, meaning: '식별: ⑥·⑦·⑨를 고르고 ⑧은 고르지 않음' },
                { id: 'sub2.c2', points: 1, meaning: '⑥: 경영진 통보에 그치지 않고 지배기구와 커뮤니케이션(이유 또는 절차)' },
                { id: 'sub2.c3', points: 1, meaning: '⑦: 시간·비용은 설득력 낮은 증거에 만족할 근거가 아님, 또는 705에 따라 감사와 감사의견에 대한 시사점 결정(이유 또는 절차)' },
                { id: 'sub2.c4', points: 1, meaning: '⑨: 준수 여부는 수행한 절차·증거의 충분성과 적합성·감사보고서의 적합성으로 결정되거나 고유한계가 설득력 부족한 증거를 정당화하지 않음(이유 또는 절차, 한 측면도 인정)' },
            ],
            minimum_sufficient_answer: '⑥·⑦·⑨를 고르고 각각 한 문장씩 이유나 보완절차를 쓴다.',
            point_decision: '4점. 식별 1점 + 옳지 않은 항목 세 개(⑥·⑦·⑨)에 각 1점. 원 case-09-confirmation-barrier-20260914 sub3(3점: 지배기구, 감사 수행 시사점, 감사의견 시사점)은 ⑥의 1점과 ⑦의 1점(보완절차)으로, pilot-02-007 sub2(3점: 판단, 절차 생략, 낮은 설득력 증거)는 ⑦의 식별과 1점(이유)으로, sub3(4점: 두 극단의 구별, 세 평가 측면)은 함정 ⑧(식별 기준)과 ⑨의 1점으로 통합했다. 세 평가 측면의 완전한 나열, 한정의견과 의견거절의 구별은 요구하지 않는다.' },
    ],
    spoiler_review: [
        'case-09-confirmation-barrier-20260914: 제목의 “대체증거의 한계”, 사실의 “거래처의 항의나 조회 금지 요청을 보여 주는 문서는 제시하지 않았다”(①의 결론 방향), 팀원의 “거래처의 직접 확인 없이도 … 충분하다”는 제안(틀린 주장), 후속 사실의 “출고증과 입금내역을 추가로 대조하였으나 특별약정의 조건을 확인하지 못했다”·“결론에 필요한 그 밖의 신뢰할 수 있는 증거를 확보하지 못한 채”(앞 단계 ④의 정답 노출), “커뮤니케이션을 금지하는 법규상 제한은 없다”, 발문의 “보완할 증거입수”, “위험평가와 다른 감사절차에 미치는 시사점의 평가를 각각”, “최종 약정의 보관 위치와 회사 자료의 생성·수정 상황을 각각 근거로”, “필요한 커뮤니케이션과 해당 감사 및 감사의견에 관한 조치”(답안 구성 요소)를 없앴다. 원본 보관 위치, 관리자 계정 수정, 서로 다른 설명, 발송 거부, 지배기구 구성 같은 판단에 필요한 사실만 남겼다.',
        'pilot-02-006: 사실의 “어느 상황에서도 부정의 존재가 확정된 것은 아니다”, 팀장 제안의 “더 조사하지 말고 … 만족하자”(부정형으로 적은 누락 절차), 발문의 “해당하는 증거평가상의 문제 또는 절차 필요성과 연결하여”(A21 범주 암시), “필요한 대응과 과거의 신뢰가 그 대응을 생략할 근거가 되는지”(결론 방향)를 없앴다. 서로 다른 거래의 네 독립 상황(계약 취소 확인서, 서명 부인, 개인계좌 송금, 해외 보관재고)은 한 회사의 사례와 맞지 않아 삭제하고, 상반된 설명·부정 가능성 요소는 ②·③으로 옮겼다.',
        'pilot-02-007: 사실의 “그 목적을 달성할 수 있는 대체적인 절차는 없으며, 현재 받은 회사 작성 내역은 그 절차로 얻을 증거보다 설득력이 낮다”(A53 요건을 사실로 제공), 팀원 제안의 “… 이유만으로”, 을의 두 사람 주장 뒤의 “그러나 … 검토는 아직 이루어지지 않았다”(결론 암시), 발문의 “살펴볼 세 측면을 각각 제시”, “법적 책임은 판단하지 마시오”를 없앴다. 시간·비용 논점은 ⑦(종결 판단)으로, 사후 발견 평가는 ⑧(옳음)·⑨(옳지 않음)로 옮겼다.',
        '근거 문구가 정답 표지가 되지 않도록 옳은 항목(③ “함께 나타났으므로”, ⑤ “위험평가 결과에 따라”, ⑧ “사실만으로는”)과 옳지 않은 항목(① “판단을 존중하여”, ② “점을 들어”, ④ “결과에 근거하여”, ⑦ “초과하게 되므로”, ⑨ “점에 비추어”)에 서로 다른 형태로 두었다. 근거 문구가 없는 ⑥도 둔다. “그러나”, “다만” 같은 연결어는 쓰지 않았고 빠뜨린 절차를 부정형으로 적지 않았다(⑤의 “모든 거래를 추적하는 대신”은 옳은 함정의 서술이다).',
        '앞 단계 항목의 정답이 뒤 단계 사실로 드러나지 않게 자료 3에는 회신을 입수하지 못했다는 사실만 적고 ④의 대체적 절차 결과(조건 확인 실패)는 적지 않았다. 자료 4의 사후 발견은 다른 거래처(나래상사)에 관한 것이어서 가온상사 항목의 옳고 그름을 정하지 않는다. ⑧(사후 발견만으로 미준수로 볼 수 없음)과 ⑨(정교한 조작만으로 준수로 결론)는 같은 A57에서 반대 방향을 가르는 쌍이지만 따로 묻지 않고 한 목록 안에 두었다.',
        '연도는 20X1·20X2로 썼다(대상 연도 2027년). 옳지 않은 항목 수(물음별 3개)는 발문에 밝히지 않는다. 금액은 계산을 요구하지 않으므로 두지 않았다.',
    ],
    nonduplication: [
        '기준서형 std-points-20260914-a0ae425fd0b3(KGA 505 문단 8(a)), std-points-20260914-c2f71f331a7b(문단 8(b)), std-points-20260914-a2dcdc9faa17(문단 8(c)·9), pilot-09-007 sub2(미회신·불일치), pilot-02-001 sub1(KGA 200 A25), std-points-20260914-ea841eca2989(고유한계의 세 원인), pilot-05-009 sub1(부정 책임과 합리적 확신)은 기준서 내용을 재현하는 물음이다. 이 사례는 같은 문단을 사례 절차의 옳고 그름 판단에 적용한다. 사례형 case-05-governance-dialogue-20260914는 지배기구와의 양방향 커뮤니케이션(KGA 260)이 쟁점이어서 요구가 다르다.',
        '원 세 세트(case-09-confirmation-barrier-20260914, pilot-02-006, pilot-02-007)는 병합 후 퇴역 대상이다. 사용자 결정(2026-09-18)에 따라 pilot-02-006의 기준서형 물음 1(전문가적 의구심의 정의, KGA 200 문단 13(l))도 함께 퇴역하며, 현재 은행에서 이 정의를 직접 묻는 다른 물음은 없다. 운영 반영과 퇴역은 지정 검토를 모아 한 번에 한다.',
        '2023 제58회 2차 문제 2 물음 4(경영진이 조회서 발송을 거부하는 경우 수행할 절차), 2024 제59회 2차의 경영진에 의한 감사범위 제한(외부조회 거부의 시사점을 정답으로 인정한 사례), 2019 제54회 2차 문제 1 물음 1(재무담당임원의 설명을 증거 없이 받아들인 감사인의 전문가적 의구심 견지 여부), 2016 제51회 2차(조직적 부정으로 사후 발견된 왜곡표시와 감사인에 대한 비판, 고유한계)의 쟁점과 형식을 참고했다.',
    ],
    references_consulted: [
        { file: EXAM, lines: 'L4508-L4530 (2024 제59회 경영진에 의한 제한과 인정 답안), L5059-L5090·L5220-L5245 (2023 제58회 문제 2 물음 4와 답안), L12790-L12880 (2019 제54회 문제 1 물음 1과 답안), L18473-L18610 (2016 제51회 물음 3·4와 답안)', sha256: sha(EXAM) },
        ...EDITIONS.map((file) => ({ file, lines: 'KGA 200 문단 A21~A25·A53·A54·A57, KGA 505 문단 7~13·A8~A10·A20의 2025·2026 전문 대조', sha256: sha(file) })),
    ],
    edition: '2025 개정 전문을 대상 연도 2027년 기준으로 적용했다(판본 정책에 따라 사례의 20X1년을 2026-01-01 개시 보고기간으로 본다). 2026 전문(2026년 7월 개정)과 대조한 결과 KGA 200 문단 A21·A23·A24·A25·A53·A54·A57과 KGA 505 문단 8~13·A8~A10·A20의 본문이 같다(A24는 각주 번호 13→15만 다름). KGA 505 문단 A8·A9(거부 사유의 타당성·합리성에 관한 증거, 비합리적 거부와 부정위험요소)는 등록 발췌본에 없어 인용하지 않고 판단 확인에만 사용했다.',
    target_reviewed_content_sha256: target,
});

write('lineage.json', {
    version: 1,
    artifact_type: 'case_merge_lineage',
    created_at: '2026-09-18',
    user_instruction: 'docs/case-question-edit-notes-2026-09-14.md 항목 46·7·23(2026-09-18 대화: 세 문제를 종합해서 새로운 문제로 만든다. 원 세 세트는 기준서형 물음까지 모두 대체·퇴역하고, 발행 후 단계를 넣은 2물음 구성으로 진행한다)',
    source_bank: { file: BANK, sha256: sha(BANK) },
    sources: originals.map((s) => ({ set_id: s.id, title: s.title, status: s.status, reviewed_content_sha256: reviewedContentHash(s), points: points(s) })),
    target: { set_id: set.id, reviewed_content_sha256: target, points: points(set) },
    mapping: [
        { from: 'case-09-confirmation-barrier-20260914 fact1(한결회계법인·라온회사, 연말 특별 판매약정, 적극적 조회 계획, 조건의 중요성)', disposition: 'rewritten', to: 'fact1, fact2', reason: '회사명을 누리회계법인·하람회사·가온상사로 바꾸고 조건의 중요성을 배경 사실로 유지했다. 적극적 조회 계획은 자료 2의 발송 시도로 옮겼다.' },
        { from: 'case-09-confirmation-barrier-20260914 fact2(재무담당이사의 거부와 문서 미제시, 관리자 계정 수정 기록, 담당자별 설명 불일치)', disposition: 'rewritten', to: 'fact2', reason: '거부·수정 기록·설명 불일치는 유지하고 설명 불일치를 반품 조건에 관한 두 사람의 설명으로 구체화했다. ①의 결론 방향을 알려 주던 “문서는 제시하지 않았다”를 뺐다.' },
        { from: 'case-09-confirmation-barrier-20260914 fact3(원본은 거래처만 보관, 다른 외부 기록 없음, 요약파일 공란, 출고증·입금내역으로 충분하다는 팀원 제안)', disposition: 'rewritten', to: 'fact1, fact2 ④', reason: '원본 보관 위치와 요약파일 공란은 자료 1의 사실로 두고, 팀원의 틀린 주장은 감사팀이 대조 결과로 결론을 내리기로 한 절차 ④로 바꾸었다.' },
        { from: 'case-09-confirmation-barrier-20260914 fact4(추가 대조 후 조건 미확인, 끝까지 거부, 회신 미입수, 다른 증거 부재, 지배기구 구성과 법규 제한 없음)', disposition: 'rewritten', to: 'fact3', reason: '끝까지 거부와 회신 미입수, 지배기구에 경영에 참여하지 않는 구성원이 있다는 사실만 남겼다. ④의 정답을 드러내던 대조 결과 문장과 법규 문장은 뺐다.' },
        { from: 'case-09-confirmation-barrier-20260914 sub1 c1(거부 사유의 타당성·합리성에 관한 추가 증거)', disposition: 'converted_to_incorrect_item', to: 'fact2 ①, sub1.c2', reason: '질문·기록 뒤 경영진의 판단을 존중해 받아들인 절차로 바꾸어 이유 또는 보완절차 1점으로 채점한다.' },
        { from: 'case-09-confirmation-barrier-20260914 sub1 c2·c3(부정위험 평가와 다른 감사절차의 성격·시기·범위에 대한 시사점)', disposition: 'converted_to_trap', to: 'fact2 ③(옳음), sub1.c1', reason: '부정 확인 전에 부정위험 평가를 높이고 다른 특별약정의 절차 범위를 넓힌 옳은 판단으로 바꾸어 식별 기준으로만 평가한다.' },
        { from: 'case-09-confirmation-barrier-20260914 sub2 c1(적극적 조회 회신 필요 판단, 대체 불가)', disposition: 'merged_into_identification', to: 'sub1.c1, sub1.c4', reason: '④를 옳지 않다고 고르는 식별과 ④의 이유로 채점한다.' },
        { from: 'case-09-confirmation-barrier-20260914 sub2 c2·c3(기업 외부에서만 입수 가능, 특정 부정위험요소로 내부 증거 불신)', disposition: 'retained_as_reason', to: 'sub1.c4', reason: '두 사정 중 하나만 들어도 ④의 이유로 인정한다.' },
        { from: 'case-09-confirmation-barrier-20260914 sub3 c1(지배기구 커뮤니케이션)', disposition: 'converted_to_incorrect_item', to: 'fact3 ⑥, sub2.c2', reason: '대표이사와 재무담당이사에게만 서면으로 알린 조치로 바꾸었다.' },
        { from: 'case-09-confirmation-barrier-20260914 sub3 c2·c3(해당 감사의 수행과 감사의견에 대한 시사점, 적정의견 종결 불가)', disposition: 'retained_as_reason', to: 'fact3 ⑦, sub2.c3', reason: '기한·예산을 이유로 현재 증거로 충분하다고 보고 종결한 판단의 보완절차(705에 따른 감사와 감사의견의 시사점 결정)로 합쳤다.' },
        { from: 'pilot-02-006 f1(한결회계법인·다온회사, 네 독립 상황, 부정 미확정)', disposition: 'deleted', to: null, reason: '같은 회사의 시간 순서 사례로 바꾸면서 독립 상황 안내를 없앴다. 부정이 확정되지 않은 상태는 ③의 “부정 여부를 확인하기 전에”로 남겼다.' },
        { from: 'pilot-02-006 f2(회사 계약서와 고객 확인서의 상반)', disposition: 'absorbed', to: 'fact2 ②, sub1.c3', reason: '상반된 감사증거 요소를 판매담당자와 재무담당이사의 서로 다른 설명으로 옮겼다. 계약 취소 확인서 상황은 삭제했다.' },
        { from: 'pilot-02-006 f3(납품확인서 서명 부인)', disposition: 'deleted', to: null, reason: '문서 신뢰성 의문 요소는 결산 직전 관리자 계정의 반복 수정(②·③·④의 사실)으로 대신했다.' },
        { from: 'pilot-02-006 f4(승인권자 개인계좌 송금)', disposition: 'deleted', to: null, reason: '부정 가능성 상황은 관리자 계정 수정·설명 불일치·발송 거부(③)로 대신했다.' },
        { from: 'pilot-02-006 f5(계획에 없던 해외 보관재고)', disposition: 'deleted', to: null, reason: '추가 감사절차의 필요성은 ③의 다른 특별약정에 대한 절차 범위 확대로 대신했다.' },
        { from: 'pilot-02-006 f6(과거의 정직한 설명을 들어 추가조사 없이 만족하자는 팀장 제안)', disposition: 'converted_to_incorrect_item', to: 'fact2 ②, sub1.c3', reason: '“더 조사하지 말고”라는 부정형을 없애고 과거 성실한 답변을 이유로 재무담당이사의 설명을 채택한 판단으로 바꾸었다.' },
        { from: 'pilot-02-006 sub1 crit1~crit3(전문가적 의구심의 정의, 기준서형 3점)', disposition: 'deleted', to: null, reason: '사례와 무관한 기준서형 물음이어서 사례 병합 대상이 아니다. 사용자 결정(2026-09-18)에 따라 별도로 보존하지 않고 원 세트와 함께 퇴역한다.' },
        { from: 'pilot-02-006 sub2 crit4·crit5(상반된 증거, 문서 신뢰성 의문)', disposition: 'absorbed', to: 'sub1.c3, sub1.c4', reason: '서로 다른 설명을 해소해야 한다는 ②의 보완절차와 회사 자료를 신뢰할 수 없다는 ④의 이유로 흡수했다.' },
        { from: 'pilot-02-006 sub2 crit6(부정의 존재가능성을 나타낼 수 있는 상황)', disposition: 'converted_to_trap', to: 'fact2 ③(옳음), sub1.c1', reason: '부정 확인 전에 위험평가를 높인 옳은 판단으로 식별 기준에서 평가한다.' },
        { from: 'pilot-02-006 sub2 crit7(추가적인 감사절차의 필요성)', disposition: 'converted_to_trap', to: 'fact2 ③(옳음), sub1.c1', reason: '다른 특별약정에 대한 감사절차의 범위 확대로 옮겼다.' },
        { from: 'pilot-02-006 sub3 crit8(팀장 제안이 부적절하다는 판단)', disposition: 'merged_into_identification', to: 'sub1.c1', reason: '②를 옳지 않다고 고르는 식별로 채점한다.' },
        { from: 'pilot-02-006 sub3 crit10·crit9(더 조사하여 절차 변경·추가 결정, 과거 신뢰로 의구심 필요성이 경감되지 않음)', disposition: 'retained_as_reason', to: 'sub1.c3', reason: '둘 중 하나만 써도 ②의 이유 또는 보완절차로 인정한다.' },
        { from: 'pilot-02-007 f1(한결회계법인, 독립 상황 갑·을, 법적 책임 제외)', disposition: 'deleted', to: null, reason: '같은 회사의 시간 순서 사례로 바꾸었다. 법적 책임 제외 문장은 판단에 쓰이지 않아 뺐다.' },
        { from: 'pilot-02-007 f2(해외 보관 자산의 현지 절차, 대체 절차 없음, 예산 초과·일정 촉박을 이유로 한 생략 제안)', disposition: 'rewritten', to: 'fact3 ⑦', reason: 'A53 요건을 사실로 주던 “대체적인 절차는 없으며 … 설득력이 낮다”를 없애고, 업무 종결 단계에서 제출기한·예산을 이유로 현재 증거로 충분하다고 본 판단으로 바꾸었다.' },
        { from: 'pilot-02-007 f3(발행 후 거래처·직원 공모와 조회 회신 조작 발견)', disposition: 'rewritten', to: 'fact4', reason: '같은 회사의 다른 거래처(나래상사) 사건으로 옮기고, 당시 적극적 조회를 수행해 받은 회신이 장부와 일치했다는 사실을 두었다.' },
        { from: 'pilot-02-007 f4(사후 발견만으로 미준수가 확정되었다는 주장, 정교한 조작이므로 검토가 불필요하다는 주장, 검토 미실시)', disposition: 'converted_to_items', to: 'fact4 ⑧(옳음), ⑨(옳지 않음)', reason: '미준수 주장은 사후 발견만으로 미준수로 볼 수 없다는 품질관리실의 옳은 판단(⑧)으로, 검토 불필요 주장은 조작의 정교함을 들어 준수로 결론 낸 업무수행이사의 판단(⑨)으로 바꾸었다. 결론을 암시하던 “검토는 아직 이루어지지 않았다”를 뺐다.' },
        { from: 'pilot-02-007 sub2 crit4(제안이 부적절하다는 판단)', disposition: 'merged_into_identification', to: 'sub2.c1', reason: '⑦을 옳지 않다고 고르는 식별로 채점한다.' },
        { from: 'pilot-02-007 sub2 crit5·crit10(시간·비용은 대체 절차 없는 절차 생략이나 설득력 낮은 증거 만족의 근거가 아님)', disposition: 'retained_as_reason', to: 'sub2.c3', reason: '⑦의 이유로 승계했다. ⑦은 현재 증거에 만족한 판단이므로 두 갈래 중 설득력 낮은 증거에 관한 부분이 직접 대응하며, 절차 생략 갈래는 같은 원칙의 서술로 인정한다.' },
        { from: 'pilot-02-007 sub3 crit6(사후 발견만으로 미준수 단정 불가, 정교한 조작만으로 적절성 확정 불가)', disposition: 'split', to: 'fact4 ⑧(옳음, sub2.c1), ⑨(sub2.c1·sub2.c4)', reason: '전단은 옳은 함정 ⑧, 후단은 옳지 않은 항목 ⑨로 나누었다.' },
        { from: 'pilot-02-007 sub3 crit7~crit9(수행한 절차, 증거의 충분성과 적합성, 감사보고서의 적합성)', disposition: 'retained_as_reason', to: 'sub2.c4', reason: '⑨의 이유 또는 보완절차 1점으로 통합했다. 세 측면 중 일부만 들어도 인정한다.' },
    ],
    points_change: { from: originals.reduce((n, s) => n + points(s), 0), to: points(set), reason: '원 세 세트는 9점·10점·7점이었다. pilot-02-006의 기준서형 물음 1(3점)은 사용자 결정으로 병합 없이 퇴역한다. 사례형 23점은 선택형 2물음 8점(식별 2점 + 옳지 않은 항목 6점)으로 통합했다. 원 criterion의 세부 명제(두 사정, 네 범주, 세 평가 측면, 판단 문구)는 식별 기준과 항목별 이유나 보완절차 1점으로 옮겼다.' },
});

const verdicts = (sub: string, rows: [string, string][]) => rows.map(([verdict, reason], i) => ({ criterion_id: `${sub}.c${i + 1}`, verdict, reason }));
const total = (rows: { verdict: string }[]) => rows.reduce((n, v) => n + (v.verdict === 'met' ? 1 : 0), 0);
const cases = [
    { id: 'r07-sub1-partial', subquestion_id: 'sub1', kind: 'partial',
        answer: '옳지 않은 것은 ①, ②, ③, ④이다.\n① 거부 사유를 질문하고 기록하는 데 그치지 말고, 가온상사의 요청 문서 등 거부 사유가 타당하고 합리적인지에 관한 감사증거를 구했어야 한다.\n③ 부정이 확인되지 않은 상태에서 부정위험 평가를 높이고 다른 약정까지 절차를 넓힌 것은 지나치다.\n④ 약정 원본은 가온상사만 보관하고 있어 외부에서만 확인할 수 있으므로 적극적 조회 회신이 필요하고, 출고증과 입금 내역으로는 반품·지급 조건을 확인할 수 없다.',
        expected_verdicts: verdicts('sub1', [['contradicted', '옳은 ③을 옳지 않다고 골랐다.'], ['met', '거부 사유의 타당성과 합리성에 관한 감사증거를 구해야 한다고 적었다.'], ['not_met', '②는 번호만 적고 이유나 보완절차를 쓰지 않았다.'], ['met', '외부에서만 확인 가능해 적극적 조회 회신이 필요하다는 이유를 적었다.']]),
        reason: '함정 ③을 고르고 ②의 이유를 빠뜨린 답에서 식별 점수와 ②의 점수만 잃고 ①·④의 이유는 유지되는지 확인하는 부분정답이다.' },
    { id: 'r07-sub1-wrong', subquestion_id: 'sub1', kind: 'wrong',
        answer: '옳지 않은 것은 ③, ⑤이다.\n③ 부정이 확인되기 전에 부정위험 평가를 높이는 것은 근거 없는 의심이다.\n⑤ 부정의 징후가 있으므로 일반 판매도 모든 거래를 확인했어야 한다.\n①, ②, ④는 옳다. 거래관계에 관한 경영진의 판단이면 증거 없이 받아들여도 되고, 과거에 성실하게 답해 온 재무담당이사의 설명은 그대로 채택할 수 있으며, 출고증과 입금 내역을 대조하면 약정 조건에 관한 충분한 증거가 된다.',
        expected_verdicts: verdicts('sub1', [['contradicted', '옳은 ③·⑤만 고르고 ①·②·④가 옳다고 명시했다.'], ['contradicted', '경영진의 판단이면 증거 없이 받아들여도 된다고 명시했다.'], ['contradicted', '과거에 성실했던 재무담당이사의 설명은 그대로 채택할 수 있다고 명시했다.'], ['contradicted', '출고증과 입금 내역으로 충분하다고 명시했다.']]),
        reason: '함정만 고르고 옳지 않은 항목을 옳다고 쓴 대표 오답이다.' },
    { id: 'r07-sub2-partial', subquestion_id: 'sub2', kind: 'partial',
        answer: '옳지 않은 것은 ⑦, ⑧, ⑨이다.\n⑦ 시간이나 비용의 문제 그 자체는 설득력이 낮은 감사증거에 만족할 정당한 근거가 되지 못한다.\n⑧ 감사보고서를 발행한 뒤 중요한 왜곡표시가 발견되었다면 당시 감사는 실패한 것이다.\n⑨ 감사기준을 따랐는지는 당시 수행한 감사절차와 입수한 감사증거의 충분성·적합성을 검토하여 판단해야 한다.',
        expected_verdicts: verdicts('sub2', [['contradicted', '옳지 않은 ⑥을 빠뜨리고 옳은 ⑧을 옳지 않다고 골랐다.'], ['not_met', '⑥(지배기구 커뮤니케이션)을 다루지 않았다.'], ['met', '시간·비용은 설득력 낮은 증거에 만족할 근거가 아니라는 이유를 적었다.'], ['met', '수행한 절차와 증거의 충분성·적합성을 검토해 판단해야 한다고 적었다.']]),
        reason: '옳지 않은 ⑥을 빠뜨리고 함정 ⑧을 고른 답에서 ⑦·⑨의 이유는 유지되는지 확인하는 부분정답이다.' },
    { id: 'r07-sub2-wrong', subquestion_id: 'sub2', kind: 'wrong',
        answer: '옳지 않은 것은 ⑧이다. 감사보고서를 발행한 뒤 중요한 왜곡표시가 발견되었으므로 당시 감사는 감사기준을 따르지 않은 것이다.\n⑥, ⑦, ⑨는 옳다. 경영진에게 서면으로 알리면 충분하고, 제출기한이나 예산 때문이라면 지금까지의 증거로 감사를 종결해도 되며, 공모와 조작이 정교했다면 감사가 감사기준에 따라 수행된 것으로 볼 수 있다.',
        expected_verdicts: verdicts('sub2', [['contradicted', '옳은 ⑧만 고르고 ⑥·⑦·⑨가 옳다고 명시했다.'], ['contradicted', '경영진에게 서면으로 알리면 충분하다고 명시했다.'], ['contradicted', '제출기한이나 예산 때문이면 지금까지의 증거로 종결해도 된다고 명시했다.'], ['contradicted', '조작이 정교했다면 감사기준에 따라 수행된 것으로 볼 수 있다고 명시했다.']]),
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
        { id: 'r07-supp-brief', purpose: '옳지 않은 항목에 이유만(② 과거 신뢰, ④ 적극적 조회 필요, ⑨ 고유한계) 또는 보완절차만(①·⑥·⑦) 짧게 쓴 답이 항목별 1점을 받는지 확인한다. ⑦은 705에 따른 시사점 결정만, ⑨는 고유한계가 설득력 부족한 증거를 정당화하지 않는다는 이유만 들었다.',
            answers: {
                sub1: '①, ②, ④\n① 거부 사유의 타당성과 합리성에 관한 증거를 구했어야 한다.\n② 과거에 정직했던 경영진이라도 전문가적 의구심을 유지할 필요성이 줄어드는 것은 아니다.\n④ 적극적 조회 회신이 필요한 상황이라 대체적 절차로는 필요한 증거를 얻을 수 없다.',
                sub2: '⑥, ⑦, ⑨\n⑥ 지배기구와 커뮤니케이션했어야 한다.\n⑦ 회신을 입수하지 못했으므로 감사의견에 미치는 영향(의견변형 필요성)을 결정했어야 한다.\n⑨ 감사의 고유한계가 설득력이 부족한 감사증거에 만족하는 것을 정당화하지는 않는다.',
            },
            expected: {
                sub1: supp('sub1', [['met', '①·②·④만 골랐다.'], ['met', '거부 사유의 타당성·합리성에 관한 증거를 구하는 절차를 적었다.'], ['met', '과거 신뢰로 전문가적 의구심 필요성이 줄지 않는다는 이유를 적었다.'], ['met', '적극적 조회 회신이 필요해 대체적 절차로는 증거를 얻을 수 없다는 이유를 적었다.']]),
                sub2: supp('sub2', [['met', '⑥·⑦·⑨만 골랐다.'], ['met', '지배기구와 커뮤니케이션하는 절차를 적었다.'], ['met', '감사의견에 대한 시사점(의견변형 필요성)을 결정하는 절차를 적었다.'], ['met', '고유한계가 설득력 부족한 증거를 정당화하지 않는다는 이유를 적었다.']]),
            } },
        { id: 'r07-supp-content-identification', purpose: '번호 없이 내용으로 옳지 않은 항목을 특정하고, 여러 항목의 이유와 보완절차를 한 문장에 함께 쓴 답이 식별 점수와 각 항목 점수를 받는지 확인한다.',
            answers: {
                sub1: '재무담당이사의 거부 사유를 질문하고 기록만 한 뒤 받아들인 것, 과거의 성실한 답변을 이유로 재무담당이사의 설명을 채택한 것, 출고증과 입금 내역의 대조 결과로 약정 조건의 결론을 내리기로 한 것이 옳지 않다. 거부 사유는 그 타당성과 합리성에 관한 증거로 확인해야 하고, 과거의 신뢰가 있어도 서로 다른 설명은 추가 증거로 해소해야 하며, 약정 조건은 가온상사만 가진 원본으로만 확인할 수 있어 적극적 조회 회신이 필요하다.',
                sub2: '대표이사와 재무담당이사에게만 서면으로 알린 조치, 기한과 예산을 이유로 지금까지의 증거로 충분하다고 보고 감사를 종결한 판단, 조작이 정교했으므로 감사가 감사기준을 따랐다고 본 결론이 옳지 않다. 지배기구와 커뮤니케이션해야 하고, 시간과 비용은 설득력이 낮은 증거에 만족할 근거가 아니며, 당시 수행한 절차와 입수한 증거의 충분성·적합성을 검토해 판단해야 한다.',
            },
            expected: {
                sub1: supp('sub1', [['met', '내용으로 ①·②·④만 특정했다.'], ['met', '거부 사유의 타당성·합리성에 관한 증거 확인을 적었다.'], ['met', '과거 신뢰가 있어도 서로 다른 설명을 추가 증거로 해소해야 한다고 적었다.'], ['met', '원본이 외부에만 있어 적극적 조회 회신이 필요하다고 적었다.']]),
                sub2: supp('sub2', [['met', '내용으로 ⑥·⑦·⑨만 특정했다.'], ['met', '지배기구와 커뮤니케이션해야 한다고 적었다.'], ['met', '시간과 비용은 설득력 낮은 증거에 만족할 근거가 아니라고 적었다.'], ['met', '수행한 절차와 증거의 충분성·적합성을 검토해 판단해야 한다고 적었다.']]),
            } },
        { id: 'r07-supp-restated-conclusion', purpose: '옳지 않은 항목을 모두 고르되 각 항목에 옳지 않다는 결론만 되풀이하고 원칙·보완절차를 쓰지 않은 답이 식별 점수만 받는지 확인한다(조건 경계).',
            answers: {
                sub1: '옳지 않은 것은 ①, ②, ④이다.\n① 재무담당이사가 말한 거부 사유를 그대로 받아들인 것은 잘못이다.\n② 두 사람의 설명 가운데 재무담당이사의 설명을 채택한 것은 잘못이다.\n④ 출고증과 입금 내역을 대조한 결과로 결론을 내리기로 한 것은 잘못이다.',
                sub2: '옳지 않은 것은 ⑥, ⑦, ⑨이다.\n⑥ 대표이사와 재무담당이사에게 알린 조치는 적절하지 않다.\n⑦ 지금까지의 증거로 감사를 종결하기로 한 판단은 적절하지 않다.\n⑨ 당시 감사가 감사기준에 따라 수행되었다고 결론 내린 것은 적절하지 않다.',
            },
            expected: {
                sub1: supp('sub1', [['met', '①·②·④만 골랐다.'], ['not_met', '거부 사유의 타당성·합리성에 관한 증거를 구해야 한다는 이유나 절차가 없다.'], ['not_met', '과거 신뢰에 관한 원칙이나 설명을 해소하는 절차가 없다.'], ['not_met', '적극적 조회 회신이 필요한 이유나 절차가 없다.']]),
                sub2: supp('sub2', [['met', '⑥·⑦·⑨만 골랐다.'], ['not_met', '지배기구와 커뮤니케이션해야 한다는 내용이 없다.'], ['not_met', '시간·비용에 관한 원칙이나 감사의견 시사점 결정이 없다.'], ['not_met', '감사수행 평가의 기준이나 검토 절차가 없다.']]),
            } },
    ],
});
console.log({ target, originals: originals.map((s) => [s.id, points(s)]), points: points(set), cases: cases.map((c) => [c.id, c.expected_points]) });
