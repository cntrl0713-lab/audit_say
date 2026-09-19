// r11: KGA 705 문단 11·12·13·15·26·27·A9·A16·A24·A27(2025 전문) 발췌본과 출처 계보를 만든다. 원문 행은 기존 PyMuPDF 페이지 텍스트에서 그대로 가져온다.
// render-kga705-pages.py로 같은 쪽을 다시 추출·렌더링한 raw 대조 파일이 먼저 있어야 한다. 기존 출력이 있으면 쓰지 않는다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r11-scope-limitation-disclaimer/sources/extract-kga705.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const DUMP = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025-pymupdf-pages.txt';
const PDF = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025.pdf';
const DUMP_2026 = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt';
const RAW = 'cpa_uploader/raw/originals/case-review-2026-09-15';
const OUT = `${RAW}/r11-kga705-2025-excerpts.md`;
const PROVENANCE = `${RAW}/r11-kga705-2025-excerpts.provenance.json`;
const REGISTERED = 'cpa_uploader/data/official/case-review-2026-09-15-r11-kga705.md';
const URL = 'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06';
const FRESH = {
    744: ['4c3c337f8fa1a827d4e9ce9bd752af57d062302017c38528f35b2d377c88d7d5', '2a1de283a9c0132634c63edfc77935feba130127840a47f04f26c4e2c6206454'],
    745: ['2cf30115064032bb399f9d1098552af23bb4c5d754127f1c70948f12ac250885', '3653b18586c63dba821332e805cab6d9a803c1eedf7858815d678d59d8f695c2'],
    747: ['b2ed5659ab80e0ac148c0e60570d6f3bcd5ba0663d1761f1a64ff8630846c87f', '7627375dda89e4c9cf02c249556e134fbb6ff2527bddcba4aa4089e2dbff2e4d'],
    751: ['96e65c78e73a8359ed2a3aeab2cc8129b67ef0a43b4b2e3f42cb2e5697436a3f', 'bff8f762c138b52dc03b9825f0621d60231765a44a8301ce42da7e46f874003c'],
    752: ['00707450ad1f29b80a0b32e33fb033d32ec1a9f8593c6e0002ab70494b408c3e', 'c1fae23ff91a700803bcaf99131a2cdf6244910900a463531efe556578056309'],
    754: ['9b15d58a62a47d6492c7e66d3db61ff48c780b4425d82baac383b69a0459da00', 'c471479e1774be45057fb67c8bd9ee742e34fdd34589f22be7c896ec75948594'],
    755: ['6d97d02d30bbe8fca6e3d74b701b057c16abe102af538ea2fff20c327bd181e3', 'cecf9daae844f007007ad67220e33442cef8c924d5157c6f892674a97fb5420f'],
};

assert.equal(sha(fs.readFileSync(DUMP)), 'b626436fcb11ce0c8a51e542d6e7e35724ee3d56984148e41a6202d03b4bd02a');
assert.equal(sha(fs.readFileSync(PDF)), 'b6b3a965c25cdb5bfdc0bf54838ae1bcc642581eef2d2d9e306a67ac811b0989');
assert.equal(sha(fs.readFileSync(DUMP_2026)), 'f0914795b909ea38e6ab2d4db83a7cc0e3519730ae30c7925fca034bf5975568');
const freshFiles = Object.entries(FRESH).flatMap(([page, [text, image]]) => {
    const files = [{ file: `${RAW}/r11-kga705-2025-page-${page}.txt`, sha256: text }, { file: `${RAW}/r11-kga705-2025-page-${page}.png`, sha256: image }];
    for (const entry of files) assert.equal(sha(fs.readFileSync(entry.file)), entry.sha256, entry.file);
    return files;
});
assert(!fs.existsSync(OUT) && !fs.existsSync(PROVENANCE) && !fs.existsSync(REGISTERED), 'outputs already exist');

