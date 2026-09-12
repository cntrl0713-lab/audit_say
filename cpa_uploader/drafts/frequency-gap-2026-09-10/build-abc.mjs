import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSourceCatalog } from '../../questionSourceCatalog.mjs';

const base = path.dirname(fileURLToPath(import.meta.url));
const rel = 'cpa_uploader/drafts/frequency-gap-2026-09-10';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const write = (name, value) => fs.writeFileSync(path.join(base, name), JSON.stringify(value, null, 2) + '\n');
const pdfText = fs.readFileSync(path.join(base, 'sources/kga-2025-pymupdf-pages.txt'), 'utf8').replace(/\r/g, '');
function page(n) {
  const marker = `## PDF page ${n}\n`;
  const start = pdfText.indexOf(marker) + marker.length;
  if (start < marker.length) throw new Error(`Missing page ${n}`);
  const end = pdfText.indexOf('## PDF page ', start);
  return pdfText.slice(start, end < 0 ? undefined : end).split('\n').filter(line => !/^감사기준서 402 /.test(line) && !/^\d+ \/ 974/.test(line)).join('\n').trim();
}
function between(text, start, end) {
  const a = text.indexOf(start), b = end ? text.indexOf(end, a + start.length) : text.length;
  if (a < 0 || b < 0) throw new Error(`Missing source boundary: ${start} / ${end}`);
  return text.slice(a, b).trim();
}
const blocks = {
  '9': { pages: '339', quote: between(page(339), '9. \n', '10. \n') },
  '12': { pages: '339–340', quote: between(page(339), '12. \n', '\n3 감사기준서') + '\n' + between(page(340), '(d) \n', ' 서비스조직에 대한') },
  '13': { pages: '340', quote: between(page(340), '13. \n', '14. \n') },
  '16': { pages: '340–341', quote: between(page(340), '16. \n') + '\n' + between(page(341), '(a) \n', '서비스조직 통제의 운영효과성에 대한') },
  'A22': { pages: '347–348', quote: between(page(347), 'A22.', '\n10 감사기준서') + '\n' + between(page(348), '(a) \n', 'A23.') },
  '20': { pages: '342', quote: between(page(342), '20. \n', '21. \n') },
  '21': { pages: '342', quote: between(page(342), '21. \n', '22. \n') },
  '22': { pages: '342', quote: between(page(342), '22. \n', '적용 및 기타 설명자료') },
  'A42': { pages: '354', quote: between(page(354), 'A42.', '서비스감사인이 수행한 업무에 대한 언급') },
};
const url = 'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06';
const officialFile = `${rel}/sources/abc-official.txt`;
fs.writeFileSync(path.join(base, 'sources/abc-official.txt'), `한국공인회계사회 회계감사기준 전문(2025 개정), 2026 시행 기준\n원문 URL: ${url}\nPDF SHA-256: ${sha(fs.readFileSync(path.join(base, 'sources/kga-2025.pdf')))}\n2026-09-10 직접 확인. PDF 머리말·꼬리말 및 문단12·A22 사이에 끼어든 각주를 제외하고 문단·하위 항목을 연결했다.\n\n# KGA 402: 서비스조직을 이용하는 기업에 관한 감사 고려사항\n\n` + Object.entries(blocks).map(([p, b]) => `[KGA 402.${p}; PDF ${b.pages}]\n${b.quote}\n`).join('\n'));
const ref = p => ({ id: `std-402-${p}`, file: officialFile, title: `한국공인회계사회 회계감사기준 402 문단 ${p} (2025 개정 전문 PDF ${blocks[p].pages}쪽)`, page: 'KGA 402', role: 'standard', source_quote: blocks[p].quote, content_hash: sha(blocks[p].quote) });
const catalog = buildSourceCatalog();
const dataset = JSON.parse(fs.readFileSync('cpa_uploader/analysis/question-elements/question-elements.json', 'utf8'));
const links = JSON.parse(fs.readFileSync(path.join(base, 'frequency-links.json'), 'utf8'));
const edition = '2026년 시행 기준을 사용하고 2027년에도 동일 적용한다고 가정한다. 한국공인회계사회 2025 개정 전문 및 2026 개정 전문을 대조하며, 2027년 시험 적용 판본 확정으로 표시하지 않는다.';
function sub(id, type, prompt, paragraphs, claims, options) {
  const requirements = paragraphs.map(p => ({ id: `${id}-r-${p}`, source_ref_id: `std-402-${p}`, source_quote: blocks[p].quote, source_span: `KGA 402.${p}; PDF ${blocks[p].pages}` }));
  return { id, type, prompt, constraints: { ordered: false, max_entries: null, overflow_policy: 'none' }, selection: { type: 'all', n: null }, decision: options ? { options, correct: options[0] } : null, answer_slots: [{ id: `${id}.answer`, label: '답안', input: 'textarea' }], model_answer: claims.map(c => c[0]), requirements, criteria: claims.map(([answer, p = paragraphs[0], claim = answer], i) => ({ id: `${id}-c${i + 1}`, requirement_id: `${id}-r-${p}`, claim, critical_facts: [{ id: `${id}-c${i + 1}-fact`, type: 'action', expected: claim }], max_points: 1, scores: { met: 1, not_met: 0, contradicted: 0 }, source_ref_ids: [`std-402-${p}`] })) };
}
function set(id, title, paragraphs, facts, subs, notes = []) {
  return { schema_version: '3.0', id, type: 'linked_question_set', status: 'needs_review', title, classification: { topic_id: '13', part: 'PART3', chapter: '타인의 업무 활용', domain: 'audit', standards: ['KGA 402'], tags: ['서비스조직', '이용자기업 감사인'] }, source_refs: paragraphs.map(ref), shared_context: { facts: facts.map((text, i) => ({ id: `fact${i + 1}`, text, scoreable: false })) }, learning_order: subs.map(s => s.id), subquestions: subs, verification: { source_fidelity: 'excerpt', review_status: 'needs_human_review', calculation_required: false, notes: [edition, '기출·연습 빈도와 기존 문제은행의 차이는 frequency-links.json에 연결했다. 기준서 본문과 실제 발문을 독립적으로 대조한 출제 초안이며 사람 승인 및 실제 모델 채점 완료를 뜻하지 않는다.', '각 독립 criterion은 1점이다. 동일 의미의 표현과 한 문장에 담긴 여러 명제를 허용한다. 선택 가능한 절차를 모두 답하는 계약과 실제 감사에서 모든 절차를 수행해야 한다는 의무를 구별한다.', ...notes] } };
}
const a = set('draft-13-402-001', '서비스조직의 이용에 대한 이해와 추가 정보의 입수', ['9', '12'], ['서비스조직을 이용하는 기업의 재무제표감사에서 서비스 이용에 대한 이해를 다룬다.'], [
  sub('sub1', 'enumeration', '이용자기업 감사인이 서비스조직의 서비스 이용을 이해할 때 파악하여야 하는 네 범주의 사항을 모두 제시하시오. 각 범주의 대상과 범위를 포함하시오.', ['9'], [
    ['서비스조직이 제공하는 서비스의 성격과 이용자기업에 미치는 유의성을 이해한다. 이용자기업의 내부통제에 대한 영향도 포함한다.'],
    ['서비스조직이 처리한 거래 또는 그 조직에 영향을 받는 계정이나 재무보고절차의 성격과 중요성을 이해한다.'],
    ['서비스조직의 활동과 이용자기업의 활동 사이의 상호작용 정도를 이해한다.'],
    ['서비스조직 활동에 관한 계약조건 등을 포함하여 이용자기업과 서비스조직 간 관계의 성격을 이해한다.'],
  ]),
  sub('sub2', 'enumeration', '이용자기업으로부터 서비스조직에 관한 충분한 이해를 얻을 수 없는 경우, 이를 보완하기 위해 선택할 수 있는 절차를 각 절차의 조건과 함께 모두 제시하시오.', ['12'], [
    ['입수할 수 있는 경우 유형 1 또는 유형 2 보고서를 입수한다.'],
    ['특정 정보를 얻기 위하여 이용자기업을 통하여 서비스조직과 접촉한다.'],
    ['서비스조직을 방문하여 관련 통제에 관한 필요한 정보를 제공할 절차를 수행한다.'],
    ['타감사인이 수행한 업무를 활용하여 서비스조직의 통제에 관한 필요한 정보를 제공할 절차를 수행한다.'],
  ]),
], ['sub2는 선택 가능한 네 절차를 모두 쓰라는 발문이다. 실제로는 문단12에 따라 하나 이상의 절차를 선택한다. 네 절차의 동시 수행을 필수라고 채점하지 않는다.']);
const b = set('draft-13-402-002', '유형 1 보고서와 서비스조직 통제의 운영효과성', ['A22', '16', '13'], [
  'A사와 B사는 급여 계산 및 지급과 관련하여 A사의 또 다른 종속기업인 C사를 서비스조직으로 활용하고 있다.',
  '감사인은 A사의 급여 관련 통제테스트를 수행할 때 C사의 유형 1 보고서를 통제의 운영효과성에 관한 감사증거로 이용하려고 한다.',
], [
  sub('sub1', 'judgment', '제시된 유형 1 보고서를 급여 관련 통제의 운영효과성에 관한 감사증거로 이용하려는 계획이 적절한지 판단하고, 보고서가 제공하는 증거의 한계에 근거하여 이유를 설명하시오.', ['A22', '16'], [
    ['유형 1 보고서를 통제의 운영효과성에 관한 감사증거로 이용하려는 계획은 적절하지 않다.', 'A22'],
    // The prompt asks for the evidence limitation; the design/implementation clause stays in the model answer only.
    ['유형 1 보고서는 서비스조직 통제의 설계와 실행에 대한 이해에는 도움이 되지만, 관련 통제의 운영효과성에 대한 증거를 제공하지 않는다.', 'A22', '유형 1 보고서는 관련 통제의 운영효과성에 대한 증거를 제공하지 않는다.'],
  ], ['적절하지 않다', '적절하다']),
  sub('sub2', 'enumeration', '위험평가에 서비스조직의 통제가 효과적으로 운영된다는 기대가 포함된 경우, 통제의 운영효과성에 관한 감사증거를 입수하기 위해 선택할 수 있는 절차를 각 절차의 조건과 함께 모두 제시하시오.', ['16'], [
    // Live grading accepted an unspecified "서비스조직의 보고서"; sub1 of this set is about type 1 being insufficient.
    ['입수할 수 있는 경우 유형 2 보고서를 입수한다.', '16', '입수할 수 있는 경우 유형 2 보고서를 입수한다. 보고서의 유형을 특정하지 않거나 유형 1 보고서로 답하면 충족하지 않는다.'],
    ['서비스조직의 통제에 대하여 적합한 통제테스트를 수행한다.'],
    ['서비스조직의 통제에 대하여 통제테스트를 수행한 타감사인의 업무를 활용한다.'],
  ]),
  sub('sub3', 'descriptive', '유형 1 또는 유형 2 보고서가 제공하는 감사증거의 충분성과 적합성을 결정할 때, 서비스감사인과 적용 기준에 관하여 만족할 수 있어야 하는 사항을 모두 기술하시오.', ['13'], [
    ['서비스감사인이 전문가적 적격성을 갖추고 있다는 데 만족할 수 있어야 한다.'],
    ['서비스감사인이 서비스조직으로부터 독립적이라는 데 만족할 수 있어야 한다.'],
    ['발행된 유형 1 또는 유형 2 보고서에 적용된 기준이 적절하다는 데 만족할 수 있어야 한다.'],
  ]),
], ['사례는 연도별 해설 A의 2025년 문제3 물음3의 급여 서비스조직 사실·계획을 재구성했다. 원문 인용의 OCR은 보존했다. 공개 지문은 띄어쓰기를 정리하고 원문의 통제테스트 목적을 운영효과성 증거의 입수로 명료화했다. 새로운 기업·거래·결과 사실을 추가하지 않았다. 원문 교재의 정오판단 사례이므로 제시된 계획이 옳다는 의미는 아니다.', 'sub2의 세 절차는 실제 감사에서 하나 이상을 선택하는 대안이며 유형2 보고서의 입수만으로 모든 평가가 종료된다고 가르치지 않는다. 유형2 보고서의 상세 후속평가(402.17)는 이 물음 범위 밖이다.']);
const bLink = links.sets.find(x => x.candidate === 'B').links.find(x => x.target === 'sub1' && x.source_records.some(r => r.origin?.year === 2025));
if (!bLink) throw new Error('Missing B source mapping');
const bRecord = dataset.records.find(x => x.id === bLink.source_records.find(r => r.origin?.year === 2025).record_id);
if (!bRecord) throw new Error('Missing B source record');
const caseFile = bRecord.source.file;
const caseLines = fs.readFileSync(caseFile, 'utf8').replace(/\r/g, '').split('\n');
for (const [name, prefix] of [['facts', '• 한편, A사와 B사는 급여'], ['plan', '감사인은 A사의 급여 관련 통제테스트']]) {
  const line = caseLines.findIndex((text, i) => i < bRecord.source.end_line && text.startsWith(prefix));
  if (line < 0) throw new Error(`Missing case ${name}`);
  const caseQuote = caseLines.slice(line, line + 2).join('\n');
  b.source_refs.push({ id: `case-2025-3-3-${name}`, file: caseFile, title: '연도별 해설 A 수록 2025년 문제3 물음3', page: `원문 페이지 ${bRecord.source.page}; L${line + 1}–L${line + 2}`, role: 'question', source_quote: caseQuote, content_hash: sha(caseQuote) });
}
const c = set('draft-13-402-003', '서비스조직 관련 증거부족과 감사보고서의 책임', ['20', 'A42', '21', '22'], ['각 물음은 서비스조직을 이용하는 기업의 감사보고에 관한 독립된 상황이다.'], [
  sub('sub1', 'judgment', '재무제표감사와 관련된 서비스조직의 서비스에 관하여 충분하고 적합한 감사증거를 입수할 수 없다. 이용자기업 감사인이 감사의견에 관하여 따라야 할 대응 원칙을 제시하고, 이러한 증거부족이 감사상 어떤 제한에 해당하는지 설명하시오. 한정의견과 의견거절 중 하나를 선택하는 것은 요구하지 않는다.', ['20', 'A42'], [
    ['감사기준서 705에 따라 감사의견을 변형한다.', '20'],
    ['서비스조직 관련 충분하고 적합한 감사증거를 입수하지 못하였으므로 감사범위의 제한에 해당한다.', 'A42'],
  ], ['705에 따라 감사의견을 변형한다', '서비스조직에 책임을 넘기고 적정의견을 표명한다']),
  sub('sub2', 'descriptive', '적정의견 감사보고서에서 서비스감사인이 수행한 업무를 언급하는 데 적용되는 원칙과 법규상 예외를 설명하고, 예외가 적용될 때 보고서에 명시할 사항을 제시하시오.', ['21'], [
    ['법규에서 요구하지 않는 한, 적정의견 감사보고서에서 서비스감사인이 수행한 업무를 언급하지 않는다.'],
    ['법규가 그 언급을 요구한다면, 언급이 이용자기업 감사인의 감사의견에 대한 책임을 경감시키지 않는다는 사실을 감사보고서에 명시한다.'],
  ]),
  sub('sub3', 'descriptive', '서비스감사인이 수행한 업무에 대한 언급이 이용자기업 감사인의 변형의견을 이해시키는 것과 관련되어 그 업무를 언급하는 경우, 이용자기업 감사보고서에 함께 명시하여야 할 사항을 기술하시오.', ['22'], [
    ['해당 언급이 변형의견에 대한 이용자기업 감사인의 책임을 경감시키지 않는다는 사실을 명시한다.'],
  ]),
], ['이전 C/sub1은 발문에서 근거를 요구하면서 판단에만 배점했다. 감사범위 제한이라는 근거를 별도 1점으로 연결했다. C/sub3은 보고서 기재사항을 설명하는 descriptive로 분류한다.']);

