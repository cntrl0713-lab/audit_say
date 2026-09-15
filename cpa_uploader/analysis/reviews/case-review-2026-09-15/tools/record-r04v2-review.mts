// r04 v2 agent 내용 검토 기록(한 번만 실행; 기존 파일이 있으면 쓰지 않는다). v1 검토를 바탕으로 대상과 판본 변경 확인만 더한다.
//   npx tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/tools/record-r04v2-review.mts
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewedContentHash } from '../../../../questionReviewIdentity.ts';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r04-initial-audit';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r04';
const file = `${D}/v2/sets.json`;
const [set] = JSON.parse(fs.readFileSync(file, 'utf8'));
const [v1] = JSON.parse(fs.readFileSync(`${D}/sets.json`, 'utf8'));
const sha = (p: string) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const previous = JSON.parse(fs.readFileSync(`${R}/root-content-review-v1.json`, 'utf8'));
const change = 'v2는 KGA 300 발췌본 v2(출처·확인일 두 줄 추가, 문단 3의 소제목 “시행일” 제외)에 맞춰 kga300-13 출처 제목의 줄 표시만 L11-L18에서 L13-L20으로 고쳤다. 초안 생성기가 나머지 내용이 v1과 같음을 단언하며, 인용 원문과 content_hash, 사실관계·발문·모범답안·criterion·대표 답안은 바뀌지 않았으므로 v1의 문항별 검토 판단을 그대로 유지한다.';
const review = {
    ...previous,
    reviewed_at: new Date().toISOString(),
    target: { file, sha256: sha(file), set_id: set.id, reviewed_content_sha256: reviewedContentHash(set) },
    previous_review: { file: `${R}/root-content-review-v1.json`, sha256: sha(`${R}/root-content-review-v1.json`), reviewed_content_sha256: reviewedContentHash(v1) },
    evidence: [`${D}/v2/design.json`, `${D}/v2/lineage.json`, `${D}/v2/qa.json`, `${D}/v2/build-draft.mjs`, `${D}/sources/extract-kga300.mjs`,
        'cpa_uploader/data/official/case-review-2026-09-15-kga300.md', 'cpa_uploader/data/official/delegated-s03-kga-2025.txt',
        'cpa_uploader/data/official/kga501-505-510-2025-review09.txt', 'cpa_uploader/data/official/kga500-2025-review08.txt',
        'cpa_uploader/data/official/delegated-n02-kga315-2025.txt', 'cpa_uploader/data/official/kga701-706-710-720-2025-review16.txt'].map((f) => ({ file: f, sha256: sha(f) })),
    method_detail: `${previous.method_detail} ${change} v2 등록본의 문단 13 인용이 파일 안에 한 번만 있고 KGA 300 구간에 속하는지, 원자료 카탈로그가 앞 12줄에서 읽는 판본 설명이 출처·확인일 두 줄뿐인지 다시 확인했다.`,
    version_change: change,
};
fs.writeFileSync(`${R}/root-content-review-v2.json`, JSON.stringify(review, null, 2) + '\n', { flag: 'wx' });
console.log(review.target);
