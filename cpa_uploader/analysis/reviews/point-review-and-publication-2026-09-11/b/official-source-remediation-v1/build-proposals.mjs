import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { buildSourceCatalog } from '../../../../../questionSourceCatalog.mjs';

const own = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(own, '../../../../../..');
const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const bankFile = `${base}/prepared-reviewed-v4/candidate-authoring.json`;
const sha = data => createHash('sha256').update(data).digest('hex');
const snapshots = new Map();
function text(file) {
    if (!snapshots.has(file)) snapshots.set(file, fs.readFileSync(path.resolve(root, file)));
    return snapshots.get(file).toString('utf8');
}
const read = file => JSON.parse(text(file));
const rel = file => path.relative(root, file).replaceAll('\\', '/');
const norm = value => value.replace(/\s/g, '');
const bank = read(bankFile);
assert.equal(sha(snapshots.get(bankFile)), 'ab2986dad1d82f4f4e24e7d50d9058a17ec324af84c706c7e7f51b92bf8f745b');
const inventory = read(`${base}/official-source-remediation-inventory-v1.json`).rows.filter(row => Number(row.topic_id) >= 7);
assert.equal(inventory.length, 15);
const catalog = buildSourceCatalog();
const staged = read(`${base}/b/official-source-remediation-v1/official-pdf-evidence.json`);
const addedFile = staged.new_official_files[0].target_file;
assert.equal(sha(Buffer.from(text(addedFile))), staged.new_official_files[0].sha256);
const existing = {
    src50515head: 'cpa_uploader/data/official/kga501-505-510-2025-review09.txt',
    'std-402-9': 'cpa_uploader/data/official/delegated-s03-kga-2025.txt',
    'src720-13': 'cpa_uploader/data/official/kga701-706-710-720-2025-review16.txt',
    'src720-21': 'cpa_uploader/data/official/kga701-706-710-720-2025-review16.txt',
    'src720-22': 'cpa_uploader/data/official/kga701-706-710-720-2025-review16.txt',
};
const details = {
    src50515head: '소극적 조회의 증거 설득력이 적극적 조회보다 낮다는 근거와, 경영진주장 수준의 유일한 실증절차로 이용하려면 네 조건이 모두 충족되어야 한다는 결합·예외 관계가 같다. 각 조건의 구체 내용을 물음1의 추가 배점으로 요구하지 않는다.',
    src50515a: '감사인이 중요왜곡표시위험을 낮다고 평가한 조건과 해당 경영진주장 관련 통제의 운영효과성에 충분하고 적합한 증거를 입수한 조건을 모두 보존한다. 통제의 존재·설계만 확인한 경우로 바꾸지 않는다.',
    src50515b: '대상 모집단의 다수·동질성·소액 조건을 보존한다. 계정잔액/거래/조건은 대상의 대안 예시이며 세 범주를 모두 보유해야 한다는 요구로 바꾸지 않는다.',
    src50515c: '불일치사항의 예상 발생률이 매우 낮아야 한다는 조건을 유지한다. 전혀 없다는 절대조건으로 강화하지 않는다.',
    src50515d: '감사인이 조회 수신자가 요청을 무시할 상황·조건을 알고 있지 않다는 인식의 부정을 보존한다. 무시할 가능성이 절대 없다는 사실의 확정으로 바꾸지 않는다.',
    'std-402-9': '주체는 이용자기업 감사인이다. 서비스의 성격·내부통제 영향 등 유의성, 처리거래/영향받는 계정·절차의 성격·중요성, 양 활동의 상호작용, 계약조건 등 관계의 성격을 모두 포함한다. 315 각주와 A1~A11 연결은 이해 문맥이며 운영효과성 테스트의무를 새로 묻지 않는다.',
    'std-402-12': '이용자기업으로부터 충분한 이해를 얻을 수 없을 때 하나 이상 절차를 선택하는 조건을 유지한다. 입수가능할 때 유형1 또는 유형2 보고서, 이용자기업을 통한 접촉, 서비스조직 방문, 타감사인의 업무 활용이라는 네 대안을 그대로 보존한다. 발문의 전 대안 열거와 실제로 네 절차를 모두 수행할 의무는 다르다. PDF339쪽 말미의315 각주와340쪽 머리말을 그대로 포함하여 연속 원문 인용을 만들었고 추가 채점요건으로 쓰지 않는다.',
    src70016: '중요성 관점에서 해당 재무보고체계에 따라 작성되었다는 감사인의 결론이 적정의견으로 연결된다. 발문이 이미 준 결론 재진술을 추가 요구하지 않는다.',
    src70017head: '둘 중 하나에 해당하면705에 따라 의견을 변형하는 선택 관계를 보존한다. 두 상황의 동시 충족으로 바꾸지 않는다.',
    src70017a: '입수한 감사증거에 근거한 재무제표 전체의 중요한 왜곡표시 결론이라는 조건을 보존한다. 감사증거 입수 불가와 구별한다.',
    src70017b: '재무제표 전체가 중요하게 왜곡표시되지 않았다고 결론 내릴 정도의 충분하고 적합한 감사증거를 입수할 수 없는 조건을 유지한다. 실제 중요한 왜곡표시가 있다고 확인한 상황과 구별한다.',
    src70018: '공정표시체계에 따라 작성되었으나 공정표시 목적을 달성하지 못하는 조건, 경영진과의 논의, 해당 체계의 요구와 해결방법 고려,705에 따른 변형 필요성 결정이라는 단계·주체를 보존한다. A16의 추가공시/극히 드문 이탈 가능성은 설명자료이며 자동 의견변형이나 새 정답요건으로 만들지 않는다.',
    'src720-13': '감사인이 경영진과 논의할 문서·발행방식·시기, 최종본의 적시 입수 협의와 가능하면 보고서일 전이라는 한정, 이후 입수가능한 문서의 최종본을 제공가능할 때 기업 발행 전에 제공하겠다는 경영진 서면진술을 모두 보존한다. A20의 기타정보 미입수가 보고서 발행을 무조건 금지하지 않는다는 한계를 유지한다.',
    'src720-21': '보고서일에 상장기업은 기타정보 입수 또는 입수 예상, 비상장기업은 일부 또는 전부 입수라는 서로 다른 기타정보 단락 포함조건을 보존한다. 현재 사례의 상장기업 조건 적용을 비상장기업으로 확장하지 않는다. 직접 criterion 배점이 없는 범위 근거도 삭제하지 않는다.',
    'src720-22': '문단21에 따라 단락을 포함해야 할 경우에 한한다. 경영진 책임, 보고서일 전 입수 정보와 상장기업의 이후 예상 정보, 의견 범위 제외·현재와 미래 확신 미표명, 열람·고려·보고 책임을 보존한다. 보고서일 전 입수한 정보에 한한(e)의 보고사항 없음/중요한 미수정왜곡표시 설명은 대안으로 유지하고 동시 보고 의무로 바꾸지 않는다.',
};
function normalizedRange(body, quote) {
    const indices = [], chars = [];
    for (let i = 0; i < body.length; i++) if (!/\s/.test(body[i])) { indices.push(i); chars.push(body[i]); }
    const flat = chars.join(''), needle = norm(quote), found = flat.indexOf(needle);
    if (found < 0) return null;
    assert.equal(flat.indexOf(needle, found + 1), -1, 'Source quote must locate uniquely');
    return { start: indices[found], end: indices[found + needle.length - 1] + 1 };
}
function span(body, quote, allowCrossPage = false) {
    let range = normalizedRange(body, quote);
    if (!range && allowCrossPage) {
        const flat = norm(quote), prefix = normalizedRange(body, flat.slice(0, 60));
        const lastItem = flat.lastIndexOf('(d)');
        assert(lastItem >= 0, 'Only the checked 402.12 cross-page (d) continuation is supported');
        const suffix = normalizedRange(body, flat.slice(lastItem));
        assert(prefix && suffix && prefix.start < suffix.start, 'Cross-page endpoints missing');
        range = { start: prefix.start, end: suffix.end };
    }
    assert(range, 'Official exact content span missing');
    return { ...range, quote: body.slice(range.start, range.end), line_start: body.slice(0, range.start).split('\n').length,
        line_end: body.slice(0, range.end).split('\n').length };
}
const entries = [];
const suggestedSets = new Map();
for (const row of inventory) {
    const set = bank.find(set => set.id === row.set_id);
    const before = set.source_refs.find(ref => ref.id === row.source_ref_id);
    assert.deepEqual(before.source_quote, row.source_quote);
    text(before.file);
    const file = existing[before.id] ?? addedFile, body = text(file);
    const found = span(body, before.source_quote, before.id === 'std-402-12');
    const units = catalog.units.filter(unit => unit.file === file && unit.authority === 'official_transcription'
        && unit.standard === before.page && unit.startLine <= found.line_end && unit.endLine >= found.line_start);
    assert(units.length > 0, 'Missing registered official unit');
    const title = `${before.title}; ${file} L${found.line_start}–L${found.line_end}`;
    const after = { ...before, file, title, source_quote: found.quote, content_hash: sha(found.quote) };
    const requirements = set.subquestions.flatMap(sub => sub.requirements.filter(req => req.source_ref_id === before.id).map(req => {
        const rr = span(body, req.source_quote, before.id === 'std-402-12');
        assert(rr.start >= found.start && rr.end <= found.end, 'Requirement exceeds source reference');
        return { subquestion_id: sub.id, requirement_id: req.id, before: req,
            after: { ...req, source_quote: rr.quote, source_span: `${before.title}; ${file} L${rr.line_start}–L${rr.line_end}` } };
    }));
    entries.push({ set_id: set.id, source_ref_id: before.id, before_source_ref: before, after_source_ref: after, requirements,
        catalog_unit_ids: units.map(unit => unit.id),
        catalog_units: units.map(unit => ({ id: unit.id, file: unit.file, authority: unit.authority, standard: unit.standard, paragraph: unit.paragraph, locator: unit.locator, startLine: unit.startLine, endLine: unit.endLine })),
        exact_location: { source_file_sha256: sha(snapshots.get(file)), source_quote_sha256: sha(found.quote), start_char: found.start, end_char: found.end, startLine: found.line_start, endLine: found.line_end },
        affected_criteria: set.subquestions.flatMap(sub => sub.criteria.filter(criterion => criterion.source_ref_ids.includes(before.id)).map(criterion => ({ subquestion_id: sub.id, criterion_id: criterion.id, claim: criterion.claim }))),
        semantic_comparison: { status: 'local_source_comparison_complete_not_model_review', before_after_nonwhitespace_equal: norm(before.source_quote) === norm(after.source_quote),
            difference: before.id === 'std-402-12' ? 'Official page footer/315 footnotes, next-page heading/folio and extraction page marker retained between (c) and (d); no audit requirement words deleted or replaced.' : 'Only original PDF transcription whitespace/line-break differences; all nonwhitespace content identical.',
            reasoning: details[before.id], edition_evidence: `${base}/b/official-source-remediation-v1/official-pdf-evidence.json`,
            question_claim_points_changed: false, model_api_calls: 0 } });
    const candidate = suggestedSets.get(set.id) ?? structuredClone(set);
    candidate.source_refs[candidate.source_refs.findIndex(ref => ref.id === before.id)] = after;
    for (const rr of requirements) {
        const sub = candidate.subquestions.find(sub => sub.id === rr.subquestion_id);
        sub.requirements[sub.requirements.findIndex(req => req.id === rr.requirement_id)] = rr.after;
    }
    suggestedSets.set(set.id, candidate);
}
const stripSources = set => ({ ...set, source_refs: undefined, subquestions: set.subquestions.map(sub => ({ ...sub,
    requirements: sub.requirements.map(({ source_quote: _quote, source_span: _span, ...rest }) => rest) })) });
