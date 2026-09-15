// r02 v1 agent 내용 검토 기록(한 번만 실행; 기존 파일이 있으면 쓰지 않는다).
//   npx tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/tools/record-r02-review.mts
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewedContentHash } from '../../../../questionReviewIdentity.ts';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r02-other-information-merge';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r02';
const file = `${D}/sets.json`;
const [set] = JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = (p: string) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const pass = { source: 'pass', answer: 'pass', prompt: 'pass', points: 'pass', style: 'pass', topics: 'pass', edition: 'pass', nonduplication: 'pass' };
fs.mkdirSync(R, { recursive: true });
const review = {
    version: 1, method: 'agent_content_review', human_review_performed: false,
    reviewer_id: 'agent:claude-opus-5 (author agent; no independent peer review)', reviewed_at: new Date().toISOString(),
    target: { file, sha256: sha(file), set_id: set.id, reviewed_content_sha256: reviewedContentHash(set) },
    evidence: [`${D}/design.json`, `${D}/lineage.json`, `${D}/qa.json`, 'cpa_uploader/data/official/kga701-706-710-720-2025-review16.txt',
        'cpa_uploader/data/official/delegated-n06-kga710-720-1100-supplement-2025.txt', 'cpa_uploader/data/official/kga700-705-2025-review15.txt',
        'cpa_uploader/data/official/kga315-330-2025-review06.txt', 'cpa_uploader/data/official/kga330-2025-review07.txt'].map((f) => ({ file: f, sha256: sha(f) })),
    method_detail: '등록 전문 추출본에서 KGA 720 문단 1·6·7·8·10·12~23, 적용자료 A44~A50, KGA 705 문단 7·29, KGA 315 문단 37, KGA 330 문단 6을 읽고 열한 항목의 옳고 그름, 각 criterion의 claim·허용 범위·반대 조건, 모범답안의 충족 여부를 양방향으로 대조했다. 원 60·21의 발문·모범답안·criterion과 비교했다. 문단 10의 시행 적용대상과 사용자 확정 대상 연도 2027년을 대조했다.',
    questions: [
        { set_id: set.id, subquestion_id: 'sub1', checks: pass,
            rationale: '①은 문단 13(a)·(c)에 따라 옳다(감사보고서일 후 완성되는 연차보고서의 발행 전 최종본 제공 서면진술). ②는 문단 7(b)에 따라 투자설명서가 적용 대상이 아니므로 옳지 않다. ③은 문단 16에 따라 옳다(재무제표 감사가 거의 끝났어도 불일치의 원인을 경영진과 논의하고 재무제표 쪽도 조사). ④는 기타정보가 사실이어도 감사인의 이해 갱신이 필요하므로(문단 16(c)·20, KGA 315 문단 37) 옳지 않다. ⑤는 문단 14의 열람과 문단 15의 주의 유지에 어긋나 옳지 않다. 자료 3의 ③ 조사 결과는 옳은 ③과 일치해 앞 항목의 정답을 드러내지 않는다. c1 식별과 c2~c4(이유나 보완절차 한 가지, 핵심 수준)가 독립적으로 채점된다.',
            check_rationales: {
                source: '새 인용(문단 6·7(b)·8·12(b)·13·14·15·21)은 등록 전문의 exact 부분문자열이며 KGA 720 구간 안에 있다. 재사용 인용(16·18·19·20·22·A45·A49·A50, 705.7, 315.37, 330.6)은 원 세트의 해시와 같다. 초안 검증·전체 은행 검사 통과.',
                answer: '모범답안이 c1~c4를 충족한다. 부분정답(③ 선택·⑤ 누락, ②·④ 이유)=2점, 오답(①·③ 선택, ②·④·⑤ 적절 명시)=0점, 보조 사례(보완절차만)=4점을 원문으로 정했다.',
                prompt: '발문은 범위(①~⑤)와 요구(번호, 이유나 수행하였어야 할 절차를 간략히)만 적는다. 원 발문의 결론형 표현을 없앴다.',
                points: '4점. 옳지 않은 항목 세 개에 각 1점, 식별 1점. 사용자 지시에 따라 구체적 후속절차를 요구하지 않는다.',
                style: '사업보고서·연차보고서·투자설명서의 관계, 불일치·가동중단 사실, 읽지 않은 부분을 판단해야 하므로 사례형이다.',
                topics: '16(기타정보), 06·07(④의 위험평가·추가감사절차 수정).',
                edition: '대상 연도 2027년. KGA 720 문단 10상 주권상장법인·직전 사업연도말 자산총액 5천억원 이상이면 2026-01-01 이후 개시 보고기간부터 적용되므로 사실관계의 8천억원 상장기업에 적용된다.',
                nonduplication: '원 60 sub1·sub3의 조치 서술을 옳고 그름 판단으로 바꿨다. 기존 KGA 720 기준서형의 요구 열거와 달리 사례 적용이다.' },
            unresolved_content_findings: [] },
        { set_id: set.id, subquestion_id: 'sub2', checks: pass,
            rationale: '⑥은 KGA 705 문단 7(a)에 따라 한정의견 사유를 기타정보 단락으로 대신했으므로 옳지 않다. ⑦은 문단 18(a)·A45와 사실관계(성실성 의문 없음, 해지 불가)에 따라 옳다. ⑧은 문단 22(e)(ii)에 어긋나 옳지 않다. ⑨는 문단 21(a)·22(b)에 따라 옳다. ⑩은 문단 6·17·19에 따라 옳다. ⑪은 문단 19(b)에 어긋나 옳지 않다. ⑦과 ⑧, ⑩과 ⑪은 서로 모순되지 않는 다른 행위이다. c1 식별과 c2~c4(이유나 보완절차 한 가지)가 독립적으로 채점된다.',
            check_rationales: {
                source: 'KGA 705 문단 7, KGA 720 문단 6·18·19·20·21·22·A45·A49·A50 인용을 criterion에 연결했다.',
                answer: '모범답안이 c1~c4를 충족한다. 부분정답(⑦ 선택·⑧ 누락, ⑥·⑪ 이유)=2점, 오답(⑨·⑩ 선택, ⑥·⑧·⑪ 적절 명시)=0점, 보조 사례(이유만)=4점을 원문으로 정했다.',
                prompt: '범위(⑥~⑪)와 요구만 적는다.',
                points: '4점. 옳지 않은 항목 세 개에 각 1점, 식별 1점.',
                style: '재무제표 왜곡표시와 기타정보 왜곡표시의 구별, 기타정보 단락 기재, 감사보고서일 후 조치를 사실에 적용해야 하므로 사례형이다.',
                topics: '16(기타정보)과 15(⑥의 감사의견).',
                edition: 'sub1과 같은 판본·가정.',
                nonduplication: '원 21 sub1·exp1의 조치 서술을 옳고 그름 판단으로 바꿨다. KGA 705 문단 29(의견거절 시 기타정보 단락 제외)는 이번 사실관계에 맞지 않아 넣지 않았다.' },
            unresolved_content_findings: [] },
    ],
    observations_not_blocking: [
        '사실관계 2,088자, 항목 11개로 원 두 문제보다 길다. 사용자가 요청한 종합 문제 범위이다.',
        '두 물음 모두 옳지 않은 항목이 3개다. 옳지 않은 항목 수는 발문에 밝히지 않는다.',
        '작성 agent가 직접 검토했으며 독립 agent 교차검토·사람 확인은 수행하지 않았다.',
    ],
    unresolved_content_findings: [],
};
fs.writeFileSync(`${R}/root-content-review-v1.json`, JSON.stringify(review, null, 2) + '\n', { flag: 'wx' });
console.log(review.target);
