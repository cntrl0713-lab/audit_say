// r10 v3 agent 내용 검토 기록(한 번만 실행; 기존 파일이 있으면 쓰지 않는다). v2 검토를 바탕으로 바뀐 물음 1의 ①을 다시 검토한다.
//   npx tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/tools/record-r10v3-review.mts
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewedContentHash } from '../../../../questionReviewIdentity.ts';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r10-report-date-subsequent-merge';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r10';
const file = `${D}/v3/sets.json`;
const [set] = JSON.parse(fs.readFileSync(file, 'utf8'));
const [v2] = JSON.parse(fs.readFileSync(`${D}/v2/sets.json`, 'utf8'));
const sha = (p: string) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const previous = JSON.parse(fs.readFileSync(`${R}/root-content-review-v2.json`, 'utf8'));
const pass = { source: 'pass', answer: 'pass', prompt: 'pass', points: 'pass', style: 'pass', topics: 'pass', edition: 'pass', nonduplication: 'pass' };
const change = '사용자 지시(2026-09-19): 주주총회 승인을 이사회 승인으로 착각하도록 한 ②를 함정으로 두고 ①을 대체한다. v2의 ①(감사보고서일은 이사회 승인 일정과 관계없다는 판단)과 ②(주주총회 최종 승인 전 3월 12일)는 감사보고서일 전에 필요한 승인과 필요 없는 승인의 두 경우를 함께 보였다. v3은 ①을 감사위원회에 독립성 준수 확인서를 제출한 것으로 충분하다고 보고 감사의견근거 단락에서 독립성·윤리적 책임 기술을 빼기로 한 판단(옳지 않음, KGA 700 문단 28(c))으로 바꾸었다. 초안 생성기가 물음 2·3, 자료 1·3·4, 자료 2의 ②~④가 v2와 같음을 단언한다. 같은 요청으로 학습 단위 계약의 사례형 기준(대조되는 두 경우를 한 사례에 함께 두지 않음)을 고쳤다.';
const sub1 = { set_id: set.id, subquestion_id: 'sub1', checks: pass,
    rationale: '①은 KGA 700 문단 28(c)에 따라 옳지 않다(감사의견근거 단락에는 감사인이 윤리적 요구사항에 따라 기업으로부터 독립적이며 기타의 윤리적 책임을 이행하였다는 기술을 포함해야 하고, 감사위원회에 대한 독립성 준수 확인서 제출이 이를 대신하지 않음). ②는 KGA 700 문단 49·A69에 따라 옳다(주석 포함 작성 3월 8일, 이사회 승인 3월 10일, 필요 절차 완료 3월 12일이므로 3월 12일은 가장 빠른 보고서일이며 주주의 최종승인은 필요하지 않음). 이사회 승인이 필요하다는 짝 항목이 없어져 주주총회 승인을 이사회 승인과 혼동하게 하는 함정으로만 작동한다. ③은 KGA 700 문단 A63에 따라 옳다(법적 책임, 법규 및 전문가적 제재의 위협은 개인의 안전에 대한 위협에 포함되지 않음). ④는 KGA 700 문단 A66과 KGA 560 문단 10에 따라 옳지 않다(감사보고서일은 3월 12일까지 발생해 알게 된 사건과 거래의 영향을 고려하였다는 사실을 알리며 제출일까지의 사건은 포함하지 않음). 네 항목 가운데 같은 기준에서 결론이 갈리는 두 경우를 함께 보이는 쌍은 없다(②는 문단 49·A69, ④는 문단 A66으로 판단하고 한쪽의 결론이 다른 쪽의 기준을 알려 주지 않음). c1 식별과 c2·c3이 독립적으로 채점된다.',
    check_rationales: {
        source: 'KGA 700 문단 28은 주제15 등록본(kga700-705-2025-review15.txt의 KGA 700 구간)에서 문단 본문만 발췌했다. 쓰지 않게 된 문단 A67은 출처에서 뺐다. 나머지 출처는 v2와 같고, 모든 출처가 criterion이나 requirement에 쓰인다는 것을 생성기가 단언한다. 초안 검증(--against-bank)의 원문 실존 검사를 통과했다.',
        answer: '모범답안이 c1~c3을 충족한다. 부분정답(함정 ② 선택, ①·④ 이유)=2점, 오답(②·③만 선택, ①·④가 옳다고 명시)=0점, 보조 사례(① 보완절차만, ④ 대안 이유만)=3점, 번호 없이 내용으로 특정한 답=3점, 결론만 되풀이한 답=1점을 원문으로 정했다.',
        prompt: '발문은 v1·v2와 같다. ①은 판단 내용만 적었고 “충분하다고 보고”는 옳은 항목(② “최종 승인되기 전인”, ⑤ “이미 제출하였으므로”)의 근거 문구와 형태가 다르다.',
        points: '3점. 옳지 않은 항목 두 개에 각 1점, 식별 1점. 윤리적 요구사항의 원천(관할지) 표시와 문단 번호, 감사보고서일 정의의 원문 재현은 요구하지 않는다. 함정 ②·③은 식별 기준으로만 평가한다.',
        style: '보고서 작성 판단, 재무제표 작성·이사회 승인·절차 완료·보고서 제출·주주총회의 날짜, 주주 서한이라는 사실에 기준을 적용해 각 판단의 옳고 그름을 판단해야 하므로 사례형이다.',
        topics: '15(KGA 700 감사의견근거 단락의 독립성 기술, 감사보고서일의 결정과 의미, 업무수행이사 이름 공시의 예외). ④의 대안 이유인 KGA 560 문단 10은 보조 근거다.',
        edition: '대상 연도 2027년. 사례의 20X1년을 2026-01-01 개시 보고기간으로 보고 2025 전문을 적용했다. 새로 인용한 KGA 700 문단 28도 2026 전문과 본문이 같다.',
        nonduplication: '원 pilot-15-007 sub1(감사보고서일)은 ②의 함정, sub2 crit1은 ③으로 남았다. ①의 감사의견근거 단락 독립성 기술(700.28(c))은 pilot-15-001 subq1(두 단락의 배치와 제목)과 다르고, r11 ⑫·std-points-20260914-817048b7fa92 sub2(의견거절 시 감사인의 책임 단락, 705.28)와도 보고서 단락이 다르다.' },
    unresolved_content_findings: [] };
