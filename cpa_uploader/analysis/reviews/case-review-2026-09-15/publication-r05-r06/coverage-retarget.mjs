// 퇴역하는 원 사례형 세트를 가리키던 은행 대상 coverage 관계 1건을 대체 문항으로 다시 연결한다(정본 설치 뒤 한 번 실행).
// 초안 대상(target.scope=draft) 관계 9건은 보존된 초안 파일을 가리키므로 바꾸지 않는다.
//   node --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r05-r06/coverage-retarget.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { questionHash, sourceUnitHash } from '../../../coverage/build-coverage.mjs';
import { buildSourceCatalog } from '../../../../questionSourceCatalog.mjs';
import { assertRelationship, checkCoverageBeforeWrite } from '../../case-trio-next-2026-09-14/helpers/coverage-contract.mjs';

const P = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r05-r06', file = 'cpa_uploader/analysis/coverage/links.json';
const read = (f) => JSON.parse(fs.readFileSync(f)), hash = (x) => createHash('sha256').update(x).digest('hex'), ref = (f) => ({ file: f, sha256: hash(fs.readFileSync(f)) });
const write = (f, v) => { fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n', { flag: 'wx' }); return ref(f); };
assert.equal(read(P + '/install-completion.json').status, 'canonical_installed_and_validated');
const plan = read(P + '/plan.json'), retired = plan.rounds.flatMap((r) => r.retires);
const decisions = [
    { id: 'case-additional-20260914-04-materiality-revision', set_id: 'case-04-materiality-20260917', subquestion_id: 'sub2', criterion_ids: ['sub2.c1'], relationship: 'partial', source_unit_ids: ['src-0daaa18eaf14f4f6a8', 'src-24bfa3ad9356517e75'],
        reason: '원 대상 case-04-materiality-reset-20260914/sub1은 r06 병합으로 퇴역했다. 원 sub1.c1(최초 중요성 고정 제안이 부적절하다는 판단)·c2(사업처분·계약종료에 따른 수익구조 변화와 최초 예측의 큰 차이를 새 정보로 연결하는 설명)는 KGA 320 문단 12·A14(감사 중 알게 된 정보로 전체 중요성을 다르게 결정했을 경우의 수정)의 사례 적용을 판단+근거 서술형으로 배점했다. 대체 세트 sub2의 ④는 같은 유형의 사실(사업부문 처분·계약종료로 실제 이익 전망이 최초 예측과 크게 달라짐)에서 중요성을 낮춰 수정한 절차를 옳음으로 제시하고, 같은 근거(문단 12·A14)를 sub2.c1의 source_ref_ids로 쓴다. 다만 새 세트는 선택형이라 ④를 포함한 다섯 항목의 옳고 그름을 한 번에 식별하는 sub2.c1 1점만 관련되고 원 세트처럼 판단·근거를 분리한 서술을 요구하지 않으므로 direct가 아니라 partial을 유지한다. ⑤~⑦의 수행중요성 재검토·추가감사절차·문서화(sub2.c2~c4)는 이 대표 연결에 포함하지 않는다.' },
];
const bytes = fs.readFileSync(file), data = JSON.parse(bytes), bank = read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const elements = read('cpa_uploader/analysis/question-elements/question-elements.json').elements, units = buildSourceCatalog().units;
const bankTargets = data.links.filter((l) => l.target && l.target.scope !== 'draft' && retired.includes(l.target.set_id));
assert.deepEqual(bankTargets.map((l) => l.id).sort(), decisions.map((d) => d.id).sort(), 'Every bank relationship to a retired set must be decided');
for (const id of retired) assert(!bank.some((s) => s.id === id), 'Retired set still in canonical bank: ' + id);
const review = write(P + '/coverage-retarget-review.json', { version: 1, method: 'agent_relationship_review', human_review_performed: false,
    reviewer_id: 'agent:claude-sonnet-5 (publication author agent; not an independent peer review)', reviewed_at: new Date().toISOString(),
    basis: '퇴역·대체 이력(plan.json)과 대체 문항의 발문·항목·criterion, 원 관계의 요소·원출제·답안 비교·원자료 단위를 대조했다.',
    plan: ref(P + '/plan.json'), links: decisions.map((d) => ({ ...d, decision: 'retarget_to_replacement' })), unresolved_findings: [],
    unchanged_draft_links: data.links.filter((l) => l.target?.scope === 'draft' && retired.includes(l.target.set_id)).map((l) => l.id) });
const candidate = structuredClone(data);
for (const d of decisions) {
    const link = candidate.links.find((l) => l.id === d.id), previous = structuredClone(link);
    const set = bank.find((s) => s.id === d.set_id), q = set?.subquestions.find((x) => x.id === d.subquestion_id);
    assert(q && set.status === 'published', d.id); assert(d.criterion_ids.every((id) => q.criteria.some((c) => c.id === id)));
    const element = elements.find((e) => e.id === link.element_id); assert(element, link.element_id);
    const sourceIds = d.source_unit_ids ?? link.source_unit_ids;
    const sources = sourceIds.map((id) => { const u = units.find((x) => x.id === id); assert(u, id); return u; });
    Object.assign(link, { source_unit_ids: sourceIds, target: { set_id: set.id, subquestion_id: q.id, criterion_ids: d.criterion_ids }, relationship: d.relationship, review_status: 'reviewed', reason: d.reason,
        snapshot: { element_sha256: hash(JSON.stringify(element)), question_sha256: questionHash(set, q), source_hashes: Object.fromEntries(sources.map((u) => [u.id, u.contentHash])), source_metadata_hashes: Object.fromEntries(sources.map((u) => [u.id, sourceUnitHash(u)])) },
        provenance: { ...previous.provenance, retargeted: { reason: 'retired_and_replaced', previous_target: previous.target, previous_relationship: previous.relationship, previous_reason: previous.reason,
            previous_source_unit_ids: previous.source_unit_ids, previous_snapshot: previous.snapshot, review, publication: ref(P + '/install-completion.json'), human_review_performed: false } } });
    assertRelationship(link);
}
assert.equal(candidate.links.length, data.links.length);
for (const [i, l] of candidate.links.entries()) if (!decisions.some((d) => d.id === l.id)) assert.deepEqual(l, data.links[i], 'Unrelated relationship changed: ' + l.id);
assert.equal(hash(fs.readFileSync(file)), hash(bytes), 'Concurrent coverage edit');
const assembled = checkCoverageBeforeWrite({ overlay: candidate, dataset: read('cpa_uploader/analysis/question-elements/question-elements.json'), bank, catalog: buildSourceCatalog(), addedIds: decisions.map((d) => d.id) });
assert.equal(hash(fs.readFileSync(file)), hash(bytes), 'Concurrent coverage edit after assemble validation');
fs.writeFileSync(P + '/coverage-links-before.json', bytes, { flag: 'wx' });
fs.writeFileSync(file, JSON.stringify(candidate, null, 2) + '\n');
write(P + '/coverage-update.json', { created_at: new Date().toISOString(), before: ref(P + '/coverage-links-before.json'), after: ref(file), retargeted_link_ids: decisions.map((d) => d.id), review,
    assembled_before_write: assembled, other_links_preserved: true, frequency_inputs_changed: false, human_review_performed: false });
console.log({ retargeted: decisions.length, total_links: candidate.links.length, assembled });
