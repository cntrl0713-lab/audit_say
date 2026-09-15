// 퇴역하는 원 사례형 세트를 가리키던 은행 대상 coverage 관계 3건을 대체 문항으로 다시 연결한다(정본 설치 뒤 한 번 실행).
// 초안 대상(target.scope=draft) 관계 14건은 보존된 초안 파일을 가리키므로 바꾸지 않는다.
//   node --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication/coverage-retarget.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { questionHash, sourceUnitHash } from '../../../coverage/build-coverage.mjs';
import { buildSourceCatalog } from '../../../../questionSourceCatalog.mjs';
import { assertRelationship, checkCoverageBeforeWrite } from '../../case-trio-next-2026-09-14/helpers/coverage-contract.mjs';

const P = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/publication', file = 'cpa_uploader/analysis/coverage/links.json';
const read = (f) => JSON.parse(fs.readFileSync(f)), hash = (x) => createHash('sha256').update(x).digest('hex'), ref = (f) => ({ file: f, sha256: hash(fs.readFileSync(f)) });
const write = (f, v) => { fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n', { flag: 'wx' }); return ref(f); };
assert.equal(read(P + '/install-completion.json').status, 'canonical_installed_and_validated');
const plan = read(P + '/plan.json'), retired = plan.rounds.flatMap((r) => r.retires);
const decisions = [
    { id: 'case-followup-20260914-14-additional-procedures-performer', set_id: 'case-14-group-procedures-20260915', subquestion_id: 'sub2', criterion_ids: ['sub2.c1'], relationship: 'partial', source_unit_ids: ['src-8b5100ad4819792a6a'],
        reason: '원 대상 case-14-component-evidence-gap-20260914는 r01 병합으로 퇴역했다. 대체 세트 sub2의 ⑤는 부문감사인이 한 창고재고 업무가 불충분하다고 판단한 뒤 그룹업무팀이 추가감사절차를 정하고 그 수행을 부문감사인에게 맡겨 결과를 평가하는 옳은 절차다. 2017년 문제7 물음4(1)의 두 요구(추가 절차의 결정, 수행자의 결정)를 옳은 절차로 알아보는지를 식별 기준 sub2.c1로만 평가하고 절차를 서술하게 하지 않으므로 partial이다. 600.43이 결정 의무를 지지한다. 구체적 창고 절차의 근거였던 501.8은 새 문항에서 묻지 않아 원자료 단위에서 뺐다.' },
    { id: 'case-applied-20260914-13-type2-period-adjacent', set_id: 'case-13-payroll-service-20260915', subquestion_id: 'sub2', criterion_ids: ['sub2.c2'], relationship: 'adjacent', source_unit_ids: null,
        reason: '원 대상 case-13-type2-period-exceptions-20260914/sub1은 r03 병합으로 퇴역했다. 대체 세트 sub2의 ⑤는 1~9월 유형 2 보고서로 20X1년 전체의 급여 통제 운영에 관한 증거를 얻을 수 있다는 옳지 않은 의견이며 sub2.c2가 대상기간의 한계 또는 10~12월 추가 증거를 요구한다. 2025 CPA 문제3 물음3 항목④는 유형 1 보고서로 운영효과성을 입증할 수 있는지를 묻는다. 보고서 증거의 적합성 평가라는 인접 목표를 공유하나 보고서 유형과 결함의 원인이 달라 adjacent를 유지한다.' },
    { id: 'case-applied-20260914-16-other-information-fs-direct', set_id: 'case-16-other-information-20260915', subquestion_id: 'sub2', criterion_ids: ['sub2.c2'], relationship: 'direct', source_unit_ids: null,
        reason: '원 대상 case-16-other-information-cause-20260914/sub2는 r02 병합으로 퇴역했다. 대체 세트 sub2의 ⑥은 기타정보와의 차이를 계기로 충분한 증거로 확인된 재무제표의 중요한 매출 과대계상을 경영진이 수정하지 않았는데 기타정보 단락에만 기술하고 적정의견을 표명한 옳지 않은 판단이며, sub2.c2가 한정의견 표명(감사의견 변형)을 요구한다. 2025 GS1 문제5 물음3의 보고서일 전·재무제표 수정 필요·경영진 거부 분기에 직접 대응하므로 direct를 유지한다.' },
];
const bytes = fs.readFileSync(file), data = JSON.parse(bytes), bank = read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const elements = read('cpa_uploader/analysis/question-elements/question-elements.json').elements, units = buildSourceCatalog().units;
const bankTargets = data.links.filter((l) => l.target && l.target.scope !== 'draft' && retired.includes(l.target.set_id));
assert.deepEqual(bankTargets.map((l) => l.id).sort(), decisions.map((d) => d.id).sort(), 'Every bank relationship to a retired set must be decided');
for (const id of retired) assert(!bank.some((s) => s.id === id), 'Retired set still in canonical bank: ' + id);
const review = write(P + '/coverage-retarget-review.json', { version: 1, method: 'agent_relationship_review', human_review_performed: false,
    reviewer_id: 'agent:claude-opus-5 (publication author agent; not an independent peer review)', reviewed_at: new Date().toISOString(),
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
