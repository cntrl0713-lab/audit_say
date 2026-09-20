// 퇴역하는 원 두 세트를 가리키던 은행 대상 coverage 관계 1건을 대체 문항으로 다시 연결한다(정본 설치 뒤 한 번 실행). publication-r07-r11/coverage-retarget.mjs를 옮겼다.
// 초안 대상(target.scope=draft) 관계 4건(모두 pilot-10-007을 가리키는 delegated-authoring 초안)은 보존된 초안 파일을 가리키므로 바꾸지 않는다. 반영 전 links.json 사본은 커밋하지 않는 tmp/에 두고 해시만 기록한다.
//   node --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r12/coverage-retarget.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { questionHash, sourceUnitHash } from '../../../coverage/build-coverage.mjs';
import { buildSourceCatalog } from '../../../../questionSourceCatalog.mjs';
import { assertRelationship, checkCoverageBeforeWrite } from '../../case-trio-next-2026-09-14/helpers/coverage-contract.mjs';

const P = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r12', T = 'tmp/case-review-publication-r12', file = 'cpa_uploader/analysis/coverage/links.json';
const read = (f) => JSON.parse(fs.readFileSync(f)), hash = (x) => createHash('sha256').update(x).digest('hex'), ref = (f) => ({ file: f, sha256: hash(fs.readFileSync(f)) });
const write = (f, v) => { fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n', { flag: 'wx' }); return ref(f); };
assert.equal(read(P + '/install-completion.json').status, 'canonical_installed_and_validated');
const plan = read(P + '/plan.json'), retired = plan.rounds.flatMap((r) => r.retires);
const decisions = [
    { id: 'coverage-trio-20260914-a', set_id: 'case-10-analytical-procedures-20260920', subquestion_id: 'sub2', criterion_ids: ['sub2.c2'], relationship: 'partial',
        reason: '원 대상 case-10-completion-analytics-20260914/sub1은 r12 병합으로 퇴역했다. 원 sub1.c1·c2는 2018CPA문제2물음5의 필수 두 단계·목적 가운데 감사종결 단계를 실제 판매구조 변화에 적용하게 하여 요소에 partial로 대응했다. 대체 세트 sub2의 ⑥(감사종료에 근접한 시점의 분석적절차를 따로 설계하지 않고 위험평가 단계의 상반기 매출·이익률 분석 결과로 갈음하기로 한 결정)은 같은 사실(하반기에 도매판매가 줄고 직영판매가 늘어난 판매구조 변화, 계정별 세부테스트 완료, 최종 재무제표 입수)에서 감사의 종료시점에 근접하여 기업에 대하여 이해한 바와 재무제표가 일관성이 있는지에 대한 전반적인 결론을 내리기 위한 분석적절차를 수행해야 한다는 이유나 절차를 sub2.c2로 요구하고, 근거로 KGA 520 문단 6·A17·A19를 쓴다. 위험평가 단계까지 포괄하는 원물음 전부의 직접 대응은 아니므로 partial을 유지한다. 원자료 단위 src-e67ae1831db41aa655(문단 6)·src-93c9a60b32ac6a97bd(문단 A17)·src-5c224e2b3d26cb7abb(문단 A19)는 공식 출처 레지스트리에서 오므로 세트 퇴역과 무관하게 유지되고, 대체 criterion의 근거 문단과 같아 그대로 두었다. ⑥·⑦의 식별 기준 sub2.c1과 위험평가 수정을 요구하는 sub2.c3은 이 대표 연결에 넣지 않았다.' },
];
const bytes = fs.readFileSync(file), data = JSON.parse(bytes), bank = read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const elements = read('cpa_uploader/analysis/question-elements/question-elements.json').elements, units = buildSourceCatalog().units;
const bankTargets = data.links.filter((l) => l.target && l.target.scope !== 'draft' && retired.includes(l.target.set_id));
assert.equal(bankTargets.length, 1, 'r12는 은행 대상 관계 1건만 재연결한다');
assert.deepEqual(bankTargets.map((l) => l.id).sort(), decisions.map((d) => d.id).sort(), 'Every bank relationship to a retired set must be decided');
for (const id of retired) assert(!bank.some((s) => s.id === id), 'Retired set still in canonical bank: ' + id);
const review = write(P + '/coverage-retarget-review.json', { version: 1, method: 'agent_relationship_review', human_review_performed: false,
    reviewer_id: 'agent:claude-opus-5 (publication author agent; not an independent peer review)', reviewed_at: new Date().toISOString(),
    basis: '퇴역·대체 이력(plan.json)과 대체 문항의 발문·항목·criterion, 원 관계의 요소·원출제·답안 비교·원자료 단위를 대조했다. 원자료 단위는 대체 criterion의 근거 문단과 같아 그대로 두었다.',
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
fs.mkdirSync(T, { recursive: true }); fs.writeFileSync(T + '/coverage-links-before.json', bytes, { flag: 'wx' });
fs.writeFileSync(file, JSON.stringify(candidate, null, 2) + '\n');
write(P + '/coverage-update.json', { created_at: new Date().toISOString(), before: ref(T + '/coverage-links-before.json'), before_copy_committed: false, after: ref(file), retargeted_link_ids: decisions.map((d) => d.id), review,
    assembled_before_write: assembled, other_links_preserved: true, frequency_inputs_changed: false, human_review_performed: false });
console.log({ retargeted: decisions.length, total_links: candidate.links.length, assembled });
