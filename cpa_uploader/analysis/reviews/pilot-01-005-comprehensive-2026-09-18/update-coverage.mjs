import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildSourceCatalog } from '../../../questionSourceCatalog.mjs';
import { questionHash, sourceUnitHash } from '../../coverage/build-coverage.mjs';

const R = 'cpa_uploader/analysis/reviews/pilot-01-005-comprehensive-2026-09-18';
const file = 'cpa_uploader/analysis/coverage/links.json';
const bank = JSON.parse(fs.readFileSync('cpa_uploader/data/cpa_question_sets_v3.authoring.json', 'utf8'));
const dataset = JSON.parse(fs.readFileSync('cpa_uploader/analysis/question-elements/question-elements.json', 'utf8'));
const overlay = JSON.parse(fs.readFileSync(file, 'utf8'));
const catalog = buildSourceCatalog();
const sha = (value) => createHash('sha256').update(value).digest('hex');
const ref = (evidenceFile) => ({ file: evidenceFile, sha256: sha(fs.readFileSync(evidenceFile)) });
const set = bank.find((row) => row.id === 'pilot-01-005');
const question = set?.subquestions.find((row) => row.id === 'sub1');
assert(set && question);

const proposals = [
  {
    id: 'pilot-01-005-comprehensive-20260918-own-share',
    element_id: 'ethics.own-share-audit-fee',
    source_unit_ids: ['src-7e9495ceac6def64f7'],
    criterion_ids: ['sub1.crit1', 'sub1.crit2'],
    reason: '2020·2022 기출의 감사보수 자기주식 수령 쟁점을 새 수임 사례의 정확한 식별과 회계법인 직접 재무적 이해관계 청산 이유에 직접 연결한다.',
  },
  {
    id: 'pilot-01-005-comprehensive-20260918-joint-business',
    element_id: 'ethics.client-material-joint-business',
    source_unit_ids: ['src-cbdae8404682e7ebb9'],
    criterion_ids: ['sub1.crit1', 'sub1.crit3'],
    reason: '2016·2024 기출의 의뢰인에게 중요한 공동사업 쟁점을 새 수임 사례의 정확한 식별과 양 당사자 중요성·관계 해소 이유에 직접 연결한다.',
  },
  {
    id: 'pilot-01-005-comprehensive-20260918-low-fee',
    element_id: 'ethics.low-fee-required-safeguards',
    source_unit_ids: ['src-7f5576107b198d3b0f', 'src-30bdfbe0bd09bb26a5'],
    criterion_ids: ['sub1.crit1', 'sub1.crit4'],
    reason: '2014·2019 기출의 낮은 보수 위협과 안전장치를 새 수임 사례의 정확한 식별, 위협 평가 및 고지·시간·적격한 스태프 조치에 직접 연결한다.',
  },
];
const existing = new Set(overlay.links.map((row) => row.id));
const links = proposals.map((proposal) => {
  assert(!existing.has(proposal.id), `Coverage link already exists: ${proposal.id}`);
  const element = dataset.elements.find((row) => row.id === proposal.element_id);
  assert(element);
  const units = proposal.source_unit_ids.map((id) => {
    const unit = catalog.units.find((row) => row.id === id);
    assert(unit, `Missing source unit: ${id}`);
    return unit;
  });
  for (const id of proposal.criterion_ids) assert(question.criteria.some((criterion) => criterion.id === id));
  return {
    id: proposal.id,
    element_id: proposal.element_id,
    source_unit_ids: proposal.source_unit_ids,
    target: { scope: 'bank', set_id: set.id, subquestion_id: question.id, criterion_ids: proposal.criterion_ids },
    relationship: 'direct',
    review_status: 'reviewed',
    reason: proposal.reason,
    provenance: {
      file: `${R}/content-review-v1.json`,
      sha256: ref(`${R}/content-review-v1.json`).sha256,
      reviewer_kind: 'agent_content_review',
      review_date: '2026-09-18',
      publication: {
        file: `${R}/publication-v1/install-completion.json`,
        sha256: ref(`${R}/publication-v1/install-completion.json`).sha256,
        content_identity: '검토된 3물음·10점 대체본과 published/verified 정본의 reviewedContentHash 일치 및 로컬 설치 검증 완료.',
      },
    },
    snapshot: {
      element_sha256: sha(JSON.stringify(element)),
      question_sha256: questionHash(set, question),
      source_hashes: Object.fromEntries(units.map((unit) => [unit.id, unit.contentHash])),
      source_metadata_hashes: Object.fromEntries(units.map((unit) => [unit.id, sourceUnitHash(unit)])),
    },
  };
});
overlay.links.push(...links);
fs.writeFileSync(file, `${JSON.stringify(overlay, null, 2)}\n`);
fs.writeFileSync(`${R}/coverage-links-v1.json`, `${JSON.stringify({ version: 1, links }, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ appended: links.map((row) => row.id), total_links: overlay.links.length }, null, 2));
