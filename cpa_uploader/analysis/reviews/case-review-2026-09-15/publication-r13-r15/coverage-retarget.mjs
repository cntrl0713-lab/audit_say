// 퇴역하는 원 8세트를 가리키던 은행 대상 coverage 관계 2건을 대체 문항으로 다시 연결한다(정본 설치 뒤 한 번 실행). publication-r12/coverage-retarget.mjs를 옮겼다.
// 초안 대상(target.scope=draft) 관계 19건(delegated-authoring·frequency-priority 초안의 pilot-06-006·pilot-06-007·pilot-07-008·pilot-08-006·pilot-08-007·draft-09-501-freq01)은 보존된 초안 파일을 가리키므로 바꾸지 않는다. 반영 전 links.json 사본은 커밋하지 않는 tmp/에 두고 해시만 기록한다.
//   node --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r13-r15/coverage-retarget.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { questionHash, sourceUnitHash } from '../../../coverage/build-coverage.mjs';
import { buildSourceCatalog } from '../../../../questionSourceCatalog.mjs';
import { assertRelationship, checkCoverageBeforeWrite } from '../../case-trio-next-2026-09-14/helpers/coverage-contract.mjs';

const P = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r13-r15', T = 'tmp/case-review-publication-r13-r15', file = 'cpa_uploader/analysis/coverage/links.json';
const read = (f) => JSON.parse(fs.readFileSync(f)), hash = (x) => createHash('sha256').update(x).digest('hex'), ref = (f) => ({ file: f, sha256: hash(fs.readFileSync(f)) });
const write = (f, v) => { fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n', { flag: 'wx' }); return ref(f); };
assert.equal(read(P + '/install-completion.json').status, 'canonical_installed_and_validated');
const plan = read(P + '/plan.json'), retired = plan.rounds.flatMap((r) => r.retires);
const decisions = [
    { id: 'case-applied-20260914-09-liabilities-period-direct', set_id: 'case-06-purchase-payment-20260920', subquestion_id: 'sub3', criterion_ids: ['sub3.c2'], relationship: 'direct',
        reason: '원 대상 case-09-unrecorded-liabilities-20260914/sub1은 r14 병합으로 퇴역했다. 원 sub1.c1(후속지급 검사 종료일을 감사보고서일에 근접한 시점까지 확대)·c2(30일·60일 결제주기 때문에 12월 매입분 일부가 검사기간 밖에서 지급된다는 이유)는 요소 “부외부채 테스트의 재무제표일 후 현금지급 검토를 보완할 사항”(2017년 기출 1회)에 direct로 대응했다. 대체 세트 sub3의 ⑩(1월 20일 현장업무 종료일을 후속지급 검사의 종료일로 삼은 판단)은 같은 사실(거래처별 30일·60일 결제주기, 1월 20일 현장 철수, 3월 10일 감사보고서일 예정)에서 같은 보완 내용을 sub3.c2로 요구한다. 학습 단위 계약의 선택형 배점에 따라 이유 또는 보완절차 중 하나를 핵심 원칙 수준으로 쓰면 득점하므로 원 두 criterion이 한 criterion으로 합쳐졌고, 요구 자체는 같아 direct를 유지한다. 옳지 않은 항목 전체를 고르는 식별 기준 sub3.c1과 조회 대상 선정(sub3.c3)·차기초 지급의 기간귀속(sub3.c4)은 이 대표 연결에 넣지 않았다. 원자료 단위는 공식 출처 레지스트리에서 오고 대체 criterion의 근거 문단과 같아 그대로 두었다.' },
    { id: 'coverage-deepening-20260914-04', set_id: 'case-09-inventory-count-20260920', subquestion_id: 'sub1', criterion_ids: ['sub1.c3'], relationship: 'partial',
        reason: '원 대상 case-09-inventory-location-population-20260914/sub2는 r15 병합으로 퇴역했다. 원 sub2.c1~c3은 요소 “다른 날짜·다른 관리부서의 여러 창고를 한 모집단으로 통합하여 테스트 실사 수량을 줄이는 판단의 적절성과 이유 두 가지 서술”(2023년 기출 1회)에 direct로 대응했다. 대체 세트 sub1의 ③(두 장소의 실사기록을 하나의 목록으로 합쳐 표본규모를 산정한 판단)은 상품의 성격·관리 부서·실사팀과 실사기록 담당자가 다르다는 사실에서 모집단 구분의 이유나 절차를 sub1.c3으로 요구한다. 다만 병합에서 실사기준일을 20X1년 11월 30일 하나로 통일하여 “다른 날짜”라는 구분 근거가 사실관계에서 빠졌고, 선택형 배점상 이유 하나로 득점하므로 원 요소가 요구한 두 가지 이유를 모두 요구하지 않는다. 그래서 direct가 아니라 partial로 낮춘다. 식별 기준 sub1.c2·c4와 sub1.c1은 이 대표 연결에 넣지 않았다. 원자료 단위는 공식 출처 레지스트리에서 오고 대체 criterion의 근거 문단(KGA 530 문단 6)과 같아 그대로 두었다.' },
];
const bytes = fs.readFileSync(file), data = JSON.parse(bytes), bank = read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const elements = read('cpa_uploader/analysis/question-elements/question-elements.json').elements, units = buildSourceCatalog().units;
const bankTargets = data.links.filter((l) => l.target && l.target.scope !== 'draft' && retired.includes(l.target.set_id));
assert.equal(bankTargets.length, 2, 'r13~r15는 은행 대상 관계 2건을 재연결한다');
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