// 페이지 텍스트는 CRLF로 저장되어 있으므로 행 끝 CR만 제거하고 행 끝 공백은 유지한다.
const lines = fs.readFileSync(DUMP, 'utf8').split('\n').map((line) => line.replace(/\r$/u, ''));
const take = (start, end) => lines.slice(start - 1, end);
const expectLine = (number, text) => assert.equal(lines[number - 1].trimEnd(), text, `L${number}`);

expectLine(31067, '## PDF page 744');
expectLine(31089, '11.');
expectLine(31092, '당 제한을 제거하도록 요청하여야 한다.');
expectLine(31093, '12.');
expectLine(31097, '가능한지 여부를 결정하여야 한다.');
expectLine(31098, '13.');
expectLine(31107, '절할 것이라고 결론을 내리면, 다음 중 하나의 조치를 취해야 함');
expectLine(31109, '2 감사기준서 260 “지배기구와의 커뮤니케이션” 문단 13');
expectLine(31112, '## PDF page 745');
expectLine(31116, '(i)');
expectLine(31121, '참조)');
expectLine(31122, '14.');
expectLine(31127, '15.');
expectLine(31133, '과 상충될 것이다. (문단 A16 참조)');
expectLine(31154, '3 감사기준서 805 “단위재무제표와 재무제표 특정 요소, 계정 또는 항목에 대한 감사-특별 고려사항”은 감사인이 재무제표');
expectLine(31155, '의 하나 이상의 요소나 계정 또는 항목에 대하여 별도로 의견표명을 하는 상황을 다룬다.');
expectLine(31209, '## PDF page 747');
expectLine(31239, '26.');
expectLine(31247, '기술');
expectLine(31248, '27.');
expectLine(31251, '와 영향을 기술하여야 한다. (문단 A24 참조)');
expectLine(31382, '## PDF page 751');
expectLine(31396, 'A9.');
expectLine(31402, '있다.');
expectLine(31426, '## PDF page 752');
assert(lines[31446].startsWith('A16. 감사인의 부적정의견 또는 의견거절과'), 'L31447');
expectLine(31457, '전체에 의견을 거절한 것이 아니다.');
expectLine(31460, '9 이러한 상황에 대한 기술은 감사기준서 700 문단 A32 참고');
expectLine(31461, '10 감사기준서 510 “초도감사-기초잔액” 문단 10');
expectLine(31501, '## PDF page 754');
assert(lines[31509].startsWith('A24. 감사의견근거 단락 내에'), 'L31510');
expectLine(31513, '의 공시는 재무제표의 이용자들에게 관련성이 있을 것이다.');
assert(lines[31536].startsWith('A27. 예상되는 감사의견의 변형을'), 'L31537');
expectLine(31540, '의도된 변형과 변형 이유(또는 상황)를 감사인이 지배기구에게 통지하는 것');
expectLine(31543, '## PDF page 755');
expectLine(31547, '(b)');
expectLine(31552, '정보와 설명을 제공할 기회를 갖는 것');