const variants = {
  [a.id]: [
    ['제공 서비스의 성질 및 이용자기업에 대한 중요 영향을 파악하며 내부통제 영향도 본다.', '해당 조직이 처리하거나 영향을 주는 거래·계정·재무보고 과정의 성질과 중요도를 파악한다.', '양 조직이 수행하는 활동이 서로 연계되는 정도를 파악한다.', '업무 관련 계약 내용을 포함한 양 조직 사이 관계의 성질을 파악한다.'],
    ['이용 가능한 유형1 또는 유형2 보고서를 확보한다.', '이용자기업을 경유하여 서비스조직에 특정 정보를 문의한다.', '해당 서비스조직을 찾아가 통제 이해에 필요한 정보수집 절차를 실시한다.', '다른 감사인의 수행업무를 활용해 해당 통제에 필요한 정보를 얻는 절차를 한다.'],
  ],
  [b.id]: [
    ['운영이 효과적인지를 입증하는 자료로는 유형1을 사용할 수 없다.', '유형1은 통제 설계·실행의 이해 자료이며 운영효과성을 입증하지 않는다.'],
    ['이용 가능한 유형2 보고서를 확보한다.', '해당 서비스조직의 통제에 알맞은 운영효과성 테스트를 직접 한다.', '그 조직의 통제를 테스트한 다른 감사인의 업무를 이용한다.'],
    ['서비스감사인이 전문적 능력을 갖췄음을 확인한다.', '서비스감사인이 해당 서비스조직으로부터 독립성을 갖췄음을 확인한다.', '그 보고서를 작성할 때 적용한 기준이 적합함을 확인한다.'],
  ],
  [c.id]: [
    ['705의 규정에 따라 변형의견으로 대응한다.', '관련 증거를 얻을 수 없어 감사범위가 제한된 경우다.'],
    ['법에서 요구하는 경우를 제외하고 적정의견 보고서에서 서비스감사인의 업무를 거론하지 않는다.', '법령상 요구되어 거론하더라도 자신의 의견에 대한 책임은 줄어들지 않는다고 보고서에 적는다.'],
    ['변형의견 설명을 위한 거론이더라도 이용자기업 감사인의 그 의견에 대한 책임이 줄지 않음을 기재한다.'],
  ],
};
const wrong = {
  [a.id]: [
    ['서비스가 내부통제에 미치는 영향은 이해 대상에서 제외한다.', '서비스조직이 영향을 주는 계정의 중요성은 고려하지 않는다.', '두 조직 활동의 상호작용은 파악할 필요가 없다.', '계약조건은 조직 간 관계 이해에서 제외한다.'],
    ['입수할 수 없어도 유형1 보고서를 반드시 입수해야 한다.', '이용자기업을 경유할 필요 없이 서비스조직과 직접 접촉하는 절차로 답한다.', '서비스조직을 방문하되 관련 통제 정보는 수집하지 않는다.', '타감사인이 수행한 업무는 활용할 수 없다.'],
  ],
  [b.id]: [
    ['유형1 보고서를 운영효과성 증거로 이용하는 계획은 적절하다.', '유형1 보고서는 관련 통제의 운영효과성에 대한 증거를 제공한다.'],
    ['유형2 대신 유형1 보고서를 운영효과성 증거로 입수한다.', '서비스조직의 통제에 대한 테스트는 수행할 수 없다.', '다른 감사인이 한 서비스조직 통제테스트는 활용할 수 없다.'],
    ['서비스감사인의 전문적 적격성은 평가할 필요가 없다.', '서비스감사인이 서비스조직으로부터 독립적일 필요는 없다.', '보고서 적용 기준의 적절성은 확인하지 않아도 된다.'],
  ],
  [c.id]: [
    ['서비스조직으로부터 증거를 얻지 못해도 적정의견을 유지한다.', '증거를 입수할 수 없다는 것만으로 중요한 왜곡표시가 확정되었다고 본다.'],
    ['법규상 요구가 없어도 적정의견 보고서에 서비스감사인의 업무를 항상 언급한다.', '법규상 요구된 언급은 이용자기업 감사인의 책임이 줄어든다고 기재한다.'],
    ['변형의견을 이해시키기 위해 언급하면 이용자기업 감사인의 책임이 경감된다고 기재한다.'],
  ],
};
const boundaries = {
  [a.id]: [
    ['서비스조직이 제공하는 서비스의 성격을 이해한다.', '서비스조직이 처리한 거래의 성격을 확인한다.', '두 조직이 수행하는 활동을 각각 파악한다.', '서비스조직과 체결한 계약서를 입수한다.'],
    ['유형1 또는 유형2 보고서를 입수한다.', '특정 정보를 얻으려고 서비스조직과 접촉한다.', '서비스조직을 방문한다.', '타감사인의 업무를 활용한다.'],
  ],
  [b.id]: [
    ['유형1 보고서를 서비스조직의 통제를 이해하는 자료로 사용하는 것은 적절하다.', '유형1 보고서는 통제의 설계와 실행을 이해하는 데 도움이 된다.'],
    ['입수할 수 있으면 서비스조직의 보고서를 입수한다.', '서비스조직 통제의 설계를 파악한다.', '다른 감사인의 보고서를 활용한다.'],
    ['서비스감사인이 업무를 수임하였는지 확인한다.', '서비스감사인이 이용자기업으로부터 독립적인지 확인한다.', '유형1 또는 유형2 보고서가 최근 발행되었는지 확인한다.'],
  ],
  [c.id]: [
    ['충분하고 적합한 증거를 입수한 경우에는 감사기준서700에 따라 감사의견을 형성한다.', '서비스조직에 자료를 요청하고 있다.'],
    ['원칙적으로 서비스감사인의 업무를 언급하지 않는다.', '법규상 언급이 요구되므로 서비스감사인의 업무 내용을 감사보고서에 기재한다.'],
    ['변형의견을 이해시키기 위하여 서비스감사인이 수행한 업무를 언급한다.'],
  ],
};
function makeQA(s) {
  const cases = [];
  for (const [si, q] of s.subquestions.entries()) {
    const full = q.model_answer.join('\n');
    const add = (kind, answer, target, verdict, all = false, why = '') => {
      let expected_verdicts = q.criteria.map((c, i) => ({ criterion_id: c.id, verdict: all ? (i === target && verdict !== 'met' ? verdict : 'met') : (i === target ? verdict : 'not_met') }));
      if (s.id === b.id && q.id === 'sub1') {
        if (kind === 'equivalent_expression' && target === 1) {
          expected_verdicts = q.criteria.map(c => ({ criterion_id: c.id, verdict: 'met' }));
          why = '운영효과성을 입증하지 않는다는 설명은 제시된 이용 목적의 부적절 판단을 명백히 함축한다. 판단과 근거에 각각 1점이다.';
        }
        if (kind === 'omission' && target === 0) {
          answer = '계획의 적절성은 판단을 유보한다. 유형1 보고서는 서비스조직에 대한 이해에 도움이 된다.';
          expected_verdicts = q.criteria.map(c => ({ criterion_id: c.id, verdict: 'not_met' }));
          why = '명시적 판단도 함축되는 조치도 없고 운영효과성 증거의 한계도 쓰지 않았다. 명확한 이유를 쓴 답안에서 판단 문구만 지운 것을 0점 반례로 삼지 않는다.';
        }
        if (kind === 'contradiction' && target === 1) {
          expected_verdicts = q.criteria.map(c => ({ criterion_id: c.id, verdict: 'contradicted' }));
          why = '운영효과성 증거를 제공한다는 반대 이유는 이 목적의 이용이 가능하다는 반대 판단도 함축한다.';
        }
      }
      cases.push({ id: `${q.id}-${kind}-${cases.length + 1}`, subquestion_id: q.id, kind, answer, expected_points: expected_verdicts.filter(x => x.verdict === 'met').length, expected_verdicts, rationale: why || '원문과 독립 채점명제를 대조해 먼저 정한 기대값이다. 실제 모델의 판정 결과가 아니다.' });
    };
    q.criteria.forEach((criterion, ci) => {
      add('model_answer', full, ci, 'met', true);
      add('equivalent_expression', variants[s.id][si][ci], ci, 'met');
      add('omission', q.model_answer.filter((_, i) => i !== ci).join('\n'), ci, 'not_met', true);
      add('contradiction', wrong[s.id][si][ci], ci, 'contradicted');
      add('condition_boundary', boundaries[s.id][si][ci], ci, 'not_met', false, '주어진 발문이 요구하는 조건·대상·범위 또는 조치의 일부만 답하거나 다른 적용 상황을 답한 경계 사례다. 반대 의미 답안과 별개로, 독립 명제의 필수 범위를 완성하지 못하여 이 명제는 0점이다.');
    });
    add('empty', '', -1, 'not_met');
    if (s.id === b.id && q.id === 'sub1') {
      add('implied_conclusion', variants[s.id][si][1], -1, 'met', true, '운영효과성 증거로 사용할 수 없다는 분명한 이유는 이 계획의 부적절 판단을 함축하므로 2점이다.');
      add('limitation_only', '유형1 보고서는 운영효과성에 대한 증거를 제공하지 않으므로 이 계획은 적절하지 않다.', -1, 'met', true, '발문이 요구한 증거의 한계를 제시했다. 설계·실행 이해에 도움이 된다는 부연은 채점 요건이 아니므로 2점이다.');
      add('explicit_opposite_conclusion', q.model_answer[1] + ' 따라서 제시된 계획은 적절하다.', 0, 'contradicted', true, '증거의 한계는 맞게 설명했어도 명시적 반대 결론을 썼으므로 판단 점수는 0점이고 독립된 이유 점수 1점만 남는다.');
    }
    if (q.type === 'enumeration') {
      add('reverse_order', [...q.model_answer].reverse().join('\n'), -1, 'met', true);
      add('single_sentence', q.model_answer.join(' '), -1, 'met', true);
      add('irrelevant_prefix', '오늘은 날씨가 맑다.\n' + full, -1, 'met', true);
      add('names_only', '유형1, 유형2, 서비스조직, 감사인', -1, 'not_met', false, '이 물음은 명칭만이 아니라 각 조치·조건 또는 이해할 범주를 요구한다. 단순한 관련 명칭 나열은 그 요구를 충족하지 않는다.');
    }
  }
  return { set_id: s.id, method: 'source_and_contract_review', human_approval: false, live_model_grading: 'not_run', cases };
}
for (const s of [a, b, c]) {
  write(`${s.id}.json`, s);
  const entry = links.sets.find(x => x.set_id === s.id);
  const sourceUnits = catalog.units.filter(u => u.standard === 'KGA 402' && s.source_refs.some(r => r.id === `std-402-${u.paragraph}`)).map(u => u.id);
  for (const link of entry.links) for (const record of link.source_records) sourceUnits.push(...record.source_unit_ids, ...record.context_source_unit_ids);
  write(`${s.id}.authoring-plan.json`, { version: 1, set_id: s.id, topic_id: '13', mode: s === b ? 'adapt_existing_question' : 'new_from_standard', objective: s.title + '에 관하여 주체·조건에 맞는 이해사항, 절차 또는 보고 책임을 설명한다.', scope: { actors: ['이용자기업 감사인', '서비스조직', '서비스감사인'], timing: [s === c ? '감사의견 형성 및 감사보고' : '위험평가 및 감사증거 입수'], conditions: [s === a ? '이용자기업으로부터 충분한 이해를 얻을 수 없는 경우를 별도 물음으로 구분' : s === b ? '유형1 보고서의 운영효과성 증거로서의 이용; 통제 운영효과성에 의존하는 위험평가' : '증거부족, 적정의견, 변형의견은 물음별 독립 상황'], exceptions: [s === c ? '적정의견 보고서의 서비스감사인 업무 언급은 법규에서 요구하는 경우 예외' : '선택 가능한 절차 중 하나 이상으로 목적을 달성; 보고서 입수가능 조건 보존'], required_answers: s.subquestions.map(q => `${q.id}: ${q.prompt}`), exclusions: ['산술 계산', '실제 감사에서 모든 대안 절차를 동시에 수행해야 한다는 주장', s === c ? '한정의견과 의견거절 중 특정 의견의 선택' : 'KGA402.17 유형2 보고서 상세평가 및 하위서비스조직 처리'] }, question_types: [...new Set(s.subquestions.map(q => q.type))], source_unit_ids: [...new Set(sourceUnits)], existing_question_difference: '현재 주제13의 pilot-13-001~005는 내부감사 및 감사인측 전문가를 다룬다. 이번 세트는 별도 기준서402의 서비스조직 요구사항을 독립적으로 평가한다. frequency-links.json의 실제 은행 대조 및 원출제 연결을 함께 읽는다.', edition_assumption: edition, unresolved_items: [], status: 'ready', official_evidence: s.source_refs.filter(r => r.role === 'standard').map(r => ({ file: r.file, paragraph: r.title, page: r.page, quote_sha256: r.content_hash, official_url: url })), readiness_note: 'ready는 정해진 판본 가정 안에서 초안을 작성할 준비가 되었다는 뜻이다. 사람 승인·실제 모델 채점·2027년 시험 적용 확정은 미완료다.' });
  write(`qa-${s.id.replace('draft-', '')}.json`, makeQA(s));
}
const newerText = fs.readFileSync(path.join(base, 'sources/kga-2026-pymupdf-pages.txt'), 'utf8').replace(/\r/g, '');
const comparisonText = (text, n) => text.split(`## PDF page ${n}\n`)[1].split('## PDF page ')[0].replace(/감사기준서 402[^\n]*|\d+ \/ (974|1001)|\s+/g, '');
const comparisons = [337,338,339,340,341,342,347,348,354,355].map(n => ({ pdf_2025_page: n, pdf_2026_page: n + 26, comparison: 'page_headers_numbers_and_whitespace_removed', equal: comparisonText(pdfText, n) === comparisonText(newerText, n + 26) }));
if (comparisons.some(c => !c.equal)) throw new Error('402 edition comparison differs; inspect before regenerating');
write('abc-source-evidence.json', { version: 1, checked_at: '2026-09-10', set_ids: [a.id, b.id, c.id], official_sources: [{ edition: '2025-11', url, file: `${rel}/sources/kga-2025.pdf`, sha256: sha(fs.readFileSync(path.join(base, 'sources/kga-2025.pdf'))) }, { edition: '2026', url: 'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06', file: `${rel}/sources/kga-2026-full.pdf`, sha256: sha(fs.readFileSync(path.join(base, 'sources/kga-2026-full.pdf'))) }], transcription: { file: officialFile, sha256: sha(fs.readFileSync(path.join(base, 'sources/abc-official.txt'))) }, comparisons, visual_check_pages: [339, 340, 342, 348], edition_assumption: edition });
console.log('A/B/C draft JSON, plans, source excerpt, author QA written.');