const review = {
    ...previous,
    reviewed_at: new Date().toISOString(),
    target: { file, sha256: sha(file), set_id: set.id, reviewed_content_sha256: reviewedContentHash(set) },
    previous_review: { file: `${R}/root-content-review-v2.json`, sha256: sha(`${R}/root-content-review-v2.json`), reviewed_content_sha256: reviewedContentHash(v2) },
    evidence: [`${D}/v3/design.json`, `${D}/v3/lineage.json`, `${D}/v3/qa.json`, `${D}/v3/build-draft.mjs`, `${D}/v2/sets.json`,
        'cpa_uploader/data/official/kga700-705-2025-review15.txt', 'cpa_uploader/data/official/delegated-s05-kga-2025.txt',
        'cpa_uploader/data/official/kga450-560-570-580-2025-review12.txt', 'cpa_uploader/data/official/delegated-r01-kga-2025.txt',
        'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025-pymupdf-pages.txt', 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt',
        'cpa_uploader/drafts/case-review-2026-09-15/r11-scope-limitation-disclaimer/sets.json',
        'docs/물음별-학습-단위와-분류-계약.md',
        'cpa_uploader/data/cpa_question_sets_v3.authoring.json'].map((f) => ({ file: f, sha256: sha(f) })),
    method_detail: `${previous.method_detail} ${change} v3에서는 새 ①을 KGA 700 문단 28(2025·2026 전문 비교)과 대조하고, 은행의 pilot-15-001·std-points-20260914-817048b7fa92와 다른 세션 r11 초안의 독립성 기술 항목과 겹치는지 확인했다. 개정한 사례형 기준으로 세 물음의 모든 항목 쌍을 다시 읽어 같은 기준에서 결론이 갈리는 두 경우가 남지 않았는지 확인했다.`,
    questions: previous.questions.map((q: { subquestion_id: string }) => (q.subquestion_id === 'sub1' ? sub1 : q)),
    observations_not_blocking: [
        '사실관계는 v3에서 2,072자, 항목 11개다. 원 세 세트의 독립 상황을 한 회사의 시간 순서로 합친 구성, 48번 상황 가의 삭제, 67번 사건의 교체는 v1과 같다.',
        '감사보고서일의 증거 조건(이사회 승인 등)은 ②의 함정 판단으로만 묻고 옳지 않은 항목의 이유로는 묻지 않는다. 이름 생략 시 지배기구와의 의도 논의(KGA 700 문단 46 후단)는 v2부터 묻지 않으며, 원 세트가 퇴역하면 은행에 이 요구를 묻는 물음이 남지 않는다.',
        '개정한 사례형 기준으로 본 물음 2·3: ⑤는 보고서 제출 뒤 수정 거부라는 한 상황의 대응이고, ⑨(보고서 전체 일자 변경)·⑩(추가 일자를 승인일로)은 같은 문단의 서로 다른 잘못이며, ⑪은 허용되는 보고 방법 하나여서 같은 조건의 두 경우를 함께 보이는 쌍은 없다고 판단했다.',
        '옳지 않은 항목 수는 물음별 2개이며 발문에 밝히지 않는다. 물음 2·3의 검토 판단은 v1과 같다.',
        '작성 agent가 직접 검토했으며 독립 agent 교차검토·사람 확인은 수행하지 않았다.',
    ],
    version_change: change,
};
fs.writeFileSync(`${R}/root-content-review-v3.json`, JSON.stringify(review, null, 2) + '\n', { flag: 'wx' });
console.log(review.target);
