// r03 v2 agent 내용 검토 기록(한 번만 실행; 기존 파일이 있으면 쓰지 않는다).
//   npx tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/tools/record-r03v2-review.mts
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewedContentHash } from '../../../../questionReviewIdentity.ts';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r03-payroll-service-merge';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r03';
const file = `${D}/v2/sets.json`;
const [set] = JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = (p: string) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const pass = { source: 'pass', answer: 'pass', prompt: 'pass', points: 'pass', style: 'pass', topics: 'pass', edition: 'pass', nonduplication: 'pass' };
const review = {
    version: 1, method: 'agent_content_review', human_review_performed: false,
    reviewer_id: 'agent:claude-opus-5 (v2 revision author; v1 was authored by another agent session; no independent peer review)', reviewed_at: new Date().toISOString(),
    target: { file, sha256: sha(file), set_id: set.id, reviewed_content_sha256: reviewedContentHash(set) },
    previous_review: { file: `${R}/root-content-review-v1.json`, sha256: sha(`${R}/root-content-review-v1.json`) },
    evidence: [`${D}/v2/design.json`, `${D}/v2/lineage.json`, `${D}/v2/qa.json`, `${D}/v2/build-draft.mjs`, `${D}/sets.json`, `${D}/design.json`,
        'cpa_uploader/data/official/delegated-s03-kga-2025.txt'].map((f) => ({ file: f, sha256: sha(f) })),
    method_detail: '사용자 검토 요청(사실관계가 너무 복잡)에 따라 v1의 사실관계·항목·발문·모범답안·criterion을 등록 전문의 KGA 402 문단 9·16·17·18·A31~A40과 다시 대조했다. v1의 정답 판정과 출처는 맞았고, 쓰이지 않는 사실·비슷한 이름·검토조서 기재 사이의 모순·같은 달의 두 변경을 복잡도의 원인으로 확인했다(design.json review_findings_v1). v2의 여덟 항목과 criterion을 원문과 양방향으로 다시 대조했다.',
    questions: [
        { set_id: set.id, subquestion_id: 'sub1', checks: pass,
            rationale: '①은 402.17(b)의 관련성 결정으로 옳다. ②는 402.18·A40에 따라 감사와 관련된 하위서비스(급여액 산정에 쓰이는 코드 변환)를 보고범위 제외만으로 검토에서 뺄 수 없어 옳지 않다. ③은 문서화된 규정을 설계 이해에 쓴 것으로 17(b)에 맞으며 운영효과성을 입증했다고 하지 않는다. ④는 17(b)가 요구하는 이용자기업 통제의 운영효과성 테스트를 규정과 서비스조직 보고서로 대신해 옳지 않다. ③의 근거 문구(규정이 문서로 정비됨)는 상황 설명이며 옳음을 정당화하는 기준 문구가 아니다.',
            check_rationales: {
                source: 'v1의 KGA 402 인용 7개를 해시 그대로 재사용했다. 초안 검증 통과.',
                answer: '모범답안이 c1~c3를 충족한다. 부분정답(번호만 ②·④)=1점, 오답(①·③ 선택, ②·④ 적절 명시)=0점, 보조 사례(번호 없이 내용으로 특정한 이유)=3점을 원문으로 정했다.',
                prompt: '범위(①~④)와 요구만 적는다.',
                points: '3점. v1과 같다.',
                style: '하위서비스 제외, 보충통제의 전제, 회사 규정이라는 사실을 판단에 적용해야 하므로 사례형이다.',
                topics: '13·06·07(v1과 같음).',
                edition: 'v1과 같은 판본·가정.',
                nonduplication: 'v1의 쟁점을 유지하고 문장만 줄였다.' },
            unresolved_content_findings: [] },
        { set_id: set.id, subquestion_id: 'sub2', checks: pass,
            rationale: '⑤는 402.17(a)·(c)·A32에 따라 1~9월 보고서로 연간 운영을 입증할 수 없어 옳지 않다. ⑥은 A33이 정보시스템·처리절차의 변경도 유의적 변경으로 들므로 담당자가 같다는 이유로 변경이 아니라고 본 것이 옳지 않다. ⑦은 A38에 따라 서비스조직의 승인을 얻어 서비스감사인과 예외를 논의할 수 있어 옳다. ⑧은 A38에 따라 예외가 보고서의 유용성을 자동으로 부정하지 않으므로 옳지 않다. 항목을 감사팀 의견으로 바꾸어 v1의 한 검토조서 안 모순(⑤·⑥·⑧)과 ⑥의 잔여기간 언급이 ⑤의 정답을 드러내던 문제를 없앴다. ⑦의 근거 문구는 예외 발생 위치에 관한 사실이다.',
            check_rationales: {
                source: 'KGA 402.17·A32·A33·A34·A38 인용을 criterion에 연결했다.',
                answer: '모범답안이 c1~c4를 충족한다. 부분정답(⑦ 선택·⑥ 누락, ⑤·⑧ 이유)=2점, 오답(⑦만 선택, ⑤·⑥·⑧ 적절 명시)=0점, 보조 사례(보완절차만)=4점을 원문으로 정했다.',
                prompt: '범위(⑤~⑧)와 요구만 적는다. 의견에 대한 판단이므로 “수행하여야 할 절차”로 썼다.',
                points: '4점. v1과 같다.',
                style: '대상기간·10월 변경·예외 사실을 판단에 적용해야 하므로 사례형이다.',
                topics: '13·07(v1과 같음).',
                edition: 'v1과 같은 판본·가정.',
                nonduplication: 'v1의 쟁점을 유지했다.' },
            unresolved_content_findings: [] },
    ],
    observations_not_blocking: [
        '사실관계는 1,494자에서 1,159자로 줄었고 등장 주체는 감사팀·온유회사·새롬·태림·서비스감사인이다.',
        '옳지 않은 항목 수는 물음별 2·3개이며 발문에 밝히지 않는다.',
        'v1은 다른 agent 세션이 작성했고 v2는 이 세션이 수정·검토했다. 독립 agent 교차검토·사람 확인은 수행하지 않았다.',
    ],
    unresolved_content_findings: [],
};
fs.writeFileSync(`${R}/root-content-review-v2.json`, JSON.stringify(review, null, 2) + '\n', { flag: 'wx' });
console.log(review.target);
