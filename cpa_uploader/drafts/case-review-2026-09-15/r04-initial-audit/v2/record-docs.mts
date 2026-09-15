// r04 v2 설계 장부·계보·대표 답안 기록(한 번만 실행; 기존 파일이 있으면 쓰지 않는다). v1 기록을 바탕으로 대상 해시와 판본 메모만 바꾼다.
//   npx tsx cpa_uploader/drafts/case-review-2026-09-15/r04-initial-audit/v2/record-docs.mts
import fs from 'node:fs';
import { reviewedContentHash } from '../../../../questionReviewIdentity.ts';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r04-initial-audit';
const V2 = `${D}/v2`;
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (name: string, value: unknown) => fs.writeFileSync(`${V2}/${name}`, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const [v1] = read(`${D}/sets.json`), [v2] = read(`${V2}/sets.json`);
const note = 'v2는 KGA 300 발췌본 v2(출처·확인일 두 줄 추가, 문단 3의 소제목 “시행일” 제외)에 맞춰 kga300-13 출처 제목의 줄 표시(L11-L18→L13-L20)만 고친 판본이다. 원자료 카탈로그가 v1 발췌본의 소제목을 판본 설명으로 읽던 문제를 고치기 위한 것이며, 인용 원문·사실관계·발문·모범답안·criterion·대표 답안은 v1과 같다.';

const design = read(`${D}/design.json`);
write('design.json', { ...design, version_note: note, previous: { file: `${D}/design.json`, reviewed_content_sha256: reviewedContentHash(v1) },
    target_reviewed_content_sha256: reviewedContentHash(v2) });
const lineage = read(`${D}/lineage.json`);
write('lineage.json', { ...lineage, target: { ...lineage.target, reviewed_content_sha256: reviewedContentHash(v2) },
    v1_to_v2: { from: { file: `${D}/sets.json`, reviewed_content_sha256: reviewedContentHash(v1) }, change: note } });
write('qa.json', { ...read(`${D}/qa.json`), note_v2: 'v1 qa.json의 대표 답안·보조 사례·기대 판정을 그대로 쓴다. v2의 문항 내용은 출처 제목의 줄 표시 외에 v1과 같다.' });
console.log('v2 design/lineage/qa written', reviewedContentHash(v2));
