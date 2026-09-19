// r10 v2 agent 내용 검토 기록(한 번만 실행; 기존 파일이 있으면 쓰지 않는다). v1 검토를 바탕으로 바뀐 물음 1(④와 익명 편지 사실)을 다시 검토한다.
//   npx tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/tools/record-r10v2-review.mts
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewedContentHash } from '../../../../questionReviewIdentity.ts';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r10-report-date-subsequent-merge';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r10';
const file = `${D}/v2/sets.json`;
const [set] = JSON.parse(fs.readFileSync(file, 'utf8'));
const [v1] = JSON.parse(fs.readFileSync(`${D}/sets.json`, 'utf8'));
const sha = (p: string) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const previous = JSON.parse(fs.readFileSync(`${R}/root-content-review-v1.json`, 'utf8'));
const pass = { source: 'pass', answer: 'pass', prompt: 'pass', points: 'pass', style: 'pass', topics: 'pass', edition: 'pass', nonduplication: 'pass' };
const change = '사용자 지적(2026-09-19): ③(주주의 손해배상 소송·징계 요구는 이름 생략 사유가 아님, 옳음)과 v1의 ④(익명 편지의 신체적 위협을 평가해 생략하고 감사위원회에 사후 통지, 옳지 않음)가 KGA 700 문단 46·A63의 두 경우를 나란히 보여 정답 힌트가 된다. v2는 ④와 익명 편지 사실을 없애고, ④를 감사보고서일이 제출일(3월 17일)까지의 사건을 고려하였다는 뜻이라는 업무수행이사의 설명(옳지 않음, KGA 700 문단 A66·KGA 560 문단 10)으로 바꾸었다. 초안 생성기가 물음 2·3과 자료 1·3·4, 기존 출처가 v1과 같음을 단언한다.';
const sub1 = { set_id: set.id, subquestion_id: 'sub1', checks: pass,
    rationale: '①은 KGA 700 문단 49(b)·A67에 따라 옳지 않다(감사보고서일의 기초가 되는 증거에는 이사회가 재무제표에 대한 책임을 진다고 주장했다는 증거가 포함되므로 승인 일정과 관계없다는 판단은 요건에 어긋남). ②는 KGA 700 문단 49·A69에 따라 옳다(주석 포함 작성 3월 8일, 이사회 승인 3월 10일, 필요 절차 완료 3월 12일이므로 3월 12일은 가장 빠른 보고서일이며 주주의 최종승인은 필요하지 않음). ③은 KGA 700 문단 A63에 따라 옳다(법적 책임, 법규 및 전문가적 제재의 위협은 개인의 안전에 대한 위협에 포함되지 않음). ④는 KGA 700 문단 A66과 KGA 560 문단 10에 따라 옳지 않다(감사보고서일은 그날인 3월 12일까지 발생해 감사인이 알게 된 사건과 거래의 영향을 고려하였다는 사실을 알리며, 감사인은 보고서일 후 재무제표에 대한 감사절차를 수행할 의무가 없으므로 제출일 3월 17일까지의 사건이 고려되었다는 설명은 틀림). 이름 공시에 관한 항목은 ③ 하나라서 생략 사유가 되는 위협과 되지 않는 위협을 대비시키지 않는다. c1 식별과 c2·c3이 독립적으로 채점된다.',
    check_rationales: {
        source: 'KGA 700 문단 46·49·A63·A67·A69는 v1과 같은 s05 등록본 발췌다. 새 ④의 근거인 KGA 700 문단 A66은 같은 등록본에서 문단 본문만 발췌했고(각주 번호와 쪽 표시 제외), KGA 560 문단 10은 case-12-post-report-refusal-20260914의 인용(src-571698f8ae613cde46)을 해시 그대로 재사용했다. 초안 검증(--against-bank)의 원문 실존 검사를 통과했다.',
        answer: '모범답안이 c1~c3을 충족한다. 부분정답(함정 ② 선택, ①·④ 이유)=2점, 오답(②·③만 선택, ①·④가 옳다고 명시)=0점, 보조 사례(① 보완절차만, ④ 보고서일 후 절차 의무가 없다는 대안 이유만)=3점, 번호 없이 내용으로 특정한 답=3점, 결론만 되풀이한 답=1점을 원문으로 정했다.',
        prompt: '발문은 v1과 같다(범위 ①~④, 번호와 이유나 보완절차). 사실관계에서 익명 편지 문장을 없앴고 ④는 설명한 내용만 적어 옳고 그름의 근거를 붙이지 않았다.',
        points: '3점. 옳지 않은 항목 두 개에 각 1점, 식별 1점. 감사보고서일의 정의 문구 재현이나 문단 번호는 요구하지 않는다. 함정 ②·③은 식별 기준으로만 평가한다.',
        style: '재무제표 작성·이사회 승인·절차 완료·보고서 제출·주주총회의 날짜와 주주 서한이라는 사실에 기준을 적용해 각 판단의 옳고 그름을 판단해야 하므로 사례형이다. ④도 감사보고서일(3월 12일)과 제출일(3월 17일)의 구별을 사례 날짜에 적용한다.',
        topics: '15(KGA 700 감사보고서일의 결정과 의미, 업무수행이사 이름 공시의 예외). ④의 대안 이유인 KGA 560 문단 10은 보조 근거다.',
        edition: '대상 연도 2027년. 사례의 20X1년을 2026-01-01 개시 보고기간으로 보고 2025 전문을 적용했다. 새로 인용한 KGA 700 문단 A66과 KGA 560 문단 10도 2026 전문과 본문이 같다.',
        nonduplication: '원 pilot-15-007 sub1·sub2 crit1의 요소를 ①~③으로 옮겼고, ④는 원 세트가 인용만 한 문단 A66을 새로 묻는다. v1의 ④가 맡던 이름 생략 시 지배기구와의 의도 논의(문단 46 후단)는 v2에서 빠지며, 현재 은행에서 이를 묻는 물음은 pilot-15-007 sub2뿐이다(design.json nonduplication).' },
    unresolved_content_findings: [] };
