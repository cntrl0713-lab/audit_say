// qa.json의 supplementary_cases를 run-supplementary.ts 입력 형상으로 옮긴다. 기존 파일이 있으면 쓰지 않는다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r22-uncorrected-misstatement-merge/record-supplementary-input.mjs
import fs from 'node:fs';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r22-uncorrected-misstatement-merge';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r22';
const qa = JSON.parse(fs.readFileSync(`${D}/qa.json`, 'utf8'));
const out = {
    version: 1,
    set_id: qa.set_id,
    note: 'qa.json의 supplementary_cases를 run-supplementary.ts 입력 형상으로 옮긴 것이다. 승급 receipt 분모와 별개인 표적 사례이며 실행 전에 확정한 기대값을 그대로 쓴다.',
    supplementary_cases: qa.supplementary_cases,
};
fs.writeFileSync(`${R}/supplementary-input-v1.json`, `${JSON.stringify(out, null, 2)}\n`, { flag: 'wx' });
console.log('written', `${R}/supplementary-input-v1.json`, '| cases', out.supplementary_cases.length);
