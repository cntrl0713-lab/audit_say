// 운영 반영 전 재실측용 내용 검토 기록(한 번만 실행; 기존 파일이 있으면 쓰지 않는다).
// r01 v3·r02 v1 실행 manifest가 고정한 authorization.md 해시가 뒤에 추가된 사용자 결정으로 달라져 승급 검증을 통과할 수 없으므로,
// 같은 초안에 대한 기존 검토 판단을 그대로 옮기고 새 실행 판본(r01 v4, r02 v2)의 입력으로 쓴다.
//   npx tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/tools/record-rerun-reviews.mts
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { reviewedContentHash } from '../../../../questionReviewIdentity.ts';

const B = 'cpa_uploader/analysis/reviews/case-review-2026-09-15';
const DR = 'cpa_uploader/drafts/case-review-2026-09-15';
const sha = (p: string) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const jobs = [
    { round: 'r01', from: 'v3', to: 'v4', draft: `${DR}/r01-group-audit-merge/v3/sets.json`, oldManifest: `${B}/r01/execution-v3/grading-manifest.json` },
    { round: 'r02', from: 'v1', to: 'v2', draft: `${DR}/r02-other-information-merge/sets.json`, oldManifest: `${B}/r02/execution-v1/grading-manifest.json` },
];
for (const job of jobs) {
    const previousFile = `${B}/${job.round}/root-content-review-${job.from}.json`;
    const previous = read(previousFile), [set] = read(job.draft);
    assert.equal(previous.target.reviewed_content_sha256, reviewedContentHash(set), `${job.round}: draft changed after review`);
    const recorded = read(job.oldManifest).inputs.find((i: { file: string }) => i.file === `${B}/authorization.md`);
    assert(recorded && recorded.sha256 !== sha(`${B}/authorization.md`), `${job.round}: the old manifest still matches authorization.md`);
    const review = {
        ...previous,
        reviewed_at: new Date().toISOString(),
        target: { file: job.draft, sha256: sha(job.draft), set_id: set.id, reviewed_content_sha256: reviewedContentHash(set) },
        previous_review: { file: previousFile, sha256: sha(previousFile) },
        rerun_reason: `운영 반영 전 재실측: ${job.oldManifest}가 입력으로 고정한 ${B}/authorization.md 해시(${recorded.sha256})가 이후 사용자 결정 추가로 현재 파일(${sha(`${B}/authorization.md`)})과 달라 승급 검증이 이 실행 증거를 읽을 수 없다. 초안과 문항별 검토 판단은 ${job.from}과 같고 새 실행 판본 ${job.to}에서 같은 대표 답안을 다시 채점한다.`,
    };
    const out = `${B}/${job.round}/root-content-review-${job.to}.json`;
    fs.writeFileSync(out, JSON.stringify(review, null, 2) + '\n', { flag: 'wx' });
    console.log(out, review.target.reviewed_content_sha256);
}
