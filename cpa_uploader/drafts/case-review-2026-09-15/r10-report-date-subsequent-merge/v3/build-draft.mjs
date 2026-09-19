// r10 v3: 사용자 지시(2026-09-19)에 따라 주주총회 승인을 이사회 승인으로 착각하게 하는 ②를 함정으로 두고, ②와 짝을 이루어
// 두 경우(이사회 승인은 필요, 주주총회 승인은 불필요)를 함께 보이던 ①을 감사의견근거 단락의 독립성 기술(KGA 700 문단 28(c))에 관한 항목으로 바꾼다.
// 물음 2·3, 자료 1·3·4, ②~④는 v2와 바이트까지 같다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r10-report-date-subsequent-merge/v3/build-draft.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r10-report-date-subsequent-merge';
const OUT = `${D}/v3`;
const BANK = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const R15 = 'cpa_uploader/data/official/kga700-705-2025-review15.txt';
const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const [v2] = JSON.parse(fs.readFileSync(`${D}/v2/sets.json`, 'utf8'));
const set = structuredClone(v2);
const bank = JSON.parse(fs.readFileSync(BANK, 'utf8'));
assert(!bank.some((s) => s.id === set.id), 'new set ID must not exist in the bank');
for (const ref of set.source_refs) assert.equal(sha(ref.source_quote), ref.content_hash, ref.id);

// 출처: KGA 700 문단 28(주제15 등록본 발췌)을 더하고, 쓰지 않게 된 문단 A67을 뺀다.
const r15 = fs.readFileSync(R15, 'utf8');
const start = '28. 감사보고서에는 감사의견 단락 바로 다음에', end = '는지 여부에 대한 기술';
const i = r15.indexOf(start), j = r15.indexOf(end, i);
assert(i >= 0 && j > i && r15.indexOf(start, i + 1) === -1, '700.28 발췌 위치');
const q28 = r15.slice(i, j + end.length);
const first = r15.slice(0, i).split('\n').length;
const kga700_28 = { id: 'kga700-28', file: R15, title: `KGA 700 문단 28, 2025 개정 전문 원문 PDF 678쪽; L${first}-L${first + q28.split('\n').length - 1}`,
    page: 'KGA 700', source_quote: q28, role: 'standard', content_hash: sha(q28) };
set.source_refs.splice(set.source_refs.findIndex((r) => r.id === 'kga700-46'), 0, kga700_28);
set.source_refs = set.source_refs.filter((r) => r.id !== 'kga700-A67');
const quote = (id) => set.source_refs.find((r) => r.id === id).source_quote;

const fact2 = set.shared_context.facts.find((f) => f.id === 'fact2');
const lines = fact2.text.split('\n'); assert(lines[1].startsWith('① '));
lines[1] = '① 업무수행이사는 감사위원회에 독립성 준수 확인서를 제출한 것으로 충분하다고 보고, 감사보고서의 감사의견근거 단락에서는 감사인의 독립성과 윤리적 책임에 관한 기술을 빼기로 하였다.';
fact2.text = lines.join('\n');

const sub1 = set.subquestions.find((q) => q.id === 'sub1');
assert(sub1.model_answer[1].startsWith('① '));
sub1.model_answer[1] = '① 감사의견근거 단락에는 감사인이 감사와 관련된 윤리적 요구사항에 따라 기업으로부터 독립적이며 그 요구사항에 따른 기타의 윤리적 책임을 이행하였다는 기술(관련 윤리적 요구사항의 원천이 되는 관할지의 표시 포함)을 포함하여야 한다. 감사위원회에 독립성 준수 확인서를 제출하였다는 이유로 감사보고서에서 이 기술을 뺄 수 없다.';
const req = (id) => sub1.requirements.find((r) => r.id === id);
Object.assign(req('sub1.req1'), { source_span: 'KGA 700 문단 28·46·49·A63·A66·A69; 식별 기준: ①(감사위원회에 독립성 준수 확인서를 제출한 것으로 충분하다고 보고 감사의견근거 단락에서 독립성·윤리적 책임에 관한 기술을 빼기로 함), ④(감사보고서일은 제출일인 3월 17일까지 발생한 사건과 거래의 영향을 고려하였다는 뜻이라고 설명)는 옳지 않다. ②는 KGA 700 문단 49·A69(감사보고서일은 모든 단위재무제표와 공시의 작성, 인정된 권한을 가진 기구인 이사회의 책임 확인을 포함한 충분하고 적합한 증거의 입수일보다 빠르지 않아야 하며, 그 결론에 주주의 최종승인은 필요하지 않음. 주주총회 승인을 이사회 승인과 혼동하게 하는 함정), ③은 KGA 700 문단 A63(개인의 안전에 대한 위협은 법적 책임 또는 법규 및 전문가적 제재의 위협을 포함하지 않음)에 따라 옳다.' });
Object.assign(req('sub1.req2'), { source_ref_id: 'kga700-28', source_quote: quote('kga700-28'),
    source_span: 'KGA 700 문단 28(c); 적용: 감사보고서의 감사의견근거 단락에는 감사인이 감사와 관련된 윤리적 요구사항에 따라 기업으로부터 독립적이며 그러한 요구사항에 따른 기타의 윤리적 책임들을 이행하였다는 기술을 포함하여야 하고, 그 기술에는 관련 윤리적 요구사항의 원천에 대한 관할지의 표시 또는 국제윤리기준에 대한 언급이 포함되어야 한다. 지배기구에 독립성 준수 확인서를 제출한 것은 감사보고서의 이 기술을 대신하지 못한다.' });
