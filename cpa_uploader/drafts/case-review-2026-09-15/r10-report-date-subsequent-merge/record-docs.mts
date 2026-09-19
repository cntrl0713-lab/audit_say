// r10 설계 장부·계보·대표 답안 기록(한 번만 실행; 기존 파일이 있으면 쓰지 않는다).
//   npx tsx cpa_uploader/drafts/case-review-2026-09-15/r10-report-date-subsequent-merge/record-docs.mts
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewedContentHash } from '../../../questionReviewIdentity.ts';
import { computeSubquestionMaxPoints } from '../../../../lib/questionV3.ts';
import type { QuestionSetV3 } from '../../../../lib/questionV3.ts';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r10-report-date-subsequent-merge';
const BANK = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const EXAM = 'cpa_uploader/data/회계감사_통합학습자료/04_기출문제/기출문제_연도별_해설_A.md';
const MOCK = 'cpa_uploader/data/회계감사_통합학습자료/03_문제연습/고급_회계감사_연습.md';
const ELEMENTS = 'cpa_uploader/analysis/question-elements/question-elements.json';
const EDITIONS = ['cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025-pymupdf-pages.txt', 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt'];
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (name: string, value: unknown) => fs.writeFileSync(`${D}/${name}`, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const [set] = read(`${D}/sets.json`) as QuestionSetV3[];
const bank = read(BANK) as QuestionSetV3[];
const originals = ['pilot-15-007', 'case-12-restricted-revision-dual-date-20260914', 'case-12-post-report-refusal-20260914'].map((id) => bank.find((s) => s.id === id)!);
const points = (s: QuestionSetV3) => s.subquestions.reduce((n, q) => n + computeSubquestionMaxPoints(q), 0);
const target = reviewedContentHash(set);
for (const file of [MOCK, ELEMENTS]) if (!fs.existsSync(file)) throw new Error('missing ' + file);

write('design.json', {
    version: 1,
    set_id: set.id,
    route: '사례형 병합 재구성(검토 스킬) + 새 사실관계·발문 제작(제작 스킬)',
    format: '세 물음 모두 옳고 그름을 구분하는 선택형이다(번호를 붙인 절차·판단 중 옳지 않은 것을 모두 찾아 번호와 이유 또는 보완절차를 간략히 쓴다). 사용자가 형식을 따로 지정하지 않아 학습 단위 계약의 기본 형식을 적용했다. 세 원 세트의 시점(감사보고서 작성, 보고서 제출 후 수정 거부, 제한된 수정과 보고서)을 물음 하나씩으로 두었다.',
    user_requests: [
        '36번(pilot-15-007)·67번(case-12-restricted-revision-dual-date-20260914)·48번(case-12-post-report-refusal-20260914)을 합쳐서 종합문제로 구성한다. 문제 제작 및 검토 스킬을 활용한다(2026-09-19).',
        '공통 기준(2026-09-15): 암시 제거, 옳고 그름을 구분하는 형식, 이유나 보완절차는 간략히, 연도는 20X1·20X2(대상 연도 2027년), 운영 반영은 지정 검토를 모아 한 번에 한다.',
        '원 세 세트의 물음 8개는 모두 사례형이어서 따로 보존할 기준서형 물음이 없다. 병합본으로 대체하는 것을 전제로 작성했고, 원 세트의 퇴역과 운영 반영은 지정 검토를 모아 한 번에 할 때 사용자 승인에 따라 진행한다.',
    ],
    items: [
        { no: '①', fact_id: 'fact2', verdict: '옳지 않음', kind: '판단', basis: 'KGA 700 문단 49(b)·A67: 감사보고서일의 기초가 되는 감사증거에는 인정된 권한을 가진 기구가 재무제표에 대하여 책임을 진다고 주장하였다는 증거가 포함되며, 그 증거가 입수되기 전까지 감사인은 충분하고 적합한 감사증거가 입수되었는지 결론을 내릴 위치에 있지 않다. 이사회의 재무제표 승인 일정과 관계없이 금액·공시에 대한 절차 완료일로 감사보고서일을 정할 수 있다는 판단은 이 요건에 어긋난다.', origin: 'pilot-15-007 sub1 crit2~crit4(감사보고서일의 증거 조건: 충분하고 적합한 증거, 모든 단위재무제표와 공시의 작성, 인정된 권한을 가진 기구의 책임 주장)' },
        { no: '②', fact_id: 'fact2', verdict: '옳음(함정)', kind: '판단', basis: 'KGA 700 문단 49·A69: 감사보고서일은 충분하고 적합한 증거(모든 단위재무제표와 공시의 작성, 인정된 권한을 가진 기구의 책임 주장 포함)를 입수한 날보다 빠르지 않아야 하며, 주주의 최종승인이 요구되는 국가에서도 그 결론에 주주의 최종승인은 필요하지 않다. 주석 포함 작성 3월 8일, 이사회 승인 3월 10일, 필요한 절차 완료 3월 12일이므로 3월 12일은 가장 빠른 감사보고서일이다. 함정 요소: 정기주주총회의 최종 승인 전이어서 이른 것처럼 보인다.', origin: 'pilot-15-007 f2·sub1 crit1(가장 빠른 감사보고서일 3월 12일)' },
        { no: '③', fact_id: 'fact2', verdict: '옳음(함정)', kind: '판단', basis: 'KGA 700 문단 46·A63: 이름 공시 생략의 예외는 개인의 안전에 대한 유의적 위협이 합리적으로 예상되는 드문 상황이며, 그러한 위협에는 법적 책임 또는 법규 및 전문가적 제재의 위협이 포함되지 않는다. 손해배상 소송과 감독기관 징계 요구는 이에 해당한다. 함정 요소: 업무수행이사 개인에 대한 위협이어서 생략 사유가 될 것처럼 보인다.', origin: 'pilot-15-007 f3 갑·sub2 crit1(손해배상·제재 위협만으로는 생략 불가)' },
        { no: '④', fact_id: 'fact2', verdict: '옳지 않음', kind: '조치', basis: 'KGA 700 문단 46: 이름을 포함하지 않으려 하는 드문 상황일 경우 감사인은 개인의 안전에 대한 유의적 위협의 발생가능성과 심각성에 대한 평가를 알리기 위해 이름을 기재하지 않으려는 의도를 지배기구와 논의하여야 한다. 업무수행이사는 평가를 마쳤으나 이름을 기재하지 않은 감사보고서를 제출한 뒤에 감사위원회에 사실과 평가 결과를 알렸다. 사후 통지는 의도의 논의가 아니다.', origin: 'pilot-15-007 f3 을·sub2 crit2·crit3·crit5(평가 후 생략, 의도의 지배기구 논의, 발생가능성·심각성 평가의 전달)' },
        { no: '⑤', fact_id: 'fact3', verdict: '옳음(함정)', kind: '판단', basis: 'KGA 560 문단 13(a)·(b): 의견을 변형한 후 감사보고서를 제출하는 대응은 아직 감사보고서를 기업에 제출하지 않은 경우이고, 이미 제출한 경우에는 필요한 수정 전 제3자 발행을 하지 말라고 통보하고 그럼에도 발행되면 감사보고서에 대한 의존을 막는 조치를 취한다. 감사보고서는 3월 17일 이미 제출되었다. 함정 요소: 경영진의 수정 거부이므로 의견을 변형해야 할 것처럼 보인다.', origin: 'case-12-post-report-refusal-20260914 fact3 가·sub2 c1·c2(보고서 제출 전 수정 거부 시 한정의견)의 대비 항목' },
        { no: '⑥', fact_id: 'fact3', verdict: '옳지 않음', kind: '조치', basis: 'KGA 560 문단 13(b): 이미 감사보고서를 제출한 경우 필요한 수정 전에는 재무제표를 제3자에게 발행하지 말라는 통보는 지배기구의 모든 구성원이 경영에 참여하는 경우가 아니라면 지배기구를 포함하여 한다. 미르전자의 감사위원회는 경영에 참여하지 않는 사외이사로만 구성되어 있으므로 대표이사와 재무담당이사에 대한 통보로 충분하지 않다.', origin: 'case-12-post-report-refusal-20260914 sub3 c1·c2(경영진에 대한 발행 금지 통보, 지배기구 포함)' },
        { no: '⑦', fact_id: 'fact3', verdict: '옳지 않음', kind: '판단', basis: 'KGA 560 문단 13(b) 후단: 통보에도 불구하고 필요한 수정 없이 재무제표가 발행된 경우 감사인은 해당 감사보고서에 대한 의존을 못하게 하기 위한 적합한 조치를 취하여야 한다. 경영진의 책임이라는 이유로 감사인의 조치가 면제되지 않는다.', origin: 'case-12-post-report-refusal-20260914 sub3 c3(의존 방지 조치)' },
        { no: '⑧', fact_id: 'fact4', verdict: '옳음(함정)', kind: '절차', basis: 'KGA 560 문단 11(b)(i)·12: 경영진이 후속사건의 영향에 대해서만 재무제표를 수정하고 승인권자가 이에 대해서만 승인하는 것이 법규나 재무보고체계에서 금지되지 않는다면 문단 11(b)(i)의 후속사건 감사절차를 해당 수정사항에만 한정하는 것이 허용된다. 사실관계에서 법규·재무보고체계가 이를 금지하지 않고 실제 수정과 이사회 승인도 소송충당부채와 주석 12로 한정되었다. 함정 요소: 재무제표를 수정했으니 모든 후속사건 절차를 새 보고서일까지 연장해야 할 것처럼 보인다.', origin: 'case-12-restricted-revision-dual-date-20260914 fact2·sub1 c1·c2(제한 예외의 허용과 조건)' },
        { no: '⑨', fact_id: 'fact4', verdict: '옳지 않음', kind: '절차', basis: 'KGA 560 문단 12(a)·A13: 수정사항에 한정된 추가 일자를 포함하도록 감사보고서를 수정하는 경우 수정 전 재무제표에 대한 감사보고서일은 변경 없이 남으며, 최초 일자는 해당 재무제표에 대한 감사업무의 종료 시점을 알려 준다. 절차를 주석 12에 한정했는데 보고서 전체의 일자를 3월 27일로 바꾸면 그날까지 모든 후속사건에 대한 절차를 수행한 것처럼 보인다(모든 절차를 연장하려면 문단 11(b)(i)이 적용됨).', origin: 'case-12-restricted-revision-dual-date-20260914 fact3·sub2 c1(최초 일자 유지와 그 의미)' },
        { no: '⑩', fact_id: 'fact4', verdict: '옳지 않음', kind: '판단', basis: 'KGA 560 문단 A13: 추가 일자는 주석에 기술된 수정사항에 한정하여 수행된 감사절차의 종료일이다. KGA 700 문단 49: 감사보고서의 일자는 충분하고 적합한 증거를 입수한 날보다 빠를 수 없다. 이사회의 수정 승인일(3월 25일)은 수정사항에 대한 감사절차 종료일(3월 27일)보다 빠르다.', origin: 'case-12-restricted-revision-dual-date-20260914 sub2 c2(추가 일자는 승인일이나 발행 예정일이 아닌 절차 종료일)' },
        { no: '⑪', fact_id: 'fact4', verdict: '옳음(함정)', kind: '조치', basis: 'KGA 560 문단 12(b): 이중 보고서일 대신 후속사건에 대한 감사절차가 재무제표의 관련 주석에 기술된 수정에만 한정하여 수행되었다는 설명을 강조사항문단 또는 기타사항문단에 포함하는 새로운 감사보고서 또는 수정된 감사보고서를 제출할 수 있다. 함정 요소: 절차를 한정했으면 반드시 이중 보고서일을 써야 하거나 강조사항문단만 허용되는 것처럼 보인다.', origin: 'case-12-restricted-revision-dual-date-20260914 fact3·sub3 c1·c2(이중일자 대신 쓰는 보고서 형태와 설명 문단)' },
    ],
    questions: [
        { subquestion_id: 'sub1', question_style: 'case', type: 'judgment', topic_ids: ['15'], case_fact_ids: ['fact1', 'fact2'],
            topic_reason: '15: 감사보고서일의 결정(KGA 700 문단 49·A67·A69)과 업무수행이사 이름 공시의 예외 및 지배기구와의 논의(문단 46·A63)를 사례의 일정과 위협 정보에 적용한다.',
            criteria: [
                { id: 'sub1.c1', points: 1, meaning: '식별: ①·④를 고르고 ②·③은 고르지 않음' },
                { id: 'sub1.c2', points: 1, meaning: '①: 이사회(인정된 권한을 가진 기구)의 책임 확인 증거를 포함한 증거 입수일보다 빠를 수 없음, 또는 이사회 승인일 이후로 정함(이유 또는 절차)' },
                { id: 'sub1.c3', points: 1, meaning: '④: 이름을 기재하지 않으려는 의도를 보고서 제출 전에 지배기구와 논의해 위협 평가를 알려야 함(이유 또는 절차)' },
            ],
            minimum_sufficient_answer: '①·④를 고르고 각각 한 문장씩 이유나 보완절차를 쓴다.',
            point_decision: '3점. 식별 1점 + 옳지 않은 항목 두 개(①·④)에 각 1점. 원 pilot-15-007 sub1(4점: 가장 빠른 날짜, 증거·작성·책임 주장의 세 조건)은 옳은 함정 ②(식별 기준)와 ①의 1점(세 조건 중 이사회 책임 확인을 중심으로 한 이유 또는 이사회 승인 이후라는 절차)으로, sub2(4점: 갑 생략 불가, 을 평가 후 생략, 의도의 논의, 평가의 전달)는 옳은 함정 ③(식별 기준)과 ④의 1점(의도의 사전 논의 또는 평가의 전달)으로 통합했다. 날짜 계산의 반복, 세 조건의 완전한 나열, 위협 평가의 세부 방법은 요구하지 않는다.' },
        { subquestion_id: 'sub2', question_style: 'case', type: 'judgment', topic_ids: ['12'], case_fact_ids: ['fact1', 'fact3'],
            topic_reason: '12: 감사보고서일 후 재무제표 발행일 전에 알게 된 사실에 대하여 경영진이 수정을 거부한 경우 이미 감사보고서를 제출한 감사인의 대응(KGA 560 문단 13)을 사례의 제출 시점과 지배기구 구성에 적용한다.',
            criteria: [
                { id: 'sub2.c1', points: 1, meaning: '식별: ⑥·⑦을 고르고 ⑤는 고르지 않음' },
                { id: 'sub2.c2', points: 1, meaning: '⑥: 발행 금지 통보를 경영진뿐 아니라 경영에 참여하지 않는 감사위원회(지배기구)에도 해야 함(이유 또는 절차)' },
                { id: 'sub2.c3', points: 1, meaning: '⑦: 수정 없이 발행되면 감사보고서에 대한 의존을 막는 적합한 조치를 취해야 함(이유 또는 절차)' },
            ],
            minimum_sufficient_answer: '⑥·⑦을 고르고 각각 한 문장씩 이유나 보완절차를 쓴다.',
            point_decision: '3점. 식별 1점 + 옳지 않은 항목 두 개(⑥·⑦)에 각 1점. 원 case-12-post-report-refusal-20260914 sub3(3점: 경영진 통보, 지배기구 포함, 의존 방지 조치)은 ⑥·⑦의 각 1점과 식별로 통합했다. sub2(2점: 제출 전 수정 거부 시 한정의견과 그 근거)는 독립된 대조 상황 가를 없애면서 옳은 함정 ⑤(제출 후에는 의견 변형 보고서 대신 발행을 막는 조치)의 식별 기준으로 바꾸었다. sub1(4점: 시기 식별, 토의·결정·질문)은 자료 3의 배경 사실로 옮겼다. 구체적 의존 방지 수단의 나열은 요구하지 않는다.' },
        { subquestion_id: 'sub3', question_style: 'case', type: 'judgment', topic_ids: ['12'], case_fact_ids: ['fact1', 'fact3', 'fact4'],
            topic_reason: '12: 수정사항에 한정한 후속사건 감사절차의 허용 조건과 이중 보고서일·설명 문단을 사용한 감사보고서 수정(KGA 560 문단 11·12·A13)을 사례의 수정·승인 범위와 날짜에 적용한다.',
            criteria: [
                { id: 'sub3.c1', points: 1, meaning: '식별: ⑨·⑩을 고르고 ⑧·⑪은 고르지 않음' },
                { id: 'sub3.c2', points: 1, meaning: '⑨: 최초 감사보고서일 3월 12일을 유지하고 주석 12에만 추가 일자(또는 설명 문단), 전체 일자 변경 불가(이유 또는 절차)' },
                { id: 'sub3.c3', points: 1, meaning: '⑩: 추가 일자는 한정된 감사절차의 종료일 3월 27일이며 증거 입수일보다 빠를 수 없음(이유 또는 절차)' },
            ],
            minimum_sufficient_answer: '⑨·⑩을 고르고 각각 한 문장씩 이유나 보완절차를 쓴다.',
            point_decision: '3점. 식별 1점 + 옳지 않은 항목 두 개(⑨·⑩)에 각 1점. 원 case-12-restricted-revision-dual-date-20260914 sub1(2점: 제한 허용 판단과 근거)은 옳은 함정 ⑧(식별 기준)로, sub2(2점: 최초 일자 유지와 의미, 추가 일자와 의미)는 ⑨·⑩의 각 1점으로, sub3(2점: 새로운/수정된 보고서와 강조·기타사항문단, 주석에 맞춘 설명)은 옳은 함정 ⑪(식별 기준)로 통합했다. 날짜 문구·괄호 형식의 재현은 요구하지 않는다.' },
    ],
    spoiler_review: [
        'pilot-15-007: 사실의 “아래 두 물음의 상황은 독립적이다”, 갑·을의 독립 상황 구분, 을의 “감사인은 아직 위협의 발생가능성과 심각성을 평가하지 않았다”(요구 절차를 가리키는 미결 사실), 발문의 “증거 관련 조건 세 가지를 설명하시오”, “예외의 요건과 생략하려는 경우 지배기구와 논의할 사항을 설명하시오”, “구체적 위협정보가 입수되었다는 사실만으로 평가가 끝났다고 가정하지 마시오”(답안 구성 요소와 결론 방향)를 없앴다. 두 위협 정보는 한 회사의 서로 다른 서한으로 옮겨 ③(옳음)·④(옳지 않음)로 판단하게 했다.',
        'case-12-restricted-revision-dual-date-20260914: 제목의 “제한된 주석 수정과 이중 보고서일의 적용”(정답 방법), 사실의 “이 사실을 최초 보고서일에 알았더라면 감사보고서의 수정 여부에 영향을 미칠 수 있었다”(기준서 요건 문구), “해당 날짜 옆에 특정 주석을 구분하는 표시는 없다”(오류 지적), “회사의 요청 때문에 그 범위가 바뀌지는 않는다”, 발문의 “초안을 고치시오”, “유지해야 할 최초 일자와 … 추가 일자를 실제 날짜로 제시하고”(정답 구조), “어떤 보고서와 설명 문단을 사용하여야 하는지”를 없앴다. 담보제공 공시 누락은 48번의 소송 합의 수정으로 바꾸어 한 사건의 흐름으로 합쳤다.',
        'case-12-post-report-refusal-20260914: 제목의 “수정거부 대응”, 사실의 “다음 상황 가와 나는 서로 독립된 후속 상황이다”, “감사인은 필요한 수정 전에는 발행하지 말라는 통보를 아직 하지 않았다”(요구 조치를 가리키는 미결 사실), 발문의 “어느 시기에 해당하는지 식별하고 … 초기 대응을”, “증거의 입수 여부와 … 중요성·전반성을 연결하여”, “누구에게 무엇을 통보해야 하는지 … 추가 조치가 달성해야 할 목적”(답안 구성 요소)을 없앴다. 대조 상황 가(제출 전)·나(제출 후)는 병렬로 묻지 않고 제출 후 상황만 남겨 ⑤에서 대비시켰다.',
        '근거 문구가 정답 표지가 되지 않도록 옳은 항목(② “최종 승인되기 전인”, ③ “서한에서 예고한”, ⑤ “이미 제출하였으므로”, ⑪ “원하지 않자”)과 옳지 않은 항목(① “관계가 없다고”, ④ “검토하여 … 평가하고”, ⑦ “경영진이 책임질 일이므로”)에 서로 다른 형태로 두고, 근거 문구가 없는 ⑥·⑧·⑨·⑩을 섞었다. “그러나”, “다만” 같은 연결어는 쓰지 않았고 빠뜨린 절차를 부정형으로 적지 않았다(④는 사후에 알린 행위를 적었다).',
        '앞 단계 항목의 정답이 뒤 단계 사실로 드러나지 않게 했다. 자료 3은 보고서 제출·합의서 입수·수정 거부만 적고 ①~④의 결과를 다루지 않는다. 자료 4의 수정 결정은 법률고문과의 협의에 따른 것이며 ⑥·⑦의 통보 범위나 판단의 적정성을 드러내지 않는다. ⑨(보고서 전체 일자 변경)와 ⑩(추가 일자를 승인일로)은 같은 문단에서 서로 다른 잘못을 가르는 항목이지만 따로 묻지 않고 한 목록 안에 두었다.',
        '연도는 20X1·20X2로 썼다(대상 연도 2027년). 옳지 않은 항목 수(물음별 2개)는 발문에 밝히지 않는다. 금액은 계산을 요구하지 않으므로 두지 않았다. 사실관계는 2,175자로 원 세 세트(3·3·3개 사실)를 한 회사의 시간 순서로 합쳤다.',
    ],
    nonduplication: [
        '기준서형 draft-12-560-freq01 q1(문단 12의 두 조건)·q2(문단 12의 두 보고 방법과 최초 일자·추가 일자), std-points-20260914-4e39b686bc62(문단 10·11의 대응 절차와 새 보고서일의 제한), pilot-15-001(감사보고서 구성)은 기준서 내용을 재현하는 물음이다. 이 사례는 같은 문단을 사례 절차·판단의 옳고 그름에 적용한다. KGA 700 문단 46·49와 KGA 560 문단 13을 인용하는 다른 사례형 물음은 원 세 세트 밖에 없다.',
        '같은 날 다른 세션의 r08(case-16-kam-emphasis-20260919, KGA 701·706)·r09(case-16-comparative-restatement-20260919, KGA 700 문단 16·705·706·710) 초안과 인용 문단이 겹치지 않는다.',
        '2025 제60회 2차 문제 4 물음 3(보고서 제출 전 알게 된 사실의 책임 성격·세 절차·두 보고 방법), 2016 제51회 2차 문제 9 물음 1·2(책임을 최소화하는 보고서일 기재, 수정 거부 시 한정의견), 2019 제54회 2차 문제 6 물음 6(업무수행이사 이름 비공시 상황과 추가 조치), 2020 제55회 2차 문제 3 물음 5(감사보고서일·재무제표 승인일·발행일의 개념), 2021 제56회 2차 문제 5 물음 4·2023 제58회 2차 문제 10 물음 2(이중 보고서일), 고급회계감사연습 2025 모의 GS1-8 물음 4(보고서 제출 후 수정 거부 시 의존 방지 통보)의 쟁점과 형식을 참고했다. 분석의 요소 subsequent.restricted-date-extension은 기출 4회(2016·2019·2021·2025)로 집계되어 있다.',
    ],
    references_consulted: [
        { file: EXAM, lines: 'L1135-L1156 (2025 제60회 문제 4 물음 3), L19949-L19961·L20030-L20050 (2016 제51회 문제 9 물음 1·2와 답안), L13916-L13920·L14115-L14140 (2019 제54회 문제 6 물음 6과 답안), L10875-L10876 (2020 제55회 문제 3 물음 5), L9552-L9570 (2021 제56회 문제 5 물음 4), L6401-L6402·L6505-L6515 (2023 제58회 문제 10 물음 2와 답안)', sha256: sha(EXAM) },
        { file: MOCK, lines: 'L7478-L7497 (2025 모의 GS1-8 물음 4 문항, 항목 ④), L14280-L14296 (같은 물음의 항목 표)', sha256: sha(MOCK) },
        { file: ELEMENTS, lines: 'subsequent.restricted-date-extension, element-779e55ea9f02ee69, element-7617f881ed554040, element-1afe072a06763767, element-e6ab6340bd4f02bd, element-b2f3c0a90ae3028a, element-aee66c4410919864의 원출제 연결', sha256: sha(ELEMENTS) },
        ...EDITIONS.map((file) => ({ file, lines: 'KGA 700 문단 46·49·A61~A63·A66~A69, KGA 560 문단 5·6·10~13·A2·A3·A12·A13·A16·A17의 2025·2026 전문 대조', sha256: sha(file) })),
    ],
    edition: '2025 개정 전문을 대상 연도 2027년 기준으로 적용했다(사례의 20X1년을 2026-01-01 개시 보고기간으로 보며, 감사기준서 560은 2026년 1월 1일 이후 개시 보고기간부터 시행). 2026 전문(2026년 7월 개정)과 대조한 결과 KGA 700 문단 46·49·A61~A63·A66~A69와 KGA 560 문단 5·6·10~13·A2·A3·A12·A13·A16·A17의 본문이 같다(560의 차이는 쪽 머리말뿐). KGA 560 문단 A2·A3·A16·A17은 등록 발췌본에 없어 인용하지 않고 판단 확인에만 사용했다. 사실관계의 “업무품질관리검토”는 2025 전문 감사기준서 220의 용어이며 판단 대상이 아니다.',
    target_reviewed_content_sha256: target,
});

write('lineage.json', {
    version: 1,
    artifact_type: 'case_merge_lineage',
    created_at: '2026-09-19',
    user_instruction: 'docs/case-question-edit-notes-2026-09-14.md 항목 36·67·48(2026-09-19 대화: 세 문제를 합쳐서 종합문제로 구성한다. 문제 제작 및 검토 스킬을 활용한다)',
    source_bank: { file: BANK, sha256: sha(BANK) },
    sources: originals.map((s) => ({ set_id: s.id, title: s.title, status: s.status, reviewed_content_sha256: reviewedContentHash(s), points: points(s) })),
    target: { set_id: set.id, reviewed_content_sha256: target, points: points(set) },
    mapping: [
        { from: 'pilot-15-007 f1(다온회계법인·상장기업 세운기계, 개정 품질관리체계 미적용, 두 물음의 독립 상황)', disposition: 'rewritten', to: 'fact1', reason: '회사명을 이음회계법인·미르전자로 바꾸고 상장기업의 일반목적 전체재무제표 감사라는 전제를 유지했다. 독립 상황 안내는 한 회사의 시간 순서로 바꾸면서 없앴다.' },
        { from: 'pilot-15-007 f2(주석 포함 작성 3월 8일, 인정된 권한을 가진 기구의 책임 인정 3월 10일, 증거 입수 3월 12일, 보고서 전달 3월 17일, 최종 감사파일 취합)', disposition: 'rewritten', to: 'fact1, fact3', reason: '날짜는 유지하고 책임 인정은 이사회의 재무제표 승인으로 적었다. 주주총회의 최종 승인일을 더해 ②의 함정으로 썼다. 쓰이지 않는 최종 감사파일 취합 문장은 뺐다.' },
        { from: 'pilot-15-007 f3(추가 법규 요건 없음, 갑: 손해배상·제재 요구 위협, 을: 신체적 피해 정보와 평가 미실시)', disposition: 'rewritten', to: 'fact1, fact2', reason: '추가 법규 요건이 없다는 배제 사실은 자료 1에, 두 위협은 같은 회사의 주주 서한과 익명 편지로 자료 2에 두었다. 요구 절차를 가리키던 “아직 평가하지 않았다”를 없앴다.' },
        { from: 'pilot-15-007 sub1 crit1(가장 빠른 감사보고서일 3월 12일)', disposition: 'converted_to_trap', to: 'fact2 ②(옳음), sub1.c1', reason: '주주총회 최종 승인 전인 3월 12일을 감사보고서일로 정한 옳은 판단으로 바꾸어 식별 기준으로만 평가한다.' },
        { from: 'pilot-15-007 sub1 crit2~crit4(충분하고 적합한 증거, 모든 단위재무제표와 공시의 작성, 인정된 권한을 가진 기구의 책임 주장)', disposition: 'converted_to_incorrect_item', to: 'fact2 ①, sub1.c2', reason: '이사회 승인 일정과 관계없이 금액·공시에 대한 절차 완료일로 보고서일을 정할 수 있다는 감사팀의 판단으로 바꾸어 이유 또는 절차 1점으로 채점한다. 세 조건의 나열은 요구하지 않는다.' },
        { from: 'pilot-15-007 sub2 crit1(갑의 법적·제재 위협만으로 생략 불가)', disposition: 'converted_to_trap', to: 'fact2 ③(옳음), sub1.c1', reason: '손해배상 소송과 징계 요구는 생략 사유가 아니라고 본 옳은 판단으로 식별 기준에서 평가한다.' },
        { from: 'pilot-15-007 sub2 crit2(을: 유의적 위협이 합리적으로 예상되는지 평가한 뒤 생략)', disposition: 'absorbed', to: 'fact2 ④', reason: '업무수행이사가 평가를 마친 사실로 ④에 넣어 평가 자체가 아니라 지배기구와의 논의가 쟁점이 되게 했다.' },
        { from: 'pilot-15-007 sub2 crit3·crit5(이름을 기재하지 않으려는 의도의 지배기구 논의, 발생가능성·심각성 평가의 전달)', disposition: 'converted_to_incorrect_item', to: 'fact2 ④, sub1.c3', reason: '보고서 제출 뒤 감사위원회에 사실과 평가 결과를 알린 조치로 바꾸었다. 의도의 사전 논의나 평가의 전달 중 하나를 이유 또는 절차로 인정한다.' },
        { from: 'case-12-restricted-revision-dual-date-20260914 fact1(해솔회사, 최초 승인일 3월 8일·보고서일 3월 10일, 발행 예정 3월 30일, 3월 15일에 알게 된 담보제공 공시 누락)', disposition: 'rewritten', to: 'fact3, fact4', reason: '보고서일 후 알게 된 사실을 48번의 소송 합의 한 건으로 합쳐 담보제공 공시 누락을 소송충당부채와 주석 12의 수정으로 바꾸었다. 요건 문구로 된 “알았더라면 … 영향을 미칠 수 있었다”는 뺐다.' },
        { from: 'case-12-restricted-revision-dual-date-20260914 fact2(수정사항 한정의 비금지, 주석 9만 수정, 3월 20일 승인, 3월 22일 절차 종료)', disposition: 'rewritten', to: 'fact4', reason: '법규·재무보고체계의 비금지와 실제 수정·승인 범위는 유지하고 날짜를 3월 25일 승인, 3월 27일 절차 종료로 바꾸었다.' },
        { from: 'case-12-restricted-revision-dual-date-20260914 fact3(최초 일자를 삭제한 이중일자 초안, 이중일자 없이 받으려는 회사 요청)', disposition: 'converted_to_items', to: 'fact4 ⑨(옳지 않음), ⑪(옳음)', reason: '초안은 보고서 전체 일자를 3월 27일로 바꾼 수정안(⑨)으로, 회사 요청은 기타사항문단을 포함한 수정된 감사보고서를 제출하기로 한 결정(⑪)으로 바꾸었다.' },
        { from: 'case-12-restricted-revision-dual-date-20260914 sub1 c1·c2(제한 허용 판단과 법규·수정·승인 범위의 근거)', disposition: 'converted_to_trap', to: 'fact4 ⑧(옳음), sub3.c1', reason: '후속사건 감사절차를 주석 12의 수정사항에만 한정한 옳은 절차로 식별 기준에서 평가한다.' },
        { from: 'case-12-restricted-revision-dual-date-20260914 sub2 c1(최초 일자 3월 10일 유지와 수정 전 감사업무 종료 시점의 의미)', disposition: 'converted_to_incorrect_item', to: 'fact4 ⑨, sub3.c2', reason: '보고서 전체 일자를 바꾼 수정안의 이유 또는 절차(최초 일자 유지, 주석에 한정된 추가 일자나 설명 문단)로 승계했다.' },
        { from: 'case-12-restricted-revision-dual-date-20260914 sub2 c2(추가 일자는 승인일·발행 예정일이 아닌 절차 종료일)', disposition: 'converted_to_incorrect_item', to: 'fact4 ⑩, sub3.c3', reason: '추가 일자를 이사회 승인일로 적어야 한다는 담당 매니저의 판단으로 바꾸었다.' },
        { from: 'case-12-restricted-revision-dual-date-20260914 sub3 c1·c2(새로운/수정된 보고서와 강조·기타사항문단, 주석 9에 맞춘 설명)', disposition: 'converted_to_trap', to: 'fact4 ⑪(옳음), sub3.c1', reason: '절차 한정의 설명을 기타사항문단에 포함한 수정된 감사보고서를 제출하기로 한 옳은 결정으로 식별 기준에서 평가한다.' },
        { from: 'case-12-post-report-refusal-20260914 fact1(새솔회사, 보고서일 3월 15일, 3월 20일 뒤늦게 받은 합의자료, 3월 12일 합의, 제3자 미제공)', disposition: 'rewritten', to: 'fact3', reason: '보고서일 3월 12일·제출 3월 17일에 맞추어 3월 9일 합의, 3월 20일 합의서 입수로 바꾸고 소송을 특허침해 소송으로 특정했다.' },
        { from: 'case-12-post-report-refusal-20260914 fact2(가·나 독립 상황, 수정 필요 증거, 이익 감소를 원하지 않는 거부, 중요하지만 전반적이지 않음, 경영에 참여하지 않는 감사위원)', disposition: 'rewritten', to: 'fact1, fact3', reason: '감사위원회 구성은 자료 1에, 수정 필요 결정과 거부는 자료 3에 두었다. 독립 상황 안내와 거부 동기는 뺐고, 의견 판단을 묻지 않으므로 중요성·전반성 평가는 두지 않았다.' },
        { from: 'case-12-post-report-refusal-20260914 fact3 가(보고서 미제출, 원래 적정의견 보고서를 보내 달라는 요청)', disposition: 'deleted', to: null, reason: '같은 기준에서 반대 대응을 가르는 병렬 상황이라 학습 단위 계약에 따라 제출 후 상황 하나만 남겼다. 제출 전 대응과의 대비는 ⑤의 함정으로 옮겼다.' },
        { from: 'case-12-post-report-refusal-20260914 fact3 나(3월 17일 제출, 제3자 미발행, 은행 제공 계획, 통보 미실시)', disposition: 'rewritten', to: 'fact1, fact3', reason: '제출과 제3자 미제공은 자료 3에, 공시·은행 제출 계획은 자료 1에 두었다. 요구 조치를 가리키던 “통보를 아직 하지 않았다”를 없앴다.' },
        { from: 'case-12-post-report-refusal-20260914 sub1 c1~c4(보고서일 후 발행일 전 시기 식별, 경영진·지배기구와 토의, 수정 필요 결정, 처리 계획 질문)', disposition: 'converted_to_background', to: 'fact3', reason: '감사팀이 합의 내용을 토의하고 수정이 필요하다고 결정하였으며 경영진이 수정하지 않겠다고 답한 배경 사실로 옮겼다. 별도 득점 기준은 두지 않는다.' },
        { from: 'case-12-post-report-refusal-20260914 sub2 c1·c2(가: 한정의견으로 변형한 보고서 제출, 중요하지만 전반적이지 않은 미수정왜곡표시)', disposition: 'converted_to_trap', to: 'fact3 ⑤(옳음), sub2.c1', reason: '이미 제출한 뒤에는 의견을 변형한 보고서를 새로 작성하는 대신 발행을 막는 조치로 대응한 옳은 판단으로 바꾸어, 제출 전후의 대응 차이를 식별 기준에서 평가한다.' },
        { from: 'case-12-post-report-refusal-20260914 sub3 c1(경영진에게 필요한 수정 전 제3자 발행 금지 통보)', disposition: 'absorbed', to: 'fact3 ⑥', reason: '대표이사와 재무담당이사에게 한 서면 통보로 ⑥에 넣었다.' },
        { from: 'case-12-post-report-refusal-20260914 sub3 c2(경영에 참여하지 않는 감사위원이 있으므로 지배기구 포함)', disposition: 'converted_to_incorrect_item', to: 'fact3 ⑥, sub2.c2', reason: '대표이사와 재무담당이사에게만 통보한 조치로 바꾸어 이유 또는 절차 1점으로 채점한다.' },
        { from: 'case-12-post-report-refusal-20260914 sub3 c3(수정 없이 제공되면 의존을 막는 후속조치)', disposition: 'converted_to_incorrect_item', to: 'fact3 ⑦, sub2.c3', reason: '발행되더라도 경영진의 책임이므로 감사인이 취할 조치가 없다는 판단으로 바꾸었다.' },
    ],
    points_change: { from: originals.reduce((n, s) => n + points(s), 0), to: points(set), reason: '원 세 세트는 8점·6점·9점(모두 사례형 8물음)이었다. 선택형 3물음 9점(식별 3점 + 옳지 않은 항목 6점)으로 통합했다. 원 criterion의 세부 명제(세 조건, 두 위협 상황, 초기 대응 세 절차, 한정의견의 근거, 날짜 문구)는 식별 기준과 항목별 이유 1점, 배경 사실로 흡수했으며 삭제한 요구는 제출 전 수정 거부의 의견 판단(대조 상황)이다.' },
});

const verdicts = (sub: string, rows: [string, string][]) => rows.map(([verdict, reason], i) => ({ criterion_id: `${sub}.c${i + 1}`, verdict, reason }));
const total = (rows: { verdict: string }[]) => rows.reduce((n, v) => n + (v.verdict === 'met' ? 1 : 0), 0);
const cases = [
    { id: 'r10-sub1-partial', subquestion_id: 'sub1', kind: 'partial',
        answer: '옳지 않은 것은 ①, ②, ④이다.\n① 감사보고서일은 이사회가 재무제표에 대한 책임을 확인하였다는 증거를 입수한 날보다 빠를 수 없으므로 이사회 승인 일정과 관계가 없다는 판단은 잘못이다.\n② 주주총회에서 재무제표가 최종 승인된 뒤에 감사보고서일을 정해야 한다.\n④ 이름을 기재하지 않으려면 감사보고서를 내기 전에 그 의도를 감사위원회와 논의해 위협의 발생가능성과 심각성에 대한 평가를 알렸어야 한다.',
        expected_verdicts: verdicts('sub1', [['contradicted', '옳은 ②를 옳지 않다고 골랐다.'], ['met', '이사회의 책임 확인 증거를 입수한 날보다 빠를 수 없다는 이유를 적었다.'], ['met', '보고서 제출 전에 의도를 감사위원회와 논의해 평가를 알려야 한다고 적었다.']]),
        reason: '함정 ②를 고른 답에서 식별 점수만 잃고 ①·④의 이유는 유지되는지 확인하는 부분정답이다.' },
    { id: 'r10-sub1-wrong', subquestion_id: 'sub1', kind: 'wrong',
        answer: '옳지 않은 것은 ②, ③이다.\n② 주주총회가 재무제표를 최종 승인하기 전에는 감사보고서일을 정할 수 없다.\n③ 손해배상 소송이나 징계 요구도 업무수행이사 개인에 대한 위협이므로 이름을 기재하지 않을 사유가 된다.\n①과 ④는 옳다. 감사보고서일은 재무제표 금액과 공시에 대한 감사절차를 마친 날이면 되고 이사회 승인과는 관계가 없으며, 이름을 기재하지 않는 결정은 감사인이 판단할 일이므로 감사위원회에는 보고서를 제출한 뒤에 알리면 충분하다.',
        expected_verdicts: verdicts('sub1', [['contradicted', '옳은 ②·③만 고르고 ①·④가 옳다고 명시했다.'], ['contradicted', '감사보고서일은 이사회 승인과 관계가 없다고 명시했다.'], ['contradicted', '보고서를 제출한 뒤에 알리면 충분하다고 명시했다.']]),
        reason: '함정만 고르고 옳지 않은 항목을 옳다고 쓴 대표 오답이다.' },
    { id: 'r10-sub2-partial', subquestion_id: 'sub2', kind: 'partial',
        answer: '옳지 않은 것은 ⑤, ⑥이다.\n⑤ 경영진이 수정을 거부했으므로 한정의견으로 변형한 감사보고서를 다시 작성해 제출해야 한다.\n⑥ 감사위원회는 경영에 참여하지 않는 사외이사로 구성되어 있으므로 발행하지 말라는 통보를 감사위원회에도 해야 한다.',
        expected_verdicts: verdicts('sub2', [['contradicted', '옳은 ⑤를 옳지 않다고 골랐고 ⑦을 빠뜨렸다.'], ['met', '감사위원회에도 발행하지 말라고 통보해야 한다고 적었다.'], ['not_met', '⑦(의존 방지 조치)을 다루지 않았다.']]),
        reason: '함정 ⑤를 고르고 ⑦을 빠뜨린 답에서 ⑥의 이유만 유지되는지 확인하는 부분정답이다.' },
    { id: 'r10-sub2-wrong', subquestion_id: 'sub2', kind: 'wrong',
        answer: '옳지 않은 것은 ⑤이다. 경영진이 수정을 거부했으므로 감사인은 한정의견으로 변형한 감사보고서를 다시 제출해야 한다.\n⑥과 ⑦은 옳다. 발행하지 말라는 통보는 대표이사와 재무담당이사에게 하면 충분하고, 통보한 뒤에 수정되지 않은 재무제표가 발행되더라도 그것은 경영진의 책임이므로 감사인이 따로 조치할 필요는 없다.',
        expected_verdicts: verdicts('sub2', [['contradicted', '옳은 ⑤만 고르고 ⑥·⑦이 옳다고 명시했다.'], ['contradicted', '대표이사와 재무담당이사에게 통보하면 충분하다고 명시했다.'], ['contradicted', '발행되더라도 감사인이 조치할 필요가 없다고 명시했다.']]),
        reason: '함정만 고르고 옳지 않은 항목을 옳다고 쓴 대표 오답이다.' },
    { id: 'r10-sub3-partial', subquestion_id: 'sub3', kind: 'partial',
        answer: '옳지 않은 것은 ⑨, ⑩이다.\n⑨ 후속사건 감사절차를 주석 12에 한정했으므로 최초 감사보고서일 3월 12일은 그대로 두고 주석 12에 관한 사항에만 추가 일자를 적어야 한다.\n⑩ 주석 12에 관한 추가 일자는 재무제표를 공시하는 3월 31일로 적어야 한다.',
        expected_verdicts: verdicts('sub3', [['met', '⑨·⑩만 골랐다.'], ['met', '최초 일자 3월 12일을 유지하고 주석 12에만 추가 일자를 적어야 한다고 적었다.'], ['contradicted', '추가 일자를 절차 종료일이 아닌 공시일 3월 31일로 적어야 한다고 했다.']]),
        reason: '옳지 않은 항목을 모두 골랐지만 ⑩의 이유가 틀린 답에서 식별과 ⑨의 점수는 유지되는지 확인하는 부분정답이다.' },
    { id: 'r10-sub3-wrong', subquestion_id: 'sub3', kind: 'wrong',
        answer: '옳지 않은 것은 ⑧, ⑪이다.\n⑧ 경영진이 재무제표를 수정했으므로 모든 후속사건에 대한 감사절차를 새 감사보고서일까지 연장해야 한다.\n⑪ 절차를 한정한 경우에는 반드시 이중 보고서일을 써야 한다.\n⑨와 ⑩은 옳다. 수정사항에 대한 감사절차를 3월 27일에 마쳤으므로 감사보고서 전체의 일자를 3월 27일로 바꾸어도 되고, 이중 보고서일을 쓴다면 추가 일자는 이사회가 수정사항을 승인한 3월 25일로 적는 것이 맞다.',
        expected_verdicts: verdicts('sub3', [['contradicted', '옳은 ⑧·⑪만 고르고 ⑨·⑩이 옳다고 명시했다.'], ['contradicted', '보고서 전체의 일자를 3월 27일로 바꾸어도 된다고 명시했다.'], ['contradicted', '추가 일자를 이사회 승인일 3월 25일로 적는 것이 맞다고 명시했다.']]),
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
        { id: 'r10-supp-brief', purpose: '옳지 않은 항목에 이유만(⑩ 절차 종료일) 또는 보완절차만(①·④·⑥·⑦·⑨) 짧게 쓴 답이 항목별 1점을 받는지 확인한다. ④는 의도의 사전 논의만, ⑨는 최초 일자의 유지만 적었다.',
            answers: {
                sub1: '①, ④\n① 감사보고서일은 이사회의 재무제표 승인일 이후로 정해야 한다.\n④ 이름을 기재하지 않으려는 의도를 감사위원회와 미리 논의했어야 한다.',
                sub2: '⑥, ⑦\n⑥ 감사위원회에도 발행하지 말라고 통보했어야 한다.\n⑦ 수정 없이 발행되면 감사보고서에 대한 의존을 막는 조치를 취해야 한다.',
                sub3: '⑨, ⑩\n⑨ 최초 감사보고서일 3월 12일은 바꾸지 않고 유지해야 한다.\n⑩ 추가 일자는 수정사항에 대한 감사절차가 끝난 3월 27일이다.',
            },
            expected: {
                sub1: supp('sub1', [['met', '①·④만 골랐다.'], ['met', '감사보고서일을 이사회 승인일 이후로 정해야 한다는 절차를 적었다.'], ['met', '이름을 기재하지 않으려는 의도를 감사위원회와 미리 논의해야 한다는 절차를 적었다.']]),
                sub2: supp('sub2', [['met', '⑥·⑦만 골랐다.'], ['met', '감사위원회에도 통보해야 한다는 절차를 적었다.'], ['met', '의존을 막는 조치를 취해야 한다는 절차를 적었다.']]),
                sub3: supp('sub3', [['met', '⑨·⑩만 골랐다.'], ['met', '최초 감사보고서일 3월 12일을 유지해야 한다는 절차를 적었다.'], ['met', '추가 일자는 절차 종료일 3월 27일이라는 이유를 적었다.']]),
            } },
        { id: 'r10-supp-content-identification', purpose: '번호 없이 내용으로 옳지 않은 항목을 특정하고, 두 항목의 이유와 보완절차를 한 문장에 함께 쓴 답이 식별 점수와 각 항목 점수를 받는지 확인한다.',
            answers: {
                sub1: '재무제표 금액과 공시에 대한 절차만 마치면 이사회 승인과 관계없이 감사보고서일을 정할 수 있다고 본 감사팀의 판단과, 이름을 기재하지 않은 뒤 보고서를 제출하고 나서야 감사위원회에 알린 조치가 옳지 않다. 감사보고서일은 이사회가 재무제표에 대한 책임을 확인한 증거를 입수한 날보다 빠를 수 없고, 이름을 기재하지 않으려면 그 의도를 보고서 제출 전에 감사위원회와 논의해 위협에 대한 평가를 알려야 한다.',
                sub2: '대표이사와 재무담당이사에게만 발행하지 말라고 통보한 조치와, 통보 뒤 수정되지 않은 재무제표가 발행되어도 감사인이 할 일은 없다고 본 판단이 옳지 않다. 경영에 참여하지 않는 감사위원회에도 통보해야 하고, 그래도 발행되면 감사보고서에 대한 의존을 막는 조치를 취해야 한다.',
                sub3: '감사보고서 전체의 일자를 3월 27일로 바꾼 수정안과, 추가 일자를 이사회 승인일인 3월 25일로 적어야 한다는 매니저의 의견이 옳지 않다. 절차를 주석 12에 한정했으므로 3월 12일을 유지하고 주석 12에만 추가 일자를 붙여야 하며, 그 추가 일자는 한정된 절차를 마친 3월 27일이어야 한다.',
            },
            expected: {
                sub1: supp('sub1', [['met', '내용으로 ①·④만 특정했다.'], ['met', '이사회의 책임 확인 증거 입수일보다 빠를 수 없다고 적었다.'], ['met', '보고서 제출 전에 의도를 논의해 평가를 알려야 한다고 적었다.']]),
                sub2: supp('sub2', [['met', '내용으로 ⑥·⑦만 특정했다.'], ['met', '감사위원회에도 통보해야 한다고 적었다.'], ['met', '의존을 막는 조치를 취해야 한다고 적었다.']]),
                sub3: supp('sub3', [['met', '내용으로 ⑨·⑩만 특정했다.'], ['met', '3월 12일을 유지하고 주석 12에만 추가 일자를 붙여야 한다고 적었다.'], ['met', '추가 일자는 한정된 절차를 마친 3월 27일이어야 한다고 적었다.']]),
            } },
        { id: 'r10-supp-restated-conclusion', purpose: '옳지 않은 항목을 모두 고르되 각 항목에 옳지 않다는 결론만 되풀이하고 원칙·보완절차를 쓰지 않은 답이 식별 점수만 받는지 확인한다(조건 경계).',
            answers: {
                sub1: '옳지 않은 것은 ①, ④이다.\n① 3월 8일에 감사팀이 내린 감사보고서일에 관한 판단은 적절하지 않다.\n④ 익명 편지에 대한 업무수행이사의 조치는 적절하지 않다.',
                sub2: '옳지 않은 것은 ⑥, ⑦이다.\n⑥ 3월 21일의 서면 통보는 적절하지 않다.\n⑦ 통보 뒤의 상황에 관한 업무수행이사의 판단은 적절하지 않다.',
                sub3: '옳지 않은 것은 ⑨, ⑩이다.\n⑨ 보고서 담당자의 수정안은 적절하지 않다.\n⑩ 담당 매니저의 의견은 적절하지 않다.',
            },
            expected: {
                sub1: supp('sub1', [['met', '①·④만 골랐다.'], ['not_met', '감사보고서일의 조건이나 정해야 할 날짜가 없다.'], ['not_met', '지배기구와의 사전 논의나 평가 전달이 없다.']]),
                sub2: supp('sub2', [['met', '⑥·⑦만 골랐다.'], ['not_met', '감사위원회(지배기구)에도 통보해야 한다는 내용이 없다.'], ['not_met', '의존을 막는 조치에 관한 내용이 없다.']]),
                sub3: supp('sub3', [['met', '⑨·⑩만 골랐다.'], ['not_met', '최초 일자의 유지나 추가 일자·설명 문단에 관한 내용이 없다.'], ['not_met', '추가 일자가 절차 종료일이어야 한다는 내용이 없다.']]),
            } },
    ],
});
console.log({ target, originals: originals.map((s) => [s.id, points(s)]), points: points(set), cases: cases.map((c) => [c.id, c.expected_points]) });