const selections = [
    { paragraph: '11', pdf_page: 744, ranges: [[31089, 31092]] },
    { paragraph: '12', pdf_page: 744, ranges: [[31093, 31097]] },
    { paragraph: '12 footnote 2', pdf_page: 744, ranges: [[31109, 31109]] },
    { paragraph: '13', pdf_page: '744-745', ranges: [[31098, 31107], [31116, 31121]] },
    { paragraph: '15', pdf_page: 745, ranges: [[31127, 31133]] },
    { paragraph: '15 footnote 3', pdf_page: 745, ranges: [[31154, 31155]] },
    { paragraph: '26', pdf_page: 747, ranges: [[31239, 31247]] },
    { paragraph: '27', pdf_page: 747, ranges: [[31248, 31251]] },
    { paragraph: 'A9', pdf_page: 751, ranges: [[31396, 31402]] },
    { paragraph: 'A16', pdf_page: 752, ranges: [[31447, 31457]] },
    { paragraph: 'A16 footnotes 9·10', pdf_page: 752, ranges: [[31460, 31461]] },
    { paragraph: 'A24', pdf_page: 754, ranges: [[31510, 31513]] },
    { paragraph: 'A27', pdf_page: '754-755', ranges: [[31537, 31540], [31547, 31552]] },
];
const range = (paragraph) => selections.find((s) => s.paragraph === paragraph).ranges.flatMap(([start, end]) => take(start, end));
const header = [
    `출처: 한국공인회계사회 2025년 개정 회계감사기준 전문 PDF 744·745·747·751·752·754·755쪽. 공식 URL: ${URL}`,
    '확인일: 2026-09-19. 2027년 CPA 시험 대비, 2026-01-01 개시 보고기간을 기본 사례로 적용. 2026 전문과 대조해 발췌한 문단과 각주의 본문이 같음. 추출 계보: cpa_uploader/raw/originals/case-review-2026-09-15/r11-kga705-2025-excerpts.provenance.json',
];
const body = [
    '# KGA 705: 감사의견의 변형',
    '',
    ...header,
    '',
    '## PDF PAGE 744',
    ...range('11'),
    ...range('12'),
    ' ',
    ...range('12 footnote 2'),
    '',
    ...range('13'),
    '',
    '## PDF PAGE 745',
    ...range('15'),
    ' ',
    ...range('15 footnote 3'),
    '',
    '## PDF PAGE 747',
    ...range('26'),
    ...range('27'),
    '',
    '## PDF PAGE 751',
    ...range('A9'),
    '',
    '## PDF PAGE 752',
    ...range('A16'),
    ' ',
    ...range('A16 footnotes 9·10'),
    '',
    '## PDF PAGE 754',
    ...range('A24'),
    '',
    ...range('A27'),
    '',
].join('\n');
// questionSourceCatalog.mjs의 판본 설명은 앞 12줄 중 https?:|확인|개정|시행|Checked|출처를 포함한 줄이다.
const catalogHeader = body.split(/\r?\n/u).slice(0, 12).filter((line) => /https?:|확인|개정|시행|Checked|출처/iu.test(line));
assert.deepEqual(catalogHeader, header, 'catalog edition header must be exactly the provenance lines');