const review = {
    ...previous,
    reviewed_at: new Date().toISOString(),
    target: { file, sha256: sha(file), set_id: set.id, reviewed_content_sha256: reviewedContentHash(set) },
    previous_review: { file: `${R}/root-content-review-v1.json`, sha256: sha(`${R}/root-content-review-v1.json`), reviewed_content_sha256: reviewedContentHash(v1) },
    evidence: [`${D}/v2/design.json`, `${D}/v2/lineage.json`, `${D}/v2/qa.json`, `${D}/v2/build-draft.mjs`, `${D}/sets.json`,
        'cpa_uploader/data/official/delegated-s05-kga-2025.txt', 'cpa_uploader/data/official/kga450-560-570-580-2025-review12.txt',
        'cpa_uploader/data/official/delegated-r01-kga-2025.txt',
        'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025-pymupdf-pages.txt', 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt',
        'cpa_uploader/data/회계감사_통합학습자료/04_기출문제/기출문제_연도별_해설_A.md',
        'cpa_uploader/data/cpa_question_sets_v3.authoring.json'].map((f) => ({ file: f, sha256: sha(f) })),
    method_detail: `${previous.method_detail} ${change} v2에서는 새 ④를 KGA 700 문단 A66·KGA 560 문단 2·10과 대조하고, ①·②·③과 한 목록에서 서로의 판단 기준을 알려 주는지, 물음 2·3의 사실(보고서 제출 3월 17일, 합의서 입수 3월 20일)이 ④의 정답을 드러내는지 다시 읽었다. 2014 제49회 문제 1 물음 1과 2020 제55회 문제 3 물음 5의 쟁점과 비교했다.`,
    questions: previous.questions.map((q: { subquestion_id: string }) => (q.subquestion_id === 'sub1' ? sub1 : q)),
    observations_not_blocking: [
        '사실관계는 v2에서 2,081자, 항목 11개다. 원 세 세트의 독립 상황을 한 회사의 시간 순서로 합친 구성과 48번 상황 가의 삭제, 67번 사건의 교체는 v1과 같다.',
        'v2에서 업무수행이사 이름 공시에 관한 항목은 ③(옳음) 하나다. 이름 생략 시 지배기구와의 의도 논의(KGA 700 문단 46 후단)는 이 사례에서 묻지 않으며, 원 세트가 퇴역하면 은행에 이 요구를 묻는 물음이 남지 않는다.',
        '④(감사보고서일의 의미)와 ②(주주총회 승인 전 3월 12일)는 모두 감사보고서일을 다루지만 서로 다른 문단(A66, 49·A69)으로 판단하며 한쪽의 결론이 다른 쪽의 기준을 알려 주지 않는다.',
        '옳지 않은 항목 수는 물음별 2개이며 발문에 밝히지 않는다. 물음 2·3의 검토 판단은 v1과 같다.',
        '작성 agent가 직접 검토했으며 독립 agent 교차검토·사람 확인은 수행하지 않았다.',
    ],
    version_change: change,
};
fs.writeFileSync(`${R}/root-content-review-v2.json`, JSON.stringify(review, null, 2) + '\n', { flag: 'wx' });
console.log(review.target);
