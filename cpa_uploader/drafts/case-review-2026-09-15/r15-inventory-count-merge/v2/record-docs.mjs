// r15 v2의 설계·계보·작성자 QA 장부 기록기. v1 장부를 읽어 발문 변경 사실만 덧붙인다.
//
//   node --import tsx cpa_uploader/drafts/case-review-2026-09-15/r15-inventory-count-merge/v2/record-docs.mjs
//
// 출력: v2/design.json, v2/lineage.json, v2/qa.json (모두 flag 'wx')

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reviewedContentHash } from '../../../../questionReviewIdentity.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const v1 = (name) => JSON.parse(fs.readFileSync(path.join(here, '..', name), 'utf8'));
const [draft] = JSON.parse(fs.readFileSync(path.join(here, 'sets.json'), 'utf8'));
const write = (name, value) => {
    fs.writeFileSync(path.join(here, name), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
    console.log('wrote v2/' + name);
};

const CHANGE =
    'v2에서 두 물음의 발문만 바꾸었다. v1을 만든 뒤 다른 세션이 정본에 설치한 case-10-analytical-procedures-20260920의 발문("자료 2의 ①~⑤ 중 …", "자료 3의 ⑥~⑨ 중 …")과 바이트가 같아 새 정본에 대한 validateAuthoringBank가 발문 중복으로 거절했다. 은행의 다른 선택형 사례가 쓰는 대로 자료 번호 대신 단계 이름("재고자산 실사를 계획하고 실사일에 수행한 절차와 판단 ①~⑤", "실사일 이후 재무제표일까지의 절차와 판단 ⑥~⑨")으로 범위를 정했다. 두 발문 모두 다루는 단계의 범위만 알려 주고 옳지 않은 항목의 수·내용을 알려 주지 않는다. 사실관계·항목·모범답안·criterion·배점·출처는 v1과 같다.';

const design = v1('design.json');
design.version = 2;
design.user_requests.push(`2026-09-20 정본 설치 후 재검증에서 발견한 발문 중복을 고쳤다. ${CHANGE}`);
design.spoiler_review.prompt_change_v2 = CHANGE;
design.target_reviewed_content_sha256 = reviewedContentHash(draft);
design.supersedes = { version: 1, file: 'cpa_uploader/drafts/case-review-2026-09-15/r15-inventory-count-merge/design.json' };
write('design.json', design);

const lineage = v1('lineage.json');
lineage.version = 2;
lineage.prompt_change_v2 = CHANGE;
lineage.supersedes = { version: 1, file: 'cpa_uploader/drafts/case-review-2026-09-15/r15-inventory-count-merge/lineage.json' };
write('lineage.json', lineage);

const qa = v1('qa.json');
qa.version = 2;
qa.note += ' v2는 발문만 바뀌었고 대표·보조 답안과 기대 판정은 v1과 같다. 저장 모범답안도 v1과 같은 바이트다.';
qa.prompt_change_v2 = CHANGE;
qa.supersedes = { version: 1, file: 'cpa_uploader/drafts/case-review-2026-09-15/r15-inventory-count-merge/qa.json' };
write('qa.json', qa);
