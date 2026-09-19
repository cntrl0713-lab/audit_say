// r08: KGA 701 문단 A10·A11·A18·A21·A27·A28·A40·A46·A47·A51과 KGA 706 문단 A16·A18(2025 전문) 발췌본과 출처 계보를 만든다.
// 원문 행은 기존 PyMuPDF 페이지 텍스트에서 그대로 가져온다. render-kga701-706-pages.py로 같은 쪽을 다시 추출·렌더링한 raw 대조 파일이 먼저 있어야 한다.
// 기존 출력이 있으면 쓰지 않는다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r08-kam-emphasis/sources/extract-kga701-706.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const DUMP = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025-pymupdf-pages.txt';
const PDF = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025.pdf';
const DUMP_2026 = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt';
const RAW = 'cpa_uploader/raw/originals/case-review-2026-09-15';
const OUT = `${RAW}/kga701-706-2025-excerpts.md`;
const PROVENANCE = `${RAW}/kga701-706-2025-excerpts.provenance.json`;
const REGISTERED = 'cpa_uploader/data/official/case-review-2026-09-15-kga701-706.md';
const URL = 'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06';
const FRESH = {
    727: ['334732170c024b023897076f627782ca8296a34181cfddfd9fcac32c7699cb03', 'b761dc9b7fd7a8e0477e426560c36d204bee7d2e1f49629fa47285d4db8d1503'],
    729: ['2bdfdb1acd15942af686ffcfdce737355e69a7a4f5d5528ff02fafaab8aadf6e', 'e54835cb091c51fcdf914212c13d3b76701233758b7cf197726a669accf3354f'],
    730: ['948cfc82462935d0cb1da45b35f1326a73d6cb4c8004f2f0a3a5b39c2e50f527', '661bc1c3a80e89d57ae4a5c1aaef5a8bd23089ae3e689f877091ac2f6c9fb5c9'],
    731: ['4b2bb791e4ddf8130a5e52132340e8b3f3838abbf02c21ad53fee62670482b8b', '86689e4e56bd496419c359c05b24165592855448046bedae6e824917347f1d3a'],
    734: ['74b720d96255686892a21019ee73ef318467a01d83577b4543f41667ccf30cde', '314860977d8f23a03d0d76d113a2c6299e0f4c2c7e49fa215a5f7fe917797a6a'],
    736: ['0fe81bc5fb521acfef62ed8e97707920df157590f8df75d51f9e986ebeaafc06', '2b28382e482cbce7fb3aea12f862d46eb876605d9194a2f47d13af951d32c4a7'],
    737: ['f45a56eeeb032d3eaab18dedec9258d0d8cc264ddefd1f030f589d6f7031a51b', 'd5c2a3a847f8a9b4a1d113d9781b703853216514c5cb26d2d9bbbb5fe12d4e5b'],
    777: ['edff66154854e66e260a938c9df08415e75306ad66aff46b3f8e4fa6250757a0', '3ae385b59e530a02061c9670228701bdae20dfd12099bb308cc68fe9fceaf320'],
    778: ['0593e3a83c13227b6bc3056cf2f96d11acc3d1d0764c0ebcb34cc2d7dc05ac12', '886767a8d2218bfe8d2b602c723d2ee889403ef742fc05a63a58fc8c0651fdbe'],
};

assert.equal(sha(fs.readFileSync(DUMP)), 'b626436fcb11ce0c8a51e542d6e7e35724ee3d56984148e41a6202d03b4bd02a');
assert.equal(sha(fs.readFileSync(PDF)), 'b6b3a965c25cdb5bfdc0bf54838ae1bcc642581eef2d2d9e306a67ac811b0989');
assert.equal(sha(fs.readFileSync(DUMP_2026)), 'f0914795b909ea38e6ab2d4db83a7cc0e3519730ae30c7925fca034bf5975568');
const freshFiles = Object.entries(FRESH).flatMap(([page, [text, image]]) => {
    const files = [{ file: `${RAW}/kga701-706-2025-page-${page}.txt`, sha256: text }, { file: `${RAW}/kga701-706-2025-page-${page}.png`, sha256: image }];
    for (const entry of files) assert.equal(sha(fs.readFileSync(entry.file)), entry.sha256, entry.file);
    return files;
});
assert(!fs.existsSync(OUT) && !fs.existsSync(PROVENANCE) && !fs.existsSync(REGISTERED), 'outputs already exist');

