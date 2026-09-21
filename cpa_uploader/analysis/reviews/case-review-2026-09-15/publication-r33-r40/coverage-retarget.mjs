// 퇴역하는 원 11세트를 가리키던 은행 대상 coverage 관계 8건을 대체 문항으로 다시 연결한다(정본 설치 뒤 한 번 실행). publication-r20-r27/coverage-retarget.mjs를 옮겼다.
// 이번 회차에서는 사례형에서 사라진 요구를 정면으로 다루는 기준서형이 은행에 없어 신규 관계(additions)를 만들지 않고 unresolved_findings에 후속 제작 후보로 남겼다.
// 초안 대상(target.scope=draft) 관계 5건은 보존된 초안 파일을 가리키므로 바꾸지 않는다. 반영 전 links.json 사본은 커밋하지 않는 tmp/에 두고 해시만 기록한다.
//   node --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r33-r40/coverage-retarget.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { questionHash, sourceUnitHash } from '../../../coverage/build-coverage.mjs';
import { buildSourceCatalog } from '../../../../questionSourceCatalog.mjs';
import { assertRelationship, checkCoverageBeforeWrite } from '../../case-trio-next-2026-09-14/helpers/coverage-contract.mjs';

const P = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r33-r40', T = 'tmp/case-review-publication-r33-r40', file = 'cpa_uploader/analysis/coverage/links.json';
const read = (f) => JSON.parse(fs.readFileSync(f)), hash = (x) => createHash('sha256').update(x).digest('hex'), ref = (f) => ({ file: f, sha256: hash(fs.readFileSync(f)) });
const write = (f, v) => { fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n', { flag: 'wx' }); return ref(f); };
assert.equal(read(P + '/install-completion.json').status, 'canonical_installed_and_validated');
const plan = read(P + '/plan.json'), retired = plan.rounds.flatMap((r) => r.retires);
const decisions = [
    { id: 'case-applied-20260914-09-legal-inquiry-adjacent', set_id: 'case-09-legal-inquiry-20260921', subquestion_id: 'sub1', criterion_ids: ['crit1'], relationship: 'adjacent',
        reason: '원 대상 case-09-legal-inquiry-20260914/sub1은 r40 갱신으로 퇴역했다. 요소 "소송 관련 세부질문서 대신 일반질문서를 발송하는 상황 제시"(2024년 모의 1회)에 인접 요구로 대응하던 관계다. 원 세트는 sub1.c1·c2로 일반질문서의 회신 제한을 근거로 세부질문서를 선택하는 판단을 득점 요건으로 물었다. r40은 일반질문서(KGA 501 A22)와 세부질문서(A23)가 적용 조건이 갈리는 쌍이어서 세부질문서 한쪽으로 고정하고 A22 인용을 승계하지 않았으며, 세부질문서 선택은 옳은 항목 ④(함정, 무득점)로 돌렸다. 사실관계 fact2가 "법률전문직 단체의 규칙 때문에 일반질문서에는 적절하게 답변할 수 없다"는 상황을 여전히 제시하므로 요소가 전제하는 상황은 살아 있으나 득점 요건은 아니다. 그래서 adjacent를 유지하고 그 단계의 식별 기준 crit1로 옮긴다. 이 요소를 직접 묻는 문항은 은행에 없어 후속 제작 후보로 남는다. 원자료 단위는 공식 출처 레지스트리에서 오고 대체 criterion의 근거 문단과 같은 KGA 501 구간이라 그대로 두었다.' },
];
// 퇴역이 만든 결손을 같은 회차에서 정리하는 신규 관계다. 기존 관계의 재연결이 아니므로 decisions와 구분해 둔다.
// 이번 회차에서 사례형의 득점 요건에서 사라진 요구(KGA 710 문단 11(a)·(b))를 정면으로 다루는 기준서형이 은행에 없어 신규 관계를 만들지 않았다. unresolved_findings 참조.
const additions = [];
const bytes = fs.readFileSync(file), data = JSON.parse(bytes), bank = read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const elements = read('cpa_uploader/analysis/question-elements/question-elements.json').elements, units = buildSourceCatalog().units;
const bankTargets = data.links.filter((l) => l.target && l.target.scope !== 'draft' && retired.includes(l.target.set_id));
assert.equal(bankTargets.length, 1, 'r33~r40은 은행 대상 관계 1건을 재연결한다');
assert.deepEqual(bankTargets.map((l) => l.id).sort(), decisions.map((d) => d.id).sort(), 'Every bank relationship to a retired set must be decided');
for (const id of retired) assert(!bank.some((s) => s.id === id), 'Retired set still in canonical bank: ' + id);
const review = write(P + '/coverage-retarget-review.json', { version: 1, method: 'agent_relationship_review', human_review_performed: false,
    reviewer_id: 'agent:claude-opus-5 (publication author agent; not an independent peer review)', reviewed_at: new Date().toISOString(),
    basis: '퇴역·대체 이력(plan.json)과 각 회차 초안의 lineage.json, 대체 문항의 발문·항목·criterion, 원 관계의 요소·원출제·답안 비교·원자료 단위를 대조했다. 원자료 단위는 대체 criterion의 근거 문단과 같으면 그대로 두고, 근거 문단이 바뀐 두 건(frequency-gap-2026-09-10-E-1*)만 대체 criterion의 근거 문단으로 옮겼다. 신규 관계는 요소의 요구가 병합에서 사례형의 득점 요건에서 사라지고 기준서형이 그 요구를 계속 다루는 경우에 한정하며, 이번 회차에는 해당하는 기준서형이 없어 만들지 않았다.',
    plan: ref(P + '/plan.json'), links: decisions.map((d) => ({ ...d, decision: 'retarget_to_replacement' })),
    new_links: additions.map((a) => ({ ...a, decision: 'new_relationship_to_standards_set_retaining_the_requirement' })),
    resolved_findings: [],
    unresolved_findings: [
        'frequency-gap-2026-09-10-E-1 / -case-quality-split: r31이 승계하지 않은 KGA 710 문단 11(a)·(b)(전기 변형의 미해결에 따른 당기 의견변형과 변형근거문단의 기재)를 다루는 문항이 은행에 없다. 은행 전수 조회에서 문단 11을 인용하는 세트를 찾지 못했고 r31 lineage.json의 disposition도 후속 회차의 기준서형 물음 후보로 적고 있다. 기준서형이 없으므로 새 관계를 만들지 않고 후속 제작 후보로 남긴다.',
        'element-ff4c17f0c219489c: 원발문 모범답안의 근거인 KGA 510 문단 13(전임감사인의 전기 의견변형이 당기에도 계속 관련성이 있고 중요하면 당기 감사의견을 변형)을 득점 요건으로 묻는 문항이 은행에 없다. case-09-initial-audit-20260915 sub4의 식별 기준 sub4.c1이 문단 13·A9를 근거로 두지만 옳은 항목 ⑩(전임감사인의 변형 사유가 당기에 해결되어 관련성이 없음)으로만 평가하여 독립 득점 요건이 아니고 방향도 원발문의 “변형되는 경우”와 반대다. 후속 제작 후보로 남기고 이 회차에서 새 관계를 만들지 않는다.',
        'r29가 뺀 KGA 706 문단 9(b)·9(c)(강조사항문단에 재무제표에 표시·공시된 정보만 언급, 강조된 사항과 관련하여 감사의견이 변형되지 않는다는 표시)를 가리키는 관계는 이 8건에 없다. 그 요구는 기준서형 pilot-16-004 sub2가 계속 다루며 이번 범위가 아니므로 새 관계를 만들지 않는다.',
        'r32가 삭제한 KGA 230 문단 A4(교체 전 초안·예비적 기록 등은 감사문서에 포함할 필요가 없음)와 A15(불일치 처리의 문서화가 부정확·교체 문서의 보존을 뜻하지 않음)를 직접 묻는 기준서형이 은행에 없다. 이 8건 가운데 그 요구를 가리키는 관계도 없으므로 후속 제작 후보로 남긴다.',
        'r32가 삭제한 사례형 요구(KGA 230 문단 11의 상반정보 처리 기록 2점)와 A22의 두 예시, r28이 득점 요건에서 뺀 KGA 505 문단 A23 후단·인용에서 제외한 문단 12를 가리키는 관계는 이 8건에 없다. 각각 draft-standard-additional-20260913-s03 sub2, pilot-04-006-standards-20260913 sub2, std-points-20260914-f5d37b0c8b8a가 인접 요구를 다루나 이번 범위가 아니므로 새 관계를 만들지 않는다.',
    ],
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
for (const a of additions) {
    assert(!candidate.links.some((l) => l.id === a.id), 'Relationship id already exists: ' + a.id);
    const set = bank.find((s) => s.id === a.set_id), q = set?.subquestions.find((x) => x.id === a.subquestion_id);
    assert(q && set.status === 'published', a.id); assert(a.criterion_ids.every((id) => q.criteria.some((c) => c.id === id)));
    const element = elements.find((e) => e.id === a.element_id); assert(element, a.element_id);
    const sources = a.source_unit_ids.map((id) => { const u = units.find((x) => x.id === id); assert(u, id); return u; });
    const origin = data.links.find((l) => l.id === a.origin_link_id); assert(origin, a.origin_link_id);
    const link = { id: a.id, element_id: a.element_id, source_unit_ids: a.source_unit_ids,
        target: { set_id: set.id, subquestion_id: q.id, criterion_ids: a.criterion_ids }, relationship: a.relationship, review_status: 'reviewed', reason: a.reason,
        snapshot: { element_sha256: hash(JSON.stringify(element)), question_sha256: questionHash(set, q), source_hashes: Object.fromEntries(sources.map((u) => [u.id, u.contentHash])), source_metadata_hashes: Object.fromEntries(sources.map((u) => [u.id, sourceUnitHash(u)])) },
        provenance: { created: { reason: 'requirement_dropped_from_retired_case_and_retained_by_standards_set', origin_link_id: origin.id, origin_previous_target: origin.target,
            review, publication: ref(P + '/install-completion.json'), human_review_performed: false } } };
    assertRelationship(link);
    candidate.links.push(link);
}
assert.equal(candidate.links.length, data.links.length + additions.length);
for (const [i, l] of data.links.entries()) if (!decisions.some((d) => d.id === l.id)) assert.deepEqual(candidate.links[i], l, 'Unrelated relationship changed: ' + l.id);
assert.deepEqual(candidate.links.slice(data.links.length).map((l) => l.id), additions.map((a) => a.id), 'Only the reviewed new relationships may be appended');
assert.equal(hash(fs.readFileSync(file)), hash(bytes), 'Concurrent coverage edit');
const assembled = checkCoverageBeforeWrite({ overlay: candidate, dataset: read('cpa_uploader/analysis/question-elements/question-elements.json'), bank, catalog: buildSourceCatalog(), addedIds: [...decisions, ...additions].map((x) => x.id) });
assert.equal(hash(fs.readFileSync(file)), hash(bytes), 'Concurrent coverage edit after assemble validation');
fs.mkdirSync(T, { recursive: true }); fs.writeFileSync(T + '/coverage-links-before.json', bytes, { flag: 'wx' });
fs.writeFileSync(file, JSON.stringify(candidate, null, 2) + '\n');
write(P + '/coverage-update.json', { created_at: new Date().toISOString(), before: ref(T + '/coverage-links-before.json'), before_copy_committed: false, after: ref(file), retargeted_link_ids: decisions.map((d) => d.id), added_link_ids: additions.map((a) => a.id), review,
    assembled_before_write: assembled, other_links_preserved: true, frequency_inputs_changed: false, human_review_performed: false });
console.log({ retargeted: decisions.length, added: additions.length, total_links: candidate.links.length, assembled });
