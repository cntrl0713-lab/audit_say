// r10 v2: 사용자 지적(2026-09-19)에 따라 ③(법적·제재 위협)과 ④(신체적 위협과 지배기구 논의)가 두 경우를 함께 보여 정답 힌트가 되므로,
// ④와 그 사실(익명 편지)을 없애고 감사보고서일의 의미에 관한 항목으로 바꾼다. 물음 2·3과 나머지 사실·출처는 v1과 바이트까지 같다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r10-report-date-subsequent-merge/v2/build-draft.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r10-report-date-subsequent-merge';
const OUT = `${D}/v2`;
const BANK = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const S05 = 'cpa_uploader/data/official/delegated-s05-kga-2025.txt';
const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const [v1] = JSON.parse(fs.readFileSync(`${D}/sets.json`, 'utf8'));
const set = structuredClone(v1);
const bank = JSON.parse(fs.readFileSync(BANK, 'utf8'));
assert(!bank.some((s) => s.id === set.id), 'new set ID must not exist in the bank');
for (const ref of set.source_refs) assert.equal(sha(ref.source_quote), ref.content_hash, ref.id);

// 출처: v1의 등록 인용은 그대로 두고 KGA 700 문단 A66(s05 등록본 발췌)과 KGA 560 문단 10(48번 원 세트 인용 재사용)을 더한다.
const s05 = fs.readFileSync(S05, 'utf8');
const start = 'A66. 감사보고서일은', end = '감사기준서 560에서 다룬다.';
const i = s05.indexOf(start), j = s05.indexOf(end, i);
assert(i >= 0 && j > i && s05.indexOf(start, i + 1) === -1, 'A66 발췌 위치');
const a66 = s05.slice(i, j + end.length);
const a66First = s05.slice(0, i).split('\n').length;
const kga700A66 = { id: 'kga700-A66', file: S05, title: `KGA 700 문단 A66, 2025 개정 전문 원문 PDF 700쪽; L${a66First}-L${a66First + a66.split('\n').length - 1}`,
    page: 'KGA 700', source_quote: a66, role: 'standard', content_hash: sha(a66) };
const r48 = bank.find((s) => s.id === 'case-12-post-report-refusal-20260914').source_refs.find((r) => r.id === 'src-571698f8ae613cde46');
assert(r48 && r48.content_hash === sha(r48.source_quote) && r48.page === 'KGA 560');
const r12 = fs.readFileSync(r48.file, 'utf8'); const k = r12.indexOf(r48.source_quote); assert(k >= 0);
const r48First = r12.slice(0, k).split('\n').length;
const kga560_10 = { id: 'kga560-10', file: r48.file, title: `KGA 560 문단 10, 2025 개정 전문 원문 PDF 537쪽; L${r48First}-L${r48First + r48.source_quote.split('\n').length - 1}`,
    page: r48.page, source_quote: r48.source_quote, role: 'standard', content_hash: r48.content_hash };
const at = (id) => set.source_refs.findIndex((r) => r.id === id);
set.source_refs.splice(at('kga700-A67'), 0, kga700A66);
set.source_refs.splice(at('kga560-11'), 0, kga560_10);
const quote = (id) => set.source_refs.find((r) => r.id === id).source_quote;

// 사실 2: 익명 편지 문장을 없애고 ④를 바꾼다. ①~③과 도입 문장의 나머지는 그대로 둔다.
const fact2 = set.shared_context.facts.find((f) => f.id === 'fact2');
const letter = ' 3월 9일에는 업무수행이사의 이름이 공개되면 그 가족에게 위해를 가하겠다는 익명의 편지가 법인에 접수되었다.';
assert(fact2.text.includes(letter)); fact2.text = fact2.text.replace(letter, '');
const lines = fact2.text.split('\n'); assert(lines[4].startsWith('④ '));
lines[4] = '④ 업무수행이사는 감사위원회에 감사보고서를 설명하면서, 감사보고서일은 감사보고서를 미르전자에 제출하는 3월 17일까지 발생한 사건과 거래의 영향을 감사인이 고려하였다는 것을 뜻한다고 설명하였다.';
fact2.text = lines.join('\n');

