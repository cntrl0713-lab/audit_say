// r10 v1 agent 내용 검토 기록(한 번만 실행; 기존 파일이 있으면 쓰지 않는다).
//   npx tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/tools/record-r10-review.mts
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewedContentHash } from '../../../../questionReviewIdentity.ts';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r10-report-date-subsequent-merge';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r10';
const file = `${D}/sets.json`;
const [set] = JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = (p: string) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const pass = { source: 'pass', answer: 'pass', prompt: 'pass', points: 'pass', style: 'pass', topics: 'pass', edition: 'pass', nonduplication: 'pass' };
fs.mkdirSync(R, { recursive: true });
const review = {
    version: 1, method: 'agent_content_review', human_review_performed: false,
    reviewer_id: 'agent:claude-opus-5 (author agent; no independent peer review)', reviewed_at: new Date().toISOString(),
    target: { file, sha256: sha(file), set_id: set.id, reviewed_content_sha256: reviewedContentHash(set) },
    evidence: [`${D}/design.json`, `${D}/lineage.json`, `${D}/qa.json`, `${D}/build-draft.mjs`,
        'cpa_uploader/data/official/delegated-s05-kga-2025.txt', 'cpa_uploader/data/official/kga450-560-570-580-2025-review12.txt',
        'cpa_uploader/data/official/delegated-r01-kga-2025.txt',
        'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025-pymupdf-pages.txt', 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt',
        'cpa_uploader/data/회계감사_통합학습자료/04_기출문제/기출문제_연도별_해설_A.md',
        'cpa_uploader/data/회계감사_통합학습자료/03_문제연습/고급_회계감사_연습.md',
        'cpa_uploader/analysis/question-elements/question-elements.json',
        'cpa_uploader/data/cpa_question_sets_v3.authoring.json'].map((f) => ({ file: f, sha256: sha(f) })),
    method_detail: '2025 전문 추출본에서 KGA 700 문단 46~49·A61~A69와 KGA 560 문단 1~17·A1~A20을 읽고, 2026 전문(2026년 7월 개정) 추출본과 인용·판단에 쓴 문단을 공백을 제거해 대조했다(560은 쪽 머리말 외 동일, 700 문단 46·49·A61~A63·A66~A69 동일). 원 세 세트(pilot-15-007, case-12-restricted-revision-dual-date-20260914, case-12-post-report-refusal-20260914)의 사실관계·발문·모범답안·criterion, 기준서형 draft-12-560-freq01 q1·q2, std-points-20260914-4e39b686bc62, pilot-15-001과 같은 날 다른 세션의 r08·r09 초안 인용, 2025 제60회 문제 4 물음 3·2016 제51회 문제 9 물음 1·2·2019 제54회 문제 6 물음 6·2020 제55회 문제 3 물음 5·2021 제56회 문제 5 물음 4·2023 제58회 문제 10 물음 2와 2025 모의 GS1-8 물음 4의 쟁점·답안과 비교했다. 열한 항목의 옳고 그름, 각 criterion의 claim·허용 범위·반대 조건과 모범답안의 충족 여부, 원 세트 간 전제(두 회사·독립 상황 → 한 회사의 시간 순서, 담보제공 공시 누락 → 소송 합의 수정)의 정합성, 근거 문구의 분포와 뒤 단계 사실의 정답 노출 여부를 양방향으로 대조했다.',
    questions: [
        { set_id: set.id, subquestion_id: 'sub1', checks: pass,
            rationale: '①은 KGA 700 문단 49(b)·A67에 따라 옳지 않다(감사보고서일의 기초가 되는 증거에는 인정된 권한을 가진 기구인 이사회가 재무제표에 대한 책임을 진다고 주장했다는 증거가 포함되므로 승인 일정과 관계없다는 판단은 요건에 어긋남). ②는 KGA 700 문단 49·A69에 따라 옳다(주석 포함 작성 3월 8일, 이사회 승인 3월 10일, 업무품질관리검토를 포함한 필요 절차 완료 3월 12일이므로 3월 12일은 가장 빠른 보고서일이며 주주의 최종승인은 필요하지 않음). ③은 KGA 700 문단 A63에 따라 옳다(법적 책임, 법규 및 전문가적 제재의 위협은 개인의 안전에 대한 위협에 포함되지 않음). ④는 KGA 700 문단 46에 따라 옳지 않다(유의적 위협을 평가했더라도 이름을 기재하지 않으려는 의도를 지배기구와 논의해 평가를 알려야 하며, 보고서 제출 뒤의 통지는 의도의 논의가 아님). 감사위원회는 경영에 참여하지 않는 사외이사로만 구성되어 있고 추가 법규 요건이 없다는 배제 사실이 있다. c1 식별과 c2·c3(이유나 보완절차 한 가지, 핵심 원칙 수준)이 독립적으로 채점된다.',
            check_rationales: {
                source: 'KGA 700 문단 46·49·A63·A67·A69는 s05 등록본(delegated-s05-kga-2025.txt, KGA 700 구간)에서 문단 본문만 발췌했다(pilot-15-007 인용 끝의 다음 절 제목·쪽 표시 제외). 모두 초안 검증(--against-bank)의 원문 실존 검사를 통과했다.',
                answer: '모범답안이 c1~c3을 충족한다. 부분정답(함정 ② 선택, ①·④ 이유)=2점, 오답(②·③만 선택, ①·④가 옳다고 명시)=0점, 보조 사례(①·④ 보완절차만)=3점, 번호 없이 내용으로 특정한 답=3점, 결론만 되풀이한 답=1점을 원문으로 정했다.',
                prompt: '발문은 범위(①~④)와 요구(번호, 이유나 수행하였어야 할 절차를 간략히)만 적는다. 원 발문의 “증거 관련 조건 세 가지를 설명하시오”, “예외의 요건과 … 지배기구와 논의할 사항을 설명하시오”, “평가가 끝났다고 가정하지 마시오”와 사실의 “아직 … 평가하지 않았다”를 없앴다.',
                points: '3점. 옳지 않은 항목 두 개에 각 1점, 식별 1점. 세 조건의 완전한 나열, 날짜의 반복, 위협 평가의 세부 방법은 요구하지 않는다. 함정 ②·③은 식별 기준으로만 평가한다.',
                style: '재무제표 작성·이사회 승인·절차 완료·주주총회의 날짜, 주주 서한과 익명 편지의 내용, 감사위원회의 구성이라는 사실에 기준을 적용해 각 판단·조치의 옳고 그름을 판단해야 하므로 사례형이다.',
                topics: '15(KGA 700 감사보고서일의 결정, 업무수행이사 이름 공시의 예외와 지배기구 논의).',
                edition: '대상 연도 2027년. 사례의 20X1년을 2026-01-01 개시 보고기간으로 보고 2025 전문을 적용했다. 2026 전문과 인용 문단의 본문이 같다. 사실관계의 업무품질관리검토는 2025 전문 220의 용어이며 판단 대상이 아니다.',
                nonduplication: '원 pilot-15-007 sub1·sub2의 요소를 ①~④로 옮겼다. 은행에서 KGA 700 문단 46·49를 인용하는 물음은 원 세트뿐이며, pilot-15-001은 보고서 구성의 기준서 재현이다.' },
            unresolved_content_findings: [] },
        { set_id: set.id, subquestion_id: 'sub2', checks: pass,
            rationale: '⑤는 KGA 560 문단 13(a)·(b)에 따라 옳다(의견을 변형한 후 보고서를 제출하는 대응은 아직 보고서를 제출하지 않은 경우이고, 3월 17일 이미 제출했으므로 필요한 수정 없이 제3자에게 발행되지 않도록 하는 통보와 의존 방지 조치로 대응). ⑥은 문단 13(b)에 따라 옳지 않다(지배기구의 모든 구성원이 경영에 참여하는 경우가 아니면 통보 대상에 지배기구를 포함하며, 감사위원회는 경영에 참여하지 않는 사외이사로만 구성됨). ⑦은 문단 13(b) 후단에 따라 옳지 않다(통보에도 불구하고 필요한 수정 없이 발행되면 감사보고서에 대한 의존을 못하게 하기 위한 적합한 조치를 취해야 함). 자료 3의 토의·수정 필요 결정·경영진 거부는 문단 10의 배경 사실이며 득점 대상이 아니다. c1 식별과 c2·c3이 독립적으로 채점된다.',
            check_rationales: {
                source: 'KGA 560 문단 13은 kga450-560-570-580-2025-review12.txt에서 문단 본문만 발췌했다(case-12-post-report-refusal-20260914 인용 끝의 다음 절 제목 제외). 문단 A16·A17(법적 조언)은 등록 발췌본에 없어 인용하지 않았고 ⑦의 criterion은 구체적 조치를 요구하지 않는다.',
                answer: '모범답안이 c1~c3을 충족한다. 부분정답(함정 ⑤ 선택·⑦ 누락, ⑥ 이유)=1점, 오답(⑤만 선택, ⑥·⑦이 옳다고 명시)=0점, 보조 사례(보완절차만)=3점, 내용 특정 답=3점, 결론만 되풀이한 답=1점을 원문으로 정했다.',
                prompt: '범위(⑤~⑦)와 요구만 적는다. 원 발문의 “어느 시기에 해당하는지 식별하고 … 초기 대응”, “중요성·전반성을 연결하여”, “누구에게 무엇을 통보해야 하는지 … 추가 조치가 달성해야 할 목적”과 사실의 “통보를 아직 하지 않았다”를 없앴다.',
                points: '3점. 옳지 않은 항목 두 개에 각 1점, 식별 1점. 법률 자문·이용자 통지 등 구체적 의존 방지 수단, 통보의 형식은 요구하지 않는다. 함정 ⑤는 식별 기준으로만 평가한다.',
                style: '감사보고서 제출일, 제3자 미제공 상태, 수정 거부, 감사위원회의 구성이라는 사실에 기준을 적용해야 하므로 사례형이다.',
                topics: '12(KGA 560 감사보고서일 후 재무제표 발행일 전에 알게 된 사실과 경영진의 수정 거부에 대한 대응).',
                edition: 'sub1과 같은 판본·가정. KGA 560은 2026년 1월 1일 이후 개시 보고기간부터 시행된다.',
                nonduplication: '원 case-12-post-report-refusal-20260914 sub3의 요소를 ⑥·⑦로, sub2(제출 전 수정 거부의 한정의견)를 ⑤의 대비 함정으로 옮겼다. 기준서형 std-points-20260914-4e39b686bc62(문단 10·11)와 달리 문단 13을 사례 조치에 적용한다.' },
            unresolved_content_findings: [] },
        { set_id: set.id, subquestion_id: 'sub3', checks: pass,
            rationale: '⑧은 KGA 560 문단 11(b)(i)·12에 따라 옳다(법규·재무보고체계가 수정과 승인을 합의의 영향으로 한정하는 것을 금지하지 않고 실제 수정과 이사회 승인도 소송충당부채와 주석 12로 한정됨). ⑨는 문단 12(a)·A13에 따라 옳지 않다(수정 전 재무제표에 대한 감사보고서일 3월 12일은 변경 없이 남고 추가 일자만 주석 12에 한정해 기재하며, 보고서 전체를 3월 27일자로 바꾸면 모든 후속사건 절차를 연장한 것처럼 보임). ⑩은 문단 A13과 KGA 700 문단 49에 따라 옳지 않다(추가 일자는 수정사항에 한정한 감사절차의 종료일 3월 27일이며 증거 입수일보다 빠른 이사회 승인일 3월 25일로 적을 수 없음). ⑪은 문단 12(b)에 따라 옳다(절차 한정의 설명을 기타사항문단에 포함한 수정된 감사보고서의 제출). c1 식별과 c2·c3이 독립적으로 채점된다.',
            check_rationales: {
                source: 'KGA 560 문단 12·A13은 case-12-restricted-revision-dual-date-20260914의 인용(delegated-r01-kga-2025.txt)을 해시 그대로 재사용했고, 문단 11은 kga450-560-570-580-2025-review12.txt에서 문단 본문만 발췌했다. KGA 700 문단 49는 sub1과 같은 발췌다.',
                answer: '모범답안이 c1~c3을 충족한다. 부분정답(⑨·⑩ 선택, ⑨ 이유, ⑩의 날짜를 공시일로 잘못 제시)=2점, 오답(⑧·⑪만 선택, ⑨·⑩이 옳다고 명시)=0점, 보조 사례(⑨ 보완절차만, ⑩ 이유만)=3점, 내용 특정 답=3점, 결론만 되풀이한 답=1점을 원문으로 정했다.',
                prompt: '범위(⑧~⑪)와 요구만 적는다. 원 제목의 “제한된 주석 수정과 이중 보고서일의 적용”, 원 발문의 “초안을 고치시오”, “유지해야 할 최초 일자와 … 추가 일자를 실제 날짜로 제시하고”, “어떤 보고서와 설명 문단을 사용하여야 하는지”를 없앴다.',
                points: '3점. 옳지 않은 항목 두 개에 각 1점, 식별 1점. 날짜 문구·괄호 형식의 재현, 두 보고 방법의 동시 서술은 요구하지 않는다. 함정 ⑧·⑪은 식별 기준으로만 평가한다.',
                style: '법규·재무보고체계의 비금지, 실제 수정·승인 범위, 이사회 승인일과 절차 종료일, 회사의 요청이라는 사실에 기준을 적용해야 하므로 사례형이다.',
                topics: '12(KGA 560 수정사항에 한정한 후속사건 감사절차와 이중 보고서일·설명 문단을 사용한 감사보고서 수정).',
                edition: 'sub1과 같은 판본·가정.',
                nonduplication: '원 case-12-restricted-revision-dual-date-20260914 sub1~sub3의 요소를 ⑧~⑪로 옮겼다. 기준서형 draft-12-560-freq01 q1·q2(문단 12의 조건과 두 방법의 서술)와 달리 사례 판단의 옳고 그름을 묻는다.' },
            unresolved_content_findings: [] },
    ],
    observations_not_blocking: [
        '사실관계 2,175자, 항목 11개로 원 세 세트(사실 3·3·3개)를 한 회사의 시간 순서로 합친 범위다. 48번의 독립 상황 가(보고서 제출 전 수정 거부)와 그 의견 판단(한정의견)은 대조 상황의 병렬 질문을 피하려고 삭제하고 ⑤의 함정으로 대비시켰다. 67번의 담보제공 공시 누락은 48번의 소송 합의 수정으로 바꾸어 하나의 사건 흐름으로 합쳤다.',
        '사용자가 형식을 지정하지 않아 학습 단위 계약의 기본인 옳지 않은 것 선택형을 적용했다. 원 세 세트의 물음 8개는 모두 사례형이라 따로 보존할 기준서형 물음이 없다.',
        '옳지 않은 항목 수는 물음별 2개이며 발문에 밝히지 않는다. ⑨·⑩은 같은 문단(12(a)·A13)에서 서로 다른 잘못을 가르는 항목이고 ③·④는 같은 문단 46·A63에서 법적·제재 위협과 신체적 위협을 가르는 항목이지만 각각 한 목록 안에 두었다.',
        '④의 criterion은 감사위원회에 알려야 한다고만 쓴 답을 인정하지 않는다(업무수행이사가 이미 사후에 알렸으므로 잘못의 이유가 되지 않음). 이 경계는 결론만 되풀이한 보조 사례와 별도로 실측하지 않았다.',
        '작성 agent가 직접 검토했으며 독립 agent 교차검토·사람 확인은 수행하지 않았다.',
    ],
    unresolved_content_findings: [],
};
fs.writeFileSync(`${R}/root-content-review-v1.json`, JSON.stringify(review, null, 2) + '\n', { flag: 'wx' });
console.log(review.target);