// 페이지 텍스트는 CRLF로 저장되어 있으므로 행 끝 CR만 제거하고 행 끝 공백은 유지한다.
const lines = fs.readFileSync(DUMP, 'utf8').split('\n').map((line) => line.replace(/\r$/u, ''));
const take = (start, end) => lines.slice(start - 1, end);
const expectLine = (number, text) => assert.equal(lines[number - 1].trimEnd(), text, `L${number}`);
const expectStart = (number, text) => assert(lines[number - 1].startsWith(text), `L${number}: ${text}`);

// 쪽 머리말과 문단 시작·끝, 다음 문단의 시작을 확인한다.
expectLine(30377, '## PDF page 727');
expectStart(30402, 'A10. 비록 비교재무제표가 표시되는 경우라도');
expectLine(30404, '가장 유의적인 사항들로 제한된다.15');
expectStart(30405, 'A11. 핵심감사사항에 대한 감사인의 결정이');
expectLine(30408, '도 핵심감사사항인지 여부를 감사인이 고려하는 것이 유용할 수 있다.');
expectLine(30409, '유의적감사인주의를 요구한 사항 (문단 9 참조)');
expectLine(30416, '15 감사기준서 710 “비교정보 – 대응수치 및 비교재무제표”');
expectLine(30461, '## PDF page 729');
expectStart(30488, 'A18. 문단9에서 요구하는 구체적인 고려사항과');
expectLine(30495, '주는 시스템의 변경)는 더욱 그러하다.');
expectLine(30501, '## PDF page 730');
expectStart(30515, 'A21. 그러나, 이는 모든 유의적 위험에 대한 사례가 아닐 수 있다.');
expectLine(30521, '라 감사인이 핵심감사사항을 결정할 때 고려되지 않을 것이다.');
expectStart(30522, 'A22. ');
expectLine(30535, '24 감사기준서 240 “재무제표감사에서의 부정에 관한 감사인의 책임“문단 27-28');
expectLine(30536, '25 감사기준서 240 문단 32');
expectLine(30540, '## PDF page 731');
expectStart(30564, 'A27. 유의적감사인주의를 요구한 사항들이');
expectStart(30569, 'A28. 가장 유의적인 사항에 대한 개념은');
expectLine(30572, '포함하기 위한 것이다.');
expectLine(30662, '## PDF page 734');
expectStart(30685, 'A40. 문단 13(a)-(b)는');
expectLine(30689, '는데 있어서 해당 사항을 어떻게 다루었는지를 보다 잘 이해할 수 있게 한다.');
expectStart(30690, 'A41. ');
expectLine(30740, '## PDF page 736');
expectStart(30754, 'A46. 핵심감사사항이 감사에서 어떻게 다루어졌는지를');
expectLine(30768, '규정하거나, 또는 이러한 요소들 중 하나 이상을 포함하도록 명시할 수 있다.');
expectStart(30769, 'A47. 의도된 이용자들이');
expectLine(30781, '재무제표의 별도의 구성요소에 대한 별개의 의견을 포함하거나 암시하지 않음');
expectLine(30784, '## PDF page 737');
expectStart(30787, 'A48. ');
expectStart(30805, 'A51. 문단 A46에서 언급한 바와 같이');
expectLine(30808, '대한 감사의견에 의문을 불러일으킨다는 인상을 주지 않도록 주의가 필요하다.');
expectLine(30809, '핵심감사사항으로 결정된 사항이 감사보고서에 커뮤니케이션되지 않는 상황 (문단 14 참조)');
expectLine(32341, '## PDF page 777');
expectStart(32346, 'A16. 감사보고서 내 강조사항문단 또는 기타사항문단의 위치는');
expectLine(32361, '“강조사항” 제목에 부연하는 문구로 추가할 수도 있다.');
expectLine(32375, '음에 별도의 단락으로 포함시킬 수 있을 것이다.');
expectStart(32376, 'A17. ');
expectStart(32379, '12 예를들어, 감사기준서 210');
expectLine(32383, '## PDF page 778');
expectStart(32390, 'A18. 지배기구는 문단12에서 요구하는 커뮤니케이션을 통해');
expectLine(32395, '을 것이다.');