const sub1 = set.subquestions.find((q) => q.id === 'sub1');
assert.equal(sub1.model_answer.length, 3); assert(sub1.model_answer[2].startsWith('④ '));
sub1.model_answer[2] = '④ 감사보고서일은 그날인 3월 12일까지 발생하여 감사인이 알게 된 사건과 거래의 영향을 감사인이 고려하였다는 사실을 알리는 것이며, 감사보고서일 후 제출일까지 발생한 사건은 포함하지 않는다. 감사인은 감사보고서일 후에는 재무제표에 대하여 감사절차를 수행할 의무가 없고, 그 사이에 알게 된 사실은 후속사건에 관한 감사기준서에 따라 대응한다.';
const req = (id) => sub1.requirements.find((r) => r.id === id);
Object.assign(req('sub1.req1'), { source_span: 'KGA 700 문단 46·49·A63·A66·A67·A69; 식별 기준: ①(감사보고서일은 금액과 공시에 대한 감사절차를 마친 날로 정하면 되고 이사회의 재무제표 승인 일정과 관계없다고 판단), ④(감사보고서일은 제출일인 3월 17일까지 발생한 사건과 거래의 영향을 고려하였다는 뜻이라고 설명)는 옳지 않다. ②는 KGA 700 문단 49·A69(감사보고서일은 모든 단위재무제표와 공시의 작성, 인정된 권한을 가진 기구의 책임 확인을 포함한 충분하고 적합한 증거의 입수일보다 빠르지 않아야 하며, 그 결론에 주주의 최종승인은 필요하지 않음), ③은 KGA 700 문단 A63(개인의 안전에 대한 위협은 법적 책임 또는 법규 및 전문가적 제재의 위협을 포함하지 않음)에 따라 옳다.' });
Object.assign(req('sub1.req3'), { source_ref_id: 'kga700-A66', source_quote: quote('kga700-A66'),
    source_span: 'KGA 700 문단 A66, KGA 560 문단 10; 적용: 감사보고서일은 이 날까지 발생된 사항으로서 감사인이 알게 된 사건과 거래의 영향을 감사인이 고려하였다는 사실을 알리며, 감사보고서일 후의 사건과 거래에 대한 책임은 감사기준서 560이 다룬다. 감사인은 감사보고서일 후에는 재무제표에 대하여 감사절차를 수행할 의무가 없으므로, 제출일(3월 17일)까지 발생한 사건의 영향을 고려하였다는 설명은 옳지 않다.' });
const crit = (id) => sub1.criteria.find((c) => c.id === id);
crit('sub1.c1').source_ref_ids = ['kga700-49', 'kga700-A66', 'kga700-A67', 'kga700-A69', 'kga700-46', 'kga700-A63'];
const c3 = '④ 감사보고서일은 그날인 3월 12일까지 발생하여 감사인이 알게 된 사건과 거래의 영향을 감사인이 고려하였다는 것을 알리며 감사보고서일 후 제출일까지의 사건은 포함하지 않는다는 이유나, 감사인은 감사보고서일 후에는 재무제표에 대한 감사절차를 수행할 의무가 없으므로 제출일까지의 사건을 고려하였다고 설명할 수 없다는 이유를 제시한다. 둘 중 하나만 써도 인정하며 문단 번호는 요구하지 않는다. 감사보고서일 후 제출일까지 알게 된 사실은 후속사건에 관한 감사기준서에 따라 다룬다는 취지도 인정한다. 감사보고서일이 제출일까지의 사건과 거래를 고려하였다는 뜻이라고 쓰면 인정하지 않는다.';
Object.assign(crit('sub1.c3'), { claim: c3, critical_facts: [{ id: 'sub1.c3.fact', type: 'action', expected: c3 }], source_ref_ids: ['kga700-A66', 'kga560-10'] });

set.verification.notes[0] += ' v2(2026-09-19): 사용자 지적에 따라 ③(주주의 법적·제재 위협)과 함께 두 경우를 모두 보여 정답 힌트가 되던 ④(익명 편지의 신체적 위협과 감사위원회에 대한 사후 통지)와 익명 편지 사실을 없애고, ④를 감사보고서일의 의미(KGA 700 문단 A66)에 관한 항목으로 바꾸었다. 물음 2·3은 v1과 같다.';

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/sets.json`, JSON.stringify([set], null, 2) + '\n', { flag: 'wx' });
// v1과 달라진 곳이 사실 2, 물음 1, 출처 추가, notes뿐인지 확인한다.
assert.deepEqual(set.subquestions.filter((q) => q.id !== 'sub1'), v1.subquestions.filter((q) => q.id !== 'sub1'));
assert.deepEqual(set.shared_context.facts.filter((f) => f.id !== 'fact2'), v1.shared_context.facts.filter((f) => f.id !== 'fact2'));
assert.deepEqual(set.source_refs.filter((r) => !['kga700-A66', 'kga560-10'].includes(r.id)), v1.source_refs);
const chars = [...set.shared_context.facts.map((f) => f.text).join('\n')].length;
assert(chars >= 400, 'facts must be at least 400 characters');
console.log({ set: set.id, facts_characters: chars, points: set.subquestions.map((q) => q.criteria.length), sha256: createHash('sha256').update(fs.readFileSync(`${OUT}/sets.json`)).digest('hex') });
