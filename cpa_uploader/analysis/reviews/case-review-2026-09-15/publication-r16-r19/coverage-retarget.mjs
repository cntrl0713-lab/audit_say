// 퇴역하는 원 9세트를 가리키던 은행 대상 coverage 관계 5건을 대체 문항으로 다시 연결한다(정본 설치 뒤 한 번 실행). publication-r13-r15/coverage-retarget.mjs를 옮겼다.
// 초안 대상(target.scope=draft) 관계 9건은 보존된 초안 파일을 가리키므로 바꾸지 않는다. 반영 전 links.json 사본은 커밋하지 않는 tmp/에 두고 해시만 기록한다.
//   node --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r16-r19/coverage-retarget.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { questionHash, sourceUnitHash } from '../../../coverage/build-coverage.mjs';
import { buildSourceCatalog } from '../../../../questionSourceCatalog.mjs';
import { assertRelationship, checkCoverageBeforeWrite } from '../../case-trio-next-2026-09-14/helpers/coverage-contract.mjs';

const P = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r16-r19', T = 'tmp/case-review-publication-r16-r19', file = 'cpa_uploader/analysis/coverage/links.json';
const read = (f) => JSON.parse(fs.readFileSync(f)), hash = (x) => createHash('sha256').update(x).digest('hex'), ref = (f) => ({ file: f, sha256: hash(fs.readFileSync(f)) });
const write = (f, v) => { fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n', { flag: 'wx' }); return ref(f); };
assert.equal(read(P + '/install-completion.json').status, 'canonical_installed_and_validated');
const plan = read(P + '/plan.json'), retired = plan.rounds.flatMap((r) => r.retires);
const decisions = [
    { id: 'case-followup-20260914-07-interim-timing-adjacent', set_id: 'case-07-evidence-timing-20260920', subquestion_id: 'sub2', criterion_ids: ['sub2.c3'], relationship: 'adjacent',
        reason: '원 대상 case-07-interim-misstatement-20260914/sub3은 r17 병합으로 퇴역했다. 요소 “내부회계관리제도 미비점 발견 시 재무제표 감사위험 대응 고려사항”(2019년 기출 1회)에 인접 요구로 대응하던 관계다. 대체 세트 sub2의 ⑦(기중 검사에서 예상하지 못한 반품 처리 오류를 발견하고도 위험평가와 잔여기간 실증절차의 계획을 그대로 확정한 판단)은 KGA 330 문단 23에 따라 관련 위험평가와 잔여기간 절차의 성격·시기·범위를 변경할 필요가 있는지 평가하도록 sub2.c3으로 요구한다. 내부회계관리제도 미비점이라는 원 요소의 상황은 여전히 이 세트가 직접 묻지 않으므로 adjacent를 유지한다. 원자료 단위는 공식 출처 레지스트리에서 오고 대체 criterion의 근거 문단과 같아 그대로 두었다.' },
    { id: 'case-followup-20260914-10-unavailable-control-evidence', set_id: 'case-07-control-test-sampling-20260920', subquestion_id: 'sub2', criterion_ids: ['sub2.c4'], relationship: 'direct',
        reason: '원 대상 case-10-control-sample-frame-20260914/sub2는 r18 병합으로 퇴역했다. 요소 “추출항목에 설계된 절차 또는 적절한 대체절차를 적용할 수 없는 경우의 처리절차 제시”는 KGA 530 문단 11·A15의 요구이며, 대체 세트 sub2의 ⑧(승인 기록이 분실된 항목을 다른 항목으로 교체한 처리)이 같은 요구를 sub2.c4로 그대로 묻는다. 선택형 배점에 따라 이유 또는 보완절차 하나로 득점하지만 요구 자체가 같아 direct를 유지한다. 원 세트가 함께 두었던 문단 10·A14(무효화된 항목에 대체항목 선정)는 같은 상황의 반대 결론이라 병합에서 삭제했고, 그 요구는 기준서형 pilot-10-003 sub1이 계속 다룬다.' },
    { id: 'case-applied-20260914-12-support-evidence-partial', set_id: 'case-12-going-concern-20260920', subquestion_id: 'sub2', criterion_ids: ['sub2.c3', 'sub2.c4'], relationship: 'partial',
        reason: '원 대상 case-12-going-concern-evidence-20260914/sub3은 r16 병합으로 퇴역했다. 요소 “계속기업 존속이 지배회사 지원에 달렸지만 지원능력 증거·확약서를 입수하지 못한 경우 의견과 추가문단 선택”(2022년 기출 1회)에 일부 대응하던 관계다. 대체 세트 sub2의 ⑦·⑧은 지원 검토 이메일만으로 약정의 존재·조건을 확인할 수 없고 지배기업이라는 사정만으로 자금제공능력이 확인되지 않는다는 점을 sub2.c3·c4로 요구하여, 요소가 전제하는 “지원능력 증거와 확약서 입수” 절차를 직접 다룬다. 다만 증거를 입수하지 못한 상태에서의 의견·추가문단 선택은 이 세트에 없다. 원 세트가 그 판단(705 문단 9)과 공시 미비 판단(570 문단 23)을 함께 두고 있었는데 같은 기준에서 결론이 갈리는 두 경우여서 공시 미비 쪽만 남겼고, 범위제한에 따른 의견거절은 case-15-scope-limitation-disclaimer-20260919가 다룬다. 그래서 partial을 유지한다.' },
    { id: 'coverage-deepening-20260914-02', set_id: 'case-07-control-test-sampling-20260920', subquestion_id: 'sub1', criterion_ids: ['sub1.c2'], relationship: 'adjacent',
        reason: '원 대상 case-07-control-evidence-20260914/sub1은 r18 병합으로 퇴역했다. 요소 “통제활동의 문서화가 존재하지 않는 경우 이용할 감사증거 입수방법 제시”(KGA 330 문단 A27 후단)에 직접 대응하던 관계다. 병합에서 두 원 세트의 통제 전제가 충돌해(63번은 구두 승인으로 문서가 없고, 53번은 승인 기록이 남는 출고지시서다) 표본항목 처리와 승인 기록 분실이 성립하도록 문서화된 승인 통제로 통일했고, 그 결과 “문서화가 없는 경우”라는 조건이 사례에서 빠졌다. 대체 세트 sub1의 ①(사전 통지한 날 오전의 관찰 결과를 연중 운영효과성 증거로 본 평가)은 통제테스트에서 이용하는 증거 입수방법 가운데 관찰의 한계를 sub1.c2로 요구하므로 인접 요구로 남기되 direct에서 adjacent로 낮춘다. 문서화가 없는 통제의 증거 입수방법을 직접 묻는 문항은 현재 은행에 없으므로 후속 제작의 후보로 남는다.' },
    { id: 'coverage-trio-next-20260914-a', set_id: 'case-12-written-representations-20260920', subquestion_id: 'sub3', criterion_ids: ['sub3.c3'], relationship: 'adjacent',
        reason: '원 대상 case-12-representation-conflict-20260914/sub2는 r19 병합으로 퇴역했다. 요소 “경영진이 요청된 서면진술을 하나 이상 제공하지 않을 때 의견 영향 고려 예시 외 수행할 절차 두 가지 제시”(2020년 기출 1회)에 인접 요구로 대응하던 관계다. 대체 세트 sub3의 ⑫(상반기 거래에 대한 다른 감사절차 결과로 서면진술을 대신할 수 있다는 판단)은 경영진이 책임을 완수하였는지는 다른 감사증거만으로 판단할 수 없다는 점을 sub3.c3으로 요구한다. 원 요소가 열거를 요구하는 KGA 580 문단 19의 세 절차 자체는 이 세트에서 옳은 항목 ⑭(경영진과 토의하고 지배기구와 커뮤니케이션)로만 제시되어 득점 요건이 아니므로 adjacent를 유지한다. 그 열거는 기준서형 pilot-12-003이 계속 다룬다.' },
];
const bytes = fs.readFileSync(file), data = JSON.parse(bytes), bank = read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const elements = read('cpa_uploader/analysis/question-elements/question-elements.json').elements, units = buildSourceCatalog().units;
const bankTargets = data.links.filter((l) => l.target && l.target.scope !== 'draft' && retired.includes(l.target.set_id));
assert.equal(bankTargets.length, 5, 'r16~r19는 은행 대상 관계 5건을 재연결한다');
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
