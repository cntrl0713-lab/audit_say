// 퇴역하는 원 세트를 가리키던 은행 대상 coverage 관계 5건을 대체 문항으로 다시 연결한다(정본 설치 뒤 한 번 실행). publication-r05-r06/coverage-retarget.mjs를 옮겼다.
// 초안 대상(target.scope=draft) 관계 13건은 보존된 초안 파일을 가리키므로 바꾸지 않는다. 반영 전 links.json 사본은 커밋하지 않는 tmp/에 두고 해시만 기록한다.
//   node --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r07-r11/coverage-retarget.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { questionHash, sourceUnitHash } from '../../../coverage/build-coverage.mjs';
import { buildSourceCatalog } from '../../../../questionSourceCatalog.mjs';
import { assertRelationship, checkCoverageBeforeWrite } from '../../case-trio-next-2026-09-14/helpers/coverage-contract.mjs';

const P = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r07-r11', T = 'tmp/case-review-publication-r07-r11', file = 'cpa_uploader/analysis/coverage/links.json';
const read = (f) => JSON.parse(fs.readFileSync(f)), hash = (x) => createHash('sha256').update(x).digest('hex'), ref = (f) => ({ file: f, sha256: hash(fs.readFileSync(f)) });
const write = (f, v) => { fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n', { flag: 'wx' }); return ref(f); };
assert.equal(read(P + '/install-completion.json').status, 'canonical_installed_and_validated');
const plan = read(P + '/plan.json'), retired = plan.rounds.flatMap((r) => r.retires);
const decisions = [
    { id: 'case-additional-20260914-09-required-positive-response', set_id: 'case-09-confirmation-skepticism-20260918', subquestion_id: 'sub1', criterion_ids: ['sub1.c4'], relationship: 'partial',
        reason: '원 대상 case-09-confirmation-barrier-20260914/sub2는 r07 병합으로 퇴역했다. 원 sub2.c2·c3는 KGA 505 문단 A20의 적극적 조회 회신이 필요한 두 상황(경영진주장을 확인할 정보가 기업 외부에서만 입수 가능한 경우, 특정 부정위험요소 때문에 기업에서 입수한 증거를 신뢰할 수 없는 경우)을 사례 사실에 각각 적용하게 하여 두 상황을 서술하라는 요소에 direct로 대응했다. 대체 세트 sub1의 ④(출고증과 입금 내역의 대조로 적극적 조회를 대신하기로 한 판단)는 같은 사실(최종 약정 원본을 거래처만 보관, 관리자 계정 공동 사용과 반복 수정)에서 적극적 조회 회신이 필요하고 대체적 감사절차로는 필요한 증거를 얻을 수 없다는 이유를 sub1.c4로 요구하며, 근거로 KGA 505 문단 A20·13을 쓴다. 다만 sub1.c4는 두 사정 중 하나만 들어도 인정하므로 두 상황을 모두 서술하게 하는 요소 전체에는 partial이다. ④를 포함한 다섯 항목의 식별 기준 sub1.c1은 이 대표 연결에 넣지 않았다.' },
    { id: 'case-additional-20260914-b12-post-report-sub3', set_id: 'case-12-report-date-subsequent-20260919', subquestion_id: 'sub2', criterion_ids: ['sub2.c1', 'sub2.c2', 'sub2.c3'], relationship: 'direct',
        reason: '원 대상 case-12-post-report-refusal-20260914/sub3은 r10 병합으로 퇴역했다. 원 sub3.c1~c3는 감사보고서를 회사에 제출한 뒤 제3자 발행 전에 필요한 수정을 경영진이 거부한 상황에서 KGA 560 문단 13(b)의 두 조치(수정 전 제3자 발행금지 통보를 경영진과 지배기구에 함, 통보에도 수정 없이 발행되면 감사보고서에 대한 의존을 방지하는 조치)를 요구했다. 대체 세트 sub2는 같은 시점·거부 조건(3월 17일 보고서 제출, 제3자 발행 전 소송 합의 수정 거부)에서 ⑤(새 보고서 대신 수정 없는 발행을 막는 조치로 대응함, 옳음)의 식별(sub2.c1), ⑥(대표이사·재무담당이사에게만 발행금지 통보)에 대한 지배기구(감사위원회) 포함 통보(sub2.c2), ⑦(발행 후 결과는 경영진 책임이라 조치 없음)에 대한 의존 방지 조치(sub2.c3)를 요구하고 근거로 KGA 560 문단 13을 쓴다. 선택형이라 경영진에 대한 발행금지 통보 자체는 ⑥의 사실로 주어지지만, 그 대응이 이 시점에 맞는지(⑤)와 통보 대상·불응 시 조치를 모두 평가하므로 두 조치의 조건과 범위에 direct를 유지한다.' },
    { id: 'case-followup-20260914-16-kam-eom-partial', set_id: 'case-16-kam-emphasis-20260919', subquestion_id: 'sub3', criterion_ids: ['sub3.c4'], relationship: 'partial',
        reason: '원 대상 case-16-report-paragraphs-20260914/sub1은 r08 대체로 퇴역했다. 원 sub1.c1·c2는 핵심감사사항으로 결정된 영업권 사항을 강조사항문단으로 대체할 수 없다는 판단과 이유를 요구하여, 핵심감사사항과 강조사항·기타사항문단의 관계라는 요소 중 강조사항문단과의 관계에 partial로 대응했다. 대체 세트 sub3의 ⑬(핵심감사사항으로 결정된 영업권 사항에 대해 강조사항문단을 따로 둠)은 강조사항문단이 핵심감사사항으로 결정되지 않은 사항에만 포함되며 개별 핵심감사사항의 기술을 대체하지 않는다는 이유를 sub3.c4로 요구하고, 근거로 KGA 706 문단 8·A1·A2를 쓴다. 같은 물음의 ⑩(강조사항문단을 핵심감사사항 단락 바로 앞에 둠, 옳음)은 두 단락의 배치를 식별 기준 sub3.c1로만 평가하므로 대표 연결에 넣지 않았다. 기타사항문단과 핵심감사사항의 관계는 요구하지 않으므로 partial을 유지한다.' },
    { id: 'case-applied-20260914-16-comparative-change-direct', set_id: 'case-16-comparative-restatement-20260919', subquestion_id: 'sub2', criterion_ids: ['sub2.c3'], relationship: 'direct',
        reason: '원 대상 case-16-comparative-opinion-change-20260914/sub3은 r09 병합으로 퇴역했다. 원 sub3.c1은 동일 감사인이 전기 재무제표에 대해 과거와 다른 의견을 표명하면 그 중요한 사유를 기타사항문단에 설명해야 한다는 KGA 710 문단 16을 적용하게 하여 요소에 direct로 대응했다. 대체 세트 sub2의 ⑧(전기 의견이 이전에 표명한 의견과 달라진 사유를 강조사항문단에 기재함)은 같은 계속감사 조건(20X1년 재무제표에 한정의견을 표명한 감사인이 20X2년 감사에서 재작성된 20X1년 재무제표에 적정의견을 표명)에서 그 중요한 사유를 기타사항문단에 공시해야 한다는 이유나 절차를 sub2.c3로 요구하고, 근거로 KGA 710 문단 16을 쓰므로 direct를 유지한다. 의견 변경 자체(⑥, 옳음)와 당기 의견(⑦)의 판단은 이 대표 연결에 넣지 않았다.' },
    { id: 'coverage-deepening-20260914-06', set_id: 'case-12-report-date-subsequent-20260919', subquestion_id: 'sub3', criterion_ids: ['sub3.c2', 'sub3.c3'], relationship: 'direct',
        reason: '원 대상 case-12-restricted-revision-dual-date-20260914/sub2는 r10 병합으로 퇴역했다. 원 sub2.c1·c2는 후속사건 감사절차를 수정사항에만 한정한 경우 최초 감사보고서일을 유지하고 그 수정사항에만 한정 절차의 종료일을 추가 일자로 기재하는 이중 보고서일을 요구했다. 대체 세트 sub3의 ⑨(보고서 일자 전체를 3월 27일로 바꾼 수정안)와 ⑩(추가 일자를 이사회 수정 승인일 3월 25일로 적어야 한다는 판단)은 같은 조건(주석 12의 수정사항에만 한정한 절차)에서 최초 일자 3월 12일의 유지와 주석 12에 한정한 추가 일자(sub3.c2), 그 추가 일자가 한정 절차의 종료일 3월 27일이어야 한다는 이유(sub3.c3)를 요구하고, 근거로 KGA 560 문단 12·A13을 쓰므로 direct를 유지한다. sub3.c2가 인정하는 강조사항·기타사항문단 대안도 문단 12(b)의 같은 요구다. 절차 한정(⑧)과 기타사항문단 대안(⑪)의 식별(sub3.c1)은 넣지 않았다.' },
];
const bytes = fs.readFileSync(file), data = JSON.parse(bytes), bank = read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const elements = read('cpa_uploader/analysis/question-elements/question-elements.json').elements, units = buildSourceCatalog().units;
const bankTargets = data.links.filter((l) => l.target && l.target.scope !== 'draft' && retired.includes(l.target.set_id));
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