const crit = (id) => sub1.criteria.find((c) => c.id === id);
crit('sub1.c1').source_ref_ids = ['kga700-28', 'kga700-49', 'kga700-A66', 'kga700-A69', 'kga700-46', 'kga700-A63'];
const c2 = '① 감사의견근거 단락에는 감사인이 감사와 관련된 윤리적 요구사항에 따라 기업으로부터 독립적이며 그 밖의 윤리적 책임을 이행하였다는 기술을 포함해야 하므로 감사위원회에 대한 독립성 준수 확인서로 대신할 수 없다는 이유나, 그 기술을 감사의견근거 단락에 넣어야 한다는 절차를 제시한다. 둘 중 하나만 써도 인정하며 윤리적 요구사항의 원천(관할지)의 표시나 문단 번호는 요구하지 않는다. 감사위원회에 확인서를 제출했으면 감사보고서에는 독립성에 관한 기술을 넣지 않아도 된다고 쓰면 인정하지 않는다.';
Object.assign(crit('sub1.c2'), { claim: c2, critical_facts: [{ id: 'sub1.c2.fact', type: 'action', expected: c2 }], source_ref_ids: ['kga700-28'] });

set.verification.notes[0] += ' v3(2026-09-19): 사용자 지시에 따라 주주총회 승인을 이사회 승인으로 착각하게 하는 ②를 함정으로 두고, ②와 함께 두 경우(감사보고서일 전에 필요한 이사회 승인과 필요 없는 주주총회 승인)를 보이던 ①을 감사의견근거 단락의 독립성 기술(KGA 700 문단 28(c))에 관한 항목으로 바꾸었다.';
assert(set.verification.notes[1].includes('KGA 700 문단 46·49·A61~A63·A66~A69'));
set.verification.notes[1] = set.verification.notes[1].replace('KGA 700 문단 46·49·A61~A63·A66~A69', 'KGA 700 문단 28·46·49·A61~A63·A66~A69');

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/sets.json`, JSON.stringify([set], null, 2) + '\n', { flag: 'wx' });
// v2와 달라진 곳이 ①, 물음 1의 ①에 관한 모범답안·기준, 출처(28 추가·A67 제외), notes뿐인지 확인한다.
assert.deepEqual(set.subquestions.filter((q) => q.id !== 'sub1'), v2.subquestions.filter((q) => q.id !== 'sub1'));
assert.deepEqual(set.shared_context.facts.filter((f) => f.id !== 'fact2'), v2.shared_context.facts.filter((f) => f.id !== 'fact2'));
assert.deepEqual(fact2.text.split('\n').filter((_, k) => k !== 1), v2.shared_context.facts.find((f) => f.id === 'fact2').text.split('\n').filter((_, k) => k !== 1));
assert.deepEqual(set.source_refs.filter((r) => r.id !== 'kga700-28'), v2.source_refs.filter((r) => r.id !== 'kga700-A67'));
const used = new Set(set.subquestions.flatMap((q) => [...q.requirements.map((r) => r.source_ref_id), ...q.criteria.flatMap((c) => c.source_ref_ids)]));
assert.deepEqual(set.source_refs.map((r) => r.id).filter((id) => !used.has(id)), [], 'every source is used');
const chars = [...set.shared_context.facts.map((f) => f.text).join('\n')].length;
assert(chars >= 400, 'facts must be at least 400 characters');
console.log({ set: set.id, facts_characters: chars, points: set.subquestions.map((q) => q.criteria.length), sha256: createHash('sha256').update(fs.readFileSync(`${OUT}/sets.json`)).digest('hex') });
