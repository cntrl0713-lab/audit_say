// r01 v3 agent 내용 검토 기록(한 번만 실행; 기존 파일이 있으면 쓰지 않는다).
//   npx tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/tools/record-r01v3-review.mts
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewedContentHash } from '../../../../questionReviewIdentity.ts';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r01-group-audit-merge/v3';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r01';
const file = `${D}/sets.json`;
const [set] = JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = (p: string) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const v2 = JSON.parse(fs.readFileSync(`${R}/root-content-review-v2.json`, 'utf8'));
const pass = { source: 'pass', answer: 'pass', prompt: 'pass', points: 'pass', style: 'pass', topics: 'pass', edition: 'pass', nonduplication: 'pass' };
const prior = (id: string) => v2.questions.find((q: { subquestion_id: string }) => q.subquestion_id === id);
const review = {
    version: 3, method: 'agent_content_review', human_review_performed: false,
    reviewer_id: 'agent:claude-opus-5 (author agent; no independent peer review)', reviewed_at: new Date().toISOString(),
    supersedes: { file: `${R}/root-content-review-v2.json`, sha256: sha(`${R}/root-content-review-v2.json`) },
    target: { file, sha256: sha(file), set_id: set.id, reviewed_content_sha256: reviewedContentHash(set) },
    evidence: [`${D}/design.json`, `${D}/lineage.json`, `${D}/qa.json`, `${D}/build-draft.mjs`, 'cpa_uploader/data/official/kga600-2025-review14.txt'].map((f) => ({ file: f, sha256: sha(f) })),
    method_detail: 'v3는 v2의 사실관계·출처를 바이트까지 유지하고(build-draft.mjs의 동일성 검사) 발문·모범답안·criterion만 새 배점 기준으로 바꾸었다. 바뀐 부분을 등록 전문 문단 20·29·A39·A43·A44·A8·45·A63과 다시 대조하고, 각 항목 기준이 이유와 보완절차를 각각 단독으로 인정하는지와 반대 조건을 확인했다. v2 대표 답안 원문의 v3 기대 판정을 실제 채점 전에 정했다.',
    questions: [
        { set_id: set.id, subquestion_id: 'sub1', checks: pass,
            rationale: `식별 c1은 v2와 같다. c2는 ①의 이유(독립성 결격은 관여로 극복 불가, 문단 A39)나 절차(그룹감사인이 직접 증거 입수, 문단 20) 중 하나로, c3은 ④의 이유(증거 부족 예상, 문단 29 전단)나 절차(일부 부문 선정과 추가 업무, 문단 29 후단) 중 하나로 1점을 준다. ④의 이유만 쓸 때에는 분석적절차만으로 부족한 상황이 드러나야 한다는 조건을 두어 일반화 오답을 막는다. 모범답안 세 문장이 각 기준을 충족한다. 사실 판단: ${prior('sub1').rationale}`,
            check_rationales: { ...prior('sub1').check_rationales,
                prompt: '발문은 범위(①~④)와 요구(번호, 이유나 수행하였어야 할 절차를 간략히)만 적는다. v2의 “이유와 올바른 절차를 설명” 요구를 사용자 확정 기준에 맞춰 바꾸었다.',
                points: '3점. 옳지 않은 항목 두 개에 각 1점(이유 또는 보완절차), 식별 1점. v2의 항목당 2점을 줄였다.',
                answer: '모범답안이 c1~c3을 충족한다. v2 부분정답(③ 선택)=2점, v2 오답=0점, 보조 사례(보완절차만)=3점을 원문으로 정했다.' },
            unresolved_content_findings: [] },
        { set_id: set.id, subquestion_id: 'sub2', checks: pass,
            rationale: `식별 c1은 v2와 같다. c2는 ⑦의 이유(부문 수준 판단은 그룹 평가를 대신 못함, 문단 A43·A44·A8)나 절차(같은 방향 과대계상 합산 평가, 문단 45·A63) 중 하나로, c3은 ⑧의 이유(증거 미입수는 미수정왜곡표시가 아님)나 절차(구별해 영향 평가, 문단 45) 중 하나로 1점을 준다. 모범답안 세 문장이 각 기준을 충족한다. 사실 판단: ${prior('sub2').rationale}`,
            check_rationales: { ...prior('sub2').check_rationales,
                prompt: '범위(⑤~⑨)와 요구(번호, 이유나 수행하였어야 할 절차를 간략히)만 적는다.',
                points: '3점. 옳지 않은 항목 두 개에 각 1점, 식별 1점. v2의 ⑦ 2점을 1점으로 줄였다.',
                answer: '모범답안이 c1~c3을 충족한다. v2 부분정답(⑨ 선택, ⑧ 평가 제외)=1점, v2 오답=0점, 보조 사례(이유만)=3점을 원문으로 정했다.' },
            unresolved_content_findings: [] },
    ],
    observations_not_blocking: ['작성 agent가 직접 검토했으며 독립 agent 교차검토·사람 확인은 수행하지 않았다.'],
    unresolved_content_findings: [],
};
fs.writeFileSync(`${R}/root-content-review-v3.json`, JSON.stringify(review, null, 2) + '\n', { flag: 'wx' });
console.log(review.target);
