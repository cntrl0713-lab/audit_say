import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const base = 'cpa_uploader/drafts/frequency-gap-2026-09-10';
const hash = value => createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const all2025 = read(`${base}/sources/kga-2025-pymupdf-pages.txt`);
const all2026 = read(`${base}/sources/kga-2026-pymupdf-pages.txt`);
const page = (text, n) => {
  const match = text.match(new RegExp(`## PDF page ${n}\\n([\\s\\S]*?)(?=## PDF page |$)`));
  if (!match) throw new Error(`Missing PDF page ${n}`);
  return match[1].trimEnd();
};
const between = (text, start, end) => {
  const a = text.indexOf(start);
  const b = text.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`Missing quote boundary ${start} / ${end}`);
  return text.slice(a, b).trim();
};
const paragraph = (text, p, n, end) => end
  ? between(page(text, p), `\n${n}. \n`, end)
  : page(text, p).slice(page(text, p).indexOf(`\n${n}. \n`)).trim();
const sourceFile = `${base}/sources/fgi-official.txt`;
const url2025 = 'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06';
const url2026 = 'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06';
const sourcePages = [84, 90, 91, 108, 109, 144, 146, 147, 156, 157, 809, 810, 812, 817, 824];
const quote = {
  f16: paragraph(all2025, 146, 16),
  f17: paragraph(all2025, 147, 17, '커뮤니케이션 절차'),
  g39: `${paragraph(all2025, 90, 39)}\n\n## PDF page 91\n${between(page(all2025, 91), '감사기준서 240', '서면진술')}`,
  i13: paragraph(all2025, 810, 13, '기타정보의 열람과 고려'),
  i21: paragraph(all2025, 812, 21, '\n22. \n'),
  i22: paragraph(all2025, 812, 22, '\n23. \n'),
};
// Compare the complete requirements, including subordinate clauses. Only PDF
// page headers/footers and whitespace differ in these particular provisions.
const stripLayout = value => value.replace(/## PDF page \d+/g, '').replace(/감사기준서 240 ‘재무제표감사에서 부정에 관한 감사인의 책임’/g, '').replace(/\d+ \/ (974|1001)/g, '').replace(/\s/g, '');
const quote2026 = {
  f16: paragraph(all2026, 171, 16),
  f17: paragraph(all2026, 172, 17, '커뮤니케이션 절차'),
  g39: `${paragraph(all2026, 115, 39)}\n\n## PDF page 116\n${between(page(all2026, 116), '감사기준서 240', '서면진술')}`,
  i13: paragraph(all2026, 837, 13, '기타정보의 열람과 고려'),
  i21: paragraph(all2026, 839, 21, '\n22. \n'),
  i22: paragraph(all2026, 839, 22, '\n23. \n'),
};
const comparison = Object.keys(quote).map(key => ({ key, same_ignoring_page_layout: stripLayout(quote[key]) === stripLayout(quote2026[key]), quote_2025_sha256: hash(quote[key]), quote_2026_sha256: hash(quote2026[key]) }));
if (comparison.some(item => !item.same_ignoring_page_layout)) throw new Error('Target requirements differ between editions; review before drafting');
const sourceText = [
  '한국공인회계사회 회계감사기준 전문(全文), 2025년 11월 개정. F/G/I 출제 근거와 의존 문맥.',
  `Official URL (2025): ${url2025}`,
  `Official URL (2026 comparison): ${url2026}`,
  `2025 PDF SHA-256: ${hash(fs.readFileSync(`${base}/sources/kga-2025.pdf`))}`,
  `2026 PDF SHA-256: ${hash(fs.readFileSync(`${base}/sources/kga-2026-full.pdf`))}`,
  'Checked: 2026-09-10. PyMuPDF text extraction; selected complete page bodies preserved; CRLF normalized to LF only.',
  '260.17: the official rendered page contains (a), (i), (ii), without a printed (b); this transcription does not insert one.',
  'Edition comparison: 240.39 (2025 pp90–91 / 2026 pp115–116), 260.16–17 (pp146–147 / pp171–172), 720.13 (p810 / p837), 720.21–22 (p812 / p839) have identical wording after excluding page furniture and whitespace.',
  '720.10 staged effective date: listed entities with preceding year-end assets of KRW 500 billion or more: periods beginning on/after 2026-01-01; other listed and unlisted entities: periods beginning on/after 2027-01-01. The assumed 2027 examination edition is not officially confirmed by this file.',
  ...sourcePages.map(n => {
    const heading = { 84: '# KGA 240: 재무제표감사에서 부정에 관한 감사인의 책임', 144: '# KGA 260: 지배기구와의 커뮤니케이션', 809: '# KGA 720: 기타정보에 관한 감사인의 책임' }[n];
    return `${heading ? `\n${heading}\n` : ''}\n## PDF page ${n}\n${page(all2025, n)}`;
  }),
].join('\n') + '\n';
fs.writeFileSync(sourceFile, sourceText, 'utf8');
for (const [key, text] of Object.entries(quote)) if (!sourceText.includes(text)) throw new Error(`Quote ${key} not present in source`);
fs.writeFileSync(`${base}/sources/fgi-edition-comparison.json`, JSON.stringify({ version: 1, checked_at: '2026-09-10', method: 'complete_requirement_text_comparison_excluding_page_furniture_and_whitespace', source_file: sourceFile, source_sha256: hash(sourceText), comparisons: comparison }, null, 2) + '\n');

const edition = '한국공인회계사회 2025년 11월 개정 전문의 해당 문단 전체를 인용하고, 2026년 7월 개정 공식 전문에서 같은 문단의 본문·하위항목이 동일함을 대조했다. 2026년 시행 기준을 2027년에도 동일 적용한다는 작업 가정이며, 2027년 최종 시험 적용 판본 확정은 아니다.';
const ref = (id, standard, paragraphNo, pages, text) => ({ id, file: sourceFile, title: `한국공인회계사회 회계감사기준 전문(2025년 11월 개정) ${standard} 문단 ${paragraphNo} · PDF ${pages}쪽`, page: standard, role: 'standard', source_quote: text, content_hash: hash(text) });
const conditions = { ordered: false, max_entries: null, overflow_policy: 'none' };
const selection = { type: 'all', n: null };
const clause = (full, a, b) => b ? between(full, a, b) : full.slice(full.indexOf(a)).trim();
// Each row is one independent scoring proposition. Its QA variants are authored
// from the condition and action in the source, not generated by a grading model.
const row = (claim, accepted, contradiction, boundary, boundaryVerdict = 'not_met') => ({ claim, accepted, contradiction, boundary, boundaryVerdict });
const f1 = [
  row('기업 회계실무의 유의적 질적 측면에 대한 감사인의 견해를 지배기구와 커뮤니케이션한다. 여기에는 회계정책, 회계추정 및 재무제표 공시 등이 포함된다.', '회계정책·추정·공시 등을 포함한 회계실무의 중요한 질적 측면을 감사인이 어떻게 보는지 지배기구에 전달한다.', '회계실무의 유의적 질적 측면에 대한 감사인의 견해는 지배기구에 알릴 필요가 없다.', '기업이 채택한 회계정책의 명칭만 지배기구에 통보한다.'),
  row('재무보고체계상 수용가능한 유의적 회계실무라도 그 기업의 특정 상황에 최적이지 않다고 보는 경우에는 지배기구에 그 이유를 설명한다.', '허용되는 유의적 회계처리라 해도 해당 회사의 구체적 사정에 가장 적합하지 않다는 견해라면 그 판단의 이유를 지배기구에 설명한다.', '재무보고체계에서 허용하는 회계실무라면 기업 상황에 최적이지 않다고 보아도 그 이유를 설명할 필요가 없다.', '기업 상황에 최적이지 않은 유의적 회계실무라는 결론만 지배기구에 알린다.'),
  row('감사 중 직면한 유의적 어려움이 있다면 그 내용을 지배기구와 커뮤니케이션한다.', '감사 수행 과정에서 중대한 어려움을 겪었다면 어떤 어려움인지 지배기구에 알린다.', '감사 중 유의적 어려움이 있었더라도 그 내용은 지배기구에 알리지 않는다.', '감사 중 어려움이 있었다는 사실만 지배기구에 알린다.'),
  row('지배기구 구성원 중 경영에 참여하지 않는 사람이 있는 경우, 감사 중 발생하여 경영진과 논의하였거나 서신을 교환한 유의적 사항을 지배기구와 커뮤니케이션한다.', '지배기구 전원이 경영을 맡고 있는 경우가 아니라면, 감사 중 경영진과 토의하거나 서신을 주고받은 중요한 사항을 지배기구에도 전달한다.', '지배기구 전원이 경영에 참여하는 경우에만 경영진과 논의한 유의적 사항을 지배기구에 전달할 의무가 있다.', '경영에 참여하지 않는 지배기구 구성원이 있으면 경영진과 논의하고 서신도 교환한 유의적 사항만 전달한다.', 'contradicted'),
  row('지배기구 구성원 중 경영에 참여하지 않는 사람이 있는 경우, 감사인이 요청하고 있는 서면진술을 지배기구와 커뮤니케이션한다.', '지배기구 전원이 경영에 참여하는 경우가 아니라면 감사인이 요구 중인 서면진술도 지배기구에 알린다.', '경영에 참여하지 않는 지배기구 구성원이 있더라도 요청 중인 서면진술은 지배기구에 알릴 필요가 없다.', '지배기구 전원이 경영에 참여하는 경우가 아니라면 이미 받은 서면진술만 전달하면 된다.', 'contradicted'),
  row('감사보고서의 형태와 내용에 영향을 미치는 상황이 있다면 그 상황을 지배기구와 커뮤니케이션한다.', '보고서 형식이나 기재 내용에 영향을 주는 상황이 있으면 지배기구에 그 상황을 전달한다.', '감사보고서의 형태와 내용에 영향을 미치는 상황은 지배기구 커뮤니케이션 대상이 아니다.', '감사보고서를 작성했다는 사실을 지배기구에 알린다.'),
  row('감사 중 발생한 기타 유의적 사항 중 감사인의 전문가적 판단에 비추어 재무보고절차의 감시와 관련성이 있는 사항을 지배기구와 커뮤니케이션한다.', '감사 과정에서 나온 그 밖의 중요한 사항도 감사인의 전문적 판단상 재무보고 과정의 감독과 관련되면 지배기구에 전달한다.', '열거된 항목 이외의 유의적 사항은 재무보고절차 감시와 관련되어도 지배기구에 알릴 필요가 없다.', '감사 중 발생한 사소한 사항을 지배기구에 전달한다.'),
];
const f2 = [
  row('업무팀, 적합한 경우 회계법인의 타 구성원, 회계법인 및 해당사항이 있는 경우 네트워크 회계법인이 독립성에 관한 관련 윤리적 요구사항을 준수하고 있다는 진술을 지배기구와 커뮤니케이션한다.', '감사업무팀과 소속 법인, 필요한 다른 구성원 및 해당 네트워크 법인이 관련 독립성 윤리규정을 지켰다는 진술을 지배기구에 전달한다.', '독립성 윤리규정 준수 여부에 관한 진술은 지배기구에 전달할 필요가 없다.', '업무팀만 독립성 윤리규정을 준수하고 있다는 진술을 전달한다.'),
  row('감사인의 전문가적 판단에 따라 회계법인·네트워크 회계법인과 기업 사이에 독립성 문제와 관련된다고 합리적으로 판단되는 모든 관계와 기타사항을 지배기구와 커뮤니케이션한다.', '법인 및 네트워크 법인과 회사 사이의 관계와 그 밖의 사항 가운데 전문가적 판단상 독립성에 관련된다고 합리적으로 보는 사항을 빠짐없이 지배기구에 알린다.', '독립성 훼손이 확정된 관계만 전달하며 합리적으로 독립성 관련성이 있다고 판단되는 기타사항은 제외한다.', '회계법인과 기업 사이의 독립성 관련 관계를 전달한다.'),
  row('감사대상 재무제표의 보고기간에 회계법인 및 네트워크 회계법인이 감사대상 기업과 그 통제하의 부문에 감사 및 비감사서비스를 제공하고 청구한 총 보수를 지배기구와 커뮤니케이션한다.', '감사받는 재무제표의 보고기간에 소속·네트워크 법인이 해당 회사와 지배 부문에 제공한 감사 및 비감사 용역의 총 청구 보수를 알려야 한다.', '보고기간 중 기업과 통제 부문에 소속·네트워크 법인이 청구한 감사보수만 전달하고 비감사서비스 보수는 제외한다.', '해당 보고기간에 회계법인이 감사대상 기업에 청구한 보수만 전달한다.'),
  row('총 보수는 각 서비스가 감사인의 독립성에 미치는 영향을 지배기구가 평가하는 데 적절히 도움이 되도록 서비스유형별로 배분하여 전달한다.', '지배기구가 각 용역의 독립성 영향을 평가할 수 있게 보수를 서비스 종류별로 나누어 제시한다.', '독립성에 미치는 영향 평가를 위해서도 보수 총액만 제시하면 충분하며 용역 종류별 구분은 필요 없다.', '총 보수를 단순히 수행자별로 나누어 제시한다.'),
  row('식별된 독립성 훼손위협을 제거하거나 수용가능한 수준으로 감소시키기 위해 적용한 관련 제도적 안전장치를 지배기구와 커뮤니케이션한다.', '확인된 독립성 위협을 없애거나 허용 가능한 수준까지 낮추려고 실제 적용한 관련 안전장치를 지배기구에 설명한다.', '독립성 위협을 줄이기 위해 적용한 안전장치는 지배기구에 알릴 필요가 없다.', '독립성 위협이 존재한다는 사실만 지배기구에 알린다.'),
];
const g1 = [
  row('해당 상황에 맞는 전문가로서의 책임과 법률적 책임을 결정한다. 감사인을 선임한 당사자 또는 경우에 따라 규제기관에 보고할 요구사항이 존재하는지 여부의 결정도 포함한다.', '전문가 및 법률상 어떤 책임이 있는지 정하며, 선임 당사자나 상황에 맞는 규제기관에 보고해야 하는지도 확인한다.', '감사를 계속할 능력에 의문이 생겨도 전문가·법률상 책임이나 외부 보고 요구사항을 결정할 필요가 없다.', '감사인을 선임한 당사자에게 보고할지 임의로 정한다.'),
  row('관련 법규상 감사업무의 해지가 가능한 경우에 해당 감사업무를 해지하는 것이 적절한지 여부를 고려한다.', '법에서 계약해지를 허용한다면 해당 감사에서 해지가 적합한 선택인지 검토한다.', '관련 법규에서 감사업무 해지가 금지되어도 반드시 즉시 해지한다.', '부정이 의심되면 법규상 해지 가능 여부와 관계없이 해지의 적절성을 고려해야 한다.', 'contradicted'),
];
const g2 = [
  row('감사업무를 해지한다는 사실과 그 이유를 적합한 수준의 경영진 및 지배기구와 토의한다.', '해지 사실과 사유를 적절한 직급의 경영진과 지배기구 양쪽에 설명하고 논의한다.', '감사 해지 사실과 이유는 경영진에게만 알리고 지배기구와는 토의하지 않는다.', '적합한 경영진과 지배기구에게 해지 사실만 알린다.'),
  row('감사인을 선임한 당사자 또는 경우에 따라 규제기관에 감사업무의 해지와 그 이유를 보고할 전문가로서의 요구사항이나 법률적 요구사항이 존재하는지 여부를 결정한다.', '선임 당사자나 필요한 규제기관에 해지 및 사유를 보고해야 하는 전문적 또는 법적 의무가 있는지 확인한다.', '전문가적 또는 법적 보고 요구가 있는지 확인하지 않고 언제나 해지와 사유를 규제기관에 보고해야 한다.', '해지했다는 사실을 선임 당사자에게 알릴지 여부만 고려한다.'),
];
const i1 = [
  row('경영진과 논의하여 사업보고서를 구성하는 문서와 기업이 계획한 그 문서의 발행 방식 및 시기를 결정한다.', '경영진과 협의해 어떤 문서들이 사업보고서를 이루는지, 어떤 방법으로 언제 발행할 예정인지 정한다.', '사업보고서를 구성하는 문서와 발행 방식·시기는 경영진과 논의하지 않고 감사인이 일방적으로 정한다.', '경영진과 사업보고서를 구성하는 문서만 확인한다.'),
  row('사업보고서를 구성하는 문서의 최종본을 적시에, 가능하다면 감사보고서일 전에 입수하기 위하여 경영진과 적절히 협의한다.', '가능하면 보고서일 이전에, 그렇지 않더라도 적시에 최종 문서를 받을 수 있도록 경영진과 입수 일정을 협의한다.', '사업보고서 최종본은 감사보고서일 뒤에만 받아야 하므로 그 전 입수는 협의하지 않는다.', '사업보고서의 초안을 적시에 받기로 경영진과 협의한다.'),
  row('문서의 일부 또는 전부가 감사보고서일 이후에야 제공될 수 있으면, 감사인이 기준서상 요구절차를 완료할 수 있도록 최종본을 제공할 수 있을 때 기업이 발행하기 전에 감사인에게 제공하겠다는 서면진술을 경영진에게 요청한다.', '일부든 전부든 최종 문서가 보고서일 후에야 준비된다면, 요구절차를 마칠 수 있도록 준비되는 대로 발행 전에 감사인에게 최종본을 넘기겠다는 경영진의 서면 약속을 요구한다.', '일부 문서가 감사보고서일 후에 준비되면 기업이 발행한 후 감사인에게 제공하겠다는 구두 약속을 받으면 된다.', '감사보고서일 후에 제공될 문서는 최종본이 나오면 감사인에게 주겠다는 서면진술을 요청한다.'),
];
const i2 = [
  row('기타정보에 대한 책임이 경영진에게 있다는 설명을 포함한다.', '기타정보의 책임 주체는 경영진임을 명시한다.', '기타정보에 대한 책임은 감사인에게 있다고 설명한다.', '기타정보가 사업보고서에 들어 있다고 설명한다.'),
  row('감사보고서일 전에 입수한 기타정보와, 상장기업에서 감사보고서일 후 입수할 것으로 예상되는 기타정보를 식별한다.', '이미 보고서일 전에 받은 기타정보 및 이 상장회사의 보고서일 후 수령 예정 기타정보를 구체적으로 표시한다.', '상장기업에서도 감사보고서일 후에 입수할 예정인 기타정보는 식별해서는 안 된다.', '감사보고서일 전에 받은 기타정보만 식별한다.'),
  row('감사의견은 기타정보를 포함하지 않으며, 감사인은 기타정보에 대해 감사의견이나 어떠한 형태의 확신도 표명하지 않고 앞으로도 표명하지 않을 것이라는 설명을 포함한다.', '재무제표 감사의견의 대상에 기타정보는 없으며, 기타정보에는 현재도 향후에도 감사의견 또는 어떤 수준의 확신도 제공하지 않는다고 설명한다.', '기타정보도 재무제표 감사의견에 포함되며 적어도 제한적 확신이 제공된다고 설명한다.', '감사의견이 기타정보에 미치지 않는다는 설명만 한다.'),
  row('기준서가 요구하는 기타정보의 열람, 고려 및 보고와 관련된 감사인의 책임을 기술한다.', '감사인이 기타정보를 읽고 검토하고 보고해야 하는 기준서상 책임을 설명한다.', '기타정보를 열람·고려·보고할 책임은 감사인에게 없다고 기술한다.', '감사인의 책임은 기타정보를 읽는 것이라고만 기술한다.'),
  row('감사보고서일 전에 입수한 기타정보에 관하여, 보고할 내용이 없으면 그 사실을 설명하고, 중요한 미수정왜곡표시가 있다고 결론내리면 그 중요한 미수정왜곡표시를 기술한다.', '보고서일 이전에 받은 기타정보에 대해 보고사항이 없는 경우에는 없다고 쓰고, 중요 오류가 수정되지 않았다고 결론난 경우에는 그 미수정왜곡표시를 설명한다.', '중요한 미수정왜곡표시가 있다고 결론내렸어도 감사인은 보고할 내용이 없다고 설명한다.', '보고서일 전에 받은 기타정보에 관하여 보고할 내용이 없다는 설명을 포함한다.'),
];

function question(id, prompt, rows, source, spans) {
  return {
    id, type: 'enumeration', prompt, constraints: conditions, selection, decision: null,
    answer_slots: [{ id: 'answer', label: '답안', input: 'textarea' }],
    model_answer: rows.map(r => r.claim),
    requirements: rows.map((r, i) => ({ id: `req${i + 1}`, source_ref_id: source.id, source_quote: spans[i].quote, source_span: spans[i].location })),
    criteria: rows.map((r, i) => ({ id: `c${i + 1}`, requirement_id: `req${i + 1}`, claim: r.claim, critical_facts: [{ id: `fact${i + 1}`, type: 'action', expected: r.claim }], max_points: 1, scores: { met: 1, not_met: 0, contradicted: 0 }, source_ref_ids: [source.id] })),
  };
}
const span = (location, quote) => ({ location, quote });
const f16ref = ref('src260-16', 'KGA 260', '16', '146', quote.f16);
const f17ref = ref('src260-17', 'KGA 260', '17', '147', quote.f17);
const gref = ref('src240-39', 'KGA 240', '39', '90–91', quote.g39);
const i13ref = ref('src720-13', 'KGA 720', '13', '810', quote.i13);
const i21ref = ref('src720-21', 'KGA 720', '21', '812', quote.i21);
const i22ref = ref('src720-22', 'KGA 720', '22', '812', quote.i22);
const f16a = clause(quote.f16, '(a)', '(b)');
const f16c = clause(quote.f16, '(c)', '(d)');
const f17i = clause(quote.f17, '(i)', '(ii)');
const fQuestions = [
  question('sub1', '감사기준서 260 문단 16의 감사에서의 유의적 발견사항으로서 감사인이 지배기구와 커뮤니케이션하여야 할 내용을 모두 제시하시오. 조건부 요구사항은 적용 조건을 함께 쓰고, 회계실무에 관한 추가 설명이 요구되는 경우에는 그 설명 내용도 포함하시오.', f1, f16ref, [
    span('KGA 260.16(a) 첫 문장; 2025 PDF 146쪽 / 2026 PDF 171쪽', f16a),
    span('KGA 260.16(a) 둘째 문장; 2025 PDF 146쪽 / 2026 PDF 171쪽', f16a),
    span('KGA 260.16(b); 2025 PDF 146쪽', clause(quote.f16, '(b)', '(c)')),
    span('KGA 260.16(c) 머리말 및 (i); 2025 PDF 146쪽', f16c),
    span('KGA 260.16(c) 머리말 및 (ii); 2025 PDF 146쪽', f16c),
    span('KGA 260.16(d); 2025 PDF 146쪽', clause(quote.f16, '(d)', '(e)')),
    span('KGA 260.16(e); 2025 PDF 146쪽', clause(quote.f16, '(e)')),
  ]),
  question('sub2', '상장기업의 감사에서 감사기준서 260 문단 17에 따라 감사인의 독립성에 관하여 지배기구와 커뮤니케이션하여야 할 내용을 모두 제시하시오. 진술의 대상, 관련 관계와 기타사항, 보수의 범위와 제시 방법, 적용한 안전장치에 관한 내용을 포함하시오.', f2, f17ref, [
    span('KGA 260.17(a) 독립성 준수 진술; 2025 PDF 147쪽 / 2026 PDF 172쪽', clause(quote.f17, '(a)', '(i)')),
    span('KGA 260.17의 (i) 관계와 기타사항; 2025 PDF 147쪽', f17i),
    span('KGA 260.17의 (i) 총 보수 범위; 2025 PDF 147쪽', f17i),
    span('KGA 260.17의 (i) 서비스유형별 배분; 2025 PDF 147쪽', f17i),
    span('KGA 260.17 마지막 (ii) 안전장치; 2025 PDF 147쪽', clause(quote.f17, '(ii)')),
  ]),
];
const gQuestions = [
  question('sub1', '부정 또는 부정으로 의심되는 사건에 의한 왜곡표시의 결과로, 감사를 계속 수행할 감사인의 능력에 의문을 초래하는 예외적인 환경에 직면하였다. 아직 감사업무의 해지를 결정하지 않은 단계에서, 감사기준서 240 문단 39(a)~(b)에 따라 수행하여야 할 절차를 모두 제시하시오. 보고 요구사항 및 법규상 해지 가능성과 관련된 조건도 포함하시오.', g1, gref, [
    span('KGA 240.39 머리말과 (a); 2025 PDF 90–91쪽 / 2026 PDF 115–116쪽', clause(quote.g39, '(a)', '(b)')),
    span('KGA 240.39(b); 2025 PDF 91쪽', clause(quote.g39, '(b)', '(c)')),
  ]),
  question('sub2', '물음 1의 상황에서 관련 법규상 감사업무의 해지가 가능하고, 감사인은 감사를 해지하기로 하였다. 감사기준서 240 문단 39(c)에 따라 수행하여야 할 절차를 모두 제시하시오. 토의·보고의 대상과 내용 및 보고와 관련하여 결정할 사항을 포함하시오.', g2, gref, [
    span('KGA 240.39(c)(i); 2025 PDF 91쪽', clause(quote.g39, '(c)', '(ii)')),
    span('KGA 240.39(c)(ii); 2025 PDF 91쪽', clause(quote.g39, '(ii)')),
  ]),
];
const iQuestions = [
  question('sub1', '감사기준서 720 문단 13에 따른 기타정보의 입수 절차를 모두 제시하시오. 사업보고서 구성 문서와 발행 계획의 확인, 최종본 입수를 위한 협의, 문서의 일부 또는 전부가 감사보고서일 후에야 제공되는 경우 요청할 서면진술의 내용과 제공 시점을 포함하시오.', i1, i13ref, [
    span('KGA 720.13(a); 2025 PDF 810쪽 / 2026 PDF 837쪽', clause(quote.i13, '(a)', '(b)')),
    span('KGA 720.13(b); 2025 PDF 810쪽', clause(quote.i13, '(b)', '(c)')),
    span('KGA 720.13(c); 2025 PDF 810쪽', clause(quote.i13, '(c)')),
  ]),
  question('sub2', '상장기업을 감사하고 있으며, 감사보고서일 전에 기타정보의 일부를 입수했고 나머지도 이후에 입수할 것으로 예상된다. 감사보고서에 기타정보 단락을 포함하는 경우, 감사기준서 720 문단 22에서 요구하는 단락의 내용을 모두 제시하시오. 감사인이 기타정보에 대하여 보고할 내용이 없는 경우와 중요한 미수정왜곡표시가 있다고 결론내린 경우의 설명도 구분하시오.', i2, i22ref, [
    span('KGA 720.22(a); 2025 PDF 812쪽 / 2026 PDF 839쪽', clause(quote.i22, '(a)', '(b)')),
    span('KGA 720.22(b); 2025 PDF 812쪽', clause(quote.i22, '(b)', '(c)')),
    span('KGA 720.22(c); 2025 PDF 812쪽', clause(quote.i22, '(c)', '(d)')),
    span('KGA 720.22(d); 2025 PDF 812쪽', clause(quote.i22, '(d)', '(e)')),
    span('KGA 720.22(e) 머리말 및 (i)·(ii) 대안; 2025 PDF 812쪽', clause(quote.i22, '(e)')),
  ]),
];
const drafts = [
  { id: 'draft-05-260-001', topic: '05', standard: 'KGA 260', title: '유의적 발견사항과 상장기업 감사인의 독립성 커뮤니케이션', chapter: '부정·법규·커뮤니케이션', questions: fQuestions, rows: [f1, f2], refs: [f16ref, f17ref], facts: ['한국 회계감사기준에 따라 재무제표감사를 수행하는 상황이다.'], units: ['src-73fe85bf893193bbc1', 'src-b0ab9073ba65ae159e'], objective: '지배기구에 전달할 유의적 발견사항과 상장기업 독립성 정보를 구별하고, 회계실무에 대한 조건부 이유 설명·경영참여 예외·보수 범위·안전장치를 빠짐없이 설명한다.', difference: 'pilot-05-001/sub1의 경영진 부정 의심 커뮤니케이션과 pilot-05-003/sub1·sub2의 유의적 내부통제 미비점 보고를 실제 대조했다. 새 물음은 260.16 유의적 발견사항 전체 및 260.17 독립성 정보 전체이며, 해당 기존 물음의 조건·정답 범위를 대체하지 않는다.', timing: ['재무제표감사 중 유의적 사항의 발견 및 감사대상 재무제표의 보고기간 관련 독립성 정보'], scopeConditions: ['260.16(a): 허용되는 유의적 회계실무라도 기업의 특정 상황에 최적이지 않다고 판단하면 이유 설명', '260.16(c): 지배기구 전원이 경영에 참여하는 경우가 아니면 경영진과 논의·서신 교환한 유의적 사항 및 요청 중 서면진술 전달', '260.17: 상장기업; 해당 회계법인·네트워크와 감사대상 기업·통제 부문 및 감사대상 보고기간'], exceptions: ['지배기구 전원이 경영에 참여할 때 260.16(c)의 별도 전달 예외', '독립성 진술의 타 구성원 및 네트워크 법인은 각각 적합한 경우·해당사항이 있는 경우'], exclusions: ['260.14의 감사인 책임 및 260.15의 계획범위·시기', '260.18~21의 형태·시기 자체와 적용자료의 개별 예시 나열', '독립성 위협 유형 목록 및 윤리기준의 개별 금지행위'], notes: ['옛 F 초안에서 누락한 260.16(a)의 기업 상황에 최적이지 않은 이유 설명 및 260.17 마지막 (ii)의 관련 제도적 안전장치를 복구했다.', '260.17의 공식 PDF 원문은 (a) 다음 (i)·(ii)로 표시되고 (b)가 인쇄되어 있지 않다. 임의로 번호를 보충하지 않았다.', 'F sub2는 커뮤니케이션 내용만 묻는다. 260.20의 서면 형태는 출처 인접 문맥에 보존하되 숨은 득점요건으로 추가하지 않는다.'] },
  { id: 'draft-05-240-001', topic: '05', standard: 'KGA 240', title: '부정 관련 예외적 상황의 감사 계속 여부와 해지 후 절차', chapter: '부정·법규·커뮤니케이션', questions: gQuestions, rows: [g1, g2], refs: [gref], facts: ['한국 회계감사기준 240 문단 39의 부정 관련 예외적인 환경을 전제로 한다. 해지 여부를 검토하는 단계와 실제 해지를 결정한 경우의 절차를 구분한다.'], units: ['src-16679d9f0734f9f0a1'], objective: '부정 관련 왜곡표시 때문에 감사 계속 능력에 의문이 제기되는 예외적 상황에서 책임·해지 적절성 검토와 실제 해지 시 토의·보고 요구 판단을 구분한다.', difference: 'pilot-05-001/sub1의 부정 의심 보고, pilot-05-004/sub1·sub2의 법규위반 정보·외부 보고 판단을 실제 대조했다. 새 물음은 240.39의 예외적 감사 계속 불능 상황과 해지 선택 후 절차를 대상으로 하며, 부정 식별만으로 해지가 의무라고 추론하지 않는다.', timing: ['물음 1: 해지 결정 이전의 검토', '물음 2: 법규상 가능한 해지를 결정한 경우'], scopeConditions: ['부정 또는 의심되는 부정에 의한 왜곡표시의 결과로 감사 계속 능력에 의문을 초래하는 예외적 환경', '관련 법규상 감사업무 해지가 가능한 경우에 해지의 적절성을 고려'], exceptions: ['해지를 법규에서 허용하지 않으면 39(b)의 해지 적절성 고려를 무조건적인 해지 의무로 바꾸지 않음', '보고의 상대방은 감사인 선임 당사자 또는 경우에 따라 규제기관; 보고할 전문적·법적 요구사항 존재 여부를 결정'], exclusions: ['감사를 계속 수행하기 곤란한 상황의 적용자료 A55 예시 열거', '특정 국내 법률의 해지 허용 여부 자체에 대한 판정', '240.40 서면진술 및 41~44 부정 관련 일반 보고절차'], notes: ['39(a)·(b)와 39(c)를 서로 다른 단계의 물음으로 분리했다. 부정 의심만으로 감사업무의 자동 해지를 요구하지 않는다.', '39(c)(ii)는 보고할 요구사항의 존재 여부를 결정하는 절차이다. 모든 경우에 규제기관에 보고한다는 답안은 해당 명제를 충족하지 않는다.'] },
  { id: 'draft-16-720-001', topic: '16', standard: 'KGA 720', title: '기타정보의 입수 절차와 감사보고서 기타정보 단락', chapter: '감사보고 특수사항', questions: iQuestions, rows: [i1, i2], refs: [i13ref, i21ref, i22ref], facts: ['2026년 1월 1일 이후에 개시하는 보고기간의 재무제표를 감사하는 주권상장법인으로서, 직전 사업연도말 자산총액은 5천억원 이상이다. 감사기준서 720이 적용되는 감사이다.', '재무제표에는 적정의견을 표명할 예정이다. 기타정보 단락에 특정 배치나 문구를 사용하도록 정한 별도의 법규상 보고 요구는 없다고 가정한다.'], units: ['src-a7fcf95597818dbdab', 'src-dcf5310661dc2547e7', 'src-5baf207e02260d3a4e', 'src-747e9524404bc23daa'], objective: '기타정보 입수를 위한 경영진 협의 및 보고서일 후 제공 문서의 서면진술 요구를 설명하고, 상장기업의 기타정보 단락에 포함할 정보·책임·업무 결과를 구별한다.', difference: 'pilot-16-003/sub1의 열람·불일치 고려와 sub2의 경영진 수정 요구를 실제 대조했다. 새 물음은 그에 앞선 720.13 입수 절차와 720.21 적용 조건 하의 22 단락 기재사항을 다루며, 지배기구 소통 후 미수정에 대한 18~19의 별도 후속조치는 확장하지 않는다.', timing: ['2026년 1월 1일 이후 개시 보고기간; 직전 사업연도말 자산 5천억원 이상 주권상장법인', '감사보고서일 전 적시 최종본 입수; 불가능한 문서는 준비되는 때 기업 발행 이전 제공', '물음 2: 보고서일 전 일부 입수 및 상장기업의 이후 입수 예상'], scopeConditions: ['720.13(c): 일부 또는 전부가 보고서일 후에야 제공되는 경우 경영진 서면진술 요청', '720.21(a): 상장기업에서 보고서일 현재 기타정보를 입수하였거나 입수할 것으로 예상', '720.22(e): 보고서일 전 입수한 기타정보에 관한 보고사항 없음 또는 중요한 미수정왜곡표시 설명'], exceptions: ['720.10: 자산 5천억원 미만 상장법인·주권비상장법인은 2027년 이후 개시 보고기간부터 적용; 본 사례는 2026 적용 대상에 한정', '의견거절에 따른 705.29 예외 및 720.23 변형의견 시사점을 피하도록 적정의견 조건 명시', '특정 법규가 배치·문구를 정하는 720.24 경우는 본 사례에서 제외'], exclusions: ['기타정보의 일반 정의 암기', '720.14~20 열람·수정 요구·지배기구 소통 후의 후속조치', '720.24 법규가 지정한 보고형식 및 25 문서화 요구'], notes: ['720.10 단계별 시행일을 보존하기 위해 2026 적용 대상인 직전 사업연도말 자산 5천억원 이상 주권상장법인으로 한정했다. 이를 모든 기업의 2026 시행으로 일반화하지 않는다.', '물음 2는 720.21(a) 적용 조건을 사실관계로 제시한다. 22(e)의 두 설명은 업무 결과에 따른 대안이며 동시에 모두 보고하는 것이 아니다.', '원문 13(c)의 최종본·제공 가능 시점·기업 발행 전·요구절차 완료 목적을 복구했다. 2027 시험 적용 판본 확정은 별도 사항이다.'] },
];

function write(file, value) { fs.writeFileSync(path.join(base, file), JSON.stringify(value, null, 2) + '\n', 'utf8'); }
for (const d of drafts) {
  const draft = {
    schema_version: '3.0', id: d.id, type: 'linked_question_set', status: 'needs_review', title: d.title,
    classification: { topic_id: d.topic, part: d.topic === '05' ? 'PART2' : 'PART4', chapter: d.chapter, domain: 'audit', standards: [d.standard], tags: ['빈도연계-후보', '공식원문-완전열거', '2027-동일적용가정'] },
    source_refs: d.refs,
    shared_context: { facts: d.facts.map((text, i) => ({ id: `fact${i + 1}`, text, scoreable: false })) },
    learning_order: d.questions.map(q => q.id), subquestions: d.questions,
    verification: { source_fidelity: 'exact', review_status: 'needs_human_review', calculation_required: false, notes: [edition, ...d.notes, `공식 URL: ${url2025}`, `2026 비교 URL: ${url2026}`, `원문 인용 해시 및 형상 검증과 별도로, 작성자 수동 의미 대조용 기대 사례를 qa-${d.id.slice(6)}.json에 기록했다. 사람 승인 및 실제 모델 채점은 수행하지 않았다.`] },
  };
  const actors = d.standard === 'KGA 260' ? ['감사인 및 업무팀', '경영진과 지배기구', '회계법인·해당 네트워크 법인·적합한 타 구성원', '상장기업과 그 통제하의 부문'] : d.standard === 'KGA 240' ? ['감사인', '적합한 수준의 경영진과 지배기구', '감사인 선임 당사자 및 경우에 따른 규제기관'] : ['감사인', '경영진', '적용 대상 주권상장법인'];
  const plan = { version: 1, set_id: d.id, topic_id: d.topic, mode: 'new_from_standard', objective: d.objective, scope: { actors, timing: d.timing, conditions: d.scopeConditions, exceptions: d.exceptions, required_answers: d.questions.flatMap(q => q.model_answer.map(answer => `${q.id}: ${answer}`)), exclusions: d.exclusions }, question_types: ['enumeration'], source_unit_ids: d.units, existing_question_difference: d.difference, edition_assumption: edition + (d.topic === '16' ? ' 720.10의 단계 시행은 본 사례에서 자산 5천억원 이상 상장법인으로 한정하여 적용한다.' : ''), unresolved_items: [], status: 'ready' };
  const cases = [];
  for (let qi = 0; qi < d.questions.length; qi++) {
    const q = d.questions[qi], rows = d.rows[qi];
    const verdicts = (i, verdict) => q.criteria.map((c, j) => ({ criterion_id: c.id, verdict: j === i ? verdict : 'met' }));
    const add = (id, kind, answer, expectedVerdicts, rationale) => cases.push({ id: `${q.id}-${id}`, subquestion_id: q.id, kind, answer, expected_points: expectedVerdicts.filter(v => v.verdict === 'met').length, expected_verdicts: expectedVerdicts, rationale });
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const substitute = value => rows.map((other, j) => j === i ? value : other.claim).filter(Boolean).join('\n');
      add(`c${i + 1}-model`, 'model_answer', rows.map(r => r.claim).join('\n'), verdicts(i, 'met'), `공식 근거 ${q.requirements[i].source_span}의 대상·조건·행위를 모두 담은 저장 모범답안이다.`);
      add(`c${i + 1}-paraphrase`, 'accepted_paraphrase', substitute(r.accepted), verdicts(i, 'met'), `c${i + 1}의 주체·조건·행위를 유지한 동의 표현이며 다른 명제도 유지한다.`);
      add(`c${i + 1}-omission`, 'proposition_omission', substitute(''), verdicts(i, 'not_met'), `c${i + 1}의 독립 명제만 삭제하였다. 다른 충족 명제의 점수는 유지한다.`);
      add(`c${i + 1}-opposite`, 'opposite_meaning', substitute(r.contradiction), verdicts(i, 'contradicted'), `c${i + 1}이 요구하는 책임·조건·대상·행위 중 적어도 하나를 명시적으로 반대로 진술하였다.`);
      add(`c${i + 1}-boundary`, 'condition_boundary', substitute(r.boundary), verdicts(i, r.boundaryVerdict), `공식 근거의 범위·조건·대상 또는 필요한 행위의 일부가 빠지거나 좁아진 답안이다. ${r.boundaryVerdict === 'contradicted' ? '명시적 조건 반전이므로 contradicted이다.' : '해당 결합 명제의 일부만 있어 not_met이며 다른 명제는 유지한다.'}`);
    }
    const allMet = q.criteria.map(c => ({ criterion_id: c.id, verdict: 'met' }));
    add('empty', 'empty_answer', '', q.criteria.map(c => ({ criterion_id: c.id, verdict: 'not_met' })), '빈 답안은 전 명제 0점이다.');
    add('reverse', 'reverse_order', [...q.model_answer].reverse().join('\n'), allMet, '나열 순서에 배점하지 않으며 의미상 시점·조건은 각 문장에 남아 있다.');
    add('one-paragraph', 'single_paragraph', q.model_answer.join(' '), allMet, '문장 수나 줄바꿈에 관계없이 모든 독립 명제를 포함한다.');
    add('unrelated-prefix', 'unrelated_prefix', '오늘 날씨는 맑다.\n' + q.model_answer.join('\n'), allMet, '무관한 문장이 앞에 있어도 뒤의 정상 답안에 대한 독립 점수를 유지한다.');
    const labels = {
      'draft-05-260-001': ['회계실무 / 적합성 / 어려움 / 경영진 토의 / 서면진술 / 감사보고서 / 기타사항', '독립성 / 관계 / 보수 / 서비스 / 안전장치'],
      'draft-05-240-001': ['책임 / 해지', '토의 / 보고'],
      'draft-16-720-001': ['문서 / 최종본 / 서면진술', '경영진 / 기타정보 / 감사의견 / 책임 / 왜곡표시'],
    };
    add('labels-only', 'labels_only', labels[d.id][qi], q.criteria.map(c => ({ criterion_id: c.id, verdict: 'not_met' })), '이 발문은 구체적인 전달 내용·조건 또는 수행절차를 요구한다. 대상 주제의 단어만으로는 각 명제의 요구를 설명하지 못한다. 완결 문장 형식 자체를 요구하는 것은 아니다.');
  }
  write(`${d.id}.json`, draft);
  write(`${d.id}.authoring-plan.json`, plan);
  write(`qa-${d.id.slice(6)}.json`, { set_id: d.id, method: 'source_and_contract_review', human_approval: false, live_model_grading: 'not_run', draft_sha256: hash(fs.readFileSync(path.join(base, `${d.id}.json`))), cases });
  console.log(`${d.id}: ${d.questions.length} subquestions, ${d.rows.flat().length} criteria, ${cases.length} author QA cases`);
}
