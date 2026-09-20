// 대표·보조 실측을 마친 뒤 다른 세션이 r12 세트를 정본에 설치하여 정본 해시가 바뀌었다.
// execution-v1의 고정 입력인 baseline-v1.json은 그대로 두고, 새 정본으로 후보 은행을 다시 읽어
// 검증 결과만 baseline-recheck-v1.json에 남긴다. 정본·카탈로그 파일은 쓰지 않는다.
//
//   node --import tsx cpa_uploader/drafts/case-review-2026-09-15/r15-inventory-count-merge/recheck-baseline.mjs

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileLearningCatalog } from '../../../../scripts/build-learning-unit-catalog.ts';
import { validateAuthoringBank } from '../../../questionBankPublication.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const BANK = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const CATALOG = 'cpa_uploader/data/learning-question-classifications.json';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r15';
const DRAFT = 'cpa_uploader/drafts/case-review-2026-09-15/r15-inventory-count-merge/sets.json';
const SET_ID = 'case-09-inventory-count-20260920';

const abs = (file) => path.join(root, file);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const ref = (file) => ({ file, sha256: hash(fs.readFileSync(abs(file))) });
const read = (file) => JSON.parse(fs.readFileSync(abs(file), 'utf8'));
const serialize = (value) => JSON.stringify(value, null, 2) + '\n';

const bank = read(BANK);
const catalog = read(CATALOG);
const review = read(catalog.review_file);
const [draft] = read(DRAFT);
if (draft.id !== SET_ID) throw new Error('set id 불일치');
if (catalog.source_file_sha256 !== ref(BANK).sha256) throw new Error('현재 카탈로그가 현재 정본을 가리키지 않습니다');
if (review.source_file_sha256 !== ref(BANK).sha256) throw new Error('현재 분류 검토가 현재 정본을 가리키지 않습니다');
if (bank.some((set) => set.id === SET_ID)) throw new Error('이 회차는 새 세트 ID를 더합니다');

const previous = read(`${R}/baseline-v1.json`);
const classification = read(`${R}/classification-v1.json`);
const full = [...bank, draft];
const checked = validateAuthoringBank(full);
const [v2] = read('cpa_uploader/drafts/case-review-2026-09-15/r15-inventory-count-merge/v2/sets.json');
const checkedV2 = validateAuthoringBank([...bank, v2]);
if (checkedV2.errors.length > 0) throw new Error('v2 validateAuthoringBank 오류: ' + checkedV2.errors.join(' | '));
compileLearningCatalog([...bank, v2], [...review.entries, ...classification.entries], catalog.topics);

const out = {
    version: 1,
    purpose:
        '대표·보조 실측(execution-v1)을 마친 뒤 정본이 바뀌어 baseline-v1.json의 정본 해시가 과거 값이 되었다. execution-v1의 고정 입력을 보존하려고 baseline-v1.json은 그대로 두고, 새 정본으로 후보 은행을 다시 검증한 결과만 여기에 남긴다. 채점 은행은 이 초안만 담은 부분 은행(candidate-v1.json)이므로 재채점하지 않았다.',
    rechecked_at: new Date().toISOString(),
    previous_baseline: {
        file: `${R}/baseline-v1.json`,
        bank_sha256: previous.bank.sha256,
        catalog_sha256: previous.catalog.sha256,
        sets: previous.sets,
        questions: previous.questions,
    },
    bank: ref(BANK),
    catalog: ref(CATALOG),
    classification_review: ref(catalog.review_file),
    sets: bank.length,
    questions: bank.reduce((n, s) => n + s.subquestions.length, 0),
    draft: ref(DRAFT),
    draft_unchanged: ref(DRAFT).sha256 === previous.draft.sha256,
    bank_change: {
        added: ['case-10-analytical-procedures-20260920'],
        removed: ['case-10-completion-analytics-20260914', 'pilot-10-007'],
        note: '다른 세션의 r12 설치다. 추가된 세트는 KGA 315·520을 인용하고 KGA 501·530 인용이 없어 이 회차의 중복 대조 결과가 바뀌지 않는다. 퇴역한 두 세트도 KGA 501·530을 인용하지 않아 이 회차의 비교 대상이 아니었다.',
    },
    r15_source_sets_still_active: ['draft-09-501-freq01', 'case-09-inventory-location-population-20260914'].filter((id) => bank.some((set) => set.id === id)),
    v1_draft_against_new_bank: {
        written: false,
        sha256: hash(serialize(full)),
        sets: full.length,
        questions: checked.subquestionCount,
        criteria: checked.criterionCount,
        points: checked.totalPoints,
        validate_authoring_bank_errors: checked.errors,
        note: '새 정본 뒤에 v1 초안을 붙인 전체 후보를 메모리에서 검증했다. 새로 설치된 case-10-analytical-procedures-20260920의 두 발문과 v1의 두 발문이 바이트가 같아 발문 중복 오류가 났다. 이 발견 때문에 v2에서 발문만 고쳤다.',
    },
    v2_draft_against_new_bank: {
        written: false,
        draft: ref('cpa_uploader/drafts/case-review-2026-09-15/r15-inventory-count-merge/v2/sets.json'),
        sets: bank.length + 1,
        questions: checkedV2.subquestionCount,
        criteria: checkedV2.criterionCount,
        points: checkedV2.totalPoints,
        validate_authoring_bank_errors: checkedV2.errors,
        note: 'v2 초안으로 다시 검증하여 오류 0개를 확인하고 분류도 함께 컴파일했다. 전체 은행 사본은 쓰지 않았고 정본·카탈로그 파일도 쓰지 않았다. 같은 내용을 baseline-v2.json이 회차 장부로도 기록한다.',
    },
};

fs.writeFileSync(abs(`${R}/baseline-recheck-v1.json`), serialize(out), { flag: 'wx' });
console.log(JSON.stringify({ sets: out.sets, questions: out.questions, v1_errors: out.v1_draft_against_new_bank.validate_authoring_bank_errors, v2_errors: out.v2_draft_against_new_bank.validate_authoring_bank_errors, draft_unchanged: out.draft_unchanged }, null, 2));
