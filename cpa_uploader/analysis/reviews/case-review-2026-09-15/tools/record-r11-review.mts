// r11 v1 agent 내용 검토 기록(한 번만 실행; 기존 파일이 있으면 쓰지 않는다).
//   npx tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/tools/record-r11-review.mts
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewedContentHash } from '../../../../questionReviewIdentity.ts';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r11-scope-limitation-disclaimer';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r11';
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
        'cpa_uploader/data/official/case-review-2026-09-15-r11-kga705.md', 'cpa_uploader/raw/originals/case-review-2026-09-15/r11-kga705-2025-excerpts.provenance.json',
        'cpa_uploader/data/official/kga700-705-2025-review15.txt', 'cpa_uploader/data/official/delegated-s05-kga-2025.txt',
        'cpa_uploader/data/official/kga450-560-570-580-2025-review12.txt', 'cpa_uploader/data/official/kga501-505-510-2025-review09.txt',
        'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025-pymupdf-pages.txt', 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt',
        'cpa_uploader/data/회계감사_통합학습자료/04_기출문제/기출문제_연도별_해설_A.md', 'cpa_uploader/data/회계감사_통합학습자료/04_기출문제/기출문제_주제별_해설.md',
        'cpa_uploader/data/회계감사_통합학습자료/03_문제연습/고급_회계감사_연습.md',
        'cpa_uploader/data/cpa_question_sets_v3.authoring.json'].map((f) => ({ file: f, sha256: sha(f) })),
    method_detail: '2025 전문 추출본에서 KGA 705 전체(문단 1~30, A1~A27, 보론 사례 4·5), KGA 580 문단 3·4, KGA 501 문단 4~7, KGA 240 보론 1의 감사인에 대한 접근 제한 예시를 읽고, 2026 전문(2026년 7월 개정) 추출본과 대조했다(KGA 705는 쪽 머리말·쪽 번호 외 동일, KGA 580 문단 4·KGA 501 문단 6 동일). 새로 등록한 KGA 705 발췌본(문단 11·12·13·15·26·27·A9·A16·A24·A27)은 원본 PDF 쪽 재추출과 쪽 이미지로 대조했다. 원 pilot-15-006의 사실관계·발문·모범답안·criterion, KGA 705·580·501 기준서형 물음(std-points-20260914-874ec474222d·25bbd5d8d184·3b0db7d243b3·90ff3e9ba9d8·fa2d3a177634·817048b7fa92·1b7c27cd473f, pilot-15-001, pilot-15-003, std-points-20260914-2ae588b5cc20, pilot-12-003, std-points-20260914-c82d262bd6a8)과 사례형 case-12-going-concern-evidence-20260914·case-12-representation-conflict-20260914·case-16-report-paragraphs-20260914, 2024 제59회 문제 10·2022 제57회 문제 7·2020 제55회 문제 9 물음 5·2025 제60회 문제 10 물음 1과 고급회계감사연습 Section 6 문제 11의 쟁점과 비교했다. 열두 항목의 옳고 그름, 각 criterion의 claim·허용 범위·반대 조건과 모범답안의 충족 여부, 옳은 항목이 인접 문단(705 문단 13(b)(i)·14, A11, A16, 문단 25)에 의해 다투어지지 않는지, 근거 문구의 분포와 뒤 단계 사실의 정답 노출 여부를 양방향으로 대조했다.',
    questions: [
        { set_id: set.id, subquestion_id: 'sub1', checks: pass,
            rationale: '①은 KGA 705 문단 11·12에 따라 옳다(제한 제거를 요청하고, 거절되자 경영에 참여하지 않는 사외이사로 구성된 감사위원회에 알리고 대체적 절차의 가능 여부를 검토; 대표이사의 요청은 이 요구를 면제하지 않음). ②는 KGA 580 문단 4에 따라 옳지 않다(서면진술은 그 자체로 충분하고 적합한 감사증거가 아니며 다른 감사증거의 성격·범위를 줄이지 못함). ③은 KGA 705 문단 A9에 따라 옳지 않다(경영진에 의한 제한은 부정위험 평가와 감사의 계속적 수행 여부에 시사점을 가질 수 있는데 이를 감사증거 문제로만 보고 종전 평가를 적용). ④는 KGA 501 문단 6과 KGA 705 문단 A9에 따라 옳다(예상하지 못한 폭설로 입회하지 못해 다른 일자에 실사하고 그 사이 입출고를 테스트해 충분하고 적합한 증거를 입수하였으므로 감사범위의 제한이 아님). ⑤는 KGA 705 문단 30·A27에 따라 옳지 않다(의견변형이 예상되면 발행 전에 상황과 변형 문안을 지배기구와 커뮤니케이션). c1 식별과 c2~c4(이유나 보완절차 한 가지, 핵심 원칙 수준)가 독립적으로 채점된다.',
            check_rationales: {
                source: 'KGA 705 문단 11·12·A9·A27은 이번에 등록한 2025 전문 발췌본에서, 문단 30은 std-points-20260914-fa2d3a177634의 인용을 해시 그대로, KGA 580 문단 4는 review12 등록본에서, KGA 501 문단 6은 review09 등록본에서 문단 본문만 발췌했다(review09는 쪽 전사와 직접 발췌에 같은 문단을 두 번 담아 첫 수록 위치를 쓰고 두 수록이 같음을 확인). 모두 해당 KGA 구간 안에 있고 초안 검증(--against-bank)을 통과했다. KGA 240 보론 1은 등록 발췌본에 없어 인용하지 않고 ③의 판단 확인에만 사용했다.',
                answer: '모범답안이 c1~c4를 충족한다. 부분정답(함정 ④ 선택·⑤ 누락, ②·③ 이유)=2점, 오답(①·④만 선택, ②·③·⑤가 옳다고 명시)=0점, 보조 사례(이유만 또는 보완절차만)=4점, 번호 없이 내용으로 특정한 답=4점, 결론만 되풀이한 답=1점, ③에 감사의 계속적 수행 여부만 쓴 경계 답=3점을 원문으로 정했다.',
                prompt: '발문은 범위(①~⑤)와 요구(번호, 이유나 수행하였어야 할 절차를 간략히)만 적는다. 원 발문의 “나머지 단락을 작성하지 마시오”, “책임, 증거 미입수의 한계, 독립성·윤리적 책임에 관한 기술을 각각 제시하시오” 같은 답안 구성 요소를 두지 않았다. 옳지 않은 항목 수를 밝히지 않는다.',
                points: '4점. 옳지 않은 항목 세 개에 각 1점, 식별 1점. 서면진술이 다루는 사항의 구체적 확인절차 전부, 부정위험요소의 명칭, 커뮤니케이션의 목적은 요구하지 않는다. 옳은 항목 ①·④는 식별 기준으로만 평가한다.',
                style: '감사위원회의 구성, 대표이사의 제한과 요청, 서면진술서의 내용과 생략한 절차, 폭설로 입회하지 못한 실사와 다른 일자의 실사라는 사실에 기준을 적용해 각 절차·판단의 옳고 그름을 판단해야 하므로 사례형이다.',
                topics: '15(KGA 705 문단 11·12·30·A9 경영진에 의한 감사범위 제한의 대응과 의견변형 예상 시 지배기구 커뮤니케이션), 05(경영진의 제한이 부정위험 평가에 갖는 시사점과 지배기구 커뮤니케이션), 12(KGA 580 서면진술의 한계), 09(KGA 501 예상하지 못한 상황의 재고실사 대체 절차).',
                edition: '대상 연도 2027년. 사례의 20X1년을 2026-01-01 개시 보고기간으로 보고 2025 전문을 적용했다. KGA 705 전체와 KGA 580 문단 4, KGA 501 문단 6의 본문이 2026 전문과 같다.',
                nonduplication: '원 pilot-15-006에 없던 새 요구다. 기준서형(705 문단 11·12·30·A9, 580 서면진술, 501 실사 입회)은 기준서 재현이고 이 물음은 사례 절차·판단의 옳고 그름을 묻는다.' },
            unresolved_content_findings: [] },
        { set_id: set.id, subquestion_id: 'sub2', checks: pass,
            rationale: '⑥은 KGA 705 문단 5(a)(ii)·9·13(b)(ii)에 따라 옳다(관계기업투자가 총자산의 55%, 지분법이익이 법인세비용차감전순이익의 약 69%로 특정 계정에 국한되더라도 상당한 부분이어서 전반적일 수 있고 해지가 법규상 불가능하므로 의견거절). ⑦은 문단 15에 따라 옳지 않다(A16의 예외는 계속감사·단일 재무보고체계인 사례에 해당하지 않음). ⑧은 문단 19(c)에 따라 옳지 않다(감사하였음을 감사계약 체결로 수정; 제목과 19(a)·(b) 문장은 옳음). ⑨는 문단 26(b)에 따라 옳지 않다(증거의 충분성·적합성 기술 제외; 문단 25의 수정 포함은 한정·부적정에만). ⑩은 문단 27·A24에 따라 옳지 않다(중요하지만 전반적이지 않은 재고자산 평가손실 미반영은 의견거절근거 단락에 기술). ⑪은 문단 29·A26에 따라 옳지 않다(추가 법규 요구가 없으므로 핵심감사사항 단락 불가). ⑫는 문단 28에 따라 옳다(감사기준에 따른 감사 수행·보고서 발행 책임, 증거 미입수, 독립성·윤리적 책임만 기재). c1 식별과 c2~c6이 독립적으로 채점된다.',
            check_rationales: {
                source: 'KGA 705 문단 13·15·26·27·A16·A24는 이번 등록 발췌본, 문단 5(a)·9는 case-12-going-concern-evidence-20260914, 문단 28은 std-points-20260914-817048b7fa92의 인용을 해시 그대로 재사용했다. 문단 19·A26은 s05 등록본, 문단 29는 review15 등록본에서 문단 본문만 발췌했다(원 인용 끝의 다음 절 제목·쪽 표시 제외).',
                answer: '모범답안이 c1~c6을 충족한다. 부분정답(함정 ⑥ 선택·⑩ 누락, ⑨는 번호만, ⑦·⑧·⑪ 이유)=3점, 오답(⑫만 선택, ⑦~⑪이 옳다고 명시)=0점, 보조 사례(처리만)=6점, 내용 특정 답=6점, 결론만 되풀이한 답=1점, ⑩에 수정 요구만 다시 쓴 경계 답=5점을 원문으로 정했다.',
                prompt: '범위(⑥~⑫)와 요구(번호, 이유나 바르게 처리하는 방법을 간략히)만 적는다. 제목과 태그에서 의견의 종류(의견거절)와 고칠 단락을 밝히던 원 세트의 표현을 없앴다.',
                points: '6점. 옳지 않은 항목 다섯 개에 각 1점, 식별 1점. 문안의 완전한 재현, 문단 번호, 한정의견과 부적정의견 문구의 비교는 요구하지 않는다. 옳은 항목 ⑥·⑫는 식별 기준으로만 평가한다.',
                style: '관계기업투자와 지분법이익의 비중, 해지 불가, 추가 법규 요구 없음, 계속감사, 재고자산 평가손실의 성격과 경영진의 수정 거부, 초안의 구체적 문안에 기준을 적용해 판단해야 하므로 사례형이다.',
                topics: '15(KGA 705 전반성·의견 결정, 의견거절과 상충하는 적정의견, 의견거절 단락·근거 단락·책임 단락의 문안), 16(의견거절 보고서의 핵심감사사항 단락).',
                edition: 'sub1과 같은 판본·가정.',
                nonduplication: '원 pilot-15-006 sub1 crit2를 ⑧로, exp1을 옳은 함정 ⑫로 옮겼다. 문단 15·26·27은 은행에 처음 들어오는 요구이고, 문단 28·29는 기준서형(std-points-20260914-817048b7fa92·1b7c27cd473f)과 달리 사례 초안의 판단으로 묻는다.' },
            unresolved_content_findings: [] },
    ],
    observations_not_blocking: [
        '사실관계 2,678자, 항목 12개(물음 1은 5개, 물음 2는 7개)다. 원 세트(사실 3개, 7점)보다 길지만 모든 사실이 항목의 판단에 쓰인다. 사용자가 이전 회차(r03)에서 사실관계가 복잡하다고 지적한 원인(쓰이지 않는 사실, 비슷한 이름, 모순된 기재)은 두지 않았다.',
        '사용자가 형식을 지정하지 않아 학습 단위 계약의 기본인 옳지 않은 것 선택형을 적용했다. 구성은 실행 전에 사용자 확인을 받지 않았다(이번 지시에 확인 요청이 없었다).',
        '⑥(의견 결정)의 옳음은 같은 목록의 보고서 항목이 의견거절 보고서를 전제로 한다는 점에서 짐작될 수 있다. 뒤 단계 사실로 정답을 알려 주지 않도록 의견 결정을 사실이 아닌 항목으로 두고 같은 단계에 배치했다.',
        '원 세트 퇴역 후 KGA 705 문단 16·19를 인용하는 다른 물음은 은행에 없다. 이 사례는 ⑧에서 문단 19(c)를 옳지 않은 부분으로, 문단 16·19(a)·(b)를 옳게 작성된 부분으로 다룬다.',
        '같은 날 다른 세션이 r08(case-16-kam-emphasis-20260919)·r09·r10을 진행 중이다. r08은 한정의견 사항의 핵심감사사항 단락 언급을 다루어 이 사례의 ⑪(의견거절 보고서의 핵심감사사항 단락)과 요구가 다르다.',
        '작성 agent가 직접 검토했으며 독립 agent 교차검토·사람 확인은 수행하지 않았다.',
    ],
    unresolved_content_findings: [],
};
fs.writeFileSync(`${R}/root-content-review-v1.json`, JSON.stringify(review, null, 2) + '\n', { flag: 'wx' });
console.log({ file: `${R}/root-content-review-v1.json`, reviewed_content_sha256: review.target.reviewed_content_sha256 });