for (const set of suggestedSets.values()) assert.deepEqual(stripSources(set), stripSources(bank.find(before => before.id === set.id)), 'Question or grading contract changed');
for (const entry of entries) if (entry.source_ref_id !== 'std-402-12') assert(entry.semantic_comparison.before_after_nonwhitespace_equal);
for (const [file, bytes] of snapshots) assert.equal(sha(fs.readFileSync(path.resolve(root, file))), sha(bytes), `Input changed: ${file}`);
const doc = { version: 1, bank_file: bankFile, bank_sha256: sha(snapshots.get(bankFile)), api_calls: 0, entries,
    new_official_files: staged.new_official_files, source_catalog_fingerprint: catalog.fingerprint,
    input_files: [...snapshots].map(([file, bytes]) => ({ file, sha256: sha(bytes) })),
    scope: { selected_sets: suggestedSets.size, selected_refs: entries.length, topic_range: '07–19', current_bank_mutated: false, original_source_files_mutated: false, review_receipts_mutated: false } };
fs.writeFileSync(path.join(own, 'proposals.json'), JSON.stringify(doc, null, 2)+'\n', { flag: 'wx' });
fs.writeFileSync(path.join(own, 'proposed-sets.json'), JSON.stringify([...suggestedSets.values()], null, 2)+'\n', { flag: 'wx' });
console.log(JSON.stringify({ proposals: rel(path.join(own, 'proposals.json')), sets: suggestedSets.size, refs: entries.length,
    requirements: entries.reduce((n, entry) => n + entry.requirements.length, 0), source_unit_ids: [...new Set(entries.flatMap(entry => entry.catalog_unit_ids))], api_calls: 0 }, null, 2));