const selections = [
    { standard: 'KGA 701', paragraph: 'A10', pdf_page: 727, ranges: [[30402, 30404]] },
    { standard: 'KGA 701', paragraph: 'A11', pdf_page: 727, ranges: [[30405, 30408]] },
    { standard: 'KGA 701', paragraph: 'A10 footnote 15', pdf_page: 727, ranges: [[30416, 30416]] },
    { standard: 'KGA 701', paragraph: 'A18', pdf_page: 729, ranges: [[30488, 30495]] },
    { standard: 'KGA 701', paragraph: 'A21', pdf_page: 730, ranges: [[30515, 30521]] },
    { standard: 'KGA 701', paragraph: 'A21 footnotes 24·25', pdf_page: 730, ranges: [[30535, 30536]] },
    { standard: 'KGA 701', paragraph: 'A27', pdf_page: 731, ranges: [[30564, 30568]] },
    { standard: 'KGA 701', paragraph: 'A28', pdf_page: 731, ranges: [[30569, 30572]] },
    { standard: 'KGA 701', paragraph: 'A40', pdf_page: 734, ranges: [[30685, 30689]] },
    { standard: 'KGA 701', paragraph: 'A46', pdf_page: 736, ranges: [[30754, 30768]] },
    { standard: 'KGA 701', paragraph: 'A47', pdf_page: 736, ranges: [[30769, 30781]] },
    { standard: 'KGA 701', paragraph: 'A51', pdf_page: 737, ranges: [[30805, 30808]] },
    { standard: 'KGA 706', paragraph: 'A16', pdf_page: 777, ranges: [[32346, 32375]] },
    { standard: 'KGA 706', paragraph: 'A16 footnote 12', pdf_page: 777, ranges: [[32379, 32380]] },
    { standard: 'KGA 706', paragraph: 'A18', pdf_page: 778, ranges: [[32390, 32395]] },
];
const range = (standard, paragraph) => selections.find((s) => s.standard === standard && s.paragraph === paragraph).ranges.flatMap(([start, end]) => take(start, end));
const r701 = (paragraph) => range('KGA 701', paragraph);
const r706 = (paragraph) => range('KGA 706', paragraph);
const header = [
    `출처: 한국공인회계사회 2025년 개정 회계감사기준 전문 PDF 727·729·730·731·734·736·737·777·778쪽. 공식 URL: ${URL}`,
    '확인일: 2026-09-19. 2027년 CPA 시험 대비, 2026-01-01 개시 보고기간을 기본 사례로 적용. 2026 전문과 대조해 발췌한 문단의 본문은 같고 KGA 701 문단 A21 각주 24의 감사기준서 240 제목 표기만 달라짐. 추출 계보: cpa_uploader/raw/originals/case-review-2026-09-15/kga701-706-2025-excerpts.provenance.json',
];
const body = [
    '# KGA 701: 감사보고서 핵심감사사항 커뮤니케이션',
    '',
    ...header,
    '',
    '## PDF PAGE 727',
    ...r701('A10'),
    ...r701('A11'),
    ' ',
    ...r701('A10 footnote 15'),
    '',
    '## PDF PAGE 729',
    ...r701('A18'),
    '',
    '## PDF PAGE 730',
    ...r701('A21'),
    ' ',
    ...r701('A21 footnotes 24·25'),
    '',
    '## PDF PAGE 731',
    ...r701('A27'),
    ...r701('A28'),
    '',
    '## PDF PAGE 734',
    ...r701('A40'),
    '',
    '## PDF PAGE 736',
    ...r701('A46'),
    ...r701('A47'),
    '',
    '## PDF PAGE 737',
    ...r701('A51'),
    '',
    '# KGA 706: 감사보고서의 강조사항문단과 기타사항문단',
    '',
    '## PDF PAGE 777',
    ...r706('A16'),
    ' ',
    ...r706('A16 footnote 12'),
    '',
    '## PDF PAGE 778',
    ...r706('A18'),
    '',
].join('\n');
// questionSourceCatalog.mjs의 판본 설명은 앞 12줄 중 https?:|확인|개정|시행|Checked|출처를 포함한 줄이다.
const catalogHeader = body.split(/\r?\n/u).slice(0, 12).filter((line) => /https?:|확인|개정|시행|Checked|출처/iu.test(line));
assert.deepEqual(catalogHeader, header, 'catalog edition header must be exactly the provenance lines');
// questionBankPublication.ts의 기준서 구간은 # ~ ### KGA NNN: 제목으로 나뉜다.
assert.deepEqual([...body.matchAll(/^#{1,3}\s+(KGA\s+\d+)(?:\s|:)/gmu)].map((m) => m[1]), ['KGA 701', 'KGA 706']);

// 2026 전문 대조(PDF 755~765·804~805쪽). 공백을 빼고 비교한다.
const dump2026 = fs.readFileSync(DUMP_2026, 'utf8').split('\n').map((line) => line.replace(/\r$/u, ''));
const joined2026 = (ranges) => ranges.flatMap(([start, end]) => dump2026.slice(start - 1, end)).join('\n').replace(/\s+/gu, '');
const joined2025 = (standard, paragraph) => range(standard, paragraph).join('\n').replace(/\s+/gu, '');
const comparisons = [
    ['KGA 701', 'A10', [[31511, 31513]], 'A10. 비록'],
    ['KGA 701', 'A11', [[31514, 31517]], 'A11. 핵심감사사항에'],
    ['KGA 701', 'A10 footnote 15', [[31525, 31525]], '15 감사기준서 710'],
    ['KGA 701', 'A18', [[31599, 31604], [31613, 31614]], 'A18. 문단9에서'],
    ['KGA 701', 'A21', [[31626, 31632]], 'A21. 그러나'],
    ['KGA 701', 'A27', [[31675, 31679]], 'A27. 유의적감사인주의를'],
    ['KGA 701', 'A28', [[31689, 31692]], 'A28. 가장'],
    ['KGA 701', 'A40', [[31796, 31800]], 'A40. 문단'],
    ['KGA 701', 'A46', [[31865, 31879]], 'A46. 핵심감사사항이'],
    ['KGA 701', 'A47', [[31880, 31888], [31894, 31897]], 'A47. 의도된'],
    ['KGA 701', 'A51', [[31916, 31919]], 'A51. 문단 A46에서'],
    ['KGA 706', 'A16', [[33457, 33486]], 'A16. 감사보고서 내'],
    ['KGA 706', 'A16 footnote 12', [[33490, 33491]], '12 예를들어'],
    ['KGA 706', 'A18', [[33501, 33506]], 'A18. 지배기구는'],
];
for (const [standard, paragraph, ranges, start] of comparisons) {
    assert(dump2026[ranges[0][0] - 1].startsWith(start), `2026 ${standard} ${paragraph} start`);
    assert.equal(joined2025(standard, paragraph), joined2026(ranges), `2026 ${standard} ${paragraph}`);
}
assert.notEqual(joined2025('KGA 701', 'A21 footnotes 24·25'), joined2026([[31642, 31643]]), 'footnote 24 title differs in 2026');
assert.equal(joined2025('KGA 701', 'A21 footnotes 24·25').replace('재무제표감사에서의부정', '재무제표감사에서부정'), joined2026([[31642, 31643]]), 'only the 240 title particle differs');

fs.writeFileSync(OUT, body, { flag: 'wx' });
fs.writeFileSync(REGISTERED, body, { flag: 'wx' });
const provenance = {
    source_file: DUMP,
    source_sha256: sha(fs.readFileSync(DUMP)),
    source_pdf: PDF,
    source_pdf_sha256: sha(fs.readFileSync(PDF)),
    source_pdf_raw_copy: 'cpa_uploader/raw/materials/verification/b6b3a965c25cdb5b/kga-2025.pdf',
    official_url: URL,
    official_url_record: 'cpa_uploader/drafts/frequency-priority-2026-09-10/sources/provenance.json (downloads[edition=2025], checked_at 2026-09-10T12:01:19Z)',
    edition: '2025',
    output_file: OUT,
    output_sha256: sha(fs.readFileSync(OUT)),
    registered_copy: REGISTERED,
    registered_sha256: sha(fs.readFileSync(REGISTERED)),
    selections,
    transformation: '원 페이지 텍스트의 CRLF 행 끝에서 CR만 제거하고 각 문단의 원문 문자·기호(글머리표 U+F0B7 포함)·행 끝 공백을 유지해 LF로 결합했다. 기준서별 제목(# KGA 701, # KGA 706), 출처·확인일 두 줄, 문단이 있는 PDF 쪽의 머리말(## PDF PAGE)을 추가했다. KGA 701 A10의 각주 15, A21의 각주 24·25, KGA 706 A16의 각주 12는 해당 쪽 문단 뒤에 한 줄 띄워 두었다. 소제목 행과 선택하지 않은 문단(701 A12~A17·A19·A20·A22~A26·A29~A39·A41~A45·A48~A50, 706 A17)은 제외했다.',
    fresh_check: {
        method: 'PyMuPDF 1.28.2(uv 캐시, 오프라인)로 원본 PDF 727·729·730·731·734·736·737·777·778쪽을 다시 추출해 기존 페이지 텍스트의 해당 쪽과 비교했고(끝 빈 줄 외 동일), 같은 쪽을 110dpi 이미지로 렌더링해 730쪽(A21·각주 24·25), 736쪽(A46·A47), 777쪽(706 A16·각주 12)을 육안 대조했다. 도구: cpa_uploader/drafts/case-review-2026-09-15/r08-kam-emphasis/sources/render-kga701-706-pages.py',
        files: freshFiles,
    },
    edition_comparison_2026: {
        source_file: DUMP_2026,
        source_sha256: sha(fs.readFileSync(DUMP_2026)),
        lines: comparisons.map(([standard, paragraph, ranges]) => `${standard} ${paragraph} ${ranges.map(([a, b]) => `L${a}-L${b}`).join('·')}`).join('; '),
        finding: '발췌한 KGA 701 문단 A10·A11·A18·A21·A27·A28·A40·A46·A47·A51과 KGA 706 문단 A16·A18, 각주 12·15의 본문은 공백을 빼면 2025·2026 전문에서 같다. KGA 701 A21 각주 24의 감사기준서 240 제목이 2026 전문에서 “재무제표감사에서 부정에 관한 감사인의 책임”으로 표기된다(조사 “의” 삭제). 사례의 20X1년(2026년 1월 1일 개시 보고기간)에는 2025 전문을 적용한다.',
    },
    catalog_edition_header: header,
    status: 'raw_preserved_and_registered',
};
fs.writeFileSync(PROVENANCE, JSON.stringify(provenance, null, 2) + '\n', { flag: 'wx' });
console.log({ output: OUT, sha256: provenance.output_sha256, registered: REGISTERED, same: provenance.output_sha256 === provenance.registered_sha256 });