// 2026 전문 대조: KGA 705 구간(목차 쪽부터 KGA 706 목차 쪽 전까지)에서 각 발췌의 공백 제거 본문을 찾는다.
const pageLine = /^## PDF page (\d+)$/u;
const pageFooter = /^\d+ \/ \d+\s*$/u;
const runningHead = /^감사기준서 705 ‘감사의견의 변형’\s*$/u;
const flatten = (source, from, to) => {
    const kept = [];
    let page = null;
    for (let i = from; i < to; i++) {
        const line = source[i];
        const match = line.match(pageLine);
        if (match) { page = Number(match[1]); continue; }
        if (pageFooter.test(line.trim()) || runningHead.test(line.trim())) continue;
        for (const ch of line.replace(/\s+/gu, '')) kept.push({ ch, page, line: i + 1 });
    }
    return kept;
};
const dump2026 = fs.readFileSync(DUMP_2026, 'utf8').split('\n').map((line) => line.replace(/\r$/u, ''));
const start2026 = dump2026.findIndex((line, i) => i > 30000 && line.trim() === '감사기준서 705' && (dump2026[i + 1] ?? '').includes('감사의견의 변형'));
const end2026 = dump2026.findIndex((line, i) => i > start2026 && line.trim() === '감사기준서 706');
assert(start2026 > 0 && end2026 > start2026, '2026 KGA 705 range');
const kept2026 = flatten(dump2026, start2026, end2026);
const text2026 = kept2026.map((k) => k.ch).join('');
// 쪽을 넘는 문단(13은 사이에 744쪽 각주 2가 있음)은 쪽별 구간을 따로 찾는다.
const comparison = selections.map((selection) => {
    const parts = selection.ranges.map(([start, end]) => {
        const joined = take(start, end).join('').replace(/\s+/gu, '');
        const at = text2026.indexOf(joined);
        assert(at >= 0, `2026 comparison failed: ${selection.paragraph} L${start}`);
        assert.equal(text2026.indexOf(joined, at + 1), -1, `2026 match not unique: ${selection.paragraph} L${start}`);
        const first = kept2026[at];
        const last = kept2026[at + joined.length - 1];
        return { lines_2025: `L${start}-L${end}`, pdf_pages_2026: first.page === last.page ? first.page : `${first.page}-${last.page}`, lines_2026: `L${first.line}-L${last.line}` };
    });
    return { paragraph: selection.paragraph, same_without_whitespace: true, parts };
});
// KGA 705 전체도 쪽 머리말·쪽 번호를 빼고 공백을 제거하면 2025·2026 전문이 같은지 확인한다.
const start2025 = lines.findIndex((line, i) => i > 30000 && line.trim() === '감사기준서 705' && (lines[i + 1] ?? '').includes('감사의견의 변형'));
const end2025 = lines.findIndex((line, i) => i > start2025 && line.trim() === '감사기준서 706');
assert(start2025 > 0 && end2025 > start2025, '2025 KGA 705 range');
const text2025 = flatten(lines, start2025, end2025).map((k) => k.ch).join('');
const wholeSame = text2025 === text2026;
assert.equal(wholeSame, true, 'KGA 705 whole-standard comparison');

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
    transformation: '원 페이지 텍스트의 CRLF 행 끝에서 CR만 제거하고 각 문단의 원문 문자·기호(글머리표 U+F0B7 포함)·행 끝 공백을 유지해 LF로 결합했다. KGA 제목, 출처·확인일 두 줄, 문단이 시작하는 PDF 쪽의 머리말(## PDF PAGE)을 추가했다. 쪽을 넘는 문단 13(744→745쪽)과 A27(754→755쪽)은 다음 쪽 머리말·쪽 번호 행을 빼고 이어 붙였다. 문단 12의 각주 2, 문단 15의 각주 3, A16의 각주 9·10은 해당 문단 바로 뒤에 한 줄 띄워 두었다(문단 13의 앞). 소제목 행과 문단 14, A10~A15, A17~A23, A25·A26은 제외했다.',
    fresh_check: {
        method: 'PyMuPDF 1.28.2(uv 캐시, 오프라인)로 원본 PDF 744·745·747·751·752·754·755쪽을 다시 추출해 기존 페이지 텍스트의 해당 쪽과 비교했고(끝 빈 줄 외 동일), 같은 쪽을 110dpi 이미지로 렌더링해 발췌한 문단과 각주를 육안 대조했다. 도구: cpa_uploader/drafts/case-review-2026-09-15/r11-scope-limitation-disclaimer/sources/render-kga705-pages.py',
        files: freshFiles,
    },
    edition_comparison_2026: {
        source_file: DUMP_2026,
        source_sha256: sha(fs.readFileSync(DUMP_2026)),
        kga705_range_2025: `L${start2025 + 1}-L${end2025}`,
        kga705_range_2026: `L${start2026 + 1}-L${end2026}`,
        paragraphs: comparison,
        whole_standard_same_without_page_headers_and_whitespace: wholeSame,
        finding: '발췌한 문단·각주의 본문은 2026 전문(2026년 7월 개정)과 공백을 빼면 같다. 쪽 머리말과 쪽 번호를 뺀 KGA 705 전체도 같다. 사례의 20X1년(2026년 1월 1일 개시 보고기간)에는 2025 전문을 적용한다.',
    },
    catalog_edition_header: header,
    status: 'raw_preserved_and_registered',
};
fs.writeFileSync(PROVENANCE, JSON.stringify(provenance, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output: OUT, sha256: provenance.output_sha256, registered: REGISTERED, same: provenance.output_sha256 === provenance.registered_sha256, wholeSame, comparison }, null, 1));
