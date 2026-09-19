import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewedContentHash } from '../../../questionReviewIdentity.ts';

const D = 'cpa_uploader/drafts/pilot-01-005-comprehensive-2026-09-18';
const R = 'cpa_uploader/analysis/reviews/pilot-01-005-comprehensive-2026-09-18';
const [set] = JSON.parse(fs.readFileSync(`${D}/sets.json`, 'utf8'));
const sha = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const evidenceFiles = [
  `${D}/sets.json`, `${D}/design.json`, `${D}/qa.json`, `${D}/lineage.json`, `${D}/build-draft.mjs`,
  'cpa_uploader/data/official/delegated-n01-ethics-2024.txt',
  'cpa_uploader/data/official/point-review-a-source-followup-2026-09-11.txt',
  'cpa_uploader/data/official/delegated-s01-kga200-210-220-320-2025.txt',
  'cpa_uploader/data/회계감사_통합학습자료/03_문제연습/고급_회계감사_연습.md',
];
const checks = { source: 'pass', answer: 'pass', prompt: 'pass', points: 'pass', style: 'pass', topics: 'pass', edition: 'pass', nonduplication: 'pass' };
const allSources = (question: typeof set.subquestions[number]) => [...new Set([
  ...question.requirements.map((row: { source_ref_id: string }) => row.source_ref_id),
  ...question.criteria.flatMap((row: { source_ref_ids: string[] }) => row.source_ref_ids),
])];
const review = {
  set_id: set.id,
  content_hash: reviewedContentHash(set),
  reviewer_id: 'agent:codex-gpt-5 (author agent; no independent peer review)',
  reviewed_at: new Date().toISOString(),
  method: 'agent_content_review',
  human_review_performed: false,
  evidence: evidenceFiles.map((file) => ({ file, sha256: sha(file) })),
  questions: [
    {
      subquestion_id: 'sub1',
      criterion_ids: set.subquestions[0].criteria.map((row: { id: string }) => row.id),
      source_ref_ids: allSources(set.subquestions[0]),
      checks,
      rationale: '①은 회계법인 자체의 직접 재무적 이해관계로서 청산이 필요하고, ②는 양 당사자 모두에 중요하지 않고 명백하게 경미해야 하는 예외를 의뢰인 중요성 때문에 충족하지 못한다. ③은 낮은 보수 자체를 비윤리로 단정하여 문단 240.1의 위협 평가와 240.2의 안전장치를 누락하므로 부적절하며, ④는 그 안전장치의 예시와 일치한다. 정확한 식별 1점과 세 부적절 항목의 이유·수정 각 1점은 서로 독립적이다. 2014·2019 낮은 보수, 2016·2024 공동사업, 2020·2022 주식보수 기출 요소를 하나의 수임 상황에 적용하므로 기존 단일 회상형과 구별된다.',
    },
    {
      subquestion_id: 'sub2',
      criterion_ids: set.subquestions[1].criteria.map((row: { id: string }) => row.id),
      source_ref_ids: allSources(set.subquestions[1]),
      checks,
      rationale: '①은 KGA 220 문단 9의 전 과정 관찰·질문, ③은 문단 11의 정보 입수·위협 평가·안전장치 또는 업무해지와 일치한다. ②는 위반 징후를 알게 된 뒤 내부 자문과 적합한 조치의 결정을 생략하고, ④는 해결할 수 없는 사항의 신속한 보고를 보고서 발행 때까지 늦추므로 부적절하다. 정확한 식별과 두 조치의 이유가 독립 득점이며, 수임 단계의 윤리판단을 감사 수행 중 책임으로 확장한다.',
    },
    {
      subquestion_id: 'sub3',
      criterion_ids: set.subquestions[2].criteria.map((row: { id: string }) => row.id),
      source_ref_ids: allSources(set.subquestions[2]),
      checks,
      rationale: '①은 KGA 220 문단 19(a)·(b)에 맞다. ②는 보고서일이 실제 검토 종료일보다 앞설 수 없다는 문단 19(c)를 위반하고 A26의 보고서일 후 문서 최종 정리를 남은 검토 수행과 혼동한다. ③은 의견 차이를 처리·해결할 회계법인의 정책과 절차를 따르라는 문단 22를 위반한다. ④는 실제 검토와 의견 차이 해결이 끝났다는 전제에서 A26과 일치한다. 정확한 식별과 두 오류의 수정이 독립 득점이고, pilot-01-006의 열거형과 달리 시점·미해결 의견 차이를 사례 사실에 적용한다.',
    },
  ],
  unresolved_content_findings: [],
};
fs.mkdirSync(R, { recursive: true });
fs.writeFileSync(`${R}/content-review-v1.json`, `${JSON.stringify(review, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ set_id: set.id, content_hash: review.content_hash, questions: review.questions.length }, null, 2));
